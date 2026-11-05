import { enhanceCallouts } from "../layout.js";
import { h, $, button } from "../lib/ui.js";
import { EXERCISES } from "../lib/exercises.js";
import { createSqlBox, store, renderItems } from "../lib/sqlbox.js";
import { runSQL } from "../lib/db.js";
import { TABLES } from "../lib/company.js";
import { schemaCards } from "../lib/schema.js";

const KEY = "nb-progress";
const done = new Set((() => { try { return JSON.parse(store.get(KEY) || "[]"); } catch { return []; } })());
const save = () => store.set(KEY, JSON.stringify([...done]));

$("#schema").append(schemaCards());

// ---- %show: all six tables
const showOut = h("div", { class: "sqlbox-out" });
$("#show").append(h("div", { class: "btn-row" },
  button("Tabloları göster (%show)", async () => {
    showOut.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "PostgreSQL başlatılıyor …"));
    const res = await runSQL(TABLES.map((t) => `-- ${t}\nSELECT * FROM ${t}`).join(";\n"));
    showOut.replaceChildren();
    renderItems(showOut, res.items);
  }, { kind: "primary" })), showOut);

// ---- progress chips
const progress = $("#progress");
const paintProgress = () => {
  progress.replaceChildren(...EXERCISES.map((e) => h("a", { href: `#ex${e.n}`, class: done.has(e.n) ? "done" : null, title: `Alıştırma ${e.n}: ${e.topic}${done.has(e.n) ? " (çözüldü)" : ""}` }, String(e.n))));
  $("#progress-text").textContent = `${done.size} / ${EXERCISES.length} çözüldü`;
};

// ---- the exercises
const host = $("#exercises");
for (const ex of EXERCISES) {
  const status = h("span", { class: "ex-status" + (done.has(ex.n) ? " done" : "") }, done.has(ex.n) ? "✔ çözüldü" : "çözülmedi");
  const sec = h("section", { class: "exercise", id: `ex${ex.n}` });
  sec.append(
    h("h3", { "data-toc": `Alıştırma ${ex.n} · ${ex.topic}` }, `Alıştırma ${ex.n}`, h("span", { class: "stars", title: ["", "kolay", "orta", "zor"][ex.stars] }, "★".repeat(ex.stars) + "☆".repeat(3 - ex.stars)), h("span", {}, ex.topic), status),
    h("p", { class: "small muted" }, `${["", "Kolay (Ch 6)", "Orta (Ch 7)", "Zor (Ch 7)"][ex.stars]} · slaytlar ${ex.slides}`),
    h("p", { html: `<strong>Sorgu:</strong> ${ex.query}` }),
    h("details", { class: "small muted" }, h("summary", {}, "Notebook'taki İngilizce metin"), h("p", {}, ex.queryEn)),
    h("p", { html: `<strong>Sonuç sütunları (bu sırayla):</strong> ${ex.columns}${ex.ordered ? " · <strong>sıra önemli</strong>" : ""}` }),
  );
  const hint = h("div", { class: "hint callout note", "data-label": "İpucu", html: `<p>${ex.hint}</p>` });
  sec.append(hint);
  const box = createSqlBox({
    title: `Alıştırma ${ex.n} <span class="muted">· cevabınız</span>`,
    code: `-- Exercise ${ex.n} | Your answer\n-- Write your query below this line and run it.\n`,
    saveKey: `sql:notebook:ex${ex.n}`,
    check: { n: ex.n, expect: ex.expect },
    rows: 4,
  });
  sec.append(box);

  // solution, hidden until asked for
  const sol = h("div", { hidden: true });
  sol.append(createSqlBox({ title: "Örnek çözüm", code: ex.solution, check: { n: ex.n, expect: ex.expect }, resetButton: false, foot: false }));
  for (const [i, a] of (ex.alt || []).entries()) sol.append(createSqlBox({ title: `Alternatif ${i + 1}`, code: a, check: { n: ex.n, expect: ex.expect }, resetButton: false, foot: false }));
  sol.append(h("div", { class: "callout key", "data-label": "Açıklama", html: `<p>${ex.explain}</p>` }));
  const solBtn = button("Çözümü göster", () => {
    if (sol.hidden && !done.has(ex.n) && !confirm("Önce kendiniz denemeniz önerilir. Çözüm gösterilsin mi?")) return;
    sol.hidden = !sol.hidden;
    solBtn.textContent = sol.hidden ? "Çözümü göster" : "Çözümü gizle";
  });
  sec.append(h("div", { class: "btn-row" }, solBtn), sol);

  box.addEventListener("exercisecheck", (e) => {
    if (!e.detail.ok) return;
    done.add(ex.n);
    save();
    status.textContent = "✔ çözüldü";
    status.classList.add("done");
    paintProgress();
  });
  host.append(sec);
}
paintProgress();
enhanceCallouts(host);

$("#reset-progress").addEventListener("click", () => {
  if (!confirm("İlerleme ve kaydedilmiş cevaplarınız silinsin mi?")) return;
  done.clear(); save();
  for (const e of EXERCISES) store.set(`sql:notebook:ex${e.n}`, null);
  location.reload();
});
