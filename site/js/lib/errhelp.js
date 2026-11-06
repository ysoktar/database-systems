// Errors as MySQL prints them, plus a suggestion for a misspelled name.
// The engine (go-mysql-server) words some errors its own way: `table "e" does not have column "adress"` (1105) where
// MySQL says ERROR 1054 (42S22): Unknown column 'E.Adress' in 'where clause'. improveError() rewrites those, and for an
// unknown column, table or keyword it looks for the closest COMPANY name ("Did you mean Address?").
//   improveError({code, state, message}, statement) -> {code, state, message, hint, word}
//   word: the misspelled text as typed (for marking its line in the editor)
import { COMPANY_SCHEMA } from "./schema.js";
import { t as tl } from "./i18n.js";

const COLUMNS = COMPANY_SCHEMA.flatMap((t) => t.cols.map(([c]) => ({ table: t.t, col: c })));
const TABLES = COMPANY_SCHEMA.map((t) => t.t);
const KEYWORDS = ["SELECT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "NATURAL", "CROSS", "UNION", "INTERSECT", "EXCEPT", "DISTINCT", "BETWEEN", "EXISTS",
  "CREATE", "TABLE", "VIEW", "ALTER", "DROP", "LIMIT", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END", "NULL", "LIKE", "COUNT", "AVG", "SUM"];

function distance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // swapped letters
  }
  return d[a.length][b.length];
}
/** The closest name, if it is close enough to be a typo. */
export function closest(word, names) {
  let best = null, bestD = Infinity;
  for (const n of names) { const dd = distance(word, n); if (dd < bestD) { bestD = dd; best = n; } }
  const limit = word.length <= 4 ? 1 : 2;
  return bestD > 0 && bestD <= limit ? best : null;
}

/** COMPANY tables named in the statement, with aliases: Map alias/table (lower case) -> table. */
function tablesOf(sql) {
  const map = new Map();
  const re = /\b(FROM|JOIN|UPDATE|INTO|,)\s+([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi;
  for (const m of sql.matchAll(re)) {
    const t = TABLES.find((x) => x.toLowerCase() === m[2].toLowerCase());
    if (!t) continue;
    map.set(t.toLowerCase(), t);
    map.shown ??= [];
    map.shown.push(m[2]);
    if (m[3] && !/^(WHERE|JOIN|ON|GROUP|ORDER|HAVING|LEFT|RIGHT|INNER|NATURAL|CROSS|SET|VALUES|LIMIT|UNION)$/i.test(m[3])) { map.set(m[3].toLowerCase(), t); map.shown.push(m[3]); }
  }
  return map;
}

/** Which clause a position is in, in MySQL's words ('field list', 'where clause', …). */
function clauseAt(sql, pos) {
  const before = sql.slice(0, pos).toUpperCase().replace(/'[^']*'/g, "''");
  const kws = [["SELECT", "field list"], ["WHERE", "where clause"], ["GROUP BY", "group statement"], ["HAVING", "having clause"],
    ["ORDER BY", "order clause"], ["ON", "on clause"], ["SET", "field list"], ["FROM", "from clause"]];
  let best = ["field list", -1];
  for (const [k, name] of kws) { const i = before.lastIndexOf(k); if (i > best[1]) best = [name, i]; }
  return best[0];
}

/** Where a name is used in the statement, as typed (qualified if it was), or null. */
function findUse(sql, name, qualifier) {
  const re = qualifier ? new RegExp(`\\b(${qualifier})\\s*\\.\\s*(${name})\\b`, "i") : new RegExp(`(?<![.\\w])(${name})\\b`, "i");
  const m = re.exec(sql.replace(/'[^']*'/g, (s) => " ".repeat(s.length)));
  if (!m) return null;
  return { text: sql.substr(m.index, m[0].length), index: m.index };
}

export function improveError(err, sql) {
  const out = { ...err, hint: null, word: null };
  const scope = tablesOf(sql);
  const inScope = [...new Set(scope.values())];
  const columnHint = (name, table) => {
    // the exact name exists, but in a table the query does not use: say which table to add
    const elsewhere = COLUMNS.filter((c) => c.col.toLowerCase() === name.toLowerCase() && !inScope.includes(c.table)).map((c) => c.table);
    if (elsewhere.length && !table) return tl(`${name} sütunu ${elsewhere.join(" ve ")} tablosunda; o tabloyu FROM'a ekleyip (join koşuluyla) bağlayın`, `The column ${name} is in ${elsewhere.join(" and ")}; add that table to FROM (with a join condition)`);
    const pool = COLUMNS.filter((c) => (table ? c.table === table : inScope.length ? inScope.includes(c.table) : true));
    const s = closest(name, pool.map((c) => c.col)) || (!table && closest(name, COLUMNS.map((c) => c.col)));
    if (!s) return null;
    const owners = COLUMNS.filter((c) => c.col === s).map((c) => c.table).filter((t) => !table || t === table);
    return tl(`Bunu mu demek istediniz: ${s}? (${owners.join(", ")} tablosunda ${s} sütunu var)`, `Did you mean ${s}? (${owners.join(", ")} has a column ${s})`);
  };

  // table "e" does not have column "adress"  →  1054 Unknown column 'E.Adress' in '…'
  let m = /table "([^"]+)" does not have column "([^"]+)"/i.exec(err.message);
  if (m) {
    const use = findUse(sql, m[2], m[1]);
    const shown = use ? use.text.replace(/\s+/g, "") : `${m[1]}.${m[2]}`;
    out.code = 1054; out.state = "42S22";
    out.message = `Unknown column '${shown}' in '${clauseAt(sql, use ? use.index : 0)}'`;
    out.word = use?.text || m[2];
    out.hint = columnHint(use ? use.text.split(".").pop().trim() : m[2], scope.get(m[1].toLowerCase()));
    return out;
  }
  // column "Adress" could not be found in any table in scope  →  1054 Unknown column 'Adress' in '…'
  m = /column "([^"]+)" could not be found/i.exec(err.message);
  if (m) {
    const use = findUse(sql, m[1]);
    out.code = 1054; out.state = "42S22";
    out.message = `Unknown column '${use ? use.text : m[1]}' in '${clauseAt(sql, use ? use.index : 0)}'`;
    out.word = use?.text || m[1];
    out.hint = columnHint(m[1]);
    return out;
  }
  // table not found: x  →  an unknown alias (X.Fname) is 1054 in MySQL; an unknown table is 1146
  m = /table not found: (\w+)/i.exec(err.message);
  if (m) {
    const qual = new RegExp(`\\b${m[1]}\\s*\\.\\s*(\\w+)`, "i").exec(sql);
    const named = new RegExp(`\\b(FROM|JOIN|UPDATE|INTO|TABLE)\\s+${m[1]}\\b`, "i").test(sql) || new RegExp(`,\\s*${m[1]}\\b`, "i").test(sql);
    if (qual && !named) {
      out.code = 1054; out.state = "42S22";
      out.message = `Unknown column '${qual[0].replace(/\s+/g, "")}' in '${clauseAt(sql, qual.index)}'`;
      out.word = qual[0];
      const known = scope.shown || [];
      out.hint = known.length ? tl(`${qual[0].split(".")[0].trim()} adında bir tablo ya da takma ad yok; FROM'da tanımlananlar: ${known.join(", ")}`, `There is no table or alias called ${qual[0].split(".")[0].trim()}; the ones defined in FROM: ${known.join(", ")}`) : null;
      return out;
    }
    const typed = (new RegExp(`\\b${m[1]}\\b`, "i").exec(sql) || [m[1]])[0];
    out.code = 1146; out.state = "42S02";
    out.message = `Table 'company.${typed}' doesn't exist`;
    out.word = typed;
    const s = closest(typed, TABLES);
    if (s) out.hint = tl(`Bunu mu demek istediniz: ${s}?`, `Did you mean ${s}?`);
    return out;
  }
  // syntax error at position 6 near 'SELEC'  →  MySQL's wording, and a misspelled keyword
  m = /syntax error at position \d+ near '([^']*)'/i.exec(err.message);
  if (m) {
    const near = m[1];
    const lineNo = near ? sql.slice(0, Math.max(0, sql.search(new RegExp(`\\b${near.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)))).split("\n").length : 1;
    const rest = near ? sql.slice(Math.max(0, sql.indexOf(near))).slice(0, 80) : "";
    out.message = `You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${rest}' at line ${lineNo}`;
    out.word = near || null;
    let s = near && closest(near, KEYWORDS);
    // a misspelled keyword is often read as a name (FROM EMPLOYEE ORDR BY …: ORDR becomes an alias), and the error
    // shows up on the next word: look at the word before it too
    if (!s && near) {
      const at = sql.search(new RegExp(`\\b${near.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
      const prev = at > 0 ? (/([A-Za-z_]\w*)\s*$/.exec(sql.slice(0, at)) || [])[1] : null;
      const p = prev && closest(prev, KEYWORDS);
      if (p) { s = p; out.word = prev; }
    }
    if (s) out.hint = tl(`Bunu mu demek istediniz: ${s}? ('${out.word}' yazılmış)`, `Did you mean ${s}? ('${out.word}' was written)`);
    else if (near) out.hint = tl(`Hata '${near}' sözcüğünde ya da hemen öncesinde: eksik virgül, parantez ya da yanlış yazılmış bir anahtar sözcük olabilir.`, `The error is at '${near}' or just before it: a missing comma or parenthesis, or a misspelled keyword.`);
    return out;
  }
  return out;
}
