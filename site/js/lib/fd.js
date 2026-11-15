// Functional dependencies and normal forms (Ch 14): attribute closure, candidate keys, prime attributes, the 2NF/3NF/BCNF
// tests with the dependency that breaks each one, decomposition into a normal form (one split at a time, as in the
// book: the violating X → A gives R − A and X ∪ A), and the non-additive join test for binary decompositions (NJB).
// Attributes are strings; an FD is { lhs: [attrs], rhs: [attrs] }. Pure module: used by the page and by the tests.

const uniq = (a) => [...new Set(a)];
const subsetOf = (a, b) => a.every((x) => b.includes(x));
const same = (a, b) => a.length === b.length && subsetOf(a, b);

/** "A, B -> C; C -> D" (or one FD per line; → and , accepted) → [{ lhs, rhs }] */
export function parseFDs(text) {
  const fds = [];
  for (const part of String(text).split(/[;\n]+/)) {
    const m = part.split(/->|→/);
    if (m.length !== 2) continue;
    const side = (s) => uniq(s.replace(/[{}]/g, "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean));
    const lhs = side(m[0]), rhs = side(m[1]);
    if (lhs.length && rhs.length) fds.push({ lhs, rhs });
  }
  return fds;
}
export const parseAttrs = (text) => uniq(String(text).replace(/[(){}]/g, " ").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean));

/** X⁺: every attribute that X determines under F. */
export function closure(X, fds) {
  const c = new Set(X);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of fds) if (f.lhs.every((a) => c.has(a)) && f.rhs.some((a) => !c.has(a))) { f.rhs.forEach((a) => c.add(a)); grew = true; }
  }
  return [...c];
}

/** All subsets of attrs, smallest first (attrs is small: the page limits it). */
function subsets(attrs) {
  const out = [];
  for (let m = 1; m < 1 << attrs.length; m++) out.push(attrs.filter((_, i) => m & (1 << i)));
  return out.sort((a, b) => a.length - b.length);
}

export const isSuperkey = (X, R, fds) => subsetOf(R, closure(X, fds));

/** Candidate keys: minimal superkeys. */
export function candidateKeys(R, fds) {
  const keys = [];
  for (const X of subsets(R)) {
    if (keys.some((k) => subsetOf(k, X))) continue; // contains a key: a superkey, not minimal
    if (isSuperkey(X, R, fds)) keys.push(X);
  }
  return keys;
}

/** The FDs that hold on a part Ri of R: X → (X⁺ ∩ Ri) − X for subsets X of Ri, without redundant left sides. */
export function projectFDs(Ri, fds) {
  const out = [];
  for (const X of subsets(Ri)) {
    if (X.length === Ri.length) continue;
    const Y = closure(X, fds).filter((a) => Ri.includes(a) && !X.includes(a));
    // keep only what a smaller left side does not already give
    const known = out.filter((f) => subsetOf(f.lhs, X)).flatMap((f) => f.rhs);
    const add = Y.filter((a) => !known.includes(a));
    if (add.length) out.push({ lhs: X, rhs: add });
  }
  return out;
}

/** The normal form tests. Returns { keys, prime, nf: 1|2|3|4 (4 = BCNF), violations: { "2NF": [...], "3NF": [...], BCNF: [...] } }
 *  each violation: { lhs, rhs, why } with a sentence-ready reason. */
export function analyze(R, fds) {
  const F = projectFDs(R, fds);
  const keys = candidateKeys(R, fds);
  const prime = uniq(keys.flat());
  const nonprime = R.filter((a) => !prime.includes(a));
  const v = { "2NF": [], "3NF": [], BCNF: [] };
  for (const f of F) {
    const sk = isSuperkey(f.lhs, R, fds);
    if (sk) continue;
    const rhsNP = f.rhs.filter((a) => nonprime.includes(a));
    // 2NF: a non-prime attribute depends on part of a key
    const partOfKey = keys.find((k) => subsetOf(f.lhs, k) && !same(f.lhs, k));
    if (partOfKey && rhsNP.length) v["2NF"].push({ lhs: f.lhs, rhs: rhsNP, key: partOfKey, kind: "partial" });
    // 3NF: X is not a superkey and A is not prime
    if (rhsNP.length) v["3NF"].push({ lhs: f.lhs, rhs: rhsNP, kind: partOfKey ? "partial" : "transitive" });
    // BCNF: X is not a superkey
    v.BCNF.push({ lhs: f.lhs, rhs: f.rhs, kind: rhsNP.length ? (partOfKey ? "partial" : "transitive") : "prime" });
  }
  const nf = v["2NF"].length ? 1 : v["3NF"].length ? 2 : v.BCNF.length ? 3 : 4;
  return { keys, prime, nonprime, fds: F, nf, violations: v };
}

/** NJB: {R1, R2} is non-additive iff (R1 ∩ R2) → (R1 − R2) or (R1 ∩ R2) → (R2 − R1) is in F⁺. */
export function njb(R1, R2, fds) {
  const common = R1.filter((a) => R2.includes(a));
  const c = closure(common, fds);
  const left = R1.filter((a) => !R2.includes(a)), right = R2.filter((a) => !R1.includes(a));
  return { common, ok: subsetOf(left, c) || subsetOf(right, c), determines: subsetOf(left, c) ? left : subsetOf(right, c) ? right : null, left, right };
}

/**
 * Decompose R into the target normal form ("2NF" | "3NF" | "BCNF"), one split at a time: take the first violating
 * X → A and replace the relation by X ∪ A' and R − A', where A' is what X determines in R (for 2NF/3NF only its
 * non-prime part). Returns { steps: [{ from, by, into: [R1, R2], njb }], result: [relations] }.
 */
export function decompose(R, fds, target = "BCNF") {
  const level = { "2NF": 2, "3NF": 3, BCNF: 4 }[target];
  const steps = [];
  let work = [R];
  for (let guard = 0; guard < 30; guard++) {
    const i = work.findIndex((r) => analyze(r, fds).nf < level);
    if (i < 0) break;
    const r = work[i];
    const a = analyze(r, fds);
    const list = level === 2 ? a.violations["2NF"] : level === 3 ? (a.violations["2NF"].length ? a.violations["2NF"] : a.violations["3NF"]) : (a.violations["2NF"][0] ? a.violations["2NF"] : a.violations["3NF"][0] ? a.violations["3NF"] : a.violations.BCNF);
    const f = list[0];
    let A = closure(f.lhs, fds).filter((x) => r.includes(x) && !f.lhs.includes(x));
    if (level < 4) A = A.filter((x) => a.nonprime.includes(x));
    const R1 = uniq([...f.lhs, ...A]);
    const R2 = r.filter((x) => !A.includes(x));
    steps.push({ from: r, by: { lhs: f.lhs, rhs: A, kind: f.kind }, into: [R1, R2], njb: njb(R1, R2, fds) });
    work = [...work.slice(0, i), R1, R2, ...work.slice(i + 1)];
  }
  return { steps, result: work };
}

/** Does X → Y hold in these rows (cols = column names)? Returns null or the two rows that break it. */
export function checkOnRows(cols, rows, X, Y) {
  const xi = X.map((a) => cols.indexOf(a)), yi = Y.map((a) => cols.indexOf(a));
  if (xi.includes(-1) || yi.includes(-1)) return { error: true };
  const seen = new Map();
  for (const [i, r] of rows.entries()) {
    const kx = JSON.stringify(xi.map((j) => r[j])), ky = JSON.stringify(yi.map((j) => r[j]));
    if (seen.has(kx) && seen.get(kx).ky !== ky) return { rows: [seen.get(kx).i, i] };
    if (!seen.has(kx)) seen.set(kx, { ky, i });
  }
  return null;
}

export const fmt = (attrs) => (attrs.length === 1 ? attrs[0] : `{${attrs.join(", ")}}`);
export const fmtFD = (f) => `${fmt(f.lhs)} → ${fmt(f.rhs)}`;

/** The FDs a decomposition does not preserve: X → Y is preserved if X's closure, computed through the parts only
 *  (Z grows by (Z ∩ Ri)⁺ ∩ Ri for each part Ri), contains Y. */
export function lostFDs(fds, parts) {
  return fds.filter((f) => {
    let Z = [...f.lhs], grew = true;
    while (grew) {
      grew = false;
      for (const Ri of parts) {
        const add = closure(Z.filter((a) => Ri.includes(a)), fds).filter((a) => Ri.includes(a) && !Z.includes(a));
        if (add.length) { Z = [...Z, ...add]; grew = true; }
      }
    }
    return !f.rhs.every((a) => Z.includes(a));
  });
}
