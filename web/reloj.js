// The watch's workouts from Health Connect (Android only): COROS writes each workout there with its heart rate and
// calories once the watch syncs with the phone. They are joined to the session logged in the app (series and kg stay
// manual), by time when both have it, else by day. A watch workout with no session in the app is kept on its own
// (`sesiones/reloj-<id>`, `origen: "reloj"`) and joins the session logged for it later.

const MIN = 60000;
// A watch workout this close to an app session still counts as the same one (the watch started before the app).
const HOLGURA = 15 * MIN;

const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const compatible = (sesion, w) => w.categoria === "otro" || (sesion.tipo === "gimnasio" ? w.categoria === "fuerza" : w.categoria === "flex");

/** What a session keeps from its watch workout. */
export function datosReloj(w) {
  const r = { id: w.id, inicio: w.inicio, fin: w.fin, categoria: w.categoria };
  if (Number.isFinite(w.fcMedia) && w.fcMedia > 0) r.fcMedia = Math.round(w.fcMedia);
  if (Number.isFinite(w.fcMax) && w.fcMax > 0) r.fcMax = Math.round(w.fcMax);
  if (Number.isFinite(w.kcal) && w.kcal > 0) r.kcal = Math.round(w.kcal);
  // The heart-rate curve for the session's chart: one average per `curvaPaso` seconds, 0 where there's none.
  if (Array.isArray(w.curva) && w.curva.length && Number.isFinite(w.curvaPaso) && w.curvaPaso > 0) {
    r.curva = w.curva.slice(0, 400).map((v) => (Number.isFinite(v) && v > 0 && v < 260 ? Math.round(v) : 0));
    r.curvaPaso = Math.round(w.curvaPaso);
  }
  if (w.titulo) r.titulo = String(w.titulo).slice(0, 120);
  if (w.origen) r.origen = String(w.origen).slice(0, 120);
  return r;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** How well watch workout `w` fits app session `s`: higher is better, null if it doesn't. */
export function encaje(s, w) {
  if (!compatible(s, w)) return null;
  if (s.inicio && s.fin) {
    const solape = Math.min(s.fin, w.fin) - Math.max(s.inicio, w.inicio);
    if (solape > -HOLGURA) return 2e9 + solape;
    // Logged in the app afterwards, the same day: the watch workout ended before the app session began.
    if (iso(w.inicio) === s.fecha && w.fin <= s.inicio) return 1e9 - (s.inicio - w.fin) / MIN;
    return null;
  }
  // Logged by hand (no times): the same day; with minutes, the closest length wins.
  if (iso(w.inicio) !== s.fecha) return null;
  return 1e9 - (s.duracionMin ? Math.abs(s.duracionMin - (w.fin - w.inicio) / MIN) : 0);
}

/**
 * Decides what to write. `sesiones`: every live session (the app's and the watch-only ones); `relojes`: the watch
 * workouts read; `vistos`: watch ids already handled once (a watch-only session the user deleted isn't made again).
 * Returns { poner: [[id, data]], quitar: [id], vistos: [id] }.
 */
export function emparejar(sesiones, relojes, vistos = [], { crearSueltas = true } = {}) {
  const vistosSet = new Set(vistos);
  const porId = new Map(relojes.map((w) => [w.id, w]));
  const app = sesiones.filter((s) => s.origen !== "reloj");
  const sueltas = new Map(sesiones.filter((s) => s.origen === "reloj" && s.reloj?.id).map((s) => [s.reloj.id, s]));
  const poner = [], quitar = [];
  const limpio = (s) => { const { id, _actualizado, ...d } = s; return d; }; // eslint-disable-line no-unused-vars

  // Sessions already joined keep their workout, with its numbers refreshed (heart rate can arrive later).
  const usados = new Set();
  for (const s of app) {
    if (!s.reloj?.id) continue;
    usados.add(s.reloj.id);
    const w = porId.get(s.reloj.id);
    if (w && !igual(s.reloj, datosReloj(w))) poner.push([s.id, { ...limpio(s), reloj: datosReloj(w) }]);
  }

  // The rest pair up, best fit first. A watch-only session counts as its workout, so a session logged later takes it.
  const libres = [...porId.values(), ...[...sueltas.values()].filter((s) => !porId.has(s.reloj.id)).map((s) => s.reloj)]
    .filter((w) => !usados.has(w.id));
  const pares = [];
  for (const s of app) {
    if (s.reloj?.id) continue;
    for (const w of libres) {
      const p = encaje(s, w);
      if (p != null) pares.push([p, s, w]);
    }
  }
  pares.sort((a, b) => b[0] - a[0]);
  const unidas = new Set();
  for (const [, s, w] of pares) {
    if (unidas.has(s.id) || usados.has(w.id)) continue;
    unidas.add(s.id);
    usados.add(w.id);
    poner.push([s.id, { ...limpio(s), reloj: datosReloj(porId.get(w.id) || w) }]);
  }

  for (const [wid, s] of sueltas) {
    if (usados.has(wid)) quitar.push(s.id);
    else if (porId.has(wid) && !igual(s.reloj, datosReloj(porId.get(wid)))) poner.push([s.id, { ...limpio(s), ...suelta(porId.get(wid)) }]);
  }
  for (const w of porId.values()) {
    if (usados.has(w.id) || sueltas.has(w.id) || vistosSet.has(w.id)) continue;
    if (!crearSueltas || w.categoria === "otro") continue;
    poner.push([`reloj-${w.id}`, suelta(w)]);
  }
  const nuevos = [...porId.keys()].filter((id) => !vistosSet.has(id) && (crearSueltas || usados.has(id)));
  return { poner, quitar, vistos: [...vistos, ...nuevos].slice(-500) };
}

/** A watch workout kept on its own, until a session in the app takes it. */
function suelta(w) {
  return { tipo: w.categoria === "flex" ? "flexibilidad" : "gimnasio", fecha: iso(w.inicio), inicio: w.inicio, fin: w.fin,
    duracionMin: Math.max(1, Math.round((w.fin - w.inicio) / MIN)), nombre: w.titulo || "", notas: "", origen: "reloj", reloj: datosReloj(w) };
}

/**
 * Reads the last `dias` days from Health Connect and writes the joins. Returns { leidas, unidas, sueltas } or
 * { error }. `enCurso`: a session is being done in the app right now, so its workout must wait for it.
 */
export async function importar(plugin, store, { dias = 30, enCurso = false } = {}) {
  let res;
  try {
    const hasta = Date.now();
    res = await plugin.sesiones({ desde: hasta - dias * 864e5, hasta });
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  const relojes = (res?.sesiones || []).filter((w) => w?.id && Number.isFinite(w.inicio) && Number.isFinite(w.fin) && w.fin > w.inicio);
  const sesiones = await store.all("sesiones");
  const vistos = (await store.getMeta("relojVistos")) || [];
  const r = emparejar(sesiones, relojes, vistos, { crearSueltas: !enCurso });
  for (const [id, data] of r.poner) await store.put("sesiones", id, data);
  for (const id of r.quitar) await store.remove("sesiones", id);
  await store.setMeta("relojVistos", r.vistos);
  await store.setMeta("relojLectura", Date.now());
  const ahora = await store.all("sesiones");
  return { leidas: relojes.length, unidas: ahora.filter((s) => s.origen !== "reloj" && s.reloj).length, sueltas: ahora.filter((s) => s.origen === "reloj").length };
}

/* ---------- Body weight ---------- */
// Kept in the record `ajustes/peso` as { pesos: [{ fecha, kg, origen }] }, oldest first, one per day: "hc" from
// Health Connect (a scale, Samsung Health, COROS…), "mano" typed in Perfil. A day typed by hand keeps that value.
const MAX_PESOS = 730;
const kgValido = (kg) => Number.isFinite(kg) && kg >= 20 && kg <= 400;

/** Joins Health Connect readings ({ t, kg }) into the saved list: the day's latest reading, hand-typed days kept. */
export function unirPesos(pesos = [], lecturas = []) {
  const dia = new Map((pesos || []).filter((p) => p?.fecha && kgValido(p.kg)).map((p) => [p.fecha, p]));
  const ultimo = new Map();
  for (const l of lecturas || []) {
    if (!Number.isFinite(l?.t) || !kgValido(l.kg)) continue;
    const f = iso(l.t);
    if (!ultimo.has(f) || ultimo.get(f).t < l.t) ultimo.set(f, l);
  }
  for (const [f, l] of ultimo) {
    if (dia.get(f)?.origen === "mano") continue;
    dia.set(f, { fecha: f, kg: Math.round(l.kg * 10) / 10, origen: "hc" });
  }
  return [...dia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-MAX_PESOS);
}

/** Reads the last `dias` days of body weight and saves them when something changed. → { n } or { error }. */
export async function importarPeso(plugin, store, { dias = 365 } = {}) {
  let res;
  try {
    const hasta = Date.now();
    res = await plugin.peso({ desde: hasta - dias * 864e5, hasta });
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  const antes = (await store.all("ajustes")).find((r) => r.id === "peso")?.pesos || [];
  const pesos = unirPesos(antes, res?.pesos || []);
  if (!igual(pesos, antes)) await store.put("ajustes", "peso", { pesos });
  return { n: pesos.length };
}
