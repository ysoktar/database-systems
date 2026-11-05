// Runnable SQL boxes: an editable, highlighted editor + Run button; results print as tables, like the notebook's %%pg.
//   <pre class="sql run" data-title="Q1">SELECT …</pre>     editable and runnable on the page's PostgreSQL
//   <pre class="sql run" data-expect-error>…</pre>         the error is the point (constraint violations, …)
//   <pre class="sql">…</pre>                              display only, highlighted
import { h, $$, highlightSQL, dedent, button } from "./ui.js";
import { runSQL, reset, onState, state, getDB } from "./db.js";
import { checkResult, resultHash } from "./sqlcore.js";

const NUM = new Set([20, 21, 23, 26, 700, 701, 1700]);
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
        : h("td", { class: NUM.has(types?.[j]) || typeof v === "number" ? "n" : null }, typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v)))));
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
      if (it.cols.length === 1 && it.cols[0] === "QUERY PLAN") out.append(h("pre", {}, it.rows.map((r) => r[0]).join("\n")));
      else if (it.rows.length) out.append(relationTable(it.cols, it.types, it.rows));
      else out.append(relationTable(it.cols, it.types, []));
    } else if (it.kind === "status") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "notice") out.append(h("div", { class: "res-msg status" }, it.text));
    else if (it.kind === "error") {
      const lines = [`${it.expected ? "BEKLENEN HATA" : "HATA"} [${it.code || "-"}]: ${it.message}`];
      if (it.detail) lines.push(`Detail: ${it.detail}`);
      if (it.hint) lines.push(`Hint: ${it.hint}`);
      if (it.total > 1) lines.push(`(Kutudaki ${it.total} komutun ${it.index}. komutu; kalanlar çalıştırılmadı.)`);
      if (it.rolledBack) lines.push("Hata yüzünden açık transaction geri alındı (ROLLBACK).");
      out.append(h("div", { class: `res-msg ${it.expected ? "expected" : "error"}` }, lines.join("\n")));
    }
  }
}

function loadingLine() {
  const el = h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "PostgreSQL tarayıcınızda başlatılıyor (ilk seferde ≈ 5 MB indirilir) …");
  return el;
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
      await reset();
      out.replaceChildren(h("div", { class: "res-msg ok" }, "COMPANY, Figure 5.6 hâline döndürüldü."));
    }, { title: "COMPANY tablolarını kitaptaki ilk hâline döndür (yaptığınız INSERT/UPDATE/DELETE geri alınır)" }));
  }
  const head = h("div", { class: "sqlbox-head" }, h("div", { class: "sqlbox-title", html: opts.title || "SQL" }), actions);
  const box = h("div", { class: "sqlbox" }, head, editor, out);
  if (opts.foot !== false) box.append(h("div", { class: "sqlbox-foot" }, "Düzenleyebilirsiniz · Ctrl+Enter ile çalıştırın · tarayıcınızdaki gerçek PostgreSQL üzerinde"));

  async function run() {
    const text = ta.value;
    if (!text.trim()) { out.replaceChildren(h("div", { class: "res-msg warn" }, "Çalıştırılacak SQL yok.")); return null; }
    runBtn.disabled = true;
    if (state !== "ready") out.replaceChildren(loadingLine());
    let res;
    try {
      res = await runSQL(text, { expectError: !!opts.expectError });
    } catch (e) {
      out.replaceChildren(h("div", { class: "res-msg error" }, "PostgreSQL başlatılamadı: " + (e?.message || e)));
      runBtn.disabled = false;
      return null;
    }
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
      const box = createSqlBox({
        code, title: p.dataset.title, expectError: p.hasAttribute("data-expect-error"),
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
    el.textContent = s === "ready" ? `PostgreSQL hazır${info?.ms ? ` (${(info.ms / 1000).toFixed(1)} s)` : ""}`
      : s === "loading" ? "PostgreSQL yükleniyor …" : s === "failed" ? "PostgreSQL yüklenemedi" : "PostgreSQL ilk kullanımda yüklenecek";
  };
  paint(state);
  onState(paint);
  return el;
}
