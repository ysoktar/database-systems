import { enhanceCallouts } from "../layout.js";
import { h, $, button, highlightSQL } from "../lib/ui.js";
import { createEditor, b64decode } from "../lib/ereditor.js";
import { ER_EXAMPLES, exampleById } from "../lib/er-examples.js";
import { ER_EXERCISES, solutionModel } from "../lib/er-exercises.js";
import { solutionDetails, renderCheck, loadInto } from "../lib/er-inline.js";
import { renderMapping } from "../lib/ermapview.js";
import { toDDL, mapER } from "../lib/ermap.js";
import { reverseER, catalogSQL, catalogFromRows } from "../lib/erreverse.js";
import { toDSL, emptyModel } from "../lib/ermodel.js";
import { SCHEMA_SQL } from "../lib/company.js";
import { runSQL } from "../lib/db.js";
import { startError } from "../lib/sqlbox.js";
import { erFigure } from "../lib/erd.js";
import { autoLayout, toDiagram } from "../lib/erlayout.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

// ---- what to open: #example=…, #exercise=…, #dsl=… (share link); otherwise the saved work or COMPANY
const params = new URLSearchParams(location.hash.slice(1));
let initial = null, initialLayout = null;
if (params.get("dsl")) { try { initial = b64decode(params.get("dsl")); } catch { /* broken link */ } }
else if (params.get("example") && exampleById(params.get("example"))) ({ dsl: initial, layout: initialLayout } = exampleById(params.get("example")));
let hasSaved = false;
try { hasSaved = !!localStorage.getItem("er-studio"); } catch { /* storage unavailable */ }
if (!initial && !hasSaved && !params.get("exercise")) ({ dsl: initial, layout: initialLayout } = exampleById("company"));

let mapTimer = 0;
const editor = createEditor($("#studio"), {
  dsl: initial, positions: initialLayout, storageKey: "er-studio",
  onChange: () => { clearTimeout(mapTimer); mapTimer = setTimeout(updateMapping, 300); },
});

// ---- example buttons
const ex = $("#examples");
ex.append(h("span", { class: "small muted", style: { alignSelf: "center" } }, tl("Örnekler:", "Examples:")));
for (const e of ER_EXAMPLES) {
  ex.append(button(`${tx(e, "title")} · ${e.kind}`, () => {
    if (!confirm(tl(`"${e.title}" yüklensin mi? Şu anki diyagramın yerini alır (Geri al ile dönebilirsiniz).`, `Load "${tx(e, "title")}"? It replaces the current diagram (Undo brings it back).`))) return;
    editor.setDSL(e.dsl, { positions: e.layout || null });
    history.replaceState(null, "", `#example=${e.id}`);
  }, { title: `${tx(e, "desc")} (${tx(e, "source")})` }));
}
ex.append(button(tl("Boş diyagram", "Empty diagram"), () => { if (confirm(tl("Diyagram temizlensin mi?", "Clear the diagram?"))) editor.setModel(emptyModel()); }));

// ---- ER → tables
const specSel = $("#spec-opt");
specSel.addEventListener("change", updateMapping);
function updateMapping() {
  const model = editor.getModel();
  if (!model.entities.length) { $("#mapping").replaceChildren(h("p", { class: "muted" }, tl("Diyagram boş.", "The diagram is empty."))); return; }
  renderMapping($("#mapping"), model, { spec: specSel.value, schemaName: "er_studio" });
}
updateMapping();

// ---- tables → ER
// MySQL ignores REFERENCES written inside a column definition: foreign keys are written as table constraints
const SAMPLE_DDL = `CREATE TABLE TEACHER (
  Tid    INT PRIMARY KEY,
  Name   VARCHAR(30) NOT NULL,
  Email  VARCHAR(40) UNIQUE
);
CREATE TABLE CLASS (
  Code     VARCHAR(10) PRIMARY KEY,
  Title    VARCHAR(40),
  Teacher  INT NOT NULL,
  FOREIGN KEY (Teacher) REFERENCES TEACHER(Tid)
);
CREATE TABLE PUPIL (
  Pno   INT PRIMARY KEY,
  Name  VARCHAR(30),
  Buddy INT,
  FOREIGN KEY (Buddy) REFERENCES PUPIL(Pno)
);
CREATE TABLE ATTENDS (
  Pno   INT,
  Code  VARCHAR(10),
  Grade DECIMAL(4,2),
  PRIMARY KEY (Pno, Code),
  FOREIGN KEY (Pno) REFERENCES PUPIL(Pno),
  FOREIGN KEY (Code) REFERENCES CLASS(Code)
);
CREATE TABLE PUPIL_PHONE (
  Pno   INT,
  Phone VARCHAR(15),
  PRIMARY KEY (Pno, Phone),
  FOREIGN KEY (Pno) REFERENCES PUPIL(Pno)
);
CREATE TABLE HOMEWORK (
  Code  VARCHAR(10),
  Hw_no INT,
  Due   DATE,
  PRIMARY KEY (Code, Hw_no),
  FOREIGN KEY (Code) REFERENCES CLASS(Code) ON DELETE CASCADE
);
`;
const ddlBox = h("textarea", { rows: 14, spellcheck: "false", style: { width: "100%", fontFamily: "var(--mono)", fontSize: "0.82rem" }, "aria-label": tl("CREATE TABLE komutları", "CREATE TABLE statements") });
ddlBox.value = SAMPLE_DDL;
const revOut = h("div");
const revBtn = button(tl("ER'e dönüştür", "Turn into ER"), reverse, { kind: "primary" });
$("#reverse").append(ddlBox, h("div", { class: "btn-row" }, revBtn), revOut);
$("#load-company-ddl").addEventListener("click", () => { ddlBox.value = SCHEMA_SQL.trim() + "\n"; reverse(); });
$("#load-diagram-ddl").addEventListener("click", () => { ddlBox.value = toDDL(mapER(editor.getModel(), { spec: specSel.value }).tables); reverse(); });
$("#load-sample-ddl").addEventListener("click", () => { ddlBox.value = SAMPLE_DDL; reverse(); });

let revCount = 0;
async function reverse() {
  revOut.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), tl("Tablolar MySQL'de oluşturuluyor …", "Creating the tables in MySQL …")));
  const schema = `rev_${++revCount}`;
  const created = await runSQL(`DROP DATABASE IF EXISTS ${schema};\nCREATE DATABASE ${schema};\nUSE ${schema};\n${ddlBox.value}`);
  if (created.error?.startup) { revOut.replaceChildren(startError(created.items[0].message)); return; }
  if (created.error) {
    revOut.replaceChildren(h("div", { class: "res-msg error" }, `${tl("MySQL hatası", "MySQL error")} ${created.error.code}: ${created.error.message}${created.error.index > 3 ? ` (${tl("komut", "statement")} ${created.error.index - 3})` : ""}`));
    return;
  }
  const [qCols, qCons] = catalogSQL(schema);
  const cols = (await runSQL(qCols)).last?.rows || [];
  const cons = (await runSQL(qCons)).last?.rows || [];
  const { model, steps, notes } = reverseER(catalogFromRows(cols, cons));
  // a column-level REFERENCES is accepted by MySQL but creates no foreign key
  const inline = ddlBox.value.split("\n").filter((l) => /\bREFERENCES\b/i.test(l) && !/FOREIGN\s+KEY/i.test(l) && !/^\s*(ON|--)/i.test(l));
  if (inline.length) notes.unshift(tl(`MySQL, sütun tanımının içine yazılan <code>REFERENCES</code>'ı kabul eder ama <strong>yok sayar</strong>: foreign key oluşmaz. ${inline.length} satırda böyle bir tanım var (ör. <code>${inline[0].trim().replace(/</g, "&lt;")}</code>). Foreign key için tablo kısıtı yazın: <code>FOREIGN KEY (sütun) REFERENCES T(sütun)</code>.`, `MySQL accepts a <code>REFERENCES</code> written inside a column definition but <strong>ignores</strong> it: no foreign key is created. ${inline.length} line(s) have such a definition (e.g. <code>${inline[0].trim().replace(/</g, "&lt;")}</code>). For a foreign key write a table constraint: <code>FOREIGN KEY (column) REFERENCES T(column)</code>.`));
  if (!model.entities.length) { revOut.replaceChildren(h("div", { class: "res-msg warn" }, tl("Hiç tablo bulunamadı.", "No tables found."))); return; }
  const pos = autoLayout(model);
  const spec = toDiagram(model, pos, {});
  const fig = erFigure({ ...spec, title: tl("Tablolardan çıkarılan ER diyagramı", "The ER diagram derived from the tables") }, tl("Tablolardan çıkarılan ER diyagramı (otomatik yerleşim). Düzenlemek için editöre aktarın.", "The ER diagram derived from the tables (automatic layout). Load it into the editor to edit it."));
  const dslPre = h("pre", { class: "sql" });
  dslPre.innerHTML = `<code>${highlightSQL(toDSL(model))}</code>`;
  revOut.replaceChildren(
    h("h3", {}, tl("Çıkarım adımları", "Derivation steps")),
    h("ol", { class: "map-steps" }, ...steps.map((s) => h("li", { html: s.html }))),
    h("div", { class: "callout gotcha", html: `<div class="callout-label"><span>${tl("Geri kazanılamayan bilgi", "What cannot be recovered")}</span></div><ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` }),
    fig,
    h("div", { class: "btn-row" }, button(tl("Editöre aktar", "Load into the editor"), () => {
      if (!confirm(tl("Çıkarılan diyagram editöre yüklensin mi? (Geri al ile dönebilirsiniz.)", "Load the derived diagram into the editor? (Undo brings the old one back.)"))) return;
      editor.setModel(model);
      $("#editor").scrollIntoView({ behavior: "smooth" });
    }, { kind: "primary" })),
    h("details", { class: "disclosure" }, h("summary", {}, tl("Metin hâli", "As text")), h("div", { class: "disclosure-body" }, dslPre)));
}

// ---- exercises: requirements, a check, and the solution right under each one (collapsible)
const exHost = $("#exercise-list");
const panelHost = $("#active-exercise");

const solutionBlock = (x) => solutionDetails(x, (m, layout) => loadInto(editor, m, layout));
const checkInto = (x, out) => renderCheck(out, editor.getModel(), solutionModel(x, ER_EXAMPLES));

/** The exercise being solved stays above the editor: requirements, check and solution without scrolling away. */
function openPanel(x, { clear = true } = {}) {
  if (clear && editor.getModel().entities.length && !confirm(tl(`"${x.title}" için editör temizlensin mi? (Geri al ile dönebilirsiniz.)`, `Clear the editor for "${tx(x, "title")}"? (Undo brings it back.)`))) return;
  if (clear) editor.setModel(emptyModel());
  const result = h("div");
  panelHost.replaceChildren(h("div", { class: "exercise-panel" },
    h("div", { class: "exercise-panel-head" }, h("strong", {}, `${tl("Alıştırma", "Exercise")}: ${tx(x, "title")}`),
      h("div", { class: "btn-row", style: { margin: 0 } },
        button(tl("Kontrol et", "Check"), () => checkInto(x, result), { kind: "primary" }),
        button(tl("Kapat", "Close"), () => { panelHost.replaceChildren(); history.replaceState(null, "", location.pathname); }))),
    h("details", { class: "disclosure", open: true }, h("summary", {}, tl("Gereksinimler", "Requirements")), h("div", { class: "disclosure-body" },
      h("div", { html: tx(x, "text") }), h("p", { class: "small", html: `<strong>${tl("Kullanılacak adlar", "Names to use")}:</strong> ${tx(x, "names")}` }))),
    result,
    solutionBlock(x)));
  history.replaceState(null, "", `#exercise=${x.id}`);
  panelHost.scrollIntoView({ behavior: "smooth", block: "start" });
}

for (const x of ER_EXERCISES) {
  const result = h("div");
  exHost.append(h("section", { class: "exercise", id: `exercise-${x.id}` },
    h("h3", { "data-toc": tx(x, "title") }, tx(x, "title"), h("span", { class: "stars" }, "★".repeat(x.level) + "☆".repeat(3 - x.level))),
    h("div", { html: tx(x, "text") }),
    h("p", { class: "small", html: `<strong>${tl("Kullanılacak adlar", "Names to use")}:</strong> ${tx(x, "names")}` }),
    h("div", { class: "btn-row" },
      button(tl("Editörde çöz", "Solve in the editor"), () => openPanel(x), { kind: "primary", title: tl("Editörü temizler; gereksinimler ve Kontrol et editörün üstünde kalır", "Clears the editor; the requirements and Check stay above it") }),
      button(tl("Kontrol et", "Check"), () => checkInto(x, result), { title: tl("Editördeki diyagramı bu alıştırmanın çözümüyle karşılaştır", "Compare the diagram in the editor with this exercise's solution") })),
    result,
    solutionBlock(x)));
}

if (params.get("section") && document.getElementById(params.get("section"))) setTimeout(() => document.getElementById(params.get("section")).scrollIntoView(), 400);
if (params.get("exercise")) {
  const x = ER_EXERCISES.find((e) => e.id === params.get("exercise"));
  if (x) setTimeout(() => openPanel(x, { clear: false }), 300);
}

enhanceCallouts(document.querySelector(".content"));
