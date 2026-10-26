# Sazón — sitio web y servidor (Vercel)

Recetas populares de Quebec, Chile, México y Colombia traídas en vivo de sus sitios (no se guardan), con perfil alimenticio, sustitutos según el país, plan de compras con precios y preparación paso a paso. La app iPhone (carpeta superior) usa este mismo servidor.

## Estructura
- `public/` — la web (HTML, CSS, JS sin compilar)
- `api/` — funciones de Vercel: `GET /api/search`, `GET /api/recipe`, `POST /api/prices`
- `lib/` — lógica compartida (fuentes, extracción de recetas, Gemini, precios, StatCan)

## Fuentes de recetas (2 por país)
| País | Sitios |
|---|---|
| Quebec | cuisinez.telequebec.tv · ici.radio-canada.ca/mordu |
| Chile | gourmet.cl · recetasnestle.cl |
| México | recetasnestle.com.mx · cocinafacil.com.mx |
| Colombia | mycolombianrecipes.com · recetasnestle.com.co |

La búsqueda devuelve como máximo 4 recetas, solo de los sitios del país de origen del plato, y comprueba que cada página publique la receta completa.

## Perfil alimenticio
`/api/search` y `/api/recipe` aceptan `diet=gluten,lactose,vegetarian,vegan`. Gemini marca los ingredientes no aptos y propone sustitutos que cumplen todos los regímenes; una lista de prohibidos por régimen rechaza sustitutos que no cumplen (p. ej. seitán para sin gluten) y pide otro.

## Precios
Ofertas de las circulares (Flipp) por código postal canadiense + promedios mensuales de Quebec de Statistics Canada (tabla 18-10-0245-01) + estimación de Gemini cuando no hay dato.

## Configuración en Vercel
1. Importar el repositorio con **Root Directory = `sitio`** y Framework **Other**.
2. Variable de entorno `GEMINI_API_KEY` (clave gratuita de Google AI Studio). Opcional: `GEMINI_MODEL`.

## Local
```
npm install
npm run dev            # http://localhost:8888
npm run check          # revisión de tipos
npm run test:sources   # los 40 platos populares contra las fuentes
```
