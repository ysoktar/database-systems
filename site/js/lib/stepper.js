// A row of buttons, each showing the result of one SQL query from the page's MySQL.
// Used for "conceptual evaluation order" walkthroughs and for comparing join types.
//   steps: [{ label, note (HTML), sql, display, showSql,
//             flag: "col"   a boolean column: false rows are marked (dropped at this step) and the column hidden,
//             group: "col"  rows coloured per value of the column (one colour per group),
//             pad: true     shade NULL cells produced by an outer join,
//             rowsAre: "groups"  each row is a group (counts say groups),
//             flagStyle: "keep"  marked rows stay (an outer join pads them with NULLs) instead of being dropped,
//             flagNote: [tr, en]  the caption for the marked rows ({n} = how many),
//             before: { … } or [{ … }, …]  the input(s) of the step: { sql, flag, flagStyle, flagNote, group, rowsAre, caption }  the input of the step, shown on the left of the result (before → after) }]
import { h, $$, highlightSQL } from "./ui.js";
import { runSQL } from "./db.js";
import { relationTable, startError } from "./sqlbox.js";
import { t as tl } from "./i18n.js";

/** A query result as a table, with dropped rows marked and groups coloured. */
function pane(res, spec, { title, dropText, colors = new Map() } = {}) {
  let { cols, types, rows } = res;
  const find = (c) => (c ? cols.findIndex((x) => x.toLowerCase() === c.toLowerCase()) : -1);
  const fi = find(spec.flag);
  const flags = fi >= 0 ? rows.map((r) => r[fi]) : null;
  if (fi >= 0) {
    cols = cols.filter((_, j) => j !== fi);
    types = types.filter((_, j) => j !== fi);
    rows = rows.map((r) => r.filter((_, j) => j !== fi));
  }
  const gi = spec.group ? cols.findIndex((x) => x.toLowerCase() === spec.group.toLowerCase()) : -1;
  const groupOf = [];
  if (gi >= 0) {
    // one colour per value for the whole stepper, so a group keeps its colour in "before", "after" and every step
    const values = [...new Set(rows.map((r) => r[gi]))].sort((x, y) => (x > y) - (x < y));
    for (const v of values) if (!colors.has(String(v))) colors.set(String(v), colors.size);
    rows.forEach((r, i) => { groupOf[i] = r[gi] == null ? null : colors.get(String(r[gi])); });
  }
  const rowClass = (r, i) => [
    flags && !flags[i] ? (spec.dropStyle === "dim" ? "dim" : spec.flagStyle === "keep" ? "nomatch" : "drop") : "",
    gi >= 0 && groupOf[i] != null && !(flags && !flags[i]) ? `g${groupOf[i] % 6}` : "", // a marked row shows only its mark
    gi >= 0 && spec.groupBorders !== false && i > 0 && groupOf[i] !== groupOf[i - 1] ? "gstart" : "",
    spec.pad && r.some((v) => v === null) ? "pad" : "",
  ].join(" ").trim() || null;
  const groupCount = gi >= 0 ? new Set(groupOf).size : 0;
  const dropped = flags ? flags.filter((f) => !f).length : 0;
  const groups = groupCount;
  const unitTR = spec.rowsAre === "groups" ? "grup" : "satır", unitEN = spec.rowsAre === "groups" ? "groups" : "rows";
  const bits = [tl(`${rows.length} ${unitTR}`, `${rows.length} ${unitEN}`)];
  if (groups && spec.groupBorders !== false && spec.rowsAre !== "groups") bits.push(tl(`${groups} grup`, `${groups} groups`));
  if (flags && spec.flagNote) { if (dropped) bits.push(tl(...spec.flagNote).replace("{n}", dropped)); }
  else if (flags) bits.push(dropText ? dropText(dropped) : tl(`işaretli ${dropped} ${unitTR} bu adımda elenir`, `the ${dropped} marked ${unitEN} are dropped at this step`));
  return h("div", { class: "stepper-pane" },
    title ? h("div", { class: "stepper-pane-title" }, title) : null,
    h("div", { class: "res-caption" }, bits.join(" · ")),
    relationTable(cols, types, rows, { rowClass }));
}

export function queryStepper(steps, { intro } = {}) {
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const note = h("div", { class: "stepper-note" });
  const code = h("pre", { class: "sql", style: { margin: "6px 0" } });
  const out = h("div", { "aria-live": "polite" });
  const box = h("div", { class: "stepper" }, intro ? h("p", { class: "small muted", html: intro }) : null, seg, note, code, out);
  let token = 0;
  const colors = new Map();

  async function show(i) {
    const s = steps[i];
    for (const [k, b] of $$("button", seg).entries()) b.setAttribute("aria-pressed", String(k === i));
    note.innerHTML = s.note || "";
    code.innerHTML = `<code>${highlightSQL(s.display || s.sql)}</code>`;
    code.hidden = s.showSql === false;
    out.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), tl("MySQL çalışıyor …", "MySQL is running …")));
    const my = ++token;
    const befores = s.before ? [].concat(s.before) : [];
    const [res, ...pres] = await Promise.all([runSQL(s.sql), ...befores.map((b) => runSQL(b.sql))]);
    if (my !== token) return;
    out.replaceChildren();
    const bad = [res, ...pres].find((r) => r?.error);
    if (bad?.error?.startup) { out.append(startError(bad.items[0].message)); return; }
    if (bad) { out.append(h("div", { class: "res-msg error" }, bad.error.message)); return; }
    if (!s.before) { out.append(pane(res.last, { ...s, dropStyle: s.flag ? "dim" : undefined }, { colors, dropText: (n) => tl(`soluk olanlar bu adımda elenir (${n})`, `the faded rows are dropped at this step (${n})`) })); return; }
    out.append(h("div", { class: "stepper-compare" },
      h("div", { class: "stepper-inputs" }, ...befores.map((b, k) => pane(pres[k].last, b, { colors, title: b.caption || tl("Önce: bu adıma gelen", "Before: what comes into this step") }))),
      h("div", { class: "stepper-arrow", "aria-hidden": "true" }, s.label.replace(/^\d+ · /, "")),
      pane(res.last, s, { colors, title: s.after || tl("Sonra: bu adımın sonucu", "After: the result of this step") })));
  }

  steps.forEach((s, i) => seg.append(h("button", { type: "button", onclick: () => show(i) }, s.label)));
  // load lazily: the first step runs when the stepper scrolls into view
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); show(0); }
  }, { rootMargin: "200px" });
  io.observe(box);
  return box;
}
