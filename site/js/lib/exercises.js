// The ten exercises of the class notebook (Exercises — Chapters 6 and 7, COMPANY database).
// `expect` is copied from the notebook's _EXPECTED table (fingerprints of the right answer, not the answer itself).
// `solution` and `alt` are this site's model answers; test/exercises.test.mjs runs every one of them on PostgreSQL
// (PGlite) and checks it against the notebook's fingerprint, so a solution shown here is known to be accepted.

export const EXERCISES = [
  {
    n: 1, stars: 1, topic: "Seçim ve sıralama", en: "Selection and ordering", slides: "6-31, 6-42",
    query: "Her <strong>kadın</strong> çalışanın adını, soyadını ve maaşını, maaşa göre <strong>büyükten küçüğe</strong> sıralı listeleyin. Maaşı aynı olanlar soyadına göre alfabetik sıralansın.",
    queryEn: "List the first name, last name and salary of every female employee, ordered by salary from highest to lowest. Employees with the same salary are listed in alphabetical order of last name.",
    columns: "Fname, Lname, Salary", ordered: true,
    hint: "Süzme <code>WHERE</code> ile, sıralama <code>ORDER BY</code> ile yapılır. <code>ORDER BY</code> birden çok sütun alabilir; her birinin kendi <code>ASC</code>/<code>DESC</code>'i olur.",
    expect: { h: "40054dc640fea4726df2", hu: "c9939614aa206456f938", ncols: 3, nrows: 3, ordered: true },
    solution: `SELECT Fname, Lname, Salary
FROM   EMPLOYEE
WHERE  Sex = 'F'
ORDER BY Salary DESC, Lname ASC;`,
    explain: "<code>DESC</code> yalnızca hemen önündeki sütuna uygulanır: <code>ORDER BY Salary DESC, Lname</code> = maaş azalan, eşitlikte soyadı artan. English ile Zelaya'nın maaşı aynı (25000) olduğundan ikinci anahtar sırayı belirler.",
  },
  {
    n: 2, stars: 1, topic: "İki tabloyu birleştirme", en: "Joining two tables", slides: "6-31, 7-19, 7-21",
    query: "<strong>Houston</strong>'da bulunan her proje için proje adını ve projeyi kontrol eden departmanın adını listeleyin.",
    queryEn: "For every project located in Houston, list the project name and the name of the department that controls the project.",
    columns: "Pname, Dname", ordered: false,
    hint: "<code>PROJECT.Dnum</code>, <code>DEPARTMENT.Dnumber</code>'a başvurur (foreign key).",
    expect: { h: null, hu: "c482a5f2479b508189f2", ncols: 2, nrows: 2, ordered: false },
    solution: `SELECT P.Pname, D.Dname
FROM   PROJECT P JOIN DEPARTMENT D ON P.Dnum = D.Dnumber
WHERE  P.Plocation = 'Houston';`,
    alt: [`-- Ch 6 stili: join koşulu WHERE içinde
SELECT Pname, Dname
FROM   PROJECT, DEPARTMENT
WHERE  Dnum = Dnumber AND Plocation = 'Houston';`],
    explain: "Join koşulu (<code>Dnum = Dnumber</code>) ile seçim koşulu (<code>Plocation = 'Houston'</code>) ayrı şeylerdir. Join koşulunu unutursanız 6 × 3 = 18 satırlık bir kartezyen çarpımın Houston satırlarını alırsınız (6 satır).",
  },
  {
    n: 3, stars: 1, topic: "LIKE ve BETWEEN", en: "LIKE and BETWEEN", slides: "6-39, 6-40",
    query: "<strong>Houston'da oturan</strong> ve maaşı <strong>25000 ile 35000 arasında</strong> (iki sınır dahil) olan her çalışanın adını, soyadını ve maaşını listeleyin.",
    queryEn: "List the first name, last name and salary of every employee who lives in Houston and whose salary is between 25000 and 35000 (both limits included).",
    columns: "Fname, Lname, Salary", ordered: false,
    hint: "Adreslerin nasıl yazıldığına dikkat edin, ör. <code>'731 Fondren, Houston, TX'</code> (slayt 6-40). <code>BETWEEN</code> iki sınırı da içerir.",
    expect: { h: null, hu: "b4dda64fd8998d36cdcf", ncols: 3, nrows: 3, ordered: false },
    solution: `SELECT Fname, Lname, Salary
FROM   EMPLOYEE
WHERE  Address LIKE '%Houston%'
  AND  Salary BETWEEN 25000 AND 35000;`,
    explain: "<code>Address = 'Houston'</code> hiçbir satır döndürmez: şehir adresin <em>ortasında</em>. <code>%</code> sıfır ya da daha çok karakter, <code>_</code> tam bir karakter demektir. <code>BETWEEN 25000 AND 35000</code> ≡ <code>Salary &gt;= 25000 AND Salary &lt;= 35000</code>.",
  },
  {
    n: 4, stars: 2, topic: "Self-join", en: "Self-join", slides: "6-34, 6-35",
    query: "<strong>Doğrudan amiriyle farklı departmanda</strong> çalışan her çalışan için çalışanın soyadını ve departman numarasını, ardından amirin soyadını ve departman numarasını listeleyin.",
    queryEn: "For every employee who works in a different department from his or her direct supervisor, list the employee's last name and department number, followed by the supervisor's last name and department number.",
    columns: "çalışan Lname, çalışan Dno, amir Lname, amir Dno", ordered: false,
    hint: "Q8'deki gibi (slayt 6-34) <code>EMPLOYEE</code> tablosunu iki farklı takma adla (alias) iki kez kullanın: biri çalışan, biri amir.",
    expect: { h: null, hu: "185427b186101441f345", ncols: 4, nrows: 2, ordered: false },
    solution: `SELECT E.Lname, E.Dno, S.Lname, S.Dno
FROM   EMPLOYEE AS E, EMPLOYEE AS S
WHERE  E.Super_ssn = S.Ssn
  AND  E.Dno <> S.Dno;`,
    explain: "E ve S aynı tablonun iki ayrı kopyası gibi düşünülür (tuple variables). Borg'un amiri yok (<code>Super_ssn</code> NULL), bu yüzden <code>E.Super_ssn = S.Ssn</code> onun için UNKNOWN olur ve Borg sonuçta çıkmaz, ki istenen de budur.",
  },
  {
    n: 5, stars: 2, topic: "GROUP BY ve HAVING", en: "GROUP BY and HAVING", slides: "7-29 – 7-33",
    query: "Çalışanlarının <strong>haftada toplam 40 saatten fazla</strong> çalıştığı her proje için proje adını, projede çalışan kişi sayısını ve haftalık toplam saati listeleyin. Sonucu toplam saate göre (büyükten küçüğe), eşitlikte proje adına göre sıralayın.",
    queryEn: "For every project on which the employees work more than 40 hours per week in total, list the project name, the number of employees who work on it, and the total weekly hours. Order the result by total hours (largest first); projects with the same total are ordered by project name.",
    columns: "Pname, çalışan sayısı, toplam saat", ordered: true,
    hint: "Bir gruba (toplama) ait koşul <code>WHERE</code>'e değil <code>HAVING</code>'e yazılır (slayt 7-31 – 7-33).",
    expect: { h: "7671838ef847439f82e5", hu: "7671838ef847439f82e5", ncols: 3, nrows: 4, ordered: true },
    solution: `SELECT   P.Pname, COUNT(*) AS Num_emps, SUM(W.Hours) AS Total_hours
FROM     PROJECT P JOIN WORKS_ON W ON P.Pnumber = W.Pno
GROUP BY P.Pnumber, P.Pname
HAVING   SUM(W.Hours) > 40
ORDER BY Total_hours DESC, P.Pname;`,
    explain: "<code>WHERE SUM(Hours) &gt; 40</code> hata verir: <code>WHERE</code> tek tek satırlara, gruplar oluşmadan <em>önce</em> uygulanır. Reorganization projesinde Borg'un saati NULL: <code>COUNT(*)</code> onu sayar (3 kişi) ama <code>SUM</code> NULL'u atlar (25 saat). Reorganization 40'ı geçmediği için sonuçta zaten yok.",
  },
  {
    n: 6, stars: 2, topic: "Outer join ve COUNT", en: "Outer join and COUNT", slides: "7-22, 7-27, 7-30",
    query: "<strong>Her</strong> çalışanın adını ve soyadını, sahip olduğu bağımlı (dependent) sayısıyla birlikte listeleyin; bağımlısı olmayanlar <strong>0</strong> ile görünmeli. Bağımlı sayısına göre (büyükten küçüğe), eşitlikte soyadına göre sıralayın.",
    queryEn: "List the first name and last name of every employee together with the number of dependents he or she has; employees without dependents must appear with 0. Order the result by the number of dependents (largest first), then by last name.",
    columns: "Fname, Lname, bağımlı sayısı", ordered: true,
    hint: "Eşleşen <code>DEPENDENT</code> satırı olmayan çalışanları hangi join korur? Böyle bir çalışan için <code>COUNT(*)</code> neyi sayar?",
    expect: { h: "79cba3f179fbffd54ad4", hu: "4ae1504afb228bd30725", ncols: 3, nrows: 8, ordered: true },
    solution: `SELECT   E.Fname, E.Lname, COUNT(D.Essn) AS Num_dependents
FROM     EMPLOYEE E LEFT OUTER JOIN DEPENDENT D ON E.Ssn = D.Essn
GROUP BY E.Ssn, E.Fname, E.Lname
ORDER BY Num_dependents DESC, E.Lname;`,
    alt: [`-- Correlated subquery in SELECT: no join, no GROUP BY
SELECT   Fname, Lname,
         (SELECT COUNT(*) FROM DEPENDENT D WHERE D.Essn = E.Ssn) AS Num_dependents
FROM     EMPLOYEE E
ORDER BY Num_dependents DESC, Lname;`],
    explain: "İki tuzak var. (1) İç join (inner join) bağımlısı olmayan 5 çalışanı tamamen düşürür. (2) Left join ile <code>COUNT(*)</code> kullanırsanız, NULL ile doldurulmuş satırı da sayar ve bu çalışanlar için 1 verir. <code>COUNT(D.Essn)</code> yalnızca NULL olmayan değerleri sayar, bu yüzden 0 verir.",
  },
  {
    n: 7, stars: 2, topic: "Correlated nested query (EXISTS)", en: "Correlated nested query (EXISTS)", slides: "7-12 – 7-15",
    query: "<strong>Kendi departmanının kontrol etmediği en az bir projede</strong> çalışan çalışanların adını ve soyadını listeleyin. Her çalışan bir kez görünsün.",
    queryEn: "List the first and last names of the employees who work on at least one project that is not controlled by their own department. Each employee appears once.",
    columns: "Fname, Lname", ordered: false,
    hint: "Projenin kontrol eden departmanını (<code>PROJECT.Dnum</code>) çalışanın departmanıyla (<code>EMPLOYEE.Dno</code>) correlated bir <code>EXISTS</code> içinde karşılaştırın (slayt 7-15).",
    expect: { h: null, hu: "a764b77895f9b5b219d2", ncols: 2, nrows: 2, ordered: false },
    solution: `SELECT E.Fname, E.Lname
FROM   EMPLOYEE E
WHERE  EXISTS (SELECT *
               FROM   WORKS_ON W JOIN PROJECT P ON W.Pno = P.Pnumber
               WHERE  W.Essn = E.Ssn AND P.Dnum <> E.Dno);`,
    alt: [`-- Join + DISTINCT (Wong two such projects: DISTINCT removes the duplicate)
SELECT DISTINCT E.Fname, E.Lname
FROM   EMPLOYEE E, WORKS_ON W, PROJECT P
WHERE  E.Ssn = W.Essn AND W.Pno = P.Pnumber AND P.Dnum <> E.Dno;`],
    explain: "İç sorgu dış sorgunun <code>E</code>'sine başvurduğu için correlated'dır: her çalışan için yeniden değerlendirilir. <code>EXISTS</code> her çalışanı en fazla bir kez döndürür. Join ile çözerseniz Wong iki proje (10 ve 20) yüzünden iki kez çıkar, bu yüzden <code>DISTINCT</code> gerekir.",
  },
  {
    n: 8, stars: 3, topic: "Bölme (division): \"her\"", en: "Division: \"every\"", slides: "7-16, 7-17",
    query: "John Smith'in çalıştığı <strong>her</strong> projede çalışan çalışanların adını ve soyadını listeleyin. John Smith'in kendisi dahil edilmesin.",
    queryEn: "List the first and last names of the employees who work on every project that John Smith works on. Do not include John Smith himself.",
    columns: "Fname, Lname", ordered: false,
    hint: "\"Smith'in her projesi\" şu demek: Smith'in, çalışanın <strong>çalışmadığı</strong> bir projesi <strong>yoktur</strong> (çift olumsuzlama, slayt 7-16 ve 7-17).",
    expect: { h: null, hu: "a701146dc032001d6254", ncols: 2, nrows: 1, ordered: false },
    solution: `SELECT E.Fname, E.Lname
FROM   EMPLOYEE E
WHERE  NOT (E.Fname = 'John' AND E.Lname = 'Smith')
  AND  NOT EXISTS (                    -- there is no project of Smith ...
         SELECT W.Pno
         FROM   WORKS_ON W JOIN EMPLOYEE S ON W.Essn = S.Ssn
         WHERE  S.Fname = 'John' AND S.Lname = 'Smith'
           AND  NOT EXISTS (           -- ... that E does not work on
                  SELECT *
                  FROM   WORKS_ON W2
                  WHERE  W2.Essn = E.Ssn AND W2.Pno = W.Pno));`,
    alt: [`-- Set difference (Q3A style, slide 7-16): Smith's projects EXCEPT E's projects is empty
SELECT E.Fname, E.Lname
FROM   EMPLOYEE E
WHERE  E.Ssn <> '123456789'
  AND  NOT EXISTS ( (SELECT Pno FROM WORKS_ON WHERE Essn = '123456789')
                    EXCEPT
                    (SELECT Pno FROM WORKS_ON WHERE Essn = E.Ssn) );`,
      `-- Counting: E works on as many of Smith's projects as Smith has
SELECT E.Fname, E.Lname
FROM   EMPLOYEE E JOIN WORKS_ON W ON W.Essn = E.Ssn
WHERE  E.Ssn <> '123456789'
  AND  W.Pno IN (SELECT Pno FROM WORKS_ON WHERE Essn = '123456789')
GROUP BY E.Ssn, E.Fname, E.Lname
HAVING COUNT(*) = (SELECT COUNT(*) FROM WORKS_ON WHERE Essn = '123456789');`],
    explain: "SQL'de \"her\" (∀) için doğrudan bir operatör yoktur; ∀x P(x) ≡ ¬∃x ¬P(x) dönüşümüyle iki iç içe <code>NOT EXISTS</code> yazılır. Smith 1 ve 2 numaralı projelerde çalışıyor; ikisinde de çalışan tek kişi Joyce English.",
  },
  {
    n: 9, stars: 3, topic: "Her gruptaki en büyük değer", en: "The maximum within each group", slides: "7-11, 7-12, 7-34",
    query: "Her departman için departman adını ve o departmanda <strong>en yüksek maaşı</strong> alan çalışan(lar)ın adını, soyadını ve maaşını listeleyin.",
    queryEn: "For each department, list the department name and the first name, last name and salary of the employee(s) who earn the highest salary in that department.",
    columns: "Dname, Fname, Lname, Salary", ordered: false,
    hint: "Her çalışanın maaşını <strong>kendi</strong> departmanının en yüksek maaşıyla karşılaştırın: correlated bir alt sorgu (slayt 7-12) ya da <code>WITH</code> (slayt 7-34).",
    expect: { h: null, hu: "7e16acc90278a4f29515", ncols: 4, nrows: 3, ordered: false },
    solution: `SELECT D.Dname, E.Fname, E.Lname, E.Salary
FROM   EMPLOYEE E JOIN DEPARTMENT D ON E.Dno = D.Dnumber
WHERE  E.Salary = (SELECT MAX(E2.Salary)
                   FROM   EMPLOYEE E2
                   WHERE  E2.Dno = E.Dno);`,
    alt: [`-- WITH clause: compute each department's maximum once
WITH DEPT_MAX (Dno, Max_sal) AS
     (SELECT Dno, MAX(Salary) FROM EMPLOYEE GROUP BY Dno)
SELECT D.Dname, E.Fname, E.Lname, E.Salary
FROM   EMPLOYEE E JOIN DEPT_MAX M ON E.Dno = M.Dno AND E.Salary = M.Max_sal
       JOIN DEPARTMENT D ON D.Dnumber = E.Dno;`,
      `-- >= ALL (slide 7-11)
SELECT D.Dname, E.Fname, E.Lname, E.Salary
FROM   EMPLOYEE E JOIN DEPARTMENT D ON E.Dno = D.Dnumber
WHERE  E.Salary >= ALL (SELECT Salary FROM EMPLOYEE E2 WHERE E2.Dno = E.Dno);`],
    explain: "Yaygın hata: <code>SELECT Dname, Fname, Lname, MAX(Salary) ... GROUP BY Dname</code>. Fname ve Lname gruplanmadığı ve toplanmadığı için SQL hata verir: bir grubun hangi Fname'ini göstereceği belirsizdir. Önce grubun maksimumunu bulun, sonra o maaşı alan satırları seçin.",
  },
  {
    n: 10, stars: 3, topic: "Recursive query", en: "Recursive query", slides: "7-38, 7-39",
    query: "James Borg'un <strong>doğrudan ya da dolaylı</strong> amiri olduğu tüm çalışanların soyadlarını, Borg'un altındaki seviyeleriyle listeleyin: Borg'un doğrudan yönettikleri 1, 1. seviyedekilerin yönettikleri 2, vb.",
    queryEn: "List the last names of all employees who are supervised by James Borg directly or indirectly, together with their level below Borg: 1 for employees whom Borg supervises directly, 2 for employees supervised by someone at level 1, and so on.",
    columns: "Lname, level", ordered: false,
    hint: "<code>WITH RECURSIVE</code> (slayt 7-39): Borg'un doğrudan astlarıyla seviye 1'den başlayın; her adım, şimdiye kadar bulunan satırların astlarını bir seviye derine ekler.",
    expect: { h: null, hu: "ca9a97ed4e242e1f45b9", ncols: 2, nrows: 7, ordered: false },
    solution: `WITH RECURSIVE SUP_EMP (Ssn, Lname, Level) AS (
    -- base case: Borg's direct supervisees
    SELECT E.Ssn, E.Lname, 1
    FROM   EMPLOYEE E JOIN EMPLOYEE B ON E.Super_ssn = B.Ssn
    WHERE  B.Fname = 'James' AND B.Lname = 'Borg'
  UNION ALL
    -- recursive step: the supervisees of the rows found so far
    SELECT E.Ssn, E.Lname, S.Level + 1
    FROM   EMPLOYEE E JOIN SUP_EMP S ON E.Super_ssn = S.Ssn
)
SELECT Lname, Level FROM SUP_EMP;`,
    explain: "Başlangıç (base) sorgusu Wong ve Wallace'ı (seviye 1) bulur; özyinelemeli adım onların astlarını (Smith, Narayan, English → Wong; Zelaya, Jabbar → Wallace) seviye 2 ile ekler; sonraki adım yeni satır üretmeyince durur. Kitaptaki Q29 (slayt 7-39) aynı yapıdadır ama seviye tutmaz.",
  },
];
