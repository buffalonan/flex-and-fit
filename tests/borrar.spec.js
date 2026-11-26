// Deleting a session from Historial asks first, and keeps it 30 days in Perfil → Sesiones borradas to get it back.
const { test, expect } = require("@playwright/test");

async function abrirApp(page, time = new Date("2026-11-26T08:00:00")) {
  await page.clock.install({ time });
  await page.addInitScript(() => {
    localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
  });
  await page.goto("/");
}
const sesion = {
  tipo: "gimnasio", fecha: "2026-11-25", rutina: "g3", nombre: "Tren superior · Tirón", volumenKg: 480, notas: "Buen tirón",
  ejercicios: [{ n: "Peso muerto", series: [{ kg: 24, reps: 5, hecho: true }, { kg: 24, reps: 5, hecho: true }] }],
  reloj: { id: "w1", inicio: new Date(2026, 10, 25, 10, 13).getTime(), fin: new Date(2026, 10, 25, 11, 14).getTime(), categoria: "fuerza", fcMedia: 91, fcMax: 114, kcal: 275 },
};
const registro = (page) => page.evaluate(async () => (await (await import("./store.js")).exportAll()).registros.find((r) => r.id === "s1"));

test("Borrar asks first; Cancelar keeps the session", async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(async (d) => (await import("./store.js")).put("sesiones", "s1", d), sesion);
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-del="s1"]');
  await expect(page.locator("#borrarPanel")).toBeVisible();
  await expect(page.locator("#borrarTexto")).toContainText("Tren superior · Tirón, miércoles, 25 de noviembre");
  await page.click("#borrarNo");
  await expect(page.locator("#borrarPanel")).toBeHidden();
  await expect(page.locator('#lista [data-ver="s1"]')).toHaveCount(1);
  expect((await registro(page)).borrado).toBe(false);
});

test("a deleted session waits in Perfil and comes back whole, watch included", async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(async (d) => (await import("./store.js")).put("sesiones", "s1", d), sesion);
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#papeleraCard")).toBeHidden();
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-del="s1"]');
  await page.click("#borrarSi");
  await expect(page.locator('#lista [data-ver="s1"]')).toHaveCount(0);
  const borrado = await registro(page);
  expect(borrado.borrado).toBe(true);

  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#papeleraCard")).toBeVisible();
  await expect(page.locator("#papelera")).toContainText("Tren superior · Tirón · miércoles, 25 de noviembre");
  await page.click('#papelera [data-recuperar="s1"]');
  await expect(page.locator("#papeleraEstado")).toHaveText("Recuperada: está otra vez en Historial.");
  await expect(page.locator("#papeleraCard")).toBeHidden();

  const r = await registro(page);
  expect(r.borrado).toBe(false);
  expect(r.actualizado).toBeGreaterThan(borrado.actualizado); // newer than the delete, so it wins on the Mac too
  expect(r.data).toEqual(sesion);
  await page.click('[data-tab="historial"]');
  await expect(page.locator('#lista [data-ver="s1"]')).toContainText("275 kcal");
  await expect(page.locator('#lista [data-ver="s1"]')).toContainText("Buen tirón");
});

test("the bin keeps a deleted session 30 days", async ({ page }) => {
  await abrirApp(page);
  await page.evaluate(async (d) => {
    const dia = 864e5, ahora = Date.now();
    await (await import("./store.js")).setMeta("papelera", [{ id: "a", data: { ...d, notas: "29 días" }, borrada: ahora - 29 * dia }, { id: "b", data: d, borrada: ahora - 31 * dia }]);
  }, sesion);
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#papelera [data-recuperar]")).toHaveCount(1);
  await expect(page.locator('#papelera [data-recuperar="a"]')).toBeVisible();
});
