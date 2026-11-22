// "You decide": one question at a time, options with the reason each is right or wrong, a reset button per question,
// a score and dots to jump between questions, and after every answer a worked solution (detail) shown step by step.
// questions: [{ q, pre?, opts: [[label, isRight, why]], detail?: () => Node | Promise<Node> }]
import { h, button } from "./ui.js";
import { runSQL } from "./db.js";
import { relationTable } from "./sqlbox.js";
import { t as tl } from "./i18n.js";

export function decidePlayer(host, questions, { detailLabel = tl("Adım adım çözüm", "Worked solution, step by step") } = {}) {
  let k = 0, answered = [];
  const score = () => answered.filter((j, i) => j != null && questions[i].opts[j][1]).length;
  const head = h("div", { class: "pl-bar" }), card = h("div");
  host.append(h("div", { class: "player" }, head, card));
  const show = () => {
    const d = questions[k];
    const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { k--; show(); });
    const nextB = button(k === questions.length - 1 ? tl("Sonuç", "Result") : tl("Sonraki ▶", "Next ▶"), () => { k++; k < questions.length ? show() : finish(); }, { kind: "primary" });
    prevB.disabled = k === 0; nextB.disabled = answered[k] == null;
    head.replaceChildren(prevB, nextB, h("span", { class: "pl-count" }, tl(`Soru ${k + 1} / ${questions.length} · ${score()} doğru`, `Question ${k + 1} of ${questions.length} · ${score()} correct`)),
      h("div", { class: "pl-dots", style: { margin: 0 } }, ...questions.map((q, j) => h("button", { type: "button", class: "pl-dot" + (j === k ? " on" : "") + (answered[j] == null ? "" : q.opts[answered[j]][1] ? " good" : " bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
    const opts = h("div", { class: "quiz-options" }), fb = h("div"), detail = h("div");
    const pick = async (j, initial = false) => {
      if (!initial) { answered[k] = j; show(); return; }
      [...opts.children].forEach((b, m) => { b.disabled = true; b.classList.toggle("correct", d.opts[m][1]); b.classList.toggle("wrong", m === j && !d.opts[m][1]); });
      const [, ok, why] = d.opts[j], right = d.opts.find((o) => o[1]);
      fb.replaceChildren(h("div", { class: `res-msg ${ok ? "ok" : "warn"}`, style: { fontFamily: "inherit" } }, why),
        ok ? "" : h("p", { class: "small" }, h("strong", {}, tl("Doğru cevap: ", "Correct answer: ")), right[0], ". ", right[2].replace(/^(Doğru|Right)\. /, "")),
        h("div", { class: "btn-row", style: { margin: "6px 0" } }, button(tl("↺ Cevabı sıfırla", "↺ Reset answer"), () => { answered[k] = undefined; show(); })));
      if (d.detail) {
        detail.replaceChildren(h("div", { class: "ba-label" }, detailLabel), h("p", { class: "small muted" }, tl("Hazırlanıyor…", "Preparing…")));
        const node = await d.detail();
        if (questions[k] === d) detail.replaceChildren(h("div", { class: "ba-label" }, detailLabel), node);
      }
    };
    d.opts.forEach(([label], j) => opts.append(h("button", { type: "button", onclick: () => pick(j) }, h("span", { class: "opt-letter" }, "ABCD"[j] + ") "), label)));
    card.replaceChildren(h("p", { class: "decide-q" }, d.q), d.pre ? h("pre", { class: "tx-inline" }, d.pre) : "", opts, fb, detail);
    if (answered[k] != null) pick(answered[k], true);
  };
  const finish = () => {
    k = questions.length - 1;
    head.replaceChildren(button(tl("Baştan başla", "Start again"), () => { k = 0; answered = []; show(); }, { kind: "primary" }));
    card.replaceChildren(h("p", { class: "decide-q" }, tl(`${questions.length} sorudan ${score()} tanesini doğru cevapladınız.`, `You answered ${score()} of ${questions.length} questions correctly.`)),
      h("p", {}, tl("Bir soruya dönmek için numarasına tıklayın; kırmızılar yanlış cevapladıklarınız.", "Click a number to go back to a question; the red ones are those you missed.")),
      h("div", { class: "pl-dots" }, ...questions.map((q, j) => h("button", { type: "button", class: "pl-dot " + (q.opts[answered[j]]?.[1] ? "good" : "bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
  };
  show();
}

/** A worked solution as a chain of steps; each step's SQL equivalent runs on MySQL and is shown with the previous
 *  step's result (before) next to its own result (after). steps: [{ label, expr?, sql, input? }]; input: SQL for the
 *  "before" of a step that starts from a base table instead of the previous result. */
export async function sqlSteps(steps) {
  const run = async (sql) => { const r = await runSQL(sql); return r.error ? { error: r.error.message || String(r.error) } : r.last; };
  const tableOf = (r) => (!r ? h("div", { class: "ba-empty" }, "—") : r.error ? h("div", { class: "res-msg warn" }, r.error) : h("div", {}, relationTable(r.cols, r.types, r.rows), h("div", { class: "small muted" }, tl(`${r.rows.length} satır`, `${r.rows.length} rows`))));
  let prev = null;
  const ol = h("ol", { class: "map-steps" });
  for (const s of steps) {
    // a step with its own input (an independent step, or the first one) shows that input as "before"
    if (s.input) prev = await run(s.input);
    const cur = await run(s.sql);
    ol.append(h("li", {}, h("div", { class: "step-title" }, s.label), s.expr ? h("pre", { class: "algebra" }, s.expr) : "",
      h("details", { class: "small" }, h("summary", {}, tl("SQL karşılığı", "SQL equivalent")), h("pre", { class: "tx-inline" }, s.sql)),
      h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), tableOf(prev)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), tableOf(cur)))));
    prev = cur;
  }
  return ol;
}

/** A worked computation: numbered steps, each a sentence with the value before and after (for calculations). */
export function calcSteps(steps) {
  return h("ol", { class: "map-steps" }, ...steps.map(([title, text]) => h("li", {}, h("div", { class: "step-title" }, title), h("div", { class: "small" }, text))));
}

/** A worked solution for data changes: each step's statement runs inside a transaction that is always rolled back,
 *  so the page's data never changes. Before: `show` on the current data; after: `show` once the statement ran, or the
 *  error MySQL gave (then the data is unchanged). steps: [{ label, sql, show, note? }] */
export async function changeSteps(steps) {
  const ol = h("ol", { class: "map-steps" });
  const tableOf = (r) => h("div", {}, relationTable(r.cols, r.types, r.rows), h("div", { class: "small muted" }, tl(`${r.rows.length} satır`, `${r.rows.length} rows`)));
  for (const s of steps) {
    const before = await runSQL(s.show);
    const r = await runSQL(`START TRANSACTION;\n${s.sql}\n${s.show}`);
    const after = r.error ? null : r.last;
    await runSQL("ROLLBACK");
    const err = r.error ? h("div", {}, h("div", { class: "res-msg error" }, `${tl("HATA", "ERROR")} ${r.error.code ?? ""} (${r.error.state ?? ""}): ${r.error.message}`), h("p", { class: "small" }, tl("DBMS işlemi reddetti; tablo değişmedi.", "The DBMS rejected the statement; the table did not change."))) : null;
    ol.append(h("li", {}, h("div", { class: "step-title" }, s.label), h("pre", { class: "tx-inline" }, s.sql),
      h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), before.last ? tableOf(before.last) : "—"), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), err || tableOf(after))),
      s.note ? h("p", { class: "small" }, s.note) : ""));
  }
  ol.append(h("p", { class: "small muted" }, tl("Her adım bir transaction içinde çalıştı ve geri alındı (ROLLBACK); sayfanın verisi değişmedi.", "Each step ran inside a transaction that was rolled back (ROLLBACK); the page's data did not change.")));
  return ol;
}
