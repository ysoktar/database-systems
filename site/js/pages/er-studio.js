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
import { erFigure } from "../lib/erd.js";
import { autoLayout, toDiagram } from "../lib/erlayout.js";

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
ex.append(h("span", { class: "small muted", style: { alignSelf: "center" } }, "Örnekler:"));
for (const e of ER_EXAMPLES) {
  ex.append(button(`${e.title} · ${e.kind}`, () => {
    if (!confirm(`"${e.title}" yüklensin mi? Şu anki diyagramın yerini alır (Geri al ile dönebilirsiniz).`)) return;
    editor.setDSL(e.dsl, { positions: e.layout || null });
    history.replaceState(null, "", `#example=${e.id}`);
  }, { title: `${e.desc} (${e.source})` }));
}
ex.append(button("Boş diyagram", () => { if (confirm("Diyagram temizlensin mi?")) editor.setModel(emptyModel()); }));

// ---- ER → tables
const specSel = $("#spec-opt");
specSel.addEventListener("change", updateMapping);
function updateMapping() {
  const model = editor.getModel();
  if (!model.entities.length) { $("#mapping").replaceChildren(h("p", { class: "muted" }, "Diyagram boş.")); return; }
  renderMapping($("#mapping"), model, { spec: specSel.value, schemaName: "er_studio" });
}
updateMapping();

// ---- tables → ER
const SAMPLE_DDL = `CREATE TABLE TEACHER (
  Tid    INT PRIMARY KEY,
  Name   VARCHAR(30) NOT NULL,
  Email  VARCHAR(40) UNIQUE
);
CREATE TABLE CLASS (
  Code     VARCHAR(10) PRIMARY KEY,
  Title    VARCHAR(40),
  Teacher  INT NOT NULL REFERENCES TEACHER(Tid)
);
CREATE TABLE PUPIL (
  Pno   INT PRIMARY KEY,
  Name  VARCHAR(30),
  Buddy INT REFERENCES PUPIL(Pno)
);
CREATE TABLE ATTENDS (
  Pno   INT REFERENCES PUPIL(Pno),
  Code  VARCHAR(10) REFERENCES CLASS(Code),
  Grade DECIMAL(4,2),
  PRIMARY KEY (Pno, Code)
);
CREATE TABLE PUPIL_PHONE (
  Pno   INT REFERENCES PUPIL(Pno),
  Phone VARCHAR(15),
  PRIMARY KEY (Pno, Phone)
);
CREATE TABLE HOMEWORK (
  Code  VARCHAR(10) REFERENCES CLASS(Code) ON DELETE CASCADE,
  Hw_no INT,
  Due   DATE,
  PRIMARY KEY (Code, Hw_no)
);
`;
const ddlBox = h("textarea", { rows: 14, spellcheck: "false", style: { width: "100%", fontFamily: "var(--mono)", fontSize: "0.82rem" }, "aria-label": "CREATE TABLE komutları" });
ddlBox.value = SAMPLE_DDL;
const revOut = h("div");
const revBtn = button("ER'e dönüştür", reverse, { kind: "primary" });
$("#reverse").append(ddlBox, h("div", { class: "btn-row" }, revBtn), revOut);
$("#load-company-ddl").addEventListener("click", () => { ddlBox.value = SCHEMA_SQL.trim() + "\n"; reverse(); });
$("#load-diagram-ddl").addEventListener("click", () => { ddlBox.value = toDDL(mapER(editor.getModel(), { spec: specSel.value }).tables); reverse(); });
$("#load-sample-ddl").addEventListener("click", () => { ddlBox.value = SAMPLE_DDL; reverse(); });

let revCount = 0;
async function reverse() {
  revOut.replaceChildren(h("div", { class: "loading-db" }, h("span", { class: "spinner" }), "Tablolar PostgreSQL'de oluşturuluyor …"));
  const schema = `rev_${++revCount}`;
  const created = await runSQL(`DROP SCHEMA IF EXISTS ${schema} CASCADE;\nCREATE SCHEMA ${schema};\nSET search_path TO ${schema};\n${ddlBox.value}`);
  await runSQL("SET search_path TO company, public");
  if (created.error) {
    revOut.replaceChildren(h("div", { class: "res-msg error" }, `PostgreSQL hatası: ${created.error.message}${created.error.index > 3 ? ` (komut ${created.error.index - 3})` : ""}`));
    return;
  }
  const [qCols, qCons] = catalogSQL(schema);
  const cols = (await runSQL(qCols)).last?.rows || [];
  const cons = (await runSQL(qCons)).last?.rows || [];
  const { model, steps, notes } = reverseER(catalogFromRows(cols, cons));
  if (!model.entities.length) { revOut.replaceChildren(h("div", { class: "res-msg warn" }, "Hiç tablo bulunamadı.")); return; }
  const pos = autoLayout(model);
  const spec = toDiagram(model, pos, {});
  const fig = erFigure({ ...spec, title: "Tablolardan çıkarılan ER diyagramı" }, "Tablolardan çıkarılan ER diyagramı (otomatik yerleşim). Düzenlemek için editöre aktarın.");
  const dslPre = h("pre", { class: "sql" });
  dslPre.innerHTML = `<code>${highlightSQL(toDSL(model))}</code>`;
  revOut.replaceChildren(
    h("h3", {}, "Çıkarım adımları"),
    h("ol", { class: "map-steps" }, ...steps.map((s) => h("li", { html: s.html }))),
    h("div", { class: "callout gotcha", html: `<div class="callout-label"><span>Geri kazanılamayan bilgi</span></div><ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` }),
    fig,
    h("div", { class: "btn-row" }, button("Editöre aktar", () => {
      if (!confirm("Çıkarılan diyagram editöre yüklensin mi? (Geri al ile dönebilirsiniz.)")) return;
      editor.setModel(model);
      $("#editor").scrollIntoView({ behavior: "smooth" });
    }, { kind: "primary" })),
    h("details", { class: "disclosure" }, h("summary", {}, "Metin hâli"), h("div", { class: "disclosure-body" }, dslPre)));
}

// ---- exercises: requirements, a check, and the solution right under each one (collapsible)
const exHost = $("#exercise-list");
const panelHost = $("#active-exercise");

const solutionBlock = (x) => solutionDetails(x, (m, layout) => loadInto(editor, m, layout));
const checkInto = (x, out) => renderCheck(out, editor.getModel(), solutionModel(x, ER_EXAMPLES));

/** The exercise being solved stays above the editor: requirements, check and solution without scrolling away. */
function openPanel(x, { clear = true } = {}) {
  if (clear && editor.getModel().entities.length && !confirm(`"${x.title}" için editör temizlensin mi? (Geri al ile dönebilirsiniz.)`)) return;
  if (clear) editor.setModel(emptyModel());
  const result = h("div");
  panelHost.replaceChildren(h("div", { class: "exercise-panel" },
    h("div", { class: "exercise-panel-head" }, h("strong", {}, `Alıştırma: ${x.title}`),
      h("div", { class: "btn-row", style: { margin: 0 } },
        button("Kontrol et", () => checkInto(x, result), { kind: "primary" }),
        button("Kapat", () => { panelHost.replaceChildren(); history.replaceState(null, "", location.pathname); }))),
    h("details", { class: "disclosure", open: true }, h("summary", {}, "Gereksinimler"), h("div", { class: "disclosure-body" },
      h("div", { html: x.text }), h("p", { class: "small", html: `<strong>Kullanılacak adlar:</strong> ${x.names}` }))),
    result,
    solutionBlock(x)));
  history.replaceState(null, "", `#exercise=${x.id}`);
  panelHost.scrollIntoView({ behavior: "smooth", block: "start" });
}

for (const x of ER_EXERCISES) {
  const result = h("div");
  exHost.append(h("section", { class: "exercise", id: `exercise-${x.id}` },
    h("h3", { "data-toc": x.title }, x.title, h("span", { class: "stars" }, "★".repeat(x.level) + "☆".repeat(3 - x.level))),
    h("div", { html: x.text }),
    h("p", { class: "small", html: `<strong>Kullanılacak adlar:</strong> ${x.names}` }),
    h("div", { class: "btn-row" },
      button("Editörde çöz", () => openPanel(x), { kind: "primary", title: "Editörü temizler; gereksinimler ve Kontrol et editörün üstünde kalır" }),
      button("Kontrol et", () => checkInto(x, result), { title: "Editördeki diyagramı bu alıştırmanın çözümüyle karşılaştır" })),
    result,
    solutionBlock(x)));
}

if (params.get("section") && document.getElementById(params.get("section"))) setTimeout(() => document.getElementById(params.get("section")).scrollIntoView(), 400);
if (params.get("exercise")) {
  const x = ER_EXERCISES.find((e) => e.id === params.get("exercise"));
  if (x) setTimeout(() => openPanel(x, { clear: false }), 300);
}

enhanceCallouts(document.querySelector(".content"));
