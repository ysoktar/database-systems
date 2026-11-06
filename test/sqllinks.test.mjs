// "What belongs to this word?" (site/js/lib/sqllinks.js): clauses, subqueries, aliases, columns, join conditions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { linksAt } from "../site/js/lib/sqllinks.js";

const Q16 = `SELECT E.Fname, E.Lname
FROM   EMPLOYEE AS E
WHERE  E.Ssn IN (SELECT D.Essn
                 FROM   DEPENDENT AS D
                 WHERE  E.Fname = D.Dependent_name AND E.Sex = D.Sex);`;
const at = (q, w, n = 0) => { let p = -1; for (let k = 0; k <= n; k++) p = q.indexOf(w, p + 1); assert.ok(p >= 0, w); return linksAt(q, p); };
const texts = (q, r, kind) => r.ranges.filter((x) => x.kind === kind).map((x) => q.slice(x.start, x.end));

test("a clause keyword highlights its whole clause, with its step", () => {
  const r = at(Q16, "WHERE");
  assert.match(texts(Q16, r, "clause")[0], /^WHERE {2}E\.Ssn IN \(SELECT/);
  assert.match(r.label, /WHERE · 2\. adım/);
  const inner = at(Q16, "WHERE", 1);
  assert.equal(texts(Q16, inner, "clause")[0], "WHERE  E.Fname = D.Dependent_name AND E.Sex = D.Sex");
  assert.equal(texts(Q16, at(Q16, "FROM"), "clause")[0], "FROM   EMPLOYEE AS E");
});

test("IN before a subquery: the subquery, correlated through the outer alias", () => {
  const r = at(Q16, "IN (");
  assert.match(r.label, /correlated: dış sorgunun E/);
  assert.deepEqual(texts(Q16, r, "outer"), ["E", "E"]);
  const plain = "SELECT Lname FROM EMPLOYEE WHERE Dno IN (SELECT Dnumber FROM DEPARTMENT WHERE Dname = 'Research')";
  assert.match(at(plain, "IN (").label, /correlated değil/);
});

test("an alias shows all its uses and its table", () => {
  const r = at(Q16, "D.Essn");
  assert.match(r.label, /^D = DEPENDENT/);
  assert.deepEqual(texts(Q16, r, "def"), ["DEPENDENT"]);
  assert.equal(texts(Q16, r, "same").length, 4);
});

test("columns, join conditions, = NULL and ambiguity come from the COMPANY schema", () => {
  const q = "SELECT Lname, Sex FROM EMPLOYEE, DEPARTMENT, DEPENDENT WHERE Dno = Dnumber AND Super_ssn = NULL AND Ssn = Essn";
  assert.match(at(q, "Dno").label, /EMPLOYEE\.Dno · INT · yabancı anahtar → DEPARTMENT\.Dnumber/);
  assert.match(at(q, "= Dnumber").label, /^Join koşulu: EMPLOYEE\.Dno/);
  assert.equal(at(q, "= NULL").warn, true);
  assert.equal(at(q, "Sex").warn, true); // in EMPLOYEE and DEPENDENT
  assert.match(at(q, "DEPARTMENT").label, /3 satır · birincil anahtar Dnumber/);
});

test("parentheses find their partner; comments and strings are ignored", () => {
  const q = "SELECT COUNT(*) FROM T -- WHERE (\nWHERE a = '(x'";
  const r = at(q, "(");
  assert.deepEqual(texts(q, r, "match"), ["(", ")"]);
  assert.equal(linksAt(q, q.indexOf("WHERE (")), null);
});
