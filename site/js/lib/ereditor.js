// The interactive ER / EER editor: drag elements, edit them in a side panel, add new ones from the toolbar,
// or type the schema as text; both views stay in sync. Undo/redo, auto layout, 1:N ↔ (min,max) notation,
// SVG/PNG export and share links.
import { h, $, $$, button } from "./ui.js";
import { drawER } from "./erd.js";
import { parseER, toDSL, cloneModel, findEntity, normalizeEnds, emptyModel } from "./ermodel.js";
import { autoLayout, completePositions, toDiagram, entityId, relId, catId, attrId, diagramNodes } from "./erlayout.js";

const NS = "http://www.w3.org/2000/svg";
const U = (s) => String(s).toUpperCase();
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const newAttr = (name) => ({ name, key: false, partial: false, multi: false, derived: false, comps: null });

export function b64encode(s) { return btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function b64decode(s) { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))); }

/**
 * createEditor(host, { dsl, storageKey, onChange(model) }) → api
 * api: getModel(), getDSL(), setDSL(text, {layout}), setModel(model, {layout}), relayout(), fit()
 */
export function createEditor(host, opts = {}) {
  let model = emptyModel();
  let pos = {};
  let notation = "ratio";
  let selected = null;
  let view = { x: 0, y: 0, w: 900, h: 500 };
  const history = [];
  let hIndex = -1;

  // ---------------------------------------------------------------- DOM
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "ER diyagramı editörü");
  svg.setAttribute("tabindex", "0");
  const fig = h("div", { class: "er er-canvas" }, svg,
    h("div", { class: "zoom" }, button("+", () => zoom(0.8)), button("−", () => zoom(1.25)), button("Sığdır", () => fit())),
    h("div", { class: "canvas-hint" }, "Sürükle: taşı · boş alanı sürükle: kaydır · Ctrl + tekerlek: yakınlaştır · Del: sil"));
  fig.style.margin = "0";
  const panel = h("div", { class: "er-panel", "aria-live": "polite" });
  const dsl = h("textarea", { spellcheck: "false", rows: 16, style: { width: "100%", fontFamily: "var(--mono)", fontSize: "0.82rem", lineHeight: "1.5" }, "aria-label": "ER şeması metin olarak" });
  const msgs = h("ul", { class: "dsl-msgs" });

  const notationSel = h("select", { "aria-label": "Gösterim" }, h("option", { value: "ratio" }, "Gösterim: 1 / N + çift çizgi"), h("option", { value: "minmax" }, "Gösterim: (min, max)"));
  notationSel.addEventListener("change", () => { notation = notationSel.value; render(); save(); });
  const undoBtn = button("↶ Geri al", () => undo(), { title: "Geri al (Ctrl+Z)" });
  const redoBtn = button("↷ Yinele", () => redo(), { title: "Yinele (Ctrl+Y)" });
  const toolbar = h("div", { class: "er-toolbar" },
    button("+ Entity", () => addEntity(false), { kind: "primary" }),
    button("+ Weak entity", () => addEntity(true)),
    button("+ Relationship", () => addRelationship()),
    button("+ Attribute", () => addAttribute()),
    button("+ Specialization", () => addSpecialization()),
    button("+ Category", () => addCategory()),
    h("span", { class: "sep" }),
    button("Sil", () => removeSelected(), { title: "Seçili öğeyi sil (Delete)" }),
    undoBtn, redoBtn,
    button("Otomatik yerleşim", () => { pos = autoLayout(model); commit({ layoutOnly: true }); fit(); }),
    notationSel,
    h("span", { class: "sep" }),
    button("SVG", () => exportSVG()), button("PNG", () => exportPNG()), button("Bağlantı", () => share(), { title: "Bu diyagramın paylaşılabilir bağlantısını kopyala" }));

  host.append(toolbar, h("div", { class: "er-studio" }, fig, panel),
    h("h3", {}, "Metin olarak"),
    h("p", { class: "small muted", html: "Diyagram ile bu metin aynı şeydir: birini değiştirince diğeri güncellenir. Sözdizimi için aşağıdaki <a href=\"#syntax\">kısa kılavuz</a>." }),
    h("div", { class: "dsl-wrap" }, dsl, h("div", {}, msgs)));

  // ---------------------------------------------------------------- state changes
  function snapshot() { return JSON.stringify({ dsl: toDSL(model), pos }); }
  function pushHistory() {
    const s = snapshot();
    if (history[hIndex] === s) return;
    history.splice(hIndex + 1);
    history.push(s);
    if (history.length > 100) history.shift();
    hIndex = history.length - 1;
    undoBtn.disabled = hIndex <= 0;
    redoBtn.disabled = true;
  }
  function restore(s) {
    const o = JSON.parse(s);
    model = parseER(o.dsl).model;
    pos = o.pos;
    selected = null;
    render(); syncText(); showMsgs(parseER(o.dsl)); save(); opts.onChange?.(model);
    undoBtn.disabled = hIndex <= 0;
    redoBtn.disabled = hIndex >= history.length - 1;
  }
  function undo() { if (hIndex > 0) restore(history[--hIndex]); }
  function redo() { if (hIndex < history.length - 1) restore(history[++hIndex]); }
  function save() { if (opts.storageKey) store.set(opts.storageKey, { dsl: toDSL(model), pos, notation }); }

  /** after any edit of the model through the GUI */
  function commit({ layoutOnly = false } = {}) {
    for (const r of model.relationships) normalizeEnds(r);
    if (!layoutOnly) {
      // re-parse the canonical text so that implicit entities, warnings and derived (min,max) are consistent
      const res = parseER(toDSL(model));
      model = res.model;
      showMsgs(res);
    }
    completePositions(model, pos);
    render();
    syncText();
    pushHistory();
    save();
    opts.onChange?.(model);
  }
  function syncText() { if (document.activeElement !== dsl) dsl.value = toDSL(model); }
  function showMsgs(res) {
    msgs.replaceChildren(
      ...res.errors.map((e) => h("li", { class: "e" }, `Satır ${e.line}: ${e.msg}`)),
      ...res.warnings.map((w) => h("li", { class: "w" }, `Satır ${w.line}: ${w.msg}`)));
    if (!res.errors.length && !res.warnings.length) msgs.append(h("li", { class: "muted" }, "Hata yok. (Uyarılar da burada görünür: anahtarı olmayan varlık, partial key'i olmayan zayıf varlık, …)"));
  }

  let textTimer = 0;
  dsl.addEventListener("input", () => {
    clearTimeout(textTimer);
    textTimer = setTimeout(() => {
      const res = parseER(dsl.value);
      showMsgs(res);
      if (res.errors.length) return; // keep the last valid diagram
      model = res.model;
      completePositions(model, pos);
      if (selected && !nodeExists(selected)) selected = null;
      render();
      pushHistory();
      save();
      opts.onChange?.(model);
    }, 350);
  });
  dsl.addEventListener("blur", () => { if (!parseER(dsl.value).errors.length) dsl.value = toDSL(model); });

  // ---------------------------------------------------------------- drawing
  function nodeExists(id) { const { major, attrs } = diagramNodes(model); return major.some((n) => n.id === id) || attrs.some((a) => a.id === id); }
  function render() {
    const spec = toDiagram(model, pos, { notation, selected, normalize: false, pad: 24 });
    const drawn = drawER(spec);
    svg.replaceChildren(...drawn.childNodes);
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    lastBounds = spec.bounds;
    if (!model.entities.length) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", view.x + view.w / 2); t.setAttribute("y", view.y + view.h / 2);
      t.setAttribute("style", "fill:var(--muted);text-anchor:middle;font-size:14px");
      t.textContent = "Boş diyagram: + Entity ile başlayın ya da bir örnek yükleyin.";
      svg.append(t);
    }
    renderPanel();
  }
  let lastBounds = null;
  function fit() {
    const b = lastBounds || toDiagram(model, pos, { normalize: false }).bounds;
    const r = svg.getBoundingClientRect();
    const aspect = r.width && r.height ? r.width / r.height : 16 / 9;
    let w = b.w, hh = b.h;
    if (w / hh > aspect) hh = w / aspect; else w = hh * aspect;
    view = { x: b.x - (w - b.w) / 2, y: b.y - (hh - b.h) / 2, w, h: hh };
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  }
  function zoom(f, cx, cy) {
    cx ??= view.x + view.w / 2; cy ??= view.y + view.h / 2;
    view = { x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f, w: view.w * f, h: view.h * f };
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  }
  const toSvg = (e) => {
    const r = svg.getBoundingClientRect();
    // viewBox with preserveAspectRatio xMidYMid meet
    const s = Math.max(view.w / r.width, view.h / r.height);
    const ox = view.x - (r.width * s - view.w) / 2, oy = view.y - (r.height * s - view.h) / 2;
    return { x: ox + (e.clientX - r.left) * s, y: oy + (e.clientY - r.top) * s, s };
  };

  // ---------------------------------------------------------------- pointer interaction
  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    svg.focus({ preventScroll: true });
    const g = e.target.closest("g[data-id]");
    const p = toSvg(e);
    if (g) {
      const id = g.dataset.id;
      select(id);
      const isAttr = id.startsWith("A:");
      const start = pos[id] ? { ...pos[id] } : isAttr ? { dx: 0, dy: 0 } : { x: p.x, y: p.y };
      drag = { kind: "node", id, isAttr, p0: p, start, moved: false };
    } else {
      select(null);
      drag = { kind: "pan", p0: { x: e.clientX, y: e.clientY }, v0: { ...view }, s: p.s, moved: false };
    }
    svg.setPointerCapture(e.pointerId);
    svg.classList.add("dragging");
  });
  let raf = 0;
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.kind === "pan") {
      const dx = (e.clientX - drag.p0.x) * drag.s, dy = (e.clientY - drag.p0.y) * drag.s;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      view = { ...drag.v0, x: drag.v0.x - dx, y: drag.v0.y - dy };
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
      return;
    }
    const p = toSvg(e);
    const dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved) return;
    pos[drag.id] = drag.isAttr ? { dx: Math.round(drag.start.dx + dx), dy: Math.round(drag.start.dy + dy) } : { x: Math.round(drag.start.x + dx), y: Math.round(drag.start.y + dy) };
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; const keep = view; render(); view = keep; });
  });
  const end = () => {
    if (drag?.kind === "node" && drag.moved) { pushHistory(); save(); }
    drag = null;
    svg.classList.remove("dragging");
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const p = toSvg(e);
    zoom(e.deltaY > 0 ? 1.12 : 0.89, p.x, p.y);
  }, { passive: false });
  svg.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
  });
  host.addEventListener("keydown", (e) => {
    if (e.target === dsl || e.target.matches("input, select")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  });

  function select(id) {
    selected = id;
    const keep = view;
    render();
    view = keep;
  }

  // ---------------------------------------------------------------- what is selected
  function resolve(id) {
    if (!id) return null;
    if (id.startsWith("E:")) { const e = findEntity(model, id.slice(2)); return e && { kind: "entity", obj: e }; }
    if (id.startsWith("R:")) { const r = model.relationships.find((x) => U(x.name) === id.slice(2)); return r && { kind: "rel", obj: r }; }
    if (id.startsWith("S:")) { const s = model.specializations[Number(id.slice(2))]; return s && { kind: "spec", obj: s }; }
    if (id.startsWith("U:")) { const c = model.categories.find((x) => U(x.name) === id.slice(2)); return c && { kind: "cat", obj: c }; }
    if (id.startsWith("A:")) {
      const [owner, path] = id.slice(2).split(/\/(.*)/s);
      const o = resolve(owner);
      if (!o) return null;
      let list = o.obj.attrs, attr = null;
      for (const part of path.split(".")) { attr = list.find((a) => a.name === part); list = attr?.comps || []; }
      return attr && { kind: "attr", obj: attr, owner: o };
    }
    return null;
  }
  const uniqueName = (base, taken) => { let i = 1; while (taken.has(U(`${base}${i}`))) i++; return `${base}${i}`; };
  const entityNames = () => new Set(model.entities.map((e) => U(e.name)));
  const viewCenter = () => ({ x: Math.round(view.x + view.w / 2), y: Math.round(view.y + view.h / 2) });
  const selectedEntity = () => { const r = resolve(selected); return r?.kind === "entity" ? r.obj : r?.kind === "attr" && r.owner.kind === "entity" ? r.owner.obj : null; };

  // ---------------------------------------------------------------- toolbar actions
  function addEntity(weak) {
    const name = uniqueName(weak ? "WEAK" : "ENTITY", entityNames());
    const e = { name, weak, attrs: [{ ...newAttr(weak ? "Partial_key" : "Id"), key: !weak, partial: weak }], line: 0 };
    model.entities.push(e);
    pos[entityId(name)] = viewCenter();
    selected = entityId(name);
    commit();
  }
  function addRelationship() {
    if (model.entities.length < 1) { alert("Önce en az bir entity ekleyin."); return; }
    const first = selectedEntity() || model.entities[0];
    const second = model.entities.find((e) => e !== first) || first;
    const name = uniqueName("REL", new Set(model.relationships.map((r) => U(r.name))));
    const recursive = first === second;
    model.relationships.push({ name, identifying: false, attrs: [], line: 0, ends: [
      { entity: first.name, card: "1", total: false, role: recursive ? "r1" : null, minmax: null },
      { entity: second.name, card: "N", total: false, role: recursive ? "r2" : null, minmax: null }] });
    const p1 = pos[entityId(first.name)], p2 = pos[entityId(second.name)];
    if (p1 && p2) pos[relId(name)] = { x: Math.round((p1.x + p2.x) / 2), y: Math.round((p1.y + p2.y) / 2) + (recursive ? 120 : 0) };
    selected = relId(name);
    commit();
  }
  function addAttribute() {
    const r = resolve(selected);
    const target = r?.kind === "attr" ? r.owner : r;
    if (!target || (target.kind !== "entity" && target.kind !== "rel")) { alert("Önce bir entity ya da relationship seçin."); return; }
    const name = uniqueName("Attr", new Set(target.obj.attrs.map((a) => U(a.name))));
    target.obj.attrs.push(newAttr(name));
    commit();
  }
  function addSpecialization() {
    const sup = selectedEntity();
    if (!sup) { alert("Önce üst sınıf olacak entity'yi seçin."); return; }
    const taken = entityNames();
    const a = uniqueName(`${U(sup.name)}_SUB`, taken); taken.add(U(a));
    const b = uniqueName(`${U(sup.name)}_SUB`, taken);
    const p = pos[entityId(sup.name)] || viewCenter();
    model.entities.push({ name: a, weak: false, attrs: [], line: 0 }, { name: b, weak: false, attrs: [], line: 0 });
    model.specializations.push({ super: sup.name, subs: [a, b], disjoint: true, total: false, on: null, line: 0 });
    pos[`S:${model.specializations.length - 1}`] = { x: p.x, y: p.y + 130 };
    pos[entityId(a)] = { x: p.x - 130, y: p.y + 240 };
    pos[entityId(b)] = { x: p.x + 130, y: p.y + 240 };
    selected = `S:${model.specializations.length - 1}`;
    commit();
  }
  function addCategory() {
    const regular = model.entities.filter((e) => !e.weak);
    if (regular.length < 2) { alert("Bir kategori için en az iki entity gerekli."); return; }
    const first = selectedEntity() || regular[0];
    const second = regular.find((e) => e !== first);
    const name = uniqueName("CATEGORY", entityNames());
    model.entities.push({ name, weak: false, attrs: [], line: 0 });
    model.categories.push({ name, supers: [first.name, second.name], total: false, line: 0 });
    const p1 = pos[entityId(first.name)] || viewCenter(), p2 = pos[entityId(second.name)] || viewCenter();
    const mx = Math.round((p1.x + p2.x) / 2), my = Math.round(Math.max(p1.y, p2.y));
    pos[catId(name)] = { x: mx, y: my + 110 };
    pos[entityId(name)] = { x: mx, y: my + 200 };
    selected = catId(name);
    commit();
  }
  function removeSelected() {
    const r = resolve(selected);
    if (!r) return;
    if (r.kind === "entity") {
      const n = U(r.obj.name);
      model.entities = model.entities.filter((e) => e !== r.obj);
      for (const rel of model.relationships) rel.ends = rel.ends.filter((e) => U(e.entity) !== n);
      model.relationships = model.relationships.filter((rel) => rel.ends.length >= 2);
      for (const s of model.specializations) s.subs = s.subs.filter((x) => U(x) !== n);
      model.specializations = model.specializations.filter((s) => U(s.super) !== n && s.subs.length);
      for (const c of model.categories) c.supers = c.supers.filter((x) => U(x) !== n);
      model.categories = model.categories.filter((c) => U(c.name) !== n && c.supers.length);
    } else if (r.kind === "rel") model.relationships = model.relationships.filter((x) => x !== r.obj);
    else if (r.kind === "spec") { model.specializations = model.specializations.filter((x) => x !== r.obj); reindexSpecs(); }
    else if (r.kind === "cat") model.categories = model.categories.filter((x) => x !== r.obj);
    else if (r.kind === "attr") {
      const strip = (list) => list.filter((a) => a !== r.obj).map((a) => (a.comps ? { ...a, comps: strip(a.comps) } : a));
      r.owner.obj.attrs = strip(r.owner.obj.attrs);
    }
    selected = null;
    commit();
  }
  function reindexSpecs() { for (const k of Object.keys(pos)) if (k.startsWith("S:")) delete pos[k]; }

  // renaming keeps positions: every key under the old id moves to the new one
  function rekey(oldId, newId) {
    const out = {};
    for (const [k, v] of Object.entries(pos)) {
      if (k === oldId) out[newId] = v;
      else if (k.startsWith(`A:${oldId}/`)) out[`A:${newId}/${k.slice(oldId.length + 3)}`] = v;
      else if (k.startsWith(`${oldId}.`)) out[`${newId}.${k.slice(oldId.length + 1)}`] = v;
      else out[k] = v;
    }
    pos = out;
    if (selected === oldId) selected = newId;
  }
  function renameEntity(e, name) {
    name = name.trim().replace(/\s+/g, "_");
    if (!/^[A-Za-z_]\w*$/.test(name) || (U(name) !== U(e.name) && findEntity(model, name))) return false;
    const old = e.name;
    rekey(entityId(old), entityId(name));
    if (model.categories.some((c) => U(c.name) === U(old))) rekey(catId(old), catId(name));
    for (const r of model.relationships) for (const end of r.ends) if (U(end.entity) === U(old)) end.entity = name;
    for (const s of model.specializations) { if (U(s.super) === U(old)) s.super = name; s.subs = s.subs.map((x) => (U(x) === U(old) ? name : x)); }
    for (const c of model.categories) { if (U(c.name) === U(old)) c.name = name; c.supers = c.supers.map((x) => (U(x) === U(old) ? name : x)); }
    e.name = name;
    return true;
  }

  // ---------------------------------------------------------------- side panel
  const field = (label, input) => h("label", {}, h("span", { style: { minWidth: "70px" } }, label), input);
  const text = (value, onChange) => {
    const i = h("input", { type: "text", value });
    i.addEventListener("change", () => onChange(i.value));
    return i;
  };
  const check = (label, value, onChange) => {
    const i = h("input", { type: "checkbox" });
    i.checked = !!value;
    i.addEventListener("change", () => onChange(i.checked));
    return h("label", {}, i, label);
  };
  const entSelect = (value, onChange, { allowNone = false } = {}) => {
    const s = h("select", {}, allowNone ? h("option", { value: "" }, "—") : null, ...model.entities.map((e) => h("option", { value: e.name }, e.name)));
    s.value = value || "";
    s.addEventListener("change", () => onChange(s.value));
    return s;
  };

  function attrRows(owner, focusAttr) {
    const box = h("div");
    const row = (a, list, depth) => {
      const name = text(a.name, (v) => {
        v = v.trim().replace(/\s+/g, "_");
        if (!/^[A-Za-z_]\w*$/.test(v)) { alert("Geçersiz ad"); renderPanel(); return; }
        const oid = owner.kind === "entity" ? entityId(owner.obj.name) : relId(owner.obj.name);
        const path = pathOf(owner.obj.attrs, a);
        const newPath = path.split(".").slice(0, -1).concat(v).join(".");
        rekey(attrId(oid, path), attrId(oid, newPath));
        a.name = v; commit();
      });
      if (a === focusAttr) setTimeout(() => name.focus(), 0);
      const flags = h("div", { class: "flags" },
        check("key", a.key, (v) => { a.key = v; if (v) a.partial = false; commit(); }),
        owner.kind === "entity" && owner.obj.weak ? check("partial", a.partial, (v) => { a.partial = v; if (v) a.key = false; commit(); }) : null,
        check("multi", a.multi, (v) => { a.multi = v; commit(); }),
        check("derived", a.derived, (v) => { a.derived = v; commit(); }),
        button("+ bileşen", () => { a.comps = a.comps || []; a.comps.push(newAttr(uniqueName("Part", new Set(a.comps.map((c) => U(c.name)))))); commit(); }, { title: "Bileşik öznitelik yap: bir bileşen ekle" }),
        button("×", () => { list.splice(list.indexOf(a), 1); if (depth && !list.length) delete a.comps; commit(); }, { title: "Özniteliği sil" }));
      box.append(h("div", { class: "row", style: { marginLeft: `${depth * 14}px`, background: a === focusAttr ? "var(--accent-wash)" : null } }, name, flags));
      for (const c of a.comps || []) row(c, a.comps, depth + 1);
    };
    for (const a of owner.obj.attrs) row(a, owner.obj.attrs, 0);
    box.append(h("div", { class: "row" }, button("+ öznitelik", () => { owner.obj.attrs.push(newAttr(uniqueName("Attr", new Set(owner.obj.attrs.map((x) => U(x.name)))))); commit(); })));
    return box;
  }
  function pathOf(list, target, prefix = "") {
    for (const a of list) {
      const p = prefix ? `${prefix}.${a.name}` : a.name;
      if (a === target) return p;
      if (a.comps) { const q = pathOf(a.comps, target, p); if (q) return q; }
    }
    return null;
  }

  function renderPanel() {
    let r = resolve(selected);
    let focusAttr = null;
    if (r?.kind === "attr") { focusAttr = r.obj; r = r.owner; }
    if (!r) {
      panel.replaceChildren(h("h4", {}, "Seçili öğe yok"),
        h("p", { class: "muted" }, "Diyagramda bir öğeye tıklayın: adını, özniteliklerini, kardinalitesini ve katılımını buradan değiştirebilirsiniz."),
        h("p", { class: "muted", html: `<strong>${model.entities.length}</strong> entity, <strong>${model.relationships.length}</strong> relationship, <strong>${model.specializations.length}</strong> specialization, <strong>${model.categories.length}</strong> category.` }));
      return;
    }
    const o = r.obj;
    const kids = [];
    if (r.kind === "entity") {
      kids.push(h("h4", {}, o.weak ? "Weak entity" : "Entity"),
        field("Ad", text(o.name, (v) => { if (!renameEntity(o, v)) alert("Geçersiz ya da kullanılan bir ad."); commit(); })),
        check("Weak entity (kendi anahtarı yok)", o.weak, (v) => { o.weak = v; for (const a of o.attrs) { if (v && a.key) { a.key = false; a.partial = true; } if (!v && a.partial) { a.partial = false; a.key = true; } } commit(); }),
        h("div", { class: "muted", style: { marginTop: "8px" } }, "Öznitelikler"), attrRows(r, focusAttr));
      const rels = model.relationships.filter((x) => x.ends.some((e) => U(e.entity) === U(o.name)));
      if (rels.length) kids.push(h("p", { class: "muted" }, "İlişkileri: ", ...rels.flatMap((x, i) => [i ? ", " : "", h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); select(relId(x.name)); } }, x.name)])));
    } else if (r.kind === "rel") {
      kids.push(h("h4", {}, o.identifying ? "Identifying relationship" : "Relationship"),
        field("Ad", text(o.name, (v) => {
          v = v.trim().replace(/\s+/g, "_");
          if (!/^[A-Za-z_]\w*$/.test(v) || model.relationships.some((x) => x !== o && U(x.name) === U(v))) { alert("Geçersiz ya da kullanılan bir ad."); renderPanel(); return; }
          rekey(relId(o.name), relId(v)); o.name = v; commit();
        })),
        check("Identifying (zayıf varlığın tanımlayıcı ilişkisi)", o.identifying, (v) => { o.identifying = v; commit(); }),
        h("div", { class: "muted", style: { marginTop: "8px" } }, notation === "minmax" ? "Uçlar: (min,max) bu varlığın katılımıdır" : "Uçlar: kardinalite etiketi, çift çizgi = total"));
      for (const [i, e] of o.ends.entries()) {
        const card = h("select", { "aria-label": "Kardinalite" }, ...["1", "N", "M"].map((c) => h("option", { value: c }, c)));
        card.value = e.card === "1" ? "1" : e.card === "M" ? "M" : "N";
        card.addEventListener("change", () => { e.card = card.value; e.minmax = null; commit(); });
        const mmBox = h("input", { type: "text", value: e.minmax ? `${e.minmax[0]},${e.minmax[1]}` : "", placeholder: "min,max", style: { width: "70px", flex: "0 0 70px" }, title: "İsteğe bağlı (min,max), ör. 0,N ya da 1,1" });
        mmBox.addEventListener("change", () => {
          const m = mmBox.value.replace(/[()\s]/g, "").match(/^(\d+),(\d+|[Nn*])$/);
          if (!mmBox.value.trim()) e.minmax = null;
          else if (m) e.minmax = [Number(m[1]), /^\d+$/.test(m[2]) ? Number(m[2]) : "N"];
          else { alert("Biçim: min,max (ör. 0,N)"); return; }
          commit();
        });
        kids.push(h("div", { class: "row" },
          entSelect(e.entity, (v) => { e.entity = v; commit(); }),
          card,
          check("total", e.total, (v) => { e.total = v; if (e.minmax) e.minmax[0] = v ? Math.max(1, e.minmax[0]) : 0; commit(); }),
          mmBox,
          text(e.role || "", (v) => { e.role = v.trim() || null; commit(); }),
          o.ends.length > 2 ? button("×", () => { o.ends.splice(i, 1); commit(); }) : null));
        const roleInput = kids[kids.length - 1].querySelectorAll("input[type=text]")[1];
        roleInput.placeholder = "rol adı";
        roleInput.style.flex = "1 1 80px";
      }
      kids.push(h("div", { class: "row" }, button("+ uç (n-ary)", () => { o.ends.push({ entity: model.entities[0].name, card: "N", total: false, role: null, minmax: null }); commit(); })));
      const ratio = o.ends.length === 2 ? `${o.ends[0].card === "1" ? "1" : "N"}:${o.ends[1].card === "1" ? "1" : "N"}`.replace("N:N", "M:N") : `${o.ends.length}-ary`;
      kids.push(h("p", { class: "muted" }, `Oran: ${o.ends.map((e) => e.entity).join(" : ")} = ${ratio}`),
        h("div", { class: "muted" }, "İlişkinin öznitelikleri"), attrRows(r, focusAttr));
    } else if (r.kind === "spec") {
      const sup = findEntity(model, o.super);
      const subsBox = h("div", { class: "flags" }, ...model.entities.filter((e) => U(e.name) !== U(o.super)).map((e) =>
        check(e.name, o.subs.some((x) => U(x) === U(e.name)), (v) => { o.subs = v ? [...o.subs, e.name] : o.subs.filter((x) => U(x) !== U(e.name)); if (!o.subs.length) { alert("En az bir alt sınıf kalmalı."); o.subs = [e.name]; } commit(); })));
      const onSel = h("select", {}, h("option", { value: "" }, "— (user/predicate-defined)"), ...(sup?.attrs || []).map((a) => h("option", { value: a.name }, a.name)));
      onSel.value = o.on || "";
      onSel.addEventListener("change", () => { o.on = onSel.value || null; commit(); });
      const dj = h("select", {}, h("option", { value: "d" }, "disjoint (d)"), h("option", { value: "o" }, "overlapping (o)"));
      dj.value = o.disjoint ? "d" : "o";
      dj.addEventListener("change", () => { o.disjoint = dj.value === "d"; commit(); });
      kids.push(h("h4", {}, "Specialization"),
        field("Üst sınıf", entSelect(o.super, (v) => { o.super = v; o.subs = o.subs.filter((x) => U(x) !== U(v)); commit(); })),
        h("div", { class: "muted" }, "Alt sınıflar"), subsBox,
        field("Kısıt", dj),
        check("total (her üst sınıf varlığı bir alt sınıfta)", o.total, (v) => { o.total = v; commit(); }),
        field("Defining attribute", onSel),
        h("p", { class: "muted" }, o.subs.length === 1 ? "Tek alt sınıf: daire çizilmez, yalnızca ⊂." : `${o.disjoint ? "Disjoint" : "Overlapping"}, ${o.total ? "total (çift çizgi)" : "partial"}.`));
    } else if (r.kind === "cat") {
      const supBox = h("div", { class: "flags" }, ...model.entities.filter((e) => U(e.name) !== U(o.name)).map((e) =>
        check(e.name, o.supers.some((x) => U(x) === U(e.name)), (v) => { o.supers = v ? [...o.supers, e.name] : o.supers.filter((x) => U(x) !== U(e.name)); commit(); })));
      kids.push(h("h4", {}, `Category ${o.name}`),
        h("p", { class: "muted" }, "Kategorinin adını ve özniteliklerini değiştirmek için diyagramda kategori entity'sine tıklayın."),
        h("div", { class: "muted" }, "Üst sınıflar (birleşim)"), supBox,
        check("total (birleşimdeki her varlık kategoride)", o.total, (v) => { o.total = v; commit(); }));
    }
    kids.push(h("div", { class: "row" }, button("Bu öğeyi sil", () => removeSelected())));
    panel.replaceChildren(...kids);
  }

  // ---------------------------------------------------------------- export and share
  function standaloneSVG() {
    const clone = svg.cloneNode(true);
    const src = [...svg.querySelectorAll("*")], dst = [...clone.querySelectorAll("*")];
    const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-size", "font-weight", "font-family", "font-style", "text-anchor", "dominant-baseline", "opacity"];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      dst[i].setAttribute("style", props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
    });
    const b = lastBounds;
    clone.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
    clone.setAttribute("width", Math.round(b.w));
    clone.setAttribute("height", Math.round(b.h));
    clone.setAttribute("xmlns", NS);
    const bg = document.createElementNS(NS, "rect");
    Object.entries({ x: b.x, y: b.y, width: b.w, height: b.h, fill: getComputedStyle(fig).backgroundColor }).forEach(([k, v]) => bg.setAttribute(k, v));
    clone.prepend(bg);
    return new XMLSerializer().serializeToString(clone);
  }
  const download = (blob, name) => { const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  function exportSVG() { download(new Blob([standaloneSVG()], { type: "image/svg+xml" }), "er-diagram.svg"); }
  function exportPNG() {
    const img = new Image();
    const b = lastBounds;
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(b.w * 2); c.height = Math.round(b.h * 2);
      const ctx = c.getContext("2d");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      c.toBlob((blob) => download(blob, "er-diagram.png"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(standaloneSVG());
  }
  async function share() {
    const url = `${location.origin}${location.pathname}#dsl=${b64encode(toDSL(model))}`;
    try { await navigator.clipboard.writeText(url); alert("Bağlantı kopyalandı. Açan kişi aynı diyagramı görür."); }
    catch { prompt("Bu bağlantıyı kopyalayın:", url); }
  }

  // ---------------------------------------------------------------- public API
  function setModel(m, { layout = true, keepPos = false } = {}) {
    model = cloneModel(m);
    for (const r of model.relationships) normalizeEnds(r);
    if (!keepPos) pos = layout ? autoLayout(model) : completePositions(model, {});
    else completePositions(model, pos);
    selected = null;
    const res = parseER(toDSL(model));
    showMsgs(res);
    render(); dsl.value = toDSL(model); fit(); pushHistory(); save(); opts.onChange?.(model);
  }
  function setDSL(text, { layout = true, positions = null } = {}) {
    const res = parseER(text);
    showMsgs(res);
    if (res.errors.length) { dsl.value = text; return false; }
    model = res.model;
    pos = positions ? { ...positions } : layout ? autoLayout(model) : {};
    completePositions(model, pos);
    selected = null;
    render(); dsl.value = toDSL(model); fit(); pushHistory(); save(); opts.onChange?.(model);
    return true;
  }

  // initial content: saved work, else the given DSL
  const saved = opts.storageKey ? store.get(opts.storageKey) : null;
  if (opts.dsl) setDSL(opts.dsl, { positions: opts.positions || null });
  else if (saved?.dsl && setDSL(saved.dsl, { positions: saved.pos })) { notation = saved.notation || "ratio"; notationSel.value = notation; render(); }
  else render();
  requestAnimationFrame(() => fit());
  new ResizeObserver(() => fit()).observe(fig);

  return {
    getModel: () => cloneModel(model), getDSL: () => toDSL(model), setDSL, setModel, fit,
    relayout: () => { pos = autoLayout(model); commit({ layoutOnly: true }); fit(); },
    setNotation: (n) => { notation = n; notationSel.value = n; render(); },
    element: host,
  };
}
