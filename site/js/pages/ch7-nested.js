import "../layout.js";
import { h, $, $$ } from "../lib/ui.js";

// Three-valued logic: AND / OR / NOT truth tables; click two values to see the result highlighted.
const V = ["TRUE", "FALSE", "UNKNOWN"];
const cls = { TRUE: "T", FALSE: "F", UNKNOWN: "U" };
const AND = (a, b) => (a === "FALSE" || b === "FALSE" ? "FALSE" : a === "TRUE" && b === "TRUE" ? "TRUE" : "UNKNOWN");
const OR = (a, b) => (a === "TRUE" || b === "TRUE" ? "TRUE" : a === "FALSE" && b === "FALSE" ? "FALSE" : "UNKNOWN");
const NOT = (a) => (a === "TRUE" ? "FALSE" : a === "FALSE" ? "TRUE" : "UNKNOWN");

const host = $("#tvl");
if (host) {
  let a = "TRUE", b = "UNKNOWN";
  const pickA = h("div", { class: "seg", role: "group", "aria-label": "A" });
  const pickB = h("div", { class: "seg", role: "group", "aria-label": "B" });
  const result = h("p", { class: "stepper-note" });
  const tables = h("div", { class: "two-col" });
  const table = (name, f) => {
    const t = h("table", { class: "truth" });
    t.append(h("tr", {}, h("th", {}, name), ...V.map((x) => h("th", {}, x))));
    for (const x of V) t.append(h("tr", {}, h("th", {}, x), ...V.map((y) => h("td", { class: cls[f(x, y)] + (x === a && y === b ? " hl" : "") }, f(x, y)))));
    return t;
  };
  const paint = () => {
    for (const [seg, val] of [[pickA, a], [pickB, b]]) for (const btn of $$("button", seg)) btn.setAttribute("aria-pressed", String(btn.textContent === val));
    const not = h("table", { class: "truth" }, h("tr", {}, h("th", {}, "NOT"), h("th", {}, "")),
      ...V.map((x) => h("tr", {}, h("th", {}, x), h("td", { class: cls[NOT(x)] + (x === a ? " hl" : "") }, NOT(x)))));
    tables.replaceChildren(table("AND", AND), table("OR", OR), not);
    result.innerHTML = `A AND B = <strong>${AND(a, b)}</strong> · A OR B = <strong>${OR(a, b)}</strong> · NOT A = <strong>${NOT(a)}</strong>. WHERE yalnızca <strong>TRUE</strong> olan satırları tutar: ${AND(a, b) === "TRUE" ? "A AND B koşullu satır seçilir" : "A AND B koşullu satır <em>seçilmez</em>"}.`;
  };
  for (const v of V) {
    pickA.append(h("button", { type: "button", onclick: () => { a = v; paint(); } }, v));
    pickB.append(h("button", { type: "button", onclick: () => { b = v; paint(); } }, v));
  }
  host.append(h("div", { class: "stepper" },
    h("div", { class: "btn-row", style: { alignItems: "center", gap: "14px" } }, h("span", { class: "small" }, "A ="), pickA, h("span", { class: "small" }, "B ="), pickB),
    result, tables));
  paint();
}
