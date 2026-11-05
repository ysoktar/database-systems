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
