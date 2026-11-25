// The app's language. Spanish is the source: every text is written in Spanish in the code and the data, and
// t("…") looks it up in the chosen language's dictionary (web/idiomas/<code>.js: { "Spanish text": "translation" }).
// A text with no translation stays in Spanish. The language is chosen in Perfil, kept in localStorage
// (flexfit.ajustes.idioma, this device only) and applied on the next load (Perfil reloads the page).
// Records keep their Spanish names (gym exercises are matched by name), so only what's shown is translated.
/* eslint-disable security/detect-object-injection -- keys are this app's own texts and language codes */

export const IDIOMAS = [["es", "Español"], ["en", "English"], ["de", "Deutsch"], ["ca", "Català"]];
const LOCALES = { es: "es-ES", en: "en-GB", de: "de-DE", ca: "ca-ES" };
const CARGAR = { en: () => import("./idiomas/en.js"), de: () => import("./idiomas/de.js"), ca: () => import("./idiomas/ca.js") };

function leer() {
  try { return JSON.parse(localStorage.getItem("flexfit.ajustes") || "null")?.idioma; } catch (e) { return null; }
}
const pedido = leer();
export const idioma = LOCALES[pedido] ? pedido : "es";
/** For dates and numbers (toLocaleDateString, toLocaleString). */
export const locale = LOCALES[idioma];

let dic = {};
if (CARGAR[idioma]) {
  try { dic = (await CARGAR[idioma]()).default; } catch (e) { dic = {}; }
}
document.documentElement.lang = idioma;

/** Texts asked for with no translation in the chosen language (the tests check it stays empty). */
export const faltan = new Set();

/** The text in the chosen language, with {name} placeholders filled from vars. */
export function t(es, vars) {
  let s = es;
  if (idioma !== "es" && es) {
    if (Object.hasOwn(dic, es)) s = dic[es];
    else faltan.add(es);
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
/** Singular or plural by n: tn(n, "{n} serie", "{n} series"). */
export const tn = (n, uno, varios, vars = {}) => t(n === 1 ? uno : varios, { n, ...vars });

/** A dose as written in the plan ("2 × 30 s /lado", "5 cambios + 30 s /lado"): only its words change. */
export function dosis(d) {
  if (idioma === "es" || !d) return d;
  return d.replace(/\/lado|lentas|ciclos|cambios|balanceos|sin manos/g, (w) => t(w));
}

/** A number in the chosen language (decimal comma or point). */
export const num = (n) => Number(n).toLocaleString(locale, { maximumFractionDigits: 2 });

// Static texts in index.html: text nodes and labels whose whole text is a known Spanish text.
const ATRIBUTOS = ["aria-label", "placeholder", "title"];
export function traducirPagina(root = document.body) {
  if (idioma === "es") return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = n.nodeValue.trim();
    if (!/\p{L}{2}/u.test(s) || n.parentElement?.closest("script, style")) continue;
    const tr = t(s);
    if (tr !== s) n.nodeValue = n.nodeValue.replace(s, tr);
  }
  for (const el of root.querySelectorAll(ATRIBUTOS.map((a) => `[${a}]`).join(","))) {
    for (const a of ATRIBUTOS) {
      const v = el.getAttribute(a);
      if (v && /\p{L}{2}/u.test(v) && !/^https?:/.test(v)) el.setAttribute(a, t(v));
    }
  }
}
