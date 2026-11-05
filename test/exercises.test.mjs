// Every model answer on the site (solutions and alternatives) must pass the notebook's own checker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../site/js/lib/exercises.js";
import { checkResult } from "../site/js/lib/sqlcore.js";
import { companyDB, lastResult } from "./helpers.mjs";

const db = await companyDB();

for (const ex of EXERCISES) {
  const sols = [ex.solution, ...(ex.alt || [])];
  sols.forEach((sql, i) => {
    test(`exercise ${ex.n}, ${i ? `alternative ${i}` : "solution"}`, async () => {
      const r = await checkResult(ex.expect, await lastResult(db, sql), null);
      assert.ok(r.ok, `${r.reason}: ${r.text}`);
    });
  });
}

test("wrong answers are rejected with the notebook's reasons", async () => {
  const ex = (n) => EXERCISES[n - 1].expect;
  const run = async (n, sql) => (await checkResult(ex(n), await lastResult(db, sql), null)).reason;
  assert.equal(await run(1, "SELECT Fname, Lname FROM EMPLOYEE WHERE Sex='F'"), "ncols");
  assert.equal(await run(1, "SELECT Fname, Lname, Salary FROM EMPLOYEE"), "nrows");
  assert.equal(await run(1, "SELECT Fname, Lname, Salary FROM EMPLOYEE WHERE Sex='F' ORDER BY Salary DESC, Lname DESC"), "order");
  assert.equal(await run(6, "SELECT E.Fname, E.Lname, COUNT(*) AS n FROM EMPLOYEE E LEFT JOIN DEPENDENT D ON E.Ssn = D.Essn GROUP BY E.Ssn, E.Fname, E.Lname ORDER BY n DESC, E.Lname"), "values");
  assert.equal((await checkResult(ex(2), null, null)).reason, "empty");
});
