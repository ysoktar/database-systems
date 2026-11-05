// The site's MySQL engine (engine/dist/mysql.wasm, built by `npm run engine`) in Node, with COMPANY set up exactly as
// the browser does it (site/js/lib/db.js).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startEngine } from "../site/js/lib/mysql.js";
import { resetCompany } from "../site/js/lib/db.js";
import { splitSQL } from "../site/js/lib/sqlcore.js";

const dist = join(import.meta.dirname, "..", "engine", "dist");
let enginePromise = null;

/** The engine (one per test file), reset to COMPANY. Call reset() on it again to start over. */
export async function companyDB() {
  if (!enginePromise) {
    enginePromise = (async () => {
      await import(join(dist, "wasm_exec.js"));
      return startEngine(readFileSync(join(dist, "mysql.wasm")));
    })();
  }
  const db = await enginePromise;
  resetCompany(db);
  return db;
}

/** Run every statement; return the last result as {cols, types, rows}; throw on the first error. */
export async function lastResult(db, sql) {
  let last = null;
  for (const s of splitSQL(sql)) {
    const r = db.query(s);
    if (r.error) throw new Error(`${r.error.code} ${r.error.message} in: ${s.slice(0, 80)}`);
    if (r.isResult) last = { cols: r.columns, types: r.types, rows: r.rows };
  }
  return last;
}

/** Run every statement and return the first error (or null). */
export function firstError(db, sql) {
  for (const s of splitSQL(sql)) {
    const r = db.query(s);
    if (r.error) return r.error;
  }
  return null;
}
