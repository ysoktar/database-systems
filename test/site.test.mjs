// Site structure: every page in the navigation exists, every local link and script resolves,
// every page names itself correctly, and the SQL helpers behave like the notebook's Python.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { splitSQL, quantize2, pyDumps, commandTag } from "../site/js/lib/sqlcore.js";

const site = join(import.meta.dirname, "..", "site");
const layout = readFileSync(join(site, "js", "layout.js"), "utf8");
const navIds = [...layout.slice(layout.indexOf("export const NAV"), layout.indexOf("const ALL")).matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));

test("every navigation entry has a page, and every page is in the navigation", () => {
  assert.ok(navIds.length >= 10);
  for (const id of navIds) assert.ok(existsSync(join(site, `${id}.html`)), `${id}.html missing`);
  for (const p of pages) assert.ok(navIds.includes(p.replace(/\.html$/, "")), `${p} is not in NAV`);
});

for (const p of pages) {
  test(`${p}: data-page, title, local links and scripts`, () => {
    const html = readFileSync(join(site, p), "utf8");
    assert.match(html, new RegExp(`data-page="${p.replace(/\.html$/, "")}"`));
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<html lang="tr">/);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#:]+)(?:#[^"]*)?"/g)) {
      if (url.startsWith("vendor/")) continue; // copied from node_modules at build time
      assert.ok(existsSync(join(site, url)), `${p}: ${url} does not exist`);
    }
    // every runnable box closes properly (an unclosed <pre> would swallow the page)
    assert.equal((html.match(/<pre/g) || []).length, (html.match(/<\/pre>/g) || []).length, `${p}: unbalanced <pre>`);
  });
}

test("splitSQL splits like the notebook's _split_sql", () => {
  assert.deepEqual(splitSQL("SELECT 1; SELECT ';' -- x;\n; /* ; */ SELECT 2;"), ["SELECT 1", "SELECT ';' -- x;", "/* ; */ SELECT 2"]);
  assert.deepEqual(splitSQL("CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql; SELECT f();").length, 2);
  assert.deepEqual(splitSQL("-- only a comment\n;"), []);
});

test("number normalization matches Python's Decimal.quantize(ROUND_HALF_EVEN)", () => {
  assert.equal(quantize2("55.0"), "55.00");
  assert.equal(quantize2(3), "3.00");
  assert.equal(quantize2("33250.000000000000"), "33250.00");
  assert.equal(quantize2("2.345"), "2.34");
  assert.equal(quantize2("2.355"), "2.36");
  assert.equal(quantize2("2.3451"), "2.35");
  assert.equal(quantize2("-1.005"), "-1.00");
  assert.equal(quantize2("9.999"), "10.00");
  assert.equal(pyDumps([["a", null], ["ş"]]), '[["a", null], ["\\u015f"]]');
  assert.equal(commandTag("insert into t values (1)", 1), "INSERT 0 1");
  assert.equal(commandTag("CREATE OR REPLACE VIEW v AS SELECT 1", 0), "CREATE VIEW");
});
