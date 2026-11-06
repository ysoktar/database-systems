// "What belongs to this word?": given SQL text and a position (the caret, or the word under the mouse), the parts of the
// text to highlight and a one-line explanation.
//   a clause keyword (SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, ON)  → the whole clause, with its step in
//                                                                                    the conceptual order of evaluation
//   IN / EXISTS / ANY / ALL / SOME before a subquery, or the subquery's parenthesis → the subquery; correlated or not
//   a parenthesis                                                                  → its partner
//   a name (table, alias, column)                                                  → every use of the same name; an
//                                                                                    alias also shows its table
import { wordClass } from "./ui.js";
import { t as tl, EN } from "./i18n.js";
import { COMPANY_SCHEMA } from "./schema.js";
import { SCHEMA_SQL } from "./company.js";

// ---- what the COMPANY schema knows about a name
const ROWS = { EMPLOYEE: 8, DEPARTMENT: 3, DEPT_LOCATIONS: 5, PROJECT: 6, WORKS_ON: 16, DEPENDENT: 7 };
const TYPES = {}; // "EMPLOYEE.SSN" -> "CHAR(9)"
{
  let table = null;
  for (const line of SCHEMA_SQL.split("\n")) {
    const t = /CREATE TABLE (\w+)/.exec(line);
    if (t) { table = t[1]; continue; }
    const c = /^\(?\s*([A-Za-z_]\w*)\s+((?:VARCHAR|CHAR|DECIMAL|INT|DATE)(?:\(\d+(?:,\d+)?\))?)/.exec(line);
    if (table && c && !/^(CONSTRAINT|PRIMARY|FOREIGN)$/i.test(c[1])) TYPES[`${table}.${c[1]}`.toUpperCase()] = c[2];
  }
}
const COLS = []; // { table, col, pk, fk }
for (const t of COMPANY_SCHEMA) for (const [col, kind = "", ref] of t.cols) COLS.push({ table: t.t, col, pk: kind.includes("pk"), fk: kind.includes("fk") ? ref : null });
const TABLE_SET = new Set(COMPANY_SCHEMA.map((t) => t.t));
const pkOf = (t) => COLS.filter((c) => c.table === t && c.pk).map((c) => c.col);
function describeCol(c) {
  const bits = [`${c.table}.${c.col}`, TYPES[`${c.table}.${c.col}`.toUpperCase()]];
  if (c.pk) bits.push(pkOf(c.table).length > 1 ? tl(`birincil anahtarın parçası (${pkOf(c.table).join(", ")})`, `part of the primary key (${pkOf(c.table).join(", ")})`) : tl("birincil anahtar", "primary key"));
  if (c.fk) bits.push(tl(`yabancı anahtar → ${c.fk}`, `foreign key → ${c.fk}`));
  return bits.filter(Boolean).join(" · ");
}

// ---- short explanations of keywords that are not clauses
const WORDS = {
  AS: ["takma ad verir: bir tabloya (FROM EMPLOYEE AS E) ya da bir sonuç sütununa (… AS Total)", "gives an alias: to a table (FROM EMPLOYEE AS E) or to a result column (… AS Total)"],
  DISTINCT: ["sonuçtaki tekrar eden satırları siler (SQL tabloları multiset'tir)", "removes duplicate rows from the result (SQL tables are multisets)"],
  IN: ["değer listedekilerden biri mi? = ANY ile aynı", "is the value one of those in the list? The same as = ANY"],
  BETWEEN: ["iki sınır da dahil: A BETWEEN x AND y ≡ A >= x AND A <= y", "both bounds included: A BETWEEN x AND y ≡ A >= x AND A <= y"],
  LIKE: ["metin kalıbı: % herhangi sayıda karakter, _ tam bir karakter", "a text pattern: % any number of characters, _ exactly one character"],
  IS: ["IS NULL / IS NOT NULL: NULL'u sınamanın tek yolu (= NULL her zaman UNKNOWN)", "IS NULL / IS NOT NULL: the only way to test for NULL (= NULL is always UNKNOWN)"],
  NULL: ["değer yok ya da bilinmiyor; NULL ile her karşılaştırma UNKNOWN verir", "no value, or an unknown one; every comparison with NULL gives UNKNOWN"],
  NOT: ["olumsuzlama; NOT UNKNOWN yine UNKNOWN'dur", "negation; NOT UNKNOWN is still UNKNOWN"],
  AND: ["iki koşul da TRUE olmalı; FALSE sonucu belirler, UNKNOWN AND TRUE = UNKNOWN", "both conditions must be TRUE; FALSE decides, UNKNOWN AND TRUE = UNKNOWN"],
  OR: ["koşullardan biri TRUE olmalı; TRUE sonucu belirler, UNKNOWN OR FALSE = UNKNOWN", "one condition must be TRUE; TRUE decides, UNKNOWN OR FALSE = UNKNOWN"],
  UNION: ["iki sonucun birleşimi, tekrarlar silinir (UNION ALL tutar); sütunlar uyumlu olmalı", "the union of two results, duplicates removed (UNION ALL keeps them); the columns must be compatible"],
  INTERSECT: ["iki sonucun kesişimi: ikisinde de olan satırlar", "the intersection of two results: the rows in both"],
  EXCEPT: ["küme farkı: ilkinde olup ikincisinde olmayan satırlar", "set difference: rows in the first result but not in the second"],
  JOIN: ["iki tabloyu ON koşuluna göre eşleştirir (iç join: yalnızca eşleşenler)", "matches two tables by the ON condition (inner join: only the matching pairs)"],
  LEFT: ["LEFT OUTER JOIN: soldaki her satır kalır, eşi yoksa sağ taraf NULL olur", "LEFT OUTER JOIN: every row of the left table stays; without a match the right side is NULL"],
  RIGHT: ["RIGHT OUTER JOIN: sağdaki her satır kalır, eşi yoksa sol taraf NULL olur", "RIGHT OUTER JOIN: every row of the right table stays; without a match the left side is NULL"],
  NATURAL: ["aynı adlı bütün sütunları eşitler; istemediğiniz ortak adlara dikkat", "equates all same-named columns; beware of common names you did not mean"],
  CROSS: ["kartezyen çarpım: her satır her satırla", "the Cartesian product: every row with every row"],
  COUNT: ["COUNT(*) satırları sayar; COUNT(sütun) NULL'ları atlar; boş kümede 0", "COUNT(*) counts rows; COUNT(column) skips NULLs; 0 on an empty set"],
  SUM: ["NULL olmayan değerlerin toplamı; boş kümede NULL", "the sum of the non-NULL values; NULL on an empty set"],
  AVG: ["NULL olmayan değerlerin ortalaması (NULL 0 sayılmaz)", "the average of the non-NULL values (NULL does not count as 0)"],
  MIN: ["en küçük değer, NULL'lar atlanır", "the smallest value, NULLs skipped"],
  MAX: ["en büyük değer, NULL'lar atlanır", "the largest value, NULLs skipped"],
  CASE: ["koşula göre değer: ilk TRUE olan WHEN'in THEN'i, yoksa ELSE", "a value by condition: the THEN of the first TRUE WHEN, else the ELSE"],
  WITH: ["yalnızca bu sorgu boyunca var olan ara tablo; RECURSIVE ile kendini kullanabilir", "an intermediate table that exists only for this query; with RECURSIVE it can use itself"],
  DESC: ["büyükten küçüğe; yalnızca önündeki sütuna ait", "largest first; applies only to the column before it"],
  ASC: ["küçükten büyüğe (varsayılan)", "smallest first (the default)"],
  INSERT: ["yeni satır ekler; değerler sütun sırasıyla ya da sütun listesiyle", "adds rows; values in column order or with a column list"],
  UPDATE: ["WHERE'i sağlayan satırlarda SET'teki sütunları değiştirir", "changes the SET columns in the rows that satisfy WHERE"],
  DELETE: ["WHERE'i sağlayan satırları siler; WHERE yoksa hepsini (tablo tanımı kalır)", "deletes the rows that satisfy WHERE; without WHERE all of them (the table definition stays)"],
  SET: ["hangi sütunun hangi değeri alacağı; sağ taraftaki sütun eski değerdir", "which column gets which value; a column on the right is the old value"],
  VALUES: ["eklenecek değerler, tablonun sütun sırasıyla", "the values to insert, in the table's column order"],
  PRIMARY: ["birincil anahtar: benzersiz ve NULL olamaz (entity integrity)", "primary key: unique and never NULL (entity integrity)"],
  FOREIGN: ["yabancı anahtar: değer başka bir tablonun anahtarında var olmalı ya da NULL (referential integrity)", "foreign key: the value must exist in another table's key, or be NULL (referential integrity)"],
  REFERENCES: ["yabancı anahtarın referans verdiği tablo ve sütun", "the table and column the foreign key refers to"],
  UNIQUE: ["tekrar eden değere izin vermez (aday anahtar)", "allows no duplicate values (a candidate key)"],
  CHECK: ["her satırın sağlaması gereken koşul; yalnızca o satır değişince kontrol edilir", "a condition each row must satisfy; checked only when that row changes"],
  DEFAULT: ["değer verilmezse kullanılan değer", "the value used when none is given"],
  CASCADE: ["referans verilen satır silinince/değişince referans verenler de silinir/değişir", "when the referenced row is deleted/changed, the referencing rows are too"],
  RESTRICT: ["referans veren satır varsa işlemi reddeder", "rejects the operation if referencing rows exist"],
  CONSTRAINT: ["kısıta ad verir; ad, kısıtı sonra DROP etmek için gerekir", "names a constraint; the name is needed to DROP it later"],
};

const TOKEN = /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^'\\]|''|\\.)*'?)|("(?:[^"]|"")*"?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([()])|(;)|(\.)|(,)|(<>|<=|>=|!=|=|<|>)/g;

/** Tokens with positions and parenthesis depth; comments and strings are kept out of the analysis. */
export function tokenize(src) {
  const toks = [];
  let depth = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const [text, cmt, str, quoted, num, word, paren, semi, dot, comma, op] = m;
    const t = { start: m.index, end: m.index + text.length, text, depth };
    if (cmt) t.type = "comment";
    else if (str) t.type = "string";
    else if (quoted) t.type = "name", t.name = text.slice(1, -1).toLowerCase();
    else if (num) t.type = "number";
    else if (word) {
      t.upper = word.toUpperCase();
      t.type = wordClass(word) ? "keyword" : "name";
      if (t.type === "name") t.name = word.toLowerCase();
    } else if (paren) {
      t.type = paren;
      if (paren === "(") depth++;
      else { depth = Math.max(0, depth - 1); t.depth = depth; }
    } else if (semi) t.type = ";";
    else if (dot) t.type = ".";
    else if (comma) t.type = ",";
    else if (op) t.type = "op";
    toks.push(t);
  }
  return toks.filter((t) => t.type !== "comment");
}

const STEP = {
  FROM: [1, "hangi tablolardan (ve join'lerden) satırlar gelir", "which tables (and joins) the rows come from"],
  WHERE: [2, "koşulu TRUE olan satırları tutar (FALSE ve UNKNOWN atılır)", "keeps the rows for which the condition is TRUE (FALSE and UNKNOWN are dropped)"],
  "GROUP BY": [3, "aynı değerleri taşıyan satırları gruplar", "puts rows with equal values into groups"],
  HAVING: [4, "koşulu TRUE olan grupları tutar", "keeps the groups for which the condition is TRUE"],
  SELECT: [5, "sonucun sütunları", "the columns of the result"],
  "ORDER BY": [6, "sonucu sıralar", "orders the result"],
};
const CLAUSE_END = new Set(["FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT", "UNION", "INTERSECT", "EXCEPT", "INTO", "VALUES", "SET", "WINDOW"]);
const SUBQ = new Set(["IN", "EXISTS", "ANY", "ALL", "SOME"]);
const FROMISH = new Set(["FROM", "JOIN", "UPDATE", "INTO"]);

/** Index of the parenthesis that matches toks[i], or -1. */
function partner(toks, i) {
  const t = toks[i];
  if (t.type === "(") { for (let j = i + 1; j < toks.length; j++) if (toks[j].type === ")" && toks[j].depth === t.depth) return j; }
  if (t.type === ")") { for (let j = i - 1; j >= 0; j--) if (toks[j].type === "(" && toks[j].depth === t.depth) return j; }
  return -1;
}

/** Aliases: EMPLOYEE AS E, EMPLOYEE E (after FROM, JOIN or a comma in a FROM list), with the token range they live in. */
function aliases(toks) {
  const out = [];
  let inFrom = new Map(); // depth -> inside a FROM list
  toks.forEach((t, i) => {
    if (t.type === "keyword" && FROMISH.has(t.upper)) inFrom.set(t.depth, true);
    else if (t.type === "keyword" && CLAUSE_END.has(t.upper) && t.upper !== "FROM") inFrom.set(t.depth, false);
    if (t.type !== "name") return;
    const prev = toks[i - 1];
    const startsItem = prev && ((prev.type === "keyword" && FROMISH.has(prev.upper)) || (prev.type === "," && inFrom.get(t.depth)));
    if (!startsItem) return;
    let j = i + 1;
    if (toks[j]?.upper === "AS") j++;
    const a = toks[j];
    if (a?.type !== "name" || toks[j + 1]?.type === ".") return;
    // the scope of the alias: the parentheses around it (the whole text at depth 0)
    let lo = 0, hi = toks.length - 1;
    for (let k = i; k >= 0; k--) if (toks[k].type === "(" && toks[k].depth < t.depth) { lo = k; hi = partner(toks, k); break; }
    out.push({ alias: a.name, table: t.text, aliasTok: j, tableTok: i, lo, hi: hi < 0 ? toks.length - 1 : hi });
  });
  return out;
}

const range = (toks, a, b, kind) => ({ start: toks[a].start, end: toks[b].end, kind });

/** The clause that starts at toks[i] (a clause keyword): up to the next clause keyword at the same depth. */
function clauseEnd(toks, i) {
  const d = toks[i].depth;
  let j = i + 1;
  if (toks[j]?.upper === "BY") j++;
  for (; j < toks.length; j++) {
    const t = toks[j];
    if (t.depth < d || (t.type === ")" && t.depth === d - 1) || t.type === ";") break;
    if (t.depth === d && t.type === "keyword" && (CLAUSE_END.has(t.upper) || (t.upper === "SELECT" && toks[i].upper !== "SELECT"))) break;
    if (t.depth === d && toks[i].upper === "ON" && t.type === "keyword" && /^(JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|WHERE)$/.test(t.upper)) break;
  }
  return j - 1;
}

/** A subquery between toks[open] and toks[close]: correlated if it uses an alias defined outside it. */
function subquery(toks, open, close, als) {
  const inner = new Set(als.filter((a) => a.aliasTok > open && a.aliasTok < close).map((a) => a.alias));
  const outer = new Set();
  for (let k = open + 1; k < close; k++) {
    if (toks[k].type === "name" && toks[k + 1]?.type === "." && !inner.has(toks[k].name) && als.some((a) => a.alias === toks[k].name && (a.aliasTok < open || a.aliasTok > close))) outer.add(toks[k].text);
  }
  const isQuery = toks[open + 1]?.upper === "SELECT" || toks[open + 1]?.upper === "WITH" || toks[open + 1]?.type === "(";
  if (!isQuery) return null;
  const ranges = [range(toks, open, close, "sub")];
  for (let k = open + 1; k < close; k++) if (toks[k].type === "name" && outer.has(toks[k].text) && toks[k + 1]?.type === ".") ranges.push({ start: toks[k].start, end: toks[k].end, kind: "outer" });
  const label = outer.size
    ? tl(`İç sorgu, correlated: dış sorgunun ${[...outer].join(", ")} satırını kullanır, bu yüzden dış sorgunun her satırı için yeniden hesaplanır`,
      `Subquery, correlated: it uses ${[...outer].join(", ")} of the outer query, so it is computed again for each outer row`)
    : tl("İç sorgu, correlated değil: dış sorgudan bağımsızdır, bir kez hesaplanır", "Subquery, not correlated: independent of the outer query, computed once");
  return { ranges, label };
}

/** The COMPANY tables a query uses (by name), and its aliases resolved to tables. */
function scope(toks, als) {
  const tables = new Set(toks.filter((u) => u.type === "name" && TABLE_SET.has(u.text.toUpperCase())).map((u) => u.text.toUpperCase()));
  return { tables, tableOf: (n) => { const a = als.find((x) => x.alias === n.toLowerCase()); const t = (a ? a.table : n).toUpperCase(); return TABLE_SET.has(t) ? t : null; } };
}
/** The column a name token refers to: { cols: [matching COLS], qualified } (several cols = ambiguous). */
function columnAt(toks, i, sc) {
  const t = toks[i];
  if (toks[i - 1]?.type === "." && toks[i - 2]?.type === "name") {
    const table = sc.tableOf(toks[i - 2].text);
    return { cols: COLS.filter((c) => c.table === table && c.col.toLowerCase() === t.name), qualified: true, qualifier: toks[i - 2].text };
  }
  const cols = COLS.filter((c) => c.col.toLowerCase() === t.name && sc.tables.has(c.table));
  return { cols, qualified: false };
}
/** The operand that ends (dir = -1) or starts (dir = +1) next to toks[i]: [first, last] token indexes and the column, if any. */
function operand(toks, i, dir, sc) {
  let a = i + dir;
  const t = toks[a];
  if (!t) return null;
  if (t.type === "name") {
    let first = a, last = a;
    if (dir < 0 && toks[a - 1]?.type === ".") first = a - 2;
    if (dir > 0 && toks[a + 1]?.type === "." && toks[a + 2]?.type === "name") last = a + 2;
    const colTok = dir < 0 ? a : last;
    return { first, last, col: columnAt(toks, colTok, sc).cols[0] || null };
  }
  if (t.type === "number" || t.type === "string" || (t.type === "keyword" && /^(NULL|TRUE|FALSE)$/.test(t.upper))) return { first: a, last: a, literal: t.text, isNull: t.upper === "NULL" };
  return null;
}
function comparison(toks, i, sc) {
  const L = operand(toks, i, -1, sc), R = operand(toks, i, +1, sc);
  if (!L || !R) return null;
  const ranges = [range(toks, L.first, L.last, "same"), range(toks, i, i, "kw"), range(toks, R.first, R.last, "same")];
  const op = toks[i].text;
  if (L.isNull || R.isNull) return { ranges, label: tl(`${op} NULL her zaman UNKNOWN'dur, hiçbir satırı seçmez: IS NULL / IS NOT NULL yazın`, `${op} NULL is always UNKNOWN and selects no row: write IS NULL / IS NOT NULL`), warn: true };
  if (L.col && R.col) {
    const name = (c) => `${c.table}.${c.col}`;
    const fk = L.col.fk === name(R.col) ? [L.col, R.col] : R.col.fk === name(L.col) ? [R.col, L.col] : null;
    if (op === "=" && fk) return { ranges, label: tl(`Join koşulu: ${name(fk[0])} yabancı anahtarı ${name(fk[1])} anahtarına referans veriyor; her satır, referans verdiği satırla eşleşir`, `Join condition: the foreign key ${name(fk[0])} refers to ${name(fk[1])}; each row is matched with the row it refers to`) };
    if (L.col.table !== R.col.table) return { ranges, label: tl(`${name(L.col)} ile ${name(R.col)} karşılaştırılıyor (iki tabloyu bağlayan bir koşul, ama bir foreign key değil)`, `${name(L.col)} is compared with ${name(R.col)} (a condition between two tables, but not along a foreign key)`) };
    return { ranges, label: tl(`Karşılaştırma: ${name(L.col)} ${op} ${name(R.col)}`, `Comparison: ${name(L.col)} ${op} ${name(R.col)}`) };
  }
  const col = L.col || R.col, lit = L.literal ?? R.literal;
  if (col && lit != null) return { ranges, label: tl(`Seçim koşulu: ${col.table}.${col.col} ${op} ${lit} olan satırlar (değeri NULL olanlar UNKNOWN verir, seçilmez)`, `Selection condition: the rows where ${col.table}.${col.col} ${op} ${lit} (rows where it is NULL give UNKNOWN and are not selected)`) };
  return { ranges, label: null };
}

/** What to highlight for position pos in src: { ranges: [{start, end, kind}], label } or null. */
export function linksAt(src, pos) {
  const toks = tokenize(src);
  let i = toks.findIndex((t) => pos >= t.start && pos < t.end);
  if (i < 0) i = toks.findIndex((t) => pos === t.end && t.type !== "," && t.type !== ";" && t.type !== "."); // caret right after a word
  if (i < 0) return null;
  const t = toks[i];
  const als = aliases(toks);

  if (t.type === "(" || t.type === ")") {
    const j = partner(toks, i);
    if (j < 0) return null;
    const [o, c] = t.type === "(" ? [i, j] : [j, i];
    const sq = subquery(toks, o, c, als);
    if (sq) return { ranges: [...sq.ranges, range(toks, o, o, "match"), range(toks, c, c, "match")], label: sq.label };
    return { ranges: [range(toks, o, o, "match"), range(toks, c, c, "match")], label: null };
  }

  const sc = scope(toks, als);
  if (t.type === "op") return comparison(toks, i, sc);

  if (t.type === "keyword") {
    let k = i, key = t.upper;
    if (key === "BY" && /^(GROUP|ORDER)$/.test(toks[i - 1]?.upper)) { k = i - 1; key = toks[k].upper; }
    if (key === "GROUP" || key === "ORDER") key += " BY";
    if (SUBQ.has(key) && toks[i + 1]?.type === "(") {
      const c = partner(toks, i + 1);
      const sq = c > 0 && subquery(toks, i + 1, c, als);
      if (sq) return { ranges: [range(toks, i, i, "kw"), ...sq.ranges], label: `${key} · ${sq.label}` };
    }
    if (STEP[key] || key === "LIMIT" || key === "ON") {
      const e = clauseEnd(toks, k);
      const [n, tr, en] = STEP[key] || [];
      const label = key === "LIMIT" ? tl("LIMIT · ilk n satırı tutar (ORDER BY'dan sonra)", "LIMIT · keeps the first n rows (after ORDER BY)")
        : key === "ON" ? tl("ON · join koşulu: hangi satır çiftlerinin eşleşeceği", "ON · the join condition: which pairs of rows match")
          : tl(`${key} · ${n}. adım: ${tr}`, `${key} · step ${n}: ${en}`);
      return { ranges: [range(toks, k, e, "clause"), range(toks, k, key.includes(" BY") ? k + 1 : k, "kw")], label };
    }
    if (WORDS[key]) return { ranges: [range(toks, i, i, "kw")], label: `${key} · ${EN ? WORDS[key][1] : WORDS[key][0]}` };
    return null;
  }

  if (t.type === "name") {
    const same = toks.filter((u) => u.type === "name" && u.name === t.name);
    const ranges = same.map((u) => ({ start: u.start, end: u.end, kind: "same" }));
    const al = als.find((a) => a.alias === t.name && toks.indexOf(t) >= a.lo && toks.indexOf(t) <= a.hi) || als.find((a) => a.alias === t.name);
    if (al) {
      ranges.push({ start: toks[al.tableTok].start, end: toks[al.tableTok].end, kind: "def" });
      const n = same.length - 1;
      return { ranges, label: tl(`${t.text} = ${al.table}: takma ad (alias), ${n} yerde kullanılıyor`, `${t.text} = ${al.table}: an alias, used in ${n} place${n === 1 ? "" : "s"}`) };
    }
    const tableOf = als.filter((a) => a.table.toLowerCase() === t.name);
    const T = t.text.toUpperCase();
    if (TABLE_SET.has(T) && toks[i + 1]?.type !== "." ) {
      for (const a of tableOf) for (const u of toks) if (u.type === "name" && u.name === a.alias) ranges.push({ start: u.start, end: u.end, kind: "same" });
      const pk = pkOf(T).join(", ");
      const aliasTxt = tableOf.length ? tl(` · takma adları: ${tableOf.map((a) => toks[a.aliasTok].text).join(", ")}`, ` · aliases: ${tableOf.map((a) => toks[a.aliasTok].text).join(", ")}`) : "";
      return { ranges, label: tl(`${T} tablosu · başlangıçta ${ROWS[T]} satır · birincil anahtar ${pk}${aliasTxt}`, `The table ${T} · ${ROWS[T]} rows at the start · primary key ${pk}${aliasTxt}`) };
    }
    const { cols, qualified, qualifier } = columnAt(toks, i, sc);
    if (cols.length) {
      // the column, and the columns it is tied to by a foreign key (Dno ↔ Dnumber), wherever they appear
      const tied = new Set();
      for (const c of cols) {
        if (c.fk) tied.add(c.fk.split(".")[1].toLowerCase());
        for (const d of COLS) if (d.fk === `${c.table}.${c.col}` && sc.tables.has(d.table)) tied.add(d.col.toLowerCase());
      }
      tied.delete(t.name);
      for (const u of toks) if (u.type === "name" && tied.has(u.name)) ranges.push({ start: u.start, end: u.end, kind: "def" });
      if (!qualified && new Set(cols.map((c) => c.table)).size > 1) {
        return { ranges, label: tl(`${t.text} belirsiz: ${cols.map((c) => c.table).join(" ve ")} tablolarında var; ${cols.map((c) => c.table)[0]}.${t.text} gibi tablo adıyla (ya da takma adla) yazın`, `${t.text} is ambiguous: it is in ${cols.map((c) => c.table).join(" and ")}; qualify it, e.g. ${cols.map((c) => c.table)[0]}.${t.text} (or with an alias)`), warn: true };
      }
      return { ranges, label: describeCol(cols[0]) + (qualified && qualifier.toUpperCase() !== cols[0].table ? tl(` (${qualifier} üzerinden)`, ` (through ${qualifier})`) : "") };
    }
    if (same.length < 2) return { ranges, label: null };
    return { ranges, label: tl(`${t.text}: ${same.length} yerde geçiyor`, `${t.text}: appears in ${same.length} places`) };
  }
  return null;
}

/** HTML for the highlight layer: the text, transparent, with <mark>s behind the ranges (inner ranges win). */
export function marksHTML(src, ranges) {
  const order = { clause: 0, sub: 0, kw: 1, same: 2, def: 2, outer: 3, match: 3 };
  const cls = new Array(src.length).fill(null);
  for (const r of [...ranges].sort((a, b) => order[a.kind] - order[b.kind])) for (let k = r.start; k < r.end; k++) cls[k] = r.kind;
  let out = "", k = 0;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  while (k < src.length) {
    let j = k;
    while (j < src.length && cls[j] === cls[k]) j++;
    const s = esc(src.slice(k, j));
    out += cls[k] ? `<mark class="m-${cls[k]}">${s}</mark>` : s;
    k = j;
  }
  return out;
}
