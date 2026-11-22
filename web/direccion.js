// Finding the Mac from the phone, so its address doesn't have to be typed: the app tries every address it
// knows (/api/salud) and keeps the one that answers first, learns the Mac's other addresses (home Wi-Fi,
// Tailscale) from that answer, and on the home Wi-Fi can find the Mac's Bonjour announcement
// (_flexandfit._tcp, published by the Mac's launch agent). Addresses are only ever stored on the device.

/** The origin of a typed or discovered address, or null if it isn't an http(s) URL. */
export function origen(u) {
  try {
    const x = new URL(String(u).trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.origin : null;
  } catch (e) {
    return null;
  }
}

/** Unique origins, in order, at most `max`. */
export function unir(listas, max = 6) {
  const out = [];
  for (const u of listas.flat()) {
    const o = origen(u);
    if (o && !out.includes(o)) out.push(o);
  }
  return out.slice(0, max);
}

const conTiempo = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), ms))]);

/** Asks one address for /api/salud: { servidor, direcciones } if it's a Flex & Fit server, else null. */
export async function salud(base, ms = 3000) {
  try {
    const res = await conTiempo(fetch(`${base}/api/salud`, { signal: AbortSignal.timeout?.(ms) }), ms);
    if (!res.ok) return null;
    const r = await res.json();
    if (r?.ok !== true) return null;
    return { servidor: base, direcciones: unir([Array.isArray(r.direcciones) ? r.direcciones : []]) };
  } catch (e) {
    return null;
  }
}

/** Tries every address at once and returns the first to answer ({ servidor, direcciones }), or null. */
export async function elegir(lista, ms = 3000) {
  const todas = unir([lista], 20);
  if (!todas.length) return null;
  return Promise.any(todas.map(async (u) => (await salud(u, ms)) || Promise.reject(new Error("no")))).catch(() => null);
}

/** On the Android app, the Mac's addresses announced on this Wi-Fi (Bonjour), or [] anywhere else. */
export async function buscarEnWifi(plugin, ms = 4000) {
  if (!plugin) return [];
  try {
    const r = await conTiempo(plugin.buscar({ ms }), ms + 3000);
    return unir([Array.isArray(r?.direcciones) ? r.direcciones : []], 20);
  } catch (e) {
    return [];
  }
}
