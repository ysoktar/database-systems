import test from "node:test";
import assert from "node:assert/strict";
import { parseSchedule, precedenceGraph, findCycle, serialOrder, recoverability, BOOK_SCHEDULES } from "../site/js/lib/schedule.js";

const g = (k) => precedenceGraph(parseSchedule(BOOK_SCHEDULES[k]).ops);

test("Figure 20.7: A and B serial, C not serializable, D equivalent to A", () => {
  assert.deepEqual(serialOrder(g("A")), [1, 2]);
  assert.deepEqual(serialOrder(g("B")), [2, 1]);
  assert.ok(findCycle(g("C")));
  assert.equal(serialOrder(g("C")), null);
  assert.deepEqual(serialOrder(g("D")), [1, 2]);
});

test("three transactions: E has a cycle", () => {
  assert.ok(findCycle(g("E")));
});

test("Section 20.4: Sc nonrecoverable, Sd recoverable, Se recoverable with cascading rollback", () => {
  const r = (k) => recoverability(parseSchedule(BOOK_SCHEDULES[k]).ops);
  assert.equal(r("Sa").recoverable, true);
  assert.equal(r("Sc").recoverable, false);
  assert.equal(r("Sd").recoverable, true);
  assert.equal(r("Sd").cascadeless, false);
  assert.equal(r("Se").recoverable, true);
  assert.equal(r("Se").cascadeless, false);
  const strict = recoverability(parseSchedule("r1(X); w1(X); c1; r2(X); w2(X); c2").ops);
  assert.deepEqual([strict.recoverable, strict.cascadeless, strict.strict], [true, true, true]);
  const notStrict = recoverability(parseSchedule("w1(X); w2(X); a1; c2").ops);
  assert.deepEqual([notStrict.cascadeless, notStrict.strict], [true, false]);
});

test("parse errors are reported", () => {
  assert.deepEqual(parseSchedule("r1(X); q2(X); c1").errors, ["q2(X)"]);
});
