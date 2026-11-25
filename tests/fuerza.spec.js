// Strength progress: records with the estimated 1RM, one step up when last time was complete, sets per muscle this
// week and how hard a session felt.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
async function abrirApp(page) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript(() => {
    localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
  });
  await page.goto("/");
}
const h = (d, hh) => new Date(2026, 10, d, hh).getTime();
const series = (n, kg, reps, hechas = n) => Array.from({ length: n }, (_, i) => ({ kg, reps, hecho: i < hechas }));
async function poner(page, id, data) {
  await page.evaluate(async ([id, data]) => (await import("./store.js")).put("sesiones", id, data), [id, data]);
}
const g1 = (fecha, d, ejercicios) => ({ tipo: "gimnasio", fecha, inicio: h(d, 18), fin: h(d, 19), rutina: "g1", nombre: "Tren superior · Empuje", ejercicios });

test("a complete last time goes up a step, and beating the best estimated 1RM is a record in the summary and the history", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "a", g1("2026-11-18", 18, [{ n: "Press de banca", series: series(5, 40, 8) }]));
  await poner(page, "b", g1("2026-11-24", 24, [{ n: "Press de banca", series: series(5, 42.5, 8) },
    { n: "Press inclinado", series: series(3, 24, 10, 2) }, { n: "Fondos en paralelas", series: series(3, null, 8) }]));
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  const kg = (n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="kg"]`);
  const reps = (n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="n"]`);
  // 5 × 8 at 42.5 kg done: this time 45 kg, still 8 reps.
  await expect(kg(0)).toHaveValue("45");
  await expect(kg(4)).toHaveValue("45");
  await expect(reps(0)).toHaveValue("8");
  await expect(page.locator("#regSube")).toBeVisible();
  await expect(page.locator("#regSube")).toContainText("Press de banca: +2,5 kg, la última vez completaste 5 × 8");
  await page.click('[data-ck="0-0"]');
  // The incline press missed a set: same weight, no step.
  await page.click("#regSig");
  await expect(kg(0)).toHaveValue("24");
  await expect(page.locator("#regSube")).toBeHidden();
  // Dips with no weight: one rep more.
  for (let i = 0; i < 3; i++) await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toHaveText("Fondos en paralelas");
  await expect(reps(0)).toHaveValue("9");
  await expect(page.locator("#regSube")).toContainText("+1 rep");
  await page.click("#regSig");
  await expect(page.locator("#regSig")).toHaveText("TERMINAR");
  await page.click("#regSig");

  // 45 × 8 → 1RM 57 kg (Epley), up from 54 kg (42.5 × 8).
  await expect(page.locator("#resRecords")).toBeVisible();
  await expect(page.locator("#resRecords li")).toHaveCount(1);
  await expect(page.locator("#resRecords li")).toContainText("Press de banca");
  await expect(page.locator("#resRecords li")).toContainText("57 kg");
  await expect(page.locator("#resRecords li")).toContainText("1RM estimado · antes 54 kg");
  // How hard it felt: saved on the session, shown in its detail.
  await page.click('#resEsf [data-esf="7"]');
  await expect(page.locator('#resEsf [data-esf="7"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(async () => (await (await import("./store.js")).all("sesiones")).find((s) => s.fecha === "2026-11-25")?.esfuerzo)).toBe(7);
  await page.click("#resListo");
  await page.locator("#lista [data-ver]").first().click();
  await expect(page.locator("#sesStats")).toContainText("7/10Esfuerzo");
  await expect(page.locator("#sesLista .ej").first().locator(".rec")).toHaveText("Récord · 1RM estimado 57 kg");
  // The first time an exercise is done is no record: yesterday's session has none for the dips.
  await page.click("#sesVolver");
  await page.click('#lista [data-ver="b"]');
  await expect(page.locator("#sesLista .ej").first().locator(".rec")).toHaveText("Récord · 1RM estimado 54 kg");
  await expect(page.locator("#sesLista .rec")).toHaveCount(1);
});

test("Progreso shows this week's sets per muscle and each exercise's record, and the exercise sheet shows it too", async ({ page }) => {
  await abrirApp(page);
  // Last week's doesn't count for this week's sets, but its record does.
  await poner(page, "a", g1("2026-11-17", 17, [{ n: "Press de banca", series: series(5, 50, 3) }]));
  await poner(page, "b", g1("2026-11-23", 23, [{ n: "Press de banca", series: series(5, 45, 8) }, { n: "Fondos en paralelas", series: series(3, null, 8, 2) }]));
  await page.click('[data-tab="progreso"]');
  const musc = page.locator("#musSemana");
  await expect(musc.locator(".maniqui")).toBeVisible();
  // Chest: 5 bench + 2 dips. Triceps: 2 dips (primary), the bench's are secondary.
  await expect(musc.locator(".barras li").first()).toContainText("Pecho");
  await expect(musc.locator(".barras li").first()).toContainText("7");
  await expect(musc.locator(".barras li")).toHaveCount(2);
  await expect(musc.locator('[data-m="pecho"]').first()).toHaveAttribute("fill", "var(--prim)");
  const recs = page.locator("#records li");
  await expect(recs).toHaveCount(2);
  // 45 × 8 (57 kg) beats 50 × 3 (55 kg) as an estimated 1RM.
  await expect(recs.filter({ hasText: "Press de banca" })).toContainText("57 kg");
  await expect(recs.filter({ hasText: "Press de banca" })).toContainText("1RM est. · 45 kg × 8");
  await expect(recs.filter({ hasText: "Fondos" })).toContainText("8 reps");

  await page.getByRole("button", { name: "Entrenos" }).click();
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.locator("#detLista li.ej").first().click();
  await expect(page.locator("#fichaCuerpo")).toContainText("Tu récord");
  await expect(page.locator("#fichaCuerpo")).toContainText("45 kg × 8 · 1RM estimado 57 kg");
});

test("with no strength sets this week, Progreso says so", async ({ page }) => {
  await abrirApp(page);
  await page.click('[data-tab="progreso"]');
  await expect(page.locator("#musSemana")).toContainText("Aún no hay series de fuerza esta semana.");
  await expect(page.locator("#records")).toContainText("Tus mejores marcas aparecerán");
});

for (const idioma of ["en", "de", "ca"]) {
  test(`records, the step up, sets per muscle and effort are translated: ${idioma}`, async ({ page }) => {
    await page.clock.install({ time: MIERCOLES });
    await page.addInitScript((idioma) => {
      localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "", idioma }));
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    }, idioma);
    await page.goto("/");
    await poner(page, "a", g1("2026-11-18", 18, [{ n: "Press de banca", series: series(5, 40, 8) }, { n: "Fondos en paralelas", series: series(3, null, 8) }]));
    await poner(page, "b", g1("2026-11-24", 24, [{ n: "Press de banca", series: series(5, 42.5, 8) }, { n: "Fondos en paralelas", series: series(3, null, 9) }]));
    await page.click('[data-tab="progreso"]');
    await expect(page.locator("#records li")).toHaveCount(2);
    await page.click('[data-tab="historial"]');
    await page.click('#lista [data-ver="b"]');
    await expect(page.locator("#sesLista .rec")).toHaveCount(2);
    await page.click("#sesVolver");
    await page.click('[data-tab="entrenos"]');
    await page.locator('label:has(input[value="fuerza"])').click();
    await page.click('[data-abrir="g1"]');
    await page.locator("#detLista li.ej").first().click();
    await page.click("#fichaEmpezar");
    await expect(page.locator("#regSube")).toBeVisible();
    await page.click('[data-ck="0-0"]');
    for (let i = 0; i < 6; i++) await page.click("#regSig");
    await expect(page.locator("#resRecords")).toBeVisible();
    await page.click('#resEsf [data-esf="6"]');
    await expect(page.locator("#resEsfuerzo h3")).not.toHaveText("¿Cuánto te ha costado?");
    expect(await page.evaluate(async () => [...(await import("./i18n.js")).faltan])).toEqual([]);
  });
}
