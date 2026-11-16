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
