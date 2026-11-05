// Build the static site into dist/: the contents of site/ plus the vendored libraries.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { vendorFiles } from "./vendor.mjs";

const root = join(import.meta.dirname, "..");
const out = join(root, "dist");

rmSync(out, { recursive: true, force: true });
cpSync(join(root, "site"), out, { recursive: true });
for (const [dest, src] of Object.entries(vendorFiles())) {
  mkdirSync(dirname(join(out, dest)), { recursive: true });
  cpSync(src, join(out, dest));
}

let files = 0, bytes = 0;
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f), s = statSync(p);
    if (s.isDirectory()) walk(p); else { files++; bytes += s.size; }
  }
})(out);
console.log(`dist/: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
