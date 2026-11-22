// Sends this device's pending records to the Mac and brings back everything newer than the last sync.
// On the phone the Mac is reached over Tailscale; when it's asleep or out of reach the records just wait.
import * as store from "./store.js";

let running = null;
let again = false;

/**
 * One sync round. Resolves to { ok, enviados, recibidos } or { ok: false, error }.
 * `servidor` is the base URL ("" means there's no server, e.g. the GitHub Pages demo).
 */
export function syncNow({ servidor, token }) {
  if (!servidor) return Promise.resolve({ ok: false, error: "sin-servidor" });
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let enviados = 0, recibidos = 0;
    try {
      do {
        again = false;
        let mas = true;
        let primera = true;
        while (mas) {
          const desde = (await store.getMeta("seq")) || 0;
          const pend = primera ? await store.pending() : [];
          const res = await fetch(`${servidor.replace(/\/+$/, "")}/api/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ desde, cambios: pend.map(({ tabla, id, data, actualizado, borrado }) => ({ tabla, id, data, actualizado, borrado })) }),
            signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
          });
          if (res.status === 401) return { ok: false, error: "clave" };
          if (!res.ok) return { ok: false, error: `http-${res.status}` };
          const r = await res.json();
          await store.markSent(pend);
          recibidos += await store.applyRemote(r.cambios || []);
          await store.setMeta("seq", r.seq);
          enviados += pend.length;
          mas = !!r.mas;
          primera = false;
        }
      } while (again);
      await store.setMeta("ultimaSync", Date.now());
      return { ok: true, enviados, recibidos };
    } catch (e) {
      return { ok: false, error: "sin-conexion" };
    } finally {
      running = null;
    }
  })();
  return running;
}
