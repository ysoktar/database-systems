// Exam-style SQL problems on COMPANY for the midterm guide. The expected answer of each is its model solution run on
// the same database; test/exam.test.mjs checks that every solution returns `rows` rows on the Figure 5.6 state.
export const SQL_PROBLEMS = [
  {
    id: "p1", level: 1, title: "Departman özeti",
    text: "Her departman için departmanın adını, yöneticisinin adını ve soyadını ve departmanın kaç farklı konumu olduğunu listeleyin.",
    hint: "Üç tablo: DEPARTMENT, yöneticisi için EMPLOYEE, konumlar için DEPT_LOCATIONS. Konumları saymak için gruplayın.",
    rows: 3,
    solution: `SELECT   D.Dname, E.Fname, E.Lname, COUNT(L.Dlocation) AS Num_locations
FROM     DEPARTMENT D
         JOIN EMPLOYEE E ON D.Mgr_ssn = E.Ssn
         LEFT JOIN DEPT_LOCATIONS L ON L.Dnumber = D.Dnumber
GROUP BY D.Dnumber, D.Dname, E.Fname, E.Lname;`,
    explain: "Gruplama sütunları SELECT'teki aggregate olmayan bütün sütunları içermeli. LEFT JOIN, hiç konumu olmayan bir departmanı da (COUNT = 0) gösterir; bu veride her departmanın en az bir konumu var.",
  },
  {
    id: "p2", level: 1, title: "Bağımlısı olmayan yöneticiler",
    text: "Hiç bağımlısı (dependent) olmayan departman yöneticilerinin adını ve soyadını listeleyin.",
    hint: "İki koşul: (1) bir departmanın Mgr_ssn'i, (2) DEPENDENT'ta satırı yok. NOT EXISTS ya da EXCEPT.",
    rows: 1,
    solution: `SELECT E.Fname, E.Lname
FROM   EMPLOYEE E JOIN DEPARTMENT D ON D.Mgr_ssn = E.Ssn
WHERE  NOT EXISTS (SELECT * FROM DEPENDENT P WHERE P.Essn = E.Ssn);`,
    explain: "Yöneticiler Wong, Wallace ve Borg. Wong ile Wallace'ın bağımlıları var, Borg'un yok. Kitabın alıştırmalarında sık geçen bir soru.",
  },
  {
    id: "p3", level: 2, title: "Houston projesi, Houston'da olmayan departman",
    text: "Houston'da bulunan bir projede çalışan, ama departmanının Houston'da hiçbir konumu olmayan çalışanların adını ve soyadını listeleyin.",
    hint: "PROJECT.Plocation ile DEPT_LOCATIONS.Dlocation farklı tablolarda. İkinci koşul bir NOT EXISTS (ya da NOT IN).",
    rows: 1,
    solution: `SELECT DISTINCT E.Fname, E.Lname
FROM   EMPLOYEE E, WORKS_ON W, PROJECT P
WHERE  E.Ssn = W.Essn AND W.Pno = P.Pnumber AND P.Plocation = 'Houston'
  AND  NOT EXISTS (SELECT *
                   FROM   DEPT_LOCATIONS L
                   WHERE  L.Dnumber = E.Dno AND L.Dlocation = 'Houston');`,
    explain: "Houston projeleri ProductZ ve Reorganization; çalışanları Narayan, Wong (dept 5), Wallace (dept 4), Borg (dept 1). Houston'da konumu olan departmanlar 1 ve 5. Geriye Wallace kalır. Wong iki Houston projesinde çalıştığı için, DISTINCT olmasa ve koşul sağlansaydı iki kez görünürdü.",
  },
  {
    id: "p4", level: 2, title: "Ortalamanın üstündeki departmanlar",
    text: "Çalışanlarının ortalama maaşı, şirketin genel ortalama maaşından yüksek olan departmanların adını ve ortalama maaşını listeleyin.",
    hint: "Grup koşulu HAVING'e; şirket ortalaması bir (correlated olmayan) alt sorgu.",
    rows: 1,
    solution: `SELECT   D.Dname, AVG(E.Salary) AS Avg_salary
FROM     EMPLOYEE E JOIN DEPARTMENT D ON E.Dno = D.Dnumber
GROUP BY D.Dname
HAVING   AVG(E.Salary) > (SELECT AVG(Salary) FROM EMPLOYEE);`,
    explain: "Şirket ortalaması 35125. Departman ortalamaları: Research 33250, Administration 31000, Headquarters 55000. HAVING içinde alt sorgu kullanılabilir.",
  },
  {
    id: "p5", level: 2, title: "Departman ortalamasının üstünde kazananlar",
    text: "Maaşı, kendi departmanındaki ortalama maaştan yüksek olan çalışanların soyadını, departman numarasını ve maaşını listeleyin.",
    hint: "Her çalışan için kendi departmanının ortalaması: correlated alt sorgu (ya da WITH ile departman ortalamaları).",
    rows: 3,
    solution: `SELECT E.Lname, E.Dno, E.Salary
FROM   EMPLOYEE E
WHERE  E.Salary > (SELECT AVG(X.Salary) FROM EMPLOYEE X WHERE X.Dno = E.Dno);`,
    explain: "Research ortalaması 33250 → Wong (40000) ve Narayan (38000); Administration 31000 → Wallace (43000); Headquarters'ta tek kişi var, kendi ortalamasından büyük olamaz.",
  },
  {
    id: "p6", level: 2, title: "Az çalışan çok projeliler",
    text: "En az iki projede çalışan ve haftalık toplam çalışma saati 40'tan az olan çalışanların soyadını, proje sayısını ve toplam saatini listeleyin.",
    hint: "WORKS_ON'u çalışana göre gruplayın; iki koşul da gruplara ait.",
    rows: 1,
    solution: `SELECT   E.Lname, COUNT(*) AS Num_projects, SUM(W.Hours) AS Total_hours
FROM     EMPLOYEE E JOIN WORKS_ON W ON E.Ssn = W.Essn
GROUP BY E.Ssn, E.Lname
HAVING   COUNT(*) >= 2 AND SUM(W.Hours) < 40;`,
    explain: "Çoğu çalışan tam 40 saat çalışıyor (40 < 40 değil). Wallace 20 + 15 = 35 saat, iki projede.",
  },
  {
    id: "p7", level: 3, title: "Kendi departmanının bütün projeleri",
    text: "Kendi departmanının kontrol ettiği <strong>her</strong> projede çalışan çalışanların adını ve soyadını listeleyin. (Departmanı hiç proje kontrol etmeyen olsaydı, o da sonuçta olurdu.)",
    hint: "Bölme: \"departmanının, E'nin çalışmadığı bir projesi yoktur\". Dış NOT EXISTS projeler (Dnum = E.Dno), iç NOT EXISTS WORKS_ON.",
    rows: 3,
    solution: `SELECT E.Fname, E.Lname
FROM   EMPLOYEE E
WHERE  NOT EXISTS (SELECT *
                   FROM   PROJECT P
                   WHERE  P.Dnum = E.Dno
                     AND  NOT EXISTS (SELECT *
                                      FROM   WORKS_ON W
                                      WHERE  W.Essn = E.Ssn AND W.Pno = P.Pnumber));`,
    explain: "Dept 4'ün projeleri 10 ve 30: Zelaya ve Jabbar ikisinde de çalışıyor (Wallace 10'da değil). Dept 1'in tek projesi 20: Borg. Dept 5'in 1, 2, 3 projelerinin hepsinde çalışan yok.",
  },
  {
    id: "p8", level: 3, title: "Her departmanın en genci",
    text: "Her departman için departman adını ve o departmanın <strong>en genç</strong> çalışanının adını, soyadını ve doğum tarihini listeleyin.",
    hint: "En genç = en büyük (en geç) doğum tarihi. Alıştırma 9'daki \"gruptaki en büyük\" kalıbı.",
    rows: 3,
    solution: `SELECT D.Dname, E.Fname, E.Lname, E.Bdate
FROM   EMPLOYEE E JOIN DEPARTMENT D ON E.Dno = D.Dnumber
WHERE  E.Bdate = (SELECT MAX(X.Bdate) FROM EMPLOYEE X WHERE X.Dno = E.Dno);`,
    explain: "Tarihlerde MAX en geç tarihtir, yani en genç kişi. Research: English (1972), Administration: Zelaya (1968), Headquarters: Borg.",
  },
];

// English for the English pages
const SQL_PROBLEMS_EN = {
 "p1": {
  "title": "Department summary",
  "text": "For every department, list the department's name, its manager's first and last name, and how many different locations the department has.",
  "hint": "Three tables: DEPARTMENT, EMPLOYEE for the manager, DEPT_LOCATIONS for the locations. Group to count the locations.",
  "explain": "The grouping columns must include every non-aggregate column of the SELECT. LEFT JOIN would also show a department without locations (COUNT = 0); in this data every department has at least one."
 },
 "p2": {
  "title": "Managers without dependents",
  "text": "List the first and last names of department managers who have no dependents.",
  "hint": "Two conditions: (1) the Mgr_ssn of some department, (2) no row in DEPENDENT. NOT EXISTS or EXCEPT.",
  "explain": "The managers are Wong, Wallace and Borg. Wong and Wallace have dependents, Borg does not. A question that comes up often in the book's exercises."
 },
 "p3": {
  "title": "Houston project, department not in Houston",
  "text": "List the first and last names of employees who work on a project located in Houston but whose department has no location in Houston.",
  "hint": "PROJECT.Plocation and DEPT_LOCATIONS.Dlocation are in different tables. The second condition is a NOT EXISTS (or NOT IN).",
  "explain": "The Houston projects are ProductZ and Reorganization; their employees are Narayan, Wong (dept 5), Wallace (dept 4), Borg (dept 1). The departments with a Houston location are 1 and 5. Wallace is left. Wong works on two Houston projects, so without DISTINCT he would appear twice if the condition held."
 },
 "p4": {
  "title": "Departments above the average",
  "text": "List the name and the average salary of the departments whose employees' average salary is higher than the company's overall average salary.",
  "hint": "The group condition goes in HAVING; the company average is a (non-correlated) subquery.",
  "explain": "The company average is 35125. Department averages: Research 33250, Administration 31000, Headquarters 55000. A subquery can be used inside HAVING."
 },
 "p5": {
  "title": "Earning above their department's average",
  "text": "List the last name, department number and salary of the employees whose salary is higher than the average salary of their own department.",
  "hint": "Each employee's own department average: a correlated subquery (or department averages with WITH).",
  "explain": "Research averages 33250 → Wong (40000) and Narayan (38000); Administration 31000 → Wallace (43000); Headquarters has one person, who cannot earn more than their own average."
 },
 "p6": {
  "title": "Many projects, few hours",
  "text": "List the last name, number of projects and total hours of the employees who work on at least two projects and less than 40 hours a week in total.",
  "hint": "Group WORKS_ON by employee; both conditions are about the groups.",
  "explain": "Most employees work exactly 40 hours (40 < 40 is false). Wallace works 20 + 15 = 35 hours, on two projects."
 },
 "p7": {
  "title": "Every project of one's own department",
  "text": "List the first and last names of the employees who work on <strong>every</strong> project controlled by their own department. (An employee whose department controlled no project would also be in the result.)",
  "hint": "Division: \"their department has no project that E does not work on\". The outer NOT EXISTS ranges over projects (Dnum = E.Dno), the inner one over WORKS_ON.",
  "explain": "Dept 4's projects are 10 and 30: Zelaya and Jabbar work on both (Wallace not on 10). Dept 1's only project is 20: Borg. Nobody works on all of dept 5's projects 1, 2 and 3."
 },
 "p8": {
  "title": "The youngest in each department",
  "text": "For every department, list the department name and the first name, last name and birth date of its <strong>youngest</strong> employee.",
  "hint": "Youngest = the largest (latest) birth date. The \"largest within a group\" pattern of exercise 9.",
  "explain": "On dates MAX is the latest date, i.e. the youngest person. Research: English (1972), Administration: Zelaya (1968), Headquarters: Borg."
 }
};
for (const p of SQL_PROBLEMS) Object.assign(p, Object.fromEntries(Object.entries(SQL_PROBLEMS_EN[p.id]).map(([k, v]) => [`${k}_en`, v])));
