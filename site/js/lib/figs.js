// Small explanatory figures for the concept chapters (Ch 1, 2, 3, 20). Each one shows a single idea and changes
// when the reader acts on it, so the "before" stays visible next to the "after".
import { h, button } from "./ui.js";
import { t as tl } from "./i18n.js";
import { parseSchedule, recoverability } from "./schedule.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};
const arrowDefs = (id) => {
  const d = s("defs");
  const m = s("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
  m.append(s("path", { d: "M0,0L10,5L0,10z", fill: "context-stroke" }));
  d.append(m);
  return d;
};

// ------------------------------------------------------------------ Ch 1: file processing vs the database approach
export function fileVsDb(host) {
  const OLD = "555-1234", NEW = "555-9999";
  let phone = false, email = false;
  const val = (v, changed) => (changed ? h("span", {}, h("s", { class: "vz-old" }, OLD), " → ", h("b", { class: "vz-new" }, NEW)) : v);
  const fileRec = (name, mine) =>
    h("div", { class: "vz-file" + (phone && !mine ? " bad" : "") },
      h("div", { class: "vz-cap" }, name),
      h("code", {}, "Smith · ", phone && mine ? val(OLD, true) : OLD, email ? h("span", { class: "vz-new" }, " · ?") : ""));
  const app = (name, note) => h("div", { class: "vz-app" + (email && note ? " bad" : "") }, h("b", {}, name), note && email ? h("div", { class: "vz-cap" }, tl("kodu değişmeli: kayıt yapısı programın içinde", "its code must change: the record layout is inside the program")) : null);
  const out = h("div", { class: "vz-fvd" });
  const verdict = h("p", { class: "vz-verdict" });
  function draw() {
    const left = h("div", { class: "vz-panel" },
      h("div", { class: "vz-ttl" }, tl("Dosya işleme", "File processing")),
      h("div", { class: "vz-cols" },
        h("div", {}, app(tl("Kayıt ofisi", "Registrar"), true), h("div", { class: "vz-down" }, "↓"), fileRec("registrar.dat", true)),
        h("div", {}, app(tl("Muhasebe", "Accounting"), true), h("div", { class: "vz-down" }, "↓"), fileRec("billing.dat", false))),
      h("div", { class: "vz-cap" }, tl("Her programın kendi dosyası: Smith iki kez saklanıyor.", "Each program has its own file: Smith is stored twice.")));
    const right = h("div", { class: "vz-panel" },
      h("div", { class: "vz-ttl" }, tl("Veritabanı yaklaşımı", "Database approach")),
      h("div", { class: "vz-cols" }, app(tl("Kayıt ofisi", "Registrar")), app(tl("Muhasebe", "Accounting"))),
      h("div", { class: "vz-down" }, "↓ ↓"),
      h("div", { class: "vz-dbms" },
        h("div", { class: "vz-cap" }, "DBMS"),
        h("div", { class: "vz-file" + (email ? " good" : "") }, h("div", { class: "vz-cap" }, tl("Katalog (meta-data)", "Catalog (meta-data)")), h("code", {}, "STUDENT(Name, Phone", email ? h("b", { class: "vz-new" }, ", Email") : "", ")")),
        h("div", { class: "vz-file" + (phone ? " good" : "") }, h("div", { class: "vz-cap" }, "STUDENT"), h("code", {}, "Smith · ", phone ? val(OLD, true) : OLD, email ? " · NULL" : ""))),
      h("div", { class: "vz-cap" }, tl("Tek kopya; yapı katalogda, programlarda değil.", "One copy; the structure is in the catalog, not in the programs.")));
    verdict.replaceChildren(
      !phone && !email ? tl("Bir değişiklik seçin ve iki tarafı karşılaştırın.", "Pick a change and compare the two sides.") : "",
      phone ? h("span", {}, h("b", { class: "vz-bad" }, tl("Dosya işleme: tutarsız. ", "File processing: inconsistent. ")), tl("Muhasebe hâlâ eski numarayı görüyor. ", "Accounting still sees the old number. "), h("b", { class: "vz-good" }, tl("Veritabanı: ", "Database: ")), tl("tek satır güncellendi, iki program da yeniyi görüyor (kontrollü tekrar). ", "one row was updated, both programs see the new value (controlled redundancy). ")) : "",
      email ? h("span", {}, h("b", { class: "vz-bad" }, tl("Dosya işleme: ", "File processing: ")), tl("iki programın kodu değişir. ", "both programs' code changes. "), h("b", { class: "vz-good" }, tl("Veritabanı: ", "Database: ")), tl("yalnızca katalog değişir, programlar aynı kalır (program-data independence).", "only the catalog changes; the programs stay the same (program-data independence).")) : "");
    out.replaceChildren(left, right);
  }
  host.replaceChildren(
    h("div", { class: "btn-row" },
      button(tl("Smith'in telefonu değişti", "Smith's phone changed"), () => { phone = true; draw(); }),
      button(tl("Yeni sütun: Email", "New column: Email"), () => { email = true; draw(); }),
      button(tl("Baştan", "Reset"), () => { phone = email = false; draw(); }, { kind: "ghost" })),
    out, verdict);
  draw();
}

// ------------------------------------------------------------------ Ch 1: who works on what
export function actors(host) {
  const band = (cls, title, chips, what) =>
    h("div", { class: "vz-band " + cls }, h("div", { class: "vz-ttl" }, title),
      h("div", { class: "vz-chips" }, ...chips.map(([n, d]) => h("span", { class: "chip", title: d }, n))),
      h("div", { class: "vz-cap" }, what));
  host.replaceChildren(h("figure", { class: "vz-actors" },
    band("on", tl("Sahnedekiler: veritabanının içeriğiyle çalışır", "On the scene: work with the database's content"),
      [["DBA", tl("erişimi yetkilendirir, izler", "authorizes and monitors access")], [tl("Tasarımcı", "Designer"), tl("yapıları ve view'ları belirler", "chooses structures and views")],
       [tl("Son kullanıcılar", "End users"), "casual · naive · sophisticated · standalone"], [tl("Analist / programcı", "Analyst / programmer"), tl("canned transaction'ları yazar", "write canned transactions")]],
      "↓ STUDENT, COURSE, GRADE_REPORT …"),
    h("div", { class: "vz-db" }, h("span", {}, tl("Veritabanı", "Database")), h("span", { class: "vz-cap" }, tl("içerik", "content"))),
    h("div", { class: "vz-db sw" }, h("span", {}, tl("DBMS yazılımı + donanım", "DBMS software + hardware"))),
    band("behind", tl("Perde arkasındakiler: DBMS'i ve ortamını sağlar", "Behind the scene: provide the DBMS and its environment"),
      [[tl("DBMS tasarımcıları", "DBMS designers"), tl("katalog, sorgu işleme, recovery modüllerini yazar", "write the catalog, query processing, recovery modules")], [tl("Araç geliştiriciler", "Tool developers"), tl("modelleme, performans araçları", "modelling and performance tools")], [tl("Operatörler", "Operators"), tl("donanım ve yazılımı çalıştırır", "run the hardware and software")]],
      tl("↑ içerikle ilgilenmezler", "↑ they do not deal with the content")),
    h("figcaption", {}, tl("Bir aktörün üzerine gelince ne yaptığı görünür.", "Hover an actor to see what they do."))));
}

// ------------------------------------------------------------------ Ch 2: DBMS component modules (Figure 2.3)
export function dbmsComponents(host) {
  const N = {
    dba: [80, 22, "DBA"], casual: [235, 22, "Casual user"], prog: [405, 22, "App programmer"], param: [565, 22, "Parametric user"],
    ddl: [80, 82, "DDL statements"], iq: [235, 82, "Interactive query"], app: [405, 82, "Application program"],
    ddlc: [80, 142, "DDL compiler"], qc: [235, 142, "Query compiler"], pre: [405, 142, "Precompiler"],
    cat: [80, 262, "System catalog"], qo: [235, 202, "Query optimizer"], dmlc: [405, 202, "DML compiler"],
    canned: [500, 262, "Canned transactions"], rt: [320, 322, "Runtime DB processor"], cc: [545, 322, "Concurrency/recovery"],
    sdm: [320, 382, "Stored data manager"],
  };
  const P = {
    ddl: { label: tl("Şema tanımı (DDL)", "Schema definition (DDL)"), nodes: "dba ddl ddlc cat sdm", note: tl("DDL derleyicisi tanımı katalog'a yazar; veri değişmez, yalnızca meta-data.", "The DDL compiler writes the definition into the catalog; no data changes, only meta-data.") },
    q: { label: tl("Etkileşimli sorgu", "Interactive query"), nodes: "casual iq qc qo rt sdm cat", note: tl("Sorgu derlenir, katalogdan doğrulanır, optimizer bir plan seçer, runtime işlemci planı çalıştırır.", "The query is compiled, checked against the catalog, the optimizer picks a plan, the runtime processor runs it.") },
    p: { label: tl("Uygulama programı", "Application program"), nodes: "prog app pre dmlc canned rt sdm", note: tl("Precompiler gömülü SQL'i ayırır, DML derleyicisi onu derler; sonuç hazır (canned) transaction olur.", "The precompiler pulls out the embedded SQL, the DML compiler compiles it; the result is a canned transaction.") },
    pr: { label: tl("Parametrik kullanıcı", "Parametric user"), nodes: "param canned rt sdm", note: tl("Veznedar hazır transaction'ı parametreyle çağırır; derleme yok, doğrudan çalışır.", "A bank teller calls a canned transaction with parameters; nothing is compiled, it just runs.") },
  };
  const E = [["dba", "ddl"], ["casual", "iq"], ["prog", "app"], ["ddl", "ddlc"], ["iq", "qc"], ["app", "pre"], ["ddlc", "cat"], ["qc", "qo"], ["pre", "dmlc"], ["qo", "rt"], ["dmlc", "canned"], ["param", "canned"], ["canned", "rt"], ["rt", "sdm"], ["cat", "sdm"], ["cat", "qc", "d"], ["cc", "rt", "d"]];
  const W = 132, H = 28;
  const svg = s("svg", { viewBox: "10 4 630 456", class: "vz-comp", role: "img", "aria-label": tl("DBMS bileşenleri", "DBMS components") });
  svg.append(arrowDefs("vzc-a"));
  const nodeEl = {}, edgeEl = [];
  for (const [a, b, d] of E) {
    const [x1, y1] = N[a], [x2, y2] = N[b];
    const up = y2 < y1, side = y1 === y2;
    const wa = Math.max(W, N[a][2].length * 7 + 16) / 2, wb = Math.max(W, N[b][2].length * 7 + 16) / 2;
    const p = side ? [x1 + (x2 > x1 ? wa : -wa), y1, x2 + (x2 > x1 ? -wb : wb), y2] : [x1, y1 + (up ? -H / 2 : H / 2), x2, y2 + (up ? H / 2 : -H / 2)];
    const l = s("line", { x1: p[0], y1: p[1], x2: p[2], y2: p[3], class: "vz-e" + (d ? " dash" : ""), "marker-end": "url(#vzc-a)" });
    l.dataset.a = a; l.dataset.b = b;
    edgeEl.push(l); svg.append(l);
  }
  for (const [k, [x, y, t]] of Object.entries(N)) {
    const g = s("g", { class: "vz-n" + (["dba", "casual", "prog", "param"].includes(k) ? " user" : "") });
    const w = Math.max(W, t.length * 7 + 16);
    g.append(s("rect", { x: x - w / 2, y: y - H / 2, width: w, height: H, rx: 5 }), s("text", { x, y }, t));
    nodeEl[k] = g; svg.append(g);
  }
  // the stored database
  const disk = s("g", { class: "vz-n" });
  disk.append(s("path", { d: "M250,425 v24 a70,9 0 0 0 140,0 v-24" }), s("ellipse", { cx: 320, cy: 425, rx: 70, ry: 9 }), s("text", { x: 320, y: 446 }, "Stored database"));
  nodeEl.disk = disk; svg.append(disk, s("line", { x1: 320, y1: 396, x2: 320, y2: 414, class: "vz-e", "marker-end": "url(#vzc-a)" }));
  const note = h("p", { class: "vz-verdict" });
  const btns = {};
  function pick(id) {
    const on = id ? new Set([...P[id].nodes.split(" "), "disk"]) : null;
    for (const [k, g] of Object.entries(nodeEl)) g.classList.toggle("dim", !!on && !on.has(k)), g.classList.toggle("hl", !!on && on.has(k));
    for (const l of edgeEl) { const lit = on && on.has(l.dataset.a) && on.has(l.dataset.b); l.classList.toggle("hl", !!lit); l.classList.toggle("dim", !!on && !lit); }
    for (const [k, b] of Object.entries(btns)) b.setAttribute("aria-pressed", String(k === id));
    note.textContent = id ? P[id].note : tl("Bir yol seçin: komut hangi modüllerden geçip diske ulaşıyor?", "Pick a path: which modules does the request pass through on its way to disk?");
  }
  const seg = h("div", { class: "seg" }, ...Object.entries(P).map(([k, v]) => (btns[k] = h("button", { type: "button", onclick: () => pick(k) }, v.label))));
  host.replaceChildren(h("figure", { class: "er small", style: "max-width:700px" }, seg, svg, note, h("figcaption", {}, tl("Figure 2.3'ün sadeleştirilmiş hâli. Kesik çizgiler: katalog okuma ve runtime işlemciyle birlikte çalışan alt sistemler.", "A simplified Figure 2.3. Dashed lines: catalog reads and the subsystems that work with the runtime processor."))));
  pick(null);
}

// ------------------------------------------------------------------ Ch 3: the design process (Figure 3.1)
export function designFlow(host, here = 1) {
  const steps = [
    [tl("Gereksinim toplama ve analiz", "Requirements collection and analysis"), tl("veri ve fonksiyonel gereksinimler", "data and functional requirements"), null],
    [tl("Kavramsal tasarım", "Conceptual design"), tl("ER şeması", "ER schema"), ["ch3-er.html", "Ch 3–4"]],
    [tl("Mantıksal tasarım (mapping)", "Logical design (mapping)"), tl("tablolar", "tables"), ["ch9-mapping.html", "Ch 9"]],
    [tl("Fiziksel tasarım", "Physical design"), tl("dosyalar, index'ler", "files, indexes"), ["ch16-files.html", "Ch 16–17"]],
  ];
  const row = h("div", { class: "vz-flow" });
  steps.forEach(([t, out, link], i) => {
    if (i) row.append(h("div", { class: "vz-arrow" }, "→"));
    row.append(h("div", { class: "vz-step" + (i === here ? " here" : "") },
      h("div", { class: "vz-num" }, String(i + 1)), h("b", {}, t), h("div", { class: "vz-cap" }, "⇒ " + out),
      i === here ? h("div", { class: "vz-tag" }, tl("bu sayfa", "this page")) : link ? h("a", { href: link[0], class: "vz-cap" }, link[1] + " →") : null));
  });
  host.replaceChildren(h("figure", { class: "vz-design" }, row,
    h("div", { class: "vz-brackets" }, h("span", {}, tl("DBMS'ten bağımsız", "DBMS-independent")), h("span", {}, tl("DBMS'e özgü", "DBMS-specific")))));
}

// ------------------------------------------------------------------ Ch 3: weak entity DEPENDENT and its partial key
export function weakEntity(host) {
  const EMP = [["123456789", "Smith", ["Michael", "Alice", "Elizabeth"]], ["333445555", "Wong", ["Alice", "Theodore", "Joy"]]];
  let mode = null;
  const MODES = {
    name: [tl("Dependent_name = 'Alice'", "Dependent_name = 'Alice'"), tl("İki satır eşleşir: ad tek başına anahtar değil, yalnızca aynı sahibin bağımlılarını ayırır (partial key).", "Two rows match: the name alone is not a key; it only tells apart the dependents of one owner (partial key).")],
    full: [tl("(Essn = 333445555, 'Alice')", "(Essn = 333445555, 'Alice')"), tl("Tek satır: sahibin anahtarı + partial key bir bağımlıyı tam tanımlar. Tablodaki primary key budur.", "One row: the owner's key + the partial key identify a dependent. That is the table's primary key.")],
    del: [tl("Wong silinsin", "Delete Wong"), tl("Wong'un bağımlıları da gider: sahibi olmadan var olamazlar (existence dependency, total katılım).", "Wong's dependents go too: they cannot exist without their owner (existence dependency, total participation).")],
  };
  const body = h("div", { class: "vz-weak" }), note = h("p", { class: "vz-verdict" }), btns = {};
  function draw() {
    body.replaceChildren(...EMP.map(([ssn, n, deps]) => {
      const gone = mode === "del" && n === "Wong";
      return h("div", { class: "vz-owner" + (gone ? " gone" : "") },
        h("div", {}, h("b", {}, n), " ", h("code", { class: "vz-cap" }, "Ssn " + ssn)),
        h("div", { class: "vz-deps" }, ...deps.map((d) => {
          const hit = d === "Alice" && (mode === "name" || (mode === "full" && n === "Wong"));
          return h("span", { class: "vz-dep" + (hit ? (mode === "name" ? " amb" : " hit") : "") }, d);
        })));
    }));
    for (const [k, b] of Object.entries(btns)) b.setAttribute("aria-pressed", String(k === mode));
    note.textContent = mode ? MODES[mode][1] : tl("DEPENDENT kendi anahtarı olmayan bir zayıf varlık. Bir bağımlıyı nasıl bulursunuz?", "DEPENDENT is a weak entity with no key of its own. How do you find one dependent?");
  }
  const seg = h("div", { class: "seg" }, ...Object.entries(MODES).map(([k, [l]]) => (btns[k] = h("button", { type: "button", onclick: () => { mode = mode === k ? null : k; draw(); } }, l))));
  host.replaceChildren(seg, body, note);
  draw();
}

// ------------------------------------------------------------------ Ch 20: interleaved vs parallel (Figure 20.1)
export function interleave(host) {
  const svg = s("svg", { viewBox: "0 0 560 170", class: "vz-gantt", role: "img", "aria-label": tl("İç içe ve paralel çalışma", "Interleaved and parallel processing") });
  const rows = [["A", [[0, 1], [2, 3]], 1], ["B", [[1, 2], [3, 4]], 1], ["C", [[2.2, 4]], 2], ["D", [[2.2, 4]], 3]];
  const X = (t) => 70 + t * 115;
  rows.forEach(([n, segs, c], i) => {
    const y = 18 + i * 30 + (i >= 2 ? 12 : 0);
    svg.append(s("text", { x: 46, y: y + 11, class: "vz-glbl" }, n));
    for (const [a, b] of segs) svg.append(s("rect", { x: X(a), y, width: X(b) - X(a) - 2, height: 20, rx: 3, style: `fill:var(--s${c})` }));
  });
  for (let t = 0; t <= 4; t++) svg.append(s("line", { x1: X(t), y1: 12, x2: X(t), y2: 142, class: "vz-grid" }), s("text", { x: X(t), y: 160, class: "vz-glbl", "text-anchor": "middle" }, t ? "t" + t : "0"));
  svg.append(s("text", { x: X(1), y: 10, class: "vz-gcap" }, tl("tek CPU: A ve B sırayla parça parça", "one CPU: A and B take turns")), s("text", { x: X(2.2), y: 84, class: "vz-gcap" }, tl("iki CPU: C ve D aynı anda", "two CPUs: C and D at the same time")));
  host.replaceChildren(h("figure", { class: "er small", style: "max-width:600px" }, svg, h("figcaption", {}, tl("Figure 20.1. Bu sayfadaki teori A–B gibi iç içe geçen çalışmayı esas alır.", "Figure 20.1. The theory on this page assumes interleaving, like A and B."))));
}

// ------------------------------------------------------------------ Ch 20: read_item / write_item through the buffer
export function rwItem(host) {
  const steps = [
    { op: tl("başlangıç", "start"), disk: 80, buf: null, v: null, note: tl("X = 80 diskteki bir blokta. Bellekte henüz kopyası yok.", "X = 80 sits in a disk block. There is no copy in memory yet.") },
    { op: "read_item(X)", disk: 80, buf: 80, v: 80, ch: ["buf", "v"], note: tl("Blok diskten tampona kopyalanır, X tampondan program değişkenine.", "The block is copied from disk into a buffer, and X from the buffer into the program variable.") },
    { op: "X := X − 5", disk: 80, buf: 80, v: 75, ch: ["v"], note: tl("Hesap yalnızca programın değişkeninde. Veritabanı henüz değişmedi.", "The arithmetic happens only in the program's variable. The database has not changed.") },
    { op: "write_item(X)", disk: 80, buf: 75, v: 75, ch: ["buf"], dirty: true, note: tl("Değer tampona yazılır. Disk hâlâ 80: tampon ile disk farklı.", "The value goes into the buffer. Disk still says 80: buffer and disk differ.") },
    { op: tl("blok diske yazılır", "block is flushed"), disk: 75, buf: 75, v: 75, ch: ["disk"], note: tl("Blok diske hemen ya da daha sonra yazılır. Bu ikisi arasında çökme olursa kurtarma gerekir.", "The block is written back now or later. A crash in between is why recovery is needed.") },
  ];
  let i = 0;
  const box = (k, ttl, v, prev, dirty) => h("div", { class: "vz-mem" + (steps[i].ch?.includes(k) ? " changed" : "") + (dirty ? " dirty" : "") },
    h("div", { class: "vz-cap" }, ttl), h("div", { class: "vz-val" }, v == null ? "—" : prev != null && prev !== v ? h("span", {}, h("s", { class: "vz-old" }, String(prev)), " → ", h("b", {}, String(v))) : String(v)),
    dirty ? h("div", { class: "vz-cap vz-bad" }, tl("diskten farklı", "differs from disk")) : null);
  const view = h("div"), ops = h("div", { class: "vz-ops" });
  function draw() {
    const st = steps[i], pr = steps[i - 1] || {};
    ops.replaceChildren(...steps.slice(1).map((x, k) => h("code", { class: k + 1 === i ? "on" : k + 1 < i ? "done" : "" }, x.op)));
    view.replaceChildren(
      h("div", { class: "vz-rw" },
        box("disk", tl("Disk bloğu", "Disk block"), st.disk, pr.disk),
        h("div", { class: "vz-arrow" }, "⇄"),
        box("buf", tl("Tampon (bellek)", "Buffer (memory)"), st.buf, pr.buf, st.dirty && st.disk !== st.buf),
        h("div", { class: "vz-arrow" }, "⇄"),
        box("v", tl("T1'in değişkeni X", "T1's variable X"), st.v, pr.v)),
      h("p", { class: "vz-verdict" }, h("b", {}, `${i}/${steps.length - 1} `), st.note));
    prevB.disabled = i === 0; nextB.disabled = i === steps.length - 1;
  }
  const prevB = button(tl("← Geri", "← Back"), () => { i--; draw(); }), nextB = button(tl("İleri →", "Next →"), () => { i++; draw(); }, { kind: "primary" });
  host.replaceChildren(h("div", { class: "btn-row" }, prevB, nextB, button(tl("Baştan", "Reset"), () => { i = 0; draw(); }, { kind: "ghost" }), ops), view);
  draw();
}

// ------------------------------------------------------------------ Ch 20: recoverable ⊃ cascadeless ⊃ strict
export function recSets(host) {
  const EX = [
    ["Sc", "r1(X); w1(X); r2(X); r1(Y); w2(X); c2; a1"],
    ["Sd", "r1(X); w1(X); r2(X); r1(Y); w2(X); w1(Y); c1; c2"],
    ["S1", "r1(X); w1(X); w2(X); c1; c2"],
    ["S2", "r1(X); w1(X); c1; r2(X); w2(X); c2"],
  ].map(([n, txt]) => { const { ops } = parseSchedule(txt); return { n, txt, ops, r: recoverability(ops) }; });
  const level = (r) => (!r.recoverable ? 0 : !r.cascadeless ? 1 : !r.strict ? 2 : 3);
  const R = [[0, 0, 560, 230, tl("bütün çizelgeler", "all schedules")], [70, 34, 480, 186, tl("kurtarılabilir", "recoverable")], [140, 68, 400, 142, "cascadeless"], [210, 102, 320, 98, "strict"]];
  const svg = s("svg", { viewBox: "0 0 570 240", class: "vz-sets", role: "img", "aria-label": tl("Kurtarılabilirlik sınıfları", "Recoverability classes") });
  R.forEach(([x, y, w, hh, t], k) => svg.append(s("rect", { x: x + 4, y: y + 4, width: w, height: hh, rx: 14, class: "vz-set l" + k }), s("text", { x: x + 16, y: y + 22, class: "vz-lvl" }, t)));
  const dots = EX.map((e) => {
    const k = level(e.r), x = [38, 108, 178, 380][k] , y = [130, 140, 150, 150][k];
    const g = s("g", { class: "vz-dot", tabindex: 0, role: "button" });
    g.append(s("circle", { cx: x, cy: y, r: 16 }), s("text", { x, y }, e.n));
    g.addEventListener("click", () => pick(e)); g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(e); } });
    svg.append(g);
    return [e, g];
  });
  const detail = h("div");
  function pick(e) {
    for (const [x, g] of dots) g.classList.toggle("on", x === e);
    const w = e.r.why, bad = new Set();
    const first = !e.r.recoverable ? w.recoverable : !e.r.cascadeless ? w.cascadeless : !e.r.strict ? w.strict : null;
    if (first) for (const o of [first.read, first.write, first.commit, first.writerEnd, first.op]) if (o) bad.add(o.i);
    const reason = !e.r.recoverable ? tl("T2, T1'in yazdığı X'i okuyup T1'den önce commit oluyor; T1 abort olunca T2 geri alınamaz.", "T2 reads the X that T1 wrote and commits before T1; when T1 aborts, T2 can no longer be undone.")
      : !e.r.cascadeless ? tl("Kurtarılabilir (T2, T1'den sonra commit oluyor), ama T2 commit olmamış bir değeri okuyor: T1 abort olsaydı T2 de geri alınırdı.", "Recoverable (T2 commits after T1), but T2 reads an uncommitted value: had T1 aborted, T2 would be rolled back too.")
      : !e.r.strict ? tl("Kimse commit olmamış değeri okumuyor (cascadeless), ama T2, T1 bitmeden X'in üzerine yazıyor: strict değil.", "Nobody reads an uncommitted value (cascadeless), but T2 overwrites X before T1 ends: not strict.")
      : tl("T2, X'e ancak T1 commit olduktan sonra dokunuyor: strict, dolayısıyla diğer ikisi de.", "T2 touches X only after T1 commits: strict, and so the other two as well.");
    detail.replaceChildren(
      h("table", { class: "simple vz-sched" }, h("thead", {}, h("tr", {}, h("th", {}, "T1"), h("th", {}, "T2"))),
        h("tbody", {}, ...e.ops.map((o) => h("tr", {}, ...[1, 2].map((t) => h("td", { class: o.t === t && bad.has(o.i) ? "bad" : "" }, o.t === t ? o.kind + o.t + (o.item ? `(${o.item})` : "") : "")))))),
      h("p", { class: "vz-verdict" }, h("b", {}, e.n + ": "), reason));
  }
  host.replaceChildren(h("figure", { class: "er small", style: "max-width:620px" }, svg, h("figcaption", {}, tl("Her kutu bir içindekini kapsar. Bir çizelgeye tıklayın: işlemler zaman sırasıyla, sorunlu olanlar kırmızı.", "Each box contains the one inside it. Click a schedule: operations in time order, the offending ones in red."))), detail);
  pick(EX[0]);
}
