// ER/EER → relational mapping (Ch 9): each example as "before" (the diagram) and the mapping steps, each step with its
// table before and after (ermapview.js). The specialization options 8A–8D on the book's Figure 9.5 examples.
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { parseER } from "../lib/ermodel.js";
import { exampleById, ER_EXAMPLES } from "../lib/er-examples.js";
import { renderMapping, tableCard } from "../lib/ermapview.js";
import { mapER } from "../lib/ermap.js";
import { erFigure } from "../lib/erd.js";
import { autoLayout, toDiagram } from "../lib/erlayout.js";
import { t as tl, tx } from "../lib/i18n.js";

// the book's Figure 9.5 schemas (Figures 4.4, 4.3b and 4.5)
const FIG_4_4 = `entity EMPLOYEE
  Ssn key
  Fname
  Minit
  Lname
  Birth_date
  Address
  Job_type
entity SECRETARY
  Typing_speed
entity TECHNICIAN
  Tgrade
entity ENGINEER
  Eng_type
specialization EMPLOYEE -> SECRETARY, TECHNICIAN, ENGINEER disjoint partial on Job_type
`;
const FIG_4_3B = `entity VEHICLE
  Vehicle_id key
  License_plate_no
  Price
entity CAR
  Max_speed
  No_of_passengers
entity TRUCK
  No_of_axles
  Tonnage
specialization VEHICLE -> CAR, TRUCK disjoint total
`;
const FIG_4_5 = `entity PART
  Part_no key
  Description
entity MANUFACTURED_PART
  Manufacture_date
  Batch_no
  Drawing_no
entity PURCHASED_PART
  Supplier_name
  List_price
specialization PART -> MANUFACTURED_PART, PURCHASED_PART overlapping total
`;

let n = 0;
/** The diagram (before) and the mapping steps of a schema written in the site's ER text form. */
function mapping(host, dsl, { spec = "8A", caption, showDDL = true } = {}) {
  const { model } = parseER(dsl);
  const fig = erFigure({ ...toDiagram(model, autoLayout(model), {}) }, caption || "");
  const steps = h("div");
  host.replaceChildren(h("div", { class: "ba-label" }, tl("Önce: ER diyagramı", "Before: the ER diagram")), fig,
    h("div", { class: "ba-label", style: { marginTop: "12px" } }, tl("Eşleme adımları: her adımda tablonun önceki ve sonraki hâli", "The mapping steps: each with the table before and after")), steps);
  renderMapping(steps, model, { spec, showDDL, schemaName: `ch9_${++n}` });
}

mapping($("#company-map"), exampleById("company").dsl, { caption: tl("COMPANY'nin ER şeması (Figure 9.1)", "The COMPANY ER schema (Figure 9.1)") });
mapping($("#supply-map"), exampleById("supply").dsl, { caption: tl("SUPPLY üçlü ilişkisi (Figure 3.17)", "The ternary relationship SUPPLY (Figure 3.17)") });
mapping($("#lattice-map"), exampleById("university-eer").dsl, { caption: tl("Paylaşılan alt sınıf STUDENT_ASSISTANT", "The shared subclass STUDENT_ASSISTANT") });
mapping($("#category-map"), exampleById("vehicle-eer").dsl, { caption: tl("OWNER ve REGISTERED_VEHICLE kategorileri (Figure 4.8)", "The categories OWNER and REGISTERED_VEHICLE (Figure 4.8)") });

// ---- the four options of Step 8 (Figure 9.5)
{
  const OPTIONS = [
    ["8A", FIG_4_4, "Figure 4.4", tl("8A · Figure 4.4: EMPLOYEE ve her alt sınıf için ayrı tablo. Alt sınıf tablolarının Ssn'i EMPLOYEE'ye foreign key'dir.", "8A · Figure 4.4: a table for EMPLOYEE and one for each subclass. The subclass tables' Ssn is a foreign key to EMPLOYEE.")],
    ["8B", FIG_4_3B, "Figure 4.3b", tl("8B · Figure 4.3b: VEHICLE için tablo yok; CAR ve TRUCK, VEHICLE'ın bütün özniteliklerini taşır. Özelleştirme total olduğu için hiçbir araç kaybolmaz.", "8B · Figure 4.3b: no table for VEHICLE; CAR and TRUCK carry all of VEHICLE's attributes. The specialization is total, so no vehicle is lost.")],
    ["8C", FIG_4_4, "Figure 4.4", tl("8C · Figure 4.4: tek bir EMPLOYEE tablosu; Job_type sütunu satırın hangi alt sınıfa ait olduğunu söyler. Alt sınıfa özgü sütunlar diğer satırlarda NULL kalır.", "8C · Figure 4.4: a single EMPLOYEE table; the Job_type column says which subclass a row belongs to. The subclass-specific columns stay NULL in the other rows.")],
    ["8D", FIG_4_5, "Figure 4.5", tl("8D · Figure 4.5: tek bir PART tablosu ve iki Boolean sütun (MANUFACTURED_PART_flag ve PURCHASED_PART_flag; kitapta Mflag ve Pflag). Bir parça hem üretilmiş hem satın alınmış olabilir.", "8D · Figure 4.5: a single PART table and two Boolean columns (MANUFACTURED_PART_flag and PURCHASED_PART_flag; Mflag and Pflag in the book). A part can be both manufactured and purchased.")],
  ];
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const note = h("p", { class: "stepper-note" });
  const body = h("div");
  const show = (i) => {
    for (const [k, b] of [...seg.children].entries()) b.setAttribute("aria-pressed", String(k === i));
    note.textContent = OPTIONS[i][3];
    mapping(body, OPTIONS[i][1], { spec: OPTIONS[i][0], showDDL: false, caption: OPTIONS[i][2] });
  };
  OPTIONS.forEach(([o], i) => seg.append(h("button", { type: "button", onclick: () => show(i) }, o)));
  $("#spec-options").append(h("div", { class: "stepper" }, seg, note, body));
  show(0);
}

// ---- try it: any example, any option
{
  const examples = ER_EXAMPLES.filter((e) => ["company", "bank", "university", "supply", "employee-eer", "part-eer", "university-eer", "vehicle-eer"].includes(e.id));
  const exSel = h("select", { "aria-label": tl("Örnek", "Example") }, ...examples.map((e) => h("option", { value: e.id }, `${tx(e, "title")} (${tx(e, "source")})`)));
  const specSel = h("select", { "aria-label": tl("Özelleştirme seçeneği", "Specialization option") }, ...["8A", "8B", "8C", "8D"].map((o) => h("option", { value: o }, o)));
  const body = h("div");
  const go = () => { const e = exampleById(exSel.value); mapping(body, e.dsl, { spec: specSel.value, caption: `${tx(e, "title")} (${tx(e, "source")})` }); };
  exSel.addEventListener("change", go);
  specSel.addEventListener("change", go);
  $("#explorer").append(h("div", { class: "btn-row", style: { alignItems: "center" } },
    h("label", { class: "small" }, tl("Örnek: ", "Example: "), exSel), h("label", { class: "small" }, tl("Adım 8 seçeneği: ", "Step 8 option: "), specSel)), body);
  go();
}

// ---------------------------------------------------------------- the COMPANY step player
// The diagram with the construct of the current step highlighted, the rule it applies, the table before and after,
// and the whole schema built so far. In "predict" mode the learner first guesses which table the step changes.
const RULE = {
  "1": tl("Adım 1: Her normal varlık kendi tablosunu alır. Basit öznitelikler sütun olur, bileşik öznitelikler parçalarına ayrılır, türetilmiş öznitelikler saklanmaz ve anahtar primary key olur.",
    "Step 1: every regular entity gets its own table. Simple attributes become columns, composite attributes are split into their parts, derived attributes are not stored and the key becomes the primary key."),
  "2": tl("Adım 2: Zayıf varlık da kendi tablosunu alır, ama kendi başına tanımlanamadığı için sahibinin primary key'ini foreign key olarak taşır. Primary key, sahibin anahtarı ile partial key'in birleşimidir.",
    "Step 2: a weak entity also gets its own table, but since it cannot be identified on its own it carries its owner's primary key as a foreign key. The primary key is the owner's key together with the partial key."),
  "3": tl("Adım 3: 1:1 ilişkide yeni tablo açılmaz. Taraflardan birinin tablosuna diğerinin primary key'i eklenir; total katılan tarafı seçmek NULL'ları önler.",
    "Step 3: a 1:1 relationship gets no new table. The primary key of one side is added to the other side's table; choosing the side with total participation avoids NULLs."),
  "4": tl("Adım 4: 1:N ilişkide de yeni tablo açılmaz. Foreign key N tarafına eklenir, çünkü N tarafındaki her satır ilişkiye en fazla bir kez katılır ve tek bir değer yeter.",
    "Step 4: a 1:N relationship gets no new table either. The foreign key goes to the N side, because every row there takes part at most once, so a single value is enough."),
  "5": tl("Adım 5: M:N ilişki her zaman yeni bir tablo olur. İki tarafın primary key'leri foreign key olarak eklenir ve ikisi birlikte primary key olur.",
    "Step 5: an M:N relationship always becomes a new table. Both sides' primary keys are added as foreign keys and together they form the primary key."),
  "6": tl("Adım 6: Çok değerli öznitelik bir hücreye sığmaz (1NF), bu yüzden kendi tablosunu alır: sahibin anahtarı ve değerin kendisi, ikisi birlikte primary key.",
    "Step 6: a multivalued attribute does not fit in one cell (1NF), so it gets its own table: the owner's key and the value itself, together the primary key."),
  "7": tl("Adım 7: n-li ilişki yeni bir tablo olur ve bütün katılımcıların primary key'lerini taşır. Primary key genellikle bu foreign key'lerin hepsidir; kardinalitesi 1 olan bir katılımcı varsa onun anahtarı primary key'e girmez.", "Step 7: an n-ary relationship becomes a new table carrying the primary keys of all participants. The primary key is usually all of these foreign keys; a participant with cardinality 1 is left out of it."),
  "8A": tl("Adım 8A: Üst sınıfın tablosu kalır ve her alt sınıf için ayrı bir tablo açılır. Alt sınıf tablosu üst sınıfın primary key'ini (aynı zamanda foreign key olarak) ve kendi özniteliklerini taşır. Her durumda kullanılabilir.", "Step 8A: the superclass keeps its table and each subclass gets its own. A subclass table carries the superclass's primary key (also as a foreign key) and its own attributes. It works in every case."),
  "8B": tl("Adım 8B: Üst sınıf için tablo açılmaz; her alt sınıf tablosu üst sınıfın bütün özniteliklerini de taşır. Yalnızca total özelleştirmede doğrudur, overlapping ise ortak öznitelikler tekrar eder.", "Step 8B: the superclass gets no table; each subclass table also carries all of the superclass's attributes. It is only correct for a total specialization, and with overlap the common attributes repeat."),
  "8C": tl("Adım 8C: Üst sınıf ve bütün alt sınıflar tek bir tabloda toplanır; tek bir tip sütunu satırın hangi alt sınıfa ait olduğunu söyler. Yalnızca disjoint özelleştirmede kullanılır ve alt sınıfa özgü sütunlarda NULL üretir.", "Step 8C: the superclass and all subclasses go into one table; a single type column says which subclass a row belongs to. It is only for disjoint specializations and produces NULLs in the subclass-specific columns."),
  "8D": tl("Adım 8D: Tek tablo ve her alt sınıf için bir Boolean bayrak sütunu. Bir satırda birden çok bayrak TRUE olabildiği için overlapping özelleştirmede de kullanılır.", "Step 8D: one table and a Boolean flag column per subclass. Several flags can be TRUE in one row, so it also works for overlapping specializations."),
  "9": tl("Adım 9: Kategori (union type) için bir tablo açılır. Üst sınıfların anahtarları farklıysa kategoriye yapay bir anahtar (surrogate key) verilir ve her üst sınıfın tablosuna bu anahtarı gösteren bir foreign key eklenir; anahtarlar aynıysa o anahtar kullanılır.", "Step 9: a category (union type) gets a table. If the superclasses have different keys, the category gets a surrogate key and each superclass table gets a foreign key to it; if the keys are the same, that key is used."),
};
const ruleOf = (s) => RULE[s.step === "8" ? (s.title.match(/8[ABCD]/) || ["8A"])[0] : s.step] || "";
const changedTables = (s) => (s.tables || []).filter((t) => !t.previous || t.added.length || t.addedFKs.length);
const constructOf = (s) => (s.title.split(" · ")[1] || "").replace(/\s*\([^)]*\)$/, "");

/** Mark the nodes of an ER figure that belong to the construct of a step; the rest is dimmed. */
function focusFigure(fig, model, s, doneNames) {
  const svg = fig.querySelector("svg");
  const name = constructOf(s).toUpperCase();
  const ids = new Set();
  const ownAttrs = (owner) => svg.querySelectorAll(`g[data-id^="A:${owner}/"]`).forEach((g) => ids.add(g.dataset.id));
  if (s.step === "1" || s.step === "2") { ids.add(`E:${name}`); ownAttrs(`E:${name}`); }
  if (s.step === "2") { const r = model.relationships.find((x) => x.identifying && x.ends.some((e) => e.entity.toUpperCase() === name)); if (r) { ids.add(`R:${r.name.toUpperCase()}`); r.ends.forEach((e) => ids.add(`E:${e.entity.toUpperCase()}`)); } }
  if (["3", "4", "5", "7"].includes(s.step)) {
    const r = model.relationships.find((x) => x.name.toUpperCase() === name);
    ids.add(`R:${name}`); ownAttrs(`R:${name}`);
    r?.ends.forEach((e) => ids.add(`E:${e.entity.toUpperCase()}`));
  }
  if (s.step === "8") {
    const sp = constructOf(s).match(/^(\S+) → \{(.*)\}$/);
    if (sp) {
      const sup = sp[1].toUpperCase(), subs = sp[2].split(/,\s*/).map((x) => x.toUpperCase());
      for (const e of [sup, ...subs]) { ids.add(`E:${e}`); ownAttrs(`E:${e}`); }
      model.specializations.forEach((x, n) => { if (x.super.toUpperCase() === sup && x.subs.map((y) => y.toUpperCase()).join() === subs.join()) ids.add(`S:${n}`); });
    }
  }
  if (s.step === "9") {
    const [cat, rhs] = constructOf(s).split(" = ");
    ids.add(`E:${cat.toUpperCase()}`); ids.add(`U:${cat.toUpperCase()}`); ownAttrs(`E:${cat.toUpperCase()}`);
    (rhs || "").split(" ∪ ").forEach((e) => ids.add(`E:${e.trim().toUpperCase()}`));
  }
  if (s.step === "6") { const [owner, attr] = constructOf(s).split("."); ids.add(`E:${owner.toUpperCase()}`); svg.querySelectorAll(`g[data-id^="A:E:${owner.toUpperCase()}/"]`).forEach((g) => { if (g.textContent === attr) ids.add(g.dataset.id); }); }
  fig.classList.add("focus");
  svg.querySelectorAll("g[data-id]").forEach((g) => {
    g.classList.toggle("hl", ids.has(g.dataset.id));
    const id = g.dataset.id, owner = id.startsWith("A:") ? id.slice(2).split("/")[0] : id;
    g.classList.toggle("done", !ids.has(id) && doneNames.has(owner));
  });
}

/** Draw a diagram with larger shapes and labels (scale k) and spread it out so the bigger shapes do not overlap:
 * entities and relationships move apart by `major`, attributes move away from their owner by k. */
function bigDiagram(spec, k = 1.5, major = 1.1) {
  const byId = new Map(spec.nodes.map((n) => [n.id, { ...n }]));
  const out = new Map();
  const place = (n) => {
    if (out.has(n.id)) return out.get(n.id);
    let p;
    if (n.type === "attr" && n.of && byId.has(n.of)) {
      const o = byId.get(n.of), po = place(o);
      p = { ...n, x: po.x + (n.x - o.x) * k, y: po.y + (n.y - o.y) * k };
    } else p = { ...n, x: n.x * major, y: n.y * major };
    out.set(n.id, p);
    return p;
  };
  spec.nodes.forEach(place);
  const nodes = spec.nodes.map((n) => out.get(n.id));
  const links = spec.links.map((l) => (l.via ? { ...l, via: l.via.map(([x, y]) => [x * major, y * major]) } : l));
  return { ...spec, nodes, links, width: spec.width * major, height: spec.height * major, scale: k };
}

/** Hovering over a diagram enlarges it over the page; clicking opens it full screen (Esc or a second click closes). */
function zoomable(fig, host) {
  fig.classList.add("zoomable");
  fig.title = tl("Büyütmek için üzerine gelin, tam ekran için tıklayın", "Hover to enlarge, click for full screen");
  let timer = null;
  const canHover = window.matchMedia("(hover: hover) and (min-width: 900px)").matches;
  if (canHover) {
    // the hover area is always the diagram's small (unzoomed) box: the enlarged picture spills over the page, but
    // leaving the small box shrinks it again (the transform does not change the host's own box)
    const inside = (e) => { const r = host.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    const unzoom = () => { clearTimeout(timer); timer = null; host.classList.remove("zoomed"); document.removeEventListener("mousemove", track); };
    const track = (e) => { if (!inside(e)) unzoom(); };
    // mousemove rather than mouseenter: after shrinking, the pointer may never have "left" the host, so re-entering
    // the small box must start the zoom again
    host.addEventListener("mousemove", (e) => {
      if (host.classList.contains("zoomed") || timer || !inside(e)) return;
      timer = setTimeout(() => { timer = null; host.classList.add("zoomed"); }, 250);
      document.addEventListener("mousemove", track);
    });
  }
  const close = () => { fig.classList.remove("fs"); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  fig.addEventListener("click", () => {
    host.classList.remove("zoomed");
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (fig.classList.contains("fs")) { close(); return; }
    if (fig.requestFullscreen) fig.requestFullscreen().catch(() => { fig.classList.add("fs"); document.addEventListener("keydown", onKey); });
    else { fig.classList.add("fs"); document.addEventListener("keydown", onKey); }
  });
}

// one schema with every construct, so the player can run Steps 1 to 9 without switching examples
const ALL_STEPS_DSL = `entity EMPLOYEE
  Ssn key
  Name(Fname, Lname)
  Salary
entity DEPARTMENT
  Dnumber key
  Dname
  Locations multi
entity PROJECT
  Pnumber key
  Pname
weak entity DEPENDENT
  Dependent_name partial
  Relationship
entity SUPPLIER
  Sname key
entity PART
  Part_no key
entity VEHICLE
  Vehicle_id key
  License_plate_no
  Price
entity CAR
  Max_speed
entity TRUCK
  Tonnage
entity BANK
  Bname key
entity OWNER
relationship WORKS_FOR: EMPLOYEE N total, DEPARTMENT 1 total
relationship MANAGES: EMPLOYEE 1 role=manager, DEPARTMENT 1 total
  Start_date
relationship WORKS_ON: EMPLOYEE M, PROJECT N
  Hours
identifying relationship DEPENDENTS_OF: EMPLOYEE 1, DEPENDENT N total
relationship SUPPLY: SUPPLIER M, PART N, PROJECT P
  Quantity
specialization VEHICLE -> CAR, TRUCK disjoint total
category OWNER = EMPLOYEE | BANK partial
`;
// positions chosen so no shapes overlap and no line crosses another or runs through a shape (layoutScore = 0)
const ALL_STEPS_LAYOUT = {
  "E:EMPLOYEE": { x: 504, y: 437 }, "E:DEPARTMENT": { x: 1080, y: 195 }, "R:MANAGES": { x: 828, y: 92 }, "R:WORKS_FOR": { x: 828, y: 299 },
  "E:PROJECT": { x: 1080, y: 644 }, "R:WORKS_ON": { x: 828, y: 541 }, "R:SUPPLY": { x: 1116, y: 851 }, "E:SUPPLIER": { x: 936, y: 1035 },
  "E:PART": { x: 1344, y: 1012 }, "R:DEPENDENTS_OF": { x: 564, y: 667 }, "E:DEPENDENT": { x: 564, y: 874 }, "E:VEHICLE": { x: 312, y: 81 },
  "S:0": { x: 252, y: 207 }, "E:CAR": { x: 72, y: 345 }, "E:TRUCK": { x: 432, y: 345 }, "E:BANK": { x: 72, y: 690 },
  "U:OWNER": { x: 276, y: 782 }, "E:OWNER": { x: 276, y: 943 },
};
const PLAYER_EXAMPLES = [
  ["all", tl("Baştan sona: Adım 1–9 tek şemada (8A–8D hepsi uygulanır)", "Start to finish: Steps 1–9 in one schema (8A–8D all apply)")],
  ["vehicle", tl("VEHICLE (Figure 4.3b): yalnız Adım 8, 8A–8D hepsi uygulanır", "VEHICLE (Figure 4.3b): Step 8 only, 8A–8D all apply")],
  ["company", tl("COMPANY: Adım 1–6", "COMPANY: Steps 1–6")],
  ["supply", tl("SUPPLY: Adım 7 (üçlü ilişki)", "SUPPLY: Step 7 (ternary relationship)")],
  ["employee-eer", tl("EMPLOYEE özelleştirmeleri: Adım 8", "EMPLOYEE specializations: Step 8")],
  ["part-eer", tl("PART (overlapping): Adım 8", "PART (overlapping): Step 8")],
  ["university-eer", tl("UNIVERSITY, paylaşılan alt sınıf: Adım 6 ve 8", "UNIVERSITY, shared subclass: Steps 6 and 8")],
  ["vehicle-eer", tl("Araç sahipleri, kategoriler: Adım 5 ve 9", "Vehicle owners, categories: Steps 5 and 9")],
];
function stepPlayer(host, exId = "all", spec = "8A", predictInit = false) {
  const ex = exId === "all" ? { dsl: ALL_STEPS_DSL, layout: ALL_STEPS_LAYOUT } : exId === "vehicle" ? { dsl: FIG_4_3B } : exampleById(exId);
  const { model } = parseER(ex.dsl);
  const res = mapER(model, { spec });
  const steps = res.steps.filter((s) => s.snapshot);
  const exSel = h("select", { "aria-label": tl("Örnek", "Example"), onchange: () => stepPlayer(host, exSel.value, specSel.value, predict) }, ...PLAYER_EXAMPLES.map(([id, label]) => h("option", { value: id, selected: id === exId }, label)));
  const specSel = h("select", { "aria-label": tl("Adım 8 seçeneği", "Step 8 option"), onchange: () => stepPlayer(host, exSel.value, specSel.value, predict) }, ...["8A", "8B", "8C", "8D"].map((o) => h("option", { value: o, selected: o === spec }, o)));
  const hasSpec = model.specializations.length > 0;
  // an option the algorithm could not apply (for example 8B on a partial specialization) is reported, not hidden
  const fellBack = steps.filter((s) => s.step === "8" && !s.title.includes(`${tl("Adım", "Step")} ${spec} `));
  const fallbackNote = hasSpec && fellBack.length ? h("div", { class: "res-msg warn", style: { fontFamily: "inherit", marginBottom: "8px" } },
    tl(`Seçtiğiniz ${spec}, bu örnekteki ${fellBack.length} özelleştirmeden ${fellBack.length > 1 ? "bazılarına" : "birine"} uygulanamıyor; algoritma orada geçerli bir seçeneğe dönüyor. Nedeni, ilgili Adım 8 kutusunda yazıyor (numarası 8 olan düğmeler).`,
      `The chosen ${spec} cannot be applied to ${fellBack.length > 1 ? `${fellBack.length} of the specializations` : "one specialization"} in this example; the algorithm falls back to a valid option there. The reason is given in the Step 8 box (the buttons numbered 8).`)) : null;
  // a hand-made layout is used only when it places every entity; mixing it with automatic positions makes shapes collide
  const fullLayout = ex.layout && model.entities.every((e) => ex.layout[`E:${e.name.toUpperCase()}`]);
  const pos = fullLayout ? { ...autoLayout(model), ...ex.layout } : autoLayout(model);
  let i = -1, predict = predictInit, asked = -1;
  const dots = h("div", { class: "pl-dots" }, ...steps.map((s, k) => h("button", { type: "button", class: `pl-dot s${s.step}`, title: s.title, "aria-label": s.title, onclick: () => go(k, true) }, s.step)));
  const counter = h("span", { class: "pl-count" });
  const prev = button(tl("◀ Önceki", "◀ Previous"), () => go(i - 1, true));
  const next = button(tl("Sonraki ▶", "Next ▶"), () => go(i + 1), { kind: "primary" });
  const reset = button(tl("Baştan", "Start over"), () => go(-1, true));
  const predictBox = h("input", { type: "checkbox", checked: predict, onchange: (e) => { predict = e.target.checked; } });
  const figHost = h("div", { class: "pl-fig" });
  const side = h("div", { class: "pl-side" });
  const schema = h("div", { class: "pl-schema" });
  host.replaceChildren(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, h("label", { class: "small sim-field" }, tl("Örnek: ", "Example: "), exSel), hasSpec ? h("label", { class: "small sim-field" }, tl("Adım 8 seçeneği: ", "Step 8 option: "), specSel) : null),
    fallbackNote,
    h("div", { class: "pl-bar" }, prev, next, reset, counter, h("label", { class: "small pl-predict" }, predictBox, tl(" Tahmin modu: önce siz tahmin edin", " Predict mode: guess first"))),
    dots, h("div", { class: "pl-grid side" }, figHost, side), schema));

  const renderFig = (k) => {
    const fig = erFigure(bigDiagram(toDiagram(model, pos, {}), 1.75, 1.15), tl("Vurgulu yapı bu adımda eşleniyor; soluk kenarlıklı olanlar önceki adımlarda eşlendi. Büyütmek için üzerine gelin, tam ekran için tıklayın.", "The highlighted construct is mapped in this step; the ones with a faded border were mapped in earlier steps. Hover to enlarge, click for full screen."));
    figHost.replaceChildren(fig);
    zoomable(fig, figHost);
    if (k < 0) return;
    const done = new Set();
    for (const s of steps.slice(0, k)) for (const n of constructOf(s).toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) || []) { done.add(`E:${n}`); done.add(`R:${n}`); done.add(`U:${n}`); }
    focusFigure(fig, model, steps[k], done);
  };
  const tablesAfter = (k) => {
    const m = new Map();
    for (const s of steps.slice(0, k + 1)) for (const t of s.tables || [s]) m.set(t.snapshot.name, t.snapshot);
    return [...m.values()];
  };
  const renderSchema = (k, mark = true) => {
    const ts = tablesAfter(k), cur = mark ? steps[k] : null;
    schema.replaceChildren(h("div", { class: "ba-label" }, k < 0 ? tl("Şema henüz boş", "The schema is still empty") : tl(`Şu ana kadarki şema: ${ts.length} tablo`, `The schema so far: ${ts.length} tables`)),
      h("div", { class: "schema-grid" }, ...ts.map((t) => {
        const ch = cur ? changedTables(cur).find((x) => x.name === t.name) : null;
        const c = tableCard(t, ch ? { highlight: ch.previous ? ch.added : t.cols.map((x) => x.name), newFKs: ch.addedFKs } : {});
        if (ch) c.classList.add("current");
        return c;
      })));
  };
  const reveal = (k, verdict) => {
    const s = steps[k];
    const ch = changedTables(s), made = ch.filter((t) => !t.previous).map((t) => t.name), changed = ch.filter((t) => t.previous).map((t) => t.name);
    const what = [made.length ? tl(`Yeni tablo: ${made.join(", ")}.`, `New table${made.length > 1 ? "s" : ""}: ${made.join(", ")}.`) : "", changed.length ? tl(`Değişen tablo: ${changed.join(", ")}.`, `Changed table${changed.length > 1 ? "s" : ""}: ${changed.join(", ")}.`) : ""].filter(Boolean).join(" ");
    side.replaceChildren(
      h("div", { class: "step-title" }, s.title),
      verdict || "",
      s.step === "8" && !s.title.includes(`${tl("Adım", "Step")} ${spec} `) ? h("div", { class: "res-msg warn", style: { fontFamily: "inherit", margin: "6px 0" } },
        (() => { const why = ((res.notes.find((n) => n.startsWith(constructOf(s))) || "").replace(/<[^>]+>/g, "").match(/(?:çünkü|because) (.*)$/) || [, ""])[1];
          return tl(`Seçtiğiniz ${spec} bu özelleştirmeye uygulanamıyor${why ? `, çünkü ${why}` : "."}`, `The chosen ${spec} cannot be applied to this specialization${why ? `, because ${why}` : "."}`); })()
        + tl(` Bu yüzden algoritma ${(s.title.match(/8[ABCD]/) || [""])[0]} seçeneğini kullandı.`, ` So the algorithm used option ${(s.title.match(/8[ABCD]/) || [""])[0]}.`)) : "",
      h("p", { class: "pl-rule" }, ruleOf(s)),
      h("p", { class: "small", html: s.html }),
      ...changedTables(s).map((t) => h("div", { class: "ba" },
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), t.previous ? tableCard(t.previous) : h("div", { class: "ba-empty" }, tl(`${t.name} henüz yok`, `${t.name} does not exist yet`))),
        h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), tableCard(t.snapshot, { highlight: t.previous ? t.added : t.snapshot.cols.map((c) => c.name), newFKs: t.addedFKs })))),
      h("p", { class: "small muted" }, what));
    renderSchema(k);
  };
  const ask = (k) => {
    const s = steps[k];
    const existing = tablesAfter(k - 1).map((t) => t.name);
    const right = s.previous ? s.snapshot.name : "*new";
    const opts = [...existing.map((n) => [n, tl(`${n} tablosu değişir`, `the table ${n} changes`)]), ["*new", tl("Yeni bir tablo oluşur", "a new table is created")]];
    const kind = s.title.match(/\(([^)]*)\)/)?.[1] || "";
    side.replaceChildren(h("div", { class: "step-title" }, tl(`Sıradaki yapı: ${constructOf(s)} (${kind})`, `Next construct: ${constructOf(s)} (${kind})`)),
      h("p", {}, tl("Bu yapı eşlendiğinde ne olur? Kuralları düşünüp bir seçenek işaretleyin.", "What happens when this construct is mapped? Think about the rules and pick one.")),
      h("div", { class: "quiz-options" }, ...opts.map(([v, label]) => h("button", { type: "button", onclick: () => {
        const ok = v === right;
        reveal(k, h("div", { class: `res-msg ${ok ? "ok" : "warn"}` }, ok ? tl("Doğru tahmin.", "Correct guess.") : tl(`Tahmininiz "${label}" idi; doğrusu aşağıda.`, `You guessed "${label}"; the answer is below.`)));
      } }, label))));
    renderSchema(k - 1, false);
  };
  function go(k, jump = false) {
    k = Math.max(-1, Math.min(steps.length - 1, k));
    i = k;
    counter.textContent = k < 0 ? tl(`${steps.length} adım`, `${steps.length} steps`) : tl(`Adım ${k + 1} / ${steps.length}`, `Step ${k + 1} of ${steps.length}`);
    [...dots.children].forEach((d, j) => { d.classList.toggle("on", j === k); d.classList.toggle("past", j < k); });
    prev.disabled = k < 0; next.disabled = k >= steps.length - 1;
    renderFig(k);
    if (k < 0) {
      side.replaceChildren(h("p", {}, tl("Solda seçtiğiniz örneğin ER diyagramı var. Adım 7, 8 ve 9'u görmek için üstteki listeden SUPPLY, EER ve kategori örneklerini seçebilirsiniz; Adım 8 için 8A–8D seçeneklerinden birini de seçin. Sonraki düğmesine her bastığınızda algoritma bir yapıyı eşler: diyagramda o yapı vurgulanır, burada uygulanan kural ve tablonun önceki ve sonraki hâli görünür, altta da şemanın o ana kadarki hâli büyür.",
        "On the left is the ER diagram of the chosen example. To see Steps 7, 8 and 9, pick the SUPPLY, EER and category examples from the list above; for Step 8 also pick one of the options 8A–8D. Each time you press Next the algorithm maps one construct: it is highlighted in the diagram, the rule applied and the table before and after appear here, and the schema so far grows below.")),
        h("p", { class: "small muted" }, tl("Tahmin modunu açarsanız her adımdan önce hangi tablonun değişeceğini siz tahmin edersiniz.", "If you turn on predict mode you guess which table changes before each step.")));
      renderSchema(-1);
      return;
    }
    if (predict && !jump && asked < k) { asked = k; ask(k); } else reveal(k);
  }
  go(-1, true);
}
stepPlayer($("#company-player"));

// ---------------------------------------------------------------- you decide: one ER fragment at a time
// Each scenario: a small diagram, a design question, options with the reason each is right or wrong, and after the
// answer the tables the algorithm produces for the fragment.
const DECIDE = [
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Lname\nentity DEPARTMENT\n  Dnumber key\n  Dname\nrelationship WORKS_FOR: EMPLOYEE N total, DEPARTMENT 1 total\n`,
    q: tl("WORKS_FOR bir 1:N ilişki: her çalışan tek bir departmanda çalışır, bir departmanda birçok çalışan vardır. Foreign key nereye eklenmeli?", "WORKS_FOR is a 1:N relationship: each employee works in one department, a department has many employees. Where should the foreign key go?"),
    opts: [
      [tl("EMPLOYEE tablosuna DEPARTMENT'ın anahtarı (Dno) eklenir.", "DEPARTMENT's key (Dno) is added to the EMPLOYEE table."), true, tl("Doğru. N tarafındaki her çalışanın tek bir departmanı olduğu için bu bilgi çalışanın satırına tek bir değer olarak sığar.", "Right. Each employee on the N side has one department, so the fact fits into the employee's row as a single value.")],
      [tl("DEPARTMENT tablosuna EMPLOYEE'nin anahtarı (Ssn) eklenir.", "EMPLOYEE's key (Ssn) is added to the DEPARTMENT table."), false, tl("Bir departmanda birçok çalışan olduğundan departmanın satırına birden çok Ssn yazmak gerekirdi. Bir hücre tek bir değer tutar (1NF), bu yüzden bu yön çalışmaz.", "A department has many employees, so its row would need several Ssn values. A cell holds a single value (1NF), so this direction does not work.")],
      [tl("Yeni bir WORKS_FOR(Ssn, Dno) tablosu oluşturulur.", "A new table WORKS_FOR(Ssn, Dno) is created."), false, tl("Bu da doğru sonuç verir ama gereksizdir: fazladan bir tablo ve her sorguda fazladan bir join getirir. 1:N ilişkide kitabın tercih ettiği yol foreign key'dir.", "This gives correct results too but is unnecessary: an extra table and an extra join in every query. For 1:N the book prefers the foreign key.")],
    ] },
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Lname\nentity DEPARTMENT\n  Dnumber key\n  Dname\nrelationship MANAGES: EMPLOYEE 1 role=manager, DEPARTMENT 1 total\n  Start_date\n`,
    q: tl("MANAGES bir 1:1 ilişki. Her departmanın bir yöneticisi vardır (total), ama çalışanların çoğu hiçbir departmanı yönetmez (partial). En iyi tasarım hangisi?", "MANAGES is a 1:1 relationship. Every department has a manager (total), but most employees manage no department (partial). Which design is best?"),
    opts: [
      [tl("DEPARTMENT'a Mgr_ssn ve Mgr_start_date eklenir.", "Mgr_ssn and Mgr_start_date are added to DEPARTMENT."), true, tl("Doğru. DEPARTMENT ilişkiye total katıldığı için her departman satırında Mgr_ssn doludur; hiç NULL oluşmaz. İlişkinin özniteliği Start_date de foreign key ile aynı tabloya gider.", "Right. DEPARTMENT participates totally, so Mgr_ssn is filled in every department row and no NULL appears. The relationship attribute Start_date goes to the same table as the foreign key.")],
      [tl("EMPLOYEE'ye Manages_dno ve Start_date eklenir.", "Manages_dno and Start_date are added to EMPLOYEE."), false, tl("Bu da geçerli bir eşlemedir, ama yönetici olmayan her çalışanın satırında iki sütun NULL kalır. COMPANY'de sekiz çalışandan beşinde NULL olurdu (aşağıdaki SQL kutusunda deneyebilirsiniz).", "This is also a valid mapping, but every employee who is not a manager has two NULL columns. In COMPANY five of the eight employees would have NULLs (you can try it in the SQL box below).")],
      [tl("EMPLOYEE ve DEPARTMENT tek bir tabloda birleştirilir.", "EMPLOYEE and DEPARTMENT are merged into a single table."), false, tl("Birleştirme yalnızca iki katılım da total olduğunda uygundur. Burada çoğu çalışanın departman sütunları boş kalır ve iki ayrı varlık tek tabloya karışır.", "Merging is only appropriate when both participations are total. Here most employees would have empty department columns, and two different entities would be mixed in one table.")],
    ] },
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Lname\nentity PROJECT\n  Pnumber key\n  Pname\nrelationship WORKS_ON: EMPLOYEE M total, PROJECT N total\n  Hours\n`,
    q: tl("WORKS_ON bir M:N ilişki ve Hours özniteliği var. Nasıl eşlenir?", "WORKS_ON is an M:N relationship with an attribute Hours. How is it mapped?"),
    opts: [
      [tl("EMPLOYEE'ye Pno ve Hours eklenir.", "Pno and Hours are added to EMPLOYEE."), false, tl("Bir çalışan birden çok projede çalışabildiği için tek bir Pno sütunu yetmez; çalışanın satırını her proje için tekrar etmek de gerekirdi.", "An employee can work on several projects, so a single Pno column is not enough; the employee's row would have to be repeated for every project.")],
      [tl("PROJECT'e Essn ve Hours eklenir.", "Essn and Hours are added to PROJECT."), false, tl("Aynı sorun öbür yönde: bir projede birçok çalışan var. M:N ilişkiyi iki taraftan hiçbirine tek bir foreign key olarak koyamazsınız.", "The same problem the other way round: a project has many employees. An M:N relationship cannot be stored as a single foreign key on either side.")],
      [tl("Yeni bir WORKS_ON(Essn, Pno, Hours) tablosu; primary key {Essn, Pno}.", "A new table WORKS_ON(Essn, Pno, Hours); primary key {Essn, Pno}."), true, tl("Doğru. Her (çalışan, proje) çifti bir satırdır. Hours ne çalışana ne projeye aittir, çiftin kendisine aittir; bu yüzden ilişki tablosunda durur.", "Right. Each (employee, project) pair is one row. Hours belongs neither to the employee nor to the project but to the pair, so it lives in the relationship table.")],
    ] },
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Lname\nweak entity DEPENDENT\n  Dependent_name partial\n  Relationship\nidentifying relationship DEPENDENTS_OF: EMPLOYEE 1, DEPENDENT N total\n`,
    q: tl("DEPENDENT zayıf bir varlık; partial key'i Dependent_name. DEPENDENT tablosunun primary key'i ne olmalı?", "DEPENDENT is a weak entity; its partial key is Dependent_name. What should the primary key of the DEPENDENT table be?"),
    opts: [
      [tl("{Dependent_name}", "{Dependent_name}"), false, tl("İki farklı çalışanın Alice adında birer çocuğu olabilir. Partial key yalnızca aynı sahibin bağımlıları arasında tekildir.", "Two different employees can each have a child called Alice. A partial key is unique only among the dependents of the same owner.")],
      [tl("{Essn, Dependent_name}", "{Essn, Dependent_name}"), true, tl("Doğru. Sahibin anahtarı (Essn, foreign key olarak) ile partial key birlikte her bağımlıyı tek olarak belirler.", "Right. The owner's key (Essn, as a foreign key) together with the partial key identifies each dependent uniquely.")],
      [tl("{Essn}", "{Essn}"), false, tl("Bu durumda her çalışanın en fazla bir bağımlısı olabilirdi; oysa ilişki 1:N'dir.", "Then each employee could have at most one dependent, but the relationship is 1:N.")],
    ] },
  { dsl: `entity DEPARTMENT\n  Dnumber key\n  Dname\n  Locations multi\n`,
    q: tl("DEPARTMENT'ın çok değerli Locations özniteliği var: bir departman birden çok şehirde olabilir. Nasıl saklanır?", "DEPARTMENT has a multivalued attribute Locations: a department can be in several cities. How is it stored?"),
    opts: [
      [tl("DEPARTMENT'a 'Houston, Stafford' gibi virgülle ayrılmış bir Locations sütunu eklenir.", "A Locations column holding a comma-separated list like 'Houston, Stafford' is added to DEPARTMENT."), false, tl("Bir hücrede birden çok değer 1NF'i bozar. 'Stafford'daki departmanlar' gibi bir sorgu metin aramasına döner ve bir şehri silmek ya da eklemek zorlaşır.", "Several values in one cell break 1NF. A query like 'departments in Stafford' turns into a text search, and adding or removing one city becomes awkward.")],
      [tl("DEPT_LOCATIONS(Dnumber, Dlocation) tablosu, primary key Dnumber.", "A table DEPT_LOCATIONS(Dnumber, Dlocation) with primary key Dnumber."), false, tl("Primary key yalnızca Dnumber olursa her departman tabloda bir kez geçebilir ve ancak bir yeri olabilir; çok değerli olmanın anlamı kaybolur.", "If the primary key is only Dnumber, each department can appear once and have only one location; the point of being multivalued is lost.")],
      [tl("DEPT_LOCATIONS(Dnumber, Dlocation) tablosu, primary key {Dnumber, Dlocation}.", "A table DEPT_LOCATIONS(Dnumber, Dlocation) with primary key {Dnumber, Dlocation}."), true, tl("Doğru. Her (departman, şehir) çifti bir satırdır; aynı departman farklı şehirlerle tekrar edebilir ama aynı çift iki kez yazılamaz.", "Right. Each (department, city) pair is one row; a department can repeat with different cities but the same pair cannot be written twice.")],
    ] },
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Lname\nrelationship SUPERVISION: EMPLOYEE 1 role=supervisor, EMPLOYEE N role=supervisee\n`,
    q: tl("SUPERVISION recursive bir 1:N ilişki: bir yöneticinin birçok astı, her çalışanın en fazla bir yöneticisi vardır. Nasıl eşlenir?", "SUPERVISION is a recursive 1:N relationship: a supervisor has many supervisees, each employee has at most one supervisor. How is it mapped?"),
    opts: [
      [tl("EMPLOYEE'ye kendi tablosunu gösteren Super_ssn sütunu eklenir.", "A column Super_ssn referencing EMPLOYEE itself is added to EMPLOYEE."), true, tl("Doğru. Recursive ilişki de 1:N kuralına uyar: N tarafı astlardır, bu yüzden her astın satırına yöneticisinin Ssn'i yazılır. Foreign key aynı tabloyu gösterir.", "Right. A recursive relationship follows the 1:N rule too: the N side is the supervisees, so each supervisee's row stores the supervisor's Ssn. The foreign key points to the same table.")],
      [tl("EMPLOYEE'ye astın Ssn'ini tutan Supervisee_ssn eklenir.", "A column Supervisee_ssn holding the subordinate's Ssn is added to EMPLOYEE."), false, tl("Bu, foreign key'i 1 tarafına koymak olur: bir yöneticinin birçok astı olduğu için tek bir sütun yetmez.", "That puts the foreign key on the 1 side: a supervisor has many supervisees, so one column is not enough.")],
      [tl("Ayrı bir SUPERVISOR varlık tablosu oluşturulur.", "A separate SUPERVISOR entity table is created."), false, tl("Yönetici de bir çalışandır; ayrı bir tablo aynı kişileri iki yerde tutar. Rol adları (supervisor, supervisee) yalnızca iki ucu ayırt etmeye yarar.", "A supervisor is also an employee; a separate table would store the same people twice. The role names (supervisor, supervisee) only tell the two ends apart.")],
    ] },
  { dsl: `entity EMPLOYEE\n  Ssn key\n  Name(Fname, Lname)\n  Birth_date\n  Age derived\n`,
    q: tl("EMPLOYEE'nin bileşik Name(Fname, Lname) ve türetilmiş Age öznitelikleri var. Tabloda hangi sütunlar olur?", "EMPLOYEE has a composite attribute Name(Fname, Lname) and a derived attribute Age. Which columns does the table have?"),
    opts: [
      [tl("Ssn, Name, Birth_date, Age", "Ssn, Name, Birth_date, Age"), false, tl("Bileşik öznitelik tek bir sütun olarak tutulmaz, bileşenlerine ayrılır. Age de saklanmaz.", "A composite attribute is not kept as one column; it is split into its components. Age is not stored either.")],
      [tl("Ssn, Fname, Lname, Birth_date, Age", "Ssn, Fname, Lname, Birth_date, Age"), false, tl("Bileşenler doğru, ama Age Birth_date'ten hesaplanabilir. Saklanırsa her yıl güncellenmesi gerekir ve tutarsız kalabilir.", "The components are right, but Age can be computed from Birth_date. If stored it would need updating every year and could become inconsistent.")],
      [tl("Ssn, Fname, Lname, Birth_date", "Ssn, Fname, Lname, Birth_date"), true, tl("Doğru. Bileşik öznitelik parçalarına ayrılır, türetilmiş öznitelik gerektiğinde sorgu ya da view ile hesaplanır.", "Right. The composite attribute is split into its parts, and the derived attribute is computed by a query or view when needed.")],
    ] },
  { dsl: `entity SUPPLIER\n  Sname key\nentity PART\n  Part_no key\nentity PROJECT\n  Proj_name key\nrelationship SUPPLY: SUPPLIER M, PART N, PROJECT P\n  Quantity\n`,
    q: tl("SUPPLY üçlü bir ilişki: hangi tedarikçinin hangi projeye hangi parçadan ne kadar verdiğini söyler. Nasıl eşlenir?", "SUPPLY is a ternary relationship: which supplier supplies how many of which part to which project. How is it mapped?"),
    opts: [
      [tl("Üç ayrı ikili tablo: SUPPLIER–PART, PART–PROJECT ve SUPPLIER–PROJECT.", "Three separate binary tables: SUPPLIER–PART, PART–PROJECT and SUPPLIER–PROJECT."), false, tl("Üç ikili ilişki üçlü ilişkiyle aynı bilgiyi taşımaz: 'Smith bu parçayı bu projeye verdi' bilgisi üç ayrı çiftten geri kurulamaz. Ayrıca Quantity hiçbir çifte ait değildir.", "Three binary relationships do not carry the same information as one ternary relationship: 'Smith supplied this part to this project' cannot be rebuilt from three separate pairs. Quantity also belongs to no single pair.")],
      [tl("SUPPLY(Sname, Part_no, Proj_name, Quantity); primary key üç foreign key'in birleşimi.", "SUPPLY(Sname, Part_no, Proj_name, Quantity); the primary key is the three foreign keys together."), true, tl("Doğru. Her üçlü bir satırdır ve bütün katılımcılar M/N/P olduğu için üçü birlikte primary key olur.", "Right. Each triple is one row, and since all participants are M/N/P the three together form the primary key.")],
      [tl("SUPPLY(Sname, Part_no, Proj_name, Quantity); primary key {Sname, Part_no}.", "SUPPLY(Sname, Part_no, Proj_name, Quantity); primary key {Sname, Part_no}."), false, tl("Bu, bir tedarikçinin bir parçayı yalnızca bir projeye verebileceği anlamına gelirdi. Bir katılımcının foreign key'i ancak o katılımcının kardinalitesi 1 ise primary key'in dışında kalır.", "That would mean a supplier can supply a part to only one project. A participant's foreign key is left out of the primary key only if that participant's cardinality is 1.")],
    ] },
  { dsl: FIG_4_3B, spec: "8B",
    q: tl("VEHICLE, CAR ve TRUCK'a ayrılıyor; özelleştirme disjoint ve total. Her aracın bütün bilgisini tek bir tablodan okumak ve hiç NULL olmamasını istiyoruz. Hangi seçenek uygun?", "VEHICLE is specialized into CAR and TRUCK; the specialization is disjoint and total. We want to read all of a vehicle's information from one table and have no NULLs. Which option fits?"),
    opts: [
      [tl("8A: VEHICLE, CAR ve TRUCK için üç tablo.", "8A: three tables for VEHICLE, CAR and TRUCK."), false, tl("8A her durumda çalışır ve NULL üretmez, ama bir arabanın bütün bilgisi için VEHICLE ile CAR'ı join etmek gerekir.", "8A always works and produces no NULLs, but all of a car's information needs a join of VEHICLE and CAR.")],
      [tl("8B: yalnızca CAR ve TRUCK; ikisi de VEHICLE'ın özniteliklerini taşır.", "8B: only CAR and TRUCK; both carry VEHICLE's attributes."), true, tl("Doğru. Total olduğu için her araç bir alt sınıftadır, disjoint olduğu için de yalnızca birindedir; hiçbir şey kaybolmaz ve tekrar etmez. Her araç tek tabloda, NULL'suz durur.", "Right. Total means every vehicle is in a subclass, disjoint means it is in only one; nothing is lost or repeated. Each vehicle sits in one table without NULLs.")],
      [tl("8C: tek bir VEHICLE tablosu ve Vehicle_type sütunu.", "8C: a single VEHICLE table and a Vehicle_type column."), false, tl("Tek tablodan okunur ama arabaların satırında No_of_axles ve Tonnage, kamyonların satırında Max_speed ve No_of_passengers NULL kalır.", "It is read from one table, but cars have NULL No_of_axles and Tonnage, and trucks have NULL Max_speed and No_of_passengers.")],
    ] },
  { dsl: FIG_4_5, spec: "8D",
    q: tl("PART, MANUFACTURED_PART ve PURCHASED_PART'a ayrılıyor ve özelleştirme overlapping: bir parça hem üretilmiş hem satın alınmış olabilir. Tek tablo istiyoruz. Hangi seçenek?", "PART is specialized into MANUFACTURED_PART and PURCHASED_PART, and the specialization is overlapping: a part can be both manufactured and purchased. We want a single table. Which option?"),
    opts: [
      [tl("8C: tek tablo ve Part_type gibi tek bir tip sütunu.", "8C: a single table with one type column such as Part_type."), false, tl("Tek bir tip sütunu yalnızca bir değer tutar; hem üretilmiş hem satın alınmış bir parçayı ifade edemez. 8C disjoint alt sınıflar içindir.", "A single type column holds one value; it cannot say that a part is both manufactured and purchased. 8C is for disjoint subclasses.")],
      [tl("8D: tek tablo ve her alt sınıf için bir Boolean sütun (Mflag, Pflag).", "8D: a single table with one Boolean column per subclass (Mflag, Pflag)."), true, tl("Doğru. Her alt sınıf için ayrı bir bayrak olduğundan bir satırda ikisi birden TRUE olabilir; overlapping özelleştirme böyle tek tabloda tutulur.", "Right. With one flag per subclass, both can be TRUE in the same row; this is how an overlapping specialization fits in one table.")],
      [tl("8B: yalnızca alt sınıf tabloları.", "8B: only the subclass tables."), false, tl("Tek tablo değildir; üstelik overlapping olduğunda iki alt sınıfa ait bir parçanın ortak öznitelikleri iki tabloda tekrar eder.", "It is not a single table; besides, with overlap the common attributes of a part in both subclasses are repeated in two tables.")],
    ] },
];

{
  const host = $("#decide");
  let k = 0, score = 0, answered = [];
  const head = h("div", { class: "pl-bar" });
  const card = h("div");
  host.append(h("div", { class: "player" }, head, card));
  const show = () => {
    const d = DECIDE[k];
    const { model } = parseER(d.dsl);
    const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { k--; show(); });
    const nextB = button(k === DECIDE.length - 1 ? tl("Sonuç", "Result") : tl("Sonraki ▶", "Next ▶"), () => { k++; k < DECIDE.length ? show() : finish(); }, { kind: "primary" });
    prevB.disabled = k === 0; nextB.disabled = answered[k] == null;
    head.replaceChildren(prevB, nextB, h("span", { class: "pl-count" }, tl(`Soru ${k + 1} / ${DECIDE.length} · ${score} doğru`, `Question ${k + 1} of ${DECIDE.length} · ${score} correct`)),
      h("div", { class: "pl-dots", style: { margin: 0 } }, ...DECIDE.map((_, j) => h("span", { class: "pl-dot" + (j === k ? " on" : "") + (answered[j] == null ? "" : DECIDE[j].opts[answered[j]][1] ? " good" : " bad") }, String(j + 1)))));
    const fig = erFigure(bigDiagram(toDiagram(model, autoLayout(model), {}), 1.35, 1.2), "", { small: true });
    const figBox = h("div", { class: "pl-fig" }, fig);
    zoomable(fig, figBox);
    const fb = h("div");
    const result = h("div");
    const opts = h("div", { class: "quiz-options" });
    const pick = (j, initial = false) => {
      [...opts.children].forEach((b, m) => { b.disabled = true; b.classList.toggle("correct", d.opts[m][1]); b.classList.toggle("wrong", m === j && !d.opts[m][1]); });
      const [, ok, why] = d.opts[j];
      if (!initial) { answered[k] = j; if (ok) score++; nextB.disabled = false; head.querySelector(".pl-count").textContent = tl(`Soru ${k + 1} / ${DECIDE.length} · ${score} doğru`, `Question ${k + 1} of ${DECIDE.length} · ${score} correct`); head.querySelectorAll(".pl-dot")[k].classList.add(ok ? "good" : "bad"); }
      const right = d.opts.find((o) => o[1]);
      const resetB = button(tl("↺ Cevabı sıfırla", "↺ Reset answer"), () => { if (d.opts[answered[k]]?.[1]) score--; answered[k] = undefined; show(); }, { title: tl("Bu soruyu yeniden cevaplayın", "Answer this question again") });
      fb.replaceChildren(h("div", { class: `res-msg ${ok ? "ok" : "warn"}` }, why), h("div", { class: "btn-row", style: { margin: "6px 0" } }, resetB), ok ? "" : h("p", { class: "small" }, h("strong", {}, tl("Doğru cevap: ", "Correct answer: ")), right[0], " ", right[2].replace(/^(Doğru|Right)\. /, "")));
      const res = mapER(model, { spec: d.spec || "8A" });
      // every step of the fragment with its table before and after, whether the answer was right or wrong
      const ol = h("ol", { class: "map-steps" });
      for (const st of res.steps.filter((x) => x.snapshot)) {
        ol.append(h("li", {}, h("div", { class: "step-title" }, st.title), h("div", { class: "small", html: st.html }),
          h("div", { class: "ba" },
            h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), st.previous ? tableCard(st.previous) : h("div", { class: "ba-empty" }, tl(`${st.snapshot.name} henüz yok: bu adımda oluşturuluyor`, `${st.snapshot.name} does not exist yet: this step creates it`))),
            h("div", { class: "ba-arrow", "aria-hidden": "true" }),
            h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), tableCard(st.snapshot, { highlight: st.previous ? st.added : st.snapshot.cols.map((c) => c.name), newFKs: st.addedFKs })))));
      }
      result.replaceChildren(h("div", { class: "ba-label" }, ok ? tl("Algoritma bu parçayı adım adım böyle eşler: her adımda tablonun önceki ve sonraki hâli", "This is how the algorithm maps the fragment step by step: each table before and after")
        : tl("Doğru eşleme adım adım: her adımda tablonun önceki ve sonraki hâli. Seçtiğiniz tasarımla karşılaştırın.", "The correct mapping step by step: each table before and after. Compare it with the design you chose.")), ol,
        h("div", { class: "ba-label" }, tl(`Sonuç: ${res.tables.length} tablo`, `Result: ${res.tables.length} tables`)), h("div", { class: "schema-grid" }, ...res.tables.map((t) => tableCard(t))));
    };
    d.opts.forEach(([label], j) => opts.append(h("button", { type: "button", onclick: () => pick(j) }, h("span", { class: "opt-letter" }, "ABC"[j] + ") "), label)));
    card.replaceChildren(h("div", { class: "decide-grid" }, figBox, h("div", {}, h("p", { class: "decide-q" }, d.q), opts, fb)), result);
    if (answered[k] != null) pick(answered[k], true);
  };
  const finish = () => {
    k = DECIDE.length - 1;
    head.replaceChildren(button(tl("Baştan başla", "Start again"), () => { k = 0; score = 0; answered = []; show(); }, { kind: "primary" }));
    card.replaceChildren(h("p", { class: "decide-q" }, tl(`${DECIDE.length} sorudan ${score} tanesini doğru cevapladınız.`, `You answered ${score} of ${DECIDE.length} questions correctly.`)),
      h("p", {}, score === DECIDE.length ? tl("Bütün kuralları uygulayabiliyorsunuz. Şimdi aşağıdaki 'Kendiniz deneyin' bölümünde başka şemaları eşleyebilirsiniz.", "You can apply every rule. Now try other schemas in the 'Try it yourself' section below.")
        : tl("Yanlış cevapladığınız sorulara geri dönüp açıklamaları okuyun; her biri bir kuralın neden öyle olduğunu anlatıyor. Aşağıdaki kırmızı numaralara tıklayarak o sorulara dönebilirsiniz.", "Go back to the questions you missed and read the explanations; each explains why a rule is the way it is. Click the red numbers below to return to them.")),
      h("div", { class: "pl-dots" }, ...DECIDE.map((q, j) => h("button", { type: "button", class: "pl-dot " + (q.opts[answered[j]]?.[1] ? "good" : "bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
  };
  show();
}
