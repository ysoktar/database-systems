// The COMPANY database state of Figure 5.6 as plain JavaScript (parsed from company.js once), so a page can show the
// rows a query works on without starting the database: next to every SQL box and quiz ("which data is this about?").
import { DATA_SQL } from "./company.js";
import { COMPANY_SCHEMA } from "./schema.js";
import { splitSQL } from "./sqlcore.js";

let cache = null;

/** One SQL literal list "('a', 1, NULL), (…)" → rows of JS values. */
function parseTuples(text) {
  const rows = [];
  let row = null, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "(") { row = []; i++; }
    else if (c === ")") { rows.push(row); row = null; i++; }
    else if (c === "'") {
      let j = i + 1, s = "";
      while (j < text.length && !(text[j] === "'" && text[j + 1] !== "'")) { s += text[j]; j += text[j] === "'" ? 2 : 1; }
      row.push(s); i = j + 1;
    } else if (row && /[-\d.]/.test(c)) {
      const m = /^-?\d+(\.\d+)?/.exec(text.slice(i));
      row.push(m[1] ? m[0] : Number(m[0])); i += m[0].length;
    } else if (row && /^NULL\b/i.test(text.slice(i, i + 5))) { row.push(null); i += 4; }
    else i++;
  }
  return rows;
}

/** { EMPLOYEE: { cols, rows }, … } in the order of Figure 5.6. */
export function companyData() {
  if (cache) return cache;
  cache = {};
  for (const { t, cols } of COMPANY_SCHEMA) cache[t] = { cols: cols.map(([c]) => c), rows: [] };
  for (const s of splitSQL(DATA_SQL)) {
    const m = /^\s*INSERT\s+INTO\s+(\w+)\s+VALUES\s*([\s\S]*)$/i.exec(s);
    if (m && cache[m[1].toUpperCase()]) cache[m[1].toUpperCase()].rows.push(...parseTuples(m[2]));
  }
  // salaries and hours print as MySQL prints DECIMAL(10,2) / DECIMAL(3,1)
  for (const r of cache.EMPLOYEE.rows) if (typeof r[7] === "number") r[7] = r[7].toFixed(2);
  for (const r of cache.WORKS_ON.rows) if (r[2] != null) r[2] = Number(r[2]).toFixed(1);
  return cache;
}

/** The COMPANY tables a piece of SQL mentions, in the order of Figure 5.6. */
export function tablesIn(sql) {
  const words = new Set((String(sql).replace(/'[^']*'/g, " ").match(/[A-Za-z_]+/g) || []).map((w) => w.toUpperCase()));
  return COMPANY_SCHEMA.map((s) => s.t).filter((t) => words.has(t));
}
