import "../layout.js";
import { h, $, $$, button } from "../lib/ui.js";
import { schemaCards, COMPANY_SCHEMA } from "../lib/schema.js";
import { runSQL } from "../lib/db.js";
import { relationTable } from "../lib/sqlbox.js";

$("#schema").append(schemaCards());

// ---- superkey checker: does the current state contain two tuples that agree on the chosen attributes?
const host = $("#superkey");
const tableSel = h("select", { "aria-label": "Tablo" }, ...COMPANY_SCHEMA.map((t) => h("option", { value: t.t }, t.t)));
const colsBox = h("div", { class: "bank-topics" });
const out = h("div", { class: "sqlbox-out" });
const paintCols = () => {
  const t = COMPANY_SCHEMA.find((x) => x.t === tableSel.value);
  colsBox.replaceChildren(...t.cols.map(([c]) => {
    const input = h("input", { type: "checkbox", value: c });
    return h("label", {}, input, c);
  }));
  out.replaceChildren();
};
tableSel.addEventListener("change", paintCols);

async function dupes(table, cols) {
  const list = cols.join(", ");
  const { last, error } = await runSQL(`SELECT ${list}, COUNT(*) AS tuples FROM ${table} GROUP BY ${list} HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC`);
  if (error) throw new Error(error.message);
  return last;
}

async function check() {
  const cols = $$("input:checked", colsBox).map((i) => i.value);
  const table = tableSel.value;
  if (!cols.length) { out.replaceChildren(h("div", { class: "res-msg warn" }, "En az bir sütun seçin.")); return; }
  out.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "Kontrol ediliyor …"));
  try {
    const d = await dupes(table, cols);
    out.replaceChildren();
    if (d.rows.length) {
      out.append(h("div", { class: "res-msg error" }, `{${cols.join(", ")}} bir superkey DEĞİL: aşağıdaki değerler birden çok tuple'da tekrar ediyor.`));
      out.append(relationTable(d.cols, d.types, d.rows));
      return;
    }
    // minimality on this state: removing any one attribute must create a duplicate
    const removable = [];
    if (cols.length > 1) {
      for (const c of cols) {
        const rest = cols.filter((x) => x !== c);
        if (!(await dupes(table, rest)).rows.length) removable.push(c);
      }
    }
    out.append(h("div", { class: "res-msg ok" }, `Bu durumda {${cols.join(", ")}} üzerinde tekrar yok: superkey olabilir.`));
    if (removable.length) out.append(h("div", { class: "res-msg warn" }, `Minimal değil: ${removable.join(", ")} çıkarılınca da tekrar oluşmuyor, yani bu veride daha küçük bir superkey var. Key olamaz.`));
    else out.append(h("div", { class: "res-msg status" }, cols.length > 1 ? "Bu veride hiçbir sütun çıkarılamıyor (minimal görünüyor)." : "Tek sütun: minimallik kendiliğinden sağlanıyor."));
    const pk = COMPANY_SCHEMA.find((x) => x.t === table).cols.filter((c) => (c[1] || "").includes("pk")).map((c) => c[0]);
    const same = pk.length === cols.length && pk.every((c) => cols.includes(c));
    out.append(h("div", { class: "res-msg status" }, same
      ? `Bu, şemada tanımlı primary key: {${pk.join(", ")}}. DBMS bunu her durumda zorlar.`
      : `Ama şemanın primary key'i {${pk.join(", ")}}. Bugünkü veride tekrar olmaması, seçtiğiniz kümenin her zaman benzersiz kalacağını göstermez: anahtar, anlamdan (gereksinimlerden) gelen bir kısıttır.`));
  } catch (e) {
    out.replaceChildren(h("div", { class: "res-msg error" }, String(e.message || e)));
  }
}

host.append(h("div", { class: "stepper" },
  h("div", { class: "btn-row", style: { alignItems: "center" } }, h("label", { class: "small" }, "Tablo: ", tableSel), button("Kontrol et", check, { kind: "primary" })),
  colsBox, out));
paintCols();
