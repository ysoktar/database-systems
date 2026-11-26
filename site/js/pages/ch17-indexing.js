// Ch 17 (indexing): the three single-level index types on a small EMPLOYEE file, an index cost calculator (single-level
// and multilevel, B+-tree orders), a step-by-step B+-tree / B-tree insertion player with before/after trees and search
// paths, and a bitmap index demo.
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { t as tl } from "../lib/i18n.js";

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const field = (label, input) => h("label", { class: "small sim-field" }, label, input);

// ---------------------------------------------------------------- index types on a small file
const EMP = [["123456789", "Smith", 5], ["333445555", "Wong", 5], ["453453453", "English", 5], ["666884444", "Narayan", 5],
  ["888665555", "Borg", 1], ["987654321", "Wallace", 4], ["987987987", "Jabbar", 4], ["999887777", "Zelaya", 4]];
{
  const host = $("#index-types");
  const BFR = 3;
  const hashOf = (name) => name.length % 4; // the hash index's h(K): the number of letters mod 4
  const TYPES = {
    primary: { label: tl("Birincil (Ssn)", "Primary (Ssn)"), order: 0, field: 0, def: "666884444",
      note: tl("Dosya Ssn'e göre sıralı ve Ssn bir anahtar. Her giriş ⟨K(i), P(i)⟩: K(i), i. bloğun ilk kaydının Ssn'i (blok çapası); P(i), o bloğun adresi. Her blok için bir giriş olduğundan indeks seyrektir: 8 kayıt, 3 giriş.", "The file is sorted on Ssn, a key. Each entry is ⟨K(i), P(i)⟩: K(i) is the Ssn of block i's first record (the block anchor); P(i) is that block's address. One entry per block makes the index sparse: 8 records, 3 entries.") },
    clustering: { label: tl("Kümeleme (Dno)", "Clustering (Dno)"), order: 2, field: 2, def: "4",
      note: tl("Dosya Dno'ya göre sıralı ama Dno bir anahtar değil: aynı değer birçok kayıtta var. Her farklı Dno için bir giriş var: K(i) bir Dno değeri, P(i) o değerin ilk göründüğü blok.", "The file is sorted on Dno, which is not a key: a value repeats in many records. There is one entry per distinct Dno: K(i) is a Dno value, P(i) the first block where it appears.") },
    secondary: { label: tl("İkincil (Lname)", "Secondary (Lname)"), order: 0, field: 1, def: "Wallace",
      note: tl("Dosya Ssn'e göre sıralı; Lname'e göre değil. Lname'ler bloklara dağınık olduğu için her kayıt için bir giriş gerekir: K(i) bir Lname, P(i) kaydın bulunduğu blok (blok işaretçisi, Figure 17.4; kayıt işaretçisi de olabilir). İndeks yoğun: 8 kayıt, 8 giriş.", "The file is sorted on Ssn, not on Lname. Last names are scattered over the blocks, so every record needs an entry: K(i) is a Lname, P(i) the block holding the record (a block pointer, Figure 17.4; it could also be a record pointer). The index is dense: 8 records, 8 entries.") },
    hash: { label: tl("Hash indeks (Lname)", "Hash index (Lname)"), order: 0, field: 1, def: "Wallace",
      note: tl("Dosya Ssn'e göre düzenli; indeks Lname üzerinde hashing kullanır (Figure 17.15). Girişler ⟨K, P⟩ biçiminde, h(K) = harf sayısı mod 4 ile seçilen kovalarda durur. Arama: h(K) hesaplanır, o kova okunur, girişin P'si izlenir. İndeks sıralı değildir; yalnızca eşitlik araması içindir.", "The file is organized on Ssn; the index uses hashing on Lname (Figure 17.15). The ⟨K, P⟩ entries sit in buckets chosen by h(K) = number of letters mod 4. Search: compute h(K), read that bucket, follow the entry's P. The index is not ordered; it serves equality searches only.") },
  };
  let type = "primary";
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const q = h("input", { type: "text", size: 12, "aria-label": tl("Aranan değer", "Value to find") });
  const foSel = h("select", { "aria-label": "fo", onchange: () => draw() }, ...[2, 3, 4].map((v) => h("option", { value: v, selected: v === 4 ? true : null }, String(v))));
  const out = h("div");
  const cmp = (a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b)));
  const foBox = h("label", { class: "small sim-field" }, tl("İndeks bloğuna sığan giriş (fo): ", "Entries per index block (fo): "), foSel);
  const draw = () => {
    const T = TYPES[type];
    for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.t === type));
    foBox.style.display = type === "hash" ? "none" : "";
    const fo = Number(foSel.value);
    const rows = [...EMP].sort((a, b) => cmp(a[T.order], b[T.order]));
    const blocks = []; for (let i = 0; i < rows.length; i += BFR) blocks.push(rows.slice(i, i + BFR));
    let entries;
    if (type === "primary") entries = blocks.map((b, i) => [b[0][0], i]);
    else if (type === "clustering") { entries = []; blocks.forEach((b, i) => b.forEach((r) => { if (!entries.some((e) => e[0] === r[2])) entries.push([r[2], i]); })); }
    else entries = rows.map((r) => [r[1], blocks.findIndex((b) => b.includes(r))]).sort((a, b) => cmp(a[0], b[0]));
    // search on level 1 (the walk down the upper levels follows from the hit)
    const raw = q.value.trim();
    const key = T.field === 2 ? Number(raw) : raw;
    let hit = -1, read = [], msg = "";
    if (raw) {
      if (type === "primary") {
        hit = entries.reduce((acc, e, i) => (cmp(e[0], key) <= 0 ? i : acc), -1);
        if (hit < 0) msg = tl(`${raw} ilk blok çapasından küçük; dosyada yok.`, `${raw} is smaller than the first block anchor; it is not in the file.`);
        else {
          read = [entries[hit][1]];
          const found = blocks[read[0]].some((r) => r[0] === raw);
          msg = tl(`${raw}'den küçük ya da ona eşit en büyük çapa ${entries[hit][0]}; bu yüzden blok ${read[0] + 1} okunur. ${found ? "Kayıt orada bulunur." : "Kayıt orada yok, dosyada da yok."}`,
            `The largest anchor less than or equal to ${raw} is ${entries[hit][0]}, so block ${read[0] + 1} is read. ${found ? "The record is found there." : "The record is not there, so it is not in the file."}`);
        }
      } else {
        hit = entries.findIndex((e) => e[0] === key);
        if (hit < 0) msg = tl(`İndekste ${raw} diye bir giriş yok; böyle bir kayıt yok.`, `There is no index entry ${raw}; there is no such record.`);
        else if (type === "clustering") {
          let b = entries[hit][1];
          while (b < blocks.length && blocks[b].some((r) => r[2] === key)) read.push(b++);
          msg = tl(`Giriş ${raw}, ${read[0] + 1}. bloğu gösteriyor. Dosya Dno'ya göre sıralı olduğu için Dno = ${raw} olan kayıtlar oradan başlayarak ardışık durur: ${read.map((x) => x + 1).join(" ve ")}. blok okunur.`,
            `The entry ${raw} points to block ${read[0] + 1}. The file is sorted on Dno, so the records with Dno = ${raw} follow each other from there: block${read.length > 1 ? "s" : ""} ${read.map((x) => x + 1).join(" and ")} ${read.length > 1 ? "are" : "is"} read.`);
        } else if (type === "hash") {
          read = [entries[hit][1]];
          msg = tl(`h(${raw}) = ${raw.length} mod 4 = ${hashOf(raw)}: kova ${hashOf(raw)} okunur, ${raw} girişi ${read[0] + 1}. bloğu gösterir. Toplam 2 blok: kova ve veri bloğu.`, `h(${raw}) = ${raw.length} mod 4 = ${hashOf(raw)}: bucket ${hashOf(raw)} is read, and the entry ${raw} points to block ${read[0] + 1}. Two blocks in all: the bucket and the data block.`);
        } else {
          read = [entries[hit][1]];
          msg = tl(`${raw} girişi doğrudan ${read[0] + 1}. bloğu gösteriyor. İndeks olmasaydı dosya Lname'e göre sıralı olmadığı için bütün bloklar taranırdı.`, `The entry ${raw} points straight to block ${read[0] + 1}. Without the index the file, not sorted on Lname, would have to be scanned block by block.`);
        }
      }
    }
    const blockEls = blocks.map((b, i) => h("div", { class: "ix-block" + (read.includes(i) ? " read" : "") },
      h("div", { class: "ix-bno" }, tl(`Blok ${i + 1}`, `Block ${i + 1}`)),
      ...b.map((r) => h("div", { class: "ix-rec" + (raw && (r[T.field] === key) ? " match" : "") }, h("span", { class: T.order === 0 ? "ord" : null }, r[0]), " ", h("span", { class: T.field === 1 ? "ord" : null }, r[1]), " ", h("span", { class: T.order === 2 ? "ord" : null }, String(r[2]))))));
    const links = []; // [dot, target element, highlighted]
    const entryRow = (i, K, P, on, target) => {
      const dot = h("span", { class: "ix-dot" });
      const el = h("div", { class: "ix-entry" + (on ? " hit" : "") }, h("span", { class: "ix-i" }, String(i)), h("span", { class: "ix-k" }, String(K)), h("span", { class: "ix-p" }, P, " ", dot));
      el.addEventListener("mouseenter", () => target.classList.add("hover"));
      el.addEventListener("mouseleave", () => target.classList.remove("hover"));
      links.push([dot, target, on]);
      return el;
    };
    const head = () => h("div", { class: "ix-entry ix-head" }, h("span", { class: "ix-i" }, "i"), h("span", { class: "ix-k" }, "K(i)"), h("span", { class: "ix-p" }, "P(i)"));
    const cols = [];
    let levelInfo = "";
    if (type === "hash") {
      const buckets = [0, 1, 2, 3].map((k) => ({ k, items: entries.map((e, i) => [e, i]).filter(([e]) => hashOf(e[0]) === k) }));
      const els = buckets.map((bk) => h("div", { class: "ix-block ix-iblock" + (hit >= 0 && hashOf(entries[hit][0]) === bk.k ? " read" : "") },
        h("div", { class: "ix-bno" }, tl(`Kova ${bk.k}`, `Bucket ${bk.k}`)),
        ...bk.items.map(([e, i]) => entryRow("", e[0], tl(`blok ${e[1] + 1}`, `block ${e[1] + 1}`), i === hit, blockEls[e[1]]))));
      cols.push(h("div", { class: "ix-col" }, h("div", { class: "ba-label" }, tl("Hash indeks: h(K) = harf sayısı mod 4", "Hash index: h(K) = letters mod 4")), ...els));
    } else {
      // levels: level 1 holds the entries in index blocks of fo; a new level gets one entry per block of the level
      // below (that block's first K), until the top level fits in a single block
      let lvl = entries.map((e, i) => ({ K: e[0], target: blockEls[e[1]], label: tl(`blok ${e[1] + 1}`, `block ${e[1] + 1}`), on: i === hit }));
      const levels = [];
      for (let n = 1; ; n++) {
        const blks = [];
        for (let i = 0; i < lvl.length; i += fo) blks.push(lvl.slice(i, i + fo));
        const els = blks.map((bl, b) => h("div", { class: "ix-block ix-iblock" + (bl.some((x) => x.on) ? " read" : "") },
          h("div", { class: "ix-bno" }, tl(`${n}. seviye, blok ${b + 1}`, `Level ${n}, block ${b + 1}`)),
          ...bl.map((x, j) => entryRow(b * fo + j + 1, x.K, x.label, x.on, x.target))));
        levels.push({ n, els, count: blks.length });
        if (blks.length === 1) break;
        lvl = blks.map((bl, b) => ({ K: bl[0].K, target: els[b], label: tl(`blok ${b + 1}`, `block ${b + 1}`), on: bl.some((x) => x.on) }));
      }
      for (const L of [...levels].reverse()) cols.push(h("div", { class: "ix-col" }, h("div", { class: "ba-label" }, L.n === 1 ? tl("1. seviye (taban)", "Level 1 (base)") : tl(`${L.n}. seviye`, `Level ${L.n}`)), head(), ...L.els));
      const t = levels.length;
      levelInfo = t === 1
        ? tl(`${entries.length} giriş fo = ${fo} ile tek bir indeks bloğuna sığıyor: tek seviye yeter, üst seviyeye gerek yok.`, `${entries.length} entries fit in a single index block with fo = ${fo}: one level is enough, no upper level is needed.`)
        : tl(`${entries.length} giriş fo = ${fo} ile ${levels[0].count} bloğa yayılıyor; bu yüzden üstüne bir seviye daha kuruluyor. En üst seviye tek bloğa sığınca durulur: t = ⌈log${fo}(${entries.length})⌉ = ${t} seviye. Arama her seviyeden bir blok, sonra veri bloğu okur: ${t + 1} blok.`,
            `${entries.length} entries spread over ${levels[0].count} blocks with fo = ${fo}, so another level is built on top. It stops once the top level fits in one block: t = ⌈log${fo}(${entries.length})⌉ = ${t} levels. A search reads one block per level, then the data block: ${t + 1} blocks.`);
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ix-links"); svg.setAttribute("aria-hidden", "true");
    const grid = h("div", { class: "ix-grid", style: { gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr)) minmax(0, 1.25fr)` } }, ...cols,
      h("div", { class: "ix-col" }, h("div", { class: "ba-label" }, tl("Veri dosyası (Ssn, Lname, Dno; blok başına 3 kayıt)", "Data file (Ssn, Lname, Dno; 3 records per block)")), h("div", { class: "ix-blocks" }, ...blockEls)), svg);
    out.replaceChildren(h("p", { class: "small" }, T.note), levelInfo ? h("p", { class: "small ix-levels" }, levelInfo) : "", grid,
      msg ? h("div", { class: `res-msg ${hit >= 0 ? "ok" : "warn"}`, style: { fontFamily: "inherit" } }, msg) : "");
    requestAnimationFrame(() => {
      const g = grid.getBoundingClientRect();
      svg.setAttribute("width", g.width); svg.setAttribute("height", g.height); svg.replaceChildren();
      for (const [dot, target, on] of links) {
        const a = dot.getBoundingClientRect(), b = target.getBoundingClientRect();
        if (b.left <= a.right) continue;
        const x1 = a.left + a.width / 2 - g.left, y1 = a.top + a.height / 2 - g.top, x2 = b.left - g.left - 2, y2 = b.top + 12 - g.top, mx = (x1 + x2) / 2;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        if (on) path.setAttribute("class", "on");
        svg.append(path);
      }
    });
  };
  for (const [k, T] of Object.entries(TYPES)) seg.append(h("button", { type: "button", "data-t": k, onclick: () => { type = k; q.value = T.def; draw(); } }, T.label));
  q.addEventListener("input", draw);
  host.append(h("div", { class: "player" }, seg, h("div", { class: "pl-bar" }, field(tl("Aranan değer: ", "Find: "), q), foBox), out));
  addEventListener("resize", () => draw());
  q.value = TYPES.primary.def; draw();
}

// ---------------------------------------------------------------- index cost calculator
{
  const host = $("#index-calc");
  const ins = { r: [tl("Kayıt sayısı r", "Records r"), 300000], R: [tl("Kayıt boyutu R", "Record size R"), 100], B: [tl("Blok boyutu B", "Block size B"), 4096], V: [tl("Anahtar boyutu V", "Key size V"), 9], P: [tl("Blok işaretçisi P", "Block pointer P"), 6], Pr: [tl("Kayıt işaretçisi Pr", "Record pointer Pr"), 7] };
  const el = {};
  const bar = h("div", { class: "pl-bar" });
  for (const [k, [label, v]] of Object.entries(ins)) { el[k] = h("input", { type: "number", value: v, min: 1, style: { width: "6.5em" } }); bar.append(field(`${label}: `, el[k])); }
  const out = h("div");
  const L2 = (x) => Math.max(0, Math.ceil(Math.log2(x)));
  const run = () => {
    const g = Object.fromEntries(Object.keys(ins).map((k) => [k, Math.max(1, num(el[k].value, ins[k][1]))]));
    const bfr = Math.floor(g.B / g.R);
    if (bfr < 1) { out.replaceChildren(h("div", { class: "res-msg warn" }, tl("Kayıt bir bloktan büyük; R ≤ B olmalı.", "The record is larger than a block; R ≤ B is needed."))); return; }
    const b = Math.ceil(g.r / bfr), fo = Math.floor(g.B / (g.V + g.P));
    const prim = Math.ceil(b / fo), sec = Math.ceil(g.r / fo);
    const levels = (r1) => { const lv = [r1]; let x = r1; while (x > 1) { x = Math.ceil(x / fo); lv.push(x); } return lv; };
    const ml = levels(sec);
    const p = Math.floor((g.B + g.V) / (g.V + g.P)), pleaf = Math.floor((g.B - g.P) / (g.V + g.Pr));
    const row = (a, n, why) => h("tr", {}, h("td", {}, a), h("td", {}, h("strong", {}, String(n))), h("td", { class: "small" }, why));
    out.replaceChildren(
      h("ul", {},
        h("li", {}, tl(`Veri dosyası: bfr = ⌊${g.B} / ${g.R}⌋ = ${bfr}, b = ⌈${g.r} / ${bfr}⌉ = ${b} blok.`, `Data file: bfr = ⌊${g.B} / ${g.R}⌋ = ${bfr}, b = ⌈${g.r} / ${bfr}⌉ = ${b} blocks.`)),
        h("li", {}, tl(`İndeks girişi V + P = ${g.V + g.P} byte; bir indeks bloğuna fo = bfrᵢ = ⌊${g.B} / ${g.V + g.P}⌋ = ${fo} giriş sığar.`, `An index entry is V + P = ${g.V + g.P} bytes; an index block holds fo = bfrᵢ = ⌊${g.B} / ${g.V + g.P}⌋ = ${fo} entries.`)),
        h("li", {}, tl(`Birincil indeks: ${b} giriş (her blok için bir), ⌈${b} / ${fo}⌉ = ${prim} blok. Yoğun ikincil indeks: ${g.r} giriş, ⌈${g.r} / ${fo}⌉ = ${sec} blok.`, `Primary index: ${b} entries (one per block), ⌈${b} / ${fo}⌉ = ${prim} blocks. Dense secondary index: ${g.r} entries, ⌈${g.r} / ${fo}⌉ = ${sec} blocks.`)),
        h("li", {}, tl(`Çok seviyeli (ikincil indeksten): seviyelerin blok sayıları ${ml.slice(0).join(" → ")}; t = ${ml.length - 1} seviye.`, `Multilevel (from the secondary index): block counts per level ${ml.join(" → ")}; t = ${ml.length - 1} levels.`))),
      h("div", { class: "table-wrap" }, h("table", { class: "simple" },
        h("thead", {}, h("tr", {}, h("th", {}, tl("Erişim yolu", "Access path")), h("th", {}, tl("Okunan blok", "Blocks read")), h("th", {}, tl("Neden?", "Why?")))),
        h("tbody", {},
          row(tl("İndeks yok, doğrusal arama (ortalama)", "No index, linear search (average)"), Math.ceil(b / 2), tl("Dosyanın yarısı taranır: b / 2.", "Half the file is scanned: b / 2.")),
          row(tl("Sıralı dosyada ikili arama", "Binary search on the sorted file"), L2(b), `⌈log₂ ${b}⌉`),
          row(tl("Birincil indeks + 1 veri bloğu", "Primary index + 1 data block"), L2(prim) + 1, `⌈log₂ ${prim}⌉ + 1`),
          row(tl("Yoğun ikincil indeks + 1 veri bloğu", "Dense secondary index + 1 data block"), L2(sec) + 1, `⌈log₂ ${sec}⌉ + 1`),
          row(tl("Çok seviyeli indeks + 1 veri bloğu", "Multilevel index + 1 data block"), ml.length, tl(`t + 1 = ${ml.length - 1} + 1: her seviyeden bir blok.`, `t + 1 = ${ml.length - 1} + 1: one block per level.`))))),
      h("p", { class: "small" }, tl(`B+-ağacı mertebeleri: iç düğüm (p − 1)·V + p·P ≤ B koşulundan p = ⌊(${g.B} + ${g.V}) / (${g.V} + ${g.P})⌋ = ${p}; yaprak p_leaf·(V + Pr) + P ≤ B koşulundan p_leaf = ⌊(${g.B} − ${g.P}) / (${g.V} + ${g.Pr})⌋ = ${pleaf}.`,
        `B+-tree orders: internal node from (p − 1)·V + p·P ≤ B gives p = ⌊(${g.B} + ${g.V}) / (${g.V} + ${g.P})⌋ = ${p}; leaf from p_leaf·(V + Pr) + P ≤ B gives p_leaf = ⌊(${g.B} − ${g.P}) / (${g.V} + ${g.Pr})⌋ = ${pleaf}.`)));
  };
  Object.values(el).forEach((x) => x.addEventListener("input", run));
  host.append(h("div", { class: "player" }, bar,
    h("div", { class: "btn-row" }, button(tl("Kitap: Örnek 1–3", "Book: Examples 1–3"), () => { Object.entries({ r: 300000, R: 100, B: 4096, V: 9, P: 6, Pr: 7 }).forEach(([k, v]) => (el[k].value = v)); run(); }),
      button(tl("Kitap: B+-ağacı örneği (B = 512)", "Book: B+-tree example (B = 512)"), () => { Object.entries({ r: 30000, R: 100, B: 512, V: 9, P: 6, Pr: 7 }).forEach(([k, v]) => (el[k].value = v)); run(); })), out));
  run();
}

// ---------------------------------------------------------------- B+-tree and B-tree insertion
// Node: { leaf, keys, kids } (kids only for internal nodes). B+-tree convention of the book: in an internal node the
// subtree under pointer i holds keys K(i-1) < X ≤ K(i); a leaf split copies its last left key up, an internal split moves
// the middle key up. B-tree: a node holds at most p − 1 keys; an overflowing node splits and its middle key moves up.
function cloneTree(n) { return n && { leaf: n.leaf, keys: [...n.keys], kids: n.kids ? n.kids.map(cloneTree) : null, id: n.id }; }
let nodeId = 0;
const mk = (leaf, keys, kids = null) => ({ leaf, keys, kids, id: ++nodeId });
function childIndex(node, k, bplus) {
  if (bplus) { const i = node.keys.findIndex((x) => k <= x); return i < 0 ? node.keys.length : i; }
  const i = node.keys.findIndex((x) => k < x); return i < 0 ? node.keys.length : i;
}
function searchPath(root, k, bplus) {
  const path = []; let n = root;
  while (n) { path.push(n.id); if (n.leaf) break; if (!bplus && n.keys.includes(k)) break; n = n.kids[childIndex(n, k, bplus)]; }
  return { path, found: n ? n.keys.includes(k) : false };
}
function insert(root, k, { p, pleaf, bplus }) {
  const log = [], touched = new Set(), split = new Set();
  if (!root) { const r = mk(true, [k]); log.push(tl(`Ağaç boş: ${k} ile ilk yaprak (aynı zamanda kök) oluşur.`, `The tree is empty: the first leaf (also the root) is created with ${k}.`)); touched.add(r.id); return { root: r, log, touched, split }; }
  if (searchPath(root, k, bplus).found) return { root, log: [tl(`${k} ağaçta zaten var; anahtar tekrar eklenmez.`, `${k} is already in the tree; a key is not inserted twice.`)], touched, split, dup: true };
  const maxLeaf = bplus ? pleaf : p - 1, maxInt = p - 1;
  const rec = (n) => {
    if (n.leaf) {
      n.keys.push(k); n.keys.sort((a, b) => a - b); touched.add(n.id);
      if (n.keys.length <= maxLeaf) { log.push(tl(`${k}, [${n.keys.join(", ")}] yaprağına eklendi; yaprakta yer var.`, `${k} was added to the leaf [${n.keys.join(", ")}]; there is room.`)); return null; }
      if (bplus) {
        const j = Math.ceil((pleaf + 1) / 2), left = n.keys.slice(0, j), right = n.keys.slice(j);
        n.keys = left; const r = mk(true, right); split.add(n.id); split.add(r.id);
        log.push(tl(`Yaprak taştı ([${[...left, ...right].join(", ")}], en fazla ${pleaf}). İlk ⌈(${pleaf}+1)/2⌉ = ${j} değer solda kalır: [${left.join(", ")}]; kalanlar yeni yaprağa geçer: [${right.join(", ")}]. Soldaki yaprağın son değeri ${left[left.length - 1]} ebeveyne kopyalanır.`,
          `The leaf overflowed ([${[...left, ...right].join(", ")}], at most ${pleaf}). The first ⌈(${pleaf}+1)/2⌉ = ${j} values stay left: [${left.join(", ")}]; the rest move to a new leaf: [${right.join(", ")}]. The last value of the left leaf, ${left[left.length - 1]}, is copied up to the parent.`));
        return { key: left[left.length - 1], right: r };
      }
      const m = Math.floor(n.keys.length / 2), up = n.keys[m], left = n.keys.slice(0, m), right = n.keys.slice(m + 1);
      n.keys = left; const r = mk(true, right); split.add(n.id); split.add(r.id);
      log.push(tl(`Düğüm taştı ([${[...left, up, ...right].join(", ")}], en fazla ${p - 1} değer). Ortadaki değer ${up} ebeveyne çıkar; düğüm [${left.join(", ")}] ve [${right.join(", ")}] olarak bölünür.`, `The node overflowed ([${[...left, up, ...right].join(", ")}], at most ${p - 1} values). The middle value ${up} moves up to the parent; the node splits into [${left.join(", ")}] and [${right.join(", ")}].`));
      return { key: up, right: r };
    }
    const i = childIndex(n, k, bplus);
    const res = rec(n.kids[i]);
    if (!res) return null;
    n.keys.splice(i, 0, res.key); n.kids.splice(i + 1, 0, res.right); touched.add(n.id);
    if (n.keys.length <= maxInt) { log.push(tl(`${res.key} iç düğüme eklendi: [${n.keys.join(", ")}].`, `${res.key} was added to the internal node: [${n.keys.join(", ")}].`)); return null; }
    let up, left, right, lk, rk;
    if (bplus) { const j = Math.floor((p + 1) / 2); left = n.keys.slice(0, j - 1); up = n.keys[j - 1]; right = n.keys.slice(j); lk = n.kids.slice(0, j); rk = n.kids.slice(j); }
    else { const m = Math.floor(n.keys.length / 2); left = n.keys.slice(0, m); up = n.keys[m]; right = n.keys.slice(m + 1); lk = n.kids.slice(0, m + 1); rk = n.kids.slice(m + 1); }
    const all = [...left, up, ...right];
    n.keys = left; n.kids = lk; const r = mk(false, right, rk); split.add(n.id); split.add(r.id);
    log.push(tl(`İç düğüm taştı ([${all.join(", ")}], en fazla ${p - 1} değer). Ortadaki ${up} ebeveyne taşınır (${bplus ? "iç düğümde kopyalanmaz" : "B-ağacında her bölünmede olduğu gibi"}); düğüm [${left.join(", ")}] ve [${right.join(", ")}] olarak bölünür.`,
      `The internal node overflowed ([${all.join(", ")}], at most ${p - 1} values). The middle ${up} moves up to the parent (${bplus ? "not copied, since this is an internal node" : "as in every B-tree split"}); the node splits into [${left.join(", ")}] and [${right.join(", ")}].`));
    return { key: up, right: r };
  };
  const res = rec(root);
  if (res) { root = mk(false, [res.key], [root, res.right]); touched.add(root.id); log.push(tl(`Kök bölündüğü için ${res.key} ile yeni bir kök oluşur; ağaç bir seviye uzar.`, `The root split, so a new root is created with ${res.key}; the tree grows by one level.`)); }
  return { root, log, touched, split };
}

/** Draw a tree as SVG: levels top to bottom, children under their parent, leaves linked (B+-tree). */
function drawTree(root, { bplus, hl = new Set(), split = new Set(), path = [], newKey = null } = {}) {
  if (!root) return h("div", { class: "ba-empty" }, tl("Ağaç boş", "The tree is empty"));
  const KW = 30, NH = 28, GAP = 16, LV = 70;
  const w = (n) => Math.max(1, n.keys.length) * KW + 8;
  let x = 10;
  const pos = new Map(), leaves = [];
  const place = (n, d) => {
    if (n.leaf) { pos.set(n.id, { x, y: 14 + d * LV, n }); leaves.push(n); x += w(n) + GAP; return; }
    n.kids.forEach((c) => place(c, d + 1));
    const a = pos.get(n.kids[0].id), b = pos.get(n.kids[n.kids.length - 1].id);
    pos.set(n.id, { x: (a.x + b.x + w(n.kids[n.kids.length - 1])) / 2 - w(n) / 2, y: 14 + d * LV, n });
  };
  place(root, 0);
  const W = Math.max(x, ...[...pos.values()].map((q) => q.x + w(q.n) + 10)), H = Math.max(...[...pos.values()].map((q) => q.y)) + NH + 14;
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, a = {}, t) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "bt-svg" });
  for (const q of pos.values()) if (!q.n.leaf) q.n.kids.forEach((c, i) => {
    const cq = pos.get(c.id);
    svg.append(s("line", { x1: q.x + 4 + i * KW, y1: q.y + NH, x2: cq.x + w(c) / 2, y2: cq.y, class: "bt-edge" + (path.includes(q.n.id) && path.includes(c.id) ? " on" : "") }));
  });
  if (bplus) for (let i = 0; i + 1 < leaves.length; i++) {
    const a = pos.get(leaves[i].id), b = pos.get(leaves[i + 1].id);
    svg.append(s("line", { x1: a.x + w(leaves[i]), y1: a.y + NH / 2, x2: b.x, y2: b.y + NH / 2, class: "bt-chain", "marker-end": "url(#bt-ar)" }));
  }
  const defs = s("defs"), m = s("marker", { id: "bt-ar", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" });
  m.append(s("path", { d: "M0,0 L10,5 L0,10 z", class: "bt-arhead" })); defs.append(m); svg.prepend(defs);
  for (const q of pos.values()) {
    const cls = "bt-node" + (q.n.leaf ? " leaf" : "") + (split.has(q.n.id) ? " split" : hl.has(q.n.id) ? " touched" : "") + (path.includes(q.n.id) ? " path" : "");
    const g = s("g", { class: cls });
    g.append(s("rect", { x: q.x, y: q.y, width: w(q.n), height: NH, rx: 4 }));
    q.n.keys.forEach((k, i) => {
      if (i) g.append(s("line", { x1: q.x + 4 + i * KW, x2: q.x + 4 + i * KW, y1: q.y + 4, y2: q.y + NH - 4, class: "bt-sep" }));
      g.append(s("text", { x: q.x + 4 + i * KW + KW / 2, y: q.y + NH / 2 + 1, class: "bt-key" + (k === newKey ? " new" : "") }, String(k)));
    });
    svg.append(g);
  }
  return h("div", { class: "bt-wrap" }, svg);
}
{
  const host = $("#bptree");
  const kind = h("select", {}, h("option", { value: "bplus" }, tl("B+-ağacı (Figure 17.12)", "B+-tree (Figure 17.12)")), h("option", { value: "btree" }, tl("B-ağacı (Figure 17.10)", "B-tree (Figure 17.10)")));
  const valsIn = h("input", { type: "text", value: "8 5 1 7 3 12 9 6", size: 24 });
  const pIn = h("input", { type: "number", value: 3, min: 3, max: 6, style: { width: "4em" } });
  const plIn = h("input", { type: "number", value: 2, min: 1, max: 6, style: { width: "4em" } });
  const findIn = h("input", { type: "number", value: 9, style: { width: "5em" } });
  const counter = h("span", { class: "pl-count" });
  const body = h("div"), findOut = h("div");
  let states = [], vals = [], i = 0, opts;
  const build = () => {
    vals = valsIn.value.split(/[\s,]+/).map(Number).filter(Number.isFinite).slice(0, 30);
    const bplus = kind.value === "bplus";
    opts = { p: Math.max(3, Math.min(6, num(pIn.value, 3))), pleaf: Math.max(1, Math.min(6, num(plIn.value, 2))), bplus };
    plIn.disabled = !bplus;
    nodeId = 0;
    let root = null;
    states = [{ root: null }];
    for (const v of vals) { const r = insert(cloneTree(root), v, opts); root = r.root; states.push({ root: cloneTree(root), log: r.log, touched: r.touched, split: r.split, key: v }); }
    i = Math.min(i, vals.length);
  };
  const show = () => {
    counter.textContent = tl(`${i} / ${vals.length} değer eklendi`, `${i} of ${vals.length} values inserted`);
    prevB.disabled = i === 0; nextB.disabled = i >= vals.length;
    if (i === 0) body.replaceChildren(h("p", { class: "small" }, tl(`Ağaç boş. Sonraki düğmesi ilk değeri (${vals[0]}) ekler.`, `The tree is empty. Next inserts the first value (${vals[0]}).`)));
    else {
      const st = states[i];
      body.replaceChildren(h("div", { class: "step-title" }, tl(`${st.key} ekleniyor`, `Inserting ${st.key}`)),
        h("ol", { class: "small bt-log" }, ...st.log.map((l) => h("li", {}, l))),
        h("div", { class: "ba ba-stack" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), drawTree(states[i - 1].root, { bplus: opts.bplus })),
          h("div", { class: "ba-arrow", "aria-hidden": "true" }),
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra: değerin girdiği düğümler vurgulu, bölünenler kırmızı kenarlı", "After: nodes the value went through highlighted, split nodes outlined in red")), drawTree(st.root, { bplus: opts.bplus, hl: st.touched, split: st.split, newKey: st.key }))));
    }
    find();
  };
  const find = () => {
    const root = states[i].root, k = num(findIn.value, 0);
    if (!root) { findOut.replaceChildren(); return; }
    const { path, found } = searchPath(root, k, opts.bplus);
    findOut.replaceChildren(h("p", { class: "small" }, tl(`${k} aranırken kökten ${path.length} düğüm okunur (yol vurgulu). ${found ? "Değer bulundu." : "Değer ağaçta yok."}${opts.bplus ? " B+-ağacında arama her zaman yaprakta biter; iç düğümdeki değerler yalnızca yön gösterir." : " B-ağacında değer bir iç düğümde bulunursa arama orada biter."}`,
      `Searching for ${k} reads ${path.length} node(s) from the root (the path is highlighted). ${found ? "The value was found." : "The value is not in the tree."}${opts.bplus ? " In a B+-tree a search always ends in a leaf; values in internal nodes only show the way." : " In a B-tree the search stops at an internal node if the value is found there."}`)),
      drawTree(root, { bplus: opts.bplus, path }));
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; show(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; show(); }, { kind: "primary" });
  const allB = button(tl("Hepsini ekle", "Insert all"), () => { i = vals.length; show(); });
  const reset = () => { i = 0; build(); show(); };
  kind.addEventListener("change", () => { if (kind.value === "btree") { pIn.value = 3; } reset(); });
  [valsIn, pIn, plIn].forEach((x) => x.addEventListener("input", reset));
  findIn.addEventListener("input", find);
  host.append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, field(tl("Ağaç: ", "Tree: "), kind), field(tl("Değerler: ", "Values: "), valsIn), field("p = ", pIn), field("p_leaf = ", plIn)),
    h("div", { class: "pl-bar" }, prevB, nextB, allB, counter), body,
    h("h4", {}, tl("Arama", "Search")), h("div", { class: "pl-bar" }, field(tl("Aranan değer: ", "Find: "), findIn)), findOut));
  build(); show();
}

// ---------------------------------------------------------------- bitmap index
{
  const host = $("#bitmap");
  const ROWS = [["Smith", "M", 5], ["Wong", "M", 5], ["Zelaya", "F", 4], ["Wallace", "F", 4], ["Narayan", "M", 5], ["English", "F", 5], ["Jabbar", "M", 4], ["Borg", "M", 1]];
  const sexSel = h("select", {}, ...["—", "M", "F"].map((v) => h("option", { value: v }, v)));
  const dnoSel = h("select", {}, ...["—", "1", "4", "5"].map((v) => h("option", { value: v }, v)));
  sexSel.value = "F"; dnoSel.value = "5";
  const out = h("div");
  const bits = (pred) => ROWS.map((r) => (pred(r) ? 1 : 0));
  const bitRow = (label, b, cls = "") => h("tr", { class: cls }, h("th", {}, label), ...b.map((x) => h("td", { class: x ? "b1" : "b0" }, String(x))));
  const run = () => {
    const parts = [];
    if (sexSel.value !== "—") parts.push([`Sex = '${sexSel.value}'`, bits((r) => r[1] === sexSel.value)]);
    if (dnoSel.value !== "—") parts.push([`Dno = ${dnoSel.value}`, bits((r) => String(r[2]) === dnoSel.value)]);
    const all = [["Sex = 'M'", bits((r) => r[1] === "M")], ["Sex = 'F'", bits((r) => r[1] === "F")], ["Dno = 1", bits((r) => r[2] === 1)], ["Dno = 4", bits((r) => r[2] === 4)], ["Dno = 5", bits((r) => r[2] === 5)]];
    const res = parts.length ? parts.reduce((a, [, b]) => a.map((x, i) => x & b[i]), Array(ROWS.length).fill(1)) : null;
    out.replaceChildren(
      h("div", { class: "table-wrap" }, h("table", { class: "simple bitmap" },
        h("thead", {}, h("tr", {}, h("th", {}, tl("Bitmap", "Bitmap")), ...ROWS.map((r, i) => h("th", { title: r[0] }, `${i + 1}`)))),
        h("tbody", {}, h("tr", { class: "names" }, h("th", {}, tl("Satır", "Row")), ...ROWS.map((r) => h("td", {}, r[0]))),
          ...all.map(([l, b]) => bitRow(l, b, parts.some((p) => p[0] === l) ? "used" : "")),
          res ? bitRow(parts.map((p) => p[0]).join(" AND "), res, "result") : null))),
      h("p", { class: "small" }, !res ? tl("Bir ya da iki koşul seçin.", "Choose one or two conditions.")
        : tl(`${parts.map((p) => p[0]).join(" AND ")}: kullanılan bitmap'ler bit bit AND'lenir. Sonuçta 1 olan satırlar: ${ROWS.filter((_, i) => res[i]).map((r) => r[0]).join(", ") || "yok"}. Tabloya hiç dokunmadan, yalnızca ${ROWS.length} bitlik iki dizi karşılaştırıldı.`,
          `${parts.map((p) => p[0]).join(" AND ")}: the bitmaps used are ANDed bit by bit. Rows with a 1 in the result: ${ROWS.filter((_, i) => res[i]).map((r) => r[0]).join(", ") || "none"}. The table was not touched; only two ${ROWS.length}-bit arrays were compared.`)));
  };
  sexSel.addEventListener("change", run); dnoSel.addEventListener("change", run);
  host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, field("Sex = ", sexSel), h("span", { class: "small" }, "AND"), field("Dno = ", dnoSel)), out));
  run();
}

// ---------------------------------------------------------------- you decide (indexes and B+-trees)
import { decidePlayer, calcSteps } from "../lib/decide.js";
{
  const host = $("#index-decide");
  const bpStep = (vals, add, p = 3, pleaf = 2) => {
    nodeId = 0;
    let root = null;
    for (const v of vals) root = insert(cloneTree(root), v, { p, pleaf, bplus: true }).root;
    const before = cloneTree(root), r = insert(cloneTree(root), add, { p, pleaf, bplus: true });
    return h("div", {}, h("ol", { class: "small bt-log" }, ...r.log.map((l) => h("li", {}, l))),
      h("div", { class: "ba ba-stack" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), drawTree(before, { bplus: true })), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), drawTree(r.root, { bplus: true, hl: r.touched, split: r.split, newKey: add }))));
  };
  if (host) decidePlayer(host, [
    { q: tl("EMPLOYEE dosyası Dno'ya göre sıralı ve Dno bir anahtar değil. Dno üzerine kurulan indeks hangi türdendir?", "The EMPLOYEE file is sorted on Dno, which is not a key. What type is the index built on Dno?"),
      opts: [[tl("Birincil indeks", "Primary index"), false, tl("Birincil indeks, dosyanın sıralı olduğu alan bir anahtar olduğunda kullanılır.", "A primary index is used when the field the file is sorted on is a key.")],
        [tl("Kümeleme indeksi", "Clustering index"), true, tl("Doğru. Dosya anahtar olmayan bir alana göre sıralı; her farklı Dno için bir giriş, o değerin ilk bloğunu gösterir.", "Right. The file is sorted on a non-key field; one entry per distinct Dno points to that value's first block.")],
        [tl("Yoğun ikincil indeks", "Dense secondary index"), false, tl("İkincil indeks, dosyanın sıralı olmadığı bir alan üzerine kurulur.", "A secondary index is built on a field the file is not sorted on.")]],
      detail: () => calcSteps([[tl("Karar tablosu", "Decision table"), tl("Dosya bu alana göre sıralı mı? Evet. Alan anahtar mı? Hayır. → Kümeleme indeksi (Table 17.1). Sayfadaki indeks türleri şeklinde 'Kümeleme (Dno)' sekmesinde aynı dosyayı görebilirsiniz.", "Is the file sorted on this field? Yes. Is the field a key? No. → Clustering index (Table 17.1). You can see the same file under the 'Clustering (Dno)' tab of the index types figure.")]]) },
    { q: tl("r = 30 000 kayıt, bfr = 10. Dosya anahtara göre sıralı. Birincil indekste kaç giriş vardır?", "r = 30,000 records, bfr = 10. The file is sorted on the key. How many entries does the primary index have?"),
      opts: [["30 000", false, tl("Her kayıt için bir giriş yoğun ikincil indekstir; birincil indeks seyrektir.", "One entry per record is a dense secondary index; a primary index is sparse.")],
        ["3000", true, tl("Doğru. Her veri bloğu için bir giriş (blok çapası): b = ⌈30 000 / 10⌉ = 3000.", "Right. One entry per data block (the block anchor): b = ⌈30,000 / 10⌉ = 3000.")],
        ["10", false, tl("10 bfr'dir, yani bir bloğa sığan kayıt sayısı.", "10 is bfr, the number of records per block.")]],
      detail: () => calcSteps([[tl("1. Veri blokları", "1. Data blocks"), tl("b = ⌈30 000 / 10⌉ = 3000.", "b = ⌈30,000 / 10⌉ = 3000.")], [tl("2. Seyrek indeks", "2. Sparse index"), tl("Birincil indekste her blok için bir giriş vardır: 3000 giriş.", "A primary index has one entry per block: 3000 entries.")]]) },
    { q: tl("B = 1024 byte, anahtar V = 9 byte, işaretçi P = 7 byte. İndeksin fan-out'u nedir?", "B = 1024 bytes, key V = 9 bytes, pointer P = 7 bytes. What is the fan-out of the index?"),
      opts: [["64", true, tl("Doğru. fo = ⌊1024 / (9 + 7)⌋ = ⌊1024 / 16⌋ = 64.", "Right. fo = ⌊1024 / (9 + 7)⌋ = ⌊1024 / 16⌋ = 64.")], ["113", false, tl("113 yalnızca anahtarı sayar (1024 / 9); her girişte bir işaretçi de vardır.", "113 counts only the key (1024 / 9); every entry also has a pointer.")], ["146", false, tl("146 yalnızca işaretçiyi sayar (1024 / 7).", "146 counts only the pointer (1024 / 7).")]],
      detail: () => calcSteps([[tl("Giriş boyutu", "Entry size"), "V + P = 9 + 7 = 16 byte."], ["fo", "⌊1024 / 16⌋ = 64."]]) },
    { q: tl("Yoğun bir ikincil indeksin birinci seviyesi 1000 blok, fo = 100. Çok seviyeli indeksle arama kaç blok okur?", "The first level of a dense secondary index is 1000 blocks and fo = 100. How many blocks does a search with the multilevel index read?"),
      opts: [["11", false, tl("11, tek seviyeli indeksle ikili aramadır (⌈log₂ 1000⌉ + 1).", "11 is binary search on the single-level index (⌈log₂ 1000⌉ + 1).")], ["4", true, tl("Doğru. Seviyeler 1000 → 10 → 1 blok: t = 3, arama t + 1 = 4 blok.", "Right. The levels are 1000 → 10 → 1 blocks: t = 3, the search reads t + 1 = 4 blocks.")], ["3", false, tl("Üç seviyenin her birinden bir blok okunur, ama kaydın kendisi için bir blok daha gerekir.", "One block is read from each of the three levels, but one more block is needed for the record.")]],
      detail: () => calcSteps([[tl("Seviye 1", "Level 1"), tl("1000 blok.", "1000 blocks.")], [tl("Seviye 2", "Level 2"), "⌈1000 / 100⌉ = 10."], [tl("Seviye 3", "Level 3"), tl("⌈10 / 100⌉ = 1: en üst seviye tek blok.", "⌈10 / 100⌉ = 1: the top level is a single block.")], [tl("Arama", "Search"), tl("Her seviyeden bir blok + veri bloğu = 3 + 1 = 4.", "One block per level + the data block = 3 + 1 = 4.")]]) },
    { q: tl("p = 3, p_leaf = 2 olan bir B+-ağacında tek yaprak [10, 20] var. 15 eklenince ne olur?", "A B+-tree with p = 3 and p_leaf = 2 has a single leaf [10, 20]. What happens when 15 is inserted?"),
      opts: [[tl("Yapraklar [10, 15] ve [20]; köke 15 kopyalanır", "Leaves [10, 15] and [20]; 15 is copied to the root"), true, tl("Doğru. [10, 15, 20] taşar; ilk ⌈3/2⌉ = 2 değer solda kalır, soldaki son değer 15 yeni köke kopyalanır.", "Right. [10, 15, 20] overflows; the first ⌈3/2⌉ = 2 values stay left and the last left value, 15, is copied to a new root.")],
        [tl("Yapraklar [10] ve [15, 20]; köke 10", "Leaves [10] and [15, 20]; 10 to the root"), false, tl("Solda kalan değer sayısı ⌈(p_leaf + 1)/2⌉ = 2'dir, 1 değil.", "The number of values staying left is ⌈(p_leaf + 1)/2⌉ = 2, not 1.")],
        [tl("Yapraklar [10] ve [20]; 15 köke taşınır", "Leaves [10] and [20]; 15 moves to the root"), false, tl("Bu B-ağacının bölünmesidir; B+-ağacında yapraktaki değer ebeveyne kopyalanır ve yaprakta da kalır.", "That is a B-tree split; in a B+-tree a leaf value is copied to the parent and also stays in the leaf.")]],
      detail: () => bpStep([10, 20], 15) },
    { q: tl("Aynı ağaçta (kök [15], yapraklar [10, 15] ve [20]) 25 eklenir. Sonuç nedir?", "In the same tree (root [15], leaves [10, 15] and [20]) 25 is inserted. What is the result?"),
      opts: [[tl("Sağ yaprak [20, 25] olur; bölünme olmaz", "The right leaf becomes [20, 25]; no split"), true, tl("Doğru. 25 > 15 olduğu için sağ yaprağa gider; yaprakta p_leaf = 2 değerlik yer olduğu için bölünme gerekmez.", "Right. 25 > 15, so it goes to the right leaf; the leaf has room for p_leaf = 2 values, so no split is needed.")],
        [tl("Sağ yaprak bölünür ve köke 20 eklenir", "The right leaf splits and 20 is added to the root"), false, tl("Yaprakta yalnızca 20 vardı; 25 ile iki değer olur ve p_leaf = 2'ye sığar.", "The leaf held only 20; with 25 it has two values, which fit in p_leaf = 2.")],
        [tl("Kök bölünür", "The root splits"), false, tl("Kök ancak bir alt düğüm bölünüp değer yukarı gönderildiğinde değişir.", "The root changes only when a child splits and sends a value up.")]],
      detail: () => bpStep([10, 20, 15], 25) },
  ]);
}

// ---------------------------------------------------------------- node structures (Figures 17.8, 17.10a, 17.11)
{
  const host = $("#node-structs");
  if (host) {
    const P = (i) => ["P", i, "tree"], K = (i) => ["K", i, "key"], PR = (i) => ["Pr", i, "data"];
    const pair = (i) => ["pair", i, "pair"];
    const NODES = [
      { name: tl("Arama ağacı düğümü (Figure 17.8)", "Search tree node (Figure 17.8)"), cells: [P(1), K(1), P(2), K(2), ["…"], K("q−1"), P("q")],
        rule: tl("q ≤ p. Değerler sıralıdır; P(i)'nin gösterdiği alt ağaçtaki her X için K(i−1) < X < K(i).", "q ≤ p. The values are sorted; every X in the subtree P(i) points to has K(i−1) < X < K(i).") },
      { name: tl("B-ağacı düğümü (Figure 17.10a)", "B-tree node (Figure 17.10a)"), cells: [P(1), pair(1), P(2), pair(2), ["…"], pair("q−1"), P("q")],
        rule: tl("Her değerin yanında kaydını gösteren bir veri işaretçisi Pr vardır. Kök dışındaki her düğümde en az ⌈p/2⌉ ağaç işaretçisi bulunur.", "Every value comes with a data pointer Pr to its record. Every node except the root has at least ⌈p/2⌉ tree pointers.") },
      { name: tl("B+-ağacı iç düğümü (Figure 17.11a)", "B+-tree internal node (Figure 17.11a)"), cells: [P(1), K(1), P(2), K(2), ["…"], K("q−1"), P("q")],
        rule: tl("Veri işaretçisi yok, yalnızca aramayı yönlendirir; bu yüzden düğüme daha çok değer sığar (p daha büyük).", "No data pointers; it only guides the search, so more values fit in a node (larger p).") },
      { name: tl("B+-ağacı yaprağı (Figure 17.11b)", "B+-tree leaf node (Figure 17.11b)"), cells: [pair(1), pair(2), ["…"], pair("q−1"), ["Pnext", "", "next"]],
        rule: tl("Her değer için ⟨K, Pr⟩; sondaki P<sub>next</sub> bir sonraki yaprağı gösterir, aralık araması yapraklar boyunca ilerler.", "A ⟨K, Pr⟩ per value; the final P<sub>next</sub> points to the next leaf, so a range search walks along the leaves.") },
    ];
    const WHAT = {
      tree: (i) => tl(`P${i}: ağaç işaretçisi. Bir alt düğümü (alt ağacı) gösterir.`, `P${i}: a tree pointer. It points to a child node (a subtree).`),
      key: (i) => tl(`K${i}: arama değeri. Düğümdeki değerler sıralıdır.`, `K${i}: a search value. The values in a node are sorted.`),
      pair: (i) => tl(`⟨K${i}, Pr${i}⟩: arama değeri ve o değerin kaydını (ya da kayıt bloğunu) gösteren veri işaretçisi.`, `⟨K${i}, Pr${i}⟩: a search value and the data pointer to its record (or the record's block).`),
      next: () => tl("P_next: aynı seviyedeki bir sonraki yaprağı gösterir.", "P_next: points to the next leaf on the same level."),
    };
    const cap = h("div", { class: "small node-cap" }, tl("Bir hücrenin üstüne gelin ya da dokunun.", "Hover over or tap a cell."));
    const sub = (i) => (i === "" ? "" : h("sub", {}, String(i)));
    const cell = ([kind, i, cls]) => {
      if (!cls) return h("span", { class: "nd-gap" }, "…");
      const label = kind === "pair" ? h("span", {}, "K", sub(i), ", Pr", sub(i)) : kind === "Pnext" ? h("span", {}, "P", h("sub", {}, "next")) : h("span", {}, kind, sub(i));
      const el = h("button", { type: "button", class: `nd-cell ${cls}` }, label);
      const show = () => { cap.textContent = WHAT[cls](i); for (const c of host.querySelectorAll(".nd-cell.on")) c.classList.remove("on"); el.classList.add("on"); };
      el.addEventListener("mouseenter", show); el.addEventListener("focus", show); el.addEventListener("click", show);
      return el;
    };
    host.append(h("div", { class: "stepper node-structs" },
      ...NODES.map((n) => h("div", { class: "nd-row" }, h("div", { class: "nd-name" }, n.name), h("div", { class: "nd-node" }, ...n.cells.map(cell)), h("div", { class: "small muted", html: n.rule }))),
      h("div", { class: "small muted nd-legend" }, h("span", { class: "nd-cell tree mini" }, "P"), tl(" ağaç işaretçisi  ", " tree pointer  "), h("span", { class: "nd-cell key mini" }, "K"), tl(" arama değeri  ", " search value  "), h("span", { class: "nd-cell data mini" }, "Pr"), tl(" veri işaretçisi", " data pointer")),
      cap));
  }
}
