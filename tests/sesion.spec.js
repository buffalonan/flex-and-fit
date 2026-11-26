// A session of the history opens its own screen: exercises with their sets, the watch's numbers and the charts.
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
const h = (d, hh, mm = 0) => new Date(2026, 10, d, hh, mm).getTime();
const banca = (kg, reps, hechas = 5) => ({ n: "Press de banca", series: Array.from({ length: 5 }, (_, i) => ({ kg, reps, hecho: i < hechas })) });
async function poner(page, id, data) {
  await page.evaluate(async ([id, data]) => (await import("./store.js")).put("sesiones", id, data), [id, data]);
}

test("tapping a gym session shows its sets, its volume per exercise, the weight's progression and the watch's heart rate", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "a", { tipo: "gimnasio", fecha: "2026-11-18", inicio: h(18, 18), fin: h(18, 19), rutina: "g1", nombre: "Tren superior · Empuje", volumenKg: 1600, ejercicios: [banca(40, 8)] });
  await poner(page, "b", { tipo: "gimnasio", fecha: "2026-11-21", inicio: h(21, 18), fin: h(21, 19), rutina: "g1", nombre: "Tren superior · Empuje", volumenKg: 1680, ejercicios: [banca(42, 8)] });
  const curva = Array.from({ length: 60 }, (_, i) => (i === 10 ? 0 : 100 + Math.round(40 * Math.sin(i / 6) ** 2)));
  await poner(page, "c", {
    tipo: "gimnasio", fecha: "2026-11-24", inicio: h(24, 18), fin: h(24, 19), duracionMin: 60, rutina: "g1", nombre: "Tren superior · Empuje", volumenKg: 1690, notas: "Buen día",
    ejercicios: [banca(45, 8, 4), { n: "Fondos en paralelas", series: [{ kg: -10, reps: 8, hecho: true }, { kg: null, reps: 6, hecho: true }] },
      { n: "Extensión de tríceps en polea", series: [{ kg: 25, reps: 10, hecho: true }, { kg: 25, reps: 10, hecho: false }] }],
    reloj: { id: "w1", inicio: h(24, 18), fin: h(24, 19), categoria: "fuerza", fcMedia: 121, fcMax: 140, kcal: 410, curva, curvaPaso: 60 },
  });
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="c"]');
  await expect(page.locator("#sesion")).toBeVisible();
  await expect(page.locator("#historial")).toBeHidden();
  await expect(page.locator("#sesTitle")).toHaveText("Tren superior · Empuje");
  await expect(page.locator("#sesSub")).toContainText("martes, 24 de noviembre");
  await expect(page.locator("#sesStats")).toContainText("7Series");
  await expect(page.locator("#sesStats")).toContainText("1690kgVolumen");
  await expect(page.locator("#sesStats")).toContainText("121ppmFC media");
  await expect(page.locator("#sesStats")).toContainText("140ppmFC máxima");
  await expect(page.locator("#sesStats")).toContainText("410kcalCalorías");
  // Primary muscles of the sets done light up.
  await expect(page.locator('#sesMan [data-m="pecho"]').first()).toHaveAttribute("fill", "var(--prim)");

  const ej = page.locator("#sesLista .ej");
  await expect(ej).toHaveCount(3);
  await expect(ej.nth(0)).toContainText("4/5 series · 1440 kg");
  await expect(ej.nth(0).locator(".serie")).toHaveCount(5);
  await expect(ej.nth(0).locator(".serie.ok")).toHaveCount(4);
  await expect(ej.nth(0).locator(".serie").first()).toContainText("45 kg × 8");
  // Assisted dips: negative kg shown, nothing in the volume.
  await expect(ej.nth(1).locator(".serie").first()).toContainText("-10 kg × 8");
  await expect(ej.nth(1).locator(".serie").nth(1)).toContainText("PC × 6");
  // The bench press went 40 → 42 → 45 kg over three sessions.
  await expect(ej.nth(0).locator(".prog")).toContainText("Peso máximo, últimas 3 veces · +5 kg");
  await expect(ej.nth(0).locator(".prog circle")).toHaveCount(3);
  await expect(ej.nth(2).locator(".prog")).toHaveCount(0);

  // Volume per exercise: the bench press first.
  await expect(page.locator("#sesVol .barras li")).toHaveCount(2);
  await expect(page.locator("#sesVol .barras li").first()).toContainText("Press de banca");
  await expect(page.locator("#sesVol .barras li").nth(1)).toContainText("250 kg");

  // Heart-rate chart, with a cursor on touch.
  await expect(page.locator("#sesFc .fc-graf")).toBeVisible();
  await expect(page.locator("#sesFc")).toContainText("media 121");
  await page.locator("#sesFc .fc-toque").hover();
  await expect(page.locator("#sesFc .fc-cursor")).toHaveAttribute("visibility", "visible");
  await expect(page.locator("#sesFc .fc-cursor text")).toContainText("ppm");
  await expect(page.locator("#sesNotas")).toContainText("Buen día");

  // The screen fits a phone, and back goes to the history.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.click("#sesVolver");
  await expect(page.locator("#historial")).toBeVisible();
  await expect(page.locator("#sesion")).toBeHidden();
});

test("a stretching session and one logged by hand open too; deleting from the list still works", async ({ page }) => {
  await abrirApp(page);
  await poner(page, "plan-2026-11-24", { tipo: "flexibilidad", fecha: "2026-11-24", rutina: "F1", duracionMin: 20,
    ejercicios: [{ id: "gato", dosis: "2 × 8", hecho: true }, { id: "isquio_toalla", dosis: "2 × 30 s /lado", hecho: false }] });
  await poner(page, "m", { tipo: "gimnasio", fecha: "2026-11-23", duracionMin: 45, notas: "Sin apuntar series" });
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="plan-2026-11-24"]');
  const ej = page.locator("#sesLista .ej");
  await expect(ej).toHaveCount(2);
  await expect(ej.nth(0)).toContainText("Hecho ✓");
  await expect(ej.nth(1)).toHaveClass(/saltado/);
  await expect(page.locator("#sesStats")).toContainText("1/2Ejercicios");
  await expect(page.locator('#sesMan [data-m="lumbar"]').first()).not.toHaveAttribute("fill", "var(--body)");
  await expect(page.locator("#sesFc")).toBeHidden();
  await expect(page.locator("#sesVol")).toBeHidden();
  await page.click("#sesVolver");
  await page.click('#lista [data-ver="m"]');
  await expect(page.locator("#sesNota")).toHaveText("Sesión apuntada a mano, sin ejercicios.");
  await expect(page.locator("#sesStats")).toContainText("45minDuración");
  await expect(page.locator("#sesMan")).toBeHidden();
  await page.click("#sesVolver");
  await page.click('#lista [data-del="m"]');
  await page.click("#borrarSi");
  await expect(page.locator('#lista [data-ver="m"]')).toHaveCount(0);
  await expect(page.locator("#historial")).toBeVisible();
});
