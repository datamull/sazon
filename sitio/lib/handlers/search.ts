// GET /api/search?q=pastel+de+choclo&country=CL&lang=es&diet=vegan,gluten
// Busca el plato en las dos fuentes de su país de origen y devuelve como máximo 4 recetas
// que se pueden abrir (se comprueba que cada página publique la receta completa).
import { errorJson, fetchWithTimeout, firstWorkingImage, json, pool } from "../http.js";
import { COUNTRIES, getIndex, interleave, searchIndex, SOURCES, type Country, type Diet, type Hit } from "../sources.js";
import { translateList, type Lang } from "../lang.js";
import { geminiJson, hasGemini } from "../gemini.js";
import { extractRecipe, imageCandidates, pagePreview } from "../jsonld.js";

const MAX_RESULTS = 4;
const DIETS: Diet[] = ["gluten", "lactose", "vegetarian", "vegan"];

/** Nombres del plato en otros idiomas + país de origen según la IA. */
async function expandQuery(q: string): Promise<{ variants: string[]; country?: Country }> {
  if (!hasGemini()) return { variants: [] };
  try {
    const out = await geminiJson<{ variants: string[]; country: string | null }>(
      `A user searches recipe websites for: "${q}".
Return JSON {"variants":[...],"country":"QC|CL|MX|CO|null"}.
"variants": up to 5 short dish names (1-4 words each) that a recipe URL slug would contain:
the dish's usual name in French (Quebec), Spanish and English, and the most common alternative local name.
"country": where the dish comes from among Quebec (QC), Chile (CL), Mexico (MX), Colombia (CO); null if it is not typical of any of them.
No explanations. Example for "shepherd's pie": {"variants":["pate chinois","pastel de carne","shepherds pie"],"country":"QC"}`,
      { timeoutMs: 9000, temperature: 0 },
    );
    const country = (COUNTRIES as string[]).includes(String(out.country)) ? (out.country as Country) : undefined;
    return { variants: (out.variants || []).filter((v) => typeof v === "string").slice(0, 5), country };
  } catch {
    return { variants: [] };
  }
}

interface Shown extends Hit {
  title: string;
  originalTitle?: string;
  image?: string;
}

/** Abre las páginas en orden y se queda con las primeras que publican una receta completa. */
async function firstValid(hits: Hit[], max: number): Promise<Shown[]> {
  const out: Shown[] = [];
  for (let i = 0; i < hits.length && out.length < max; i += 6) {
    const batch = hits.slice(i, i + 6);
    const checked = await pool(batch, 6, async (h): Promise<Shown | null> => {
      try {
        const res = await fetchWithTimeout(h.url, 7000);
        if (!res.ok) return null;
        const html = await res.text();
        const rec = extractRecipe(html);
        if (!rec) return null; // la página no trae ingredientes y pasos: no se podría abrir
        const p = pagePreview(html);
        const title = (rec.name || p.title || h.slugTitle).replace(/^(receta|recette|recipe)\s+(de\s+|du\s+|for\s+)?/i, "").trim();
        const image = await firstWorkingImage(imageCandidates(html, h.url, rec.image));
        return { ...h, title: title.charAt(0).toUpperCase() + title.slice(1), image };
      } catch {
        return null;
      }
    });
    for (const r of checked) if (r && out.length < max) out.push(r);
  }
  return out;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const c = url.searchParams.get("country") || "";
  const diet = (url.searchParams.get("diet") || "").split(",").filter((d): d is Diet => (DIETS as string[]).includes(d));
  const lang = (["es", "fr", "en"].includes(url.searchParams.get("lang") || "") ? url.searchParams.get("lang") : "es") as Lang;
  if (q.length < 2) return errorJson("bad_query", "Escribe al menos 2 letras");

  const [index, ai] = await Promise.all([getIndex(), expandQuery(q)]);
  if (!index.length) return errorJson("index_unavailable", "Las fuentes de recetas no respondieron. Intenta en unos minutos.", 503);
  const phrases = [q, ...ai.variants];

  // País de origen: el de la pestaña (platos populares), si no el que diga la IA, si no el de la mejor coincidencia
  let country = (COUNTRIES as string[]).includes(c) ? (c as Country) : ai.country;
  if (!country) country = searchIndex(index, phrases, undefined, 1, diet)[0]?.country;

  const ranked = country ? searchIndex(index, phrases, country, 16, diet) : [];
  // fuera las coincidencias mucho más débiles que la mejor ("Calzone italiano" para "Calzones rotos")
  const top = ranked[0]?.score ?? 0;
  const hits = interleave(ranked.filter((h) => h.score >= top - 6));
  const shown = await firstValid(hits, MAX_RESULTS);

  // títulos en el idioma elegido (la fuente puede estar en francés, español o inglés)
  if (hasGemini() && shown.length) {
    const srcLang = (r: Shown) => (r.url.includes("/es/") ? "es" : SOURCES.find((s) => s.id === r.source)?.lang);
    const todo = shown.map((r, i) => (srcLang(r) !== lang ? i : -1)).filter((i) => i >= 0);
    if (todo.length) {
      const tr = await translateList(todo.map((i) => shown[i].title), lang, "titles of recipes (dish names)", 9000);
      todo.forEach((i, n) => {
        if (tr[n] && tr[n] !== shown[i].title) shown[i].originalTitle = shown[i].title;
        shown[i].title = tr[n] || shown[i].title;
      });
    }
  }
  return json({ query: q, country: country || null, variants: ai.variants, results: shown, aiUsed: ai.variants.length > 0 }, 200, 3600);
};

