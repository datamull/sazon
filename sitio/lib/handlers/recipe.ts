// GET /api/recipe?url=...&lang=es&country=QC&diet=gluten,vegan
// Descarga la receta desde su sitio original (JSON-LD), y Gemini la traduce,
// estructura los ingredientes, propone sustitutos según el país y el régimen alimenticio
// del usuario, y clasifica cada paso.
import { errorJson, fetchWithTimeout, json } from "../http.js";
import { ALLOWED_HOSTS, sourceForUrl, type Diet } from "../sources.js";
import { absoluteImage, extractRecipe, pagePreview, type RawRecipe } from "../jsonld.js";
import { geminiJson, hasGemini } from "../gemini.js";
import { ACTIONS, guessAction } from "../actions.js";
import { isWrongLang, LANG_NAMES, translateList, type Lang } from "../lang.js";

const LANGS: Record<string, string> = LANG_NAMES;
const PLACES: Record<string, string> = {
  QC: "Quebec City, Canada (supermarkets like Maxi, IGA, Metro, Super C, Walmart, Provigo, Costco; a few Latin grocery stores)",
  CL: "Santiago, Chile (Líder, Jumbo, Unimarc, Santa Isabel, ferias libres)",
  MX: "Mexico City, Mexico (Walmart, Soriana, Chedraui, La Comer, mercados)",
  CO: "Bogotá, Colombia (Éxito, Carulla, Olímpica, D1, Ara, plazas de mercado)",
};

const DIETS: Diet[] = ["gluten", "lactose", "vegetarian", "vegan"];
const DIET_RULES: Record<Diet, string> = {
  gluten: "GLUTEN-FREE (celiac-safe): no wheat, barley, rye, regular oats, spelt; watch hidden gluten in flour, breadcrumbs, pasta, soy sauce, beer, bouillon cubes, some spice mixes and sausages",
  lactose: "LACTOSE-FREE: no milk, cream, butter, regular cheese, yogurt, condensed/evaporated milk; lactose-free dairy or plant-based alternatives are fine",
  vegetarian: "VEGETARIAN: no meat, poultry, fish, seafood, gelatin, lard or meat/fish broth; eggs and dairy are allowed",
  vegan: "VEGAN: no animal products at all (no meat, fish, eggs, dairy, honey, gelatin, lard, animal broth)",
};

// Sustitutos que nunca cumplen cada régimen (red de seguridad sobre la respuesta de la IA)
const FORBIDDEN: Record<Diet, RegExp> = {
  gluten: /seit[aá]n|gluten|\btrigo\b|\bbl[eé]\b|wheat|harina(?! de (ma[ií]z|arroz|almendra|garbanzo|coco|yuca|papa|avena sin gluten))|farine(?! de (ma[iï]s|riz|amandes?|pois chiches|coco|sarrasin|manioc))|\bflour\b(?!.*(rice|corn|almond|gluten-free))|cous ?cous|boulgour|bulgur|cebada|\borge\b|barley|centeno|seigle|\brye\b|espelta|[eé]peautre|spelt|pan rallado|chapelure|breadcrumb|panko|\bpasta\b|p[aâ]tes\b|tortillas? de harina|salsa de soya(?! sin gluten)|sauce soya(?! sans gluten)|soy sauce(?! gluten)|cerveza|bi[eè]re|beer/i,
  lactose: /\bleche\b(?! (de|sin|vegetal|deslactosada))|\blait\b(?! (de|d['’]|sans|végétal))|\bmilk\b|crema(?! (vegetal|de coco|sin))|\bcr[eè]me\b(?! (végétale|de coco|sans))|\bcream\b|mantequilla(?! (vegetal|sin))|\bbeurre\b(?! (végétal|d['’]arachide|sans))|\bbutter\b|queso(?! (vegano|vegetal|sin))|fromage(?! (végétal|végétalien|sans))|\bcheese\b|yogur|yogourt|yaourt|yogurt/i,
  vegetarian: /\bcarne\b(?! (vegetal|de soya|de soja))|\bviande\b(?! végétale)|\bmeat\b|pollo|poulet|chicken|cerdo|porc|pork|res\b|b[oœ]uf|beef|tocino|bacon|jam[oó]n|jambon|\bham\b|pescado|poisson|\bfish\b|at[uú]n|thon|tuna|camar[oó]n|crevette|shrimp|anchoa|anchois|gelatina|g[eé]latine|manteca de cerdo|saindoux|\blard\b|caldo de (pollo|res|carne|pescado)|bouillon de (poulet|b[oœ]uf|viande|poisson)/i,
  vegan: /\bhuevos?\b|\b[oœ]ufs?\b|\beggs?\b|miel|honey|\bleche\b(?! (de|vegetal))|\blait\b(?! (de|d['’]|végétal))|\bmilk\b|crema(?! (vegetal|de coco))|\bcr[eè]me\b(?! (végétale|de coco))|mantequilla(?! vegetal)|\bbeurre\b(?! (végétal|d['’]arachide))|\bbutter\b|queso(?! (vegano|vegetal))|fromage(?! (végétal|végétalien))|\bcheese\b|yogur|yogourt|yaourt|ghee|\bcarne\b(?! (vegetal|de soya|de soja))|\bviande\b(?! végétale)|pollo|poulet|cerdo|porc|b[oœ]uf|pescado|poisson|at[uú]n|thon|camar[oó]n|crevette|gelatina|g[eé]latine/i,
};

/** Regímenes que un sustituto propuesto no cumple. */
function violations(sub: { name: string; fr: string }, diet: Diet[]): Diet[] {
  // un producto que en la etiqueta dice "sin gluten", "sans lactose", "vegano"… se acepta para ese régimen
  const SAFE: Record<Diet, RegExp> = {
    gluten: /sin gluten|sans gluten|gluten[- ]free|libre de gluten/i,
    lactose: /sin lactosa|sans lactose|lactose[- ]free|deslactosad|vegan|v[eé]g[eé]talien/i,
    vegetarian: /vegetarian|v[eé]g[eé]tarien|vegan|v[eé]g[eé]talien|vegetal\b|v[eé]g[eé]tale?\b|plant[- ]based/i,
    vegan: /vegan|v[eé]g[eé]talien|plant[- ]based/i,
  };
  return diet.filter((d) => {
    const parts = [sub.name, sub.fr].filter(Boolean);
    // cada nombre se revisa por separado: basta que uno sea claramente apto
    return parts.some((t) => FORBIDDEN[d].test(t)) && !parts.some((t) => SAFE[d].test(t));
  });
}

interface Ingredient {
  original: string;
  name: string;
  qty: number | null;
  unit: string | null;
  note?: string;
  pantry: boolean;
  shopFr: string;
  fr: string;
  availability: "common" | "specialty" | "hard";
  substitute: { name: string; why: string; shopFr: string; fr: string } | null;
  /** regímenes del usuario que este ingrediente no cumple */
  conflicts: Diet[];
  /** por qué hay sustituto: disponibilidad en el país, régimen alimenticio, o ambos */
  subReason: "availability" | "diet" | "both" | null;
}
interface Step { text: string; action: string; minutes: number | null }

function fallback(raw: RawRecipe) {
  return {
    title: raw.name,
    summary: raw.description || "",
    servings: raw.yield || null,
    time: raw.totalTime || null,
    ingredients: raw.ingredients.map<Ingredient>((l) => ({
      original: l, name: l, qty: null, unit: null, pantry: /\b(sal|sel|salt|agua|eau|water|pimienta|poivre|pepper)\b/i.test(l),
      shopFr: l, fr: l, availability: "common", substitute: null, conflicts: [], subReason: null,
    })),
    steps: raw.steps.map<Step>((s) => ({ text: s, action: guessAction(s), minutes: null })),
  };
}

function prompt(raw: RawRecipe, lang: string, country: string, diet: Diet[]) {
  const L = LANGS[lang] || LANGS.es;
  const dietBlock = diet.length
    ? `
DIETARY PROFILE (mandatory). The cook follows: ${diet.map((d) => DIET_RULES[d]).join("; ")}.
- "name" and "fr" ALWAYS describe the ORIGINAL ingredient of the recipe (translated), even when it does not comply. NEVER put the substitute in "name" or "fr": the substitute goes only inside "substitute". Keep "title" as the original dish name (translated), without adding diet words.
- A substitute must comply with ALL the diets at once. Seitan is pure wheat gluten: never use it when gluten-free is required; there use tofu, tempeh, legumes, mushrooms or textured soy protein instead.
- For EVERY ingredient that does not comply, list the violated diets in "conflicts" (values: ${diet.join(", ")}) and give a "substitute" that complies with ALL of them, is easy to find where the cook lives, and keeps the dish as close as possible (say how to adapt in "why").
- If an ingredient needs a substitute both for diet and availability, one substitute must solve both. "subReason": "diet", "availability" or "both" ("null" when no substitute).
- Write the steps for the ADAPTED recipe (use the substitute names and adjust techniques if needed, e.g. no browning of meat when vegan).
- "dietNotes": 1-3 short practical tips for this diet and this recipe (e.g. check that broth/cheese labels say gluten-free). "dietOk": true if the original recipe already complies without changes.`
    : `
No dietary restrictions: "conflicts" is always [], "subReason" is "availability" or null, "dietNotes" is [] and "dietOk" true.`;
  return `You are a careful cooking assistant and translator. Below is a recipe exactly as published by its website (schema.org data); it may be in French, Spanish or English.
OUTPUT LANGUAGE: ${L}. TRANSLATE the recipe into ${L}: "title", "summary", every ingredient "name", "unit" and "note", every substitute "name" and "why", and every step "text" MUST be written in ${L}, even when the source is in another language. Only "original" keeps the source wording; "fr" and "shopFr" are always Quebec French.
Rewrite it for a home cook. Rules:
- Keep quantities faithful; do not invent ingredients or steps. Units in ${L} (e.g. Spanish "cda", "cdta", "taza"; French "c. à soupe", "tasse"; English "tbsp", "cup").
- The cook lives in ${PLACES[country] || PLACES.QC}.
- For each ingredient, judge availability THERE: "common" (any supermarket), "specialty" (only Latin/ethnic or specialty stores), "hard" (practically unavailable).
- Mark "common" anything a regular supermarket there stocks (in Quebec: Maxi, IGA, Metro, Super C), including everyday spices like paprika, cumin or oregano.
- If availability is not "common", give the best widely available substitute and a one-sentence reason (texture/flavor, how to adapt).
- "pantry": true only for salt, pepper, water, sugar, cooking oil, flour and similar staples most kitchens have.
- "fr": the ingredient's name in Quebec French exactly as a shopper reads it on Quebec supermarket shelves and labels (e.g. "pommes de terre à chair blanche", "fromage en grains", "maïs en grains surgelé", "coriandre fraîche"), without quantity.
- "shopFr": a 1-3 word search term in Quebec French for a grocery flyer (e.g. "boeuf haché", "maïs en grains", "poivron rouge").
- Steps: split long paragraphs into clear single actions (max ~25 words each), keep order. "action" must be one of: ${ACTIONS.join(", ")}. "minutes": time stated in that step, else null.
- "servings" and "time" short strings, or null.
${dietBlock}

Return ONLY JSON:
{"title":"","summary":"one sentence","servings":"","time":"","dietOk":true,"dietNotes":[],
 "ingredients":[{"original":"","name":"","qty":1.5,"unit":"","note":"","pantry":false,"fr":"","shopFr":"","availability":"common","substitute":null,"conflicts":[],"subReason":null}],
 "steps":[{"text":"","action":"mix","minutes":null}]}
(substitute when present: {"name":"","why":"","fr":"","shopFr":""})

RECIPE:
${JSON.stringify({ name: raw.name, yield: raw.yield, totalTime: raw.totalTime, ingredients: raw.ingredients, instructions: raw.steps })}

Remember: all user-facing fields (also "dietNotes") in ${L}.`;
}

/** Si algún texto quedó en otro idioma, lo traduce todo en una segunda pasada. */
async function enforceLang(rec: { title: string; summary: string; ingredients: Ingredient[]; steps: Step[]; dietNotes?: string[] }, lang: Lang) {
  const sample = [rec.steps.map((s) => s.text).join(" "), rec.ingredients.map((i) => [i.name, i.note].filter(Boolean).join(" ")).join(", "), rec.summary];
  if (!sample.some((t) => isWrongLang(t, lang))) return rec;
  const slots: string[] = [rec.title, rec.summary];
  rec.ingredients.forEach((i) => slots.push(i.name, i.unit || "", i.note || "", i.substitute?.name || "", i.substitute?.why || ""));
  rec.steps.forEach((s) => slots.push(s.text));
  (rec.dietNotes || []).forEach((n) => slots.push(n));
  const idx = slots.map((t, k) => (t ? k : -1)).filter((k) => k >= 0);
  const tr = await translateList(idx.map((k) => slots[k]), lang, "a cooking recipe: title, summary, ingredient names, units, notes, substitutes and preparation steps");
  idx.forEach((k, n) => (slots[k] = tr[n]));
  let p = 0;
  const next = () => slots[p++];
  rec.title = next();
  rec.summary = next();
  for (const i of rec.ingredients) {
    i.name = next();
    i.unit = next() || null;
    i.note = next() || undefined;
    const sn = next(), sw = next();
    if (i.substitute) Object.assign(i.substitute, { name: sn, why: sw });
  }
  for (const s of rec.steps) s.text = next();
  if (rec.dietNotes) rec.dietNotes = rec.dietNotes.map(() => next());
  return rec;
}

export default async (req: Request) => {
  const u = new URL(req.url);
  const target = u.searchParams.get("url") || "";
  const lang = LANGS[u.searchParams.get("lang") || ""] ? u.searchParams.get("lang")! : "es";
  const country = PLACES[u.searchParams.get("country") || ""] ? u.searchParams.get("country")! : "QC";
  const diet = [...new Set((u.searchParams.get("diet") || "").split(",").filter((d): d is Diet => (DIETS as string[]).includes(d)))];

  let host = "";
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "https:") throw new Error();
    host = parsed.host;
  } catch {
    return errorJson("bad_url", "Enlace de receta no válido");
  }
  if (!ALLOWED_HOSTS.has(host) || !sourceForUrl(target)) return errorJson("source_not_allowed", "Esa fuente no está en la lista de sitios de recetas", 403);

  let html: string;
  try {
    const res = await fetchWithTimeout(target, 12000);
    if (!res.ok) return errorJson("source_error", `El sitio respondió ${res.status}`, 502);
    html = await res.text();
  } catch {
    return errorJson("source_timeout", "El sitio de la receta no respondió", 504);
  }
  const raw = extractRecipe(html);
  if (!raw) return errorJson("no_recipe", "Esta página no publica una receta estructurada. Prueba otro resultado.", 422);

  const src = sourceForUrl(target)!;
  const og = pagePreview(html).image;
  const image = absoluteImage(og && !/placeholder/i.test(og) ? og : raw.image, target) || null;
  const base = { url: target, source: src.name, sourceCountry: src.country, image, author: raw.author || null, diet };

  if (!hasGemini()) return json({ ...base, ...fallback(raw), dietOk: diet.length === 0, dietAdapted: false, dietNotes: [], aiUsed: false, aiError: "no_key" }, 200, 600);

  try {
    const r = await geminiJson<any>(prompt(raw, lang, country, diet), { timeoutMs: 45000 });
    const ingredients: Ingredient[] = (r.ingredients || []).map((i: any) => ({
      original: String(i.original || i.name || ""),
      name: String(i.name || i.original || ""),
      qty: typeof i.qty === "number" ? i.qty : null,
      unit: i.unit ? String(i.unit) : null,
      note: i.note ? String(i.note) : undefined,
      pantry: !!i.pantry,
      shopFr: String(i.shopFr || i.name || ""),
      fr: String(i.fr || i.shopFr || ""),
      availability: ["common", "specialty", "hard"].includes(i.availability) ? i.availability : "common",
      substitute: i.substitute && i.substitute.name ? { name: String(i.substitute.name), why: String(i.substitute.why || ""), shopFr: String(i.substitute.shopFr || i.substitute.name), fr: String(i.substitute.fr || i.substitute.shopFr || "") } : null,
      conflicts: (Array.isArray(i.conflicts) ? i.conflicts : []).filter((d: string) => (diet as string[]).includes(d)),
      subReason: ["availability", "diet", "both"].includes(i.subReason) ? i.subReason : null,
    }));
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    for (const i of ingredients) {
      // si la IA escribió el sustituto en lugar del ingrediente original, se recupera el original publicado
      if (i.substitute && same(i.name, i.substitute.name)) {
        i.name = i.original.replace(/^[\d\s.,/½¼¾⅓⅔()-]+(g|kg|ml|l|lb|oz|c\.\s*à\s*(soupe|thé|café)|tasses?|cdas?|cdtas?|tazas?|cups?|tbsp|tsp)?\s*(de\s+|d['’]\s*)?/i, "") || i.original;
        if (same(i.fr, i.substitute.fr)) i.fr = i.shopFr && !same(i.shopFr, i.substitute.shopFr) ? i.shopFr : "";
      }
      const hardToFind = i.availability !== "common";
      i.subReason = !i.substitute ? null : i.conflicts.length ? (hardToFind ? "both" : "diet") : hardToFind ? "availability" : null;
    }
    const steps: Step[] = (r.steps || []).map((s: any) => ({
      text: String(s.text || ""),
      action: (ACTIONS as readonly string[]).includes(s.action) ? s.action : guessAction(String(s.text || "")),
      minutes: typeof s.minutes === "number" ? s.minutes : null,
    }));
    if (!ingredients.length || !steps.length) throw new Error("respuesta incompleta");
    // Red de seguridad: si un sustituto no cumple el régimen (p. ej. seitán para sin gluten), se pide otro
    const bad = diet.length ? ingredients.filter((i) => i.substitute && violations(i.substitute, diet).length) : [];
    if (bad.length) {
      try {
        const fix = await geminiJson<{ items: { name: string; why: string; fr: string; shopFr: string }[] }>(
          `For each ingredient below, give ONE substitute that complies with ALL these diets: ${diet.map((d) => DIET_RULES[d]).join("; ")}.
It must be easy to find in ${PLACES[country] || PLACES.QC}. Seitan, wheat, barley, rye and regular flour are NOT gluten-free.
Write "name" and "why" in ${LANGS[lang] || LANGS.es}; "fr" (label name) and "shopFr" (1-3 word search term) in Quebec French.
Return ONLY JSON {"items":[{"name":"","why":"","fr":"","shopFr":""}]} in the same order, exactly ${bad.length} items.
INGREDIENTS: ${JSON.stringify(bad.map((i) => i.name))}`,
          { timeoutMs: 20000, temperature: 0 },
        );
        bad.forEach((i, k) => {
          const f = fix.items?.[k];
          if (f?.name && !violations({ name: String(f.name), fr: String(f.fr || "") }, diet).length)
            i.substitute = { name: String(f.name), why: String(f.why || ""), fr: String(f.fr || f.shopFr || ""), shopFr: String(f.shopFr || f.fr || f.name) };
          else i.substitute = null; // mejor sin sustituto que uno que no cumple
        });
      } catch {
        for (const i of bad) i.substitute = null;
      }
      for (const i of bad) {
        const hardToFind = i.availability !== "common";
        i.subReason = !i.substitute ? null : i.conflicts.length ? (hardToFind ? "both" : "diet") : hardToFind ? "availability" : null;
      }
    }
    const dietNotes = diet.length ? (Array.isArray(r.dietNotes) ? r.dietNotes : []).map(String).filter(Boolean).slice(0, 3) : [];
    const rec = await enforceLang({ title: String(r.title || raw.name), summary: String(r.summary || ""), ingredients, steps, dietNotes }, lang as Lang);
    const conflicts = ingredients.some((i) => i.conflicts.length);
    return json(
      {
        ...base,
        ...rec,
        originalTitle: raw.name,
        servings: r.servings || raw.yield || null,
        time: r.time || raw.totalTime || null,
        lang,
        dietOk: diet.length === 0 || !conflicts,
        dietAdapted: diet.length > 0,
        aiUsed: true,
      },
      200,
      1800,
    );
  } catch (e: any) {
    console.warn("Gemini recipe", e?.code, e?.message);
    // al menos traducir el texto, aunque no haya sustitutos ni pasos reorganizados
    const fb = fallback(raw);
    const rec = await enforceLang({ title: fb.title, summary: fb.summary, ingredients: fb.ingredients, steps: fb.steps }, lang as Lang).catch(() => fb);
    return json({ ...base, ...fb, ...rec, originalTitle: raw.name, lang, dietOk: diet.length === 0, dietAdapted: false, dietNotes: [], aiUsed: false, aiError: e?.code || "error" });
  }
};

