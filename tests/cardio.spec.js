// Cardio before or after the weights (elliptical, treadmill, bike, rowing…): added on the fly in the logger or the
// summary, kept through an app restart, shown in the history and kept out of the strength numbers.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
async function abrirApp(page) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("iniciado")) {
      sessionStorage.setItem("iniciado", "1");
      localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    }
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
  });
  await page.goto("/");
}
const guardadas = (page) => page.evaluate(async () => (await (await import("./store.js")).all("sesiones")).filter((s) => s.fecha === "2026-11-25"));
async function empezarG1(page) {
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#registro")).toBeVisible();
}
async function campo(page, k, v) { await page.fill(`#cardioCampos input[data-campo="${k}"]`, v); }

test("cardio before and after the weights is saved on the session, apart from the volume, and shown in the history", async ({ page }) => {
  await abrirApp(page);
  await empezarG1(page);
  // Before any set: warm-up on the treadmill, with the treadmill's own fields.
  await page.click("#regCardio [data-cardio-add]");
  await expect(page.locator("#cardioPanel")).toBeVisible();
  await expect(page.locator('#cardioForm input[value="antes"]')).toBeChecked();
  await page.click('#cardioTipos [data-tipo="cinta"]');
  await expect(page.locator('#cardioTipos [data-tipo="cinta"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#cardioCampos input")).toHaveCount(5);
  // The minutes are needed.
  await page.click("#cardioGuardar");
  await expect(page.locator("#cardioError")).toHaveText("Apunta los minutos, entre 1 y 300.");
  await campo(page, "min", "10");
  await campo(page, "kmh", "5.5");
  await campo(page, "incl", "8");
  await page.click("#cardioGuardar");
  await expect(page.locator("#cardioPanel")).toBeHidden();
  await expect(page.locator("#regCardio .cardio-it")).toHaveText(["Cinta · 10 min✕"]);

  // A set, then the next page still shows it; and the app closing keeps it.
  await page.click('[data-ck="0-0"]');
  await page.click("#regSig");
  await expect(page.locator("#regCardio .cardio-it")).toHaveCount(1);
  await page.reload();
  await page.click("#contSeguir");
  await expect(page.locator("#regCardio .cardio-it")).toHaveText(["Cinta · 10 min✕"]);

  // After a set: the rowing machine counts as after. Change it once added.
  await page.click("#regCardio [data-cardio-add]");
  await expect(page.locator('#cardioForm input[value="despues"]')).toBeChecked();
  await page.click('#cardioTipos [data-tipo="remo"]');
  await expect(page.locator('#cardioCampos input[data-campo="incl"]')).toHaveCount(0);
  await campo(page, "min", "8");
  await campo(page, "km", "1.6");
  await page.click("#cardioGuardar");
  await page.click('#regCardio [data-cardio-ed="1"]');
  await expect(page.locator("#cardioTit")).toHaveText("Cambiar cardio");
  await expect(page.locator('#cardioCampos input[data-campo="km"]')).toHaveValue("1.6");
  await campo(page, "nivel", "6");
  await page.click("#cardioGuardar");
  await expect(page.locator("#regCardio .cardio-it")).toHaveText(["Cinta · 10 min✕", "Remo · 8 min✕"]);

  await page.click("#regSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resumen")).toBeVisible();
  await expect(page.locator("#resCardio")).toContainText("18 min");
  // Bike after finishing, from the summary; and the rowing taken out again.
  await page.click("#resCardio [data-cardio-add]");
  await expect(page.locator('#cardioForm input[value="despues"]')).toBeChecked();
  await page.click('#cardioTipos [data-tipo="bici"]');
  await campo(page, "min", "15");
  await campo(page, "kcal", "120");
  await page.click("#cardioGuardar");
  await page.click('#resCardio [data-cardio-del="1"]');
  await expect(page.locator("#resCardio .cardio-it")).toHaveText(["Cinta · 10 min✕", "Bici estática · 15 min✕"]);
  await page.click('#resEsf [data-esf="6"]');
  await expect.poll(async () => (await guardadas(page))[0]?.cardio?.length).toBe(2);
  const [s] = await guardadas(page);
  expect(s.esfuerzo).toBe(6);
  expect(s.cardio).toEqual([
    { tipo: "cinta", momento: "antes", min: 10, kmh: 5.5, incl: 8 },
    { tipo: "bici", momento: "despues", min: 15, kcal: 120 },
  ]);
  // Not in the strength numbers: the volume is only the bench press set.
  expect(s.ejercicios.flatMap((e) => e.series).filter((x) => x.hecho)).toHaveLength(1);
  expect(s.volumenKg).toBe(s.ejercicios[0].series[0].kg * s.ejercicios[0].series[0].reps);

  await page.click("#resListo");
  await expect(page.locator("#lista li").first()).toContainText("cardio 25 min");
  await page.locator("#lista [data-ver]").first().click();
  await expect(page.locator("#sesStats")).toContainText("25minCardio");
  await expect(page.locator("#sesCardio li")).toHaveText([
    "CintaAntes de la fuerza · 10 min · 5,5 km/h · inclinación 8 %",
    "Bici estáticaDespués de la fuerza · 15 min · 120 kcal",
  ]);
  await expect(page.locator("#sesLista .ej")).toHaveCount(s.ejercicios.length);
});

test("a session with no cardio shows no cardio card, and Cancelar adds nothing", async ({ page }) => {
  await abrirApp(page);
  await empezarG1(page);
  await page.click("#regCardio [data-cardio-add]");
  await campo(page, "min", "12");
  await page.click("#cardioCancelar");
  await expect(page.locator("#regCardio .cardio-it")).toHaveCount(0);
  await page.click('[data-ck="0-0"]');
  await page.click("#regSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resCardio")).toBeVisible();
  await expect(page.locator("#resCardio .cardio-it")).toHaveCount(0);
  expect((await guardadas(page))[0].cardio).toBeUndefined();
  await page.click("#resListo");
  await page.locator("#lista [data-ver]").first().click();
  await expect(page.locator("#sesCardio")).toBeHidden();
  await expect(page.locator("#sesStats")).not.toContainText("Cardio");
});

test("cardio can be added to, changed in or removed from a past gym session by editing it", async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(async () => (await import("./store.js")).put("sesiones", "a", { tipo: "gimnasio", fecha: "2026-11-24", rutina: "g1", nombre: "Tren superior · Empuje",
    ejercicios: [{ n: "Press de banca", series: [{ kg: 40, reps: 8, hecho: true }] }], cardio: [{ tipo: "eliptica", momento: "antes", min: 10 }] }));
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="a"]');
  await page.click("#sesEditar");
  await expect(page.locator("#edCardio .cardio-it")).toHaveText(["Elíptica · 10 min✕"]);
  await page.click("#edCardio [data-cardio-add]");
  await page.click('#cardioTipos [data-tipo="remo"]');
  await page.fill('#cardioCampos input[data-campo="min"]', "6");
  await page.click("#cardioGuardar");
  await page.click('#edCardio [data-cardio-del="0"]');
  // Nothing is written until Guardar.
  expect((await page.evaluate(async () => (await (await import("./store.js")).all("sesiones")).find((s) => s.id === "a"))).cardio).toHaveLength(1);
  await page.click("#edGuardar");
  await expect(page.locator("#sesCardio li")).toHaveText(["RemoDespués de la fuerza · 6 min"]);
  const s = await page.evaluate(async () => (await (await import("./store.js")).all("sesiones")).find((s) => s.id === "a"));
  expect(s.cardio).toEqual([{ tipo: "remo", momento: "despues", min: 6 }]);
  expect(s.volumenKg).toBe(320);
});

test("stretching sessions take cardio too: in the player, the summary and when editing", async ({ page }) => {
  await abrirApp(page);
  await page.locator('#listaFlex [data-abrir="F1"]').click();
  await page.click("#detEmpezar");
  await expect(page.locator("#reproductor")).toBeVisible();
  // Before any stretch: before stretching; the player stops while the form is open.
  await page.click("#repCardio [data-cardio-add]");
  await expect(page.locator("#cardioAntes")).toHaveText("Antes de estirar");
  await expect(page.locator('#cardioForm input[value="antes"]')).toBeChecked();
  await expect(page.locator("#repPausa")).toHaveText("SEGUIR");
  await page.click('#cardioTipos [data-tipo="bici"]');
  await campo(page, "min", "10");
  await page.click("#cardioGuardar");
  await expect(page.locator("#repCardio .cardio-it")).toHaveText(["Bici estática · 10 min✕"]);
  // The app closing keeps it.
  await page.reload();
  await page.click("#contSeguir");
  await expect(page.locator("#repCardio .cardio-it")).toHaveText(["Bici estática · 10 min✕"]);
  await page.click("#repSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resCardio")).toBeVisible();
  await page.click("#resCardio [data-cardio-add]");
  await expect(page.locator("#cardioDespues")).toHaveText("Después de estirar");
  await page.click('#cardioTipos [data-tipo="eliptica"]');
  await campo(page, "min", "15");
  await page.click("#cardioGuardar");
  await expect.poll(async () => (await guardadas(page))[0]?.cardio?.length).toBe(2);
  expect((await guardadas(page))[0].cardio).toEqual([{ tipo: "bici", momento: "antes", min: 10 }, { tipo: "eliptica", momento: "despues", min: 15 }]);

  await page.click("#resListo");
  await expect(page.locator("#lista li").first()).toContainText("cardio 25 min");
  await page.locator("#lista [data-ver]").first().click();
  await expect(page.locator("#sesStats")).toContainText("25minCardio");
  await expect(page.locator("#sesCardio li")).toHaveText(["Bici estáticaAntes de estirar · 10 min", "ElípticaDespués de estirar · 15 min"]);
  // Editing it: take the bike out.
  await page.click("#sesEditar");
  await expect(page.locator("#edCardioBox")).toBeVisible();
  await page.click('#edCardio [data-cardio-del="0"]');
  await page.click("#edGuardar");
  await expect(page.locator("#sesCardio li")).toHaveText(["ElípticaDespués de estirar · 15 min"]);
  const [s] = await guardadas(page);
  expect(s.cardio).toEqual([{ tipo: "eliptica", momento: "despues", min: 15 }]);
  expect(s.ejercicios.length).toBeGreaterThan(0);
});
