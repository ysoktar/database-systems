// From an ER model to a drawable diagram (nodes + links for erd.js), with an automatic layout.
// Positions: entities, relationships and the specialization / category circles are absolute ({x, y});
// attributes are stored as offsets from their owner ({dx, dy}), so they follow it when it is dragged.
const U = (s) => String(s).toUpperCase();

export const entityId = (n) => `E:${U(n)}`;
export const relId = (n) => `R:${U(n)}`;
export const specId = (i) => `S:${i}`;
export const catId = (n) => `U:${U(n)}`;
export const attrId = (owner, path) => `A:${owner}/${path}`;

/** Every node of the diagram with its kind and owner (without positions). */
export function diagramNodes(model) {
  const major = [], attrs = [];
  const walk = (ownerId, list, prefix, parentId) => {
    for (const a of list) {
      const path = prefix ? `${prefix}.${a.name}` : a.name;
      const id = attrId(ownerId, path);
      attrs.push({ id, attr: a, owner: parentId || ownerId, root: ownerId, path });
      if (a.comps) walk(ownerId, a.comps, path, id);
    }
  };
  for (const e of model.entities) { major.push({ id: entityId(e.name), kind: "entity", ref: e }); walk(entityId(e.name), e.attrs, "", null); }
  for (const r of model.relationships) { major.push({ id: relId(r.name), kind: "rel", ref: r }); walk(relId(r.name), r.attrs, "", null); }
  model.specializations.forEach((s, i) => { if (s.subs.length > 1 || s.on) major.push({ id: specId(i), kind: "spec", ref: s }); });
  for (const c of model.categories) major.push({ id: catId(c.name), kind: "cat", ref: c });
  return { major, attrs };
}

/** Pairs of major nodes that are connected (for the layout springs). */
function majorEdges(model) {
  const edges = [];
  for (const r of model.relationships) for (const e of r.ends) edges.push([relId(r.name), entityId(e.entity)]);
  model.specializations.forEach((s, i) => {
    if (s.subs.length > 1 || s.on) { edges.push([entityId(s.super), specId(i)]); for (const x of s.subs) edges.push([specId(i), entityId(x)]); }
    else for (const x of s.subs) edges.push([entityId(s.super), entityId(x)]);
  });
  for (const c of model.categories) { for (const s of c.supers) edges.push([entityId(s), catId(c.name)]); edges.push([catId(c.name), entityId(c.name)]); }
  return edges;
}

/** Force-directed layout of the major nodes, then attributes around their owners. Returns a fresh positions map. */
export function autoLayout(model, { seed = 1 } = {}) {
  const { major } = diagramNodes(model);
  const edges = majorEdges(model).filter(([a, b]) => a !== b);
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const P = new Map();
  const ents = major.filter((n) => n.kind === "entity");
  const cols = Math.max(1, Math.ceil(Math.sqrt(ents.length * 1.4)));
  ents.forEach((n, i) => P.set(n.id, { x: (i % cols) * 300 + rand() * 30, y: Math.floor(i / cols) * 240 + rand() * 30 }));
  const nbr = new Map(major.map((n) => [n.id, []]));
  for (const [a, b] of edges) { nbr.get(a)?.push(b); nbr.get(b)?.push(a); }
  for (const n of major.filter((x) => x.kind !== "entity")) {
    const ns = nbr.get(n.id).map((id) => P.get(id)).filter(Boolean);
    const m = ns.length ? { x: ns.reduce((s, p) => s + p.x, 0) / ns.length, y: ns.reduce((s, p) => s + p.y, 0) / ns.length } : { x: 0, y: 0 };
    P.set(n.id, { x: m.x + (rand() - 0.5) * 60, y: m.y + (rand() - 0.5) * 60 });
  }
  // attribute counts make nodes "bigger" (more repulsion)
  const weight = new Map(major.map((n) => [n.id, 1 + ((n.ref.attrs || []).length) * 0.35]));
  const ids = major.map((n) => n.id);
  const REST = 230;
  for (let it = 0, temp = 40; it < 500; it++, temp *= 0.992) {
    const F = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = P.get(ids[i]), b = P.get(ids[j]);
      let dx = a.x - b.x, dy = (a.y - b.y) * 1.25, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = rand() - 0.5; dy = rand() - 0.5; d2 = 1; }
      const f = (150000 * weight.get(ids[i]) * weight.get(ids[j])) / d2;
      const d = Math.sqrt(d2);
      F.get(ids[i]).x += (dx / d) * f; F.get(ids[i]).y += (dy / d) * f;
      F.get(ids[j]).x -= (dx / d) * f; F.get(ids[j]).y -= (dy / d) * f;
    }
    for (const [a, b] of edges) {
      const pa = P.get(a), pb = P.get(b);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - REST) * 0.06;
      F.get(a).x += (dx / d) * f * 10; F.get(a).y += (dy / d) * f * 10;
      F.get(b).x -= (dx / d) * f * 10; F.get(b).y -= (dy / d) * f * 10;
    }
    for (const id of ids) {
      const p = P.get(id), f = F.get(id);
      f.x -= p.x * 0.01; f.y -= p.y * 0.01;
      const len = Math.hypot(f.x, f.y) || 1;
      const step = Math.min(len, temp);
      p.x += (f.x / len) * step; p.y += (f.y / len) * step;
    }
  }
  const pos = {};
  for (const [id, p] of P) pos[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  placeAttributes(model, pos, { reset: true });
  return pos;
}

const labelW = (t) => [...String(t)].length * 6.9;
function nodeBox(kind, label, x, y) {
  if (kind === "entity") return { x, y, w: Math.max(84, labelW(label) + 26), h: 36 };
  if (kind === "rel") return { x, y, w: Math.max(80, labelW(label) + 44), h: 46 };
  if (kind === "attr") return { x, y, w: Math.max(46, labelW(label) + 22), h: 28 };
  return { x, y, w: 26, h: 26 };
}
const overlap = (a, b, m = 8) => Math.abs(a.x - b.x) * 2 < a.w + b.w + m && Math.abs(a.y - b.y) * 2 < a.h + b.h + m;
function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
function segHitsBox(p, q, b) {
  for (let t = 0.1; t < 1; t += 0.1) {
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
    if (Math.abs(x - b.x) * 2 < b.w && Math.abs(y - b.y) * 2 < b.h) return true;
  }
  return false;
}

/**
 * Give every attribute without an offset one. Candidate spots around the owner are scored: overlapping another
 * shape or crossing a relationship line costs a lot, being far away or close to the owner's own lines a little.
 */
export function placeAttributes(model, pos, { reset = false } = {}) {
  const { major, attrs } = diagramNodes(model);
  const edges = majorEdges(model);
  const label = new Map(major.map((n) => [n.id, n.kind === "entity" || n.kind === "rel" ? n.ref.name : "o"]));
  const kind = new Map(major.map((n) => [n.id, n.kind]));
  const occupied = [];
  for (const n of major) if (pos[n.id]) occupied.push(nodeBox(n.kind, label.get(n.id), pos[n.id].x, pos[n.id].y));
  const segs = edges.filter(([a, b]) => pos[a] && pos[b] && a !== b).map(([a, b]) => ({ a, b, p: pos[a], q: pos[b] }));
  // cardinality and role labels are drawn near the diamond end of each line (as erd.js does): keep attributes off them
  for (const r of model.relationships) {
    const rp = pos[relId(r.name)];
    if (!rp) continue;
    const rb = nodeBox("rel", r.name, 0, 0);
    for (const e of r.ends) {
      const q = pos[entityId(e.entity)];
      if (!q) continue;
      const dx = q.x - rp.x, dy = q.y - rp.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const edge = 1 / (Math.abs(ux) / (rb.w / 2) + Math.abs(uy) / (rb.h / 2));
      for (const [frac, cap, off, w] of [[0.3, 34, 9, 26], [0.6, 64, -10, e.role ? labelW(e.role) + 8 : 0]]) {
        if (!w) continue;
        const along = Math.min((len - edge) * frac, cap);
        occupied.push({ x: rp.x + ux * (edge + along) - uy * off, y: rp.y + uy * (edge + along) + ux * off, w, h: 16 });
      }
    }
  }
  const abs = new Map();
  for (const n of major) if (pos[n.id]) abs.set(n.id, pos[n.id]);
  const absOf = (a) => {
    if (abs.has(a.id)) return abs.get(a.id);
    const base = a.owner.startsWith("A:") ? absOf(attrs.find((x) => x.id === a.owner)) : abs.get(a.owner);
    if (!base || !pos[a.id] || pos[a.id].dx === undefined) return null;
    const p = { x: base.x + pos[a.id].dx, y: base.y + pos[a.id].dy };
    abs.set(a.id, p);
    return p;
  };
  if (!reset) for (const a of attrs) { const p = absOf(a); if (p) occupied.push(nodeBox("attr", a.attr.name, p.x, p.y)); }
  for (const a of attrs) {
    if (!reset && pos[a.id] && pos[a.id].dx !== undefined) continue;
    const isComp = a.owner.startsWith("A:");
    const o = isComp ? absOf(attrs.find((x) => x.id === a.owner)) : abs.get(a.owner);
    if (!o) continue;
    const ownSegs = isComp ? [] : segs.filter((sg) => sg.a === a.owner || sg.b === a.owner);
    const linkAngles = ownSegs.map((sg) => { const other = sg.a === a.owner ? sg.q : sg.p; return Math.atan2(other.y - o.y, other.x - o.x); });
    let outward = null;
    if (isComp) { const ownerAttr = attrs.find((x) => x.id === a.owner); const oo = ownerAttr.owner.startsWith("A:") ? null : abs.get(ownerAttr.owner); if (oo) outward = Math.atan2(o.y - oo.y, o.x - oo.x); }
    const ownerBoxW = isComp ? nodeBox("attr", "", 0, 0).w : nodeBox(kind.get(a.owner), label.get(a.owner), 0, 0).w;
    const radii = isComp ? [58, 72, 88, 106] : [70, 84, 100, 118, 140, 165, 195];
    let best = null, bestScore = Infinity;
    for (const r of radii) for (let k = 0; k < 36; k++) {
      const ang = (k * Math.PI) / 18;
      const x = o.x + Math.cos(ang) * (r + ownerBoxW * 0.35), y = o.y + Math.sin(ang) * r * 0.78;
      const box = nodeBox("attr", a.attr.name, x, y);
      let score = r;
      for (const b of occupied) if (overlap(box, b)) score += 1000;
      for (const sg of segs) {
        if (sg.a === a.owner || sg.b === a.owner) continue;
        if (segCross(o, { x, y }, sg.p, sg.q)) score += 220;
        if (segHitsBox(sg.p, sg.q, box)) score += 600;
      }
      for (const la of linkAngles) { const dd = Math.abs(((ang - la + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); if (dd < 0.45) score += (0.45 - dd) * 500; }
      if (outward !== null) { const dd = Math.abs(((ang - outward + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); score += dd * 60; }
      if (score < bestScore) { bestScore = score; best = { x, y, box }; }
    }
    pos[a.id] = { dx: Math.round(best.x - o.x), dy: Math.round(best.y - o.y) };
    abs.set(a.id, { x: best.x, y: best.y });
    occupied.push(best.box);
  }
  return pos;
}

/** Fill in positions for nodes that have none (new elements), keeping the others where the user put them. */
export function completePositions(model, pos) {
  const { major } = diagramNodes(model);
  const edges = majorEdges(model);
  const known = Object.values(pos).filter((p) => p.x !== undefined);
  const maxX = known.length ? Math.max(...known.map((p) => p.x)) : 0;
  const minY = known.length ? Math.min(...known.map((p) => p.y)) : 0;
  let extra = 0;
  for (const n of major) {
    if (pos[n.id]) continue;
    const ns = edges.filter(([a, b]) => a === n.id || b === n.id).map(([a, b]) => pos[a === n.id ? b : a]).filter((p) => p && p.x !== undefined);
    if (ns.length >= 2 || (ns.length === 1 && n.kind !== "entity")) {
      const x = ns.reduce((s, p) => s + p.x, 0) / ns.length, y = ns.reduce((s, p) => s + p.y, 0) / ns.length;
      pos[n.id] = { x: Math.round(x + (ns.length === 1 ? 160 : 0)), y: Math.round(y + (ns.length === 1 ? 0 : 0)) };
    } else if (ns.length === 1) pos[n.id] = { x: ns[0].x + 260, y: ns[0].y + 60 };
    else pos[n.id] = { x: maxX + 280, y: minY + (extra++) * 200 };
  }
  placeAttributes(model, pos);
  return pos;
}

/** Positions after renaming an element: keys that start with the old id move to the new id. */
export function renamePositions(pos, oldId, newId) {
  const out = {};
  for (const [k, v] of Object.entries(pos)) {
    if (k === oldId) out[newId] = v;
    else if (k.startsWith(`A:${oldId}/`)) out[`A:${newId}/${k.slice(oldId.length + 3)}`] = v;
    else out[k] = v;
  }
  return out;
}

/**
 * Build the erd.js spec. notation: "ratio" (1/N/M + double lines) or "minmax" ((min,max) next to each entity).
 * Returns { width, height, nodes, links, offset } where offset is what was added to model coordinates.
 */
export function toDiagram(model, pos, { notation = "ratio", selected = null, pad = 70, normalize = true } = {}) {
  const { major, attrs } = diagramNodes(model);
  const abs = new Map();
  for (const n of major) if (pos[n.id]) abs.set(n.id, { x: pos[n.id].x, y: pos[n.id].y });
  const absAttr = (a) => {
    if (abs.has(a.id)) return abs.get(a.id);
    const base = a.owner.startsWith("A:") ? absAttr(attrs.find((x) => x.id === a.owner)) : abs.get(a.owner);
    const o = pos[a.id] || { dx: 0, dy: -60 };
    const p = { x: (base?.x || 0) + o.dx, y: (base?.y || 0) + o.dy };
    abs.set(a.id, p);
    return p;
  };
  attrs.forEach(absAttr);
  const xs = [...abs.values()].map((p) => p.x), ys = [...abs.values()].map((p) => p.y);
  const minX = Math.min(...xs) - pad - 40, minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad + 40, maxY = Math.max(...ys) + pad;
  const ox = normalize ? minX : 0, oy = normalize ? minY : 0;
  const at = (id) => ({ x: abs.get(id).x - ox, y: abs.get(id).y - oy });
  const nodes = [], links = [];
  for (const n of major) {
    const p = at(n.id);
    if (n.kind === "entity") nodes.push({ id: n.id, type: "entity", ...p, label: n.ref.name, weak: n.ref.weak });
    else if (n.kind === "rel") nodes.push({ id: n.id, type: "rel", ...p, label: n.ref.name, ident: n.ref.identifying });
    else if (n.kind === "spec") nodes.push({ id: n.id, type: "isa", ...p, label: n.ref.disjoint ? "d" : "o" });
    else nodes.push({ id: n.id, type: "isa", ...p, label: "∪" });
  }
  for (const a of attrs) {
    const p = at(a.id);
    nodes.push({ id: a.id, type: "attr", ...p, label: a.attr.name, key: a.attr.key, pkey: a.attr.partial, multi: a.attr.multi, derived: a.attr.derived, of: a.owner });
  }
  for (const r of model.relationships) {
    const counts = new Map();
    r.ends.forEach((e) => counts.set(U(e.entity), (counts.get(U(e.entity)) || 0) + 1));
    const seen = new Map();
    for (const e of r.ends) {
      const eid = entityId(e.entity);
      if (!abs.has(eid)) continue;
      const k = seen.get(eid) || 0;
      seen.set(eid, k + 1);
      const link = { a: relId(r.name), b: eid, total: notation === "ratio" && e.total, role: e.role || null };
      const mm = e.minmax || e.derivedMinmax;
      link.card = notation === "minmax" && mm ? `(${mm[0]},${mm[1]})` : e.card;
      if (notation === "minmax" && mm) link.cardAtEntity = true;
      if (counts.get(U(e.entity)) > 1) {
        // recursive relationship: bend the second line so the two do not overlap
        const pr = at(relId(r.name)), pe = at(eid);
        const mx = (pr.x + pe.x) / 2, my = (pr.y + pe.y) / 2;
        const nx = -(pe.y - pr.y), ny = pe.x - pr.x, len = Math.hypot(nx, ny) || 1;
        const off = (k === 0 ? -1 : 1) * 45;
        link.via = [[mx + (nx / len) * off, my + (ny / len) * off]];
      }
      links.push(link);
    }
  }
  model.specializations.forEach((s, i) => {
    const sup = entityId(s.super);
    if (!abs.has(sup)) return;
    if (s.subs.length > 1 || s.on) {
      links.push({ a: sup, b: specId(i), total: s.total, role: s.on || null, roleSide: 12 });
      for (const x of s.subs) if (abs.has(entityId(x))) links.push({ a: specId(i), b: entityId(x), subset: true });
    } else for (const x of s.subs) if (abs.has(entityId(x))) links.push({ a: sup, b: entityId(x), subset: true });
  });
  for (const c of model.categories) {
    for (const s of c.supers) if (abs.has(entityId(s))) links.push({ a: entityId(s), b: catId(c.name) });
    if (abs.has(entityId(c.name))) links.push({ a: catId(c.name), b: entityId(c.name), subset: true, total: c.total });
  }
  const empty = !xs.length;
  return { width: empty ? 600 : Math.round(maxX - minX), height: empty ? 300 : Math.round(maxY - minY), nodes, links, offset: { x: -ox, y: -oy },
    bounds: empty ? { x: 0, y: 0, w: 600, h: 300 } : { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, selected };
}
