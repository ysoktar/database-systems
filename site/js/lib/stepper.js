// A row of buttons, each showing the result of one SQL query from the page's MySQL.
// Used for "conceptual evaluation order" walkthroughs and for comparing join types.
//   steps: [{ label, note (HTML), sql, flag: "col" (boolean column: false rows are dimmed and the column hidden),
//             group: "col" (alternate shading per value), pad: true (shade NULL cells produced by an outer join),
//             showSql: true }]
import { h, $$, highlightSQL } from "./ui.js";
import { runSQL } from "./db.js";
import { relationTable, startError } from "./sqlbox.js";

export function queryStepper(steps, { intro } = {}) {
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const note = h("div", { class: "stepper-note" });
  const code = h("pre", { class: "sql", style: { margin: "6px 0" } });
  const out = h("div", { "aria-live": "polite" });
  const box = h("div", { class: "stepper" }, intro ? h("p", { class: "small muted", html: intro }) : null, seg, note, code, out);
  let token = 0;

  async function show(i) {
    const s = steps[i];
    for (const [k, b] of $$("button", seg).entries()) b.setAttribute("aria-pressed", String(k === i));
    note.innerHTML = s.note || "";
    code.innerHTML = `<code>${highlightSQL(s.display || s.sql)}</code>`;
    code.hidden = s.showSql === false;
    out.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "MySQL çalışıyor …"));
    const my = ++token;
    const res = await runSQL(s.sql);
    if (my !== token) return;
    out.replaceChildren();
    if (res.error?.startup) { out.append(startError(res.items[0].message)); return; }
    if (res.error) { out.append(h("div", { class: "res-msg error" }, res.error.message)); return; }
    let { cols, types, rows } = res.last;
    let rowClass = null;
    const fi = s.flag ? cols.indexOf(s.flag) : -1;
    const gi = s.group ? cols.indexOf(s.group) : -1;
    const flags = fi >= 0 ? rows.map((r) => r[fi]) : null;
    if (fi >= 0) {
      cols = cols.filter((_, j) => j !== fi);
      types = types.filter((_, j) => j !== fi);
      rows = rows.map((r) => r.filter((_, j) => j !== fi));
    }
    let shade = [];
    if (gi >= 0) {
      const gIdx = fi >= 0 && fi < gi ? gi - 1 : gi;
      let last, on = false;
      shade = rows.map((r) => { if (r[gIdx] !== last) { on = !on; last = r[gIdx]; } return on; });
    }
    rowClass = (r, i) => [flags && !flags[i] ? "dim" : "", shade[i] ? "hl" : "", s.pad && r.some((v) => v === null) ? "pad" : ""].join(" ").trim() || null;
    out.append(h("div", { class: "res-caption" }, `${rows.length} satır` + (flags ? ` · soluk olanlar bu adımda elenir (${flags.filter((f) => !f).length})` : "")));
    out.append(relationTable(cols, types, rows, { rowClass }));
  }

  steps.forEach((s, i) => seg.append(h("button", { type: "button", onclick: () => show(i) }, s.label)));
  // load lazily: the first step runs when the stepper scrolls into view
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); show(0); }
  }, { rootMargin: "200px" });
  io.observe(box);
  return box;
}
