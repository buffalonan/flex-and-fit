// Local-first storage: every record lives in this device's IndexedDB, so the app works with no connection
// (at the gym). Records marked `pendiente` haven't reached the Mac yet; sync.js sends them.
// A record is { key: "tabla:id", tabla, id, data, actualizado (ms), borrado, pendiente }.
const DB_NAME = "flexfit";
let dbp = null;

function open() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const r = db.createObjectStore("registros", { keyPath: "key" });
      r.createIndex("tabla", "tabla");
      r.createIndex("pendiente", "pendiente");
      db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const done = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
async function tx(stores, mode, fn) {
  const db = await open();
  const t = db.transaction(stores, mode);
  const out = await fn(t);
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
  return out;
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

// Never go back in time, even if two edits land in the same millisecond or the clock moves backwards.
let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const changed = (origen) => listeners.forEach((fn) => fn(origen));

export async function put(tabla, id, data) {
  const r = { key: `${tabla}:${id}`, tabla, id, data, actualizado: stamp(), borrado: false, pendiente: 1 };
  await tx(["registros"], "readwrite", (t) => done(t.objectStore("registros").put(r)));
  changed("local");
  return r;
}

export async function remove(tabla, id) {
  const key = `${tabla}:${id}`;
  await tx(["registros"], "readwrite", async (t) => {
    const s = t.objectStore("registros");
    const old = await done(s.get(key));
    if (old) await done(s.put({ ...old, data: {}, borrado: true, actualizado: stamp(), pendiente: 1 }));
  });
  changed("local");
}

export async function all(tabla) {
  const rows = await tx(["registros"], "readonly", (t) => done(t.objectStore("registros").index("tabla").getAll(tabla)));
  return rows.filter((r) => !r.borrado).map((r) => ({ id: r.id, ...r.data, _actualizado: r.actualizado }));
}

export const pending = () => tx(["registros"], "readonly", (t) => done(t.objectStore("registros").index("pendiente").getAll(1)));

/** After the Mac accepted them: clear `pendiente` on records that weren't edited again meanwhile. */
export async function markSent(sent) {
  await tx(["registros"], "readwrite", async (t) => {
    const s = t.objectStore("registros");
    for (const r of sent) {
      const cur = await done(s.get(r.key));
      if (cur && cur.actualizado === r.actualizado) await done(s.put({ ...cur, pendiente: 0 }));
    }
  });
}

/** Records from the Mac. The newest `actualizado` wins, as on the server. */
export async function applyRemote(cambios) {
  let n = 0;
  await tx(["registros"], "readwrite", async (t) => {
    const s = t.objectStore("registros");
    for (const c of cambios) {
      const key = `${c.tabla}:${c.id}`;
      const cur = await done(s.get(key));
      if (cur && cur.actualizado >= c.actualizado) continue;
      await done(s.put({ key, tabla: c.tabla, id: c.id, data: c.data || {}, actualizado: c.actualizado, borrado: !!c.borrado, pendiente: 0 }));
      lastStamp = Math.max(lastStamp, c.actualizado);
      n++;
    }
  });
  if (n) changed("remoto");
  return n;
}

export const getMeta = (k) => tx(["meta"], "readonly", (t) => done(t.objectStore("meta").get(k)));
export const setMeta = (k, v) => tx(["meta"], "readwrite", (t) => done(t.objectStore("meta").put(v, k)));

/** Every record, including deletes, for the JSON backup. */
export async function exportAll() {
  const rows = await tx(["registros"], "readonly", (t) => done(t.objectStore("registros").getAll()));
  return { app: "flex-and-fit", version: 1, exportado: new Date().toISOString(),
    registros: rows.map(({ tabla, id, data, actualizado, borrado }) => ({ tabla, id, data, actualizado, borrado })) };
}

/**
 * Merges a copy's records (the Drive copy): the newest `actualizado` wins, and what came in is marked pending so it
 * reaches the Mac too. Unlike importJSON it doesn't mark records that were already the same. Returns how many changed.
 */
export async function unir(registros) {
  let n = 0;
  await tx(["registros"], "readwrite", async (t) => {
    const s = t.objectStore("registros");
    for (const c of registros) {
      if (!c || typeof c.tabla !== "string" || typeof c.id !== "string" || !Number.isFinite(c.actualizado)) continue;
      const key = `${c.tabla}:${c.id}`;
      const cur = await done(s.get(key));
      if (cur && cur.actualizado >= c.actualizado) continue;
      await done(s.put({ key, tabla: c.tabla, id: c.id, data: c.data || {}, actualizado: c.actualizado, borrado: !!c.borrado, pendiente: 1 }));
      lastStamp = Math.max(lastStamp, c.actualizado);
      n++;
    }
  });
  if (n) changed("local");
  return n;
}

/** Imports a Flex & Fit backup, or the JSON copied from the 6-month flexibility plan. Returns how many records changed. */
export async function importJSON(obj) {
  if (obj?.app === "flex-and-fit" && Array.isArray(obj.registros)) {
    const n = await applyRemote(obj.registros);
    // Imported records must reach the Mac too.
    await tx(["registros"], "readwrite", async (t) => {
      const s = t.objectStore("registros");
      for (const r of obj.registros) {
        const cur = await done(s.get(`${r.tabla}:${r.id}`));
        if (cur && cur.actualizado === r.actualizado) await done(s.put({ ...cur, pendiente: 1 }));
      }
    });
    if (n) changed("local");
    return n;
  }
  if (obj?.plan === "flexibilidad-6m-v1") {
    let n = 0;
    for (const s of obj.sesiones || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) continue;
      await put("sesiones", `plan-${s.fecha}`, { tipo: "flexibilidad", fecha: s.fecha, rutina: s.rutina, fase: s.fase, semana: s.semana,
        duracionMin: s.duracionMin ?? null, intensidad: s.intensidad ?? null, notas: s.notas || "", ejercicios: s.ejercicios || [] });
      n++;
    }
    for (const tst of obj.tests || []) {
      if (!Number.isInteger(tst.fase)) continue;
      await put("tests", `fase-${tst.fase}`, { ...tst });
      n++;
    }
    if (obj.inicio) await put("ajustes", "plan-flexibilidad", { plan: obj.plan, inicio: obj.inicio });
    return n;
  }
  throw new Error("Este JSON no es una copia de Flex & Fit ni del plan de flexibilidad.");
}
