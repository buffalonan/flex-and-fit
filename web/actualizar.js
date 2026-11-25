// Updates for the Android app: every merge to main publishes a release `app-v1.<n>` with flex-and-fit.apk
// (android.yml), and the app's versionCode is that same <n>. This reads the public releases of the repo and says
// whether one is newer than the installed app; the "Actualizar" plugin (ActualizarPlugin.java) opens its APK link in the browser.
export const REPO = "buffalonan/flex-and-fit";
export const API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
// The only place the plugin opens links to (it checks this too).
export const DESCARGAS = `https://github.com/${REPO}/releases/download/`;

export function numero(tag) {
  const m = /^app-v1\.(\d+)$/.exec(String(tag || ""));
  return m ? Number(m[1]) : null;
}

// The newest published (not draft, not pre-release) app release that has the APK.
export function elegirRelease(lista) {
  let mejor = null;
  for (const r of Array.isArray(lista) ? lista : []) {
    const codigo = numero(r?.tag_name);
    if (!codigo || r.draft || r.prerelease) continue;
    const apk = (r.assets || []).find((a) => a?.name === "flex-and-fit.apk");
    const url = apk?.browser_download_url;
    if (typeof url !== "string" || !url.startsWith(DESCARGAS)) continue;
    if (mejor && mejor.codigo >= codigo) continue;
    mejor = { codigo, version: `1.${codigo}`, url, bytes: apk.size || 0, fecha: r.published_at || "", pagina: r.html_url || "" };
  }
  return mejor;
}

export async function ultimaRelease(fetchFn = fetch) {
  const r = await fetchFn(API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
  return elegirRelease(await r.json());
}

// The installed version: the native versionCode, else the web's <meta name="app-version"> ("1.<n>").
export function codigoDe(version) {
  const m = /^1\.(\d+)$/.exec(String(version || ""));
  return m ? Number(m[1]) : null;
}
