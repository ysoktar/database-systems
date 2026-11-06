import "../layout.js";
import { $ } from "../lib/ui.js";
import { erFigure } from "../lib/erd.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

$("#notation").append(erFigure({
  title: "ER/EER sembolleri",
  width: 900, height: 200,
  nodes: [
    { id: "E", type: "entity", x: 70, y: 40, label: "ENTITY" },
    { id: "W", type: "entity", x: 190, y: 40, label: "WEAK", weak: true },
    { id: "R", type: "rel", x: 320, y: 40, label: "REL" },
    { id: "I", type: "rel", x: 450, y: 40, label: "IDENT", ident: true },
    { id: "a", type: "attr", x: 560, y: 40, label: "attr" },
    { id: "k", type: "attr", x: 640, y: 40, label: "Key", key: true },
    { id: "p", type: "attr", x: 720, y: 40, label: "Partial", pkey: true },
    { id: "m", type: "attr", x: 810, y: 40, label: "Multi", multi: true },
    { id: "dv", type: "attr", x: 70, y: 140, label: "Derived", derived: true },
    { id: "E1", type: "entity", x: 210, y: 140, label: "E1" },
    { id: "R1", type: "rel", x: 330, y: 140, label: "R" },
    { id: "E2", type: "entity", x: 450, y: 140, label: "E2" },
    { id: "S", type: "entity", x: 600, y: 120, label: "SUPER" },
    { id: "d", type: "isa", x: 700, y: 120, label: "d" },
    { id: "A", type: "entity", x: 820, y: 90, label: "SUB_A" },
    { id: "B", type: "entity", x: 820, y: 160, label: "SUB_B" },
  ],
  links: [
    { a: "R1", b: "E1", card: "1" }, { a: "R1", b: "E2", card: "N", total: true },
    { a: "S", b: "d", total: true }, { a: "d", b: "A", subset: true }, { a: "d", b: "B", subset: true },
  ],
}, tl("Üst sıra: entity, weak entity, relationship, identifying relationship, attribute, key, partial key, multivalued. Alt sıra: derived; 1:N ilişki (E2 total); disjoint-total specialization.", "Top row: entity, weak entity, relationship, identifying relationship, attribute, key, partial key, multivalued. Bottom row: derived; a 1:N relationship (E2 total); a disjoint, total specialization.")));
