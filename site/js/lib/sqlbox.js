// Runnable SQL boxes: an editable, highlighted editor + Run button; results print as tables, like the mysql client.
//   <pre class="sql run" data-title="Q1">SELECT …</pre>     editable and runnable on the page's MySQL (COMPANY)
//   <pre class="sql run" data-expect-error>…</pre>         the error is the point (constraint violations, …)
//   <pre class="sql">…</pre>                              display only, highlighted
import { h, $$, highlightSQL, dedent, button } from "./ui.js";
import { runSQL, reset, onState, state, stateInfo, getDB } from "./db.js";
import { checkResult, resultHash } from "./sqlcore.js";
import { companyData, tablesIn } from "./companydata.js";

import { isNumericType } from "./mysql.js";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export { store };

/** A relation as an HTML table (row numbers, NULLs in grey, numbers right-aligned). */
export function relationTable(cols, types, rows, { caption, rowClass, maxRows = 500, colClass } = {}) {
  const t = h("table", { class: "rel" });
  if (caption) t.append(h("caption", {}, caption));
  t.append(h("thead", {}, h("tr", {}, h("th", { class: "idx" }), ...cols.map((c, j) => h("th", { class: colClass ? colClass(c, j) : null }, c)))));
  const tb = h("tbody");
  rows.slice(0, maxRows).forEach((r, i) => {
    tb.append(h("tr", { class: rowClass ? rowClass(r, i) : null }, h("td", { class: "idx" }, i + 1),
      ...r.map((v, j) => v === null || v === undefined ? h("td", { class: "null" }, "NULL")
        : h("td", { class: isNumericType(types?.[j]) || typeof v === "number" ? "n" : null }, typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v)))));
  });
  t.append(tb);
  const wrap = h("div", { class: "rel-wrap" }, t);
  if (rows.length > maxRows) wrap.append(h("div", { class: "res-caption" }, `… ${rows.length - maxRows} satır daha`));
  return wrap;
}

/** Render the items returned by runSQL into a container. */
export function renderItems(out, items) {
  for (const it of items) {
    if (it.kind === "result") {
      const label = `${it.rows.length} satır`;
      out.append(h("div", { class: "res-caption" }, it.caption ? `> ${it.caption}   (${label})` : label));
      if (it.cols.length === 1 && /^(plan|EXPLAIN|QUERY PLAN)$/i.test(it.cols[0])) out.append(h("pre", {}, it.rows.map((r) => r[0]).join("\n")));
      else if (it.rows.length) out.append(relationTable(it.cols, it.types, it.rows));
      else out.append(relationTable(it.cols, it.types, []));
    } else if (it.kind === "status") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "notice") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "startup") out.append(startError(it.message));
    else if (it.kind === "error") {
      // as the mysql client prints it: ERROR 1062 (23000): Duplicate entry …
      const lines = [`${it.expected ? "BEKLENEN HATA" : "HATA"} ${it.code || ""} (${it.state || "HY000"}): ${it.message}`];
      if (it.total > 1) lines.push(`(Kutudaki ${it.total} komutun ${it.index}. komutu; kalanlar çalıştırılmadı.)`);
      // objects that already exist (or are already gone) usually mean the box changed the database on an earlier run
      if (!it.expected && [1050, 1060, 1061, 1146, 1054, 1091, 1062, 1359, 1304, 1007, 1008, 1051].includes(it.code)) {
        lines.push("İpucu: bu kutu ya da sayfadaki başka bir kutu veritabanını daha önce değiştirmiş olabilir. \"Veritabanını sıfırla\" ile COMPANY'yi ilk hâline döndürüp tekrar deneyin.");
      }
      out.append(h("div", { class: `res-msg ${it.expected ? "expected" : "error"}` }, lines.join("\n")));
    }
  }
}

/**
 * "Which data is this about?": a row of chips, one per COMPANY table the SQL mentions; a chip opens that table's rows.
 * Rows come from the running database when it is up (so earlier INSERTs show), otherwise from Figure 5.6.
 * getSQL() is called again on refresh() (the box's code can change). Returns the element, with .refresh().
 */
export function tableContext(getSQL, { label = "COMPANY veritabanı", alwaysShow = false } = {}) {
  const chips = h("span", { class: "ctx-chips" });
  const panel = h("div", { class: "ctx-panel", hidden: true });
  const el = h("div", { class: "sqlbox-ctx" }, h("span", { class: "ctx-db", title: "Kutular kitabın COMPANY veritabanı üzerinde çalışır: 8 çalışan, 3 departman, 6 proje" }, label), chips, panel);
  let open = null;
  async function show(t) {
    open = open === t ? null : t;
    for (const c of chips.children) c.setAttribute("aria-pressed", String(c.dataset.t === open));
    if (!open) { panel.hidden = true; panel.replaceChildren(); return; }
    panel.hidden = false;
    let cols, rows, types = null, live = false;
    if (state === "ready") {
      const r = await runSQL(`SELECT * FROM ${t}`);
      if (r.last) ({ cols, rows, types } = r.last), live = true;
    }
    if (!cols) ({ cols, rows } = companyData()[t]);
    if (open !== t) return;
    panel.replaceChildren(
      relationTable(cols, types, rows, { caption: `${t}: ${rows.length} satır` }),
      h("div", { class: "small muted" }, live ? "Veritabanının şu anki hâli (kutularda yaptığınız değişiklikler dahil)." : "COMPANY'nin başlangıç verisi (kitapta Figure 5.6). Kutularda yaptığınız değişiklikler, veritabanı başlayınca burada görünür."));
  }
  el.refresh = () => {
    const ts = tablesIn(getSQL());
    el.hidden = !ts.length && !alwaysShow;
    if (ts.join() === [...chips.children].map((c) => c.dataset.t).join()) return;
    chips.replaceChildren(...ts.map((t) => h("button", { type: "button", class: "ctx-chip", dataset: { t }, "aria-pressed": "false", title: `${t} tablosunun satırlarını göster`, onclick: () => show(t) }, t)));
    if (open && !ts.includes(open)) show(open);
    el.hidden = !ts.length && !alwaysShow;
  };
  el.refresh();
  return el;
}

/** What the engine is doing right now, in words (shown next to the spinner). */
export function loadingText(info) {
  if (info?.stage === "compile") return "MySQL derleniyor … (yavaş bilgisayarlarda 10–30 saniye sürebilir)";
  if (info?.stage === "setup") return "COMPANY veritabanı kuruluyor …";
  const mb = info?.mb ? `${Math.round(info.mb)} / ≈ 87 MB` : "başlıyor";
  return `MySQL tarayıcınıza indiriliyor: ${mb} (yalnızca ilk seferde; sonra tarayıcının önbelleğinden gelir)`;
}

function loadingLine() {
  const text = h("span", {}, loadingText(stateInfo));
  const el = h("div", { class: "loading-db" }, h("span", { class: "spinner" }), text);
  const off = onState((s, info) => { if (s === "loading" && el.isConnected) text.textContent = loadingText(info); else if (s !== "loading") off(); });
  return el;
}

/** The engine failed to start: the reason and what the reader can do about it. */
export function startError(e) {
  return h("div", { class: "res-msg error" },
    `MySQL başlatılamadı: ${e?.message || e}\n`
    + "Yapabilecekleriniz: (1) Tekrar ▶ Çalıştır'a basın, ya da sayfayı yenileyin. "
    + "(2) Bağlantınızı kontrol edin: motor ilk seferde ≈ 24 MB sıkıştırılmış olarak indirilir. "
    + "(3) Reklam engelleyici ya da kurum/okul ağının filtresi .wasm dosyalarını engelliyor olabilir; başka bir ağda ya da gizli pencerede deneyin. "
    + "(4) Güncel Chrome, Edge, Firefox ya da Safari kullanın; bilgisayarın belleği çok azsa diğer sekmeleri kapatın.");
}

let boxCount = 0;

/**
 * Create a SQL box.
 * opts: code, title, expectError, check (exercise spec {n, expect}), saveKey (localStorage), placeholder,
 *       onResult(result), rows (min textarea rows), resetButton (default true)
 */
export function createSqlBox(opts = {}) {
  const id = ++boxCount;
  const original = opts.code ?? "";
  const saved = opts.saveKey ? store.get(opts.saveKey) : null;
  const ta = h("textarea", { spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": `SQL editörü ${opts.title || id}`, placeholder: opts.placeholder || "" });
  ta.value = saved ?? original;
  const pre = h("pre", { "aria-hidden": "true" });
  const editor = h("div", { class: "editor" }, pre, ta);
  const out = h("div", { class: "sqlbox-out", "aria-live": "polite" });

  const paint = () => {
    pre.innerHTML = highlightSQL(ta.value) + "\n";
    ta.style.height = "auto";
    ta.style.height = Math.max(ta.scrollHeight, (opts.rows || 2) * 21 + 20) + "px";
  };
  ta.addEventListener("input", () => { paint(); if (opts.saveKey) store.set(opts.saveKey, ta.value === original ? null : ta.value); });
  ta.addEventListener("focus", () => getDB().catch(() => {}), { once: true }); // start loading while the user types
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    else if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: f } = ta;
      ta.setRangeText("  ", s, f, "end");
      ta.dispatchEvent(new Event("input"));
    }
  });

  const runBtn = button("▶ Çalıştır", () => run(), { kind: "primary", title: "Çalıştır (Ctrl+Enter)" });
  const actions = h("div", { class: "sqlbox-actions" }, runBtn);
  if (original || opts.saveKey) {
    actions.append(button("↺ Koda dön", () => { ta.value = original; store.set(opts.saveKey, null); paint(); out.replaceChildren(); }, { title: "Kutunun ilk hâline dön" }));
  }
  if (opts.resetButton !== false) {
    actions.append(button("Veritabanını sıfırla", async () => {
      out.replaceChildren(loadingLine());
      try {
        await reset();
        out.replaceChildren(h("div", { class: "res-msg ok" }, "COMPANY başlangıç verisine döndürüldü (yaptığınız değişiklikler geri alındı)."));
      } catch (e) {
        out.replaceChildren(startError(e));
      }
    }, { title: "COMPANY tablolarını kitaptaki ilk hâline döndür (yaptığınız INSERT/UPDATE/DELETE geri alınır)" }));
  }
  const head = h("div", { class: "sqlbox-head" }, h("div", { class: "sqlbox-title", html: opts.title || "SQL" }), actions);
  const box = h("div", { class: "sqlbox" }, head);
  if (!opts.database || opts.database === "company") {
    const ctx = tableContext(() => ta.value);
    let timer = 0;
    ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(ctx.refresh, 300); });
    box.append(ctx);
  }
  box.append(editor, out);
  if (opts.foot !== false) box.append(h("div", { class: "sqlbox-foot" }, opts.note ? `${opts.note} ` : "", "Düzenleyebilirsiniz · Ctrl+Enter ile çalıştırın · tarayıcınızda çalışan MySQL üzerinde"));

  async function run() {
    const text = ta.value;
    if (!text.trim()) { out.replaceChildren(h("div", { class: "res-msg warn" }, "Çalıştırılacak SQL yok.")); return null; }
    runBtn.disabled = true;
    if (state !== "ready") out.replaceChildren(loadingLine());
    let res;
    try {
      if (opts.setup) await runSQL(opts.setup, { database: opts.database }); // prerequisites (e.g. a view defined in an earlier box), output not shown
      res = await runSQL(text, { expectError: !!opts.expectError, database: opts.database });
    } catch (e) {
      out.replaceChildren(startError(e));
      runBtn.disabled = false;
      return null;
    }
    if (res.error?.startup) { out.replaceChildren(startError(res.error.message.replace(/^MySQL başlatılamadı: /, ""))); runBtn.disabled = false; return res; }
    out.replaceChildren();
    renderItems(out, res.items);
    if (opts.expectError && !res.error) out.append(h("div", { class: "res-msg warn" }, "UYARI: bu kutunun hata vermesi bekleniyordu ama tüm komutlar başarılı oldu."));
    if (opts.reference && !opts.check) {
      // expected answer = the model solution run on the same database state
      const ref = await runSQL(opts.reference.sql);
      if (ref.last) {
        const { rows, types, cols } = ref.last;
        const ordered = !!opts.reference.ordered;
        const exp = { ncols: cols.length, nrows: rows.length, ordered, hu: await resultHash(rows, types, false), h: ordered ? await resultHash(rows, types, true) : null };
        const r = await checkResult(exp, res.last, res.error);
        out.append(h("div", { class: `res-msg ${r.ok ? "ok" : "warn"}` }, `${r.ok ? "✔" : "✘"} ${opts.reference.label || "Problem"}: ${r.text}`));
        box.dispatchEvent(new CustomEvent("exercisecheck", { bubbles: true, detail: { ...r } }));
      }
    }
    if (opts.check) {
      const r = await checkResult(opts.check.expect, res.last, res.error);
      out.append(h("div", { class: `res-msg ${r.ok ? "ok" : "warn"}` }, `${r.ok ? "✔" : "✘"} Alıştırma ${opts.check.n}: ${r.text}`));
      box.dispatchEvent(new CustomEvent("exercisecheck", { bubbles: true, detail: { n: opts.check.n, ...r } }));
    }
    if (res.inTransaction) out.append(h("div", { class: "res-msg warn" }, "Not: bir transaction hâlâ açık (BEGIN). Bitirmek için COMMIT ya da ROLLBACK çalıştırın."));
    runBtn.disabled = false;
    opts.onResult?.(res);
    return res;
  }

  requestAnimationFrame(paint);
  paint();
  // boxes created inside hidden containers (solutions, closed <details>) have no height yet: repaint when shown
  if (typeof ResizeObserver !== "undefined") {
    let lastW = 0;
    new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w && w !== lastW) { lastW = w; paint(); }
    }).observe(editor);
  }
  return Object.assign(box, { run, setCode: (c) => { ta.value = c; paint(); }, getCode: () => ta.value, textarea: ta, out });
}

/** Upgrade every <pre class="sql"> of a subtree: highlighted, and runnable when it also has class "run". */
export function enhanceSQL(root = document) {
  for (const p of $$("pre.sql:not([data-ready])", root)) {
    p.dataset.ready = "1";
    const code = dedent(p.textContent);
    if (p.classList.contains("run")) {
      const setupFrom = p.dataset.setup ? document.getElementById(p.dataset.setup) : null;
      const setup = setupFrom ? (setupFrom.getCode ? setupFrom.getCode() : dedent(setupFrom.textContent)) : null;
      const box = createSqlBox({
        code, title: p.dataset.title, expectError: p.hasAttribute("data-expect-error"), setup,
        note: setupFrom ? `Önce "${setupFrom.dataset?.title || (setupFrom.querySelector?.(".sqlbox-title")?.textContent ?? "")}" kutusunun kodu sessizce çalıştırılır.` : null,
        rows: Number(p.dataset.rows) || undefined,
        saveKey: p.id ? `sql:${document.body.dataset.page}:${p.id}` : null,
      });
      if (p.id) box.id = p.id;
      p.replaceWith(box);
    } else {
      p.innerHTML = `<code>${highlightSQL(code)}</code>`;
    }
  }
}

// a small indicator of the engine state for pages that want one
export function engineBadge() {
  const el = h("span", { class: "small muted" });
  const paint = (s, info) => {
    el.textContent = s === "ready" ? `MySQL hazır${info?.ms ? ` (${(info.ms / 1000).toFixed(1)} s)` : ""}`
      : s === "loading" ? loadingText(info) : s === "failed" ? `MySQL yüklenemedi: ${info?.error?.message || ""}` : "MySQL ilk kullanımda yüklenecek";
  };
  paint(state, stateInfo);
  onState(paint);
  return el;
}
