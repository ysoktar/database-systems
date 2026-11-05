// The COMPANY relational schema as cards (Figure 5.7 of the book): primary keys underlined, foreign keys in blue.
import { h } from "./ui.js";

export const COMPANY_SCHEMA = [
  { t: "EMPLOYEE", cols: [["Fname"], ["Minit"], ["Lname"], ["Ssn", "pk"], ["Bdate"], ["Address"], ["Sex"], ["Salary"], ["Super_ssn", "fk", "EMPLOYEE.Ssn"], ["Dno", "fk", "DEPARTMENT.Dnumber"]] },
  { t: "DEPARTMENT", cols: [["Dname"], ["Dnumber", "pk"], ["Mgr_ssn", "fk", "EMPLOYEE.Ssn"], ["Mgr_start_date"]] },
  { t: "DEPT_LOCATIONS", cols: [["Dnumber", "pk fk", "DEPARTMENT.Dnumber"], ["Dlocation", "pk"]] },
  { t: "PROJECT", cols: [["Pname"], ["Pnumber", "pk"], ["Plocation"], ["Dnum", "fk", "DEPARTMENT.Dnumber"]] },
  { t: "WORKS_ON", cols: [["Essn", "pk fk", "EMPLOYEE.Ssn"], ["Pno", "pk fk", "PROJECT.Pnumber"], ["Hours"]] },
  { t: "DEPENDENT", cols: [["Essn", "pk fk", "EMPLOYEE.Ssn"], ["Dependent_name", "pk"], ["Sex"], ["Bdate"], ["Relationship"]] },
];

export function schemaCards() {
  const grid = h("div", { class: "schema-grid" });
  for (const { t, cols } of COMPANY_SCHEMA) {
    const line = h("div", { class: "cols" });
    cols.forEach(([c, k = "", ref], i) => {
      if (i) line.append(", ");
      line.append(h("span", { class: k, title: ref ? `→ ${ref}` : k.includes("pk") ? "primary key" : null }, c));
    });
    grid.append(h("div", { class: "schema-card" }, h("h4", {}, t), line));
  }
  return grid;
}
