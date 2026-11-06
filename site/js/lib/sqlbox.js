// Runnable SQL boxes: an editable, highlighted editor + Run button; results print as tables, like the mysql client.
//   <pre class="sql run" data-title="Q1">SELECT …</pre>     editable and runnable on the page's MySQL (COMPANY)
//   <pre class="sql run" data-expect-error>…</pre>         the error is the point (constraint violations, …)
//   <pre class="sql">…</pre>                              display only, highlighted
import { h, $$, highlightSQL, dedent, button } from "./ui.js";
import { runSQL, reset, onState, state, stateInfo, getDB } from "./db.js";
import { checkResult, resultHash, splitSQL } from "./sqlcore.js";
import { codeView, statementLines } from "./codeview.js";
import { companyData, tablesIn } from "./companydata.js";
import { t as tl, EN } from "./i18n.js";

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
  if (rows.length > maxRows) wrap.append(h("div", { class: "res-caption" }, tl(`… ${rows.length - maxRows} satır daha`, `… ${rows.length - maxRows} more rows`)));
  return wrap;
}

/** Render the items returned by runSQL into a container. */
export function renderItems(out, items) {
  for (const it of items) {
    if (it.kind === "result") {
      const label = tl(`${it.rows.length} satır`, `${it.rows.length} row${it.rows.length === 1 ? "" : "s"}`);
      out.append(h("div", { class: "res-caption" }, it.caption ? `> ${it.caption}   (${label})` : label));
      if (it.cols.length === 1 && /^(plan|EXPLAIN|QUERY PLAN)$/i.test(it.cols[0])) out.append(h("pre", {}, it.rows.map((r) => r[0]).join("\n")));
      else if (it.rows.length) out.append(relationTable(it.cols, it.types, it.rows));
      else out.append(relationTable(it.cols, it.types, []));
    } else if (it.kind === "status") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "notice") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "startup") out.append(startError(it.message));
    else if (it.kind === "error") {
      // as the mysql client prints it: ERROR 1062 (23000): Duplicate entry …
      const lines = [`${it.expected ? tl("BEKLENEN HATA", "EXPECTED ERROR") : tl("HATA", "ERROR")} ${it.code || ""} (${it.state || "HY000"}): ${it.message}`];
      if (it.total > 1) lines.push(tl(`(Kutudaki ${it.total} komutun ${it.index}. komutu; kalanlar çalıştırılmadı.)`, `(Statement ${it.index} of the ${it.total} in the box; the rest were not run.)`));
      // objects that already exist (or are already gone) usually mean the box changed the database on an earlier run
      if (!it.expected && [1050, 1060, 1061, 1146, 1054, 1091, 1062, 1359, 1304, 1007, 1008, 1051].includes(it.code)) {
        lines.push(tl("İpucu: bu kutu ya da sayfadaki başka bir kutu veritabanını daha önce değiştirmiş olabilir. \"Veritabanını sıfırla\" ile COMPANY'yi ilk hâline döndürüp tekrar deneyin.", "Hint: this box or another box on the page may have changed the database earlier. Use \"Reset database\" to bring COMPANY back to its starting state and try again."));
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
export function tableContext(getSQL, { label = tl("COMPANY veritabanı", "COMPANY database"), alwaysShow = false } = {}) {
  const chips = h("span", { class: "ctx-chips" });
  const panel = h("div", { class: "ctx-panel", hidden: true });
  const el = h("div", { class: "sqlbox-ctx" }, h("span", { class: "ctx-db", title: tl("Kutular kitabın COMPANY veritabanı üzerinde çalışır: 8 çalışan, 3 departman, 6 proje", "The boxes run on the book's COMPANY database: 8 employees, 3 departments, 6 projects") }, label), chips, panel);
  let open = null;
  async function show(t, { reload = false } = {}) {
    if (!reload) open = open === t ? null : t;
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
      relationTable(cols, types, rows, { caption: tl(`${t}: ${rows.length} satır`, `${t}: ${rows.length} rows`) }),
      h("div", { class: "small muted" }, live ? tl("Veritabanının şu anki hâli (kutularda yaptığınız değişiklikler dahil).", "The database as it is now (including changes made in the boxes).") : tl("COMPANY'nin başlangıç verisi (kitapta Figure 5.6). Kutularda yaptığınız değişiklikler, veritabanı başlayınca burada görünür.", "COMPANY's starting data (Figure 5.6 in the book). Once the database has started, changes made in the boxes show here.")));
  }
  el.refresh = () => {
    const ts = tablesIn(getSQL());
    el.hidden = !ts.length && !alwaysShow;
    if (ts.join() === [...chips.children].map((c) => c.dataset.t).join()) return;
    chips.replaceChildren(...ts.map((t) => h("button", { type: "button", class: "ctx-chip", dataset: { t }, "aria-pressed": "false", title: tl(`${t} tablosunun satırlarını göster`, `Show the rows of ${t}`), onclick: () => show(t) }, t)));
    if (open && !ts.includes(open)) show(open);
    el.hidden = !ts.length && !alwaysShow;
  };
  el.refresh();
  // an open table follows the database: after any box runs or the database is reset, its rows are read again
  window.addEventListener(DB_CHANGED, () => { if (open && el.isConnected) show(open, { reload: true }); });
  return el;
}

/** Fired after a box ran statements or the database was reset; open table panels re-read their rows. */
export const DB_CHANGED = "company-db-changed";
const announceChange = () => window.dispatchEvent(new Event(DB_CHANGED));

/** What the engine is doing right now, in words (shown next to the spinner). */
export function loadingText(info) {
  if (info?.stage === "cache") return tl("MySQL önbellekten yükleniyor …", "Loading MySQL from the cache …");
  if (info?.stage === "compile") return tl("MySQL derleniyor … (yavaş bilgisayarlarda 10–30 saniye sürebilir)", "Compiling MySQL … (10–30 seconds on a slow computer)");
  if (info?.stage === "setup") return tl("COMPANY veritabanı kuruluyor …", "Setting up the COMPANY database …");
  const mb = info?.mb ? `${Math.round(info.mb)} / ≈ 87 MB` : tl("başlıyor", "starting");
  return tl(`MySQL tarayıcınıza indiriliyor: ${mb} (yalnızca ilk seferde; sonra tarayıcının önbelleğinden gelir)`, `Downloading MySQL into your browser: ${mb} (first time only; afterwards it comes from the browser's cache)`);
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
    EN ? `MySQL could not start: ${e?.message || e}\n`
      + "What you can do: (1) Press ▶ Run again, or reload the page. "
      + "(2) Check your connection: the engine is downloaded once, about 24 MB compressed. "
      + "(3) An ad blocker or a school/company network filter may be blocking .wasm files; try another network or a private window. "
      + "(4) Use a current Chrome, Edge, Firefox or Safari; if the computer is low on memory, close other tabs."
    : `MySQL başlatılamadı: ${e?.message || e}\n`
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
  const cv = codeView({
    value: saved ?? original, editable: true, rows: opts.rows, placeholder: opts.placeholder,
    label: tl(`SQL editörü ${opts.title || id}`, `SQL editor ${opts.title || id}`),
    onInput: () => { if (opts.saveKey) store.set(opts.saveKey, cv.getValue() === original ? null : cv.getValue()); },
    onRun: () => run(),
  });
  const ta = cv.ta;
  const editor = cv.el;
  const paint = cv.paint;
  const out = h("div", { class: "sqlbox-out", "aria-live": "polite" });
  ta.addEventListener("focus", () => getDB().catch(() => {}), { once: true }); // start loading while the user types

  const runBtn = button(tl("▶ Çalıştır", "▶ Run"), () => run(), { kind: "primary", title: tl("Çalıştır (Ctrl+Enter)", "Run (Ctrl+Enter)") });
  const actions = h("div", { class: "sqlbox-actions" }, runBtn);
  cv.copyTool.classList.add("in-head");
  if (original || opts.saveKey) {
    actions.append(button(tl("↺ Koda dön", "↺ Restore code"), () => { cv.setValue(original); store.set(opts.saveKey, null); out.replaceChildren(); }, { title: tl("Kutunun ilk hâline dön", "Go back to the box's original code") }));
  }
  if (opts.resetButton !== false) {
    actions.append(button(tl("Veritabanını sıfırla", "Reset database"), async () => {
      out.replaceChildren(loadingLine());
      try {
        await reset();
        announceChange();
        out.replaceChildren(h("div", { class: "res-msg ok" }, tl("COMPANY başlangıç verisine döndürüldü (yaptığınız değişiklikler geri alındı).", "COMPANY is back to its starting data (your changes were undone).")));
      } catch (e) {
        out.replaceChildren(startError(e));
      }
    }, { title: tl("COMPANY tablolarını kitaptaki ilk hâline döndür (yaptığınız INSERT/UPDATE/DELETE geri alınır)", "Bring the COMPANY tables back to the book's starting state (your INSERT/UPDATE/DELETE are undone)") }));
  }
  actions.append(cv.copyTool);
  const head = h("div", { class: "sqlbox-head" }, h("div", { class: "sqlbox-title", html: opts.title || "SQL" }), actions);
  const box = h("div", { class: "sqlbox" }, head);
  if (!opts.database || opts.database === "company") {
    const ctx = tableContext(() => ta.value);
    let timer = 0;
    ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(ctx.refresh, 300); });
    box.append(ctx);
  }
  box.append(editor, cv.hint, out);
  if (opts.foot !== false) box.append(h("div", { class: "sqlbox-foot" }, opts.note ? `${opts.note} ` : "", tl("Düzenleyebilirsiniz · Ctrl+Enter ile çalıştırın · bir kelimenin üstüne gelin ya da tıklayın: neye ait olduğu gösterilir", "Editable · run with Ctrl+Enter · hover over or click a word to see what it belongs to")));

  async function run() {
    const text = ta.value;
    if (!text.trim()) { out.replaceChildren(h("div", { class: "res-msg warn" }, tl("Çalıştırılacak SQL yok.", "There is no SQL to run."))); return null; }
    runBtn.disabled = true;
    cv.clearMarks();
    if (state !== "ready") out.replaceChildren(loadingLine());
    let t0 = 0;
    let res;
    try {
      if (opts.setup) await runSQL(opts.setup, { database: opts.database }); // prerequisites (e.g. a view defined in an earlier box), output not shown
      if (state === "ready") t0 = performance.now();
      res = await runSQL(text, { expectError: !!opts.expectError, database: opts.database });
    } catch (e) {
      out.replaceChildren(startError(e));
      runBtn.disabled = false;
      return null;
    }
    if (res.error?.startup) { out.replaceChildren(startError(res.error.message.replace(/^(MySQL başlatılamadı|MySQL could not start): /, ""))); runBtn.disabled = false; return res; }
    out.replaceChildren();
    renderItems(out, res.items);
    // the statement that failed: its line numbers turn red (or amber when the error is the point of the box)
    const err = res.items.find((it) => it.kind === "error");
    if (err?.index) cv.markLines(statementLines(text, splitSQL(text), err.index), err.expected ? "expected" : "error");
    const n = splitSQL(text).length;
    out.append(h("div", { class: "res-time" }, [tl(`${n} komut`, `${n} statement${n === 1 ? "" : "s"}`), t0 ? `${Math.max(1, Math.round(performance.now() - t0))} ms` : null].filter(Boolean).join(" · ")));
    if (opts.expectError && !res.error) out.append(h("div", { class: "res-msg warn" }, tl("UYARI: bu kutunun hata vermesi bekleniyordu ama tüm komutlar başarılı oldu.", "WARNING: this box was expected to fail, but every statement succeeded.")));
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
      out.append(h("div", { class: `res-msg ${r.ok ? "ok" : "warn"}` }, `${r.ok ? "✔" : "✘"} ${tl("Alıştırma", "Exercise")} ${opts.check.n}: ${r.text}`));
      box.dispatchEvent(new CustomEvent("exercisecheck", { bubbles: true, detail: { n: opts.check.n, ...r } }));
    }
    if (res.inTransaction) out.append(h("div", { class: "res-msg warn" }, tl("Not: bir transaction hâlâ açık (BEGIN). Bitirmek için COMMIT ya da ROLLBACK çalıştırın.", "Note: a transaction is still open (BEGIN). Run COMMIT or ROLLBACK to end it.")));
    runBtn.disabled = false;
    announceChange();
    opts.onResult?.(res);
    return res;
  }

  return Object.assign(box, { run, setCode: (c) => cv.setValue(c), getCode: () => cv.getValue(), textarea: ta, out });
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
        note: setupFrom ? tl(`Önce "${setupFrom.dataset?.title || (setupFrom.querySelector?.(".sqlbox-title")?.textContent ?? "")}" kutusunun kodu sessizce çalıştırılır.`, `The code of the box "${setupFrom.dataset?.title || (setupFrom.querySelector?.(".sqlbox-title")?.textContent ?? "")}" is run first, silently.`) : null,
        rows: Number(p.dataset.rows) || undefined,
        saveKey: p.id ? `sql:${document.body.dataset.page}:${p.id}` : null,
      });
      if (p.id) box.id = p.id;
      p.replaceWith(box);
    } else {
      const cv = codeView({ value: code });
      const view = h("div", { class: "sqlview" }, cv.el, cv.hint);
      p.replaceWith(view);
    }
  }
}

// a small indicator of the engine state for pages that want one
export function engineBadge() {
  const el = h("span", { class: "small muted" });
  const paint = (s, info) => {
    el.textContent = s === "ready" ? `${tl("MySQL hazır", "MySQL ready")}${info?.ms ? ` (${(info.ms / 1000).toFixed(1)} s)` : ""}`
      : s === "loading" ? loadingText(info) : s === "failed" ? `${tl("MySQL yüklenemedi", "MySQL failed to load")}: ${info?.error?.message || ""}` : tl("MySQL ilk kullanımda yüklenecek", "MySQL loads on first use");
  };
  paint(state, stateInfo);
  onState(paint);
  return el;
}
