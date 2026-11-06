import { enhanceCallouts } from "../layout.js";
import { h, $, button, highlightSQL } from "../lib/ui.js";
import { EXERCISES } from "../lib/exercises.js";
import { createSqlBox, store, renderItems } from "../lib/sqlbox.js";
import { runSQL } from "../lib/db.js";
import { TABLES } from "../lib/company.js";
import { schemaCards } from "../lib/schema.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

const KEY = "nb-progress";
const done = new Set((() => { try { return JSON.parse(store.get(KEY) || "[]"); } catch { return []; } })());
const save = () => store.set(KEY, JSON.stringify([...done]));

$("#schema").append(schemaCards());

// ---- %show: all six tables
const showOut = h("div", { class: "sqlbox-out" });
$("#show").append(h("div", { class: "btn-row" },
  button(tl("Tabloları göster (%show)", "Show the tables (%show)"), async () => {
    showOut.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), tl("MySQL başlatılıyor …", "Starting MySQL …")));
    const res = await runSQL(TABLES.map((t) => `-- ${t}\nSELECT * FROM ${t}`).join(";\n"));
    showOut.replaceChildren();
    renderItems(showOut, res.items);
  }, { kind: "primary" })), showOut);

// ---- progress chips
const progress = $("#progress");
const paintProgress = () => {
  progress.replaceChildren(...EXERCISES.map((e) => h("a", { href: `#ex${e.n}`, class: done.has(e.n) ? "done" : null, title: `${tl("Alıştırma", "Exercise")} ${e.n}: ${tx(e, "topic")}${done.has(e.n) ? tl(" (çözüldü)", " (solved)") : ""}` }, String(e.n))));
  $("#progress-text").textContent = `${done.size} / ${EXERCISES.length} ${tl("çözüldü", "solved")}`;
};

// ---- the exercises
const host = $("#exercises");
for (const ex of EXERCISES) {
  const status = h("span", { class: "ex-status" + (done.has(ex.n) ? " done" : "") }, done.has(ex.n) ? tl("✔ çözüldü", "✔ solved") : tl("çözülmedi", "not solved"));
  const sec = h("section", { class: "exercise", id: `ex${ex.n}` });
  sec.append(
    h("h3", { "data-toc": `${tl("Alıştırma", "Exercise")} ${ex.n} · ${tx(ex, "topic")}` }, `${tl("Alıştırma", "Exercise")} ${ex.n}`, h("span", { class: "stars", title: (EN ? ["", "easy", "medium", "hard"] : ["", "kolay", "orta", "zor"])[ex.stars] }, "★".repeat(ex.stars) + "☆".repeat(3 - ex.stars)), h("span", {}, ex.topic), status),
    h("p", { class: "small muted" }, `${(EN ? ["", "Easy (Ch 6)", "Medium (Ch 7)", "Hard (Ch 7)"] : ["", "Kolay (Ch 6)", "Orta (Ch 7)", "Zor (Ch 7)"])[ex.stars]} · ${tl("slaytlar", "slides")} ${ex.slides}`),
    h("p", { html: `<strong>${tl("Sorgu", "Query")}:</strong> ${tx(ex, "query")}` }),
    EN ? null : h("details", { class: "small muted" }, h("summary", {}, "Notebook'taki İngilizce metin"), h("p", {}, ex.queryEn)),
    h("p", { html: tl(`<strong>Sonuç sütunları (bu sırayla):</strong> ${ex.columns}${ex.ordered ? " · <strong>sıra önemli</strong>" : ""}`, `<strong>Result columns (in this order):</strong> ${tx(ex, "columns")}${ex.ordered ? " · <strong>order matters</strong>" : ""}`) }),
  );
  // two levels of help: where to look, then the shape of the query with blanks
  sec.append(h("div", { class: "hint callout note", "data-label": tl("1. ipucu: nereden başlamalı", "Hint 1: where to start"), html: `<p>${tx(ex, "hint")}</p>` }));
  if (ex.skeleton) {
    const pre = h("pre", { class: "sql" });
    pre.innerHTML = `<code>${highlightSQL(ex.skeleton)}</code>`;
    sec.append(h("div", { class: "hint callout note", "data-label": tl("2. ipucu: sorgunun iskeleti", "Hint 2: the shape of the query") }, h("p", {}, tl("Boşlukları (___) doldurun. Önce 1. ipucunu deneyin; iskelete ancak takılırsanız bakın.", "Fill in the blanks (___). Try hint 1 first; look at the skeleton only if you are stuck.")), pre));
  }
  const box = createSqlBox({
    title: tl(`Alıştırma ${ex.n} <span class="muted">· cevabınız</span>`, `Exercise ${ex.n} <span class="muted">· your answer</span>`),
    code: `-- Exercise ${ex.n} | Your answer\n-- Write your query below this line and run it.\n`,
    saveKey: `sql:notebook:ex${ex.n}`,
    check: { n: ex.n, expect: ex.expect },
    rows: 4,
  });
  sec.append(box);

  // solution, hidden until asked for
  const sol = h("div", { hidden: true });
  sol.append(createSqlBox({ title: tl("Örnek çözüm", "Model solution"), code: ex.solution, check: { n: ex.n, expect: ex.expect }, resetButton: false, foot: false }));
  for (const [i, a] of (ex.alt || []).entries()) sol.append(createSqlBox({ title: `${tl("Alternatif", "Alternative")} ${i + 1}`, code: a, check: { n: ex.n, expect: ex.expect }, resetButton: false, foot: false }));
  sol.append(h("div", { class: "callout key", "data-label": tl("Açıklama", "Explanation"), html: `<p>${tx(ex, "explain")}</p>` }));
  const solBtn = button(tl("Çözümü göster", "Show the solution"), () => {
    if (sol.hidden && !done.has(ex.n) && !confirm(tl("Önce kendiniz denemeniz önerilir. Çözüm gösterilsin mi?", "Try it yourself first. Show the solution anyway?"))) return;
    sol.hidden = !sol.hidden;
    solBtn.textContent = sol.hidden ? tl("Çözümü göster", "Show the solution") : tl("Çözümü gizle", "Hide the solution");
  });
  sec.append(h("div", { class: "btn-row" }, solBtn), sol);

  box.addEventListener("exercisecheck", (e) => {
    if (!e.detail.ok) return;
    done.add(ex.n);
    save();
    status.textContent = tl("✔ çözüldü", "✔ solved");
    status.classList.add("done");
    paintProgress();
  });
  host.append(sec);
}
paintProgress();
enhanceCallouts(host);

$("#reset-progress").addEventListener("click", () => {
  if (!confirm(tl("İlerleme ve kaydedilmiş cevaplarınız silinsin mi?", "Delete your progress and saved answers?"))) return;
  done.clear(); save();
  for (const e of EXERCISES) store.set(`sql:notebook:ex${e.n}`, null);
  location.reload();
});
