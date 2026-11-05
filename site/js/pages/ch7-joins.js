import "../layout.js";
import { $ } from "../lib/ui.js";
import { queryStepper } from "../lib/stepper.js";

// ---- join types on EMPLOYEE (managers only, to keep it small) and DEPARTMENT
const E = "(SELECT Lname, Ssn FROM EMPLOYEE WHERE Lname IN ('Wong', 'Wallace', 'Smith', 'Borg'))";
$("#joins").append(queryStepper([
  { label: "INNER JOIN", pad: true,
    note: "Yalnızca eşleşen satır çiftleri. Smith hiçbir departmanı yönetmiyor, sonuçta yok.",
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E INNER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E INNER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "LEFT OUTER JOIN", pad: true,
    note: "Soldaki (EMPLOYEE) <strong>her</strong> satır kalır; eşleşmeyenlerin sağ tarafı NULL ile doldurulur (sarı).",
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "RIGHT OUTER JOIN", pad: true,
    note: "Sağdaki (DEPARTMENT) her satır kalır. Üç departmanın yöneticisi de bu dört kişinin içinde olduğu için sonuç iç join ile aynı. Yöneticisi listede olmayan bir departman olsaydı, Lname = NULL ile görünürdü.",
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "FULL OUTER JOIN", pad: true,
    note: "İki tarafın eşleşmeyen satırları da kalır. Standart SQL'de <code>FULL OUTER JOIN</code> yazılır; MySQL'de bu yoktur, aynı sonuç LEFT ve RIGHT join'in <code>UNION</code>'ıdır (UNION tekrarları, yani iki tarafta da çıkan eşleşmeleri bir kez bırakır). Gösterilen sonuç bu MySQL sürümünün.",
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn UNION SELECT E.Lname, D.Dname FROM ${E} AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY Lname`,
    display: "-- standard SQL\nSELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E FULL OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;\n-- MySQL\nSELECT E.Lname, D.Dname FROM EMPLOYEE AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn\nUNION\nSELECT E.Lname, D.Dname FROM EMPLOYEE AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },

  { label: "CROSS JOIN", note: "Join koşulu yok: kartezyen çarpım, 4 × 3 = 12 satır.",
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E CROSS JOIN DEPARTMENT AS D ORDER BY E.Lname, D.Dname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E CROSS JOIN DEPARTMENT AS D;" },
], { intro: "Örneği küçük tutmak için yalnızca Wong, Wallace, Smith ve Borg (EMPLOYEE'nin bir alt kümesi) ile DEPARTMENT kullanılıyor; ilişki: <em>E yöneticidir</em> (Ssn = Mgr_ssn)." }));

// ---- conceptual evaluation order of a grouped query
const W = "Hours >= 10";
const BASE = `FROM WORKS_ON\nWHERE ${W}`;
$("#order").append(queryStepper([
  { label: "1 · FROM",
    note: "FROM: kullanılacak tablo(lar). Birden çok tablo varsa çarpımları; JOIN varsa join sonucu.",
    sql: "SELECT Essn, Pno, Hours FROM WORKS_ON ORDER BY Pno, Essn",
    display: "FROM WORKS_ON" },
  { label: "2 · WHERE", flag: "keep",
    note: "WHERE: her satır tek tek sınanır; koşulu TRUE olmayanlar (soluk) atılır. Borg'un NULL saati için koşul UNKNOWN'dur, o da atılır. Bu adımda gruplar ve aggregate'ler yoktur.",
    sql: `SELECT Essn, Pno, Hours, COALESCE(${W}, FALSE) AS keep FROM WORKS_ON ORDER BY Pno, Essn`,
    display: BASE },
  { label: "3 · GROUP BY", group: "pno",
    note: "GROUP BY: kalan satırlar Pno değerlerine göre gruplara ayrılır (her renk bir grup).",
    sql: `SELECT Pno, Essn, Hours FROM WORKS_ON WHERE ${W} ORDER BY Pno, Essn`,
    display: `${BASE}\nGROUP BY Pno` },
  { label: "4 · HAVING", flag: "keep",
    note: "HAVING: <strong>gruplar</strong> sınanır; koşulu TRUE olmayan gruplar atılır. Koşul aggregate (COUNT, SUM, …) ya da gruplama sütunu içerebilir.",
    sql: `SELECT Pno, COUNT(*) AS group_size, SUM(Hours) AS total, (SUM(Hours) > 40) AS keep FROM WORKS_ON WHERE ${W} GROUP BY Pno ORDER BY Pno`,
    display: `${BASE}\nGROUP BY Pno\nHAVING SUM(Hours) > 40` },
  { label: "5 · SELECT",
    note: "SELECT: her gruptan <strong>bir</strong> satır üretilir: gruplama sütunları ve aggregate'ler. Alias'lar (Total_hours) burada tanımlanır.",
    sql: `SELECT Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours FROM WORKS_ON WHERE ${W} GROUP BY Pno HAVING SUM(Hours) > 40`,
    display: `SELECT   Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours\n${BASE.replace("FROM", "FROM    ").replace("WHERE", "WHERE   ")}\nGROUP BY Pno\nHAVING   SUM(Hours) > 40` },
  { label: "6 · ORDER BY",
    note: "ORDER BY en son: sonuç sıralanır; SELECT'teki alias'lar burada kullanılabilir.",
    sql: `SELECT Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours FROM WORKS_ON WHERE ${W} GROUP BY Pno HAVING SUM(Hours) > 40 ORDER BY Total_hours DESC, Pno`,
    display: `SELECT   Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours\n${BASE.replace("FROM", "FROM    ").replace("WHERE", "WHERE   ")}\nGROUP BY Pno\nHAVING   SUM(Hours) > 40\nORDER BY Total_hours DESC, Pno` },
], { intro: "Sorgu: <em>en az 10 saatlik WORKS_ON kayıtları arasında, toplamı 40 saati geçen her proje için çalışan sayısı ve toplam saat.</em> Adımlara tek tek tıklayın." }));
