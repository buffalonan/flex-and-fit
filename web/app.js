// Flex & Fit: workout list, workout detail with the mannequin, stretching player, gym set logger, progress,
// history, profile, sync with the Mac and JSON backups.
import * as store from "./store.js";
import { syncNow } from "./sync.js";
import { elegir, salud, buscarEnWifi, unir } from "./direccion.js";
import { html } from "./html.js";
import { EX, RUTINAS_FLEX, GYM, TESTS, FIG_FUERZA, CARDIO, CAMPOS_CARDIO, pasos, resumenFlex, resumenGym, enPlan } from "./datos.js";
import { maniqui, NOMBRES } from "./maniqui.js";
import { figura, animar, enPaso } from "./figura.js";
import { importar as importarReloj, importarPeso, unirPesos, partesDe, unirA, separar } from "./reloj.js";
import { ultimaRelease, codigoDe } from "./actualizar.js";
import { t, tn, dosis as tDosis, num, locale, idioma, IDIOMAS, traducirPagina } from "./i18n.js";
// The 3D figure (figura3d.js and Three.js, ~700 KB) loads the first time a sheet needs it; until then, and wherever
// WebGL isn't available, the SVG figure stays.
let modulo3d = null;
function en3d(host, id, opts = {}) {
  if (!id) return;
  host.dataset.fig3d = id;
  (modulo3d ||= import("./figura3d.js").catch(() => null)).then((m) => {
    if (m && host.isConnected && host.dataset.fig3d === id) m.montar(host, id, opts);
  });
}

const $ = (id) => document.getElementById(id);
// index.html is written in Spanish: its static texts change to the chosen language before anything is rendered.
traducirPagina();
document.querySelectorAll(".cal-dias span").forEach((sp, i) => (sp.textContent = new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" })));
/* eslint-disable security/detect-object-injection -- lookups below use ids and keys from this app's own data */

const native = !!window.Capacitor?.isNativePlatform?.();
// Where the Mac's server is. The web page served by the Mac uses its own origin. The Android app has no default:
// the address is typed once in Perfil and kept only on the phone, so no host name or IP is ever in this public repo.
// The GitHub Pages demo has no server at all.
const demo = location.hostname === "buffalonan.github.io";
// It may live under a sub-path behind a proxy (http://<mac>/fitness/), so the base is the page's folder, not the origin.
const defaultServer = () => (native || demo || location.protocol === "file:" ? "" : new URL(".", location.href).href.replace(/\/+$/, ""));

const KEY = "flexfit.ajustes";
let ajustes = { servidor: null, servidores: [], token: "", tab: "entrenos", filtro: "todos", idioma: "es" };
try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(KEY) || "null") }; } catch (e) { /* no storage */ }
const saveAjustes = () => { try { localStorage.setItem(KEY, JSON.stringify(ajustes)); } catch (e) { /* no storage */ } };
const servidor = () => (ajustes.servidor ?? defaultServer()).trim();

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
const fechaLarga = (s) => parse(s).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// A gym exercise's sets and reps (or time), per side when it's done one arm at a time.
const dosisGym = (e) => `${tn(e.series, "{n} serie", "{n} series")} · ${e.seg ? mmss(e.seg) : t("{n} reps", { n: e.reps })}${e.porLado ? ` ${t("/lado")}` : ""}`;
const fmtMin = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);
const haceDias = (f) => { const n = Math.round((parse(iso(new Date())) - parse(f)) / 864e5); return n <= 0 ? t("Hoy") : n === 1 ? t("Ayer") : t("Hace {n} días", { n }); };
// A muscle's name, and a side ("izq"/"der") after an exercise's name.
const M = (m) => t(NOMBRES[m]);
const lado = (e) => (e.lado ? ` (${t(e.lado === "izq" ? "izquierda" : "derecha")})` : "");
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch (e) { /* not supported */ } };

const rutinaFlex = (id) => RUTINAS_FLEX.find((r) => r.id === id);
const gym = (id) => GYM.find((w) => w.id === id);
const titulo = (id) => { const r = rutinaFlex(id), w = gym(id); return r ? (r.n ? t("Fase {n} · {nombre}", { n: r.n, nombre: t(r.name) }) : t(r.name)) : w ? t(w.n) : id; };

/* ---------- Data the screens share ---------- */
let sesiones = [];
let inicioPlan = null;
let pesos = []; // body weight per day, oldest first: [{ fecha, kg, origen }]
async function cargar() {
  sesiones = (await store.all("sesiones")).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b._actualizado - a._actualizado);
  const ajs = await store.all("ajustes");
  inicioPlan = ajs.find((r) => r.id === "plan-flexibilidad")?.inicio || null;
  pesos = Array.isArray(ajs.find((r) => r.id === "peso")?.pesos) ? ajs.find((r) => r.id === "peso").pesos : [];
}
const ultima = (rutina) => sesiones.find((s) => s.rutina === rutina);
// The sets of the last time an exercise was done: the newest gym session of this workout where at least one of its
// sets was ticked (a session logged by hand, or one where it was skipped, doesn't count), matched by name and, for
// same-named ones (a side plank per side), by their order. Failing that, the newest time in another workout, whose
// weights carry over but not its reps (another workout may do it 5×5 instead of 3×8). → { series, otra } or null.
function ultimasSeries(w, i) {
  const e = w.ej[i];
  const n = w.ej.slice(0, i).filter((x) => x.n === e.n).length;
  const de = (x) => (x.ejercicios || []).filter((y) => y?.n === e.n)[n];
  const hecho = (x) => x.tipo === "gimnasio" && de(x)?.series?.some((y) => y?.hecho);
  const misma = sesiones.find((x) => x.rutina === w.id && hecho(x));
  if (misma) return { series: de(misma).series, otra: false };
  const otra = sesiones.find((x) => x.rutina !== w.id && hecho(x));
  return otra ? { series: de(otra).series, otra: true } : null;
}

/* ---------- Body weight ---------- */
// The weight on a day: the latest one on or before it, else the first after it (weighed only later). null if none.
function pesoEn(fecha) {
  if (!pesos.length) return null;
  let p = null;
  for (const x of pesos) { if (!fecha || x.fecha <= fecha) p = x; else break; }
  return (p || pesos[0]).kg;
}
// Exercises done with your own body (no weight in the workout, not a machine "to choose"): their load is your weight
// plus what's added (negative: the machine's help). An approximation, the same for every such exercise.
const corporal = (def) => !!def && def.kg == null && !def.elige && !def.seg;
// The load of a set for the volume: its kg, or your weight plus its kg for a bodyweight exercise when the weight is known.
function carga(kg, def, peso) {
  const k = Number(kg) || 0;
  if (corporal(def) && peso) return Math.max(0, peso + k);
  return k > 0 ? k : 0;
}
const vecesPeso = (kg, fecha) => { const p = pesoEn(fecha); return p ? num(Math.round((kg / p) * 100) / 100) : null; };

/* ---------- Records and progression (own rules: Epley's public formula, double progression) ---------- */
// Estimated one-rep max (Epley) from a set with weight and 1–12 reps; with more reps it says little, so 0.
const e1rm = (kg, reps) => (kg > 0 && reps >= 1 && reps <= 12 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : 0);
// An exercise's best in some sessions: heaviest kg, best estimated 1RM (rounded to the kg) and its set, and, with no
// weight, most reps or seconds. Negative kg (assisted) count for neither. → null if no set of it was ticked there.
function mejorDe(lista, n, seg) {
  let hay = false, kg = 0, rm = 0, reps = 0, set = null, fecha = null;
  for (const x of lista) for (const e of x.ejercicios || []) {
    if (e?.n !== n) continue;
    for (const y of e.series || []) {
      if (!y?.hecho) continue;
      hay = true;
      const k = Number(y.kg) || 0, r = Number(seg ? y.seg : y.reps) || 0;
      if (k > 0) {
        kg = Math.max(kg, k);
        const m = seg ? 0 : Math.round(e1rm(k, r));
        if (m > rm) { rm = m; set = { kg: k, reps: r }; fecha = x.fecha; }
      } else if (k === 0 && r > reps) { reps = r; if (!rm) fecha = x.fecha; }
    }
  }
  return hay ? { kg, rm, reps, set, fecha } : null;
}
const gimnasio = (x) => x.tipo === "gimnasio";
// What session `s` beat, per exercise, against every gym session before it (none the first time an exercise is done).
function records(s) {
  const antes = sesiones.filter((x) => gimnasio(x) && x.id !== s.id && cuando(x) < cuando(s));
  const out = [];
  for (const n of new Set((s.ejercicios || []).map((e) => e?.n).filter(Boolean))) {
    const seg = !!defGym(s.rutina, n)?.seg;
    const a = mejorDe([s], n, seg), b = mejorDe(antes, n, seg);
    if (!a || !b) continue;
    if (a.rm && b.rm && a.rm > b.rm) out.push({ n, t: "1RM estimado", v: kgTxt(a.rm), antes: kgTxt(b.rm) });
    else if (a.kg && b.kg && a.kg > b.kg) out.push({ n, t: "Peso máximo", v: kgTxt(a.kg), antes: kgTxt(b.kg) });
    else if (!a.kg && !b.kg && a.reps && b.reps && a.reps > b.reps) {
      out.push({ n, t: seg ? "Mejor tiempo" : "Más repeticiones", v: seg ? mmss(a.reps) : `${a.reps}`, antes: seg ? mmss(b.reps) : `${b.reps}` });
    }
  }
  return out;
}
// Double progression: when last time in this workout every set was ticked at the target reps (or time) or more, this
// time goes up a step: +2.5 kg (assisted: 2.5 kg less help), or with no weight one rep more (5 s for a timed hold).
// → { kg: delta } | { n: delta } with its text, or null.
function subida(e, u) {
  if (!u || u.otra) return null;
  const hechas = (u.series || []).slice(0, e.series);
  const meta = e.seg || e.reps;
  if (hechas.length < e.series || !meta || !hechas.every((y) => y?.hecho && Number(e.seg ? y.seg : y.reps) >= meta)) return null;
  const kgs = hechas.map((y) => Number(y.kg) || 0);
  const vars = { ej: t(e.n), dosis: `${e.series} × ${e.seg ? mmss(meta) : meta}` };
  if (kgs.some((k) => k !== 0)) return { kg: 2.5, texto: t("{ej}: +{kg} kg, la última vez completaste {dosis}.", { ...vars, kg: num(2.5) }) };
  return e.seg ? { n: 5, texto: t("{ej}: +5 s, la última vez completaste {dosis}.", vars) } : { n: 1, texto: t("{ej}: +1 rep, la última vez completaste {dosis}.", vars) };
}

/* ---------- Screens ---------- */
const TABS = ["entrenos", "progreso", "historial", "perfil"];
let pantalla = "entrenos";
function show(tab) {
  if (!TABS.includes(tab)) tab = "entrenos";
  for (const t of [...TABS, "detalle", "sesion"]) $(t).hidden = t !== tab;
  document.querySelectorAll(".tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  pantalla = tab;
  ajustes.tab = tab;
  saveAjustes();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

const capApp = native ? window.Capacitor.registerPlugin("App") : null;
capApp?.addListener("backButton", () => {
  if (!$("cardioPanel").hidden) cerrarCardio();
  else if (!$("actPanel").hidden) $("actPanel").hidden = true;
  else if (!$("continuarPanel").hidden) $("continuarPanel").hidden = true;
  else if (!$("salirPanel").hidden) cerrarSalir();
  else if (!$("ficha").hidden) cerrarFicha();
  else if (edicion) cerrarEdicion();
  else if (sesion) pedirSalir();
  else if (!$("resumen").hidden) cerrarResumen();
  else if (pantalla === "sesion") show("historial");
  else if (pantalla === "entrenos") capApp.exitApp();
  else show("entrenos");
});
capApp?.addListener("resume", () => sync());

/* ---------- Entrenos ---------- */
function miniFlex(r) { return maniqui(resumenFlex(r).musc, "x", { titulo: t("Músculos de {x}", { x: titulo(r.id) }) }); }
function miniGym(w) { const g = resumenGym(w); return maniqui(g, "f", { titulo: t("Músculos de {x}", { x: titulo(w.id) }) }); }

function tarjeta(id, { hoy = false } = {}) {
  const r = rutinaFlex(id), w = gym(id);
  const u = ultima(id);
  const chips = [];
  if (hoy) chips.push(html`<span class="chip x">${t("HOY · FLEX")}</span>`);
  if (hoy && u?.fecha === iso(new Date())) chips.push(html`<span class="chip ok">${t("Hecha ✓")}</span>`);
  if (!hoy && u) chips.push(html`<span class="chip">${haceDias(u.fecha)}</span>`);
  if (r && !hoy && r.weeks) chips.push(html`<span class="chip">${t("Semanas {a}–{b}", { a: r.weeks[0], b: r.weeks[1] })}</span>`);
  const sub = r ? `${tn(r.items.length, "{n} ejercicio", "{n} ejercicios")} · ${r.min}` : `${tn(w.ej.length, "{n} ejercicio", "{n} ejercicios")} · ${tn(resumenGym(w).series, "{n} serie", "{n} series")}`;
  return html`<button type="button" class="wcard${hoy ? " hoy" : ""}" data-abrir="${id}">
    <span class="mini">${r ? miniFlex(r) : miniGym(w)}</span>
    <span class="meta">${chips.length && hoy ? html`<span class="chips">${chips}</span>` : ""}<span class="name">${titulo(id)}</span><span class="sub">${sub}</span>
      ${!hoy && chips.length ? html`<span class="chips">${chips}</span>` : ""}</span>
  </button>`;
}

function renderEntrenos() {
  const hoy = iso(new Date());
  const ep = enPlan(inicioPlan, hoy);
  $("hoyFecha").textContent = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  $("planPos").textContent = t("Semana {s} · F{f}", { s: Math.min(ep.semana, 26), f: ep.fase.n });
  $("hoyCard").innerHTML = html`${tarjeta(ep.rutina, { hoy: true })}${ep.test ? html`<p class="sub">${t("Hoy toca el test mensual: apúntalo en Progreso.")}</p>` : ""}`;
  $("listaFuerza").innerHTML = html`${GYM.filter((w) => !w.fuente).map((w) => tarjeta(w.id))}`;
  $("listaPlantillas").innerHTML = html`${GYM.filter((w) => w.fuente).map((w) => tarjeta(w.id))}`;
  $("listaFlex").innerHTML = html`${RUTINAS_FLEX.map((r) => tarjeta(r.id))}`;
  const f = ajustes.filtro;
  $("grupoFuerza").hidden = f === "flex";
  $("grupoPlantillas").hidden = f === "flex";
  $("grupoFlex").hidden = f === "fuerza";
  $("hoyCard").hidden = f === "fuerza";
}
document.querySelectorAll('input[name="filtro"]').forEach((r) => {
  r.checked = r.value === ajustes.filtro;
  r.addEventListener("change", () => { ajustes.filtro = r.value; saveAjustes(); renderEntrenos(); });
});
$("entrenos").addEventListener("click", (e) => { const id = e.target.closest("[data-abrir]")?.dataset.abrir; if (id) abrir(id); });

/* ---------- Detail ---------- */
let abierto = null;
function etiquetasTop(valores, n, texto) {
  return Object.entries(valores).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m, v]) => ({ m, t: texto(v) }));
}
const stat = (v, l, u = "") => html`<div class="stat"><b>${v}${u ? html`<small>${u}</small>` : ""}</b><span>${l}</span></div>`;
// The watch's numbers in the summary: filled in when its workout arrives from Health Connect (see rellenarResumen).
const statsReloj = () => html`<div class="stat"><b id="resFc">—</b><span>${t("FC media · reloj")}</span></div><div class="stat"><b id="resKcal">—</b><span>${t("Calorías · reloj")}</span></div>`;

function abrir(id) {
  abierto = id;
  const r = rutinaFlex(id), w = gym(id);
  $("detalle").classList.toggle("flex", !!r);
  $("detTitle").textContent = titulo(id);
  const u = ultima(id);
  const vez = u ? ` · ${t("última vez {cuando}", { cuando: haceDias(u.fecha).toLowerCase() })}` : "";
  if (r) {
    const { seg, musc } = resumenFlex(r);
    $("detSub").textContent = t("{n} ejercicios · {min} · intensidad {int}", { n: r.items.length, min: r.min, int: r.int }) + vez;
    $("detNotas").innerHTML = html`<li>${t(r.goal)}</li>`;
    $("detMan").innerHTML = html`${maniqui(musc, "x", { etiquetas: etiquetasTop(musc, 6, fmtMin) })}
      <div class="leyenda"><span><i style="background:var(--flex1)"></i>&lt; 1 min</span><span><i style="background:var(--flex2)"></i>1–3 min</span><span><i style="background:var(--flex3)"></i>3+ min</span></div>`;
    $("detStats").innerHTML = html`${stat(r.items.length, t("Ejercicios"))}${stat(Math.round(seg / 60), t("Estirando"), "min")}${stat(r.int.replace(" / 10", ""), t("Intensidad"), "/10")}`;
    $("detLista").innerHTML = html`${r.items.map(([ex, dosis, extra], i) => html`<li class="ej" data-i="${i}">
      <span class="th">${figura(ex)}</span>
      <div class="meta"><span class="name">${t(EX[ex].n)}</span><span class="dosis">${tDosis(dosis)}</span>
        <span class="zona">${t("Lo notas en:")} ${t(EX[ex].z)}</span>
        ${extra ? html`<span class="extra">${t(extra)}</span>` : ""}</div>
      <button type="button" class="ver" aria-label="${t("Ver {x}", { x: t(EX[ex].n) })}">›</button></li>`)}`;
    $("detMaquinas").textContent = t("Tensión, nunca dolor. Entra despacio, sin rebotes, y respira lento.");
    $("detAvance").innerHTML = html`${r.adv ? html`<b>${t("Pasa a la siguiente fase cuando:")}</b><ul>${r.adv.map((a) => html`<li>${t(a)}</li>`)}</ul>` : ""}`;
  } else {
    const g = resumenGym(w);
    $("detSub").textContent = `${t(w.sub)} · ${tn(g.series, "{n} serie", "{n} series")}${vez}`;
    $("detNotas").innerHTML = html`${w.notas.map((n) => html`<li>${t(n)}</li>`)}`;
    $("detMan").innerHTML = html`${maniqui(g, "f", { etiquetas: etiquetasTop(g.p, 6, (v) => tn(v, "{n} serie", "{n} series")) })}
      <div class="leyenda"><span><i style="background:var(--prim)"></i>${t("Músculos principales")}</span><span><i style="background:var(--sec)"></i>${t("Secundarios")}</span></div>`;
    const vol = w.ej.reduce((a, e) => a + (e.kg && e.reps ? e.kg * e.reps * e.series * (e.porLado ? 2 : 1) : 0), 0);
    $("detStats").innerHTML = html`${stat(g.series, t("Series"))}${stat(w.ej.length, t("Ejercicios"))}${stat(num(vol), t("Volumen"), "kg")}`;
    const fila = (e, i) => html`<li class="ej g" data-i="${i}">${FIG_FUERZA[e.n] ? html`<span class="th">${figura(FIG_FUERZA[e.n])}</span>` : ""}<div class="meta"><span class="name">${t(e.n)}${lado(e)}</span>
      <span class="dosis">${dosisGym(e)}${e.kg ? ` · ${num(e.kg)} kg` : ""} · ${t("Descanso")} ${mmss(e.desc)}</span>
      <span class="chips">${e.p.map((m) => html`<span class="chip f">${M(m)}</span>`)}${e.s.map((m) => html`<span class="chip">${M(m)}</span>`)}</span></div>
      <button type="button" class="ver" aria-label="${t("Ver {x}", { x: t(e.n) })}">›</button></li>`;
    const out = [];
    for (const [i, e] of w.ej.entries()) {
      if (!e.bloque) { out.push(fila(e, i)); continue; }
      if (w.ej[i - 1]?.bloque === e.bloque) continue;
      const items = w.ej.map((x, j) => [x, j]).filter(([x]) => x.bloque === e.bloque);
      out.push(html`<li class="bloque"><b>${t("Repite {n} veces", { n: w.bloques[e.bloque].rondas })}</b><ol class="ejercicios">${items.map(([x, j]) => fila(x, j))}</ol></li>`);
    }
    $("detLista").innerHTML = html`${out}`;
    $("detMaquinas").innerHTML = html`${t("Material:")} ${t(w.maquinas)}.${w.fuente ? html`<br>${t("Fuente:")} <a href="${w.fuente.url}" target="_blank" rel="noopener">${w.fuente.n}</a>` : ""}`;
    $("detAvance").innerHTML = "";
  }
  for (const t of TABS) $(t).hidden = true;
  $("detalle").hidden = false;
  pantalla = "detalle";
  window.scrollTo(0, 0);
  animar($("detalle"));
}
$("detVolver").addEventListener("click", () => show("entrenos"));

/* ---------- Exercise sheet: one exercise of the open workout, before starting (tap a row in the detail) ---------- */
let ficha = null; // index of the exercise shown
function verFicha(i) {
  const r = rutinaFlex(abierto), w = gym(abierto);
  const total = r ? r.items.length : w.ej.length;
  if (i < 0 || i >= total) return;
  ficha = i;
  $("ficha").classList.toggle("gym", !r);
  $("fichaCuenta").textContent = t("Ejercicio {i} de {n}", { i: i + 1, n: total });
  $("fichaAnt").disabled = i === 0;
  $("fichaSig").disabled = i === total - 1;
  if (r) {
    const [ex, dosis, extra] = r.items[i];
    const e = EX[ex];
    $("fichaTitulo").textContent = t(e.n);
    $("fichaFig").innerHTML = html`<div class="fig3d">${figura(ex, { clase: "grande" })}</div>`;
    en3d($("fichaFig").querySelector(".fig3d"), ex, { musculos: e });
    $("fichaDosis").textContent = tDosis(dosis);
    $("fichaCuerpo").innerHTML = html`<p class="zona">${t("Lo notas en:")} <b>${t(e.z)}</b></p>
      ${extra ? html`<p class="extra">${t(extra)}</p>` : ""}
      <h3>${t("Cómo hacerlo")}</h3><ol class="pasos">${e.c.map((c) => html`<li>${t(c)}</li>`)}</ol>
      <p class="sub">${t("Tensión, nunca dolor. Entra despacio, sin rebotes, y respira lento.")}</p>`;
  } else {
    const e = w.ej[i];
    const p = Object.fromEntries(e.p.map((m) => [m, e.series])), sec = Object.fromEntries(e.s.map((m) => [m, e.series]));
    $("fichaTitulo").textContent = `${t(e.n)}${lado(e)}`;
    $("fichaFig").innerHTML = html`${FIG_FUERZA[e.n] ? html`<div class="fig3d">${figura(FIG_FUERZA[e.n], { clase: "grande" })}</div>` : ""}${maniqui({ p, s: sec }, "f", { titulo: t("Músculos de {x}", { x: t(e.n) }) })}
      <div class="leyenda"><span><i style="background:var(--prim)"></i>${t("Principales")}</span><span><i style="background:var(--sec)"></i>${t("Secundarios")}</span></div>`;
    if (FIG_FUERZA[e.n]) en3d($("fichaFig").querySelector(".fig3d"), FIG_FUERZA[e.n], { musculos: e });
    $("fichaDosis").textContent = `${dosisGym(e)} · ${e.kg ? `${num(e.kg)} kg` : t(e.elige ? "peso a elegir" : "peso corporal")}`;
    const ult = ultimasSeries(w, i)?.series.filter((x) => x?.hecho) || [];
    const rec = mejorDe(sesiones.filter(gimnasio), e.n, !!e.seg);
    $("fichaCuerpo").innerHTML = html`<p class="zona">${t("Descanso entre series:")} <b>${mmss(e.desc)}</b>${e.bloque ? html` · ${t("en circuito, {n} rondas", { n: w.bloques[e.bloque].rondas })}` : ""}</p>
      <h3>${t("Músculos")}</h3><p class="chips">${e.p.map((m) => html`<span class="chip f">${M(m)}</span>`)}${e.s.map((m) => html`<span class="chip">${M(m)}</span>`)}</p>
      ${e.c ? html`<h3>${t("Cómo hacerlo")}</h3><ol class="pasos">${e.c.map((c) => html`<li>${t(c)}</li>`)}</ol>` : ""}
      ${rec ? html`<h3>${t("Tu récord")}</h3><p class="sub">${rec.rm ? t("{set} · 1RM estimado {kg}", { set: `${kgTxt(rec.set.kg)} × ${rec.set.reps}`, kg: kgTxt(rec.rm) }) + (vecesPeso(rec.rm, rec.fecha) ? ` · ${t("{x}× tu peso", { x: vecesPeso(rec.rm, rec.fecha) })}` : "") : rec.kg ? t("Peso máximo {kg}", { kg: kgTxt(rec.kg) }) : e.seg ? mmss(rec.reps) : t("{n} reps", { n: rec.reps })}${rec.fecha ? ` · ${fechaCorta(rec.fecha)}` : ""}</p>` : ""}
      ${ult.length ? html`<h3>${t("La última vez")}</h3><p class="sub">${ult.map((x) => `${x.kg ? `${num(x.kg)} kg × ` : ""}${x.seg ? mmss(x.seg) : x.reps}`).join(" · ")}</p>` : ""}`;
  }
  $("ficha").hidden = false;
  $("ficha").scrollTo?.(0, 0);
  animar($("ficha"));
}
function cerrarFicha() { $("ficha").hidden = true; $("fichaFig").innerHTML = ""; ficha = null; }
$("detLista").addEventListener("click", (e) => {
  const li = e.target.closest?.("li.ej[data-i]");
  if (li) verFicha(Number(li.dataset.i));
});
$("fichaSalir").addEventListener("click", cerrarFicha);
$("fichaAnt").addEventListener("click", () => verFicha(ficha - 1));
$("fichaSig").addEventListener("click", () => verFicha(ficha + 1));
$("fichaEmpezar").addEventListener("click", () => { cerrarFicha(); $("detEmpezar").click(); });
$("detEmpezar").addEventListener("click", () => (rutinaFlex(abierto) ? empezarFlex(abierto) : empezarGym(abierto)));

/* ---------- Sessions (shared by the player and the logger) ---------- */
let sesion = null; // the one in progress
let wake = null;
async function pantallaEncendida(on) {
  try {
    if (on) wake = await navigator.wakeLock?.request("screen");
    else { await wake?.release(); wake = null; }
  } catch (e) { /* not allowed or not supported */ }
}
let audio = null;
function pitido(f = 880) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(0.15, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.25);
  } catch (e) { /* no audio */ }
}
function entrar(id, inicio = Date.now()) {
  document.body.classList.add("en-sesion");
  sesion.inicio = inicio;
  sesion.rutina = id;
  abierto = id;
  pantallaEncendida(true);
  fcEnVivo();
  sesion.timerFc = setInterval(fcEnVivo, 30000);
  entreno?.empezar({ titulo: titulo(id), inicio, cabecera: t("Entreno en curso") }).catch(() => {});
  guardarEnCurso();
}

/* ---------- The session in progress, kept on the phone ---------- */
// Android may close the app while the phone is locked (Samsung is quick to do it), and the session lived only in
// memory. So every change is written to localStorage (synchronous, so nothing is lost if the app dies right after),
// and on the next start the app offers to continue it, save what was done, or discard it. It's this device's only:
// it never syncs, and it's removed when the session is saved or discarded.
const EN_CURSO = "flexfit.enCurso";
function guardarEnCurso() {
  const s = sesion;
  if (!s?.rutina) return;
  const d = s.tipo === "gym"
    ? { tipo: "gym", rutina: s.rutina, inicio: s.inicio, valores: s.valores, pag: s.pag, desc: s.desc, cardio: s.cardio }
    : { tipo: "flex", rutina: s.rutina, inicio: s.inicio, idx: s.idx, hechos: [...s.hechos], seg: s.seg };
  try { localStorage.setItem(EN_CURSO, JSON.stringify({ ...d, guardado: Date.now() })); } catch (e) { /* no storage */ }
}
function borrarEnCurso() { try { localStorage.removeItem(EN_CURSO); } catch (e) { /* no storage */ } }
// The saved session, if it still fits the app's workouts (an update may have changed them); else it's dropped.
function leerEnCurso() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(EN_CURSO) || "null"); } catch (e) { /* none or broken */ }
  if (!d || typeof d !== "object" || !Number.isFinite(d.inicio)) return null;
  const ok = d.tipo === "gym" ? !!gym(d.rutina) && d.valores && typeof d.valores === "object"
    : d.tipo === "flex" && !!rutinaFlex(d.rutina) && Array.isArray(d.hechos);
  if (!ok) borrarEnCurso();
  return ok ? d : null;
}
let pendienteEnCurso = null;
function ofrecerContinuar() {
  const d = leerEnCurso();
  if (!d || sesion) return;
  pendienteEnCurso = d;
  const ini = new Date(d.inicio);
  const cuando = iso(ini) === iso(new Date()) ? t("hoy") : ini.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  let hecho;
  if (d.tipo === "gym") { const n = Object.values(d.valores).filter((v) => v?.hecho).length; hecho = tn(n, "{n} serie hecha", "{n} series hechas"); }
  else { const n = new Set(d.hechos).size; hecho = t("{n} de {total} posturas", { n, total: rutinaFlex(d.rutina).items.length }); }
  $("contTexto").textContent = t("{titulo}, empezado {cuando} a las {hora} · {hecho}.", { titulo: titulo(d.rutina), cuando, hora: ini.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }), hecho });
  $("continuarPanel").hidden = false;
}
function retomar() {
  const d = pendienteEnCurso;
  pendienteEnCurso = null;
  $("continuarPanel").hidden = true;
  if (!d || sesion) return false;
  if (d.tipo === "gym") empezarGym(d.rutina, d); else empezarFlex(d.rutina, d);
  return true;
}
$("contSeguir").addEventListener("click", () => retomar());
$("contGuardar").addEventListener("click", () => { if (retomar()) terminar(); });
$("contDescartar").addEventListener("click", () => { pendienteEnCurso = null; borrarEnCurso(); $("continuarPanel").hidden = true; });
// Also on the way to the background, in case a change didn't get its own save.
document.addEventListener("visibilitychange", () => { if (document.hidden) guardarEnCurso(); });
window.addEventListener("pagehide", () => guardarEnCurso());

// In the Android app, a foreground service with an ongoing notification ("Entreno en curso") while a session is
// open, so Android is much less likely to close the app with the phone locked (EntrenoPlugin.java).
const entreno = native ? window.Capacitor.registerPlugin("Entreno") : null;
// While training: the latest heart rate in Health Connect, if the watch writes it during the workout (COROS usually
// writes everything when the workout ends and syncs, so this mostly stays hidden).
async function fcEnVivo() {
  const s = sesion;
  for (const id of ["repFc", "regFc"]) $(id).hidden = true;
  if (!s || !hc || !estadoSalud.fc) return;
  let r = null;
  try { r = await hc.fc({ desde: Date.now() - 3 * 60000, hasta: Date.now() }); } catch (e) { /* not now */ }
  if (sesion !== s || !r?.ultima) return;
  const el = $(s.tipo === "flex" ? "repFc" : "regFc");
  el.textContent = `♥ ${r.ultima}`;
  el.hidden = false;
}
function salirSesion() {
  clearInterval(sesion?.timer);
  clearInterval(sesion?.timerFc);
  sesion = null;
  borrarEnCurso();
  entreno?.terminar().catch(() => {});
  document.body.classList.remove("en-sesion");
  $("reproductor").hidden = true;
  $("registro").hidden = true;
  $("salirPanel").hidden = true;
  cerrarCardio();
  pantallaEncendida(false);
}
function pedirSalir() { $("salirPanel").hidden = false; if (sesion?.tipo === "flex" && !sesion.pausa) pausar(); }
function cerrarSalir() { $("salirPanel").hidden = true; }
$("repSalir").addEventListener("click", pedirSalir);
$("regSalir").addEventListener("click", pedirSalir);
$("salirSeguir").addEventListener("click", () => { cerrarSalir(); if (sesion?.tipo === "flex" && sesion.pausa) pausar(); });
$("salirDescartar").addEventListener("click", () => { salirSesion(); abrir(abierto); });
$("salirGuardar").addEventListener("click", () => terminar());

async function terminar() {
  const s = sesion;
  if (!s) return;
  // Close the session at once, so a second tap can't save it twice.
  clearInterval(s.timer);
  clearInterval(s.timerFc);
  sesion = null;
  for (const id of ["reproductor", "registro", "salirPanel"]) $(id).hidden = true;
  const fecha = iso(new Date(s.inicio));
  const min = Math.max(1, Math.round((Date.now() - s.inicio) / 60000));
  let datos, stats, man;
  if (s.tipo === "flex") {
    const r = rutinaFlex(s.rutina);
    const ep = enPlan(inicioPlan, fecha);
    const hechos = r.items.filter((_, i) => s.hechos.has(i)).length;
    datos = { tipo: "flexibilidad", fecha, inicio: s.inicio, fin: Date.now(), rutina: s.rutina, fase: r.n || ep.fase.n, semana: ep.semana, duracionMin: min, notas: "",
      ejercicios: r.items.map(([id, dosis], i) => ({ id, dosis, hecho: s.hechos.has(i) })) };
    const musc = {};
    for (const [i, [id]] of r.items.entries()) if (s.hechos.has(i)) { for (const m of EX[id].p) musc[m] = (musc[m] || 0) + s.seg[i] / 60; for (const m of EX[id].s) musc[m] = (musc[m] || 0) + s.seg[i] / 120; }
    man = maniqui(musc, "x");
    const estirando = Object.values(s.seg).reduce((a, b) => a + b, 0) / 60;
    stats = html`${stat(mmss((Date.now() - s.inicio) / 1000), t("Duración"))}${stat(`${hechos}/${r.items.length}`, t("Ejercicios"))}${stat(Math.round(estirando), t("Estirando"), "min")}${statsReloj()}`;
    // The plan starts with the first session done in the app, unless a start date was set.
    if (!inicioPlan && r.n) await store.put("ajustes", "plan-flexibilidad", { plan: "flexibilidad-6m-v1", inicio: fecha });
    // One plan session per day, with the same id the plan's JSON import uses. A second one that day keeps the first's start.
    const antes = sesiones.find((x) => x.id === `plan-${fecha}`);
    if (antes?.inicio) datos.inicio = antes.inicio;
    if (antes?.reloj) datos.reloj = antes.reloj;
    resumenId = `plan-${fecha}`;
    await store.put("sesiones", resumenId, datos);
  } else {
    const w = gym(s.rutina);
    const ejercicios = w.ej.map((e, ei) => ({ n: e.n, series: s.filas.filter((f) => f.e === ei).map((f) => {
      const v = s.valores[f.k];
      return { kg: v.kg, [e.seg ? "seg" : "reps"]: v.n, hecho: v.hecho };
    }) }));
    const hechas = Object.values(s.valores).filter((v) => v.hecho);
    const peso = pesoEn(fecha);
    const vol = s.filas.reduce((a, f) => { const v = s.valores[f.k], e = w.ej[f.e]; return a + (v.hecho && !e.seg && v.n > 0 ? carga(v.kg, e, peso) * v.n * (e.porLado ? 2 : 1) : 0); }, 0);
    datos = { tipo: "gimnasio", fecha, inicio: s.inicio, fin: Date.now(), rutina: w.id, nombre: w.n, duracionMin: min, notas: "", volumenKg: Math.round(vol), ejercicios };
    // Cardio stays apart from the sets: not in the volume, the records or the mannequin.
    if (s.cardio.length) datos.cardio = s.cardio;
    const p = {}, sec = {};
    for (const f of s.filas) if (s.valores[f.k].hecho) { for (const m of w.ej[f.e].p) p[m] = (p[m] || 0) + 1; for (const m of w.ej[f.e].s) sec[m] = (sec[m] || 0) + 1; }
    man = maniqui({ p, s: sec }, "f", { etiquetas: etiquetasTop(p, 4, (v) => tn(v, "{n} serie", "{n} series")) });
    stats = html`${stat(hechas.length, t("Series"))}${stat(num(Math.round(vol)), t("Volumen"), "kg")}${stat(mmss((Date.now() - s.inicio) / 1000), t("Duración"))}${statsReloj()}`;
    resumenId = store.newId();
    await store.put("sesiones", resumenId, datos);
  }
  // Saved: the copy kept in case the app closed isn't needed any more (salirSesion removes it too).
  borrarEnCurso();
  salirSesion();
  document.body.classList.add("en-sesion");
  $("resFecha").textContent = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  $("resTitulo").textContent = titulo(datos.rutina);
  $("resMan").innerHTML = html`${man}`;
  $("resStats").innerHTML = html`${stats}`;
  const recs = s.tipo === "flex" ? [] : records({ ...datos, id: resumenId });
  $("resRecords").innerHTML = html`<div class="hd"><h3>${t("Récords")}</h3><span class="sub">${tn(recs.length, "{n} nuevo", "{n} nuevos")}</span></div>
    <ul class="recs">${recs.map((r) => html`<li><span class="n">${t(r.n)}</span><span class="v num">${r.v}</span><span class="sub">${t("{que} · antes {v}", { que: t(r.t), v: r.antes })}</span></li>`)}</ul>`;
  $("resRecords").hidden = !recs.length;
  pintarEsfuerzo(null);
  resCardio = s.tipo === "flex" ? null : [...(datos.cardio || [])];
  renderResCardio();
  $("resumen").classList.toggle("flex", s.tipo === "flex");
  $("resumen").hidden = false;
  rellenarResumen();
  // The watch may already have synced its workout (stopped on the watch first): look now, and again in a minute.
  leerReloj({ forzar: true });
  setTimeout(() => leerReloj({ forzar: true }), 60000);
}
let resumenId = null;
function rellenarResumen() {
  if ($("resumen").hidden || !resumenId) return;
  const r = sesiones.find((x) => x.id === resumenId)?.reloj;
  $("resFc").textContent = r?.fcMedia ? `${r.fcMedia}` : "—";
  $("resKcal").textContent = r?.kcal ? `${r.kcal}` : "—";
  $("resNota").textContent = r ? (r.fcMax ? t("Del reloj: FC máxima {n} ppm.", { n: r.fcMax }) : t("Datos del reloj vía Health Connect."))
    : !hc ? t("FC media y kcal llegan de tu Coros a través de Health Connect, en la app de Android.")
      : !estadoSalud.permiso ? t("Conecta Health Connect en Perfil para ver aquí la FC y las calorías de tu Coros.")
        : t("Aparecerán cuando tu Coros sincronice el entreno con el teléfono.");
}
// How hard it felt, 1–10, saved on the session (the summary's buttons; tap again to change it).
function pintarEsfuerzo(v) {
  $("resEsf").innerHTML = html`${Array.from({ length: 10 }, (_, i) => html`<button type="button" data-esf="${i + 1}" aria-pressed="${v === i + 1}">${i + 1}</button>`)}`;
}
// Changes a saved session's fields, read fresh from the store (another change from the summary may not have reached
// `sesiones` yet). Changes to one session are queued, so two quick taps can't overwrite each other.
let cola = Promise.resolve();
function cambiarSesion(id, cambios) {
  cola = cola.then(async () => {
    const x = (await store.all("sesiones")).find((y) => y.id === id);
    if (!x) return;
    const { id: _id, _actualizado, ...data } = x; // eslint-disable-line no-unused-vars
    await store.put("sesiones", id, { ...data, ...cambios });
  }).catch(() => {});
  return cola;
}
$("resEsf").addEventListener("click", async (e) => {
  const v = Number(e.target.closest("[data-esf]")?.dataset.esf);
  if (!v || !resumenId) return;
  pintarEsfuerzo(v);
  await cambiarSesion(resumenId, { esfuerzo: v });
});
// Cardio after the weights can still be added from the summary, saved on the session at once.
let resCardio = null;
function renderResCardio() {
  const c = resCardio;
  $("resCardio").hidden = !c;
  if (!c) return;
  $("resCardio").innerHTML = html`<div class="hd"><h3>${t("Cardio")}</h3>${c.length ? html`<span class="sub">${t("{n} min", { n: num(cardioMin(c)) })}</span>` : ""}</div>
    <div class="cardio-reg" data-cardio="res">${listaCardio(c)}<button type="button" class="add" data-cardio-add>${t("+ Añadir cardio")}</button></div>`;
}
$("resCardio").addEventListener("click", (e) => accionCardio(e, resCardio, "despues", (lista) => {
  resCardio = lista;
  renderResCardio();
  if (resumenId) cambiarSesion(resumenId, { cardio: lista.length ? lista : null });
}));
function cerrarResumen() { resumenId = null; $("resumen").hidden = true; document.body.classList.remove("en-sesion"); show("historial"); }
$("resListo").addEventListener("click", cerrarResumen);

/* ---------- Stretching player ---------- */
// The routine becomes a list of steps: work steps from each dose, with short pauses to get ready or change side.
function construirPasos(r) {
  const out = [];
  for (const [i, it] of r.items.entries()) {
    const ps = pasos(it, i);
    for (const [k, p] of ps.entries()) {
      const prev = ps[k - 1];
      if (k === 0) out.push({ ...p, tipo: "prep", seg: 5, texto: t("Prepárate") });
      else if (p.lado && prev.lado !== p.lado) out.push({ ...p, tipo: "prep", seg: 4, texto: t("Cambia de lado") });
      else out.push({ ...p, tipo: "prep", seg: 3, texto: t("Suelta y respira") });
      out.push({ ...p, tipo: "work" });
    }
  }
  return out;
}

// `previo`: a session saved before the app closed. It goes back to the start of the step it was on (to the
// "get ready" before a stretch), paused, so there's time to get back into position.
function empezarFlex(id, previo = null) {
  const r = rutinaFlex(id);
  sesion = { tipo: "flex", pasos: construirPasos(r), idx: 0, hechos: new Set(), seg: {}, pausa: null, pausado: 0 };
  let i = 0;
  if (previo) {
    const n = r.items.length;
    sesion.hechos = new Set(previo.hechos.filter((x) => Number.isInteger(x) && x >= 0 && x < n));
    for (const [k, v] of Object.entries(previo.seg || {})) if (sesion.hechos.has(Number(k)) && Number.isFinite(v)) sesion.seg[k] = v;
    i = Math.max(0, Math.min(Number(previo.idx) || 0, sesion.pasos.length - 1));
    if (sesion.pasos[i].tipo === "work" && sesion.pasos[i - 1]?.tipo === "prep") i--;
    sesion.pausa = Date.now();
  }
  entrar(id, previo?.inicio);
  $("repPausa").textContent = t(sesion.pausa ? "SEGUIR" : "PAUSA");
  $("reproductor").hidden = false;
  window.scrollTo(0, 0);
  irA(i);
  sesion.timer = setInterval(tick, 200);
}
const ahora = () => (sesion.pausa ?? Date.now());
const transcurrido = () => (ahora() - sesion.t0 - sesion.pausado) / 1000;

function irA(i) {
  const s = sesion;
  const r = rutinaFlex(s.rutina);
  if (i >= s.pasos.length) { terminar(); return; }
  s.idx = i;
  s.t0 = Date.now();
  s.pausado = 0;
  if (s.pausa) s.pausa = s.t0;
  const p = s.pasos[i];
  const ex = EX[p.ex];
  $("repCuenta").textContent = t("Postura {i} de {n}", { i: p.i + 1, n: r.items.length });
  $("repTitulo").textContent = t(ex.n);
  $("repSerie").textContent = p.tipo === "prep" ? p.texto : [p.texto, p.reps ? t("{n} repeticiones", { n: p.reps }) : ""].filter(Boolean).join(" · ");
  $("repLado").hidden = !p.lado;
  $("repLado").querySelectorAll("span").forEach((sp) => sp.classList.toggle("on", sp.dataset.lado === p.lado));
  if ($("repFig").dataset.ex !== p.ex) {
    $("repFig").innerHTML = html`${figura(p.ex, { clase: "grande" })}`;
    $("repFig").dataset.ex = p.ex;
    const svg = $("repFig").querySelector("svg");
    const ctl = (t) => {
      if (!sesion) return { p: 0, t };
      const cur = sesion.pasos[sesion.idx];
      return { p: cur.tipo === "work" ? enPaso(cur.ex, transcurrido()) : 0, t: sesion.pausa ? 0 : t };
    };
    svg._ctl = ctl;
    animar($("repFig"));
    en3d($("repFig"), p.ex, { ctl, compacto: true, musculos: ex });
  }
  $("repCueT").textContent = t(p.tipo === "prep" ? "Cómo" : "Siente");
  $("repCue").textContent = p.tipo === "prep" ? t(ex.c[0]) : `${t(ex.z)}. ${t("Tensión, nunca dolor: respira lento y suelta un poco más al exhalar.")}`;
  const sig = s.pasos.slice(i + 1).find((q) => q.tipo === "work" && q.i !== p.i);
  $("repSig").innerHTML = html`${sig ? html`<span class="th">${figura(sig.ex)}</span><span>${t("Después:")} <b>${t(EX[sig.ex].n)}</b> · ${tDosis(r.items[sig.i][1])}</span>` : html`<span>${t("Es la última postura.")}</span>`}`;
  animar($("repSig"));
  if (p.tipo === "work" && !s.pausa) { vibrar(p.lado ? [120, 80, 120] : 150); pitido(p.lado === "der" ? 990 : 880); }
  guardarEnCurso();
  tick();
}
function tick() {
  const s = sesion;
  if (!s || s.tipo !== "flex") return;
  const p = s.pasos[s.idx];
  const t = transcurrido();
  $("repTiempo").textContent = mmss(p.seg - t);
  $("repReloj").textContent = mmss((Date.now() - s.inicio) / 1000);
  $("repArco").setAttribute("stroke-dashoffset", String((565.5 * Math.min(1, t / p.seg)).toFixed(1)));
  $("repArco").setAttribute("stroke", p.tipo === "prep" ? "var(--amber)" : "var(--flex3)");
  if (t >= p.seg) {
    if (p.tipo === "work") { s.hechos.add(p.i); s.seg[p.i] = (s.seg[p.i] || 0) + p.seg; }
    irA(s.idx + 1);
  }
}
function pausar() {
  const s = sesion;
  if (s.pausa) { s.pausado += Date.now() - s.pausa; s.pausa = null; } else s.pausa = Date.now();
  $("repPausa").textContent = t(s.pausa ? "SEGUIR" : "PAUSA");
}
$("repPausa").addEventListener("click", pausar);
// Skipping goes to the next exercise (a work step skipped halfway doesn't count as done).
$("repSaltar").addEventListener("click", () => {
  const s = sesion;
  const p = s.pasos[s.idx];
  const sig = s.pasos.findIndex((q, j) => j > s.idx && q.i !== p.i);
  irA(sig === -1 ? s.pasos.length : sig);
});

/* ---------- Gym logger ---------- */
// `previo`: a session saved before the app closed, whose sets, page and rest timer come back as they were.
function empezarGym(id, previo = null) {
  const w = gym(id);
  // Pages: one per exercise; a circuit is one page with its rounds in order.
  const paginas = [];
  const filas = [];
  for (const [ei, e] of w.ej.entries()) {
    if (!e.bloque) {
      const fs = Array.from({ length: e.series }, (_, si) => ({ e: ei, si, k: `${ei}-${si}`, lbl: String(si + 1) }));
      filas.push(...fs);
      paginas.push({ titulo: t(e.n), filas: fs, ej: [ei] });
    } else if (w.ej[ei - 1]?.bloque !== e.bloque) {
      const idx = w.ej.map((x, j) => [x, j]).filter(([x]) => x.bloque === e.bloque).map(([, j]) => j);
      const fs = [];
      for (let ro = 0; ro < w.bloques[e.bloque].rondas; ro++) for (const j of idx) fs.push({ e: j, si: ro, k: `${j}-${ro}`, lbl: `R${ro + 1}`, ronda: true });
      filas.push(...fs);
      paginas.push({ titulo: t("Circuito · {n} vueltas", { n: w.bloques[e.bloque].rondas }), filas: fs, ej: idx });
    }
  }
  // Each set starts with last time's weight and reps (a set beyond last time's takes its last set's numbers).
  const valores = {};
  const ult = w.ej.map((_, i) => ultimasSeries(w, i));
  for (const f of filas) {
    const e = w.ej[f.e], u = ult[f.e], c = e.seg ? "seg" : "reps";
    const ps = u && (u.series[f.si] || u.series[u.series.length - 1]);
    const kg = ps && ps.kg != null ? ps.kg : e.kg;
    const n = ps && !u.otra && ps[c] != null ? ps[c] : e.seg || e.reps;
    valores[f.k] = { kg, n, hecho: false, prev: ps ? `${ps.kg ? `${num(ps.kg)}×` : ""}${ps[c] ?? ""}${e.seg ? " s" : ""}` : "—" };
  }
  // Last time every set was done at the target: one step up (not when coming back to a session already under way).
  const subidas = {};
  for (const [ei, e] of w.ej.entries()) {
    const sube = subida(e, ult[ei]);
    if (!sube) continue;
    subidas[ei] = sube.texto;
    for (const f of filas) {
      if (f.e !== ei) continue;
      const v = valores[f.k];
      if (sube.kg && v.kg != null) v.kg = v.kg < 0 ? Math.min(0, v.kg + sube.kg) : Math.round((v.kg + sube.kg) * 2) / 2;
      if (sube.n && v.n != null) v.n += sube.n;
    }
  }
  let pag = 0, desc = null;
  if (previo) {
    for (const f of filas) {
      const v = previo.valores[f.k];
      if (v && typeof v === "object") valores[f.k] = { ...valores[f.k], kg: v.kg ?? null, n: v.n ?? null, hecho: !!v.hecho, prev: v.prev ?? valores[f.k].prev };
    }
    pag = Math.max(0, Math.min(Number(previo.pag) || 0, paginas.length - 1));
    if (previo.desc?.fin > Date.now()) desc = previo.desc;
  }
  const cardio = Array.isArray(previo?.cardio) ? previo.cardio.filter((c) => c && c.min > 0) : [];
  sesion = { tipo: "gym", paginas, filas, valores, pag, desc, subidas, cardio };
  entrar(id, previo?.inicio);
  $("registro").hidden = false;
  pagina(pag);
  renderCardioReg();
  sesion.timer = setInterval(tickGym, 250);
}
function pagina(n) {
  const s = sesion, w = gym(s.rutina);
  s.pag = n;
  const pg = s.paginas[n];
  $("regCuenta").textContent = t("Ejercicio {i} de {n}", { i: n + 1, n: s.paginas.length });
  $("regTitulo").textContent = pg.titulo;
  const ms = new Set(pg.ej.flatMap((i) => w.ej[i].p)), ss = new Set(pg.ej.flatMap((i) => w.ej[i].s));
  const fig = FIG_FUERZA[w.ej[pg.ej[0]].n];
  $("regFig").innerHTML = html`${fig ? figura(fig) : ""}`;
  $("regFig").hidden = !fig;
  animar($("regFig"));
  en3d($("regFig"), fig, { musculos: { p: [...ms], s: [...ss] } });
  $("regMusc").innerHTML = html`${[...ms].map((m) => html`<span class="chip f">${M(m)}</span>`)}${[...ss].filter((m) => !ms.has(m)).map((m) => html`<span class="chip">${M(m)}</span>`)}`;
  const timed = pg.ej.every((i) => w.ej[i].seg);
  $("regColReps").textContent = t(timed ? "SEG" : pg.ej.every((i) => w.ej[i].porLado) ? "REPS/LADO" : "REPS");
  // Kg can be negative (assisted pull-ups on the machine), so the kg field has no min and no inputmode="decimal",
  // whose keyboard on Android has no minus key. Negative kg add nothing to the volume.
  $("regFilas").innerHTML = html`${pg.filas.map((f) => {
    const e = w.ej[f.e], v = s.valores[f.k];
    const nombre = f.ronda ? `${f.lbl} · ${t(e.n)}${e.lado ? ` ${t(e.lado === "izq" ? "izq." : "der.")}` : ""}` : f.lbl;
    return html`<tr data-k="${f.k}" class="${v.hecho ? "done" : ""}"><td class="${f.ronda ? "lbl" : "num"}">${nombre}</td><td class="prev">${v.prev}</td>
      <td><input type="number" step="0.5" data-c="kg" value="${v.kg ?? ""}" aria-label="${t("Kg, serie {n}", { n: f.lbl })}" placeholder="${e.kg == null ? "—" : ""}"></td>
      <td><input type="number" inputmode="numeric" min="0" data-c="n" value="${v.n ?? ""}" aria-label="${t(e.seg ? "Segundos, serie {n}" : "Repeticiones, serie {n}", { n: f.lbl })}"></td>
      <td><button type="button" class="ck" data-ck="${f.k}" aria-pressed="${v.hecho}" aria-label="${t("Serie {n} hecha", { n: f.lbl })}">✓</button></td></tr>`;
  })}`;
  // Notes are matched to the exercise in Spanish, then shown translated.
  const nota = w.notas.find((x) => pg.ej.some((i) => x.toLowerCase().startsWith(w.ej[i].n.toLowerCase().split(" ").slice(0, 2).join(" "))));
  $("regNota").textContent = nota ? t(nota) : "";
  const sube = pg.ej.map((i) => s.subidas[i]).filter(Boolean);
  $("regSube").textContent = sube.length ? `${t("Subimos un paso.")} ${sube.join(" ")}` : "";
  $("regSube").hidden = !sube.length;
  $("regAnt").disabled = n === 0;
  $("regSig").textContent = t(n === s.paginas.length - 1 ? "TERMINAR" : "SIGUIENTE");
  guardarEnCurso();
}
$("regFilas").addEventListener("input", (e) => {
  const i = e.target.closest("input"), k = i?.closest("tr")?.dataset.k;
  if (!k) return;
  const v = Number(String(i.value).replace(",", "."));
  const val = i.value === "" || !Number.isFinite(v) ? null : v;
  sesion.valores[k][i.dataset.c] = val;
  // A new weight carries on to the exercise's later sets not ticked yet, so they needn't be changed one by one.
  if (i.dataset.c !== "kg") return;
  const f = sesion.filas.find((x) => x.k === k);
  for (const g of sesion.filas) {
    if (g.e !== f.e || g.si <= f.si || sesion.valores[g.k].hecho) continue;
    sesion.valores[g.k].kg = val;
    const inp = $("regFilas").querySelector(`tr[data-k="${g.k}"] input[data-c="kg"]`);
    if (inp) inp.value = val ?? "";
  }
});
$("regFilas").addEventListener("input", () => guardarEnCurso());
$("regFilas").addEventListener("click", (e) => {
  const k = e.target.closest("[data-ck]")?.dataset.ck;
  if (!k) return;
  const v = sesion.valores[k];
  v.hecho = !v.hecho;
  const tr = e.target.closest("tr");
  tr.classList.toggle("done", v.hecho);
  e.target.closest("button").setAttribute("aria-pressed", String(v.hecho));
  if (v.hecho) {
    const ej = gym(sesion.rutina).ej[Number(k.split("-")[0])];
    sesion.desc = { fin: Date.now() + ej.desc * 1000, total: ej.desc };
    tickGym();
  }
  guardarEnCurso();
});
function tickGym() {
  const s = sesion;
  if (!s || s.tipo !== "gym") return;
  $("regReloj").textContent = mmss((Date.now() - s.inicio) / 1000);
  const d = s.desc;
  $("regDescanso").hidden = !d;
  if (!d) return;
  const quedan = (d.fin - Date.now()) / 1000;
  $("regDescT").textContent = mmss(quedan);
  $("regDescBar").style.width = `${Math.max(0, Math.min(100, (quedan / d.total) * 100))}%`;
  if (quedan <= 0) { s.desc = null; $("regDescanso").hidden = true; vibrar([200, 100, 200]); pitido(); }
}
$("regMenos").addEventListener("click", () => { if (sesion?.desc) { sesion.desc.fin -= 15000; tickGym(); guardarEnCurso(); } });
$("regMas").addEventListener("click", () => { if (sesion?.desc) { sesion.desc.fin += 15000; sesion.desc.total += 15; tickGym(); guardarEnCurso(); } });
$("regFinDesc").addEventListener("click", () => { if (sesion) { sesion.desc = null; tickGym(); guardarEnCurso(); } });
$("regAnt").addEventListener("click", () => sesion.pag > 0 && pagina(sesion.pag - 1));
$("regSig").addEventListener("click", () => (sesion.pag < sesion.paginas.length - 1 ? pagina(sesion.pag + 1) : terminar()));

/* ---------- Cardio (elliptical, treadmill, bike, rowing…) before or after the weights ---------- */
const maquina = (id) => CARDIO.find((c) => c.id === id) || CARDIO.at(-1);
const cardioDe = (s) => (Array.isArray(s?.cardio) ? s.cardio.filter((c) => c && Number(c.min) > 0) : []);
const cardioMin = (lista) => Math.round(lista.reduce((a, c) => a + (Number(c?.min) || 0), 0) * 10) / 10;
// The details of a cardio block: "20 min · 2,1 km · 6 km/h · incline 8 % · level 5 · 180 kcal".
function lineaCardio(c) {
  const p = [t("{n} min", { n: num(c.min) })];
  for (const k of Object.keys(CAMPOS_CARDIO)) {
    const v = Number(c[k]);
    if (!(v > 0)) continue;
    p.push(k === "nivel" ? t("nivel {n}", { n: num(v) }) : k === "incl" ? t("inclinación {n} %", { n: num(v) }) : `${num(v)} ${CAMPOS_CARDIO[k].u}`);
  }
  return p.join(" · ");
}
// The blocks as buttons: tap one to change it, ✕ to remove it.
const listaCardio = (lista) => lista.map((c, i) => {
  const n = t(maquina(c.tipo).n);
  return html`<span class="cardio-it"><button type="button" class="edit" data-cardio-ed="${i}" aria-label="${t("Cambiar {x}", { x: n })}">${n} · ${t("{n} min", { n: num(c.min) })}</button><button type="button" class="del" data-cardio-del="${i}" aria-label="${t("Quitar {x}", { x: n })}">✕</button></span>`;
});
function accionCardio(e, lista, momento, guardar) {
  const b = e.target.closest("[data-cardio-add], [data-cardio-ed], [data-cardio-del]");
  if (!b || !lista) return;
  if (b.dataset.cardioDel != null) { guardar(lista.filter((_, i) => i !== Number(b.dataset.cardioDel))); return; }
  abrirCardio({ lista, i: b.dataset.cardioEd != null ? Number(b.dataset.cardioEd) : null, momento, guardar });
}
// In the logger: on every page, under the sets. Before any set is ticked it's warm-up cardio, after that it's after.
function renderCardioReg() {
  const s = sesion;
  if (s?.tipo !== "gym") return;
  $("regCardio").innerHTML = html`${listaCardio(s.cardio)}<button type="button" class="add" data-cardio-add>${t("+ Cardio")}</button>`;
}
$("regCardio").addEventListener("click", (e) => {
  if (sesion?.tipo !== "gym") return;
  const momento = Object.values(sesion.valores).some((v) => v.hecho) ? "despues" : "antes";
  accionCardio(e, sesion.cardio, momento, (lista) => {
    if (sesion?.tipo !== "gym") return;
    sesion.cardio = lista;
    renderCardioReg();
    guardarEnCurso();
  });
});
// The form: the machine, before or after, the minutes and what that machine's display shows.
let cardioForm = null;
function abrirCardio({ lista, i = null, momento, guardar }) {
  const ultimo = cardioDe(sesiones.find((x) => cardioDe(x).length)).at(-1)?.tipo;
  const d = i != null && lista[i] ? { ...lista[i] } : { tipo: lista.at(-1)?.tipo || ultimo || CARDIO[0].id, momento };
  cardioForm = { lista, i, guardar, d };
  $("cardioError").textContent = "";
  pintarCardio();
  $("cardioPanel").hidden = false;
  $("cardioCampos").querySelector("input")?.focus({ preventScroll: true });
}
function pintarCardio() {
  const d = cardioForm.d, m = maquina(d.tipo);
  $("cardioTit").textContent = t(cardioForm.i != null ? "Cambiar cardio" : "Añadir cardio");
  $("cardioTipos").innerHTML = html`${CARDIO.map((c) => html`<button type="button" data-tipo="${c.id}" aria-pressed="${c.id === m.id}">${t(c.n)}</button>`)}`;
  for (const r of $("cardioForm").querySelectorAll('input[name="momento"]')) r.checked = r.value === (d.momento === "antes" ? "antes" : "despues");
  const campo = (k, l, u, step, max) => html`<label class="f">${u ? `${l} (${u})` : l}<input type="number" inputmode="${step < 1 ? "decimal" : "numeric"}" min="0" max="${max}" step="${step}" data-campo="${k}" value="${d[k] ?? ""}"></label>`;
  $("cardioCampos").innerHTML = html`${campo("min", t("Minutos"), "", 1, 300)}${m.campos.map((k) => campo(k, t(CAMPOS_CARDIO[k].l), CAMPOS_CARDIO[k].u, CAMPOS_CARDIO[k].step, CAMPOS_CARDIO[k].max))}`;
}
function cerrarCardio() { cardioForm = null; $("cardioPanel").hidden = true; }
$("cardioTipos").addEventListener("click", (e) => {
  const id = e.target.closest("[data-tipo]")?.dataset.tipo;
  if (!id || !cardioForm) return;
  cardioForm.d.tipo = id;
  pintarCardio();
});
$("cardioForm").addEventListener("input", (e) => {
  if (!cardioForm) return;
  if (e.target.name === "momento") { cardioForm.d.momento = e.target.value; return; }
  const k = e.target.dataset.campo;
  if (!k) return;
  const v = Number(String(e.target.value).replace(",", "."));
  cardioForm.d[k] = e.target.value === "" || !Number.isFinite(v) ? null : v;
});
$("cardioForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!cardioForm) return;
  const { d, lista, i, guardar } = cardioForm, m = maquina(d.tipo);
  if (!(d.min > 0 && d.min <= 300)) { $("cardioError").textContent = t("Apunta los minutos, entre 1 y 300."); return; }
  const c = { tipo: m.id, momento: d.momento === "antes" ? "antes" : "despues", min: d.min };
  // Only the fields of this machine, and only sensible numbers (an empty or 0 field is left out).
  for (const k of m.campos) if (d[k] > 0 && d[k] <= CAMPOS_CARDIO[k].max) c[k] = d[k];
  const nueva = [...lista];
  if (i != null) nueva[i] = c; else nueva.push(c);
  cerrarCardio();
  guardar(nueva);
});
$("cardioCancelar").addEventListener("click", cerrarCardio);

/* ---------- Progreso ---------- */
async function renderProgreso() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = iso(lunes);
  const ses = sesiones.filter((s) => s.fecha >= desde);
  const n = (t) => ses.filter((s) => s.tipo === t).length;
  $("semana").innerHTML = html`<div class="stat"><b>${ses.length}</b><span>${t("sesiones esta semana")}</span></div>
    <div class="stat"><b>${n("flexibilidad")}</b><span>${t("flexibilidad")}</span></div>
    <div class="stat"><b>${n("gimnasio")}</b><span>${t("gimnasio")}</span></div>`;
  // Five weeks, Monday to Sunday, ending this week.
  const porDia = {};
  for (const s of sesiones) if (s.fecha) (porDia[s.fecha] ||= new Set()).add(s.tipo);
  const celdas = [];
  const d0 = new Date(lunes); d0.setDate(d0.getDate() - 28);
  for (let i = 0; i < 35; i++) {
    const d = new Date(d0); d.setDate(d0.getDate() + i);
    const k = iso(d), t = porDia[k];
    const c = t ? (t.has("gimnasio") && t.has("flexibilidad") ? "b" : t.has("gimnasio") ? "f" : "x") : "";
    celdas.push(html`<i class="${c}${k === iso(hoy) ? " hoy" : ""}${d > hoy ? " fut" : ""}" title="${k}"></i>`);
  }
  $("calendario").innerHTML = html`${celdas}`;
  let racha = 0;
  const d = new Date(hoy);
  if (!porDia[iso(d)]) d.setDate(d.getDate() - 1);
  while (porDia[iso(d)]) { racha++; d.setDate(d.getDate() - 1); }
  $("racha").textContent = tn(racha, "{n} día seguido", "{n} días seguidos");

  semanaMusculos(ses.filter(gimnasio));
  tablaRecords();
  grafPeso();

  const tests = await store.all("tests");
  grafica(tests);
  if (!$("testForm").contains(document.activeElement)) {
    $("testFase").value = String(enPlan(inicioPlan, iso(hoy)).fase.n);
    camposTest(tests);
  }
}
// Sets per muscle this week (Monday on), from the sets ticked: primary muscles full, as in the workout's mannequin.
// The 10–20 band is a common guide for building muscle, shown as a reference only.
function semanaMusculos(ses) {
  const p = {}, sec = {};
  for (const x of ses) for (const e of x.ejercicios || []) {
    const def = defGym(x.rutina, e?.n);
    const n = (e?.series || []).filter((y) => y?.hecho).length;
    if (!def || !n) continue;
    for (const m of def.p) p[m] = (p[m] || 0) + n;
    for (const m of def.s) sec[m] = (sec[m] || 0) + n;
  }
  const filas = Object.entries(p).sort((a, b) => b[1] - a[1]);
  $("musSemana").innerHTML = html`<div class="hd"><h3>${t("Series por músculo")}</h3><span class="sub">${t("esta semana")}</span></div>
    ${filas.length ? html`${maniqui({ p, s: sec }, "f", { titulo: t("Músculos trabajados esta semana"), etiquetas: etiquetasTop(p, 6, (v) => tn(v, "{n} serie", "{n} series")) })}
      <ul class="barras musc">${filas.map(([m, v]) => html`<li class="${v >= 10 ? "en-rango" : ""}"><span class="n">${M(m)}</span><span class="v num">${v}</span><span class="b"><i style="${`width:${Math.min(100, (v / 20) * 100).toFixed(1)}%`}"></i><em class="marca" aria-hidden="true"></em></span></li>`)}</ul>
      <p class="sub">${t("Series en que el músculo es el principal. La raya marca 10: entre 10 y 20 por semana es una guía habitual para ganar músculo.")}</p>`
    : html`<p class="sub">${t("Aún no hay series de fuerza esta semana.")}</p>`}`;
}
// Body weight over the last six months, when there are two or more days.
function grafPeso() {
  const desde = new Date(); desde.setDate(desde.getDate() - 182);
  const pts = pesos.filter((p) => p.fecha >= iso(desde));
  $("pesoGraf").hidden = pts.length < 2;
  if (pts.length < 2) { $("pesoGraf").innerHTML = ""; return; }
  const vs = pts.map((p) => p.kg), lo = Math.min(...vs), hi = Math.max(...vs);
  const t0 = parse(pts[0].fecha).getTime(), t1 = parse(pts.at(-1).fecha).getTime();
  const W = 300, H = 90, x = (p) => 16 + ((parse(p.fecha).getTime() - t0) / (t1 - t0 || 1)) * (W - 32), y = (v) => (hi === lo ? 48 : 74 - ((v - lo) / (hi - lo)) * 50);
  const dif = Math.round((vs.at(-1) - vs[0]) * 10) / 10;
  $("pesoGraf").innerHTML = html`<div class="hd"><h3>${t("Peso corporal")}</h3><span class="sub">${t("últimos 6 meses")}${dif ? ` · ${dif > 0 ? "+" : "−"}${kgTxt(Math.abs(dif))}` : ""}</span></div>
    <svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Peso corporal: de {a} a {b}", { a: kgTxt(vs[0]), b: kgTxt(vs.at(-1)) })}">
      <line x1="16" x2="${W - 16}" y1="${H - 6}" y2="${H - 6}" stroke="var(--app-line)" stroke-width=".8"/>
      <polyline points="${pts.map((p) => `${x(p).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(pts.at(-1))}" cy="${y(vs.at(-1))}" r="4" fill="var(--fg)"/>
      <text x="${x(pts[0])}" y="${y(vs[0]) - 8}" text-anchor="start">${kgTxt(vs[0])}</text>
      <text x="${x(pts.at(-1))}" y="${y(vs.at(-1)) - 8}" text-anchor="end" style="fill:var(--fg);font-weight:600">${kgTxt(vs.at(-1))}</text>
    </svg>`;
}
// Each exercise's best: the set with the best estimated 1RM, or most reps / longest hold with no weight. Newest first.
function tablaRecords() {
  const gs = sesiones.filter(gimnasio);
  const nombres = [];
  for (const x of gs) for (const e of x.ejercicios || []) if (e?.n && !nombres.includes(e.n) && e.series?.some((y) => y?.hecho)) nombres.push(e.n);
  const filas = nombres.map((n) => {
    const seg = !!defGym(null, n)?.seg, b = mejorDe(gs, n, seg);
    if (!b || !(b.rm || b.kg || b.reps)) return null;
    const v = b.rm ? kgTxt(b.rm) : b.kg ? kgTxt(b.kg) : seg ? mmss(b.reps) : t("{n} reps", { n: b.reps });
    const veces = b.rm ? vecesPeso(b.rm, b.fecha) : null;
    const det = b.rm ? t("1RM est. · {set}", { set: `${kgTxt(b.set.kg)} × ${b.set.reps}` }) + (veces ? ` · ${t("{x}× tu peso", { x: veces })}` : "") : t(b.kg ? "peso máximo" : seg ? "mejor tiempo" : "peso corporal");
    return { n, v, det, fecha: b.fecha };
  }).filter(Boolean);
  $("records").innerHTML = html`<div class="hd"><h3>${t("Récords")}</h3><span class="sub">${t("1RM estimado (Epley)")}</span></div>
    ${filas.length ? html`<ul class="recs">${filas.map((f) => html`<li><span class="n">${t(f.n)}</span><span class="v num">${f.v}</span><span class="sub">${f.det}${f.fecha ? ` · ${fechaCorta(f.fecha)}` : ""}</span></li>`)}</ul>`
    : html`<p class="sub">${t("Tus mejores marcas aparecerán cuando registres series en el gimnasio.")}</p>`}`;
}
function camposTest(tests) {
  const f = Number($("testFase").value);
  const prev = tests.find((x) => x.fase === f) || {};
  $("testCampos").innerHTML = html`${TESTS.map(([k, l, u]) => html`<label class="f">${t(l)} (${u})<input type="number" inputmode="decimal" step="any" name="${k}" value="${prev[k] ?? ""}"></label>`)}`;
}
$("testFase").addEventListener("change", async () => camposTest(await store.all("tests")));
$("testForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fase = Number($("testFase").value);
  const datos = { fase, fecha: iso(new Date()) };
  for (const [k] of TESTS) {
    const v = $("testForm").elements[k].value.trim().replace(",", ".");
    datos[k] = v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  }
  await store.put("tests", `fase-${fase}`, datos);
  $("testOk").textContent = t("Test de la fase {n} guardado.", { n: fase });
});
function grafica(tests) {
  const pts = tests.filter((t) => Number.isFinite(t.dedosSueloCm)).sort((a, b) => a.fase - b.fase);
  if (!pts.length) { $("testGrafica").innerHTML = html`<p class="sub">${t("Aún no hay tests. Haz el primero al final de la fase 1.")}</p>`; return; }
  // Distance to the floor in cm: 0 means touching it, negative means past it. Higher on the chart is better.
  const vals = pts.map((t) => t.dedosSueloCm);
  const hi = Math.max(5, ...vals) + 2, lo = Math.min(-5, ...vals) - 2;
  const x = (f) => 30 + ((f - 1) / 5) * 205, y = (v) => 8 + ((v - lo) / (hi - lo)) * 60;
  const grid = [hi - 2, 0, lo + 2].map(Math.round).filter((v, i, a) => a.indexOf(v) === i);
  $("testGrafica").innerHTML = html`<svg class="grafica" viewBox="0 0 250 86" role="img" aria-label="${t("Test de dedos al suelo por fase")}">
    ${grid.map((v) => html`<line x1="30" x2="240" y1="${y(v)}" y2="${y(v)}" stroke="var(--app-line)" stroke-width=".6" stroke-dasharray="${v === 0 ? "3 2" : "none"}"/><text x="26" y="${y(v) + 3}" text-anchor="end">${v}</text>`)}
    <text x="240" y="${y(0) - 3}" text-anchor="end">${t("tocar el suelo")}</text>
    <polyline points="${pts.map((t) => `${x(t.fase)},${y(t.dedosSueloCm)}`).join(" ")}" fill="none" stroke="var(--flex3)" stroke-width="2"/>
    ${pts.map((t, i) => html`<circle cx="${x(t.fase)}" cy="${y(t.dedosSueloCm)}" r="${i === pts.length - 1 ? 3.5 : 2.4}" fill="var(--flex3)"/>`)}
    ${[1, 2, 3, 4, 5, 6].map((f) => html`<text x="${x(f)}" y="82" text-anchor="middle">F${f}</text>`)}
    <text x="${x(pts.at(-1).fase)}" y="${y(pts.at(-1).dedosSueloCm) - 7}" text-anchor="middle" style="fill:var(--fg);font-weight:600">${pts.at(-1).dedosSueloCm} cm</text>
  </svg>`;
}

/* ---------- Historial ---------- */
const form = $("nueva");
form.fecha.value = iso(new Date());
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const min = Number(fd.get("duracionMin"));
  await store.put("sesiones", store.newId(), {
    tipo: fd.get("tipo"), fecha: fd.get("fecha") || iso(new Date()), duracionMin: min > 0 ? Math.round(min) : null, notas: String(fd.get("notas") || "").trim(),
  });
  form.duracionMin.value = "";
  form.notas.value = "";
  $("nuevaOk").hidden = false;
  setTimeout(() => ($("nuevaOk").hidden = true), 1800);
});

const hora = (ms) => new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
// A session's minutes: the longer of what was logged and the watch's time (the sets may have been logged in a minute).
const durMin = (s) => Math.max(s.duracionMin || 0, s.reloj?.fin > s.reloj?.inicio ? Math.round((s.reloj.fin - s.reloj.inicio) / 60000) : 0) || null;
// A session's name as the history shows it: the app's own workouts in the chosen language, the watch's with its title.
const nombreSesion = (s) => (s.rutina ? (rutinaFlex(s.rutina) || gym(s.rutina) ? titulo(s.rutina) : s.nombre || s.rutina) : s.nombre || "");
function lineaReloj(s) {
  const r = s.reloj;
  const partes = [`⌚ ${hora(r.inicio)}–${hora(r.fin)}`];
  if (partesDe(r).length > 1) partes.push(tn(partesDe(r).length, "{n} entreno del reloj", "{n} entrenos del reloj"));
  if (r.fcMedia) partes.push(t("FC {v} ppm", { v: `${r.fcMedia}${r.fcMax ? `/${r.fcMax}` : ""}` }));
  if (r.kcal) partes.push(`${r.kcal} kcal`);
  return partes.join(" · ") + (s.origen === "reloj" ? `. ${t("Apunta las series y se unirán.")}` : "");
}
function renderHistorial() {
  $("vacio").hidden = sesiones.length > 0;
  $("lista").innerHTML = html`${sesiones.map((s) => {
    const nombre = nombreSesion(s);
    const hechos = Array.isArray(s.ejercicios) && s.tipo === "flexibilidad" ? s.ejercicios.filter((x) => x.hecho).length : null;
    const series = s.tipo === "gimnasio" && Array.isArray(s.ejercicios) ? s.ejercicios.flatMap((x) => x.series || []).filter((x) => x.hecho).length : null;
    return html`<li>
    <button type="button" class="txt" data-ver="${s.id}" aria-label="${t("Ver la sesión: {n}, {f}", { n: nombre || t(s.tipo === "gimnasio" ? "Gimnasio" : "Flexibilidad"), f: s.fecha ? fechaLarga(s.fecha) : t("sin fecha") })}">
      <span class="tipo ${s.tipo === "gimnasio" ? "gimnasio" : ""}">${t(s.tipo === "gimnasio" ? "Gimnasio" : "Flexibilidad")}${s.rutina ? ` · ${s.rutina.toUpperCase()}` : ""}${s.origen === "reloj" ? ` · ${t("Solo en el reloj")}` : ""}</span>
      ${nombre ? html`<span class="l">${nombre}</span>` : ""}
      <span class="l"><b>${s.fecha ? fechaLarga(s.fecha) : t("Sin fecha")}</b>${durMin(s) ? ` · ${durMin(s)} min` : ""}${hechos != null ? ` · ${hechos}/${s.ejercicios.length} ${t("ejercicios")}` : ""}${series ? ` · ${tn(series, "{n} serie", "{n} series")}` : ""}${s.volumenKg ? ` · ${num(s.volumenKg)} kg` : ""}${cardioDe(s).length ? ` · ${t("cardio {n} min", { n: num(cardioMin(cardioDe(s))) })}` : ""}</span>
      ${s.reloj ? html`<span class="l reloj">${lineaReloj(s)}</span>` : ""}
      ${s.notas ? html`<span class="l sub">${s.notas}</span>` : ""}
    </button>
    <button type="button" class="del" data-del="${s.id}" aria-label="${t("Borrar la sesión del {f}", { f: s.fecha || "" })}">${t("Borrar")}</button>
  </li>`;
  })}`;
}
$("lista").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (id) { await store.remove("sesiones", id); return; }
  const ver = e.target.closest("[data-ver]")?.dataset.ver;
  if (ver) verSesion(ver);
});

/* ---------- One session of the history (tap it in Historial) ---------- */
let sesionVista = null;
const kgTxt = (kg) => `${num(kg)} kg`;
// A saved gym exercise's definition (muscles, per side, timed): from the session's workout, else any workout's.
const defGym = (rutina, n) => gym(rutina)?.ej.find((e) => e.n === n) || GYM.flatMap((w) => w.ej).find((e) => e.n === n) || null;
const volSeries = (series, def, fecha) => { const peso = pesoEn(fecha); return (series || []).reduce((a, x) => a + (x?.hecho && x.reps > 0 ? carga(x.kg, def, peso) * x.reps * (def?.porLado ? 2 : 1) : 0), 0); };
const cuando = (x) => `${x.fecha || ""}|${String(x.inicio || 0).padStart(15, "0")}`;
// The best set of an exercise in each gym session (heaviest kg; reps or time when it's bodyweight), oldest first,
// up to and including session `s`: the exercise's progression.
function progresion(s, n) {
  const pts = [];
  for (const x of [...sesiones].filter((x) => x.tipo === "gimnasio" && cuando(x) <= cuando(s)).sort((a, b) => cuando(a).localeCompare(cuando(b)))) {
    const hechas = (x.ejercicios || []).filter((e) => e?.n === n).flatMap((e) => e.series || []).filter((y) => y?.hecho);
    if (!hechas.length) continue;
    const kgs = hechas.map((y) => Number(y.kg)).filter((v) => Number.isFinite(v) && v !== 0);
    const kg = kgs.length ? Math.max(...kgs) : 0;
    const reps = Math.max(...hechas.map((y) => Number(y.reps ?? y.seg) || 0));
    pts.push({ id: x.id, fecha: x.fecha, kg, reps });
  }
  // By weight when there's any (negative is assistance on the machine: less of it is progress), else reps or time.
  const porKg = pts.some((p) => p.kg !== 0);
  return { pts: pts.slice(-8).map((p) => ({ ...p, v: porKg ? p.kg : p.reps })), porKg };
}
const fechaCorta = (f) => (f ? parse(f).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "");
function grafProgresion(s, n, seg) {
  const { pts, porKg } = progresion(s, n);
  if (pts.length < 2) return "";
  const vs = pts.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
  const W = 240, H = 64, x = (i) => 16 + (i * (W - 32)) / (pts.length - 1), y = (v) => (hi === lo ? 34 : 52 - ((v - lo) / (hi - lo)) * 32);
  const fmt = (v) => (porKg ? kgTxt(v) : seg ? mmss(v) : t("{n} reps", { n: v }));
  const ult = pts.length - 1;
  const dif = vs[ult] - vs[0];
  return html`<div class="prog"><span class="sub">${t(porKg ? "Peso máximo, últimas {n} veces" : seg ? "Mejor tiempo, últimas {n} veces" : "Más reps, últimas {n} veces", { n: pts.length })}${dif ? ` · ${dif > 0 ? "+" : "−"}${fmt(Math.abs(dif))}` : ` · ${t("igual")}`}</span>
    <svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Progresión de {x}: {l}", { x: t(n), l: pts.map((p) => `${fechaCorta(p.fecha)} ${fmt(p.v)}`).join(", ") })}">
      <line x1="16" x2="${W - 16}" y1="${H - 4}" y2="${H - 4}" stroke="var(--app-line)" stroke-width=".8"/>
      <polyline points="${pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")}" fill="none" stroke="var(--prim)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => html`<circle cx="${x(i)}" cy="${y(p.v)}" r="${p.id === s.id ? 4.5 : 3}" fill="${p.id === s.id ? "var(--prim)" : "var(--card)"}" stroke="var(--prim)" stroke-width="2"><title>${`${fechaCorta(p.fecha)} · ${fmt(p.v)}`}</title></circle>`)}
      <text x="${x(0)}" y="${y(vs[0]) - 7}" text-anchor="start">${fmt(vs[0])}</text>
      <text x="${x(ult)}" y="${y(vs[ult]) - 7}" text-anchor="end" style="fill:var(--fg);font-weight:600">${fmt(vs[ult])}</text>
    </svg></div>`;
}
// The watch's heart rate over the workout: one point per `curvaPaso` seconds, with the average as a dashed line.
function grafFc(r) {
  const c = (r?.curva || []).map((v, i) => [i, v]).filter(([, v]) => v > 0);
  if (c.length < 2) return "";
  const paso = r.curvaPaso || 60, total = (r.curva.length * paso) / 60;
  const vs = c.map(([, v]) => v), lo = Math.floor((Math.min(...vs) - 5) / 10) * 10, hi = Math.ceil((Math.max(...vs) + 5) / 10) * 10;
  const W = 300, H = 132, L = 30, R = 8, T = 10, B = 20;
  const x = (i) => L + ((i + 0.5) * paso / 60 / total) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid = [lo, Math.round((lo + hi) / 20) * 10, hi];
  const pts = c.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const iMax = c.reduce((m, p) => (p[1] > m[1] ? p : m), c[0]);
  const media = r.fcMedia || Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
  const marcas = [0, Math.round(total / 2), Math.round(total)];
  return html`<div class="hd"><h3>${t("Frecuencia cardiaca")}</h3><span class="sub">${t("ppm · del reloj")}</span></div>
    <svg class="grafica fc-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Frecuencia cardiaca: media {m}, máxima {x} ppm", { m: media, x: r.fcMax || iMax[1] })}" data-lo="${lo}" data-hi="${hi}">
      <defs><linearGradient id="fcArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--heat3)" stop-opacity=".35"/><stop offset="1" stop-color="var(--heat3)" stop-opacity="0"/></linearGradient></defs>
      ${grid.map((v) => html`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--app-line)" stroke-width=".6"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`)}
      ${marcas.map((m) => html`<text x="${L + (m / total) * (W - L - R)}" y="${H - 6}" text-anchor="${m === 0 ? "start" : m === marcas[2] ? "end" : "middle"}">${m} min</text>`)}
      <polygon points="${`${x(c[0][0]).toFixed(1)},${y(lo)} ${pts.join(" ")} ${x(c.at(-1)[0]).toFixed(1)},${y(lo)}`}" fill="url(#fcArea)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--heat3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="${L}" x2="${W - R}" y1="${y(media)}" y2="${y(media)}" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>
      <text x="${W - R}" y="${y(media) - 4}" text-anchor="end" style="fill:var(--fg)">${t("media {n}", { n: media })}</text>
      <circle cx="${x(iMax[0])}" cy="${y(iMax[1])}" r="4" fill="var(--heat3)" stroke="var(--card)" stroke-width="2"/>
      <text x="${x(iMax[0])}" y="${y(iMax[1]) - 7}" text-anchor="middle" style="fill:var(--fg);font-weight:600">${t("máx {n}", { n: iMax[1] })}</text>
      <g class="fc-cursor" visibility="hidden"><line y1="${T}" y2="${H - B}" stroke="var(--fg)" stroke-width=".8"/><circle r="4" fill="var(--heat3)" stroke="var(--fg)" stroke-width="1.5"/><text text-anchor="middle" style="fill:var(--fg);font-weight:600"></text></g>
      <rect class="fc-toque" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
    </svg>`;
}
// Touch or hover the heart-rate chart: a cursor shows the value at that minute.
function cursorFc(e) {
  const svg = e.target.closest?.(".fc-graf");
  if (!svg) return;
  const r = sesiones.find((x) => x.id === sesionVista)?.reloj;
  const c = r?.curva || [];
  const box = svg.getBoundingClientRect();
  const W = 300, H = 132, L = 30, R = 8, T = 10, B = 20, paso = r?.curvaPaso || 60, total = (c.length * paso) / 60;
  const px = ((e.clientX - box.left) / box.width) * W;
  let i = Math.round(((px - L) / (W - L - R)) * total * 60 / paso - 0.5);
  i = Math.max(0, Math.min(c.length - 1, i));
  // The nearest minute with a reading.
  for (let d = 0; d < c.length && !(c[i] > 0); d++) { if (c[i + d] > 0) i += d; else if (c[i - d] > 0) i -= d; }
  const v = c[i];
  const g = svg.querySelector(".fc-cursor");
  if (!(v > 0)) { g.setAttribute("visibility", "hidden"); return; }
  const lo = Number(svg.dataset.lo), hi = Number(svg.dataset.hi);
  const cx = L + ((i + 0.5) * paso / 60 / total) * (W - L - R), cy = T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  g.querySelector("line").setAttribute("x1", cx);
  g.querySelector("line").setAttribute("x2", cx);
  g.querySelector("circle").setAttribute("cx", cx);
  g.querySelector("circle").setAttribute("cy", cy);
  const txt = g.querySelector("text");
  txt.setAttribute("x", Math.max(L + 30, Math.min(W - R - 30, cx)));
  txt.setAttribute("y", Math.max(T + 8, cy - 9));
  txt.textContent = `${t("{n} ppm", { n: v })} · ${mmss((i * paso))}`;
  g.setAttribute("visibility", "visible");
}
$("sesFc").addEventListener("pointermove", cursorFc);
$("sesFc").addEventListener("pointerdown", cursorFc);
$("sesFc").addEventListener("pointerleave", () => $("sesFc").querySelector(".fc-cursor")?.setAttribute("visibility", "hidden"));

function verSesion(id) {
  sesionVista = id;
  for (const t of [...TABS, "detalle"]) $(t).hidden = true;
  $("sesion").hidden = false;
  pantalla = "sesion";
  renderSesion();
  window.scrollTo(0, 0);
}
function renderSesion() {
  const s = sesiones.find((x) => x.id === sesionVista);
  if (!s) { if (pantalla === "sesion") show("historial"); return; }
  const g = s.tipo === "gimnasio", r = s.reloj;
  $("sesion").classList.toggle("flex", !g);
  $("sesTipo").textContent = `${t(g ? "Gimnasio" : "Flexibilidad")}${s.rutina ? ` · ${s.rutina.toUpperCase()}` : ""}${s.origen === "reloj" ? ` · ${t("Solo en el reloj")}` : ""}`;
  // The app's own workouts show their name in the chosen language; the watch's keep its title.
  $("sesTitle").textContent = s.rutina ? (rutinaFlex(s.rutina) || gym(s.rutina) ? titulo(s.rutina) : s.nombre || s.rutina) : r?.titulo || t(g ? "Gimnasio" : "Flexibilidad");
  const ini = Math.min(...[s.inicio, r?.inicio].filter(Boolean)), fin = Math.max(...[s.fin, r?.fin].filter(Boolean));
  $("sesSub").textContent = `${s.fecha ? fechaLarga(s.fecha) : t("Sin fecha")}${ini > 0 && fin > ini ? ` · ${hora(ini)}–${hora(fin)}` : ""}`;
  const min = durMin(s);
  const ejs = Array.isArray(s.ejercicios) ? s.ejercicios : [];
  const esf = s.esfuerzo ? stat(s.esfuerzo, t("Esfuerzo"), "/10") : "";
  const reloj = r ? html`${stat(r.fcMedia || "—", t("FC media"), r.fcMedia ? t("ppm") : "")}${stat(r.fcMax || "—", t("FC máxima"), r.fcMax ? t("ppm") : "")}${stat(r.kcal || "—", t("Calorías"), r.kcal ? "kcal" : "")}` : "";
  let man = "", lista;
  const vol = [];
  if (g) {
    const p = {}, sec = {};
    let hechas = 0;
    for (const e of ejs) {
      const def = defGym(s.rutina, e?.n);
      const n = (e?.series || []).filter((x) => x?.hecho).length;
      hechas += n;
      if (def && n) { for (const m of def.p) p[m] = (p[m] || 0) + n; for (const m of def.s) sec[m] = (sec[m] || 0) + n; }
      const v = volSeries(e?.series, def, s.fecha);
      if (v > 0) vol.push([e.n, v]);
    }
    if (hechas) man = html`${maniqui({ p, s: sec }, "f", { titulo: t("Músculos trabajados"), etiquetas: etiquetasTop(p, 4, (v) => tn(v, "{n} serie", "{n} series")) })}
      <div class="leyenda"><span><i style="background:var(--prim)"></i>${t("Principales")}</span><span><i style="background:var(--sec)"></i>${t("Secundarios")}</span></div>`;
    // From the sets (with your weight for bodyweight exercises, when known); a session logged by hand keeps its own.
    const volTotal = ejs.length ? Math.round(vol.reduce((a, [, v]) => a + v, 0)) : s.volumenKg ?? 0;
    const cmin = cardioMin(cardioDe(s));
    $("sesStats").innerHTML = html`${stat(hechas, t("Series"))}${stat(num(volTotal), t("Volumen"), "kg")}${stat(min || "—", t("Duración"), min ? "min" : "")}${cmin ? stat(num(cmin), t("Cardio"), "min") : ""}${esf}${reloj}`;
    const vistos = {};
    const recs = Object.fromEntries(records(s).map((x) => [x.n, x]));
    lista = ejs.filter((e) => e?.n).map((e) => {
      const def = defGym(s.rutina, e.n), fig = FIG_FUERZA[e.n];
      const series = e.series || [];
      const n = series.filter((x) => x?.hecho).length;
      const v = volSeries(series, def, s.fecha);
      // The chart once per exercise, under its first row (a side plank per side shares it).
      const primera = !vistos[e.n];
      const graf = primera ? grafProgresion(s, e.n, !!def?.seg) : "";
      vistos[e.n] = true;
      const rec = primera && recs[e.n];
      return html`<li class="ej g ses">${fig ? html`<span class="th">${figura(fig)}</span>` : ""}<div class="meta">
        <span class="name">${t(e.n)}${def?.lado ? lado(def) : ""}</span>
        ${rec ? html`<span class="chip ok rec">${t("Récord")} · ${t(rec.t)} ${rec.v}</span>` : ""}
        <span class="dosis">${t("{n}/{total} series", { n, total: series.length })}${v ? ` · ${num(Math.round(v))} kg` : ""}${def?.porLado ? ` · ${t("por lado")}` : ""}</span>
        <span class="series">${series.map((x, i) => html`<span class="${`serie${x?.hecho ? " ok" : ""}`}"><i>${i + 1}</i>${x?.kg != null && x.kg !== "" ? kgTxt(x.kg) : t("PC")} × ${x?.seg != null ? mmss(x.seg) : x?.reps ?? "—"}</span>`)}</span>
        ${graf}</div></li>`;
    });
  } else {
    const musc = {};
    let seg = 0, hechos = 0;
    for (const [i, e] of ejs.entries()) {
      if (!e?.hecho || !EX[e.id]) continue;
      hechos++;
      const sg = pasos([e.id, e.dosis || ""], i).reduce((a, p) => a + p.seg, 0);
      seg += sg;
      for (const m of EX[e.id].p) musc[m] = (musc[m] || 0) + sg / 60;
      for (const m of EX[e.id].s) musc[m] = (musc[m] || 0) + sg / 120;
    }
    if (hechos) man = html`${maniqui(musc, "x", { titulo: t("Músculos estirados"), etiquetas: etiquetasTop(musc, 4, fmtMin) })}
      <div class="leyenda"><span><i style="background:var(--flex1)"></i>&lt; 1 min</span><span><i style="background:var(--flex2)"></i>1–3 min</span><span><i style="background:var(--flex3)"></i>3+ min</span></div>`;
    $("sesStats").innerHTML = html`${ejs.length ? stat(`${hechos}/${ejs.length}`, t("Ejercicios")) : ""}${ejs.length ? stat(Math.round(seg / 60), t("Estirando"), "min") : ""}${stat(min || "—", t("Duración"), min ? "min" : "")}${esf}${reloj}`;
    lista = ejs.filter((e) => EX[e?.id]).map((e) => html`<li class="${`ej ses${e.hecho ? "" : " saltado"}`}"><span class="th">${figura(e.id)}</span><div class="meta">
      <span class="name">${t(EX[e.id].n)}</span><span class="dosis">${tDosis(e.dosis || "")}</span><span class="zona">${t(e.hecho ? "Hecho ✓" : "Saltado")}</span></div></li>`);
  }
  $("sesMan").innerHTML = html`${man}`;
  $("sesMan").hidden = !man;
  // Cardio before the weights first, then after.
  const cs = cardioDe(s).map((c, i) => [c, i]).sort(([a, i], [b, j]) => (a.momento === "antes" ? 0 : 1) - (b.momento === "antes" ? 0 : 1) || i - j).map(([c]) => c);
  $("sesCardio").innerHTML = html`${cs.length ? html`<div class="hd"><h3>${t("Cardio")}</h3><span class="sub">${t("{n} min", { n: num(cardioMin(cs)) })}</span></div>
    <ul class="cardio-lista">${cs.map((c) => html`<li><span class="n">${t(maquina(c.tipo).n)}</span><span class="sub">${t(c.momento === "antes" ? "Antes de la fuerza" : "Después de la fuerza")} · ${lineaCardio(c)}</span></li>`)}</ul>` : ""}`;
  $("sesCardio").hidden = !cs.length;
  $("sesFc").innerHTML = html`${grafFc(r)}`;
  $("sesFc").hidden = !$("sesFc").innerHTML;
  vol.sort((a, b) => b[1] - a[1]);
  const maxVol = vol[0]?.[1] || 1;
  $("sesVol").innerHTML = html`${vol.length > 1 ? html`<div class="hd"><h3>${t("Volumen por ejercicio")}</h3><span class="sub">${t("kg × reps")}</span></div>
    <ul class="barras">${vol.map(([n, v]) => html`<li><span class="n">${t(n)}</span><span class="v num">${num(Math.round(v))} kg</span><span class="b"><i style="${`width:${Math.max(2, (v / maxVol) * 100).toFixed(1)}%`}"></i></span></li>`)}</ul>` : ""}`;
  $("sesVol").hidden = vol.length < 2;
  $("sesLista").innerHTML = html`${lista}`;
  $("sesNotas").innerHTML = html`${s.notas ? html`<h3>${t("Notas")}</h3><p>${s.notas}</p>` : ""}`;
  $("sesNotas").hidden = !s.notas;
  renderUnirReloj(s);
  $("sesNota").textContent = t(s.origen === "reloj" ? "Solo en el reloj: apunta las series de este entreno y se unirán a estos datos."
    : !ejs.length ? "Sesión apuntada a mano, sin ejercicios."
      : r && !r.curva && hc ? "La gráfica del pulso aparecerá en la próxima lectura de Health Connect."
        : !r && hc && estadoSalud.permiso ? "Sin datos del reloj para esta sesión." : "");
  animar($("sesion"));
}
$("sesVolver").addEventListener("click", () => show("historial"));

// Joining by hand: a watch-only workout to a session of the app (the same day or the next/previous one, closest
// first), and separating a watch workout from a session (it goes back on its own and won't join it again).
function renderUnirReloj(s) {
  const box = $("sesReloj");
  if (s.origen === "reloj") {
    const dia = (f) => Date.parse(`${f}T12:00:00`);
    const cerca = sesiones.filter((x) => x.origen !== "reloj" && x.fecha && s.fecha && Math.abs(dia(x.fecha) - dia(s.fecha)) <= 864e5)
      .sort((a, b) => (a.tipo === s.tipo ? 0 : 1) - (b.tipo === s.tipo ? 0 : 1)
        || Math.abs((a.inicio || dia(a.fecha)) - s.reloj.inicio) - Math.abs((b.inicio || dia(b.fecha)) - s.reloj.inicio)).slice(0, 6);
    box.innerHTML = html`<h3>${t("Unir a una sesión")}</h3>
      <p class="sub">${t(cerca.length ? "¿Apuntaste las series de este entreno en la app? Únelo a esa sesión." : "No hay sesiones apuntadas cerca de este día para unir.")}</p>
      ${cerca.map((x) => html`<button type="button" class="btn unir" data-unir="${x.id}">${nombreSesion(x) || t(x.tipo === "gimnasio" ? "Gimnasio" : "Flexibilidad")} · ${fechaCorta(x.fecha)}${x.inicio ? ` ${hora(x.inicio)}` : ""}</button>`)}`;
  } else if (s.reloj?.id) {
    box.innerHTML = html`<h3>${t("Entrenos del reloj")}</h3>
      <p class="sub">${t("Si uno no es de esta sesión, sepáralo: volverá al historial por su cuenta.")}</p>
      <ul class="partes">${partesDe(s.reloj).map((p) => html`<li><span>⌚ ${hora(p.inicio)}–${hora(p.fin)}${p.titulo ? ` · ${p.titulo}` : ""}</span>
        <button type="button" class="del" data-separar="${p.id}">${t("Separar")}</button></li>`)}</ul>`;
  } else box.innerHTML = "";
  box.hidden = !box.innerHTML;
}
$("sesReloj").addEventListener("click", async (e) => {
  const s = sesiones.find((x) => x.id === sesionVista);
  const unir = e.target.closest("[data-unir]")?.dataset.unir, wid = e.target.closest("[data-separar]")?.dataset.separar;
  const destino = unir && sesiones.find((x) => x.id === unir);
  if (s && destino) {
    await store.put("sesiones", destino.id, unirA(destino, s));
    await store.remove("sesiones", s.id);
    verSesion(destino.id);
  } else if (s && wid) {
    const r = separar(s, wid);
    if (!r) return;
    await store.put("sesiones", s.id, r.sesion);
    await store.put("sesiones", ...r.suelta);
  }
});

/* ---------- Editing a session of the history ---------- */
// A copy of the session's exercises is edited here and written only on Guardar, on top of the record as it is then
// (the watch may have refreshed it meanwhile). Records, progression, last time's weights and the week's sets are all
// worked out from the saved sets, so they follow the edit; the volume is summed again. The watch data stays as it is.
let edicion = null; // { id, gym, ejercicios: [{ n, series: [{ kg, n, hecho }] }] | [{ id, dosis, hecho }] }
const ejerciciosGym = (rutina) => [...new Set([...(gym(rutina)?.ej || []), ...GYM.flatMap((w) => w.ej)].map((e) => e.n))];
function abrirEdicion() {
  const s = sesiones.find((x) => x.id === sesionVista);
  if (!s) return;
  const g = s.tipo === "gimnasio";
  const ejs = Array.isArray(s.ejercicios) ? s.ejercicios : [];
  edicion = { id: s.id, gym: g, rutina: s.rutina,
    ejercicios: g ? ejs.filter((e) => e?.n).map((e) => ({ n: e.n, series: (e.series || []).map((x) => ({ kg: x?.kg ?? null, n: x?.seg ?? x?.reps ?? null, hecho: !!x?.hecho })) }))
      // Every stretch is kept, the ones this app no longer knows too (only the known ones are shown).
      : ejs.map((e) => (e && typeof e === "object" ? { ...e, hecho: !!e.hecho } : e)), cardio: g ? cardioDe(s).map((c) => ({ ...c })) : null };
  $("edFecha").textContent = `${s.fecha ? fechaLarga(s.fecha) : t("Sin fecha")} · ${$("sesTitle").textContent}`;
  $("edMin").value = s.duracionMin ?? "";
  $("edNotas").value = s.notas || "";
  $("edAnadirBox").hidden = !g;
  $("edCardioBox").hidden = !g;
  renderEdCardio();
  $("editar").hidden = false;
  document.body.classList.add("en-sesion");
  renderEdicion();
  $("editar").scrollTo(0, 0);
}
function cerrarEdicion() {
  edicion = null;
  cerrarCardio();
  $("editar").hidden = true;
  $("edLista").innerHTML = "";
  document.body.classList.remove("en-sesion");
}
function renderEdicion() {
  const ed = edicion;
  const nombres = ejerciciosGym(ed.rutina);
  if (!ed.gym) {
    $("edLista").innerHTML = html`${ed.ejercicios.map((e, i) => (!EX[e?.id] ? "" : html`<li class="${`ej ses${e.hecho ? "" : " saltado"}`}"><span class="th">${figura(e.id)}</span><div class="meta">
      <span class="name">${t(EX[e.id].n)}</span><span class="dosis">${tDosis(e.dosis || "")}</span>
      <button type="button" class="btn ed-hecho" data-hecho="${i}" aria-pressed="${String(e.hecho)}">${t(e.hecho ? "Hecho ✓" : "Saltado")}</button></div></li>`))}`;
    animar($("edLista"));
    return;
  }
  const opciones = (actual) => html`${[...new Set([actual, ...nombres])].map((n) => html`<option value="${n}" ${n === actual ? "selected" : ""}>${t(n)}</option>`)}`;
  $("edLista").innerHTML = html`${ed.ejercicios.map((e, ei) => {
    const def = defGym(ed.rutina, e.n);
    return html`<li class="card ed-ej" data-e="${ei}">
      <div class="ed-cab"><select data-cambiar="${ei}" aria-label="${t("Ejercicio {i}", { i: ei + 1 })}">${opciones(e.n)}</select>
        <button type="button" class="del" data-quitar="${ei}" aria-label="${t("Quitar {x}", { x: t(e.n) })}">${t("Quitar")}</button></div>
      ${e.series.length ? html`<table class="sets"><thead><tr><th>${t("SERIE")}</th><th>${t("KG")}</th><th>${t(def?.seg ? "SEG" : def?.porLado ? "REPS/LADO" : "REPS")}</th><th><span class="sr">${t("Hecha")}</span>✓</th><th><span class="sr">${t("Quitar")}</span></th></tr></thead>
      <tbody>${e.series.map((x, si) => html`<tr data-k="${`${ei}-${si}`}" class="${x.hecho ? "done" : ""}"><td class="num">${si + 1}</td>
        <td><input type="number" step="0.5" data-c="kg" value="${x.kg ?? ""}" placeholder="—" aria-label="${t("Kg, serie {n}", { n: si + 1 })}"></td>
        <td><input type="number" inputmode="numeric" min="0" data-c="n" value="${x.n ?? ""}" aria-label="${t(def?.seg ? "Segundos, serie {n}" : "Repeticiones, serie {n}", { n: si + 1 })}"></td>
        <td><button type="button" class="ck" data-ck="${`${ei}-${si}`}" aria-pressed="${String(x.hecho)}" aria-label="${t("Serie {n} hecha", { n: si + 1 })}">✓</button></td>
        <td><button type="button" class="ck quita" data-quita="${`${ei}-${si}`}" aria-label="${t("Quitar la serie {n}", { n: si + 1 })}">✕</button></td></tr>`)}</tbody></table>` : ""}
      <button type="button" class="btn ghost" data-serie="${ei}">${t("+ Añadir una serie")}</button></li>`;
  })}`;
  $("edAnadir").innerHTML = html`<option value="">${t("Elige un ejercicio…")}</option>${nombres.map((n) => html`<option value="${n}">${t(n)}</option>`)}`;
}
// The session's cardio, changed with the same form as in the logger; written with the rest on Guardar.
function renderEdCardio() {
  const c = edicion?.cardio;
  $("edCardio").innerHTML = html`${c ? html`${listaCardio(c)}<button type="button" class="add" data-cardio-add>${t("+ Añadir cardio")}</button>` : ""}`;
}
$("edCardio").addEventListener("click", (e) => accionCardio(e, edicion?.cardio, "despues", (lista) => {
  if (!edicion?.gym) return;
  edicion.cardio = lista;
  renderEdCardio();
}));
const celda = (k) => { const [ei, si] = k.split("-").map(Number); return edicion?.ejercicios[ei]?.series[si]; };
$("edLista").addEventListener("input", (e) => {
  const i = e.target.closest("input[data-c]"), x = celda(i?.closest("tr")?.dataset.k || "");
  if (!x) return;
  const v = Number(String(i.value).replace(",", "."));
  x[i.dataset.c] = i.value === "" || !Number.isFinite(v) ? null : v;
});
$("edLista").addEventListener("change", (e) => {
  const sel = e.target.closest("[data-cambiar]");
  if (!sel || !edicion) return;
  // Another exercise in its place: the sets stay, with their kg and reps (or seconds).
  edicion.ejercicios[Number(sel.dataset.cambiar)].n = sel.value;
  renderEdicion();
});
$("edLista").addEventListener("click", (e) => {
  const ed = edicion;
  if (!ed) return;
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.hecho != null) { const x = ed.ejercicios[Number(d.hecho)]; x.hecho = !x.hecho; }
  else if (d.ck) { const x = celda(d.ck); x.hecho = !x.hecho; }
  else if (d.quita) { const [ei, si] = d.quita.split("-").map(Number); ed.ejercicios[ei].series.splice(si, 1); }
  else if (d.quitar != null) ed.ejercicios.splice(Number(d.quitar), 1);
  else if (d.serie != null) {
    // A new set like the last one (done), or the exercise's dose when it has none yet.
    const ej = ed.ejercicios[Number(d.serie)], def = defGym(ed.rutina, ej.n), u = ej.series.at(-1);
    ej.series.push(u ? { kg: u.kg, n: u.n, hecho: true } : { kg: def?.kg ?? null, n: def?.seg || def?.reps || null, hecho: true });
  } else return;
  renderEdicion();
});
$("edAnadir").addEventListener("change", () => {
  const n = $("edAnadir").value;
  if (!n || !edicion) return;
  const def = defGym(edicion.rutina, n);
  edicion.ejercicios.push({ n, series: [{ kg: def?.kg ?? null, n: def?.seg || def?.reps || null, hecho: true }] });
  renderEdicion();
  $("edLista").lastElementChild?.scrollIntoView({ block: "nearest" });
});
async function guardarEdicion() {
  const ed = edicion, s = sesiones.find((x) => x.id === ed?.id);
  if (!s) { cerrarEdicion(); return; }
  const { id, _actualizado, ...d } = s; // eslint-disable-line no-unused-vars
  const min = Number($("edMin").value);
  if ($("edMin").value !== "" && Number.isFinite(min) && min > 0) d.duracionMin = Math.round(min); else delete d.duracionMin;
  d.notas = $("edNotas").value.trim();
  if (ed.gym) {
    d.ejercicios = ed.ejercicios.filter((e) => e.series.length).map((e) => {
      const seg = !!defGym(ed.rutina, e.n)?.seg;
      return { n: e.n, series: e.series.map((x) => ({ kg: x.kg, [seg ? "seg" : "reps"]: x.n, hecho: x.hecho })) };
    });
    if (d.ejercicios.length || Array.isArray(s.ejercicios)) {
      d.volumenKg = Math.round(d.ejercicios.reduce((a, e) => a + volSeries(e.series, defGym(ed.rutina, e.n), d.fecha), 0));
    }
    // A watch-only workout with sets written in becomes a session of its own, keeping its watch data (a session
    // logged later no longer takes it).
    if (d.origen === "reloj" && d.ejercicios.length) delete d.origen;
    if (!d.ejercicios.length && !Array.isArray(s.ejercicios)) delete d.ejercicios;
    if (ed.cardio.length) d.cardio = ed.cardio; else delete d.cardio;
  } else if (Array.isArray(s.ejercicios)) d.ejercicios = ed.ejercicios;
  cerrarEdicion();
  await store.put("sesiones", ed.id, d);
}
$("sesEditar").addEventListener("click", abrirEdicion);
$("edSalir").addEventListener("click", cerrarEdicion);
$("edCancelar").addEventListener("click", cerrarEdicion);
$("edGuardar").addEventListener("click", guardarEdicion);

/* ---------- Perfil ---------- */
function renderPeso() {
  const u = pesos.at(-1);
  $("pesoEstado").textContent = u ? t("{kg} · {f} · {o}", { kg: kgTxt(u.kg), f: fechaCorta(u.fecha), o: t(u.origen === "mano" ? "apuntado a mano" : "de Health Connect") }) : t("Sin peso todavía.");
  $("pesoPermiso").hidden = !(hc && estadoSalud.disponible && estadoSalud.permiso && estadoSalud.peso === false);
}
$("pesoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kg = Number(String($("pesoKg").value).replace(",", "."));
  if (!(kg >= 20 && kg <= 400)) { $("pesoEstado").textContent = t("Escribe tu peso en kg, entre 20 y 400."); return; }
  const hoy = iso(new Date());
  const lista = [...pesos.filter((p) => p.fecha !== hoy), { fecha: hoy, kg: Math.round(kg * 10) / 10, origen: "mano" }];
  await store.put("ajustes", "peso", { pesos: unirPesos(lista, []) });
  $("pesoKg").value = "";
});
$("pesoPermiso").addEventListener("click", async () => {
  try { estadoSalud = { ...estadoSalud, ...(await hc.pedirPermiso()) }; } catch (e) { /* refused */ }
  renderPeso();
  renderReloj();
  if (estadoSalud.peso) await leerReloj({ forzar: true });
});
function renderPerfil() {
  renderPeso();
  if (document.activeElement !== $("planInicio")) $("planInicio").value = inicioPlan || "";
  const ep = enPlan(inicioPlan, iso(new Date()));
  $("planEstado").textContent = !inicioPlan ? t("Empieza con tu primera sesión de flexibilidad, o elige la fecha aquí.")
    : ep.antes ? t("El plan aún no ha empezado.") : ep.despues ? t("Plan completado: sigue con la fase 6 como mantenimiento.")
      : t("Semana {s} de 26 · Fase {n}, {nombre}.", { s: ep.semana, n: ep.fase.n, nombre: t(ep.fase.name) });
}
$("planInicio").addEventListener("change", async (e) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) await store.put("ajustes", "plan-flexibilidad", { plan: "flexibilidad-6m-v1", inicio: e.target.value });
});
$("planCard").addEventListener("submit", (e) => e.preventDefault());

// The app's language (i18n.js reads it on load): this device only. Changing it reloads the page, back on Perfil.
$("idioma").innerHTML = html`${IDIOMAS.map(([c, n]) => html`<option value="${c}" lang="${c}">${n}</option>`)}`;
$("idioma").value = idioma;
$("idioma").addEventListener("change", (e) => {
  ajustes.idioma = e.target.value;
  ajustes.tab = "perfil";
  saveAjustes();
  location.reload();
});
$("idiomaCard").addEventListener("submit", (e) => e.preventDefault());

/* ---------- Reloj (Health Connect) ---------- */
// Only in the Android app: the watch's workouts, heart rate and calories (reloj.js joins them to the sessions).
const hc = native ? window.Capacitor.registerPlugin("Salud") : null;
let estadoSalud = { disponible: false, permiso: false };
let leyendo = null;
let ultimaLectura = 0;
async function comprobarSalud() {
  if (!hc) return;
  try { estadoSalud = { ...estadoSalud, ...(await hc.estado()) }; } catch (e) { estadoSalud = { disponible: false, permiso: false }; }
  renderReloj();
  renderPeso();
}
function leerReloj({ forzar = false } = {}) {
  if (!hc || !estadoSalud.permiso) return Promise.resolve(null);
  // A forced read (after a session) mustn't be lost to one already running from before it was saved.
  if (leyendo) return forzar ? leyendo.then(() => leerReloj({ forzar })) : leyendo;
  if (!forzar && Date.now() - ultimaLectura < 60000) return Promise.resolve(null);
  ultimaLectura = Date.now();
  leyendo = importarReloj(hc, store, { enCurso: !!sesion || !!leerEnCurso() })
    .then(async (r) => { if (estadoSalud.peso) await importarPeso(hc, store); renderReloj(r); return r; })
    .finally(() => (leyendo = null));
  return leyendo;
}
async function renderReloj(r) {
  $("relojCard").hidden = !hc;
  if (!hc) return;
  const st = $("relojEstado"), btn = $("relojBoton");
  st.classList.toggle("error", !!r?.error || !estadoSalud.disponible);
  btn.hidden = !estadoSalud.disponible;
  btn.textContent = t(estadoSalud.permiso ? "Leer ahora" : "Conectar Health Connect");
  if (!estadoSalud.disponible) { st.textContent = t("Health Connect no está disponible en este teléfono (hace falta Android 14 o posterior)."); return; }
  if (!estadoSalud.permiso) { st.textContent = t("Sin permiso todavía: pulsa el botón y permite leer ejercicio, frecuencia cardiaca y calorías."); return; }
  if (r?.error) { st.textContent = r.error; return; }
  const ult = await store.getMeta("relojLectura");
  const n = r || { unidas: sesiones.filter((s) => s.origen !== "reloj" && s.reloj).length, sueltas: sesiones.filter((s) => s.origen === "reloj").length };
  st.textContent = `${ult ? `${t("Última lectura: {f}.", { f: new Date(ult).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) })} ` : ""}`
    + tn(n.unidas, "{n} sesión unida a su entreno del reloj", "{n} sesiones unidas a su entreno del reloj") + (n.sueltas ? t(", {n} solo en el reloj", { n: n.sueltas }) : "") + "."
    + `${estadoSalud.fc === false ? ` ${t("Falta el permiso de frecuencia cardiaca.")}` : ""}${estadoSalud.kcal === false ? ` ${t("Falta el permiso de calorías.")}` : ""}`;
}
$("relojBoton").addEventListener("click", async () => {
  if (!estadoSalud.permiso) {
    try { estadoSalud = { ...estadoSalud, ...(await hc.pedirPermiso()) }; } catch (e) { /* refused */ }
    renderReloj();
    if (!estadoSalud.permiso) return;
  }
  $("relojEstado").textContent = t("Leyendo Health Connect…");
  await leerReloj({ forzar: true });
});
capApp?.addListener("resume", () => comprobarSalud().then(() => leerReloj()));
setInterval(() => leerReloj(), 2 * 60 * 1000);

/* ---------- Actualizaciones (GitHub releases) ---------- */
// Only in the Android app: on start and on resume (at most every 6 hours, or from Perfil) it reads the repo's releases;
// when one is newer than the installed app it offers it and opens the APK's link in the browser, which downloads it
// and hands it to Android's installer. The app itself never downloads or installs APKs: an app that does
// (REQUEST_INSTALL_PACKAGES) is what Google Play Protect blocked as harmful.
const actualizador = native && window.Capacitor.isPluginAvailable?.("Actualizar") ? window.Capacitor.registerPlugin("Actualizar") : null;
// { comprobada (ms), release (the newer one found then), ignorada (versionCode the user said "Ahora no" to) }
const ACT = "flexfit.actualizacion";
let act = { comprobada: 0, ignorada: 0 };
try { act = { ...act, ...JSON.parse(localStorage.getItem(ACT) || "null") }; } catch (e) { /* no storage */ }
const saveAct = () => { try { localStorage.setItem(ACT, JSON.stringify(act)); } catch (e) { /* no storage */ } };
let instalada = null; // { codigo, nombre }
let nueva = null; // the newest release, when newer than the installed app
let actEstado = { texto: "", error: false };
let actOcupado = false;
async function versionInstalada() {
  if (instalada) return instalada;
  try { instalada = await actualizador.version(); } catch (e) { /* older app */ }
  const meta = document.querySelector('meta[name="app-version"]')?.content;
  if (!instalada?.codigo && codigoDe(meta)) instalada = { codigo: codigoDe(meta), nombre: meta };
  return instalada;
}
async function buscarActualizacion({ forzar = false } = {}) {
  if (!actualizador || actOcupado) return;
  const yo = await versionInstalada();
  if (!forzar && Date.now() - act.comprobada < 6 * 3600 * 1000) {
    nueva = act.release?.codigo > (yo?.codigo || Infinity) ? act.release : null;
    return renderActualizar();
  }
  if (forzar) { actEstado = { texto: t("Buscando en GitHub…"), error: false }; renderActualizar(); }
  try {
    const r = await ultimaRelease();
    nueva = r && yo?.codigo && r.codigo > yo.codigo ? r : null;
    act.comprobada = Date.now();
    act.release = nueva;
    saveAct();
    actEstado = { texto: nueva ? "" : t("Tienes la última versión."), error: false };
  } catch (e) {
    actEstado = { texto: t("No se pudo consultar GitHub. Prueba más tarde."), error: true };
  }
  renderActualizar();
  // On its own it asks once per version, never in the middle of a session, and not in debug builds (the emulator test).
  if (nueva && !forzar && !yo.depuracion && act.ignorada !== nueva.codigo && !sesion && $("continuarPanel").hidden) {
    const v = { yo: yo.nombre || yo.codigo, nueva: nueva.version, fecha: nueva.fecha ? new Date(nueva.fecha).toLocaleDateString(locale, { day: "numeric", month: "long" }) : "" };
    $("actTexto").textContent = `${v.fecha ? t("Tienes la {yo} y en GitHub está la {nueva}, del {fecha}.", v) : t("Tienes la {yo} y en GitHub está la {nueva}.", v)} `
      + t("Chrome la descarga; abre el archivo y confirma la instalación. Se instala encima de esta y conserva tus datos.");
    $("actPanel").hidden = false;
  }
}
function renderActualizar() {
  $("actCard").hidden = !actualizador;
  if (!actualizador) return;
  const yo = instalada ? t("Versión instalada: {v}.", { v: instalada.nombre || instalada.codigo }) : "";
  const hay = nueva ? ` ${t("Hay una versión nueva: {v}.", { v: nueva.version })}` : "";
  const st = $("actEstado");
  st.textContent = `${yo}${hay}${actEstado.texto ? ` ${actEstado.texto}` : ""}`.trim();
  st.classList.toggle("error", actEstado.error);
  $("actInstalar").hidden = !nueva;
  $("actInstalar").disabled = actOcupado;
  $("actBuscar").disabled = actOcupado;
}
async function instalarActualizacion() {
  if (!nueva || actOcupado) return;
  $("actPanel").hidden = true;
  show("perfil");
  $("actCard").scrollIntoView({ block: "center" });
  actOcupado = true;
  renderActualizar();
  try {
    await actualizador.abrir({ url: nueva.url });
    actEstado = { texto: t("Chrome está descargando la {v}. Cuando acabe, toca el aviso de descarga y luego Instalar.", { v: nueva.version }), error: false };
  } catch (e) {
    actEstado = { texto: t(e?.code === "url" ? "Solo abro las versiones publicadas en GitHub." : "No se pudo abrir el navegador."), error: true };
  } finally {
    actOcupado = false;
    renderActualizar();
  }
}
$("actBuscar").addEventListener("click", () => buscarActualizacion({ forzar: true }));
$("actInstalar").addEventListener("click", instalarActualizacion);
$("actSi").addEventListener("click", instalarActualizacion);
$("actNo").addEventListener("click", () => { $("actPanel").hidden = true; if (nueva) { act.ignorada = nueva.codigo; saveAct(); } });
capApp?.addListener("resume", () => buscarActualizacion());

/* ---------- Sync ---------- */
const ERRORES = { "sin-conexion": "No encuentro el Mac. Se sincronizará cuando esté encendido y a tu alcance.", clave: "La clave no coincide con la del Mac.", "sin-servidor": "Sin servidor: los datos se quedan solo en este dispositivo." };
let timer = null;
// The Android app finds the Mac on its own: if the address in use doesn't answer, it tries the others it knows,
// and with none it looks for the Mac's Bonjour announcement on the Wi-Fi (at most once a minute).
const descubrir = native ? window.Capacitor.registerPlugin("Descubrir") : null;
let ultimaBusqueda = 0;
let aprendidas = false;
function usar(h) {
  ajustes.servidor = h.servidor;
  ajustes.servidores = unir([[h.servidor], h.direcciones, ajustes.servidores || []]);
  saveAjustes();
  $("servidor").value = h.servidor;
  renderDirecciones();
}
async function buscarMac(forzar = false) {
  const otras = unir([ajustes.servidores || []], 20).filter((u) => u !== servidor());
  let h = await elegir(otras);
  if (!h && descubrir && (forzar || Date.now() - ultimaBusqueda > 60000)) {
    ultimaBusqueda = Date.now();
    h = await elegir(await buscarEnWifi(descubrir));
  }
  if (h) usar(h);
  return h;
}
async function sync() {
  let r = await syncNow({ servidor: servidor(), token: ajustes.token });
  if (native && (r.error === "sin-conexion" || r.error === "sin-servidor") && (await buscarMac())) {
    r = await syncNow({ servidor: servidor(), token: ajustes.token });
  }
  if (native && r.ok && !aprendidas) {
    // Once per start, learn the Mac's other addresses (Wi-Fi at home, Tailscale away).
    aprendidas = true;
    const h = await salud(servidor());
    if (h) usar(h);
  }
  await renderSync(r);
  return r;
}
// Renders can overlap (a save and a finished sync); only the newest one may write, so a stale read never wins.
let renderGen = 0;
let lastResult = null;
async function renderSync(r) {
  if (r) lastResult = r;
  r = lastResult;
  const gen = ++renderGen;
  const pend = (await store.pending()).length;
  const ult = await store.getMeta("ultimaSync");
  if (gen !== renderGen) return;
  const pill = $("syncPill");
  if (!servidor()) { pill.dataset.estado = "local"; pill.textContent = t("Solo en este dispositivo"); }
  else if (r && !r.ok) { pill.dataset.estado = "error"; pill.textContent = pend ? t("{n} sin subir", { n: pend }) : t("Sin conexión con el Mac"); }
  else if (pend) { pill.dataset.estado = "pendiente"; pill.textContent = t("{n} sin subir", { n: pend }); }
  else { pill.dataset.estado = "ok"; pill.textContent = t("Sincronizado"); }
  const st = $("syncEstado");
  st.classList.toggle("error", !!(r && !r.ok && r.error !== "sin-servidor"));
  st.textContent = r && !r.ok ? (ERRORES[r.error] ? t(ERRORES[r.error]) : t("El Mac respondió con un error ({e}).", { e: r.error }))
    : ult ? t("Última sincronización: {f}", { f: new Date(ult).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) }) : "";
}
const syncSoon = () => { clearTimeout(timer); timer = setTimeout(sync, 1500); };
$("syncPill").addEventListener("click", () => { show("perfil"); sync(); });
window.addEventListener("online", () => sync());
setInterval(() => sync(), 5 * 60 * 1000);

// The public demo doesn't offer a server at all.
$("servidorCard").hidden = demo;
$("demoNota").hidden = !demo;
$("servidor").value = servidor();
$("token").value = ajustes.token || "";
function renderDirecciones() {
  const otras = unir([ajustes.servidores || []]).filter((u) => u !== servidor());
  $("direcciones").textContent = otras.length ? t("También la conozco en: {l}", { l: otras.join(", ") }) : "";
}
renderDirecciones();
$("buscarMac").hidden = !descubrir;
$("buscarMac").addEventListener("click", async () => {
  const st = $("syncEstado");
  st.classList.remove("error");
  st.textContent = t("Buscando el Mac en esta wifi…");
  const h = await buscarMac(true);
  if (!h) { st.classList.add("error"); st.textContent = t("No encuentro el Mac en esta wifi. ¿Está encendido y en la misma red?"); return; }
  const r = await sync();
  if (r.ok) st.textContent = t("Encontrado en {s}. {e} enviados, {r} recibidos.", { s: h.servidor, e: r.enviados, r: r.recibidos });
});
$("servidorCard").addEventListener("submit", async (e) => {
  e.preventDefault();
  ajustes.servidor = $("servidor").value.trim().replace(/\/+$/, "");
  ajustes.token = $("token").value;
  if (ajustes.servidor) ajustes.servidores = unir([[ajustes.servidor], ajustes.servidores || []]);
  saveAjustes();
  renderDirecciones();
  $("syncEstado").textContent = t("Sincronizando…");
  const r = await sync();
  if (r.ok) $("syncEstado").textContent = t("Listo: {e} enviados, {r} recibidos.", { e: r.enviados, r: r.recibidos });
});

/* ---------- Backups ---------- */
$("exportar").addEventListener("click", async () => {
  const txt = JSON.stringify(await store.exportAll(), null, 2);
  const name = `flex-and-fit-${iso(new Date())}.json`;
  const file = new File([txt], name, { type: "application/json" });
  if (native && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { /* cancelled: fall back */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $("copiaEstado").textContent = t("Descargado {n}", { n: name });
});
$("importar").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  const st = $("copiaEstado");
  try {
    const n = await store.importJSON(JSON.parse(await f.text()));
    st.classList.remove("error");
    st.textContent = t("Importados {n} registros.", { n });
  } catch (err) {
    st.classList.add("error");
    st.textContent = err instanceof SyntaxError ? t("El archivo no es un JSON válido.") : t(err.message);
  }
});

/* ---------- Start ---------- */
async function renderAll() {
  await cargar();
  renderEntrenos();
  renderHistorial();
  if (pantalla === "sesion") renderSesion();
  renderPerfil();
  await renderProgreso();
  rellenarResumen();
  animar();
}
store.onChange(async (origen) => {
  await renderAll();
  await renderSync();
  if (origen === "local") syncSoon();
});
const ver = document.querySelector('meta[name="app-version"]')?.content;
$("version").textContent = t("Versión {v}", { v: ver || t("local") }) + (native ? ` · ${t("app Android")}` : "");
show(ajustes.tab);
await renderAll();
await renderSync();
ofrecerContinuar();
comprobarSalud().then(() => leerReloj());
buscarActualizacion();
sync();
