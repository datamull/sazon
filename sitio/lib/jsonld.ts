// Extrae la receta publicada por el propio sitio en su marcado schema.org (JSON-LD).
import { decodeEntities, stripTags } from "./http.js";

export interface RawRecipe {
  name: string;
  image?: string;
  description?: string;
  yield?: string;
  totalTime?: string;
  ingredients: string[];
  steps: string[];
  author?: string;
}

function* walk(node: any): Generator<any> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  yield node;
  if (node["@graph"]) yield* walk(node["@graph"]);
  if (node.mainEntity) yield* walk(node.mainEntity);
}

function isRecipe(n: any): boolean {
  const t = n?.["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function firstImage(img: any): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[img.length > 1 ? 1 : 0]) || firstImage(img[0]);
  return img.url || img.contentUrl || undefined;
}

function flattenSteps(ins: any): string[] {
  if (!ins) return [];
  if (typeof ins === "string") {
    // a veces viene todo en un string con saltos o <li>
    const parts = ins.split(/<\/li>|\n+|\r+/).map(stripTags).filter((s) => s.length > 2);
    return parts.length ? parts : [stripTags(ins)];
  }
  if (Array.isArray(ins)) return ins.flatMap(flattenSteps);
  if (ins["@type"] === "HowToSection" || ins.itemListElement) return flattenSteps(ins.itemListElement);
  if (ins.text) return [stripTags(ins.text)];
  if (ins.name) return [stripTags(ins.name)];
  return [];
}

function iso(d?: string): string | undefined {
  if (!d || typeof d !== "string") return undefined;
  const m = d.match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return undefined;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  if (!h && !min) return undefined;
  return h ? `${h} h${min ? " " + min + " min" : ""}` : `${min} min`;
}

export function extractRecipe(html: string): RawRecipe | null {
  // algunos sitios (Mordu) escriben el atributo sin comillas: type=application/ld+json
  const blocks = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: any;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      try {
        data = JSON.parse(b[1].trim().replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
    for (const n of walk(data)) {
      if (!isRecipe(n)) continue;
      const ingredients = (Array.isArray(n.recipeIngredient) ? n.recipeIngredient : n.ingredients || [])
        .map((x: any) => stripTags(String(x)))
        .filter(Boolean);
      const steps = flattenSteps(n.recipeInstructions);
      if (!ingredients.length || !steps.length) continue;
      const author = Array.isArray(n.author) ? n.author[0]?.name : n.author?.name;
      return {
        name: decodeEntities(String(n.name || "")).trim(),
        image: firstImage(n.image),
        description: n.description ? stripTags(n.description).slice(0, 400) : undefined,
        yield: Array.isArray(n.recipeYield) ? String(n.recipeYield[0]) : n.recipeYield ? String(n.recipeYield) : undefined,
        totalTime: iso(n.totalTime) || iso(n.cookTime),
        ingredients,
        steps,
        author: author ? String(author) : undefined,
      };
    }
  }
  return null;
}

/** Lee un arreglo JSON que empieza en `start` (posición del '['), respetando strings. */
function jsonArrayAt(html: string, start: number): any[] | null {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length && i < start + 400000; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Kiwilimón arma su JSON-LD en el navegador a partir de datos incrustados en la página;
 * aquí leemos esos mismos datos (ingredientes y pasos publicados por el sitio).
 */
export function extractEmbeddedKiwilimon(html: string): RawRecipe | null {
  const ingAt = html.indexOf('"ingredients":[{"ikey"');
  const stepAt = html.indexOf('"steps":[{"skey"');
  if (ingAt < 0 || stepAt < 0) return null;
  const ings = jsonArrayAt(html, html.indexOf("[", ingAt));
  const steps = jsonArrayAt(html, html.indexOf("[", stepAt));
  if (!ings?.length || !steps?.length) return null;
  const p = pagePreview(html);
  const portions = html.slice(stepAt - 3000, stepAt).match(/"portions":(\d+)/)?.[1];
  return {
    name: p.title || "",
    image: p.image,
    yield: portions ? `${portions}` : undefined,
    ingredients: ings.map((x: any) => stripTags(String(x.text || ""))).filter(Boolean),
    steps: steps.map((x: any) => stripTags(String(x.text || ""))).filter(Boolean),
  };
}

/** Convierte una imagen relativa ("/sites/...") en dirección completa según la página. */
export function absoluteImage(img: string | undefined, pageUrl: string): string | undefined {
  if (!img) return undefined;
  try {
    return new URL(img, pageUrl).toString();
  } catch {
    return undefined;
  }
}

/** Título e imagen para las tarjetas de resultados. */
export function pagePreview(html: string): { title?: string; image?: string } {
  const og = (p: string) =>
    html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${p}["']`, "i"))?.[1];
  const title = og("title") || html.match(/<title>([^<]+)<\/title>/i)?.[1];
  return {
    title: title ? decodeEntities(title).split(/\s[|–-]\s/)[0].trim() : undefined,
    image: og("image") ? decodeEntities(og("image")!) : undefined,
  };
}
