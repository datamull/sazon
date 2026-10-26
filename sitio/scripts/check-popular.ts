// Revisa que cada plato popular devuelva recetas abribles de su país (sin IA).
import search from "../lib/handlers/search.js";
const window: any = {};
const src = (await import("node:fs")).readFileSync(new URL("../public/i18n.js", import.meta.url), "utf8");
new Function("window", src)(window);
const POP = window.SAZON_POPULAR as Record<string, { q: string }[]>;
const only = process.argv[2];
for (const [c, list] of Object.entries(POP)) {
  if (only && only !== c) continue;
  for (const d of list) {
    const t = Date.now();
    const r = await search(new Request(`http://x/api/search?q=${encodeURIComponent(d.q)}&country=${c}&lang=es`));
    const j: any = await r.json();
    const res = j.results || [];
    const bad = res.filter((x: any) => x.country !== c).length;
    console.log(`${c} ${res.length}/4 ${bad ? "OTRO-PAIS " : ""}${String(Date.now() - t).padStart(5)}ms ${d.q.padEnd(22)} ${res.map((x: any) => `[${x.source}] ${x.title}`).join(" | ")}`);
  }
}
