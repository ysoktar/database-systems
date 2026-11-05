// ER studio: the language, the ER → relational mapping (run on PostgreSQL), reverse engineering, round trips and the
// exercise checker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { parseER, toDSL } from "../site/js/lib/ermodel.js";
import { mapER, toDDL } from "../site/js/lib/ermap.js";
import { reverseER, catalogSQL, catalogFromRows } from "../site/js/lib/erreverse.js";
import { ER_EXAMPLES } from "../site/js/lib/er-examples.js";
import { ER_EXERCISES, compareER, solutionModel } from "../site/js/lib/er-exercises.js";
import { autoLayout, toDiagram } from "../site/js/lib/erlayout.js";
import { SCHEMA_SQL } from "../site/js/lib/company.js";

const db = await PGlite.create();
let n = 0;
async function reverse(ddl) {
  const schema = `rv${++n}`;
  await db.exec(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};` + ddl);
  const [a, b] = catalogSQL(schema);
  const cols = (await db.query(a, [], { rowMode: "array" })).rows;
  const cons = (await db.query(b, [], { rowMode: "array" })).rows;
  return reverseER(catalogFromRows(cols, cons));
}
const model = (id) => parseER(ER_EXAMPLES.find((e) => e.id === id).dsl).model;
const table = (res, name) => res.tables.find((t) => t.name === name);

for (const ex of ER_EXAMPLES) {
  test(`example ${ex.id}: parses cleanly and survives a text round trip`, () => {
    const r = parseER(ex.dsl);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    const again = parseER(toDSL(r.model));
    assert.equal(toDSL(again.model), toDSL(r.model));
  });
  for (const spec of ex.kind === "EER" ? ["8A", "8B", "8C", "8D"] : ["8A"]) {
    test(`example ${ex.id}: mapping ${spec} gives DDL that PostgreSQL accepts`, async () => {
      const { tables } = mapER(model(ex.id), { spec });
      assert.ok(tables.length > 0);
      await db.exec(`CREATE SCHEMA m${++n}; SET search_path TO m${n};` + toDDL(tables));
    });
  }
  test(`example ${ex.id}: layout places every node`, () => {
    const m = model(ex.id);
    const d = toDiagram(m, autoLayout(m));
    for (const node of d.nodes) assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), node.id);
  });
}

test("COMPANY maps like Figure 9.2", () => {
  const res = mapER(model("company"));
  assert.deepEqual(res.tables.map((t) => t.name).sort(), ["DEPARTMENT", "DEPARTMENT_LOCATIONS", "DEPENDENT", "EMPLOYEE", "PROJECT", "WORKS_ON"]);
  assert.deepEqual(table(res, "EMPLOYEE").pk, ["Ssn"]);
  assert.deepEqual(table(res, "DEPARTMENT").uniques, [["Name"], ["manager_Ssn"]]); // second key and the 1:1 FK → UNIQUE
  assert.deepEqual(table(res, "DEPENDENT").pk, ["EMPLOYEE_Ssn", "Name"]); // owner key + partial key
  assert.deepEqual(table(res, "WORKS_ON").pk, ["EMPLOYEE_Ssn", "PROJECT_Number"]); // M:N
  assert.ok(table(res, "WORKS_ON").cols.some((c) => c.name === "Hours"));
  assert.ok(table(res, "EMPLOYEE").cols.some((c) => c.name === "supervisor_Ssn")); // recursive 1:N with role
  assert.ok(table(res, "EMPLOYEE").cols.find((c) => c.name === "DEPARTMENT_Number").notNull); // total participation
  assert.ok(table(res, "DEPARTMENT").cols.some((c) => c.name === "manager_Ssn")); // 1:1 → FK on the total side
  assert.ok(table(res, "DEPARTMENT").cols.some((c) => c.name === "Start_date"));
  assert.ok(!table(res, "DEPARTMENT").cols.some((c) => c.name === "Number_of_employees")); // derived: not stored
  assert.ok(table(res, "EMPLOYEE").cols.some((c) => c.name === "Fname")); // composite flattened
  assert.deepEqual(res.steps.map((s) => s.step), [...res.steps.map((s) => s.step)].sort((a, b) => a - b));
});

test("specialization options 8A–8D and the category surrogate key", () => {
  const a = mapER(model("employee-eer"), { spec: "8A" });
  assert.deepEqual(table(a, "SECRETARY").pk, ["Ssn"]);
  assert.equal(table(a, "SECRETARY").fks[0].ref, "EMPLOYEE");
  const c = mapER(model("employee-eer"), { spec: "8C" });
  assert.deepEqual(c.tables.map((t) => t.name).sort(), ["EMPLOYEE", "PROJECT"]);
  const b = mapER(model("part-eer"), { spec: "8B" });
  assert.deepEqual(b.tables.map((t) => t.name).sort(), ["MANUFACTURED_PART", "PURCHASED_PART"]);
  const bOverlapPartial = mapER(model("employee-eer"), { spec: "8B" });
  assert.ok(bOverlapPartial.notes.some((x) => x.includes("8A"))); // falls back
  const v = mapER(model("vehicle-eer"));
  assert.deepEqual(table(v, "OWNER").pk, ["OWNER_id"]);
  assert.ok(table(v, "PERSON").fks.some((f) => f.ref === "OWNER"));
  assert.deepEqual(table(v, "REGISTERED_VEHICLE").pk, ["Vehicle_id"]); // same keys: no surrogate
});

test("reverse engineering the book's COMPANY DDL", async () => {
  const { model: m } = await reverse(SCHEMA_SQL);
  const e = (name) => m.entities.find((x) => x.name === name);
  assert.deepEqual(m.entities.map((x) => x.name).sort(), ["DEPARTMENT", "DEPENDENT", "EMPLOYEE", "PROJECT"]);
  assert.ok(e("DEPENDENT").weak);
  assert.ok(e("DEPENDENT").attrs.find((a) => a.name === "Dependent_name").partial);
  assert.ok(e("DEPARTMENT").attrs.find((a) => a.name === "Dlocation").multi);
  assert.ok(e("DEPARTMENT").attrs.find((a) => a.name === "Dname").key); // UNIQUE → key
  const wo = m.relationships.find((r) => r.name === "WORKS_ON");
  assert.deepEqual(wo.ends.map((x) => x.entity).sort(), ["EMPLOYEE", "PROJECT"]);
  assert.ok(wo.attrs.some((a) => a.name === "Hours"));
  assert.ok(m.relationships.some((r) => r.identifying));
  const sup = m.relationships.find((r) => r.ends.every((x) => x.entity === "EMPLOYEE"));
  assert.ok(sup && sup.ends.every((x) => x.role)); // recursive, with role names
  assert.deepEqual(parseER(toDSL(m)).errors, []);
});

for (const id of ["company", "university", "bank", "supply"]) {
  test(`round trip ER → tables → ER keeps the structure (${id})`, async () => {
    const m = model(id);
    const back = (await reverse(toDDL(mapER(m).tables))).model;
    assert.deepEqual(back.entities.map((e) => e.name).sort(), m.entities.map((e) => e.name.toUpperCase()).sort());
    assert.deepEqual(back.entities.filter((e) => e.weak).map((e) => e.name).sort(), m.entities.filter((e) => e.weak).map((e) => e.name.toUpperCase()).sort());
    const sig = (r) => `${r.ends.map((x) => x.entity.toUpperCase()).sort().join("+")}:${r.ends.length === 2 ? r.ends.map((x) => (x.card === "1" ? 1 : 0)).sort().join("") : "n"}`;
    assert.deepEqual(back.relationships.map(sig).sort(), m.relationships.map(sig).sort());
  });
}

test("(min,max) and 1/N describe the same constraints", () => {
  const a = parseER("entity A\n  a key\nentity B\n  b key\nrelationship R: A (0,N), B (1,1)\n").model.relationships[0];
  const b = parseER("entity A\n  a key\nentity B\n  b key\nrelationship R: A 1, B N total\n").model.relationships[0];
  assert.deepEqual(a.ends.map((e) => [e.card, e.total]), b.ends.map((e) => [e.card, e.total]));
  assert.deepEqual(b.ends.map((e) => e.derivedMinmax), [[0, "N"], [1, 1]]);
});

test("parse errors and warnings point at lines", () => {
  const r = parseER("entity A\n  id key\nrelationship R: A 1, NOPE N\nweak entity W\n  x\nfoo bar\n");
  assert.ok(r.errors.some((e) => e.line === 3 && e.msg.includes("NOPE")));
  assert.ok(r.errors.some((e) => e.line === 6));
  assert.ok(r.warnings.some((w) => w.line === 4));
});

for (const ex of ER_EXERCISES) {
  test(`exercise ${ex.id}: the solution scores 100% and a sloppy answer does not`, () => {
    const sol = solutionModel(ex, ER_EXAMPLES);
    const full = compareER(sol, sol);
    assert.equal(full.score, full.total);
    const sloppy = parseER(toDSL(sol).replace(/ total/g, "").replace(/weak entity/g, "entity").replace(/ multi/g, "")).model;
    const r = compareER(sloppy, sol);
    assert.ok(r.score < r.total);
  });
}
