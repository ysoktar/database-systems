// Site chrome shared by every page: header, navigation, pager, footer, theme, callouts, quizzes, SQL boxes.
// Each page's module imports this first; the page itself only contains its article.
import { h, $, $$, CALLOUT_ICONS } from "./lib/ui.js";
import { enhanceSQL, tableContext } from "./lib/sqlbox.js";
import { t as tl, tx, EN } from "./lib/i18n.js";
import { GLOSSARY } from "./lib/glossary.js";

export const REPO = "https://github.com/ysoktar/database-systems";
export const NOTEBOOK_URL = "https://colab.research.google.com/drive/1ArUuenMYSnN0ZNk_1Gsmn-CvnUnUeS30?usp=sharing";

/**
 * Site map. `ch` = chapter of Elmasri & Navathe (7th ed.). `slides`: the slide range of the course's slide deck that the page
 * covers (the syllabus limits some chapters, e.g. Ch 8 slides 1–67).
 */
export const NAV = [
  { part: "Başlangıç", part_en: "Start", items: [
    { id: "index", title: "Genel bakış", title_en: "Overview", desc_en: "Exam scope, plan and how to use the site.", desc: "Sınav kapsamı, plan ve sitenin kullanımı." },
  ] },
  { part: "Bölüm I · Kavramlar", part_en: "Part I · Concepts", short: "Ch 1–2", items: [
    { id: "ch1-intro", title: "Veritabanı ve DBMS", title_en: "Databases and DBMS", desc_en: "Characteristics of the database approach, actors, advantages.", ch: "Ch 1", desc: "Veritabanı yaklaşımının özellikleri, aktörler, avantajlar." },
    { id: "ch2-architecture", title: "Mimari ve veri modelleri", title_en: "Architecture and data models", desc_en: "Schema/state, three-schema architecture, data independence, languages.", ch: "Ch 2", desc: "Şema/durum, üç-şema mimarisi, veri bağımsızlığı, diller." },
  ] },
  { part: "Bölüm II · Kavramsal modelleme", part_en: "Part II · Conceptual modelling", short: "Ch 3–4", items: [
    { id: "ch3-er", title: "ER modeli", title_en: "The ER model", desc_en: "Entity, attribute, key, relationship, cardinality, participation, weak entity.", ch: "Ch 3", desc: "Varlık, öznitelik, anahtar, ilişki, kardinalite, katılım, zayıf varlık." },
    { id: "ch4-eer", title: "EER modeli", title_en: "The EER model", desc_en: "Subclass/superclass, specialization, disjoint/overlap, total/partial, category.", ch: "Ch 4", desc: "Alt/üst sınıf, özelleştirme, disjoint/overlap, total/partial, kategori." },
  ] },
  { part: "Bölüm III · İlişkisel model", part_en: "Part III · Relational model", short: "Ch 5", items: [
    { id: "ch5-relational", title: "İlişkisel model ve kısıtlar", title_en: "Relational model and constraints", desc_en: "Keys, integrity constraints, update operations and violations.", ch: "Ch 5", desc: "Anahtarlar, bütünlük kısıtları, güncelleme işlemleri ve ihlaller." },
  ] },
  { part: "Bölüm IV · SQL", part_en: "Part IV · SQL", short: "Ch 6–7", items: [
    { id: "ch6-sql", title: "Temel SQL", title_en: "Basic SQL", desc_en: "CREATE TABLE, SELECT-FROM-WHERE, LIKE, ORDER BY, INSERT/UPDATE/DELETE.", ch: "Ch 6", desc: "CREATE TABLE, SELECT-FROM-WHERE, LIKE, ORDER BY, INSERT/UPDATE/DELETE." },
    { id: "ch7-nested", title: "NULL ve iç içe sorgular", title_en: "NULL and nested queries", desc_en: "Three-valued logic, IN/ANY/ALL, correlated queries, EXISTS, division.", ch: "Ch 7.1", desc: "Üç değerli mantık, IN/ANY/ALL, correlated sorgu, EXISTS, bölme." },
    { id: "ch7-joins", title: "Join, gruplama, WITH", title_en: "Joins, grouping, WITH", desc_en: "Outer joins, aggregates, GROUP BY/HAVING, CASE, WITH RECURSIVE.", ch: "Ch 7.1", desc: "Outer join, aggregate, GROUP BY/HAVING, CASE, WITH RECURSIVE." },
    { id: "ch7-views", title: "Kısıtlar, trigger, view, ALTER", title_en: "Constraints, triggers, views, ALTER", desc_en: "ASSERTION, triggers, views and updatability, schema change.", ch: "Ch 7.2–7.4", desc: "ASSERTION, trigger, view ve güncellenebilirlik, şema değişikliği." },
  ] },
  { part: "Bölüm V · İlişkisel cebir", part_en: "Part V · Relational algebra", short: "Ch 8", items: [
    { id: "ch8-algebra", title: "İlişkisel cebir", title_en: "Relational algebra", desc_en: "σ, π, ρ, set operations, joins, division, query trees, aggregates, outer joins.", ch: "Ch 8", slides: "1–67", desc: "σ, π, ρ, küme işlemleri, join'ler, bölme, sorgu ağaçları, aggregate, outer join." },
  ] },
  { part: "Bölüm VI · Veritabanı tasarımı", part_en: "Part VI · Database design", short: "Ch 9, 14", items: [
    { id: "ch9-mapping", title: "ER'den tablolara eşleme", title_en: "ER-to-relational mapping", desc_en: "The mapping algorithm: Steps 1–7 for ER, 8A–8D for specializations, 9 for categories.", ch: "Ch 9", slides: "1–38", desc: "Eşleme algoritması: ER için Adım 1–7, özelleştirme için 8A–8D, kategoriler için Adım 9." },
    { id: "ch14-normalization", title: "Fonksiyonel bağımlılık ve normalizasyon", title_en: "Functional dependencies and normalization", desc_en: "Design guidelines and anomalies, FDs, keys, 1NF, 2NF, 3NF, BCNF, lossless decomposition.", ch: "Ch 14", slides: "1–55", desc: "Tasarım kuralları ve anomaliler, FD'ler, anahtarlar, 1NF, 2NF, 3NF, BCNF, kayıpsız ayrıştırma." },
  ] },
  { part: "Bölüm VII · Depolama ve indeksleme", part_en: "Part VII · Storage and indexing", short: "Ch 16, 17", items: [
    { id: "ch16-files", title: "Disk depolama, dosyalar ve hashing", title_en: "Disk storage, files and hashing", desc_en: "Storage hierarchy, disks, buffer management, blocking, heap and sorted files, hashing, RAID.", ch: "Ch 16", slides: "1–41", desc: "Depolama hiyerarşisi, diskler, tampon yönetimi, bloklama, heap ve sıralı dosyalar, hashing, RAID." },
    { id: "ch17-indexing", title: "İndeks yapıları", title_en: "Indexing structures", desc_en: "Primary, clustering and secondary indexes, multilevel indexes, B-trees and B+-trees.", ch: "Ch 17", slides: "1–41", desc: "Birincil, kümeleme ve ikincil indeksler, çok seviyeli indeksler, B-ağaçları ve B+-ağaçları." },
  ] },
  { part: "Bölüm VIII · Transaction'lar ve programlama", part_en: "Part VIII · Transactions and programming", short: "Ch 11, 20", items: [
    { id: "ch11-php", title: "PHP ile web veritabanı programlama", title_en: "Web database programming with PHP", desc_en: "Three-tier web architecture, PHP basics, arrays, forms, PEAR DB, placeholders, fetchRow and getAll.", ch: "Ch 11", slides: "1–35", desc: "Üç katmanlı web mimarisi, PHP temelleri, diziler, formlar, PEAR DB, placeholder'lar, fetchRow ve getAll." },
    { id: "ch20-transactions", title: "Transaction işleme", title_en: "Transaction processing", desc_en: "Concurrency problems, transaction states and the log, ACID, recoverable and serializable schedules, isolation levels.", ch: "Ch 20", slides: "1–44", desc: "Eşzamanlılık sorunları, transaction durumları ve log, ACID, kurtarılabilir ve serileştirilebilir çizelgeler, izolasyon seviyeleri." },
  ] },
  { part: "Uygulama", part_en: "Practice", items: [
    { id: "er-studio", title: "ER stüdyosu", title_en: "ER studio", desc_en: "Draw ER/EER, map to tables, turn tables back into ER; design exercises.", desc: "ER/EER çiz, tablolara dönüştür, tablolardan ER'e geri dön; tasarım alıştırmaları." },
    { id: "notebook", title: "Notebook alıştırmaları", title_en: "Notebook exercises", desc_en: "The 10 SQL exercises of the Colab notebook, with the same checker.", desc: "Colab notebook'undaki 10 SQL alıştırması, aynı kontrolcüyle." },
    { id: "lab", title: "SQL laboratuvarı", title_en: "SQL lab", desc_en: "A free query console on COMPANY and a schema browser.", desc: "COMPANY üzerinde serbest sorgu konsolu ve şema tarayıcı." },
  ] },
  { part: "Sınav", part_en: "Exam", items: [
    { id: "exam-midterm", title: "Arasınav çalışma rehberi", title_en: "Midterm study guide", desc_en: "What to know chapter by chapter, worked problems, a practice set.", desc: "Bölüm bölüm bilinmesi gerekenler, çözümlü sorular, deneme seti." },
    { id: "exam-final", title: "Final çalışma rehberi", title_en: "Final exam study guide", desc_en: "All topics: a scope map, a study plan, an end-to-end worked problem from requirements to transactions, a mixed practice set.", desc: "Bütün konular: kapsam haritası, çalışma planı, gereksinimden transaction'a uçtan uca çözümlü problem, karışık deneme seti." },
    { id: "cheatsheet", title: "Özet kâğıdı ve sözlük", title_en: "Cheat sheet and glossary", desc_en: "SQL syntax, ER notation, algebra, normal forms, file and index formulas, transactions, Turkish–English terms.", desc: "SQL sözdizimi, ER gösterimi, cebir, normal formlar, dosya ve indeks formülleri, transaction'lar, Türkçe–İngilizce terimler." },
  ] },
];

const ALL = NAV.flatMap((p) => p.items.map((it) => ({ ...it, title: tx(it, "title"), desc: tx(it, "desc"), part: tx(p, "part"), short: p.short })));
export const pageInfo = (id) => ALL.find((p) => p.id === id);
export const PAGES = ALL;
const href = (id) => (id === "index" ? "index.html" : `${id}.html`);
/** The same page in the other language: Turkish pages are in site/, English ones in site/en/. */
const otherLangHref = (id) => (EN ? `../${href(id)}` : `en/${href(id)}`);

const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
  <ellipse cx="14" cy="6.5" rx="9" ry="3.5" fill="var(--accent)"/>
  <path d="M5 6.5v15c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-15" fill="none" stroke="var(--accent)" stroke-width="2"/>
  <path d="M5 11.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5M5 16.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5" fill="none" stroke="var(--text-2)" stroke-width="1.8"/></svg>`;

const THEME_ICONS = {
  auto: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor"/></svg>',
  light: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>',
};
const THEME_NAMES = EN ? { auto: "Auto", light: "Light", dark: "Dark" } : { auto: "Otomatik", light: "Açık", dark: "Koyu" };

function getTheme() {
  try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; }
}
function setTheme(t) {
  try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage unavailable */ }
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

function buildHeader() {
  const themeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": tl("Renk teması", "Colour theme") });
  const paintTheme = () => {
    const t = getTheme();
    themeBtn.innerHTML = THEME_ICONS[t] + `<span class="label">${THEME_NAMES[t]}</span>`;
    themeBtn.title = tl(`Tema: ${THEME_NAMES[t]} (değiştirmek için tıklayın)`, `Theme: ${THEME_NAMES[t]} (click to change)`);
  };
  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    setTheme(order[(order.indexOf(getTheme()) + 1) % 3]);
    paintTheme();
  });
  paintTheme();
  const menu = h("button", { class: "icon-btn menu-btn", type: "button", "aria-label": tl("Menüyü aç", "Open the menu"), "aria-expanded": "false" });
  menu.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" stroke-width="1.8"><path d="M2 4.5h14M2 9h14M2 13.5h14"/></svg>';
  menu.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  const brand = h("a", { class: "brand", href: "index.html" });
  brand.innerHTML = LOGO;
  brand.append(h("span", { class: "brand-title" }, tl("Veritabanı Sistemleri", "Database Systems")), h("span", { class: "brand-sub" }, tl("BIL372/BIL071 · Elmasri & Navathe", "BIL372/BIL071 · Elmasri & Navathe")));
  const nb = h("a", { class: "icon-btn", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: tl("Ders notebook'unu Google Colab'da aç", "Open the class notebook in Google Colab") });
  nb.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/></svg><span class="label">Notebook</span>';
  const gh = h("a", { class: "icon-btn", href: REPO, target: "_blank", rel: "noopener", title: tl("GitHub'daki kaynak kod", "Source code on GitHub"), "aria-label": tl("GitHub'daki kaynak kod", "Source code on GitHub") });
  gh.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z"/></svg>';
  // the language switch: the same page in the other language, at the same section
  const id = document.body.dataset.page || "index";
  const langBtn = h("a", { class: "icon-btn lang-btn", href: otherLangHref(id), hreflang: EN ? "tr" : "en", lang: EN ? "tr" : "en",
    title: EN ? "Bu sayfanın Türkçesi" : "This page in English", "aria-label": EN ? "Türkçe" : "English" });
  langBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.3"/><path d="M1.7 8h12.6M8 1.7c1.8 1.9 2.6 4 2.6 6.3S9.8 12.4 8 14.3C6.2 12.4 5.4 10.3 5.4 8S6.2 3.6 8 1.7z"/></svg>'
    + `<span class="lang-code">${EN ? "TR" : "EN"}</span>`;
  langBtn.addEventListener("click", () => {
    try {
      localStorage.setItem("lang", EN ? "tr" : "en");
      sessionStorage.setItem("langJump", JSON.stringify({ id, section: currentSection }));
    } catch { /* storage unavailable: the switch still works, from the top of the page */ }
  });
  return h("header", { class: "site-header" }, menu, brand, h("div", { class: "header-spacer" }), h("div", { class: "header-actions" }, langBtn, nb, gh, themeBtn));
}

function buildSidebar(current) {
  const nav = h("nav", { class: "sidebar", "aria-label": tl("Site", "Site") });
  for (const part of NAV) {
    const sec = h("div", { class: "nav-part" }, h("div", { class: "nav-part-title" }, h("span", {}, tx(part, "part")), part.short ? h("span", {}, part.short) : null));
    const ol = h("ol");
    for (const it of part.items) {
      const a = h("a", { href: href(it.id) }, h("span", {}, tx(it, "title")), it.ch ? h("span", { class: "nav-book" }, it.ch) : null);
      if (it.id === current) a.setAttribute("aria-current", "page");
      ol.append(h("li", {}, a));
    }
    sec.append(ol);
    nav.append(sec);
  }
  return nav;
}

function buildPager(current) {
  const i = ALL.findIndex((p) => p.id === current);
  if (i < 0) return null;
  const prev = ALL[i - 1], next = ALL[i + 1];
  return h("nav", { class: "pager", "aria-label": tl("Önceki ve sonraki sayfa", "Previous and next page") },
    prev ? h("a", { class: "prev", href: href(prev.id) }, h("span", { class: "dir" }, tl("← Önceki", "← Previous")), h("span", {}, prev.title)) : h("span"),
    next ? h("a", { class: "next", href: href(next.id) }, h("span", { class: "dir" }, tl("Sonraki →", "Next →")), h("span", {}, next.title)) : null);
}

function buildFooter() {
  const f = h("footer", { class: "site-footer" });
  f.innerHTML = EN ? `<p>An unofficial study site for BIL372/BIL071 Database Systems (TOBB ETÜ, Fall 2026–2027), following chapters 1–7 of
    R. Elmasri &amp; S. B. Navathe, <em>Fundamentals of Database Systems</em> (7th edition).
    Sample database: the book's COMPANY database (schema Figure 5.5/6.1, data Figure 5.6).</p>
    <p>Every SQL box is connected to a MySQL-compatible database running in your browser (go-mysql-server, WebAssembly); no data leaves your computer.
    <a href="${REPO}">Source code on GitHub</a>.</p>` : `<p>BIL372/BIL071 Veritabanı Sistemleri (TOBB ETÜ, 2026–2027 Güz) için hazırlanmış, R. Elmasri &amp; S. B. Navathe'nin
    <em>Fundamentals of Database Systems</em> (7. baskı) kitabının 1–7. bölümlerine eşlik eden gayriresmî bir çalışma sitesi.
    Örnek veritabanı: kitabın COMPANY veritabanı (şema Figure 5.5/6.1, veri Figure 5.6).</p>
    <p>Her SQL kutusu tarayıcınızda çalışan, MySQL ile uyumlu bir veritabanına (go-mysql-server, WebAssembly) bağlıdır; hiçbir veri bilgisayarınızdan çıkmaz.
    <a href="${REPO}">GitHub'daki kaynak kod</a>.</p>`;
  return f;
}

/** "Key idea", "Gotcha", … boxes get their label and icon; hints and answers get a reveal button. */
export function enhanceCallouts(root) {
  const LABELS = EN
    ? { look: "Look closely", discuss: "Think about it", key: "Key idea", gotcha: "Pitfall", try: "Try it", note: "Note", why: "Why it matters", connect: "Connections", example: "Worked example", goals: "By the end of this page you should be able to" }
    : { look: "Dikkat edin", discuss: "Düşünün", key: "Ana fikir", gotcha: "Tuzak", try: "Deneyin", note: "Not", why: "Neden önemli", connect: "Bağlantılar", example: "Çözümlü örnek", goals: "Bu sayfanın sonunda yapabilmeniz gerekenler" };
  for (const c of $$(".callout", root)) {
    const kind = Object.keys(LABELS).find((k) => c.classList.contains(k)) || "note";
    if (!c.querySelector(".callout-label")) {
      const lab = h("div", { class: "callout-label" });
      lab.innerHTML = (CALLOUT_ICONS[kind] || "") + `<span>${c.dataset.label || LABELS[kind]}</span>`;
      c.prepend(lab);
    }
  }
  for (const hint of $$(".hint", root)) {
    if (hint.previousElementSibling?.classList.contains("hint-toggle")) continue;
    hint.hidden = true;
    const label = hint.dataset.label || tl("İpucunu göster", "Show the hint");
    const b = h("button", { type: "button", class: "btn small hint-toggle", "aria-expanded": "false" }, label);
    b.addEventListener("click", () => {
      hint.hidden = !hint.hidden;
      b.setAttribute("aria-expanded", String(!hint.hidden));
      b.textContent = hint.hidden ? label : tl("Gizle", "Hide");
    });
    hint.before(b);
  }
}

/**
 * Quizzes written as
 *   <div class="quiz" data-answer="2" data-tables="EMPLOYEE DEPARTMENT">
 *     <p>Question</p> <pre class="sql">…</pre>
 *     <ol><li data-why="why this option is wrong (or right)">…</li>…</ol>
 *     <div class="explain">the reasoning behind the answer</div>
 *     <pre class="sql run" data-title="Kontrol edin">…</pre>          (optional: shown once the question is answered)
 *   </div>
 * become multiple-choice questions. A wrong choice says why it is wrong; once answered (or revealed) the explanation
 * and the reason for every option appear. A question about COMPANY data shows chips for the tables it needs.
 */
export function enhanceQuizzes(root = document) {
  let number = $$(".quiz[data-ready]", root).length;
  for (const q of $$(".quiz:not([data-ready])", root)) {
    number++;
    q.dataset.ready = "1";
    const answer = Number(q.dataset.answer);
    const items = $$(":scope > ol > li", q);
    const explain = $(":scope > .explain", q);
    const question = q.querySelector(":scope > p, :scope > .q");
    const check = $$(":scope > pre.sql.run", q);
    const extra = $$(":scope > pre:not(.run), :scope > .rel-wrap, :scope > table, :scope > .q-context", q);
    const sqlText = [...extra, ...check].filter((x) => x.matches("pre.sql")).map((x) => x.textContent).join("\n") + " " + (q.dataset.tables || "");
    const ctx = tableContext(() => sqlText, { label: tl("Bu soru COMPANY'nin başlangıç verisiyle ilgili; tablolar", "This question uses COMPANY's starting data; tables") });
    const opts = h("div", { class: "quiz-options" });
    const fb = h("div", { class: "quiz-feedback", "aria-live": "polite" });
    const after = h("div", { class: "quiz-after", hidden: true }, ...check);
    const buttons = [];
    const L = (i) => "ABCDEFG"[i];
    const finish = (revealed) => {
      for (const x of buttons) { x.disabled = true; x.classList.remove("wrong"); }
      buttons[answer - 1].classList.add("correct");
      const list = items.map((li, i) => li.dataset.why
        ? `<li class="${i + 1 === answer ? "ok" : "no"}"><strong>${L(i)}</strong> ${i + 1 === answer ? "✓" : "✗"} ${li.dataset.why}</li>` : "").join("");
      fb.innerHTML = `<span class="verdict ${revealed ? "no" : "ok"}">${revealed ? tl(`Doğru cevap: ${L(answer - 1)}.`, `Correct answer: ${L(answer - 1)}.`) : tl("✓ Doğru.", "✓ Correct.")}</span> ${explain ? explain.innerHTML : ""}`
        + (list ? `<ul class="quiz-whys">${list}</ul>` : "");
      if (check.length) { after.hidden = false; enhanceSQL(after); }
    };
    items.forEach((li, i) => {
      const b = h("button", { type: "button" }, h("span", { class: "opt-letter" }, L(i)), h("span", { html: li.innerHTML }));
      buttons.push(b);
      b.addEventListener("click", () => {
        const ok = i + 1 === answer;
        const first = !q.dataset.tried;
        q.dataset.tried = "1";
        q.dispatchEvent(new CustomEvent("quizanswer", { bubbles: true, detail: { correct: ok, firstTry: first } }));
        if (ok) { finish(false); return; }
        for (const x of buttons) x.classList.remove("wrong");
        b.classList.add("wrong");
        fb.replaceChildren(h("span", { class: "verdict no" }, tl("✗ Değil.", "✗ Not quite.")), " ", h("span", { html: li.dataset.why || tl("Bu seçenek doğru değil.", "This option is not correct.") }), " ",
          h("button", { type: "button", class: "link-btn", onclick: () => finish(true) }, tl("Cevabı göster", "Show the answer")));
      });
      opts.append(b);
    });
    const label = h("div", { class: "quiz-label" }, tl("Soru ", "Question ") + number);
    q.replaceChildren(label, question ? h("div", { class: "quiz-q", html: question.innerHTML }) : "", ...extra, ctx, opts, fb, after);
    enhanceSQL(q);
  }
}

/** Kicker above the H1: part and book chapter. */
function buildKicker(info) {
  if (!info || info.id === "index") return null;
  const k = h("div", { class: "kicker" }, h("span", {}, info.part));
  if (info.ch) k.append(h("span", { class: "chip", title: tl("Elmasri & Navathe, 7. baskı", "Elmasri & Navathe, 7th edition") }, tl("Kitap ", "Book ") + info.ch));
  if (info.slides) k.append(h("span", { class: "chip", title: tl("Ders slaytlarında bu sayfanın kapsadığı aralık (müfredattaki gibi)", "The range of the course slides this page covers (as in the syllabus)") }, tl(`Slaytlar ${info.slides}`, `Slides ${info.slides}`)));
  return k;
}

let currentSection = -1; // index of the section being read, for the language switch

function init() {
  const id = document.body.dataset.page || "index";
  const info = pageInfo(id);
  const main = $("main") || document.body.appendChild(h("main"));
  main.classList.add("main");
  main.id = "content";
  const content = $(".content", main) || (() => { const c = h("div", { class: "content" }); c.append(...main.childNodes); main.append(c); return c; })();
  const h1 = $("h1", content);
  const kicker = buildKicker(info);
  if (h1 && kicker) h1.before(kicker);
  const pager = buildPager(id);
  if (pager) content.append(pager);
  content.append(buildFooter());

  const layout = h("div", { class: "layout" }, buildSidebar(id));
  main.replaceWith(layout);
  layout.append(main);
  const scrim = h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") });
  document.body.prepend(h("a", { class: "skip-link", href: "#content" }, tl("İçeriğe geç", "Skip to content")), buildHeader(), scrim);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  foldIntro(content);
  linkTerms(content, enhanceTerms(content));
  enhanceCallouts(content);
  enhanceQuizzes(content);
  enhanceSQL(content);
  // <div class="company-data" data-tables="EMPLOYEE WORKS_ON"></div>: chips that open those COMPANY tables
  for (const el of $$(".company-data[data-tables]", content)) el.replaceWith(Object.assign(tableContext(() => el.dataset.tables, { label: el.dataset.label || tl("COMPANY'nin başlangıç verisi; tablolar", "COMPANY's starting data; tables"), alwaysShow: true }), { className: "sqlbox-ctx standalone" }));
  labelTables(content);
  // page modules run after this one: wait for them so the navigation sees the content they add
  const nav = () => buildPageNav(content, id);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(nav, 0));
  else setTimeout(nav, 0);
  const cur = $(".sidebar [aria-current]"), side = $(".sidebar");
  if (cur && side) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
}

/**
 * The goals and the scope note at the top of a page are useful but stand between the reader and the topic: fold them
 * into one closed line ("Goals (4) · Scope: slides 1–41") right under the lead. The reader's choice is remembered.
 */
/** "Terms at a glance": a <dl class="term-glance"> written in the page (dt = term, dd = plain definition with an
 *  example; dt[data-sec] = the start of the heading where the term is explained) becomes a filterable list. Clicking a
 *  term with a section jumps there and briefly marks the heading. Without JavaScript the plain list still reads well. */
function enhanceTerms(content) {
  const entries = [];
  for (const dl of content.querySelectorAll("dl.term-glance")) {
    const heads = [...content.querySelectorAll("h2, h3")];
    const rows = [...dl.querySelectorAll("dt")].map((dt) => {
      const dd = dt.nextElementSibling;
      const target = dt.dataset.sec ? heads.find((x) => x.textContent.trim().startsWith(dt.dataset.sec)) : null;
      const go = target ? h("a", { class: "term-go", href: `#${target.id || ""}`, onclick: (e) => {
        e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.classList.add("term-flash"); setTimeout(() => target.classList.remove("term-flash"), 1600);
      } }, tl("bölüme git →", "go to section →")) : "";
      const r = h("div", { class: "term-row static" }, h("span", { class: "term-name" }, dt.textContent), h("span", { class: "term-def" }, ...[...dd.childNodes].map((n) => n.cloneNode(true)), go ? " " : "", go));
      r.dataset.q = (dt.textContent + " " + dd.textContent).toLocaleLowerCase();
      entries.push({ name: dt.textContent, dd: dd.cloneNode(true) });
      return r;
    });
    const list = h("div", { class: "term-list" }, ...rows);
    const none = h("p", { class: "small muted", hidden: true }, tl("Eşleşen terim yok.", "No matching term."));
    const q = h("input", { type: "search", class: "term-filter", placeholder: tl("Terim ara…", "Search terms…"), "aria-label": tl("Terim ara", "Search terms"), oninput: () => {
      const v = q.value.trim().toLocaleLowerCase(); let n = 0;
      for (const r of rows) { const on = !v || r.dataset.q.includes(v); r.hidden = !on; n += on; }
      none.hidden = n > 0;
    } });
    dl.replaceWith(h("div", { class: "stepper term-box" }, q, list, none));
  }
  return entries;
}

/** Underlines glossary terms in the prose: this page's "terms at a glance" plus the site glossary (glossary.js). Each
 *  term is marked once per paragraph, list item or cell; hovering, focusing or tapping it shows the definition. Code,
 *  headings, links, buttons and the widgets are left alone. */
function linkTerms(content, pageEntries) {
  if (document.body.dataset.page === "cheatsheet" || $("#glossary")) return;
  const lc = (x) => x.toLocaleLowerCase(EN ? "en" : "tr");
  const entries = [...pageEntries];
  const have = new Set(entries.map((e) => lc(e.name)));
  for (const g of GLOSSARY) {
    const name = EN ? g.en : g.tr;
    if (have.has(lc(name)) || have.has(lc(g.en))) continue;
    have.add(lc(name));
    // Turkish pages often use the English term, so both names match there
    entries.push({ name, def: EN ? g.d_en : g.d, alias: EN ? [] : [g.en] });
  }
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // everyday words that are also glossary forms; underlining them on every line is noise, not help
  const STOP = new Set(EN ? ["project", "state", "client", "instance", "array", "field", "operation", "record", "data", "system", "select", "server", "block", "file"]
    : ["project", "örnek", "işlem", "satır", "durum", "dizi", "alan", "ilişki", "tekrar", "kayıt", "veri", "sistem", "istemci", "sunucu", "blok", "dosya"]);
  const forms = [];
  for (const e of entries) {
    // "Meta-data (katalog)" → "Meta-data", "katalog"; "A / B" → "A", "B"
    const all = [e.name, ...(e.alias || [])];
    const parts = all.flatMap((n) => n.split(/\s*[()\/·,]\s*|\s+vs\.?\s+/)).map((x) => x.trim()).filter((x) => x.length >= 2 && !/^\d+$/.test(x));
    for (const f of new Set([...all, ...parts])) if (f.length >= 2 && !STOP.has(lc(f))) forms.push({ f, e });
  }
  forms.sort((a, b) => b.f.length - a.f.length);
  const byForm = new Map();
  for (const x of forms) if (!byForm.has(lc(x.f))) byForm.set(lc(x.f), x);
  const keys = [...byForm.keys()];
  // Turkish words take suffixes (DBMS'in, veritabanlarının); English takes plurals.
  const tail = EN ? "(?:'s|s|es)?(?![\\p{L}\\d])" : "(?:['’][\\p{L}]*|[\\p{L}]{0,7})?(?![\\p{L}\\d])";
  const re = new RegExp(`(?<![\\p{L}\\d])(?:${[...byForm.values()].map((x) => esc(x.f)).join("|")})${tail}`, "giu");
  const SKIP = "pre, code, a, button, label, h1, h2, h3, h4, summary, select, textarea, .term-box, .term, .sqlbox, .stepper, figure, svg, .decide, div[id], table.bcmp, .kicker";
  const OK = "p, li, td, dd, .callout";
  const marked = new WeakMap();
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const jobs = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement, block = el?.closest(OK);
    if (!block || el.closest(SKIP) || !n.data.trim()) continue;
    const seen = marked.get(block) || new Set();
    marked.set(block, seen);
    const hits = [];
    re.lastIndex = 0;
    for (let m; (m = re.exec(n.data)); ) {
      const word = m[0], w = lc(word);
      const key = keys.filter((k) => w.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      const form = key && byForm.get(key), e = form?.e;
      if (!e || seen.has(e)) continue;
      // acronyms and SQL keywords (IN, LEFT, DBA) only in capitals; short Turkish forms take no bare suffix
      if (/^[^a-zçğıöşü]+$/.test(form.f) && !word.startsWith(form.f)) continue;
      if (!EN && form.f.length < 4 && word.length > form.f.length && !/['’]/.test(word[form.f.length])) continue;
      seen.add(e);
      hits.push([m.index, word, e]);
    }
    if (hits.length) jobs.push([n, hits]);
  }
  for (const [n, hits] of jobs) {
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const [i, word, e] of hits) {
      frag.append(n.data.slice(at, i), h("span", { class: "term", tabindex: "0", dataset: { term: entries.indexOf(e) } }, word));
      at = i + word.length;
    }
    frag.append(n.data.slice(at));
    n.replaceWith(frag);
  }
  const pop = h("div", { class: "term-pop", role: "tooltip", hidden: true });
  document.body.append(pop);
  let cur = null;
  const show = (t) => {
    const e = entries[+t.dataset.term];
    cur = t;
    pop.replaceChildren(h("strong", {}, e.name), " ", ...(e.dd ? [...e.dd.childNodes].map((x) => x.cloneNode(true)) : [e.def]));
    pop.hidden = false;
    const r = t.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
    pop.style.maxWidth = w + "px";
    pop.style.left = Math.max(12, Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - w - 12)) + "px";
    pop.style.top = window.scrollY + r.bottom + 6 + "px";
  };
  const hide = () => { pop.hidden = true; cur = null; };
  const term = (ev) => ev.target.closest?.(".term[data-term]");
  content.addEventListener("mouseover", (ev) => { const t = term(ev); if (t) show(t); });
  content.addEventListener("mouseout", (ev) => { const t = term(ev); if (t && !t.contains(ev.relatedTarget)) hide(); });
  content.addEventListener("focusin", (ev) => { const t = term(ev); if (t) show(t); });
  content.addEventListener("focusout", (ev) => { if (term(ev)) hide(); });
  content.addEventListener("click", (ev) => { const t = term(ev); if (t) (cur === t && !pop.hidden ? hide() : show(t)); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") hide(); });
  window.addEventListener("scroll", () => cur && !pop.hidden && show(cur), { passive: true });
}

function foldIntro(content) {
  const firstH2 = $("h2", content);
  const before = (el) => !firstH2 || (el.compareDocumentPosition(firstH2) & Node.DOCUMENT_POSITION_FOLLOWING);
  const goals = $$(".callout.goals", content).filter(before);
  const scope = $$(".callout.note", content).filter(before).filter((c) => /^\s*(Kapsam|Scope)\b/.test(c.textContent));
  const parts = [...goals, ...scope];
  if (!parts.length) return;
  const n = goals.reduce((s, g) => s + $$("li", g).length, 0);
  const slides = scope.map((c) => (c.textContent.match(/(\d+\s*[–-]\s*\d+)/) || [])[1]).find(Boolean);
  const KEY = "intro-open";
  let open = false;
  try { open = localStorage.getItem(KEY) === "1"; } catch { /* storage may be unavailable */ }
  const d = h("details", { class: "page-intro", open: open || null },
    h("summary", {}, h("span", { class: "pi-title" }, tl("Bu sayfa hakkında", "About this page")),
      h("span", { class: "pi-meta" }, [n ? tl(`${n} hedef`, `${n} goals`) : "", scope.length ? (slides ? tl(`kapsam: slaytlar ${slides}`, `scope: slides ${slides}`) : tl("kapsam", "scope")) : ""].filter(Boolean).join(" · "))));
  parts[0].before(d);
  d.append(...parts);
  d.addEventListener("toggle", () => { try { localStorage.setItem(KEY, d.open ? "1" : "0"); } catch { /* ignore */ } });
}

/** On phones, tables become stacked cards: every cell carries its column name (CSS shows it). */
export function labelTables(root) {
  for (const t of $$("table.simple", root)) {
    const heads = $$("thead th", t).map((th) => th.textContent.trim());
    if (!heads.length) continue;
    t.classList.add("stack");
    for (const tr of $$("tbody tr", t)) $$("td", tr).forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; });
  }
}

const slug = (s) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
const tocText = (hd) => (hd.dataset.toc || hd.textContent).replace(/\s+/g, " ").trim();

/**
 * In-page navigation, built once the page's own script has added its content:
 *   - "Bu sayfada" under the introduction (the page's sections)
 *   - "Bu bölümde" at the start of a section with several sub-sections
 *   - a table of contents that stays in view: a right-hand column on wide screens, a bar under the header otherwise;
 *     the section being read is highlighted and its sub-sections are listed
 */
function buildPageNav(content, id) {
  const all = $$(":scope > h2, :scope > h3, :scope > section > h2, :scope > section > h3, :scope > div > section.exercise > h3", content)
    .filter((x) => !x.closest(".quiz, template, .sqlbox, .er, .stepper, .callout"));
  const tree = [];
  for (const hd of all) {
    if (hd.tagName === "H2") tree.push({ hd, subs: [] });
    else if (tree.length) tree[tree.length - 1].subs.push(hd);
  }
  if (tree.length < 3) return;
  const used = new Set($$("[id]").map((e) => e.id));
  for (const hd of all) {
    if (hd.id) continue;
    const base = slug(tocText(hd));
    let s = base, k = 2;
    while (used.has(s)) s = `${base}-${k++}`;
    hd.id = s;
    used.add(s);
  }
  const link = (hd, cls) => h("a", { href: `#${hd.id}`, class: cls || null, "data-target": hd.id }, tocText(hd));

  // "Bu sayfada" under the introduction
  if (id !== "index" && !$(".page-toc", content)) {
    const toc = h("nav", { class: "page-toc", "aria-label": tl("Bu sayfada", "On this page") }, h("div", { class: "page-toc-title" }, tl("Bu sayfada", "On this page")),
      h("ol", {}, ...tree.map((t) => h("li", {}, link(t.hd)))));
    // with a folded intro the list goes inside it (one closed line instead of a block); otherwise under the lead
    const intro = $(":scope > details.page-intro", content);
    if (intro) {
      intro.querySelector("summary").after(toc);
      const meta = intro.querySelector(".pi-meta");
      meta.textContent = [tl(`${tree.length} bölüm`, `${tree.length} sections`), meta.textContent].filter(Boolean).join(" · ");
    } else ($(":scope > .lead", content) || $(":scope > h1", content)).after(toc);
  }
  // "Bu bölümde" at the start of long sections
  for (const t of tree) {
    if (t.subs.length < 3 || t.hd.nextElementSibling?.classList.contains("section-toc")) continue;
    t.hd.after(h("nav", { class: "section-toc", "aria-label": `${tocText(t.hd)}: ${tl("bu bölümde", "in this section")}` }, h("span", { class: "page-toc-title" }, tl("Bu bölümde", "In this section")),
      ...t.subs.map((s) => link(s))));
  }

  // the table of contents that stays in view
  const info = ALL.find((p) => p.id === id);
  const i = ALL.findIndex((p) => p.id === id);
  const prev = ALL[i - 1], next = ALL[i + 1];
  const railHead = () => info ? h("div", { class: "toc-rail-head" },
    info.ch ? h("span", { class: "toc-rail-ch" }, info.ch) : null, h("span", { class: "toc-rail-title" }, info.title)) : null;
  const railPager = () => h("nav", { class: "toc-pager", "aria-label": tl("Önceki ve sonraki sayfa", "Previous and next page") },
    prev ? h("a", { href: href(prev.id), class: "prev" }, h("span", { class: "dir" }, tl("← Önceki", "← Previous")), h("span", {}, prev.title)) : null,
    next ? h("a", { href: href(next.id), class: "next" }, h("span", { class: "dir" }, tl("Sonraki →", "Next →")), h("span", {}, next.title)) : null);
  // a section with sub-sections gets an arrow that opens or closes them; the section being read opens by itself
  // unless its arrow closed it, and an arrow-opened section stays open while reading elsewhere
  const makeList = () => h("ol", { class: "toc-list" }, ...tree.map((t) => {
    const li = h("li", { "data-section": t.hd.id });
    const row = h("div", { class: "toc-row" }, link(t.hd, "toc-h2"));
    if (t.subs.length) {
      const chev = h("button", { type: "button", class: "toc-chev", "aria-label": `${tocText(t.hd)}: ${tl("alt başlıkları aç/kapat", "open or close the sub-sections")}`, "aria-expanded": "false" },
        h("span", { "aria-hidden": "true" }, "▸"));
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        li.dataset.user = li.classList.contains("open") ? "closed" : "open";
        spy();
      });
      row.append(chev);
    }
    li.append(row);
    if (t.subs.length) li.append(h("ol", { class: "toc-subs" }, ...t.subs.map((s) => h("li", {}, link(s, "toc-h3")))));
    return li;
  }));
  const rail = h("aside", { class: "toc-rail", "aria-label": tl("İçindekiler", "Contents") }, railHead(), h("div", { class: "page-toc-title" }, tl("İçindekiler", "Contents")), makeList(),
    h("a", { href: "#", class: "toc-top", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, tl("↑ Sayfanın başı", "↑ Top of the page")),
    railPager());
  const main = content.closest(".main");
  main.classList.add("has-rail");
  main.append(rail);

  const label = h("span", { class: "toc-current" });
  const toggle = h("button", { type: "button", class: "toc-toggle", "aria-expanded": "false" }, h("span", { class: "toc-bar-title" }, tl("Bu sayfada", "On this page")), label, h("span", { class: "toc-caret", "aria-hidden": "true" }, "▾"));
  const panel = h("div", { class: "toc-panel", hidden: true }, makeList(),
    h("a", { href: "#", class: "toc-top", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, tl("↑ Sayfanın başı", "↑ Top of the page")),
    railPager());
  const bar = h("div", { class: "toc-bar" }, toggle, panel);
  const setOpen = (open) => { panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => { setOpen(panel.hidden); if (!panel.hidden) spy(); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".toc-bar")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  document.body.append(bar);

  // scroll spy: which section and sub-section is being read
  const offset = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) + 64;
  let ticking = false;
  const spy = () => {
    ticking = false;
    const top = offset();
    let cur = null, curSub = null;
    for (const t of tree) {
      if (t.hd.getBoundingClientRect().top <= top) { cur = t; curSub = null; for (const s of t.subs) if (s.getBoundingClientRect().top <= top) curSub = s; }
    }
    for (const list of [rail, panel]) {
      for (const li of $$(":scope .toc-list > li", list)) {
        const reading = !!cur && li.dataset.section === cur.hd.id;
        const open = li.dataset.user === "open" || (reading && li.dataset.user !== "closed");
        li.classList.toggle("open", open);
        li.querySelector(".toc-chev")?.setAttribute("aria-expanded", String(open));
        if (!reading && li.dataset.user === "closed") delete li.dataset.user; // closing only lasts while the section is read
      }
      for (const a of $$("a[data-target]", list)) a.classList.toggle("current", a.dataset.target === (curSub || cur?.hd)?.id || a.dataset.target === cur?.hd.id && a.classList.contains("toc-h2"));
    }
    label.textContent = cur ? tocText(curSub || cur.hd) : "";
    currentSection = cur ? tree.indexOf(cur) : -1;
    bar.classList.toggle("show", window.scrollY > 280);
    // keep the highlighted entry visible inside the rail and inside the open list
    follow(rail);
    if (!panel.hidden) follow(panel);
  };
  function follow(box) {
    const active = $$("a.current", box).pop();
    if (!active || box.scrollHeight <= box.clientHeight) return;
    const r = active.getBoundingClientRect(), rr = box.getBoundingClientRect();
    if (r.top < rr.top + 30 || r.bottom > rr.bottom - 30) box.scrollTop += r.top - rr.top - rr.height / 2;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  // arriving from the other language: open the same section (the sections of the two versions correspond one to one)
  try {
    const jump = JSON.parse(sessionStorage.getItem("langJump") || "null");
    sessionStorage.removeItem("langJump");
    if (jump && jump.id === id && jump.section >= 0 && tree[jump.section] && !location.hash) tree[jump.section].hd.scrollIntoView();
  } catch { /* nothing to restore */ }
  spy();
}

init();
