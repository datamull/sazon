// Ilustraciones de cada acción de cocina (SVG propio, usa los colores del tema).
// No muestran el plato exacto: representan el gesto del paso (picar, revolver, hornear…).
(function () {
  const W = (inner) =>
    `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" role="img" class="art">${inner}</svg>`;
  const steam = (x, y) =>
    `<path class="st" d="M${x} ${y}c-6-8 6-12 0-20s6-12 0-20"/><path class="st" d="M${x + 16} ${y + 4}c-6-8 6-12 0-20s6-12 0-20"/><path class="st" d="M${x + 32} ${y}c-6-8 6-12 0-20s6-12 0-20"/>`;
  const table = `<rect class="tb" x="0" y="132" width="240" height="28"/>`;

  const ART = {
    chop: W(`${table}
      <rect class="wd" x="38" y="104" width="150" height="30" rx="8"/>
      <circle class="dk" cx="174" cy="112" r="4"/>
      <circle class="gr" cx="70" cy="98" r="18"/><path class="ln" d="M70 80c2-8 8-12 14-12"/>
      <rect class="gr2" x="96" y="92" width="10" height="12" rx="2"/><rect class="gr2" x="110" y="94" width="10" height="10" rx="2"/><rect class="gr2" x="124" y="92" width="10" height="12" rx="2"/>
      <g class="move-y"><path class="mt" d="M138 40 L196 52 L190 74 L132 64 Z"/><rect class="hd" x="190" y="50" width="38" height="14" rx="6" transform="rotate(12 190 50)"/></g>`),
    peel: W(`${table}
      <ellipse class="ye" cx="96" cy="94" rx="34" ry="28"/>
      <path class="ln" d="M70 84c12-10 40-12 56 2"/>
      <path class="pe" d="M128 96c18 6 22 22 10 30s-26 0-20 10"/>
      <g class="move-x"><rect class="hd" x="150" y="54" width="54" height="14" rx="7" transform="rotate(-24 150 54)"/><rect class="mt" x="126" y="72" width="30" height="10" rx="3" transform="rotate(-24 126 72)"/></g>`),
    grate: W(`${table}
      <path class="mt" d="M120 30 L160 30 L176 128 L104 128 Z"/>
      <g class="dk">${[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => `<rect x="${118 + c * 14 + r * 1}" y="${46 + r * 16}" width="8" height="4" rx="2"/>`).join("")).join("")}</g>
      <rect class="hd" x="126" y="16" width="28" height="12" rx="6"/>
      <rect class="ye" x="40" y="70" width="46" height="34" rx="6" transform="rotate(-18 40 70)"/>
      <g class="ye fall"><rect x="128" y="132" width="3" height="10" rx="1"/><rect x="138" y="136" width="3" height="8" rx="1"/><rect x="148" y="133" width="3" height="10" rx="1"/></g>`),
    mix: W(`${table}
      <path class="bw" d="M44 78 h152 a76 52 0 0 1 -152 0 Z"/>
      <ellipse class="fd" cx="120" cy="80" rx="70" ry="10"/>
      <path class="ln spin" d="M96 82c10 6 38 6 48 0"/>
      <g class="move-x"><rect class="wd" x="128" y="20" width="10" height="70" rx="5" transform="rotate(24 128 20)"/><ellipse class="wd" cx="112" cy="88" rx="12" ry="7" transform="rotate(24 112 88)"/></g>`),
    whisk: W(`${table}
      <path class="bw" d="M50 82 h140 a70 48 0 0 1 -140 0 Z"/>
      <ellipse class="ye" cx="120" cy="84" rx="64" ry="9"/>
      <g class="shake"><rect class="hd" x="134" y="12" width="12" height="40" rx="6" transform="rotate(20 134 12)"/>
      <path class="ln" d="M126 50c-22 10-26 40-10 44s20-30 10-44M126 50c-8 12-12 38 0 44s16-32 0-44"/></g>`),
    blend: W(`${table}
      <rect class="hd" x="88" y="110" width="64" height="24" rx="6"/><circle class="ye" cx="120" cy="122" r="5"/>
      <path class="gl" d="M92 108 L84 36 L156 36 L148 108 Z"/>
      <path class="gr shake" d="M96 104 L90 64 c14 -8 46 8 60 0 L144 104 Z"/>
      <rect class="dk" x="80" y="26" width="80" height="12" rx="4"/>`),
    knead: W(`${table}
      <rect class="wd" x="22" y="108" width="196" height="26" rx="8"/>
      <ellipse class="ye" cx="96" cy="104" rx="46" ry="16"/>
      <g class="move-x"><rect class="wd" x="128" y="84" width="96" height="16" rx="8"/><rect class="hd" x="118" y="86" width="14" height="12" rx="4"/><rect class="hd" x="220" y="86" width="14" height="12" rx="4"/></g>
      <g class="fl"><circle cx="60" cy="80" r="2"/><circle cx="74" cy="72" r="1.6"/><circle cx="54" cy="66" r="1.4"/></g>`),
    boil: W(`${table}
      <path class="fl2" d="M84 132c4-10 10-10 12 0M112 132c4-12 12-12 14 0M142 132c4-10 10-10 12 0"/>
      <rect class="mt" x="62" y="62" width="116" height="64" rx="10"/>
      <rect class="dk" x="50" y="68" width="16" height="8" rx="4"/><rect class="dk" x="174" y="68" width="16" height="8" rx="4"/>
      <ellipse class="wt" cx="120" cy="64" rx="56" ry="8"/>
      <g class="bub"><circle cx="98" cy="62" r="4"/><circle cx="124" cy="60" r="3"/><circle cx="146" cy="63" r="4"/></g>
      ${steam(100, 46)}`),
    fry: W(`${table}
      <path class="fl2" d="M90 132c4-10 10-10 12 0M116 132c4-12 12-12 14 0M142 132c4-10 10-10 12 0"/>
      <ellipse class="mt" cx="120" cy="108" rx="66" ry="16"/>
      <rect class="hd" x="182" y="100" width="54" height="12" rx="6"/>
      <g class="hop"><path class="ye" d="M92 100c6-10 20-10 24 0z"/><circle class="gr" cx="132" cy="98" r="7"/><rect class="re" x="146" y="94" width="14" height="8" rx="3"/></g>
      <g class="fl"><circle cx="96" cy="84" r="2"/><circle cx="140" cy="80" r="2"/><circle cx="118" cy="76" r="1.6"/></g>`),
    bake: W(`${table}
      <rect class="mt" x="46" y="26" width="148" height="106" rx="10"/>
      <rect class="dk" x="58" y="50" width="124" height="70" rx="6"/>
      <rect class="gl" x="64" y="56" width="112" height="58" rx="4"/>
      <rect class="ye" x="86" y="86" width="68" height="22" rx="4"/><path class="re" d="M86 90h68v-4h-68z"/>
      <path class="glow" d="M70 112h100"/>
      <circle class="dk" cx="70" cy="38" r="4"/><circle class="dk" cx="86" cy="38" r="4"/><rect class="hd" x="150" y="34" width="32" height="7" rx="3"/>`),
    grill: W(`${table}
      <rect class="dk" x="40" y="96" width="160" height="12" rx="4"/>
      <path class="ln" d="M52 96v-6M76 96v-6M100 96v-6M124 96v-6M148 96v-6M172 96v-6"/>
      <path class="fl2 flick" d="M70 128c6-18 14-18 16 0M108 128c6-22 16-22 18 0M150 128c6-18 14-18 16 0"/>
      <rect class="re" x="76" y="70" width="62" height="22" rx="10"/>
      <path class="dk2" d="M88 72l8 18M104 72l8 18M120 72l8 18"/>
      <ellipse class="gr" cx="160" cy="80" rx="16" ry="10"/>
      ${steam(96, 60)}`),
    drain: W(`${table}
      <path class="bw" d="M66 112 h108 a54 18 0 0 1 -108 0 Z"/>
      <path class="mt" d="M70 48 h100 l-10 44 h-80 Z"/>
      <g class="dk"><circle cx="96" cy="66" r="3"/><circle cx="112" cy="72" r="3"/><circle cx="128" cy="66" r="3"/><circle cx="144" cy="72" r="3"/><circle cx="104" cy="82" r="3"/><circle cx="136" cy="82" r="3"/></g>
      <path class="ye" d="M80 46c10-12 70-12 80 0z"/>
      <g class="wt fall"><circle cx="104" cy="98" r="3"/><circle cx="120" cy="104" r="3"/><circle cx="136" cy="98" r="3"/></g>`),
    season: W(`${table}
      <path class="bw" d="M50 100 h140 a70 30 0 0 1 -140 0 Z"/>
      <ellipse class="gr" cx="120" cy="102" rx="64" ry="8"/>
      <g class="shake"><rect class="gl" x="120" y="22" width="34" height="46" rx="10" transform="rotate(30 120 22)"/><rect class="dk" x="126" y="16" width="34" height="12" rx="5" transform="rotate(30 126 16)"/></g>
      <g class="dk fall"><circle cx="104" cy="74" r="1.8"/><circle cx="112" cy="82" r="1.8"/><circle cx="98" cy="86" r="1.6"/><circle cx="118" cy="90" r="1.6"/></g>`),
    rest: W(`${table}
      <path class="bw" d="M44 92 h120 a60 40 0 0 1 -120 0 Z"/>
      <path class="gl" d="M40 90 q64 -22 128 0"/>
      <circle class="mt" cx="186" cy="62" r="34"/><circle class="wt" cx="186" cy="62" r="27"/>
      <path class="ln tick" d="M186 62 V42"/><path class="ln" d="M186 62 L200 70"/>
      <circle class="dk" cx="186" cy="62" r="3"/>`),
    assemble: W(`${table}
      <rect class="gl" x="38" y="70" width="164" height="62" rx="10"/>
      <rect class="ye" x="46" y="78" width="148" height="14" rx="4"/>
      <rect class="re" x="46" y="94" width="148" height="14" rx="4"/>
      <rect class="gr" x="46" y="110" width="148" height="14" rx="4"/>
      <g class="move-y"><rect class="wd" x="120" y="20" width="10" height="44" rx="5" transform="rotate(-30 120 20)"/><ellipse class="ye" cx="150" cy="60" rx="18" ry="8"/></g>`),
    serve: W(`${table}
      <ellipse class="mt" cx="120" cy="114" rx="86" ry="18"/>
      <ellipse class="wt" cx="120" cy="110" rx="70" ry="12"/>
      <path class="ye" d="M80 108c4-24 76-24 80 0z"/>
      <circle class="gr" cx="102" cy="96" r="5"/><circle class="re" cx="124" cy="92" r="5"/><circle class="gr" cx="140" cy="98" r="4"/>
      ${steam(102, 70)}`),
  };
  window.SAZON_ART = ART;
})();
