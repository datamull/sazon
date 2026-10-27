// Dibujos de la portada (olla e ingredientes). Los usan la web (splash en app.js)
// y la app iPhone (exportados con tool/export_splash.cjs).
// Cada elemento es un SVG propio; "box" es su posición en un escenario de 200 × 220.
(function () {
  const C = {
    green: "#2F6B3F",
    cream: "#F4F6EE",
    maize: "#E9B949",
    maizeDeep: "#C99A2E",
    chile: "#C8442B",
    amber: "#D9822B",
    leaf: "#A8D5A2",
    stem: "#5E9C62",
    brown: "#6B4A2B",
    plantain: "#DCC64E",
  };
  const svg = (vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

  const parts = {
    // cuerpo de la olla (va delante de los ingredientes: así "entran" en ella)
    potBody: {
      box: { x: 44, y: 100, w: 112, h: 60 },
      svg: svg(
        "0 0 112 60",
        `<path d="M0 0h112v30a30 30 0 0 1-30 30H30A30 30 0 0 1 0 30z" fill="${C.maize}"/>` +
          `<path d="M0 0h112v6H0z" fill="${C.maizeDeep}" opacity=".35"/>` +
          `<circle cx="86" cy="30" r="10" fill="${C.chile}"/>`,
      ),
    },
    rim: {
      box: { x: 30, y: 94, w: 140, h: 12 },
      svg: svg("0 0 140 12", `<path d="M6 6h128" stroke="${C.cream}" stroke-width="10" stroke-linecap="round"/>`),
    },
    steam: {
      box: { x: 70, y: 36, w: 60, h: 52 },
      svg: svg(
        "0 0 60 52",
        `<path class="sp" d="M18 50c-8-10 8-16 0-26s8-16 0-22" fill="none" stroke="${C.cream}" stroke-width="5" stroke-linecap="round"/>` +
          `<path class="sp" d="M42 50c-8-10 8-16 0-26s8-16 0-22" fill="none" stroke="${C.cream}" stroke-width="5" stroke-linecap="round"/>`,
      ),
    },
    // Quebec: hoja de arce (sirope)
    maple: {
      box: { x: 50, y: 70, w: 40, h: 42 },
      rot: -18,
      svg: svg(
        "0 0 40 42",
        `<path d="M20 2l4 10 7-4-2 10 9-2-5 8 3 2-12 4-2 8h-4l-2-8-12-4 3-2-5-8 9 2-2-10 7 4z" fill="${C.amber}"/>` +
          `<path d="M20 30v11" stroke="${C.brown}" stroke-width="2.5" stroke-linecap="round"/>`,
      ),
    },
    // Chile: choclo
    corn: {
      box: { x: 80, y: 62, w: 24, h: 46 },
      rot: 12,
      svg: svg(
        "0 0 24 46",
        `<ellipse cx="12" cy="18" rx="8" ry="16" fill="${C.maize}"/>` +
          `<path d="M7 8h10M5 14h14M5 20h14M5 26h14M7 32h10M12 3v30" stroke="${C.maizeDeep}" stroke-width="1.4"/>` +
          `<path d="M12 46C4 36 1 24 5 13c3 13 5 22 7 33zM12 46c8-10 11-22 7-33-3 13-5 22-7 33z" fill="${C.leaf}"/>`,
      ),
    },
    // México: chile
    chili: {
      box: { x: 104, y: 64, w: 24, h: 46 },
      rot: -10,
      svg: svg(
        "0 0 24 46",
        `<path d="M8 8c10 0 14 10 12 22-2 10-10 15-16 15 6-6 8-14 6-24-1-6-2-9-2-13z" fill="${C.chile}"/>` +
          `<path d="M8 8C7 4 10 1 15 2" fill="none" stroke="${C.stem}" stroke-width="3" stroke-linecap="round"/>` +
          `<ellipse cx="9.5" cy="8.5" rx="4.5" ry="2.6" fill="${C.stem}"/>`,
      ),
    },
    // Colombia: plátano
    plantain: {
      box: { x: 118, y: 74, w: 48, h: 26 },
      rot: 16,
      svg: svg(
        "0 0 48 26",
        `<path d="M2 6c12 14 32 14 44-2-2 12-16 20-28 18C10 21 4 14 2 6z" fill="${C.plantain}"/>` +
          `<path d="M8 12c10 7 24 7 34-3" fill="none" stroke="${C.maizeDeep}" stroke-width="1.4" opacity=".7"/>` +
          `<circle cx="3" cy="6" r="2.4" fill="${C.brown}"/><circle cx="45.5" cy="4.5" r="2" fill="${C.brown}"/>`,
      ),
    },
  };

  // orden de caída: Quebec, Chile, México, Colombia
  const drops = ["maple", "corn", "chili", "plantain"];

  window.SAZON_SPLASH = { C, parts, drops, stage: { w: 200, h: 220 } };
})();
