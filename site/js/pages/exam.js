// Midterm study guide: exam-style SQL problems checked against a model solution, a worked ER design problem,
// and a practice set dealt from the guide's own question bank plus the quizzes of every chapter page.
import { enhanceQuizzes, enhanceCallouts, PAGES } from "../layout.js";
import { h, $, $$, button } from "../lib/ui.js";
import { createSqlBox } from "../lib/sqlbox.js";
import { SQL_PROBLEMS } from "../lib/exam-problems.js";
import { erFigure } from "../lib/erd.js";
import { createEditor } from "../lib/ereditor.js";
import { ER_EXERCISES, compareER, solutionModel } from "../lib/er-exercises.js";
import { ER_EXAMPLES } from "../lib/er-examples.js";
import { emptyModel } from "../lib/ermodel.js";

// ---- drawing area for the ER design problem, checked against the model solution
const erEditor = createEditor($("#er-draw"), { storageKey: "er-exam-university" });
const uni = ER_EXERCISES.find((x) => x.id === "university");
$("#er-check").addEventListener("click", () => {
  const r = compareER(erEditor.getModel(), solutionModel(uni, ER_EXAMPLES));
  const pct = r.total ? Math.round((100 * r.score) / r.total) : 0;
  const wrong = r.items.filter((i) => i.ok === false).length;
  const list = h("ul", { class: "check-list" }, ...r.items.sort((a, b) => (a.ok === b.ok ? 0 : a.ok === false ? -1 : b.ok === false ? 1 : 0))
    .map((i) => h("li", { class: i.ok === true ? "ok" : i.ok === false ? "no" : "meh", html: i.text })));
  $("#er-result").replaceChildren(
    h("div", { class: `res-msg ${pct === 100 ? "ok" : "warn"}` }, pct === 100 ? `✔ Tam uyum: ${r.score} / ${r.total} kontrol.` : `${r.score} / ${r.total} kontrol doğru (%${pct}).`),
    h("details", { class: "disclosure", open: wrong > 0 && wrong <= 8 }, h("summary", {}, wrong ? `Ayrıntılar: ${wrong} düzeltilecek madde` : "Ayrıntılar"), h("div", { class: "disclosure-body" }, list)));
});
$("#er-clear").addEventListener("click", () => { if (confirm("Çizim temizlensin mi? (Geri al ile dönebilirsiniz.)")) { erEditor.setModel(emptyModel()); $("#er-result").replaceChildren(); } });

// ---- SQL problems
const host = $("#sql-list");
for (const p of SQL_PROBLEMS) {
  const sec = h("section", { class: "exercise", id: p.id });
  sec.append(h("h3", { "data-toc": `Problem ${p.id.slice(1)} · ${p.title}` }, `Problem ${p.id.slice(1)}`, h("span", { class: "stars" }, "★".repeat(p.level) + "☆".repeat(3 - p.level)), h("span", {}, p.title)),
    h("p", { html: p.text }),
    h("div", { class: "hint callout note", "data-label": "İpucu", html: `<p>${p.hint}</p>` }));
  sec.append(createSqlBox({
    title: `Problem ${p.id.slice(1)} <span class="muted">· cevabınız</span>`,
    code: "-- your query\n", saveKey: `sql:exam:${p.id}`, rows: 4,
    reference: { sql: p.solution, label: `Problem ${p.id.slice(1)}` },
  }));
  const sol = h("div", { hidden: true },
    createSqlBox({ title: "Örnek çözüm", code: p.solution, resetButton: false, foot: false }),
    h("div", { class: "callout key", "data-label": "Açıklama", html: `<p>${p.explain}</p>` }));
  const b = button("Çözümü göster", () => { sol.hidden = !sol.hidden; b.textContent = sol.hidden ? "Çözümü göster" : "Çözümü gizle"; });
  sec.append(h("div", { class: "btn-row" }, b), sol);
  host.append(sec);
}
enhanceCallouts(host);

// ---- worked ER design problem: a small university
$("#er-solution").append(erFigure({
  title: "Çözüm: üniversite ER şeması",
  width: 900, height: 430,
  nodes: [
    { id: "ST", type: "entity", x: 120, y: 220, label: "STUDENT" },
    { id: "SE", type: "entity", x: 470, y: 220, label: "SECTION", weak: true },
    { id: "CO", type: "entity", x: 790, y: 220, label: "COURSE" },
    { id: "IN", type: "entity", x: 470, y: 390, label: "INSTRUCTOR" },
    { id: "DE", type: "entity", x: 790, y: 390, label: "DEPARTMENT" },
    { id: "EN", type: "rel", x: 295, y: 220, label: "ENROLLS" },
    { id: "OF", type: "rel", x: 630, y: 220, label: "OFFERING_OF", ident: true },
    { id: "TE", type: "rel", x: 470, y: 305, label: "TEACHES" },
    { id: "OFR", type: "rel", x: 790, y: 305, label: "OFFERS" },
    { id: "WI", type: "rel", x: 630, y: 390, label: "WORKS_IN" },
    { id: "PR", type: "rel", x: 790, y: 110, label: "PREREQ" },
    { id: "s1", type: "attr", x: 50, y: 160, label: "Sid", key: true, of: "ST" },
    { id: "s2", type: "attr", x: 130, y: 135, label: "Name", of: "ST" },
    { id: "s3", type: "attr", x: 60, y: 290, label: "Phones", multi: true, of: "ST" },
    { id: "s4", type: "attr", x: 175, y: 300, label: "Gpa", derived: true, of: "ST" },
    { id: "g", type: "attr", x: 295, y: 155, label: "Grade", of: "EN" },
    { id: "e1", type: "attr", x: 400, y: 150, label: "Sec_no", pkey: true, of: "SE" },
    { id: "e2", type: "attr", x: 480, y: 140, label: "Semester", pkey: true, of: "SE" },
    { id: "e3", type: "attr", x: 560, y: 150, label: "Year", pkey: true, of: "SE" },
    { id: "c1", type: "attr", x: 880, y: 175, label: "Code", key: true, of: "CO" },
    { id: "c2", type: "attr", x: 880, y: 255, label: "Credits", of: "CO" },
    { id: "i1", type: "attr", x: 370, y: 410, label: "Iid", key: true, of: "IN" },
    { id: "d1", type: "attr", x: 880, y: 405, label: "Dname", key: true, of: "DE" },
  ],
  links: [
    { a: "EN", b: "ST", card: "M" }, { a: "EN", b: "SE", card: "N" },
    { a: "OF", b: "SE", card: "N", total: true }, { a: "OF", b: "CO", card: "1" },
    { a: "TE", b: "SE", card: "N", total: true, cardSide: -10 }, { a: "TE", b: "IN", card: "1", cardSide: -10 },
    { a: "OFR", b: "CO", card: "N", total: true, cardSide: -10 }, { a: "OFR", b: "DE", card: "1", cardSide: -10 },
    { a: "WI", b: "IN", card: "N", total: true }, { a: "WI", b: "DE", card: "1" },
    { a: "PR", b: "CO", via: [[700, 110]], card: "M", role: "course", roleSide: -12 },
    { a: "PR", b: "CO", via: [[880, 110]], card: "N", role: "prereq", roleSide: -12 },
  ],
}, "Bir çözüm (gerekçeler aşağıda)."));

// ---- practice set
const bank = $("#bank");
const own = $$(".quiz", $("#exam-questions").content).map((q) => ({ topic: q.dataset.topic || "Rehber", html: q.outerHTML }));
const chapterPages = PAGES.filter((p) => p.scope === "midterm");
const list = h("div");
const score = h("span", { class: "bank-score", "aria-live": "polite" });
let pool = null, size = 10, answered = 0, correct = 0;
const on = new Set(["Rehber", ...chapterPages.map((p) => p.id)]);
const paintScore = () => { score.textContent = answered ? `İlk denemede ${answered} sorudan ${correct} doğru` : "Puan, bir soruyu cevaplayınca başlar."; };

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
    box.append(h("div", { class: "quiz-src" }, info ? h("a", { href: `${info.id}.html` }, `${info.title} · ${info.ch}`) : "Arasınav rehberi"));
    return box;
  }));
  if (!pick.length) list.append(h("p", { class: "muted" }, "Soru seçilmedi: yukarıdan en az bir konu işaretleyin."));
  enhanceQuizzes(list);
}
list.addEventListener("quizanswer", (e) => { if (!e.detail.firstTry) return; answered++; if (e.detail.correct) correct++; paintScore(); });

const topicBox = h("div", { class: "bank-topics" });
for (const [id, label] of [["Rehber", "Rehberin soruları"], ...chapterPages.map((p) => [p.id, `${p.ch} · ${p.title}`])]) {
  const input = h("input", { type: "checkbox" });
  input.checked = true;
  input.addEventListener("change", () => { if (input.checked) on.add(id); else on.delete(id); deal(); });
  topicBox.append(h("label", {}, input, label));
}
const sizeSel = h("select", { "aria-label": "Soru sayısı" }, ...[["10", 10], ["20", 20], ["Hepsi", 0]].map(([l, v]) => h("option", { value: v }, l)));
sizeSel.addEventListener("change", () => { size = Number(sizeSel.value); deal(); });
bank.append(h("div", { class: "bank-bar" }, h("label", { class: "small" }, "Soru sayısı: ", sizeSel), button("Yeni set", deal, { kind: "primary" }), score), topicBox, list);
bank.classList.add("bank");
deal();
