// Phase 2: the workout list, the detail with its mannequin, the stretching player, the gym logger and progress.
const { test, expect } = require("@playwright/test");

// Timers are jumped with fastForward (due timers fire once), so the figures' animation frames don't eat the test's time.
// A Wednesday, so today's routine is the phase's, not Sunday's. Each test uses a browser with no server set,
// so data from other tests (they share the server) never shows up here.
const MIERCOLES = new Date("2026-11-25T10:00:00");
async function abrirApp(page, time = MIERCOLES) {
  await page.clock.install({ time });
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  await page.goto("/");
}
const fill = (page, sel) => page.locator(sel).evaluate((el) => el.getAttribute("fill"));

test("the list shows today's routine, the six phases and the four gym workouts", async ({ page }) => {
  await abrirApp(page);
  await expect(page.locator("#hoyCard")).toContainText("HOY · FLEX");
  await expect(page.locator("#hoyCard")).toContainText("Fase 1 · Despertar");
  await expect(page.locator("#planPos")).toHaveText("Semana 1 · F1");
  await expect(page.locator("#listaFlex .wcard")).toHaveCount(7);
  await expect(page.locator("#listaFuerza .wcard")).toHaveCount(4);
  await expect(page.locator("#listaFuerza")).toContainText("Tren superior · Empuje");
  await expect(page.locator("#listaFuerza")).toContainText("23 series");
  // Every card has its mannequin.
  await expect(page.locator("#entrenos .wcard svg.maniqui")).toHaveCount(12);

  await page.locator('label:has(input[value="fuerza"])').click();
  await expect(page.locator("#grupoFlex")).toBeHidden();
  await expect(page.locator("#hoyCard")).toBeHidden();
  await page.locator('label:has(input[value="flex"])').click();
  await expect(page.locator("#grupoFuerza")).toBeHidden();
  await expect(page.locator("#grupoFlex")).toBeVisible();
});

test("a gym workout shows its exercises as in Coros, and its muscles: primary red, secondary amber", async ({ page }) => {
  await abrirApp(page);
  await page.click('[data-abrir="g1"]');
  await expect(page.locator("#detTitle")).toHaveText("Tren superior · Empuje");
  await expect(page.locator("#detSub")).toContainText("23 series");
  await expect(page.locator("#detNotas")).toContainText("Elevaciones laterales en polea");
  await expect(page.locator("#detLista .ej")).toHaveCount(6);
  await expect(page.locator("#detLista .ej").first()).toContainText("1 Press de banca");
  await expect(page.locator("#detLista .ej").first()).toContainText("5 series · 8 reps · 40 kg · Descanso 1:30");
  await expect(page.locator("#detLista .ej").nth(4)).toContainText("5 Fondos en paralelas");
  await expect(page.locator("#detLista .ej").nth(4).locator(".dosis")).toHaveText("3 series · 8 reps · Descanso 1:30");
  await expect(page.locator("#detMaquinas")).toContainText("cuerda");
  expect(await fill(page, '#detMan [data-m="pecho"] >> nth=0')).toBe("var(--prim)");
  expect(await fill(page, '#detMan [data-m="trapecio"] >> nth=0')).toBe("var(--sec)");
  expect(await fill(page, '#detMan [data-m="gemelos"] >> nth=0')).toBe("var(--body)");
  await expect(page.locator("#detMan")).toContainText("Músculos principales");
  await expect(page.locator("#detMan text").first()).toContainText("series");

  await page.click("#detVolver");
  await page.click('[data-abrir="g4"]');
  await expect(page.locator("#detLista .bloque")).toContainText("Repite 3 veces");
  await expect(page.locator("#detLista .bloque .ej")).toHaveCount(3);
  await expect(page.locator("#detLista .bloque")).toContainText("1 serie · 1:20");
  await expect(page.locator("#detSub")).toContainText("26 series");
});

test("a flexibility routine shows each stretch animated, with its dose and cues", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await expect(page.locator("#detTitle")).toHaveText("Fase 1 · Despertar");
  await expect(page.locator("#detLista .ej")).toHaveCount(9);
  await expect(page.locator("#detLista .ej svg.fig[data-fig]")).toHaveCount(9);
  await expect(page.locator("#detLista .ej").nth(3).locator(".dosis")).toHaveText("2 × 20–30 s /lado");
  await page.locator("#detLista .ej").nth(3).getByText("Cómo hacerlo").click();
  await expect(page.locator("#detLista .ej").nth(3)).toContainText("Boca arriba, toalla o cinturón");
  expect(await fill(page, '#detMan [data-m="isquios"] >> nth=0')).toMatch(/var\(--flex[123]\)/);
  await expect(page.locator("#detMan")).toContainText("min");
  await expect(page.locator("#detAvance")).toContainText("Pasa a la siguiente fase");
  // The figure moves: its trunk is drawn somewhere else a few seconds later.
  const trunk = () => page.locator('#detLista .ej >> nth=1 >> [data-k="tr"]').getAttribute("d");
  const before = await trunk();
  await page.clock.runFor(3000);
  expect(await trunk()).not.toBe(before);
});

test("the plan's start date decides today's routine, and Sunday is the gentle one", async ({ page }) => {
  await abrirApp(page);
  await page.getByRole("button", { name: "Perfil" }).click();
  await page.fill("#planInicio", "2026-10-21");
  await page.locator("#planInicio").dispatchEvent("change");
  await expect(page.locator("#planEstado")).toHaveText("Semana 6 de 26 · Fase 2, Ampliar.");
  await page.getByRole("button", { name: "Entrenos" }).click();
  await expect(page.locator("#hoyCard")).toContainText("Fase 2 · Ampliar");
  await expect(page.locator("#planPos")).toHaveText("Semana 6 · F2");

  await page.clock.setSystemTime(new Date("2026-11-29T10:00:00"));
  await page.reload();
  await expect(page.locator("#hoyCard")).toContainText("Domingo suave");
});

test("the stretching player times each stretch, changes side, pauses, and logs the session", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#reproductor")).toBeVisible();
  await expect(page.locator(".tabs")).toBeHidden();
  await expect(page.locator("#repTitulo")).toHaveText("Respiración boca arriba");
  await expect(page.locator("#repSerie")).toHaveText("Prepárate");
  await expect(page.locator("#repSig")).toContainText("Después: Gato-camello · 2 × 8 lentas");

  // 5 s to get ready, then the 1-minute breathing, then the next exercise.
  await page.clock.fastForward(6000);
  await expect(page.locator("#repTiempo")).toHaveText("0:59");
  await page.click("#repPausa");
  await page.clock.fastForward(30000);
  await expect(page.locator("#repTiempo")).toHaveText("0:59");
  await page.click("#repPausa");
  await page.clock.fastForward(60000);
  await expect(page.locator("#repTitulo")).toHaveText("Gato-camello");

  // Skip to the hamstrings: two sides, the left one first.
  await page.click("#repSaltar");
  await page.click("#repSaltar");
  await expect(page.locator("#repTitulo")).toHaveText("Isquios con toalla");
  await page.clock.fastForward(6000);
  await expect(page.locator("#repLado .on")).toHaveText("Lado izquierdo");
  await page.clock.fastForward(30000);
  await expect(page.locator("#repSerie")).toHaveText("Cambia de lado");
  await page.clock.fastForward(5000);
  await expect(page.locator("#repLado .on")).toHaveText("Lado derecho");

  for (let i = 0; i < 12 && (await page.locator("#reproductor").isVisible()); i++) await page.click("#repSaltar");
  await expect(page.locator("#resumen")).toBeVisible();
  await expect(page.locator("#resTitulo")).toHaveText("Fase 1 · Despertar");
  await expect(page.locator("#resStats")).toContainText("2/9");
  await page.click("#resListo");
  await expect(page.locator("#lista li").first()).toContainText("Flexibilidad · F1");
  await expect(page.locator("#lista li").first()).toContainText("2/9 ejercicios");
  // The first session also starts the plan.
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#planInicio")).toHaveValue("2026-11-25");
});

test("the gym logger fills in last time's numbers and starts the rest timer", async ({ page }) => {
  await abrirApp(page);
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#regTitulo")).toHaveText("Press de banca");
  await expect(page.locator("#regFilas tr")).toHaveCount(5);
  const kg = page.locator('#regFilas tr >> nth=0 >> input[data-c="kg"]');
  await expect(kg).toHaveValue("40");
  await kg.fill("42.5");
  await page.click('[data-ck="0-0"]');
  await expect(page.locator("#regFilas tr").first()).toHaveClass(/done/);
  await expect(page.locator("#regDescanso")).toBeVisible();
  await expect(page.locator("#regDescT")).toHaveText("1:30");
  await page.click("#regMas");
  await expect(page.locator("#regDescT")).toHaveText("1:45");
  await page.clock.fastForward(106000);
  await expect(page.locator("#regDescanso")).toBeHidden();

  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await expect(page.locator("#regSig")).toHaveText("TERMINAR");
  await page.click("#regSig");
  await expect(page.locator("#resStats")).toContainText("1Series");
  await expect(page.locator("#resStats")).toContainText("340kg");
  await page.click("#resListo");
  await expect(page.locator("#lista li").first()).toContainText("Gimnasio · G1");
  await expect(page.locator("#lista li").first()).toContainText("1 series");

  await page.getByRole("button", { name: "Entrenos" }).click();
  await page.click('[data-abrir="g1"]');
  await expect(page.locator("#detSub")).toContainText("última vez hoy");
  await page.click("#detEmpezar");
  await expect(page.locator("#regFilas tr").first().locator(".prev")).toHaveText("42,5×8");
  await expect(page.locator('#regFilas tr >> nth=0 >> input[data-c="kg"]')).toHaveValue("42.5");

  // The circuit is one page with its three rounds.
  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await page.click("#regSalir");
  await page.click("#salirDescartar");
  // Discarding goes back to the workout.
  await expect(page.locator("#detTitle")).toHaveText("Tren superior · Empuje");
  await page.click("#detVolver");
  await page.click('[data-abrir="g4"] >> nth=-1');
  await page.click("#detEmpezar");
  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toHaveText("Circuito · 3 vueltas");
  await expect(page.locator("#regFilas tr")).toHaveCount(9);
  await expect(page.locator("#regColReps")).toHaveText("SEG");
  await expect(page.locator("#regFilas tr").nth(1)).toContainText("R1 · Plancha lateral izq.");
});

test("the monthly test is saved and charted, and the calendar marks the days trained", async ({ page }) => {
  await abrirApp(page);
  await page.getByRole("button", { name: "Historial" }).click();
  await page.click("#nuevaBox summary");
  await page.click('#nueva label:has(input[value="gimnasio"])');
  await page.click('#nueva button[type="submit"]');
  await page.getByRole("button", { name: "Progreso" }).click();
  await expect(page.locator("#calendario i.f")).toHaveCount(1);
  await expect(page.locator("#calendario i.hoy")).toHaveClass(/f/);
  await expect(page.locator("#racha")).toHaveText("1 día seguido");
  await expect(page.locator("#testGrafica")).toContainText("Aún no hay tests");

  await expect(page.locator("#testFase")).toHaveValue("1");
  await page.fill('#testForm input[name="dedosSueloCm"]', "22");
  await page.fill('#testForm input[name="sentadillaSeg"]', "5");
  await page.click('#testForm button[type="submit"]');
  await expect(page.locator("#testOk")).toHaveText("Test de la fase 1 guardado.");
  await expect(page.locator("#testGrafica")).toContainText("22 cm");
  await page.selectOption("#testFase", "2");
  await expect(page.locator('#testForm input[name="dedosSueloCm"]')).toHaveValue("");
  await page.selectOption("#testFase", "1");
  await expect(page.locator('#testForm input[name="sentadillaSeg"]')).toHaveValue("5");
});
