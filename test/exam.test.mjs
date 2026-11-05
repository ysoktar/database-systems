// The midterm guide's SQL problems: each model solution runs and returns the stated number of rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SQL_PROBLEMS } from "../site/js/lib/exam-problems.js";
import { companyDB, lastResult } from "./helpers.mjs";

const db = await companyDB();
for (const p of SQL_PROBLEMS) {
  test(`exam problem ${p.id}: ${p.title}`, async () => {
    const r = await lastResult(db, p.solution);
    assert.equal(r.rows.length, p.rows, JSON.stringify(r.rows));
  });
}
