// Relational → ER (reverse engineering): read the tables, keys and foreign keys of a database from MySQL's information_schema
// and recognise the patterns that the mapping algorithm (Ch 9) produces:
//   PK = two or more FKs                    → M:N (or n-ary) relationship, other columns its attributes
//   PK = one FK + the table has only key columns → multivalued attribute of the referenced entity
//   PK = FK(s) + own columns                 → weak entity, owner = referenced table, own PK columns = partial key
//   PK = exactly one FK (whole PK)           → subclass of the referenced table (IS-A, option 8A)
//   otherwise                                → regular entity; UNIQUE → further keys
//   every other FK of an entity table        → 1:N relationship (1:1 if the FK is UNIQUE), total if NOT NULL
// What the tables cannot tell (derived and composite attributes, the participation of the "1" side, specialization
// constraints, relationship names) is reported in the notes.
import { emptyModel, normalizeEnds } from "./ermodel.js";

const U = (s) => String(s).toUpperCase();
const nice = (c) => c.charAt(0).toUpperCase() + c.slice(1);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const subset = (a, b) => a.every((x) => b.includes(x));

/** SQL that lists the columns and the PK / UNIQUE / FK constraints of one database (MySQL's information_schema). */
export const catalogSQL = (schema) => {
  const keyCols = (col) => `(SELECT GROUP_CONCAT(k.${col} ORDER BY k.ORDINAL_POSITION SEPARATOR ',')
             FROM information_schema.KEY_COLUMN_USAGE k
             WHERE k.TABLE_SCHEMA = tc.TABLE_SCHEMA AND k.TABLE_NAME = tc.TABLE_NAME AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME)`;
  return [
    `SELECT TABLE_NAME, COLUMN_NAME, UPPER(COLUMN_TYPE), IS_NULLABLE = 'NO'
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = '${schema}'
   ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    `SELECT tc.TABLE_NAME,
          CASE tc.CONSTRAINT_TYPE WHEN 'PRIMARY KEY' THEN 'p' WHEN 'UNIQUE' THEN 'u' ELSE 'f' END,
          tc.CONSTRAINT_NAME,
          ${keyCols("COLUMN_NAME")},
          ${keyCols("REFERENCED_TABLE_NAME").replace("GROUP_CONCAT(k.REFERENCED_TABLE_NAME ORDER BY k.ORDINAL_POSITION SEPARATOR ',')", "MAX(k.REFERENCED_TABLE_NAME)")},
          ${keyCols("REFERENCED_COLUMN_NAME")}
   FROM information_schema.TABLE_CONSTRAINTS tc
   WHERE tc.TABLE_SCHEMA = '${schema}' AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
   ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME`,
  ];
};

/** Build the catalog object from the rows of the two catalogSQL queries (arrays of row arrays). */
export function catalogFromRows(colRows, conRows) {
  const tables = new Map();
  const get = (n) => {
    if (!tables.has(n)) tables.set(n, { name: n, cols: [], pk: [], uniques: [], fks: [] });
    return tables.get(n);
  };
  for (const [t, col, type, notNull] of colRows) get(t).cols.push({ name: col, type, notNull: !!notNull });
  for (const [t, kind, name, cols, ref, refCols] of conRows) {
    const tb = get(t);
    const cs = (cols || "").split(",").filter(Boolean);
    if (kind === "p") tb.pk = cs;
    else if (kind === "u") tb.uniques.push(cs);
    else tb.fks.push({ name, cols: cs, ref, refCols: (refCols || "").split(",").filter(Boolean) });
  }
  return [...tables.values()];
}

/** Reverse-engineer a catalog into an ER model. Returns { model, steps: [{kind, table, html}], notes: [html] }. */
export function reverseER(catalog) {
  const model = emptyModel();
  const steps = [], notes = [];
  const T = new Map(catalog.map((t) => [t.name, t]));
  const role = new Map(); // table → "entity" | "weak" | "sub" | "rel" | "multi"
  const relNames = new Set();
  const uniqueName = (base) => { let n = U(base), k = 2; while (relNames.has(n)) n = `${U(base)}_${k++}`; relNames.add(n); return n; };

  // ---- classify every table first: an FK can only become a relationship once both ends are known to be entities
  for (const t of catalog) {
    const pkFKs = t.fks.filter((f) => f.cols.length && subset(f.cols, t.pk));
    const fkCols = [...new Set(pkFKs.flatMap((f) => f.cols))];
    if (!t.pk.length) role.set(t.name, "entity");
    else if (pkFKs.length && pkFKs.every((f) => sameSet(f.cols, t.pk))) role.set(t.name, "sub");
    else if (pkFKs.length >= 2 && sameSet(fkCols, t.pk)) role.set(t.name, "rel");
    else if (pkFKs.length >= 1 && !sameSet(fkCols, t.pk)) role.set(t.name, pkFKs.length === 1 && t.cols.every((c) => t.pk.includes(c.name)) ? "multi" : "weak");
    else role.set(t.name, "entity");
  }

  const attrsOf = (t, exclude) => t.cols.filter((c) => !exclude.includes(c.name)).map((c) => ({ name: nice(c.name), key: false, partial: false, multi: false, derived: false, comps: null }));
  const entityOf = new Map();
  const addEntity = (t, weak) => {
    const e = { name: U(t.name), weak, attrs: [], line: 0 };
    model.entities.push(e);
    entityOf.set(t.name, e);
    return e;
  };
  const isEntityTable = (n) => ["entity", "weak", "sub"].includes(role.get(n));

  for (const t of catalog) {
    const r = role.get(t.name);
    const nonPkFKcols = t.fks.filter((f) => !subset(f.cols, t.pk) && isEntityTable(f.ref)).flatMap((f) => f.cols);
    if (r === "entity") {
      const e = addEntity(t, false);
      const exclude = nonPkFKcols;
      for (const c of t.cols) {
        if (exclude.includes(c.name)) continue;
        e.attrs.push({ name: nice(c.name), key: t.pk.length === 1 && t.pk[0] === c.name || t.uniques.some((u) => u.length === 1 && u[0] === c.name),
          partial: false, multi: false, derived: false, comps: null });
      }
      if (t.pk.length > 1) {
        // a composite key becomes one composite key attribute
        const comps = t.pk.map((c) => ({ name: nice(c), key: false, partial: false, multi: false, derived: false, comps: null }));
        e.attrs = e.attrs.filter((a) => !t.pk.map(nice).includes(a.name));
        e.attrs.unshift({ name: `${U(t.name)}_key`, key: true, partial: false, multi: false, derived: false, comps });
        notes.push(`${U(t.name)}: bileşik primary key (${t.pk.join(", ")}) bileşik bir anahtar özniteliği oldu.`);
      }
      steps.push({ kind: "entity", table: t.name, html: `<strong>${U(t.name)}</strong>: primary key'i başka bir tabloya başvurmuyor → <em>regular entity</em>. Anahtar: ${t.pk.join(", ") || "yok"}${t.uniques.length ? `; UNIQUE sütunlar da anahtar: ${t.uniques.map((u) => u.join(", ")).join("; ")}` : ""}.` });
    } else if (r === "weak") {
      const e = addEntity(t, true);
      const pkFKs = t.fks.filter((f) => subset(f.cols, t.pk));
      const fkCols = pkFKs.flatMap((f) => f.cols);
      for (const c of t.cols) {
        if (fkCols.includes(c.name) || nonPkFKcols.includes(c.name)) continue;
        e.attrs.push({ name: nice(c.name), key: false, partial: t.pk.includes(c.name), multi: false, derived: false, comps: null });
      }
      const owner = pkFKs[0];
      model.relationships.push({ name: uniqueName(`${t.name}_OF`), identifying: true, attrs: [], line: 0,
        ends: [{ entity: U(owner.ref), card: "1", total: false, role: null, minmax: null }, { entity: U(t.name), card: "N", total: true, role: null, minmax: null }] });
      for (const extra of pkFKs.slice(1)) notes.push(`${U(t.name)}: primary key'de ${U(extra.ref)}'e başvuran ikinci bir foreign key var; yalnızca ${U(owner.ref)} sahip olarak alındı.`);
      steps.push({ kind: "weak", table: t.name, html: `<strong>${U(t.name)}</strong>: primary key (${t.pk.join(", ")}) = ${U(owner.ref)}'e foreign key (${owner.cols.join(", ")}) + kendi sütunları → <em>weak entity</em>, sahibi ${U(owner.ref)}; kendi sütunları partial key.` });
    } else if (r === "sub") {
      const e = addEntity(t, false);
      const exclude = [...t.pk, ...nonPkFKcols];
      e.attrs = attrsOf(t, exclude);
      const supers = [...new Set(t.fks.filter((f) => sameSet(f.cols, t.pk)).map((f) => U(f.ref)))];
      for (const s of supers) {
        let sp = model.specializations.find((x) => x.super === s && x.fromReverse);
        if (!sp) { sp = { super: s, subs: [], disjoint: false, total: false, on: null, line: 0, fromReverse: true }; model.specializations.push(sp); }
        sp.subs.push(U(t.name));
      }
      steps.push({ kind: "sub", table: t.name, html: `<strong>${U(t.name)}</strong>: primary key'inin tamamı (${t.pk.join(", ")}) ${supers.join(" ve ")}'in primary key'ine foreign key → <em>alt sınıf</em> (IS-A, seçenek 8A)${supers.length > 1 ? "; birden çok üst sınıf: paylaşılan alt sınıf" : ""}.` });
    }
  }

  // ---- relationship tables and multivalued attributes
  for (const t of catalog) {
    const r = role.get(t.name);
    if (r === "rel") {
      const pkFKs = t.fks.filter((f) => subset(f.cols, t.pk));
      const counts = new Map();
      for (const f of pkFKs) counts.set(f.ref, (counts.get(f.ref) || 0) + 1);
      const ends = pkFKs.map((f, i) => {
        const pre = f.cols.length === 1 ? f.cols[0].replace(new RegExp(`_?${f.refCols[0]}$`, "i"), "") : "";
        const recursive = counts.get(f.ref) > 1;
        return { entity: U(f.ref), card: pkFKs.length === 2 ? (i === 0 ? "M" : "N") : "N", total: false, role: recursive ? (pre || `r${i + 1}`).toLowerCase() : null, minmax: null };
      });
      const keyAndFK = pkFKs.flatMap((f) => f.cols);
      const otherFKs = t.fks.filter((f) => !subset(f.cols, t.pk));
      const rel = { name: uniqueName(t.name), identifying: false, ends, attrs: attrsOf(t, keyAndFK), line: 0 };
      model.relationships.push(rel);
      if (otherFKs.length) notes.push(`${U(t.name)}: primary key dışındaki foreign key'ler (${otherFKs.map((f) => f.cols.join(", ")).join("; ")}) ilişki özniteliği olarak bırakıldı.`);
      steps.push({ kind: "rel", table: t.name, html: `<strong>${U(t.name)}</strong>: primary key, ${pkFKs.length} foreign key'in birleşimi → <em>${pkFKs.length === 2 ? "M:N" : `${pkFKs.length}-ary`} ilişki</em> (${ends.map((e) => e.entity).join(", ")})${rel.attrs.length ? `; diğer sütunlar ilişkinin öznitelikleri: ${rel.attrs.map((a) => a.name).join(", ")}` : ""}. Katılımlar tablodan bilinemez (partial varsayıldı).` });
    } else if (r === "multi") {
      const f = t.fks.find((x) => subset(x.cols, t.pk));
      const owner = entityOf.get(f.ref);
      const valCols = t.pk.filter((c) => !f.cols.includes(c));
      const attr = valCols.length === 1
        ? { name: nice(valCols[0]), key: false, partial: false, multi: true, derived: false, comps: null }
        : { name: nice(t.name), key: false, partial: false, multi: true, derived: false, comps: valCols.map((c) => ({ name: nice(c), key: false, partial: false, multi: false, derived: false, comps: null })) };
      if (owner) owner.attrs.push(attr);
      else notes.push(`${U(t.name)}: sahibi ${U(f.ref)} bir varlık tablosu değil; çok değerli öznitelik eklenemedi.`);
      steps.push({ kind: "multi", table: t.name, html: `<strong>${U(t.name)}</strong>: yalnızca anahtar sütunları var, biri ${U(f.ref)}'e foreign key → ${U(f.ref)}'in <em>çok değerli özniteliği</em> ${attr.name}.` });
    }
  }

  // ---- the remaining foreign keys of entity tables: 1:N and 1:1 relationships
  for (const t of catalog) {
    if (!isEntityTable(t.name)) continue;
    for (const f of t.fks) {
      if (subset(f.cols, t.pk) && ["weak", "sub"].includes(role.get(t.name))) continue; // already identifying / IS-A
      if (!isEntityTable(f.ref)) { notes.push(`${U(t.name)}.${f.cols.join(", ")}: ${U(f.ref)} bir varlık tablosu değil, ilişki çıkarılamadı.`); continue; }
      const oneOne = t.uniques.some((u) => sameSet(u, f.cols)) || sameSet(t.pk, f.cols);
      const total = f.cols.every((c) => t.cols.find((x) => x.name === c)?.notNull);
      const refKey = f.refCols[0] || "";
      const pre = f.cols.length === 1 ? f.cols[0].replace(new RegExp(`_?${refKey}$`, "i"), "") : "";
      const prefix = pre && U(pre) !== U(f.ref) ? pre : "";
      const recursive = f.ref === t.name;
      const name = uniqueName(prefix ? prefix : `${t.name}_${f.ref}`);
      const ends = [
        { entity: U(f.ref), card: "1", total: false, role: recursive ? (prefix || "ref").toLowerCase() : null, minmax: null },
        { entity: U(t.name), card: oneOne ? "1" : "N", total, role: recursive ? t.name.toLowerCase() : null, minmax: null },
      ];
      model.relationships.push({ name, identifying: false, ends, attrs: [], line: 0 });
      steps.push({ kind: "fk", table: t.name, html: `<strong>${U(t.name)}.${f.cols.join(", ")}</strong> → ${U(f.ref)}: primary key'in parçası olmayan foreign key → <em>${oneOne ? "1:1" : "1:N"}${recursive ? " recursive" : ""} ilişki</em> ${name}${oneOne ? " (FK UNIQUE)" : ` (${U(t.name)} N tarafı)`}; ${total ? "NOT NULL → total participation" : "NULL olabilir → partial"}.` });
    }
  }
  for (const r of model.relationships) normalizeEnds(r);
  for (const sp of model.specializations) delete sp.fromReverse;
  notes.push("Tablolardan geri kazanılamayanlar: türetilmiş öznitelikler (saklanmadıkları için), bileşik özniteliklerin yapısı (sütunlara ayrılmışlardır), \"1\" tarafının katılımı (total mı?), (min,max) sınırları, özelleştirmelerin disjoint/total kısıtları ve ilişkilerin gerçek adları. Bunlar varsayılan değerlerle dolduruldu; diyagramı editörde düzeltebilirsiniz.");
  return { model, steps, notes };
}
