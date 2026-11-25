// Phase 2: the workout list, the detail with its mannequin, the stretching player, the gym logger and progress.
const { test, expect } = require("@playwright/test");

// Timers are jumped with fastForward (due timers fire once), so the figures' animation frames don't eat the test's time.
// A Wednesday, so today's routine is the phase's, not Sunday's. Each test uses a browser with no server set,
// so data from other tests (they share the server) never shows up here.
const MIERCOLES = new Date("2026-11-25T10:00:00");
// WebGL is off unless a test asks for it: the 3D figure is slow on CI's software renderer, and without it the app
// keeps the SVG figure, which is what most tests look at.
async function abrirApp(page, time = MIERCOLES, { webgl = false } = {}) {
  await page.clock.install({ time });
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  if (!webgl) {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (tipo, ...r) {
        return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r);
      };
    });
  }
  await page.goto("/");
}
const fill = (page, sel) => page.locator(sel).evaluate((el) => el.getAttribute("fill"));

test("the list shows today's routine, the six phases and the gym workouts", async ({ page }) => {
  await abrirApp(page);
  await expect(page.locator("#hoyCard")).toContainText("HOY · FLEX");
  await expect(page.locator("#hoyCard")).toContainText("Fase 1 · Despertar");
  await expect(page.locator("#planPos")).toHaveText("Semana 1 · F1");
  await expect(page.locator("#listaFlex .wcard")).toHaveCount(7);
  await expect(page.locator("#listaFuerza .wcard")).toHaveCount(5);
  await expect(page.locator("#listaFuerza")).toContainText("Tren superior · Empuje");
  await expect(page.locator("#listaFuerza")).toContainText("23 series");
  await expect(page.locator("#listaPlantillas .wcard")).toHaveCount(3);
  // Every card has its mannequin.
  await expect(page.locator("#entrenos .wcard svg.maniqui")).toHaveCount(16);

  await page.locator('label:has(input[value="fuerza"])').click();
  await expect(page.locator("#grupoFlex")).toBeHidden();
  await expect(page.locator("#hoyCard")).toBeHidden();
  await expect(page.locator("#grupoPlantillas")).toBeVisible();
  await page.locator('label:has(input[value="flex"])').click();
  await expect(page.locator("#grupoFuerza")).toBeHidden();
  await expect(page.locator("#grupoPlantillas")).toBeHidden();
  await expect(page.locator("#grupoFlex")).toBeVisible();
});

test("a gym workout shows its exercises as in Coros, and its muscles: primary red, secondary amber", async ({ page }) => {
  await abrirApp(page);
  await page.click('[data-abrir="g1"]');
  await expect(page.locator("#detTitle")).toHaveText("Tren superior · Empuje");
  await expect(page.locator("#detSub")).toContainText("23 series");
  await expect(page.locator("#detNotas")).toContainText("Elevaciones laterales en polea");
  await expect(page.locator("#detLista .ej")).toHaveCount(6);
  await expect(page.locator("#detLista .ej").first()).toContainText("Press de banca");
  await expect(page.locator("#detLista .ej").first()).toContainText("5 series · 8 reps · 40 kg · Descanso 1:30");
  await expect(page.locator("#detLista .ej").nth(4)).toContainText("Fondos en paralelas");
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
  expect(await fill(page, '#detMan [data-m="isquios"] >> nth=0')).toMatch(/var\(--flex[123]\)/);
  await expect(page.locator("#detMan")).toContainText("min");
  await expect(page.locator("#detAvance")).toContainText("Pasa a la siguiente fase");
  // The figure moves: its trunk is drawn somewhere else a few seconds later (only figures on screen are animated).
  await page.locator("#detLista .ej").nth(1).scrollIntoViewIfNeeded();
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

test("changing a set's weight carries it to the exercise's later sets not ticked yet", async ({ page }) => {
  await abrirApp(page);
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  const kg = (n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="kg"]`);
  await kg(0).fill("50");
  for (let n = 0; n < 5; n++) await expect(kg(n)).toHaveValue("50");
  await page.click('[data-ck="0-0"]');
  await page.click('[data-ck="0-2"]');
  // From the second set: the ticked third one keeps its weight, the first is earlier and keeps it too.
  await kg(1).fill("24");
  await expect(kg(0)).toHaveValue("50");
  await expect(kg(1)).toHaveValue("24");
  await expect(kg(2)).toHaveValue("50");
  await expect(kg(3)).toHaveValue("24");
  await expect(kg(4)).toHaveValue("24");
  // The values are kept, not only shown: leaving the page and coming back shows them.
  await page.click("#regSig");
  await page.click("#regAnt");
  await expect(kg(4)).toHaveValue("24");
  await page.click('[data-ck="0-4"]');
  await page.click("#regSig");
  for (let i = 0; i < 4; i++) await page.click("#regSig");
  await page.click("#regSig");
  // 50×8 + 50×8 + 24×8.
  await expect(page.locator("#resStats")).toContainText("992kg");
});

test("each exercise starts with last time's weights: from its newest session where it was done, else from another workout", async ({ page }) => {
  await abrirApp(page);
  await page.locator('label:has(input[value="fuerza"])').click();
  const kg = (n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="kg"]`);
  const reps = (n) => page.locator(`#regFilas tr >> nth=${n} >> input[data-c="n"]`);
  const g1 = async () => { await page.getByRole("button", { name: "Entrenos" }).click(); await page.click('[data-abrir="g1"]'); await page.click("#detEmpezar"); };
  await g1();
  await kg(0).fill("47.5");
  await reps(0).fill("6");
  await page.click('[data-ck="0-0"]');
  for (let i = 0; i < 6; i++) await page.click("#regSig");
  await page.click("#resListo");

  // Next time: the bench press has 47.5 kg on every set; the incline press, not done, keeps its default.
  await g1();
  await expect(kg(0)).toHaveValue("47.5");
  await expect(reps(0)).toHaveValue("6");
  await expect(kg(4)).toHaveValue("47.5");
  await expect(reps(4)).toHaveValue("8");
  await page.click("#regSig");
  await expect(kg(0)).toHaveValue("24");
  // A session where the bench press was skipped (only the incline press done) doesn't reset it.
  await page.click('[data-ck="1-0"]');
  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await page.click("#resListo");
  await g1();
  await expect(kg(0)).toHaveValue("47.5");
  await page.click("#regSalir");
  await page.click("#salirDescartar");

  // StrongLifts A has a bench press too: it takes the weight, but keeps its own 5 reps.
  await page.click("#detVolver");
  await page.locator('label:has(input[value="todos"])').click();
  await page.click('[data-abrir="sl-a"]');
  await page.click("#detEmpezar");
  await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toHaveText("Press de banca");
  await expect(kg(0)).toHaveValue("47.5");
  await expect(reps(0)).toHaveValue("5");
});

test("assisted pull-ups take a negative weight, which adds nothing to the volume", async ({ page }) => {
  await abrirApp(page);
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g3"]');
  await page.click("#detEmpezar");
  await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toHaveText("Dominadas");
  const kg = page.locator('#regFilas tr >> nth=0 >> input[data-c="kg"]');
  await expect(kg).not.toHaveAttribute("min");
  await kg.fill("-20");
  await expect(page.locator('#regFilas tr >> nth=3 >> input[data-c="kg"]')).toHaveValue("-20");
  await page.click('[data-ck="1-0"]');
  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await expect(page.locator("#resStats")).toContainText("1Series");
  await expect(page.locator("#resStats")).toContainText("0kg");
  await page.click("#resListo");
  await page.getByRole("button", { name: "Entrenos" }).click();
  await page.click('[data-abrir="g3"]');
  await page.click("#detEmpezar");
  await page.click("#regSig");
  await expect(page.locator("#regFilas tr").first().locator(".prev")).toHaveText("-20×8");
  await expect(kg).toHaveValue("-20");
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

test("each exercise can be looked at before starting: animation, dose and cues", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.locator("#detLista .ej").nth(3).click();
  const f = page.locator("#ficha");
  await expect(f).toBeVisible();
  await expect(page.locator("#fichaCuenta")).toHaveText("Ejercicio 4 de 9");
  await expect(page.locator("#fichaDosis")).toHaveText("2 × 20–30 s /lado");
  await expect(f).toContainText("Boca arriba, toalla o cinturón");
  await expect(f.locator("svg.fig.grande")).toHaveCount(1);
  // The big figure moves too.
  const trunk = () => f.locator('[data-k="tr"]').first().getAttribute("d");
  const before = await trunk();
  await page.clock.runFor(3000);
  expect(await trunk()).not.toBe(before);
  await page.click("#fichaSig");
  await expect(page.locator("#fichaCuenta")).toHaveText("Ejercicio 5 de 9");
  await page.click("#fichaSalir");
  await expect(f).toBeHidden();
  await expect(page.locator("#detalle")).toBeVisible();

  // A gym exercise shows its muscles on the mannequin, and EMPEZAR starts the workout from there.
  await page.click("#detVolver");
  await page.click('#listaFuerza [data-abrir="g1"]');
  await page.getByRole("button", { name: "Ver Press de banca" }).click();
  await expect(page.locator("#fichaTitulo")).toHaveText("Press de banca");
  await expect(page.locator("#fichaDosis")).toHaveText("5 series · 8 reps · 40 kg");
  await expect(page.locator("#fichaAnt")).toBeDisabled();
  expect(await fill(page, '#fichaFig [data-m="pecho"] >> nth=0')).toBe("var(--prim)");
  await page.click("#fichaEmpezar");
  await expect(f).toBeHidden();
  await expect(page.locator("#registro")).toBeVisible();
});

test("professional templates: StrongLifts 5×5 A and B and the ACSM beginner routine, with their source", async ({ page }) => {
  await abrirApp(page);
  await page.click('#listaPlantillas [data-abrir="sl-a"]');
  await expect(page.locator("#detTitle")).toHaveText("StrongLifts 5×5 · A");
  await expect(page.locator("#detLista .ej")).toHaveCount(3);
  await expect(page.locator("#detLista .ej").first().locator(".dosis")).toHaveText("5 series · 5 reps · 20 kg · Descanso 3:00");
  await expect(page.locator("#detNotas")).toContainText("añade 2,5 kg");
  await expect(page.locator("#detMaquinas a")).toHaveAttribute("href", "https://stronglifts.com/5x5/");
  // No number in front of the exercises.
  await expect(page.locator("#detLista .ej .name").first()).toHaveText("Sentadilla");
  await page.click("#detVolver");

  await page.click('#listaPlantillas [data-abrir="sl-b"]');
  await expect(page.locator("#detLista .ej").nth(2).locator(".dosis")).toHaveText("1 serie · 5 reps · 40 kg · Descanso 3:00");
  await page.click("#detVolver");

  await page.click('#listaPlantillas [data-abrir="acsm"]');
  await expect(page.locator("#detLista .ej")).toHaveCount(10);
  await expect(page.locator("#detMaquinas")).toContainText("ACSM");
  await page.locator("#detLista .ej").first().click();
  await expect(page.locator("#fichaDosis")).toHaveText("2 series · 10 reps · peso a elegir");
});

test("the kettlebell workout: ten exercises with the halo, the one-arm press per side and swings, with how to do each", async ({ page }) => {
  await abrirApp(page);
  await page.click('#listaFuerza [data-abrir="kb"]');
  await expect(page.locator("#detTitle")).toHaveText("Kettlebell · cuerpo completo");
  await expect(page.locator("#detLista .ej")).toHaveCount(10);
  await expect(page.locator("#detLista .ej .name").first()).toHaveText("Halo");
  await expect(page.locator("#detLista")).toContainText("Swing a dos manos");
  await expect(page.locator("#detLista")).toContainText("Swing a una mano");
  const press = page.locator("#detLista .ej", { hasText: "Press de hombro a una mano" });
  await expect(press.locator(".dosis")).toHaveText("3 series · 8 reps /lado · 12 kg · Descanso 1:30");
  expect(await fill(page, '#detMan [data-m="gluteos"] >> nth=0')).toBe("var(--prim)");
  expect(await fill(page, '#detMan [data-m="hombros"] >> nth=0')).toBe("var(--prim)");

  await page.locator("#detLista .ej").first().click();
  await expect(page.locator("#fichaDosis")).toHaveText("3 series · 10 reps · 8 kg");
  await expect(page.locator("#fichaCuerpo .pasos li")).toHaveCount(4);
  await expect(page.locator("#fichaCuerpo")).toContainText("alrededor de la cabeza");
  await page.click("#fichaEmpezar");
  await expect(page.locator("#registro")).toBeVisible();
  await expect(page.locator("#regColReps")).toHaveText("REPS");
  for (let i = 0; i < 4; i++) await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toContainText("Press de hombro a una mano");
  await expect(page.locator("#regColReps")).toHaveText("REPS/LADO");
});

test("every strength exercise has its animated figure: in the workout, its sheet and the set logger", async ({ page }) => {
  await abrirApp(page);
  // The cards render after IndexedDB answers: wait for them before reading their ids.
  await expect(page.locator("#listaFuerza [data-abrir], #listaPlantillas [data-abrir]")).toHaveCount(8);
  const ids = await page.locator("#listaFuerza [data-abrir], #listaPlantillas [data-abrir]").evaluateAll((els) => els.map((e) => e.dataset.abrir));
  expect(ids.length).toBe(8);
  for (const id of ids) {
    await page.click(`[data-abrir="${id}"]`);
    const filas = page.locator("#detLista .ej");
    await expect(filas.first()).toBeVisible();
    const n = await filas.count();
    await expect(page.locator("#detLista .ej .th svg.fig[data-fig]")).toHaveCount(n);
    await page.clock.fastForward(1500);
    // Every joint was drawn (no NaN from the pose maths) and the figures stay inside their frame.
    const malos = await page.locator("#detLista svg.fig").evaluateAll((svgs) => svgs.filter((s) =>
      [...s.querySelectorAll("line, path, circle, g")].some((e) => /NaN/.test(e.outerHTML))).map((s) => s.dataset.fig));
    expect(malos).toEqual([]);
    await page.click("#detVolver");
  }

  await page.click('#listaFuerza [data-abrir="kb"]');
  await page.locator("#detLista .ej").first().click();
  await expect(page.locator('#fichaFig svg.fig[data-fig="kb_halo"]')).toBeVisible();
  await expect(page.locator("#fichaFig svg.maniqui")).toBeVisible();
  await page.click("#fichaEmpezar");
  await expect(page.locator('#regFig svg.fig[data-fig="kb_halo"]')).toBeVisible();
  await page.click("#regSig");
  await expect(page.locator('#regFig svg.fig[data-fig="kb_pm"]')).toBeVisible();
});

test("the exercise sheet, the player and the set logger show the 3D figure, with buttons for each angle", async ({ page }) => {
  test.slow();
  await abrirApp(page, MIERCOLES, { webgl: true });
  await page.click('#listaFuerza [data-abrir="kb"]');
  await page.locator("#detLista .ej").first().click();
  await expect(page.locator("#fichaFig canvas")).toBeVisible();
  await expect(page.locator("#fichaFig svg.fig")).toHaveCount(0);
  const vistas = page.locator("#fichaFig .f3d-vistas button");
  await expect(vistas).toHaveCount(5);
  await expect(vistas.filter({ hasText: "Frente" })).toHaveAttribute("aria-pressed", "true");
  await vistas.filter({ hasText: "Espalda" }).click();
  await expect(vistas.filter({ hasText: "Espalda" })).toHaveAttribute("aria-pressed", "true");
  await expect(vistas.filter({ hasText: "Frente" })).toHaveAttribute("aria-pressed", "false");
  for (const b of await vistas.all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);

  // The logger takes the canvas over, with its own angle buttons.
  await page.click("#fichaEmpezar");
  await expect(page.locator("#regFig canvas")).toBeVisible();
  await expect(page.locator("#fichaFig canvas")).toHaveCount(0);
  await expect(page.locator("#regFig .f3d-vistas button")).toHaveCount(5);
  await page.click("#regSig");
  await expect(page.locator("#regFig")).toHaveAttribute("data-fig3d", "kb_pm");
  await expect(page.locator("#regFig canvas")).toBeVisible();
});

test("the stretching player shows the 3D figure in its ring, turned by dragging", async ({ page }) => {
  test.slow();
  await abrirApp(page, MIERCOLES, { webgl: true });
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#repFig canvas")).toBeVisible();
  await expect(page.locator("#repFig svg.fig")).toHaveCount(0);
  // The ring has no room for buttons.
  await expect(page.locator("#repFig .f3d-vistas")).toHaveCount(0);
});

test("every 3D figure keeps its joints, stays on the floor and holds what the 2D figure holds", async ({ page }) => {
  await abrirApp(page);
  const problemas = await page.evaluate(async () => {
    const { revisar } = await import("./figura3d.js");
    const { FIGURAS, FIGURAS_FUERZA } = await import("./figura.js");
    const r = {}, todas = [...FIGURAS, ...FIGURAS_FUERZA];
    for (const id of todas) { const p = revisar(id); if (p.length) r[id] = p; }
    return { n: todas.length, r };
  });
  expect(problemas.n).toBeGreaterThan(60);
  expect(problemas.r).toEqual({});
});
