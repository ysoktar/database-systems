// "You decide" banks for the SQL chapters (Ch 5, 6, 7). Each answer is followed by a worked solution that runs on the
// page's MySQL: queries step by step (sqlSteps), data changes inside a transaction that is rolled back (changeSteps).
import "../layout.js";
import { $ } from "../lib/ui.js";
import { decidePlayer, sqlSteps, changeSteps } from "../lib/decide.js";
import { t as tl } from "../lib/i18n.js";

const V = () => tl("Geçerli: bütün kısıtları sağlar", "Valid: it satisfies every constraint");
const KEY = () => tl("Key kısıtını ihlal eder", "It violates the key constraint");
const REF = () => tl("Referential integrity'yi ihlal eder", "It violates referential integrity");
const ENT = () => tl("Entity integrity'yi ihlal eder", "It violates entity integrity");

const BANKS = {
  // ---- Ch 5: which constraint does this change violate?
  "con-decide": () => [
    { q: tl("Bu satırı eklemek hangi kısıtı ihlal eder?", "Which constraint does inserting this row violate?"),
      pre: "INSERT INTO DEPENDENT VALUES ('453453453', 'Joy', 'F', '1990-01-01', 'Daughter');",
      opts: [[V(), true, tl("Doğru. PK (Essn, Dependent_name) = ('453453453', 'Joy') yeni, NULL değil; Essn 453453453 EMPLOYEE'de var (English).", "Right. The PK (Essn, Dependent_name) = ('453453453', 'Joy') is new and not NULL; Essn 453453453 is in EMPLOYEE (English).")],
        [REF(), false, tl("Essn = 453453453 EMPLOYEE'de var (Joyce English); FK'nın gösterdiği satır mevcut.", "Essn = 453453453 is in EMPLOYEE (Joyce English); the row the FK points to exists.")],
        [KEY(), false, tl("English'in henüz hiç bağımlısı yok, dolayısıyla ('453453453', 'Joy') daha önce yok.", "English has no dependents yet, so ('453453453', 'Joy') does not exist yet.")]],
      detail: () => changeSteps([{ label: tl("Ekle ve English'in bağımlılarına bak", "Insert and look at English's dependents"), sql: "INSERT INTO DEPENDENT VALUES ('453453453', 'Joy', 'F', '1990-01-01', 'Daughter');", show: "SELECT * FROM DEPENDENT WHERE Essn = '453453453';" }]) },
    { q: tl("Smith (123456789) zaten proje 1'de 32.5 saat çalışıyor. Bu ekleme ne olur?", "Smith (123456789) already works 32.5 hours on project 1. What happens to this insert?"),
      pre: "INSERT INTO WORKS_ON VALUES ('123456789', 1, 10.0);",
      opts: [[V(), false, tl("Saatin farklı olması yetmez: PK (Essn, Pno)'dur ve ('123456789', 1) zaten var.", "A different number of hours is not enough: the PK is (Essn, Pno) and ('123456789', 1) already exists.")],
        [KEY(), true, tl("Doğru. WORKS_ON'un PK'sı (Essn, Pno); aynı çift ikinci kez eklenemez (MySQL 1062).", "Right. WORKS_ON's PK is (Essn, Pno); the same pair cannot be inserted twice (MySQL 1062).")],
        [REF(), false, tl("Hem çalışan 123456789 hem proje 1 var; FK'lar sağlanıyor. Sorun PK'da.", "Both employee 123456789 and project 1 exist; the FKs hold. The problem is the PK.")]],
      detail: () => changeSteps([{ label: tl("Eklemeyi dene", "Try the insert"), sql: "INSERT INTO WORKS_ON VALUES ('123456789', 1, 10.0);", show: "SELECT * FROM WORKS_ON WHERE Essn = '123456789';" }]) },
    { q: tl("ProductX'i (proje 1) silmek mümkün mü?", "Can ProductX (project 1) be deleted?"),
      pre: "DELETE FROM PROJECT WHERE Pnumber = 1;",
      opts: [[tl("Evet, PROJECT'te ona referans veren bir sütun yok", "Yes, nothing in PROJECT refers to it"), false, tl("Referans başka tablodan gelir: WORKS_ON.Pno, PROJECT.Pnumber'a referans verir ve Smith ile English proje 1'de çalışıyor.", "The reference comes from another table: WORKS_ON.Pno refers to PROJECT.Pnumber, and Smith and English work on project 1.")],
        [tl("Hayır: referential integrity, WORKS_ON'daki satırlar ona referans veriyor", "No: referential integrity, rows in WORKS_ON refer to it"), true, tl("Doğru. Silme yalnızca referential integrity'yi ihlal edebilir; WORKS_ON.Pno'da ON DELETE eylemi olmadığı için silme reddedilir (1451).", "Right. A delete can only violate referential integrity; WORKS_ON.Pno has no ON DELETE action, so the delete is rejected (1451).")],
        [tl("Hayır: entity integrity", "No: entity integrity"), false, tl("Entity integrity PK'nın NULL olmasıyla ilgilidir; silme onu ihlal edemez.", "Entity integrity is about a NULL PK; a delete cannot violate it.")]],
      detail: () => changeSteps([{ label: tl("Silmeyi dene", "Try the delete"), sql: "DELETE FROM PROJECT WHERE Pnumber = 1;", show: "SELECT Pname, Pnumber, Plocation FROM PROJECT WHERE Pnumber <= 3;" },
        { label: tl("Önce referans veren WORKS_ON satırlarını, sonra projeyi silmek", "Deleting the referring WORKS_ON rows first, then the project"), sql: "DELETE FROM WORKS_ON WHERE Pno = 1;\nDELETE FROM PROJECT WHERE Pnumber = 1;", show: "SELECT Pname, Pnumber, Plocation FROM PROJECT WHERE Pnumber <= 3;", note: tl("Referans veren kalmayınca silme geçer. FK ON DELETE CASCADE olsaydı DBMS bunu kendisi yapardı.", "With no referring rows left the delete goes through. Had the FK been ON DELETE CASCADE, the DBMS would have done this itself.") }]) },
    { q: tl("Wong'un (333445555) bağımlılarını silmek ne olur?", "What happens when Wong's (333445555) dependents are deleted?"),
      pre: "DELETE FROM DEPENDENT WHERE Essn = '333445555';",
      opts: [[tl("Reddedilir: Wong'a referans veriyorlar", "Rejected: they refer to Wong"), false, tl("Yön ters: DEPENDENT, EMPLOYEE'ye referans verir. Referans veren satırı silmek kimseyi yetim bırakmaz.", "The direction is reversed: DEPENDENT refers to EMPLOYEE. Deleting the referring row leaves nobody orphaned.")],
        [tl("Geçerli: 3 satır silinir", "Valid: 3 rows are deleted"), true, tl("Doğru. DEPENDENT'a hiçbir tablo referans vermez; Wong'un üç bağımlısı (Alice, Theodore, Joy) silinir.", "Right. No table refers to DEPENDENT; Wong's three dependents (Alice, Theodore, Joy) are deleted.")],
        [tl("Wong da silinir (cascade)", "Wong is deleted too (cascade)"), false, tl("Cascade referans verilen satır silinince referans verenlere uygulanır, tersine değil.", "Cascade applies to the referring rows when the referenced row is deleted, not the other way round.")]],
      detail: () => changeSteps([{ label: tl("Sil ve DEPENDENT'a bak", "Delete and look at DEPENDENT"), sql: "DELETE FROM DEPENDENT WHERE Essn = '333445555';", show: "SELECT Essn, Dependent_name, Relationship FROM DEPENDENT;" }]) },
    { q: tl("DEPT_LOCATIONS.Dnumber'da ON DELETE CASCADE var. Departman 1 (Headquarters) silinebilir mi?", "DEPT_LOCATIONS.Dnumber has ON DELETE CASCADE. Can department 1 (Headquarters) be deleted?"),
      pre: "DELETE FROM DEPARTMENT WHERE Dnumber = 1;",
      opts: [[tl("Evet; Houston satırı da cascade ile silinir", "Yes; its Houston row is deleted by the cascade too"), false, tl("Cascade yalnızca DEPT_LOCATIONS için geçerli. Borg'un EMPLOYEE.Dno'su da departman 1'i gösteriyor ve o FK'da eylem yok.", "The cascade only covers DEPT_LOCATIONS. Borg's EMPLOYEE.Dno also points to department 1, and that FK has no action.")],
        [tl("Hayır; EMPLOYEE.Dno (Borg) hâlâ ona referans veriyor", "No; EMPLOYEE.Dno (Borg) still refers to it"), true, tl("Doğru. Bir silme, ona referans veren bütün FK'ların izin vermesiyle gerçekleşir; tek bir RESTRICT/NO ACTION FK bütün silmeyi reddettirir.", "Right. A delete goes through only if every FK referring to the row allows it; a single RESTRICT/NO ACTION FK rejects the whole delete.")],
        [tl("Evet; Borg'un Dno'su NULL olur", "Yes; Borg's Dno becomes NULL"), false, tl("SET NULL yalnızca Super_ssn için tanımlı; Dno için değil.", "SET NULL is defined only for Super_ssn, not for Dno.")]],
      detail: () => changeSteps([{ label: tl("Silmeyi dene", "Try the delete"), sql: "DELETE FROM DEPARTMENT WHERE Dnumber = 1;", show: "SELECT * FROM DEPT_LOCATIONS WHERE Dnumber = 1;", note: tl("Reddedilen silme cascade'i de başlatmaz: işlem bir bütündür.", "A rejected delete does not start the cascade either: the statement is all or nothing.") }]) },
    { q: tl("Houston'daki konumları olmayan bir departmana (9) taşımak ne olur?", "What happens when the Houston locations are moved to a department (9) that does not exist?"),
      pre: "UPDATE DEPT_LOCATIONS SET Dnumber = 9 WHERE Dlocation = 'Houston';",
      opts: [[tl("Referential integrity ihlali (departman 9 yok)", "A referential integrity violation (there is no department 9)"), true, tl("Doğru. FK'yı değiştirmek, yeni değerin referans verilen tabloda olmasını ister (1452).", "Right. Changing an FK requires the new value to exist in the referenced table (1452).")],
        [KEY(), false, tl("(9, 'Houston') yeni bir çift; key tekrarı yok. Sorun 9'un DEPARTMENT'ta olmaması.", "(9, 'Houston') is a new pair; no key repeats. The problem is that 9 is not in DEPARTMENT.")],
        [V(), false, tl("DEPT_LOCATIONS.Dnumber bir FK; 9 DEPARTMENT'ta yok.", "DEPT_LOCATIONS.Dnumber is an FK; 9 is not in DEPARTMENT.")]],
      detail: () => changeSteps([{ label: tl("Güncellemeyi dene", "Try the update"), sql: "UPDATE DEPT_LOCATIONS SET Dnumber = 9 WHERE Dlocation = 'Houston';", show: "SELECT * FROM DEPT_LOCATIONS;" },
        { label: tl("Headquarters'ın Houston konumunu var olan bir departmana (4) taşımak", "Moving Headquarters' Houston location to an existing department (4)"), sql: "UPDATE DEPT_LOCATIONS SET Dnumber = 4 WHERE Dnumber = 1;", show: "SELECT * FROM DEPT_LOCATIONS;", note: tl("4 var olduğu ve (4, 'Houston') henüz olmadığı için güncelleme geçer. İki Houston satırını birden 4'e taşımak ise (4, 'Houston')'u iki kez üretir ve key kısıtını ihlal ederdi.", "Department 4 exists and (4, 'Houston') does not yet, so the update goes through. Moving both Houston rows to 4 at once would produce (4, 'Houston') twice and violate the key constraint.") }]) },
  ],

  // ---- Ch 6: predict what a basic statement does
  "sql-decide": () => [
    { q: tl("EMPLOYEE'de 8 çalışan var; üçünün maaşı 25000. SELECT DISTINCT Salary FROM EMPLOYEE kaç satır döndürür?", "EMPLOYEE has 8 employees; three earn 25000. How many rows does SELECT DISTINCT Salary FROM EMPLOYEE return?"),
      opts: [["8", false, tl("8, DISTINCT'siz sonuçtur. DISTINCT tekrar eden 25000'leri teke indirir.", "8 is the result without DISTINCT. DISTINCT reduces the repeated 25000s to one.")],
        ["6", true, tl("Doğru. 8 değerden üç 25000 bir satıra iner: 8 − 2 = 6.", "Right. Of the 8 values the three 25000s become one row: 8 − 2 = 6.")],
        ["5", false, tl("Yalnızca 25000 tekrar ediyor; diğer beş maaş farklı. 5 + 1 = 6.", "Only 25000 repeats; the other five salaries differ. 5 + 1 = 6.")]],
      detail: () => sqlSteps([
        { label: tl("1. SELECT Salary: tekrarlarla (SQL bir multiset döndürür)", "1. SELECT Salary: with duplicates (SQL returns a multiset)"), input: "SELECT Fname, Salary FROM EMPLOYEE", sql: "SELECT Salary FROM EMPLOYEE" },
        { label: tl("2. DISTINCT: tekrarlar silinir", "2. DISTINCT: duplicates removed"), sql: "SELECT DISTINCT Salary FROM EMPLOYEE" }]) },
    { q: tl("Her çalışanın adı ve departmanının adı istendi; WHERE yazılmadı. Kaç satır gelir?", "Each employee's name and department name was wanted, but no WHERE was written. How many rows come back?"),
      pre: "SELECT Fname, Dname FROM EMPLOYEE, DEPARTMENT;",
      opts: [[tl("8: her çalışan bir kez", "8: each employee once"), false, tl("FROM'daki iki tablo, koşul yoksa kartezyen çarpım verir; eşleşmeyi WHERE'deki join koşulu yapar.", "Two tables in FROM give a Cartesian product without a condition; the join condition in WHERE does the matching.")],
        [tl("24: her çalışan her departmanla", "24: each employee with each department"), true, tl("Doğru. 8 × 3 = 24. Join koşulu Dno = Dnumber eklenince her çalışan yalnızca kendi departmanıyla kalır (8 satır).", "Right. 8 × 3 = 24. Adding the join condition Dno = Dnumber keeps each employee only with their own department (8 rows).")],
        [tl("Hata: join koşulu eksik", "An error: the join condition is missing"), false, tl("Koşulsuz FROM geçerli SQL'dir; sessizce kartezyen çarpım döndürür. Bu yüzden hatası fark edilmesi zordur.", "A FROM without a condition is valid SQL; it silently returns the Cartesian product. That is why the mistake is hard to notice.")]],
      detail: () => sqlSteps([
        { label: tl("1. FROM: kartezyen çarpım", "1. FROM: the Cartesian product"), input: "SELECT Dnumber, Dname FROM DEPARTMENT", sql: "SELECT Fname, Dno, Dnumber, Dname FROM EMPLOYEE, DEPARTMENT" },
        { label: tl("2. WHERE Dno = Dnumber: yalnızca eşleşen çiftler", "2. WHERE Dno = Dnumber: only the matching pairs"), sql: "SELECT Fname, Dno, Dnumber, Dname FROM EMPLOYEE, DEPARTMENT WHERE Dno = Dnumber" },
        { label: tl("3. SELECT: istenen sütunlar", "3. SELECT: the wanted columns"), sql: "SELECT Fname, Dname FROM EMPLOYEE, DEPARTMENT WHERE Dno = Dnumber" }]) },
    { q: tl("Adresi Houston'da olan çalışanlar için hangi koşul doğru?", "Which condition finds the employees whose address is in Houston?"),
      opts: [["WHERE Address = 'Houston'", false, tl("= tam eşitlik ister; adres '731 Fondren, Houston, TX' gibi bir metin, 'Houston'a eşit değil. 0 satır.", "= requires exact equality; an address is text like '731 Fondren, Houston, TX', not equal to 'Houston'. 0 rows.")],
        ["WHERE Address LIKE '%Houston%'", true, tl("Doğru. % herhangi uzunlukta (sıfır dahil) bir metne uyar; 5 çalışan gelir.", "Right. % matches text of any length (zero included); 5 employees come back.")],
        ["WHERE Address LIKE 'Houston'", false, tl("Joker karakter olmadan LIKE de tam eşitlik gibi davranır.", "Without wildcards LIKE behaves like exact equality too.")]],
      detail: () => sqlSteps([
        { label: tl("1. = 'Houston': tam eşitlik", "1. = 'Houston': exact equality"), input: "SELECT Fname, Address FROM EMPLOYEE", sql: "SELECT Fname, Address FROM EMPLOYEE WHERE Address = 'Houston'" },
        { label: tl("2. LIKE '%Houston%': içinde Houston geçen", "2. LIKE '%Houston%': containing Houston"), input: "SELECT Fname, Address FROM EMPLOYEE", sql: "SELECT Fname, Address FROM EMPLOYEE WHERE Address LIKE '%Houston%'" }]) },
    { q: tl("Bu UPDATE kaç satırı değiştirir?", "How many rows does this UPDATE change?"),
      pre: "UPDATE PROJECT SET Plocation = 'Austin';",
      opts: [[tl("Hiçbirini; WHERE olmadan hangi satır olduğu belli değil", "None; without WHERE no row is chosen"), false, tl("Tersine: WHERE yoksa koşul her satır için doğru sayılır.", "The opposite: without WHERE the condition counts as true for every row.")],
        [tl("6: PROJECT'in bütün satırları", "6: every row of PROJECT"), true, tl("Doğru. WHERE'siz UPDATE ve DELETE tablonun tamamına uygulanır; en sık yapılan pahalı hatalardan biri.", "Right. UPDATE and DELETE without WHERE apply to the whole table; one of the most common costly mistakes.")],
        [tl("1: ilk satır", "1: the first row"), false, tl("SQL'de 'ilk satır' diye bir kavram yok; bir küme üzerinde çalışır.", "SQL has no notion of 'the first row'; it works on a set.")]],
      detail: () => changeSteps([{ label: tl("WHERE'siz UPDATE", "UPDATE without WHERE"), sql: "UPDATE PROJECT SET Plocation = 'Austin';", show: "SELECT Pname, Pnumber, Plocation FROM PROJECT;" }]) },
    { q: tl("Administration departmanının (4) çalışanlarını silmek ne olur?", "What happens when the employees of Administration (department 4) are deleted?"),
      pre: "DELETE FROM EMPLOYEE WHERE Dno = 4;",
      opts: [[tl("3 satır silinir", "3 rows are deleted"), false, tl("Wallace, Zelaya ve Jabbar'a WORKS_ON, DEPENDENT ve DEPARTMENT.Mgr_ssn referans veriyor; FK'lar silmeyi engeller.", "WORKS_ON, DEPENDENT and DEPARTMENT.Mgr_ssn refer to Wallace, Zelaya and Jabbar; the FKs block the delete.")],
        [tl("Reddedilir (foreign key) ve hiçbiri silinmez", "It is rejected (foreign key) and none is deleted"), true, tl("Doğru. Tek bir satır bile engellenince bütün komut geri alınır: komut ya tamamen uygulanır ya hiç.", "Right. When even one row is blocked the whole statement is undone: it applies completely or not at all.")],
        [tl("Referansı olmayan satırlar silinir, diğerleri kalır", "The rows without references are deleted, the others stay"), false, tl("Bir SQL komutu atomiktir; kısmen uygulanmaz.", "An SQL statement is atomic; it is never partly applied.")]],
      detail: () => changeSteps([{ label: tl("Silmeyi dene", "Try the delete"), sql: "DELETE FROM EMPLOYEE WHERE Dno = 4;", show: "SELECT Fname, Lname, Ssn, Dno FROM EMPLOYEE WHERE Dno = 4;" }]) },
  ],

  // ---- Ch 7 (joins and grouping)
  "join-decide": () => [
    { q: tl("Her çalışanı amiriyle listeleyin; amiri olmayan Borg da görünmeli. Hangi join?", "List every employee with their supervisor; Borg, who has none, must appear too. Which join?"),
      opts: [["EMPLOYEE E JOIN EMPLOYEE S ON E.Super_ssn = S.Ssn", false, tl("Inner join eşleşmeyeni atar: Borg'un Super_ssn'i NULL, hiçbir satırla eşleşmez. 7 satır.", "An inner join drops the unmatched: Borg's Super_ssn is NULL and matches no row. 7 rows.")],
        ["EMPLOYEE E LEFT JOIN EMPLOYEE S ON E.Super_ssn = S.Ssn", true, tl("Doğru. LEFT JOIN soldaki her satırı tutar; eşleşmeyenin sağ sütunları NULL olur. 8 satır.", "Right. LEFT JOIN keeps every row on the left; an unmatched row gets NULLs on the right. 8 rows.")],
        ["EMPLOYEE E NATURAL JOIN EMPLOYEE S", false, tl("Natural join aynı adlı bütün sütunlarda eşler; bir tablo kendisiyle natural join yapılınca her satır yalnızca kendisiyle eşleşir.", "A natural join matches on every same-named column; joining a table with itself this way matches each row only with itself.")]],
      detail: () => sqlSteps([
        { label: tl("1. Inner join: eşleşenler", "1. Inner join: the matches"), input: "SELECT Lname, Super_ssn FROM EMPLOYEE", sql: "SELECT E.Lname AS Employee, S.Lname AS Supervisor FROM EMPLOYEE E JOIN EMPLOYEE S ON E.Super_ssn = S.Ssn" },
        { label: tl("2. Left join: eşleşmeyen Borg da, NULL ile", "2. Left join: unmatched Borg too, with NULL"), sql: "SELECT E.Lname AS Employee, S.Lname AS Supervisor FROM EMPLOYEE E LEFT JOIN EMPLOYEE S ON E.Super_ssn = S.Ssn" }]) },
    { q: tl("SELECT COUNT(*), COUNT(Super_ssn) FROM EMPLOYEE ne döndürür?", "What does SELECT COUNT(*), COUNT(Super_ssn) FROM EMPLOYEE return?"),
      opts: [["8, 8", false, tl("COUNT(sütun) NULL'ları saymaz; Borg'un Super_ssn'i NULL.", "COUNT(column) does not count NULLs; Borg's Super_ssn is NULL.")],
        ["8, 7", true, tl("Doğru. COUNT(*) satırları, COUNT(Super_ssn) NULL olmayan değerleri sayar.", "Right. COUNT(*) counts rows, COUNT(Super_ssn) counts non-NULL values.")],
        ["8, 3", false, tl("3, farklı amirlerin sayısı olurdu: COUNT(DISTINCT Super_ssn).", "3 would be the number of distinct supervisors: COUNT(DISTINCT Super_ssn).")]],
      detail: () => sqlSteps([
        { label: tl("Girdi ve sayımlar", "The input and the counts"), input: "SELECT Lname, Super_ssn FROM EMPLOYEE", sql: "SELECT COUNT(*), COUNT(Super_ssn), COUNT(DISTINCT Super_ssn) FROM EMPLOYEE" }]) },
    { q: tl("Ortalama maaşı 33000'den yüksek departmanlar için hangisi doğru?", "Which is right for the departments whose average salary is above 33000?"),
      opts: [["SELECT Dno, AVG(Salary) FROM EMPLOYEE WHERE AVG(Salary) > 33000 GROUP BY Dno", false, tl("WHERE gruplamadan önce, tek tek satırlar üzerinde çalışır; o anda AVG yoktur. MySQL hata verir (1111).", "WHERE runs before grouping, on single rows; there is no AVG yet. MySQL gives an error (1111).")],
        ["SELECT Dno, AVG(Salary) FROM EMPLOYEE GROUP BY Dno HAVING AVG(Salary) > 33000", true, tl("Doğru. HAVING gruplardan sonra çalışır ve grup üzerindeki koşulları süzer: departman 5 (33250) ve 1 (55000).", "Right. HAVING runs after grouping and filters on conditions over groups: departments 5 (33250) and 1 (55000).")],
        ["SELECT Dno, AVG(Salary) FROM EMPLOYEE WHERE Salary > 33000 GROUP BY Dno", false, tl("Bu, 33000'den fazla kazananların ortalamasını alır; departmanın ortalamasını süzmez. Departman 4 de (Wallace, 43000) gelir.", "This averages only those earning over 33000; it does not filter the department's average. Department 4 comes too (Wallace, 43000).")]],
      detail: () => sqlSteps([
        { label: tl("1. FROM: satırlar", "1. FROM: the rows"), input: "SELECT Dno, Salary FROM EMPLOYEE", sql: "SELECT Dno, Salary FROM EMPLOYEE ORDER BY Dno" },
        { label: tl("2. GROUP BY Dno: her grup için ortalama", "2. GROUP BY Dno: the average of each group"), sql: "SELECT Dno, AVG(Salary) FROM EMPLOYEE GROUP BY Dno" },
        { label: tl("3. HAVING: koşulu sağlayan gruplar", "3. HAVING: the groups satisfying the condition"), sql: "SELECT Dno, AVG(Salary) FROM EMPLOYEE GROUP BY Dno HAVING AVG(Salary) > 33000" }]) },
    { q: tl("Bu sorgu neden hata verir?", "Why does this query give an error?"),
      pre: "SELECT Dno, Lname, COUNT(*) FROM EMPLOYEE GROUP BY Dno;",
      opts: [[tl("COUNT(*) GROUP BY ile kullanılamaz", "COUNT(*) cannot be used with GROUP BY"), false, tl("COUNT(*) tam da GROUP BY ile kullanılır: her grubun satır sayısı.", "COUNT(*) is exactly what GROUP BY is used with: each group's row count.")],
        [tl("Lname grupta tek bir değer değil", "Lname is not a single value in a group"), true, tl("Doğru. Departman 5'in grubunda dört soyadı var; hangisinin yazılacağı belli değil. SELECT'te yalnızca gruplama sütunları ve aggregate'ler olabilir (MySQL 1055).", "Right. Department 5's group has four last names; which to print is undefined. SELECT may hold only grouping columns and aggregates (MySQL 1055).")],
        [tl("GROUP BY'da birden çok sütun olmalı", "GROUP BY must have several columns"), false, tl("Tek sütunla gruplamak geçerlidir; sorun SELECT'teki Lname.", "Grouping by one column is valid; the problem is Lname in SELECT.")]],
      detail: () => sqlSteps([
        { label: tl("1. Gruplar: departman 5'te dört soyadı", "1. The groups: four last names in department 5"), input: "SELECT Dno, Lname FROM EMPLOYEE ORDER BY Dno", sql: "SELECT Dno, GROUP_CONCAT(Lname) AS Lnames, COUNT(*) FROM EMPLOYEE GROUP BY Dno" },
        { label: tl("2. Asıl sorgu: hata", "2. The query itself: an error"), sql: "SELECT Dno, Lname, COUNT(*) FROM EMPLOYEE GROUP BY Dno" }]) },
  ],

  // ---- Ch 7 (NULL and nested queries)
  "nested-decide": () => [
    { q: tl("Amiri olmayan çalışanlar için WHERE Super_ssn = NULL kaç satır döndürür?", "For the employees with no supervisor, how many rows does WHERE Super_ssn = NULL return?"),
      opts: [["1 (Borg)", false, tl("NULL ile = karşılaştırması TRUE değil UNKNOWN verir; WHERE yalnızca TRUE olanları tutar.", "Comparing with NULL using = gives UNKNOWN, not TRUE; WHERE keeps only TRUE rows.")],
        ["0", true, tl("Doğru. Her satırda koşul UNKNOWN olur. Doğrusu: WHERE Super_ssn IS NULL (1 satır).", "Right. The condition is UNKNOWN on every row. The right form: WHERE Super_ssn IS NULL (1 row).")],
        [tl("Hata", "An error"), false, tl("= NULL sözdizimsel olarak geçerlidir; yalnızca hiçbir zaman TRUE olmaz.", "= NULL is syntactically valid; it is just never TRUE.")]],
      detail: () => sqlSteps([
        { label: "1. = NULL", input: "SELECT Lname, Super_ssn FROM EMPLOYEE", sql: "SELECT Lname, Super_ssn FROM EMPLOYEE WHERE Super_ssn = NULL" },
        { label: "2. IS NULL", input: "SELECT Lname, Super_ssn FROM EMPLOYEE", sql: "SELECT Lname, Super_ssn FROM EMPLOYEE WHERE Super_ssn IS NULL" }]) },
    { q: tl("Kimsenin amiri olmayan çalışanlar (5 kişi) için bu sorgu kaç satır döndürür?", "How many rows does this query return for the employees who supervise nobody (5 people)?"),
      pre: "SELECT Lname FROM EMPLOYEE\nWHERE Ssn NOT IN (SELECT Super_ssn FROM EMPLOYEE);",
      opts: [["5", false, tl("Alt sorgunun sonucunda Borg'dan gelen bir NULL var. x NOT IN (…, NULL) hiçbir zaman TRUE olamaz.", "The subquery's result holds a NULL from Borg. x NOT IN (…, NULL) can never be TRUE.")],
        ["0", true, tl("Doğru. NOT IN, listedeki her değerle ≠ demektir; NULL ile ≠ UNKNOWN verir, AND'in sonucu da TRUE olamaz. Çözüm: alt sorguya WHERE Super_ssn IS NOT NULL ya da NOT EXISTS.", "Right. NOT IN means ≠ every value in the list; ≠ NULL gives UNKNOWN, so the AND can never be TRUE. Fix: add WHERE Super_ssn IS NOT NULL to the subquery, or use NOT EXISTS.")],
        ["3", false, tl("3, amirlerin sayısıdır (Wong, Wallace, Borg); NOT IN onları değil diğerlerini istiyor, ama NULL yüzünden hiçbiri gelmez.", "3 is the number of supervisors (Wong, Wallace, Borg); NOT IN asks for the others, but because of the NULL none come back.")]],
      detail: () => sqlSteps([
        { label: tl("1. Alt sorgu: bir NULL içeriyor", "1. The subquery: it contains a NULL"), input: "SELECT Lname, Super_ssn FROM EMPLOYEE", sql: "SELECT Super_ssn FROM EMPLOYEE" },
        { label: tl("2. NOT IN: 0 satır", "2. NOT IN: 0 rows"), input: "SELECT Lname, Ssn FROM EMPLOYEE", sql: "SELECT Lname FROM EMPLOYEE WHERE Ssn NOT IN (SELECT Super_ssn FROM EMPLOYEE)" },
        { label: tl("3. Düzeltme: NULL'ı alt sorgudan çıkar", "3. The fix: remove the NULL from the subquery"), input: "SELECT Lname, Ssn FROM EMPLOYEE", sql: "SELECT Lname FROM EMPLOYEE WHERE Ssn NOT IN (SELECT Super_ssn FROM EMPLOYEE WHERE Super_ssn IS NOT NULL)" }]) },
    { q: tl("Maaşı departman 5'teki herkesten yüksek olanlar kimler?", "Who earns more than everybody in department 5?"),
      pre: "SELECT Lname, Salary FROM EMPLOYEE\nWHERE Salary > ALL (SELECT Salary FROM EMPLOYEE WHERE Dno = 5);",
      opts: [[tl("Yalnızca Borg", "Only Borg"), false, tl("Departman 5'in en yüksek maaşı 40000 (Wong); Wallace'ın 43000'i de ondan büyük.", "Department 5's highest salary is 40000 (Wong); Wallace's 43000 is larger too.")],
        [tl("Wallace ve Borg", "Wallace and Borg"), true, tl("Doğru. > ALL, alt sorgunun en büyüğünden (40000) büyük olmak demektir: 43000 ve 55000.", "Right. > ALL means larger than the subquery's maximum (40000): 43000 and 55000.")],
        [tl("Departman 5 dışındaki herkes", "Everybody outside department 5"), false, tl("> ALL departmanı değil maaşı karşılaştırır; Zelaya (25000) ve Jabbar (25000) 40000'den büyük değil.", "> ALL compares salaries, not departments; Zelaya (25000) and Jabbar (25000) are not above 40000.")]],
      detail: () => sqlSteps([
        { label: tl("1. Alt sorgu: departman 5'in maaşları", "1. The subquery: department 5's salaries"), input: "SELECT Lname, Salary, Dno FROM EMPLOYEE", sql: "SELECT Salary FROM EMPLOYEE WHERE Dno = 5" },
        { label: tl("2. > ALL: hepsinden büyük olanlar", "2. > ALL: those larger than all of them"), input: "SELECT Lname, Salary FROM EMPLOYEE", sql: "SELECT Lname, Salary FROM EMPLOYEE WHERE Salary > ALL (SELECT Salary FROM EMPLOYEE WHERE Dno = 5)" }]) },
    { q: tl("Hiç bağımlısı olmayan çalışanlar için NOT EXISTS'li sorguda alt sorgu nasıl olmalı?", "For the employees with no dependents, what must the subquery of the NOT EXISTS query be?"),
      opts: [["NOT EXISTS (SELECT * FROM DEPENDENT)", false, tl("Bu alt sorgu dış satıra bağlı değil: DEPENDENT boş olmadığı için her çalışan için FALSE olur, 0 satır.", "This subquery does not depend on the outer row: DEPENDENT is not empty, so it is FALSE for every employee, 0 rows.")],
        ["NOT EXISTS (SELECT * FROM DEPENDENT D WHERE D.Essn = E.Ssn)", true, tl("Doğru. Correlated alt sorgu her çalışan için yeniden değerlendirilir: o çalışanın bağımlısı yoksa boştur ve NOT EXISTS TRUE olur. 5 çalışan.", "Right. The correlated subquery is evaluated again for each employee: it is empty when that employee has no dependents, and NOT EXISTS is TRUE. 5 employees.")],
        ["NOT EXISTS (SELECT Essn FROM DEPENDENT WHERE Essn IS NULL)", false, tl("Essn PK'nın parçası, hiç NULL değil; alt sorgu her zaman boş olur ve herkes gelir.", "Essn is part of the PK and never NULL; the subquery is always empty and everybody comes back.")]],
      detail: () => sqlSteps([
        { label: tl("1. Bağımlısı olanlar", "1. Those with dependents"), input: "SELECT Lname, Ssn FROM EMPLOYEE", sql: "SELECT DISTINCT Essn FROM DEPENDENT" },
        { label: tl("2. NOT EXISTS (correlated): her çalışan için ayrı ayrı", "2. NOT EXISTS (correlated): for each employee separately"), input: "SELECT Lname, Ssn FROM EMPLOYEE", sql: "SELECT Lname FROM EMPLOYEE E WHERE NOT EXISTS (SELECT * FROM DEPENDENT D WHERE D.Essn = E.Ssn)" }]) },
  ],
};

for (const [id, bank] of Object.entries(BANKS)) {
  const host = $("#" + id);
  if (host) decidePlayer(host, bank());
}
