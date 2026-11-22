// Flex & Fit, phase 1: screens, quick session log, history, settings, sync with the Mac and JSON backups.
import * as store from "./store.js";
import { syncNow } from "./sync.js";

const $ = (id) => document.getElementById(id);
// html`...` builds markup and escapes every value in it, unless the value was itself built with html`...`.
class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }
// eslint-disable-next-line security/detect-object-injection -- c is one of the five characters in the regex
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const asHTML = (v) => (v instanceof SafeHTML ? v.s : Array.isArray(v) ? v.map(asHTML).join("") : v == null ? "" : esc(v));
// eslint-disable-next-line security/detect-object-injection -- i is the template literal's own index
const html = (strings, ...vals) => new SafeHTML(strings.reduce((out, str, i) => out + str + (i < vals.length ? asHTML(vals[i]) : ""), ""));

const native = !!window.Capacitor?.isNativePlatform?.();
// Where the Mac's server is: the app reaches it over Tailscale; the web page is served by it, so it's the same origin.
// The GitHub Pages demo has no server.
const defaultServer = () => (native ? "http://ferrans-macbook-air:3334" : location.hostname.endsWith("github.io") || location.protocol === "file:" ? "" : location.origin);

const KEY = "flexfit.ajustes";
let ajustes = { servidor: null, token: "", tema: "", tab: "hoy" };
try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(KEY) || "null") }; } catch (e) { /* no storage */ }
const saveAjustes = () => { try { localStorage.setItem(KEY, JSON.stringify(ajustes)); } catch (e) { /* no storage */ } };
const servidor = () => (ajustes.servidor ?? defaultServer()).trim();

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
const fechaLarga = (s) => parse(s).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

/* ---------- Screens ---------- */
const TABS = ["hoy", "historial", "ajustes"];
function show(tab) {
  if (!TABS.includes(tab)) tab = "hoy";
  for (const t of TABS) $(t).hidden = t !== tab;
  document.querySelectorAll(".tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  ajustes.tab = tab;
  saveAjustes();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

const capApp = native ? window.Capacitor.registerPlugin("App") : null;
capApp?.addListener("backButton", () => (ajustes.tab === "hoy" ? capApp.exitApp() : show("hoy")));
capApp?.addListener("resume", () => sync());

/* ---------- Hoy ---------- */
async function renderHoy() {
  const hoy = new Date();
  $("hoyFecha").textContent = hoy.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const lunes = new Date(hoy); lunes.setHours(0, 0, 0, 0); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = iso(lunes);
  const ses = (await store.all("sesiones")).filter((s) => s.fecha >= desde);
  const n = (t) => ses.filter((s) => s.tipo === t).length;
  $("semana").innerHTML = html`<div class="stat"><b>${ses.length}</b><span>sesiones esta semana</span></div>
    <div class="stat"><b>${n("flexibilidad")}</b><span>flexibilidad</span></div>
    <div class="stat"><b>${n("gimnasio")}</b><span>gimnasio</span></div>`;
}

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

/* ---------- Historial ---------- */
async function renderHistorial() {
  const ses = (await store.all("sesiones")).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b._actualizado - a._actualizado);
  $("vacio").hidden = ses.length > 0;
  $("lista").innerHTML = html`${ses.map((s) => html`<li>
    <div class="txt">
      <span class="tipo ${s.tipo === "gimnasio" ? "gimnasio" : ""}">${s.tipo === "gimnasio" ? "Gimnasio" : "Flexibilidad"}${s.rutina ? ` · ${s.rutina}` : ""}</span>
      <div><b>${s.fecha ? fechaLarga(s.fecha) : "Sin fecha"}</b>${s.duracionMin ? ` · ${s.duracionMin} min` : ""}</div>
      ${s.notas ? html`<div class="hint">${s.notas}</div>` : ""}
    </div>
    <button type="button" class="del" data-del="${s.id}" aria-label="Borrar la sesión del ${s.fecha || ""}">Borrar</button>
  </li>`)}`;
}
$("lista").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (id) await store.remove("sesiones", id);
});

/* ---------- Sync ---------- */
const ERRORES = { "sin-conexion": "No encuentro el Mac. Se sincronizará cuando esté encendido y a tu alcance.", clave: "La clave no coincide con la del Mac.", "sin-servidor": "Sin servidor: los datos se quedan solo en este dispositivo." };
let timer = null;
async function sync() {
  const r = await syncNow({ servidor: servidor(), token: ajustes.token });
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
  const ultima = await store.getMeta("ultimaSync");
  if (gen !== renderGen) return;
  const pill = $("syncPill");
  if (!servidor()) { pill.dataset.estado = "local"; pill.textContent = "Solo en este dispositivo"; }
  else if (r && !r.ok) { pill.dataset.estado = "error"; pill.textContent = pend ? `${pend} sin subir` : "Sin conexión con el Mac"; }
  else if (pend) { pill.dataset.estado = "pendiente"; pill.textContent = `${pend} sin subir`; }
  else { pill.dataset.estado = "ok"; pill.textContent = "Sincronizado"; }
  const st = $("syncEstado");
  st.classList.toggle("error", !!(r && !r.ok && r.error !== "sin-servidor"));
  st.textContent = r && !r.ok ? ERRORES[r.error] || `El Mac respondió con un error (${r.error}).`
    : ultima ? `Última sincronización: ${new Date(ultima).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}` : "";
}
const syncSoon = () => { clearTimeout(timer); timer = setTimeout(sync, 1500); };
$("syncPill").addEventListener("click", () => { show("ajustes"); sync(); });
window.addEventListener("online", () => sync());
setInterval(() => sync(), 5 * 60 * 1000);

$("servidor").value = servidor();
$("token").value = ajustes.token || "";
$("servidorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  ajustes.servidor = $("servidor").value.trim().replace(/\/+$/, "");
  ajustes.token = $("token").value;
  saveAjustes();
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

/* ---------- Theme ---------- */
document.querySelectorAll('input[name="tema"]').forEach((r) => {
  r.checked = r.value === (ajustes.tema || "");
  r.addEventListener("change", () => {
    ajustes.tema = r.value;
    saveAjustes();
    if (r.value) document.documentElement.dataset.theme = r.value;
    else delete document.documentElement.dataset.theme;
  });
});

/* ---------- Start ---------- */
async function renderAll() {
  await Promise.all([renderHoy(), renderHistorial()]);
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
sync();
