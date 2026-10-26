// Función de Vercel: /api/search (la lógica está en lib/handlers/search.ts)
import handler from "../lib/handlers/search.js";

export function GET(request: Request): Promise<Response> {
  return handler(request);
}
