// The watch's workouts from Health Connect: the Android app's "Salud" plugin is faked here, so the app runs as on the
// phone (window.Capacitor present) and reads the workouts a test puts in window.__reloj.
const { test, expect } = require("@playwright/test");


async function abrirComoAndroid(page, { permiso = false, relojes = [], fcEnVivo = null } = {}) {
  await page.addInitScript(({ permiso, relojes, fcEnVivo }) => {
    localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    // Without WebGL, as in the other tests.
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    // Times are relative to now: [minutes from now at start, at end].
    const ahora = Date.now();
    window.__reloj = relojes.map(({ desde, hasta, ...w }) => ({ ...w, inicio: ahora + desde * 60000, fin: ahora + hasta * 60000 }));
    window.__permiso = permiso;
    window.__pedidos = 0;
    const plugins = {
      App: { addListener() {}, exitApp() {} },
      Descubrir: { buscar: async () => ({ direcciones: [] }) },
      Salud: {
        estado: async () => ({ disponible: true, permiso: window.__permiso, fc: window.__permiso, kcal: window.__permiso }),
        pedirPermiso: async () => { window.__pedidos++; window.__permiso = true; return { disponible: true, permiso: true, fc: true, kcal: true }; },
        sesiones: async ({ desde, hasta }) => ({ sesiones: window.__permiso ? window.__reloj.filter((w) => w.fin >= desde && w.inicio <= hasta) : [] }),
        fc: async () => fcEnVivo || {},
      },
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: (n) => plugins[n] };
  }, { permiso, relojes, fcEnVivo });
  await page.goto("/");
}

test("joining rules: by time, by day when logged by hand or afterwards, and never twice", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { emparejar } = await import("./reloj.js");
    const h = (hh, mm = 0) => new Date(2026, 10, 24, hh, mm).getTime();
    const relojes = [
      { id: "w1", inicio: h(18, 0), fin: h(19, 5), categoria: "fuerza", fcMedia: 118, fcMax: 161, kcal: 412 },
      { id: "w2", inicio: h(8, 0), fin: h(8, 25), categoria: "flex", fcMedia: 80 },
      { id: "w3", inicio: h(12, 0), fin: h(12, 40), categoria: "fuerza" },
      { id: "w4", inicio: h(7, 0), fin: h(7, 30), categoria: "otro" },
    ];
    const sesiones = [
      // Logged in the app while training: overlaps w1.
      { id: "a", tipo: "gimnasio", fecha: "2026-11-24", inicio: h(18, 4), fin: h(19, 1), _actualizado: 1 },
      // Logged by hand, a stretching session that day: w2 (w3 is strength).
      { id: "b", tipo: "flexibilidad", fecha: "2026-11-24", duracionMin: 20 },
      // Logged in the app in the evening, after the midday workout: w3, by day.
      { id: "c", tipo: "gimnasio", fecha: "2026-11-24", inicio: h(21, 0), fin: h(21, 10) },
      // Another day: nothing.
      { id: "d", tipo: "gimnasio", fecha: "2026-11-23", inicio: h(18, 0) - 864e5, fin: h(19, 0) - 864e5 },
    ];
    const uno = emparejar(sesiones, relojes, []);
    // A second pass with the joins written changes nothing; a deleted watch-only session isn't made again.
    const escrito = sesiones.map((s) => ({ ...s, ...(Object.fromEntries(uno.poner)[s.id] || {}) }));
    const dos = emparejar(escrito, relojes, uno.vistos);
    return { poner: Object.fromEntries(uno.poner.map(([id, d]) => [id, d.reloj?.id])), datosA: uno.poner.find(([id]) => id === "a")[1], dos };
  });
  expect(r.poner).toEqual({ a: "w1", b: "w2", c: "w3" });
  expect(r.datosA.reloj).toMatchObject({ fcMedia: 118, fcMax: 161, kcal: 412 });
  expect(r.datosA._actualizado).toBeUndefined();
  // w4 ("otro") is neither joined nor kept alone.
  expect(r.dos).toEqual({ poner: [], quitar: [], vistos: ["w1", "w2", "w3", "w4"] });
});

test("in the web there is no Health Connect card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#relojCard")).toBeHidden();
});

test("a watch workout shows up alone, then joins the gym session logged for it later by hand", async ({ page }) => {
  await abrirComoAndroid(page, { relojes: [{ id: "coros-1", desde: -90, hasta: -30, categoria: "fuerza", fcMedia: 121, fcMax: 158, kcal: 380, titulo: "Strength" }] });
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#relojCard")).toBeVisible();
  await expect(page.locator("#relojEstado")).toContainText("Sin permiso");
  await page.getByRole("button", { name: "Conectar Health Connect" }).click();
  await expect(page.locator("#relojEstado")).toContainText("0 sesiones unidas a su entreno del reloj, 1 solo en el reloj");
  expect(await page.evaluate(() => window.__pedidos)).toBe(1);

  await page.getByRole("button", { name: "Historial" }).click();
  const li = page.locator("#lista li");
  await expect(li).toHaveCount(1);
  await expect(li).toContainText("Gimnasio · Solo en el reloj");
  await expect(li).toContainText("FC 121/158 ppm · 380 kcal");

  // Logged by hand the same day: the two become one.
  await page.click("#nuevaBox summary");
  await page.locator('#nueva label:has(input[value="gimnasio"])').click();
  await page.fill('#nueva input[name="duracionMin"]', "60");
  await page.fill('#nueva textarea[name="notas"]', "pierna");
  await page.click('#nueva button[type="submit"]');
  await page.getByRole("button", { name: "Perfil" }).click();
  await page.getByRole("button", { name: "Leer ahora" }).click();
  await expect(page.locator("#relojEstado")).toContainText("1 sesión unida a su entreno del reloj.");
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(li).toHaveCount(1);
  await expect(li).toContainText("pierna");
  await expect(li).toContainText("FC 121/158 ppm · 380 kcal");
  await expect(li).not.toContainText("Solo en el reloj");
});

test("the summary of a gym session takes the watch's heart rate and calories, and shows live heart rate while training", async ({ page }) => {
  // The watch workout started two minutes before the app session and is already in Health Connect.
  await abrirComoAndroid(page, { permiso: true, fcEnVivo: { ultima: 112, ultimaEn: Date.now() }, relojes: [{ id: "coros-2", desde: -2, hasta: 30, categoria: "fuerza", fcMedia: 109, fcMax: 150, kcal: 95 }] });
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await expect(page.locator("#regFc")).toHaveText("♥ 112");
  await page.click('[data-ck="0-0"]');
  await page.click("#regSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resumen")).toBeVisible();
  await expect(page.locator("#resFc")).toHaveText("109");
  await expect(page.locator("#resKcal")).toHaveText("95");
  await expect(page.locator("#resNota")).toContainText("FC máxima 150 ppm");
  await page.click("#resListo");
  await expect(page.locator("#lista li")).toHaveCount(1);
  await expect(page.locator("#lista li")).toContainText("Gimnasio · G1");
  await expect(page.locator("#lista li")).toContainText("FC 109/150 ppm · 95 kcal");
});

test("without permission the summary says where to connect it", async ({ page }) => {
  await abrirComoAndroid(page);
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await page.click("#regSalir");
  await page.click("#salirGuardar");
  await expect(page.locator("#resFc")).toHaveText("—");
  await expect(page.locator("#resNota")).toContainText("Conecta Health Connect en Perfil");
});


test("the heart-rate curve is kept for the session's chart, cleaned", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { datosReloj } = await import("./reloj.js");
    return [datosReloj({ id: "w", inicio: 1, fin: 2, categoria: "fuerza", curva: [90, 0, 120.4, -3, 999, "x"], curvaPaso: 60 }), datosReloj({ id: "w", inicio: 1, fin: 2, categoria: "fuerza", curva: [90] })];
  });
  expect(r[0].curva).toEqual([90, 0, 120, 0, 0, 0]);
  expect(r[0].curvaPaso).toBe(60);
  expect(r[1].curva).toBeUndefined();
});

test("a watch stopped and started again: the pieces close to the session join it, and the sets logged before the watch too", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { emparejar } = await import("./reloj.js");
    const h = (hh, mm = 0) => new Date(2026, 10, 25, hh, mm).getTime();
    const corto = { id: "w-corto", inicio: h(10, 13), fin: h(10, 15), categoria: "fuerza", fcMedia: 96, fcMax: 107, kcal: 26, curva: [95, 97], curvaPaso: 60, titulo: "Strength" };
    const largo = { id: "w-largo", inicio: h(10, 16), fin: h(11, 14), categoria: "fuerza", fcMedia: 91, fcMax: 114, kcal: 249, curva: Array(58).fill(90), curvaPaso: 60, titulo: "Strength" };
    const lejos = { id: "w-tarde", inicio: h(19, 0), fin: h(19, 40), categoria: "fuerza" };
    // As it was: the sets logged in a minute, joined to the short piece; the long one alone in the history.
    const { datosReloj } = await import("./reloj.js");
    const g3 = { id: "g3", tipo: "gimnasio", fecha: "2026-11-25", inicio: h(10, 14), fin: h(10, 15), duracionMin: 1, reloj: datosReloj(corto) };
    const sola = { id: "reloj-w-largo", tipo: "gimnasio", fecha: "2026-11-25", origen: "reloj", reloj: datosReloj(largo) };
    const uno = emparejar([g3, sola], [corto, largo], ["w-corto", "w-largo"]);
    const escrito = { ...g3, ...Object.fromEntries(uno.poner).g3 };
    const dos = emparejar([escrito], [corto, largo], uno.vistos);
    // Logged quickly before starting the watch, with nothing joined yet: the same day still joins; one far in the
    // evening, with the session already joined, stays on its own.
    const antes = { id: "a", tipo: "gimnasio", fecha: "2026-11-25", inicio: h(9, 50), fin: h(9, 51) };
    const tres = emparejar([antes], [largo, lejos], []);
    // Separated by hand: never joined to that session again.
    const cuatro = emparejar([{ ...antes, relojNo: ["w-largo"] }], [largo], ["w-largo"]);
    return { uno, reloj: Object.fromEntries(uno.poner).g3?.reloj, dos, tres: Object.fromEntries(tres.poner.map(([id, d]) => [id, d.reloj.partes?.map((p) => p.id) || d.reloj.id])), cuatro };
  });
  expect(r.uno.quitar).toEqual(["reloj-w-largo"]);
  expect(r.reloj).toMatchObject({ id: "w-largo", fcMax: 114, kcal: 275, fcMedia: 91, curvaPaso: 60 });
  expect(r.reloj.fin - r.reloj.inicio).toBe(61 * 60000);
  expect(r.reloj.partes.map((p) => p.id)).toEqual(["w-corto", "w-largo"]);
  // The curve on one timeline: the short piece's minutes, a minute with nothing, then the long one.
  expect(r.reloj.curva.slice(0, 4)).toEqual([95, 97, 0, 90]);
  expect(r.dos.poner).toEqual([]);
  expect(r.tres).toEqual({ a: "w-largo", "reloj-w-tarde": "w-tarde" });
  expect(r.cuatro.poner).toEqual([]);
});

test("join a watch workout to a session by hand from the history, and separate it again", async ({ page }) => {
  // A stretching workout on the watch, but the session was logged as gym: they don't join on their own.
  await abrirComoAndroid(page, { permiso: true, relojes: [{ id: "coros-7", desde: -70, hasta: -10, categoria: "flex", fcMedia: 88, fcMax: 120, kcal: 150, titulo: "Yoga" }] });
  await page.getByRole("button", { name: "Historial" }).click();
  const li = page.locator("#lista li");
  await expect(li).toHaveCount(1);
  await page.click("#nuevaBox summary");
  await page.locator('#nueva label:has(input[value="gimnasio"])').click();
  await page.fill('#nueva textarea[name="notas"]', "a mano");
  await page.click('#nueva button[type="submit"]');
  await expect(li).toHaveCount(2);

  await li.filter({ hasText: "Solo en el reloj" }).locator("[data-ver]").click();
  await expect(page.locator("#sesReloj")).toContainText("Unir a una sesión");
  await page.locator("#sesReloj [data-unir]").click();
  // Now the session logged by hand, with the watch's data.
  await expect(page.locator("#sesNotas")).toContainText("a mano");
  await expect(page.locator("#sesStats")).toContainText("150");
  await expect(page.locator("#sesReloj")).toContainText("Yoga");
  await page.click("#sesVolver");
  await expect(li).toHaveCount(1);
  await expect(li).toContainText("FC 88/120 ppm · 150 kcal");

  await li.locator("[data-ver]").click();
  await page.locator("#sesReloj [data-separar]").click();
  await expect(page.locator("#sesReloj")).toBeHidden();
  await page.click("#sesVolver");
  await expect(li).toHaveCount(2);
  await expect(li.filter({ hasText: "Solo en el reloj" })).toContainText("150 kcal");

  // Every new text has its translation.
  const faltan = await page.evaluate(async () => {
    const claves = ["Unir a una sesión", "¿Apuntaste las series de este entreno en la app? Únelo a esa sesión.", "No hay sesiones apuntadas cerca de este día para unir.",
      "Entrenos del reloj", "Si uno no es de esta sesión, sepáralo: volverá al historial por su cuenta.", "Separar", "{n} entreno del reloj", "{n} entrenos del reloj"];
    const r = [];
    for (const l of ["en", "de", "ca"]) { const d = (await import(`./idiomas/${l}.js`)).default; for (const k of claves) if (!d[k]) r.push(`${l}: ${k}`); }
    return r;
  });
  expect(faltan).toEqual([]);
});
