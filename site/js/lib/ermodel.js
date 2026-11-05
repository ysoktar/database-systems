// ER / EER models as data, and a small line-based language to write them (used by the ER studio, the mapping and
// the tests). Pure module: no DOM.
//
//   entity EMPLOYEE                          weak entity DEPENDENT
//     Ssn key                                  Dependent_name partial
//     Name(Fname, Minit, Lname)                Sex
//     Locations multi                        relationship WORKS_FOR: EMPLOYEE N total, DEPARTMENT 1 total
//     Age derived                              Hours
//   identifying relationship DEPENDENTS_OF: EMPLOYEE 1, DEPENDENT N total
//   relationship SUPERVISION: EMPLOYEE 1 role=supervisor, EMPLOYEE N role=supervisee
//   relationship WORKS_FOR: EMPLOYEE (1,1), DEPARTMENT (4,N)        -- (min,max) instead of 1/N + total
//   specialization EMPLOYEE -> SECRETARY, ENGINEER, TECHNICIAN disjoint partial on Job_type
//   category OWNER = PERSON | BANK | COMPANY partial
//
// Attribute flags: key, partial (partial key of a weak entity), multi (multivalued), derived.
// Comments start with # or --. Indented lines are attributes of the entity or relationship above them.

export const emptyModel = () => ({ entities: [], relationships: [], specializations: [], categories: [] });

const FLAGS = new Set(["key", "partial", "multi", "derived"]);
const isMany = (c) => c !== "1";

/** Split at commas that are not inside parentheses. */
function splitTop(s, sep = ",") {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** "Address(Street(Number, Name), City) multi" → attribute object */
function parseAttr(text, err) {
  const t = text.trim();
  const m = t.match(/^([A-Za-z_ÇĞİÖŞÜçğıöşü][\wÇĞİÖŞÜçğıöşü]*)\s*(\((.*)\))?\s*(.*)$/);
  if (!m) { err(`Öznitelik okunamadı: "${t}"`); return null; }
  const attr = { name: m[1], key: false, partial: false, multi: false, derived: false, comps: null };
  if (m[2] !== undefined) attr.comps = splitTop(m[3]).map((c) => parseAttr(c, err)).filter(Boolean);
  for (const f of m[4].split(/\s+/).filter(Boolean)) {
    const fl = f.toLowerCase();
    if (FLAGS.has(fl)) attr[fl] = true;
    else err(`Bilinmeyen öznitelik özelliği "${f}" (key, partial, multi, derived olabilir)`);
  }
  return attr;
}

/** "EMPLOYEE N total role=supervisor" or "DEPARTMENT (4,N)" → relationship end */
function parseEnd(text, err) {
  const m = text.match(/^([A-Za-z_][\w]*)\s+(\(\s*\d+\s*,\s*(?:\d+|[A-Za-z*])\s*\)|\d+|[A-Za-z])\s*(.*)$/);
  if (!m) { err(`İlişki ucu okunamadı: "${text}" (biçim: VARLIK 1|N|M [total] [role=ad] ya da VARLIK (min,max))`); return null; }
  const end = { entity: m[1], card: "1", total: false, role: null, minmax: null };
  const c = m[2];
  if (c.startsWith("(")) {
    const [lo, hi] = c.slice(1, -1).split(",").map((x) => x.trim());
    end.minmax = [Number(lo), /^\d+$/.test(hi) ? Number(hi) : "N"];
    end.total = Number(lo) >= 1;
  } else end.card = c === "1" ? "1" : c.toUpperCase();
  for (const tok of m[3].split(/\s+/).filter(Boolean)) {
    const tl = tok.toLowerCase();
    if (tl === "total") end.total = true;
    else if (tl === "partial") end.total = false;
    else if (tl.startsWith("role=")) end.role = tok.slice(5);
    else err(`Bilinmeyen ilişki ucu özelliği "${tok}" (total, partial, role=ad)`);
  }
  return end;
}

/** Fill in the 1/N labels from (min,max) and the other way round, for binary relationships. */
export function normalizeEnds(rel) {
  const ends = rel.ends;
  if (ends.length === 2) {
    const [a, b] = ends;
    // the ratio label next to A is how many A's one B can be related to = B's max
    if (b.minmax) a.card = b.minmax[1] === 1 ? "1" : (a.card !== "1" ? a.card : "N");
    if (a.minmax) b.card = a.minmax[1] === 1 ? "1" : (b.card !== "1" ? b.card : "N");
  }
  for (const [i, e] of ends.entries()) {
    if (e.minmax) { e.total = e.minmax[0] >= 1; continue; }
    if (ends.length === 2) {
      const other = ends[1 - i];
      e.derivedMinmax = [e.total ? 1 : 0, other.card === "1" ? 1 : "N"];
    }
  }
}

/** Parse the language. Returns { model, errors: [{line, msg}], warnings: [{line, msg}] }. */
export function parseER(text) {
  const model = emptyModel();
  const errors = [], warnings = [];
  let block = null; // entity or relationship that indented attribute lines belong to
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = i + 1;
    const err = (msg) => errors.push({ line, msg });
    const noComment = raw.replace(/(#|--).*$/, "");
    if (!noComment.trim()) return;
    const indented = /^\s/.test(noComment);
    const s = noComment.trim();
    let m;
    if (indented && block) {
      const a = parseAttr(s, err);
      if (a) block.attrs.push(a);
      return;
    }
    block = null;
    if ((m = s.match(/^(weak\s+)?entity\s+([A-Za-z_]\w*)\s*$/i))) {
      const e = { name: m[2], weak: !!m[1], attrs: [], line };
      model.entities.push(e);
      block = e;
    } else if ((m = s.match(/^(identifying\s+)?relationship\s+([A-Za-z_]\w*)\s*:\s*(.+)$/i))) {
      const ends = splitTop(m[3]).map((t) => parseEnd(t, err)).filter(Boolean);
      const r = { name: m[2], identifying: !!m[1], ends, attrs: [], line };
      if (ends.length < 2) err(`${r.name}: bir ilişkinin en az iki ucu olmalı`);
      model.relationships.push(r);
      block = r;
    } else if ((m = s.match(/^specialization\s+([A-Za-z_]\w*)\s*->\s*(.+)$/i))) {
      const sp = { super: m[1], subs: [], disjoint: true, total: false, on: null, line };
      const toks = m[2].replace(/,/g, " , ").split(/\s+/).filter(Boolean);
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k], tl = t.toLowerCase();
        if (t === ",") continue;
        if (tl === "disjoint" || tl === "d") sp.disjoint = true;
        else if (tl === "overlapping" || tl === "overlap" || tl === "o") sp.disjoint = false;
        else if (tl === "total") sp.total = true;
        else if (tl === "partial") sp.total = false;
        else if (tl === "on") sp.on = toks[++k] || null;
        else if (/^[A-Za-z_]\w*$/.test(t)) sp.subs.push(t);
        else err(`specialization: "${t}" anlaşılamadı`);
      }
      if (!sp.subs.length) err("specialization: en az bir alt sınıf gerekli");
      model.specializations.push(sp);
    } else if ((m = s.match(/^category\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i))) {
      const toks = m[2].split(/\s*\|\s*|\s+/).filter(Boolean);
      const c = { name: m[1], supers: [], total: false, line };
      for (const t of toks) {
        const tl = t.toLowerCase();
        if (tl === "total") c.total = true;
        else if (tl === "partial") c.total = false;
        else c.supers.push(t);
      }
      if (c.supers.length < 2) err(`category ${c.name}: en az iki üst sınıf gerekli`);
      model.categories.push(c);
    } else if (indented) {
      err("Girintili satır bir entity ya da relationship satırının altında olmalı");
    } else {
      err(`Anlaşılamadı: "${s}". Satırlar entity, weak entity, relationship, identifying relationship, specialization ya da category ile başlar.`);
    }
  });

  // subclasses and categories that were not declared become entities without attributes
  const names = new Map(model.entities.map((e) => [e.name.toUpperCase(), e]));
  const ensure = (n, line) => {
    if (!names.has(n.toUpperCase())) {
      const e = { name: n, weak: false, attrs: [], line, implicit: true };
      model.entities.push(e);
      names.set(n.toUpperCase(), e);
    }
  };
  for (const sp of model.specializations) sp.subs.forEach((s) => ensure(s, sp.line));
  for (const c of model.categories) ensure(c.name, c.line);
  for (const r of model.relationships) normalizeEnds(r);
  validate(model, errors, warnings);
  return { model, errors, warnings };
}

function validate(model, errors, warnings) {
  const ent = new Map();
  for (const e of model.entities) {
    const k = e.name.toUpperCase();
    if (ent.has(k) && !e.implicit) errors.push({ line: e.line, msg: `${e.name} iki kez tanımlanmış` });
    ent.set(k, e);
  }
  const relNames = new Set();
  for (const r of model.relationships) {
    if (relNames.has(r.name.toUpperCase())) errors.push({ line: r.line, msg: `${r.name} ilişkisi iki kez tanımlanmış` });
    relNames.add(r.name.toUpperCase());
    for (const end of r.ends) if (!ent.has(end.entity.toUpperCase())) errors.push({ line: r.line, msg: `${r.name}: ${end.entity} diye bir varlık tipi yok` });
    const seen = new Set();
    for (const end of r.ends) {
      if (seen.has(end.entity.toUpperCase()) && !end.role) warnings.push({ line: r.line, msg: `${r.name}: ${end.entity} ilişkiye iki kez katılıyor; recursive ilişkilerde rol adı (role=…) gerekli` });
      seen.add(end.entity.toUpperCase());
    }
    if (r.identifying) {
      const weakEnd = r.ends.find((e) => ent.get(e.entity.toUpperCase())?.weak);
      if (!weakEnd) warnings.push({ line: r.line, msg: `${r.name}: identifying relationship'in bir ucu weak entity olmalı` });
      else if (!weakEnd.total) warnings.push({ line: r.line, msg: `${r.name}: zayıf varlığın (${weakEnd.entity}) tanımlayıcı ilişkiye katılımı total olmalı` });
    }
  }
  const subs = new Set(model.specializations.flatMap((s) => s.subs.map((x) => x.toUpperCase())));
  const cats = new Set(model.categories.map((c) => c.name.toUpperCase()));
  for (const e of model.entities) {
    const keys = keysOf(e);
    if (e.weak) {
      if (!e.attrs.some((a) => a.partial)) warnings.push({ line: e.line, msg: `${e.name}: zayıf varlığın bir partial key'i olmalı` });
      if (!model.relationships.some((r) => r.identifying && r.ends.some((x) => x.entity.toUpperCase() === e.name.toUpperCase()))) warnings.push({ line: e.line, msg: `${e.name}: zayıf varlık bir identifying relationship'e katılmalı` });
    } else if (!keys.length && !subs.has(e.name.toUpperCase()) && !cats.has(e.name.toUpperCase())) {
      warnings.push({ line: e.line, msg: `${e.name}: anahtar (key) yok. Kendi anahtarı yoksa weak entity olmalı.` });
    }
  }
  for (const sp of model.specializations) {
    if (!ent.has(sp.super.toUpperCase())) errors.push({ line: sp.line, msg: `specialization: ${sp.super} diye bir varlık tipi yok` });
    if (sp.on && ent.has(sp.super.toUpperCase()) && !ent.get(sp.super.toUpperCase()).attrs.some((a) => a.name.toUpperCase() === sp.on.toUpperCase())) {
      warnings.push({ line: sp.line, msg: `specialization: ${sp.super}'in ${sp.on} diye bir özniteliği yok (defining attribute)` });
    }
  }
  for (const c of model.categories) for (const s of c.supers) if (!ent.has(s.toUpperCase())) errors.push({ line: c.line, msg: `category ${c.name}: ${s} diye bir varlık tipi yok` });
}

/** Key attributes of an entity (composite keys count as one key). */
export const keysOf = (e) => e.attrs.filter((a) => a.key);

// ---------------------------------------------------------------- back to text
function attrText(a) {
  let s = a.name + (a.comps ? `(${a.comps.map(attrText).join(", ")})` : "");
  for (const f of ["key", "partial", "multi", "derived"]) if (a[f]) s += " " + f;
  return s;
}
function endText(e) {
  let s = `${e.entity} ${e.minmax ? `(${e.minmax[0]},${e.minmax[1]})` : e.card}`;
  if (!e.minmax && e.total) s += " total";
  if (e.role) s += ` role=${e.role}`;
  return s;
}

/** Serialize a model in the canonical form of the language. */
export function toDSL(model) {
  const out = [];
  const relsFor = new Set();
  for (const e of model.entities) {
    if (e.implicit && !e.attrs.length) continue;
    out.push(`${e.weak ? "weak " : ""}entity ${e.name}`);
    for (const a of e.attrs) out.push("  " + attrText(a));
    out.push("");
  }
  for (const r of model.relationships) {
    relsFor.add(r.name);
    out.push(`${r.identifying ? "identifying " : ""}relationship ${r.name}: ${r.ends.map(endText).join(", ")}`);
    for (const a of r.attrs) out.push("  " + attrText(a));
  }
  if (model.relationships.length) out.push("");
  for (const s of model.specializations) {
    out.push(`specialization ${s.super} -> ${s.subs.join(", ")} ${s.disjoint ? "disjoint" : "overlapping"} ${s.total ? "total" : "partial"}${s.on ? ` on ${s.on}` : ""}`);
  }
  for (const c of model.categories) out.push(`category ${c.name} = ${c.supers.join(" | ")} ${c.total ? "total" : "partial"}`);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Deep copy (models are plain data). */
export const cloneModel = (m) => JSON.parse(JSON.stringify(m));

export const findEntity = (model, name) => model.entities.find((e) => e.name.toUpperCase() === String(name).toUpperCase());

export { isMany };
