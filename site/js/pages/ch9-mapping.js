// ER/EER → relational mapping (Ch 9): each example as "before" (the diagram) and the mapping steps, each step with its
// table before and after (ermapview.js). The specialization options 8A–8D on the book's Figure 9.5 examples.
import "../layout.js";
import { $, h } from "../lib/ui.js";
import { parseER } from "../lib/ermodel.js";
import { exampleById, ER_EXAMPLES } from "../lib/er-examples.js";
import { renderMapping } from "../lib/ermapview.js";
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
