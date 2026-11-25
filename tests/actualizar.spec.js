// Updates from GitHub releases: the Android app's "Actualizar" plugin is faked, and GitHub's API is answered by the test.
const { test, expect } = require("@playwright/test");

const URL_APK = (n) => `https://github.com/buffalonan/flex-and-fit/releases/download/app-v1.${n}/flex-and-fit.apk`;
const release = (n, extra = {}) => ({
  tag_name: `app-v1.${n}`, draft: false, prerelease: false, published_at: "2026-11-25T09:00:00Z",
  html_url: `https://github.com/buffalonan/flex-and-fit/releases/tag/app-v1.${n}`,
  assets: [{ name: "flex-and-fit.apk", size: 4_000_000, browser_download_url: URL_APK(n) }], ...extra,
});

async function abrirComoAndroid(page, { instalada = 40, releases = [release(42), release(41)], permiso = true } = {}) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ json: releases }));
  await page.addInitScript(({ instalada, permiso }) => {
    if (!localStorage.getItem("flexfit.ajustes")) localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    window.__act = { descargas: [], instalar: 0, permiso, oyentes: {}, app: {} };
    const plugins = {
      App: { addListener(n, f) { (window.__act.app[n] ||= []).push(f); }, exitApp() {} },
      Descubrir: { buscar: async () => ({ direcciones: [] }) },
      Actualizar: {
        version: async () => ({ codigo: instalada, nombre: `1.${instalada}`, depuracion: false }),
        addListener: async (n, f) => { window.__act.oyentes[n] = f; return { remove() { delete window.__act.oyentes[n]; } }; },
        descargar: async ({ url }) => {
          window.__act.descargas.push(url);
          window.__act.oyentes.progreso?.({ bytes: 1_000_000, total: 4_000_000 });
          await new Promise((r) => (window.__act.terminar = r));
          return { codigo: 42, nombre: "1.42" };
        },
        permiso: async () => ({ puede: window.__act.permiso }),
        instalar: async () => { window.__act.instalar++; return { estado: window.__act.permiso ? "abierto" : "permiso" }; },
      },
    };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n in plugins, registerPlugin: (n) => plugins[n] };
  }, { instalada, permiso });
  await page.goto("/");
}

test("picks the newest app release with its APK, and only this repo's downloads", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async (lista) => {
    const { elegirRelease } = await import("./actualizar.js");
    return elegirRelease(lista);
  }, [
    release(50, { prerelease: true }),
    release(49, { draft: true }),
    { ...release(48), tag_name: "v2.0" },
    { ...release(47), assets: [{ name: "flex-and-fit.apk", browser_download_url: "https://example.com/app-v1.47/flex-and-fit.apk" }] },
    { ...release(46), assets: [] },
    release(44),
    release(45),
  ]);
  expect(r).toMatchObject({ codigo: 45, version: "1.45", url: URL_APK(45) });
});

test("offers a newer version on start, downloads it and opens Android's installer", async ({ page }) => {
  await abrirComoAndroid(page);
  await expect(page.locator("#actPanel")).toBeVisible();
  await expect(page.locator("#actTexto")).toContainText("Tienes la 1.40 y en GitHub está la 1.42");
  await page.click("#actSi");
  await expect(page.locator("#perfil")).toBeVisible();
  await expect(page.locator("#actEstado")).toContainText("Descargando la 1.42… 25 %");
  await expect(page.locator("#actProgreso")).toBeVisible();
  expect(await page.evaluate(() => window.__act.descargas)).toEqual([URL_APK(42)]);
  await page.evaluate(() => window.__act.terminar());
  await expect(page.locator("#actEstado")).toContainText("Confirma la instalación");
  await expect(page.locator("#actProgreso")).toBeHidden();
  expect(await page.evaluate(() => window.__act.instalar)).toBe(1);
});

test("without permission to install, it opens the settings and installs on return", async ({ page }) => {
  await abrirComoAndroid(page, { permiso: false });
  await page.click("#actSi");
  await page.evaluate(() => window.__act.terminar());
  await expect(page.locator("#actEstado")).toContainText("Permitir de esta fuente");
  // The user allows it in Android's settings and comes back to the app.
  await page.evaluate(() => { window.__act.permiso = true; window.__act.app.resume.forEach((f) => f()); });
  await expect(page.locator("#actEstado")).toContainText("Confirma la instalación");
  expect(await page.evaluate(() => window.__act.instalar)).toBe(2);
});

test("'Ahora no' doesn't ask again for that version, but Perfil still offers it", async ({ page }) => {
  await abrirComoAndroid(page);
  await page.click("#actNo");
  await expect(page.locator("#actPanel")).toBeHidden();
  // Reopened later (past the 6-hour wait): the same version isn't offered on its own again.
  await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("flexfit.actualizacion")); a.comprobada = 0; localStorage.setItem("flexfit.actualizacion", JSON.stringify(a)); });
  await page.reload();
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#actEstado")).toContainText("Hay una versión nueva: 1.42");
  await expect(page.locator("#actPanel")).toBeHidden();
  await expect(page.locator("#actInstalar")).toBeVisible();
});

test("up to date: no offer, and Perfil says so", async ({ page }) => {
  await abrirComoAndroid(page, { instalada: 42 });
  await page.getByRole("button", { name: "Perfil" }).click();
  await page.click("#actBuscar");
  await expect(page.locator("#actEstado")).toHaveText("Versión instalada: 1.42. Tienes la última versión.");
  await expect(page.locator("#actInstalar")).toBeHidden();
  await expect(page.locator("#actPanel")).toBeHidden();
});

test("the web has no updater", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#actCard")).toBeHidden();
});
