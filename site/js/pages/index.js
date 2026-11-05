import { NAV } from "../layout.js";
import { h, $ } from "../lib/ui.js";
import { schemaCards } from "../lib/schema.js";
import { drawER } from "../lib/erd.js";

// ---- part cards
const parts = $("#parts");
for (const p of NAV.slice(1)) {
  const card = h("div", { class: "card" },
    h("div", { class: "card-kicker" }, p.part + (p.short ? ` · ${p.short}` : "")),
    h("ol", {}, ...p.items.map((it) => h("li", {}, h("a", { href: `${it.id}.html` }, it.title), h("div", { class: "small muted" }, it.desc)))));
  parts.append(card);
}

$("#schema").append(schemaCards());

// ---- hero: a small ER diagram
const hero = $("#hero");
const fig = h("figure", { class: "er small", style: { margin: 0 } });
fig.append(drawER({
  title: "EMPLOYEE N:1 DEPARTMENT", width: 420, height: 300,
  nodes: [
    { id: "E", type: "entity", x: 90, y: 150, label: "EMPLOYEE" },
    { id: "D", type: "entity", x: 340, y: 150, label: "DEPARTMENT" },
    { id: "W", type: "rel", x: 215, y: 150, label: "WORKS_FOR" },
    { id: "a", type: "attr", x: 60, y: 60, label: "Ssn", key: true, of: "E" },
    { id: "b", type: "attr", x: 140, y: 50, label: "Name", of: "E" },
    { id: "c", type: "attr", x: 70, y: 245, label: "Salary", of: "E" },
    { id: "d", type: "attr", x: 330, y: 55, label: "Dnumber", key: true, of: "D" },
    { id: "e", type: "attr", x: 360, y: 245, label: "Locations", multi: true, of: "D" },
    { id: "f", type: "attr", x: 240, y: 250, label: "Emp_count", derived: true, of: "D" },
  ],
  links: [{ a: "W", b: "E", card: "N", total: true }, { a: "W", b: "D", card: "1", total: true }],
}));
fig.append(h("figcaption", {}, "Her çalışan tam bir departmanda çalışır (N:1, çift çizgi = total participation)."));
hero.append(fig);
