// Pure SQL helpers shared by the browser and the tests (no DOM):
//   splitSQL      split a box into statements, like the mysql command-line client (DELIMITER included)
//   resultHash    the notebook's exercise fingerprint (sha256 of the normalized rows), ported from Python
//   commandTag    mysql-style status text for statements that return no rows
import { isNumericType } from "./mysql.js";

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").map((l) => l.replace(/(--\s|--$|#).*$/, "")).join("\n");
}

/**
 * Split at the delimiter (';' unless changed) outside quotes and comments.
 * "DELIMITER //" on its own line changes the delimiter, as in the mysql client, so that trigger and procedure bodies
 * (BEGIN … END with ';' inside) stay one statement.
 */
export function splitSQL(text) {
  const stmts = [];
  let buf = "", i = 0, delim = ";";
  const n = text.length;
  const atLineStart = (k) => k === 0 || /\n[ \t]*$/.test(text.slice(Math.max(0, k - 200), k));
  while (i < n) {
    const c = text[i];
    let j;
    if (atLineStart(i) && /^DELIMITER[ \t]+\S+/i.test(text.slice(i, i + 40))) {
      const line = text.slice(i).match(/^DELIMITER[ \t]+(\S+)[^\n]*/i);
      if (buf.trim()) { stmts.push(buf); buf = ""; }
      delim = line[1];
      i += line[0].length;
      continue;
    }
    if (text.startsWith("--", i) || c === "#") {
      j = text.indexOf("\n", i);
      j = j === -1 ? n : j;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      j = end === -1 ? n : end + 2;
    } else if (c === "'" || c === '"' || c === "`") {
      j = i + 1;
      while (j < n) {
        if (text[j] === "\\" && c !== "`") { j += 2; continue; }
        if (text[j] === c) {
          if (text[j + 1] === c) { j += 2; continue; }
          break;
        }
        j++;
      }
      j++;
    } else if (text.startsWith(delim, i)) {
      // a comment on the same line after the delimiter belongs to this statement, not to the next one
      const rest = text.slice(i + delim.length).match(/^[ \t]*((?:--|#)[^\n]*)/);
      stmts.push(rest ? `${buf} ${rest[1]}` : buf);
      buf = "";
      i += delim.length + (rest ? rest[0].length : 0);
      continue;
    } else j = i + 1;
    buf += text.slice(i, j);
    i = j;
  }
  stmts.push(buf);
  return stmts.map((s) => s.trim()).filter((s) => stripComments(s).trim());
}

/** First keyword of a statement (comments skipped), upper-case. */
export function firstWord(stmt) {
  return (stripComments(stmt).trim().split(/\s+/)[0] || "").toUpperCase();
}

/** The caption the notebook prints above a result when a cell has several queries: the leading comment, or the SQL. */
export function caption(stmt) {
  const comments = [], code = [];
  for (const line of stmt.split("\n")) {
    const s = line.trim();
    if (s.startsWith("--") && !code.length) comments.push(s.replace(/^-+/, "").trim());
    else if (s) code.push(s);
  }
  if (comments.length) return comments.join(" ");
  // otherwise a comment at the end of the statement ("SELECT …;  -- Q21")
  const last = code[code.length - 1] || "";
  const k = last.lastIndexOf("--");
  if (k > 0 && (last.slice(0, k).split("'").length % 2) === 1) return last.slice(k + 2).trim();
  const joined = code.join(" ");
  return joined.length > 90 ? joined.slice(0, 90) + " ..." : joined;
}

/** mysql-style status ("INSERT: Query OK, 1 row affected", "CREATE TABLE: Query OK"). */
export function commandTag(stmt, affected) {
  const words = stripComments(stmt).trim().split(/\s+/).map((w) => w.toUpperCase());
  const w0 = words[0] || "";
  const rows = (k) => `${k ?? 0} row${k === 1 ? "" : "s"} affected`;
  if (["INSERT", "UPDATE", "DELETE", "REPLACE"].includes(w0)) return `${w0}: Query OK, ${rows(affected)}`;
  if (["CREATE", "DROP", "ALTER", "RENAME", "TRUNCATE"].includes(w0)) {
    const skip = new Set(["OR", "REPLACE", "TEMPORARY", "UNIQUE", "IF", "NOT", "EXISTS", "DEFINER", "ALGORITHM", "SQL", "SECURITY"]);
    const obj = words.slice(1).find((w) => !skip.has(w) && !w.includes("=")) || "";
    return `${w0} ${obj.replace(/[^A-Z_]/g, "")}: Query OK`.replace("  ", " ");
  }
  if (w0 === "START" || w0 === "BEGIN") return "START TRANSACTION: Query OK";
  return `${w0.replace(/[^A-Z_]/g, "") || "OK"}: Query OK`;
}

// ---------------------------------------------------------------- exercise checker

/** Decimal(str(v)).quantize(Decimal("0.01")) with Python's default ROUND_HALF_EVEN, on the decimal text. */
export function quantize2(v) {
  let s = String(v).trim();
  if (/e/i.test(s)) s = Number(s).toFixed(10);
  let neg = s.startsWith("-");
  if (neg || s.startsWith("+")) s = s.slice(1);
  let [ip, fp = ""] = s.split(".");
  ip = ip.replace(/^0+(?=\d)/, "") || "0";
  fp = fp.padEnd(3, "0");
  let digits = ip + fp.slice(0, 2);
  const rest = fp.slice(2);
  const first = Number(rest[0]);
  const tail = /[1-9]/.test(rest.slice(1));
  const last = Number(digits[digits.length - 1]);
  if (first > 5 || (first === 5 && (tail || last % 2 === 1))) {
    // add one unit in the last place
    const arr = digits.split("").map(Number);
    let k = arr.length - 1;
    while (k >= 0) { if (arr[k] === 9) { arr[k] = 0; k--; } else { arr[k]++; break; } }
    if (k < 0) arr.unshift(1);
    digits = arr.join("");
  }
  const int = digits.slice(0, -2) || "0", frac = digits.slice(-2);
  if (/^0+$/.test(int + frac)) neg = neg && false; // Python prints -0.00 for negative zero; never happens here
  return (neg ? "-" : "") + int + "." + frac;
}

/** One value as the notebook's _norm_val sees it. `type` is the column's MySQL type name. */
export function normValue(v, type) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isNumericType(type) || typeof v === "number" || typeof v === "bigint") return quantize2(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (/^(datetime|timestamp)/i.test(String(type))) return String(v).replace(" ", "T"); // Python isoformat()
  return String(v).replace(/\s+$/, ""); // CHAR(n) padding does not matter
}

/** Python's json.dumps for nested arrays of strings / null (", " separators, ASCII escapes). */
export function pyDumps(x) {
  if (Array.isArray(x)) return "[" + x.map(pyDumps).join(", ") + "]";
  if (x === null) return "null";
  return JSON.stringify(x).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** sha256(json.dumps(normalized rows))[:20]; rows are sorted first unless the order matters. */
export async function resultHash(rows, types, ordered) {
  let norm = rows.map((r) => r.map((v, i) => normValue(v, types[i])));
  if (!ordered) norm = norm.map((r) => [pyDumps(r), r]).sort((a, b) => cmp(a[0], b[0])).map((x) => x[1]);
  const bytes = new TextEncoder().encode(pyDumps(norm));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

/**
 * Compare a result with an exercise's expected fingerprint, exactly like the notebook's _check:
 * columns, then rows, then values (order ignored), then order (when it matters).
 * Returns { ok, reason, text } with a Turkish message.
 */
export async function checkResult(exp, last, error) {
  if (error) return { ok: false, reason: "error", text: "Önce yukarıdaki hatayı düzeltin." };
  if (!last) return { ok: false, reason: "empty", text: "Henüz sonuç yok. Bir SELECT sorgusu yazıp çalıştırın." };
  const { cols, types, rows } = last;
  if (cols.length !== exp.ncols) return { ok: false, reason: "ncols", text: `Henüz değil. Sonuçta ${exp.ncols} sütun olmalı; sizinkinde ${cols.length} var.` };
  if (rows.length !== exp.nrows) return { ok: false, reason: "nrows", text: `Henüz değil. Sonuçta ${exp.nrows} satır olmalı; sizinkinde ${rows.length} var.` };
  if ((await resultHash(rows, types, false)) !== exp.hu) return { ok: false, reason: "values", text: "Henüz değil. Satır sayısı doğru ama bazı değerler farklı." };
  if (exp.ordered && (await resultHash(rows, types, true)) !== exp.h) return { ok: false, reason: "order", text: "Neredeyse! Satırlar doğru ama istenen sırada değil." };
  return { ok: true, reason: "ok", text: "Doğru!" };
}
