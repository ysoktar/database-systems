import "../layout.js";
import { h, $, $$ } from "../lib/ui.js";
import { erFigure, COMPANY_ER } from "../lib/erd.js";

const put = (id, fig) => { const host = $(`#${id}`); if (host) host.append(fig); };

// ---- notation legend: one tiny diagram per symbol
const legend = [
  [{ id: "a", type: "entity", x: 70, y: 30, label: "ENTITY" }], "Entity type (varlık tipi)",
  [{ id: "a", type: "entity", x: 70, y: 30, label: "WEAK", weak: true }], "Weak entity type (zayıf varlık)",
  [{ id: "a", type: "rel", x: 70, y: 30, label: "RELATES" }], "Relationship type (ilişki tipi)",
  [{ id: "a", type: "rel", x: 70, y: 30, label: "IDENT", ident: true }], "Identifying relationship (tanımlayıcı ilişki)",
  [{ id: "a", type: "attr", x: 70, y: 30, label: "Attribute" }], "Attribute (öznitelik)",
  [{ id: "a", type: "attr", x: 70, y: 30, label: "Key", key: true }], "Key attribute (anahtar, altı çizili)",
  [{ id: "a", type: "attr", x: 70, y: 30, label: "Partial", pkey: true }], "Partial key (kısmi anahtar, kesik altı çizili)",
  [{ id: "a", type: "attr", x: 70, y: 30, label: "Multi", multi: true }], "Multivalued attribute (çok değerli, çift elips)",
  [{ id: "a", type: "attr", x: 70, y: 30, label: "Derived", derived: true }], "Derived attribute (türetilmiş, kesik elips)",
];
const lg = h("div", { class: "schema-grid", style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" } });
for (let i = 0; i < legend.length; i += 2) {
  const fig = erFigure({ width: 140, height: 60, nodes: legend[i], links: [] }, legend[i + 1], { small: true });
  fig.style.margin = "0";
  lg.append(fig);
}
// composite + participation examples
const comp = erFigure({
  width: 300, height: 120,
  nodes: [
    { id: "n", type: "attr", x: 150, y: 90, label: "Name" },
    { id: "f", type: "attr", x: 60, y: 30, label: "Fname", of: "n" },
    { id: "m", type: "attr", x: 150, y: 22, label: "Minit", of: "n" },
    { id: "l", type: "attr", x: 240, y: 30, label: "Lname", of: "n" },
  ], links: [],
}, "Composite attribute (bileşik): bileşenleri ana özniteliğe bağlanır.", { small: true });
comp.style.margin = "0";
const part = erFigure({
  width: 300, height: 80,
  nodes: [
    { id: "e1", type: "entity", x: 50, y: 40, label: "E1" },
    { id: "r", type: "rel", x: 150, y: 40, label: "R" },
    { id: "e2", type: "entity", x: 250, y: 40, label: "E2" },
  ], links: [{ a: "r", b: "e1", card: "1" }, { a: "r", b: "e2", card: "N", total: true }],
}, "E1:E2 için 1:N kardinalite; E2'nin R'ye katılımı total (çift çizgi), E1'inki partial.", { small: true });
part.style.margin = "0";
lg.append(comp, part);
put("legend", lg);

put("company-er", erFigure(COMPANY_ER, "COMPANY ER şeması (kitapta Figure 3.2). Çift çizgi = total participation, çift dikdörtgen/eşkenar dörtgen = zayıf varlık ve tanımlayıcı ilişkisi; SUPERVISION recursive bir ilişkidir (rol adları: supervisor, supervisee)."));

// ---- relationship instances drawn from the Figure 5.6 data
const EMPS = ["Smith", "Wong", "Zelaya", "Wallace", "Narayan", "English", "Jabbar", "Borg"];
const DEPTS = ["Research (5)", "Administration (4)", "Headquarters (1)"];
const PROJS = ["ProductX", "ProductY", "ProductZ", "Computerization", "Reorganization", "Newbenefits"];
const REL = {
  WORKS_FOR: { right: DEPTS, ratio: "N:1", pairs: [[0, 0], [1, 0], [2, 1], [3, 1], [4, 0], [5, 0], [6, 1], [7, 2]],
    note: "Her çalışan <strong>tam bir</strong> departmanda çalışır; bir departmanda <strong>birçok</strong> çalışan olabilir → N:1. Tüm çalışanlar ve tüm departmanlar katılıyor → iki taraf da total." },
  MANAGES: { right: DEPTS, ratio: "1:1", pairs: [[1, 0], [3, 1], [7, 2]],
    note: "Bir çalışan en fazla bir departmanı, bir departmanı tam bir çalışan yönetir → 1:1. 5 çalışan hiçbir şey yönetmiyor → EMPLOYEE'nin katılımı <strong>partial</strong>; her departmanın yöneticisi var → DEPARTMENT'ın katılımı <strong>total</strong>." },
  WORKS_ON: { right: PROJS, ratio: "M:N", pairs: [[0, 0], [0, 1], [4, 2], [5, 0], [5, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 5], [2, 3], [6, 3], [6, 5], [3, 5], [3, 4], [7, 4]],
    note: "Bir çalışan birçok projede, bir projede birçok çalışan çalışabilir → M:N. Her ilişki örneğinin bir <em>Hours</em> değeri var: bu, ilişkinin özniteliğidir; ne yalnız çalışana ne yalnız projeye aittir." },
};
const relHost = $("#instances");
if (relHost) {
  const seg = h("div", { class: "seg", role: "group", "aria-label": "İlişki tipi" });
  const note = h("p", { class: "stepper-note" });
  const svgHost = h("div");
  const draw = (name) => {
    const R = REL[name];
    const H = Math.max(EMPS.length, R.right.length) * 34 + 30;
    const yL = (i) => 30 + i * ((H - 50) / (EMPS.length - 1));
    const yR = (j) => R.right.length === 1 ? H / 2 : 30 + j * ((H - 50) / (R.right.length - 1));
    const used = new Set(R.pairs.map((p) => p[0]));
    const usedR = new Set(R.pairs.map((p) => p[1]));
    let s = `<svg viewBox="0 0 620 ${H}" role="img" aria-label="${name} ilişki örnekleri">
      <style>.ri-t{font-size:12px;fill:var(--text);dominant-baseline:middle}.ri-d{fill:var(--s1)}.ri-d.off{fill:var(--surface-3);stroke:var(--axis)}.ri-r{fill:var(--s2)}.ri-r.off{fill:var(--surface-3);stroke:var(--axis)}
      .ri-l{stroke:var(--text-2);stroke-width:1.2}.ri-h{font-size:11px;font-weight:700;fill:var(--muted);letter-spacing:.05em;text-anchor:middle}.ri-x{fill:rgba(235,104,52,.12);stroke:var(--text-2)}</style>
      <text class="ri-h" x="80" y="12">EMPLOYEE</text><text class="ri-h" x="520" y="12">${name === "WORKS_ON" ? "PROJECT" : "DEPARTMENT"}</text>
      <text class="ri-h" x="310" y="12">${name}</text>`;
    R.pairs.forEach(([i, j], k) => {
      const mx = 310, my = 30 + k * ((H - 50) / Math.max(1, R.pairs.length - 1));
      s += `<line class="ri-l" x1="150" y1="${yL(i)}" x2="${mx - 7}" y2="${my}"/><line class="ri-l" x1="${mx + 7}" y1="${my}" x2="455" y2="${yR(j)}"/>
        <polygon class="ri-x" points="${mx},${my - 6} ${mx + 7},${my} ${mx},${my + 6} ${mx - 7},${my}"/>`;
    });
    EMPS.forEach((e, i) => { s += `<circle class="ri-d${used.has(i) ? "" : " off"}" cx="150" cy="${yL(i)}" r="5"/><text class="ri-t" x="140" y="${yL(i)}" style="text-anchor:end">${e}</text>`; });
    R.right.forEach((d, j) => { s += `<circle class="ri-r${usedR.has(j) ? "" : " off"}" cx="460" cy="${yR(j)}" r="5"/><text class="ri-t" x="472" y="${yR(j)}" style="text-anchor:start">${d}</text>`; });
    s += "</svg>";
    svgHost.innerHTML = `<figure class="er" style="margin:0">${s}<figcaption>Her küçük eşkenar dörtgen bir <em>relationship instance</em>'tır (kitapta Figure 3.9, 3.12, 3.13). Gri noktalar ilişkiye katılmayan varlıklar.</figcaption></figure>`;
    note.innerHTML = `<strong>Kardinalite ${R.ratio}.</strong> ${R.note}`;
    for (const b of $$("button", seg)) b.setAttribute("aria-pressed", String(b.textContent === name));
  };
  for (const name of Object.keys(REL)) seg.append(h("button", { type: "button", onclick: () => draw(name) }, name));
  relHost.append(h("div", { class: "stepper" }, seg, note, svgHost));
  draw("WORKS_FOR");
}

// ---- (min, max) notation
put("minmax", erFigure({
  width: 640, height: 120,
  nodes: [
    { id: "E", type: "entity", x: 90, y: 60, label: "EMPLOYEE" },
    { id: "W", type: "rel", x: 320, y: 60, label: "WORKS_FOR" },
    { id: "D", type: "entity", x: 550, y: 60, label: "DEPARTMENT" },
  ],
  links: [{ a: "W", b: "E", card: "(1,1)", cardSide: -12, cardAtEntity: true }, { a: "W", b: "D", card: "(4,N)", cardSide: -12, cardAtEntity: true }],
}, "(min, max) gösterimi: her EMPLOYEE, WORKS_FOR'a en az 1 en çok 1 kez katılır (1,1); her DEPARTMENT en az 4 en çok N kez katılır (4,N). Dikkat: (min,max) değeri <em>kendi varlığının yanına</em> yazılır, 1:N gösteriminin tersine.", { small: true }));

// ---- ternary relationship
put("ternary", erFigure({
  width: 640, height: 220,
  nodes: [
    { id: "S", type: "entity", x: 90, y: 60, label: "SUPPLIER" },
    { id: "P", type: "entity", x: 550, y: 60, label: "PROJECT" },
    { id: "PA", type: "entity", x: 320, y: 190, label: "PART" },
    { id: "SU", type: "rel", x: 320, y: 60, label: "SUPPLY" },
    { id: "q", type: "attr", x: 320, y: 10, label: "Quantity", of: "SU" },
  ],
  links: [{ a: "SU", b: "S", card: "M" }, { a: "SU", b: "P", card: "N" }, { a: "SU", b: "PA", card: "P" }],
}, "Üçlü (ternary) ilişki: SUPPLY(s, j, p) = \"s tedarikçisi j projesine p parçasını sağlıyor\" (Figure 3.17). Üç ikili ilişki (CAN_SUPPLY, USES, SUPPLIES) bunu aynı anlamla ifade edemez.", { small: true }));
