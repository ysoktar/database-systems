// Ch 11 (PHP web database programming): a three-tier request player (browser → PHP → DBMS, each step before/after),
// PHP string output with "guess first", the Figure 11.3 array statements step by step, a placeholder vs concatenation
// lab that runs both queries on the page's MySQL, and a fetchRow / getAll loop player on real query results.
import "../layout.js";
import { $, h, button } from "../lib/ui.js";
import { runSQL } from "../lib/db.js";
import { relationTable } from "../lib/sqlbox.js";
import { t as tl } from "../lib/i18n.js";

const field = (label, input) => h("label", { class: "small sim-field" }, label, input);
const code = (text) => h("pre", { class: "code-block small-code" }, h("code", {}, text));
const SETUP = `DROP TABLE IF EXISTS demo.EMPLOYEE;
CREATE TABLE demo.EMPLOYEE (Emp_id INT, Name VARCHAR(20), Job VARCHAR(10), Dno INT);
INSERT INTO demo.EMPLOYEE VALUES
  (1, 'John Smith', 'Engineer', 5), (2, 'Franklin Wong', 'Manager', 5), (3, 'Alicia Zelaya', 'Secretary', 4),
  (4, 'Jennifer Wallace', 'Manager', 4), (5, 'Ramesh Narayan', 'Engineer', 5), (6, 'Joyce English', 'Secretary', 5),
  (7, 'Ahmad Jabbar', 'Engineer', 4), (8, 'James Borg', 'Manager', 1)`;
let setupDone = null;
const ensureTable = () => (setupDone ||= runSQL(SETUP));
/** Run SQL on demo.EMPLOYEE (created first if needed); resolves to { cols, rows } or { error }. */
async function query(sql) {
  await ensureTable();
  let r = await runSQL(sql);
  if (r.error && /EMPLOYEE/.test(r.error.message || "")) { setupDone = null; await ensureTable(); r = await runSQL(sql); }
  return r.error ? { error: r.error.message || String(r.error) } : { cols: r.last?.cols || [], rows: r.last?.rows || [] };
}
const kv = (obj, changed = []) => h("div", { class: "tx-vals" }, ...(Object.keys(obj).length ? Object.entries(obj).map(([k, v]) => h("span", { class: "tx-val" + (changed.includes(k) ? " new" : "") }, `${k} = ${v}`)) : [h("span", { class: "muted" }, tl("boş", "empty"))]));

// ---------------------------------------------------------------- three-tier request player
{
  const host = $("#tier-player");
  const TIERS = [["client", tl("İstemci: tarayıcı", "Client: browser")], ["middle", tl("Orta katman: web sunucusu + PHP", "Middle tier: web server + PHP")], ["db", tl("Alt katman: DBMS", "Bottom tier: DBMS")]];
  const FORM_HTML = `<FORM method="post" action="greeting.php">\nEnter your name: <input type="text" name="user_name">\n<BR/>\n<INPUT type="submit" value="SUBMIT NAME">\n</FORM>`;
  const SCEN = {
    greet: { label: tl("Karşılama formu (Figure 11.1)", "Greeting form (Figure 11.1)"), steps: () => [
      { tier: "client", to: "middle", title: tl("Tarayıcı programı ister", "The browser requests the program"), data: "GET /example/greeting.php", post: {}, out: "", note: tl("Kullanıcı adresi açar. Formdan gelen bir değer olmadığı için istekte POST verisi yok.", "The user opens the address. No form value has been sent, so the request carries no POST data.") },
      { tier: "middle", title: tl("PHP çalışır: $_POST['user_name'] boş", "PHP runs: $_POST['user_name'] is empty"), data: "if ($_POST['user_name'])  →  false", post: {}, out: FORM_HTML, note: tl("Koşul yanlış olduğu için else kısmı çalışır ve here document'taki form HTML'i çıktıya yazılır.", "The condition is false, so the else part runs and the form HTML in the here document is printed.") },
      { tier: "client", from: "middle", title: tl("Tarayıcı formu gösterir", "The browser shows the form"), data: tl("HTML yanıtı: form", "HTML response: the form"), post: {}, out: FORM_HTML, note: tl("Tarayıcı yalnızca HTML'i görür; PHP kodu hiçbir zaman istemciye gitmez (Figure 11.1b).", "The browser only sees HTML; the PHP code never reaches the client (Figure 11.1b).") },
      { tier: "client", to: "middle", title: tl("Kullanıcı John Smith yazıp gönderir", "The user types John Smith and submits"), data: "POST /example/greeting.php\nuser_name=John Smith", post: { "user_name": "John Smith" }, out: "", note: tl("Form aynı programa gönderilir; INPUT'un name özniteliği user_name olduğu için değer $_POST['user_name'] olur (Figure 11.1c).", "The form is sent to the same program; the INPUT's name attribute is user_name, so the value becomes $_POST['user_name'] (Figure 11.1c).") },
      { tier: "middle", title: tl("PHP çalışır: bu kez değer var", "PHP runs: this time there is a value"), data: "if ($_POST['user_name'])  →  true", post: { "user_name": "John Smith" }, out: "Welcome, John Smith", note: tl("Koşul doğru: iki print komutu karşılama mesajını yazar.", "The condition is true: the two print statements write the welcome message.") },
      { tier: "client", from: "middle", title: tl("Tarayıcı karşılamayı gösterir", "The browser shows the welcome"), data: tl("HTML yanıtı", "HTML response"), post: { "user_name": "John Smith" }, out: "Welcome, John Smith", note: tl("Figure 11.1d. Bu senaryoda veritabanına hiç gidilmedi; bir sonraki senaryo alt katmanı da kullanır.", "Figure 11.1d. The database was never involved here; the next scenario uses the bottom tier too.") },
    ] },
    db: { label: tl("Veritabanı sorgusu (Figure 11.7)", "Database query (Figure 11.7)"), steps: (rows) => {
      const lines = rows.map((r) => ` ${r[0]}`).join("\n");
      return [
        { tier: "client", to: "middle", title: tl("Kullanıcı formu gönderir", "The user submits the form"), data: "POST /emp.php\nemp_job=Engineer&emp_dno=5", post: { emp_job: "Engineer", emp_dno: "5" }, out: "", note: tl("Kullanıcı bir iş ve departman numarası seçip formu gönderir.", "The user picks a job and a department number and submits the form.") },
        { tier: "middle", to: "db", title: tl("PHP bağlanır ve sorguyu gönderir", "PHP connects and sends the query"), data: "DB::connect('mysql://acct1:pass12@host/db1')\n$d->query('SELECT Name FROM EMPLOYEE WHERE Job = ? AND Dno = ?',\n          array($_POST['emp_job'], $_POST['emp_dno']))", post: { emp_job: "Engineer", emp_dno: "5" }, out: "", note: tl("Değerler placeholder'larla gönderilir; kütüphane onları tırnaklayıp yerine koyar.", "The values are sent with placeholders; the library quotes them and puts them in place.") },
        { tier: "db", from: "middle", title: tl("DBMS sorguyu çalıştırır", "The DBMS runs the query"), data: "SELECT Name FROM demo.EMPLOYEE WHERE Job = 'Engineer' AND Dno = 5", post: { emp_job: "Engineer", emp_dno: "5" }, out: "", rows, note: tl(`Sorgu bu sayfanın MySQL motorunda çalıştı ve ${rows.length} satır döndü.`, `The query ran on this page's MySQL engine and returned ${rows.length} rows.`) },
        { tier: "middle", from: "db", title: tl("PHP satırları dolaşıp HTML üretir", "PHP loops over the rows and builds HTML"), data: "while ($r = $q->fetchRow()) { print \" $r[0] \\n\"; }", post: { emp_job: "Engineer", emp_dno: "5" }, out: `employees in dept 5 whose job is Engineer:\n${lines}`, note: tl("fetchRow her çağrıda bir satır verir; satırlar bitince döngü biter.", "fetchRow returns one row per call; the loop ends when the rows run out.") },
        { tier: "client", from: "middle", title: tl("Tarayıcı sonucu gösterir", "The browser shows the result"), data: tl("HTML yanıtı", "HTML response"), post: { emp_job: "Engineer", emp_dno: "5" }, out: `employees in dept 5 whose job is Engineer:\n${lines}`, note: tl("Kullanıcı yalnızca sonucu görür; SQL komutu da veritabanı da tarayıcıdan gizlidir.", "The user only sees the result; both the SQL command and the database are hidden from the browser.") },
      ];
    } },
  };
  let sid = "greet", i = 0, steps = [];
  const seg = h("div", { class: "stepper-steps", role: "group" });
  const counter = h("span", { class: "pl-count" }), body = h("div");
  const tiersEl = () => h("div", { class: "tiers" }, ...TIERS.flatMap(([k, name], n) => {
    const s = steps[i - 1];
    const box = h("div", { class: "tier" + (s && s.tier === k ? " on" : "") + (s && (s.to === k || s.from === k) ? " peer" : "") }, h("div", { class: "tier-name" }, name));
    if (n === 2) return [box];
    const flow = s && ((s.tier === TIERS[n][0] && s.to === TIERS[n + 1][0]) ? "→" : (s.tier === TIERS[n][0] && s.from === TIERS[n + 1][0]) || (s.tier === TIERS[n + 1][0] && s.from === TIERS[n][0]) ? (s.tier === TIERS[n][0] ? "←" : "→") : (s.tier === TIERS[n + 1][0] && s.to === TIERS[n][0]) ? "←" : "");
    return [box, h("div", { class: "tier-arrow" + (flow ? " on" : "") }, flow || "⇄")];
  }));
  const draw = () => {
    for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.s === sid));
    counter.textContent = tl(`Adım ${i} / ${steps.length}`, `Step ${i} of ${steps.length}`);
    prevB.disabled = i === 0; nextB.disabled = i >= steps.length;
    if (i === 0) { body.replaceChildren(tiersEl(), h("p", { class: "small" }, tl("Sonraki düğmesiyle isteği adım adım izleyin.", "Follow the request step by step with Next."))); return; }
    const s = steps[i - 1], p = steps[i - 2] || { post: {}, out: "" };
    body.replaceChildren(tiersEl(), h("div", { class: "step-title" }, tl(`Adım ${i}: ${s.title}`, `Step ${i}: ${s.title}`)), h("p", { class: "small" }, s.note),
      h("div", { class: "ba-label" }, tl("Taşınan veri ya da çalışan kod", "Data in transit or code running")), code(s.data),
      s.rows ? relationTable(["Name"], null, s.rows) : "",
      h("div", { class: "ba" },
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), h("div", { class: "small" }, h("strong", {}, "$_POST: ")), kv(p.post), h("div", { class: "small", style: { marginTop: "6px" } }, h("strong", {}, tl("Çıktı:", "Output:"))), code(p.out || tl("(henüz yok)", "(none yet)"))),
        h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), h("div", { class: "small" }, h("strong", {}, "$_POST: ")), kv(s.post, Object.keys(s.post).filter((k) => p.post[k] !== s.post[k])), h("div", { class: "small", style: { marginTop: "6px" } }, h("strong", {}, tl("Çıktı:", "Output:"))), code(s.out || tl("(henüz yok)", "(none yet)")))));
  };
  const load = async () => {
    if (sid === "db") { const r = await query("SELECT Name FROM demo.EMPLOYEE WHERE Job = 'Engineer' AND Dno = 5"); steps = SCEN.db.steps(r.rows || []); }
    else steps = SCEN.greet.steps();
    i = 0; draw();
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; draw(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; draw(); }, { kind: "primary" });
  for (const [k, S] of Object.entries(SCEN)) seg.append(h("button", { type: "button", "data-s": k, onclick: () => { sid = k; load(); } }, S.label));
  host.append(h("div", { class: "player" }, seg, h("div", { class: "pl-bar" }, prevB, nextB, counter), body));
  load();
}

// ---------------------------------------------------------------- strings: guess the output
{
  const host = $("#php-strings");
  const nameIn = h("input", { type: "text", value: "John", size: 12 });
  const guess = h("input", { type: "checkbox", checked: true });
  const out = h("div");
  const LINES = [
    [`print 'Welcome to $name';`, (n) => "Welcome to $name", tl("Tek tırnak: değişken yorumlanmaz, $name olduğu gibi yazılır.", "Single quotes: the variable is not interpolated; $name is printed as is.")],
    [`print "Welcome to $name";`, (n) => `Welcome to ${n}`, tl("Çift tırnak: $name'in değeri metne yerleştirilir.", "Double quotes: the value of $name is put into the text.")],
    [`print 'Welcome to ' . $name;`, (n) => `Welcome to ${n}`, tl("Nokta operatörü iki stringi birleştirir.", "The dot operator concatenates the two strings.")],
    [`print "Welcome \\"$name\\"!";`, (n) => `Welcome "${n}"!`, tl("Çift tırnak içinde \\\" bir tırnak işareti yazar.", "Inside double quotes \\\" prints a quote mark.")],
    [`print 'It\\'s ' . strtoupper($name);`, (n) => `It's ${n.toUpperCase()}`, tl("Tek tırnak içinde \\' bir tek tırnak yazar; strtoupper büyük harfe çevirir.", "Inside single quotes \\' prints a single quote; strtoupper converts to upper case.")],
    [`print <<<_HTML_\nHello $name, today is a good day.\n_HTML_;`, (n) => `Hello ${n}, today is a good day.`, tl("Here document de çift tırnak gibi değişkenleri yorumlar; uzun metinler için kullanılır.", "A here document interpolates variables like double quotes; it is used for long texts.")],
    [`$n = strlen($name); print "$name has $n letters";`, (n) => `${n} has ${[...n].length} letters`, tl("strlen stringin uzunluğunu verir; iki değişken de yerleştirilir.", "strlen gives the length of the string; both variables are interpolated.")],
  ];
  const run = () => {
    const n = nameIn.value;
    out.replaceChildren(...LINES.map(([src, f, why]) => {
      const res = h("div", { class: "php-out" + (guess.checked ? " hidden" : "") }, h("code", {}, f(n)), h("span", { class: "small muted" }, " · ", why));
      const row = h("div", { class: "php-line", onclick: () => res.classList.remove("hidden") }, h("pre", { class: "code-block small-code" }, h("code", {}, src)), res);
      return row;
    }));
  };
  nameIn.addEventListener("input", run); guess.addEventListener("change", run);
  host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, field("$name = ", nameIn), h("label", { class: "small pl-predict" }, guess, tl(" Önce tahmin et (çıktıyı görmek için satıra tıklayın)", " Guess first (click a line to see its output)"))), out));
  run();
}

// ---------------------------------------------------------------- arrays (Figure 11.3) step by step
{
  const host = $("#php-arrays");
  const STEPS = [
    [`$teaching = array('Database' => 'Smith', 'OS' => 'Carrick', 'Graphics' => 'Kam');`, () => [["Database", "Smith"], ["OS", "Carrick"], ["Graphics", "Kam"]], tl("İlişkisel bir dizi oluşturulur: anahtarlar ders adları, değerler öğretim üyeleri.", "An associative array is created: the keys are course names, the values instructors.")],
    [`$teaching['Graphics'] = 'Benson';`, (a) => a.map(([k, v]) => [k, k === "Graphics" ? "Benson" : v]), tl("Var olan bir anahtara atama, değerini değiştirir.", "Assigning to an existing key changes its value.")],
    [`$teaching['Data Mining'] = 'Kam';`, (a) => [...a, ["Data Mining", "Kam"]], tl("Yeni bir anahtara atama diziye yeni bir eleman ekler; diziler dinamiktir.", "Assigning to a new key adds an element; arrays are dynamic.")],
    [`print count($teaching);`, (a) => a, tl("count eleman sayısını verir: 4.", "count gives the number of elements: 4."), (a) => String(a.length)],
    [`sort($teaching);`, (a) => [...a].map(([, v]) => v).sort().map((v, i) => [String(i), v]), tl("sort değerleri sıralar ve 0'dan başlayan sayısal indeksler verir: ilişkisel anahtarlar kaybolur!", "sort orders the values and gives numeric indexes from 0: the associative keys are lost!")],
    [`foreach ($teaching as $key => $value) { print " $key : $value\\n"; }`, (a) => a, tl("foreach her elemanı anahtarı ve değeriyle dolaşır.", "foreach visits every element with its key and value."), (a) => a.map(([k, v]) => ` ${k} : ${v}`).join("\n")],
    [`$courses = array('Database', 'OS', 'Graphics', 'Data Mining');`, () => [["0", "Database"], ["1", "OS"], ["2", "Graphics"], ["3", "Data Mining"]], tl("Sayısal bir dizi: indeksler 0, 1, 2, 3 olarak kendiliğinden verilir.", "A numeric array: the indexes 0, 1, 2, 3 are given automatically.")],
    [`for ($i = 0, $num = count($courses); $i < $num; $i++) { print "$i: $courses[$i]\\n"; }`, (a) => a, tl("İndeksle çalışan for döngüsü, count ile eleman sayısını alır.", "An index-based for loop gets the number of elements with count."), (a) => a.map(([k, v]) => `${k}: ${v}`).join("\n")],
  ];
  let i = 0;
  const counter = h("span", { class: "pl-count" }), body = h("div");
  const states = () => { const out = [[]]; for (const [, f] of STEPS) out.push(f(out[out.length - 1])); return out; };
  const arr = (a, prev = null) => h("table", { class: "simple php-arr" }, h("thead", {}, h("tr", {}, h("th", {}, tl("anahtar", "key")), h("th", {}, tl("değer", "value")))),
    h("tbody", {}, ...(a.length ? a.map(([k, v]) => h("tr", { class: prev && !prev.some(([pk, pv]) => pk === k && pv === v) ? "new" : "" }, h("td", {}, /^\d+$/.test(k) ? k : `'${k}'`), h("td", {}, `'${v}'`))) : [h("tr", {}, h("td", { colspan: 2, class: "muted" }, tl("dizi yok", "no array")))])));
  const draw = () => {
    const st = states();
    counter.textContent = tl(`Komut ${i} / ${STEPS.length}`, `Statement ${i} of ${STEPS.length}`);
    prevB.disabled = i === 0; nextB.disabled = i >= STEPS.length;
    if (!i) { body.replaceChildren(h("p", { class: "small" }, tl("Sonraki düğmesi Figure 11.3'ün komutlarını sırayla çalıştırır.", "Next runs the statements of Figure 11.3 one by one."))); return; }
    const [src, , why, outF] = STEPS[i - 1];
    body.replaceChildren(code(src), h("p", { class: "small" }, why),
      h("div", { class: "ba" }, h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), arr(st[i - 1])), h("div", { class: "ba-arrow", "aria-hidden": "true" }),
        h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), arr(st[i], st[i - 1]))),
      outF ? h("div", {}, h("div", { class: "ba-label" }, tl("Çıktı", "Output")), code(outF(st[i]))) : "");
  };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; draw(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; draw(); }, { kind: "primary" });
  host.append(h("div", { class: "player" }, h("div", { class: "pl-bar" }, prevB, nextB, counter), body));
  draw();
}

// ---------------------------------------------------------------- placeholders vs concatenation (runs both)
{
  const host = $("#placeholder-lab");
  const jobIn = h("input", { type: "text", value: "Engineer", size: 22 });
  const dnoIn = h("input", { type: "text", value: "5", size: 12 });
  const left = h("div", { class: "ba-side" }), right = h("div", { class: "ba-side" });
  const quote = (v) => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  let seq = 0;
  const run = async () => {
    const my = ++seq, job = jobIn.value, dno = dnoIn.value;
    const concat = `SELECT Name, Job, Dno FROM demo.EMPLOYEE WHERE Job = '${job}' AND Dno = ${dno}`;
    const bound = `SELECT Name, Job, Dno FROM demo.EMPLOYEE WHERE Job = ${quote(job)} AND Dno = ${quote(dno)}`;
    const [a, b] = [await query(concat), await query(bound)];
    if (my !== seq) return;
    const res = (r) => (r.error ? h("div", { class: "res-msg warn", style: { fontFamily: "inherit" } }, tl(`Hata: ${r.error}`, `Error: ${r.error}`)) : h("div", {}, relationTable(r.cols, null, r.rows), h("p", { class: "small" }, tl(`${r.rows.length} satır`, `${r.rows.length} rows`))));
    left.replaceChildren(h("div", { class: "ba-label" }, tl("String birleştirme (Figure 11.6'daki ilk INSERT gibi)", "String concatenation (like the first INSERT of Figure 11.6)")),
      code(`$q = $d->query("SELECT Name, Job, Dno FROM EMPLOYEE\n  WHERE Job = '$_POST[emp_job]' AND Dno = $_POST[emp_dno]");`), h("div", { class: "small" }, tl("Veritabanına giden SQL:", "SQL sent to the database:")), code(concat), res(a));
    right.replaceChildren(h("div", { class: "ba-label" }, tl("Placeholder (Figure 11.6'daki ikinci INSERT gibi)", "Placeholders (like the second INSERT of Figure 11.6)")),
      code(`$q = $d->query('SELECT Name, Job, Dno FROM EMPLOYEE\n  WHERE Job = ? AND Dno = ?',\n  array($_POST['emp_job'], $_POST['emp_dno']));`), h("div", { class: "small" }, tl("Veritabanına giden SQL (değerler tırnaklanmış):", "SQL sent to the database (values quoted):")), code(bound), res(b));
    verdict.textContent = !a.error && !b.error && a.rows.length !== b.rows.length
      ? tl(`İki sorgu farklı sonuç verdi: birleştirmeyle oluşturulan sorgu ${a.rows.length} satır, placeholder'lı sorgu ${b.rows.length} satır döndürdü. Kullanıcının yazdığı tırnak işareti, birleştirmeli sorguda Job değerini kapatıp sorguya yeni bir koşul ekledi; bu SQL injection'dır.`, `The two queries returned different results: the concatenated query ${a.rows.length} rows, the one with placeholders ${b.rows.length}. The quote typed by the user closed the Job value in the concatenated query and added a new condition to it; this is SQL injection.`)
      : tl("Normal bir girdide iki yöntem aynı sonucu verir. Farkı görmek için 'Saldırgan girdi' düğmesine basın.", "With an ordinary input both methods give the same result. Press 'Malicious input' to see the difference.");
  };
  const verdict = h("p", { class: "small" });
  [jobIn, dnoIn].forEach((x) => x.addEventListener("input", run));
  host.append(h("div", { class: "player" },
    h("div", { class: "pl-bar" }, field("emp_job: ", jobIn), field("emp_dno: ", dnoIn),
      button(tl("Normal girdi", "Normal input"), () => { jobIn.value = "Engineer"; dnoIn.value = "5"; run(); }),
      button(tl("Saldırgan girdi", "Malicious input"), () => { jobIn.value = "x' OR '1'='1"; dnoIn.value = "0 OR 1=1"; run(); }, { kind: "primary" })),
    h("div", { class: "ba ph-ba" }, left, h("div", { class: "ba-arrow", "aria-hidden": "true" }), right), verdict));
  run();
}

// ---------------------------------------------------------------- fetchRow / getAll loop
{
  const host = $("#fetch-loop");
  const MODES = {
    fetch: { label: tl("fetchRow ile while döngüsü", "while loop with fetchRow"), sql: "SELECT Name, Dno FROM demo.EMPLOYEE", php: `$q = $d->query('SELECT Name, Dno FROM EMPLOYEE');\nwhile ($r = $q->fetchRow()) {\n  print "employee $r[0] works for department $r[1] \\n";\n}`, line: (r) => `employee ${r[0]} works for department ${r[1]}` },
    param: { label: tl("Placeholder'lı sorgu ve fetchRow", "Query with placeholders and fetchRow"), sql: "SELECT Name FROM demo.EMPLOYEE WHERE Job = 'Manager' AND Dno = 5", php: `$q = $d->query('SELECT Name FROM EMPLOYEE WHERE Job = ? AND Dno = ?',\n   array('Manager', 5));\nwhile ($r = $q->fetchRow()) {\n  print " $r[0] \\n";\n}`, line: (r) => ` ${r[0]}` },
    getall: { label: tl("getAll ve foreach", "getAll and foreach"), sql: "SELECT Name, Job, Dno FROM demo.EMPLOYEE", php: `$allresult = $d->getAll('SELECT Name, Job, Dno FROM EMPLOYEE');\nforeach ($allresult as $r) {\n  print " $r[0] $r[1] $r[2] \\n";\n}`, line: (r) => ` ${r[0]} ${r[1]} ${r[2]}` },
  };
  let mode = "fetch", rows = [], cols = [], i = 0;
  const seg = h("div", { class: "stepper-steps", role: "group" }), counter = h("span", { class: "pl-count" }), body = h("div");
  const rArr = (r) => (r ? h("span", { class: "tx-vals" }, ...r.map((v, k) => h("span", { class: "tx-val" }, `$r[${k}] = ${v}`))) : h("code", {}, "false"));
  const draw = () => {
    for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.m === mode));
    const M = MODES[mode], total = rows.length + 1;
    counter.textContent = tl(`Adım ${i} / ${total}`, `Step ${i} of ${total}`);
    prevB.disabled = i === 0; nextB.disabled = i >= total;
    const output = rows.slice(0, Math.min(i, rows.length)).map(M.line).join("\n");
    const prevOut = rows.slice(0, Math.max(0, Math.min(i - 1, rows.length))).map(M.line).join("\n");
    const kids = [code(M.php)];
    if (mode === "getall") kids.push(h("div", { class: "ba-label" }, tl("$allresult: iki boyutlu dizi (satır × sütun)", "$allresult: a two-dimensional array (row × column)")), relationTable(["#", ...cols.map((c, k) => `[${k}] ${c}`)], null, rows.map((r, k) => [k, ...r]), { rowClass: (_, k) => (k === i - 1 ? "keep" : null) }));
    else kids.push(h("div", { class: "ba-label" }, tl(`Sorgu sonucu (${rows.length} satır, MySQL'de çalıştı)`, `Query result (${rows.length} rows, run on MySQL)`)), relationTable(cols, null, rows, { rowClass: (_, k) => (k === i - 1 ? "keep" : k < i - 1 ? "dim" : null) }));
    if (i === 0) kids.push(h("p", { class: "small" }, tl("Sonraki düğmesine her bastığınızda döngünün bir turu çalışır.", "Each press of Next runs one turn of the loop.")));
    else {
      const done = i > rows.length;
      kids.push(h("div", { class: "step-title" }, done ? tl(`${mode === "getall" ? "foreach dizinin sonuna geldi" : "fetchRow() false döndü"}: döngü biter`, `${mode === "getall" ? "foreach reached the end of the array" : "fetchRow() returned false"}: the loop ends`) : tl(`Tur ${i}: ${mode === "getall" ? `$r = $allresult[${i - 1}]` : "$r = $q->fetchRow()"}`, `Turn ${i}: ${mode === "getall" ? `$r = $allresult[${i - 1}]` : "$r = $q->fetchRow()"}`)),
        h("div", { class: "ba" },
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Önce", "Before")), h("div", { class: "small" }, h("strong", {}, "$r: "), rArr(i > 1 ? rows[i - 2] : null)), code(prevOut || tl("(çıktı yok)", "(no output)"))),
          h("div", { class: "ba-arrow", "aria-hidden": "true" }),
          h("div", { class: "ba-side" }, h("div", { class: "ba-label" }, tl("Sonra", "After")), h("div", { class: "small" }, h("strong", {}, "$r: "), rArr(done ? null : rows[i - 1])), code(output || tl("(çıktı yok)", "(no output)")))),
        h("p", { class: "small" }, done ? tl(`Satır kalmadığı için ${mode === "getall" ? "döngü" : "fetchRow false döndürdü, while koşulu yanlış oldu ve döngü"} bitti; ${rows.length} satır yazıldı.`, `With no rows left, ${mode === "getall" ? "the loop" : "fetchRow returned false, the while condition became false and the loop"} ended; ${rows.length} rows were printed.`)
          : tl("Dönen satır bir dizidir; $r[0] ilk sütun, $r[1] ikinci sütundur. print satırı çıktıya ekler.", "The returned row is an array; $r[0] is the first column, $r[1] the second. print adds the line to the output.")));
    }
    body.replaceChildren(...kids);
  };
  const load = async () => { const r = await query(MODES[mode].sql); rows = r.rows || []; cols = r.cols || []; i = 0; draw(); };
  const prevB = button(tl("◀ Önceki", "◀ Previous"), () => { i--; draw(); });
  const nextB = button(tl("Sonraki ▶", "Next ▶"), () => { i++; draw(); }, { kind: "primary" });
  const endB = button(tl("Sona git", "Go to end"), () => { i = rows.length + 1; draw(); });
  for (const [k, M] of Object.entries(MODES)) seg.append(h("button", { type: "button", "data-m": k, onclick: () => { mode = k; load(); } }, M.label));
  host.append(h("div", { class: "player" }, seg, h("div", { class: "pl-bar" }, prevB, nextB, endB, counter), body));
  load();
}
