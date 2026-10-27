// Fuentes de recetas y buscador sobre sus sitemaps.
// La app NO guarda recetas: sólo un índice de enlaces públicos (URL + palabras del slug),
// que se refresca cada pocos días desde los sitemaps oficiales de cada sitio.
//
// Dos fuentes por país. Kiwilimón, Larousse Cocina, Trois fois par jour y SOS Cuisine
// bloquean a los servidores en la nube (403), por eso no se usan.
import { gunzipSync } from "node:zlib";
import { fetchWithTimeout, normalize, pool } from "./http.js";
import { readCache, writeCache } from "./cache.js";

export type Country = "QC" | "CL" | "MX" | "CO";
export const COUNTRIES: Country[] = ["QC", "CL", "MX", "CO"];

export interface Source {
  id: string;
  name: string;
  host: string;
  country: Country;
  lang: "fr" | "es" | "en";
  sitemaps: string[];
  /** el sitemap es un índice de otros sitemaps (se abre un nivel más) */
  sitemapIndex?: boolean;
  /** sólo URLs que parecen recetas */
  match: RegExp;
}

export const SOURCES: Source[] = [
  // Quebec
  {
    id: "telequebec",
    name: "Cuisinez – Télé-Québec",
    host: "cuisinez.telequebec.tv",
    country: "QC",
    lang: "fr",
    sitemaps: ["https://cuisinez.telequebec.tv/recettes/sitemap.xml"],
    match: /\/recettes\/\d+\/[a-z0-9-]+/,
  },
  {
    id: "mordu",
    name: "Mordu – Radio-Canada",
    host: "ici.radio-canada.ca",
    country: "QC",
    lang: "fr",
    sitemaps: ["https://ici.radio-canada.ca/mordu/sitemapcontent.xml"],
    match: /\/mordu\/recettes\/\d+\/[a-z0-9-]+/,
  },
  // Chile
  {
    id: "gourmet",
    name: "Gourmet.cl",
    host: "www.gourmet.cl",
    country: "CL",
    lang: "es",
    sitemaps: ["https://www.gourmet.cl/recetas-sitemap.xml", "https://www.gourmet.cl/recetas-sitemap2.xml"],
    match: /\/recetas\/[a-z0-9-]+/,
  },
  {
    id: "nestle-cl",
    name: "Recetas Nestlé Chile",
    host: "www.recetasnestle.cl",
    country: "CL",
    lang: "es",
    sitemaps: ["https://www.recetasnestle.cl/sitemap.xml?page=1", "https://www.recetasnestle.cl/sitemap.xml?page=2"],
    match: /recetasnestle\.cl\/recetas\/[a-z0-9-]+$/,
  },
  // México
  {
    id: "nestle-mx",
    name: "Recetas Nestlé México",
    host: "www.recetasnestle.com.mx",
    country: "MX",
    lang: "es",
    sitemaps: [
      "https://www.recetasnestle.com.mx/sitemap.xml?page=1",
      "https://www.recetasnestle.com.mx/sitemap.xml?page=2",
      "https://www.recetasnestle.com.mx/sitemap.xml?page=3",
    ],
    match: /recetasnestle\.com\.mx\/recetas\/[a-z0-9-]+$/,
  },
  {
    id: "cocinafacil",
    name: "Cocina Fácil",
    host: "www.cocinafacil.com.mx",
    country: "MX",
    lang: "es",
    sitemaps: ["https://www.cocinafacil.com.mx/sitemap.xml"],
    sitemapIndex: true,
    match: /cocinafacil\.com\.mx\/recetas\/[a-z0-9-]+$/,
  },
  // Colombia
  {
    id: "mycolombianrecipes",
    name: "My Colombian Recipes",
    host: "www.mycolombianrecipes.com",
    country: "CO",
    lang: "en",
    sitemaps: ["https://www.mycolombianrecipes.com/post-sitemap.xml", "https://www.mycolombianrecipes.com/post-sitemap2.xml"],
    match: /mycolombianrecipes\.com\/(es\/)?[a-z0-9-]+\/?$/,
  },
  {
    id: "nestle-co",
    name: "Recetas Nestlé Colombia",
    host: "www.recetasnestle.com.co",
    country: "CO",
    lang: "es",
    sitemaps: ["https://www.recetasnestle.com.co/sitemap.xml?page=1", "https://www.recetasnestle.com.co/sitemap.xml?page=2"],
    match: /recetasnestle\.com\.co\/recetas\/[a-z0-9-]+$/,
  },
];

export const ALLOWED_HOSTS = new Set(SOURCES.map((s) => s.host));

export function sourceForUrl(url: string): Source | undefined {
  try {
    const u = new URL(url);
    return SOURCES.find((s) => s.host === u.host && s.match.test(url));
  } catch {
    return undefined;
  }
}

export interface IndexEntry {
  u: string; // url
  s: string; // source id
  w: string; // palabras del slug, normalizadas
}

const INDEX_KEY = "recipe-index-v2";
const MAX_AGE_MS = 4 * 24 * 3600 * 1000;
/** si alguna fuente falló, el índice se vuelve a intentar pronto */
const PARTIAL_MAX_AGE_MS = 3600 * 1000;
type Cached = { at: number; entries: IndexEntry[]; missing: string[] };
let memo: Cached | null = null;

async function readSitemap(url: string): Promise<string[]> {
  const res = await fetchWithTimeout(url, 25000);
  if (!res.ok) throw new Error(`sitemap ${url} -> ${res.status}`);
  let text: string;
  if (url.endsWith(".gz")) {
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      text = gunzipSync(buf).toString("utf8");
    } catch {
      text = buf.toString("utf8"); // algunos servidores ya lo descomprimen
    }
  } else {
    text = await res.text();
  }
  return [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

function slugWords(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return normalize(last.replace(/-/g, " ").replace(/\b\d+\b/g, " "));
}

async function readSource(src: Source): Promise<IndexEntry[]> {
  let sitemaps = src.sitemaps;
  if (src.sitemapIndex) {
    const nested = await Promise.all(src.sitemaps.map(readSitemap));
    sitemaps = nested.flat();
  }
  const lists = await pool(sitemaps, 12, async (sm) => {
    try {
      return await readSitemap(sm);
    } catch (e) {
      console.warn("No se pudo leer", sm, String(e));
      return [] as string[];
    }
  });
  const out: IndexEntry[] = [];
  const seen = new Set<string>();
  for (const u of lists.flat()) {
    if (seen.has(u) || !src.match.test(u)) continue;
    seen.add(u);
    const w = slugWords(u);
    if (w.length > 2) out.push({ u, s: src.id, w });
  }
  return out;
}

async function buildIndex(): Promise<Cached> {
  const parts = await Promise.all(
    SOURCES.map(async (src) => {
      try {
        return { src, entries: await readSource(src) };
      } catch (e) {
        console.warn("Fuente no disponible", src.id, String(e));
        return { src, entries: [] as IndexEntry[] };
      }
    }),
  );
  return {
    at: Date.now(),
    entries: parts.flatMap((p) => p.entries),
    missing: parts.filter((p) => p.entries.length === 0).map((p) => p.src.id),
  };
}

const fresh = (c: Cached | null) => !!c && c.entries?.length > 0 && Date.now() - c.at < (c.missing?.length ? PARTIAL_MAX_AGE_MS : MAX_AGE_MS);

export async function getIndex(): Promise<IndexEntry[]> {
  if (fresh(memo)) return memo!.entries;
  const cached = await readCache<Cached>(INDEX_KEY);
  if (fresh(cached)) {
    memo = cached;
    return cached!.entries;
  }
  const built = await buildIndex();
  memo = built;
  if (built.entries.length > 100) await writeCache(INDEX_KEY, built);
  return built.entries;
}

const STOP = new Set(
  "de del la las el los y con en a al para receta recetas recette recettes recipe recipes the of and with a la au aux du des le les et facil facile easy casera maison".split(" "),
);

export function tokens(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export interface Hit {
  url: string;
  source: string;
  sourceName: string;
  country: Country;
  slugTitle: string;
  score: number;
}

export type Diet = "gluten" | "lactose" | "vegetarian" | "vegan";

// Palabras de slug que indican que la receta ya cumple el régimen
const DIET_WORDS: Record<Diet, RegExp> = {
  gluten: /\b(sin gluten|sans gluten|gluten free|gluten)\b/,
  lactose: /\b(sin lactosa|sans lactose|lactose free|deslactosad[ao]s?)\b/,
  vegetarian: /\b(vegetarian[ao]?s?|vegetarien(ne)?s?|vege|veg|veggie|sin carne)\b/,
  vegan: /\b(vegan[ao]?s?|vegetalien(ne)?s?|vegane?s?|veg)\b/,
};

/**
 * Puntúa cada URL según cuántas palabras de la búsqueda aparecen en su slug.
 * `phrases` son variantes de la misma búsqueda (p. ej. traducciones); gana la mejor.
 * Con `country`, sólo se consideran las fuentes de ese país.
 */
export function searchIndex(entries: IndexEntry[], phrases: string[], country?: Country, limit = 24, diet: Diet[] = []): Hit[] {
  const variants = phrases.map(tokens).filter((v) => v.length);
  if (!variants.length) return [];
  const bySource = new Map(SOURCES.map((s) => [s.id, s]));
  const scored: Hit[] = [];
  for (const e of entries) {
    const src = bySource.get(e.s);
    if (!src || (country && src.country !== country)) continue;
    const words = e.w.split(" ");
    let best = 0;
    for (const v of variants) {
      let hit = 0;
      let exact = 0;
      for (const t of v) {
        if (words.includes(t)) {
          hit++;
          exact++;
        } else if (
          t.length >= 4 &&
          words.some((w) => {
            const [a, b] = w.length < t.length ? [w, t] : [t, w];
            // plural/singular o variantes cercanas ("choclo"/"choclos"), no "tour"/"tourtiere"
            return a.length >= 4 && b.startsWith(a) && a.length / b.length >= 0.75;
          })
        ) {
          hit++;
        }
      }
      if (hit === 0) continue;
      const coverage = hit / v.length;
      // todas las palabras presentes pesa mucho; coincidencia exacta y slugs cortos (plato "clásico") suben
      const classic = /\b(tradicional|clasic[oa]|traditionnel(le)?|classique|maison|casero|casera|original|authentic)\b/.test(e.w) ? 0.6 : 0;
      const s = coverage * 10 + (hit === v.length ? 6 : 0) + exact * 0.4 + classic - Math.max(0, words.length - v.length) * 0.35;
      if (s > best) best = s;
    }
    if (best < 5) continue;
    // si el slug ya dice "vegano", "sin gluten"…, sube para quien sigue ese régimen
    for (const d of diet) if (DIET_WORDS[d].test(e.w)) best += 2.5;
    if (e.u.includes("/es/")) best += 0.2; // versión en español de My Colombian Recipes
    scored.push({
      url: e.u,
      source: src.id,
      sourceName: src.name,
      country: src.country,
      slugTitle: e.w.replace(/\b\w/g, (c) => c.toUpperCase()),
      score: Math.round(best * 100) / 100,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  // evita duplicados casi idénticos (misma receta en /es/ y en inglés)
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const h of scored) {
    const key = h.source + ":" + h.slugTitle.toLowerCase().slice(0, 18);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

/** País con mejores coincidencias (cuando la búsqueda es libre y la IA no lo dijo). */
export function bestCountry(hits: Hit[]): Country | undefined {
  return hits[0]?.country;
}

/** Alterna las dos fuentes del país para mostrar ambas cuando las dos tienen buenas coincidencias. */
export function interleave(hits: Hit[]): Hit[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) groups.set(h.source, [...(groups.get(h.source) || []), h]);
  const lists = [...groups.values()];
  const top = hits[0]?.score ?? 0;
  const out: Hit[] = [];
  for (let i = 0; out.length < hits.length; i++) {
    let added = false;
    for (const l of lists) {
      const h = l[i];
      // la otra fuente entra sólo si su coincidencia es casi tan buena como la mejor
      if (h && (out.length === 0 || h.score >= top - 4)) {
        out.push(h);
        added = true;
      }
    }
    if (!added) break;
  }
  for (const h of hits) if (!out.includes(h)) out.push(h);
  return out;
}
