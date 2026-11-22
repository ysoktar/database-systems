// "You decide" banks for ER (Ch 3) and EER (Ch 4) design choices. After each answer the right model is drawn in the
// book's notation and mapped to tables with the Ch 9 algorithm, so a design decision is seen in both forms.
import { h, $ } from "../lib/ui.js";
import { decidePlayer } from "../lib/decide.js";
import { erFigure } from "../lib/erd.js";
import { parseER } from "../lib/ermodel.js";
import { mapER } from "../lib/ermap.js";
import { tableCard } from "../lib/ermapview.js";
import { autoLayout, toDiagram } from "../lib/erlayout.js";
import { t as tl } from "../lib/i18n.js";

/** The right design: its diagram, the tables Ch 9 maps it to, and a sentence linking the two. */
function model(dsl, note, { spec = "8A" } = {}) {
  return () => {
    const { model: m } = parseER(dsl);
    const fig = erFigure({ ...toDiagram(m, autoLayout(m), {}) }, "");
    // a small schema keeps its natural size instead of stretching to the card's width
    const svg = fig.querySelector("svg"), vb = svg?.viewBox?.baseVal;
    if (vb?.width) { svg.style.maxWidth = `${Math.round(vb.width * 1.15)}px`; svg.style.margin = "0 auto"; svg.style.display = "block"; }
    const tables = mapER(m, { spec }).tables;
    return h("div", {},
      h("div", { class: "ba-label" }, tl("Doğru model (ER diyagramı)", "The right model (ER diagram)")), fig,
      h("div", { class: "ba-label", style: { marginTop: "10px" } }, tl("↓ Ch 9 eşlemesiyle tablolar", "↓ Its tables by the Ch 9 mapping")),
      h("div", { class: "schema-grid" }, ...tables.map((t) => tableCard(t))), h("p", { class: "small" }, note));
  };
}

const BANKS = {
  "er-decide": () => [
    { q: tl("Gereksinim: \"Bir çalışanın birden çok telefon numarası olabilir.\" Telefon nasıl modellenir?", "Requirement: \"An employee may have several phone numbers.\" How is the phone modelled?"),
      opts: [[tl("Çok değerli öznitelik (çift elips)", "A multivalued attribute (double ellipse)"), true, tl("Doğru. Bir varlığın aynı öznitelik için birden çok değeri varsa çok değerli öznitelik kullanılır.", "Right. When an entity has several values for the same attribute, a multivalued attribute is used.")],
        [tl("Phone1, Phone2, Phone3 öznitelikleri", "Attributes Phone1, Phone2, Phone3"), false, tl("Sayıyı keyfi olarak sınırlar ve çoğu satırda boş kalır; dördüncü telefon şemayı değiştirmeyi gerektirir.", "It caps the number arbitrarily and is empty in most rows; a fourth phone needs a schema change.")],
        [tl("Bileşik öznitelik (alt elipsler)", "A composite attribute (sub-ellipses)"), false, tl("Bileşik öznitelik tek bir değerin parçalarıdır (Name = Fname + Lname); birden çok değer değil.", "A composite attribute is the parts of one value (Name = Fname + Lname), not several values.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n  Phones multi\n", tl("Çok değerli öznitelik Adım 6'da kendi tablosuna gider: PK (Ssn, Phones). Bir çalışanın kaç telefonu olursa o kadar satır.", "Step 6 moves the multivalued attribute to its own table with PK (Ssn, Phones): one row per phone, however many there are.")) },
    { q: tl("Gereksinim: \"Bir bağımlı yalnızca çalıştığı kişi üzerinden tanınır; iki çalışanın aynı adlı çocukları olabilir.\" DEPENDENT nedir?", "Requirement: \"A dependent is identified only through the employee; two employees may have children with the same name.\" What is DEPENDENT?"),
      opts: [[tl("Name anahtarlı normal bir varlık", "A regular entity keyed by Name"), false, tl("İki çalışanın aynı adlı çocukları varsa Name tek başına benzersiz değildir; anahtar olamaz.", "If two employees have children with the same name, Name alone is not unique; it cannot be a key.")],
        [tl("Name kısmi anahtarlı zayıf varlık", "A weak entity with partial key Name"), true, tl("Doğru. Kendi anahtarı yok; sahibinin anahtarı (Ssn) ile kısmi anahtarı (Name) birlikte tanımlar. Tanımlayıcı ilişkiye katılımı total.", "Right. It has no key of its own; the owner's key (Ssn) together with the partial key (Name) identifies it. Its participation in the identifying relationship is total.")],
        [tl("EMPLOYEE'nin çok değerli bir özniteliği", "A multivalued attribute of EMPLOYEE"), false, tl("Bağımlının kendi öznitelikleri (Sex, Birth_date) ve ilişkileri olabilir; bunu bir öznitelik taşıyamaz.", "A dependent has attributes of its own (Sex, Birth_date) and may have relationships; an attribute cannot carry that.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n\nweak entity DEPENDENT\n  Name partial\n  Sex\n  Birth_date\n\nidentifying relationship DEPENDENTS_OF: EMPLOYEE 1, DEPENDENT N total\n", tl("Adım 2: zayıf varlığın tablosu sahibin PK'sını FK olarak alır ve PK'sı (EMPLOYEE_Ssn, Name) olur.", "Step 2: the weak entity's table takes the owner's PK as an FK, and its PK becomes (EMPLOYEE_Ssn, Name).")) },
    { q: tl("Gereksinim: \"Her çalışan birden çok projede, her projede birden çok çalışan çalışır; her çalışanın her projedeki haftalık saati tutulur.\" Hours nereye konur?", "Requirement: \"Each employee works on several projects and each project has several employees; the weekly hours of each employee on each project are kept.\" Where does Hours go?"),
      opts: [[tl("EMPLOYEE'ye", "On EMPLOYEE"), false, tl("Bir çalışanın her projede ayrı saati var; EMPLOYEE'de tek bir Hours hangisini tutacak?", "An employee has separate hours on each project; which one would a single Hours on EMPLOYEE hold?")],
        [tl("PROJECT'e", "On PROJECT"), false, tl("Aynı sorun öbür taraftan: bir projede her çalışanın saati farklı.", "The same problem from the other side: each employee on a project has different hours.")],
        [tl("WORKS_ON ilişkisine (M:N)", "On the WORKS_ON relationship (M:N)"), true, tl("Doğru. Hours bir (çalışan, proje) çiftinin özelliğidir; M:N ilişkinin özniteliği olur.", "Right. Hours describes an (employee, project) pair; it becomes an attribute of the M:N relationship.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n\nentity PROJECT\n  Number key\n  Name\n\nrelationship WORKS_ON: EMPLOYEE M total, PROJECT N total\n  Hours\n", tl("Adım 5: M:N ilişki kendi tablosu olur; PK iki FK'dan oluşur ve Hours oraya gider.", "Step 5: the M:N relationship becomes its own table; its PK is made of the two FKs, and Hours goes there.")) },
    { q: tl("Gereksinim: \"Her departmanı bir çalışan yönetir; bir çalışan en fazla bir departman yönetir; yönetmeye başladığı tarih tutulur.\" Start_date nereye konur?", "Requirement: \"Each department is managed by one employee; an employee manages at most one department; the date management started is kept.\" Where does Start_date go?"),
      opts: [[tl("MANAGES ilişkisine", "On the MANAGES relationship"), true, tl("Doğru. Tarih yönetme olayının özelliğidir. 1:1 olduğu için eşlemede DEPARTMENT tablosuna taşınır (total katılan taraf).", "Right. The date describes the managing. Since it is 1:1, the mapping moves it into DEPARTMENT (the side with total participation).")],
        [tl("EMPLOYEE'ye", "On EMPLOYEE"), false, tl("Çalışanların çoğu yönetici değil; bu sütun çoğu satırda NULL kalır ve anlamı belirsizleşir.", "Most employees are not managers; the column would be NULL in most rows and its meaning unclear.")],
        [tl("Ayrı bir START_DATE varlığına", "On a separate START_DATE entity"), false, tl("Bir tarih kendi başına tanınan bir nesne değildir; varlık yapmak gereksiz bir ilişki ekler.", "A date is not an object identified on its own; making it an entity adds a needless relationship.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n\nentity DEPARTMENT\n  Number key\n  Name\n\nrelationship MANAGES: EMPLOYEE 1 role=manager, DEPARTMENT 1 total\n  Start_date\n", tl("Adım 3 (1:1): FK ve ilişkinin özniteliği total katılan DEPARTMENT'a eklenir, böylece NULL olmaz.", "Step 3 (1:1): the FK and the relationship's attribute go into DEPARTMENT, which participates totally, so they are never NULL.")) },
    { q: tl("Gereksinim: \"Her çalışan bir departmanda çalışmak zorundadır; bir departmanda birçok çalışan olabilir.\" EMPLOYEE'nin WORKS_FOR'a katılımı nasıl çizilir?", "Requirement: \"Every employee must work in a department; a department may have many employees.\" How is EMPLOYEE's participation in WORKS_FOR drawn?"),
      opts: [[tl("Tek çizgi, N tarafı", "A single line, the N side"), false, tl("Tek çizgi kısmi katılımdır: departmanı olmayan çalışana izin verir.", "A single line is partial participation: it allows an employee without a department.")],
        [tl("Çift çizgi (total), N tarafı", "A double line (total), the N side"), true, tl("Doğru. 'Zorundadır' total katılımdır (min = 1); 'birçok çalışan' EMPLOYEE'yi N tarafı yapar.", "Right. 'Must' is total participation (min = 1); 'many employees' puts EMPLOYEE on the N side.")],
        [tl("Çift çizgi, 1 tarafı", "A double line, the 1 side"), false, tl("1 tarafı departmandır: bir çalışan bir departmanda, bir departmanda N çalışan.", "The 1 side is the department: an employee is in one department, a department has N employees.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n\nentity DEPARTMENT\n  Number key\n  Name\n\nrelationship WORKS_FOR: EMPLOYEE N total, DEPARTMENT 1\n", tl("Adım 4 (1:N): FK N tarafına (EMPLOYEE) eklenir. Total katılım tabloda FK'nın NOT NULL olmasıdır.", "Step 4 (1:N): the FK goes to the N side (EMPLOYEE). Total participation becomes NOT NULL on that FK.")) },
  ],

  "eer-decide": () => [
    { q: tl("Gereksinim: \"Bir kişi aynı anda hem öğrenci hem çalışan olabilir; her kişi ikisinden biri olmak zorunda değil.\" PERSON'ın özelleştirmesi nedir?", "Requirement: \"A person can be a student and an employee at the same time; a person need not be either.\" What is PERSON's specialization?"),
      opts: [[tl("Overlapping, partial", "Overlapping, partial"), true, tl("Doğru. İkisi birden olabilir: overlapping (o). Hiçbiri olmayabilir: partial (tek çizgi).", "Right. Both at once is allowed: overlapping (o). Neither is allowed: partial (single line).")],
        [tl("Disjoint, total", "Disjoint, total"), false, tl("Disjoint ikisinin birden olmasını yasaklar; total de her kişinin birinde olmasını ister. İkisi de gereksinime ters.", "Disjoint forbids both at once and total requires every person to be in one; both contradict the requirement.")],
        [tl("Overlapping, total", "Overlapping, total"), false, tl("Total, her kişinin en az bir alt sınıfta olmasını ister; gereksinim buna izin veriyor ama zorlamıyor.", "Total requires every person in at least one subclass; the requirement allows this but does not demand it.")]],
      detail: model("entity PERSON\n  Ssn key\n  Name\n\nentity STUDENT\n  Major\n\nentity EMPLOYEE\n  Salary\n\nspecialization PERSON -> STUDENT, EMPLOYEE overlapping partial\n", tl("8A: her alt sınıf üst sınıfın PK'sıyla kendi tablosunu alır. Overlapping olduğu için bir Ssn iki alt tabloda birden bulunabilir.", "8A: each subclass gets its own table with the superclass PK. Being overlapping, one Ssn may be in both subclass tables.")) },
    { q: tl("Gereksinim: \"Her ödeme ya saatlik ya maaşlıdır, ikisi birden değil.\" EMPLOYEE'nin bu özelleştirmesi nedir?", "Requirement: \"Every employee is paid either hourly or salaried, never both.\" What is this specialization of EMPLOYEE?"),
      opts: [[tl("Disjoint, total", "Disjoint, total"), true, tl("Doğru. 'İkisi birden değil': disjoint (d). 'Her çalışan': total (çift çizgi).", "Right. 'Never both': disjoint (d). 'Every employee': total (double line).")],
        [tl("Disjoint, partial", "Disjoint, partial"), false, tl("Partial, hiçbir ödeme biçimi olmayan çalışana izin verir; gereksinim 'her çalışan' diyor.", "Partial allows an employee with no pay method; the requirement says 'every employee'.")],
        [tl("Overlapping, total", "Overlapping, total"), false, tl("Overlapping bir çalışanın hem saatlik hem maaşlı olmasına izin verir.", "Overlapping would allow an employee to be both hourly and salaried.")]],
      detail: model("entity EMPLOYEE\n  Ssn key\n  Name\n\nentity HOURLY_EMPLOYEE\n  Pay_scale\n\nentity SALARIED_EMPLOYEE\n  Salary\n\nspecialization EMPLOYEE -> HOURLY_EMPLOYEE, SALARIED_EMPLOYEE disjoint total\n", tl("Disjoint ve total olduğu için 8B de mümkündür (yalnızca alt sınıf tabloları); burada 8C, tek tablo ve bir tip sütunu.", "Being disjoint and total, 8B (subclass tables only) is also possible; here 8C, one table with a type column."), { spec: "8C" }) },
    { q: tl("Gereksinim: \"Bir aracın sahibi bir kişi, bir banka ya da bir şirket olabilir.\" OWNER nasıl modellenir?", "Requirement: \"A vehicle's owner may be a person, a bank or a company.\" How is OWNER modelled?"),
      opts: [[tl("PERSON, BANK ve COMPANY'nin üst sınıfı", "The superclass of PERSON, BANK and COMPANY"), false, tl("Üst sınıf, alt sınıflarının ortak anahtarını ve özniteliklerini paylaşır; kişi, banka ve şirketin ortak anahtarı yok.", "A superclass shares one key and its attributes with its subclasses; a person, a bank and a company have no common key.")],
        [tl("Bir kategori (union type): PERSON ∪ BANK ∪ COMPANY", "A category (union type): PERSON ∪ BANK ∪ COMPANY"), true, tl("Doğru. Farklı anahtarlı varlık tiplerinin birleşiminin bir alt kümesi: kategori. Her sahip bu üçünden yalnızca birindendir.", "Right. A subset of the union of entity types with different keys: a category. Each owner comes from exactly one of the three.")],
        [tl("Üç ayrı OWNS ilişkisi", "Three separate OWNS relationships"), false, tl("Çalışır ama 'sahip' kavramı kaybolur: OWNS'un öznitelikleri (alış tarihi) üç kez tekrarlanır.", "It works but loses the notion of 'owner': OWNS's attributes (purchase date) are repeated three times.")]],
      detail: model("entity PERSON\n  Ssn key\n  Name\n\nentity BANK\n  Bname key\n\nentity COMPANY\n  Cname key\n\nentity OWNER\n\ncategory OWNER = PERSON | BANK | COMPANY partial\n", tl("Adım 9: anahtarları farklı olduğu için OWNER yapay bir anahtar (OWNER_id) alır; her üst sınıf tablosuna FK olarak eklenir.", "Step 9: since the keys differ, OWNER gets a surrogate key (OWNER_id), added as an FK to each superclass table.")) },
    { q: tl("Gereksinim: \"Bir parça hem üretilmiş hem satın alınmış olabilir; her parça en az birindendir.\" Hangi eşleme seçeneği en az tabloyla bunu tutar?", "Requirement: \"A part may be both manufactured and purchased; each part is at least one.\" Which mapping option keeps this with the fewest tables?"),
      opts: [[tl("8C: tek tablo, tek tip sütunu", "8C: one table, one type column"), false, tl("Tek tip sütunu tek bir değer alır; hem üretilmiş hem satın alınmış bir parçayı gösteremez.", "One type column holds one value; it cannot show a part that is both manufactured and purchased.")],
        [tl("8D: tek tablo, her alt sınıf için bir Boolean bayrak", "8D: one table, a Boolean flag per subclass"), true, tl("Doğru. Mflag ve Pflag aynı satırda ikisi birden doğru olabilir; overlapping için tasarlanmış seçenek.", "Right. Mflag and Pflag can both be true on the same row; this is the option designed for overlapping.")],
        [tl("8B: yalnızca alt sınıf tabloları", "8B: subclass tables only"), false, tl("8B overlapping'de aynı parçayı iki tabloda tekrarlar (ortak öznitelikler iki kez).", "With overlapping, 8B repeats the same part in two tables (the shared attributes twice).")]],
      detail: model("entity PART\n  Part_no key\n  Description\n\nentity MANUFACTURED_PART\n  Batch_no\n\nentity PURCHASED_PART\n  Supplier_name\n\nspecialization PART -> MANUFACTURED_PART, PURCHASED_PART overlapping total\n", tl("8D: bütün öznitelikler tek tabloda; bayraklar hangi alt sınıflarda olduğunu söyler. Alt sınıfın öznitelikleri o sınıfta olmayanlar için NULL kalır.", "8D: every attribute in one table; the flags say which subclasses a part is in. A subclass's attributes stay NULL for parts not in it."), { spec: "8D" }) },
  ],
};

for (const [id, bank] of Object.entries(BANKS)) {
  const host = $("#" + id);
  if (host) decidePlayer(host, bank(), { detailLabel: tl("Doğru model ve tabloları", "The right model and its tables") });
}
