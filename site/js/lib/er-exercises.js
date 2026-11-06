// ER design exercises: requirements, the names to use, and a model solution. compareER() checks a student's model
// against the solution structurally: entity types (and weak ones), keys, attributes and their kinds, relationships
// (matched by the entity types they connect, so their names are free), cardinality, participation, specializations.
import { parseER, keysOf } from "./ermodel.js";
import { t as tl } from "./i18n.js";

export const ER_EXERCISES = [
  {
    id: "library", title: "Kütüphane", level: 1,
    title_en: "Library",
    text_en: `<ul>
      <li>Every <strong>book</strong> has a unique ISBN, a title, a publication year and one or more <strong>authors</strong> (we keep only their names).</li>
      <li>A book can have several physical <strong>copies</strong>. Copies are numbered only within their book (copies 1, 2, 3 … of each book); every copy has a shelf.</li>
      <li>For <strong>members</strong> we keep a unique member number, a name (as first and last name) and a phone.</li>
      <li>A member can borrow many copies; a copy is with at most one member at a time. For each loan the due date is kept. A copy need not be on loan at every moment, and not every member has to borrow.</li>
    </ul>`,
    names_en: "Entities: BOOK, COPY, MEMBER. Attributes: Isbn, Title, Year, Authors, Copy_no, Shelf, Member_no, Name (First, Last), Phone, Due_date.",
    why_en: [
      "\"unique ISBN\", \"unique member number\" → BOOK.Isbn and MEMBER.Member_no are keys.",
      "\"one or more authors, only their names\" → Authors is a multivalued attribute; no other information about authors is kept, so no separate entity is needed.",
      "\"copies are numbered only within their book\" → COPY is a weak entity, owner BOOK, partial key Copy_no; identifying relationship HAS_COPY, with total participation of COPY.",
      "\"as first and last name\" → Name(First, Last) is a composite attribute.",
      "\"a member many copies, a copy at most one member\" → BORROWS, MEMBER:COPY = 1:N. \"need not be on loan / not every member has to borrow\" → both sides partial.",
      "\"for each loan the due date\" → Due_date is an attribute of BORROWS (since it is 1:N it could also move to COPY).",
    ],
    text: `<ul>
      <li>Her <strong>kitabın</strong> benzersiz bir ISBN'i, bir başlığı, bir yayın yılı ve bir ya da daha çok <strong>yazarı</strong> (yalnızca adlarını tutuyoruz) vardır.</li>
      <li>Bir kitabın birden çok fiziksel <strong>kopyası</strong> olabilir. Kopyalar yalnızca kitapları içinde numaralandırılır (her kitabın 1, 2, 3 … numaralı kopyaları), her kopyanın bir rafı vardır.</li>
      <li><strong>Üyelerin</strong> benzersiz bir üye numarası, adı (ad ve soyad olarak) ve telefonu tutulur.</li>
      <li>Bir üye birçok kopyayı ödünç alabilir; bir kopya aynı anda en fazla bir üyededir. Her ödünç için iade tarihi tutulur. Bir kopyanın her an ödünçte olması gerekmez, her üyenin de ödünç alması gerekmez.</li>
    </ul>`,
    names: "Entity'ler: BOOK, COPY, MEMBER. Öznitelikler: Isbn, Title, Year, Authors, Copy_no, Shelf, Member_no, Name (First, Last), Phone, Due_date.",
    why: [
      "\"benzersiz ISBN\", \"benzersiz üye numarası\" → BOOK.Isbn ve MEMBER.Member_no anahtar.",
      "\"bir ya da daha çok yazar, yalnızca adları\" → Authors çok değerli (multi) öznitelik; yazarın başka bilgisi tutulmadığı için ayrı bir entity gerekmez.",
      "\"kopyalar yalnızca kitapları içinde numaralandırılır\" → COPY zayıf varlık, sahibi BOOK, partial key Copy_no; tanımlayıcı ilişki HAS_COPY ve COPY'nin katılımı total.",
      "\"ad ve soyad olarak\" → Name(First, Last) bileşik öznitelik.",
      "\"bir üye birçok kopya, bir kopya en fazla bir üyede\" → BORROWS, MEMBER:COPY = 1:N. \"her an ödünçte olması / her üyenin ödünç alması gerekmez\" → iki taraf da partial.",
      "\"her ödünç için iade tarihi\" → Due_date, BORROWS'un özniteliği (1:N olduğu için COPY'ye de taşınabilirdi).",
    ],
    solution: `entity BOOK
  Isbn key
  Title
  Year
  Authors multi

weak entity COPY
  Copy_no partial
  Shelf

entity MEMBER
  Member_no key
  Name(First, Last)
  Phone

identifying relationship HAS_COPY: BOOK 1, COPY N total
relationship BORROWS: MEMBER 1, COPY N
  Due_date
`,
  },
  {
    id: "hospital", title: "Hastane", level: 1,
    title_en: "Hospital",
    text_en: `<ul>
      <li>For <strong>patients</strong> we keep a unique patient number, a name and a birth date; their age is computed from the birth date.</li>
      <li><strong>Doctors</strong> have a unique staff number, a name and a specialty.</li>
      <li>Every patient stays in exactly one <strong>room</strong>; a room can hold several patients, and rooms can be empty. Rooms are identified by their room number, and their floor is kept.</li>
      <li>Doctors <strong>treat</strong> patients: a doctor sees many patients, a patient many doctors; every patient has at least one doctor. For each treatment the date is kept.</li>
    </ul>`,
    names_en: "Entities: PATIENT, DOCTOR, ROOM. Attributes: Pid, Name, Birth_date, Age, Did, Specialty, Room_no, Floor, Date.",
    why_en: [
      "Pid, Did, Room_no are unique → keys.",
      "\"age is computed from the birth date\" → Age is a derived attribute.",
      "\"every patient in exactly one room; a room several patients; rooms can be empty\" → STAYS_IN, PATIENT:ROOM = N:1; PATIENT total, ROOM partial.",
      "\"a doctor many patients, a patient many doctors\" → TREATS M:N. \"every patient has at least one doctor\" → PATIENT's participation is total; no such rule for doctors → partial.",
      "\"for each treatment the date\" → Date is an attribute of the M:N TREATS; it cannot move to either entity.",
    ],
    text: `<ul>
      <li><strong>Hastaların</strong> benzersiz bir hasta numarası, adı ve doğum tarihi tutulur; yaşları doğum tarihinden hesaplanır.</li>
      <li><strong>Doktorların</strong> benzersiz bir sicil numarası, adı ve uzmanlık alanı vardır.</li>
      <li>Her hasta tam bir <strong>odada</strong> yatar; bir odada birden çok hasta olabilir, boş odalar olabilir. Odalar oda numarasıyla tanımlanır ve kat bilgisi tutulur.</li>
      <li>Doktorlar hastaları <strong>tedavi eder</strong>: bir doktor birçok hastayı, bir hasta birçok doktoru görebilir; her hastanın en az bir doktoru vardır. Her tedavi için tarih tutulur.</li>
    </ul>`,
    names: "Entity'ler: PATIENT, DOCTOR, ROOM. Öznitelikler: Pid, Name, Birth_date, Age, Did, Specialty, Room_no, Floor, Date.",
    why: [
      "Pid, Did, Room_no benzersiz → anahtarlar.",
      "\"yaşları doğum tarihinden hesaplanır\" → Age türetilmiş (derived) öznitelik.",
      "\"her hasta tam bir odada; bir odada birden çok hasta; boş odalar olabilir\" → STAYS_IN, PATIENT:ROOM = N:1; PATIENT total, ROOM partial.",
      "\"bir doktor birçok hasta, bir hasta birçok doktor\" → TREATS M:N. \"her hastanın en az bir doktoru var\" → PATIENT'in katılımı total; doktor için böyle bir şart yok → partial.",
      "\"her tedavi için tarih\" → Date, M:N TREATS'in özniteliği; hiçbir varlığa taşınamaz.",
    ],
    solution: `entity PATIENT
  Pid key
  Name
  Birth_date
  Age derived

entity DOCTOR
  Did key
  Name
  Specialty

entity ROOM
  Room_no key
  Floor

relationship STAYS_IN: PATIENT N total, ROOM 1
relationship TREATS: DOCTOR M, PATIENT N total
  Date
`,
  },
  {
    id: "university", title: "Üniversite (arasınav rehberi)", level: 2,
    title_en: "University (midterm guide)",
    text_en: `<ul>
      <li>The university's <strong>students</strong> are kept with a student number (unique), a name, one or more phones and a grade point average (computed from their grades).</li>
      <li>Every <strong>course</strong> has a unique code, a title and credits. A course's prerequisites are other courses.</li>
      <li>Courses are offered each term as <strong>sections</strong>: with a section number, a semester and a year, but identified only within their course.</li>
      <li>Every section is taught by exactly one <strong>instructor</strong> (staff number, name, rank); an instructor can teach many sections or none.</li>
      <li>Students enrol in sections, and a grade is kept for each enrolment.</li>
      <li>Every instructor works in exactly one <strong>department</strong> (department name unique, building kept); every course is offered by exactly one department.</li>
    </ul>`,
    names_en: "Entities: STUDENT, COURSE, SECTION, INSTRUCTOR, DEPARTMENT. Attributes: Sid, Name, Phones, Gpa, Code, Title, Credits, Sec_no, Semester, Year, Iid, Rank, Dname, Building, Grade.",
    why_en: [
      "\"unique\" → Sid, Code, Iid, Dname are keys. \"one or more phones\" → Phones is multivalued. \"computed from their grades\" → Gpa is derived.",
      "\"identified only within their course\" → SECTION is a weak entity; owner COURSE, partial key (Sec_no, Semester, Year), identifying relationship OFFERING_OF, total participation of SECTION.",
      "\"every section taught by exactly one instructor; may teach none\" → TEACHES, INSTRUCTOR:SECTION = 1:N; SECTION total, INSTRUCTOR partial.",
      "\"a grade for each enrolment\" → Grade is an attribute of the M:N ENROLLS.",
      "\"prerequisites are other courses\" → recursive M:N PREREQ on COURSE; role names are required (course, prerequisite).",
      "\"works in exactly one department\", \"offered by exactly one department\" → WORKS_IN and OFFERS are N:1, total on the INSTRUCTOR and COURSE side.",
    ],
    text: `<ul>
      <li>Üniversite <strong>öğrencileri</strong> öğrenci numarası (benzersiz), ad, bir ya da daha çok telefon ve not ortalamasıyla (notlardan hesaplanır) tutulur.</li>
      <li>Her <strong>dersin</strong> benzersiz bir kodu, adı ve kredisi vardır. Bir dersin önkoşulları başka derslerdir.</li>
      <li>Dersler dönemlerde <strong>şubeler</strong> olarak açılır: şube numarası, dönem ve yılla, ama yalnızca dersi içinde tanımlanır.</li>
      <li>Her şubeyi tam bir <strong>öğretim üyesi</strong> verir (sicil, ad, unvan); bir öğretim üyesi birçok şube verebilir ya da hiç vermeyebilir.</li>
      <li>Öğrenciler şubelere kaydolur ve her kayıt için bir not tutulur.</li>
      <li>Her öğretim üyesi tam bir <strong>bölümde</strong> çalışır (bölüm adı benzersiz, binası tutulur); her ders tam bir bölüm tarafından açılır.</li>
    </ul>`,
    names: "Entity'ler: STUDENT, COURSE, SECTION, INSTRUCTOR, DEPARTMENT. Öznitelikler: Sid, Name, Phones, Gpa, Code, Title, Credits, Sec_no, Semester, Year, Iid, Rank, Dname, Building, Grade.",
    solution: null, // the UNIVERSITY example
    solutionExample: "university",
    why: [
      "\"benzersiz\" → Sid, Code, Iid, Dname anahtar. \"bir ya da daha çok telefon\" → Phones çok değerli. \"notlardan hesaplanır\" → Gpa türetilmiş.",
      "\"yalnızca dersi içinde tanımlanır\" → SECTION zayıf varlık; sahibi COURSE, partial key (Sec_no, Semester, Year), tanımlayıcı ilişki OFFERING_OF, SECTION'ın katılımı total.",
      "\"her şubeyi tam bir öğretim üyesi verir; hiç vermeyebilir\" → TEACHES, INSTRUCTOR:SECTION = 1:N; SECTION total, INSTRUCTOR partial.",
      "\"her kayıt için bir not\" → Grade, M:N ENROLLS'un özniteliği.",
      "\"önkoşulları başka derslerdir\" → COURSE üzerinde recursive M:N PREREQ; rol adları zorunlu (course, prerequisite).",
      "\"tam bir bölümde çalışır\", \"tam bir bölüm tarafından açılır\" → WORKS_IN ve OFFERS N:1, INSTRUCTOR ve COURSE tarafı total.",
    ],
  },
  {
    id: "airline", title: "Havayolu (EER)", level: 3,
    title_en: "Airline (EER)",
    text_en: `<ul>
      <li>Every <strong>person</strong> the airline keeps has a unique id number and a name.</li>
      <li>Persons can be <strong>pilots</strong> or <strong>passengers</strong>; a pilot can also be a passenger on another flight; the system also has persons who are neither (e.g. former employees). For pilots the licence number is kept, for passengers their loyalty points.</li>
      <li>Every <strong>flight</strong> has a unique flight number and a departure time. Every flight is flown by exactly one pilot; a pilot can fly many flights.</li>
      <li>Passengers <strong>book</strong> flights: a passenger many flights, a flight many passengers. Every booking has a seat number.</li>
    </ul>`,
    names_en: "Entities: PERSON, PILOT, PASSENGER, FLIGHT. Attributes: Pid, Name, License_no, Points, Flight_no, Departure, Seat.",
    why_en: [
      "PILOT and PASSENGER are subclasses of PERSON: id number and name in the superclass, License_no and Points are local attributes.",
      "\"a pilot can also be a passenger on another flight\" → overlapping (o). \"persons who are neither\" → partial (single line).",
      "\"every flight flown by exactly one pilot; a pilot many flights\" → FLIES, PILOT:FLIGHT = 1:N; FLIGHT total.",
      "\"a passenger many flights, a flight many passengers\" → BOOKS M:N; Seat is an attribute of this relationship.",
      "The relationships attach to the subclasses (PILOT, PASSENGER), not to PERSON: only pilots fly flights, only passengers book.",
    ],
    text: `<ul>
      <li>Havayolunun tuttuğu her <strong>kişinin</strong> benzersiz bir kimlik numarası ve adı vardır.</li>
      <li>Kişiler <strong>pilot</strong> ya da <strong>yolcu</strong> olabilir; bir pilot başka bir uçuşta yolcu da olabilir; sistemde ikisi de olmayan kişiler de vardır (ör. eski çalışanlar). Pilotların lisans numarası, yolcuların sadakat puanı tutulur.</li>
      <li>Her <strong>uçuşun</strong> benzersiz bir uçuş numarası ve kalkış zamanı vardır. Her uçuşu tam bir pilot kullanır; bir pilot birçok uçuşta görev alabilir.</li>
      <li>Yolcular uçuşlara <strong>rezervasyon</strong> yapar: bir yolcu birçok uçuşa, bir uçuşa birçok yolcu. Her rezervasyonun bir koltuk numarası vardır.</li>
    </ul>`,
    names: "Entity'ler: PERSON, PILOT, PASSENGER, FLIGHT. Öznitelikler: Pid, Name, License_no, Points, Flight_no, Departure, Seat.",
    why: [
      "PILOT ve PASSENGER, PERSON'ın alt sınıfları: kimlik numarası ve ad üst sınıfta, License_no ve Points yerel öznitelikler.",
      "\"bir pilot başka bir uçuşta yolcu da olabilir\" → overlapping (o). \"ikisi de olmayan kişiler var\" → partial (tek çizgi).",
      "\"her uçuşu tam bir pilot kullanır; bir pilot birçok uçuşta\" → FLIES, PILOT:FLIGHT = 1:N; FLIGHT total.",
      "\"bir yolcu birçok uçuşa, bir uçuşa birçok yolcu\" → BOOKS M:N; Seat bu ilişkinin özniteliği.",
      "İlişkiler alt sınıflara bağlanır (PILOT, PASSENGER), PERSON'a değil: yalnızca pilotlar uçuş kullanır, yalnızca yolcular rezervasyon yapar.",
    ],
    solution: `entity PERSON
  Pid key
  Name

entity PILOT
  License_no

entity PASSENGER
  Points

entity FLIGHT
  Flight_no key
  Departure

relationship FLIES: PILOT 1, FLIGHT N total
relationship BOOKS: PASSENGER M, FLIGHT N
  Seat

specialization PERSON -> PILOT, PASSENGER overlapping partial
`,
  },
];

const U = (s) => String(s).toUpperCase();
const flat = (attrs) => attrs.flatMap((a) => [a, ...(a.comps ? flat(a.comps) : [])]);
const kindOf = (a) => (a.multi ? "multivalued" : a.derived ? "derived" : a.comps ? "composite" : "simple");
const ratio = (r) => r.ends.map((e) => (e.card === "1" ? "1" : "N"));

/** Compare a student's model with the solution. Returns { items: [{ ok: true|false|null, text }], score, total }. */
export function compareER(student, solution) {
  const items = [];
  const add = (ok, text) => items.push({ ok, text });
  const sEnt = new Map(student.entities.map((e) => [U(e.name), e]));
  for (const e of solution.entities) {
    const se = sEnt.get(U(e.name));
    if (!se) { add(false, tl(`Entity <strong>${e.name}</strong> eksik.`, `Entity <strong>${e.name}</strong> is missing.`)); continue; }
    const kind = (x) => (x.weak ? "weak entity" : "regular entity");
    add(se.weak === e.weak, `${e.name}: ${se.weak === e.weak ? `${kind(e)} ✓` : tl(`<strong>${kind(e)}</strong> olmalı (sizinki ${kind(se)})`, `should be a <strong>${kind(e)}</strong> (yours: ${kind(se)})`)}`);
    const keys = keysOf(e).map((a) => U(a.name)).sort().join(","), skeys = keysOf(se).map((a) => U(a.name)).sort().join(",");
    if (keys || skeys) add(keys === skeys, tl(`${e.name} anahtar(lar)ı: ${keys === skeys ? (keys || "yok") + " ✓" : `beklenen <strong>${keys || "yok"}</strong>, sizinki ${skeys || "yok"}`}`, `${e.name} key(s): ${keys === skeys ? (keys || "none") + " ✓" : `expected <strong>${keys || "none"}</strong>, yours ${skeys || "none"}`}`));
    const partial = flat(e.attrs).filter((a) => a.partial).map((a) => U(a.name)).sort().join(",");
    const spartial = flat(se.attrs).filter((a) => a.partial).map((a) => U(a.name)).sort().join(",");
    if (partial || spartial) add(partial === spartial, tl(`${e.name} partial key: ${partial === spartial ? partial + " ✓" : `beklenen <strong>${partial || "yok"}</strong>, sizinki ${spartial || "yok"}`}`, `${e.name} partial key: ${partial === spartial ? partial + " ✓" : `expected <strong>${partial || "none"}</strong>, yours ${spartial || "none"}`}`));
    const sAttrs = new Map(flat(se.attrs).map((a) => [U(a.name), a]));
    for (const a of flat(e.attrs)) {
      const sa = sAttrs.get(U(a.name));
      if (!sa) { add(false, tl(`${e.name}.${a.name} özniteliği eksik.`, `Attribute ${e.name}.${a.name} is missing.`)); continue; }
      if (kindOf(a) !== "simple" || kindOf(sa) !== "simple") add(kindOf(a) === kindOf(sa), `${e.name}.${a.name}: ${kindOf(a) === kindOf(sa) ? kindOf(a) + " ✓" : tl(`<strong>${kindOf(a)}</strong> olmalı (sizinki ${kindOf(sa)})`, `should be <strong>${kindOf(a)}</strong> (yours: ${kindOf(sa)})`)}`);
    }
  }
  for (const e of student.entities) if (!solution.entities.some((x) => U(x.name) === U(e.name))) add(null, tl(`Fazladan entity: ${e.name} (çözümde yok; belki bir öznitelik ya da ilişki olmalı).`, `Extra entity: ${e.name} (not in the solution; perhaps it should be an attribute or a relationship).`));

  // relationships: matched by the multiset of participating entity types
  const sig = (r) => r.ends.map((e) => U(e.entity)).sort().join("+");
  const unmatched = [...student.relationships];
  for (const r of solution.relationships) {
    const candidates = unmatched.filter((x) => sig(x) === sig(r));
    const sr = candidates.find((x) => U(x.name) === U(r.name)) || candidates[0];
    const label = `${r.ends.map((e) => e.entity).join(" — ")} (${r.name})`;
    if (!sr) { add(false, tl(`İlişki eksik: ${label}.`, `Missing relationship: ${label}.`)); continue; }
    unmatched.splice(unmatched.indexOf(sr), 1);
    add(!!sr.identifying === !!r.identifying, `${label}: ${r.identifying ? (sr.identifying ? "identifying ✓" : tl("<strong>identifying relationship olmalı</strong>", "<strong>should be an identifying relationship</strong>")) : (sr.identifying ? tl("identifying olmamalı", "should not be identifying") : tl("ilişki ✓", "relationship ✓"))}`);
    // align ends (recursive relationships by role order)
    const ends = r.ends.map((e) => sr.ends.find((x) => U(x.entity) === U(e.entity) && (!e.role || !x.role || U(x.role) === U(e.role))) || sr.ends.find((x) => U(x.entity) === U(e.entity)));
    if (r.ends.length === 2 && ends.every(Boolean)) {
      const exp = ratio(r).join(":"), got = ratio({ ends }).join(":");
      add(exp === got, tl(`${label} kardinalite: ${exp === got ? exp.replace("N:N", "M:N") + " ✓" : `beklenen <strong>${exp.replace("N:N", "M:N")}</strong>, sizinki ${got.replace("N:N", "M:N")}`}`, `${label} cardinality: ${exp === got ? exp.replace("N:N", "M:N") + " ✓" : `expected <strong>${exp.replace("N:N", "M:N")}</strong>, yours ${got.replace("N:N", "M:N")}`}`));
    }
    r.ends.forEach((e, i) => {
      const se = ends[i];
      if (se) add(!!se.total === !!e.total, tl(`${label}: ${e.entity}'in katılımı ${se.total === e.total ? (e.total ? "total" : "partial") + " ✓" : `<strong>${e.total ? "total" : "partial"}</strong> olmalı`}`, `${label}: participation of ${e.entity} ${se.total === e.total ? (e.total ? "total" : "partial") + " ✓" : `should be <strong>${e.total ? "total" : "partial"}</strong>`}`));
    });
    const ra = r.attrs.map((a) => U(a.name)).sort().join(","), sa = sr.attrs.map((a) => U(a.name)).sort().join(",");
    if (ra || sa) add(ra === sa, tl(`${label} öznitelikleri: ${ra === sa ? ra + " ✓" : `beklenen <strong>${ra || "yok"}</strong>, sizinki ${sa || "yok"}`}`, `${label} attributes: ${ra === sa ? ra + " ✓" : `expected <strong>${ra || "none"}</strong>, yours ${sa || "none"}`}`));
  }
  for (const r of unmatched) add(null, tl(`Fazladan ilişki: ${r.name} (${r.ends.map((e) => e.entity).join(", ")}).`, `Extra relationship: ${r.name} (${r.ends.map((e) => e.entity).join(", ")}).`));

  for (const s of solution.specializations) {
    const ss = student.specializations.find((x) => U(x.super) === U(s.super) && x.subs.map(U).sort().join() === s.subs.map(U).sort().join());
    if (!ss) { add(false, tl(`Özelleştirme eksik: ${s.super} → {${s.subs.join(", ")}}.`, `Missing specialization: ${s.super} → {${s.subs.join(", ")}}.`)); continue; }
    add(ss.disjoint === s.disjoint, tl(`${s.super} özelleştirmesi ${s.disjoint ? "disjoint" : "overlapping"} ${ss.disjoint === s.disjoint ? "✓" : "olmalı"}`, `${s.super} specialization ${ss.disjoint === s.disjoint ? (s.disjoint ? "disjoint" : "overlapping") + " ✓" : `should be ${s.disjoint ? "disjoint" : "overlapping"}`}`));
    add(ss.total === s.total, tl(`${s.super} özelleştirmesi ${s.total ? "total" : "partial"} ${ss.total === s.total ? "✓" : "olmalı"}`, `${s.super} specialization ${ss.total === s.total ? (s.total ? "total" : "partial") + " ✓" : `should be ${s.total ? "total" : "partial"}`}`));
  }
  for (const c of solution.categories) {
    const sc = student.categories.find((x) => U(x.name) === U(c.name));
    add(!!sc, sc ? tl(`Kategori ${c.name} ✓`, `Category ${c.name} ✓`) : tl(`Kategori eksik: ${c.name}.`, `Missing category: ${c.name}.`));
  }
  const graded = items.filter((i) => i.ok !== null);
  return { items, score: graded.filter((i) => i.ok).length, total: graded.length };
}

export const solutionModel = (ex, examples) => parseER(ex.solution || examples.find((e) => e.id === ex.solutionExample).dsl).model;
