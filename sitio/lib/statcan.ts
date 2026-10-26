// Precios de detalle promedio mensuales en Quebec — Statistics Canada, tabla 18-10-0245-01.
// API oficial y gratuita (Web Data Service). Se guarda en caché 7 días (StatCan publica una vez al mes).
import { readCache, writeCache } from "./cache.js";

export const STATCAN_TABLE_URL = "https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=1810024501";
const WDS = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods";
const QUEBEC = 5;
const KEY = "statcan-qc-v1";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/** id de producto StatCan → nombre (tal como lo publica la tabla). Sin productos de higiene. */
export const PRODUCTS: Record<number, string> = {
  1: "Boeuf à ragoût, par kilogramme", 2: "Contrefilets de boeuf, par kilogramme", 3: "Hauts de surlonge de boeuf, par kilogramme",
  41: "Côtes de boeuf, par kilogramme", 4: "Boeuf haché, par kilogramme", 5: "Longes de porc, par kilogramme", 6: "Côtes de porc, par kilogramme",
  42: "Épaule de porc, par kilogramme", 7: "Poulet entier, par kilogramme", 8: "Poitrines de poulet, par kilogramme",
  9: "Hauts de cuisse de poulet, par kilogramme", 43: "Pilons de poulet, par kilogramme", 10: "Bacon, 500 grammes",
  11: "Saucisses fumées, 400 grammes", 78: "Saumon, par kilogramme", 79: "Crevette, 300 grammes", 44: "Saumon en conserve, 213 grammes",
  12: "Thon en conserve, 170 grammes", 80: "Burgers sans viande, 226 grammes", 13: "Lait, 1 litre", 14: "Lait, 2 litres", 15: "Lait, 4 litres",
  81: "Lait de soja, 1,89 litres", 82: "Lait de noix, 1,89 litres", 16: "Crème, 1 litre", 17: "Beurre, 454 grammes", 83: "Margarine, 907 grammes",
  18: "Fromage en bloc, 500 grammes", 19: "Yogourt, 500 grammes", 20: "Oeufs, 1 douzaine", 21: "Pommes, par kilogramme",
  22: "Oranges, par kilogramme", 23: "Oranges, 1,36 kilogrammes", 24: "Bananes, par kilogramme", 25: "Poires, par kilogramme",
  26: "Citrons, unité", 45: "Limes, unité", 27: "Raisins, par kilogramme", 28: "Cantaloup, unité", 84: "Fraises, 454 grammes",
  29: "Avocat, unité", 30: "Pommes de terre, 4,54 kilogrammes", 46: "Pommes de terre, par kilogramme", 47: "Patates douces, par kilogramme",
  31: "Tomates, par kilogramme", 32: "Chou, par kilogramme", 33: "Carottes, 1,36 kilogrammes", 34: "Oignons, par kilogramme",
  35: "Oignons, 1,36 kilogrammes", 36: "Céleri, unité", 37: "Concombre, unité", 38: "Champignons, 227 grammes", 48: "Laitue iceberg, unité",
  49: "Laitue romaine, unité", 39: "Brocoli, unité", 40: "Poivrons, par kilogramme", 85: "Courge, par kilogramme",
  86: "Légumes-feuilles, 142 grammes", 50: "Pommes de terre frites surgelées, 750 grammes", 51: "Haricots verts surgelés, 750 grammes",
  52: "Brocoli surgelé, 500 grammes", 53: "Maïs surgelé, 750 grammes", 54: "Mélange de légumes surgelé, 750 grammes",
  55: "Petits pois surgelés, 750 grammes", 87: "Pizza surgelé, 390 grammes", 88: "Épinard surgelé, 300 grammes", 89: "Fraises surgelé, 600 grammes",
  56: "Pain blanc, 675 grammes", 90: "Pain sans levain et pita, 500 grammes", 91: "Craquelins et pain croustillant, 200 grammes",
  92: "Biscuits et biscuits sucrés, 300 grammes", 57: "Pâtes sèches ou fraîches, 500 grammes", 93: "Riz complet, 900 grammes",
  94: "Riz blanc, 2 kilogrammes", 58: "Céréales, 400 grammes", 59: "Farine de blé, 2,5 kilogrammes", 60: "Sucre blanc, 2 kilogrammes",
  61: "Jus de pomme, 2 litres", 62: "Jus d’orange, 2 litres", 63: "Café torréfié ou moulu, 340 grammes", 64: "Thé (20 sachets)",
  65: "Ketchup, 1 litre", 66: "Huile végétale, 3 litres", 95: "Huile de canola, 3 litres", 96: "Huile d'olive, 1 litre",
  68: "Beurre d’arachide, 1 kilogramme", 69: "Mayonnaise, 890 millilitres", 70: "Fèves au lard en conserve, 398 millilitres",
  71: "Tomates en conserve, 796 millilitres", 72: "Soupe en conserve, 284 millilitres", 73: "Haricots et lentilles en conserve, 540 millilitres",
  98: "Maïs en conserve, 341 millilitres", 99: "Pêche en conserve, 398 millilitres", 100: "Poire en conserve, 398 millilitres",
  74: "Lentilles séchées, 900 grammes", 101: "Haricots et légumineuses secs, 900 grammes", 102: "Tofu, 350 grammes", 103: "Houmous, 227 grammes",
  104: "Salsa, 418 millilitres", 105: "Sauce pour pâtes, 650 millilitres", 106: "Vinaigrette, 475 millilitres", 107: "Amandes, 200 grammes",
  108: "Arachides, 450 grammes", 109: "Graines de tournesol, 400 grammes",
};

export interface StatPrice { price: number; period: string; product: string; size: string }
let memo: { at: number; data: Record<number, { price: number; period: string }> } | null = null;

/** "Oignons, par kilogramme" → "1 kg"; "Lait, 2 litres" → "2 litres"; "Avocat, unité" → "unité" */
export function sizeOf(name: string): string {
  const s = name.split(",").slice(1).join(",").trim();
  if (/par kilogramme/i.test(s)) return "1 kg";
  return s.replace(/kilogrammes?/i, "kg").replace(/grammes?/i, "g").replace(/millilitres?/i, "ml") || name;
}

async function download(): Promise<Record<number, { price: number; period: string }>> {
  const body = Object.keys(PRODUCTS).map((p) => ({ productId: 18100245, coordinate: `${QUEBEC}.${p}.0.0.0.0.0.0.0.0`, latestN: 3 }));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(WDS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error("StatCan " + res.status);
    const rows: any[] = await res.json();
    const out: Record<number, { price: number; period: string }> = {};
    for (const r of rows) {
      if (r.status !== "SUCCESS") continue;
      const pid = Number(String(r.object.coordinate).split(".")[1]);
      // el período más reciente con valor publicado
      const pts = (r.object.vectorDataPoint || []).filter((p: any) => typeof p.value === "number").sort((a: any, b: any) => (a.refPer < b.refPer ? 1 : -1));
      if (pts[0]) out[pid] = { price: pts[0].value, period: String(pts[0].refPer).slice(0, 7) };
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

export async function getQuebecPrices(): Promise<Record<number, { price: number; period: string }>> {
  if (memo && Date.now() - memo.at < MAX_AGE_MS) return memo.data;
  const c = await readCache<NonNullable<typeof memo>>(KEY);
  if (c && Date.now() - c.at < MAX_AGE_MS && Object.keys(c.data).length) return (memo = c).data;
  try {
    const data = await download();
    memo = { at: Date.now(), data };
    if (Object.keys(data).length > 20) await writeCache(KEY, memo);
    return data;
  } catch (e) {
    console.warn("StatCan no disponible", String(e));
    return memo?.data || {};
  }
}

export function statPrice(pid: number, data: Record<number, { price: number; period: string }>): StatPrice | null {
  const d = data[pid];
  const name = PRODUCTS[pid];
  if (!d || !name) return null;
  return { price: d.price, period: d.period, product: name.split(",")[0], size: sizeOf(name) };
}
