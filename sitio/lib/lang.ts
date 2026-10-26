// Detección simple de idioma y traducción por lotes con Gemini.
import { geminiJson } from "./gemini.js";

export type Lang = "es" | "fr" | "en";
export const LANG_NAMES: Record<Lang, string> = { es: "Spanish (Latin American)", fr: "Quebec French", en: "English" };

const STOP: Record<Lang, string[]> = {
  es: ["el", "la", "los", "las", "de", "del", "y", "con", "en", "un", "una", "para", "hasta", "agregar", "cocinar", "minutos", "sal", "taza", "cucharada", "aceite", "mantequilla", "cebolla", "azúcar", "harina", "leche", "pimienta", "ajo", "papas", "papa", "agua"],
  fr: ["le", "la", "les", "de", "du", "des", "et", "avec", "dans", "un", "une", "pour", "jusqu", "ajouter", "cuire", "minutes", "sel", "tasse", "c", "à", "au", "aux", "huile", "beurre", "oignon", "oignons", "sucre", "farine", "lait", "poivre", "ail", "terre", "eau"],
  en: ["the", "and", "with", "in", "a", "an", "of", "for", "until", "add", "cook", "minutes", "salt", "cup", "tablespoon", "to", "into", "oil", "butter", "onion", "sugar", "flour", "milk", "pepper", "garlic", "potatoes", "water"],
};

function words(text: string): string[] {
  return text.toLowerCase().replace(/[’']/g, " ").split(/[^a-zà-ÿœ]+/).filter(Boolean);
}

/** Idioma más probable de un texto (o null si es demasiado corto para decidir). */
export function detect(text: string): Lang | null {
  const w = words(text);
  if (w.length < 6) return null;
  // palabras exclusivas pesan más que las compartidas (la, de)
  const score = (l: Lang) => w.reduce((a, x) => a + (STOP[l].includes(x) ? (Object.values(STOP).filter((s) => s.includes(x)).length === 1 ? 2 : 0.5) : 0), 0);
  const ranked = (["es", "fr", "en"] as Lang[]).map((l) => [l, score(l)] as const).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] < 3 || ranked[0][1] < ranked[1][1] * 1.3) return null;
  return ranked[0][0];
}

/** ¿El texto está en otro idioma claramente distinto al pedido? */
export function isWrongLang(text: string, lang: Lang): boolean {
  const d = detect(text);
  return d !== null && d !== lang;
}

/** Traduce una lista de textos manteniendo el orden. Devuelve los originales si falla. */
export async function translateList(texts: string[], lang: Lang, context: string, timeoutMs = 30000): Promise<string[]> {
  if (!texts.length) return texts;
  try {
    const r = await geminiJson<{ t: string[] }>(
      `Translate each string into ${LANG_NAMES[lang]}. Context: ${context}.
Rules: translate EVERYTHING into ${LANG_NAMES[lang]} (also cooking verbs, ingredient names and units like "c. à soupe" -> the ${LANG_NAMES[lang]} equivalent);
keep numbers, temperatures and proper dish names (e.g. "Pâté chinois", "Pozole") as they are; same order and same count; no extra text.
Return ONLY JSON {"t":[...]} with exactly ${texts.length} strings.
STRINGS: ${JSON.stringify(texts)}`,
      { timeoutMs, temperature: 0 },
    );
    if (Array.isArray(r.t) && r.t.length === texts.length) return r.t.map((x, i) => (typeof x === "string" && x.trim() ? x : texts[i]));
  } catch (e: any) {
    console.warn("translateList", e?.code, e?.message);
  }
  return texts;
}
