// Utilidades HTTP compartidas por las funciones.

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function fetchWithTimeout(url: string, ms = 12000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, "accept-language": "fr-CA,fr;q=0.9,es;q=0.8,en;q=0.7", ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function json(data: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
  if (cacheSeconds > 0) headers["cache-control"] = `public, max-age=${cacheSeconds}`;
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorJson(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}

/** minúsculas, sin tildes, sin signos */
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function stripTags(s: string): string {
  return decodeEntities(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Primera foto que realmente carga (responde 200 con tipo imagen); se prueban como máximo 3. */
export async function firstWorkingImage(candidates: string[]): Promise<string | undefined> {
  for (const u of candidates.slice(0, 3)) {
    try {
      const r = await fetchWithTimeout(u, 4000, { method: "GET", headers: { range: "bytes=0-0", accept: "image/*" } });
      const ok = (r.status === 200 || r.status === 206) && /^image\//.test(r.headers.get("content-type") || "");
      r.body?.cancel().catch(() => {});
      if (ok) return u;
    } catch {}
  }
  return undefined;
}

/** Ejecuta tareas con concurrencia limitada. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
