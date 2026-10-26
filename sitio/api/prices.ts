// Función de Vercel: /api/prices (la lógica está en lib/handlers/prices.ts)
import handler from "../lib/handlers/prices.js";

export function POST(request: Request): Promise<Response> {
  return handler(request);
}
