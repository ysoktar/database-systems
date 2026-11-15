// Functional dependencies and normal forms (site/js/lib/fd.js) on the book's Ch 14 examples.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFDs, parseAttrs, closure, candidateKeys, analyze, decompose, njb, checkOnRows, lostFDs } from "../site/js/lib/fd.js";

const set = (a) => [...a].sort().join(",");

test("closure and candidate keys", () => {
  const F = parseFDs("Ssn, Pnumber -> Hours; Ssn -> Ename; Pnumber -> Pname, Plocation");
  assert.equal(set(closure(["Ssn"], F)), "Ename,Ssn");
  assert.deepEqual(candidateKeys(parseAttrs("Ssn Pnumber Hours Ename Pname Plocation"), F).map(set), ["Pnumber,Ssn"]);
  // LOTS: two candidate keys
  const L = parseFDs("Property_id -> County_name, Lot, Area, Price, Tax_rate; County_name, Lot -> Property_id, Area, Price, Tax_rate; County_name -> Tax_rate; Area -> Price");
  assert.deepEqual(candidateKeys(parseAttrs("Property_id County_name Lot Area Price Tax_rate"), L).map(set).sort(), ["County_name,Lot", "Property_id"]);
});

test("EMP_PROJ is in 1NF only; 2NF decomposition gives EP1, EP2, EP3 (Figure 14.11a)", () => {
  const R = parseAttrs("Ssn Pnumber Hours Ename Pname Plocation");
  const F = parseFDs("Ssn, Pnumber -> Hours; Ssn -> Ename; Pnumber -> Pname, Plocation");
  assert.equal(analyze(R, F).nf, 1);
  const d = decompose(R, F, "2NF");
  assert.deepEqual(d.result.map(set).sort(), ["Ename,Ssn", "Hours,Pnumber,Ssn", "Plocation,Pname,Pnumber"]);
  assert.ok(d.steps.every((s) => s.njb.ok));
});

test("EMP_DEPT is in 2NF; 3NF decomposition gives ED1, ED2 (Figure 14.11b)", () => {
  const R = parseAttrs("Ename Ssn Bdate Address Dnumber Dname Dmgr_ssn");
  const F = parseFDs("Ssn -> Ename, Bdate, Address, Dnumber; Dnumber -> Dname, Dmgr_ssn");
  assert.equal(analyze(R, F).nf, 2);
  assert.deepEqual(decompose(R, F, "3NF").result.map(set).sort(), ["Address,Bdate,Dnumber,Ename,Ssn", "Dmgr_ssn,Dname,Dnumber"]);
});

test("LOTS: 2NF, then 3NF, then BCNF (Figures 14.12 and 14.13a)", () => {
  const R = parseAttrs("Property_id County_name Lot Area Price Tax_rate");
  const F = parseFDs("Property_id -> County_name, Lot, Area, Price, Tax_rate; County_name, Lot -> Property_id, Area, Price, Tax_rate; County_name -> Tax_rate; Area -> Price");
  assert.equal(analyze(R, F).nf, 1);
  assert.deepEqual(decompose(R, F, "2NF").result.map(set).sort(), ["Area,County_name,Lot,Price,Property_id", "County_name,Tax_rate"]);
  assert.deepEqual(decompose(R, F, "3NF").result.map(set).sort(), ["Area,County_name,Lot,Property_id", "Area,Price", "County_name,Tax_rate"]);
  // with FD5 Area -> County_name, LOTS1A is in 3NF but not in BCNF
  const F5 = [...F, ...parseFDs("Area -> County_name")];
  const L1A = parseAttrs("Property_id County_name Lot Area");
  assert.equal(analyze(L1A, F5).nf, 3);
  assert.deepEqual(decompose(L1A, F5, "BCNF").result.map(set).sort(), ["Area,County_name", "Area,Lot,Property_id"]);
});

test("TEACH: 3NF but not BCNF; only D3 is non-additive (slides 51–55)", () => {
  const R = parseAttrs("Student Course Instructor");
  const F = parseFDs("Student, Course -> Instructor; Instructor -> Course");
  assert.equal(analyze(R, F).nf, 3);
  assert.equal(njb(["Student", "Instructor"], ["Student", "Course"], F).ok, false);   // D1
  assert.equal(njb(["Course", "Instructor"], ["Course", "Student"], F).ok, false);    // D2
  assert.equal(njb(["Instructor", "Course"], ["Instructor", "Student"], F).ok, true); // D3
  assert.deepEqual(decompose(R, F, "BCNF").result.map(set).sort(), ["Course,Instructor", "Instructor,Student"]);
});

test("ruling out FDs from a relation state (Figure 14.7)", () => {
  const cols = ["Teacher", "Course", "Text"];
  const rows = [["Smith", "Data Structures", "Bartram"], ["Smith", "Data Management", "Martin"], ["Hall", "Compilers", "Hoffman"], ["Brown", "Data Structures", "Horowitz"]];
  assert.equal(checkOnRows(cols, rows, ["Text"], ["Course"]), null);       // may exist
  assert.ok(checkOnRows(cols, rows, ["Teacher"], ["Course"]).rows);        // ruled out
  assert.ok(checkOnRows(cols, rows, ["Course"], ["Text"]).rows);           // ruled out
});

test("dependency preservation: 3NF keeps every FD, BCNF can lose one (TEACH, LOTS1A)", () => {
  const L = parseFDs("Property_id -> County_name, Lot, Area, Price, Tax_rate; County_name, Lot -> Property_id, Area, Price, Tax_rate; County_name -> Tax_rate; Area -> Price");
  const R = parseAttrs("Property_id County_name Lot Area Price Tax_rate");
  assert.equal(lostFDs(L, decompose(R, L, "3NF").result).length, 0);
  const T = parseFDs("Student, Course -> Instructor; Instructor -> Course");
  assert.deepEqual(lostFDs(T, decompose(parseAttrs("Student Course Instructor"), T, "BCNF").result).map((f) => f.rhs.join()), ["Instructor"]);
  const F5 = [...L, ...parseFDs("Area -> County_name")];
  const lost = lostFDs(F5, decompose(parseAttrs("Property_id County_name Lot Area"), F5, "BCNF").result);
  assert.ok(lost.some((f) => f.lhs.join() === "County_name,Lot"));   // FD2 is lost (Figure 14.13a)
});
