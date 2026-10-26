// Servidor local para probar sin Vercel: sirve public/ y monta las funciones de api/.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as search from "../api/search.js";
import * as recipe from "../api/recipe.js";
import * as prices from "../api/prices.js";

const routes: Record<string, Record<string, (r: Request) => Promise<Response>>> = {
  "/api/search": search as any,
  "/api/recipe": recipe as any,
  "/api/prices": prices as any,
};
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT || 8888);

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const route = routes[url.pathname];
  if (route) {
    const fn = route[req.method || "GET"];
    if (!fn) return res.writeHead(405).end();
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const r = await fn(new Request(url, { method: req.method, headers: req.headers as any, body: req.method === "GET" ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log("http://localhost:" + port));
