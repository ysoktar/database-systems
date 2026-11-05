// DOM views for the mapping: the explained step list with the resulting tables, the DDL, and a button that creates
// the tables in the page's MySQL (in a database of their own) so they can be queried right away.
import { h, highlightSQL, button } from "./ui.js";
import { mapER, toDDL, ident } from "./ermap.js";
import { runSQL } from "./db.js";
import { renderItems, createSqlBox } from "./sqlbox.js";

/** One table as a schema card: PK underlined, FKs in blue with their target. */
export function tableCard(t, { highlight = [] } = {}) {
  const fkCols = new Map();
  for (const f of t.fks) f.cols.forEach((c, i) => fkCols.set(c, `${f.ref}.${f.refCols[i]}`));
  const uniq = new Set(t.uniques.flat());
  const cols = h("div", { class: "cols" });
  t.cols.forEach((c, i) => {
    if (i) cols.append(", ");
    const cls = [t.pk.includes(c.name) ? "pk" : "", fkCols.has(c.name) ? "fk" : ""].join(" ").trim();
    cols.append(h("span", { class: cls || null, style: highlight.includes(c.name) ? { background: "var(--accent-wash)", borderRadius: "3px", padding: "0 2px" } : null, title: [fkCols.has(c.name) ? `→ ${fkCols.get(c.name)}` : "", uniq.has(c.name) ? "UNIQUE" : "", c.type].filter(Boolean).join(" · ") }, c.name));
  });
  const fkLines = t.fks.map((f) => h("div", { class: "small muted" }, `FK (${f.cols.join(", ")}) → ${f.ref}(${f.refCols.join(", ")})${f.onDelete ? ` ON DELETE ${f.onDelete}` : ""}`));
  const uq = t.uniques.map((u) => h("div", { class: "small muted" }, `UNIQUE (${u.join(", ")})`));
  return h("div", { class: "schema-card" }, h("h4", {}, t.name), cols, ...uq, ...fkLines);
}

let schemaCounter = 0;

/**
 * Render the mapping of `model` into `host`. options: { spec, showSteps, showDDL, runnable, schemaName }
 * Returns the mapping result.
 */
export function renderMapping(host, model, { spec = "8A", showSteps = true, showDDL = true, runnable = true, schemaName } = {}) {
  const res = mapER(model, { spec });
  const byName = new Map(res.tables.map((t) => [t.name, t]));
  const kids = [];
  if (showSteps) {
    const ol = h("ol", { class: "map-steps" });
    for (const s of res.steps) {
      const li = h("li", {}, h("div", { class: "step-title" }, s.title), h("div", { html: s.html }));
      if (s.snapshot) {
        const fresh = s.added.length === s.snapshot.cols.length;
        li.append(tableCard(s.snapshot, { highlight: fresh ? [] : s.added }));
        if (!fresh && s.added.length) li.append(h("div", { class: "small muted" }, `Bu adımda eklenen sütunlar vurgulandı: ${s.added.join(", ")}.`));
      }
      ol.append(li);
    }
    kids.push(ol);
  }
  if (res.notes.length) kids.push(h("div", { class: "callout note", html: `<div class="callout-label"><span>Notlar</span></div><ul>${res.notes.map((n) => `<li>${n}</li>`).join("")}</ul>` }));
  kids.push(h("h4", {}, `Sonuç: ${res.tables.length} tablo`), h("div", { class: "schema-grid" }, ...res.tables.map(tableCard)));
  if (showDDL) {
    const ddl = toDDL(res.tables);
    const pre = h("pre", { class: "sql" });
    pre.innerHTML = `<code>${highlightSQL(ddl)}</code>`;
    const details = h("details", { class: "disclosure" }, h("summary", {}, "DDL (CREATE TABLE)"), h("div", { class: "disclosure-body" }, pre));
    kids.push(details);
    if (runnable && res.tables.length) {
      const out = h("div", { class: "sqlbox-out" });
      const queryHost = h("div");
      const schema = schemaName || `er_${++schemaCounter}`;
      const run = button("Tabloları MySQL'de oluştur", async () => {
        out.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "MySQL çalışıyor …"));
        const r = await runSQL(`DROP DATABASE IF EXISTS ${schema};\nCREATE DATABASE ${schema};\nUSE ${schema};\n${ddl}`);
        out.replaceChildren();
        renderItems(out, r.items.filter((it) => it.kind !== "status" && it.kind !== "notice"));
        if (!r.error) {
          out.append(h("div", { class: "res-msg ok" }, `${res.tables.length} tablo "${schema}" veritabanında oluşturuldu. Aşağıdaki kutuda sorgulayabilir, satır ekleyerek kısıtları deneyebilirsiniz.`));
          const first = res.tables[0];
          queryHost.replaceChildren(createSqlBox({
            title: `Veritabanı ${schema}`, resetButton: false, database: schema,
            note: `Bu kutu COMPANY'de değil, az önce oluşturulan ${schema} veritabanında çalışır (tablolar boş).`,
            code: `-- the tables just created (they are empty: try an INSERT that violates a key or a foreign key)\nSHOW TABLES;\nSELECT * FROM ${ident(first.name)};`,
          }));
        }
      }, { kind: "primary" });
      kids.push(h("div", { class: "btn-row" }, run), out, queryHost);
    }
  }
  host.replaceChildren(...kids);
  return res;
}
