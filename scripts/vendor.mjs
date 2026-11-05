// Files the site needs at runtime that are built or installed outside site/.
// Shared by build.mjs (copies them into dist/) and serve.mjs (serves them in development).
// The database of every SQL box is a MySQL-compatible engine (go-mysql-server) compiled to WebAssembly: engine/build.sh
// writes it to engine/dist/ (run `npm run engine` once, and again after changing engine/).
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

export function vendorFiles() {
  const files = {
    "vendor/mysql/mysql.wasm": join(root, "engine", "dist", "mysql.wasm"),
    "vendor/mysql/wasm_exec.js": join(root, "engine", "dist", "wasm_exec.js"),
  };
  for (const [k, v] of Object.entries(files)) if (!existsSync(v)) console.warn(`${k}: ${v} yok; önce "npm run engine" çalıştırın`);
  return files;
}
