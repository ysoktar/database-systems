// Example ER / EER schemas in the ER studio's language. COMPANY, BANK and the EER examples follow Elmasri & Navathe
// (Figures 3.2, 3.21, 4.1/4.4, 4.8); UNIVERSITY is the worked problem of the midterm guide.
export const ER_EXAMPLES = [
  {
    id: "company", title: "COMPANY", kind: "ER", source: "Figure 3.2",
    layout: { "E:EMPLOYEE": { x: 330, y: 330 }, "E:DEPARTMENT": { x: 760, y: 190 }, "E:PROJECT": { x: 760, y: 530 }, "E:DEPENDENT": { x: 330, y: 660 },
      "R:MANAGES": { x: 560, y: 80 }, "R:WORKS_FOR": { x: 560, y: 245 }, "R:CONTROLS": { x: 760, y: 360 }, "R:WORKS_ON": { x: 560, y: 450 },
      "R:DEPENDENTS_OF": { x: 330, y: 530 }, "R:SUPERVISION": { x: 110, y: 470 } },
    desc: "Kitabın ana örneği: çalışanlar, departmanlar, projeler, bağımlılar. Bütün ER kavramları burada: bileşik, çok değerli, türetilmiş öznitelik, zayıf varlık, recursive ilişki, M:N.",
    dsl: `entity EMPLOYEE
  Ssn key
  Name(Fname, Minit, Lname)
  Bdate
  Address
  Salary
  Sex

entity DEPARTMENT
  Number key
  Name key
  Locations multi
  Number_of_employees derived

entity PROJECT
  Number key
  Name key
  Location

weak entity DEPENDENT
  Name partial
  Sex
  Birth_date
  Relationship

relationship WORKS_FOR: EMPLOYEE N total, DEPARTMENT 1 total
relationship MANAGES: EMPLOYEE 1 role=manager, DEPARTMENT 1 total
  Start_date
relationship CONTROLS: DEPARTMENT 1 role=controlling, PROJECT N total
relationship WORKS_ON: EMPLOYEE M total, PROJECT N total
  Hours
relationship SUPERVISION: EMPLOYEE 1 role=supervisor, EMPLOYEE N role=supervisee
identifying relationship DEPENDENTS_OF: EMPLOYEE 1, DEPENDENT N total
`,
  },
  {
    id: "university", title: "UNIVERSITY", kind: "ER", source: "Arasınav rehberi",
    layout: { "E:STUDENT": { x: 120, y: 220 }, "E:SECTION": { x: 470, y: 220 }, "E:COURSE": { x: 790, y: 220 }, "E:INSTRUCTOR": { x: 470, y: 390 },
      "E:DEPARTMENT": { x: 790, y: 390 }, "R:ENROLLS": { x: 295, y: 220 }, "R:OFFERING_OF": { x: 630, y: 220 }, "R:TEACHES": { x: 470, y: 305 },
      "R:OFFERS": { x: 790, y: 305 }, "R:WORKS_IN": { x: 630, y: 390 }, "R:PREREQ": { x: 790, y: 90 } },
    desc: "Öğrenciler, dersler, şubeler (zayıf varlık), öğretim üyeleri ve bölümler; önkoşul recursive M:N ilişkisi.",
    dsl: `entity STUDENT
  Sid key
  Name
  Phones multi
  Gpa derived

entity COURSE
  Code key
  Title
  Credits

weak entity SECTION
  Sec_no partial
  Semester partial
  Year partial

entity INSTRUCTOR
  Iid key
  Name
  Rank

entity DEPARTMENT
  Dname key
  Building

relationship ENROLLS: STUDENT M, SECTION N
  Grade
identifying relationship OFFERING_OF: COURSE 1, SECTION N total
relationship TEACHES: INSTRUCTOR 1, SECTION N total
relationship OFFERS: DEPARTMENT 1, COURSE N total
relationship WORKS_IN: INSTRUCTOR N total, DEPARTMENT 1
relationship PREREQ: COURSE M role=course, COURSE N role=prerequisite
`,
  },
  {
    id: "bank", title: "BANK", kind: "ER", source: "Figure 3.21",
    desc: "Bankalar, şubeler (zayıf varlık), hesaplar, krediler, müşteriler; iki M:N ilişki.",
    dsl: `entity BANK
  Code key
  Name
  Addr

weak entity BANK_BRANCH
  Branch_no partial
  Addr

entity ACCOUNT
  Acct_no key
  Balance
  Type

entity LOAN
  Loan_no key
  Amount
  Type

entity CUSTOMER
  Ssn key
  Name
  Addr
  Phone

identifying relationship BRANCHES: BANK 1, BANK_BRANCH N total
relationship ACCTS: BANK_BRANCH 1, ACCOUNT N total
relationship LOANS: BANK_BRANCH 1, LOAN N total
relationship A_C: CUSTOMER M, ACCOUNT N total
relationship L_C: CUSTOMER M, LOAN N total
`,
  },
  {
    id: "supply", title: "SUPPLY (üçlü ilişki)", kind: "ER", source: "Figure 3.17",
    desc: "Üçlü (ternary) ilişki: hangi tedarikçi hangi projeye hangi parçayı sağlıyor. Eşleme Adım 7'yi gösterir.",
    dsl: `entity SUPPLIER
  Sname key
  City

entity PROJECT
  Proj_name key

entity PART
  Part_no key
  Description

relationship SUPPLY: SUPPLIER M, PROJECT N, PART P
  Quantity
`,
  },
  {
    id: "employee-eer", title: "EMPLOYEE özelleştirmeleri", kind: "EER", source: "Figure 4.1, 4.4",
    desc: "İş tipine göre disjoint/partial, ödeme biçimine göre disjoint/total özelleştirme ve tek alt sınıflı MANAGER. Eşleme Adım 8 seçeneklerini (8A–8D) karşılaştırmak için.",
    dsl: `entity EMPLOYEE
  Ssn key
  Name(Fname, Minit, Lname)
  Birth_date
  Address
  Job_type

entity SECRETARY
  Typing_speed

entity TECHNICIAN
  Tgrade

entity ENGINEER
  Eng_type

entity HOURLY_EMPLOYEE
  Pay_scale

entity SALARIED_EMPLOYEE
  Salary

entity PROJECT
  Pnumber key
  Pname

relationship MANAGES: MANAGER 1, PROJECT N total

specialization EMPLOYEE -> SECRETARY, TECHNICIAN, ENGINEER disjoint partial on Job_type
specialization EMPLOYEE -> MANAGER
specialization EMPLOYEE -> HOURLY_EMPLOYEE, SALARIED_EMPLOYEE disjoint total
`,
  },
  {
    id: "part-eer", title: "PART (overlapping)", kind: "EER", source: "Figure 4.5",
    desc: "Overlapping ve total özelleştirme: bir parça hem üretilmiş hem satın alınmış olabilir. 8D seçeneği (çok sayıda Boolean tip sütunu) burada anlamlı.",
    dsl: `entity PART
  Part_no key
  Description

entity MANUFACTURED_PART
  Drawing_no
  Manufacture_date
  Batch_no

entity PURCHASED_PART
  Supplier_name
  List_price

specialization PART -> MANUFACTURED_PART, PURCHASED_PART overlapping total
`,
  },
  {
    id: "vehicle-eer", title: "OWNER kategorisi", kind: "EER", source: "Figure 4.8",
    desc: "Kategori (union type): sahip bir kişi, banka ya da şirket olabilir; araçlar arabalar ve kamyonlardan oluşur (total kategori). Eşleme Adım 9 ve yapay anahtar (surrogate key).",
    dsl: `entity PERSON
  Ssn key
  Name
  Address

entity BANK
  Bname key
  Baddress

entity COMPANY
  Cname key
  Caddress

entity OWNER

entity CAR
  Vehicle_id key
  Cstyle
  Cmake

entity TRUCK
  Vehicle_id key
  Tonnage
  Tmake

entity REGISTERED_VEHICLE

category OWNER = PERSON | BANK | COMPANY partial
category REGISTERED_VEHICLE = CAR | TRUCK total

relationship OWNS: OWNER M, REGISTERED_VEHICLE N total
  Purchase_date
  Lien_or_regular
`,
  },
  {
    id: "university-eer", title: "UNIVERSITY EER (lattice)", kind: "EER", source: "Figure 4.7'nin sadeleştirilmişi",
    desc: "PERSON → EMPLOYEE, ALUMNUS, STUDENT (overlapping); STUDENT_ASSISTANT hem EMPLOYEE hem STUDENT (shared subclass, multiple inheritance).",
    dsl: `entity PERSON
  Ssn key
  Name
  Birth_date
  Sex

entity EMPLOYEE
  Salary

entity ALUMNUS
  Degrees multi

entity STUDENT
  Major_dept

entity STUDENT_ASSISTANT
  Percent_time

specialization PERSON -> EMPLOYEE, ALUMNUS, STUDENT overlapping partial
specialization EMPLOYEE -> STUDENT_ASSISTANT
specialization STUDENT -> STUDENT_ASSISTANT
`,
  },
];

export const exampleById = (id) => ER_EXAMPLES.find((e) => e.id === id);
