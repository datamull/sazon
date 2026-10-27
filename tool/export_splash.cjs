// Exporta los dibujos de la portada (sitio/public/splash-art.js) a lib/data/splash_art.dart.
// Uso: node tool/export_splash.cjs sitio/public/splash-art.js lib/data/splash_art.dart
const fs = require("fs");
const window = {};
new Function("window", fs.readFileSync(process.argv[2], "utf8"))(window);
const A = window.SAZON_SPLASH;
const q = (s) => "r'''" + s.replace(/ class="sp"/g, "") + "'''";
let d = "// Generado por tool/export_splash.cjs desde la web (sitio/public/splash-art.js). No editar a mano.\n\n";
d += "class SplashPart {\n  final double x, y, w, h, rot;\n  final String svg;\n  const SplashPart(this.x, this.y, this.w, this.h, this.rot, this.svg);\n}\n\n";
d += `const splashStageW = ${A.stage.w}.0;\nconst splashStageH = ${A.stage.h}.0;\n\n`;
d += "const Map<String, SplashPart> splashParts = {\n";
for (const [k, p] of Object.entries(A.parts)) {
  const b = p.box;
  d += `  '${k}': SplashPart(${b.x}, ${b.y}, ${b.w}, ${b.h}, ${p.rot || 0}, ${q(p.svg)}),\n`;
}
d += "};\n\n";
d += `const splashDrops = [${A.drops.map((x) => `'${x}'`).join(", ")}];\n`;
fs.writeFileSync(process.argv[3], d);
console.log("ok", Object.keys(A.parts).length);
