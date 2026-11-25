// The app's language: Spanish by default; English, German and Catalan chosen in Perfil, kept on this device.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
async function abrirApp(page, idioma) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript((idioma) => {
    // Only the first load: later reloads keep what the app saved (the language picked in Perfil).
    if (!sessionStorage.getItem("iniciado")) {
      sessionStorage.setItem("iniciado", "1");
      localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "", ...(idioma ? { idioma } : {}) }));
    }
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
  }, idioma);
  await page.goto("/");
  // The app's module waits for its dictionary (top-level await), which can end after the page's load event: wait
  // until it has run (it fills in the version), so the static texts are already translated.
  await expect(page.locator("#version")).not.toBeEmpty();
}

test("Perfil changes the language, and it stays after reopening the app", async ({ page }) => {
  await abrirApp(page);
  await expect(page.locator(".tabs")).toContainText("Entrenos");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#idioma option")).toHaveText(["Español", "English", "Deutsch", "Català"]);
  await expect(page.locator("#idioma")).toHaveValue("es");

  await Promise.all([page.waitForEvent("load"), page.locator("#idioma").selectOption("en")]);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Back on Perfil, now in English.
  await expect(page.locator("#perTitle")).toHaveText("Profile");
  await expect(page.locator("#idioma")).toHaveValue("en");
  await expect(page.locator(".tabs")).toContainText("Workouts");
  await page.getByRole("button", { name: "Workouts" }).click();
  await expect(page.locator("#hoyCard")).toContainText("Phase 1 · Awaken");
  await expect(page.locator("#planPos")).toHaveText("Week 1 · F1");
  await expect(page.locator("#hoyFecha")).toHaveText(/Wednesday/);

  await page.reload();
  await expect(page.locator(".tabs")).toContainText("Workouts");

  await page.getByRole("button", { name: "Profile" }).click();
  await Promise.all([page.waitForEvent("load"), page.locator("#idioma").selectOption("ca")]);
  await expect(page.locator(".tabs")).toContainText("Entrenaments");
  await Promise.all([page.waitForEvent("load"), page.locator("#idioma").selectOption("es")]);
  await expect(page.locator(".tabs")).toContainText("Entrenos");
  await expect(page.locator("#perTitle")).toHaveText("Perfil");
});

test("every exercise, plan and workout has its translation", async ({ page }) => {
  for (const idioma of ["en", "de", "ca"]) {
    await abrirApp(page, idioma);
    const faltan = await page.evaluate(async () => {
      const { t, faltan } = await import("./i18n.js");
      const d = await import("./datos.js");
      const { NOMBRES } = await import("./maniqui.js");
      for (const e of Object.values(d.EX)) [e.n, e.z, ...e.c].forEach((s) => t(s));
      for (const p of [...d.PH, d.SUAVE]) [p.name, p.goal, ...(p.adv || []), ...p.items.map((i) => i[2]).filter(Boolean)].forEach((s) => t(s));
      for (const w of d.GYM) [w.n, w.sub, w.maquinas, ...w.notas, ...w.ej.flatMap((e) => [e.n, ...(e.c || [])])].forEach((s) => t(s));
      d.TESTS.forEach(([, l]) => t(l));
      Object.values(NOMBRES).forEach((s) => t(s));
      return [...faltan];
    });
    expect(faltan, idioma).toEqual([]);
    await page.evaluate(() => sessionStorage.clear());
  }
});

for (const idioma of ["en", "de", "ca"]) {
  test(`every screen is in ${idioma}, with nothing left in Spanish`, async ({ page }) => {
    await abrirApp(page, idioma);
    // What's on screen now: no text left in Spanish that has a translation, and the page fits the phone.
    const revisar = async (donde) => {
      const r = await page.evaluate(async (idioma) => {
        const dic = (await import(`./idiomas/${idioma}.js`)).default;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const quedan = [];
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const s = n.nodeValue.trim();
          if (s && Object.hasOwn(dic, s) && dic[s] !== s && !n.parentElement.closest("[hidden]")) quedan.push(s);
        }
        return { quedan, ancho: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, idioma);
      expect(r.quedan, donde).toEqual([]);
      expect(r.ancho, `${donde}: no sideways scrolling`).toBeLessThanOrEqual(0);
    };
    const tab = (i) => page.locator(".tabs button").nth(i).click();

    await revisar("entrenos");
    // A stretching routine, one of its stretches, and the player.
    await page.locator('#listaFlex [data-abrir="F3"]').click();
    await revisar("flex detail");
    await page.locator("#detLista li.ej").nth(3).click();
    await revisar("stretch sheet");
    await page.locator("#fichaEmpezar").click();
    await expect(page.locator("#reproductor")).toBeVisible();
    await revisar("player");
    await page.clock.fastForward(6000);
    await revisar("player, working");
    await page.locator("#repSalir").click();
    await revisar("leaving");
    await page.locator("#salirGuardar").click();
    await expect(page.locator("#resumen")).toBeVisible();
    await revisar("flex summary");
    await page.locator("#resListo").click();

    // A gym workout with a circuit, one of its exercises, and the logger.
    await tab(0);
    await page.locator('#listaFuerza [data-abrir="g4"]').click();
    await revisar("gym detail");
    await page.locator("#detLista li.ej").first().click();
    await revisar("gym sheet");
    await page.locator("#fichaSalir").click();
    await page.locator("#detEmpezar").click();
    await expect(page.locator("#registro")).toBeVisible();
    await page.locator("#regFilas [data-ck]").first().click();
    await revisar("logger");
    for (let i = 0; i < 5; i++) await page.locator("#regSig").click();
    await revisar("logger, circuit");
    await page.locator("#regSig").click();
    await expect(page.locator("#resumen")).toBeVisible();
    await revisar("gym summary");
    await page.locator("#resListo").click();
    await revisar("history");
    // Both sessions just saved, opened from the history.
    for (const i of [0, 1]) {
      await page.locator("#lista [data-ver]").nth(i).click();
      await expect(page.locator("#sesion")).toBeVisible();
      await revisar(`session ${i}`);
      await page.locator("#sesEditar").click();
      await expect(page.locator("#editar")).toBeVisible();
      await revisar(`editing session ${i}`);
      await page.locator("#edCancelar").click();
      await page.locator("#sesVolver").click();
    }

    await tab(1);
    await revisar("progress");
    await tab(3);
    await revisar("profile");

    // And every text the app asked for had a translation.
    expect(await page.evaluate(async () => [...(await import("./i18n.js")).faltan])).toEqual([]);
  });
}
