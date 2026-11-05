// ER / EER diagrams in the notation of Elmasri & Navathe (Chen notation), drawn as inline SVG from a small spec.
//   nodes: {id, type: "entity"|"rel"|"attr"|"isa", x, y, label, weak, ident, key, pkey, multi, derived, of}
//          attr.of = the entity / relationship / composite attribute it belongs to (draws the line)
//   links: {a, b, total, card, role, via: [[x, y], …], subset}
//          card is written near the relationship end of the line (Elmasri puts 1 / N / M beside the diamond)
//          total = double line (total participation); subset = the ⊂ mark of a subclass line
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const textW = (s) => [...String(s)].length * 6.9;

function size(n) {
  if (n.type === "entity") return { w: Math.max(84, textW(n.label) + 26), h: 36 };
  if (n.type === "rel") return { w: Math.max(80, textW(n.label) + 44), h: 46 };
  if (n.type === "attr") return { w: Math.max(46, textW(n.label) + 22), h: 28 };
  return { w: 26, h: 26 };
}

/** Point where the segment from the centre of node n towards (tx, ty) leaves n's shape. */
function boundary(n, tx, ty) {
  const { w, h } = size(n);
  const dx = tx - n.x, dy = ty - n.y;
  if (!dx && !dy) return [n.x, n.y];
  let t;
  if (n.type === "entity") t = Math.min(Math.abs(w / 2 / (dx || 1e-9)), Math.abs(h / 2 / (dy || 1e-9)));
  else if (n.type === "rel") t = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
  else if (n.type === "attr") t = 1 / Math.sqrt((dx / (w / 2)) ** 2 + (dy / (h / 2)) ** 2);
  else t = 13 / Math.hypot(dx, dy);
  return [n.x + dx * t, n.y + dy * t];
}

export function drawER(spec) {
  const svg = el("svg", { viewBox: `0 0 ${spec.width} ${spec.height}`, role: "img", "aria-label": spec.title || "ER diagram" });
  if (spec.title) svg.append(el("title", {}, spec.title));
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const gLinks = el("g"), gNodes = el("g"), gLabels = el("g");
  svg.append(gLinks, gNodes, gLabels);

  const links = [...spec.links];
  for (const n of spec.nodes) if (n.of) links.push({ a: n.id, b: n.of, attr: true });

  for (const L of links) {
    const A = byId.get(L.a), B = byId.get(L.b);
    if (!A || !B) throw new Error(`ER link ${L.a} → ${L.b}: unknown node`);
    const pts = [[A.x, A.y], ...(L.via || []), [B.x, B.y]];
    // clip the end points to the shapes
    pts[0] = boundary(A, ...pts[1]);
    pts[pts.length - 1] = boundary(B, ...pts[pts.length - 2]);
    const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L");
    if (L.total) {
      gLinks.append(el("path", { d, class: "link", "stroke-width": 4.6, style: "stroke:var(--text-2)" }));
      gLinks.append(el("path", { d, class: "link", "stroke-width": 1.8, style: "stroke:var(--surface)" }));
    } else gLinks.append(el("path", { d, class: "link" }));

    // cardinality next to the relationship end (whichever end is a diamond), role names along the line
    const relAtA = A.type === "rel", relAtB = B.type === "rel";
    const placeLabel = (txt, cls, frac, off) => {
      // segment adjacent to the relationship end
      const [p, q] = relAtB && !relAtA ? [pts[pts.length - 1], pts[pts.length - 2]] : [pts[0], pts[1]];
      const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const along = Math.min(len * frac, 34 + (frac > 0.4 ? 30 : 0));
      const x = p[0] + ux * along - uy * off, y = p[1] + uy * along + ux * off;
      gLabels.append(el("text", { x: x.toFixed(1), y: y.toFixed(1), class: cls }, txt));
    };
    if (L.card) placeLabel(L.card, "card", 0.3, L.cardSide ?? 9);
    if (L.role) placeLabel(L.role, "lbl", 0.6, L.roleSide ?? -10);
    if (L.subset) {
      // ⊂ on the line from the ISA circle to the subclass, opening towards the circle
      const [p, q] = [pts[0], pts[pts.length - 1]];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len, px = -uy, py = ux;
      const r = 7;
      const s = [mx - ux * 4 + px * r, my - uy * 4 + py * r], e = [mx - ux * 4 - px * r, my - uy * 4 - py * r];
      const c1 = [s[0] + ux * 12, s[1] + uy * 12], c2 = [e[0] + ux * 12, e[1] + uy * 12];
      gLabels.append(el("path", { class: "subset", d: `M${s}C${c1} ${c2} ${e}` }));
    }
  }

  for (const n of spec.nodes) {
    const { w, h } = size(n);
    const g = el("g", { class: { entity: "ent", rel: "rel", attr: "att", isa: "isa" }[n.type] });
    if (n.type === "entity") {
      if (n.weak) g.classList.add("weak");
      g.append(el("rect", { x: n.x - w / 2, y: n.y - h / 2, width: w, height: h }));
      if (n.weak) g.append(el("rect", { class: "inner", x: n.x - w / 2 + 4, y: n.y - h / 2 + 4, width: w - 8, height: h - 8 }));
    } else if (n.type === "rel") {
      if (n.ident) g.classList.add("ident");
      const dia = (k) => `${n.x},${n.y - h / 2 + k} ${n.x + w / 2 - k * 1.6},${n.y} ${n.x},${n.y + h / 2 - k} ${n.x - w / 2 + k * 1.6},${n.y}`;
      g.append(el("polygon", { points: dia(0) }));
      if (n.ident) g.append(el("polygon", { class: "inner", points: dia(5) }));
    } else if (n.type === "attr") {
      if (n.multi) g.classList.add("multi");
      if (n.derived) g.classList.add("derived");
      g.append(el("ellipse", { cx: n.x, cy: n.y, rx: w / 2, ry: h / 2 }));
      if (n.multi) g.append(el("ellipse", { class: "inner", cx: n.x, cy: n.y, rx: w / 2 - 4, ry: h / 2 - 4 }));
    } else {
      g.append(el("circle", { cx: n.x, cy: n.y, r: 13 }));
    }
    g.append(el("text", { x: n.x, y: n.y + 0.5, class: n.key ? "key" : n.pkey ? "pkey" : null }, n.label));
    gNodes.append(g);
  }
  return svg;
}

/** <figure class="er"> with a diagram and a caption. */
export function erFigure(spec, caption, { small = false } = {}) {
  const fig = document.createElement("figure");
  fig.className = "er" + (small ? " small" : "");
  fig.append(drawER(spec));
  if (caption) {
    const c = document.createElement("figcaption");
    c.innerHTML = caption;
    fig.append(c);
  }
  return fig;
}

// ---------------------------------------------------------------- the diagrams used on the site
export const COMPANY_ER = {
  title: "COMPANY veritabanının ER şeması (Elmasri & Navathe, Figure 3.2)",
  width: 1000, height: 720,
  nodes: [
    { id: "EMP", type: "entity", x: 330, y: 330, label: "EMPLOYEE" },
    { id: "DEPT", type: "entity", x: 760, y: 190, label: "DEPARTMENT" },
    { id: "PROJ", type: "entity", x: 760, y: 530, label: "PROJECT" },
    { id: "DEP", type: "entity", x: 330, y: 650, label: "DEPENDENT", weak: true },
    { id: "MAN", type: "rel", x: 560, y: 92, label: "MANAGES" },
    { id: "WF", type: "rel", x: 560, y: 245, label: "WORKS_FOR" },
    { id: "CON", type: "rel", x: 760, y: 360, label: "CONTROLS" },
    { id: "WO", type: "rel", x: 560, y: 450, label: "WORKS_ON" },
    { id: "DOF", type: "rel", x: 330, y: 530, label: "DEPENDENTS_OF", ident: true },
    { id: "SUP", type: "rel", x: 120, y: 500, label: "SUPERVISION" },
    // EMPLOYEE attributes
    { id: "eName", type: "attr", x: 250, y: 200, label: "Name", of: "EMP" },
    { id: "eF", type: "attr", x: 120, y: 150, label: "Fname", of: "eName" },
    { id: "eM", type: "attr", x: 220, y: 120, label: "Minit", of: "eName" },
    { id: "eL", type: "attr", x: 320, y: 140, label: "Lname", of: "eName" },
    { id: "eSsn", type: "attr", x: 130, y: 260, label: "Ssn", key: true, of: "EMP" },
    { id: "eB", type: "attr", x: 110, y: 315, label: "Bdate", of: "EMP" },
    { id: "eA", type: "attr", x: 130, y: 370, label: "Address", of: "EMP" },
    { id: "eSal", type: "attr", x: 400, y: 215, label: "Salary", of: "EMP" },
    { id: "eSex", type: "attr", x: 230, y: 420, label: "Sex", of: "EMP" },
    // DEPARTMENT attributes
    { id: "dN", type: "attr", x: 920, y: 120, label: "Name", key: true, of: "DEPT" },
    { id: "dNo", type: "attr", x: 935, y: 175, label: "Number", key: true, of: "DEPT" },
    { id: "dLoc", type: "attr", x: 925, y: 235, label: "Locations", multi: true, of: "DEPT" },
    { id: "dNE", type: "attr", x: 790, y: 95, label: "Number_of_employees", derived: true, of: "DEPT" },
    { id: "mSD", type: "attr", x: 560, y: 28, label: "Start_date", of: "MAN" },
    // PROJECT attributes
    { id: "pN", type: "attr", x: 915, y: 480, label: "Name", key: true, of: "PROJ" },
    { id: "pNo", type: "attr", x: 930, y: 535, label: "Number", key: true, of: "PROJ" },
    { id: "pL", type: "attr", x: 910, y: 590, label: "Location", of: "PROJ" },
    { id: "wH", type: "attr", x: 560, y: 520, label: "Hours", of: "WO" },
    // DEPENDENT attributes
    { id: "nN", type: "attr", x: 170, y: 620, label: "Name", pkey: true, of: "DEP" },
    { id: "nS", type: "attr", x: 170, y: 680, label: "Sex", of: "DEP" },
    { id: "nB", type: "attr", x: 500, y: 690, label: "Birth_date", of: "DEP" },
    { id: "nR", type: "attr", x: 510, y: 630, label: "Relationship", of: "DEP" },
  ],
  links: [
    { a: "MAN", b: "EMP", card: "1" },
    { a: "MAN", b: "DEPT", card: "1", total: true },
    { a: "WF", b: "EMP", card: "N", total: true },
    { a: "WF", b: "DEPT", card: "1", total: true },
    { a: "CON", b: "DEPT", card: "1", cardSide: -10 },
    { a: "CON", b: "PROJ", card: "N", total: true, cardSide: -10 },
    { a: "WO", b: "EMP", card: "M", total: true },
    { a: "WO", b: "PROJ", card: "N", total: true },
    { a: "DOF", b: "EMP", card: "1", cardSide: -10 },
    { a: "DOF", b: "DEP", card: "N", total: true, cardSide: -10 },
    { a: "SUP", b: "EMP", via: [[120, 400], [270, 400]], card: "1", role: "supervisor", cardSide: -10, roleSide: 12 },
    { a: "SUP", b: "EMP", via: [[260, 500], [300, 450]], card: "N", role: "supervisee", cardSide: -10, roleSide: 12 },
  ],
};
