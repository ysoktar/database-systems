// An ER design exercise placed in a page: requirements, an editor to draw in, a check against the model solution,
// and the solution with its reasons (collapsible). Used by the chapter pages and the midterm guide.
import { h, button } from "./ui.js";
import { createEditor } from "./ereditor.js";
import { ER_EXERCISES, compareER, solutionModel } from "./er-exercises.js";
import { ER_EXAMPLES, exampleById } from "./er-examples.js";
import { emptyModel, toDSL } from "./ermodel.js";
import { erFigure } from "./erd.js";
import { autoLayout, completePositions, toDiagram } from "./erlayout.js";

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
    h("div", { class: `res-msg ${pct === 100 ? "ok" : "warn"}` }, pct === 100 ? `✔ Tam uyum: ${r.score} / ${r.total} kontrol.` : `${r.score} / ${r.total} kontrol doğru (%${pct}).`),
    h("details", { class: "disclosure", open: wrong > 0 && wrong <= 8 }, h("summary", {}, wrong ? `Ayrıntılar: ${wrong} düzeltilecek madde` : "Ayrıntılar"), h("div", { class: "disclosure-body" }, list)));
}

/** The solution diagram and its reasons, drawn when first opened. onLoad(model) loads it into an editor. */
export function solutionDetails(x, onLoad) {
  const model = solutionModel(x, ER_EXAMPLES);
  const body = h("div", { class: "disclosure-body" });
  const details = h("details", { class: "disclosure solution" }, h("summary", {}, "Çözüm ve gerekçeler"), body);
  details.addEventListener("toggle", () => {
    if (!details.open || body.childElementCount) return;
    const ex = x.solutionExample && exampleById(x.solutionExample);
    const spec = toDiagram(model, ex?.layout ? completePositions(model, { ...ex.layout }) : autoLayout(model), {});
    const fig = erFigure({ ...spec, title: `${x.title}: çözüm` }, "Örnek çözüm. Farklı ama eşdeğer çözümler de olabilir (ör. ilişki adları).");
    fig.className = "er solution-fig";
    const note = h("span", { class: "small muted" });
    body.append(fig, h("ul", {}, ...(x.why || []).map((w) => h("li", {}, w))));
    if (onLoad) body.append(h("div", { class: "btn-row", style: { alignItems: "center" } }, button("Çözümü editöre yükle", () => {
      if (!confirm("Çiziminizin yerine çözüm yüklensin mi? (Geri al ile dönebilirsiniz.)")) return;
      onLoad(model, ex?.layout || null);
      note.textContent = "Çözüm editöre yüklendi.";
    }), note));
  });
  return details;
}

/** Mount exercise `id` into `host`: requirements (unless showText is false), editor, check, clear, solution. */
export function mountExercise(host, id, { showText = true } = {}) {
  const x = ER_EXERCISES.find((e) => e.id === id);
  const result = h("div");
  const drawHost = h("div");
  if (showText) host.append(h("div", { class: "callout example", "data-label": "Gereksinimler", html: x.text }));
  host.append(
    h("p", { class: "small", html: `<strong>Kullanılacak adlar:</strong> ${x.names} Çiziminiz bu tarayıcıda saklanır.` }),
    drawHost);
  const editor = createEditor(drawHost, { storageKey: `er-inline-${id}` });
  host.append(
    h("div", { class: "btn-row", style: { alignItems: "center" } },
      button("Kontrol et", () => renderCheck(result, editor.getModel(), solutionModel(x, ER_EXAMPLES)), { kind: "primary" }),
      button("Temizle", () => { if (confirm("Çizim temizlensin mi? (Geri al ile dönebilirsiniz.)")) { editor.setModel(emptyModel()); result.replaceChildren(); } }),
      h("a", { class: "small", href: `er-studio.html#exercise=${id}` }, "Daha geniş alan için ER stüdyosunda açın")),
    result,
    solutionDetails(x, (m, layout) => loadInto(editor, m, layout)));
  return editor;
}
