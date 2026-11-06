// An ER design exercise placed in a page: requirements, an editor to draw in, a check against the model solution,
// and the solution with its reasons (collapsible). Used by the chapter pages and the midterm guide.
import { h, button } from "./ui.js";
import { createEditor } from "./ereditor.js";
import { ER_EXERCISES, compareER, solutionModel } from "./er-exercises.js";
import { ER_EXAMPLES, exampleById } from "./er-examples.js";
import { emptyModel, toDSL } from "./ermodel.js";
import { erFigure } from "./erd.js";
import { autoLayout, completePositions, toDiagram } from "./erlayout.js";
import { t as tl, tx, EN } from "./i18n.js";

/** Load a model into an editor, with a hand layout when there is one. */
export function loadInto(editor, model, layout) {
  if (layout) editor.setDSL(toDSL(model), { positions: { ...layout } });
  else editor.setModel(model);
}

/** Check results: a summary line and a collapsible list. */
export function renderCheck(out, student, solution) {
  const r = compareER(student, solution);
  const pct = r.total ? Math.round((100 * r.score) / r.total) : 0;
  const wrong = r.items.filter((i) => i.ok === false).length;
  const list = h("ul", { class: "check-list" }, ...r.items.sort((a, b) => (a.ok === b.ok ? 0 : a.ok === false ? -1 : b.ok === false ? 1 : 0))
    .map((i) => h("li", { class: i.ok === true ? "ok" : i.ok === false ? "no" : "meh", html: i.text })));
  out.replaceChildren(
    h("div", { class: `res-msg ${pct === 100 ? "ok" : "warn"}` }, pct === 100 ? tl(`✔ Tam uyum: ${r.score} / ${r.total} kontrol.`, `✔ Full match: ${r.score} / ${r.total} checks.`) : tl(`${r.score} / ${r.total} kontrol doğru (%${pct}).`, `${r.score} / ${r.total} checks right (${pct}%).`)),
    h("details", { class: "disclosure", open: wrong > 0 && wrong <= 8 }, h("summary", {}, wrong ? tl(`Ayrıntılar: ${wrong} düzeltilecek madde`, `Details: ${wrong} things to fix`) : tl("Ayrıntılar", "Details")), h("div", { class: "disclosure-body" }, list)));
}

/** The solution diagram and its reasons, drawn when first opened. onLoad(model) loads it into an editor. */
export function solutionDetails(x, onLoad) {
  const model = solutionModel(x, ER_EXAMPLES);
  const body = h("div", { class: "disclosure-body" });
  const details = h("details", { class: "disclosure solution" }, h("summary", {}, tl("Çözüm ve gerekçeler", "Solution and reasoning")), body);
  details.addEventListener("toggle", () => {
    if (!details.open || body.childElementCount) return;
    const ex = x.solutionExample && exampleById(x.solutionExample);
    const spec = toDiagram(model, ex?.layout ? completePositions(model, { ...ex.layout }) : autoLayout(model), {});
    const fig = erFigure({ ...spec, title: `${tx(x, "title")}: ${tl("çözüm", "solution")}` }, tl("Örnek çözüm. Farklı ama eşdeğer çözümler de olabilir (ör. ilişki adları).", "A model solution. Different but equivalent solutions are possible (e.g. relationship names)."));
    fig.className = "er solution-fig";
    const note = h("span", { class: "small muted" });
    body.append(fig, h("ul", {}, ...(tx(x, "why") || []).map((w) => h("li", {}, w))));
    if (onLoad) body.append(h("div", { class: "btn-row", style: { alignItems: "center" } }, button(tl("Çözümü editöre yükle", "Load the solution into the editor"), () => {
      if (!confirm(tl("Çiziminizin yerine çözüm yüklensin mi? (Geri al ile dönebilirsiniz.)", "Replace your drawing with the solution? (Undo brings it back.)"))) return;
      onLoad(model, ex?.layout || null);
      note.textContent = tl("Çözüm editöre yüklendi.", "The solution was loaded into the editor.");
    }), note));
  });
  return details;
}

/** Mount exercise `id` into `host`: requirements (unless showText is false), editor, check, clear, solution. */
export function mountExercise(host, id, { showText = true } = {}) {
  const x = ER_EXERCISES.find((e) => e.id === id);
  const result = h("div");
  const drawHost = h("div");
  if (showText) host.append(h("div", { class: "callout example", "data-label": tl("Gereksinimler", "Requirements"), html: tx(x, "text") }));
  host.append(
    h("p", { class: "small", html: tl(`<strong>Kullanılacak adlar:</strong> ${x.names} Çiziminiz bu tarayıcıda saklanır.`, `<strong>Names to use:</strong> ${tx(x, "names")} Your drawing is saved in this browser.`) }),
    drawHost);
  const editor = createEditor(drawHost, { storageKey: `er-inline-${id}` });
  host.append(
    h("div", { class: "btn-row", style: { alignItems: "center" } },
      button(tl("Kontrol et", "Check"), () => renderCheck(result, editor.getModel(), solutionModel(x, ER_EXAMPLES)), { kind: "primary" }),
      button(tl("Temizle", "Clear"), () => { if (confirm(tl("Çizim temizlensin mi? (Geri al ile dönebilirsiniz.)", "Clear the drawing? (Undo brings it back.)"))) { editor.setModel(emptyModel()); result.replaceChildren(); } }),
      h("a", { class: "small", href: `er-studio.html#exercise=${id}` }, tl("Daha geniş alan için ER stüdyosunda açın", "Open in the ER studio for more room"))),
    result,
    solutionDetails(x, (m, layout) => loadInto(editor, m, layout)));
  return editor;
}
