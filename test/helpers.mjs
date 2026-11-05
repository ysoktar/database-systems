// A fresh COMPANY database on PGlite (PostgreSQL in WebAssembly), set up exactly as the site's db.js does.
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_SQL, DATA_SQL } from "../site/js/lib/company.js";
import { splitSQL } from "../site/js/lib/sqlcore.js";

const raw = (x) => x;
export async function companyDB() {
  const db = await PGlite.create({ parsers: { 1082: raw, 1083: raw, 1114: raw, 1184: raw } });
  await db.exec("CREATE SCHEMA company; SET search_path TO company, public;");
  for (const part of [SCHEMA_SQL, DATA_SQL]) for (const s of splitSQL(part)) await db.query(s);
  return db;
}

/** Run every statement; return the last result as {cols, types, rows}. */
export async function lastResult(db, sql) {
  let last = null;
  for (const s of splitSQL(sql)) {
    const r = await db.query(s, [], { rowMode: "array" });
    if (r.fields.length) last = { cols: r.fields.map((f) => f.name), types: r.fields.map((f) => f.dataTypeID), rows: r.rows };
  }
  return last;
}
