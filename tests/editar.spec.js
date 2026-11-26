// Editing a session of the history: its sets' kg, reps and ticks, its exercises (swap, remove, add), minutes and
// notes. Records, progression and the logger's last-time weights follow the edit; the watch data stays joined.
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
const registro = (page, id) => page.evaluate(async (id) => {
  const r = (await (await import("./store.js")).pending()).find((x) => x.tabla === "sesiones" && x.id === id);
  return r && { ...r.data, pendiente: r.pendiente };
}, id);
const g1 = (fecha, d, ejercicios, extra = {}) => ({ tipo: "gimnasio", fecha, inicio: h(d, 18), fin: h(d, 19), rutina: "g1", nombre: "Tren superior · Empuje", ejercicios, ...extra });
const reloj = { id: "w1", inicio: h(24, 18), fin: h(24, 19), categoria: "fuerza", fcMedia: 121, fcMax: 140, kcal: 410 };

test("a gym session's kg, sets and exercises are edited, saved for the Mac, and records and the logger follow", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "a", g1("2026-11-18", 18, [{ n: "Press de banca", series: series(5, 40, 8) }]));
  await poner(page, "b", g1("2026-11-24", 24, [{ n: "Press de banca", series: series(5, 42.5, 8) },
    { n: "Press inclinado", series: series(3, 24, 10) }, { n: "Elevaciones laterales", series: series(4, 15, 12) }], { volumenKg: 3000, reloj, esfuerzo: 7 }));
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="b"]');
  await expect(page.locator("#sesLista .ej").first()).toContainText("Récord · 1RM estimado 54 kg");

  await page.click("#sesEditar");
  await expect(page.locator("#editar")).toBeVisible();
  await expect(page.locator(".tabs")).toBeHidden();
  const ej = page.locator("#edLista .ed-ej");
  await expect(ej).toHaveCount(3);
  // Bench press: the first set was 50 kg, the fifth wasn't done, the fourth never happened.
  await ej.nth(0).locator('tr[data-k="0-0"] input[data-c="kg"]').fill("50");
  await ej.nth(0).locator('[data-ck="0-4"]').click();
  await expect(ej.nth(0).locator('[data-ck="0-4"]')).toHaveAttribute("aria-pressed", "false");
  await ej.nth(0).locator('[data-quita="0-3"]').click();
  await expect(ej.nth(0).locator("tbody tr")).toHaveCount(4);
  await expect(ej.nth(0).locator('tr[data-k="0-0"] input[data-c="kg"]')).toHaveValue("50");
  // The incline press was really the shoulder press, with one more set.
  await ej.nth(1).locator("[data-cambiar]").selectOption("Press de hombro sentado con mancuernas");
  await ej.nth(1).locator("[data-serie]").click();
  await expect(ej.nth(1).locator("tbody tr")).toHaveCount(4);
  await expect(ej.nth(1).locator('tr[data-k="1-3"] input[data-c="kg"]')).toHaveValue("24");
  await ej.nth(1).locator('tr[data-k="1-3"] input[data-c="n"]').fill("8");
  // No lateral raises that day, but dips.
  await ej.nth(2).locator("[data-quitar]").click();
  await expect(ej).toHaveCount(2);
  await page.locator("#edAnadir").selectOption("Fondos en paralelas");
  await expect(ej).toHaveCount(3);
  await expect(ej.nth(2).locator('input[data-c="n"]')).toHaveValue("8");
  await page.fill("#edMin", "75");
  await page.fill("#edNotas", "Corregido");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.click("#edGuardar");

  await expect(page.locator("#editar")).toBeHidden();
  await expect(page.locator("#sesion")).toBeVisible();
  const lista = page.locator("#sesLista .ej");
  await expect(lista).toHaveCount(3);
  await expect(lista.nth(0)).toContainText("3/4 series · 1080 kg");
  await expect(lista.nth(0).locator(".serie").first()).toContainText("50 kg × 8");
  // 50 × 8 → 1RM 63 kg (Epley).
  await expect(lista.nth(0)).toContainText("Récord · 1RM estimado 63 kg");
  await expect(lista.nth(1)).toContainText("Press de hombro sentado con mancuernas");
  await expect(lista.nth(1)).toContainText("4/4 series");
  await expect(lista.nth(2)).toContainText("Fondos en paralelas");
  await expect(page.locator("#sesStats")).toContainText("8Series");
  await expect(page.locator("#sesStats")).toContainText("75minDuración");
  await expect(page.locator("#sesStats")).toContainText("121ppmFC media");
  await expect(page.locator("#sesNotas")).toContainText("Corregido");

  // Saved with its new volume, waiting to go to the Mac, with the watch and the effort kept.
  const r = await registro(page, "b");
  expect(r.pendiente).toBe(1);
  expect(r.volumenKg).toBe(1080 + 3 * 240 + 24 * 8);
  expect(r.reloj.id).toBe("w1");
  expect(r.esfuerzo).toBe(7);
  expect(r.duracionMin).toBe(75);
  expect(r.ejercicios.map((e) => e.n)).toEqual(["Press de banca", "Press de hombro sentado con mancuernas", "Fondos en paralelas"]);
  expect(r.ejercicios[0].series).toEqual([{ kg: 50, reps: 8, hecho: true }, { kg: 42.5, reps: 8, hecho: true }, { kg: 42.5, reps: 8, hecho: true }, { kg: 42.5, reps: 8, hecho: false }]);
  await expect(page.locator('#lista [data-ver="b"]')).toContainText("Corregido");

  // The logger starts from the edited weights.
  await page.click("#sesVolver");
  await page.click('[data-tab="entrenos"]');
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g1"]');
  await page.click("#detEmpezar");
  await expect(page.locator('#regFilas tr >> nth=0 >> input[data-c="kg"]')).toHaveValue("50");
  await expect(page.locator('#regFilas tr >> nth=1 >> input[data-c="kg"]')).toHaveValue("42.5");
  await expect(page.locator("#regSube")).toBeHidden();
});

test("cancelling leaves the session as it was", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "b", g1("2026-11-24", 24, [{ n: "Press de banca", series: series(2, 42.5, 8) }]));
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="b"]');
  await page.click("#sesEditar");
  await page.locator('#edLista tr[data-k="0-0"] input[data-c="kg"]').fill("80");
  await page.locator('[data-quitar="0"]').click();
  await page.click("#edCancelar");
  await expect(page.locator("#editar")).toBeHidden();
  await expect(page.locator("#sesLista .ej")).toHaveCount(1);
  await expect(page.locator("#sesLista .serie").first()).toContainText("42,5 kg × 8");
  // Opening it again starts from what's saved.
  await page.click("#sesEditar");
  await expect(page.locator('#edLista tr[data-k="0-0"] input[data-c="kg"]')).toHaveValue("42.5");
  await page.click("#edSalir");
  await expect(page.locator("#sesion")).toBeVisible();
});

test("sets written into a watch-only workout make it a session of its own, still with the watch's data", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "reloj-w1", { tipo: "gimnasio", fecha: "2026-11-24", inicio: h(24, 18), fin: h(24, 19), duracionMin: 60, nombre: "Fuerza", notas: "", origen: "reloj", reloj });
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="reloj-w1"]');
  await page.click("#sesEditar");
  await expect(page.locator("#edLista .ed-ej")).toHaveCount(0);
  await page.locator("#edAnadir").selectOption("Plancha");
  await expect(page.locator('#edLista input[data-c="n"]')).toHaveValue("80");
  await expect(page.locator("#edLista th").nth(2)).toHaveText("SEG");
  await page.click("#edGuardar");
  await expect(page.locator("#sesLista .ej")).toContainText("1:20");
  await expect(page.locator("#sesTipo")).not.toContainText("Solo en el reloj");
  const r = await registro(page, "reloj-w1");
  expect(r.origen).toBeUndefined();
  expect(r.reloj.id).toBe("w1");
  expect(r.ejercicios).toEqual([{ n: "Plancha", series: [{ kg: null, seg: 80, hecho: true }] }]);
});

test("a stretching session's exercises are marked done or skipped", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "plan-2026-11-24", { tipo: "flexibilidad", fecha: "2026-11-24", rutina: "F1", duracionMin: 20,
    ejercicios: [{ id: "gato", dosis: "2 × 8", hecho: true }, { id: "viejo", dosis: "1 × 30 s", hecho: true }, { id: "isquio_toalla", dosis: "2 × 30 s /lado", hecho: false }] });
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="plan-2026-11-24"]');
  await page.click("#sesEditar");
  // A stretch the app no longer knows isn't shown, but stays in the session.
  await expect(page.locator("#edLista li")).toHaveCount(2);
  await expect(page.locator("#edAnadirBox")).toBeHidden();
  await page.locator('[data-hecho="2"]').click();
  await expect(page.locator('[data-hecho="2"]')).toHaveText("Hecho ✓");
  await page.locator('[data-hecho="0"]').click();
  await page.click("#edGuardar");
  await expect(page.locator("#sesStats")).toContainText("1/3Ejercicios");
  await expect(page.locator("#sesLista .ej").nth(0)).toHaveClass(/saltado/);
  await expect(page.locator("#sesLista .ej").nth(1)).not.toHaveClass(/saltado/);
  const r = await registro(page, "plan-2026-11-24");
  expect(r.ejercicios.map((e) => [e.id, e.hecho])).toEqual([["gato", false], ["viejo", true], ["isquio_toalla", true]]);
  expect(r.rutina).toBe("F1");
});

test("an assisted set is made negative with ± when editing, since the phone's keyboard has no minus", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "d", { tipo: "gimnasio", fecha: "2026-11-24", inicio: h(24, 18), fin: h(24, 19), rutina: "g3", nombre: "Tren superior · Tirón", ejercicios: [{ n: "Dominadas", series: series(2, 20, 8) }] });
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="d"]');
  await page.click("#sesEditar");
  await page.locator('#edLista tr[data-k="0-0"] [data-signo]').click();
  await expect(page.locator('#edLista tr[data-k="0-0"] input[data-c="kg"]')).toHaveValue("-20");
  await expect(page.locator('#edLista tr[data-k="0-1"] input[data-c="kg"]')).toHaveValue("20");
  await page.click("#edGuardar");
  const r = await registro(page, "d");
  expect(r.ejercicios[0].series.map((x) => x.kg)).toEqual([-20, 20]);
});
