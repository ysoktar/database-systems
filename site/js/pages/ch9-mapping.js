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
  "7": tl("Adım 7: n-li ilişki yeni bir tablo olur ve bütün katılımcıların primary key'lerini taşır.", "Step 7: an n-ary relationship becomes a new table carrying the primary keys of all participants."),
};
const constructOf = (s) => (s.title.split(" · ")[1] || "").replace(/\s*\(.*$/, "");

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
  if (s.step === "6") { const [owner, attr] = constructOf(s).split("."); ids.add(`E:${owner.toUpperCase()}`); svg.querySelectorAll(`g[data-id^="A:E:${owner.toUpperCase()}/"]`).forEach((g) => { if (g.textContent === attr) ids.add(g.dataset.id); }); }
  fig.classList.add("focus");
  svg.querySelectorAll("g[data-id]").forEach((g) => {
    g.classList.toggle("hl", ids.has(g.dataset.id));
    const id = g.dataset.id, owner = id.startsWith("A:") ? id.slice(2).split("/")[0] : id;
    g.classList.toggle("done", !ids.has(id) && doneNames.has(owner));
  });
}

function stepPlayer(host, exId) {
  const ex = exampleById(exId);
  const { model } = parseER(ex.dsl);
  const res = mapER(model, { spec: "8A" });
  const steps = res.steps.filter((s) => s.snapshot);
  const pos = { ...autoLayout(model), ...(ex.layout || {}) };
  let i = -1, predict = false, asked = -1;
  const dots = h("div", { class: "pl-dots" }, ...steps.map((s, k) => h("button", { type: "button", class: `pl-dot s${s.step}`, title: s.title, "aria-label": s.title, onclick: () => go(k, true) }, s.step)));
  const counter = h("span", { class: "pl-count" });
  const prev = button(tl("◀ Önceki", "◀ Previous"), () => go(i - 1, true));
  const next = button(tl("Sonraki ▶", "Next ▶"), () => go(i + 1), { kind: "primary" });
  const reset = button(tl("Baştan", "Start over"), () => go(-1, true));
  const predictBox = h("input", { type: "checkbox", onchange: (e) => { predict = e.target.checked; } });
  const figHost = h("div", { class: "pl-fig" });
  const side = h("div", { class: "pl-side" });
  const schema = h("div", { class: "pl-schema" });
  host.append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, prev, next, reset, counter, h("label", { class: "small pl-predict" }, predictBox, tl(" Tahmin modu: önce siz tahmin edin", " Predict mode: guess first"))),
    dots, h("div", { class: "pl-grid" }, figHost, side), schema));

  const renderFig = (k) => {
    const fig = erFigure(toDiagram(model, pos, {}), tl("Vurgulu yapı bu adımda eşleniyor; soluk kenarlıklı olanlar önceki adımlarda eşlendi.", "The highlighted construct is mapped in this step; the ones with a faded border were mapped in earlier steps."));
    figHost.replaceChildren(fig);
    if (k < 0) return;
    const done = new Set();
    for (const s of steps.slice(0, k)) {
      const n = constructOf(s).toUpperCase();
      done.add(`E:${n}`); done.add(`R:${n}`);
    }
    focusFigure(fig, model, steps[k], done);
  };
  const tablesAfter = (k) => {
    const m = new Map();
    for (const s of steps.slice(0, k + 1)) m.set(s.snapshot.name, s.snapshot);
    return [...m.values()];
  };
  const renderSchema = (k, mark = true) => {
    const ts = tablesAfter(k), cur = mark ? steps[k] : null;
    schema.replaceChildren(h("div", { class: "ba-label" }, k < 0 ? tl("Şema henüz boş", "The schema is still empty") : tl(`Şu ana kadarki şema: ${ts.length} tablo`, `The schema so far: ${ts.length} tables`)),
      h("div", { class: "schema-grid" }, ...ts.map((t) => {
        const c = tableCard(t, t.name === cur?.snapshot.name ? { highlight: cur.previous ? cur.added : t.cols.map((x) => x.name), newFKs: cur.addedFKs } : {});
        if (t.name === cur?.snapshot.name) c.classList.add("current");
        return c;
      })));
  };
  const reveal = (k, verdict) => {
    const s = steps[k];
    const what = s.previous ? tl(`${s.snapshot.name} tablosu değişiyor.`, `The table ${s.snapshot.name} changes.`) : tl(`Yeni bir tablo oluşuyor: ${s.snapshot.name}.`, `A new table is created: ${s.snapshot.name}.`);
    side.replaceChildren(
      h("div", { class: "step-title" }, s.title),
      verdict || "",
      h("p", { class: "pl-rule" }, RULE[s.step] || ""),
      h("p", { class: "small", html: s.html }),
      h("div", { class: "ba" },
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), s.previous ? tableCard(s.previous) : h("div", { class: "ba-empty" }, tl("Tablo henüz yok", "No table yet"))),
        h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), tableCard(s.snapshot, { highlight: s.previous ? s.added : s.snapshot.cols.map((c) => c.name), newFKs: s.addedFKs }))),
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
      side.replaceChildren(h("p", {}, tl("Solda COMPANY'nin ER diyagramı var. Sonraki düğmesine her bastığınızda algoritma bir yapıyı eşler: diyagramda o yapı vurgulanır, burada uygulanan kural ve tablonun önceki ve sonraki hâli görünür, altta da şemanın o ana kadarki hâli büyür.",
        "On the left is the COMPANY ER diagram. Each time you press Next the algorithm maps one construct: it is highlighted in the diagram, the rule applied and the table before and after appear here, and the schema so far grows below.")),
        h("p", { class: "small muted" }, tl("Tahmin modunu açarsanız her adımdan önce hangi tablonun değişeceğini siz tahmin edersiniz.", "If you turn on predict mode you guess which table changes before each step.")));
      renderSchema(-1);
      return;
    }
    if (predict && !jump && asked < k) { asked = k; ask(k); } else reveal(k);
  }
  go(-1, true);
}
stepPlayer($("#company-player"), "company");

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
    const fig = erFigure(toDiagram(model, autoLayout(model), {}), "", { small: true });
    const fb = h("div");
    const result = h("div");
    const opts = h("div", { class: "quiz-options" });
    const pick = (j, initial = false) => {
      [...opts.children].forEach((b, m) => { b.disabled = true; b.classList.toggle("correct", d.opts[m][1]); b.classList.toggle("wrong", m === j && !d.opts[m][1]); });
      const [, ok, why] = d.opts[j];
      if (!initial) { answered[k] = j; if (ok) score++; nextB.disabled = false; head.querySelector(".pl-count").textContent = tl(`Soru ${k + 1} / ${DECIDE.length} · ${score} doğru`, `Question ${k + 1} of ${DECIDE.length} · ${score} correct`); head.querySelectorAll(".pl-dot")[k].classList.add(ok ? "good" : "bad"); }
      const right = d.opts.find((o) => o[1]);
      fb.replaceChildren(h("div", { class: `res-msg ${ok ? "ok" : "warn"}` }, why), ok ? "" : h("p", { class: "small" }, h("strong", {}, tl("Doğru cevap: ", "Correct answer: ")), right[0], " ", right[2].replace(/^(Doğru|Right)\. /, "")));
      const res = mapER(model, { spec: d.spec || "8A" });
      result.replaceChildren(h("div", { class: "ba-label" }, tl("Algoritmanın ürettiği tablolar", "The tables the algorithm produces")), h("div", { class: "schema-grid" }, ...res.tables.map((t) => tableCard(t))));
    };
    d.opts.forEach(([label], j) => opts.append(h("button", { type: "button", onclick: () => pick(j) }, h("span", { class: "opt-letter" }, "ABC"[j] + ") "), label)));
    card.replaceChildren(h("div", { class: "decide-grid" }, fig, h("div", {}, h("p", { class: "decide-q" }, d.q), opts, fb)), result);
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
