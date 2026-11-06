import "../layout.js";
import { mountExercise } from "../lib/er-inline.js";
import { $ } from "../lib/ui.js";
import { erFigure } from "../lib/erd.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

const put = (id, fig) => { const host = $(`#${id}`); if (host) host.append(fig); };

// Figure 4.1: specializations of EMPLOYEE
put("spec-employee", erFigure({
  title: tl("EMPLOYEE'nin özelleştirmeleri", "Specializations of EMPLOYEE"),
  width: 900, height: 400,
  nodes: [
    { id: "E", type: "entity", x: 450, y: 70, label: "EMPLOYEE" },
    { id: "eN", type: "attr", x: 270, y: 30, label: "Name", of: "E" },
    { id: "eS", type: "attr", x: 360, y: 20, label: "Ssn", key: true, of: "E" },
    { id: "eB", type: "attr", x: 560, y: 20, label: "Birth_date", of: "E" },
    { id: "eJ", type: "attr", x: 650, y: 40, label: "Job_type", of: "E" },
    { id: "d1", type: "isa", x: 220, y: 190, label: "d" },
    { id: "d2", type: "isa", x: 700, y: 190, label: "d" },
    { id: "SEC", type: "entity", x: 90, y: 300, label: "SECRETARY" },
    { id: "TEC", type: "entity", x: 220, y: 300, label: "TECHNICIAN" },
    { id: "ENG", type: "entity", x: 360, y: 300, label: "ENGINEER" },
    { id: "MAN", type: "entity", x: 470, y: 300, label: "MANAGER" },
    { id: "HE", type: "entity", x: 620, y: 300, label: "HOURLY_EMPLOYEE" },
    { id: "SE", type: "entity", x: 800, y: 300, label: "SALARIED_EMPLOYEE" },
    { id: "a1", type: "attr", x: 90, y: 370, label: "Typing_speed", of: "SEC" },
    { id: "a2", type: "attr", x: 220, y: 370, label: "Tgrade", of: "TEC" },
    { id: "a3", type: "attr", x: 360, y: 370, label: "Eng_type", of: "ENG" },
    { id: "a4", type: "attr", x: 620, y: 370, label: "Pay_scale", of: "HE" },
    { id: "a5", type: "attr", x: 800, y: 370, label: "Salary", of: "SE" },
  ],
  links: [
    { a: "E", b: "d1", via: [[220, 110]], role: "Job_type", roleSide: -12 },
    { a: "d1", b: "SEC", subset: true }, { a: "d1", b: "TEC", subset: true }, { a: "d1", b: "ENG", subset: true },
    { a: "E", b: "MAN", subset: true },
    { a: "E", b: "d2", via: [[700, 110]], total: true },
    { a: "d2", b: "HE", subset: true }, { a: "d2", b: "SE", subset: true },
  ],
}, tl("EMPLOYEE'nin üç özelleştirmesi (Figure 4.1): iş tipine göre (disjoint, partial, defining attribute Job_type), tek alt sınıflı MANAGER, ödeme biçimine göre (disjoint, total).", "Three specializations of EMPLOYEE (Figure 4.1): by job type (disjoint, partial, defining attribute Job_type), MANAGER with a single subclass, by pay method (disjoint, total).")));

// Overlapping specialization (Figure 4.5)
put("spec-part", erFigure({
  title: tl("PART'ın overlapping özelleştirmesi", "The overlapping specialization of PART"),
  width: 640, height: 260,
  nodes: [
    { id: "P", type: "entity", x: 320, y: 50, label: "PART" },
    { id: "p1", type: "attr", x: 180, y: 30, label: "Part_no", key: true, of: "P" },
    { id: "p2", type: "attr", x: 460, y: 30, label: "Description", of: "P" },
    { id: "o", type: "isa", x: 320, y: 140, label: "o" },
    { id: "M", type: "entity", x: 170, y: 200, label: "MANUFACTURED_PART" },
    { id: "U", type: "entity", x: 480, y: 200, label: "PURCHASED_PART" },
    { id: "m1", type: "attr", x: 90, y: 245, label: "Drawing_no", of: "M" },
    { id: "m2", type: "attr", x: 240, y: 248, label: "Batch_no", of: "M" },
    { id: "u1", type: "attr", x: 420, y: 248, label: "Supplier_name", of: "U" },
    { id: "u2", type: "attr", x: 570, y: 245, label: "List_price", of: "U" },
  ],
  links: [{ a: "P", b: "o", total: true }, { a: "o", b: "M", subset: true }, { a: "o", b: "U", subset: true }],
}, tl("PART: overlapping ve total özelleştirme (Figure 4.5).", "PART: an overlapping, total specialization (Figure 4.5)."), { small: true }));

// Specialization lattice with a shared subclass (Figure 4.6)
put("lattice", erFigure({
  title: tl("Paylaşılan alt sınıf: ENGINEERING_MANAGER", "A shared subclass: ENGINEERING_MANAGER"),
  width: 640, height: 260,
  nodes: [
    { id: "E", type: "entity", x: 320, y: 30, label: "EMPLOYEE" },
    { id: "d", type: "isa", x: 140, y: 100, label: "d" },
    { id: "ENG", type: "entity", x: 200, y: 160, label: "ENGINEER" },
    { id: "SEC", type: "entity", x: 70, y: 160, label: "SECRETARY" },
    { id: "MAN", type: "entity", x: 420, y: 160, label: "MANAGER" },
    { id: "d2", type: "isa", x: 560, y: 100, label: "d" },
    { id: "S", type: "entity", x: 560, y: 160, label: "SALARIED" },
    { id: "EM", type: "entity", x: 320, y: 235, label: "ENGINEERING_MANAGER" },
  ],
  links: [
    { a: "E", b: "d", via: [[140, 30]] }, { a: "d", b: "ENG", subset: true }, { a: "d", b: "SEC", subset: true },
    { a: "E", b: "MAN", subset: true },
    { a: "E", b: "d2", via: [[560, 30]], total: true }, { a: "d2", b: "S", subset: true },
    { a: "ENG", b: "EM", subset: true }, { a: "MAN", b: "EM", subset: true },
  ],
}, tl("Lattice: ENGINEERING_MANAGER, ENGINEER ve MANAGER'ın paylaşılan alt sınıfı (Figure 4.6'dan sadeleştirildi).", "Lattice: ENGINEERING_MANAGER, a shared subclass of ENGINEER and MANAGER (simplified from Figure 4.6)."), { small: true }));

// Category (union type), Figure 4.8
put("category", erFigure({
  title: "OWNER kategorisi",
  width: 640, height: 300,
  nodes: [
    { id: "PE", type: "entity", x: 110, y: 40, label: "PERSON" },
    { id: "BA", type: "entity", x: 320, y: 40, label: "BANK" },
    { id: "CO", type: "entity", x: 530, y: 40, label: "COMPANY" },
    { id: "pa", type: "attr", x: 40, y: 95, label: "Ssn", key: true, of: "PE" },
    { id: "ba", type: "attr", x: 422, y: 40, label: "Bname", key: true, of: "BA" },
    { id: "ca", type: "attr", x: 610, y: 95, label: "Cname", key: true, of: "CO" },
    { id: "u", type: "isa", x: 320, y: 140, label: "∪" },
    { id: "OW", type: "entity", x: 320, y: 210, label: "OWNER" },
    { id: "OWN", type: "rel", x: 320, y: 270, label: "OWNS" },
  ],
  links: [
    { a: "PE", b: "u" }, { a: "BA", b: "u" }, { a: "CO", b: "u" },
    { a: "u", b: "OW", subset: true },
    { a: "OW", b: "OWN" },
  ],
}, tl("OWNER = PERSON ∪ BANK ∪ COMPANY'nin alt kümesi (Figure 4.8).", "OWNER ⊆ PERSON ∪ BANK ∪ COMPANY (Figure 4.8)."), { small: true }));

mountExercise($("#draw-airline"), "airline");
