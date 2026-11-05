// Site chrome shared by every page: header, navigation, pager, footer, theme, callouts, quizzes, SQL boxes.
// Each page's module imports this first; the page itself only contains its article.
import { h, $, $$, CALLOUT_ICONS } from "./lib/ui.js";
import { enhanceSQL } from "./lib/sqlbox.js";

export const REPO = "https://github.com/ysoktar/database-systems";
export const NOTEBOOK_URL = "https://colab.research.google.com/drive/1ArUuenMYSnN0ZNk_1Gsmn-CvnUnUeS30?usp=sharing";

/**
 * Site map. `ch` = chapter of Elmasri & Navathe (7th ed.). `scope`: "midterm" (Ch 1–7, on the midterm) or
 * "final" (Ch 8 onward: outside the midterm scope).
 */
export const NAV = [
  { part: "Başlangıç", items: [
    { id: "index", title: "Genel bakış", desc: "Sınav kapsamı, plan ve sitenin kullanımı." },
  ] },
  { part: "Bölüm I · Kavramlar", short: "Ch 1–2", items: [
    { id: "ch1-intro", title: "Veritabanı ve DBMS", ch: "Ch 1", desc: "Veritabanı yaklaşımının özellikleri, aktörler, avantajlar." },
    { id: "ch2-architecture", title: "Mimari ve veri modelleri", ch: "Ch 2", desc: "Şema/durum, üç-şema mimarisi, veri bağımsızlığı, diller." },
  ] },
  { part: "Bölüm II · Kavramsal modelleme", short: "Ch 3–4", items: [
    { id: "ch3-er", title: "ER modeli", ch: "Ch 3", desc: "Varlık, öznitelik, anahtar, ilişki, kardinalite, katılım, zayıf varlık." },
    { id: "ch4-eer", title: "EER modeli", ch: "Ch 4", desc: "Alt/üst sınıf, özelleştirme, disjoint/overlap, total/partial, kategori." },
  ] },
  { part: "Bölüm III · İlişkisel model", short: "Ch 5", items: [
    { id: "ch5-relational", title: "İlişkisel model ve kısıtlar", ch: "Ch 5", desc: "Anahtarlar, bütünlük kısıtları, güncelleme işlemleri ve ihlaller." },
  ] },
  { part: "Bölüm IV · SQL", short: "Ch 6–7", items: [
    { id: "ch6-sql", title: "Temel SQL", ch: "Ch 6", desc: "CREATE TABLE, SELECT-FROM-WHERE, LIKE, ORDER BY, INSERT/UPDATE/DELETE." },
    { id: "ch7-nested", title: "NULL ve iç içe sorgular", ch: "Ch 7.1", desc: "Üç değerli mantık, IN/ANY/ALL, correlated sorgu, EXISTS, bölme." },
    { id: "ch7-joins", title: "Join, gruplama, WITH", ch: "Ch 7.1", desc: "Outer join, aggregate, GROUP BY/HAVING, CASE, WITH RECURSIVE." },
    { id: "ch7-views", title: "Kısıtlar, trigger, view, ALTER", ch: "Ch 7.2–7.4", desc: "ASSERTION, trigger, view ve güncellenebilirlik, şema değişikliği." },
  ] },
  { part: "Uygulama", items: [
    { id: "er-studio", title: "ER stüdyosu", desc: "ER/EER çiz, tablolara dönüştür, tablolardan ER'e geri dön; tasarım alıştırmaları." },
    { id: "notebook", title: "Notebook alıştırmaları", desc: "Colab notebook'undaki 10 SQL alıştırması, aynı kontrolcüyle." },
    { id: "lab", title: "SQL laboratuvarı", desc: "COMPANY üzerinde serbest sorgu konsolu ve şema tarayıcı." },
  ] },
  { part: "Sınav", items: [
    { id: "exam-midterm", title: "Arasınav çalışma rehberi", desc: "Bölüm bölüm bilinmesi gerekenler, çözümlü sorular, deneme seti." },
    { id: "cheatsheet", title: "Özet kâğıdı ve sözlük", desc: "SQL sözdizimi, ER gösterimi, Türkçe–İngilizce terimler." },
  ] },
  { part: "Sonrası", short: "Final", items: [
    { id: "ch8-algebra", title: "İlişkisel cebir (önizleme)", ch: "Ch 8", scope: "final", desc: "İlişkisel cebir ve SQL karşılıkları; arasınav kapsamı dışında." },
  ] },
];

const ALL = NAV.flatMap((p) => p.items.map((it) => ({ ...it, part: p.part, short: p.short })));
for (const it of ALL) it.scope ??= it.ch ? "midterm" : "none";
export const SCOPES = {
  midterm: { label: "Arasınavda", tip: "Arasınav kapsamında: Elmasri & Navathe Ch 1–7." },
  final: { label: "Arasınav kapsamı dışında", tip: "Ch 8 arasınav kapsamında değil (Ch 1–7)." },
};
export const pageInfo = (id) => ALL.find((p) => p.id === id);
export const PAGES = ALL;
const href = (id) => (id === "index" ? "index.html" : `${id}.html`);

const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
  <ellipse cx="14" cy="6.5" rx="9" ry="3.5" fill="var(--s1)"/>
  <path d="M5 6.5v15c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-15" fill="none" stroke="var(--s1)" stroke-width="2"/>
  <path d="M5 11.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5M5 16.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5" fill="none" stroke="var(--s2)" stroke-width="1.8"/></svg>`;

const THEME_ICONS = {
  auto: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor"/></svg>',
  light: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>',
};
const THEME_NAMES = { auto: "Otomatik", light: "Açık", dark: "Koyu" };

function getTheme() {
  try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; }
}
function setTheme(t) {
  try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage unavailable */ }
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

function buildHeader() {
  const themeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Renk teması" });
  const paintTheme = () => {
    const t = getTheme();
    themeBtn.innerHTML = THEME_ICONS[t] + `<span class="label">${THEME_NAMES[t]}</span>`;
    themeBtn.title = `Tema: ${THEME_NAMES[t]} (değiştirmek için tıklayın)`;
  };
  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    setTheme(order[(order.indexOf(getTheme()) + 1) % 3]);
    paintTheme();
  });
  paintTheme();
  const menu = h("button", { class: "icon-btn menu-btn", type: "button", "aria-label": "Menüyü aç", "aria-expanded": "false" });
  menu.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" stroke-width="1.8"><path d="M2 4.5h14M2 9h14M2 13.5h14"/></svg>';
  menu.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  const brand = h("a", { class: "brand", href: "index.html" });
  brand.innerHTML = LOGO;
  brand.append(h("span", { class: "brand-title" }, "Veritabanı Sistemleri"), h("span", { class: "brand-sub" }, "BIL372/BIL071 · arasınav"));
  const nb = h("a", { class: "icon-btn", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: "Ders notebook'unu Google Colab'da aç" });
  nb.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/></svg><span class="label">Notebook</span>';
  const gh = h("a", { class: "icon-btn", href: REPO, target: "_blank", rel: "noopener", title: "GitHub'daki kaynak kod", "aria-label": "GitHub'daki kaynak kod" });
  gh.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z"/></svg>';
  return h("header", { class: "site-header" }, menu, brand, h("div", { class: "header-spacer" }), h("div", { class: "header-actions" }, nb, gh, themeBtn));
}

function buildSidebar(current) {
  const nav = h("nav", { class: "sidebar", "aria-label": "Site" });
  for (const part of NAV) {
    const sec = h("div", { class: "nav-part" }, h("div", { class: "nav-part-title" }, h("span", {}, part.part), part.short ? h("span", {}, part.short) : null));
    const ol = h("ol");
    for (const it of part.items) {
      const sc = ALL.find((x) => x.id === it.id).scope;
      const tag = sc === "final" ? h("span", { class: "nav-scope beyond", title: SCOPES.final.tip }, "final") : null;
      const a = h("a", { href: href(it.id) }, h("span", {}, it.title, tag), it.ch ? h("span", { class: "nav-book" }, it.ch) : null);
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
  return h("nav", { class: "pager", "aria-label": "Önceki ve sonraki sayfa" },
    prev ? h("a", { class: "prev", href: href(prev.id) }, h("span", { class: "dir" }, "← Önceki"), h("span", {}, prev.title)) : h("span"),
    next ? h("a", { class: "next", href: href(next.id) }, h("span", { class: "dir" }, "Sonraki →"), h("span", {}, next.title)) : null);
}

function buildFooter() {
  const f = h("footer", { class: "site-footer" });
  f.innerHTML = `<p>BIL372/BIL071 Veritabanı Sistemleri (TOBB ETÜ, 2026–2027 Güz) için hazırlanmış, R. Elmasri &amp; S. B. Navathe'nin
    <em>Fundamentals of Database Systems</em> (7. baskı) kitabının 1–7. bölümlerine eşlik eden gayriresmî bir çalışma sitesi.
    Örnek veritabanı: kitabın COMPANY veritabanı (Figure 5.6).</p>
    <p>Her SQL kutusu tarayıcınızda çalışan gerçek bir PostgreSQL'e (PGlite) bağlıdır; hiçbir veri bilgisayarınızdan çıkmaz.
    <a href="${REPO}">GitHub'daki kaynak kod</a>.</p>`;
  return f;
}

/** "Key idea", "Gotcha", … boxes get their label and icon; hints and answers get a reveal button. */
export function enhanceCallouts(root) {
  const LABELS = { look: "Dikkat edin", discuss: "Düşünün", key: "Ana fikir", gotcha: "Tuzak", try: "Deneyin", note: "Not", why: "Neden önemli", connect: "Bağlantılar", example: "Çözümlü örnek" };
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
    const label = hint.dataset.label || "İpucunu göster";
    const b = h("button", { type: "button", class: "btn small hint-toggle", "aria-expanded": "false" }, label);
    b.addEventListener("click", () => {
      hint.hidden = !hint.hidden;
      b.setAttribute("aria-expanded", String(!hint.hidden));
      b.textContent = hint.hidden ? label : "Gizle";
    });
    hint.before(b);
  }
}

/**
 * Quizzes written as
 *   <div class="quiz" data-answer="2"><p>Question</p><ol><li>…</li>…</ol><div class="explain">…</div></div>
 * become clickable multiple-choice questions with instant feedback.
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
    const extra = $$(":scope > pre, :scope > .rel-wrap, :scope > table", q);
    const opts = h("div", { class: "quiz-options" });
    const fb = h("div", { class: "quiz-feedback", "aria-live": "polite" });
    items.forEach((li, i) => {
      const b = h("button", { type: "button" }, h("span", { class: "opt-letter" }, "ABCDEFG"[i]), h("span", { html: li.innerHTML }));
      b.addEventListener("click", () => {
        const ok = i + 1 === answer;
        const first = !q.dataset.tried;
        q.dataset.tried = "1";
        q.dispatchEvent(new CustomEvent("quizanswer", { bubbles: true, detail: { correct: ok, firstTry: first } }));
        for (const x of $$("button", opts)) x.classList.remove("correct", "wrong");
        b.classList.add(ok ? "correct" : "wrong");
        if (ok) for (const x of $$("button", opts)) x.disabled = true;
        const why = li.dataset.why;
        fb.innerHTML = ok
          ? `<span class="verdict ok">✓ Doğru.</span> ${explain ? explain.innerHTML : ""}`
          : `<span class="verdict no">✗ Değil.</span> ${why ? why + " " : ""}Başka bir seçenek deneyin.`;
      });
      opts.append(b);
    });
    const label = h("div", { class: "quiz-label" }, "Soru " + number);
    q.replaceChildren(label, question ? h("div", { class: "quiz-q", html: question.innerHTML }) : "", ...extra, opts, fb);
    enhanceSQL(q);
  }
}

/** Kicker above the H1: part, book chapter, scope. */
function buildKicker(info) {
  if (!info || info.id === "index") return null;
  const k = h("div", { class: "kicker" }, h("span", {}, info.part));
  if (info.ch) k.append(h("span", { class: "chip", title: "Elmasri & Navathe, 7. baskı" }, "Kitap " + info.ch));
  const sc = SCOPES[info.scope];
  if (sc) k.append(h("span", { class: `chip scope ${info.scope === "final" ? "beyond" : "slides"}`, title: sc.tip }, h("span", { class: "dot" }), sc.label));
  return k;
}

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
  document.body.prepend(h("a", { class: "skip-link", href: "#content" }, "İçeriğe geç"), buildHeader(), scrim);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  enhanceCallouts(content);
  enhanceQuizzes(content);
  enhanceSQL(content);
  labelTables(content);
  // page modules run after this one: wait for them so the navigation sees the content they add
  const nav = () => buildPageNav(content, id);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(nav, 0));
  else setTimeout(nav, 0);
  const cur = $(".sidebar [aria-current]"), side = $(".sidebar");
  if (cur && side) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
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
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bolum";
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
    const toc = h("nav", { class: "page-toc", "aria-label": "Bu sayfada" }, h("div", { class: "page-toc-title" }, "Bu sayfada"),
      h("ol", {}, ...tree.map((t) => h("li", {}, link(t.hd)))));
    ($(":scope > .lead", content) || $(":scope > h1", content)).after(toc);
  }
  // "Bu bölümde" at the start of long sections
  for (const t of tree) {
    if (t.subs.length < 3 || t.hd.nextElementSibling?.classList.contains("section-toc")) continue;
    t.hd.after(h("nav", { class: "section-toc", "aria-label": `${tocText(t.hd)}: bu bölümde` }, h("span", { class: "page-toc-title" }, "Bu bölümde"),
      ...t.subs.map((s) => link(s))));
  }

  // the table of contents that stays in view
  const makeList = () => h("ol", { class: "toc-list" }, ...tree.map((t) => h("li", { "data-section": t.hd.id }, link(t.hd, "toc-h2"),
    t.subs.length ? h("ol", { class: "toc-subs" }, ...t.subs.map((s) => h("li", {}, link(s, "toc-h3")))) : null)));
  const rail = h("aside", { class: "toc-rail", "aria-label": "İçindekiler" }, h("div", { class: "page-toc-title" }, "İçindekiler"), makeList(),
    h("a", { href: "#", class: "toc-top", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, "↑ Sayfanın başı"));
  const main = content.closest(".main");
  main.classList.add("has-rail");
  main.append(rail);

  const label = h("span", { class: "toc-current" });
  const toggle = h("button", { type: "button", class: "toc-toggle", "aria-expanded": "false" }, h("span", { class: "toc-bar-title" }, "Bu sayfada"), label, h("span", { class: "toc-caret", "aria-hidden": "true" }, "▾"));
  const panel = h("div", { class: "toc-panel", hidden: true }, makeList(),
    h("a", { href: "#", class: "toc-top", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, "↑ Sayfanın başı"));
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
      for (const li of $$(":scope .toc-list > li", list)) li.classList.toggle("open", !!cur && li.dataset.section === cur.hd.id);
      for (const a of $$("a[data-target]", list)) a.classList.toggle("current", a.dataset.target === (curSub || cur?.hd)?.id || a.dataset.target === cur?.hd.id && a.classList.contains("toc-h2"));
    }
    label.textContent = cur ? tocText(curSub || cur.hd) : "";
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
  spy();
}

init();
