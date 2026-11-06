import "../layout.js";
import { $ } from "../lib/ui.js";
import { queryStepper } from "../lib/stepper.js";
import { t as tl, tx, EN } from "../lib/i18n.js";

// ---- join types on EMPLOYEE (managers only, to keep it small) and DEPARTMENT
const E = "(SELECT Lname, Ssn FROM EMPLOYEE WHERE Lname IN ('Wong', 'Wallace', 'Smith', 'Borg'))";
$("#joins").append(queryStepper([
  { label: "INNER JOIN", pad: true,
    note: tl("Yalnızca eşleşen satır çiftleri. Smith hiçbir departmanı yönetmiyor, sonuçta yok.", "Only matching pairs of rows. Smith manages no department, so he is not in the result."),
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E INNER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E INNER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "LEFT OUTER JOIN", pad: true,
    note: tl("Soldaki (EMPLOYEE) <strong>her</strong> satır kalır; eşleşmeyenlerin sağ tarafı NULL ile doldurulur (sarı).", "<strong>Every</strong> row on the left (EMPLOYEE) stays; unmatched rows get NULLs on the right (yellow)."),
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "RIGHT OUTER JOIN", pad: true,
    note: tl("Sağdaki (DEPARTMENT) her satır kalır. Üç departmanın yöneticisi de bu dört kişinin içinde olduğu için sonuç iç join ile aynı. Yöneticisi listede olmayan bir departman olsaydı, Lname = NULL ile görünürdü.", "Every row on the right (DEPARTMENT) stays. All three managers are among these four people, so the result equals the inner join. A department whose manager is not in the list would show with Lname = NULL."),
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY E.Lname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },
  { label: "FULL OUTER JOIN", pad: true,
    note: tl("İki tarafın eşleşmeyen satırları da kalır. Standart SQL'de <code>FULL OUTER JOIN</code> yazılır; MySQL'de bu yoktur, aynı sonuç LEFT ve RIGHT join'in <code>UNION</code>'ıdır (UNION tekrarları, yani iki tarafta da çıkan eşleşmeleri bir kez bırakır). Gösterilen sonuç bu MySQL sürümünün.", "Unmatched rows of both sides stay. Standard SQL writes <code>FULL OUTER JOIN</code>; MySQL has none, and the same result is the <code>UNION</code> of a LEFT and a RIGHT join (UNION keeps the matches found on both sides once). The result shown is from this MySQL version."),
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn UNION SELECT E.Lname, D.Dname FROM ${E} AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn ORDER BY Lname`,
    display: "-- standard SQL\nSELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E FULL OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;\n-- MySQL\nSELECT E.Lname, D.Dname FROM EMPLOYEE AS E LEFT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn\nUNION\nSELECT E.Lname, D.Dname FROM EMPLOYEE AS E RIGHT OUTER JOIN DEPARTMENT AS D ON E.Ssn = D.Mgr_ssn;" },

  { label: "CROSS JOIN", note: tl("Join koşulu yok: kartezyen çarpım, 4 × 3 = 12 satır.", "No join condition: the Cartesian product, 4 × 3 = 12 rows."),
    sql: `SELECT E.Lname, D.Dname FROM ${E} AS E CROSS JOIN DEPARTMENT AS D ORDER BY E.Lname, D.Dname`,
    display: "SELECT E.Lname, D.Dname\nFROM   EMPLOYEE AS E CROSS JOIN DEPARTMENT AS D;" },
], { intro: tl("Örneği küçük tutmak için yalnızca Wong, Wallace, Smith ve Borg (EMPLOYEE'nin bir alt kümesi) ile DEPARTMENT kullanılıyor; ilişki: <em>E yöneticidir</em> (Ssn = Mgr_ssn).", "To keep the example small only Wong, Wallace, Smith and Borg (a subset of EMPLOYEE) and DEPARTMENT are used; the relationship: <em>E is the manager</em> (Ssn = Mgr_ssn).") }));

// ---- conceptual evaluation order of a grouped query
const W = "Hours >= 10";
const BASE = `FROM WORKS_ON\nWHERE ${W}`;
$("#order").append(queryStepper([
  { label: "1 · FROM",
    note: tl("FROM: kullanılacak tablo(lar). Birden çok tablo varsa çarpımları; JOIN varsa join sonucu.", "FROM: the table(s) to use. With several tables their product; with JOIN the join result."),
    sql: "SELECT Essn, Pno, Hours FROM WORKS_ON ORDER BY Pno, Essn",
    display: "FROM WORKS_ON" },
  { label: "2 · WHERE", flag: "keep",
    note: tl("WHERE: her satır tek tek sınanır; koşulu TRUE olmayanlar (soluk) atılır. Borg'un NULL saati için koşul UNKNOWN'dur, o da atılır. Bu adımda gruplar ve aggregate'ler yoktur.", "WHERE: every row is tested on its own; rows whose condition is not TRUE (faded) are dropped. For Borg's NULL hours the condition is UNKNOWN, so his row goes too. There are no groups or aggregates at this step."),
    sql: `SELECT Essn, Pno, Hours, COALESCE(${W}, FALSE) AS keep FROM WORKS_ON ORDER BY Pno, Essn`,
    display: BASE },
  { label: "3 · GROUP BY", group: "pno",
    note: tl("GROUP BY: kalan satırlar Pno değerlerine göre gruplara ayrılır (her renk bir grup).", "GROUP BY: the remaining rows are split into groups by Pno (each colour is a group)."),
    sql: `SELECT Pno, Essn, Hours FROM WORKS_ON WHERE ${W} ORDER BY Pno, Essn`,
    display: `${BASE}\nGROUP BY Pno` },
  { label: "4 · HAVING", flag: "keep",
    note: tl("HAVING: <strong>gruplar</strong> sınanır; koşulu TRUE olmayan gruplar atılır. Koşul aggregate (COUNT, SUM, …) ya da gruplama sütunu içerebilir.", "HAVING: the <strong>groups</strong> are tested; groups whose condition is not TRUE are dropped. The condition can use aggregates (COUNT, SUM, …) or grouping columns."),
    sql: `SELECT Pno, COUNT(*) AS group_size, SUM(Hours) AS total, (SUM(Hours) > 40) AS keep FROM WORKS_ON WHERE ${W} GROUP BY Pno ORDER BY Pno`,
    display: `${BASE}\nGROUP BY Pno\nHAVING SUM(Hours) > 40` },
  { label: "5 · SELECT",
    note: tl("SELECT: her gruptan <strong>bir</strong> satır üretilir: gruplama sütunları ve aggregate'ler. Alias'lar (Total_hours) burada tanımlanır.", "SELECT: each group produces <strong>one</strong> row: grouping columns and aggregates. Aliases (Total_hours) are defined here."),
    sql: `SELECT Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours FROM WORKS_ON WHERE ${W} GROUP BY Pno HAVING SUM(Hours) > 40`,
    display: `SELECT   Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours\n${BASE.replace("FROM", "FROM    ").replace("WHERE", "WHERE   ")}\nGROUP BY Pno\nHAVING   SUM(Hours) > 40` },
  { label: "6 · ORDER BY",
    note: tl("ORDER BY en son: sonuç sıralanır; SELECT'teki alias'lar burada kullanılabilir.", "ORDER BY comes last: the result is sorted; the aliases of SELECT can be used here."),
    sql: `SELECT Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours FROM WORKS_ON WHERE ${W} GROUP BY Pno HAVING SUM(Hours) > 40 ORDER BY Total_hours DESC, Pno`,
    display: `SELECT   Pno, COUNT(*) AS Num_emps, SUM(Hours) AS Total_hours\n${BASE.replace("FROM", "FROM    ").replace("WHERE", "WHERE   ")}\nGROUP BY Pno\nHAVING   SUM(Hours) > 40\nORDER BY Total_hours DESC, Pno` },
], { intro: tl("Sorgu: <em>en az 10 saatlik WORKS_ON kayıtları arasında, toplamı 40 saati geçen her proje için çalışan sayısı ve toplam saat.</em> Adımlara tek tek tıklayın.", "Query: <em>among WORKS_ON records of at least 10 hours, for every project whose total exceeds 40 hours, the number of employees and the total hours.</em> Click the steps one by one.") }));
