// The copy of the whole history in the user's Google Drive (Android app only; DrivePlugin.java signs in).
// It lives in the app's own hidden folder (appDataFolder, scope drive.appdata): one JSON file, the same as Perfil's
// "Exportar JSON", with every record ever, deletes included. A copy run first downloads the copy and merges it in
// (newest `actualizado` wins, as with the Mac), then uploads the result if this device has something newer, so a
// fresh install that signs in gets its history back, and an empty device never overwrites a full copy.
export const NOMBRE = "flex-and-fit-copia.json";
const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3";

const fallo = (code, msg) => Object.assign(new Error(msg || code), { code });

async function pedir(token, url, opts = {}) {
  let r;
  try {
    r = await fetch(url, { ...opts, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  } catch (e) {
    throw fallo("red");
  }
  if (r.status === 401) throw fallo("token");
  if (!r.ok) throw fallo("drive", `Drive respondió ${r.status}`);
  return r;
}

/** The signed-in account: { email, nombre }. */
export async function cuenta(token) {
  const r = await (await pedir(token, `${API}/about?fields=user(emailAddress,displayName)`)).json();
  return { email: r.user?.emailAddress || "", nombre: r.user?.displayName || "" };
}

/** The copy in the app's folder, newest first if there were ever two: { id, modifiedTime } or null. */
export async function buscar(token) {
  const q = new URLSearchParams({ spaces: "appDataFolder", q: `name = '${NOMBRE}' and trashed = false`,
    fields: "files(id,modifiedTime)", orderBy: "modifiedTime desc", pageSize: "10" });
  const r = await (await pedir(token, `${API}/files?${q}`)).json();
  return r.files?.[0] || null;
}

export async function descargar(token, id) {
  const r = await pedir(token, `${API}/files/${encodeURIComponent(id)}?alt=media`);
  let obj;
  try { obj = await r.json(); } catch (e) { throw fallo("copia"); }
  if (obj?.app !== "flex-and-fit" || !Array.isArray(obj.registros)) throw fallo("copia");
  return obj;
}

/** Writes the copy (creating the file the first time). Returns its id. */
export async function subir(token, id, copia) {
  if (!id) {
    const r = await pedir(token, `${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: NOMBRE, parents: ["appDataFolder"], mimeType: "application/json" }) });
    id = (await r.json()).id;
    if (!id) throw fallo("drive");
  }
  await pedir(token, `${SUBIDA}/files/${encodeURIComponent(id)}?uploadType=media&fields=id`, { method: "PATCH",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(copia) });
  return id;
}

const ultimo = (registros) => registros.reduce((m, r) => Math.max(m, Number(r.actualizado) || 0), 0);

/**
 * One copy run: download and merge, then upload if this device has anything the copy hasn't.
 * Returns { recuperados (records the copy brought in), registros (in the copy now), subida (whether it uploaded),
 *   ultimo (the newest `actualizado` the copy now has) }.
 */
export async function copiar(token, store) {
  const f = await buscar(token);
  let recuperados = 0, enCopia = 0, ultimoCopia = 0;
  if (f) {
    const copia = await descargar(token, f.id);
    enCopia = copia.registros.length;
    ultimoCopia = ultimo(copia.registros);
    recuperados = await store.unir(copia.registros);
  }
  const local = await store.exportAll();
  const subida = local.registros.length > 0 && (!f || ultimo(local.registros) > ultimoCopia || local.registros.length > enCopia);
  if (subida) await subir(token, f?.id, local);
  return { recuperados, registros: subida ? local.registros.length : enCopia, subida, ultimo: Math.max(ultimo(local.registros), ultimoCopia) };
}

/** Takes back Google's permission (Perfil → Desconectar). The copy stays in Drive. */
export async function revocar(token) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString() });
  } catch (e) { /* offline: the permission stays until revoked in the Google account */ }
}
