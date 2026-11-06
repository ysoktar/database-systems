// Errors in MySQL's words, with a suggestion for a misspelled name (site/js/lib/errhelp.js), on the real engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { companyDB } from "./helpers.mjs";
import { improveError } from "../site/js/lib/errhelp.js";

const db = await companyDB();
const err = (q) => { db.query("USE company"); const r = db.query(q); assert.ok(r.error, q); return improveError(r.error, q); };

test("an unknown qualified column is MySQL's 1054, with the closest column of that table", () => {
  const e = err("SELECT Fname, Lname, Salary\nFROM EMPLOYEE AS E\nWHERE E.Adress LIKE '%Houston%'");
  assert.equal(e.code, 1054);
  assert.equal(e.message, "Unknown column 'E.Adress' in 'where clause'");
  assert.match(e.hint, /Address/);
  assert.equal(e.word, "E.Adress");
});

test("unknown columns, tables, aliases and keywords", () => {
  assert.match(err("SELECT Fname FROM EMPLOYEE ORDER BY Slary").message, /Unknown column 'Slary' in 'order clause'/);
  assert.match(err("SELECT Pname FROM EMPLOYEE").hint, /PROJECT/);
  const t = err("SELECT * FROM EMPLOYE");
  assert.equal(t.code, 1146);
  assert.match(t.hint, /EMPLOYEE/);
  assert.match(err("SELECT X.Fname FROM EMPLOYEE E").message, /Unknown column 'X.Fname'/);
  const k = err("SELECT Fname FROM EMPLOYEE ORDR BY Fname");
  assert.match(k.message, /^You have an error in your SQL syntax/);
  assert.match(k.hint, /ORDER/);
});

test("other errors are left as they are", () => {
  const e = err("INSERT INTO WORKS_ON VALUES (NULL, 10, 5.0)");
  assert.equal(e.code, 1048);
  assert.equal(e.hint, null);
});
