// Ch 16 (disk storage, file organizations, hashing, RAID): a buffer-replacement simulator, a blocking-factor
// calculator, a static external hashing simulator and an interactive RAID array. Every simulator shows the state
// before and after each step.
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { t as tl } from "../lib/i18n.js";

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const field = (label, input) => h("label", { class: "small sim-field" }, label, input);
const frameRow = (cells, { hit = null, inserted = null, evicted = null, hand = null, bits = null } = {}) =>
  h("div", { class: "frames" }, ...cells.map((p, i) => h("span", {
    class: "frame" + (p == null ? " empty" : "") + (i === hit ? " hit" : "") + (i === inserted ? " ins" : "") + (i === hand ? " hand" : ""),
    title: evicted != null && i === inserted ? tl(`${evicted} çıkarıldı`, `${evicted} was evicted`) : null,
  }, p == null ? "–" : String(p), bits ? h("sub", {}, String(bits[i])) : null)));

// ---------------------------------------------------------------- buffer replacement
{
  const reqIn = h("input", { type: "text", value: "1 2 3 1 4 1 5 2 1 3", size: 26, "aria-label": tl("İstek dizisi", "Request sequence") });
  const nIn = h("input", { type: "number", value: 3, min: 1, max: 8, style: { width: "4em" } });
  const stratIn = h("select", {}, ...["LRU", "FIFO", "Clock"].map((s) => h("option", { value: s }, s)));
  const out = h("div");
  const run = () => {
    const reqs = reqIn.value.split(/[\s,]+/).filter(Boolean);
    const n = Math.max(1, Math.min(8, num(nIn.value, 3)));
    const strat = stratIn.value;
    let frames = Array(n).fill(null), last = Array(n).fill(0), loaded = Array(n).fill(0), bits = Array(n).fill(0), hand = 0, hits = 0;
    const rows = [];
    reqs.forEach((p, t) => {
      const before = { cells: [...frames], bits: [...bits], hand };
      let i = frames.indexOf(p), evicted = null, note;
      if (i >= 0) {
        hits++; last[i] = t; bits[i] = 1;
        note = tl(`${p} zaten tamponda: isabet, diske gidilmez.`, `${p} is already in the buffer: a hit, no disk access.`);
        rows.push({ t, p, before, after: { cells: [...frames], bits: [...bits], hand }, hit: true, i, note });
        return;
      }
      i = frames.indexOf(null);
      if (i < 0) {
        if (strat === "LRU") { i = last.indexOf(Math.min(...last)); note = tl(`Boş tampon yok. ${frames[i]} en uzun süredir kullanılmayan sayfa olduğu için çıkarılıyor.`, `No free frame. ${frames[i]} is evicted because it is the least recently used page.`); }
        else if (strat === "FIFO") { i = loaded.indexOf(Math.min(...loaded)); note = tl(`Boş tampon yok. ${frames[i]} tampona en önce giren sayfa olduğu için çıkarılıyor.`, `No free frame. ${frames[i]} is evicted because it entered the buffer first.`); }
        else {
          const skipped = [];
          while (bits[hand]) { bits[hand] = 0; skipped.push(frames[hand]); hand = (hand + 1) % n; }
          i = hand; hand = (hand + 1) % n;
          note = (skipped.length ? tl(`İbre ${skipped.join(", ")} sayfalarının bitini 0 yapıp geçti; `, `The hand cleared the bit of ${skipped.join(", ")} and moved on; `) : "")
            + (skipped.length ? tl(`biti 0 olan ilk sayfa ${frames[i]} çıkarılıyor.`, `the first page with bit 0, ${frames[i]}, is evicted.`) : tl(`İbrenin gösterdiği ${frames[i]} sayfasının biti zaten 0, bu yüzden o çıkarılıyor.`, `The page under the hand, ${frames[i]}, already has bit 0, so it is evicted.`));
        }
        evicted = frames[i];
      } else note = tl(`Boş tampon var: ${p} diskten okunup oraya konuyor.`, `There is a free frame: ${p} is read from disk into it.`);
      if (strat === "Clock" && evicted == null) hand = (i + 1) % n;
      frames[i] = p; last[i] = t; loaded[i] = t; bits[i] = 1;
      rows.push({ t, p, before, after: { cells: [...frames], bits: [...bits], hand }, hit: false, i, evicted, note });
    });
    const clock = strat === "Clock";
    out.replaceChildren(
      h("p", { class: "small" }, tl(`${reqs.length} istekte ${hits} isabet ve ${reqs.length - hits} eksik var; yani diskten ${reqs.length - hits} kez okuma yapıldı.`, `Of ${reqs.length} requests, ${hits} are hits and ${reqs.length - hits} are misses; so the disk was read ${reqs.length - hits} times.`)
        + (clock ? tl(" Alt simge her tamponun kullanıldı bitidir; çerçeveli tampon saat ibresinin bulunduğu yerdir.", " The subscript is each frame's reference bit; the outlined frame is where the clock hand points.") : "")),
      h("div", { class: "table-wrap" }, h("table", { class: "simple sim-table" },
        h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, tl("İstek", "Request")), h("th", {}, tl("Önce", "Before")), h("th", {}, tl("Sonra", "After")), h("th", {}, tl("Ne oldu?", "What happened?")))),
        h("tbody", {}, ...rows.map((r) => h("tr", { class: r.hit ? "hit-row" : "miss-row" },
          h("td", {}, String(r.t + 1)), h("td", {}, h("strong", {}, r.p), " ", h("span", { class: r.hit ? "tag ok" : "tag bad" }, r.hit ? "hit" : "miss")),
          h("td", {}, frameRow(r.before.cells, clock ? { bits: r.before.bits, hand: r.before.hand } : {})),
          h("td", {}, frameRow(r.after.cells, { hit: r.hit ? r.i : null, inserted: r.hit ? null : r.i, evicted: r.evicted, ...(clock ? { bits: r.after.bits, hand: r.after.hand } : {}) })),
          h("td", { class: "small" }, r.note)))))));
  };
  [reqIn, nIn, stratIn].forEach((x) => x.addEventListener("input", run));
  $("#buffer-sim").append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, field(tl("İstekler: ", "Requests: "), reqIn), field(tl("Tampon sayısı: ", "Frames: "), nIn), field(tl("Strateji: ", "Strategy: "), stratIn)), out));
  run();
}

// ---------------------------------------------------------------- blocking factor and file size
{
  const rIn = h("input", { type: "number", value: 30000, min: 1, style: { width: "7em" } });
  const RIn = h("input", { type: "number", value: 100, min: 1, style: { width: "6em" } });
  const BIn = h("input", { type: "number", value: 512, min: 1, style: { width: "6em" } });
  const spIn = h("select", {}, h("option", { value: "u" }, "unspanned"), h("option", { value: "s" }, "spanned"));
  const out = h("div");
  const run = () => {
    const r = Math.max(1, num(rIn.value, 1)), R = Math.max(1, num(RIn.value, 1)), B = Math.max(1, num(BIn.value, 1));
    const spanned = spIn.value === "s" || R > B;
    let bfr, b, waste, lines = [];
    if (!spanned) {
      bfr = Math.floor(B / R); b = Math.ceil(r / bfr); waste = B - bfr * R;
      lines.push(tl(`bfr = ⌊B / R⌋ = ⌊${B} / ${R}⌋ = ${bfr} kayıt/blok.`, `bfr = ⌊B / R⌋ = ⌊${B} / ${R}⌋ = ${bfr} records per block.`),
        tl(`Her blokta B − bfr · R = ${B} − ${bfr} · ${R} = ${waste} byte kullanılmadan kalır.`, `Each block leaves B − bfr · R = ${B} − ${bfr} · ${R} = ${waste} bytes unused.`),
        tl(`b = ⌈r / bfr⌉ = ⌈${r} / ${bfr}⌉ = ${b} blok.`, `b = ⌈r / bfr⌉ = ⌈${r} / ${bfr}⌉ = ${b} blocks.`));
    } else {
      bfr = B / R; b = Math.ceil((r * R) / B); waste = 0;
      lines.push(R > B ? tl("Kayıt bir bloktan büyük olduğu için spanned yerleşim zorunlu.", "The record is larger than a block, so spanned placement is required.") : tl("Spanned yerleşimde boşluk kalmaz; kayıtlar blok sınırını geçebilir.", "Spanned placement leaves no gaps; records may cross block boundaries."),
        tl(`Ortalama bfr = B / R = ${bfr.toFixed(2)}; b = ⌈r · R / B⌉ = ⌈${r} · ${R} / ${B}⌉ = ${b} blok.`, `Average bfr = B / R = ${bfr.toFixed(2)}; b = ⌈r · R / B⌉ = ⌈${r} · ${R} / ${B}⌉ = ${b} blocks.`));
    }
    const log2 = Math.ceil(Math.log2(b));
    // one block drawn to scale (unspanned) or the start of the file (spanned)
    const bar = h("div", { class: "blockbar", title: tl("Bir blok", "One block") });
    if (!spanned) {
      for (let i = 0; i < Math.min(bfr, 40); i++) bar.append(h("span", { class: "rec", style: { flexGrow: R } }, bfr <= 12 ? `R${i + 1}` : ""));
      if (waste) bar.append(h("span", { class: "waste", style: { flexGrow: waste } }, waste / B > 0.08 ? tl("boş", "unused") : ""));
    } else bar.append(h("span", { class: "rec", style: { flexGrow: 1 } }, tl("kayıtlar blok sınırını geçerek ardışık dizilir", "records follow each other across block boundaries")));
    out.replaceChildren(
      h("ul", {}, ...lines.map((l) => h("li", {}, l))),
      h("div", { class: "ba-label" }, tl(`Bir blok (${B} byte)`, `One block (${B} bytes)`)), bar,
      h("div", { class: "table-wrap" }, h("table", { class: "simple" },
        h("thead", {}, h("tr", {}, h("th", {}, tl("Arama", "Search")), h("th", {}, tl("Okunan blok", "Blocks read")), h("th", {}, tl("Neden?", "Why?")))),
        h("tbody", {},
          h("tr", {}, h("td", {}, tl("Heap dosyada anahtar araması (ortalama)", "Key search in a heap file (average)")), h("td", {}, String(Math.ceil(b / 2))), h("td", { class: "small" }, tl("Kayıt bulunana kadar ortalama dosyanın yarısı taranır: b / 2.", "On average half the file is scanned until the record is found: b / 2."))),
          h("tr", {}, h("td", {}, tl("Heap dosyada olmayan bir kaydı aramak", "Searching a heap file for a missing record")), h("td", {}, String(b)), h("td", { class: "small" }, tl("Kaydın olmadığını anlamak için bütün bloklar okunur: b.", "Every block must be read to know the record is not there: b."))),
          h("tr", {}, h("td", {}, tl("Sıralı dosyada ikili arama", "Binary search in an ordered file")), h("td", {}, String(log2)), h("td", { class: "small" }, tl(`⌈log₂ b⌉ = ⌈log₂ ${b}⌉ = ${log2}: her okumada aralık yarıya iner.`, `⌈log₂ b⌉ = ⌈log₂ ${b}⌉ = ${log2}: each read halves the range.`))),
          h("tr", {}, h("td", {}, tl("Hash dosyasında eşitlik araması", "Equality search in a hash file")), h("td", {}, "1"), h("td", { class: "small" }, tl("Taşma yoksa hash fonksiyonu doğrudan kovanın bloğunu verir.", "Without overflow the hash function gives the bucket's block directly.")))))));
  };
  [rIn, RIn, BIn, spIn].forEach((x) => x.addEventListener("input", run));
  $("#block-calc").append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, field(tl("Kayıt sayısı r: ", "Records r: "), rIn), field(tl("Kayıt boyutu R (byte): ", "Record size R (bytes): "), RIn), field(tl("Blok boyutu B (byte): ", "Block size B (bytes): "), BIn), field(tl("Yerleşim: ", "Placement: "), spIn)), out));
  run();
}

// ---------------------------------------------------------------- static external hashing
{
  const keysIn = h("input", { type: "text", value: "12 7 25 3 18 9 30 14 21 5", size: 28 });
  const mIn = h("input", { type: "number", value: 4, min: 1, max: 10, style: { width: "4em" } });
  const capIn = h("input", { type: "number", value: 2, min: 1, max: 5, style: { width: "4em" } });
  const findIn = h("input", { type: "number", value: 21, style: { width: "5em" } });
  const counter = h("span", { class: "pl-count" });
  const body = h("div"), findOut = h("div", { class: "small" });
  let i = 0, states = [], keys = [], M = 4, cap = 2;
  const build = () => {
    keys = keysIn.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
    M = Math.max(1, Math.min(10, num(mIn.value, 4))); cap = Math.max(1, Math.min(5, num(capIn.value, 2)));
    let b = Array.from({ length: M }, () => ({ main: [], over: [] }));
    states = [b];
    for (const k of keys) { b = b.map((x) => ({ main: [...x.main], over: [...x.over] })); const n = ((k % M) + M) % M; (b[n].main.length < cap ? b[n].main : b[n].over).push(k); states.push(b); }
    i = Math.min(i, keys.length);
  };
  const draw = (st, key) => h("div", { class: "buckets" }, ...st.map((x, n) => h("div", { class: "bucket" + (key != null && ((key % M) + M) % M === n ? " target" : "") },
    h("div", { class: "bucket-no" }, tl(`Kova ${n}`, `Bucket ${n}`)),
    h("div", { class: "bucket-main" }, ...Array.from({ length: cap }, (_, s) => h("span", { class: "slot" + (x.main[s] === key && key != null ? " new" : "") }, x.main[s] ?? "–"))),
    x.over.length ? h("div", { class: "bucket-over" }, "↳ ", ...x.over.map((v) => h("span", { class: "slot over" + (v === key ? " new" : "") }, v))) : null)));
  const show = () => {
    counter.textContent = tl(`${i} / ${keys.length} anahtar eklendi`, `${i} of ${keys.length} keys inserted`);
    prevB.disabled = i === 0; nextB.disabled = i >= keys.length;
    if (i === 0) { body.replaceChildren(h("p", { class: "small" }, tl(`Kovalar boş. Sonraki düğmesi ilk anahtarı (${keys[0]}) ekler.`, `The buckets are empty. Next inserts the first key (${keys[0]}).`)), draw(states[0])); }
    else {
      const k = keys[i - 1], n = ((k % M) + M) % M, over = states[i][n].over.includes(k);
      body.replaceChildren(
        h("p", {}, tl(`h(${k}) = ${k} mod ${M} = ${n}. `, `h(${k}) = ${k} mod ${M} = ${n}. `) + (over ? tl(`Kova ${n} dolu (${cap} kayıt), bu yüzden ${k} taşma zincirine gidiyor. Bu anahtarı bulmak artık bir yerine iki blok okumayı gerektirir.`, `Bucket ${n} is full (${cap} records), so ${k} goes to the overflow chain. Finding this key now takes two block reads instead of one.`) : tl(`Kova ${n}'de yer var, ${k} oraya yazılıyor.`, `Bucket ${n} has room, so ${k} is written there.`))),
        h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), draw(states[i - 1], null)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), draw(states[i], k))));
    }
    find();
  };
  const find = () => {
    const k = num(findIn.value, 0), n = ((k % M) + M) % M, st = states[i][n];
    const inMain = st.main.includes(k), pos = st.over.indexOf(k);
    findOut.textContent = inMain ? tl(`h(${k}) = ${n}: kovanın bloğu okunur ve ${k} orada bulunur. 1 blok okundu.`, `h(${k}) = ${n}: the bucket's block is read and ${k} is found there. 1 block read.`)
      : pos >= 0 ? tl(`h(${k}) = ${n}: kova okunur, ${k} orada yok; taşma zincirinde ${pos + 1}. sırada bulunur. ${pos + 2} blok okundu (her taşma kaydının ayrı bir blokta olduğu varsayılıyor).`, `h(${k}) = ${n}: the bucket is read, ${k} is not there; it is found at position ${pos + 1} of the overflow chain. ${pos + 2} blocks read (assuming each overflow record is in its own block).`)
      : !st.over.length ? tl(`h(${k}) = ${n}: kovanın bloğu okunur, ${k} orada yok ve taşma zinciri de yok; 1 blok okumayla kaydın olmadığı anlaşılır.`, `h(${k}) = ${n}: the bucket's block is read, ${k} is not there and there is no overflow chain; one block read shows the record does not exist.`)
      : tl(`h(${k}) = ${n}: kova ve taşma zinciri okunur, ${k} bulunamaz. ${1 + st.over.length} blok okundu. Hash'in avantajı yalnızca eşitlik aramasında geçerlidir; aralık aramasında bütün kovalar okunmalıdır.`, `h(${k}) = ${n}: the bucket and its overflow chain are read and ${k} is not found. ${1 + st.over.length} blocks read. Hashing only helps equality searches; a range search must read every bucket.`);
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; show(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; show(); }, { kind: "primary" });
  const allB = button(tl("Hepsini ekle", "Insert all"), () => { i = keys.length; show(); });
  [keysIn, mIn, capIn].forEach((x) => x.addEventListener("input", () => { build(); show(); }));
  findIn.addEventListener("input", find);
  $("#hash-sim").append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, field(tl("Anahtarlar: ", "Keys: "), keysIn), field(tl("Kova sayısı M: ", "Buckets M: "), mIn), field(tl("Kova kapasitesi: ", "Bucket capacity: "), capIn)),
    h("div", { class: "pl-bar" }, prevB, nextB, allB, counter), body,
    h("div", { class: "pl-bar", style: { marginTop: "10px" } }, field(tl("Bir anahtar arayın: ", "Search for a key: "), findIn)), findOut));
  build(); show();
}

// ---------------------------------------------------------------- RAID: where the blocks go and what a failure costs
{
  const LEVELS = {
    0: { disks: 4, layout: () => { const rows = []; for (let s = 0; s < 2; s++) rows.push([0, 1, 2, 3].map((d) => `B${s * 4 + d + 1}`)); return rows; } },
    1: { disks: 2, layout: () => [1, 2, 3, 4].map((n) => [`B${n}`, `B${n}`]) },
    4: { disks: 4, layout: () => { const rows = []; for (let s = 0; s < 3; s++) rows.push([`B${s * 3 + 1}`, `B${s * 3 + 2}`, `B${s * 3 + 3}`, `P${s + 1}`]); return rows; } },
    5: { disks: 4, layout: () => { const rows = []; let n = 1; for (let s = 0; s < 3; s++) { const p = 3 - (s % 4); rows.push([0, 1, 2, 3].map((d) => (d === p ? `P${s + 1}` : `B${n++}`))); } return rows; } },
    6: { disks: 5, layout: () => { const rows = []; let n = 1; for (let s = 0; s < 3; s++) { const p = (4 - s) % 5, q = (p + 1) % 5; rows.push([0, 1, 2, 3, 4].map((d) => (d === p ? `P${s + 1}` : d === q ? `Q${s + 1}` : `B${n++}`))); } return rows; } },
  };
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const out = h("div");
  let level = 5, failed = new Set();
  const draw = () => {
    for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.l === String(level)));
    const L = LEVELS[level], rows = L.layout();
    const tolerance = { 0: 0, 1: 1, 4: 1, 5: 1, 6: 2 }[level];
    const lost = failed.size > tolerance;
    const grid = h("div", { class: "raid-grid", style: { gridTemplateColumns: `repeat(${L.disks}, minmax(0, 1fr))` } },
      ...Array.from({ length: L.disks }, (_, d) => h("button", { type: "button", class: "raid-disk" + (failed.has(d) ? " failed" : ""), onclick: () => { failed.has(d) ? failed.delete(d) : failed.add(d); draw(); } },
        h("div", { class: "raid-head" }, tl(`Disk ${d + 1}`, `Disk ${d + 1}`), failed.has(d) ? " ✕" : ""),
        ...rows.map((r) => h("div", { class: "raid-blk" + (/^[PQ]/.test(r[d]) ? " parity" : "") + (failed.has(d) ? (lost ? " gone" : " rebuilt") : "") }, r[d])))));
    const data = rows.flat().filter((x) => x.startsWith("B")).length;
    const raw = rows.length * L.disks;
    const useful = level === 1 ? rows.length : data;
    const msg = !failed.size ? tl("Bir diski bozmak için üzerine tıklayın.", "Click a disk to make it fail.")
      : !lost ? (level === 1 ? tl("Bozuk diskin her bloğunun aynası diğer diskte duruyor; veri kaybı yok ve yeniden kurmak yalnızca kopyalamaktır.", "Every block of the failed disk has a mirror on the other disk; no data is lost and rebuilding is just copying.")
        : tl("Veri kaybı yok: bozuk diskteki her blok, aynı şeritteki diğer blokların ve eşlik bloğunun XOR'u alınarak yeniden hesaplanır (yeşil).", "No data lost: each block on the failed disk is recomputed by XOR-ing the other blocks of its stripe with the parity block (green)."))
      : level === 0 ? tl("RAID 0'da fazlalık yok: bozuk diskteki bloklar kayboldu (kırmızı).", "RAID 0 has no redundancy: the blocks on the failed disk are lost (red).")
      : tl(`Bu seviye en fazla ${tolerance} disk bozulmasına dayanır; ${failed.size} disk bozulduğu için bazı bloklar geri getirilemez (kırmızı).`, `This level survives at most ${tolerance} failed disk(s); with ${failed.size} failed, some blocks cannot be recovered (red).`);
    out.replaceChildren(grid, h("div", { class: `res-msg ${!failed.size ? "" : lost ? "warn" : "ok"}`, style: { fontFamily: "inherit" } }, msg),
      h("p", { class: "small muted" }, tl(`Kapasite: ${raw} bloğun ${useful} tanesi veri taşıyor (%${Math.round((100 * useful) / raw)}). `, `Capacity: ${useful} of ${raw} blocks hold data (${Math.round((100 * useful) / raw)}%). `)
        + { 0: tl("En hızlı ve en verimli seviye, ama hiç koruma yok.", "The fastest and most efficient level, but no protection at all."),
          1: tl("Kapasitenin yarısı kopyalara gider; okumalar iki diskten paralel yapılabilir.", "Half of the capacity goes to copies; reads can be served from both disks in parallel."),
          4: tl("Eşlik tek bir diskte: her yazma o diske de yazmak zorunda olduğu için eşlik diski darboğaz olur.", "Parity is on one disk: every write must also write that disk, so the parity disk becomes a bottleneck."),
          5: tl("Eşlik bloklarının diskler arasında dönüşümlü dağıldığına dikkat edin; böylece yazmalar tek bir diske yığılmaz.", "Notice how the parity blocks rotate across the disks, so writes do not pile up on one disk."),
          6: tl("Her şeritte iki fazlalık bloğu (P ve Q) var; iki disk aynı anda bozulsa da veri kurtarılır.", "Each stripe has two redundancy blocks (P and Q); data survives even if two disks fail at once.") }[level]));
  };
  for (const l of Object.keys(LEVELS)) seg.append(h("button", { type: "button", "data-l": l, onclick: () => { level = Number(l); failed = new Set(); draw(); } }, `RAID ${l}`));
  $("#raid").append(h("div", { class: "player" }, seg, out));
  draw();
}

// ---------------------------------------------------------------- you decide (files, buffers, hashing, RAID)
import { decidePlayer, calcSteps } from "../lib/decide.js";
{
  const host = $("#files-decide");
  // the buffer contents after each request (LRU or FIFO), for the worked solutions
  const simulate = (reqs, n, strat) => {
    let frames = [], last = {}, rows = [];
    reqs.forEach((p, t) => {
      const before = frames.join(", ") || "—";
      let what;
      if (frames.includes(p)) { last[p] = t; what = tl(`${p} tamponda: isabet`, `${p} is in the buffer: a hit`); }
      else if (frames.length < n) { frames.push(p); last[p] = t; what = tl(`${p} boş tampona okunur`, `${p} is read into a free frame`); }
      else {
        const victim = strat === "LRU" ? frames.reduce((a, b) => (last[a] <= last[b] ? a : b)) : frames[0];
        frames = frames.filter((x) => x !== victim); frames.push(p); last[p] = t;
        what = tl(`${victim} çıkarılır (${strat === "LRU" ? "en uzun süredir kullanılmayan" : "en önce giren"}), ${p} okunur`, `${victim} is evicted (${strat === "LRU" ? "least recently used" : "first in"}), ${p} is read`);
      }
      rows.push([tl(`İstek ${t + 1}: ${p}`, `Request ${t + 1}: ${p}`), tl(`Önce [${before}] → sonra [${frames.join(", ")}]. ${what}.`, `Before [${before}] → after [${frames.join(", ")}]. ${what}.`)]);
    });
    return calcSteps(rows);
  };
  if (host) decidePlayer(host, [
    { q: tl("B = 4096 byte, R = 150 byte, r = 20 000 kayıt, unspanned. Dosya kaç blok tutar?", "B = 4096 bytes, R = 150 bytes, r = 20,000 records, unspanned. How many blocks does the file take?"),
      opts: [["741", true, tl("Doğru. bfr = ⌊4096 / 150⌋ = 27; b = ⌈20 000 / 27⌉ = 741.", "Right. bfr = ⌊4096 / 150⌋ = 27; b = ⌈20,000 / 27⌉ = 741.")],
        ["733", false, tl("733, r · R / B'nin yukarı yuvarlanmasıdır; blokların sonunda kalan boş alanı yok sayar.", "733 is r · R / B rounded up; it ignores the free space left at the end of blocks.")],
        ["740", false, tl("Blok sayısı aşağı değil yukarı yuvarlanır: son 20 kayıt için de bir blok gerekir.", "The number of blocks is rounded up, not down: the last 20 records need a block too.")]],
      detail: () => calcSteps([[tl("1. Blocking factor", "1. Blocking factor"), tl("bfr = ⌊B / R⌋ = ⌊4096 / 150⌋ = ⌊27,3⌋ = 27 kayıt/blok; her blokta 4096 − 27 · 150 = 46 byte boş kalır.", "bfr = ⌊B / R⌋ = ⌊4096 / 150⌋ = ⌊27.3⌋ = 27 records per block; each block leaves 4096 − 27 · 150 = 46 bytes free.")],
        [tl("2. Blok sayısı", "2. Number of blocks"), tl("b = ⌈r / bfr⌉ = ⌈20 000 / 27⌉ = ⌈740,7⌉ = 741 blok.", "b = ⌈r / bfr⌉ = ⌈20,000 / 27⌉ = ⌈740.7⌉ = 741 blocks.")]]) },
    { q: tl("741 bloklu bir heap dosyasında, dosyada olmayan bir anahtarı aramak kaç blok okur? Aynı dosya anahtara göre sıralı olsaydı?", "In a heap file of 741 blocks, how many blocks does searching for a key that is not in the file read? And if the file were sorted on the key?"),
      opts: [[tl("741 ve 10", "741 and 10"), true, tl("Doğru. Heap'te kaydın olmadığını anlamak için bütün bloklar okunur; sıralı dosyada ikili arama ⌈log₂ 741⌉ = 10 blok okur.", "Right. In a heap all blocks are read to know the record is absent; in a sorted file binary search reads ⌈log₂ 741⌉ = 10 blocks.")],
        [tl("371 ve 10", "371 and 10"), false, tl("371 (b/2), var olan bir kaydın ortalama maliyetidir; olmayan bir kayıt için dosyanın sonuna kadar gidilir.", "371 (b/2) is the average cost for a record that exists; for a missing record the whole file is read.")],
        [tl("741 ve 1", "741 and 1"), false, tl("Tek blok okuma hash dosyasının maliyetidir; sıralı dosyada ikili arama yapılır.", "A single block read is the cost of a hash file; a sorted file uses binary search.")]],
      detail: () => calcSteps([[tl("Heap", "Heap"), tl("Kayıtlar sırasız olduğu için 741 bloğun hepsi okunur; ancak sonunda kaydın olmadığı anlaşılır.", "Records are unordered, so all 741 blocks are read; only at the end is it known that the record is absent.")],
        [tl("Sıralı dosya", "Sorted file"), tl("İkili arama her okumada aralığı yarıya indirir: 2⁹ = 512 < 741 ≤ 1024 = 2¹⁰, yani ⌈log₂ 741⌉ = 10 blok.", "Binary search halves the range at each read: 2⁹ = 512 < 741 ≤ 1024 = 2¹⁰, so ⌈log₂ 741⌉ = 10 blocks.")]]) },
    { q: tl("3 tamponlu LRU ile istekler 1, 2, 3, 1, 4. Dördüncü sayfa (4) geldiğinde hangi sayfa çıkarılır?", "With 3 frames and LRU the requests are 1, 2, 3, 1, 4. When page 4 arrives, which page is evicted?"),
      opts: [["1", false, tl("1 az önce (4. istekte) kullanıldı; en yakın zamanda kullanılan sayfadır.", "1 was just used (request 4); it is the most recently used page.")],
        ["2", true, tl("Doğru. Son kullanımlar: 1 → 4. istek, 2 → 2. istek, 3 → 3. istek. En uzun süredir kullanılmayan 2'dir.", "Right. Last uses: 1 → request 4, 2 → request 2, 3 → request 3. The least recently used is 2.")],
        ["3", false, tl("3, 2'den daha yakın zamanda kullanıldı.", "3 was used more recently than 2.")]],
      detail: () => simulate(["1", "2", "3", "1", "4"], 3, "LRU") },
    { q: tl("Aynı istekler (1, 2, 3, 1, 4) FIFO ile çalışırsa 4 geldiğinde hangi sayfa çıkarılır?", "If the same requests (1, 2, 3, 1, 4) run with FIFO, which page is evicted when 4 arrives?"),
      opts: [["1", true, tl("Doğru. FIFO tampona en önce gireni çıkarır; 1'in yeniden kullanılması sırasını değiştirmez.", "Right. FIFO evicts the page that entered first; reusing 1 does not change its place.")],
        ["2", false, tl("2 kullanım zamanına göre seçilirdi (LRU); FIFO giriş sırasına bakar.", "2 would be chosen by last use (LRU); FIFO looks at the order of entry.")],
        ["3", false, tl("3 en son giren sayfadır.", "3 is the page that entered last.")]],
      detail: () => simulate(["1", "2", "3", "1", "4"], 3, "FIFO") },
    { q: tl("h(K) = K mod 4 ve kova kapasitesi 2. Anahtarlar 4, 8, 12 sırayla eklenir. 12 nereye yazılır ve onu bulmak kaç blok okur?", "h(K) = K mod 4 and bucket capacity 2. The keys 4, 8, 12 are inserted in order. Where does 12 go and how many block reads does finding it take?"),
      opts: [[tl("Kova 0'a; 1 blok", "Bucket 0; 1 block"), false, tl("Kova 0'da yalnızca iki yer var ve 4 ile 8 onları doldurdu.", "Bucket 0 has only two places and 4 and 8 filled them.")],
        [tl("Kova 0'ın taşma zincirine; 2 blok", "Bucket 0's overflow chain; 2 blocks"), true, tl("Doğru. 4, 8 ve 12'nin hepsi 0'a düşer; kova dolu olduğu için 12 taşma zincirine gider ve onu bulmak için kova ile taşma bloğu okunur.", "Right. 4, 8 and 12 all hash to 0; the bucket is full, so 12 goes to the overflow chain and finding it reads the bucket and the overflow block.")],
        [tl("Kova 3'e; 1 blok", "Bucket 3; 1 block"), false, tl("12 mod 4 = 0'dır; statik hashing boş bir kovaya kaydırmaz.", "12 mod 4 = 0; static hashing does not move it to an empty bucket.")]],
      detail: () => calcSteps([["4", tl("h(4) = 0 → kova 0: önce [–, –], sonra [4, –].", "h(4) = 0 → bucket 0: before [–, –], after [4, –].")], ["8", tl("h(8) = 0 → kova 0: önce [4, –], sonra [4, 8].", "h(8) = 0 → bucket 0: before [4, –], after [4, 8].")],
        ["12", tl("h(12) = 0 → kova 0 dolu: önce [4, 8], sonra [4, 8] ↳ [12]. Arama: kova bloğu + taşma bloğu = 2 okuma.", "h(12) = 0 → bucket 0 is full: before [4, 8], after [4, 8] ↳ [12]. Search: bucket block + overflow block = 2 reads.")]]) },
    { q: tl("4 diskli bir RAID 5 dizisinde kapasitenin ne kadarı veriye ayrılır ve kaç disk bozulmasına dayanır?", "In a RAID 5 array of 4 disks, how much of the capacity holds data and how many disk failures does it survive?"),
      opts: [[tl("%75; bir disk", "75%; one disk"), true, tl("Doğru. Her şeritte 4 bloktan 1'i eşliktir; tek bir disk bozulursa blokları eşlikten yeniden hesaplanır.", "Right. In each stripe 1 of 4 blocks is parity; if one disk fails its blocks are recomputed from parity.")],
        [tl("%50; bir disk", "50%; one disk"), false, tl("%50 aynalamadır (RAID 1).", "50% is mirroring (RAID 1).")],
        [tl("%75; iki disk", "75%; two disks"), false, tl("İki disk bozulmasına dayanmak için iki fazlalık bloğu gerekir: RAID 6.", "Surviving two failures needs two redundancy blocks: RAID 6.")]],
      detail: () => calcSteps([[tl("Yerleşim", "Layout"), tl("Her şeritte 3 veri bloğu ve 1 eşlik bloğu vardır; eşlik blokları diskler arasında dönüşümlü dağılır.", "Each stripe has 3 data blocks and 1 parity block; the parity blocks rotate across the disks.")],
        [tl("Kapasite", "Capacity"), tl("3 / 4 = %75. Sayfadaki RAID şeklinde bir diske tıklayarak bozulmayı deneyebilirsiniz.", "3 / 4 = 75%. You can try a failure by clicking a disk in the RAID figure on the page.")]]) },
  ]);
}
