// FDs and normalization (Ch 14, slides 1–55): ruling out FDs from a relation state, and a normalization tool that
// finds keys and the highest normal form, says which FD breaks the next one, and decomposes step by step
// (each step: the relation before → the two relations after, with the NJB test).
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { relationTable } from "../lib/sqlbox.js";
import { parseFDs, parseAttrs, closure, analyze, decompose, njb, checkOnRows, lostFDs, fmt, fmtFD } from "../lib/fd.js";
import { t as tl } from "../lib/i18n.js";

const NF_NAME = { 1: "1NF", 2: "2NF", 3: "3NF", 4: "BCNF" };

// ---- the book's examples
const PRESETS = {
  emp_proj: { name: "EMP_PROJ", attrs: "Ssn Pnumber Hours Ename Pname Plocation", fds: "Ssn, Pnumber -> Hours\nSsn -> Ename\nPnumber -> Pname, Plocation", target: "2NF", src: "Figure 14.11a" },
  emp_dept: { name: "EMP_DEPT", attrs: "Ename Ssn Bdate Address Dnumber Dname Dmgr_ssn", fds: "Ssn -> Ename, Bdate, Address, Dnumber\nDnumber -> Dname, Dmgr_ssn", target: "3NF", src: "Figure 14.11b" },
  lots: { name: "LOTS", attrs: "Property_id County_name Lot Area Price Tax_rate", fds: "Property_id -> County_name, Lot, Area, Price, Tax_rate\nCounty_name, Lot -> Property_id, Area, Price, Tax_rate\nCounty_name -> Tax_rate\nArea -> Price", target: "3NF", src: "Figure 14.12" },
  lots1a: { name: "LOTS1A", attrs: "Property_id County_name Lot Area", fds: "Property_id -> County_name, Lot, Area\nCounty_name, Lot -> Property_id, Area\nArea -> County_name", target: "BCNF", src: "Figure 14.13a" },
  teach: { name: "TEACH", attrs: "Student Course Instructor", fds: "Student, Course -> Instructor\nInstructor -> Course", target: "BCNF", src: "Figure 14.14" },
  chain: { name: "R", attrs: "A B C D", fds: "A -> B\nB -> C\nC -> D", target: "BCNF", src: tl("sınama sorusu", "test question") },
};

/** A relation as "NAME(attrs)" with its candidate keys underlined (the first key) and other key attributes dotted. */
function relationLine(name, R, fds) {
  const a = analyze(R, fds);
  const key = a.keys[0] || [];
  return h("div", { class: "nf-rel" }, h("strong", {}, name), "(",
    ...R.flatMap((x, i) => [i ? ", " : "", h("span", { class: key.includes(x) ? "pk" : a.prime.includes(x) ? "nf-prime" : null }, x)]), ")",
    h("span", { class: `nf-badge nf${a.nf}` }, NF_NAME[a.nf]));
}

/** Sentences: the keys, the prime attributes, and why R is in its normal form and not in the next one. */
function explain(R, fds) {
  const a = analyze(R, fds);
  const keys = a.keys.map(fmt).join(tl(" ve ", " and "));
  const out = [
    tl(`Aday ${a.keys.length > 1 ? "anahtarlar" : "anahtar"}: ${keys}. Asal öznitelikler: ${a.prime.join(", ") || "yok"}; asal olmayanlar: ${a.nonprime.join(", ") || "yok"}.`,
      `Candidate ${a.keys.length > 1 ? "keys" : "key"}: ${keys}. Prime attributes: ${a.prime.join(", ") || "none"}; nonprime: ${a.nonprime.join(", ") || "none"}.`),
  ];
  const v = a.nf === 1 ? a.violations["2NF"][0] : a.nf === 2 ? a.violations["3NF"][0] : a.nf === 3 ? a.violations.BCNF[0] : null;
  if (!v) out.push(tl("Her bağımlılığın sol tarafı bir süper anahtardır, bu yüzden ilişki BCNF'tedir.", "The left side of every dependency is a superkey, so the relation is in BCNF."));
  else if (a.nf === 1) out.push(tl(`İlişki 2NF'te değildir: ${fmtFD(v)} bir kısmi bağımlılıktır. ${fmt(v.lhs)}, ${fmt(v.key)} anahtarının yalnızca bir parçasıdır ve asal olmayan ${v.rhs.join(", ")} ona bağlıdır.`,
    `The relation is not in 2NF: ${fmtFD(v)} is a partial dependency. ${fmt(v.lhs)} is only part of the key ${fmt(v.key)}, and the nonprime ${v.rhs.join(", ")} depends on it.`));
  else if (a.nf === 2) out.push(tl(`İlişki 2NF'tedir ama 3NF'te değildir: ${fmtFD(v)} bağımlılığında ${fmt(v.lhs)} bir süper anahtar değildir ve ${v.rhs.join(", ")} asal değildir. Bu bir geçişli bağımlılıktır: anahtar → ${fmt(v.lhs)} → ${fmt(v.rhs)}.`,
    `The relation is in 2NF but not in 3NF: in ${fmtFD(v)}, ${fmt(v.lhs)} is not a superkey and ${v.rhs.join(", ")} is not prime. This is a transitive dependency: key → ${fmt(v.lhs)} → ${fmt(v.rhs)}.`));
  else out.push(tl(`İlişki 3NF'tedir ama BCNF'te değildir: ${fmtFD(v)} bağımlılığında ${fmt(v.lhs)} bir süper anahtar değildir. 3NF buna izin verir, çünkü ${v.rhs.join(", ")} asal bir özniteliktir; BCNF ise izin vermez.`,
    `The relation is in 3NF but not in BCNF: in ${fmtFD(v)}, ${fmt(v.lhs)} is not a superkey. 3NF allows this because ${v.rhs.join(", ")} is a prime attribute; BCNF does not.`));
  return { a, text: out };
}

/** The analysis and the step-by-step decomposition of one relation. */
function normalize(host, { name, attrs, fds, target }) {
  const R = parseAttrs(attrs), F = parseFDs(fds);
  if (!R.length || R.length > 12) { host.replaceChildren(h("div", { class: "res-msg warn" }, tl("1 ile 12 arasında öznitelik yazın.", "Write between 1 and 12 attributes."))); return; }
  const unknown = [...new Set(F.flatMap((f) => [...f.lhs, ...f.rhs]))].filter((x) => !R.includes(x));
  if (unknown.length) { host.replaceChildren(h("div", { class: "res-msg warn" }, tl(`Bağımlılıklarda şemada olmayan öznitelikler var: ${unknown.join(", ")}.`, `The dependencies use attributes that are not in the schema: ${unknown.join(", ")}.`))); return; }
  const { a, text } = explain(R, F);
  const closures = h("ul", { class: "small" }, ...F.map((f) => h("li", {}, `${fmtFD(f)} · ${fmt(f.lhs)}⁺ = {${closure(f.lhs, F).filter((x) => R.includes(x)).join(", ")}}`)));
  const d = decompose(R, F, target);
  const stepsEl = h("ol", { class: "map-steps" });
  let k = 0, counter = 0;
  // the split-off part X ∪ A gets a new numbered name; the remaining part R − A keeps the name of the relation it came from
  const names = new Map([[R.join(","), name]]);
  for (const s of d.steps) {
    k++;
    const from = names.get(s.from.join(",")) || name;
    const nm1 = `${name}${++counter}`, nm2 = from;
    names.set(s.into[0].join(","), nm1); names.set(s.into[1].join(","), nm2);
    const kind = { partial: tl("kısmi bağımlılık (2NF ihlali)", "a partial dependency (2NF violation)"), transitive: tl("geçişli bağımlılık (3NF ihlali)", "a transitive dependency (3NF violation)"), prime: tl("sol tarafı süper anahtar olmayan bağımlılık (BCNF ihlali)", "a dependency whose left side is not a superkey (BCNF violation)") }[s.by.kind];
    const j = s.njb;
    stepsEl.append(h("li", {},
      h("div", { class: "step-title" }, tl(`Adım ${k}: ${fmtFD(s.by)} ile ayrıştırma`, `Step ${k}: decomposing by ${fmtFD(s.by)}`)),
      h("div", {}, tl(`${fmtFD(s.by)}, ${kind}. ${fmt(s.by.lhs)} ve belirlediği öznitelikler yeni bir ilişkiye alınır (X ∪ A); geri kalan ilişkiden ${s.by.rhs.join(", ")} çıkarılır (R − A) ve ilişki adını korur.`,
        `${fmtFD(s.by)} is ${kind}. ${fmt(s.by.lhs)} and the attributes it determines go into a new relation (X ∪ A); ${s.by.rhs.join(", ")} is removed from the rest (R − A), which keeps its name.`)),
      h("div", { class: "ba" },
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), relationLine(from, s.from, F)),
        h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), relationLine(nm1, s.into[0], F), relationLine(nm2, s.into[1], F))),
      h("div", { class: `small ${j.ok ? "nf-ok" : "nf-bad"}` }, j.ok
        ? tl(`NJB testi: ortak öznitelik${j.common.length > 1 ? "ler" : ""} ${fmt(j.common)}, ${fmt(j.determines)} kısmını belirliyor; ayrıştırma kayıpsızdır.`, `NJB test: the common attribute${j.common.length > 1 ? "s" : ""} ${fmt(j.common)} determine${j.common.length > 1 ? "" : "s"} ${fmt(j.determines)}; the decomposition is lossless.`)
        : tl(`NJB testi: ortak öznitelikler ${fmt(j.common)} iki parçanın geri kalanını da belirlemiyor; bu ayrıştırma sahte satırlar üretebilir.`, `NJB test: the common attributes ${fmt(j.common)} determine the rest of neither part; this decomposition can produce spurious tuples.`))));
  }
  const kids = [h("div", { class: "nf-summary" }, relationLine(name, R, F), ...text.map((t) => h("p", {}, t))),
    h("details", { class: "disclosure" }, h("summary", {}, tl("Kapanışlar", "Closures")), h("div", { class: "disclosure-body" }, closures))];
  if (d.steps.length) {
    kids.push(h("h4", {}, tl(`${target}'e ayrıştırma, adım adım`, `Decomposition into ${target}, step by step`)), stepsEl,
      h("h4", {}, tl(`Sonuç: ${d.result.length} ilişki`, `Result: ${d.result.length} relations`)),
      h("div", { class: "nf-result" }, ...d.result.map((r) => relationLine(names.get(r.join(",")) || "R", r, F))));
    const gone = lostFDs(F, d.result);
    kids.push(h("p", { class: "small muted" }, gone.length
      ? tl(`Bu ayrıştırmanın korumadığı bağımlılık${gone.length > 1 ? "lar" : ""}: ${gone.map(fmtFD).join("; ")}. Parçaların hiçbirinde, tek başına ya da birlikte, kontrol edilemez. Bağımlılıkların korunmasından bu şekilde vazgeçilebilir; kayıpsız join ise her adımda korunur.`,
        `Dependenc${gone.length > 1 ? "ies" : "y"} this decomposition does not preserve: ${gone.map(fmtFD).join("; ")}. ${gone.length > 1 ? "They" : "It"} cannot be checked in the parts, alone or together. Preserving dependencies can be given up in this way; the lossless join is kept at every step.`)
      : tl("Bütün bağımlılıklar korunuyor: her biri parçaların üzerinden kontrol edilebilir.", "All the dependencies are preserved: each can be checked through the parts.")));
  } else if (a.nf >= { "2NF": 2, "3NF": 3, BCNF: 4 }[target]) {
    kids.push(h("p", { class: "small muted" }, tl(`İlişki zaten ${target}'te (ya da daha yüksek bir normal formda); ayrıştırmaya gerek yok.`, `The relation is already in ${target} (or higher); no decomposition is needed.`)));
  }
  host.replaceChildren(...kids);
}

// ---- the book's examples inside the sections
const preset = (id, hostId, extraTargets) => {
  const p = PRESETS[id], host = $(`#${hostId}`);
  if (!host) return;
  const body = h("div");
  if (extraTargets) {
    const seg = h("div", { class: "stepper-steps", role: "group" });
    const show = (t) => { for (const b of seg.children) b.setAttribute("aria-pressed", String(b.textContent.startsWith(t))); normalize(body, { ...p, target: t }); };
    for (const t of extraTargets) seg.append(h("button", { type: "button", onclick: () => show(t) }, tl(`${t}'e ayrıştır`, `Decompose into ${t}`)));
    host.append(h("div", { class: "stepper" }, seg, body));
    show(extraTargets[0]);
  } else {
    host.append(h("div", { class: "stepper" }, h("p", { class: "small muted" }, `${p.name} (${p.src}): ${p.fds.split("\n").join("; ").replace(/->/g, "→")}`), body));
    normalize(body, p);
  }
};
preset("emp_proj", "nf-emp-proj");
preset("emp_dept", "nf-emp-dept");
preset("lots", "nf-lots", ["2NF", "3NF", "BCNF"]);
preset("teach", "nf-teach");

// ---- NJB on the three decompositions of TEACH
{
  const F = parseFDs(PRESETS.teach.fds);
  const D = [["D1", ["Student", "Instructor"], ["Student", "Course"]], ["D2", ["Course", "Instructor"], ["Course", "Student"]], ["D3", ["Instructor", "Course"], ["Instructor", "Student"]]];
  const out = h("div");
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const show = (i) => {
    for (const [k, b] of [...seg.children].entries()) b.setAttribute("aria-pressed", String(k === i));
    const [, R1, R2] = D[i], j = njb(R1, R2, F);
    out.replaceChildren(h("div", { class: "ba" },
      h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), relationLine("TEACH", ["Student", "Course", "Instructor"], F)),
      h("div", { class: "ba-arrow", "aria-hidden": "true" }),
      h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), relationLine("R1", R1, F), relationLine("R2", R2, F))),
      h("p", { class: j.ok ? "nf-ok" : "nf-bad" }, tl(`R1 ∩ R2 = ${fmt(j.common)}. ${fmt(j.common)} → ${fmt(j.left)} ${closure(j.common, F).filter((x) => j.left.includes(x)).length === j.left.length ? "sağlanır" : "sağlanmaz"}; ${fmt(j.common)} → ${fmt(j.right)} ${closure(j.common, F).filter((x) => j.right.includes(x)).length === j.right.length ? "sağlanır" : "sağlanmaz"}. ${j.ok ? "Ayrıştırma kayıpsızdır." : "Ayrıştırma kayıplıdır: join sahte satırlar üretebilir."}`,
        `R1 ∩ R2 = ${fmt(j.common)}. ${fmt(j.common)} → ${fmt(j.left)} ${closure(j.common, F).filter((x) => j.left.includes(x)).length === j.left.length ? "holds" : "does not hold"}; ${fmt(j.common)} → ${fmt(j.right)} ${closure(j.common, F).filter((x) => j.right.includes(x)).length === j.right.length ? "holds" : "does not hold"}. ${j.ok ? "The decomposition is lossless." : "The decomposition is lossy: the join can produce spurious tuples."}`)));
  };
  D.forEach(([n], i) => seg.append(h("button", { type: "button", onclick: () => show(i) }, n)));
  $("#njb-teach").append(h("div", { class: "stepper" }, seg, out));
  show(0);
}

// ---- ruling out FDs from a relation state (Figures 14.7 and 14.8)
{
  const DATA = {
    teach: { label: tl("TEACH (Figure 14.7)", "TEACH (Figure 14.7)"), cols: ["Teacher", "Course", "Text"],
      rows: [["Smith", "Data Structures", "Bartram"], ["Smith", "Data Management", "Martin"], ["Hall", "Compilers", "Hoffman"], ["Brown", "Data Structures", "Horowitz"]] },
    r: { label: tl("R(A, B, C, D) (Figure 14.8)", "R(A, B, C, D) (Figure 14.8)"), cols: ["A", "B", "C", "D"],
      rows: [["a1", "b1", "c1", "d1"], ["a1", "b2", "c2", "d2"], ["a2", "b2", "c2", "d3"], ["a3", "b3", "c4", "d3"]] },
  };
  const sel = h("select", { "aria-label": tl("Tablo", "Table") }, ...Object.entries(DATA).map(([k, d]) => h("option", { value: k }, d.label)));
  const xs = h("span", { class: "nf-picks" }), ys = h("span", { class: "nf-picks" });
  const out = h("div");
  const picks = (host, cols, def) => host.replaceChildren(...cols.map((c) => h("label", { class: "nf-pick" }, h("input", { type: "checkbox", value: c, checked: def.includes(c) || null, onchange: run }), c)));
  function run() {
    const d = DATA[sel.value];
    const X = [...xs.querySelectorAll("input:checked")].map((i) => i.value), Y = [...ys.querySelectorAll("input:checked")].map((i) => i.value);
    if (!X.length || !Y.length) { out.replaceChildren(relationTable(d.cols, null, d.rows), h("p", { class: "small muted" }, tl("X ve Y için en az birer öznitelik seçin.", "Choose at least one attribute for X and for Y."))); return; }
    const r = checkOnRows(d.cols, d.rows, X, Y);
    out.replaceChildren(relationTable(d.cols, null, d.rows, { rowClass: (_, i) => (r?.rows?.includes(i) ? "drop" : null) }),
      h("p", { class: r ? "nf-bad" : "nf-ok" }, r
        ? tl(`${fmt(X)} → ${fmt(Y)} elenir: ${r.rows[0] + 1}. ve ${r.rows[1] + 1}. satırların ${fmt(X)} değerleri aynı, ${fmt(Y)} değerleri farklı (kırmızı).`, `${fmt(X)} → ${fmt(Y)} is ruled out: rows ${r.rows[0] + 1} and ${r.rows[1] + 1} have the same ${fmt(X)} but different ${fmt(Y)} (red).`)
        : tl(`${fmt(X)} → ${fmt(Y)} bu duruma göre olabilir: ${fmt(X)} değerleri aynı olan her satır çiftinin ${fmt(Y)} değerleri de aynı. (Bu, FD'nin var olduğunu kanıtlamaz; yalnızca bu satırların onu bozmadığını gösterir.)`, `${fmt(X)} → ${fmt(Y)} may exist in this state: every pair of rows with the same ${fmt(X)} also has the same ${fmt(Y)}. (This does not prove that the FD exists; it only shows these rows do not break it.)`)));
  }
  const load = () => { const d = DATA[sel.value]; picks(xs, d.cols, [d.cols[sel.value === "teach" ? 0 : 1]]); picks(ys, d.cols, [d.cols[sel.value === "teach" ? 1 : 2]]); run(); };
  sel.addEventListener("change", load);
  $("#fd-check").append(h("div", { class: "stepper" },
    h("div", { class: "btn-row", style: { alignItems: "center" } }, h("label", { class: "small" }, tl("Tablo: ", "Table: "), sel)),
    h("div", { class: "small" }, h("strong", {}, "X: "), xs), h("div", { class: "small" }, h("strong", {}, "Y: "), ys), out));
  load();
}

// ---- the free tool
{
  const nameIn = h("input", { type: "text", value: "EMP_PROJ", "aria-label": tl("İlişkinin adı", "Name of the relation"), size: 12 });
  const attrsIn = h("input", { type: "text", "aria-label": tl("Öznitelikler", "Attributes"), class: "nf-attrs" });
  const fdsIn = h("textarea", { rows: 5, spellcheck: "false", "aria-label": tl("Fonksiyonel bağımlılıklar", "Functional dependencies"), class: "nf-fds" });
  const targetSel = h("select", { "aria-label": tl("Hedef normal form", "Target normal form") }, ...["2NF", "3NF", "BCNF"].map((t) => h("option", { value: t }, t)));
  const out = h("div");
  const run = () => normalize(out, { name: nameIn.value.trim() || "R", attrs: attrsIn.value, fds: fdsIn.value, target: targetSel.value });
  const load = (id) => { const p = PRESETS[id]; nameIn.value = p.name; attrsIn.value = p.attrs; fdsIn.value = p.fds; targetSel.value = p.target; run(); };
  for (const el of [nameIn, attrsIn, fdsIn]) el.addEventListener("input", run);
  targetSel.addEventListener("change", run);
  $("#nf-tool").append(h("div", { class: "stepper" },
    h("div", { class: "btn-row" }, ...Object.entries(PRESETS).map(([id, p]) => h("button", { type: "button", class: "btn small", onclick: () => load(id) }, `${p.name} · ${p.src}`))),
    h("div", { class: "nf-form" },
      h("label", { class: "small" }, tl("Ad", "Name"), nameIn),
      h("label", { class: "small" }, tl("Öznitelikler", "Attributes"), attrsIn),
      h("label", { class: "small" }, tl("Fonksiyonel bağımlılıklar (her satıra bir tane)", "Functional dependencies (one per line)"), fdsIn),
      h("label", { class: "small" }, tl("Hedef", "Target"), targetSel)),
    out));
  load("emp_proj");
}

// ---------------------------------------------------------------- the FD diagram (the book's style)
// The attributes in a row of boxes; each FD is a line under the row: a drop from every left-side attribute and an
// arrow up to every right-side attribute. The highlighted FD is drawn in the accent colour, a violating one in red.
const SVGNS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}, text) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
function fdDiagram(name, R, F, { hl = null, bad = false, keys = null } = {}) {
  const key = (keys || analyze(R, F).keys)[0] || [];
  const fds = F.filter((f) => f.lhs.every((a) => R.includes(a))).map((f) => ({ ...f, rhs: f.rhs.filter((a) => R.includes(a)) })).filter((f) => f.rhs.length);
  const cw = (t) => Math.max(54, t.length * 8.4 + 18);
  let x = 10;
  const box = new Map();
  for (const a of R) { const w = cw(a); box.set(a, { x, w, cx: x + w / 2 }); x += w + 6; }
  const W = x + 4, top = 26, bh = 30, gap = 16;
  const H = top + bh + gap * (fds.length + 1) + 4;
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "fd-svg", role: "img", "aria-label": `${name}: ${fds.map(fmtFD).join("; ")}` });
  const defs = sv("defs");
  for (const [id, col] of [["fd-ar", "var(--text-2)"], ["fd-ar-hl", "var(--accent)"], ["fd-ar-bad", "var(--critical)"]]) {
    const m = sv("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    m.append(sv("path", { d: "M0,0 L10,5 L0,10 z", style: `fill:${col}` })); defs.append(m);
  }
  svg.append(defs, sv("text", { x: 10, y: 16, class: "fd-name" }, name));
  for (const a of R) {
    const b = box.get(a);
    svg.append(sv("rect", { x: b.x, y: top, width: b.w, height: bh, rx: 3, class: "fd-box" + (key.includes(a) ? " key" : "") }));
    const t = sv("text", { x: b.cx, y: top + bh / 2 + 1, class: "fd-attr" + (key.includes(a) ? " key" : "") }, a);
    svg.append(t);
  }
  fds.forEach((f, i) => {
    const isHl = hl && fmtFD(hl) === fmtFD(f) || (hl && hl.lhs.join() === f.lhs.join() && hl.rhs.every((a) => f.rhs.includes(a)));
    const cls = isHl ? (bad ? "bad" : "hl") : "";
    const y = top + bh + gap * (i + 1);
    const xs = [...f.lhs, ...f.rhs].map((a) => box.get(a).cx);
    const g = sv("g", { class: "fd-line " + cls });
    g.append(sv("line", { x1: Math.min(...xs), x2: Math.max(...xs), y1: y, y2: y }));
    for (const a of f.lhs) g.append(sv("line", { x1: box.get(a).cx - 4, x2: box.get(a).cx - 4, y1: top + bh, y2: y }));
    for (const a of f.rhs) g.append(sv("line", { x1: box.get(a).cx + 4, x2: box.get(a).cx + 4, y1: y, y2: top + bh + 3, "marker-end": `url(#${isHl ? (bad ? "fd-ar-bad" : "fd-ar-hl") : "fd-ar"})` }));
    g.append(sv("title", {}, fmtFD(f)));
    svg.append(g);
  });
  return h("div", { class: "fd-diagram" }, svg);
}

/** X⁺ step by step: each round, the FD that fires and the set before and after it. */
function closureTrace(X, F) {
  const c = [...X], rounds = [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of F) if (f.lhs.every((a) => c.includes(a)) && f.rhs.some((a) => !c.includes(a))) {
      const before = [...c];
      f.rhs.forEach((a) => { if (!c.includes(a)) c.push(a); });
      rounds.push({ fd: f, before, after: [...c], added: c.filter((a) => !before.includes(a)) });
      grew = true;
    }
  }
  return { result: c, rounds };
}
const setChips = (all, added = []) => h("span", { class: "set-chips" }, "{", ...all.flatMap((a, i) => [i ? ", " : "", h("span", { class: added.includes(a) ? "new" : null }, a)]), "}");

// ---------------------------------------------------------------- closure, step by step
{
  const host = $("#closure-steps");
  if (host) {
    const pre = h("select", { "aria-label": tl("Örnek", "Example") }, ...Object.entries(PRESETS).map(([id, p]) => h("option", { value: id }, `${p.name} · ${p.src}`)));
    const xIn = h("input", { type: "text", size: 18, "aria-label": "X" });
    const out = h("div");
    const run = () => {
      const p = PRESETS[pre.value], R = parseAttrs(p.attrs), F = parseFDs(p.fds), X = parseAttrs(xIn.value).filter((a) => R.includes(a));
      if (!X.length) { out.replaceChildren(h("p", { class: "small muted" }, tl("X için şemadaki özniteliklerden en az birini yazın.", "Write at least one attribute of the schema for X."))); return; }
      const tr = closureTrace(X, F);
      const sk = R.every((a) => tr.result.includes(a));
      out.replaceChildren(fdDiagram(p.name, R, F),
        h("ol", { class: "map-steps" },
          h("li", {}, h("div", { class: "step-title" }, tl("Başlangıç", "Start")), h("div", {}, tl("X⁺ önce X'in kendisidir: ", "X⁺ starts as X itself: "), setChips(X, X))),
          ...tr.rounds.map((r, i) => h("li", {}, h("div", { class: "step-title" }, tl(`Adım ${i + 1}: ${fmtFD(r.fd)}`, `Step ${i + 1}: ${fmtFD(r.fd)}`)),
            h("div", { class: "small" }, tl(`Sol taraf ${fmt(r.fd.lhs)} kümede olduğu için sağ taraftaki ${r.added.join(", ")} eklenir.`, `The left side ${fmt(r.fd.lhs)} is in the set, so ${r.added.join(", ")} from the right side is added.`)),
            h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), setChips(r.before)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
              h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), setChips(r.after, r.added)))))),
        h("p", { class: sk ? "nf-ok" : "nf-bad" }, (tr.rounds.length ? tl("Hiçbir bağımlılık yeni öznitelik eklemiyor, hesap bitti. ", "No dependency adds anything new, so the computation stops. ") : tl("Hiçbir bağımlılığın sol tarafı kümede değil. ", "No dependency's left side is in the set. "))
          + (sk ? tl(`${fmt(X)}⁺ bütün öznitelikleri içerdiği için ${fmt(X)} bir süper anahtardır.`, `${fmt(X)}⁺ contains every attribute, so ${fmt(X)} is a superkey.`)
            : tl(`${fmt(X)}⁺ şu öznitelikleri içermiyor: ${R.filter((a) => !tr.result.includes(a)).join(", ")}. Bu yüzden ${fmt(X)} bir süper anahtar değildir.`, `${fmt(X)}⁺ is missing ${R.filter((a) => !tr.result.includes(a)).join(", ")}, so ${fmt(X)} is not a superkey.`))));
    };
    const load = () => { const p = PRESETS[pre.value]; xIn.value = parseFDs(p.fds)[0].lhs.join(", "); run(); };
    pre.addEventListener("change", load); xIn.addEventListener("input", run);
    host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, h("label", { class: "small sim-field" }, tl("Örnek: ", "Example: "), pre), h("label", { class: "small sim-field" }, "X = ", xIn)), out));
    load();
  }
}

// ---------------------------------------------------------------- anomalies, live
{
  const host = $("#anomaly-lab");
  if (host) {
    const COLS = ["Ename", "Ssn", "Dnumber", "Dname", "Dmgr_ssn"];
    const START = [["Smith", "123456789", 5, "Research", "333445555"], ["Wong", "333445555", 5, "Research", "333445555"], ["Zelaya", "999887777", 4, "Administration", "987654321"],
      ["Wallace", "987654321", 4, "Administration", "987654321"], ["Narayan", "666884444", 5, "Research", "333445555"], ["English", "453453453", 5, "Research", "333445555"],
      ["Jabbar", "987987987", 4, "Administration", "987654321"], ["Borg", "888665555", 1, "Headquarters", "888665555"]];
    const table = (rows, mark = {}) => h("div", { class: "table-wrap" }, h("table", { class: "simple anomaly" },
      h("thead", {}, h("tr", {}, ...COLS.map((c, i) => h("th", {}, i === 1 ? h("u", {}, c) : c)))),
      h("tbody", {}, ...rows.map((r, i) => h("tr", { class: mark.rows?.[i] || null }, ...r.map((v, j) => h("td", { class: mark.cells?.[`${i},${j}`] || null }, v == null ? "NULL" : String(v))))))));
    const ACTIONS = [
      { label: tl("Research'ün adını yalnızca Smith'in satırında 'R&D' yap", "Rename Research to 'R&D' in Smith's row only"), kind: tl("Güncelleme anomalisi", "Update anomaly"),
        run: (rows) => { const after = rows.map((r) => [...r]); after[0][3] = "R&D"; return { after, markBefore: { rows: Object.fromEntries(rows.map((r, i) => [i, r[2] === 5 ? "hl-row" : null])) }, markAfter: { cells: { "0,3": "cell-bad", "1,3": "cell-warn", "4,3": "cell-warn", "5,3": "cell-warn" } },
          text: tl("Departman 5'in adı dört satırda tekrar ediyor. Yalnızca birini değiştirince aynı departman numarası iki farklı adla görünür; veri tutarsız hâle gelir. Doğrusu dört satırın hepsini değiştirmektir, bu da tekrar eden verinin bedelidir.", "Department 5's name repeats in four rows. Changing only one makes the same department number appear with two names; the data becomes inconsistent. The correct way is to change all four rows, which is the price of repeated data.") }; } },
      { label: tl("Henüz çalışanı olmayan 6 numaralı Marketing departmanını ekle", "Insert department 6, Marketing, which has no employees yet"), kind: tl("Ekleme anomalisi", "Insert anomaly"),
        run: (rows) => { const after = [...rows.map((r) => [...r]), [null, null, 6, "Marketing", null]]; return { after, markAfter: { rows: { [rows.length]: "drop" }, cells: { [`${rows.length},1`]: "cell-bad" } },
          text: tl("Departmanın bilgisi ancak bir çalışan satırıyla birlikte saklanabiliyor. Çalışanı olmayan bir departman için Ename ve Ssn NULL kalır; Ssn primary key olduğu için bu satır entity integrity kuralını bozar ve reddedilir.", "Department data can only be stored together with an employee row. For a department with no employees Ename and Ssn are NULL; since Ssn is the primary key, the row breaks entity integrity and is rejected.") }; } },
      { label: tl("Borg'un satırını sil (Headquarters'ın tek çalışanı)", "Delete Borg's row (the only employee of Headquarters)"), kind: tl("Silme anomalisi", "Delete anomaly"),
        run: (rows) => { const after = rows.filter((r) => r[1] !== "888665555").map((r) => [...r]); return { after, markBefore: { rows: { 7: "drop" } },
          text: tl("Borg silindiğinde Headquarters departmanının adı ve yöneticisi de tablodan kaybolur, çünkü bu bilgi yalnızca onun satırında duruyordu. Departman hâlâ var ama artık hiçbir yerde kayıtlı değil.", "When Borg is deleted, the name and manager of Headquarters disappear too, because that information lived only in his row. The department still exists but is no longer recorded anywhere.") }; } },
    ];
    const out = h("div");
    const fix = h("div");
    const show = (i) => {
      [...seg.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      const a = ACTIONS[i], r = a.run(START);
      out.replaceChildren(h("p", {}, h("strong", {}, a.kind, ". "), a.text),
        h("div", { class: "ba ba-stack" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), table(START, r.markBefore)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), table(r.after, r.markAfter))));
      fix.replaceChildren(h("p", { class: "small" }, tl("Çözüm, EMP_DEPT'i 3NF'e ayrıştırmaktır: EMPLOYEE(Ename, Ssn, Dnumber) ve DEPARTMENT(Dnumber, Dname, Dmgr_ssn). Departmanın adı artık tek bir satırda durur, çalışanı olmayan departman eklenebilir ve son çalışanı silinen departman kaybolmaz.",
        "The fix is to decompose EMP_DEPT into 3NF: EMPLOYEE(Ename, Ssn, Dnumber) and DEPARTMENT(Dnumber, Dname, Dmgr_ssn). The department's name then lives in one row, a department without employees can be inserted, and a department does not vanish when its last employee is deleted.")));
    };
    const seg = h("div", { class: "stepper-steps", role: "group" }, ...ACTIONS.map((a, i) => h("button", { type: "button", onclick: () => show(i) }, a.kind)));
    host.append(h("div", { class: "player" }, seg, h("p", { class: "small muted" }, ...ACTIONS.map((a, i) => [i ? " · " : "", h("strong", {}, a.kind), ": ", a.label])), out, fix));
    show(0);
  }
}

// ---------------------------------------------------------------- normalization, step by step (player)
function nfSteps(p, target) {
  const R = parseAttrs(p.attrs), F = parseFDs(p.fds);
  const a = analyze(R, F);
  const steps = [];
  const k0 = a.keys[0];
  steps.push({ kind: "keys", R, name: p.name, trace: closureTrace(k0, F), a });
  const d = decompose(R, F, target);
  const names = new Map([[R.join(","), p.name]]);
  let counter = 0;
  let current = [[p.name, R]];
  for (const s of d.steps) {
    const from = names.get(s.from.join(",")) || p.name;
    const nm1 = `${p.name}${++counter}`;
    names.set(s.into[0].join(","), nm1); names.set(s.into[1].join(","), from);
    const before = current;
    current = current.flatMap(([n, r]) => (r.join(",") === s.from.join(",") ? [[nm1, s.into[0]], [from, s.into[1]]] : [[n, r]]));
    steps.push({ kind: "split", s, from, nm1, before, after: current, F });
  }
  steps.push({ kind: "done", result: current, F, lost: lostFDs(F, d.result), target, R, name: p.name, a });
  return { R, F, steps };
}
{
  const host = $("#nf-player");
  if (host) {
    const KIND = { partial: tl("kısmi bağımlılık: 2NF ihlali", "partial dependency: a 2NF violation"), transitive: tl("geçişli bağımlılık: 3NF ihlali", "transitive dependency: a 3NF violation"), prime: tl("sol tarafı süper anahtar değil: BCNF ihlali", "left side is not a superkey: a BCNF violation") };
    const render = (pid = "emp_proj", target = PRESETS.emp_proj.target, predictInit = false) => {
      const p = PRESETS[pid];
      const { F, steps } = nfSteps(p, target);
      let i = 0, predict = predictInit, asked = -1;
      const exSel = h("select", { onchange: () => render(exSel.value, PRESETS[exSel.value].target, predict) }, ...Object.entries(PRESETS).map(([id, q]) => h("option", { value: id, selected: id === pid }, `${q.name} · ${q.src}`)));
      const tgSel = h("select", { onchange: () => render(pid, tgSel.value, predict) }, ...["2NF", "3NF", "BCNF"].map((t) => h("option", { value: t, selected: t === target }, t)));
      const counter = h("span", { class: "pl-count" });
      const prev = button(tl("◀ Önceki", "◀ Previous"), () => go(i - 1, true));
      const next = button(tl("Sonraki ▶", "Next ▶"), () => go(i + 1), { kind: "primary" });
      const predictBox = h("input", { type: "checkbox", checked: predict, onchange: (e) => { predict = e.target.checked; } });
      const dots = h("div", { class: "pl-dots" }, ...steps.map((s, k) => h("button", { type: "button", class: "pl-dot", onclick: () => go(k, true) }, s.kind === "keys" ? tl("Anahtar", "Key") : s.kind === "done" ? tl("Sonuç", "Result") : String(k))));
      const body = h("div");
      host.replaceChildren(h("div", { class: "player" },
        h("div", { class: "pl-bar" }, h("label", { class: "small sim-field" }, tl("Örnek: ", "Example: "), exSel), h("label", { class: "small sim-field" }, tl("Hedef: ", "Target: "), tgSel)),
        h("div", { class: "pl-bar" }, prev, next, counter, h("label", { class: "small pl-predict" }, predictBox, tl(" Tahmin modu: ihlal eden bağımlılığı önce siz bulun", " Predict mode: find the violating dependency first"))),
        dots, body));
      const rels = (list, hlName, s) => h("div", { class: "nf-stack" }, ...list.map(([n, r]) => fdDiagram(n, r, F, n === hlName && s ? { hl: s.by, bad: true } : {})));
      const reveal = (k, verdict) => {
        const st = steps[k];
        if (st.kind === "keys") {
          body.replaceChildren(h("div", { class: "step-title" }, tl("1. Aday anahtarı bul", "1. Find the candidate key")),
            h("p", { class: "pl-rule" }, tl("Normal formlar anahtarlara dayandığı için önce aday anahtar bulunur. Bir küme X'in kapanışı X⁺ bütün öznitelikleri içeriyorsa X bir süper anahtardır; minimal olan süper anahtar aday anahtardır.", "Normal forms are defined in terms of keys, so the candidate key comes first. If the closure X⁺ of a set X contains every attribute, X is a superkey; a minimal superkey is a candidate key.")),
            fdDiagram(st.name, st.R, F, { keys: st.a.keys }),
            h("ol", { class: "map-steps" }, ...st.trace.rounds.map((r) => h("li", {}, h("div", { class: "small" }, h("strong", {}, fmtFD(r.fd)), tl(` ile ${r.added.join(", ")} eklenir.`, ` adds ${r.added.join(", ")}.`)),
              h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), setChips(r.before)), h("div", { class: "ba-arrow", "aria-hidden": "true" }), h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), setChips(r.after, r.added)))))),
            h("p", {}, tl(`${fmt(st.a.keys[0])}⁺ bütün öznitelikleri içeriyor ve hiçbir alt kümesi içermiyor, bu yüzden ${fmt(st.a.keys[0])} bir aday anahtardır.`, `${fmt(st.a.keys[0])}⁺ contains every attribute and none of its subsets does, so ${fmt(st.a.keys[0])} is a candidate key.`)
              + (st.a.keys.length > 1 ? tl(` Diğer aday anahtar${st.a.keys.length > 2 ? "lar" : ""}: ${st.a.keys.slice(1).map(fmt).join(", ")}.`, ` Other candidate key${st.a.keys.length > 2 ? "s" : ""}: ${st.a.keys.slice(1).map(fmt).join(", ")}.`) : "")
              + tl(` İlişki şu an ${NF_NAME[st.a.nf]}'de.`, ` The relation is currently in ${NF_NAME[st.a.nf]}.`)));
        } else if (st.kind === "split") {
          const s = st.s, j = s.njb;
          body.replaceChildren(h("div", { class: "step-title" }, tl(`${k + 1}. ${st.from} ilişkisini ${fmtFD(s.by)} ile ayrıştır`, `${k + 1}. Decompose ${st.from} by ${fmtFD(s.by)}`)), verdict || "",
            h("p", { class: "pl-rule" }, tl(`${fmtFD(s.by)} bir ${KIND[s.by.kind]}. Kural: X → A ihlal ediyorsa, X ile belirlediği öznitelikler yeni bir ilişkiye alınır (X ∪ A) ve eski ilişkiden A çıkarılır (R − A). X iki parçada da kaldığı için join kayıpsızdır.`,
              `${fmtFD(s.by)} is a ${KIND[s.by.kind]}. Rule: if X → A violates the form, X and what it determines go into a new relation (X ∪ A) and A is removed from the old one (R − A). X stays in both parts, so the join is lossless.`)),
            h("div", { class: "ba ba-stack" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce: ihlal eden bağımlılık kırmızı", "Before: the violating dependency in red")), rels(st.before, st.from, s)),
              h("div", { class: "ba-arrow", "aria-hidden": "true" }),
              h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl(`Sonra: ${st.nm1} = X ∪ A, ${st.from} = R − A`, `After: ${st.nm1} = X ∪ A, ${st.from} = R − A`)), rels(st.after))),
            h("p", { class: `small ${j.ok ? "nf-ok" : "nf-bad"}` }, j.ok ? tl(`NJB testi: ortak öznitelik ${fmt(j.common)}, ${fmt(j.determines)} kısmını belirliyor; ayrıştırma kayıpsız.`, `NJB test: the common attribute ${fmt(j.common)} determines ${fmt(j.determines)}; the decomposition is lossless.`) : tl("NJB testi başarısız.", "The NJB test fails.")));
        } else {
          body.replaceChildren(h("div", { class: "step-title" }, tl(`Sonuç: ${st.result.length} ilişki, hepsi en az ${st.target}`, `Result: ${st.result.length} relations, all at least in ${st.target}`)),
            h("div", { class: "nf-result" }, ...st.result.map(([n, r]) => relationLine(n, r, F))), rels(st.result),
            h("p", { class: "small" }, st.result.length === 1 ? tl(`${st.name} zaten ${st.target}'te; ayrıştırmaya gerek yok.`, `${st.name} is already in ${st.target}; no decomposition is needed.`)
              : st.lost.length ? tl(`Korunmayan bağımlılık: ${st.lost.map(fmtFD).join("; ")}. BCNF'e ayrıştırma bazen bir bağımlılığı feda eder; kayıpsız join ise her zaman korunur.`, `Dependency not preserved: ${st.lost.map(fmtFD).join("; ")}. Decomposing into BCNF sometimes sacrifices a dependency; the lossless join is always kept.`)
              : tl("Bütün bağımlılıklar korunuyor ve her ayrıştırma kayıpsız.", "Every dependency is preserved and every decomposition is lossless.")));
        }
      };
      const ask = (k) => {
        const st = steps[k];
        const r = st.before.find(([n]) => n === st.from)[1];
        const opts = analyze(r, F).fds;
        body.replaceChildren(h("div", { class: "step-title" }, tl(`${st.from} henüz ${target}'te değil. Hangi bağımlılık ihlal ediyor?`, `${st.from} is not in ${target} yet. Which dependency violates it?`)),
          fdDiagram(st.from, r, F),
          h("div", { class: "quiz-options" }, ...opts.map((f) => h("button", { type: "button", onclick: () => {
            const ok = f.lhs.join() === st.s.by.lhs.join();
            reveal(k, h("div", { class: `res-msg ${ok ? "ok" : "warn"}` }, ok ? tl("Doğru: ilk ele alınan ihlal bu.", "Right: this is the violation handled first.") : tl(`Seçtiğiniz ${fmtFD(f)} ${isSkOf(f.lhs, r) ? tl("sol tarafı bir süper anahtar olduğu için ihlal değildir.", "is not a violation, because its left side is a superkey.") : tl(`de sorunlu olabilir, ama algoritma önce ${fmtFD(st.s.by)} ile başlar (önce 2NF, sonra 3NF ihlalleri).`, `may also be a problem, but the algorithm starts with ${fmtFD(st.s.by)} (2NF violations first, then 3NF).`)}`, `You chose ${fmtFD(f)}: ${isSkOf(f.lhs, r) ? "its left side is a superkey, so it is not a violation." : `it may also be a problem, but the algorithm starts with ${fmtFD(st.s.by)} (2NF violations first, then 3NF).`}`)));
          } }, fmtFD(f)))));
      };
      const isSkOf = (X, r) => r.every((a) => closure(X, F).includes(a));
      function go(k, jump = false) {
        i = Math.max(0, Math.min(steps.length - 1, k));
        counter.textContent = tl(`Adım ${i + 1} / ${steps.length}`, `Step ${i + 1} of ${steps.length}`);
        [...dots.children].forEach((d, j) => { d.classList.toggle("on", j === i); d.classList.toggle("past", j < i); });
        prev.disabled = i === 0; next.disabled = i === steps.length - 1;
        if (predict && !jump && steps[i].kind === "split" && asked < i) { asked = i; ask(i); } else reveal(i);
      }
      go(0, true);
    };
    render();
  }
}

// ---------------------------------------------------------------- you decide (normal forms), with a reset per question
// After each answer: why each option is right or wrong, the FD diagram, and the decomposition step by step (before/after).
const ND = [
  { p: "emp_proj", q: tl("EMP_PROJ(Ssn, Pnumber, Hours, Ename, Pname, Plocation) en yüksek hangi normal formda?", "What is the highest normal form of EMP_PROJ(Ssn, Pnumber, Hours, Ename, Pname, Plocation)?"),
    opts: [["1NF", true, tl("Doğru. Anahtar {Ssn, Pnumber}; Ssn → Ename ve Pnumber → Pname, Plocation anahtarın bir parçasına bağlı kısmi bağımlılıklardır, bu yüzden 2NF sağlanmaz.", "Right. The key is {Ssn, Pnumber}; Ssn → Ename and Pnumber → Pname, Plocation depend on part of the key, which are partial dependencies, so 2NF fails.")],
      ["2NF", false, tl("2NF için asal olmayan her özniteliğin anahtarın tamamına bağlı olması gerekir. Ename yalnızca Ssn'e, yani anahtarın bir parçasına bağlı.", "2NF needs every nonprime attribute to depend on the whole key. Ename depends only on Ssn, a part of the key.")],
      ["3NF", false, tl("3NF, 2NF'i de gerektirir; ilişki 2NF'te bile değil.", "3NF requires 2NF as well, and the relation is not even in 2NF.")]] },
  { p: "emp_dept", q: tl("EMP_DEPT(Ename, Ssn, Bdate, Address, Dnumber, Dname, Dmgr_ssn) en yüksek hangi normal formda?", "What is the highest normal form of EMP_DEPT(Ename, Ssn, Bdate, Address, Dnumber, Dname, Dmgr_ssn)?"),
    opts: [["1NF", false, tl("Anahtar tek öznitelikli (Ssn) olduğu için kısmi bağımlılık olamaz; ilişki en az 2NF'tedir.", "The key has a single attribute (Ssn), so there can be no partial dependency; the relation is at least in 2NF.")],
      ["2NF", true, tl("Doğru. Ssn → Dnumber → Dname, Dmgr_ssn geçişli bir bağımlılıktır: Dnumber süper anahtar değil ve Dname asal değil. Bu yüzden 3NF sağlanmaz.", "Right. Ssn → Dnumber → Dname, Dmgr_ssn is a transitive dependency: Dnumber is not a superkey and Dname is not prime, so 3NF fails.")],
      ["BCNF", false, tl("Dnumber → Dname bağımlılığının sol tarafı süper anahtar değil; bu hem 3NF'i hem BCNF'i bozar.", "The left side of Dnumber → Dname is not a superkey; that breaks both 3NF and BCNF.")]] },
  { p: "teach", q: tl("TEACH(Student, Course, Instructor); {Student, Course} → Instructor ve Instructor → Course. En yüksek normal form hangisi?", "TEACH(Student, Course, Instructor); {Student, Course} → Instructor and Instructor → Course. What is the highest normal form?"),
    opts: [["2NF", false, tl("Kısmi ya da geçişli bağımlılık yok: Instructor → Course'ta sağ taraf Course asal bir özniteliktir.", "There is no partial or transitive dependency: in Instructor → Course the right side, Course, is a prime attribute.")],
      ["3NF", true, tl("Doğru. Aday anahtarlar {Student, Course} ve {Student, Instructor}; Course asal olduğu için Instructor → Course 3NF'e uyar. Ama Instructor süper anahtar olmadığı için BCNF'e uymaz.", "Right. The candidate keys are {Student, Course} and {Student, Instructor}; Course is prime, so Instructor → Course is allowed by 3NF. Instructor is not a superkey, so BCNF fails.")],
      ["BCNF", false, tl("BCNF her bağımlılığın sol tarafının süper anahtar olmasını ister. Instructor tek başına bir süper anahtar değil.", "BCNF needs the left side of every dependency to be a superkey. Instructor alone is not a superkey.")]] },
  { p: "chain", q: tl("R(A, B, C, D) için A → B, B → C, C → D. Aday anahtar hangisi?", "For R(A, B, C, D) with A → B, B → C, C → D, what is the candidate key?"),
    opts: [["{A}", true, tl("Doğru. A⁺ = {A, B, C, D}: A → B ile B, B → C ile C, C → D ile D eklenir. A'yı hiçbir bağımlılık belirlemediği için her anahtarda bulunmak zorundadır.", "Right. A⁺ = {A, B, C, D}: A → B adds B, B → C adds C, C → D adds D. No dependency determines A, so it must be in every key.")],
      ["{A, B}", false, tl("{A, B} bir süper anahtardır ama minimal değildir: B çıkarılınca kalan {A} hâlâ her şeyi belirler.", "{A, B} is a superkey but not minimal: without B, {A} still determines everything.")],
      ["{D}", false, tl("D⁺ = {D}; D hiçbir şeyi belirlemez. Bağımlılık zincirinin sonu anahtar olamaz.", "D⁺ = {D}; D determines nothing. The end of a dependency chain cannot be a key.")]] },
  { p: "lots", q: tl("LOTS'ta County_name → Tax_rate hangi normal formu bozar? (Aday anahtarlar Property_id ve {County_name, Lot}.)", "In LOTS, which normal form does County_name → Tax_rate break? (The candidate keys are Property_id and {County_name, Lot}.)"),
    opts: [["2NF", true, tl("Doğru. County_name, {County_name, Lot} aday anahtarının bir parçasıdır ve asal olmayan Tax_rate ona bağlıdır: kısmi bağımlılık. Kitap bu yüzden LOTS'u önce LOTS1 ve LOTS2'ye ayırır.", "Right. County_name is part of the candidate key {County_name, Lot} and the nonprime Tax_rate depends on it: a partial dependency. That is why the book first splits LOTS into LOTS1 and LOTS2.")],
      [tl("Yalnız 3NF", "3NF only"), false, tl("Geçişli bağımlılık gibi görünse de sol taraf bir aday anahtarın parçası; genel tanımla bu önce 2NF'i bozar.", "It may look transitive, but the left side is part of a candidate key; by the general definition it breaks 2NF first.")],
      [tl("Hiçbirini", "None"), false, tl("County_name süper anahtar değil ve Tax_rate asal değil; bu bağımlılık en azından 3NF'i bozar.", "County_name is not a superkey and Tax_rate is not prime; this dependency breaks at least 3NF.")]] },
  { p: "lots", q: tl("LOTS'ta Area → Price hangi normal formu bozar?", "In LOTS, which normal form does Area → Price break?"),
    opts: [["2NF", false, tl("Area hiçbir aday anahtarın parçası değil, bu yüzden kısmi bağımlılık değildir.", "Area is not part of any candidate key, so this is not a partial dependency.")],
      ["3NF", true, tl("Doğru. Area süper anahtar değil, Price asal değil ve Area bir anahtarın parçası da değil: geçişli bağımlılık. 2NF'e uyar ama 3NF'i bozar.", "Right. Area is not a superkey, Price is not prime and Area is not part of a key: a transitive dependency. It satisfies 2NF but breaks 3NF.")],
      [tl("Yalnız BCNF", "BCNF only"), false, tl("Yalnız BCNF'i bozan bağımlılıkta sağ taraf asaldır. Price asal değil, bu yüzden 3NF de bozulur.", "A dependency that breaks only BCNF has a prime right side. Price is not prime, so 3NF breaks too.")]] },
  { p: "teach", njb: [["Student", "Instructor"], ["Student", "Course"]], q: tl("TEACH'i {Student, Instructor} ve {Student, Course} olarak ayırırsak join kayıpsız olur mu?", "If TEACH is split into {Student, Instructor} and {Student, Course}, is the join lossless?"),
    opts: [[tl("Evet, kayıpsız", "Yes, lossless"), false, tl("NJB testine göre ortak öznitelik Student, iki parçadan birinin geri kalanını belirlemeli. Student ne Instructor'ı ne Course'u belirler.", "By the NJB test the common attribute Student must determine the rest of one part. Student determines neither Instructor nor Course.")],
      [tl("Hayır, sahte satırlar oluşabilir", "No, spurious tuples can appear"), true, tl("Doğru. Student → Instructor da Student → Course da sağlanmaz; kitaptaki D1 ayrıştırması bu yüzden kayıplıdır. Kayıpsız olan D3'tür: {Instructor, Course} ve {Instructor, Student}.", "Right. Neither Student → Instructor nor Student → Course holds; that is why the book's decomposition D1 is lossy. The lossless one is D3: {Instructor, Course} and {Instructor, Student}.")],
      [tl("Bağımlılıklara bakmadan söylenemez", "Cannot be told without the data"), false, tl("NJB testi yalnızca bağımlılıklara bakar; verinin kendisine gerek yoktur.", "The NJB test only looks at the dependencies; the data itself is not needed.")]] },
  { p: "lots1a", q: tl("LOTS1A(Property_id, County_name, Lot, Area) BCNF'e ayrıştırılınca hangi bağımlılık korunamaz?", "When LOTS1A(Property_id, County_name, Lot, Area) is decomposed into BCNF, which dependency is lost?"),
    opts: [["Property_id → County_name, Lot, Area", false, tl("Bu bağımlılığın sol tarafı bir anahtar; parçalar üzerinden kontrol edilebilir.", "The left side of this dependency is a key; it can be checked through the parts.")],
      ["{County_name, Lot} → Property_id, Area", true, tl("Doğru. Area → County_name yüzünden ilişki {Area, County_name} ve {Property_id, Area, Lot} olarak ayrılır. County_name ile Lot artık aynı parçada değildir, bu bağımlılık kaybolur. BCNF bazen bağımlılık korumayı feda eder.", "Right. Because of Area → County_name the relation splits into {Area, County_name} and {Property_id, Area, Lot}. County_name and Lot are no longer in the same part, so this dependency is lost. BCNF sometimes gives up dependency preservation.")],
      ["Area → County_name", false, tl("Bu bağımlılık ayrıştırmanın nedenidir ve {Area, County_name} parçasında aynen durur.", "This dependency is the reason for the split and stays intact in the part {Area, County_name}.")]] },
];
{
  const host = $("#nf-decide");
  if (host) {
    let k = 0, answered = [];
    const score = () => answered.filter((j, i) => j != null && ND[i].opts[j][1]).length;
    const head = h("div", { class: "pl-bar" }), card = h("div");
    host.append(h("div", { class: "player" }, head, card));
    const show = () => {
      const d = ND[k], p = PRESETS[d.p], R = parseAttrs(p.attrs), F = parseFDs(p.fds);
      const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { k--; show(); });
      const nextB = button(k === ND.length - 1 ? tl("Sonuç", "Result") : tl("Sonraki ▶", "Next ▶"), () => { k++; k < ND.length ? show() : finish(); }, { kind: "primary" });
      prevB.disabled = k === 0; nextB.disabled = answered[k] == null;
      head.replaceChildren(prevB, nextB, h("span", { class: "pl-count" }, tl(`Soru ${k + 1} / ${ND.length} · ${score()} doğru`, `Question ${k + 1} of ${ND.length} · ${score()} correct`)),
        h("div", { class: "pl-dots", style: { margin: 0 } }, ...ND.map((q, j) => h("button", { type: "button", class: "pl-dot" + (j === k ? " on" : "") + (answered[j] == null ? "" : q.opts[answered[j]][1] ? " good" : " bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
      const opts = h("div", { class: "quiz-options" }), fb = h("div"), detail = h("div");
      const pick = (j, initial = false) => {
        if (!initial) { answered[k] = j; show(); return; } // re-render: score, dots and the Next button follow the answer
        [...opts.children].forEach((b, m) => { b.disabled = true; b.classList.toggle("correct", d.opts[m][1]); b.classList.toggle("wrong", m === j && !d.opts[m][1]); });
        const [, ok, why] = d.opts[j], right = d.opts.find((o) => o[1]);
        fb.replaceChildren(h("div", { class: `res-msg ${ok ? "ok" : "warn"}`, style: { fontFamily: "inherit" } }, why),
          ok ? "" : h("p", { class: "small" }, h("strong", {}, tl("Doğru cevap: ", "Correct answer: ")), right[0], ". ", right[2].replace(/^(Doğru|Right)\. /, "")),
          h("div", { class: "btn-row", style: { margin: "6px 0" } }, button(tl("↺ Cevabı sıfırla", "↺ Reset answer"), () => { answered[k] = undefined; show(); })));
        // the worked solution, step by step with before/after
        if (d.njb) {
          const [R1, R2] = d.njb, jn = njb(R1, R2, F);
          detail.replaceChildren(h("div", { class: "ba-label" }, tl("Adım adım: ayrıştırma ve NJB testi", "Step by step: the decomposition and the NJB test")),
            h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), fdDiagram(p.name, R, F)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
              h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), relationLine("R1", R1, F), relationLine("R2", R2, F))),
            h("p", { class: jn.ok ? "nf-ok" : "nf-bad" }, tl(`R1 ∩ R2 = ${fmt(jn.common)} ve ${fmt(jn.common)}⁺ = {${closure(jn.common, F).join(", ")}}. ${jn.ok ? "Bu küme parçalardan birinin geri kalanını kapsıyor; ayrıştırma kayıpsız." : `Bu küme ne R1 − R2 = ${fmt(jn.left)} ne de R2 − R1 = ${fmt(jn.right)} kümesini kapsıyor; ayrıştırma kayıplı.`}`,
              `R1 ∩ R2 = ${fmt(jn.common)} and ${fmt(jn.common)}⁺ = {${closure(jn.common, F).join(", ")}}. ${jn.ok ? "It covers one side, so the decomposition is lossless." : `It covers neither R1 − R2 = ${fmt(jn.left)} nor R2 − R1 = ${fmt(jn.right)}; the decomposition is lossy.`}`)));
        } else {
          const body = h("div");
          normalize(body, { ...p, target: "BCNF" });
          detail.replaceChildren(h("div", { class: "ba-label" }, tl("Adım adım çözüm: bağımlılık diyagramı, anahtar ve BCNF'e ayrıştırma (her adımda önce ve sonra)", "Worked solution: the dependency diagram, the key and the decomposition into BCNF (each step before and after)")), fdDiagram(p.name, R, F), body);
        }
      };
      d.opts.forEach(([label], j) => opts.append(h("button", { type: "button", onclick: () => pick(j) }, h("span", { class: "opt-letter" }, "ABC"[j] + ") "), label)));
      card.replaceChildren(h("p", { class: "decide-q" }, d.q), h("p", { class: "small muted" }, `${p.name}: ${p.fds.split("\n").join("; ").replace(/->/g, "→")}`), opts, fb, detail);
      if (answered[k] != null) pick(answered[k], true);
    };
    const finish = () => {
      k = ND.length - 1;
      head.replaceChildren(button(tl("Baştan başla", "Start again"), () => { k = 0; answered = []; show(); }, { kind: "primary" }));
      card.replaceChildren(h("p", { class: "decide-q" }, tl(`${ND.length} sorudan ${score()} tanesini doğru cevapladınız.`, `You answered ${score()} of ${ND.length} questions correctly.`)),
        h("p", {}, tl("Bir soruya dönmek için numarasına tıklayın; kırmızılar yanlış cevapladıklarınız.", "Click a number to go back to a question; the red ones are those you missed.")),
        h("div", { class: "pl-dots" }, ...ND.map((q, j) => h("button", { type: "button", class: "pl-dot " + (q.opts[answered[j]]?.[1] ? "good" : "bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
    };
    show();
  }
}

// ================================================================ normalization journey on real data
// One table built from COMPANY's data goes UNF → 1NF → 2NF → 3NF (= BCNF here). Every stage shows its relations with
// their rows, the repeated facts highlighted, the dependency that causes them, three anomaly tests, and whether
// joining the parts gives back the 1NF rows exactly (lossless).
import { companyData } from "../lib/companydata.js";

const JF = parseFDs("Ssn -> Ename, Dnumber\nDnumber -> Dname\nPnumber -> Pname\nSsn, Pnumber -> Hours");
function journeyData() {
  const C = companyData(), col = (t, c) => C[t].cols.indexOf(c);
  const emp = C.EMPLOYEE.rows, dep = C.DEPARTMENT.rows, prj = C.PROJECT.rows, won = C.WORKS_ON.rows;
  const dname = (n) => dep.find((d) => d[col("DEPARTMENT", "Dnumber")] === n)[col("DEPARTMENT", "Dname")];
  const pname = (n) => prj.find((p) => p[col("PROJECT", "Pnumber")] === n)[col("PROJECT", "Pname")];
  const ename = (e) => `${e[col("EMPLOYEE", "Fname")]} ${e[col("EMPLOYEE", "Lname")]}`;
  const flat = [];
  for (const e of emp) for (const w of won.filter((w) => w[0] === e[col("EMPLOYEE", "Ssn")]))
    flat.push({ Ssn: e[col("EMPLOYEE", "Ssn")], Pnumber: w[1], Ename: ename(e), Dnumber: e[col("EMPLOYEE", "Dno")], Dname: dname(e[col("EMPLOYEE", "Dno")]), Pname: pname(w[1]), Hours: w[2] ?? "NULL" });
  return flat;
}
const project = (rows, attrs) => { const seen = new Map(); for (const r of rows) { const o = Object.fromEntries(attrs.map((a) => [a, r[a]])); seen.set(attrs.map((a) => o[a]).join(""), o); } return [...seen.values()]; };
const natJoin = (A, B) => { const common = Object.keys(A[0] || {}).filter((k) => k in (B[0] || {})); const out = []; for (const a of A) for (const b of B) if (common.every((k) => a[k] === b[k])) out.push({ ...a, ...b }); return out; };
const rowKey = (r, attrs) => attrs.map((a) => r[a]).join("");

/** A relation's rows as a table; cells that repeat a fact (same left side of a non-key FD) are highlighted. */
function factTable(attrs, rows, F, { mark = null, noRep = false } = {}) {
  const a = analyze(attrs, F);
  const rep = new Set();
  let repeats = 0;
  for (const f of noRep ? [] : a.fds) {
    if (attrs.every((x) => closure(f.lhs, F).includes(x))) continue; // left side is a superkey: no repetition
    const groups = new Map();
    rows.forEach((r, i) => { const k = rowKey(r, f.lhs); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
    for (const g of groups.values()) if (g.length > 1) for (const i of g.slice(1)) for (const c of f.rhs) { if (!rep.has(`${i}|${c}`)) repeats++; rep.add(`${i}|${c}`); }
  }
  const key = a.keys[0] || [];
  const t = h("table", { class: "simple jt" }, h("thead", {}, h("tr", {}, ...attrs.map((c) => h("th", {}, key.includes(c) ? h("u", {}, c) : c)))),
    h("tbody", {}, ...rows.map((r, i) => h("tr", { class: mark?.(r) || null }, ...attrs.map((c) => h("td", { class: rep.has(`${i}|${c}`) ? "rep" : null, title: rep.has(`${i}|${c}`) ? tl("Bu bilgi başka bir satırda zaten var", "This fact is already stored in another row") : null }, String(r[c])))))));
  return { el: h("div", { class: "table-wrap" }, t), repeats, cells: attrs.length * rows.length };
}

{
  const host = $("#nf-journey");
  if (host) {
    const flat = journeyData();
    const A1 = ["Ssn", "Pnumber", "Ename", "Dnumber", "Dname", "Pname", "Hours"];
    const STAGES = [
      { id: "UNF", rels: null },
      { id: "1NF", rels: [["EMP_PROJ", A1]] },
      { id: "2NF", rels: [["WORKS_ON", ["Ssn", "Pnumber", "Hours"]], ["EMP", ["Ssn", "Ename", "Dnumber", "Dname"]], ["PROJ", ["Pnumber", "Pname"]]] },
      { id: "3NF / BCNF", rels: [["WORKS_ON", ["Ssn", "Pnumber", "Hours"]], ["EMP", ["Ssn", "Ename", "Dnumber"]], ["DEPT", ["Dnumber", "Dname"]], ["PROJ", ["Pnumber", "Pname"]]] },
    ];
    const TEXT = [
      tl("Başlangıç: her çalışan tek satır, projeleri tek bir hücrede liste olarak duruyor. Bir hücrede birden çok değer var; 'ProductX'te kim çalışıyor?' sorusu bile metin aramasına döner. Bu tablo 1NF'te değildir.",
        "Start: one row per employee, their projects as a list in one cell. A cell holds several values; even 'who works on ProductX?' becomes a text search. This table is not in 1NF."),
      tl("1NF: liste hücresi açılır, her (çalışan, proje) çifti bir satır olur. Değerler artık atomik, ama anahtar {Ssn, Pnumber} olunca Ssn → Ename, Dnumber ve Pnumber → Pname bağımlılıkları anahtarın yalnızca bir parçasına bağlı: kısmi bağımlılık. Bu yüzden çalışanın adı her projesi için, projenin adı her çalışanı için tekrar ediyor (sarı hücreler).",
        "1NF: the list cell is opened up; each (employee, project) pair becomes a row. Values are atomic now, but with the key {Ssn, Pnumber}, Ssn → Ename, Dnumber and Pnumber → Pname depend on only part of the key: partial dependencies. So an employee's name repeats for each project and a project's name for each employee (yellow cells)."),
      tl("2NF: her kısmi bağımlılık kendi tablosuna alındı. EMP(Ssn, …) ve PROJ(Pnumber, Pname) ayrıldı, WORKS_ON'da yalnızca tam bağımlı Hours kaldı. Proje adları artık bir kez saklanıyor. Ama EMP'de Ssn → Dnumber → Dname zinciri var: geçişli bağımlılık. Departman adı, departmandaki her çalışan için tekrar ediyor.",
        "2NF: each partial dependency went into its own table. EMP(Ssn, …) and PROJ(Pnumber, Pname) were split off; WORKS_ON keeps only the fully dependent Hours. Project names are stored once now. But EMP has the chain Ssn → Dnumber → Dname: a transitive dependency. A department's name repeats for each employee in it."),
      tl("3NF: geçişli bağımlılık DEPT(Dnumber, Dname) tablosuna alındı. Artık her bilginin tek bir yeri var: hiçbir hücre tekrar etmiyor ve her bağımlılığın sol tarafı kendi tablosunun anahtarı, yani tablolar BCNF'te de. Bunlar COMPANY'nin kendi tablolarıdır: iyi bir ER tasarımı ve eşleme bu sonucu baştan verir.",
        "3NF: the transitive dependency went into DEPT(Dnumber, Dname). Now every fact has one place: no cell repeats and the left side of every dependency is its table's key, so the tables are in BCNF too. These are COMPANY's own tables: a good ER design and mapping give this result from the start."),
    ];
    let i = 0;
    const seg = h("div", { class: "stepper-steps", role: "group" }), body = h("div");
    const unf = () => {
      const byEmp = new Map();
      for (const r of flat) { if (!byEmp.has(r.Ssn)) byEmp.set(r.Ssn, { ...r, Projects: [] }); byEmp.get(r.Ssn).Projects.push(`${r.Pnumber} ${r.Pname} (${r.Hours})`); }
      const rows = [...byEmp.values()];
      return h("div", { class: "table-wrap" }, h("table", { class: "simple jt" }, h("thead", {}, h("tr", {}, ...["Ssn", "Ename", "Dnumber", "Dname", "Projects"].map((c) => h("th", {}, c)))),
        h("tbody", {}, ...rows.map((r) => h("tr", {}, h("td", {}, r.Ssn), h("td", {}, r.Ename), h("td", {}, String(r.Dnumber)), h("td", {}, r.Dname), h("td", { class: "multi" }, r.Projects.join("; ")))))));
    };
    const relRows = (attrs) => project(flat, attrs);
    const stageRels = (s) => s.rels.map(([n, attrs]) => ({ n, attrs, rows: relRows(attrs) }));
    // the three anomaly tests, computed from the stage's relations
    const anomalies = (s) => {
      if (!s.rels) return [[tl("ProductX'in adını değiştir", "Rename ProductX"), false, tl("Liste hücrelerinin içindeki metin tek tek düzenlenmeli", "The text inside list cells must be edited one by one")],
        [tl("Henüz kimsenin çalışmadığı bir proje ekle", "Add a project nobody works on yet"), false, tl("Proje ancak bir çalışanın listesine yazılabilir", "A project can only be written into an employee's list")],
        [tl("Borg'u sil (Headquarters'ın tek çalışanı)", "Delete Borg (Headquarters' only employee)"), false, tl("Headquarters'ın adı da kaybolur", "Headquarters' name is lost too")]];
      const R = stageRels(s);
      const holder = (attr) => R.filter((r) => r.attrs.includes(attr));
      const pn = holder("Pname"), rowsP = pn.reduce((n, r) => n + r.rows.filter((x) => x.Pnumber === 1).length, 0);
      const projAlone = pn.some((r) => (analyze(r.attrs, JF).keys[0] || []).join() === "Pnumber");
      const deptAlone = holder("Dname").some((r) => (analyze(r.attrs, JF).keys[0] || []).join() === "Dnumber");
      return [[tl("ProductX'in adını değiştir", "Rename ProductX"), rowsP === 1, rowsP === 1 ? tl("Tek satır güncellenir", "One row is updated") : tl(`${rowsP} satır güncellenmeli; biri unutulursa veri tutarsız olur`, `${rowsP} rows must be updated; forgetting one leaves the data inconsistent`)],
        [tl("Henüz kimsenin çalışmadığı bir proje ekle", "Add a project nobody works on yet"), projAlone, projAlone ? tl("PROJ'a bir satır eklenir", "A row is added to PROJ") : tl("Anahtarın parçası Ssn NULL kalır: entity integrity reddeder", "The key part Ssn would be NULL: entity integrity rejects it")],
        [tl("Borg'u sil (Headquarters'ın tek çalışanı)", "Delete Borg (Headquarters' only employee)"), deptAlone, deptAlone ? tl("Headquarters'ın adı DEPT'te kalır", "Headquarters' name stays in DEPT") : tl("Headquarters'ın adı yalnızca Borg'un satırındaydı; o da kaybolur", "Headquarters' name was only in Borg's row; it is lost too")]];
    };
    const draw = () => {
      [...seg.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      prev.disabled = i === 0; next.disabled = i === STAGES.length - 1;
      const s = STAGES[i], kids = [h("p", {}, TEXT[i])];
      if (s.rels) {
        const R = stageRels(s);
        const prevRels = STAGES[i - 1]?.rels;
        // the dependency that is removed in the next step, in red
        const nextBad = { "1NF": parseFDs("Pnumber -> Pname")[0], "2NF": parseFDs("Dnumber -> Dname")[0] }[s.id];
        kids.push(h("div", { class: "ba-label" }, tl("Şemalar ve bağımlılıklar", "Schemas and dependencies") + (nextBad ? tl(" (kırmızı: bir sonraki adımda çözülecek sorun)", " (red: the problem the next step solves)") : "")),
          h("div", { class: "nf-stack" }, ...R.map((r) => fdDiagram(r.n, r.attrs, JF, nextBad && r.attrs.includes(nextBad.rhs[0]) && r.attrs.includes(nextBad.lhs[0]) && r.attrs.length > 2 ? { hl: nextBad, bad: true } : {}))));
        let repeats = 0, cells = 0;
        const tables = R.map((r) => { const t = factTable(r.attrs, r.rows, JF); repeats += t.repeats; cells += t.cells; return h("div", {}, h("div", { class: "jt-name" }, `${r.n} (${r.rows.length} ${tl("satır", "rows")})`), t.el); });
        kids.push(h("div", { class: "jt-metrics" }, h("span", { class: repeats ? "bad" : "ok" }, tl(`${repeats} tekrar eden hücre`, `${repeats} repeated cells`)), h("span", {}, tl(`${cells} hücre toplam`, `${cells} cells in all`)), h("span", {}, tl(`${R.length} tablo`, `${R.length} tables`))),
          h("div", { class: "jt-tables" }, ...tables));
        if (R.length > 1) {
          const joined = R.slice(1).reduce((acc, r) => natJoin(acc, r.rows), R[0].rows);
          const orig = new Set(flat.map((r) => rowKey(r, A1))), back = new Set(joined.map((r) => rowKey(r, A1)));
          const same = joined.length === flat.length && [...orig].every((k) => back.has(k));
          kids.push(h("div", { class: `res-msg ${same ? "ok" : "warn"}`, style: { fontFamily: "inherit" } }, same
            ? tl(`Kayıpsız: ${R.map((r) => r.n).join(" * ")} natural join'i 1NF tablonun ${flat.length} satırını eksiksiz ve fazlasız geri veriyor.`, `Lossless: the natural join ${R.map((r) => r.n).join(" * ")} gives back the ${flat.length} rows of the 1NF table, none missing, none extra.`)
            : tl(`Join ${joined.length} satır veriyor; orijinal ${flat.length} satırdı.`, `The join gives ${joined.length} rows; the original had ${flat.length}.`)));
        }
        if (prevRels) kids.unshift(h("div", { class: "small muted" }, tl(`Önceki adım: ${prevRels.map(([n, a]) => `${n}(${a.join(", ")})`).join(", ")}`, `Previous step: ${prevRels.map(([n, a]) => `${n}(${a.join(", ")})`).join(", ")}`)));
      } else kids.push(unf());
      const an = anomalies(s);
      kids.push(h("div", { class: "ba-label" }, tl("Anomali testi", "Anomaly test")), h("ul", { class: "jt-anom" }, ...an.map(([what, ok, why]) => h("li", { class: ok ? "ok" : "bad" }, h("strong", {}, (ok ? "✓ " : "✗ ") + what), ": ", why))));
      body.replaceChildren(...kids);
    };
    const prev = button(tl("◀ Önceki adım", "◀ Previous step"), () => { i--; draw(); });
    const next = button(tl("Sonraki adım ▶", "Next step ▶"), () => { i++; draw(); }, { kind: "primary" });
    STAGES.forEach((s, j) => seg.append(h("button", { type: "button", onclick: () => { i = j; draw(); } }, s.id)));
    host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, prev, next, seg), body));
    draw();
  }
}

// ================================================================ free decomposition lab
// Split a table into two parts of your choice: the parts' rows, their join, spurious rows in red, the NJB verdict,
// each part's normal form and the dependencies that are lost.
{
  const host = $("#decomp-lab");
  if (host) {
    const TEACH_ROWS = [["Narayan", "Database", "Mark"], ["Smith", "Database", "Navathe"], ["Smith", "Operating Systems", "Ammar"], ["Smith", "Theory", "Schulman"], ["Wallace", "Database", "Mark"], ["Wallace", "Operating Systems", "Ahamad"], ["Wong", "Database", "Omiecinski"], ["Zelaya", "Database", "Navathe"], ["Narayan", "Operating Systems", "Ammar"]];
    const BASES = {
      emp: { label: tl("EMP_PROJ (yolculuktaki 1NF tablo)", "EMP_PROJ (the 1NF table of the journey)"), attrs: ["Ssn", "Pnumber", "Ename", "Dnumber", "Dname", "Pname", "Hours"], F: JF, rows: () => journeyData(),
        presets: [[tl("İyi: Ssn ile böl", "Good: split on Ssn"), ["Ssn", "Ename", "Dnumber", "Dname"], ["Ssn", "Pnumber", "Pname", "Hours"]], [tl("Kötü: ortak öznitelik Dname", "Bad: common attribute Dname"), ["Ssn", "Ename", "Dnumber", "Dname"], ["Dname", "Pnumber", "Pname", "Hours"]], [tl("Kötü: ortak öznitelik yok", "Bad: no common attribute"), ["Ssn", "Ename", "Dnumber", "Dname"], ["Pnumber", "Pname", "Hours"]]] },
      teach: { label: tl("TEACH (Figure 14.14)", "TEACH (Figure 14.14)"), attrs: ["Student", "Course", "Instructor"], F: parseFDs("Student, Course -> Instructor\nInstructor -> Course"), rows: () => TEACH_ROWS.map(([Student, Course, Instructor]) => ({ Student, Course, Instructor })),
        presets: [["D1", ["Student", "Instructor"], ["Student", "Course"]], ["D2", ["Course", "Instructor"], ["Course", "Student"]], ["D3", ["Instructor", "Course"], ["Instructor", "Student"]]] },
    };
    let base = "emp";
    const sel = h("select", {}, ...Object.entries(BASES).map(([k, b]) => h("option", { value: k }, b.label)));
    const pick1 = h("div", { class: "nf-picks" }), pick2 = h("div", { class: "nf-picks" }), presets = h("div", { class: "btn-row" }), out = h("div");
    const boxes = (host2, attrs, on) => host2.replaceChildren(...attrs.map((a) => h("label", { class: "nf-pick" }, h("input", { type: "checkbox", value: a, checked: on.includes(a) || null, onchange: run }), a)));
    const chosen = (el) => [...el.querySelectorAll("input:checked")].map((x) => x.value);
    function run() {
      const B = BASES[base], rows = B.rows(), R1 = chosen(pick1), R2 = chosen(pick2);
      const missing = B.attrs.filter((a) => !R1.includes(a) && !R2.includes(a));
      if (!R1.length || !R2.length) { out.replaceChildren(h("p", { class: "small muted" }, tl("İki parçanın her birine en az bir öznitelik seçin.", "Choose at least one attribute for each of the two parts."))); return; }
      const P1 = project(rows, R1), P2 = project(rows, R2), J = natJoin(P1, P2);
      const all = B.attrs.filter((a) => R1.includes(a) || R2.includes(a));
      const orig = new Set(rows.map((r) => rowKey(r, all)));
      const spurious = J.filter((r) => !orig.has(rowKey(r, all))).length;
      const jn = njb(R1, R2, B.F), common = R1.filter((a) => R2.includes(a));
      const lost = lostFDs(B.F, [R1, R2]);
      const t1 = factTable(R1, P1, B.F), t2 = factTable(R2, P2, B.F);
      // the join: spurious rows first (red), the genuine ones folded below
      const bad = J.filter((r) => !orig.has(rowKey(r, all))), good = J.filter((r) => orig.has(rowKey(r, all)));
      const tj = h("div", {}, bad.length ? factTable(all, bad.slice(0, 15), B.F, { noRep: true, mark: () => "drop" }).el : "",
        bad.length > 15 ? h("p", { class: "small muted" }, tl(`… ve ${bad.length - 15} sahte satır daha`, `… and ${bad.length - 15} more spurious rows`)) : "",
        h("details", { class: "small" }, h("summary", {}, tl(`Orijinalde de olan ${good.length} satır`, `The ${good.length} rows that are also in the original`)), factTable(all, good, B.F, { noRep: true }).el));
      out.replaceChildren(
        missing.length ? h("div", { class: "res-msg warn", style: { fontFamily: "inherit" } }, tl(`Hiçbir parçada olmayan öznitelik: ${missing.join(", ")}. Bu bilgi tamamen kaybolur.`, `Attribute in neither part: ${missing.join(", ")}. This information is lost completely.`)) : "",
        h("div", { class: "lab-grid" },
          h("div", {}, relationLine("R1", R1, B.F), h("div", { class: "small muted" }, tl(`${P1.length} satır`, `${P1.length} rows`)), t1.el),
          h("div", {}, relationLine("R2", R2, B.F), h("div", { class: "small muted" }, tl(`${P2.length} satır`, `${P2.length} rows`)), t2.el)),
        h("div", { class: "ba-label" }, tl(`R1 * R2 (ortak: ${common.join(", ") || "yok, kartezyen çarpım"}): ${J.length} satır, orijinal ${rows.length}`, `R1 * R2 (common: ${common.join(", ") || "none, a Cartesian product"}): ${J.length} rows, original ${rows.length}`)),
        tj,
        h("div", { class: `res-msg ${spurious || missing.length ? "warn" : "ok"}`, style: { fontFamily: "inherit" } },
          spurious ? tl(`${spurious} sahte satır (kırmızı): join, orijinalde olmayan satırlar üretti. NJB testi de bunu öngörüyor: ortak öznitelikler {${common.join(", ")}} iki parçanın geri kalanını da belirlemiyor.`, `${spurious} spurious rows (red): the join produced rows that were not in the original. The NJB test predicts this: the common attributes {${common.join(", ")}} determine the rest of neither part.`)
            : jn.ok ? tl(`Kayıpsız: join orijinal satırları aynen veriyor. NJB: {${common.join(", ")}} → {${(jn.determines || []).join(", ")}}.`, `Lossless: the join gives back exactly the original rows. NJB: {${common.join(", ")}} → {${(jn.determines || []).join(", ")}}.`)
            : tl("Bu veride sahte satır çıkmadı, ama NJB testi ayrıştırmanın kayıpsız olduğunu garanti etmiyor: başka bir veri durumunda sahte satır oluşabilir.", "No spurious rows appeared in this data, but the NJB test does not guarantee the decomposition is lossless: another data state could produce them.")),
        h("p", { class: "small" }, lost.length ? tl(`Korunmayan bağımlılık: ${lost.map(fmtFD).join("; ")}. Bu kural artık tek bir tabloda kontrol edilemez.`, `Dependency not preserved: ${lost.map(fmtFD).join("; ")}. This rule can no longer be checked in a single table.`) : tl("Bütün bağımlılıklar korunuyor.", "Every dependency is preserved.")));
    }
    const load = (r1, r2) => { const B = BASES[base]; boxes(pick1, B.attrs, r1); boxes(pick2, B.attrs, r2); run(); };
    const loadBase = () => { const B = BASES[base]; presets.replaceChildren(...B.presets.map(([n, r1, r2]) => button(n, () => load(r1, r2)))); load(B.presets[0][1], B.presets[0][2]); };
    sel.addEventListener("change", () => { base = sel.value; loadBase(); });
    host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, h("label", { class: "small sim-field" }, tl("Tablo: ", "Table: "), sel)), presets,
      h("div", { class: "small" }, h("strong", {}, "R1: "), pick1), h("div", { class: "small" }, h("strong", {}, "R2: "), pick2), out));
    loadBase();
  }
}

// ---- the one rule: pick a dependency X → A and answer three questions; the answers say which normal form it
// breaks (or none) and how to fix it. On the journey's table the repeats it causes are counted on the real rows.
{
  const host = $("#fd-ladder");
  if (host) {
    const J = ["Ssn", "Pnumber", "Ename", "Dnumber", "Dname", "Pname", "Hours"];
    const REL = [
      { name: "EMP_PROJ", R: J, F: JF, rows: journeyData(), note: tl("yolculuktaki 1NF tablosu, COMPANY verisi", "the journey's 1NF table, COMPANY data") },
      { name: "EMP_DEPT", R: parseAttrs(PRESETS.emp_dept.attrs), F: parseFDs(PRESETS.emp_dept.fds), note: "Figure 14.11b" },
      { name: "LOTS", R: parseAttrs(PRESETS.lots.attrs), F: parseFDs(PRESETS.lots.fds), note: "Figure 14.12" },
      { name: "TEACH", R: parseAttrs(PRESETS.teach.attrs), F: parseFDs(PRESETS.teach.fds), note: "Figure 14.14" },
    ];
    let rel = REL[0], fd = null;
    const relSeg = h("div", { class: "stepper-steps", role: "group" }), fdRow = h("div", { class: "btn-row" }), diagram = h("div"), out = h("div");
    const yes = tl("Evet", "Yes"), no = tl("Hayır", "No");
    const paint = () => {
      for (const b of relSeg.children) b.setAttribute("aria-pressed", String(b.dataset.name === rel.name));
      const a = analyze(rel.R, rel.F);
      fdRow.replaceChildren(h("span", { class: "small muted" }, tl("Bir bağımlılık seçin:", "Pick a dependency:")),
        ...rel.F.map((f) => h("button", { type: "button", "aria-pressed": String(fd === f), onclick: () => { fd = f; paint(); } }, fmtFD(f))));
      if (!fd) { diagram.replaceChildren(fdDiagram(rel.name, rel.R, rel.F, { keys: a.keys })); out.replaceChildren(h("p", { class: "small" }, tl(`Aday ${a.keys.length > 1 ? "anahtarlar" : "anahtar"}: ${a.keys.map(fmt).join(tl(" ve ", " and "))} (${rel.note}).`, `Candidate ${a.keys.length > 1 ? "keys" : "key"}: ${a.keys.map(fmt).join(" and ")} (${rel.note}).`))); return; }
      const X = fd.lhs, Xp = closure(X, rel.F).filter((x) => rel.R.includes(x));
      const sk = rel.R.every((x) => Xp.includes(x));
      const A = fd.rhs.filter((x) => !X.includes(x)), Anp = A.filter((x) => !a.prime.includes(x));
      const partKey = a.keys.find((k) => X.every((x) => k.includes(x)) && X.length < k.length);
      const verdict = sk ? "ok" : !Anp.length ? "bcnf" : partKey ? "2nf" : "3nf";
      diagram.replaceChildren(fdDiagram(rel.name, rel.R, rel.F, { keys: a.keys, hl: fd, bad: verdict !== "ok" }));
      const step = (n, q, ans, why, reached, last) => h("li", { class: (reached ? "" : "skip ") + (last ? "here" : "") },
        h("div", { class: "step-title" }, `${n}. ${q}`), reached ? h("div", { class: "small" }, h("strong", {}, ans ? yes : no), ". ", why) : h("div", { class: "small muted" }, tl("Bu soruya gerek kalmadı.", "Not needed.")));
      const s1 = step(1, tl(`Sol taraf ${fmt(X)} bir süper anahtar mı?`, `Is the left side ${fmt(X)} a superkey?`), sk,
        tl(`${fmt(X)}⁺ = {${Xp.join(", ")}}${sk ? ": ilişkinin bütün öznitelikleri." : `; ${rel.R.filter((x) => !Xp.includes(x)).join(", ")} eksik.`}`, `${fmt(X)}⁺ = {${Xp.join(", ")}}${sk ? ": every attribute of the relation." : `; ${rel.R.filter((x) => !Xp.includes(x)).join(", ")} missing.`}`), true, sk);
      const s2 = step(2, tl(`Sağ taraf (${A.join(", ")}) asal mı, yani bir aday anahtarın parçası mı?`, `Is the right side (${A.join(", ")}) prime, i.e. part of a candidate key?`), !Anp.length,
        tl(`Aday anahtarlar: ${a.keys.map(fmt).join(", ")}. ${Anp.length ? `${Anp.join(", ")} hiçbirinde yok.` : "Hepsi bir anahtarda geçiyor."}`, `Candidate keys: ${a.keys.map(fmt).join(", ")}. ${Anp.length ? `${Anp.join(", ")} is in none of them.` : "All of it appears in a key."}`), !sk, verdict === "bcnf");
      const s3 = step(3, tl(`${fmt(X)} bir aday anahtarın parçası mı?`, `Is ${fmt(X)} part of a candidate key?`), !!partKey,
        partKey ? tl(`${fmt(X)} ⊂ ${fmt(partKey)}.`, `${fmt(X)} ⊂ ${fmt(partKey)}.`) : tl(`${fmt(X)} anahtar dışı bir öznitelik; anahtar → ${fmt(X)} → ${fmt(Anp)} zinciri var.`, `${fmt(X)} is outside every key; there is a chain key → ${fmt(X)} → ${fmt(Anp)}.`), !sk && !!Anp.length, verdict === "2nf" || verdict === "3nf");
      const MSG = {
        ok: [tl("Sorun yok: bu bağımlılık hiçbir normal formu bozmaz.", "No problem: this dependency breaks no normal form."), "ok", tl(`${fmt(X)} her satırda farklı bir değer aldığı için ${fmt(A)} de her satırda bir kez yazılır; tekrar yok.`, `${fmt(X)} takes a different value in every row, so ${fmt(A)} is written once per row; nothing repeats.`)],
        "2nf": [tl("Kısmi bağımlılık: 2NF'i (dolayısıyla 3NF ve BCNF'i de) bozar.", "A partial dependency: it breaks 2NF (and so 3NF and BCNF too)."), "error", tl(`Asal olmayan ${Anp.join(", ")}, anahtarın yalnızca bir parçasına bağlı.`, `The nonprime ${Anp.join(", ")} depends on only part of the key.`)],
        "3nf": [tl("Geçişli bağımlılık: 2NF'e uyar, 3NF'i (ve BCNF'i) bozar.", "A transitive dependency: it satisfies 2NF but breaks 3NF (and BCNF)."), "error", tl(`Asal olmayan ${Anp.join(", ")}, anahtar olmayan ${fmt(X)} üzerinden anahtara bağlı.`, `The nonprime ${Anp.join(", ")} depends on the key through the non-key ${fmt(X)}.`)],
        bcnf: [tl("3NF buna izin verir, BCNF vermez.", "3NF allows this; BCNF does not."), "warn", tl(`Sol taraf süper anahtar değil, ama sağ taraf asal olduğu için 3NF'in (b) koşulu sağlanır.`, `The left side is not a superkey, but the right side is prime, so condition (b) of 3NF holds.`)],
      }[verdict];
      const kids = [h("ol", { class: "map-steps ladder" }, s1, s2, s3), h("div", { class: `res-msg ${MSG[1]}`, style: { fontFamily: "inherit" } }, h("strong", {}, MSG[0]), " ", MSG[2])];
      if (verdict !== "ok") {
        const R1 = [...X, ...A], R2 = rel.R.filter((x) => !A.includes(x));
        kids.push(h("p", { class: "small" }, h("strong", {}, tl("Düzeltme: ", "Fix: ")), tl(`${fmt(X)} ve ${fmt(A)} kendi tablosuna çıkar, ${fmt(A)} asıl tablodan silinir:`, `move ${fmt(X)} and ${fmt(A)} to a table of their own and remove ${fmt(A)} from the original:`)),
          h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), relationLine(rel.name, rel.R, rel.F)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
            h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), relationLine(rel.name + "1", R1, rel.F), relationLine(rel.name + "2", R2, rel.F))),
          h("p", { class: "small muted" }, tl(`Join kayıpsızdır: iki parçanın ortak özniteliği ${fmt(X)}, ${rel.name}1'in anahtarıdır (NJB testi).`, `The join is lossless: the parts' common attribute ${fmt(X)} is the key of ${rel.name}1 (the NJB test).`)));
      }
      if (rel.rows) {
        const distinct = new Set(rel.rows.map((r) => X.map((x) => r[x]).join("|"))).size;
        kids.push(h("p", { class: "small" }, h("strong", {}, tl("Veride: ", "In the data: ")), distinct === rel.rows.length
          ? tl(`${fmt(X)} ${rel.rows.length} satırın hepsinde farklı; ${fmt(A)} hiç tekrar etmiyor.`, `${fmt(X)} differs in all ${rel.rows.length} rows; ${fmt(A)} never repeats.`)
          : tl(`${fmt(X)} için ${distinct} farklı değer ${rel.rows.length} satıra dağılmış; ${fmt(A)} ${rel.rows.length - distinct} kez gereksiz yere tekrar yazılıyor. Bunlar anomalilerin kaynağıdır.`, `${fmt(X)} has ${distinct} distinct values spread over ${rel.rows.length} rows; ${fmt(A)} is needlessly written ${rel.rows.length - distinct} extra times. These repeats are where anomalies come from.`)));
      }
      out.replaceChildren(...kids);
    };
    for (const r of REL) relSeg.append(h("button", { type: "button", "data-name": r.name, onclick: () => { rel = r; fd = null; paint(); } }, r.name));
    host.append(h("div", { class: "stepper" }, relSeg, fdRow, diagram, out));
    paint();
  }
}

// ---- split it yourself: the journey's 1NF table with every repeated fact coloured by the dependency that causes it.
// Clicking a dependency moves X ∪ A to a table of its own; the repeat counter, each table's normal form, the lossless
// check and any lost dependency update at once. Any order is allowed.
{
  const host = $("#nf-split");
  if (host) {
    const flat = journeyData();
    const A1 = ["Ssn", "Pnumber", "Ename", "Dnumber", "Dname", "Pname", "Hours"];
    const COLOR = { Ename: 0, Dnumber: 0, Dname: 1, Pname: 2 }; // the FD each attribute comes from: Ssn →, Dnumber →, Pnumber →
    const NAME = { Ssn: "EMP", Dnumber: "DEPT", Pnumber: "PROJ" };
    const start = () => [{ name: "EMP_PROJ", attrs: A1 }];
    let tables = start(), history = [], last = null;
    const start0 = repeatsOf(tables);
    function badFDs(T) {
      return analyze(T.attrs, JF).fds.filter((f) => !T.attrs.every((x) => closure(f.lhs, JF).includes(x)));
    }
    function cellsOf(T) { // repeated cells of one table: "row|col" → colour
      const rows = project(flat, T.attrs), rep = new Map();
      for (const f of badFDs(T)) {
        const seen = new Set();
        rows.forEach((r, i) => { const k = rowKey(r, f.lhs); if (seen.has(k)) for (const c of f.rhs) rep.set(`${i}|${c}`, COLOR[c] ?? 3); seen.add(k); });
      }
      return { rows, rep };
    }
    function repeatsOf(ts) { return ts.reduce((n, T) => n + cellsOf(T).rep.size, 0); }
    function joinAll(ts) {
      let parts = ts.map((T) => project(flat, T.attrs)), acc = parts.shift();
      while (parts.length) { // join next a part that shares attributes, so no accidental cross product
        let i = parts.findIndex((p) => Object.keys(p[0]).some((k) => k in acc[0]));
        if (i < 0) i = 0;
        acc = natJoin(acc, parts.splice(i, 1)[0]);
      }
      return acc;
    }
    const meter = h("div"), body = h("div"), ctrl = h("div", { class: "btn-row" }), msg = h("div");
    const split = (T, f) => {
      history.push(tables);
      const A = f.rhs, X = f.lhs;
      let nm = X.length === 1 && NAME[X[0]] || `${T.name}_${X.join("_")}`;
      while (tables.some((t) => t.name === nm)) nm += "2";
      const before = repeatsOf(tables);
      tables = tables.flatMap((t) => t === T ? [{ name: t.name, attrs: t.attrs.filter((x) => !A.includes(x)) }, { name: nm, attrs: [...X, ...A] }] : [t]);
      last = { f, nm, from: T.name, before, after: repeatsOf(tables) };
      paint();
    };
    const paint = () => {
      const total = repeatsOf(tables), joined = joinAll(tables);
      const lossless = joined.length === flat.length && joined.every((r) => flat.some((o) => A1.every((a) => o[a] === r[a])));
      const lost = lostFDs(JF, tables.map((t) => t.attrs));
      meter.replaceChildren(h("div", { class: "split-meter" },
        h("div", { class: "split-bar" }, h("span", { style: { width: `${(100 * total) / start0}%` } })),
        h("span", { class: "small" }, h("strong", {}, tl(`${total} gereksiz tekrar`, `${total} needless repeats`)), tl(` (başta ${start0})`, ` (${start0} at the start)`), " · ",
          lossless ? h("span", { class: "ok-text" }, tl(`join ${flat.length} satırı eksiksiz geri veriyor ✓`, `the join gives back all ${flat.length} rows ✓`)) : h("span", { class: "bad-text" }, tl(`join ${joined.length} satır veriyor ✗`, `the join gives ${joined.length} rows ✗`)),
          lost.length ? [" · ", h("span", { class: "bad-text" }, tl(`kaybolan bağımlılık: ${lost.map(fmtFD).join(", ")}`, `lost dependency: ${lost.map(fmtFD).join(", ")}`))] : "")));
      const all = tables.flatMap((T) => badFDs(T).map((f) => [T, f]));
      ctrl.replaceChildren(...(all.length ? [h("span", { class: "small muted" }, tl("Ayırmak için bir bağımlılığa tıklayın:", "Click a dependency to split it off:"))] : []),
        ...all.map(([T, f]) => h("button", { type: "button", class: `split-fd c${COLOR[f.rhs[0]] ?? 3}`, onclick: () => split(T, f) }, `${fmtFD(f)}`, h("span", { class: "small muted" }, ` (${T.name})`))),
        button(tl("↶ Geri al", "↶ Undo"), () => { tables = history.pop() || start(); last = null; paint(); }), button(tl("Baştan", "Start over"), () => { tables = start(); history = []; last = null; paint(); }));
      ctrl.lastChild.previousSibling.disabled = !history.length;
      body.replaceChildren(h("div", { class: "split-tables" }, ...tables.map((T) => {
        const { rows, rep } = cellsOf(T), a = analyze(T.attrs, JF), key = a.keys[0] || [];
        return h("div", { class: "split-t" + (last && (T.name === last.nm) ? " fresh" : "") },
          h("div", { class: "split-h" }, h("strong", {}, T.name), " ", h("span", { class: `nf-badge nf${a.nf}` }, NF_NAME[a.nf]), h("span", { class: "small muted" }, tl(` ${rows.length} satır`, ` ${rows.length} rows`))),
          h("div", { class: "table-wrap" }, h("table", { class: "simple jt" },
            h("thead", {}, h("tr", {}, ...T.attrs.map((c) => h("th", { class: COLOR[c] != null && !key.includes(c) ? `c${COLOR[c]}` : null }, key.includes(c) ? h("u", {}, c) : c)))),
            h("tbody", {}, ...rows.map((r, i) => h("tr", {}, ...T.attrs.map((c) => { const k = rep.get(`${i}|${c}`); return h("td", { class: k != null ? `dup c${k}` : null, title: k != null ? tl("Bu bilgi bu tabloda zaten yazılı: gereksiz tekrar", "This fact is already written in this table: a needless repeat") : null }, String(r[c])); })))))));
      })));
      const out = [];
      if (!last) out.push(tl("Renkli hücreler gereksiz tekrarlardır; rengi, tekrara yol açan bağımlılığı gösterir (mavi Ssn →, turuncu Dnumber →, yeşil Pnumber →). Bir bağımlılığa tıklayın ve tekrarların nereye gittiğini izleyin.", "Coloured cells are needless repeats; the colour shows the dependency causing them (blue Ssn →, orange Dnumber →, green Pnumber →). Click a dependency and watch where the repeats go."));
      else out.push(tl(`${fmtFD(last.f)} ayrıldı: ${last.from}'tan ${last.f.rhs.join(", ")} çıktı, ${last.nm}(${[...last.f.lhs, ...last.f.rhs].join(", ")}) oluştu. ${fmt(last.f.lhs)} yeni tablonun anahtarı olduğu için ${last.f.rhs.join(", ")} her ${fmt(last.f.lhs)} için bir kez yazılıyor: tekrar ${last.before} → ${last.after}.`,
        `${fmtFD(last.f)} split off: ${last.f.rhs.join(", ")} left ${last.from} and ${last.nm}(${[...last.f.lhs, ...last.f.rhs].join(", ")}) was formed. ${fmt(last.f.lhs)} is the new table's key, so ${last.f.rhs.join(", ")} is written once per ${fmt(last.f.lhs)}: repeats ${last.before} → ${last.after}.`));
      if (lost.length) out.push(tl(`Dikkat: ${lost.map(fmtFD).join(", ")} artık tek bir tablonun içinde değil; DBMS onu bir anahtarla zorlayamaz. Bu sırayla bölmek bağımlılığı kaybettirdi. Geri alıp önce ${fmt(lost[0].lhs)} → ${lost[0].rhs.join(", ")}'ı ayırmayı deneyin.`,
        `Note: ${lost.map(fmtFD).join(", ")} is no longer inside a single table; the DBMS cannot enforce it with a key. Splitting in this order lost the dependency. Undo and try splitting ${fmt(lost[0].lhs)} → ${lost[0].rhs.join(", ")} first.`));
      if (!all.length) out.push(tl(`Bitti: ${tables.length} tablonun hepsi BCNF'te, hiçbir bilgi iki kez yazılmıyor ve join orijinal ${flat.length} satırı geri veriyor. Aşağıdaki yolculuk aynı sonuca 1NF → 2NF → 3NF sırasıyla varır.`,
        `Done: all ${tables.length} tables are in BCNF, no fact is written twice and the join gives back the original ${flat.length} rows. The journey below reaches the same result in the order 1NF → 2NF → 3NF.`));
      msg.replaceChildren(...out.map((t, i) => h("div", { class: `res-msg ${i === 0 && !all.length ? "ok" : lost.length && i === 1 ? "warn" : "status"}`, style: { fontFamily: "inherit" } }, t)));
    };
    host.append(h("div", { class: "stepper" }, meter, ctrl, msg, body));
    paint();
  }
}

// ---- every term on one table: the journey's EMP_PROJ as a strip of attribute boxes; hovering or clicking a term
// lights up the attributes it talks about (left side blue, right side orange, key underlined).
{
  const host = $("#nf-terms");
  if (host) {
    const R = ["Ssn", "Pnumber", "Ename", "Dnumber", "Dname", "Pname", "Hours"];
    // [term, left/role attrs, right attrs, definition, example]
    const T = [
      [tl("Fonksiyonel bağımlılık (FD)", "Functional dependency (FD)"), ["Ssn"], ["Ename"], tl("X → Y: X'i aynı olan iki satırın Y'si de aynı olmak zorunda.", "X → Y: two rows with the same X must have the same Y."), "Ssn → Ename"],
      [tl("Süper anahtar", "Superkey"), ["Ssn", "Pnumber", "Hours"], [], tl("Değeri iki satırda asla aynı olmayan öznitelik kümesi; fazlalık içerebilir.", "A set of attributes whose value is never the same in two rows; it may contain extras."), "{Ssn, Pnumber, Hours}"],
      [tl("Aday anahtar (anahtar)", "Candidate key (key)"), ["Ssn", "Pnumber"], [], tl("Minimal süper anahtar: bir özniteliği çıkarınca artık satırları ayırt edemez. Biri primary key seçilir.", "A minimal superkey: remove any attribute and it no longer tells rows apart. One is chosen as the primary key."), "{Ssn, Pnumber}"],
      [tl("Asal (prime) öznitelik", "Prime attribute"), ["Ssn", "Pnumber"], [], tl("Herhangi bir aday anahtarın içinde geçen öznitelik.", "An attribute that appears in some candidate key."), "Ssn, Pnumber"],
      [tl("Asal olmayan (nonprime) öznitelik", "Nonprime attribute"), [], ["Ename", "Dnumber", "Dname", "Pname", "Hours"], tl("Hiçbir aday anahtarda geçmeyen öznitelik. 2NF ve 3NF bunları korur.", "An attribute in no candidate key. 2NF and 3NF protect these."), "Ename, Dnumber, Dname, Pname, Hours"],
      [tl("Kapanış X⁺", "Closure X⁺"), ["Ssn"], ["Ename", "Dnumber", "Dname"], tl("X'ten bağımlılıklar zinciriyle ulaşılan bütün öznitelikler. X⁺ her şeyi içeriyorsa X süper anahtardır.", "Every attribute reachable from X by chaining dependencies. If X⁺ contains everything, X is a superkey."), "Ssn⁺ = {Ssn, Ename, Dnumber, Dname}"],
      [tl("Tam bağımlılık", "Full dependency"), ["Ssn", "Pnumber"], ["Hours"], tl("Sol taraftan bir öznitelik çıkarınca bozulan bağımlılık: Hours için hem çalışan hem proje gerekir.", "A dependency that breaks if any attribute leaves the left side: Hours needs both the employee and the project."), "{Ssn, Pnumber} → Hours"],
      [tl("Kısmi bağımlılık", "Partial dependency"), ["Ssn"], ["Ename"], tl("Asal olmayan bir özniteliğin anahtarın yalnızca bir parçasına bağlı olması. 2NF bunu yasaklar.", "A nonprime attribute depending on only part of the key. 2NF forbids it."), tl("Ssn → Ename (anahtar {Ssn, Pnumber})", "Ssn → Ename (key {Ssn, Pnumber})")],
      [tl("Geçişli bağımlılık", "Transitive dependency"), ["Dnumber"], ["Dname"], tl("Asal olmayan bir özniteliğin anahtara başka bir anahtar olmayan öznitelik üzerinden bağlı olması. 3NF bunu yasaklar.", "A nonprime attribute depending on the key through another non-key attribute. 3NF forbids it."), "Ssn → Dnumber → Dname"],
      [tl("Anomali", "Anomaly"), [], ["Dname"], tl("Tekrardan doğan güncelleme, ekleme ve silme sorunları: bir adı bir satırda değiştirip ötekinde unutmak gibi.", "Update, insertion and deletion problems caused by repetition, such as renaming in one row and forgetting another."), tl("'Research' 4 satırda yazılı", "'Research' written in 4 rows")],
      [tl("Ayrıştırma (decomposition)", "Decomposition"), ["Dnumber"], ["Dname"], tl("Tabloyu sütunlarına göre küçük tablolara bölmek; ortak sütun parçaları birbirine bağlar.", "Splitting a table by its columns into smaller tables; a shared column links the parts."), "DEPT(Dnumber, Dname) + EMP_PROJ − Dname"],
      [tl("Kayıpsız join / NJB testi", "Lossless join / NJB test"), ["Dnumber"], [], tl("Parçaların join'i orijinali eksiksiz ve fazlasız verir. Test: ortak öznitelikler parçalardan birinin anahtarı olmalı.", "The join of the parts gives back the original, nothing missing, nothing extra. Test: the shared attributes must be a key of one part."), tl("ortak Dnumber, DEPT'in anahtarı", "shared Dnumber is DEPT's key")],
      [tl("Sahte satır (spurious tuple)", "Spurious tuple"), ["Dname"], [], tl("Kötü bölünmüş parçaların join'inde çıkan, orijinalde olmayan satır.", "A row produced by joining badly split parts that was never in the original."), tl("ortak sütun yalnızca Dname olursa", "if the only shared column is Dname")],
      [tl("Bağımlılığın korunması", "Dependency preservation"), ["Dnumber"], ["Dname"], tl("Her bağımlılığın bölmeden sonra tek bir tablonun içinde kalması; böylece bir anahtarla zorlanabilir. Gerekirse vazgeçilir, kayıpsız join'den asla.", "Every dependency stays inside a single table after the split, so a key can enforce it. It may be given up; a lossless join never."), tl("Dnumber → Dname, DEPT'in içinde", "Dnumber → Dname, inside DEPT")],
    ];
    let sel = 0;
    const strip = h("div", { class: "term-strip" }), cap = h("div", { class: "small term-cap" });
    const paintStrip = () => {
      const [name, L, Rr, , ex] = T[sel];
      strip.replaceChildren(h("span", { class: "term-rel" }, "EMP_PROJ("), ...R.flatMap((a, i) => [i ? h("span", { class: "term-sep" }, ",") : "",
        h("span", { class: "term-attr" + (L.includes(a) ? " l" : "") + (Rr.includes(a) ? " r" : "") + (a === "Ssn" || a === "Pnumber" ? " k" : "") }, a)]), h("span", { class: "term-rel" }, ")"));
      cap.replaceChildren(h("strong", {}, name), ": ", ex);
      for (const [i, tr] of [...list.children].entries()) tr.classList.toggle("on", i === sel);
    };
    const list = h("div", { class: "term-list" }, ...T.map(([name, , , def], i) => h("button", { type: "button", class: "term-row", onmouseenter: () => { sel = i; paintStrip(); }, onfocus: () => { sel = i; paintStrip(); }, onclick: () => { sel = i; paintStrip(); } },
      h("span", { class: "term-name" }, name), h("span", { class: "term-def" }, def))));
    host.append(h("div", { class: "stepper term-box" }, h("div", { class: "term-top" }, strip, cap,
      h("div", { class: "small muted" }, h("span", { class: "term-attr l mini" }, tl("sol taraf", "left side")), " ", h("span", { class: "term-attr r mini" }, tl("sağ taraf / ilgili", "right side / concerned")), " ", h("span", { class: "term-attr k mini" }, tl("anahtar", "key")))), list));
    paintStrip();
  }
}
