// Transaction schedules (Ch 20): parsing the book's shorthand (r1(X); w2(Y); c1; a2), conflicting operations, the
// precedence graph and the conflict-serializability test (Algorithm 20.1), an equivalent serial order, and the
// recoverability classes (recoverable, cascadeless, strict) with the reasons.

/** "r1(X); w1(X); c1" → [{ t: 1, kind: "r", item: "X", i: 0 }, …]. kind: r, w, c (commit), a (abort). */
export function parseSchedule(text) {
  const ops = [], errors = [];
  for (const raw of String(text).split(/[;,\n]+|\s+(?=[rwcabRWCAB]\d)/).map((s) => s.trim()).filter(Boolean)) {
    const m = raw.match(/^([rwRW])\s*(\d+)\s*\(\s*([A-Za-z_]\w*)\s*\)$/) || raw.match(/^([caCA])\s*(\d+)$/);
    if (!m) { errors.push(raw); continue; }
    ops.push({ t: Number(m[2]), kind: m[1].toLowerCase(), item: m[3] || null, i: ops.length });
  }
  return { ops, errors };
}
export const opText = (o) => (o.item ? `${o.kind}${o.t}(${o.item})` : `${o.kind}${o.t}`);
export const transactions = (ops) => [...new Set(ops.map((o) => o.t))].sort((a, b) => a - b);

/** Pairs of conflicting operations, in schedule order: different transactions, same item, at least one write. */
export function conflicts(ops) {
  const out = [];
  for (let a = 0; a < ops.length; a++) for (let b = a + 1; b < ops.length; b++) {
    const x = ops[a], y = ops[b];
    if (!x.item || !y.item || x.t === y.t || x.item !== y.item || (x.kind === "r" && y.kind === "r")) continue;
    out.push({ from: x, to: y, type: `${x.kind === "r" ? "read" : "write"}-${y.kind === "r" ? "read" : "write"}` });
  }
  return out;
}

/** Precedence graph: nodes are transactions, an edge Ti → Tj for every conflict where Ti's operation comes first. */
export function precedenceGraph(ops) {
  const nodes = transactions(ops);
  const edges = new Map(); // "i>j" → { from, to, because: [conflicts] }
  for (const c of conflicts(ops)) {
    const k = `${c.from.t}>${c.to.t}`;
    if (!edges.has(k)) edges.set(k, { from: c.from.t, to: c.to.t, because: [] });
    edges.get(k).because.push(c);
  }
  return { nodes, edges: [...edges.values()] };
}

/** A cycle in the graph (list of nodes, first = last) or null. */
export function findCycle({ nodes, edges }) {
  const adj = new Map(nodes.map((n) => [n, edges.filter((e) => e.from === n).map((e) => e.to)]));
  const state = new Map(), stack = [];
  let cycle = null;
  const dfs = (n) => {
    state.set(n, 1); stack.push(n);
    for (const m of adj.get(n) || []) {
      if (cycle) return;
      if (state.get(m) === 1) { cycle = [...stack.slice(stack.indexOf(m)), m]; return; }
      if (!state.get(m)) dfs(m);
    }
    stack.pop(); state.set(n, 2);
  };
  for (const n of nodes) { if (!state.get(n)) dfs(n); if (cycle) break; }
  return cycle;
}

/** An equivalent serial order (topological sort) or null when the graph has a cycle. */
export function serialOrder(g) {
  if (findCycle(g)) return null;
  const indeg = new Map(g.nodes.map((n) => [n, 0]));
  for (const e of g.edges) indeg.set(e.to, indeg.get(e.to) + 1);
  const order = [], ready = g.nodes.filter((n) => !indeg.get(n));
  while (ready.length) {
    ready.sort((a, b) => a - b);
    const n = ready.shift(); order.push(n);
    for (const e of g.edges.filter((x) => x.from === n)) { indeg.set(e.to, indeg.get(e.to) - 1); if (!indeg.get(e.to)) ready.push(e.to); }
  }
  return order;
}

/** For each read, the write it reads from (the last earlier write of the item by another, not yet aborted, transaction). */
export function readsFrom(ops) {
  const out = [];
  ops.forEach((o, p) => {
    if (o.kind !== "r") return;
    for (let q = p - 1; q >= 0; q--) {
      const w = ops[q];
      if (w.kind !== "w" || w.item !== o.item) continue;
      if (w.t === o.t) break; // reads its own write
      const abortedBefore = ops.slice(0, p).some((x) => x.kind === "a" && x.t === w.t);
      if (abortedBefore) continue;
      out.push({ read: o, write: w });
      break;
    }
  });
  return out;
}

/** Recoverable / cascadeless / strict, each with a reason (the operations that break it, or null). */
export function recoverability(ops) {
  const end = (t) => ops.find((o) => (o.kind === "c" || o.kind === "a") && o.t === t);
  const rf = readsFrom(ops);
  let recoverable = null, cascadeless = null, strict = null;
  for (const { read, write } of rf) {
    const cr = ops.find((o) => o.kind === "c" && o.t === read.t), ew = end(write.t);
    // recoverable: the reader may commit only after the writer has committed
    if (!recoverable && cr && !(ew && ew.kind === "c" && ew.i < cr.i)) recoverable = { read, write, commit: cr, writerEnd: ew || null };
    // cascadeless: the reader reads only committed values
    if (!cascadeless && !(ew && ew.kind === "c" && ew.i < read.i)) cascadeless = { read, write };
  }
  // strict: no read or write of X until the last transaction that wrote X has committed or aborted
  ops.forEach((o, p) => {
    if (strict || !o.item) return;
    for (let q = p - 1; q >= 0; q--) {
      const w = ops[q];
      if (w.kind !== "w" || w.item !== o.item) continue;
      if (w.t === o.t) break;
      const e = end(w.t);
      if (!(e && e.i < p)) strict = { op: o, write: w };
      break;
    }
  });
  return { readsFrom: rf, recoverable: !recoverable, cascadeless: !cascadeless, strict: !strict, why: { recoverable, cascadeless, strict } };
}

/** The book's schedules (Figures 20.5, 20.3; Section 20.4). */
export const BOOK_SCHEDULES = {
  A: "r1(X); w1(X); r1(Y); w1(Y); r2(X); w2(X)",
  B: "r2(X); w2(X); r1(X); w1(X); r1(Y); w1(Y)",
  C: "r1(X); r2(X); w1(X); r1(Y); w2(X); w1(Y)",
  D: "r1(X); w1(X); r2(X); w2(X); r1(Y); w1(Y)",
  Sa: "r1(X); r2(X); w1(X); r1(Y); w2(X); c2; w1(Y); c1",
  Sc: "r1(X); w1(X); r2(X); r1(Y); w2(X); c2; a1",
  Sd: "r1(X); w1(X); r2(X); r1(Y); w2(X); w1(Y); c1; c2",
  Se: "r1(X); w1(X); r2(X); r1(Y); w2(X); w1(Y); a1; a2",
  E: "r1(X); w1(X); r2(Y); w2(Y); r3(Y); w3(Y); r1(Y); w1(Y); r3(X); w3(X)",
};
