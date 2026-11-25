// Updates from GitHub releases: the Android app's "Actualizar" plugin is faked, and GitHub's API is answered by the test.
const { test, expect } = require("@playwright/test");

const URL_APK = (n) => `https://github.com/buffalonan/flex-and-fit/releases/download/app-v1.${n}/flex-and-fit.apk`;
const release = (n, extra = {}) => ({
  tag_name: `app-v1.${n}`, draft: false, prerelease: false, published_at: "2026-11-25T09:00:00Z",
  html_url: `https://github.com/buffalonan/flex-and-fit/releases/tag/app-v1.${n}`,
  assets: [{ name: "flex-and-fit.apk", size: 4_000_000, browser_download_url: URL_APK(n) }], ...extra,
});

async function abrirComoAndroid(page, { instalada = 40, releases = [release(42), release(41)], falla, idioma } = {}) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ json: releases }));
  await page.addInitScript(({ instalada, falla, idioma }) => {
    if (!localStorage.getItem("flexfit.ajustes")) localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "", ...(idioma ? { idioma } : {}) }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    window.__act = { abiertas: [], app: {} };
    const plugins = {
      App: { addListener(n, f) { (window.__act.app[n] ||= []).push(f); }, exitApp() {} },
      Descubrir: { buscar: async () => ({ direcciones: [] }) },
      Actualizar: {
        version: async () => ({ codigo: instalada, nombre: `1.${instalada}`, depuracion: false }),
        abrir: async ({ url }) => {
          window.__act.abiertas.push(url);
          if (falla) throw Object.assign(new Error("x"), { code: falla });
        },
      },
    };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n in plugins, registerPlugin: (n) => plugins[n] };
  }, { instalada, falla, idioma });
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

test("offers a newer version on start and opens its APK in the browser (the app installs nothing itself)", async ({ page }) => {
  await abrirComoAndroid(page);
  await expect(page.locator("#actPanel")).toBeVisible();
  await expect(page.locator("#actTexto")).toContainText("Tienes la 1.40 y en GitHub está la 1.42");
  await expect(page.locator("#actTexto")).toContainText("Chrome la descarga");
  await page.click("#actSi");
  await expect(page.locator("#perfil")).toBeVisible();
  await expect(page.locator("#actEstado")).toContainText("Chrome está descargando la 1.42");
  expect(await page.evaluate(() => window.__act.abiertas)).toEqual([URL_APK(42)]);
});

test("if the browser can't be opened, it says so and lets you try again", async ({ page }) => {
  await abrirComoAndroid(page, { falla: "navegador" });
  await page.click("#actSi");
  await expect(page.locator("#actEstado")).toContainText("No se pudo abrir el navegador.");
  await expect(page.locator("#actEstado")).toHaveClass(/error/);
  await expect(page.locator("#actInstalar")).toBeEnabled();
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

for (const idioma of ["en", "de", "ca"]) {
  test(`the updater's texts are translated (${idioma})`, async ({ page }) => {
    await abrirComoAndroid(page, { idioma });
    await expect(page.locator("#actPanel")).toBeVisible();
    await expect(page.locator("#actTexto")).not.toContainText(/Tienes la|Chrome la descarga/);
    await page.click("#actSi");
    await expect(page.locator("#actEstado")).not.toHaveText(/Chrome está|Versión instalada/);
    await page.click("#actBuscar");
    await expect(page.locator("#actEstado")).not.toHaveText(/Buscando/);
    expect(await page.evaluate(async () => [...(await import("./i18n.js")).faltan])).toEqual([]);
  });
}

// Google Play Protect blocked the APK as harmful while the app could install APKs itself.
test("the Android app doesn't ask to install other apps", () => {
  const manifest = require("node:fs").readFileSync(require("node:path").join(__dirname, "../android/app/src/main/AndroidManifest.xml"), "utf8");
  expect(manifest).not.toContain("REQUEST_INSTALL_PACKAGES");
});
