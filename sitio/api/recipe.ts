// Función de Vercel: /api/recipe (la lógica está en lib/handlers/recipe.ts)
import handler from "../lib/handlers/recipe.js";

export function GET(request: Request): Promise<Response> {
  return handler(request);
}
