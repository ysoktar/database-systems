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
export let stateInfo = null; // loading: { stage: "download" | "compile" | "setup", mb }; failed: { error }
const setState = (s, info = null) => { state = s; stateInfo = info; for (const fn of listeners) fn(s, info); };
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

const STALL_MS = 45000;      // the download is given up when no byte arrives for this long
const COMPILE_MS = 180000;   // and the start when compiling takes longer than this
const nextFrame = () => new Promise((r) => setTimeout(r, 30)); // let the page paint the new stage

/** The engine's bytes, with progress events; fails (instead of hanging) when the download stalls. */
async function download(url) {
  const ctrl = new AbortController();
  let stall = 0;
  const arm = () => { clearTimeout(stall); stall = setTimeout(() => ctrl.abort(), STALL_MS); };
  arm();
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`mysql.wasm indirilemedi (HTTP ${res.status})`);
    if (!res.body?.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let n = 0, painted = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.length;
      arm();
      if (performance.now() - painted > 250) { painted = performance.now(); setState("loading", { stage: "download", mb: n / 1e6 }); }
    }
    const bytes = new Uint8Array(n);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.length; }
    return bytes;
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`indirme ${STALL_MS / 1000} saniyedir ilerlemiyor`);
    throw new Error(`mysql.wasm indirilemedi (${e?.message || e})`);
  } finally {
    clearTimeout(stall);
  }
}

async function create() {
  setState("loading", { stage: "download", mb: 0 });
  const t0 = performance.now();
  await loadGlue();
  const bytes = await download(new URL("mysql.wasm", base));
  setState("loading", { stage: "compile" });
  await nextFrame();
  let timer = 0;
  const db = await Promise.race([
    startEngine(bytes),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`motor ${COMPILE_MS / 1000} saniyede başlamadı`)), COMPILE_MS); }),
  ]).finally(() => clearTimeout(timer));
  setState("loading", { stage: "setup" });
  await nextFrame();
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
  const job = queue.then(async () => resetCompany(await getDB()));
  queue = job.catch(() => {}); // a failed start must not block the boxes that run after it
  return job;
}

const ROW_WORDS = new Set(["SELECT", "WITH", "VALUES", "TABLE", "EXPLAIN", "SHOW", "DESCRIBE", "DESC"]);
const word2 = (s) => firstWord(s.replace(/^\s*\S+/, ""));

/**
 * Run the statements of one box, like the mysql client: every result is collected; the first error stops the box.
 * (An error does not end an open transaction: it stays open until COMMIT or ROLLBACK.)
 * Every box starts in `database` (COMPANY unless told otherwise), so a USE in one box never changes what the next
 * box sees. Returns { items, last, error, inTransaction }.
 * items: {kind: "result", cols, types, rows, caption} | {kind: "status", text} | {kind: "error", …}
 * If the engine cannot start, the result has one {kind: "startup", message} item and error.startup = true (it never
 * rejects, so no caller is left with a spinner).
 */
export function runSQL(text, { expectError = false, database = "company" } = {}) {
  const job = queue.then(async () => {
    let db;
    try {
      db = await getDB();
    } catch (e) {
      const message = e?.message || String(e);
      return { items: [{ kind: "startup", message }], last: null, error: { startup: true, message: `MySQL başlatılamadı: ${message}` }, inTransaction: false };
    }
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
