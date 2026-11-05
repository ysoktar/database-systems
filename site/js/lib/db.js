// One MySQL per page, in the browser: go-mysql-server (a MySQL-compatible engine) compiled to WebAssembly (engine/).
// It is downloaded (≈ 23 MB compressed, cached by the browser afterwards) the first time a SQL box is used on a page,
// then set up with the COMPANY schema and data, as the notebook's sqlnb.setup(reset=True) does.
import { SCHEMA_SQL, DATA_SQL, TABLES } from "./company.js";
import { splitSQL, firstWord, caption, commandTag } from "./sqlcore.js";
import { startEngine } from "./mysql.js";

let dbPromise = null;
let queue = Promise.resolve(); // statements of different boxes never interleave
const listeners = new Set();
export let state = "idle"; // idle | loading | ready | failed
const setState = (s, info) => { state = s; for (const fn of listeners) fn(s, info); };
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let inTransaction = false;
const base = new URL("../../vendor/mysql/", import.meta.url);

function loadGlue() {
  if (globalThis.Go) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("wasm_exec.js", base).href;
    s.onload = resolve;
    s.onerror = () => reject(new Error("wasm_exec.js yüklenemedi"));
    document.head.append(s);
  });
}

async function create() {
  setState("loading");
  const t0 = performance.now();
  await loadGlue();
  const db = await startEngine(fetch(new URL("mysql.wasm", base)));
  resetCompany(db);
  setState("ready", { ms: performance.now() - t0 });
  return db;
}

export function getDB() {
  if (!dbPromise) dbPromise = create().catch((e) => { setState("failed", { error: e }); dbPromise = null; throw e; });
  return dbPromise;
}

/** Restore COMPANY to Figure 6.1/6.2 + the Figure 5.6 database state (the notebook's sqlnb.reset_company()). */
export function resetCompany(db) {
  db.reset();
  inTransaction = false;
  for (const s of ["CREATE DATABASE IF NOT EXISTS demo", "USE company", ...splitSQL(SCHEMA_SQL), ...splitSQL(DATA_SQL)]) {
    const r = db.query(s);
    if (r.error) throw new Error(`COMPANY kurulamadı: ${r.error.message} (${s.slice(0, 60)})`);
  }
}

export function reset() {
  return (queue = queue.then(async () => resetCompany(await getDB())));
}

const ROW_WORDS = new Set(["SELECT", "WITH", "VALUES", "TABLE", "EXPLAIN", "SHOW", "DESCRIBE", "DESC"]);
const word2 = (s) => firstWord(s.replace(/^\s*\S+/, ""));

/**
 * Run the statements of one box, like the mysql client: every result is collected; the first error stops the box.
 * (An error does not end an open transaction: it stays open until COMMIT or ROLLBACK.)
 * Every box starts in `database` (COMPANY unless told otherwise), so a USE in one box never changes what the next
 * box sees. Returns { items, last, error, inTransaction }.
 * items: {kind: "result", cols, types, rows, caption} | {kind: "status", text} | {kind: "error", …}
 */
export function runSQL(text, { expectError = false, database = "company" } = {}) {
  const job = queue.then(async () => {
    const db = await getDB();
    const stmts = splitSQL(text);
    db.query(`USE ${database}`);
    const multi = stmts.filter((s) => ROW_WORDS.has(firstWord(s))).length > 1;
    const items = [];
    let last = null, error = null, statuses = [];
    const flush = () => { if (statuses.length) { items.push({ kind: "status", text: statuses.join("   ·   ") }); statuses = []; } };
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      const r = db.query(s);
      if (r.error) {
        flush();
        error = { code: r.error.code, state: r.error.state, message: r.error.message, index: i + 1, total: stmts.length };
        items.push({ kind: "error", expected: expectError, ...error });
        break;
      }
      const w = firstWord(s);
      if (w === "BEGIN" || (w === "START" && word2(s) === "TRANSACTION")) inTransaction = true;
      if (w === "COMMIT" || w === "ROLLBACK") inTransaction = false;
      if (r.isResult) {
        flush();
        last = { cols: r.columns, types: r.types, rows: r.rows };
        items.push({ kind: "result", ...last, caption: multi ? caption(s) : null });
      } else statuses.push(commandTag(s, r.affected));
    }
    flush();
    return { items, last, error, inTransaction };
  });
  queue = job.catch(() => {});
  return job;
}

/** Column names, types and keys of the tables of a database (for the schema browser). */
export async function describe(schema = "company") {
  const { last } = await runSQL(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME, c.COLUMN_TYPE, c.IS_NULLABLE,
           (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k
             WHERE k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = c.COLUMN_NAME
               AND k.CONSTRAINT_NAME = 'PRIMARY') AS pk,
           (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k
             WHERE k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = c.COLUMN_NAME
               AND k.REFERENCED_TABLE_NAME IS NOT NULL) AS fk
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = '${schema}'
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`);
  const tables = new Map();
  for (const [t, col, ty, nul, pk, fk] of last?.rows || []) {
    if (!tables.has(t)) tables.set(t, []);
    tables.get(t).push({ name: col, type: String(ty).toUpperCase(), nullable: nul === "YES", pk: pk > 0, fk: fk > 0 });
  }
  return tables;
}

export { TABLES };
