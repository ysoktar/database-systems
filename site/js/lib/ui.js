// UI building blocks: DOM helper, buttons, callout icons, SQL syntax highlighting.

/** Tiny hyperscript: h("div", {class: "x", onclick: f}, "text", child, …). Strings become text nodes (never HTML). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v; // only ever used with trusted, hard-coded markup
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function button(label, onClick, { kind = "", title } = {}) {
  const b = h("button", { type: "button", class: "btn small " + kind, title }, label);
  b.addEventListener("click", onClick);
  return b;
}

export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------------------------------------------------------------- SQL highlighting
const KEYWORDS = new Set(`SELECT FROM WHERE AND OR NOT AS DISTINCT ALL ORDER BY GROUP HAVING ASC DESC INSERT INTO VALUES UPDATE SET DELETE
CREATE TABLE VIEW DROP ALTER ADD COLUMN CONSTRAINT PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT NULL IS IN EXISTS ANY SOME
BETWEEN LIKE JOIN INNER LEFT RIGHT FULL OUTER NATURAL CROSS ON USING UNION INTERSECT EXCEPT WITH RECURSIVE CASE WHEN THEN ELSE END
CASCADE RESTRICT NO ACTION TRIGGER BEFORE AFTER FOR EACH ROW EXECUTE FUNCTION PROCEDURE RETURNS RETURN BEGIN COMMIT ROLLBACK
LANGUAGE DECLARE IF OR REPLACE ASSERTION SCHEMA AUTHORIZATION DOMAIN DEFERRABLE INITIALLY DEFERRED IMMEDIATE TRUE FALSE UNKNOWN
INT INTEGER SMALLINT CHAR VARCHAR DECIMAL NUMERIC DATE TIME TIMESTAMP BOOLEAN REAL FLOAT TEXT INTERVAL LIMIT OFFSET
NEW OLD OF CAST GRANT REVOKE TO PRIVILEGES CONSTRAINTS ONLY LATERAL FETCH FIRST ROWS NEXT EXPLAIN RAISE EXCEPTION NOTICE
TRANSACTION SAVEPOINT RELEASE STATEMENT MATERIALIZED TEMP TEMPORARY OPTION LOCAL CASCADED`.split(/\s+/));
const FUNCS = new Set("COUNT SUM AVG MIN MAX COALESCE NULLIF UPPER LOWER LENGTH SUBSTRING EXTRACT AGE NOW CURRENT_DATE ROUND STRING_AGG ARRAY_AGG TRIM CONCAT POSITION".split(" "));

/** Turn SQL text into highlighted HTML (comments, strings, numbers, keywords, functions). */
export function highlightSQL(src) {
  const re = /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\$\$)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    const [tok, cmt, str, , dollar, num, word] = m;
    if (cmt) out += `<span class="tok-cmt">${escapeHtml(tok)}</span>`;
    else if (str) out += `<span class="tok-str">${escapeHtml(tok)}</span>`;
    else if (dollar) out += `<span class="tok-str">$$</span>`;
    else if (num) out += `<span class="tok-num">${tok}</span>`;
    else if (word && KEYWORDS.has(word.toUpperCase())) out += `<span class="tok-kw">${tok}</span>`;
    else if (word && FUNCS.has(word.toUpperCase())) out += `<span class="tok-fn">${tok}</span>`;
    else out += escapeHtml(tok);
    last = re.lastIndex;
  }
  return out + escapeHtml(src.slice(last));
}

/** Remove the common leading indentation of a block of code and trim blank first/last lines. */
export function dedent(s) {
  const lines = s.replace(/\t/g, "  ").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(ind)).join("\n");
}

export const CALLOUT_ICONS = {
  look: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  discuss: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z" stroke-linejoin="round"/></svg>',
  gotcha: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2l6.5 11.5h-13z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>',
  try: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5l2.5 2.5L12 5"/><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="3"/></svg>',
  note: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 7v4.2M8 4.7v.1"/></svg>',
  why: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8a4.4 4.4 0 0 0-2.6 8v1.7h5.2V9.8A4.4 4.4 0 0 0 8 1.8z" stroke-linejoin="round"/><path d="M6 13.8h4"/></svg>',
  connect: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="3.5" r="2"/><circle cx="12.5" cy="12.5" r="2"/><path d="M5.3 7.1l5.4-2.7M5.3 8.9l5.4 2.7"/></svg>',
  example: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="1.8" width="11" height="12.4" rx="1.6"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5"/></svg>',
};
