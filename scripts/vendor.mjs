// Third-party files the site needs at runtime, copied out of node_modules.
// Shared by build.mjs (copies them into dist/) and serve.mjs (serves them in development).
// PGlite = PostgreSQL compiled to WebAssembly: every SQL box on the site runs on a real PostgreSQL in the browser.
import { readdirSync } from "node:fs";
import { join } from "node:path";

const nm = (...p) => join(import.meta.dirname, "..", "node_modules", ...p);

export function vendorFiles() {
  const files = {};
  const dist = nm("@electric-sql", "pglite", "dist");
  for (const f of readdirSync(dist)) {
    // the ES module entry point and its chunks (chunk names change between versions), the WebAssembly binaries
    // and the file-system image; source maps, CommonJS builds, typings and extensions are not needed
    if ((f.endsWith(".js") && !f.startsWith("templating")) || ["pglite.wasm", "pglite.data", "initdb.wasm"].includes(f)) {
      files[`vendor/pglite/${f}`] = join(dist, f);
    }
  }
  for (const f of readdirSync(join(dist, "fs"))) if (f.endsWith(".js")) files[`vendor/pglite/fs/${f}`] = join(dist, "fs", f);
  return files;
}
