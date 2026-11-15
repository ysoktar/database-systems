// FDs and normalization (Ch 14, slides 1–55): ruling out FDs from a relation state, and a normalization tool that
// finds keys and the highest normal form, says which FD breaks the next one, and decomposes step by step
// (each step: the relation before → the two relations after, with the NJB test).
import "../layout.js";
import { $, h } from "../lib/ui.js";
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
