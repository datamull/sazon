// Exporta los textos y platos populares de la web (sitio/public/i18n.js) a lib/l10n/strings_data.dart.
// Uso: node tool/export_strings.cjs sitio/public/i18n.js lib/l10n/strings_data.dart
const fs = require("fs");
const window = {};
new Function("window", fs.readFileSync(process.argv[2], "utf8"))(window);
const I = window.SAZON_I18N, P = window.SAZON_POPULAR;
const q = (v) => "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$") + "'";
let d = "// Generado desde la web (sitio/public/i18n.js) con tool/export_strings.cjs para que la app y la web digan lo mismo.\n\nconst Map<String, Map<String, String>> uiStrings = {\n";
for (const [lang, o] of Object.entries(I)) {
  d += `  ${q(lang)}: {\n`;
  for (const [k, v] of Object.entries(o)) {
    if (k === "countries") { for (const [c, n] of Object.entries(v)) d += `    ${q("country" + c)}: ${q(n)},\n`; continue; }
    d += `    ${q(k)}: ${q(v)},\n`;
  }
  d += "  },\n";
}
d += "};\n\nclass PopularDish {\n  final String q;\n  final Map<String, String> labels;\n  const PopularDish(this.q, this.labels);\n}\n\n/// Orden de los países (también el de la rotación del plato del día).\nconst popularCountries = ['QC', 'CL', 'MX', 'CO'];\n\nconst Map<String, List<PopularDish>> popularDishes = {\n";
for (const [c, list] of Object.entries(P)) {
  d += `  ${q(c)}: [\n`;
  for (const x of list) d += `    PopularDish(${q(x.q)}, {${["es", "fr", "en"].map((l) => `${q(l)}: ${q(x[l])}`).join(", ")}}),\n`;
  d += "  ],\n";
}
d += "};\n\n/// Dos sitios de recetas por país (los mismos del servidor).\nconst Map<String, String> recipeSources = {\n  'QC': 'Télé-Québec · Mordu (Radio-Canada)',\n  'CL': 'Gourmet.cl · Recetas Nestlé Chile',\n  'MX': 'Recetas Nestlé México · Cocina Fácil',\n  'CO': 'My Colombian Recipes · Recetas Nestlé Colombia',\n};\n\nconst dietKeys = ['gluten', 'lactose', 'vegetarian', 'vegan'];\n";
fs.writeFileSync(process.argv[3], d);
console.log("ok");
