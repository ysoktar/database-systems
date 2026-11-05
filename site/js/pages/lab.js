import "../layout.js";
import { h, $, button } from "../lib/ui.js";
import { createSqlBox, engineBadge } from "../lib/sqlbox.js";
import { describe, onState, state, getDB } from "../lib/db.js";

const EXAMPLES = [
  ["Tüm çalışanlar", "SELECT * FROM EMPLOYEE;"],
  ["Departman başına ortalama maaş", "SELECT D.Dname, COUNT(*) AS n, ROUND(AVG(E.Salary), 2) AS avg_salary\nFROM   EMPLOYEE E JOIN DEPARTMENT D ON E.Dno = D.Dnumber\nGROUP BY D.Dname\nORDER BY avg_salary DESC;"],
  ["Projeler ve kontrol eden departman", "SELECT P.Pname, P.Plocation, D.Dname\nFROM   PROJECT P JOIN DEPARTMENT D ON P.Dnum = D.Dnumber\nORDER BY D.Dname, P.Pname;"],
  ["Amir zinciri (recursive)", "-- MySQL concatenates with CONCAT (|| means OR)\nWITH RECURSIVE CHAIN (Ssn, Lname, Path) AS (\n  SELECT Ssn, Lname, CAST(Lname AS CHAR(200)) FROM EMPLOYEE WHERE Super_ssn IS NULL\n  UNION ALL\n  SELECT E.Ssn, E.Lname, CONCAT(C.Path, ' > ', E.Lname)\n  FROM   EMPLOYEE E JOIN CHAIN C ON E.Super_ssn = C.Ssn\n)\nSELECT Path FROM CHAIN ORDER BY Path;"],
  ["Transaction: START TRANSACTION … ROLLBACK", "START TRANSACTION;\nUPDATE EMPLOYEE SET Salary = Salary * 2;\nSELECT Lname, Salary FROM EMPLOYEE ORDER BY Salary DESC LIMIT 3;\nROLLBACK;\nSELECT Lname, Salary FROM EMPLOYEE ORDER BY Salary DESC LIMIT 3;"],
  ["Kısıtları listele", "SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE\nFROM   information_schema.TABLE_CONSTRAINTS\nWHERE  TABLE_SCHEMA = 'company'\nORDER BY TABLE_NAME, CONSTRAINT_TYPE;"],
  ["Bir tablonun tanımı", "SHOW CREATE TABLE EMPLOYEE;"],
  ["Sorgu planı (EXPLAIN)", "EXPLAIN FORMAT=TREE SELECT E.Lname, P.Pname\nFROM   EMPLOYEE E JOIN WORKS_ON W ON E.Ssn = W.Essn JOIN PROJECT P ON W.Pno = P.Pnumber;"],

];

const box = createSqlBox({
  title: "SQL konsolu <span class=\"muted\">· COMPANY</span>",
  code: "SELECT Fname, Lname, Salary, Dno\nFROM   EMPLOYEE\nWHERE  Salary > 30000\nORDER BY Salary DESC;",
  saveKey: "sql:lab:console",
  rows: 8,
  onResult: () => refreshSchema(),
});
$("#console").append(box);

const ex = h("div", { class: "btn-row" });
for (const [label, sql] of EXAMPLES) ex.append(button(label, () => { box.setCode(sql); box.textarea.focus(); box.run(); }));
$("#examples").append(ex);

// ---- schema browser: the live catalog (it changes when you CREATE / ALTER / DROP)
const schemaHost = $("#browser");
let busy = false;
async function refreshSchema() {
  if (busy || state !== "ready") return;
  busy = true;
  try {
    const tables = await describe();
    const grid = h("div", { class: "schema-grid" });
    for (const [t, cols] of tables) {
      const peek = button("göster", () => { box.setCode(`SELECT * FROM ${t.toUpperCase()};`); box.run(); });
      grid.append(h("div", { class: "schema-card" },
        h("h4", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, t.toUpperCase(), peek),
        h("div", { class: "cols" }, ...cols.map((c, i) => h("span", {}, i ? ", " : "", h("span", { class: [c.pk ? "pk" : "", c.fk ? "fk" : ""].join(" ") }, c.name), h("span", { class: "muted" }, ` ${c.type}${c.nullable ? "" : " NOT NULL"}`))))));
    }
    schemaHost.replaceChildren(grid);
  } finally { busy = false; }
}
schemaHost.append(h("p", { class: "small muted" }, "Şema, MySQL ilk kez çalıştırıldığında (bir sorgu çalıştırın ya da aşağıdaki düğmeye basın) katalogdan okunur."),
  button("Şemayı yükle", () => getDB().then(refreshSchema), { kind: "primary" }));
onState((s) => { if (s === "ready") refreshSchema(); });
$("#engine").append(engineBadge());
