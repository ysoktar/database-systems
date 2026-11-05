// Minimal static server for local development.
//   npm run dev      serves site/ (vendored libraries straight from node_modules), edits show on reload
//   npm start        builds, then serves dist/ exactly as GitHub Pages will
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { vendorFiles } from "./vendor.mjs";

const root = join(import.meta.dirname, "..", process.argv[2] === "dist" ? "dist" : "site");
const vendor = vendorFiles();
const port = Number(process.env.PORT) || 8000;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".wasm": "application/wasm", ".data": "application/octet-stream", ".ipynb": "application/json", ".txt": "text/plain", ".sql": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (path === "" || path.endsWith("/")) path += "index.html";
  let file = vendor[path] ?? join(root, normalize(path));
  if (!vendor[path] && !file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" }).end("404 Not Found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}/`));
