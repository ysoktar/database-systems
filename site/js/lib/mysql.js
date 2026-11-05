// Starting the MySQL-compatible engine (go-mysql-server compiled to WebAssembly, see engine/) and talking to it.
// Shared by the browser (db.js) and the tests (Node). Go's glue script (wasm_exec.js) must have defined globalThis.Go.
//
//   const engine = await startEngine(fetch("vendor/mysql/mysql.wasm"))   // browser: a Response (streamed)
//   const engine = await startEngine(bytes)                              // Node: the file's bytes
//   engine.query("SELECT 1") → { isResult, columns, types, rows, affected, error: {code, state, message} }
//   engine.reset()           → a fresh, empty server
// The engine's parser has no quantified comparisons (x > ALL (subquery), x = ANY (…)); query() rewrites them first.

export async function startEngine(source) {
  const go = new globalThis.Go();
  const { instance } = source instanceof Promise || (typeof Response !== "undefined" && source instanceof Response)
    ? await WebAssembly.instantiateStreaming(await source, go.importObject)
    : await WebAssembly.instantiate(source, go.importObject);
  go.run(instance); // returns when the program exits, which it never does (it serves calls)
  for (let i = 0; !globalThis.gmsReady && i < 200; i++) await new Promise((r) => setTimeout(r, 5));
  if (!globalThis.gmsReady) throw new Error("MySQL motoru başlatılamadı");
  return {
    query: (sql) => JSON.parse(globalThis.gmsQuery(rewriteQuantified(sql))),
    reset: () => globalThis.gmsReset(),
  };
}

/** Column types (MySQL names) whose values are numbers. */
export const isNumericType = (t) => /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|double|float|real|bit)\b/i.test(String(t || ""));


// ---- quantified comparisons: x op ALL|ANY|SOME (subquery) ----

/** The text with every quote and comment blanked out (same length), so searches only see SQL. */
function mask(sql) {
  let out = "";
  for (let i = 0; i < sql.length; ) {
    const c = sql[i], d = sql[i + 1];
    let j = i;
    if (c === "'" || c === '"' || c === "`") {
      j = i + 1;
      while (j < sql.length && sql[j] !== c) j += sql[j] === "\\" && c !== "`" ? 2 : 1;
      j++;
    } else if ((c === "-" && d === "-") || c === "#") j = sql.indexOf("\n", i) < 0 ? sql.length : sql.indexOf("\n", i);
    else if (c === "/" && d === "*") j = sql.indexOf("*/", i + 2) < 0 ? sql.length : sql.indexOf("*/", i + 2) + 2;
    if (j > i) { out += c === "`" ? sql.slice(i, Math.min(j, sql.length)) : " ".repeat(Math.min(j, sql.length) - i); i = j; }
    else { out += c; i++; }
  }
  return out;
}

let qn = 0;

/**
 * Rewrite x op ALL (S) / x op ANY (S) into what the engine runs, keeping SQL's meaning in a WHERE/HAVING:
 *   = ANY → IN,  <> ALL → NOT IN,
 *   x op ANY (S) → EXISTS (SELECT 1 FROM (S) AS q(c) WHERE x op q.c)
 *   x op ALL (S) → NOT EXISTS (SELECT 1 FROM (S) AS q(c) WHERE NOT (x op q.c) OR q.c IS NULL OR x IS NULL)
 * x is a column, a qualified column, a number or a parenthesized expression.
 */
export function rewriteQuantified(sql) {
  if (!/\b(ALL|ANY|SOME)\s*\(/i.test(sql)) return sql;
  const m = mask(sql);
  const QUANT = /(=|<>|!=|<=|>=|<|>)\s*(ALL|ANY|SOME)\s*\(/gi;
  let out = "", from = 0, hit;
  while ((hit = QUANT.exec(m))) {
    const open = hit.index + hit[0].length - 1;
    let depth = 0, close = -1;
    for (let i = open; i < m.length; i++) {
      if (m[i] === "(") depth++;
      else if (m[i] === ")" && --depth === 0) { close = i; break; }
    }
    if (close < 0) break;
    // the left operand, ending just before the operator
    const before = m.slice(0, hit.index).replace(/\s+$/, "");
    let start = -1;
    if (before.endsWith(")")) {
      let dd = 0;
      for (let i = before.length - 1; i >= 0; i--) {
        if (before[i] === ")") dd++;
        else if (before[i] === "(" && --dd === 0) { start = i; break; }
      }
    } else {
      const lm = /(?:`[^`]*`|[A-Za-z_$][\w$]*)(?:\.(?:`[^`]*`|[A-Za-z_$][\w$]*))*$|\d+(?:\.\d+)?$/.exec(before);
      if (lm) start = lm.index;
    }
    if (start < from) continue; // not a shape we know: leave it to the engine
    const lhs = sql.slice(start, before.length);
    const op = hit[1] === "!=" ? "<>" : hit[1];
    const q = hit[2].toUpperCase() === "ALL" ? "ALL" : "ANY";
    const sub = rewriteQuantified(sql.slice(open + 1, close));
    let rep;
    if (op === "=" && q === "ANY") rep = `${lhs} IN (${sub})`;
    else if (op === "<>" && q === "ALL") rep = `${lhs} NOT IN (${sub})`;
    else {
      const a = `q__${++qn}`;
      rep = q === "ANY"
        ? `EXISTS (SELECT 1 FROM (${sub}) AS ${a}(c) WHERE ${lhs} ${op} ${a}.c)`
        : `NOT EXISTS (SELECT 1 FROM (${sub}) AS ${a}(c) WHERE NOT (${lhs} ${op} ${a}.c) OR ${a}.c IS NULL OR ${lhs} IS NULL)`;
    }
    out += sql.slice(from, start) + rep;
    from = close + 1;
    QUANT.lastIndex = close + 1;
  }
  return out + sql.slice(from);
}
