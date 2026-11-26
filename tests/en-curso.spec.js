// A session left open when the app closes (Android closed it with the phone locked) is kept on the phone and offered
// again on the next start: continue, save what was done, or discard.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
async function abrirApp(page, { android = false } = {}) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript((android) => {
    if (!sessionStorage.getItem("iniciado")) {
      // Only on the first load: a reload is the app opening again, and must find what the last one left.
      sessionStorage.setItem("iniciado", "1");
      localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    }
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    if (android) {
      window.__entreno = JSON.parse(sessionStorage.getItem("entreno") || "[]");
      const anota = (x) => { window.__entreno.push(x); sessionStorage.setItem("entreno", JSON.stringify(window.__entreno)); };
      const plugins = {
        App: { addListener() {}, exitApp() {} },
        Descubrir: { buscar: async () => ({ direcciones: [] }) },
        Entreno: { empezar: async (o) => anota(["empezar", o.titulo]), terminar: async () => anota(["terminar"]) },
      };
      window.Capacitor = { isNativePlatform: () => true, registerPlugin: (n) => plugins[n] };
    }
  }, android);
  await page.goto("/");
}
const kg = (page, n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="kg"]`);

test("a gym session survives the app closing: its sets, weights and page come back", async ({ page }) => {
  await abrirApp(page);
  await expect(page.locator("#continuarPanel")).toBeHidden();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await kg(page, 0).fill("45");
  await page.click('[data-ck="0-0"]');
  await page.click('[data-ck="0-1"]');
  await page.click("#regSig");
  await expect(page.locator("#regTitulo")).not.toHaveText("Press de banca");
  const segunda = await page.locator("#regTitulo").textContent();
  await page.clock.fastForward(10 * 60000);

  // The app closes and opens again.
  await page.reload();
  await expect(page.locator("#continuarPanel")).toBeVisible();
  await expect(page.locator("#contTexto")).toHaveText("Tren superior · Empuje, empezado hoy a las 10:00 · 2 series hechas.");
  await page.click("#contSeguir");
  await expect(page.locator("#registro")).toBeVisible();
  await expect(page.locator("#regTitulo")).toHaveText(segunda);
  // The clock counts from when it started, not from now.
  await expect(page.locator("#regReloj")).toHaveText(/^1\d:\d\d$/);
  await page.click("#regAnt");
  await expect(kg(page, 0)).toHaveValue("45");
  await expect(kg(page, 4)).toHaveValue("45");
  await expect(page.locator('[data-ck="0-1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-ck="0-2"]')).not.toHaveAttribute("aria-pressed", "true");

  for (let i = 0; i < 6; i++) await page.click("#regSig");
  await expect(page.locator("#resStats")).toContainText("2Series");
  await expect(page.locator("#resStats")).toContainText("720kg");
  // Saved: it isn't offered again.
  await page.reload();
  await expect(page.locator("#lista li, #entrenos").first()).toBeVisible();
  await expect(page.locator("#continuarPanel")).toBeHidden();
});

test("an open session can be saved as it is, or discarded, from the offer", async ({ page }) => {
  await abrirApp(page);
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await page.click('[data-ck="0-0"]');
  await page.reload();
  await page.click("#contGuardar");
  await expect(page.locator("#resumen")).toBeVisible();
  await expect(page.locator("#resStats")).toContainText("1Series");
  await page.click("#resListo");
  await expect(page.locator("#lista li")).toHaveCount(1);

  await page.getByRole("button", { name: "Entrenos" }).click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await page.reload();
  await page.click("#contDescartar");
  await expect(page.locator("#continuarPanel")).toBeHidden();
  await expect(page.locator("#registro")).toBeHidden();
  await page.reload();
  await expect(page.locator("#continuarPanel")).toBeHidden();
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista li")).toHaveCount(1);
});

test("a stretching session comes back paused at the start of the stretch it was on, with what was done", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  // Get ready (10 s) and the full minute of breathing: the first stretch is done. Then halfway into the next one.
  await page.clock.fastForward(11000);
  await page.clock.fastForward(60000);
  await expect(page.locator("#repTitulo")).toHaveText("Gato-camello");
  await page.clock.fastForward(10000);
  await page.reload();
  await expect(page.locator("#contTexto")).toContainText("1 de 9 posturas");
  await page.click("#contSeguir");
  await expect(page.locator("#reproductor")).toBeVisible();
  await expect(page.locator("#repTitulo")).toHaveText("Gato-camello");
  await expect(page.locator("#repSerie")).toHaveText("Prepárate");
  await expect(page.locator("#repPausa")).toHaveText("SEGUIR");
  const t = await page.locator("#repTiempo").textContent();
  await page.clock.fastForward(10000);
  await expect(page.locator("#repTiempo")).toHaveText(t);
  await page.click("#repSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resStats")).toContainText("1/9");
});

test("in the Android app a session keeps a foreground notification while it's open", async ({ page }) => {
  await abrirApp(page, { android: true });
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await expect.poll(() => page.evaluate(() => window.__entreno)).toEqual([["empezar", "Tren superior · Empuje"]]);
  await page.reload();
  await page.click("#contSeguir");
  await page.click("#regSalir");
  await page.click("#salirDescartar");
  await expect.poll(() => page.evaluate(() => window.__entreno)).toEqual([["empezar", "Tren superior · Empuje"], ["empezar", "Tren superior · Empuje"], ["terminar"]]);
});
