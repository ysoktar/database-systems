// Midterm study guide: exam-style SQL problems checked against a model solution, a worked ER design problem,
// and a practice set dealt from the guide's own question bank plus the quizzes of every chapter page.
import { enhanceQuizzes, enhanceCallouts, PAGES } from "../layout.js";
import { h, $, $$, button } from "../lib/ui.js";
import { createSqlBox } from "../lib/sqlbox.js";
import { SQL_PROBLEMS } from "../lib/exam-problems.js";
import { mountExercise } from "../lib/er-inline.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

// ---- the ER design problem: draw it on the page, check it, open the solution
mountExercise($("#er-draw"), "university", { showText: false });

// ---- SQL problems
const host = $("#sql-list");
for (const p of SQL_PROBLEMS) {
  const sec = h("section", { class: "exercise", id: p.id });
  sec.append(h("h3", { "data-toc": `Problem ${p.id.slice(1)} · ${tx(p, "title")}` }, `Problem ${p.id.slice(1)}`, h("span", { class: "stars" }, "★".repeat(p.level) + "☆".repeat(3 - p.level)), h("span", {}, tx(p, "title"))),
    h("p", { html: tx(p, "text") }),
    h("div", { class: "hint callout note", "data-label": tl("İpucu", "Hint"), html: `<p>${tx(p, "hint")}</p>` }));
  sec.append(createSqlBox({
    title: `Problem ${p.id.slice(1)} <span class="muted">· ${tl("cevabınız", "your answer")}</span>`,
    code: "-- your query\n", saveKey: `sql:exam:${p.id}`, rows: 4,
    reference: { sql: p.solution, label: `Problem ${p.id.slice(1)}` },
  }));
  const sol = h("div", { hidden: true },
    createSqlBox({ title: tl("Örnek çözüm", "Model solution"), code: p.solution, resetButton: false, foot: false }),
    h("div", { class: "callout key", "data-label": tl("Açıklama", "Explanation"), html: `<p>${tx(p, "explain")}</p>` }));
  const b = button(tl("Çözümü göster", "Show the solution"), () => { sol.hidden = !sol.hidden; b.textContent = sol.hidden ? tl("Çözümü göster", "Show the solution") : tl("Çözümü gizle", "Hide the solution"); });
  sec.append(h("div", { class: "btn-row" }, b), sol);
  host.append(sec);
}
enhanceCallouts(host);


// ---- practice set
const bank = $("#bank");
const own = $$(".quiz", $("#exam-questions").content).map((q) => ({ topic: q.dataset.topic || "Rehber", html: q.outerHTML }));
const chapterPages = PAGES.filter((p) => p.scope === "midterm");
const list = h("div");
const score = h("span", { class: "bank-score", "aria-live": "polite" });
let pool = null, size = 10, answered = 0, correct = 0;
const on = new Set(["Rehber", ...chapterPages.map((p) => p.id)]);
const paintScore = () => { score.textContent = answered ? tl(`İlk denemede ${answered} sorudan ${correct} doğru`, `${correct} of ${answered} right on the first try`) : tl("Puan, bir soruyu cevaplayınca başlar.", "The score starts when you answer a question."); };

async function loadPool() {
  if (pool) return pool;
  const parser = new DOMParser();
  const pages = await Promise.all(chapterPages.map(async (p) => {
    try {
      const doc = parser.parseFromString(await (await fetch(`${p.id}.html`)).text(), "text/html");
      return $$(".quiz", doc).map((q) => ({ topic: p.id, html: q.outerHTML }));
    } catch { return []; }
  }));
  pool = [...own, ...pages.flat()];
  return pool;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function deal() {
  const all = await loadPool();
  const pick = shuffle(all.filter((q) => on.has(q.topic))).slice(0, size || undefined);
  answered = 0; correct = 0; paintScore();
  list.replaceChildren(...pick.map((q) => {
    const box = h("div", { html: q.html });
    const info = PAGES.find((p) => p.id === q.topic);
    box.append(h("div", { class: "quiz-src" }, info ? h("a", { href: `${info.id}.html` }, `${info.title} · ${info.ch}`) : tl("Arasınav rehberi", "Midterm guide")));
    return box;
  }));
  if (!pick.length) list.append(h("p", { class: "muted" }, tl("Soru seçilmedi: yukarıdan en az bir konu işaretleyin.", "No questions selected: tick at least one topic above.")));
  enhanceQuizzes(list);
}
list.addEventListener("quizanswer", (e) => { if (!e.detail.firstTry) return; answered++; if (e.detail.correct) correct++; paintScore(); });

const topicBox = h("div", { class: "bank-topics" });
for (const [id, label] of [["Rehber", tl("Rehberin soruları", "The guide's questions")], ...chapterPages.map((p) => [p.id, `${p.ch} · ${p.title}`])]) {
  const input = h("input", { type: "checkbox" });
  input.checked = true;
  input.addEventListener("change", () => { if (input.checked) on.add(id); else on.delete(id); deal(); });
  topicBox.append(h("label", {}, input, label));
}
const sizeSel = h("select", { "aria-label": tl("Soru sayısı", "Number of questions") }, ...[["10", 10], ["20", 20], [tl("Hepsi", "All"), 0]].map(([l, v]) => h("option", { value: v }, l)));
sizeSel.addEventListener("change", () => { size = Number(sizeSel.value); deal(); });
bank.append(h("div", { class: "bank-bar" }, h("label", { class: "small" }, tl("Soru sayısı: ", "Number of questions: "), sizeSel), button(tl("Yeni set", "New set"), deal, { kind: "primary" }), score), topicBox, list);
bank.classList.add("bank");
deal();
