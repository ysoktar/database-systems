// Relational algebra (Ch 8, slides 1–67): every operation shown as input → result on COMPANY, with its SQL equivalent,
// and the query tree of Q2 whose nodes show their intermediate results.
import "../layout.js";
import { $, h } from "../lib/ui.js";
import { queryStepper } from "../lib/stepper.js";
import { runSQL } from "../lib/db.js";
import { relationTable, startError } from "../lib/sqlbox.js";
import { t as tl } from "../lib/i18n.js";

const DROP = ["koşulu sağlamayan {n} satır (kırmızı) atılır", "the {n} rows that fail the condition (red) are dropped"];
const after = tl("Sonuç", "Result");
const input = (name) => tl(`Girdi: ${name}`, `Input: ${name}`);

// ---- SELECT and PROJECT
$("#select-project").append(queryStepper([
  { label: "σ Dno=4",
    note: tl("<strong>σ<sub>Dno=4</sub>(EMPLOYEE)</strong>: her satır tek tek sınanır; Dno'su 4 olan üç satır kalır. Sütunlar değişmez.", "<strong>σ<sub>Dno=4</sub>(EMPLOYEE)</strong>: every row is tested on its own; the three rows with Dno 4 remain. The columns do not change."),
    before: { sql: "SELECT Fname, Lname, Salary, Dno, (Dno = 4) AS keep FROM EMPLOYEE", flag: "keep", flagNote: DROP, caption: input("EMPLOYEE") },
    sql: "SELECT Fname, Lname, Salary, Dno FROM EMPLOYEE WHERE Dno = 4", after,
    display: "-- σ Dno=4 (EMPLOYEE)\nSELECT * FROM EMPLOYEE WHERE Dno = 4;" },
  { label: "σ Dno=4 AND Salary>25000",
    note: tl("<strong>σ<sub>Dno=4 AND Salary&gt;25000</sub>(EMPLOYEE)</strong>: iki koşulun ikisi de sağlanmalı. Bu, σ<sub>Salary&gt;25000</sub>(σ<sub>Dno=4</sub>(EMPLOYEE)) ile aynıdır: art arda gelen seçimler tek bir seçimde birleşir.", "<strong>σ<sub>Dno=4 AND Salary&gt;25000</sub>(EMPLOYEE)</strong>: both conditions must hold. It is the same as σ<sub>Salary&gt;25000</sub>(σ<sub>Dno=4</sub>(EMPLOYEE)): successive selections combine into one."),
    before: { sql: "SELECT Fname, Lname, Salary, Dno, (Dno = 4 AND Salary > 25000) AS keep FROM EMPLOYEE", flag: "keep", flagNote: DROP, caption: input("EMPLOYEE") },
    sql: "SELECT Fname, Lname, Salary, Dno FROM EMPLOYEE WHERE Dno = 4 AND Salary > 25000", after,
    display: "-- σ Dno=4 AND Salary>25000 (EMPLOYEE)\nSELECT * FROM EMPLOYEE WHERE Dno = 4 AND Salary > 25000;" },
  { label: "π Lname, Fname, Salary",
    note: tl("<strong>π<sub>Lname, Fname, Salary</sub>(EMPLOYEE)</strong>: yalnızca üç sütun kalır. Hiçbir satır tekrar etmediği için satır sayısı değişmez (8).", "<strong>π<sub>Lname, Fname, Salary</sub>(EMPLOYEE)</strong>: only three columns remain. No row repeats, so the number of rows stays the same (8)."),
    before: { sql: "SELECT Fname, Minit, Lname, Ssn, Salary, Dno FROM EMPLOYEE", caption: input("EMPLOYEE") },
    sql: "SELECT DISTINCT Lname, Fname, Salary FROM EMPLOYEE", after,
    display: "-- π Lname, Fname, Salary (EMPLOYEE)\nSELECT DISTINCT Lname, Fname, Salary FROM EMPLOYEE;" },
  { label: "π Sex, Salary",
    note: tl("<strong>π<sub>Sex, Salary</sub>(EMPLOYEE)</strong>: iki sütun kalınca (F, 25000) çifti iki kez oluşur. Sonuç bir küme olduğu için tekrar eden satır (kırmızı) silinir: 8 satırdan 7'si kalır. SQL'de bunun için <code>DISTINCT</code> yazmak gerekir.", "<strong>π<sub>Sex, Salary</sub>(EMPLOYEE)</strong>: with two columns left, the pair (F, 25000) occurs twice. Since the result is a set, the repeated row (red) is removed: 7 of the 8 rows remain. SQL needs <code>DISTINCT</code> for this."),
    before: { sql: "SELECT Sex, Salary, (ROW_NUMBER() OVER (PARTITION BY Sex, Salary ORDER BY Ssn) = 1) AS keep FROM EMPLOYEE ORDER BY Sex, Salary", flag: "keep",
      flagNote: ["tekrar eden {n} satır (kırmızı) silinir", "the {n} repeated rows (red) are removed"], caption: tl("Girdi: EMPLOYEE'nin Sex ve Salary sütunları", "Input: the Sex and Salary columns of EMPLOYEE") },
    sql: "SELECT DISTINCT Sex, Salary FROM EMPLOYEE ORDER BY Sex, Salary", after,
    display: "-- π Sex, Salary (EMPLOYEE)\nSELECT DISTINCT Sex, Salary FROM EMPLOYEE;" },
], { intro: tl("Bir işleme tıklayın: solda girdisi, sağda sonucu.", "Click an operation: its input on the left, its result on the right.") }));

// ---- a sequence of operations with named intermediate results
$("#sequence").append(queryStepper([
  { label: "DEP5_EMPS ← σ",
    note: tl("İlk ara sonuç: <strong>DEP5_EMPS ← σ<sub>Dno=5</sub>(EMPLOYEE)</strong>. 5 numaralı departmanın dört çalışanı kalır.", "The first intermediate result: <strong>DEP5_EMPS ← σ<sub>Dno=5</sub>(EMPLOYEE)</strong>. The four employees of department 5 remain."),
    before: { sql: "SELECT Fname, Lname, Salary, Dno, (Dno = 5) AS keep FROM EMPLOYEE", flag: "keep", flagNote: DROP, caption: input("EMPLOYEE") },
    sql: "SELECT Fname, Minit, Lname, Ssn, Salary, Dno FROM EMPLOYEE WHERE Dno = 5", after: "DEP5_EMPS",
    display: "-- DEP5_EMPS ← σ Dno=5 (EMPLOYEE)\nSELECT * FROM EMPLOYEE WHERE Dno = 5;" },
  { label: "RESULT ← π",
    note: tl("İkinci adım, birincinin sonucunu kullanır: <strong>RESULT ← π<sub>Fname, Lname, Salary</sub>(DEP5_EMPS)</strong>. Tek ifade olarak yazılsaydı sonuç aynı olurdu.", "The second step uses the result of the first: <strong>RESULT ← π<sub>Fname, Lname, Salary</sub>(DEP5_EMPS)</strong>. Written as a single expression the result would be the same."),
    before: { sql: "SELECT Fname, Minit, Lname, Ssn, Salary, Dno FROM EMPLOYEE WHERE Dno = 5", caption: tl("Girdi: DEP5_EMPS", "Input: DEP5_EMPS") },
    sql: "SELECT DISTINCT Fname, Lname, Salary FROM EMPLOYEE WHERE Dno = 5", after: "RESULT",
    display: "-- RESULT ← π Fname, Lname, Salary (DEP5_EMPS)\nSELECT DISTINCT Fname, Lname, Salary FROM EMPLOYEE WHERE Dno = 5;" },
]));

// ---- set operations on RESULT1 and RESULT2
const R1 = "SELECT Ssn FROM EMPLOYEE WHERE Dno = 5";
const R2 = "SELECT DISTINCT Super_ssn AS Ssn FROM EMPLOYEE WHERE Dno = 5";
const r1 = (flag, note) => ({ sql: flag ? `SELECT Ssn, ${flag} AS keep FROM EMPLOYEE E WHERE Dno = 5` : R1, flag: flag ? "keep" : undefined, flagNote: note, group: "Ssn", groupBorders: false, caption: "RESULT1 = π Ssn (DEP5_EMPS)" });
const r2 = (flag, note) => ({ sql: flag ? `SELECT DISTINCT Super_ssn AS Ssn, ${flag} AS keep FROM EMPLOYEE E WHERE Dno = 5` : R2, flag: flag ? "keep" : undefined, flagNote: note, group: "Ssn", groupBorders: false, caption: "RESULT2(Ssn) = π Super_ssn (DEP5_EMPS)" });
const inR2 = "EXISTS (SELECT 1 FROM EMPLOYEE X WHERE X.Dno = 5 AND X.Super_ssn = E.Ssn)";
const inR1 = "EXISTS (SELECT 1 FROM EMPLOYEE X WHERE X.Dno = 5 AND X.Ssn = E.Super_ssn)";
const NOT_BOTH = ["öbüründe bulunmayan {n} satır (kırmızı) sonuca girmez", "the {n} rows not found in the other (red) do not reach the result"];
$("#set-ops").append(queryStepper([
  { label: "RESULT1 ∪ RESULT2", group: "Ssn", groupBorders: false,
    note: tl("<strong>∪</strong>: iki girdideki bütün Ssn'ler, tekrarsız olarak. 333445555 (Wong) iki girdide de var ama sonuçta bir kez yer alır; Borg (888665555) yalnızca RESULT2'den gelir.", "<strong>∪</strong>: all the Ssns of both inputs, without repeats. 333445555 (Wong) is in both inputs but appears once in the result; Borg (888665555) comes only from RESULT2."),
    before: [r1(), r2()], sql: `${R1} UNION ${R2}`, after: "RESULT1 ∪ RESULT2",
    display: `-- RESULT ← RESULT1 ∪ RESULT2\n${R1}\nUNION\nSELECT Super_ssn FROM EMPLOYEE WHERE Dno = 5;` },
  { label: "RESULT1 ∩ RESULT2", group: "Ssn", groupBorders: false,
    note: tl("<strong>∩</strong>: yalnızca iki girdide de bulunan Ssn'ler. Yalnızca Wong hem 5 numaralı departmanda çalışıyor hem de oradaki birini yönetiyor.", "<strong>∩</strong>: only the Ssns found in both inputs. Only Wong both works in department 5 and supervises someone there."),
    before: [r1(inR2, NOT_BOTH), r2(inR1, NOT_BOTH)], sql: `${R1} INTERSECT ${R2}`, after: "RESULT1 ∩ RESULT2",
    display: `-- RESULT1 ∩ RESULT2\n${R1}\nINTERSECT\nSELECT Super_ssn FROM EMPLOYEE WHERE Dno = 5;` },
  { label: "RESULT1 − RESULT2", group: "Ssn", groupBorders: false,
    note: tl("<strong>−</strong>: RESULT1'de olup RESULT2'de olmayanlar, yani 5 numaralı departmanda çalışıp oradaki kimseyi yönetmeyenler. RESULT2 − RESULT1 ise başka bir sonuç verir (Borg): fark değişmeli değildir.", "<strong>−</strong>: those in RESULT1 but not in RESULT2, i.e. those who work in department 5 and supervise nobody there. RESULT2 − RESULT1 gives another result (Borg): difference is not commutative."),
    before: [r1(`NOT ${inR2}`, ["RESULT2'de de bulunan {n} satır (kırmızı) çıkarılır", "the {n} rows also in RESULT2 (red) are removed"]), r2()], sql: `${R1} EXCEPT ${R2}`, after: "RESULT1 − RESULT2",
    display: `-- RESULT1 − RESULT2\n${R1}\nEXCEPT\nSELECT Super_ssn FROM EMPLOYEE WHERE Dno = 5;` },
]));

// ---- Cartesian product, then a selection: female employees and their dependents
const EMPNAMES = "SELECT Fname, Lname, Ssn FROM EMPLOYEE WHERE Sex = 'F'";
$("#product").append(queryStepper([
  { label: "FEMALE_EMPS, EMPNAMES",
    note: tl("<strong>EMPNAMES ← π<sub>Fname, Lname, Ssn</sub>(σ<sub>Sex='F'</sub>(EMPLOYEE))</strong>: üç kadın çalışan.", "<strong>EMPNAMES ← π<sub>Fname, Lname, Ssn</sub>(σ<sub>Sex='F'</sub>(EMPLOYEE))</strong>: the three female employees."),
    before: { sql: "SELECT Fname, Lname, Ssn, Sex, (Sex = 'F') AS keep FROM EMPLOYEE", flag: "keep", flagNote: DROP, caption: input("EMPLOYEE") },
    sql: EMPNAMES, after: "EMPNAMES", display: `-- EMPNAMES ← π Fname, Lname, Ssn (σ Sex='F' (EMPLOYEE))\n${EMPNAMES};` },
  { label: "EMP_DEPENDENTS ← ×",
    note: tl("<strong>EMP_DEPENDENTS ← EMPNAMES × DEPENDENT</strong>: 3 kadın çalışanın her biri 7 bağımlının her biriyle eşleşir: 3 · 7 = 21 satır. Çoğu anlamsızdır, çünkü çalışan ile bağımlı birbiriyle ilgili değildir.", "<strong>EMP_DEPENDENTS ← EMPNAMES × DEPENDENT</strong>: each of the 3 female employees is paired with each of the 7 dependents: 3 · 7 = 21 rows. Most are meaningless, because the employee and the dependent are not related."),
    before: [{ sql: EMPNAMES, caption: "EMPNAMES" }, { sql: "SELECT Essn, Dependent_name, Relationship FROM DEPENDENT", caption: "DEPENDENT" }],
    sql: "SELECT E.Fname, E.Lname, E.Ssn, D.Essn, D.Dependent_name FROM EMPLOYEE E CROSS JOIN DEPENDENT D WHERE E.Sex = 'F' ORDER BY E.Lname, D.Essn",
    after: "EMP_DEPENDENTS", display: "-- EMP_DEPENDENTS ← EMPNAMES × DEPENDENT\nSELECT * FROM (SELECT Fname, Lname, Ssn FROM EMPLOYEE WHERE Sex = 'F') AS EMPNAMES CROSS JOIN DEPENDENT;" },
  { label: "ACTUAL_DEPS ← σ Ssn=Essn",
    note: tl("<strong>ACTUAL_DEPS ← σ<sub>Ssn=Essn</sub>(EMP_DEPENDENTS)</strong>: yalnızca bağımlının gerçekten o çalışana ait olduğu satırlar kalır. Kadın çalışanlardan yalnızca Wallace'ın bir bağımlısı var (Abner). Çarpımın arkasından gelen bu seçim, tam olarak bir join'dir.", "<strong>ACTUAL_DEPS ← σ<sub>Ssn=Essn</sub>(EMP_DEPENDENTS)</strong>: only the rows where the dependent really belongs to that employee remain. Of the female employees only Wallace has a dependent (Abner). This selection after a product is exactly a join."),
    before: { sql: "SELECT E.Fname, E.Lname, E.Ssn, D.Essn, D.Dependent_name, (E.Ssn = D.Essn) AS keep FROM EMPLOYEE E CROSS JOIN DEPENDENT D WHERE E.Sex = 'F' ORDER BY E.Lname, D.Essn", flag: "keep", flagNote: DROP, caption: "EMP_DEPENDENTS" },
    sql: "SELECT E.Fname, E.Lname, E.Ssn, D.Essn, D.Dependent_name FROM EMPLOYEE E CROSS JOIN DEPENDENT D WHERE E.Sex = 'F' AND E.Ssn = D.Essn",
    after: "ACTUAL_DEPS", display: "-- ACTUAL_DEPS ← σ Ssn=Essn (EMP_DEPENDENTS)\nSELECT * FROM EMPNAMES CROSS JOIN DEPENDENT WHERE Ssn = Essn;" },
  { label: "RESULT ← π",
    note: tl("<strong>RESULT ← π<sub>Fname, Lname, Dependent_name</sub>(ACTUAL_DEPS)</strong>: kadın çalışanların adları ve bağımlılarının adları.", "<strong>RESULT ← π<sub>Fname, Lname, Dependent_name</sub>(ACTUAL_DEPS)</strong>: the names of the female employees and of their dependents."),
    before: { sql: "SELECT E.Fname, E.Lname, E.Ssn, D.Essn, D.Dependent_name FROM EMPLOYEE E CROSS JOIN DEPENDENT D WHERE E.Sex = 'F' AND E.Ssn = D.Essn", caption: "ACTUAL_DEPS" },
    sql: "SELECT DISTINCT E.Fname, E.Lname, D.Dependent_name FROM EMPLOYEE E JOIN DEPENDENT D ON E.Ssn = D.Essn WHERE E.Sex = 'F'",
    after: "RESULT", display: "-- RESULT ← π Fname, Lname, Dependent_name (ACTUAL_DEPS)\nSELECT DISTINCT Fname, Lname, Dependent_name FROM EMPLOYEE JOIN DEPENDENT ON Ssn = Essn WHERE Sex = 'F';" },
]));

// ---- JOIN: DEPT_MGR and a natural join
$("#joins-alg").append(queryStepper([
  { label: "DEPARTMENT ⋈ Mgr_ssn=Ssn EMPLOYEE", group: "Ssn", groupBorders: false,
    note: tl("<strong>DEPT_MGR ← DEPARTMENT ⋈<sub>Mgr_ssn=Ssn</sub> EMPLOYEE</strong>: her departman, Ssn'i Mgr_ssn'ine eşit olan çalışanla birleşir (aynı renk = eşleşen çift). Yönetici olmayan beş çalışanın eşi yoktur ve sonuca girmez. Bu bir equijoin'dir: Mgr_ssn ile Ssn her satırda aynıdır.", "<strong>DEPT_MGR ← DEPARTMENT ⋈<sub>Mgr_ssn=Ssn</sub> EMPLOYEE</strong>: each department is combined with the employee whose Ssn equals its Mgr_ssn (same colour = a matching pair). The five employees who are not managers have no partner and do not reach the result. This is an equijoin: Mgr_ssn and Ssn are equal in every row."),
    before: [{ sql: "SELECT Dname, Dnumber, Mgr_ssn FROM DEPARTMENT", group: "Mgr_ssn", groupBorders: false, caption: "DEPARTMENT" },
      { sql: "SELECT Fname, Lname, Ssn, EXISTS (SELECT 1 FROM DEPARTMENT D WHERE D.Mgr_ssn = E.Ssn) AS keep FROM EMPLOYEE E", flag: "keep", group: "Ssn", groupBorders: false, flagNote: ["eşi olmayan {n} satır (kırmızı) sonuca girmez", "the {n} rows without a partner (red) do not reach the result"], caption: "EMPLOYEE" }],
    sql: "SELECT D.Dname, D.Dnumber, D.Mgr_ssn, E.Fname, E.Lname, E.Ssn FROM DEPARTMENT D JOIN EMPLOYEE E ON D.Mgr_ssn = E.Ssn", after: "DEPT_MGR",
    display: "-- DEPT_MGR ← DEPARTMENT ⋈ Mgr_ssn=Ssn EMPLOYEE\nSELECT * FROM DEPARTMENT JOIN EMPLOYEE ON Mgr_ssn = Ssn;" },
  { label: "DEPARTMENT * DEPT_LOCATIONS", group: "Dnumber", groupBorders: false,
    note: tl("<strong>DEPT_LOCS ← DEPARTMENT * DEPT_LOCATIONS</strong>: iki ilişkinin aynı adı taşıyan tek sütunu Dnumber'dır; koşul DEPARTMENT.Dnumber = DEPT_LOCATIONS.Dnumber kendiliğinden oluşur ve Dnumber sonuçta yalnızca bir kez yer alır.", "<strong>DEPT_LOCS ← DEPARTMENT * DEPT_LOCATIONS</strong>: the only column with the same name in both relations is Dnumber; the condition DEPARTMENT.Dnumber = DEPT_LOCATIONS.Dnumber is formed automatically and Dnumber appears only once in the result."),
    before: [{ sql: "SELECT Dname, Dnumber, Mgr_ssn FROM DEPARTMENT", group: "Dnumber", groupBorders: false, caption: "DEPARTMENT" }, { sql: "SELECT Dnumber, Dlocation FROM DEPT_LOCATIONS", group: "Dnumber", groupBorders: false, caption: "DEPT_LOCATIONS" }],
    sql: "SELECT Dnumber, Dname, Mgr_ssn, Dlocation FROM DEPARTMENT NATURAL JOIN DEPT_LOCATIONS ORDER BY Dnumber, Dlocation", after: "DEPT_LOCS",
    display: "-- DEPT_LOCS ← DEPARTMENT * DEPT_LOCATIONS\nSELECT * FROM DEPARTMENT NATURAL JOIN DEPT_LOCATIONS;" },
]));

// ---- DIVISION
const COVERS = "NOT EXISTS (SELECT 1 FROM WORKS_ON S WHERE S.Essn = '123456789' AND S.Pno NOT IN (SELECT X.Pno FROM WORKS_ON X WHERE X.Essn = W.Essn))";
$("#division").append(queryStepper([
  { label: "SSN_PNOS ÷ SMITH_PNOS",
    note: tl("Smith'in projeleri 1 ve 2'dir. SSN_PNOS'ta her çalışanın satırları aynı renktedir; bir Essn, hem 1 hem 2 ile birlikte bulunuyorsa sonuca girer. Smith'in kendisi (123456789) ve English (453453453) bu koşulu sağlar. Wong 2'de çalışıyor ama 1'de çalışmıyor, bu yüzden onun satırları kırmızıdır.", "Smith's projects are 1 and 2. In SSN_PNOS the rows of each employee share a colour; an Essn reaches the result if it occurs with both 1 and 2. Smith himself (123456789) and English (453453453) satisfy this. Wong works on 2 but not on 1, so his rows are red."),
    before: [{ sql: `SELECT W.Essn, W.Pno, ${COVERS} AS keep FROM WORKS_ON W ORDER BY W.Essn, W.Pno`, flag: "keep", group: "Essn", flagNote: ["Smith'in projelerinin hepsiyle birlikte bulunmayan Essn'lerin {n} satırı (kırmızı)", "{n} rows of Essns that do not occur with all of Smith's projects (red)"], caption: "SSN_PNOS = π Essn, Pno (WORKS_ON)" },
      { sql: "SELECT Pno FROM WORKS_ON WHERE Essn = '123456789'", caption: "SMITH_PNOS" }],
    sql: `SELECT DISTINCT W.Essn AS Ssn FROM WORKS_ON W WHERE ${COVERS}`, after: "SSNS(Ssn)", showSql: false },
]));

// ---- aggregate functions and grouping (Figure 8.10)
$("#aggregate").append(queryStepper([
  { label: "Dno ℑ COUNT Ssn, AVERAGE Salary", group: "Dno",
    note: tl("<strong>ρ<sub>R(Dno, No_of_employees, Average_sal)</sub>(<sub>Dno</sub>ℑ<sub>COUNT Ssn, AVERAGE Salary</sub>(EMPLOYEE))</strong>: çalışanlar Dno'ya göre gruplanır (her renk bir grup) ve her grup tek bir satıra iner. ρ sonuç sütunlarına ad verir.", "<strong>ρ<sub>R(Dno, No_of_employees, Average_sal)</sub>(<sub>Dno</sub>ℑ<sub>COUNT Ssn, AVERAGE Salary</sub>(EMPLOYEE))</strong>: the employees are grouped by Dno (each colour is a group) and each group shrinks to one row. ρ names the result columns."),
    before: { sql: "SELECT Dno, Ssn, Salary FROM EMPLOYEE ORDER BY Dno, Ssn", group: "Dno", caption: input("EMPLOYEE") },
    sql: "SELECT Dno, COUNT(Ssn) AS No_of_employees, AVG(Salary) AS Average_sal FROM EMPLOYEE GROUP BY Dno ORDER BY Dno", after,
    display: "-- ρ R(Dno, No_of_employees, Average_sal) (Dno ℑ COUNT Ssn, AVERAGE Salary (EMPLOYEE))\nSELECT Dno, COUNT(Ssn) AS No_of_employees, AVG(Salary) AS Average_sal\nFROM   EMPLOYEE GROUP BY Dno;" },
  { label: "ℑ COUNT Ssn, AVERAGE Salary",
    note: tl("<strong>ℑ<sub>COUNT Ssn, AVERAGE Salary</sub>(EMPLOYEE)</strong>: gruplama özniteliği yoksa bütün ilişki tek bir grup olur ve sonuçta tek satır vardır.", "<strong>ℑ<sub>COUNT Ssn, AVERAGE Salary</sub>(EMPLOYEE)</strong>: with no grouping attribute the whole relation is one group and the result has a single row."),
    before: { sql: "SELECT Dno, Ssn, Salary FROM EMPLOYEE ORDER BY Dno, Ssn", caption: input("EMPLOYEE") },
    sql: "SELECT COUNT(Ssn) AS Count_ssn, AVG(Salary) AS Average_salary FROM EMPLOYEE", after,
    display: "-- ℑ COUNT Ssn, AVERAGE Salary (EMPLOYEE)\nSELECT COUNT(Ssn), AVG(Salary) FROM EMPLOYEE;" },
]));

// ---- recursive closure, two levels (Figure 8.11)
const SUP = "SELECT Ssn AS Ssn1, Super_ssn AS Ssn2 FROM EMPLOYEE";
const L1 = "SELECT Ssn FROM EMPLOYEE WHERE Super_ssn = '888665555'";
const L2 = `SELECT Ssn FROM EMPLOYEE WHERE Super_ssn IN (${L1})`;
$("#recursive").append(queryStepper([
  { label: tl("RESULT1: 1. seviye", "RESULT1: level 1"),
    note: tl("<strong>RESULT1</strong>: SUPERVISION'da Ssn2'si Borg (888665555) olan satırlar, yani Borg'un doğrudan astları: Wong ve Wallace.", "<strong>RESULT1</strong>: the rows of SUPERVISION whose Ssn2 is Borg (888665555), i.e. Borg's direct supervisees: Wong and Wallace."),
    before: { sql: `SELECT Ssn AS Ssn1, Super_ssn AS Ssn2, (Super_ssn = '888665555') AS keep FROM EMPLOYEE`, flag: "keep", flagNote: ["Borg'un doğrudan astı olmayan {n} satır (kırmızı)", "{n} rows that are not Borg's direct supervisees (red)"], caption: "SUPERVISION(Ssn1, Ssn2)" },
    sql: L1, after: "RESULT1(Ssn)", display: `-- RESULT1(Ssn) ← π Ssn1 (SUPERVISION ⋈ Ssn2=Ssn BORG_SSN)\n${L1};` },
  { label: tl("RESULT2: 2. seviye", "RESULT2: level 2"),
    note: tl("<strong>RESULT2</strong>: Ssn2'si RESULT1'de olan satırlar, yani Wong ile Wallace'ın astları. Üçüncü bir seviye olsaydı aynı işlemi bir kez daha yazmak gerekirdi; seviye sayısı bilinmiyorsa temel cebir bunu yapamaz.", "<strong>RESULT2</strong>: the rows whose Ssn2 is in RESULT1, i.e. the supervisees of Wong and Wallace. A third level would need the same operation written once more; if the number of levels is unknown, basic algebra cannot do it."),
    before: [{ sql: `SELECT Ssn AS Ssn1, Super_ssn AS Ssn2, (Super_ssn IN (${L1})) AS keep FROM EMPLOYEE`, flag: "keep", flagNote: ["Ssn2'si RESULT1'de olmayan {n} satır (kırmızı)", "{n} rows whose Ssn2 is not in RESULT1 (red)"], caption: "SUPERVISION(Ssn1, Ssn2)" }, { sql: L1, caption: "RESULT1" }],
    sql: L2, after: "RESULT2(Ssn)", display: `-- RESULT2(Ssn) ← π Ssn1 (SUPERVISION ⋈ Ssn2=Ssn RESULT1)\n${L2};` },
  { label: "RESULT ← RESULT2 ∪ RESULT1",
    note: tl("İki seviyenin birleşimi: Borg'un bütün astları (iki seviyeye kadar). SQL'de bunun genel hâli <code>WITH RECURSIVE</code>'dir.", "The union of the two levels: all of Borg's supervisees (up to two levels). In SQL the general form is <code>WITH RECURSIVE</code>."),
    before: [{ sql: L2, caption: "RESULT2" }, { sql: L1, caption: "RESULT1" }],
    sql: `${L2} UNION ${L1}`, after: "RESULT", display: `-- RESULT ← RESULT2 ∪ RESULT1\n${L2}\nUNION\n${L1};` },
]));

// ---- LEFT OUTER JOIN (Figure 8.12)
$("#outer-join").append(queryStepper([
  { label: "EMPLOYEE ⟕ Ssn=Mgr_ssn DEPARTMENT", pad: true,
    note: tl("Soldaki EMPLOYEE'nin her satırı kalır. Departman yöneten üç çalışan (Wong, Wallace, Borg) departmanlarıyla eşleşir; diğer beşinin Dname'i NULL olur (sarı). İç join olsaydı bu beş satır kaybolurdu.", "Every row of EMPLOYEE on the left stays. The three employees who manage a department (Wong, Wallace, Borg) are matched with it; the other five get NULL as Dname (yellow). With an inner join these five rows would be lost."),
    before: [{ sql: "SELECT Fname, Minit, Lname, Ssn, EXISTS (SELECT 1 FROM DEPARTMENT D WHERE D.Mgr_ssn = E.Ssn) AS keep FROM EMPLOYEE E", flag: "keep", flagStyle: "keep", flagNote: ["eşi olmayan {n} satır (sarı) NULL ile kalır", "the {n} rows without a partner (yellow) stay, with NULLs"], caption: "EMPLOYEE" },
      { sql: "SELECT Dname, Mgr_ssn FROM DEPARTMENT", caption: "DEPARTMENT" }],
    sql: "SELECT E.Fname, E.Minit, E.Lname, D.Dname FROM EMPLOYEE E LEFT OUTER JOIN DEPARTMENT D ON E.Ssn = D.Mgr_ssn", after: "RESULT",
    display: "-- RESULT ← π Fname, Minit, Lname, Dname (EMPLOYEE ⟕ Ssn=Mgr_ssn DEPARTMENT)\nSELECT E.Fname, E.Minit, E.Lname, D.Dname\nFROM   EMPLOYEE E LEFT OUTER JOIN DEPARTMENT D ON E.Ssn = D.Mgr_ssn;" },
]));

// ---- example queries Q1 and Q6, step by step
$("#q1").append(queryStepper([
  { label: "RESEARCH_DEPT",
    note: tl("<strong>RESEARCH_DEPT ← σ<sub>Dname='Research'</sub>(DEPARTMENT)</strong>", "<strong>RESEARCH_DEPT ← σ<sub>Dname='Research'</sub>(DEPARTMENT)</strong>"),
    before: { sql: "SELECT Dname, Dnumber, Mgr_ssn, (Dname = 'Research') AS keep FROM DEPARTMENT", flag: "keep", flagNote: DROP, caption: input("DEPARTMENT") },
    sql: "SELECT Dname, Dnumber, Mgr_ssn FROM DEPARTMENT WHERE Dname = 'Research'", after: "RESEARCH_DEPT", showSql: false },
  { label: "RESEARCH_EMPS", group: "Dnumber", groupBorders: false,
    note: tl("<strong>RESEARCH_EMPS ← (RESEARCH_DEPT ⋈<sub>Dnumber=Dno</sub> EMPLOYEE)</strong>: Research'ün numarası 5'tir; Dno'su 5 olan dört çalışan eşleşir.", "<strong>RESEARCH_EMPS ← (RESEARCH_DEPT ⋈<sub>Dnumber=Dno</sub> EMPLOYEE)</strong>: Research's number is 5; the four employees with Dno 5 match."),
    before: [{ sql: "SELECT Dname, Dnumber FROM DEPARTMENT WHERE Dname = 'Research'", group: "Dnumber", groupBorders: false, caption: "RESEARCH_DEPT" },
      { sql: "SELECT Fname, Lname, Address, Dno AS Dnumber, (Dno = 5) AS keep FROM EMPLOYEE", flag: "keep", group: "Dnumber", groupBorders: false, flagNote: ["eşi olmayan {n} satır (kırmızı) sonuca girmez", "the {n} rows without a partner (red) do not reach the result"], caption: tl("EMPLOYEE (Dno sütunu Dnumber renginde)", "EMPLOYEE (the Dno column in the colour of Dnumber)") }],
    sql: "SELECT D.Dname, D.Dnumber, E.Fname, E.Lname, E.Address, E.Dno FROM DEPARTMENT D JOIN EMPLOYEE E ON D.Dnumber = E.Dno WHERE D.Dname = 'Research'", after: "RESEARCH_EMPS", showSql: false },
  { label: "RESULT",
    note: tl("<strong>RESULT ← π<sub>Fname, Lname, Address</sub>(RESEARCH_EMPS)</strong>", "<strong>RESULT ← π<sub>Fname, Lname, Address</sub>(RESEARCH_EMPS)</strong>"),
    before: { sql: "SELECT D.Dname, D.Dnumber, E.Fname, E.Lname, E.Address, E.Dno FROM DEPARTMENT D JOIN EMPLOYEE E ON D.Dnumber = E.Dno WHERE D.Dname = 'Research'", caption: "RESEARCH_EMPS" },
    sql: "SELECT DISTINCT E.Fname, E.Lname, E.Address FROM DEPARTMENT D JOIN EMPLOYEE E ON D.Dnumber = E.Dno WHERE D.Dname = 'Research'", after: "RESULT",
    display: "-- the whole query in SQL\nSELECT Fname, Lname, Address\nFROM   DEPARTMENT JOIN EMPLOYEE ON Dnumber = Dno\nWHERE  Dname = 'Research';" },
]));
$("#q6").append(queryStepper([
  { label: "ALL_EMPS − EMPS_WITH_DEPS",
    note: tl("<strong>EMPS_WITHOUT_DEPS ← ALL_EMPS − EMPS_WITH_DEPS</strong>: bağımlısı olan üç çalışanın Ssn'i (kırmızı) bütün Ssn'lerden çıkarılır; beş Ssn kalır.", "<strong>EMPS_WITHOUT_DEPS ← ALL_EMPS − EMPS_WITH_DEPS</strong>: the Ssns of the three employees with dependents (red) are removed from all the Ssns; five Ssns remain."),
    before: [{ sql: "SELECT Ssn, Ssn NOT IN (SELECT Essn FROM DEPENDENT) AS keep FROM EMPLOYEE", flag: "keep", flagNote: ["EMPS_WITH_DEPS'te de bulunan {n} satır (kırmızı) çıkarılır", "the {n} rows also in EMPS_WITH_DEPS (red) are removed"], caption: "ALL_EMPS = π Ssn (EMPLOYEE)" },
      { sql: "SELECT DISTINCT Essn AS Ssn FROM DEPENDENT", caption: "EMPS_WITH_DEPS(Ssn) = π Essn (DEPENDENT)" }],
    sql: "SELECT Ssn FROM EMPLOYEE EXCEPT SELECT Essn FROM DEPENDENT", after: "EMPS_WITHOUT_DEPS", showSql: false },
  { label: "RESULT ← π (… * EMPLOYEE)",
    note: tl("<strong>RESULT ← π<sub>Lname, Fname</sub>(EMPS_WITHOUT_DEPS * EMPLOYEE)</strong>: kalan Ssn'ler EMPLOYEE ile ortak sütunları Ssn üzerinden natural join yapar ve adlar alınır.", "<strong>RESULT ← π<sub>Lname, Fname</sub>(EMPS_WITHOUT_DEPS * EMPLOYEE)</strong>: the remaining Ssns are natural-joined with EMPLOYEE on their common column Ssn and the names are taken."),
    before: [{ sql: "SELECT Ssn FROM EMPLOYEE EXCEPT SELECT Essn FROM DEPENDENT", caption: "EMPS_WITHOUT_DEPS" }, { sql: "SELECT Ssn, Fname, Lname FROM EMPLOYEE", caption: "EMPLOYEE" }],
    sql: "SELECT Lname, Fname FROM EMPLOYEE WHERE Ssn IN (SELECT Ssn FROM EMPLOYEE EXCEPT SELECT Essn FROM DEPENDENT)", after: "RESULT",
    display: "-- the whole query in SQL\nSELECT Lname, Fname FROM EMPLOYEE\nWHERE  Ssn IN (SELECT Ssn FROM EMPLOYEE EXCEPT SELECT Essn FROM DEPENDENT);" },
]));

// ---- the query tree of Q2: click a node to see its intermediate result
const P = "SELECT * FROM PROJECT WHERE Plocation = 'Stafford'";
const PD = `SELECT P.*, D.* FROM PROJECT P JOIN DEPARTMENT D ON P.Dnum = D.Dnumber WHERE P.Plocation = 'Stafford'`;
const PDE = `SELECT P.Pnumber, P.Pname, P.Plocation, P.Dnum, D.Dname, D.Mgr_ssn, E.Ssn, E.Lname, E.Address, E.Bdate FROM PROJECT P JOIN DEPARTMENT D ON P.Dnum = D.Dnumber JOIN EMPLOYEE E ON D.Mgr_ssn = E.Ssn WHERE P.Plocation = 'Stafford'`;
const TREE = {
  label: "π Pnumber, Dnum, Lname, Address, Bdate", sql: "SELECT DISTINCT P.Pnumber, P.Dnum, E.Lname, E.Address, E.Bdate FROM PROJECT P JOIN DEPARTMENT D ON P.Dnum = D.Dnumber JOIN EMPLOYEE E ON D.Mgr_ssn = E.Ssn WHERE P.Plocation = 'Stafford'",
  kids: [{ label: "⋈ Mgr_ssn=Ssn", sql: PDE, kids: [
    { label: "⋈ Dnum=Dnumber", sql: PD, kids: [
      { label: "σ Plocation='Stafford'", sql: P, kids: [{ label: "PROJECT", sql: "SELECT * FROM PROJECT", leaf: true }] },
      { label: "DEPARTMENT", sql: "SELECT * FROM DEPARTMENT", leaf: true }] },
    { label: "EMPLOYEE", sql: "SELECT Fname, Lname, Ssn, Address, Bdate, Dno FROM EMPLOYEE", leaf: true }] }],
};
{
  const out = h("div", { "aria-live": "polite" });
  const buttons = [];
  const node = (n, depth) => {
    const b = h("button", { type: "button", class: `qt-node${n.leaf ? " leaf" : ""}` }, n.label);
    buttons.push(b);
    b.addEventListener("click", async () => {
      for (const x of buttons) x.setAttribute("aria-pressed", String(x === b));
      out.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), tl("MySQL çalışıyor …", "MySQL is running …")));
      const r = await runSQL(n.sql);
      if (r.error?.startup) { out.replaceChildren(startError(r.items[0].message)); return; }
      if (r.error) { out.replaceChildren(h("div", { class: "res-msg error" }, r.error.message)); return; }
      out.replaceChildren(h("div", { class: "res-caption" }, `${n.label} · ${tl(`${r.last.rows.length} satır`, `${r.last.rows.length} rows`)}`), relationTable(r.last.cols, r.last.types, r.last.rows));
    });
    return h("li", {}, b, n.kids ? h("ul", {}, ...n.kids.map((k) => node(k, depth + 1))) : null);
  };
  $("#query-tree").append(h("div", { class: "qtree" }, h("ul", {}, node(TREE, 0))),
    h("p", { class: "small muted" }, tl("Yapraklar temel ilişkilerdir (açık renk); iç düğümler işlemlerdir. Bir düğümün sonucu, çocuklarının sonuçlarından hesaplanır.", "The leaves are base relations (light); the inner nodes are operations. A node's result is computed from the results of its children.")), out);
}
