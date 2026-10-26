// POST /api/prices  { postal: "G1R 4S9", items: [{ id, name, query }] }
// Busca cada ingrediente en las circulares (Flipp) de los supermercados cercanos al código postal,
// Gemini descarta productos que no corresponden y asocia cada ingrediente a un producto de StatCan;
// lo que no está en oferta usa el precio promedio oficial de Quebec (o, si no hay equivalente, una estimación de Gemini).
import { errorJson, fetchWithTimeout, json, normalize, pool } from "../http.js";
import { geminiJson, hasGemini } from "../gemini.js";
import { getQuebecPrices, PRODUCTS, statPrice, STATCAN_TABLE_URL } from "../statcan.js";

interface Item { id: string; name: string; query: string }
interface Cand { k: number; merchant: string; name: string; price: number; unit: string; validTo: string | null; image: string | null }

const NOT_GROCERY = /canadian tire|best buy|home depot|rona|bureau en gros|staples|jean coutu|brunet|uniprix|familiprix|sports|toys|ikea|structube|la source|sail/i;

async function flipp(query: string, postal: string): Promise<Cand[]> {
  const url = `https://backflipp.wishabi.com/flipp/items/search?locale=fr-ca&postal_code=${encodeURIComponent(postal)}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, 10000, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const d: any = await res.json();
    const items: any[] = d.items || [];
    return items
      .filter((x) => typeof x.current_price === "number" && x.current_price > 0 && !NOT_GROCERY.test(x.merchant_name || ""))
      .slice(0, 14)
      .map((x, k) => ({
        k,
        merchant: String(x.merchant_name),
        name: String(x.name || "").replace(/\s+/g, " ").trim(),
        price: x.current_price,
        unit: [x.pre_price_text, x.post_price_text].filter(Boolean).join(" ").trim(),
        validTo: x.valid_to || null,
        image: x.clean_image_url || null,
      }));
  } catch {
    return [];
  }
}

function naiveMatch(query: string, c: Cand): boolean {
  const q = normalize(query).split(" ").filter((t) => t.length > 2);
  const n = normalize(c.name);
  // sin IA: basta con que aparezca la palabra principal (la primera del término de búsqueda)
  return q.length > 0 && n.includes(q[0].slice(0, Math.max(4, q[0].length - 1)));
}

export default async (req: Request) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorJson("bad_body", "Cuerpo JSON inválido");
  }
  const postal = String(body.postal || "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) return errorJson("bad_postal", "Código postal canadiense inválido (ej.: G1R 4S9)");
  const items: Item[] = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 30)
    .map((i: any) => ({ id: String(i.id), name: String(i.name || "").slice(0, 80), query: String(i.query || i.name || "").slice(0, 40) }))
    .filter((i: Item) => i.query);
  if (!items.length) return errorJson("no_items", "No hay ingredientes para buscar");

  const [cands, stat] = await Promise.all([pool(items, 5, (i) => flipp(i.query, postal)), getQuebecPrices()]);
  const statList = Object.keys(stat).map((id) => `${id}=${PRODUCTS[Number(id)]}`).join("; ");

  // Gemini: qué candidatos SON el ingrediente + precio habitual estimado
  let matches: Record<string, number[]> = {};
  let estimates: Record<string, { price: number; size: string; source: "statcan" | "ai"; product?: string; period?: string }> = {};
  let aiUsed = false;
  if (hasGemini()) {
    try {
      const payload = items.map((it, i) => ({
        i,
        ingredient: it.name,
        search: it.query,
        candidates: cands[i].map((c) => [c.k, c.merchant, c.name, c.price, c.unit]),
      }));
      const r = await geminiJson<{ items: { i: number; match: number[]; statcan?: number | null; estimate?: { price: number; size: string } }[] }>(
        `You compare grocery flyer products in Quebec, Canada against recipe ingredients.
For each ingredient: "match" = candidate numbers (k) that ARE that ingredient in a form a cook would buy for it
(same food; any brand/size; exclude snacks, ready meals, sauces or different foods that only share a word).
"statcan" = id of the Statistics Canada product below that is the SAME food (same item, a plain/generic form of it), else null.
Prefer the per-kilogram or smallest package variant. Do not map to a different food (e.g. sweet corn kernels -> "Maïs surgelé" or "Maïs en conserve" is fine; fresh basil -> null).
"estimate" = only when statcan is null: typical REGULAR price in CAD at a Quebec supermarket for the smallest common package, with its size (e.g. {"price":3.49,"size":"bouquet"}).
Return ONLY JSON {"items":[{"i":0,"match":[0,3],"statcan":34,"estimate":null}]}
STATCAN PRODUCTS: ${statList}
DATA: ${JSON.stringify(payload)}`,
        { timeoutMs: 40000, temperature: 0 },
      );
      for (const row of r.items || []) {
        const it = items[row.i];
        if (!it) continue;
        matches[it.id] = Array.isArray(row.match) ? row.match.filter((k) => typeof k === "number") : [];
        const sp = typeof row.statcan === "number" ? statPrice(row.statcan, stat) : null;
        if (sp) estimates[it.id] = { price: sp.price, size: sp.size, source: "statcan", product: sp.product, period: sp.period };
        else if (row.estimate && typeof row.estimate.price === "number" && row.estimate.price > 0)
          estimates[it.id] = { price: Math.round(row.estimate.price * 100) / 100, size: String(row.estimate.size || ""), source: "ai" };
      }
      aiUsed = true;
    } catch (e: any) {
      console.warn("Gemini prices", e?.code, e?.message);
      matches = {};
    }
  }

  // Sin IA (o si no respondió): asociar a StatCan por la palabra principal del término de búsqueda
  for (const it of items) {
    if (estimates[it.id]) continue;
    const stem = (w: string) => w.replace(/(es|s|x)$/, "");
    const words = normalize(it.query).split(" ").filter((t) => t.length > 2).map(stem);
    if (!words.length) continue;
    // el producto cuyo nombre comparte más palabras con la búsqueda (la principal debe coincidir)
    let pid: number | undefined;
    let best = 0;
    for (const id of Object.keys(stat).map(Number)) {
      const pw = normalize(PRODUCTS[id].split(",")[0]).split(" ").filter((t) => t.length > 2).map(stem);
      if (pw[0] !== words[0]) continue;
      const score = words.filter((w) => pw.includes(w)).length - pw.filter((w) => !words.includes(w)).length * 0.5;
      if (score > best) [best, pid] = [score, id];
    }
    const sp = pid ? statPrice(pid, stat) : null;
    if (sp) estimates[it.id] = { price: sp.price, size: sp.size, source: "statcan", product: sp.product, period: sp.period };
  }

  // Oferta más barata por ingrediente y por tienda
  const offers: Record<string, Record<string, Omit<Cand, "k" | "merchant">>> = {};
  const stores = new Set<string>();
  items.forEach((it, i) => {
    const ok = aiUsed && matches[it.id] ? cands[i].filter((c) => matches[it.id].includes(c.k)) : cands[i].filter((c) => naiveMatch(it.query, c));
    const byStore: Record<string, Omit<Cand, "k" | "merchant">> = {};
    for (const c of ok) {
      const prev = byStore[c.merchant];
      if (!prev || c.price < prev.price) byStore[c.merchant] = { name: c.name, price: c.price, unit: c.unit, validTo: c.validTo, image: c.image };
      stores.add(c.merchant);
    }
    offers[it.id] = byStore;
  });

  return json({ postal, stores: [...stores].sort(), offers, estimates, aiUsed, statcanUrl: STATCAN_TABLE_URL, fetchedAt: new Date().toISOString() });
};

