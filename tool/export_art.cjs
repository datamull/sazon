// Convierte las ilustraciones de la web (public/art.js) en SVG con colores fijos para Flutter.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const window = {};
new Function("window", src)(window);
const ART = window.SAZON_ART;
const PAL = {
  light: { tb: "#e3e6d6", wd: "#c99a62", mt: "#b9c2b5", dk: "#3c463b", hd: "#3c463b", gr: "#2f6b3f", gr2: "#6e8a42", ye: "#e9b949", re: "#c8442b", bwFill: "#ffffff", fd: "#e9b949", gl: "#e7f1ee", wt: "#cfe3ea", fl: "#ffffff", flame: "#e8743b", metal: "#b9c2b5" },
  dark:  { tb: "#262d25", wd: "#9b7548", mt: "#6f7a6c", dk: "#c9d2c4", hd: "#c9d2c4", gr: "#7fc28f", gr2: "#a9b85f", ye: "#e9c46a", re: "#ee8166", bwFill: "#1b211b", fd: "#e9c46a", gl: "#2a3632", wt: "#2c4650", fl: "#1b211b", flame: "#f08a4b", metal: "#6f7a6c" },
};
function style(cls, p) {
  const fill = (c) => `fill="${c}"`;
  const line = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`;
  return {
    tb: fill(p.tb), wd: fill(p.wd), mt: fill(p.mt), dk: fill(p.dk), hd: fill(p.hd), gr: fill(p.gr), gr2: fill(p.gr2),
    ye: fill(p.ye), re: fill(p.re), fd: `fill="${p.fd}" opacity="0.8"`, wt: fill(p.wt), fl: fill(p.fl),
    bw: `fill="${p.bwFill}" stroke="${p.dk}" stroke-width="3"`, gl: `fill="${p.gl}" stroke="${p.dk}" stroke-width="3"`,
    ln: line(p.dk, 3), dk2: line(p.dk, 3), pe: line(p.ye, 7), st: `${line(p.metal, 3)} opacity="0.8"`,
    fl2: `fill="${p.flame}" stroke="${p.ye}" stroke-width="2"`, glow: `stroke="${p.flame}" stroke-width="4" stroke-linecap="round" opacity="0.8" fill="none"`,
    bub: fill(p.fl),
  }[cls];
}
function convert(svg, p) {
  // los grupos con clase de color heredan a sus hijos: pasamos el color al <g>
  let out = svg.replace(/ class="art"/, "").replace(/ role="img"/, "");
  out = out.replace(/class="([^"]+)"/g, (_, cls) => {
    const parts = cls.split(/\s+/).map((c) => style(c, p)).filter(Boolean);
    return parts[0] || "";
  });
  return out.replace(/\s+/g, " ").trim();
}
let dart = "// Generado por tool/export_art.cjs desde la web (public/art.js). No editar a mano.\n// Ilustraciones de cada acción de cocina; no muestran el plato exacto sino el gesto del paso.\n\nconst Map<String, String> stepArtLight = {\n";
for (const [k, v] of Object.entries(ART)) dart += `  '${k}': r'''${convert(v, PAL.light)}''',\n`;
dart += "};\n\nconst Map<String, String> stepArtDark = {\n";
for (const [k, v] of Object.entries(ART)) dart += `  '${k}': r'''${convert(v, PAL.dark)}''',\n`;
dart += "};\n";
fs.writeFileSync(process.argv[3], dart);
console.log("ok", Object.keys(ART).length);
