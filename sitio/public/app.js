// Sazón — app de cocina con asistente de compras.
(() => {
  "use strict";
  const ART = window.SAZON_ART;
  const I18N = window.SAZON_I18N;
  const POP = window.SAZON_POPULAR;
  const COUNTRIES = ["QC", "CL", "MX", "CO"];
  const FLAGS = { QC: "⚜", CL: "★", MX: "◆", CO: "●" };
  // dos sitios de recetas por país (los mismos del servidor)
  const SOURCES = {
    QC: "Télé-Québec · Mordu (Radio-Canada)",
    CL: "Gourmet.cl · Recetas Nestlé Chile",
    MX: "Recetas Nestlé México · Cocina Fácil",
    CO: "My Colombian Recipes · Recetas Nestlé Colombia",
  };

  // ---------- almacenamiento local (sólo comodidad del usuario) ----------
  const ls = {
    get(k, d) {
      try {
        const v = localStorage.getItem("sazon:" + k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem("sazon:" + k, JSON.stringify(v));
      } catch {}
    },
  };
  const ss = {
    get(k) {
      try {
        const v = sessionStorage.getItem("sazon:" + k);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        sessionStorage.setItem("sazon:" + k, JSON.stringify(v));
      } catch {}
    },
  };

  const guessLang = () => {
    const l = (navigator.language || "es").slice(0, 2);
    return ["es", "fr", "en"].includes(l) ? l : "es";
  };
  const settings = Object.assign({ lang: guessLang(), country: "QC", postal: "", name: "", diet: [] }, ls.get("settings", {}));
  const DIETS = ["gluten", "lactose", "vegetarian", "vegan"];
  if (!Array.isArray(settings.diet)) settings.diet = [];
  // régimen como parámetro estable para la API y las cachés
  const dietParam = () => DIETS.filter((d) => settings.diet.includes(d)).join(",");
  let T = I18N[settings.lang] || I18N.es;

  const S = {
    view: "home",
    tab: settings.country,
    q: "",
    qCountry: null,
    results: null,
    recipe: null,
    url: null,
    subs: {},
    have: {},
    prices: null,
    pricesErr: null,
    mainStore: null,
    step: 0,
    err: null,
    loading: false,
  };

  // ---------- utilidades ----------
  const app = document.getElementById("app");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) =>
    new Intl.NumberFormat(settings.lang === "en" ? "en-CA" : settings.lang === "fr" ? "fr-CA" : "es-CL", {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "narrowSymbol",
    }).format(n);
  const FR = { 0.25: "¼", 0.33: "⅓", 0.5: "½", 0.66: "⅔", 0.67: "⅔", 0.75: "¾" };
  const qtyFmt = (q) => {
    if (q == null) return "";
    const w = Math.floor(q);
    const f = Math.round((q - w) * 100) / 100;
    const fs = FR[f] || (f ? String(f).replace(/^0/, "") : "");
    return (w ? String(w) : "") + (fs ? (w ? " " : "") + fs : "") || String(q);
  };
  const dateFmt = (iso) => {
    try {
      return new Intl.DateTimeFormat(settings.lang === "en" ? "en-CA" : settings.lang + "-CA", { day: "numeric", month: "short" }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  // Búsqueda del producto en el sitio de cada supermercado (abre su página; la app no lee esos precios)
  const STORE_SEARCH = [
    [/^maxi/i, (q) => `https://www.maxi.ca/fr/search?search-bar=${q}`],
    [/provigo/i, (q) => `https://www.provigo.ca/fr/search?search-bar=${q}`],
    [/super ?c/i, (q) => `https://www.superc.ca/fr/epicerie-en-ligne/recherche?filter=${q}`],
    [/^metro/i, (q) => `https://www.metro.ca/fr/epicerie-en-ligne/recherche?filter=${q}`],
    [/^iga/i, (q) => `https://www.iga.net/fr/search?k=${q}`],
    [/walmart/i, (q) => `https://www.walmart.ca/fr/search?q=${q}`],
    [/costco/i, (q) => `https://www.costco.ca/CatalogSearch?keyword=${q}`],
    [/voil/i, (q) => `https://voila.ca/products/search?q=${q}`],
  ];
  function storeSearch(store, query) {
    if (!store || !query) return null;
    const hit = STORE_SEARCH.find(([re]) => re.test(store));
    return hit ? hit[1](encodeURIComponent(query)) : null;
  }
  const monthFmt = (ym) => {
    try {
      return new Intl.DateTimeFormat(settings.lang === "en" ? "en-CA" : settings.lang + "-CA", { month: "short", year: "numeric" }).format(new Date(ym + "-15"));
    } catch {
      return ym || "";
    }
  };

  async function api(path, opts) {
    const r = await fetch(path, opts);
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      const e = new Error(d?.error?.message || T.error);
      e.code = d?.error?.code;
      throw e;
    }
    return d;
  }

  // ---------- navegación ----------
  function go(view, patch = {}, replace = false) {
    Object.assign(S, patch, { view });
    const snap = { view, step: S.step, q: S.q, qCountry: S.qCountry, url: S.url };
    try {
      replace ? history.replaceState(snap, "") : history.pushState(snap, "");
    } catch {}
    render();
    window.scrollTo({ top: 0 });
  }
  window.addEventListener("popstate", (e) => {
    const st = e.state || { view: "home" };
    Object.assign(S, { view: st.view, step: st.step || 0 });
    if (st.view === "results" && st.q && (S.q !== st.q || !S.results)) return search(st.q, st.qCountry, true);
    if (["recipe", "buy", "check", "cook", "done"].includes(st.view) && st.url && (!S.recipe || S.url !== st.url)) return openRecipe(st.url, true);
    render();
  });

  // ---------- datos ----------
  async function search(q, country, fromHistory) {
    q = (q || "").trim();
    if (q.length < 2) return;
    S.q = q;
    S.qCountry = country || null;
    S.results = null;
    S.err = null;
    fromHistory ? render() : go("results");
    try {
      const params = new URLSearchParams({ q, lang: settings.lang, v: "4" });
      if (dietParam()) params.set("diet", dietParam());
      if (country) params.set("country", country);
      const d = await api("/api/search?" + params);
      if (S.q !== q) return;
      S.results = d.results || [];
      S.resultsCountry = d.country || null;
    } catch (e) {
      S.err = e.message;
    }
    if (S.view === "results") render();
  }

  function initRecipeState(url) {
    const r = S.recipe;
    const savedSubs = ls.get(`subs:${dietParam()}:${url}`, null);
    S.subs = savedSubs || {};
    // por defecto: sustituto activado si el original no cumple tu régimen o es muy difícil de encontrar
    if (!savedSubs)
      r.ingredients.forEach((i, idx) => (S.subs[idx] = !!(i.substitute && ((i.conflicts || []).length || i.availability === "hard"))));
    S.have = ls.get("have:" + url, {});
    S.prices = null;
    S.pricesErr = null;
    S.mainStore = null;
  }

  async function openRecipe(url, fromHistory) {
    S.url = url;
    S.err = null;
    const key = `r4:${settings.lang}:${settings.country}:${dietParam()}:${url}`;
    const cached = ss.get(key);
    if (cached) {
      S.recipe = cached;
      initRecipeState(url);
      return fromHistory ? render() : go("recipe");
    }
    S.recipe = null;
    fromHistory ? render() : go("recipe");
    try {
      const qs = new URLSearchParams({ url, lang: settings.lang, country: settings.country, v: "4" });
      if (dietParam()) qs.set("diet", dietParam());
      const d = await api(`/api/recipe?${qs}`);
      if (S.url !== url) return;
      S.recipe = d;
      if (d.aiUsed) ss.set(key, d);
      initRecipeState(url);
    } catch (e) {
      S.err = e.message;
    }
    render();
  }

  const effective = (i, idx) =>
    S.subs[idx] && i.substitute
      ? { name: i.substitute.name, query: i.substitute.shopFr, fr: i.substitute.fr || i.substitute.shopFr, sub: true }
      : { name: i.name, query: i.shopFr, fr: i.fr || i.shopFr, sub: false };

  // Nombres para comprar en Quebec: si la app no está en francés, el nombre en francés va al lado.
  const plain = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const showFr = () => settings.country === "QC" && settings.lang !== "fr";
  const frOf = (name, fr) => (showFr() && fr && plain(fr) !== plain(name) ? fr : "");
  // Nombre en francés primero (el de la etiqueta del súper) y la traducción entre paréntesis
  const withFr = (name, fr) => {
    const f = frOf(name, fr);
    return f ? `${f} (${name})` : name;
  };
  // Nombre original del plato primero y la traducción entre paréntesis
  const cleanOrig = (t) => String(t || "").replace(/^(receta|recette|recipe)\s+(de\s+|du\s+|for\s+)?/i, "").replace(/^./, (c) => c.toUpperCase());
  const noParen = (t) => String(t || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const withOrig = (title, orig) => {
    const o = cleanOrig(orig);
    if (!o || plain(o) === plain(title)) return title;
    if (plain(noParen(o)) === plain(noParen(title))) return o; // mismo plato, sin repetir
    return `${o} (${title})`;
  };

  function buyItems() {
    return S.recipe.ingredients
      .map((i, idx) => ({ id: String(idx), ...effective(i, idx), ing: i }))
      .filter((x) => !x.ing.pantry);
  }

  async function loadPrices() {
    S.prices = "loading";
    S.pricesErr = null;
    render();
    try {
      const items = buyItems().map(({ id, name, query }) => ({ id, name, query }));
      S.prices = await api("/api/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postal: settings.postal, items }),
      });
      S.mainStore = null;
    } catch (e) {
      S.prices = null;
      S.pricesErr = e.message;
    }
    render();
  }

  // Plan de compra: el supermercado más barato para la canasta completa
  // (oferta si existe, si no precio habitual estimado), y lo que no está en oferta ahí
  // se busca en el siguiente supermercado más barato.
  function buildPlan(prices, items, chosen) {
    const offer = (id, s) => prices.offers[id]?.[s];
    const est = (id) => prices.estimates[id]?.price;
    const fallbackPrice = (id) => {
      const ps = Object.values(prices.offers[id] || {}).map((o) => o.price).sort((a, b) => a - b);
      return est(id) ?? (ps.length ? ps[Math.floor(ps.length / 2)] : 0);
    };
    const ranked = prices.stores
      .map((s) => ({
        s,
        cover: items.filter((it) => offer(it.id, s)).length,
        cost: items.reduce((a, it) => a + (offer(it.id, s)?.price ?? fallbackPrice(it.id)), 0),
      }))
      .filter((r) => r.cover > 0)
      .sort((a, b) => a.cost - b.cost || b.cover - a.cover);
    const main = chosen && ranked.some((r) => r.s === chosen) ? chosen : ranked[0]?.s || null;
    const stops = [];
    let rest = items;
    if (main) {
      stops.push({ store: main, main: true, rows: items.filter((it) => offer(it.id, main)).map((it) => ({ it, o: offer(it.id, main) })) });
      rest = items.filter((it) => !offer(it.id, main));
      for (const r of ranked) {
        if (r.s === main || !rest.length || stops.length >= 3) continue;
        const take = rest.filter((it) => offer(it.id, r.s));
        if (!take.length) continue;
        stops.push({ store: r.s, main: false, rows: take.map((it) => ({ it, o: offer(it.id, r.s) })) });
        rest = rest.filter((it) => !take.includes(it));
      }
    }
    const leftovers = rest.map((it) => ({ it, e: prices.estimates[it.id] || null }));
    const total =
      stops.reduce((a, st) => a + st.rows.reduce((b, r) => b + r.o.price, 0), 0) + leftovers.reduce((a, l) => a + (l.e?.price || 0), 0);
    return { ranked, main, stops, leftovers, total };
  }

  // ---------- vistas ----------
  const header = () => `
    <header class="bar">
      <div class="bar-in">
        ${S.view !== "home" ? `<button class="icon-btn" data-act="back" aria-label="${esc(T.back)}">${icon("back")}</button>` : ""}
        <button class="brand" data-act="home" aria-label="Sazón">
          <span class="brand-mark">${icon("pot")}</span><span class="brand-word">Sazón</span>
        </button>
        <button class="icon-btn" data-act="settings" aria-label="${esc(T.settings)}">${icon("gear")}</button>
      </div>
    </header>`;

  const searchForm = (val = "") => `
    <form class="search" data-form="search" role="search">
      <label class="sr" for="q">${esc(T.search)}</label>
      <input id="q" name="q" type="search" autocomplete="off" placeholder="${esc(T.searchPh)}" value="${esc(val)}" />
      <button class="btn primary" type="submit">${icon("search")}<span>${esc(T.search)}</span></button>
    </form>`;

  function vHome() {
    return `
      <section class="hero">
        ${settings.name ? `<p class="eyebrow">${esc(T.hello)}, ${esc(settings.name)}</p>` : ""}
        <h1>${esc(T.tagline)}</h1>
        ${searchForm()}
        ${profileLine()}
      </section>
      <section class="popular">
        <div class="tabs" role="tablist">
          ${COUNTRIES.map(
            (c) => `<button role="tab" aria-selected="${S.tab === c}" class="tab ${S.tab === c ? "on" : ""}" data-act="tab" data-c="${c}">
              <span class="tab-mark" aria-hidden="true">${FLAGS[c]}</span>${esc(T.countries[c])}</button>`,
          ).join("")}
        </div>
        <h2 class="eyebrow">${esc(T.popular)} · ${esc(T.countries[S.tab])}</h2>
        <ul class="dish-grid">
          ${POP[S.tab]
            .map(
              (d, i) => `<li><button class="dish" data-act="dish" data-q="${esc(d.q)}" data-c="${S.tab}">
                <span class="dish-n">${String(i + 1).padStart(2, "0")}</span><span class="dish-t">${esc(withOrig(d[settings.lang] || d.q, d.q))}</span>${icon("arrow")}</button></li>`,
            )
            .join("")}
        </ul>
        <p class="sources">${esc(T.sourcesOf)} ${esc(T.countries[S.tab])}: ${esc(SOURCES[S.tab])}</p>
      </section>`;
  }

  function vResults() {
    let body;
    if (S.err) body = errorBox(S.err, "retry-search");
    else if (!S.results) body = loader(T.searching, 6);
    else if (!S.results.length) body = `<p class="empty">${esc(T.noResults)}</p>`;
    else
      body = `<ul class="cards">${S.results
        .map(
          (r) => `<li><button class="card" data-act="open" data-url="${esc(r.url)}">
            <span class="card-img">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="card-ph">${icon("pot")}</span></span>
            <span class="card-body"><span class="card-t">${esc(withOrig(r.title, r.originalTitle))}</span>
            <span class="card-s"><span class="pill pill-${r.country}">${esc(T.countries[r.country])}</span>${esc(r.sourceName)}</span></span>
          </button></li>`,
        )
        .join("")}</ul>`;
    return `
      <section class="pad">${searchForm(S.q)}</section>
      <section class="pad">
        <h1 class="h-sec">${esc(T.resultsFor)} <em>${esc(S.q)}</em></h1>
        ${S.results && S.results.length && S.resultsCountry ? `<p class="muted small">${esc(T.sourcesOf)} ${esc(T.countries[S.resultsCountry])}: ${esc(SOURCES[S.resultsCountry])}</p>` : ""}
        ${body}
      </section>`;
  }

  function aiNote(r) {
    if (r.aiUsed) return "";
    const extra = r.aiError === "no_key" ? T.aiOffKey : r.aiError === "rate_limited" ? T.aiOffQuota : "";
    return `<p class="note warn">${icon("info")}<span>${esc(T.aiOff)} ${esc(extra)}</span></p>`;
  }

  function ingRow(i, idx, withCheck) {
    const e = effective(i, idx);
    const amount = [qtyFmt(i.qty), i.unit].filter(Boolean).join(" ");
    const country = T.countries[settings.country];
    const conflicts = i.conflicts || [];
    const dietTxt = conflicts.length ? `${T.notSuitable} ${conflicts.map((d) => T["diet_" + d]).join(" · ")}.` : "";
    const availTxt = i.availability !== "common" ? `${i.availability === "hard" ? T.hard : T.specialty} ${country}.` : "";
    let flag = "";
    if (i.substitute && (conflicts.length || i.availability !== "common")) {
      flag = `<div class="sub ${conflicts.length ? "diet" : i.availability}">
            <p class="sub-why"><strong>${esc([dietTxt, availTxt].filter(Boolean).join(" "))}</strong>
            ${esc(T.substitute)}: <b>${esc(withFr(i.substitute.name, i.substitute.fr))}</b> — ${esc(i.substitute.why)}</p>
            <button class="link" data-act="toggle-sub" data-i="${idx}">${esc(S.subs[idx] ? T.useOriginal : T.useSub)}</button>
          </div>`;
    } else if (conflicts.length) {
      flag = `<div class="sub diet"><p class="sub-why"><strong>${esc(dietTxt)}</strong> ${esc(T.noDietSub)}</p></div>`;
    }
    const label = `<span class="ing-main">
        ${amount ? `<span class="qty">${esc(amount)}</span>` : ""}
        ${
          frOf(e.name, e.fr)
            ? `<span class="ing-name ${e.sub ? "is-sub" : ""}" lang="fr">${esc(frOf(e.name, e.fr))}</span><span class="ing-tr">${esc(e.name)}</span>`
            : `<span class="ing-name ${e.sub ? "is-sub" : ""}">${esc(e.name)}</span>`
        }
        ${e.sub ? `<s class="orig">${esc(i.name)}</s>` : ""}
        ${i.note ? `<span class="ing-note">${esc(i.note)}</span>` : ""}
        ${i.pantry ? `<span class="tag">${esc(T.pantry)}</span>` : ""}
        ${withCheck && conflicts.length && !e.sub ? `<span class="tag tag-warn">${esc(T.notSuitable)} ${esc(conflicts.map((d) => T["diet_" + d]).join(" · "))}</span>` : ""}
      </span>`;
    if (!withCheck) return `<li class="ing">${label}${flag}</li>`;
    return `<li class="ing check ${S.have[idx] ? "done" : ""}">
      <label class="chk"><input type="checkbox" id="have-${idx}" data-act="have" data-i="${idx}" ${S.have[idx] ? "checked" : ""}/><span class="box" aria-hidden="true">${icon("tick")}</span>${label}</label>
    </li>`;
  }

  function recipeHead(r) {
    return `
      ${r.image ? `<div class="r-hero"><img src="${esc(r.image)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ""}
      <div class="pad r-head">
        ${(() => {
          const o = cleanOrig(r.originalTitle);
          const diff = o && plain(o) !== plain(r.title) && plain(noParen(o)) !== plain(noParen(r.title));
          return `<h1 class="r-title">${esc(diff ? o : r.title)}</h1>${diff ? `<p class="r-orig">(${esc(r.title)})</p>` : ""}`;
        })()}
        ${r.summary ? `<p class="r-sum">${esc(r.summary)}</p>` : ""}
        <dl class="facts">
          ${r.servings ? `<div><dt>${esc(T.servings)}</dt><dd>${esc(r.servings)}</dd></div>` : ""}
          ${r.time ? `<div><dt>${esc(T.time)}</dt><dd>${esc(r.time)}</dd></div>` : ""}
          <div><dt>${esc(T.from)}</dt><dd><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.source)} ${icon("ext")}</a></dd></div>
        </dl>
        ${aiNote(r)}
        ${dietBanner(r)}
      </div>`;
  }

  const dietNames = (list) => list.map((d) => T["diet_" + d]).join(" · ");

  function profileLine() {
    const list = DIETS.filter((d) => settings.diet.includes(d));
    return `<button class="profile-line" data-act="settings">${icon("leaf")}<span>${
      list.length ? `${esc(T.yourProfile)}: <b>${esc(dietNames(list))}</b>` : esc(T.addProfile)
    }</span></button>`;
  }

  function dietBanner(r) {
    const list = r.diet || [];
    if (!list.length) return "";
    if (!r.dietAdapted)
      return `<p class="note warn">${icon("leaf")}<span>${esc(T.dietFail)} (${esc(dietNames(list))})</span></p>`;
    const notes = (r.dietNotes || []).map((n) => `<li>${esc(n)}</li>`).join("");
    return `<div class="diet-banner">
        <p class="diet-h">${icon("leaf")}<span>${esc(r.dietOk ? T.alreadyOk : T.adaptedFor)}: <b>${esc(dietNames(list))}</b></span></p>
        ${notes ? `<ul class="diet-notes">${notes}</ul>` : ""}
      </div>`;
  }

  function vRecipe() {
    if (S.err) return `<section class="pad">${errorBox(S.err, "retry-recipe")}</section>`;
    const r = S.recipe;
    if (!r) return `<section class="pad">${loader(T.loadingRecipe, 8, true)}</section>`;
    return `
      ${recipeHead(r)}
      <section class="pad">
        <h2 class="h-sec">${esc(T.ingredients)} <span class="count">${r.ingredients.length}</span></h2>
        <ul class="ings">${r.ingredients.map((i, idx) => ingRow(i, idx, false)).join("")}</ul>
      </section>
      <section class="pad">
        <div class="buy-cta">
          <div><p class="eyebrow">${esc(T.buyOptional)}</p><h2 class="h-sm">${esc(T.buyTitle)}</h2><p class="muted">${esc(T.buyHint)}</p></div>
          <button class="btn ghost" data-act="buy">${icon("cart")}<span>${esc(T.buyTitle)}</span></button>
        </div>
      </section>
      <div class="dock"><div class="dock-in"><button class="btn primary wide" data-act="check">${esc(T.toChecklist)} ${icon("arrow")}</button></div></div>`;
  }

  function vBuy() {
    const r = S.recipe;
    if (!r) return vRecipe();
    let body = "";
    if (settings.country !== "QC") body = `<p class="note">${icon("info")}<span>${esc(T.pricesOnlyCA)}</span></p>`;
    else if (!/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(settings.postal)) body = postalForm();
    else if (S.prices === "loading") body = loader(T.loadingPrices, 5);
    else if (S.pricesErr) body = errorBox(S.pricesErr, "retry-prices");
    else if (S.prices) body = planView();
    else body = loader(T.loadingPrices, 5);
    return `
      <section class="pad">
        <p class="eyebrow">${esc(r.title)}</p>
        <h1 class="h-sec">${esc(T.buyTitle)}</h1>
        ${body}
      </section>
      <div class="dock"><div class="dock-in"><button class="btn primary wide" data-act="check">${esc(T.toChecklist)} ${icon("arrow")}</button></div></div>`;
  }

  function postalForm() {
    return `<form class="postal" data-form="postal">
      <label for="postal-in">${esc(T.postal)}</label>
      <div class="row"><input id="postal-in" name="postal" inputmode="text" autocomplete="postal-code" placeholder="G1R 4S9" maxlength="7" value="${esc(settings.postal)}"/>
      <button class="btn primary" type="submit">${icon("search")}<span>${esc(T.search)}</span></button></div>
      <p class="muted small">${esc(T.postalHint)}</p></form>`;
  }

  function planView() {
    const items = buyItems();
    if (!items.length) return `<p class="empty">${esc(T.nothingToBuy)}</p>`;
    const p = buildPlan(S.prices, items, S.mainStore);
    // estimado: { source: "statcan" | "ai" } o null; store: supermercado donde buscarlo
    const row = (it, price, sub, est, store) => {
      const link = storeSearch(store, it.query);
      const tag = est && price != null
        ? est.source === "statcan"
          ? `<span class="src src-stat">${esc(T.statAvg)} · ${esc(monthFmt(est.period))}</span>`
          : `<span class="src">${esc(T.aiEst)}</span>`
        : "";
      return `
      <li class="prow">
        <span class="prow-n">${esc(withFr(it.name, it.fr))}${sub ? `<span class="prow-s">${esc(sub)}</span>` : ""}${tag}
          ${link ? `<a class="see" href="${esc(link)}" target="_blank" rel="noopener">${esc(T.seeAt)} ${esc(store)} ${icon("ext")}</a>` : ""}</span>
        <span class="prow-p ${est ? "est" : ""}">${price != null ? (est ? esc(T.est) + " " : "") + money(price) : "—"}</span>
      </li>`;
    };
    const stopsHtml = p.stops
      .map(
        (st, k) => `
        <article class="stop ${st.main ? "main" : ""}">
          <header class="stop-h">
            <span class="stop-n">${k + 1}</span>
            <div><p class="eyebrow">${esc(st.main ? T.mainStore : T.secondStop)}</p><h3>${esc(st.store)}</h3></div>
            <span class="stop-t">${money(st.rows.reduce((a, r) => a + r.o.price, 0))}</span>
          </header>
          <ul class="plist">${st.rows
            .map((r) =>
              row(r.it, r.o.price, [r.o.name, r.o.unit, r.o.validTo ? `${T.validTo} ${dateFmt(r.o.validTo)}` : ""].filter(Boolean).join(" · "), null, st.store),
            )
            .join("")}</ul>
        </article>`,
      )
      .join("");
    const leftHtml = p.leftovers.length
      ? `<article class="stop left">
          <header class="stop-h"><span class="stop-n">${icon("info")}</span><div><h3>${esc(T.noOffer)}</h3><p class="muted small">${esc(T.noOfferHint)}</p></div></header>
          <ul class="plist">${p.leftovers.map((l) => row(l.it, l.e?.price ?? null, [l.e?.product, l.e?.size].filter(Boolean).join(" · "), l.e || { source: "ai" }, p.main)).join("")}</ul>
        </article>`
      : "";
    const others = p.ranked.length > 1
      ? `<details class="others"><summary>${esc(T.otherStores)}</summary>
          <ul class="store-list">${p.ranked
            .map(
              (r) => `<li><button class="store ${r.s === p.main ? "on" : ""}" data-act="main" data-s="${esc(r.s)}">
                <span>${esc(r.s)}</span><span class="muted small">${r.cover}/${items.length} ${esc(T.covers)}</span><b>${money(r.cost)}</b></button></li>`,
            )
            .join("")}</ul></details>`
      : "";
    return `
      <div class="total"><span>${esc(T.total)}</span><b>${money(p.total)}</b></div>
      <div class="stops">${stopsHtml}${leftHtml}</div>
      ${others}
      <p class="muted small fine">${esc(T.pricesNote)} ${S.prices.statcanUrl ? `<a href="${esc(S.prices.statcanUrl)}" target="_blank" rel="noopener">Statistique Canada, 18-10-0245-01</a>.` : ""} ${S.prices.aiUsed ? "" : esc(T.aiOff)}</p>`;
  }

  function missingList() {
    return S.recipe.ingredients
      .map((i, idx) => ({ i, idx }))
      .filter(({ idx }) => !S.have[idx])
      .map(({ i, idx }) => {
        const e = effective(i, idx);
        const amount = [qtyFmt(i.qty), i.unit].filter(Boolean).join(" ");
        return `${amount ? amount + " " : ""}${withFr(e.name, e.fr)}`;
      });
  }

  function vCheck() {
    const r = S.recipe;
    if (!r) return vRecipe();
    const n = r.ingredients.length;
    const got = r.ingredients.filter((_, idx) => S.have[idx]).length;
    const miss = missingList();
    const all = got === n;
    return `
      <section class="pad">
        <p class="eyebrow">${esc(r.title)}</p>
        <h1 class="h-sec">${esc(T.checkTitle)}</h1>
        <p class="muted">${esc(T.checkHint)}</p>
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${got}">
          <span style="width:${(got / n) * 100}%"></span></div>
        <p class="meter-t"><b>${got}</b> ${esc(T.of)} ${n} · ${esc(T.have)}</p>
        <ul class="ings">${r.ingredients.map((i, idx) => ingRow(i, idx, true)).join("")}</ul>
      </section>
      ${
        miss.length
          ? `<section class="pad"><div class="shoplist">
          <h2 class="h-sm">${esc(T.shopping)} <span class="count">${miss.length}</span></h2>
          <pre id="shop-text">${esc(miss.map((m) => "• " + m).join("\n"))}</pre>
          <button class="btn ghost" data-act="copy">${icon("copy")}<span>${esc(T.copy)}</span></button>
        </div></section>`
          : `<section class="pad"><p class="ok">${icon("tick")} ${esc(T.allSet)}</p></section>`
      }
      <div class="dock"><div class="dock-in">
        <button class="btn primary wide" data-act="cook" ${all ? "" : "disabled"}>${esc(T.start)} ${icon("arrow")}</button>
        ${all ? "" : `<button class="link center" data-act="cook">${esc(T.startAnyway)}</button>`}
      </div></div>`;
  }

  let timer = null;
  function vCook() {
    const r = S.recipe;
    if (!r) return vRecipe();
    const n = r.steps.length;
    const i = Math.min(Math.max(0, S.step), n - 1);
    const st = r.steps[i];
    const last = i === n - 1;
    return `
      <section class="cook">
        <div class="cook-top pad">
          <p class="eyebrow">${esc(r.title)}</p>
          <div class="dots" aria-hidden="true">${r.steps.map((_, k) => `<span class="${k < i ? "past" : k === i ? "now" : ""}"></span>`).join("")}</div>
        </div>
        <figure class="stage" data-action="${esc(st.action)}">${ART[st.action] || ART.mix}</figure>
        <div class="pad cook-body">
          <p class="step-n">${esc(T.step)} <b>${i + 1}</b> ${esc(T.of)} ${n}</p>
          <p class="step-t">${esc(st.text)}</p>
          ${
            st.minutes
              ? `<div class="timer" id="timer"><button class="btn ghost" data-act="timer" data-m="${st.minutes}">${icon("clock")}<span>${esc(T.timer)} · ${st.minutes} ${esc(T.min)}</span></button><output id="timer-out"></output></div>`
              : ""
          }
        </div>
      </section>
      <div class="dock"><div class="dock-in two">
        <button class="btn ghost" data-act="prev" ${i === 0 ? "disabled" : ""}>${icon("back")}<span>${esc(T.prev)}</span></button>
        <button class="btn primary" data-act="${last ? "finish" : "next"}">${esc(last ? T.finish : T.next)} ${icon("arrow")}</button>
      </div></div>`;
  }

  function vDone() {
    return `<section class="pad finish-view">
      <figure class="stage">${ART.serve}</figure>
      <h1 class="h-sec">${esc(T.doneTitle)}</h1>
      <p class="muted">${esc(T.doneMsg)}</p>
      <div class="stack"><button class="btn primary" data-act="home">${esc(T.another)}</button>
      <button class="btn ghost" data-act="to-recipe">${esc(T.backRecipe)}</button></div>
    </section>`;
  }

  const loader = (msg, n, hero) => `
    <div class="loading" role="status" aria-live="polite">
      <div class="spin-pot">${ART.boil}</div><p>${esc(msg)}</p>
      ${hero ? "" : `<ul class="skel">${Array.from({ length: n }, () => "<li></li>").join("")}</ul>`}
    </div>`;
  const errorBox = (msg, act) =>
    `<div class="err" role="alert"><p>${icon("info")} ${esc(msg)}</p><button class="btn ghost" data-act="${act}">${esc(T.retry)}</button></div>`;

  function settingsSheet() {
    return `<div class="sheet-bg" id="sheet" hidden>
      <form class="sheet" data-form="settings" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
        <h2 id="sheet-t" class="h-sm">${esc(T.settings)}</h2>
        <fieldset class="profile"><legend>${esc(T.profile)}</legend>
          <label class="field" for="set-name">${esc(T.yourName)}</label>
          <input id="set-name" name="name" maxlength="30" autocomplete="given-name" placeholder="${esc(T.namePh)}" value="${esc(settings.name)}"/>
          <p class="field">${esc(T.diets)}</p>
          <div class="seg">
            ${DIETS.map(
              (d) => `<label><input type="checkbox" name="diet" id="diet-${d}" value="${d}" ${settings.diet.includes(d) ? "checked" : ""}/><span>${esc(T["diet_" + d])}</span></label>`,
            ).join("")}
          </div>
          <p class="muted small">${esc(T.dietHint)}</p>
        </fieldset>
        <fieldset><legend>${esc(T.language)}</legend><div class="seg">
          ${[["es", "Español"], ["fr", "Français"], ["en", "English"]]
            .map(([k, l]) => `<label><input type="radio" name="lang" id="lang-${k}" value="${k}" ${settings.lang === k ? "checked" : ""}/><span>${l}</span></label>`)
            .join("")}</div></fieldset>
        <fieldset><legend>${esc(T.liveIn)}</legend><div class="seg">
          ${COUNTRIES.map((c) => `<label><input type="radio" name="country" id="country-${c}" value="${c}" ${settings.country === c ? "checked" : ""}/><span>${esc(T.countries[c])}</span></label>`).join("")}</div></fieldset>
        <label class="field" for="set-postal">${esc(T.postal)} <span class="muted small">(Canada)</span></label>
        <input id="set-postal" name="postal" placeholder="G1R 4S9" maxlength="7" value="${esc(settings.postal)}"/>
        <p class="muted small">${esc(T.postalHint)}</p>
        <div class="stack row"><button type="button" class="btn ghost" data-act="close-settings">${esc(T.close)}</button><button class="btn primary" type="submit">${esc(T.save)}</button></div>
      </form></div>`;
  }

  function render() {
    T = I18N[settings.lang] || I18N.es;
    document.documentElement.lang = settings.lang;
    const views = { home: vHome, results: vResults, recipe: vRecipe, buy: vBuy, check: vCheck, cook: vCook, done: vDone };
    app.className = "v-" + S.view;
    app.innerHTML = header() + `<main>${(views[S.view] || vHome)()}</main>` + settingsSheet();
    if (S.view === "buy" && S.recipe && settings.country === "QC" && settings.postal && !S.prices && !S.pricesErr) loadPrices();
    if (S.view === "cook") wake();
  }

  // ---------- extras ----------
  let lock = null;
  async function wake() {
    try {
      if (!lock && navigator.wakeLock) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => (lock = null));
      }
    } catch {}
  }

  function startTimer(min) {
    clearInterval(timer);
    let left = Math.round(min * 60);
    const out = () => document.getElementById("timer-out");
    let ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
    const tick = () => {
      const o = out();
      if (!o) return clearInterval(timer);
      if (left <= 0) {
        clearInterval(timer);
        o.textContent = T.timeUp;
        o.classList.add("ring");
        if (ctx) {
          [0, 0.35, 0.7].forEach((t) => {
            const g = ctx.createGain(), os = ctx.createOscillator();
            os.frequency.value = 880;
            os.connect(g).connect(ctx.destination);
            g.gain.setValueAtTime(0.2, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
            os.start(ctx.currentTime + t);
            os.stop(ctx.currentTime + t + 0.3);
          });
        }
        return;
      }
      o.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      left--;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------- eventos ----------
  document.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === "have") return; // lo maneja "change"
    switch (act) {
      case "home":
        clearInterval(timer);
        return go("home", { tab: S.tab });
      case "back":
        clearInterval(timer);
        return history.length > 1 ? history.back() : go("home");
      case "settings":
        document.getElementById("sheet").hidden = false;
        document.getElementById("lang-" + settings.lang)?.focus();
        return;
      case "close-settings":
        document.getElementById("sheet").hidden = true;
        return;
      case "tab":
        S.tab = el.dataset.c;
        return render();
      case "dish":
        return search(el.dataset.q, el.dataset.c);
      case "open":
        return openRecipe(el.dataset.url);
      case "retry-search":
        return search(S.q, S.qCountry, true);
      case "retry-recipe":
        return openRecipe(S.url, true);
      case "retry-prices":
        return loadPrices();
      case "toggle-sub": {
        const i = el.dataset.i;
        S.subs[i] = !S.subs[i];
        ls.set(`subs:${dietParam()}:${S.url}`, S.subs);
        if (S.prices && S.prices !== "loading") S.prices = null; // la canasta cambió
        return render();
      }
      case "buy":
        return go("buy");
      case "check":
        return go("check");
      case "main":
        S.mainStore = el.dataset.s;
        return render();
      case "copy": {
        const text = missingList().map((m) => "• " + m).join("\n");
        try {
          await navigator.clipboard.writeText(`${S.recipe.title}\n${text}`);
          toast(T.copied);
        } catch {
          const pre = document.getElementById("shop-text");
          const range = document.createRange();
          range.selectNodeContents(pre);
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          toast(T.copyFail);
        }
        return;
      }
      case "cook":
        return go("cook", { step: 0 });
      case "next":
        clearInterval(timer);
        return go("cook", { step: S.step + 1 });
      case "prev":
        clearInterval(timer);
        return go("cook", { step: Math.max(0, S.step - 1) });
      case "finish":
        clearInterval(timer);
        return go("done");
      case "to-recipe":
        return go("recipe");
      case "timer":
        return startTimer(Number(el.dataset.m));
    }
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset?.act === "have") {
      S.have[el.dataset.i] = el.checked;
      ls.set("have:" + S.url, S.have);
      const y = window.scrollY;
      render();
      window.scrollTo({ top: y });
      document.getElementById("have-" + el.dataset.i)?.focus();
    }
  });

  document.addEventListener("submit", (ev) => {
    const f = ev.target.closest("[data-form]");
    if (!f) return;
    ev.preventDefault();
    const fd = new FormData(f);
    if (f.dataset.form === "search") return search(String(fd.get("q") || ""), null);
    if (f.dataset.form === "postal") {
      settings.postal = String(fd.get("postal") || "").toUpperCase().trim();
      ls.set("settings", settings);
      S.prices = null;
      S.pricesErr = null;
      return render();
    }
    if (f.dataset.form === "settings") {
      const before = `${settings.lang}|${settings.country}|${dietParam()}`;
      settings.lang = String(fd.get("lang") || settings.lang);
      settings.country = String(fd.get("country") || settings.country);
      settings.postal = String(fd.get("postal") || "").toUpperCase().trim();
      settings.name = String(fd.get("name") || "").trim().slice(0, 30);
      settings.diet = fd.getAll("diet").map(String).filter((d) => DIETS.includes(d));
      ls.set("settings", settings);
      S.tab = settings.country;
      S.prices = null;
      S.pricesErr = null;
      const changed = before !== `${settings.lang}|${settings.country}|${dietParam()}`;
      if (changed && S.url && ["recipe", "buy", "check", "cook"].includes(S.view)) return openRecipe(S.url, true);
      if (changed && S.view === "results" && S.q) return search(S.q, S.qCountry, true);
      return render();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      const sh = document.getElementById("sheet");
      if (sh && !sh.hidden) sh.hidden = true;
    }
    if (S.view === "cook" && !ev.target.closest("input,textarea")) {
      if (ev.key === "ArrowRight") document.querySelector('[data-act="next"],[data-act="finish"]')?.click();
      if (ev.key === "ArrowLeft") document.querySelector('[data-act="prev"]')?.click();
    }
  });
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "sheet") ev.target.hidden = true;
  });

  // ---------- íconos ----------
  function icon(n) {
    const p = {
      back: '<path d="M15 5l-7 7 7 7"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
      pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h20M9 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4"/>',
      cart: '<path d="M3 4h2l2.5 11h11L21 7H7"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
      tick: '<path d="M5 12.5l4.5 4.5L19 7"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
      copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
      clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
      ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
      leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l7-7"/>',
    }[n];
    return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  }

  // ---------- portada: olla animada + plato del día ----------
  // El plato del día rota cada día entre los 4 países (mismo plato para todos ese día).
  function dailyDish() {
    const now = new Date();
    const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    const country = COUNTRIES[day % 4];
    const list = POP[country];
    return { country, dish: list[Math.floor(day / 4) % list.length] };
  }

  function splashStage() {
    const A = window.SAZON_SPLASH;
    const { w, h } = A.stage;
    const place = (key, cls, extra = "") => {
      const p = A.parts[key];
      const b = p.box;
      return `<div class="sp-part ${cls}" style="left:${(b.x / w) * 100}%;top:${(b.y / h) * 100}%;width:${(b.w / w) * 100}%;height:${(b.h / h) * 100}%;--r:${p.rot || 0}deg;${extra}">${p.svg}</div>`;
    };
    const drops = A.drops.map((k, i) => place(k, "sp-drop", `--d:${0.15 + i * 0.16}s`)).join("");
    const bubbles = [0, 1, 2]
      .map((i) => `<span class="sp-bubble" style="left:${40 + i * 10}%;--d:${1.05 + i * 0.18}s"></span>`)
      .join("");
    return `<div class="sp-stage" aria-hidden="true">
        ${place("steam", "sp-steam")}
        ${drops}
        ${bubbles}
        <div class="sp-pot">${place("potBody", "sp-body")}${place("rim", "sp-rim")}</div>
      </div>`;
  }

  function startSplash() {
    if (location.hash || S.view !== "home") return;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { country, dish } = dailyDish();
    const el = document.createElement("div");
    el.className = "splash" + (reduce ? " still" : "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Sazón");
    el.innerHTML = `
      <div class="sp-intro">
        ${splashStage()}
        <p class="sp-word">Sazón</p>
        <p class="sp-tag">${esc(T.tagline)}</p>
      </div>
      <button class="sp-skip" data-sp="skip">${esc(T.skip)}</button>`;
    document.body.appendChild(el);
    document.documentElement.classList.add("splash-open");

    let hit = null;
    let done = false;
    const close = (then) => {
      if (done) return;
      done = true;
      el.classList.add("out");
      document.documentElement.classList.remove("splash-open");
      setTimeout(() => el.remove(), 320);
      if (then) then();
    };

    // la receta del plato del día se busca mientras corre la animación (adaptada al perfil)
    const params = new URLSearchParams({ q: dish.q, country, lang: settings.lang, v: "4" });
    if (dietParam()) params.set("diet", dietParam());
    const found = api("/api/search?" + params)
      .then((d) => {
        hit = (d.results || []).find((r) => r.image) || (d.results || [])[0] || null;
        if (!hit?.image) return;
        // espera la foto (máx. 1,5 s) para que la portada aparezca completa
        return new Promise((ok) => {
          const img = new Image();
          img.onload = img.onerror = ok;
          img.src = hit.image;
          setTimeout(ok, 1500);
        });
      })
      .catch(() => {});

    const introMs = reduce ? 300 : 2600;
    const minIntro = new Promise((ok) => setTimeout(ok, introMs));
    const maxWait = new Promise((ok) => setTimeout(ok, introMs + 6000));
    Promise.all([minIntro, Promise.race([found, maxWait])]).then(() => {
      if (done) return;
      showDaily();
    });

    function showDaily() {
      const label = dish[settings.lang] || dish.q;
      const tr = plain(label) !== plain(dish.q) ? label : "";
      const list = DIETS.filter((d) => settings.diet.includes(d));
      const recipeName = hit ? withOrig(hit.title, hit.originalTitle) : "";
      const card = document.createElement("div");
      card.className = "sp-daily" + (hit?.image ? "" : " no-photo");
      card.innerHTML = `
        ${hit?.image ? `<div class="sd-photo"><img src="${esc(hit.image)}" alt="" referrerpolicy="no-referrer"></div>` : `<div class="sd-art">${ART.serve}</div>`}
        <div class="sd-shade"></div>
        <div class="sd-top"><span class="brand-mark">${icon("pot")}</span><span class="sd-brand">Sazón</span></div>
        <div class="sd-body">
          <p class="sd-eyebrow">${settings.name ? `${esc(T.hello)}, ${esc(settings.name)} · ` : ""}${esc(T.dishOfDay)}</p>
          <span class="sd-country">${FLAGS[country]} ${esc(T.countries[country])}</span>
          <h1 class="sd-title">${esc(dish.q)}</h1>
          ${tr ? `<p class="sd-tr">(${esc(tr)})</p>` : ""}
          ${hit ? `<p class="sd-src">${esc(recipeName)} · ${esc(hit.sourceName)}</p>` : ""}
          ${list.length ? `<p class="sd-diet">${icon("leaf")}<span>${esc(T.willAdapt)}: <b>${esc(dietNames(list))}</b></span></p>` : ""}
          <div class="sd-actions">
            <button class="sd-cook" data-sp="cook">${esc(T.cookToday)} ${icon("arrow")}</button>
            <button class="sd-all" data-sp="all">${esc(T.seeAll)}</button>
          </div>
        </div>`;
      el.querySelector(".sp-skip")?.remove();
      el.appendChild(card);
      requestAnimationFrame(() => el.classList.add("daily"));
      card.querySelector(".sd-cook").focus({ preventScroll: true });
    }

    el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-sp]");
      if (!b) {
        // tocar durante la animación la salta
        if (!el.classList.contains("daily")) el.classList.add("still");
        return;
      }
      const act = b.dataset.sp;
      if (act === "skip" || act === "all") return close();
      if (act === "cook") return close(() => (hit ? openRecipe(hit.url) : search(dish.q, country)));
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
    });
  }

  try {
    history.replaceState({ view: "home" }, "");
  } catch {}
  render();
  startSplash();
})();
