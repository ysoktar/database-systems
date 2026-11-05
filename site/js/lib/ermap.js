// ER / EER → relational mapping, following the algorithm of Elmasri & Navathe Ch 9:
//   Step 1 regular entity types · Step 2 weak entity types · Step 3 binary 1:1 · Step 4 binary 1:N · Step 5 binary M:N
//   Step 6 multivalued attributes · Step 7 n-ary relationships · Step 8 specialization (options 8A–8D) · Step 9 categories
// Pure module: returns tables and an explained step log, and can print the result as DDL.
import { keysOf, isMany } from "./ermodel.js";

const U = (s) => String(s).toUpperCase();

/** Leaf columns of an attribute (composite attributes are flattened into their simple components). */
const leaves = (a) => (a.comps && a.comps.length ? a.comps.flatMap(leaves) : [a.name]);

/** A plausible SQL type from an attribute name (only used to make the DDL runnable). */
export function guessType(name) {
  const n = name.toLowerCase();
  if (/ssn$/.test(n)) return "CHAR(9)";
  if (/(^|_)(date|bdate)$|date$|_date|birth/.test(n)) return "DATE";
  if (/flag$/.test(n)) return "BOOLEAN";
  if (/(salary|price|amount|balance|hours|gpa|percent|quantity|tonnage|pay_scale|speed|lien)/.test(n)) return "DECIMAL(10,2)";
  if (/(^|_)(no|num|number|id|code|year|credits|tgrade|grade_level)$|_id$|^id$|number$/.test(n)) return "INT";
  if (/^sex$|^minit$/.test(n)) return "CHAR(1)";
  return "VARCHAR(30)";
}

/**
 * Map a model. options.spec: "8A" (default) | "8B" | "8C" | "8D".
 * Returns { tables: [{ name, cols: [{name, type, notNull}], pk: [col], uniques: [[col]], fks: [{cols, ref, refCols, onDelete, why}], origin }],
 *           steps: [{ step, title, html, table }], notes: [html] }
 */
export function mapER(model, options = {}) {
  const specOpt = options.spec || "8A";
  const tables = [];
  const steps = [];
  const notes = [];
  const byName = new Map();
  const entity = new Map(model.entities.map((e) => [U(e.name), e]));
  const where = new Map(); // entity name → { table, pk: [cols], keyNames: [attribute names] } or { none: true }

  // each step keeps a copy of its table as it is after the step, and which columns the step added
  const lastSeen = new Map();
  const log = (step, title, html, table) => {
    let snapshot = null, added = [];
    if (table) {
      snapshot = JSON.parse(JSON.stringify(table));
      const before = lastSeen.get(table.name) || [];
      added = table.cols.map((c) => c.name).filter((c) => !before.includes(c));
      lastSeen.set(table.name, table.cols.map((c) => c.name));
    }
    steps.push({ step, title, html, table: table?.name, snapshot, added });
  };
  const newTable = (name, origin) => {
    let n = U(name);
    while (byName.has(n)) n += "_2";
    const t = { name: n, cols: [], pk: [], uniques: [], fks: [], origin };
    tables.push(t);
    byName.set(n, t);
    return t;
  };
  const addCol = (t, name, { type, notNull = false } = {}) => {
    let n = name;
    let k = 2;
    while (t.cols.some((c) => U(c.name) === U(n))) n = `${name}_${k++}`;
    t.cols.push({ name: n, type: type || guessType(name), notNull });
    return n;
  };
  const addSimpleAttrs = (t, attrs, skipped) => {
    for (const a of attrs) {
      if (a.multi) continue; // step 6
      if (a.derived) { skipped.push(a.name); continue; }
      for (const leaf of leaves(a)) addCol(t, leaf, { notNull: !!(a.key || a.partial) });
    }
  };
  const colsOf = (a) => leaves(a);
  const fkName = (end, refTable, keyCol) => {
    if (end && end.role) return `${end.role}_${keyCol}`;
    return U(keyCol).startsWith(`${U(refTable)}_`) ? keyCol : `${refTable}_${keyCol}`;
  };
  /** add FK columns in t that reference the table of entity `ename`; returns the new column names */
  const addFK = (t, ename, { role = null, notNull = false, onDelete = null, why = "", unique = false } = {}) => {
    const w = where.get(U(ename));
    if (!w || w.none) {
      notes.push(`${t.name} → ${ename}: ${ename} için tablo yok (${w?.why || "eşlenmemiş"}); sütun foreign key kısıtı olmadan eklendi.`);
      const c = addCol(t, `${role || U(ename)}_id`, { type: "INT", notNull });
      return [c];
    }
    const cols = w.pk.map((pkCol) => {
      const col = w.table.cols.find((c) => c.name === pkCol);
      return addCol(t, fkName({ role }, w.table.name, pkCol), { type: col?.type, notNull });
    });
    t.fks.push({ cols, ref: w.table.name, refCols: [...w.pk], onDelete, why });
    if (unique) t.uniques.push(cols);
    return cols;
  };
  const relAttrs = (t, r) => {
    const skipped = [];
    addSimpleAttrs(t, r.attrs, skipped);
    return r.attrs.filter((a) => !a.multi && !a.derived).map((a) => a.name);
  };

  // ---------------------------------------------------------------- which entities are subclasses / categories
  const subOf = new Map(); // sub → [specializations]
  for (const sp of model.specializations) for (const s of sp.subs) {
    if (!subOf.has(U(s))) subOf.set(U(s), []);
    subOf.get(U(s)).push(sp);
  }
  const catByName = new Map(model.categories.map((c) => [U(c.name), c]));
  const specsOfSuper = (n) => model.specializations.filter((s) => U(s.super) === U(n));
  /** the option used for one specialization (falls back to 8A when the chosen one does not fit) */
  const optFor = new Map();
  for (const sp of model.specializations) {
    let o = specOpt;
    const why = [];
    if (o === "8B" && !sp.total) { why.push("8B yalnız <em>total</em> özelleştirmede kullanılabilir: bir alt sınıfa ait olmayan üst sınıf varlıkları kaybolurdu"); o = "8A"; }
    if (o === "8B" && specsOfSuper(sp.super).length > 1) { why.push("8B, birden çok özelleştirmesi olan bir üst sınıfta öznitelikleri her alt sınıfa tekrar tekrar kopyalardı"); o = "8A"; }
    if (o === "8C" && !sp.disjoint) { why.push("8C (tek tip sütunu) yalnız <em>disjoint</em> özelleştirmede kullanılabilir; overlapping için 8D"); o = "8D"; }
    if ((o === "8C" || o === "8D" || o === "8B") && model.specializations.some((x) => x.subs.some((s) => U(s) === U(sp.super)))) {
      why.push("üst sınıfın kendisi bir alt sınıf; iç içe birleştirme yerine 8A kullanıldı"); o = "8A";
    }
    if ((o === "8C" || o === "8D") && sp.subs.some((s) => (subOf.get(U(s)) || []).length > 1)) { why.push("paylaşılan alt sınıf (lattice) tek tabloya katlanamaz"); o = "8A"; }
    if (why.length) notes.push(`${sp.super} → {${sp.subs.join(", ")}}: ${specOpt} yerine ${o}, çünkü ${why.join("; ")}.`);
    optFor.set(sp, o);
  }

  // ---------------------------------------------------------------- Step 1: regular entity types
  const isRegular = (e) => !e.weak && !subOf.has(U(e.name)) && !catByName.has(U(e.name));
  for (const e of model.entities.filter(isRegular)) {
    const specs = specsOfSuper(e.name);
    if (specs.length && specs.every((s) => optFor.get(s) === "8B")) {
      where.set(U(e.name), { none: true, why: "8B: üst sınıfın tablosu oluşturulmaz" });
      continue;
    }
    const t = newTable(e.name, { kind: "entity", name: e.name });
    const skipped = [];
    addSimpleAttrs(t, e.attrs, skipped);
    const keys = keysOf(e);
    if (keys.length) {
      t.pk = colsOf(keys[0]);
      for (const k of keys.slice(1)) t.uniques.push(colsOf(k));
    } else {
      t.pk = [addCol(t, `${U(e.name)}_id`, { type: "INT", notNull: true })];
      notes.push(`${e.name}'in anahtarı yok; yapay bir anahtar (${t.pk[0]}) eklendi.`);
    }
    for (const c of t.cols) if (t.pk.includes(c.name)) c.notNull = true;
    where.set(U(e.name), { table: t, pk: t.pk });
    log("1", `Adım 1 · ${e.name} (regular entity)`,
      `Basit öznitelikleriyle bir tablo. ${keys.length ? `Primary key: <code>${t.pk.join(", ")}</code>${keys[0].comps ? " (bileşik anahtarın bileşenleri)" : ""}.` : ""}`
      + (keys.length > 1 ? ` Diğer anahtarlar UNIQUE: ${keys.slice(1).map((k) => `<code>${colsOf(k).join(", ")}</code>`).join(", ")}.` : "")
      + (e.attrs.some((a) => a.comps) ? " Bileşik öznitelikler bileşenlerine ayrıldı." : "")
      + (skipped.length ? ` Türetilmiş öznitelik(ler) saklanmaz: ${skipped.join(", ")} (gerektiğinde sorgu ya da view ile hesaplanır).` : "")
      + (e.attrs.some((a) => a.multi) ? " Çok değerli öznitelikler Adım 6'da." : ""), t);
  }

  // ---------------------------------------------------------------- Step 2: weak entity types (owners first)
  const identifying = model.relationships.filter((r) => r.identifying);
  let pending = model.entities.filter((e) => e.weak);
  for (let guard = 0; pending.length && guard < 20; guard++) {
    pending = pending.filter((e) => {
      const r = identifying.find((x) => x.ends.some((end) => U(end.entity) === U(e.name)));
      const ownerEnd = r?.ends.find((end) => U(end.entity) !== U(e.name));
      if (ownerEnd && !where.has(U(ownerEnd.entity)) && entity.get(U(ownerEnd.entity))?.weak) return true; // owner not mapped yet
      const t = newTable(e.name, { kind: "weak", name: e.name });
      const skipped = [];
      let fkCols = [];
      if (ownerEnd) fkCols = addFK(t, ownerEnd.entity, { role: ownerEnd.role, notNull: true, onDelete: "CASCADE", why: `${r.name} (identifying relationship)` });
      addSimpleAttrs(t, e.attrs, skipped);
      if (r) relAttrs(t, r);
      const partial = e.attrs.filter((a) => a.partial).flatMap(colsOf);
      t.pk = [...fkCols, ...partial];
      for (const c of t.cols) if (t.pk.includes(c.name)) c.notNull = true;
      if (!partial.length) notes.push(`${e.name}'in partial key'i yok; primary key yalnızca sahibin anahtarı oldu.`);
      where.set(U(e.name), { table: t, pk: t.pk });
      log("2", `Adım 2 · ${e.name} (weak entity)`,
        ownerEnd ? `Kendi öznitelikleri + sahibi <strong>${ownerEnd.entity}</strong>'in primary key'i foreign key olarak (<code>${fkCols.join(", ")}</code>). Primary key = sahibin anahtarı + partial key: <code>${t.pk.join(", ")}</code>. Sahip silinince zayıf varlıklar da silinmeli: <code>ON DELETE CASCADE</code>. ${r.name} için ayrı tablo yok.`
          : "Identifying relationship bulunamadı; yalnızca kendi öznitelikleri.", t);
      return false;
    });
  }

  // ---------------------------------------------------------------- Step 8: specializations (subclasses, in dependency order)
  const done = new Set();
  const specialize = (sp) => {
    if (done.has(sp)) return;
    if (subOf.has(U(sp.super))) for (const parent of subOf.get(U(sp.super))) specialize(parent);
    done.add(sp);
    const o = optFor.get(sp);
    const sup = entity.get(U(sp.super));
    const supW = where.get(U(sp.super));
    const label = `${sp.super} → {${sp.subs.join(", ")}} (${sp.disjoint ? "disjoint" : "overlapping"}, ${sp.total ? "total" : "partial"})`;
    if (o === "8A") {
      const made = [];
      for (const s of sp.subs) {
        const se = entity.get(U(s));
        if (where.has(U(s))) { // shared subclass: second superclass
          const w = where.get(U(s));
          if (!w.none) addFKToExisting(w.table, sp.super, w.pk);
          continue;
        }
        const t = newTable(s, { kind: "subclass", name: s, of: sp.super });
        const pk = supW && !supW.none ? supW.pk.map((c) => addCol(t, c, { type: supW.table.cols.find((x) => x.name === c)?.type, notNull: true })) : [addCol(t, `${U(sp.super)}_id`, { type: "INT", notNull: true })];
        if (supW && !supW.none) t.fks.push({ cols: pk, ref: supW.table.name, refCols: [...supW.pk], onDelete: "CASCADE", why: `${s} IS-A ${sp.super}` });
        addSimpleAttrs(t, se?.attrs || [], []);
        t.pk = pk;
        where.set(U(s), { table: t, pk });
        made.push(t);
      }
      log("8", `Adım 8A · ${label}`, `Üst sınıfın tablosu kalır; her alt sınıf için ayrı bir tablo: üst sınıfın primary key'i (<code>${supW?.pk?.join(", ") || "?"}</code>) + alt sınıfın yerel öznitelikleri. Alt sınıfın PK'sı aynı zamanda üst sınıfa foreign key'dir. Her özelleştirmede çalışır (total/partial, disjoint/overlapping).`, made[0]);
    } else if (o === "8B") {
      const made = [];
      for (const s of sp.subs) {
        const se = entity.get(U(s));
        const t = newTable(s, { kind: "subclass", name: s, of: sp.super });
        const skipped = [];
        addSimpleAttrs(t, sup.attrs, skipped);
        addSimpleAttrs(t, se?.attrs || [], skipped);
        const keys = keysOf(sup);
        t.pk = keys.length ? colsOf(keys[0]) : [addCol(t, `${U(sp.super)}_id`, { type: "INT", notNull: true })];
        where.set(U(s), { table: t, pk: t.pk });
        made.push(t);
      }
      log("8", `Adım 8B · ${label}`, `Üst sınıf için tablo yok; her alt sınıf tablosu üst sınıfın <em>bütün</em> özniteliklerini içerir. Yalnızca total özelleştirmede doğrudur (her varlık bir alt sınıfta olmalı). Disjoint değilse bir varlık birden çok tabloda tekrar eder. Üst sınıfa başvuran ilişkiler foreign key ile ifade edilemez.`, made[0]);
    } else {
      // 8C / 8D: one relation for the superclass and all subclasses
      const t = supW.table;
      let typeCols = [];
      if (o === "8C" && sp.subs.length > 1) {
        if (sp.on && t.cols.some((c) => U(c.name) === U(sp.on))) typeCols = [t.cols.find((c) => U(c.name) === U(sp.on)).name];
        else typeCols = [addCol(t, sp.on || `${sp.subs.map((x) => x.split("_")[0]).join("_or_")}_type`, { type: "VARCHAR(20)" })];
      } else {
        typeCols = sp.subs.map((s) => addCol(t, `${s}_flag`, { type: "BOOLEAN" }));
      }
      for (const s of sp.subs) {
        addSimpleAttrs(t, entity.get(U(s))?.attrs || [], []);
        where.set(U(s), { table: t, pk: t.pk, merged: true });
      }
      log("8", `Adım 8${o === "8C" ? "C" : "D"} · ${label}`, o === "8C"
        ? `Tek tablo: üst sınıfın ve bütün alt sınıfların öznitelikleri + varlığın hangi alt sınıfta olduğunu söyleyen bir tip sütunu (<code>${typeCols[0]}</code>${sp.on ? ", defining attribute" : ""}). Yalnız disjoint için; alt sınıfların öznitelikleri o alt sınıfta olmayanlar için NULL olur.`
        : `Tek tablo + her alt sınıf için bir Boolean tip sütunu (<code>${typeCols.join(", ")}</code>). Overlapping özelleştirmeye uygun; çok sayıda NULL üretir.`, t);
    }
  };
  function addFKToExisting(t, superName, pk) {
    const w = where.get(U(superName));
    if (w && !w.none) t.fks.push({ cols: pk, ref: w.table.name, refCols: [...w.pk], onDelete: "CASCADE", why: `${t.name} IS-A ${superName} (paylaşılan alt sınıf)` });
  }
  model.specializations.forEach(specialize);

  // ---------------------------------------------------------------- Step 9: categories
  for (const c of model.categories) {
    const ce = entity.get(U(c.name));
    const supWs = c.supers.map((s) => [s, where.get(U(s))]).filter(([, w]) => w && !w.none);
    const pkSig = (w) => w.pk.map((col) => U(col)).join(",");
    const sameKey = supWs.length && supWs.every(([, w]) => pkSig(w) === pkSig(supWs[0][1]));
    const t = newTable(c.name, { kind: "category", name: c.name });
    if (sameKey) {
      const w0 = supWs[0][1];
      t.pk = w0.pk.map((col) => addCol(t, col, { type: w0.table.cols.find((x) => x.name === col)?.type, notNull: true }));
      addSimpleAttrs(t, ce?.attrs || [], []);
      if (c.total) for (const [, w] of supWs) w.table.fks.push({ cols: [...w.pk], ref: t.name, refCols: [...t.pk], onDelete: "CASCADE", why: `${w.table.name} ⊆ ${c.name} (total category)` });
      log("9", `Adım 9 · ${c.name} = ${c.supers.join(" ∪ ")}`, `Üst sınıfların anahtarı aynı (<code>${t.pk.join(", ")}</code>): yapay anahtara gerek yok; kategori tablosu bu anahtarı kullanır.${c.total ? " Kategori total olduğu için her üst sınıf satırı kategoride de bulunmalı: üst sınıfların PK'sı kategoriye foreign key." : " Kategori partial; üyelik bir kısıtla değil uygulama ya da trigger ile izlenir."}`, t);
    } else {
      const sk = addCol(t, `${U(c.name)}_id`, { type: "INT", notNull: true });
      t.pk = [sk];
      addSimpleAttrs(t, ce?.attrs || [], []);
      for (const [, w] of supWs) {
        const col = addCol(w.table, sk, { type: "INT" });
        w.table.fks.push({ cols: [col], ref: t.name, refCols: [sk], onDelete: null, why: `${w.table.name} ∈ ${c.name}` });
        w.table.uniques.push([col]);
      }
      log("9", `Adım 9 · ${c.name} = ${c.supers.join(" ∪ ")}`, `Üst sınıfların anahtarları farklı: kategoriye bir <strong>yapay anahtar</strong> (surrogate key) <code>${sk}</code> verilir ve her üst sınıf tablosuna bu anahtara başvuran bir foreign key eklenir (kategoriye ait olmayanlar için NULL).`, t);
    }
    where.set(U(c.name), { table: t, pk: t.pk });
  }

  // ---------------------------------------------------------------- Steps 3, 4, 5, 7: relationships
  for (const r of model.relationships.filter((x) => !x.identifying)) {
    const ends = r.ends;
    if (ends.length === 2) {
      const [a, b] = ends;
      const oneOne = !isMany(a.card) && !isMany(b.card);
      const manyMany = isMany(a.card) && isMany(b.card);
      if (manyMany) {
        const t = newTable(r.name, { kind: "relationship", name: r.name });
        const ca = addFK(t, a.entity, { role: a.role, notNull: true, onDelete: "CASCADE", why: r.name });
        const cb = addFK(t, b.entity, { role: b.role, notNull: true, onDelete: "CASCADE", why: r.name });
        const attrs = relAttrs(t, r);
        t.pk = [...ca, ...cb];
        log("5", `Adım 5 · ${r.name} (M:N)`, `M:N ilişki her zaman <strong>yeni bir tablo</strong> olur: iki tarafın primary key'leri foreign key olarak (<code>${ca.join(", ")}</code> → ${a.entity}, <code>${cb.join(", ")}</code> → ${b.entity}); primary key ikisinin birleşimi.${attrs.length ? ` İlişkinin öznitelikleri (${attrs.join(", ")}) bu tabloya gelir.` : ""}`, t);
      } else {
        // FK side S: the N side for 1:N; for 1:1 the side with total participation
        let S, T;
        if (oneOne) [S, T] = b.total && !a.total ? [b, a] : a.total ? [a, b] : [b, a];
        else [S, T] = isMany(a.card) ? [a, b] : [b, a];
        const sw = where.get(U(S.entity));
        if (!sw || sw.none) { notes.push(`${r.name}: ${S.entity} için tablo yok, ilişki eşlenemedi.`); continue; }
        const t = sw.table;
        const cols = addFK(t, T.entity, { role: T.role, notNull: S.total && !sw.merged, why: r.name, unique: oneOne });
        const attrs = relAttrs(t, r);
        const recursive = U(a.entity) === U(b.entity);
        log(oneOne ? "3" : "4", `Adım ${oneOne ? 3 : 4} · ${r.name} (${oneOne ? "1:1" : "1:N"}${recursive ? ", recursive" : ""})`,
          oneOne
            ? `Foreign key yaklaşımı: <strong>${S.entity}</strong> tablosuna ${T.entity}'in primary key'i eklenir (<code>${cols.join(", ")}</code>)${S.total ? "; total participation tarafı seçildi, böylece NULL olmaz (NOT NULL)" : "; hiçbir taraf total değil, FK NULL olabilir"}. 1:1'i korumak için UNIQUE. ${attrs.length ? `İlişkinin öznitelikleri (${attrs.join(", ")}) de ${S.entity}'e gelir. ` : ""}(Alternatifler: iki tabloyu birleştirmek, ya da ayrı bir cross-reference tablosu.)`
            : `Foreign key, <strong>N tarafındaki</strong> ${S.entity} tablosuna: <code>${cols.join(", ")}</code> → ${T.entity}${recursive ? " (aynı tablo; rol adıyla)" : ""}.${S.total ? " Total participation → NOT NULL." : ""}${attrs.length ? ` İlişkinin öznitelikleri (${attrs.join(", ")}) da N tarafına.` : ""} Yeni tablo gerekmez (cross-reference tablosu da bir seçenek).`, t);
      }
    } else {
      const t = newTable(r.name, { kind: "relationship", name: r.name });
      const keyCols = [];
      const all = [];
      for (const e of ends) {
        const cols = addFK(t, e.entity, { role: e.role, notNull: true, onDelete: "CASCADE", why: r.name });
        all.push(...cols);
        if (isMany(e.card)) keyCols.push(...cols);
      }
      const attrs = relAttrs(t, r);
      t.pk = keyCols.length ? keyCols : all;
      log("7", `Adım 7 · ${r.name} (${ends.length}-ary)`, `n-ary ilişki her zaman <strong>yeni bir tablo</strong>: bütün katılımcıların primary key'leri foreign key olarak. Primary key ${keyCols.length < all.length ? "kardinalitesi 1 olmayan katılımcıların" : "hepsinin"} foreign key'leri: <code>${t.pk.join(", ")}</code>.${attrs.length ? ` Öznitelikler: ${attrs.join(", ")}.` : ""}`, t);
    }
  }

  // ---------------------------------------------------------------- Step 6: multivalued attributes
  const multis = [];
  for (const e of model.entities) for (const a of e.attrs.filter((x) => x.multi)) multis.push([e.name, a, where.get(U(e.name))]);
  for (const r of model.relationships) for (const a of r.attrs.filter((x) => x.multi)) multis.push([r.name, a, byName.has(U(r.name)) ? { table: byName.get(U(r.name)), pk: byName.get(U(r.name)).pk } : null]);
  for (const [owner, a, w] of multis) {
    if (!w || w.none) { notes.push(`${owner}.${a.name}: sahibin tablosu yok, çok değerli öznitelik eşlenemedi.`); continue; }
    const t = newTable(`${owner}_${a.name}`, { kind: "multivalued", name: `${owner}.${a.name}` });
    const fk = w.pk.map((c) => addCol(t, c, { type: w.table.cols.find((x) => x.name === c)?.type, notNull: true }));
    t.fks.push({ cols: fk, ref: w.table.name, refCols: [...w.pk], onDelete: "CASCADE", why: `${owner}.${a.name}` });
    const vals = leaves(a).map((l) => addCol(t, l, { notNull: true }));
    t.pk = [...fk, ...vals];
    log("6", `Adım 6 · ${owner}.${a.name} (multivalued)`, `Çok değerli öznitelik için yeni tablo: öznitelik (<code>${vals.join(", ")}</code>) + sahibin primary key'i (<code>${fk.join(", ")}</code>, foreign key). Primary key ikisinin birleşimi: her değer ayrı bir satır.`, t);
  }
  for (const r of identifying) for (const a of r.attrs) if (a.multi) notes.push(`${r.name}.${a.name}: tanımlayıcı ilişkinin çok değerli özniteliği eşlenmedi.`);

  // the same foreign key can be reached twice (a shared subclass whose superclasses were merged into one table)
  for (const t of tables) {
    const seen = new Set();
    t.fks = t.fks.filter((f) => { const k = `${f.cols.join(",")}>${f.ref}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  steps.sort((x, y) => Number(x.step) - Number(y.step));
  return { tables, steps, notes };
}

/** CREATE TABLE statements (foreign keys added afterwards with ALTER TABLE, so cycles such as EMPLOYEE ↔ DEPARTMENT work). */
// MySQL reserved words that make sensible attribute names; such names are written in backquotes
const RESERVED = new Set(["RANK", "ORDER", "GROUP", "KEY", "KEYS", "INDEX", "DESC", "ASC", "CONDITION", "RANGE", "ROW", "ROWS",
  "DIV", "MOD", "INTERVAL", "READ", "WRITE", "RELEASE", "REPEAT", "USAGE", "OPTION", "CHANGE", "CHECK", "COLUMN", "DEFAULT",
  "SELECT", "FROM", "WHERE", "TABLE", "USER", "LEAD", "LAG", "WINDOW", "OVER", "FUNCTION", "SYSTEM", "GROUPS", "CUBE", "MATCH",
  "LIMIT", "LINES", "LOAD", "PRIMARY", "REFERENCES", "SCHEMA", "SIGNAL", "TRIGGER", "UNIQUE", "VALUES", "YEAR_MONTH", "INT", "TO"]);
export const ident = (n) => (RESERVED.has(String(n).toUpperCase()) ? `\`${n}\`` : n);

export function toDDL(tables, { schema = null } = {}) {
  const q = (n) => (schema ? `${schema}.${ident(n)}` : ident(n));
  const cs = (list) => list.map(ident).join(", ");
  const out = [];
  for (const t of tables) {
    const lines = t.cols.map((c) => `  ${ident(c.name).padEnd(18)} ${c.type}${c.notNull ? " NOT NULL" : ""}`);
    if (t.pk.length) lines.push(`  PRIMARY KEY (${cs(t.pk)})`);
    for (const u of t.uniques) lines.push(`  UNIQUE (${cs(u)})`);
    out.push(`CREATE TABLE ${q(t.name)} (\n${lines.join(",\n")}\n);`);
  }
  for (const t of tables) for (const [i, f] of t.fks.entries()) {
    out.push(`ALTER TABLE ${q(t.name)} ADD CONSTRAINT ${t.name}_FK${i + 1}\n  FOREIGN KEY (${cs(f.cols)}) REFERENCES ${q(f.ref)} (${cs(f.refCols)})${f.onDelete ? ` ON DELETE ${f.onDelete}` : ""};`);
  }
  return out.join("\n\n") + "\n";
}
