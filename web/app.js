// Flex & Fit: workout list, workout detail with the mannequin, stretching player, gym set logger, progress,
// history, profile, sync with the Mac and JSON backups.
import * as store from "./store.js";
import { syncNow } from "./sync.js";
import { elegir, salud, buscarEnWifi, unir } from "./direccion.js";
import { html } from "./html.js";
import { EX, RUTINAS_FLEX, GYM, TESTS, FIG_FUERZA, pasos, resumenFlex, resumenGym, enPlan } from "./datos.js";
import { maniqui, NOMBRES } from "./maniqui.js";
import { figura, animar, enPaso } from "./figura.js";
import { importar as importarReloj } from "./reloj.js";
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
/* eslint-disable security/detect-object-injection -- lookups below use ids and keys from this app's own data */

const native = !!window.Capacitor?.isNativePlatform?.();
// Where the Mac's server is. The web page served by the Mac uses its own origin. The Android app has no default:
// the address is typed once in Perfil and kept only on the phone, so no host name or IP is ever in this public repo.
// The GitHub Pages demo has no server at all.
const demo = location.hostname === "buffalonan.github.io";
// It may live under a sub-path behind a proxy (http://<mac>/fitness/), so the base is the page's folder, not the origin.
const defaultServer = () => (native || demo || location.protocol === "file:" ? "" : new URL(".", location.href).href.replace(/\/+$/, ""));

const KEY = "flexfit.ajustes";
let ajustes = { servidor: null, servidores: [], token: "", tab: "entrenos", filtro: "todos" };
try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(KEY) || "null") }; } catch (e) { /* no storage */ }
const saveAjustes = () => { try { localStorage.setItem(KEY, JSON.stringify(ajustes)); } catch (e) { /* no storage */ } };
const servidor = () => (ajustes.servidor ?? defaultServer()).trim();

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
const fechaLarga = (s) => parse(s).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// A gym exercise's sets and reps (or time), per side when it's done one arm at a time.
const dosisGym = (e) => `${e.series} ${e.series === 1 ? "serie" : "series"} · ${e.seg ? mmss(e.seg) : `${e.reps} reps`}${e.porLado ? " /lado" : ""}`;
const fmtMin = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);
const haceDias = (f) => { const n = Math.round((parse(iso(new Date())) - parse(f)) / 864e5); return n <= 0 ? "Hoy" : n === 1 ? "Ayer" : `Hace ${n} días`; };
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch (e) { /* not supported */ } };

const rutinaFlex = (id) => RUTINAS_FLEX.find((r) => r.id === id);
const gym = (id) => GYM.find((w) => w.id === id);
const titulo = (id) => { const r = rutinaFlex(id); return r ? (r.n ? `Fase ${r.n} · ${r.name}` : r.name) : gym(id)?.n || id; };

/* ---------- Data the screens share ---------- */
let sesiones = [];
let inicioPlan = null;
async function cargar() {
  sesiones = (await store.all("sesiones")).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b._actualizado - a._actualizado);
  inicioPlan = (await store.all("ajustes")).find((r) => r.id === "plan-flexibilidad")?.inicio || null;
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

/* ---------- Screens ---------- */
const TABS = ["entrenos", "progreso", "historial", "perfil"];
let pantalla = "entrenos";
function show(tab) {
  if (!TABS.includes(tab)) tab = "entrenos";
  for (const t of [...TABS, "detalle"]) $(t).hidden = t !== tab;
  document.querySelectorAll(".tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  pantalla = tab;
  ajustes.tab = tab;
  saveAjustes();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

const capApp = native ? window.Capacitor.registerPlugin("App") : null;
capApp?.addListener("backButton", () => {
  if (!$("continuarPanel").hidden) $("continuarPanel").hidden = true;
  else if (!$("salirPanel").hidden) cerrarSalir();
  else if (!$("ficha").hidden) cerrarFicha();
  else if (sesion) pedirSalir();
  else if (!$("resumen").hidden) cerrarResumen();
  else if (pantalla === "entrenos") capApp.exitApp();
  else show("entrenos");
});
capApp?.addListener("resume", () => sync());

/* ---------- Entrenos ---------- */
function miniFlex(r) { return maniqui(resumenFlex(r).musc, "x", { titulo: `Músculos de ${titulo(r.id)}` }); }
function miniGym(w) { const g = resumenGym(w); return maniqui(g, "f", { titulo: `Músculos de ${w.n}` }); }

function tarjeta(id, { hoy = false } = {}) {
  const r = rutinaFlex(id), w = gym(id);
  const u = ultima(id);
  const chips = [];
  if (hoy) chips.push(html`<span class="chip x">HOY · FLEX</span>`);
  if (hoy && u?.fecha === iso(new Date())) chips.push(html`<span class="chip ok">Hecha ✓</span>`);
  if (!hoy && u) chips.push(html`<span class="chip">${haceDias(u.fecha)}</span>`);
  if (r && !hoy && r.weeks) chips.push(html`<span class="chip">Semanas ${r.weeks[0]}–${r.weeks[1]}</span>`);
  const sub = r ? `${r.items.length} ejercicios · ${r.min}` : `${w.ej.length} ejercicios · ${resumenGym(w).series} series`;
  return html`<button type="button" class="wcard${hoy ? " hoy" : ""}" data-abrir="${id}">
    <span class="mini">${r ? miniFlex(r) : miniGym(w)}</span>
    <span class="meta">${chips.length && hoy ? html`<span class="chips">${chips}</span>` : ""}<span class="name">${titulo(id)}</span><span class="sub">${sub}</span>
      ${!hoy && chips.length ? html`<span class="chips">${chips}</span>` : ""}</span>
  </button>`;
}

function renderEntrenos() {
  const hoy = iso(new Date());
  const ep = enPlan(inicioPlan, hoy);
  $("hoyFecha").textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $("planPos").textContent = `Semana ${Math.min(ep.semana, 26)} · F${ep.fase.n}`;
  $("hoyCard").innerHTML = html`${tarjeta(ep.rutina, { hoy: true })}${ep.test ? html`<p class="sub">Hoy toca el test mensual: apúntalo en Progreso.</p>` : ""}`;
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
const statsReloj = () => html`<div class="stat"><b id="resFc">—</b><span>FC media · reloj</span></div><div class="stat"><b id="resKcal">—</b><span>Calorías · reloj</span></div>`;

function abrir(id) {
  abierto = id;
  const r = rutinaFlex(id), w = gym(id);
  $("detalle").classList.toggle("flex", !!r);
  $("detTitle").textContent = titulo(id);
  const u = ultima(id);
  if (r) {
    const { seg, musc } = resumenFlex(r);
    $("detSub").textContent = `${r.items.length} ejercicios · ${r.min} · intensidad ${r.int}${u ? ` · última vez ${haceDias(u.fecha).toLowerCase()}` : ""}`;
    $("detNotas").innerHTML = html`<li>${r.goal}</li>`;
    $("detMan").innerHTML = html`${maniqui(musc, "x", { etiquetas: etiquetasTop(musc, 6, fmtMin) })}
      <div class="leyenda"><span><i style="background:var(--flex1)"></i>&lt; 1 min</span><span><i style="background:var(--flex2)"></i>1–3 min</span><span><i style="background:var(--flex3)"></i>3+ min</span></div>`;
    $("detStats").innerHTML = html`${stat(r.items.length, "Ejercicios")}${stat(Math.round(seg / 60), "Estirando", "min")}${stat(r.int.replace(" / 10", ""), "Intensidad", "/10")}`;
    $("detLista").innerHTML = html`${r.items.map(([ex, dosis, extra], i) => html`<li class="ej" data-i="${i}">
      <span class="th">${figura(ex)}</span>
      <div class="meta"><span class="name">${EX[ex].n}</span><span class="dosis">${dosis}</span>
        <span class="zona">Lo notas en: ${EX[ex].z}</span>
        ${extra ? html`<span class="extra">${extra}</span>` : ""}</div>
      <button type="button" class="ver" aria-label="${`Ver ${EX[ex].n}`}">›</button></li>`)}`;
    $("detMaquinas").textContent = "Tensión, nunca dolor. Entra despacio, sin rebotes, y respira lento.";
    $("detAvance").innerHTML = html`${r.adv ? html`<b>Pasa a la siguiente fase cuando:</b><ul>${r.adv.map((a) => html`<li>${a}</li>`)}</ul>` : ""}`;
  } else {
    const g = resumenGym(w);
    $("detSub").textContent = `${w.sub} · ${g.series} series${u ? ` · última vez ${haceDias(u.fecha).toLowerCase()}` : ""}`;
    $("detNotas").innerHTML = html`${w.notas.map((n) => html`<li>${n}</li>`)}`;
    $("detMan").innerHTML = html`${maniqui(g, "f", { etiquetas: etiquetasTop(g.p, 6, (v) => `${v} series`) })}
      <div class="leyenda"><span><i style="background:var(--prim)"></i>Músculos principales</span><span><i style="background:var(--sec)"></i>Secundarios</span></div>`;
    const vol = w.ej.reduce((a, e) => a + (e.kg && e.reps ? e.kg * e.reps * e.series * (e.porLado ? 2 : 1) : 0), 0);
    $("detStats").innerHTML = html`${stat(g.series, "Series")}${stat(w.ej.length, "Ejercicios")}${stat(vol.toLocaleString("es-ES"), "Volumen", "kg")}`;
    const fila = (e, i) => html`<li class="ej g" data-i="${i}">${FIG_FUERZA[e.n] ? html`<span class="th">${figura(FIG_FUERZA[e.n])}</span>` : ""}<div class="meta"><span class="name">${e.n}${e.lado ? ` (${e.lado === "izq" ? "izquierda" : "derecha"})` : ""}</span>
      <span class="dosis">${dosisGym(e)}${e.kg ? ` · ${String(e.kg).replace(".", ",")} kg` : ""} · Descanso ${mmss(e.desc)}</span>
      <span class="chips">${e.p.map((m) => html`<span class="chip f">${NOMBRES[m]}</span>`)}${e.s.map((m) => html`<span class="chip">${NOMBRES[m]}</span>`)}</span></div>
      <button type="button" class="ver" aria-label="${`Ver ${e.n}`}">›</button></li>`;
    const out = [];
    for (const [i, e] of w.ej.entries()) {
      if (!e.bloque) { out.push(fila(e, i)); continue; }
      if (w.ej[i - 1]?.bloque === e.bloque) continue;
      const items = w.ej.map((x, j) => [x, j]).filter(([x]) => x.bloque === e.bloque);
      out.push(html`<li class="bloque"><b>Repite ${w.bloques[e.bloque].rondas} veces</b><ol class="ejercicios">${items.map(([x, j]) => fila(x, j))}</ol></li>`);
    }
    $("detLista").innerHTML = html`${out}`;
    $("detMaquinas").innerHTML = html`Material: ${w.maquinas}.${w.fuente ? html`<br>Fuente: <a href="${w.fuente.url}" target="_blank" rel="noopener">${w.fuente.n}</a>` : ""}`;
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
const lado = (e) => (e.lado ? ` (${e.lado === "izq" ? "izquierda" : "derecha"})` : "");
function verFicha(i) {
  const r = rutinaFlex(abierto), w = gym(abierto);
  const total = r ? r.items.length : w.ej.length;
  if (i < 0 || i >= total) return;
  ficha = i;
  $("ficha").classList.toggle("gym", !r);
  $("fichaCuenta").textContent = `Ejercicio ${i + 1} de ${total}`;
  $("fichaAnt").disabled = i === 0;
  $("fichaSig").disabled = i === total - 1;
  if (r) {
    const [ex, dosis, extra] = r.items[i];
    const e = EX[ex];
    $("fichaTitulo").textContent = e.n;
    $("fichaFig").innerHTML = html`<div class="fig3d">${figura(ex, { clase: "grande" })}</div>`;
    en3d($("fichaFig").querySelector(".fig3d"), ex, { musculos: e });
    $("fichaDosis").textContent = dosis;
    $("fichaCuerpo").innerHTML = html`<p class="zona">Lo notas en: <b>${e.z}</b></p>
      ${extra ? html`<p class="extra">${extra}</p>` : ""}
      <h3>Cómo hacerlo</h3><ol class="pasos">${e.c.map((c) => html`<li>${c}</li>`)}</ol>
      <p class="sub">Tensión, nunca dolor. Entra despacio, sin rebotes, y respira lento.</p>`;
  } else {
    const e = w.ej[i];
    const p = Object.fromEntries(e.p.map((m) => [m, e.series])), sec = Object.fromEntries(e.s.map((m) => [m, e.series]));
    $("fichaTitulo").textContent = `${e.n}${lado(e)}`;
    $("fichaFig").innerHTML = html`${FIG_FUERZA[e.n] ? html`<div class="fig3d">${figura(FIG_FUERZA[e.n], { clase: "grande" })}</div>` : ""}${maniqui({ p, s: sec }, "f", { titulo: `Músculos de ${e.n}` })}
      <div class="leyenda"><span><i style="background:var(--prim)"></i>Principales</span><span><i style="background:var(--sec)"></i>Secundarios</span></div>`;
    if (FIG_FUERZA[e.n]) en3d($("fichaFig").querySelector(".fig3d"), FIG_FUERZA[e.n], { musculos: e });
    $("fichaDosis").textContent = `${dosisGym(e)}${e.kg ? ` · ${String(e.kg).replace(".", ",")} kg` : e.elige ? " · peso a elegir" : " · peso corporal"}`;
    const ult = ultimasSeries(w, i)?.series.filter((x) => x?.hecho) || [];
    $("fichaCuerpo").innerHTML = html`<p class="zona">Descanso entre series: <b>${mmss(e.desc)}</b>${e.bloque ? html` · en circuito, ${w.bloques[e.bloque].rondas} rondas` : ""}</p>
      <h3>Músculos</h3><p class="chips">${e.p.map((m) => html`<span class="chip f">${NOMBRES[m]}</span>`)}${e.s.map((m) => html`<span class="chip">${NOMBRES[m]}</span>`)}</p>
      ${e.c ? html`<h3>Cómo hacerlo</h3><ol class="pasos">${e.c.map((c) => html`<li>${c}</li>`)}</ol>` : ""}
      ${ult.length ? html`<h3>La última vez</h3><p class="sub">${ult.map((x) => `${x.kg ? `${String(x.kg).replace(".", ",")} kg × ` : ""}${x.seg ? mmss(x.seg) : x.reps}`).join(" · ")}</p>` : ""}`;
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
  entreno?.empezar({ titulo: titulo(id), inicio }).catch(() => {});
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
    ? { tipo: "gym", rutina: s.rutina, inicio: s.inicio, valores: s.valores, pag: s.pag, desc: s.desc }
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
  const cuando = iso(ini) === iso(new Date()) ? "hoy" : ini.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  let hecho;
  if (d.tipo === "gym") { const n = Object.values(d.valores).filter((v) => v?.hecho).length; hecho = `${n} ${n === 1 ? "serie hecha" : "series hechas"}`; }
  else { const n = new Set(d.hechos).size; hecho = `${n} de ${rutinaFlex(d.rutina).items.length} posturas`; }
  $("contTexto").textContent = `${titulo(d.rutina)}, empezado ${cuando} a las ${ini.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · ${hecho}.`;
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
    stats = html`${stat(mmss((Date.now() - s.inicio) / 1000), "Duración")}${stat(`${hechos}/${r.items.length}`, "Ejercicios")}${stat(Math.round(estirando), "Estirando", "min")}${statsReloj()}`;
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
    const vol = s.filas.reduce((a, f) => { const v = s.valores[f.k]; return a + (v.hecho && v.kg > 0 && !w.ej[f.e].seg ? v.kg * v.n * (w.ej[f.e].porLado ? 2 : 1) : 0); }, 0);
    datos = { tipo: "gimnasio", fecha, inicio: s.inicio, fin: Date.now(), rutina: w.id, nombre: w.n, duracionMin: min, notas: "", volumenKg: Math.round(vol), ejercicios };
    const p = {}, sec = {};
    for (const f of s.filas) if (s.valores[f.k].hecho) { for (const m of w.ej[f.e].p) p[m] = (p[m] || 0) + 1; for (const m of w.ej[f.e].s) sec[m] = (sec[m] || 0) + 1; }
    man = maniqui({ p, s: sec }, "f", { etiquetas: etiquetasTop(p, 4, (v) => `${v} series`) });
    stats = html`${stat(hechas.length, "Series")}${stat(Math.round(vol).toLocaleString("es-ES"), "Volumen", "kg")}${stat(mmss((Date.now() - s.inicio) / 1000), "Duración")}${statsReloj()}`;
    resumenId = store.newId();
    await store.put("sesiones", resumenId, datos);
  }
  // Saved: the copy kept in case the app closed isn't needed any more (salirSesion removes it too).
  borrarEnCurso();
  salirSesion();
  document.body.classList.add("en-sesion");
  $("resFecha").textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $("resTitulo").textContent = titulo(datos.rutina);
  $("resMan").innerHTML = html`${man}`;
  $("resStats").innerHTML = html`${stats}`;
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
  $("resNota").textContent = r ? (r.fcMax ? `Del reloj: FC máxima ${r.fcMax} ppm.` : "Datos del reloj vía Health Connect.")
    : !hc ? "FC media y kcal llegan de tu Coros a través de Health Connect, en la app de Android."
      : !estadoSalud.permiso ? "Conecta Health Connect en Perfil para ver aquí la FC y las calorías de tu Coros."
        : "Aparecerán cuando tu Coros sincronice el entreno con el teléfono.";
}
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
      if (k === 0) out.push({ ...p, tipo: "prep", seg: 5, texto: "Prepárate" });
      else if (p.lado && prev.lado !== p.lado) out.push({ ...p, tipo: "prep", seg: 4, texto: "Cambia de lado" });
      else out.push({ ...p, tipo: "prep", seg: 3, texto: "Suelta y respira" });
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
  $("repPausa").textContent = sesion.pausa ? "SEGUIR" : "PAUSA";
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
  $("repCuenta").textContent = `Postura ${p.i + 1} de ${r.items.length}`;
  $("repTitulo").textContent = ex.n;
  $("repSerie").textContent = p.tipo === "prep" ? p.texto : [p.texto, p.reps ? `${p.reps} repeticiones` : ""].filter(Boolean).join(" · ");
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
  $("repCueT").textContent = p.tipo === "prep" ? "Cómo" : "Siente";
  $("repCue").textContent = p.tipo === "prep" ? ex.c[0] : `${ex.z}. Tensión, nunca dolor: respira lento y suelta un poco más al exhalar.`;
  const sig = s.pasos.slice(i + 1).find((q) => q.tipo === "work" && q.i !== p.i);
  $("repSig").innerHTML = html`${sig ? html`<span class="th">${figura(sig.ex)}</span><span>Después: <b>${EX[sig.ex].n}</b> · ${r.items[sig.i][1]}</span>` : html`<span>Es la última postura.</span>`}`;
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
  $("repPausa").textContent = s.pausa ? "SEGUIR" : "PAUSA";
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
      paginas.push({ titulo: e.n, filas: fs, ej: [ei] });
    } else if (w.ej[ei - 1]?.bloque !== e.bloque) {
      const idx = w.ej.map((x, j) => [x, j]).filter(([x]) => x.bloque === e.bloque).map(([, j]) => j);
      const fs = [];
      for (let ro = 0; ro < w.bloques[e.bloque].rondas; ro++) for (const j of idx) fs.push({ e: j, si: ro, k: `${j}-${ro}`, lbl: `R${ro + 1}`, ronda: true });
      filas.push(...fs);
      paginas.push({ titulo: `Circuito · ${w.bloques[e.bloque].rondas} vueltas`, filas: fs, ej: idx });
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
    valores[f.k] = { kg, n, hecho: false, prev: ps ? `${ps.kg ? `${String(ps.kg).replace(".", ",")}×` : ""}${ps[c] ?? ""}${e.seg ? " s" : ""}` : "—" };
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
  sesion = { tipo: "gym", paginas, filas, valores, pag, desc };
  entrar(id, previo?.inicio);
  $("registro").hidden = false;
  pagina(pag);
  sesion.timer = setInterval(tickGym, 250);
}
function pagina(n) {
  const s = sesion, w = gym(s.rutina);
  s.pag = n;
  const pg = s.paginas[n];
  $("regCuenta").textContent = `Ejercicio ${n + 1} de ${s.paginas.length}`;
  $("regTitulo").textContent = pg.titulo;
  const ms = new Set(pg.ej.flatMap((i) => w.ej[i].p)), ss = new Set(pg.ej.flatMap((i) => w.ej[i].s));
  const fig = FIG_FUERZA[w.ej[pg.ej[0]].n];
  $("regFig").innerHTML = html`${fig ? figura(fig) : ""}`;
  $("regFig").hidden = !fig;
  animar($("regFig"));
  en3d($("regFig"), fig, { musculos: { p: [...ms], s: [...ss] } });
  $("regMusc").innerHTML = html`${[...ms].map((m) => html`<span class="chip f">${NOMBRES[m]}</span>`)}${[...ss].filter((m) => !ms.has(m)).map((m) => html`<span class="chip">${NOMBRES[m]}</span>`)}`;
  const timed = pg.ej.every((i) => w.ej[i].seg);
  $("regColReps").textContent = timed ? "SEG" : pg.ej.every((i) => w.ej[i].porLado) ? "REPS/LADO" : "REPS";
  // Kg can be negative (assisted pull-ups on the machine), so the kg field has no min and no inputmode="decimal",
  // whose keyboard on Android has no minus key. Negative kg add nothing to the volume.
  $("regFilas").innerHTML = html`${pg.filas.map((f) => {
    const e = w.ej[f.e], v = s.valores[f.k];
    const nombre = f.ronda ? `${f.lbl} · ${e.n}${e.lado ? (e.lado === "izq" ? " izq." : " der.") : ""}` : f.lbl;
    return html`<tr data-k="${f.k}" class="${v.hecho ? "done" : ""}"><td class="${f.ronda ? "lbl" : "num"}">${nombre}</td><td class="prev">${v.prev}</td>
      <td><input type="number" step="0.5" data-c="kg" value="${v.kg ?? ""}" aria-label="Kg, serie ${f.lbl}" placeholder="${e.kg == null ? "—" : ""}"></td>
      <td><input type="number" inputmode="numeric" min="0" data-c="n" value="${v.n ?? ""}" aria-label="${e.seg ? "Segundos" : "Repeticiones"}, serie ${f.lbl}"></td>
      <td><button type="button" class="ck" data-ck="${f.k}" aria-pressed="${v.hecho}" aria-label="Serie ${f.lbl} hecha">✓</button></td></tr>`;
  })}`;
  $("regNota").textContent = w.notas.find((x) => pg.ej.some((i) => x.toLowerCase().startsWith(w.ej[i].n.toLowerCase().split(" ").slice(0, 2).join(" ")))) || "";
  $("regAnt").disabled = n === 0;
  $("regSig").textContent = n === s.paginas.length - 1 ? "TERMINAR" : "SIGUIENTE";
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

/* ---------- Progreso ---------- */
async function renderProgreso() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = iso(lunes);
  const ses = sesiones.filter((s) => s.fecha >= desde);
  const n = (t) => ses.filter((s) => s.tipo === t).length;
  $("semana").innerHTML = html`<div class="stat"><b>${ses.length}</b><span>sesiones esta semana</span></div>
    <div class="stat"><b>${n("flexibilidad")}</b><span>flexibilidad</span></div>
    <div class="stat"><b>${n("gimnasio")}</b><span>gimnasio</span></div>`;
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
  $("racha").textContent = racha === 1 ? "1 día seguido" : `${racha} días seguidos`;

  const tests = await store.all("tests");
  grafica(tests);
  if (!$("testForm").contains(document.activeElement)) {
    $("testFase").value = String(enPlan(inicioPlan, iso(hoy)).fase.n);
    camposTest(tests);
  }
}
function camposTest(tests) {
  const f = Number($("testFase").value);
  const t = tests.find((x) => x.fase === f) || {};
  $("testCampos").innerHTML = html`${TESTS.map(([k, l, u]) => html`<label class="f">${l} (${u})<input type="number" inputmode="decimal" step="any" name="${k}" value="${t[k] ?? ""}"></label>`)}`;
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
  $("testOk").textContent = `Test de la fase ${fase} guardado.`;
});
function grafica(tests) {
  const pts = tests.filter((t) => Number.isFinite(t.dedosSueloCm)).sort((a, b) => a.fase - b.fase);
  if (!pts.length) { $("testGrafica").innerHTML = html`<p class="sub">Aún no hay tests. Haz el primero al final de la fase 1.</p>`; return; }
  // Distance to the floor in cm: 0 means touching it, negative means past it. Higher on the chart is better.
  const vals = pts.map((t) => t.dedosSueloCm);
  const hi = Math.max(5, ...vals) + 2, lo = Math.min(-5, ...vals) - 2;
  const x = (f) => 30 + ((f - 1) / 5) * 205, y = (v) => 8 + ((v - lo) / (hi - lo)) * 60;
  const grid = [hi - 2, 0, lo + 2].map(Math.round).filter((v, i, a) => a.indexOf(v) === i);
  $("testGrafica").innerHTML = html`<svg class="grafica" viewBox="0 0 250 86" role="img" aria-label="Test de dedos al suelo por fase">
    ${grid.map((v) => html`<line x1="30" x2="240" y1="${y(v)}" y2="${y(v)}" stroke="var(--app-line)" stroke-width=".6" stroke-dasharray="${v === 0 ? "3 2" : "none"}"/><text x="26" y="${y(v) + 3}" text-anchor="end">${v}</text>`)}
    <text x="240" y="${y(0) - 3}" text-anchor="end">tocar el suelo</text>
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

const hora = (ms) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function lineaReloj(s) {
  const r = s.reloj;
  const partes = [`⌚ ${hora(r.inicio)}–${hora(r.fin)}`];
  if (r.fcMedia) partes.push(`FC ${r.fcMedia}${r.fcMax ? `/${r.fcMax}` : ""} ppm`);
  if (r.kcal) partes.push(`${r.kcal} kcal`);
  return partes.join(" · ") + (s.origen === "reloj" ? ". Apunta las series y se unirán." : "");
}
function renderHistorial() {
  $("vacio").hidden = sesiones.length > 0;
  $("lista").innerHTML = html`${sesiones.map((s) => {
    const nombre = s.rutina ? (s.nombre || titulo(s.rutina)) : "";
    const hechos = Array.isArray(s.ejercicios) && s.tipo === "flexibilidad" ? s.ejercicios.filter((x) => x.hecho).length : null;
    const series = s.tipo === "gimnasio" && Array.isArray(s.ejercicios) ? s.ejercicios.flatMap((x) => x.series || []).filter((x) => x.hecho).length : null;
    return html`<li>
    <div class="txt">
      <span class="tipo ${s.tipo === "gimnasio" ? "gimnasio" : ""}">${s.tipo === "gimnasio" ? "Gimnasio" : "Flexibilidad"}${s.rutina ? ` · ${s.rutina.toUpperCase()}` : ""}${s.origen === "reloj" ? " · Solo en el reloj" : ""}</span>
      ${nombre ? html`<div>${nombre}</div>` : ""}
      <div><b>${s.fecha ? fechaLarga(s.fecha) : "Sin fecha"}</b>${s.duracionMin ? ` · ${s.duracionMin} min` : ""}${hechos != null ? ` · ${hechos}/${s.ejercicios.length} ejercicios` : ""}${series ? ` · ${series} series` : ""}${s.volumenKg ? ` · ${s.volumenKg.toLocaleString("es-ES")} kg` : ""}</div>
      ${s.reloj ? html`<div class="reloj">${lineaReloj(s)}</div>` : ""}
      ${s.notas ? html`<div class="sub">${s.notas}</div>` : ""}
    </div>
    <button type="button" class="del" data-del="${s.id}" aria-label="Borrar la sesión del ${s.fecha || ""}">Borrar</button>
  </li>`;
  })}`;
}
$("lista").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (id) await store.remove("sesiones", id);
});

/* ---------- Perfil ---------- */
function renderPerfil() {
  if (document.activeElement !== $("planInicio")) $("planInicio").value = inicioPlan || "";
  const ep = enPlan(inicioPlan, iso(new Date()));
  $("planEstado").textContent = !inicioPlan ? "Empieza con tu primera sesión de flexibilidad, o elige la fecha aquí."
    : ep.antes ? "El plan aún no ha empezado." : ep.despues ? "Plan completado: sigue con la fase 6 como mantenimiento."
      : `Semana ${ep.semana} de 26 · Fase ${ep.fase.n}, ${ep.fase.name}.`;
}
$("planInicio").addEventListener("change", async (e) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) await store.put("ajustes", "plan-flexibilidad", { plan: "flexibilidad-6m-v1", inicio: e.target.value });
});
$("planCard").addEventListener("submit", (e) => e.preventDefault());

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
}
function leerReloj({ forzar = false } = {}) {
  if (!hc || !estadoSalud.permiso) return Promise.resolve(null);
  // A forced read (after a session) mustn't be lost to one already running from before it was saved.
  if (leyendo) return forzar ? leyendo.then(() => leerReloj({ forzar })) : leyendo;
  if (!forzar && Date.now() - ultimaLectura < 60000) return Promise.resolve(null);
  ultimaLectura = Date.now();
  leyendo = importarReloj(hc, store, { enCurso: !!sesion || !!leerEnCurso() }).then((r) => { renderReloj(r); return r; }).finally(() => (leyendo = null));
  return leyendo;
}
async function renderReloj(r) {
  $("relojCard").hidden = !hc;
  if (!hc) return;
  const st = $("relojEstado"), btn = $("relojBoton");
  st.classList.toggle("error", !!r?.error || !estadoSalud.disponible);
  btn.hidden = !estadoSalud.disponible;
  btn.textContent = estadoSalud.permiso ? "Leer ahora" : "Conectar Health Connect";
  if (!estadoSalud.disponible) { st.textContent = "Health Connect no está disponible en este teléfono (hace falta Android 14 o posterior)."; return; }
  if (!estadoSalud.permiso) { st.textContent = "Sin permiso todavía: pulsa el botón y permite leer ejercicio, frecuencia cardiaca y calorías."; return; }
  if (r?.error) { st.textContent = r.error; return; }
  const ult = await store.getMeta("relojLectura");
  const n = r || { unidas: sesiones.filter((s) => s.origen !== "reloj" && s.reloj).length, sueltas: sesiones.filter((s) => s.origen === "reloj").length };
  st.textContent = `${ult ? `Última lectura: ${new Date(ult).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}. ` : ""}`
    + `${n.unidas} ${n.unidas === 1 ? "sesión unida" : "sesiones unidas"} a su entreno del reloj${n.sueltas ? `, ${n.sueltas} solo en el reloj` : ""}.`
    + `${estadoSalud.fc === false ? " Falta el permiso de frecuencia cardiaca." : ""}${estadoSalud.kcal === false ? " Falta el permiso de calorías." : ""}`;
}
$("relojBoton").addEventListener("click", async () => {
  if (!estadoSalud.permiso) {
    try { estadoSalud = { ...estadoSalud, ...(await hc.pedirPermiso()) }; } catch (e) { /* refused */ }
    renderReloj();
    if (!estadoSalud.permiso) return;
  }
  $("relojEstado").textContent = "Leyendo Health Connect…";
  await leerReloj({ forzar: true });
});
capApp?.addListener("resume", () => comprobarSalud().then(() => leerReloj()));
setInterval(() => leerReloj(), 2 * 60 * 1000);

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
  if (!servidor()) { pill.dataset.estado = "local"; pill.textContent = "Solo en este dispositivo"; }
  else if (r && !r.ok) { pill.dataset.estado = "error"; pill.textContent = pend ? `${pend} sin subir` : "Sin conexión con el Mac"; }
  else if (pend) { pill.dataset.estado = "pendiente"; pill.textContent = `${pend} sin subir`; }
  else { pill.dataset.estado = "ok"; pill.textContent = "Sincronizado"; }
  const st = $("syncEstado");
  st.classList.toggle("error", !!(r && !r.ok && r.error !== "sin-servidor"));
  st.textContent = r && !r.ok ? ERRORES[r.error] || `El Mac respondió con un error (${r.error}).`
    : ult ? `Última sincronización: ${new Date(ult).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}` : "";
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
  $("direcciones").textContent = otras.length ? `También la conozco en: ${otras.join(", ")}` : "";
}
renderDirecciones();
$("buscarMac").hidden = !descubrir;
$("buscarMac").addEventListener("click", async () => {
  const st = $("syncEstado");
  st.classList.remove("error");
  st.textContent = "Buscando el Mac en esta wifi…";
  const h = await buscarMac(true);
  if (!h) { st.classList.add("error"); st.textContent = "No encuentro el Mac en esta wifi. ¿Está encendido y en la misma red?"; return; }
  const r = await sync();
  if (r.ok) st.textContent = `Encontrado en ${h.servidor}. ${r.enviados} enviados, ${r.recibidos} recibidos.`;
});
$("servidorCard").addEventListener("submit", async (e) => {
  e.preventDefault();
  ajustes.servidor = $("servidor").value.trim().replace(/\/+$/, "");
  ajustes.token = $("token").value;
  if (ajustes.servidor) ajustes.servidores = unir([[ajustes.servidor], ajustes.servidores || []]);
  saveAjustes();
  renderDirecciones();
  $("syncEstado").textContent = "Sincronizando…";
  const r = await sync();
  if (r.ok) $("syncEstado").textContent = `Listo: ${r.enviados} enviados, ${r.recibidos} recibidos.`;
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
  $("copiaEstado").textContent = `Descargado ${name}`;
});
$("importar").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  const st = $("copiaEstado");
  try {
    const n = await store.importJSON(JSON.parse(await f.text()));
    st.classList.remove("error");
    st.textContent = `Importados ${n} registros.`;
  } catch (err) {
    st.classList.add("error");
    st.textContent = err instanceof SyntaxError ? "El archivo no es un JSON válido." : err.message;
  }
});

/* ---------- Start ---------- */
async function renderAll() {
  await cargar();
  renderEntrenos();
  renderHistorial();
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
$("version").textContent = `Versión ${ver || "local"}${native ? " · app Android" : ""}`;
show(ajustes.tab);
await renderAll();
await renderSync();
ofrecerContinuar();
comprobarSalud().then(() => leerReloj());
sync();
