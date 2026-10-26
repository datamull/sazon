// Cliente mínimo de la API de Gemini (Google AI Studio, nivel gratuito).
// Clave: variable de entorno GEMINI_API_KEY (en Vercel: Settings → Environment Variables). Modelo: GEMINI_MODEL (opcional).

const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function hasGemini(): boolean {
  return !!env("GEMINI_API_KEY");
}

export class GeminiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Pide a Gemini una respuesta JSON y la devuelve ya parseada. */
export async function geminiJson<T = any>(prompt: string, opts: { timeoutMs?: number; temperature?: number } = {}): Promise<T> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new GeminiError("no_key", "Falta GEMINI_API_KEY en el servidor");
  const preferred = env("GEMINI_MODEL");
  const models = preferred ? [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)] : FALLBACK_MODELS;
  let lastErr: GeminiError | null = null;
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.2 },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // 404: modelo no existe para esta clave; 429: cuota; 5xx: saturado → probar el siguiente
        lastErr = new GeminiError(res.status === 429 ? "rate_limited" : `http_${res.status}`, body.slice(0, 300));
        if ([404, 429, 500, 502, 503, 504].includes(res.status)) continue;
        throw lastErr;
      }
      const data: any = await res.json();
      const text: string = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        lastErr = new GeminiError("invalid_json", cleaned.slice(0, 200));
        continue;
      }
    } catch (e: any) {
      if (e instanceof GeminiError) throw e;
      lastErr = new GeminiError(e?.name === "AbortError" ? "timeout" : "network", String(e?.message || e));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new GeminiError("unknown", "Gemini no respondió");
}
