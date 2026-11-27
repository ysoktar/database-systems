// Ch 20 (transactions): the four concurrency problems step by step (database and local values before/after), the
// transaction state diagram, a schedule analyzer that builds the precedence graph one conflict at a time (graph
// before/after) and classifies recoverability, and "you decide" questions with reset and worked solutions.
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { t as tl } from "../lib/i18n.js";
import { parseSchedule, conflicts, precedenceGraph, findCycle, serialOrder, recoverability, transactions, opText, BOOK_SCHEDULES } from "../lib/schedule.js";

const field = (label, input) => h("label", { class: "small sim-field" }, label, input);
const NS = "http://www.w3.org/2000/svg";
const sv = (tag, a = {}, t) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };

// ---------------------------------------------------------------- the four problems
// Each step: [transaction, operation text, action(db, loc)]; db holds the database items, loc[T] the local variables.
const N = 5, M = 4;
const PROBLEMS = {
  lost: {
    label: tl("Kayıp güncelleme", "Lost update"), db: { X: 80, Y: 100 },
    steps: [
      ["T1", "read_item(X)", (d, l) => { l.T1.X = d.X; }], ["T1", "X := X − N", (d, l) => { l.T1.X -= N; }],
      ["T2", "read_item(X)", (d, l) => { l.T2.X = d.X; }], ["T2", "X := X + M", (d, l) => { l.T2.X += M; }],
      ["T1", "write_item(X)", (d, l) => { d.X = l.T1.X; }], ["T1", "read_item(Y)", (d, l) => { l.T1.Y = d.Y; }],
      ["T2", "write_item(X)", (d, l) => { d.X = l.T2.X; }], ["T1", "Y := Y + N", (d, l) => { l.T1.Y += N; }], ["T1", "write_item(Y)", (d, l) => { d.Y = l.T1.Y; }],
    ],
    correct: { X: 79, Y: 105 },
    end: tl("T2, X'i T1 yazmadan önce okuduğu için T1'in güncellemesinden habersiz; T2'nin yazdığı 84, T1'in 75'ini ezdi. Seri çalışmada X = 80 − 5 + 4 = 79 olmalıydı: T1'in güncellemesi kayboldu.", "T2 read X before T1 wrote it, so it knows nothing of T1's update; the 84 written by T2 overwrote T1's 75. Run serially, X should be 80 − 5 + 4 = 79: T1's update is lost."),
  },
  dirty: {
    label: tl("Geçici güncelleme (dirty read)", "Temporary update (dirty read)"), db: { X: 80, Y: 100 },
    steps: [
      ["T1", "read_item(X)", (d, l) => { l.T1.X = d.X; }], ["T1", "X := X − N", (d, l) => { l.T1.X -= N; }], ["T1", "write_item(X)", (d, l) => { d.X = l.T1.X; }],
      ["T2", "read_item(X)", (d, l) => { l.T2.X = d.X; }], ["T2", "X := X + M", (d, l) => { l.T2.X += M; }], ["T2", "write_item(X)", (d, l) => { d.X = l.T2.X; }],
      ["T1", "read_item(Y)", (d, l) => { l.T1.Y = d.Y; }],
      ["T1", tl("T1 başarısız olur: ROLLBACK, X önceki değerine (80) döner", "T1 fails: ROLLBACK, X goes back to its old value (80)"), (d) => { d.X = 80; }],
    ],
    correct: { X: 84, Y: 100 },
    end: tl("T2, T1'in commit olmamış değerini (75) okudu: bu kirli veridir. T1 geri alınınca X'in önceki görüntüsü 80 yüklendi ve T2'nin güncellemesi de silindi. T1 hiç çalışmamış sayılacağı için doğru sonuç 80 + 4 = 84 olmalıydı; ama T2 geçersiz bir değere dayandığı için onun da geri alınması gerekir.", "T2 read T1's uncommitted value (75): dirty data. When T1 was rolled back, X's before image 80 was restored and T2's update was wiped out too. Since T1 counts as never having run, the right result is 80 + 4 = 84; but T2 relied on an invalid value, so it must be rolled back too."),
  },
  summary: {
    label: tl("Yanlış özet", "Incorrect summary"), db: { A: 20, X: 80, Y: 100 },
    steps: [
      ["T3", "sum := 0", (d, l) => { l.T3.sum = 0; }], ["T3", "read_item(A)", (d, l) => { l.T3.A = d.A; }], ["T3", "sum := sum + A", (d, l) => { l.T3.sum += l.T3.A; }],
      ["T1", "read_item(X)", (d, l) => { l.T1.X = d.X; }], ["T1", "X := X − N", (d, l) => { l.T1.X -= N; }], ["T1", "write_item(X)", (d, l) => { d.X = l.T1.X; }],
      ["T3", "read_item(X)", (d, l) => { l.T3.X = d.X; }], ["T3", "sum := sum + X", (d, l) => { l.T3.sum += l.T3.X; }],
      ["T3", "read_item(Y)", (d, l) => { l.T3.Y = d.Y; }], ["T3", "sum := sum + Y", (d, l) => { l.T3.sum += l.T3.Y; }],
      ["T1", "read_item(Y)", (d, l) => { l.T1.Y = d.Y; }], ["T1", "Y := Y + N", (d, l) => { l.T1.Y += N; }], ["T1", "write_item(Y)", (d, l) => { d.Y = l.T1.Y; }],
    ],
    correct: { sum: 200 },
    end: tl("T3, X'in yeni değerini (75) ama Y'nin eski değerini (100) topladı: sum = 20 + 75 + 100 = 195. T1 tamamen önce ya da tamamen sonra çalışsaydı toplam 200 olurdu; T1 parayı yalnızca X'ten Y'ye taşıdığı için toplamı değiştirmez.", "T3 added X's new value (75) but Y's old value (100): sum = 20 + 75 + 100 = 195. Had T1 run completely before or after, the sum would be 200; T1 only moves money from X to Y, so it does not change the total."),
  },
  unrepeatable: {
    label: tl("Tekrarlanamayan okuma", "Unrepeatable read"), db: { X: 80 },
    steps: [
      ["T3", tl("read_item(X)  (ilk okuma)", "read_item(X)  (first read)"), (d, l) => { l.T3.X1 = d.X; }],
      ["T2", "read_item(X)", (d, l) => { l.T2.X = d.X; }], ["T2", "X := X + M", (d, l) => { l.T2.X += M; }], ["T2", "write_item(X)", (d, l) => { d.X = l.T2.X; }],
      ["T3", tl("read_item(X)  (ikinci okuma)", "read_item(X)  (second read)"), (d, l) => { l.T3.X2 = d.X; }],
    ],
    end: tl("T3 aynı X'i iki kez okudu ve 80 ile 84 gibi iki farklı değer gördü, çünkü arada T2 X'i değiştirdi. Örneğin bir müşteri koltuk sayısını kontrol edip birkaç saniye sonra rezervasyon yaparken bu sorunla karşılaşır.", "T3 read the same X twice and saw two different values, 80 and 84, because T2 changed X in between. A customer who checks the number of free seats and books a few seconds later meets exactly this problem."),
  },
};
{
  const host = $("#problems");
  let pid = "lost", i = 0;
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const counter = h("span", { class: "pl-count" });
  const body = h("div");
  const states = () => {
    const P = PROBLEMS[pid];
    const out = [{ db: { ...P.db }, loc: { T1: {}, T2: {}, T3: {} } }];
    for (const [, , act] of P.steps) { const prev = out[out.length - 1]; const s = { db: { ...prev.db }, loc: { T1: { ...prev.loc.T1 }, T2: { ...prev.loc.T2 }, T3: { ...prev.loc.T3 } } }; act(s.db, s.loc); out.push(s); }
    return out;
  };
  const vals = (o, changed = []) => h("span", { class: "tx-vals" }, ...(Object.keys(o).length ? Object.entries(o).map(([k, v]) => h("span", { class: "tx-val" + (changed.includes(k) ? " new" : "") }, `${k} = ${v}`)) : [h("span", { class: "muted" }, "—")]));
  const diff = (a, b) => Object.keys(b).filter((k) => a[k] !== b[k]);
  const draw = () => {
    const P = PROBLEMS[pid], st = states(), txs = [...new Set(P.steps.map((s) => s[0]))].sort();
    for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.p === pid));
    counter.textContent = tl(`Adım ${i} / ${P.steps.length}`, `Step ${i} of ${P.steps.length}`);
    prevB.disabled = i === 0; nextB.disabled = i >= P.steps.length;
    // the schedule as columns, the current operation highlighted
    const sched = h("table", { class: "simple tx-sched" }, h("thead", {}, h("tr", {}, h("th", {}, "#"), ...txs.map((t) => h("th", {}, t)))),
      h("tbody", {}, ...P.steps.map(([t, op], k) => h("tr", { class: k + 1 === i ? "cur" : k < i ? "done" : "" }, h("td", {}, String(k + 1)), ...txs.map((x) => h("td", {}, x === t ? op : ""))))));
    const kids = [h("div", { class: "table-wrap" }, sched)];
    if (i > 0) {
      const a = st[i - 1], b = st[i], [t, op] = P.steps[i - 1];
      kids.push(h("div", { class: "step-title" }, tl(`Adım ${i}: ${t} · ${op}`, `Step ${i}: ${t} · ${op}`)),
        h("div", { class: "ba" },
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), h("div", {}, h("strong", {}, tl("Veritabanı: ", "Database: ")), vals(a.db)), ...txs.map((x) => h("div", {}, h("strong", {}, `${x}: `), vals(a.loc[x])))),
          h("div", { class: "ba-arrow", "aria-hidden": "true" }),
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), h("div", {}, h("strong", {}, tl("Veritabanı: ", "Database: ")), vals(b.db, diff(a.db, b.db))), ...txs.map((x) => h("div", {}, h("strong", {}, `${x}: `), vals(b.loc[x], diff(a.loc[x], b.loc[x])))))));
    } else kids.push(h("p", { class: "small" }, tl(`Başlangıç değerleri: ${Object.entries(P.db).map(([k, v]) => `${k} = ${v}`).join(", ")}; N = ${N}, M = ${M}. Sonraki düğmesiyle işlemleri sırayla çalıştırın.`, `Initial values: ${Object.entries(P.db).map(([k, v]) => `${k} = ${v}`).join(", ")}; N = ${N}, M = ${M}. Run the operations one by one with Next.`)));
    if (i === P.steps.length) kids.push(h("div", { class: "res-msg warn", style: { fontFamily: "inherit" } }, P.end,
      P.correct ? tl(` Doğru sonuç: ${Object.entries(P.correct).map(([k, v]) => `${k} = ${v}`).join(", ")}.`, ` Correct result: ${Object.entries(P.correct).map(([k, v]) => `${k} = ${v}`).join(", ")}.`) : ""));
    body.replaceChildren(...kids);
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; draw(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; draw(); }, { kind: "primary" });
  const allB = button(tl("Sona git", "Go to end"), () => { i = PROBLEMS[pid].steps.length; draw(); });
  for (const [k, P] of Object.entries(PROBLEMS)) seg.append(h("button", { type: "button", "data-p": k, onclick: () => { pid = k; i = 0; draw(); } }, P.label));
  host.append(h("div", { class: "player" }, seg, h("div", { class: "pl-bar" }, prevB, nextB, allB, counter), body));
  draw();
}

// ---------------------------------------------------------------- transaction states (Figure 20.4)
{
  const host = $("#states");
  const S = { active: [tl("Aktif", "Active"), 150, 90], partial: [tl("Kısmen commit", "Partially committed"), 400, 40], committed: ["Committed", 640, 90], failed: [tl("Başarısız", "Failed"), 400, 170], terminated: [tl("Sonlandı", "Terminated"), 640, 200] };
  const E = [["start", "active", tl("Begin transaction", "Begin transaction")], ["active", "active", "Read, Write"], ["active", "partial", "End transaction"], ["partial", "committed", "Commit"],
    ["active", "failed", "Abort"], ["partial", "failed", "Abort"], ["committed", "terminated", ""], ["failed", "terminated", ""]];
  const EXPLAIN = {
    "start>active": tl("Transaction başladı ve aktif duruma geçti; okuma ve yazma işlemleri bu durumda yapılır.", "The transaction started and became active; reads and writes happen in this state."),
    "active>active": tl("Okuma ve yazma işlemleri transaction'ı aktif durumda tutar.", "Reads and writes keep the transaction active."),
    "active>partial": tl("Son işlem bitti (end transaction). Değişikliklerin kalıcı olup olamayacağı kontrol ediliyor: kurtarma için log kayıtları diske yazılır, eşzamanlılık kontrolü bir ihlal olup olmadığına bakar.", "The last operation is done (end transaction). It is being checked whether the changes can be made permanent: log records are written to disk for recovery and concurrency control checks for violations."),
    "partial>committed": tl("Kontroller başarılı: transaction commit noktasına ulaştı, değişiklikler kalıcıdır.", "The checks passed: the transaction reached its commit point and its changes are permanent."),
    "active>failed": tl("Transaction aktifken iptal edildi; değişiklikleri geri alınmalı.", "The transaction was aborted while active; its changes must be undone."),
    "partial>failed": tl("Kontrollerden biri başarısız oldu; transaction iptal edilir ve değişiklikleri geri alınır.", "One of the checks failed; the transaction is aborted and its changes undone."),
    "committed>terminated": tl("Transaction sistemden ayrıldı.", "The transaction left the system."),
    "failed>terminated": tl("Geri alma bitti, transaction sistemden ayrıldı; gerekirse daha sonra yeniden başlatılabilir.", "The rollback is done and the transaction left the system; it may be restarted later."),
  };
  let cur = "start", hist = [];
  const out = h("div"), btns = h("div", { class: "btn-row" }), msg = h("p", { class: "small" });
  const draw = () => {
    const svg = sv("svg", { viewBox: "-50 0 830 250", class: "st-svg" });
    const defs = sv("defs"), m = sv("marker", { id: "st-ar", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" });
    m.append(sv("path", { d: "M0,0 L10,5 L0,10 z", class: "st-head" })); defs.append(m); svg.append(defs);
    const last = hist[hist.length - 1];
    for (const [a, b, label] of E) {
      const on = last && last[0] === a && last[1] === b;
      const [x1, y1] = a === "start" ? [-40, 90] : [S[a][1], S[a][2]], [x2, y2] = [S[b][1], S[b][2]];
      if (a === b) { svg.append(sv("path", { d: `M${x1 - 30},${y1 - 22} C${x1 - 60},${y1 - 80} ${x1 + 60},${y1 - 80} ${x1 + 30},${y1 - 22}`, class: "st-edge" + (on ? " on" : ""), "marker-end": "url(#st-ar)" })); svg.append(sv("text", { x: x1, y: y1 - 70, class: "st-lbl" }, label)); continue; }
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const sx = x1 + ux * (a === "start" ? 0 : 62), sy = y1 + uy * 24, ex = x2 - ux * 66, ey = y2 - uy * 24;
      svg.append(sv("line", { x1: sx, y1: sy, x2: ex, y2: ey, class: "st-edge" + (on ? " on" : ""), "marker-end": "url(#st-ar)" }));
      // the label sits beside the line (on its upper side), never across it
      let nx = -uy, ny = ux; if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
      if (label) svg.append(sv("text", { x: (sx + ex) / 2 + nx * 9, y: (sy + ey) / 2 + ny * 9, class: "st-lbl", style: `text-anchor:${nx < -0.3 ? "end" : nx > 0.3 ? "start" : "middle"}` }, label));
    }
    for (const [k, [name, x, y]] of Object.entries(S)) {
      const g = sv("g", { class: "st-node" + (k === cur ? " cur" : "") + (hist.some((e) => e[1] === k) ? " seen" : "") });
      g.append(sv("rect", { x: x - 66, y: y - 22, width: 132, height: 44, rx: 22 }), sv("text", { x, y: y + 1 }, name)); svg.append(g);
    }
    out.replaceChildren(svg);
    btns.replaceChildren(...E.filter(([a]) => a === cur).map(([a, b, label]) => button(label || tl("Sistemden ayrıl", "Leave the system"), () => { hist.push([a, b]); cur = b; msg.textContent = EXPLAIN[`${a}>${b}`]; draw(); })),
      button(tl("Baştan", "Start over"), () => { cur = "start"; hist = []; msg.textContent = tl("Bir olay seçerek transaction'ı ilerletin.", "Move the transaction on by choosing an event."); draw(); }));
  };
  msg.textContent = tl("Bir olay seçerek transaction'ı ilerletin.", "Move the transaction on by choosing an event.");
  host.append(h("div", { class: "player" }, out, btns, msg));
  draw();
}

// ---------------------------------------------------------------- schedule analyzer
/** The precedence graph as SVG: transactions on a circle, edges with the items that caused them; cycle edges red. */
function graphSVG(nodes, edges, { added = null, cycle = null } = {}) {
  const two = nodes.length <= 2, R = nodes.length > 2 ? 70 : 60, cx = 120, cy = two ? 40 : 95;
  const pos = new Map(nodes.map((n, k) => [n, nodes.length === 2 ? [cx + (k ? 75 : -75), cy] : [cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / nodes.length), cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / nodes.length)]]));
  const svg = sv("svg", { viewBox: two ? "0 0 240 80" : "0 0 240 190", class: "pg-svg" });
  const defs = sv("defs");
  for (const [id, cls] of [["pg-ar", "pg-head"], ["pg-ar-new", "pg-head new"], ["pg-ar-cyc", "pg-head cyc"]]) { const m = sv("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }); m.append(sv("path", { d: "M0,0 L10,5 L0,10 z", class: cls })); defs.append(m); }
  svg.append(defs);
  const inCycle = (e) => cycle && cycle.some((n, k) => k + 1 < cycle.length && n === e.from && cycle[k + 1] === e.to);
  for (const e of edges) {
    const [x1, y1] = pos.get(e.from), [x2, y2] = pos.get(e.to);
    const both = edges.some((f) => f.from === e.to && f.to === e.from);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, off = both ? 14 : 0;
    const sx = x1 + ux * 22 - uy * off, sy = y1 + uy * 22 + ux * off, ex = x2 - ux * 22 - uy * off, ey = y2 - uy * 22 + ux * off;
    const isNew = added && added.from === e.from && added.to === e.to, cyc = inCycle(e);
    svg.append(sv("line", { x1: sx, y1: sy, x2: ex, y2: ey, class: "pg-edge" + (isNew ? " new" : "") + (cyc ? " cyc" : ""), "marker-end": `url(#${cyc ? "pg-ar-cyc" : isNew ? "pg-ar-new" : "pg-ar"})` }));
    const items = [...new Set(e.because.map((c) => c.from.item))].join(", ");
    svg.append(sv("text", { x: (sx + ex) / 2 - uy * 10, y: (sy + ey) / 2 + ux * 10 + 3, class: "pg-lbl" }, items));
  }
  for (const n of nodes) { const [x, y] = pos.get(n); const g = sv("g", { class: "pg-node" }); g.append(sv("circle", { cx: x, cy: y, r: 20 }), sv("text", { x, y: y + 1 }, `T${n}`)); svg.append(g); }
  return h("div", { class: "pg-wrap" }, svg);
}
/** The schedule as one column per transaction, rows in schedule order; the given operations highlighted. */
function scheduleTable(ops, mark = []) {
  const txs = transactions(ops);
  return h("div", { class: "table-wrap" }, h("table", { class: "simple tx-sched" },
    h("thead", {}, h("tr", {}, h("th", {}, "#"), ...txs.map((t) => h("th", {}, `T${t}`)))),
    h("tbody", {}, ...ops.map((o, k) => h("tr", { class: mark.includes(o) ? "cur" : "" }, h("td", {}, String(k + 1)), ...txs.map((t) => h("td", {}, t === o.t ? opText(o) : "")))))));
}
const sentence = {
  serial: (order) => tl(`Grafta döngü yok: çizelge çakışma serileştirilebilirdir. Eşdeğer seri sıra (topolojik sıralama): ${order.map((t) => `T${t}`).join(" → ")}.`, `The graph has no cycle: the schedule is conflict serializable. An equivalent serial order (topological sort): ${order.map((t) => `T${t}`).join(" → ")}.`),
  cycle: (c) => tl(`Grafta döngü var (${c.map((t) => `T${t}`).join(" → ")}): çizelge çakışma serileştirilebilir değildir.`, `The graph has a cycle (${c.map((t) => `T${t}`).join(" → ")}): the schedule is not conflict serializable.`),
};
function recSentences(ops) {
  const r = recoverability(ops), out = [];
  if (!ops.some((o) => o.kind === "c" || o.kind === "a")) return [tl("Çizelgede commit ya da abort olmadığı için kurtarılabilirlik sınıfı değerlendirilmedi; sınıflar commit ve abort'ların yerine bağlıdır.", "The schedule has no commit or abort, so its recoverability class is not assessed; the classes depend on where commits and aborts are.")];
  const w = r.why;
  out.push(r.recoverable ? tl("Kurtarılabilir: her transaction, okuduğu değerleri yazan transaction'lar commit olduktan sonra commit oluyor.", "Recoverable: every transaction commits after the transactions whose values it read have committed.")
    : tl(`Kurtarılamaz: T${w.recoverable.read.t}, T${w.recoverable.write.t}'in yazdığı ${w.recoverable.read.item}'i okuyor (${opText(w.recoverable.read)}) ve T${w.recoverable.write.t}${w.recoverable.writerEnd?.kind === "a" ? " abort olduğu hâlde" : " commit olmadan"} commit oluyor.`, `Not recoverable: T${w.recoverable.read.t} reads the ${w.recoverable.read.item} written by T${w.recoverable.write.t} (${opText(w.recoverable.read)}) and commits ${w.recoverable.writerEnd?.kind === "a" ? "although T" + w.recoverable.write.t + " aborts" : "before T" + w.recoverable.write.t + " commits"}.`));
  if (r.recoverable) out.push(r.cascadeless ? tl("Cascadeless: hiçbir transaction commit olmamış bir değeri okumuyor.", "Cascadeless: no transaction reads an uncommitted value.")
    : tl(`Cascadeless değil: ${opText(w.cascadeless.read)}, henüz commit olmamış T${w.cascadeless.write.t}'in yazdığı değeri okuyor; T${w.cascadeless.write.t} abort olursa T${w.cascadeless.read.t} de geri alınmalı (basamaklı geri alma).`, `Not cascadeless: ${opText(w.cascadeless.read)} reads a value written by T${w.cascadeless.write.t}, which has not committed yet; if T${w.cascadeless.write.t} aborts, T${w.cascadeless.read.t} must be rolled back too (cascading rollback).`));
  if (r.cascadeless && r.recoverable) out.push(r.strict ? tl("Strict: X'i yazan transaction bitmeden kimse X'i okumuyor ya da yazmıyor.", "Strict: nobody reads or writes X before the transaction that wrote X has ended.")
    : tl(`Strict değil: ${opText(w.strict.op)}, ${opText(w.strict.write)} yazan T${w.strict.write.t} bitmeden aynı öğeye erişiyor.`, `Not strict: ${opText(w.strict.op)} accesses the item before T${w.strict.write.t}, which did ${opText(w.strict.write)}, has ended.`));
  return out;
}
/** All steps of the analysis: the conflicts one by one, each adding (or repeating) an edge. */
function analysis(ops) {
  const cs = conflicts(ops), nodes = transactions(ops), steps = [];
  let edges = [];
  for (const c of cs) {
    const before = edges.map((e) => ({ ...e, because: [...e.because] }));
    let e = edges.find((x) => x.from === c.from.t && x.to === c.to.t);
    const isNew = !e;
    if (!e) { e = { from: c.from.t, to: c.to.t, because: [] }; edges.push(e); }
    e.because.push(c);
    steps.push({ c, isNew, before, after: edges.map((x) => ({ ...x, because: [...x.because] })), edge: e });
  }
  const g = precedenceGraph(ops);
  return { nodes, steps, g, cycle: findCycle(g), order: serialOrder(g) };
}
const conflictSentence = (s) => tl(`${opText(s.c.from)} ile ${opText(s.c.to)} çakışıyor (${s.c.type === "read-write" ? "okuma-yazma" : s.c.type === "write-read" ? "yazma-okuma" : "yazma-yazma"}, ${s.c.from.item} üzerinde). T${s.c.from.t}'in işlemi önce geldiği için ${s.isNew ? `T${s.c.from.t} → T${s.c.to.t} kenarı eklenir` : `T${s.c.from.t} → T${s.c.to.t} kenarı zaten var`}.`,
  `${opText(s.c.from)} and ${opText(s.c.to)} conflict (${s.c.type}, on ${s.c.from.item}). T${s.c.from.t}'s operation comes first, so ${s.isNew ? `the edge T${s.c.from.t} → T${s.c.to.t} is added` : `the edge T${s.c.from.t} → T${s.c.to.t} is already there`}.`);
function analysisList(ops) {
  const a = analysis(ops);
  return h("div", {}, scheduleTable(ops),
    h("ol", { class: "map-steps" }, ...a.steps.map((s) => h("li", {}, h("div", { class: "small" }, conflictSentence(s)),
      h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), graphSVG(a.nodes, s.before)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), graphSVG(a.nodes, s.after, { added: s.isNew ? s.edge : null })))))),
    h("p", { class: a.cycle ? "nf-bad" : "nf-ok" }, a.cycle ? sentence.cycle(a.cycle) : sentence.serial(a.order)),
    graphSVG(a.nodes, a.g.edges, { cycle: a.cycle }),
    h("ul", { class: "small" }, ...recSentences(ops).map((x) => h("li", {}, x))));
}
{
  const host = $("#schedule-tool");
  const NAMES = { A: tl("A: seri, T1 sonra T2 (Figure 20.5a)", "A: serial, T1 then T2 (Figure 20.5a)"), B: tl("B: seri, T2 sonra T1 (Figure 20.5b)", "B: serial, T2 then T1 (Figure 20.5b)"), C: tl("C: iç içe (Figure 20.5c)", "C: interleaved (Figure 20.5c)"), D: tl("D: iç içe (Figure 20.5c)", "D: interleaved (Figure 20.5c)"),
    Sa: tl("Sa: kayıp güncelleme, commit'lerle", "Sa: lost update, with commits"), Sc: tl("Sc: kurtarılamaz (Bölüm 20.4)", "Sc: nonrecoverable (Section 20.4)"), Sd: tl("Sd: kurtarılabilir (Bölüm 20.4)", "Sd: recoverable (Section 20.4)"), Se: tl("Se: basamaklı geri alma (Bölüm 20.4)", "Se: cascading rollback (Section 20.4)"), E: tl("E: üç transaction", "E: three transactions") };
  const sel = h("select", {}, ...Object.keys(BOOK_SCHEDULES).map((k) => h("option", { value: k }, NAMES[k] || k)));
  const ta = h("textarea", { rows: 2, spellcheck: "false", class: "nf-fds", "aria-label": tl("Çizelge", "Schedule") });
  const counter = h("span", { class: "pl-count" }), body = h("div");
  let ops = [], a = null, i = 0;
  const build = () => {
    const p = parseSchedule(ta.value);
    ops = p.ops; a = analysis(ops); i = 0;
    if (p.errors.length) { body.replaceChildren(h("div", { class: "res-msg warn" }, tl(`Anlaşılamayan işlemler: ${p.errors.join(", ")}. Biçim: r1(X); w2(Y); c1; a2`, `Not understood: ${p.errors.join(", ")}. Format: r1(X); w2(Y); c1; a2`))); prevB.disabled = nextB.disabled = true; return false; }
    return true;
  };
  const total = () => a.steps.length + 1;
  const show = () => {
    counter.textContent = tl(`Adım ${i} / ${total()}`, `Step ${i} of ${total()}`);
    prevB.disabled = i === 0; nextB.disabled = i >= total();
    if (i === 0) { body.replaceChildren(h("p", { class: "small" }, tl(`Çizelgede ${ops.length} işlem ve ${a.nodes.length} transaction var. Her transaction grafta bir düğümdür. Sonraki düğmesi çakışan işlem çiftlerini sırayla bulur (${a.steps.length} çift).`, `The schedule has ${ops.length} operations and ${a.nodes.length} transactions. Each transaction is a node in the graph. Next finds the conflicting pairs one by one (${a.steps.length} pairs).`)), scheduleTable(ops), graphSVG(a.nodes, [])); return; }
    if (i <= a.steps.length) {
      const s = a.steps[i - 1];
      body.replaceChildren(h("div", { class: "step-title" }, tl(`Çakışma ${i}: ${opText(s.c.from)} ve ${opText(s.c.to)}`, `Conflict ${i}: ${opText(s.c.from)} and ${opText(s.c.to)}`)), h("p", { class: "small" }, conflictSentence(s)),
        h("div", { class: "pg-grid" }, scheduleTable(ops, [s.c.from, s.c.to]),
          h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), graphSVG(a.nodes, s.before)), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
            h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), graphSVG(a.nodes, s.after, { added: s.isNew ? s.edge : null })))));
      return;
    }
    body.replaceChildren(h("div", { class: "step-title" }, tl("Sonuç", "Result")), h("p", { class: a.cycle ? "nf-bad" : "nf-ok" }, a.cycle ? sentence.cycle(a.cycle) : sentence.serial(a.order)),
      graphSVG(a.nodes, a.g.edges, { cycle: a.cycle }), h("h4", {}, tl("Kurtarılabilirlik", "Recoverability")), h("ul", { class: "small" }, ...recSentences(ops).map((x) => h("li", {}, x))));
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; show(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; show(); }, { kind: "primary" });
  const endB = button(tl("Sonuca git", "Go to result"), () => { i = total(); show(); });
  const load = () => { ta.value = BOOK_SCHEDULES[sel.value]; if (build()) show(); };
  sel.addEventListener("change", load);
  // "Check in the analyzer" buttons in the exercises: data-sched="r1(X); …"
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-sched]");
    if (!b) return;
    ta.value = b.dataset.sched;
    if (build()) show();
    host.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  ta.addEventListener("input", () => { if (build()) show(); });
  host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, field(tl("Kitap çizelgesi: ", "Book schedule: "), sel)), h("label", { class: "small" }, tl("Çizelge (r = okuma, w = yazma, c = commit, a = abort):", "Schedule (r = read, w = write, c = commit, a = abort):"), ta),
    h("div", { class: "pl-bar" }, prevB, nextB, endB, counter), body));
  sel.value = "C"; load();
}

// ---------------------------------------------------------------- you decide
const TD = [
  { s: BOOK_SCHEDULES.C, q: tl("Bu çizelge (kitaptaki C) çakışma serileştirilebilir mi?", "Is this schedule (the book's C) conflict serializable?"),
    opts: [[tl("Evet, T1 → T2'ye eşdeğer", "Yes, equivalent to T1 → T2"), false, tl("r1(X) ile w2(X) T1 → T2 verir, ama r2(X) ile w1(X) de T2 → T1 verir; iki yön birden olduğu için seri bir sıra yoktur.", "r1(X) and w2(X) give T1 → T2, but r2(X) and w1(X) give T2 → T1; with both directions there is no serial order.")],
      [tl("Hayır, öncelik grafında döngü var", "No, the precedence graph has a cycle"), true, tl("Doğru. T1 → T2 ve T2 → T1 kenarları bir döngü oluşturur; bu çizelge kayıp güncelleme çizelgesidir.", "Right. The edges T1 → T2 and T2 → T1 form a cycle; this is the lost update schedule.")],
      [tl("Evet, T2 → T1'e eşdeğer", "Yes, equivalent to T2 → T1"), false, tl("w1(X) ile w2(X) T1 → T2 kenarı verir; bu yüzden T2 tamamen önce çalışamaz.", "w1(X) and w2(X) give the edge T1 → T2; so T2 cannot run entirely first.")]] },
  { s: BOOK_SCHEDULES.D, q: tl("Bu çizelge (kitaptaki D) serileştirilebilir mi?", "Is this schedule (the book's D) serializable?"),
    opts: [[tl("Evet, T1 → T2 seri çizelgesine eşdeğer", "Yes, equivalent to the serial schedule T1 → T2"), true, tl("Doğru. Bütün çakışmalarda T1'in işlemi önce geliyor; grafta yalnızca T1 → T2 var. D, iç içe olduğu hâlde A ile aynı sonucu garanti eder.", "Right. In every conflict T1's operation comes first; the graph has only T1 → T2. D is interleaved but guarantees the same result as A.")],
      [tl("Hayır, çünkü seri değil", "No, because it is not serial"), false, tl("Serileştirilebilir olmak seri olmak demek değildir; bir seri çizelgeye eşdeğer olmak yeter.", "Being serializable does not mean being serial; being equivalent to a serial schedule is enough.")],
      [tl("Evet, T2 → T1'e eşdeğer", "Yes, equivalent to T2 → T1"), false, tl("w1(X) ile r2(X) T1 → T2 kenarı verir; T2 önce çalışamaz.", "w1(X) and r2(X) give T1 → T2; T2 cannot go first.")]] },
  { s: BOOK_SCHEDULES.Sc, q: tl("Bu çizelge (Sc) kurtarılabilir mi?", "Is this schedule (Sc) recoverable?"),
    opts: [[tl("Evet, strict", "Yes, strict"), false, tl("Strict olmak için X'i yazan T1 bitmeden kimse X'e erişmemeli; r2(X) T1 bitmeden geliyor.", "To be strict nobody may access X before T1, which wrote it, ends; r2(X) comes before T1 ends.")],
      [tl("Hayır, kurtarılamaz", "No, it is not recoverable"), true, tl("Doğru. T2, T1'in yazdığı X'i okuyup T1'den önce commit oluyor; sonra T1 abort olunca commit olmuş T2 geçersiz bir değere dayanıyor ve geri alınamıyor.", "Right. T2 reads the X written by T1 and commits before T1; when T1 then aborts, the committed T2 relies on an invalid value and cannot be undone.")],
      [tl("Evet, cascadeless", "Yes, cascadeless"), false, tl("T2 commit olmamış bir değeri okuyor; bu cascadeless olmayı da bozar.", "T2 reads an uncommitted value; that breaks cascadelessness too.")]] },
  { s: BOOK_SCHEDULES.Sd, q: tl("Sd'de commit'lerin yeri değişti. Hangi sınıfta?", "In Sd the commits moved. Which class is it in?"),
    opts: [[tl("Kurtarılamaz", "Not recoverable"), false, tl("T2, okuduğu değeri yazan T1 commit olduktan sonra commit oluyor; bu kurtarılabilirliğin koşuludur.", "T2 commits after T1, which wrote the value it read, has committed; that is the condition for recoverability.")],
      [tl("Kurtarılabilir ama cascadeless değil", "Recoverable but not cascadeless"), true, tl("Doğru. Commit sırası doğru, ama T2 commit olmamış T1'in X'ini okuyor; T1 abort olsaydı T2 de geri alınmak zorunda kalırdı.", "Right. The commit order is right, but T2 reads T1's uncommitted X; had T1 aborted, T2 would have to be rolled back too.")],
      [tl("Strict", "Strict"), false, tl("Strict, cascadeless olmayı gerektirir; T2 commit olmamış bir değeri okuyor.", "Strict requires being cascadeless; T2 reads an uncommitted value.")]] },
  { s: "r1(X); w1(X); c1; r2(X); w2(X); c2", q: tl("Bu çizelge en fazla hangi sınıftadır?", "What is the strongest class of this schedule?"),
    opts: [[tl("Yalnızca kurtarılabilir", "Only recoverable"), false, tl("T2, X'i T1 commit olduktan sonra okuyor; bu cascadeless olmayı da sağlar.", "T2 reads X after T1 committed; that also makes it cascadeless.")],
      [tl("Cascadeless ama strict değil", "Cascadeless but not strict"), false, tl("T2 X'e yalnızca T1 bittikten sonra erişiyor; strict koşulu da sağlanıyor.", "T2 accesses X only after T1 ended; the strict condition holds too.")],
      ["Strict", true, tl("Doğru. Hiçbir transaction, X'i yazan transaction bitmeden X'e erişmiyor. Bu çizelge aynı zamanda seridir.", "Right. No transaction accesses X before the transaction that wrote X has ended. This schedule is also serial.")]] },
  { s: BOOK_SCHEDULES.E, q: tl("Üç transaction'lık bu çizelge serileştirilebilir mi?", "Is this schedule of three transactions serializable?"),
    opts: [[tl("Evet: T1 → T2 → T3", "Yes: T1 → T2 → T3"), false, tl("w2(Y) ile r1(Y) T2 → T1 kenarı verir; T1 önce çalışamaz.", "w2(Y) and r1(Y) give T2 → T1; T1 cannot go first.")],
      [tl("Hayır, T1 ile T3 arasında döngü var", "No, there is a cycle between T1 and T3"), true, tl("Doğru. X üzerindeki çakışmalar T1 → T3, Y üzerindekiler T3 → T1 verir; T1 → T3 → T1 bir döngüdür.", "Right. The conflicts on X give T1 → T3 and those on Y give T3 → T1; T1 → T3 → T1 is a cycle.")],
      [tl("Evet: T2 → T3 → T1", "Yes: T2 → T3 → T1"), false, tl("w1(X) ile r3(X) T1 → T3 kenarı verir; T3, T1'den önce çalışamaz.", "w1(X) and r3(X) give T1 → T3; T3 cannot run before T1.")]] },
  { s: "r1(X); r2(Y); w1(X); r3(X); w2(Y); w3(X); r3(Y)", q: tl("Bu çizelge serileştirilebilir mi?", "Is this schedule serializable?"),
    opts: [[tl("Evet; örneğin T1 → T2 → T3", "Yes; for example T1 → T2 → T3"), true, tl("Doğru. X üzerindeki çakışmalar T1 → T3, Y üzerindekiler T2 → T3 verir; döngü yoktur. T1 ile T2 arasında çakışma olmadığı için T2 → T1 → T3 de eşdeğer bir seri sıradır.", "Right. The conflicts on X give T1 → T3 and those on Y give T2 → T3; there is no cycle. T1 and T2 do not conflict, so T2 → T1 → T3 is an equivalent serial order too.")],
      [tl("Hayır, T3 ile T2 arasında döngü var", "No, there is a cycle between T3 and T2"), false, tl("r3(Y), w2(Y)'den sonra geliyor; bu yalnızca T2 → T3 verir, ters yönde bir kenar yok.", "r3(Y) comes after w2(Y); that gives only T2 → T3, there is no edge the other way.")],
      [tl("Evet, yalnızca T3 → T1 → T2", "Yes, only T3 → T1 → T2"), false, tl("T3, T1'in yazdığı X'i okuyor; T3 önce çalışamaz.", "T3 reads the X written by T1; T3 cannot go first.")]] },
  { s: "r1(X); r2(X); w1(X); w2(X)", q: tl("Bu çizelge hangi eşzamanlılık sorununu gösterir?", "Which concurrency problem does this schedule show?"),
    opts: [[tl("Kayıp güncelleme", "Lost update"), true, tl("Doğru. İki transaction X'in aynı eski değerini okuyor ve ikisi de yazıyor; w2(X), T1'in güncellemesini ezer. Grafta T1 ⇄ T2 döngüsü vardır.", "Right. Both transactions read the same old value of X and both write it; w2(X) overwrites T1's update. The graph has the cycle T1 ⇄ T2.")],
      [tl("Kirli okuma", "Dirty read"), false, tl("Kirli okuma, commit olmamış ve sonra geri alınan bir değeri okumaktır; burada okumalar yazmalardan önce geliyor.", "A dirty read reads a value that is uncommitted and later rolled back; here the reads come before the writes.")],
      [tl("Tekrarlanamayan okuma", "Unrepeatable read"), false, tl("Tekrarlanamayan okumada aynı transaction aynı öğeyi iki kez okur; burada her transaction X'i bir kez okuyor.", "In an unrepeatable read the same transaction reads an item twice; here each transaction reads X once.")]] },
];
{
  const host = $("#tx-decide");
  let k = 0, answered = [];
  const score = () => answered.filter((j, n) => j != null && TD[n].opts[j][1]).length;
  const head = h("div", { class: "pl-bar" }), card = h("div");
  host.append(h("div", { class: "player" }, head, card));
  const show = () => {
    const d = TD[k], ops = parseSchedule(d.s).ops;
    const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { k--; show(); });
    const nextB = button(k === TD.length - 1 ? tl("Sonuç", "Result") : tl("Sonraki ▶", "Next ▶"), () => { k++; k < TD.length ? show() : finish(); }, { kind: "primary" });
    prevB.disabled = k === 0; nextB.disabled = answered[k] == null;
    head.replaceChildren(prevB, nextB, h("span", { class: "pl-count" }, tl(`Soru ${k + 1} / ${TD.length} · ${score()} doğru`, `Question ${k + 1} of ${TD.length} · ${score()} correct`)),
      h("div", { class: "pl-dots", style: { margin: 0 } }, ...TD.map((q, j) => h("button", { type: "button", class: "pl-dot" + (j === k ? " on" : "") + (answered[j] == null ? "" : q.opts[answered[j]][1] ? " good" : " bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
    const opts = h("div", { class: "quiz-options" }), fb = h("div"), detail = h("div");
    const pick = (j, initial = false) => {
      if (!initial) { answered[k] = j; show(); return; }
      [...opts.children].forEach((b, m) => { b.disabled = true; b.classList.toggle("correct", d.opts[m][1]); b.classList.toggle("wrong", m === j && !d.opts[m][1]); });
      const [, ok, why] = d.opts[j], right = d.opts.find((o) => o[1]);
      fb.replaceChildren(h("div", { class: `res-msg ${ok ? "ok" : "warn"}`, style: { fontFamily: "inherit" } }, why),
        ok ? "" : h("p", { class: "small" }, h("strong", {}, tl("Doğru cevap: ", "Correct answer: ")), right[0], ". ", right[2].replace(/^(Doğru|Right)\. /, "")),
        h("div", { class: "btn-row", style: { margin: "6px 0" } }, button(tl("↺ Cevabı sıfırla", "↺ Reset answer"), () => { answered[k] = undefined; show(); })));
      detail.replaceChildren(h("div", { class: "ba-label" }, tl("Adım adım çözüm: her çakışma ve öncelik grafının önceki ve sonraki hâli", "Worked solution: each conflict and the precedence graph before and after")), analysisList(ops));
    };
    d.opts.forEach(([label], j) => opts.append(h("button", { type: "button", onclick: () => pick(j) }, h("span", { class: "opt-letter" }, "ABC"[j] + ") "), label)));
    card.replaceChildren(h("p", { class: "decide-q" }, d.q), h("pre", { class: "tx-inline" }, d.s), opts, fb, detail);
    if (answered[k] != null) pick(answered[k], true);
  };
  const finish = () => {
    k = TD.length - 1;
    head.replaceChildren(button(tl("Baştan başla", "Start again"), () => { k = 0; answered = []; show(); }, { kind: "primary" }));
    card.replaceChildren(h("p", { class: "decide-q" }, tl(`${TD.length} sorudan ${score()} tanesini doğru cevapladınız.`, `You answered ${score()} of ${TD.length} questions correctly.`)),
      h("p", {}, tl("Bir soruya dönmek için numarasına tıklayın; kırmızılar yanlış cevapladıklarınız.", "Click a number to go back to a question; the red ones are those you missed.")),
      h("div", { class: "pl-dots" }, ...TD.map((q, j) => h("button", { type: "button", class: "pl-dot " + (q.opts[answered[j]]?.[1] ? "good" : "bad"), onclick: () => { k = j; show(); } }, String(j + 1)))));
  };
  show();
}

import { interleave, rwItem, recSets } from "../lib/figs.js";
interleave(document.querySelector("#interleave"));
rwItem(document.querySelector("#rw-item"));
recSets(document.querySelector("#rec-sets"));
