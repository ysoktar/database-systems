// One PostgreSQL per page, in the browser: PGlite (PostgreSQL compiled to WebAssembly).
// It is downloaded (≈ 5 MB compressed, cached afterwards) the first time a SQL box is used on a page,
// then set up with the COMPANY schema and data, as the notebook's sqlnb.setup(reset=True) does.
import { SCHEMA_SQL, DATA_SQL, TABLES } from "./company.js";
import { splitSQL, firstWord, caption, commandTag } from "./sqlcore.js";

let dbPromise = null;
let queue = Promise.resolve(); // statements of different boxes never interleave
const listeners = new Set();
export let state = "idle"; // idle | loading | ready | failed
const setState = (s, info) => { state = s; for (const fn of listeners) fn(s, info); };
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const raw = (x) => x;
// dates and times come back as PostgreSQL prints them ('1965-01-09'), not as JavaScript Date objects
const PARSERS = { 1082: raw, 1083: raw, 1114: raw, 1184: raw, 1186: raw };

async function create() {
  setState("loading");
  const t0 = performance.now();
  const { PGlite } = await import("../../vendor/pglite/index.js");
  const db = await PGlite.create({ parsers: PARSERS });
  await resetCompany(db);
  setState("ready", { ms: performance.now() - t0 });
  return db;
}

export function getDB() {
  if (!dbPromise) dbPromise = create().catch((e) => { setState("failed", { error: e }); dbPromise = null; throw e; });
  return dbPromise;
}

/** Restore COMPANY to Figure 6.1/6.2 + the Figure 5.6 database state (the notebook's sqlnb.reset_company()). */
async function resetCompany(db) {
  if (db.isInTransaction()) await db.query("ROLLBACK");
  await db.exec("DROP SCHEMA IF EXISTS company CASCADE; DROP SCHEMA IF EXISTS demo CASCADE; CREATE SCHEMA company; CREATE SCHEMA demo; SET search_path TO company, public;");
  for (const part of [SCHEMA_SQL, DATA_SQL]) for (const s of splitSQL(part)) await db.query(s);
}

export function reset() {
  return (queue = queue.then(async () => resetCompany(await getDB())));
}

const ROW_WORDS = new Set(["SELECT", "WITH", "VALUES", "TABLE", "EXPLAIN", "SHOW"]);

/**
 * Run the statements of one box, like the notebook's %%pg: every result is collected; the first error stops the box
 * and rolls back an aborted transaction. Returns { items, last, error, inTransaction }.
 * items: {kind: "result", cols, types, rows, caption} | {kind: "status", text} | {kind: "notice", text} | {kind: "error", …}
 */
export function runSQL(text, { expectError = false } = {}) {
  const job = queue.then(async () => {
    const db = await getDB();
    const stmts = splitSQL(text);
    const multi = stmts.filter((s) => ROW_WORDS.has(firstWord(s))).length > 1;
    const items = [];
    let last = null, error = null, statuses = [];
    const flush = () => { if (statuses.length) { items.push({ kind: "status", text: statuses.join("   ") }); statuses = []; } };
    const onNotice = (n) => { flush(); items.push({ kind: "notice", text: `${n.severity || "NOTICE"}: ${n.message}` }); };
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      try {
        const r = await db.query(s, [], { rowMode: "array", onNotice });
        if (r.fields && r.fields.length) {
          flush();
          last = { cols: r.fields.map((f) => f.name), types: r.fields.map((f) => f.dataTypeID), rows: r.rows };
          items.push({ kind: "result", ...last, caption: multi ? caption(s) : null });
        } else statuses.push(commandTag(s, r.affectedRows));
      } catch (e) {
        flush();
        let rolledBack = false;
        if (db.isInTransaction()) {
          try { await db.query("ROLLBACK"); rolledBack = true; } catch { /* already gone */ }
        }
        error = { code: e.code, message: e.message, detail: e.detail, hint: e.hint, index: i + 1, total: stmts.length, rolledBack };
        items.push({ kind: "error", expected: expectError, ...error });
        break;
      }
    }
    flush();
    return { items, last, error, inTransaction: db.isInTransaction() };
  });
  queue = job.catch(() => {});
  return job;
}

/** Column names, types and keys of the COMPANY tables (for the schema browser). */
export async function describe() {
  const { last } = await runSQL(`
    SELECT c.table_name, c.column_name, c.data_type, c.character_maximum_length, c.numeric_precision, c.numeric_scale, c.is_nullable,
           EXISTS (SELECT 1 FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k
                   ON t.constraint_name = k.constraint_name AND t.table_schema = k.table_schema
                   WHERE t.constraint_type = 'PRIMARY KEY' AND k.table_name = c.table_name AND k.column_name = c.column_name
                     AND t.table_schema = 'company') AS pk,
           EXISTS (SELECT 1 FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k
                   ON t.constraint_name = k.constraint_name AND t.table_schema = k.table_schema
                   WHERE t.constraint_type = 'FOREIGN KEY' AND k.table_name = c.table_name AND k.column_name = c.column_name
                     AND t.table_schema = 'company') AS fk
    FROM information_schema.columns c
    WHERE c.table_schema = 'company'
    ORDER BY c.table_name, c.ordinal_position`);
  const tables = new Map();
  for (const [t, col, ty, len, prec, scale, nul, pk, fk] of last.rows) {
    if (!tables.has(t)) tables.set(t, []);
    const type = ty === "character varying" ? `VARCHAR(${len})` : ty === "character" ? (len > 1 ? `CHAR(${len})` : "CHAR")
      : ty === "numeric" ? `DECIMAL(${prec},${scale})` : ty === "integer" ? "INT" : ty.toUpperCase();
    tables.get(t).push({ name: col, type, nullable: nul === "YES", pk, fk });
  }
  return tables;
}

export { TABLES };
