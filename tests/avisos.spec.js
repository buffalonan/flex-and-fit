// Harp-like sound cues (web/avisos.js): before a stretch or a rest ends, and when the next one starts. In a browser
// they're played with Web Audio (recorded here through OscillatorNode.start and navigator.vibrate); in the app the
// whole list goes to the Entreno plugin, which plays it natively with the phone locked.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
const C5 = 523.25, E5 = 659.25;
async function abrirApp(page, { android = false } = {}) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript((android) => {
    localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    window.__vib = [];
    window.__notas = [];
    navigator.vibrate = (p) => { window.__vib.push([Date.now(), p]); return true; };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__notas.push([Date.now(), this.frequency.value]); return start.apply(this, a); };
    if (android) {
      window.__pitidos = [];
      const plugins = {
        App: { addListener() {}, exitApp() {} },
        Descubrir: { buscar: async () => ({ direcciones: [] }) },
        Entreno: { empezar: async () => {}, terminar: async () => {}, pitidos: async (o) => { window.__pitidos.push(o); } },
      };
      window.Capacitor = { isNativePlatform: () => true, registerPlugin: (n) => plugins[n] };
    }
  }, android);
  await page.goto("/");
}
const vib = (page) => page.evaluate(() => window.__vib.map(([, p]) => p));
const notas = (page) => page.evaluate(() => window.__notas.map(([, f]) => Math.round(f * 100) / 100));

test("the cues follow the steps: 'pronto' 3 s before a long stretch ends, 'acaba' at its end, 'empieza' or 'lado' after the prep", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { avisosFlex, avisosDescanso } = await import("./avisos.js");
    const pasos = [
      { tipo: "prep", seg: 5 }, { tipo: "work", seg: 30, lado: "izq" },
      { tipo: "prep", seg: 4 }, { tipo: "work", seg: 30, lado: "der" },
      { tipo: "prep", seg: 3 }, { tipo: "work", seg: 5 },
    ];
    return {
      todo: avisosFlex(pasos, 0, 0, -1),
      luego: avisosFlex(pasos, 1, 5000, 33000),
      descanso: avisosDescanso({ fin: 90000, total: 90 }, 0),
      corto: avisosDescanso({ fin: 10000, total: 10 }, 0),
    };
  });
  expect(r.todo).toEqual([
    { en: 5000, s: "empieza" }, { en: 32000, s: "pronto" }, { en: 35000, s: "acaba" },
    { en: 39000, s: "lado" }, { en: 66000, s: "pronto" }, { en: 69000, s: "acaba" },
    { en: 72000, s: "empieza" }, { en: 77000, s: "acaba" }, // a 5 s stretch has no "pronto"
  ]);
  expect(r.luego[0]).toEqual({ en: 35000, s: "acaba" });
  expect(r.descanso).toEqual([{ en: 85000, s: "pronto" }, { en: 90000, s: "empieza" }]);
  expect(r.corto).toEqual([{ en: 10000, s: "empieza" }]);
});

test("in the browser the player plays harp notes and vibrates, and stays quiet while paused", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#repSerie")).toHaveText("Prepárate");
  expect(await vib(page)).toEqual([]);

  // 5 s to get ready: the breathing starts with a rising arpeggio and a vibration.
  await page.clock.fastForward(5300);
  await expect.poll(() => vib(page)).toEqual([[150]]);
  expect((await notas(page)).filter((f) => f < 800)).toEqual(expect.arrayContaining([C5, E5]));

  // 3 s before the minute ends, a soft falling pair (no vibration); at the end, a falling arpeggio that vibrates.
  await page.evaluate(() => { window.__notas = []; });
  await page.clock.fastForward(57000);
  await expect.poll(() => notas(page)).toContain(E5);
  expect(await vib(page)).toEqual([[150]]);
  await page.clock.fastForward(3000);
  await expect.poll(() => vib(page)).toEqual([[150], [180]]);

  // Paused, nothing sounds.
  await page.click("#repPausa");
  await page.evaluate(() => { window.__notas = []; });
  await page.clock.fastForward(30000);
  await page.clock.fastForward(30000);
  expect(await notas(page)).toEqual([]);
  expect(await vib(page)).toEqual([[150], [180]]);
});

test("in the app the cues go to the native plugin, and pausing or leaving clears them", async ({ page }) => {
  await abrirApp(page, { android: true });
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  const ultima = () => page.evaluate(() => window.__pitidos.at(-1));
  await expect.poll(async () => (await ultima())?.lista.length).toBeGreaterThan(10);
  const l = (await ultima()).lista;
  const t0 = l[0].en - 5000; // when the player started
  expect(t0 - MIERCOLES.getTime()).toBeLessThan(5000);
  expect(l[0]).toEqual({ en: t0 + 5000, notas: [[0, C5], [110, E5], [220, 783.99]], vib: [150] });
  expect(l[1]).toEqual({ en: t0 + 62000, notas: [[0, E5], [220, C5]], vib: [] }); // 3 s before the breathing ends
  expect(l[2]).toMatchObject({ en: t0 + 65000, vib: [180] });
  expect((await ultima()).parciales.length).toBeGreaterThan(1);

  // The web side doesn't play them too.
  await page.clock.fastForward(5300);
  expect(await vib(page)).toEqual([]);

  await page.click("#repPausa");
  await expect.poll(async () => (await ultima()).lista).toEqual([]);
  await page.click("#repPausa");
  await expect.poll(async () => (await ultima()).lista.length).toBeGreaterThan(10);
  // Still on the clock: the breathing's end moved by the pause only.
  expect((await ultima()).lista[1].en).toBeGreaterThanOrEqual(t0 + 62000);

  await page.click("#repSalir");
  await page.click("#salirDescartar");
  await expect.poll(async () => (await ultima()).lista).toEqual([]);
});

test("the gym rest timer: 'pronto' 5 s before it ends and 'empieza' when it's over", async ({ page }) => {
  await abrirApp(page, { android: true });
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await page.click('[data-ck="0-0"]');
  const ultima = () => page.evaluate(() => window.__pitidos.at(-1));
  await expect.poll(async () => (await ultima())?.lista.length).toBe(2);
  const [pronto, empieza] = (await ultima()).lista;
  expect(empieza.en - pronto.en).toBe(5000);
  expect(empieza.vib).toEqual([150]);
  expect(pronto.vib).toEqual([]);
  // +15 s moves them.
  await page.click("#regMas");
  await expect.poll(async () => (await ultima()).lista[1].en).toBe(empieza.en + 15000);
  await page.click("#regFinDesc");
  await expect.poll(async () => (await ultima()).lista).toEqual([]);
});

test("the player keeps to the clock after the page was asleep, as the native cues did", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  // One jump of 70 s (timers fire once, like a frozen web view waking up): 5 s prep + 60 s breathing + 5 s prep.
  await page.clock.fastForward(70000);
  await expect(page.locator("#repTitulo")).toHaveText("Gato-camello");
  await expect(page.locator("#repSerie")).not.toHaveText("Prepárate");
});
