// The code area of every SQL box: line numbers, highlighted text, and "what belongs to this word" (sqllinks.js) shown
// on the caret or under the mouse. Runnable boxes put an editable textarea on top; display-only boxes do not.
import { h, highlightSQL } from "./ui.js";
import { linksAt, marksHTML } from "./sqllinks.js";
import { t as tl } from "./i18n.js";

const COPY_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-1v-8h8v1"/></svg>';

/**
 * opts: value, editable, rows (minimum lines), label (aria), placeholder, onInput(), onRun()
 * returns { el, hint, ta, copyTool, getValue, setValue, paint, markLines(lines, kind), clearMarks() }
 */
export function codeView(opts = {}) {
  const editable = !!opts.editable;
  let value = opts.value ?? "";
  const gutter = h("div", { class: "cv-gutter", "aria-hidden": "true" });
  const marks = h("pre", { class: "cv-marks", "aria-hidden": "true" });
  const hl = h("pre", { class: "cv-hl", "aria-hidden": editable ? "true" : null });
  const code = h("div", { class: "cv-code" }, marks, hl);
  let ta = null;
  if (editable) {
    ta = h("textarea", { class: "cv-ta", wrap: "off", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": opts.label || "SQL", placeholder: opts.placeholder || "" });
    ta.value = value;
    code.append(ta);
  }
  const copied = h("span", { class: "cv-copied" });
  const copy = h("button", { type: "button", class: "cv-copy", title: tl("Kodu kopyala", "Copy the code"), "aria-label": tl("Kodu kopyala", "Copy the code"), html: COPY_ICON });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(getValue()); copied.textContent = tl("Kopyalandı", "Copied"); }
    catch { copied.textContent = tl("Kopyalanamadı", "Could not copy"); }
    setTimeout(() => { copied.textContent = ""; }, 1400);
  });
  // a display-only box shows the copy button over its top-right corner; a runnable box puts it in its header (copyTool)
  const copyTool = h("span", { class: "cv-tools" }, copied, copy);
  const el = h("div", { class: `cv${editable ? " cv-edit" : " cv-static"}` }, gutter, code, editable ? null : copyTool);
  const hint = h("div", { class: "cv-hint", hidden: true, "aria-live": "polite" });

  const getValue = () => (ta ? ta.value : value);
  let lineMarks = new Map(); // line number (1-based) -> kind
  let links = null;

  function paintGutter() {
    const n = getValue().split("\n").length;
    const want = Math.max(n, editable ? opts.rows || 1 : 1);
    if (gutter.childElementCount !== want || lineMarks.size || gutter.dataset.marked) {
      gutter.replaceChildren(...Array.from({ length: want }, (_, i) => h("span", { class: lineMarks.get(i + 1) ? `cv-ln ${lineMarks.get(i + 1)}` : "cv-ln" }, i + 1)));
      gutter.dataset.marked = lineMarks.size ? "1" : "";
    }
  }
  function paintMarks() {
    marks.innerHTML = links?.ranges?.length ? marksHTML(getValue(), links.ranges) + "\n" : "";
    hint.hidden = !links?.label;
    hint.textContent = links?.label || "";
    hint.classList.toggle("warn", !!links?.warn);
  }
  function paint() {
    hl.innerHTML = highlightSQL(getValue()) + "\n";
    paintGutter();
    paintMarks();
    if (ta) {
      ta.style.height = "auto";
      const bar = ta.offsetHeight - ta.clientHeight; // a horizontal scrollbar, if any
      ta.style.height = Math.max(ta.scrollHeight + bar, (opts.rows || 2) * lineH() + 20) + "px";
      syncScroll();
    }
  }
  const lineH = () => parseFloat(getComputedStyle(hl).lineHeight) || 21;
  function syncScroll() { if (ta) { hl.scrollLeft = marks.scrollLeft = ta.scrollLeft; } }

  // ---- what belongs to the word at a position
  const setLinks = (l) => { links = l; paintMarks(); };
  const caretLinks = () => {
    if (!ta || document.activeElement !== ta) return null;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = ta.value.slice(s, e);
    if (s !== e && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(sel)) return null; // a word may be selected, not a longer stretch
    return linksAt(ta.value, s);
  };
  let hovering = false;
  // position under the mouse from coordinates: monospace and no wrapping make it a little arithmetic
  let charW = 0;
  function measure() {
    const probe = h("span", { style: { visibility: "hidden", position: "absolute", whiteSpace: "pre" } }, "0000000000");
    hl.append(probe);
    charW = probe.getBoundingClientRect().width / 10;
    probe.remove();
  }
  function posAt(ev) {
    if (!charW) measure();
    const scroller = ta || hl;
    const r = scroller.getBoundingClientRect(), cs = getComputedStyle(scroller);
    const x = ev.clientX - r.left - parseFloat(cs.paddingLeft) + scroller.scrollLeft;
    const y = ev.clientY - r.top - parseFloat(cs.paddingTop) + scroller.scrollTop;
    if (x < 0 || y < 0) return -1;
    const lines = getValue().split("\n");
    const line = Math.floor(y / lineH());
    if (line >= lines.length) return -1;
    const col = Math.floor(x / charW);
    if (col >= lines[line].length) return -1;
    let pos = col;
    for (let i = 0; i < line; i++) pos += lines[i].length + 1;
    return pos;
  }
  let lastPos = -2;
  code.addEventListener("mousemove", (ev) => {
    const p = posAt(ev);
    if (p === lastPos) return;
    lastPos = p;
    const l = p >= 0 ? linksAt(getValue(), p) : null;
    hovering = !!l?.ranges?.length;
    setLinks(hovering ? l : caretLinks());
  });
  code.addEventListener("mouseleave", () => { hovering = false; lastPos = -2; setLinks(caretLinks()); });
  // a tap on a phone (no hover) on a display-only box shows the links of the tapped word
  if (!ta) code.addEventListener("click", (ev) => { const p = posAt(ev); setLinks(p >= 0 ? linksAt(value, p) : null); });

  if (ta) {
    const onCaret = () => { if (!hovering) setLinks(caretLinks()); };
    for (const evt of ["keyup", "click", "select", "focus"]) ta.addEventListener(evt, onCaret);
    ta.addEventListener("blur", () => { if (!hovering) setLinks(null); });
    ta.addEventListener("scroll", syncScroll);
    ta.addEventListener("input", () => { clearMarks(false); paint(); onCaret(); opts.onInput?.(); });
    ta.addEventListener("keydown", (e) => keys(e));
  }

  // ---- editing keys: Ctrl+Enter runs; Tab / Shift+Tab indent and outdent (also several lines); Enter keeps the indent
  function keys(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); opts.onRun?.(); return; }
    const v = ta.value, s = ta.selectionStart, f = ta.selectionEnd;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && s === f) {
      const indent = v.slice(lineStart, s).match(/^ */)[0];
      if (!indent) return;
      e.preventDefault();
      ta.setRangeText("\n" + indent, s, f, "end");
      ta.dispatchEvent(new Event("input"));
    } else if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const multi = v.slice(s, f).includes("\n");
      if (!multi && !e.shiftKey) { e.preventDefault(); ta.setRangeText("  ", s, f, "end"); ta.dispatchEvent(new Event("input")); return; }
      e.preventDefault();
      const end = f > s && v[f - 1] === "\n" ? f - 1 : f;
      const block = v.slice(lineStart, end);
      const out = block.split("\n").map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, "") : "  " + l)).join("\n");
      ta.setRangeText(out, lineStart, end, "preserve");
      if (multi) { ta.selectionStart = lineStart; ta.selectionEnd = lineStart + out.length; }
      else { const d = out.length - block.length; ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s + d); }
      ta.dispatchEvent(new Event("input"));
    }
  }

  function markLines(lines, kind) { for (const n of lines) lineMarks.set(n, kind); paintGutter(); }
  function clearMarks(repaint = true) { if (lineMarks.size) { lineMarks = new Map(); if (repaint) paintGutter(); else gutter.dataset.marked = "1"; } }
  function setValue(v) { if (ta) ta.value = v; else value = v; clearMarks(false); links = null; paint(); }

  if (typeof ResizeObserver !== "undefined") {
    let lastW = 0;
    new ResizeObserver((entries) => { const w = entries[0].contentRect.width; if (w && w !== lastW) { lastW = w; charW = 0; paint(); } }).observe(el);
  }
  requestAnimationFrame(paint);
  paint();
  return { el, hint, ta, copyTool, getValue, setValue, paint, markLines, clearMarks };
}

/** Line numbers (1-based) of the statement-th statement of the text (as splitSQL cut it), found by its own text. */
export function statementLines(text, statements, index) {
  let from = 0, found = null;
  for (let k = 0; k < statements.length && k < index; k++) {
    const st = statements[k].trim();
    const first = st.split("\n")[0].trim().slice(0, 40), last = st.split("\n").pop().trim().slice(-30);
    const a = text.indexOf(first, from);
    if (a < 0) return [];
    const b = text.indexOf(last, a);
    const end = b < 0 ? a + first.length : b + last.length;
    from = end;
    if (k === index - 1) found = [a, end];
  }
  if (!found) return [];
  const lineOf = (p) => text.slice(0, p).split("\n").length;
  const out = [];
  for (let n = lineOf(found[0]); n <= lineOf(found[1]); n++) out.push(n);
  return out;
}
