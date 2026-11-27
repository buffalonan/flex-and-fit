// A short YouTube clip of an exercise, shown on demand in its sheet (VIDEOS in datos.js: { id, ini, fin, canal }).
// The clip plays muted, from ini to fin seconds, again and again, from youtube-nocookie.com, and only loads when it's
// asked for, so nothing goes to YouTube otherwise. It needs internet: offline, the animated figure is all there is.
// YouTube's terms allow embedding but not downloading, so the clips can't be kept on the phone.

const ORIGEN = "https://www.youtube-nocookie.com";

/** The embed address of a clip: muted, inline, with no related videos at the end. */
export function urlVideo(v) {
  const q = new URLSearchParams({ start: v.ini, end: v.fin, autoplay: 1, mute: 1, playsinline: 1, rel: 0, enablejsapi: 1 });
  return `${ORIGEN}/embed/${encodeURIComponent(v.id)}?${q}`;
}

/** The clip on YouTube itself, at its start (when the embedded player can't play it). */
export const urlYoutube = (v) => `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}&t=${v.ini}s`;

/**
 * Loops the clip in `iframe`: the embedded player stops at `end`, so on its "ended" state it's sent back to `ini`.
 * Uses the player's postMessage interface (enablejsapi=1), with no YouTube script on the page.
 * Returns a function that stops listening.
 */
export function enBucle(iframe, v) {
  const enviar = (msg) => iframe.contentWindow?.postMessage(JSON.stringify(msg), ORIGEN);
  const escuchar = () => enviar({ event: "listening", id: v.id, channel: "widget" });
  const alMensaje = (ev) => {
    if (ev.origin !== ORIGEN || ev.source !== iframe.contentWindow) return;
    let d;
    try { d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch (e) { return; }
    const estado = d?.event === "onStateChange" ? d.info : d?.event === "infoDelivery" ? d.info?.playerState : undefined;
    if (estado === 0) {
      enviar({ event: "command", func: "seekTo", args: [v.ini, true] });
      enviar({ event: "command", func: "playVideo", args: [] });
    }
  };
  window.addEventListener("message", alMensaje);
  iframe.addEventListener("load", escuchar);
  return () => window.removeEventListener("message", alMensaje);
}
