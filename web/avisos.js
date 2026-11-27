// Sound cues during a session, so a change of exercise is noticed without looking at the screen: soft harp-like
// notes (plucked partials that fade out by themselves) instead of beeps. A short falling pair says "this is about
// to end", a falling arpeggio "done, let go", a rising one "go", each new stretch or set also vibrating.
//
// The cues are worked out ahead as a list `{ en (ms, wall clock), s (sound) }` from the session's state, every time
// it changes (a step starts, pause, skip, a rest starts or is changed). In the Android app the whole list goes to
// EntrenoPlugin.pitidos(), which plays it natively from the foreground service, so it sounds with the phone locked
// while the web view is frozen; elsewhere tick() plays it with Web Audio.

/* eslint-disable security/detect-object-injection -- step indexes and the fixed sound names below */
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
// `notas`: [ms from the start, Hz]; `vib`: navigator.vibrate pattern (on, off, on…).
export const SONIDOS = {
  pronto: { notas: [[0, E5], [220, C5]] },
  acaba: { notas: [[0, G5], [130, E5], [260, C5]], vib: [180] },
  empieza: { notas: [[0, C5], [110, E5], [220, G5]], vib: [150] },
  lado: { notas: [[0, E5], [110, G5], [220, C6]], vib: [120, 80, 120] },
};
// Harp-ish timbre: a few harmonics, the higher ones dying faster ([multiple, level, decay per second]).
export const PARCIALES = [[1, 1, 2.6], [2, 0.42, 4.5], [3, 0.16, 7], [4, 0.06, 11]];

// The stretching player. `pasos`: its steps ({ tipo: "prep" | "work", seg, lado }), `idx`: the current one, which
// started at `inicio` (ms, pauses already taken out). 3 s before the end of any step of 8 s or more, "pronto" (so
// also before the next stretch starts, the rests between them being 10 s); at the end of a stretch "acaba"; at the
// end of a rest (every stretch has one before it) "empieza", or "lado" for the right side.
export function avisosFlex(pasos, idx, inicio, ahora = Date.now()) {
  const out = [];
  let t0 = inicio;
  for (let j = idx; j < pasos.length; j++) {
    const p = pasos[j], fin = t0 + p.seg * 1000;
    if (p.seg >= 8) out.push({ en: fin - 3000, s: "pronto" });
    if (p.tipo === "work") out.push({ en: fin, s: "acaba" });
    else if (pasos[j + 1]?.tipo === "work") out.push({ en: fin, s: pasos[j + 1].lado === "der" ? "lado" : "empieza" });
    t0 = fin;
  }
  return out.filter((a) => a.en > ahora);
}

// The gym logger's rest between sets, ending at `fin` (ms) after `total` seconds: "pronto" 5 s before (rests of
// 20 s or more) and "empieza" when it's over.
export function avisosDescanso(desc, ahora = Date.now()) {
  if (!desc) return [];
  const out = [];
  if (desc.total >= 20) out.push({ en: desc.fin - 5000, s: "pronto" });
  out.push({ en: desc.fin, s: "empieza" });
  return out.filter((a) => a.en > ahora);
}

// Plays the cues: natively when `nativo` (the Entreno plugin) takes them, otherwise from tick().
export function avisador(nativo) {
  let cola = [];
  let audio = null;
  const tocar = (s) => {
    const son = SONIDOS[s];
    try { if (son.vib) navigator.vibrate?.(son.vib); } catch (e) { /* not supported */ }
    try {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume();
      const t0 = audio.currentTime + 0.02;
      const sal = audio.createGain();
      sal.gain.value = 0.22;
      sal.connect(audio.destination);
      for (const [ms, f] of son.notas) {
        for (const [k, nivel, caida] of PARCIALES) {
          const o = audio.createOscillator(), g = audio.createGain(), t = t0 + ms / 1000;
          o.frequency.value = f * k;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(nivel, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 5 / caida);
          o.connect(g).connect(sal);
          o.start(t);
          o.stop(t + 5 / caida);
        }
      }
    } catch (e) { /* no audio */ }
  };
  return {
    // Web Audio needs a tap first: call it from the tap that starts the session.
    preparar() { try { audio ||= new AudioContext(); audio.resume?.(); } catch (e) { /* no audio */ } },
    programar(lista) {
      cola = [...lista].sort((a, b) => a.en - b.en);
      if (!nativo) return;
      const enviar = cola.map((a) => ({ en: a.en, notas: SONIDOS[a.s].notas, vib: SONIDOS[a.s].vib || [] }));
      // If the plugin can't (an older app), tick() plays them here instead.
      try {
        Promise.resolve(nativo.pitidos({ lista: enviar, parciales: PARCIALES })).catch(() => { nativo = null; });
      } catch (e) { nativo = null; }
    },
    tick(ahora = Date.now()) {
      if (nativo) return;
      while (cola.length && cola[0].en <= ahora) {
        const a = cola.shift();
        if (ahora - a.en < 1500) tocar(a.s); // one missed long ago (the page was asleep) stays silent
      }
    },
    parar() { this.programar([]); },
    tocar,
  };
}
