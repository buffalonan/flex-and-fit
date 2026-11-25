// Body weight: from Health Connect (the "Salud" plugin is faked, as in reloj.spec.js) or typed in Perfil. It gives the
// strength relative to your weight and the volume of bodyweight exercises, and Progreso charts it.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
const h = (d, hh = 8) => new Date(2026, 10, d, hh).getTime();
async function abrir(page, { android = false, pesos = [] } = {}) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript(({ android, pesos }) => {
    localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" }));
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    if (!android) return;
    window.__peso = false;
    const estado = () => ({ disponible: true, permiso: true, fc: true, kcal: true, peso: window.__peso });
    const plugins = {
      App: { addListener() {}, exitApp() {} },
      Descubrir: { buscar: async () => ({ direcciones: [] }) },
      Salud: {
        estado: async () => estado(),
        pedirPermiso: async () => { window.__peso = true; return estado(); },
        sesiones: async () => ({ sesiones: [] }),
        peso: async () => ({ pesos: window.__peso ? pesos : [] }),
        fc: async () => ({}),
      },
    };
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: (n) => plugins[n] };
  }, { android, pesos });
  await page.goto("/");
}
async function poner(page, tabla, id, data) {
  await page.evaluate(async ([tabla, id, data]) => (await import("./store.js")).put(tabla, id, data), [tabla, id, data]);
}
const sesion = (fecha, d, ejercicios) => ({ tipo: "gimnasio", fecha, inicio: h(d, 18), fin: h(d, 19), rutina: "g1", nombre: "Tren superior · Empuje", ejercicios });
const series = (n, kg, reps) => Array.from({ length: n }, () => ({ kg, reps, hecho: true }));

test("weights join by day: the day's latest reading, hand-typed days kept, impossible values dropped", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async ([a, b, c, d]) => {
    const { unirPesos } = await import("./reloj.js");
    return unirPesos([{ fecha: "2026-11-20", kg: 81, origen: "mano" }, { fecha: "2026-11-21", kg: 80.9, origen: "hc" }],
      [{ t: a, kg: 80.04 }, { t: b, kg: 80.62 }, { t: c, kg: 79.5 }, { t: d, kg: 5 }]);
  }, [h(21, 7), h(21, 9), h(20, 8), h(22, 8)]);
  expect(r).toEqual([{ fecha: "2026-11-20", kg: 81, origen: "mano" }, { fecha: "2026-11-21", kg: 80.6, origen: "hc" }]);
});

test("in the app, Perfil asks for the weight permission, reads it, and it gives relative strength, volume and a chart", async ({ page }) => {
  await abrir(page, { android: true, pesos: [{ t: h(1), kg: 82, origen: "com.sec.android.app.shealth" }, { t: h(24), kg: 80, origen: "com.sec.android.app.shealth" }] });
  await poner(page, "sesiones", "a", sesion("2026-11-24", 24, [{ n: "Press de banca", series: series(5, 45, 8) }, { n: "Fondos en paralelas", series: series(3, null, 8) }]));
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#pesoEstado")).toHaveText("Sin peso todavía.");
  await page.click("#pesoPermiso");
  await expect(page.locator("#pesoEstado")).toContainText("80 kg");
  await expect(page.locator("#pesoEstado")).toContainText("de Health Connect");
  await expect(page.locator("#pesoPermiso")).toBeHidden();

  await page.click('[data-tab="progreso"]');
  await expect(page.locator("#pesoGraf")).toBeVisible();
  await expect(page.locator("#pesoGraf")).toContainText("−2 kg");
  // 45 × 8 → 1RM 57 kg, 0,71 times 80 kg.
  await expect(page.locator("#records li").filter({ hasText: "Press de banca" })).toContainText("0,71× tu peso");

  // Dips with no weight at 80 kg: 3 × 8 × 80 = 1920 kg, plus the bench press's 1800.
  await page.click('[data-tab="historial"]');
  await page.click('#lista [data-ver="a"]');
  await expect(page.locator("#sesStats")).toContainText("3720kgVolumen");
  await expect(page.locator("#sesVol li").filter({ hasText: "Fondos" })).toContainText("1920 kg");
});

test("on the web the weight is typed in Perfil, and assisted sets count your weight minus the help", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("#pesoPermiso")).toBeHidden();
  await page.click('[data-tab="perfil"]');
  await page.fill("#pesoKg", "10");
  await page.click('#pesoForm button[type="submit"]');
  await expect(page.locator("#pesoEstado")).toHaveText("Escribe tu peso en kg, entre 20 y 400.");
  await page.fill("#pesoKg", "75");
  await page.click('#pesoForm button[type="submit"]');
  await expect(page.locator("#pesoEstado")).toContainText("75 kg");
  await expect(page.locator("#pesoEstado")).toContainText("apuntado a mano");
  await expect(page.locator("#pesoGraf")).toBeHidden();

  // Assisted pull-ups with 20 kg of help at 75 kg: 4 × 8 × 55.
  await page.click('[data-tab="entrenos"]');
  await page.locator('label:has(input[value="fuerza"])').click();
  await page.click('[data-abrir="g3"]');
  await page.click("#detEmpezar");
  await page.click("#regSig");
  await expect(page.locator("#regTitulo")).toHaveText("Dominadas");
  await page.locator('#regFilas tr >> nth=0 >> input[data-c="kg"]').fill("-20");
  for (let i = 0; i < 4; i++) await page.click(`[data-ck="1-${i}"]`);
  for (let i = 0; i < 5; i++) await page.click("#regSig");
  await expect(page.locator("#resStats")).toContainText("1760kg");
});
