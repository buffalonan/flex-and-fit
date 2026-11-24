const { test, expect } = require("@playwright/test");
const http = require("node:http");

const unique = () => `nota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pendingCount = (page) => page.evaluate(async () => (await (await import("./store.js")).pending()).length);

async function logSession(page, { tipo = "flexibilidad", min = "15", notas }) {
  await page.getByRole("button", { name: "Historial" }).click();
  if (!(await page.locator("#nuevaBox").evaluate((d) => d.open))) await page.click("#nuevaBox summary");
  await page.locator(`#nueva label:has(input[value="${tipo}"])`).click();
  await page.fill('#nueva input[name="duracionMin"]', min);
  await page.fill('#nueva textarea[name="notas"]', notas);
  await page.click('#nueva button[type="submit"]');
  await expect(page.locator("#nuevaOk")).toBeVisible();
}

test("a session logged on one device reaches another through the Mac", async ({ page, browser }) => {
  await page.goto("/");
  const notas = unique();
  await logSession(page, { tipo: "gimnasio", notas });
  // The pill can still show the previous state for a moment, so wait for the record itself to leave.
  await expect.poll(() => pendingCount(page)).toBe(0);
  await expect(page.locator("#syncPill")).toHaveText("Sincronizado");

  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).toContainText(notas);
  await expect(page.locator("#lista")).toContainText("Gimnasio");

  // A second device: a fresh browser with empty storage.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto("/");
  await phone.getByRole("button", { name: "Historial" }).click();
  await expect(phone.locator("#lista")).toContainText(notas);

  // Deleting on the second device removes it on the first after its next sync.
  await phone.locator("li", { hasText: notas }).getByRole("button", { name: /Borrar/ }).click();
  await expect(phone.locator("#lista")).not.toContainText(notas);
  await expect.poll(() => pendingCount(phone)).toBe(0);
  await other.close();

  await page.click("#syncPill");
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).not.toContainText(notas);
});

test("with the Mac out of reach, sessions wait on the device and go up later", async ({ page }) => {
  await page.route("**/api/sync", (r) => r.abort("connectionrefused"));
  await page.goto("/");
  const notas = unique();
  await logSession(page, { notas });
  await expect(page.locator("#syncPill")).toHaveText("1 sin subir");
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).toContainText(notas);

  // Still there after closing and reopening the app.
  await page.reload();
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).toContainText(notas);

  await page.unroute("**/api/sync");
  await page.click("#syncPill");
  await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
  await expect(page.locator("#syncEstado")).toContainText("Última sincronización");
});

test("a wrong key is reported", async ({ page }) => {
  await page.route("**/api/sync", (r) => r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"clave incorrecta"}' }));
  await page.goto("/");
  await page.getByRole("button", { name: "Perfil" }).click();
  await page.fill("#token", "mala");
  await page.getByRole("button", { name: "Guardar y sincronizar" }).click();
  await expect(page.locator("#syncEstado")).toHaveText("La clave no coincide con la del Mac.");
});

test("imports the JSON from the 6-month flexibility plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Perfil" }).click();
  const plan = {
    plan: "flexibilidad-6m-v1", inicio: "2026-11-23",
    sesiones: [{ fecha: "2026-11-24", semana: 1, fase: 1, rutina: "F1", ejercicios: [{ id: "gato", dosis: "2 × 8 lentas", hecho: true }] }],
    tests: [{ fase: 1, dedosSueloCm: 22, sentadillaSeg: 5 }],
  };
  await page.setInputFiles("#importar", { name: "plan.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(plan)) });
  await expect(page.locator("#copiaEstado")).toHaveText("Importados 2 registros.");
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).toContainText("Flexibilidad · F1");
  await expect(page.locator("#lista")).toContainText("martes, 24 de noviembre");

  await page.getByRole("button", { name: "Perfil" }).click();
  await page.setInputFiles("#importar", { name: "x.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
  await expect(page.locator("#copiaEstado")).toHaveText("El archivo no es un JSON válido.");
});

test("exports every record as JSON, and the export imports back", async ({ page, browser }) => {
  await page.goto("/");
  const notas = unique();
  await logSession(page, { notas });
  await page.getByRole("button", { name: "Perfil" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportar")]);
  expect(download.suggestedFilename()).toMatch(/^flex-and-fit-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
  expect(data.app).toBe("flex-and-fit");
  expect(data.registros.some((r) => r.data.notas === notas)).toBe(true);

  // Into a device with no server, so only the import can bring it.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  await p2.goto("/");
  await expect(p2.locator("#syncPill")).toHaveText("Solo en este dispositivo");
  await p2.getByRole("button", { name: "Perfil" }).click();
  await p2.setInputFiles("#importar", { name: "copia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await expect(p2.locator("#copiaEstado")).toContainText("Importados");
  await p2.getByRole("button", { name: "Historial" }).click();
  await expect(p2.locator("#lista")).toContainText(notas);
  await other.close();
});

test("notes are shown as text, never as markup", async ({ page }) => {
  await page.route("**/api/sync", (r) => r.abort());
  await page.goto("/");
  const notas = `<img src=x onerror="window.pwned=1">${unique()}`;
  await logSession(page, { notas });
  await page.getByRole("button", { name: "Historial" }).click();
  await expect(page.locator("#lista")).toContainText(notas);
  expect(await page.locator("#lista img").count()).toBe(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});

test("week summary counts this week's sessions by kind", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  await page.goto("/");
  await logSession(page, { tipo: "gimnasio", notas: unique() });
  await logSession(page, { tipo: "flexibilidad", notas: unique() });
  await page.getByRole("button", { name: "Progreso" }).click();
  await expect(page.locator("#semana .stat").nth(0)).toContainText("2");
  await expect(page.locator("#semana .stat").nth(1)).toContainText("1");
  await expect(page.locator("#semana .stat").nth(2)).toContainText("1");
});

test("remembers the tab, and every screen fits a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Historial" }).click();
  await page.reload();
  await expect(page.locator("#historial")).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const tab of ["Entrenos", "Progreso", "Historial", "Perfil"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    expect(await overflow()).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "Entrenos", exact: true }).click();
  for (const id of ["F6", "g4"]) {
    await page.click(`#entrenos [data-abrir="${id}"] >> nth=-1`);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.click("#detEmpezar");
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.click(id === "g4" ? "#regSalir" : "#repSalir");
    await page.click("#salirDescartar");
    await page.click("#detVolver");
  }
});

test("the Android app has no server address until one is typed in Perfil", async ({ page }) => {
  // Pretend to be the Capacitor app.
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, registerPlugin: () => ({ addListener() {}, exitApp() {} }) };
  });
  let calls = 0;
  await page.route("**/api/sync", (r) => { calls++; return r.continue(); });
  await page.goto("/");
  await expect(page.locator("#syncPill")).toHaveText("Solo en este dispositivo");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#servidor")).toHaveValue("");
  await expect(page.locator("#servidorCard")).toBeVisible();
  expect(calls).toBe(0);

  // Once typed, it's remembered on this device and used.
  await page.fill("#servidor", new URL(page.url()).origin);
  await page.getByRole("button", { name: "Guardar y sincronizar" }).click();
  await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
  await page.reload();
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#servidor")).toHaveValue(new URL(page.url()).origin);
});

// Pretend to be the Capacitor app; `wifi` is what the Bonjour search finds on this Wi-Fi.
const comoApp = (page, wifi) => page.addInitScript((w) => {
  window.__busquedas = 0;
  window.Capacitor = {
    isNativePlatform: () => true,
    registerPlugin: (n) => (n === "Descubrir"
      ? { buscar: async () => { window.__busquedas++; return { direcciones: w }; } }
      : { addListener() {}, exitApp() {} }),
  };
}, wifi);

test("the Android app finds the Mac on the Wi-Fi by itself and learns its other addresses", async ({ page }) => {
  const origin = "http://127.0.0.1:4173";
  await comoApp(page, [origin]);
  await page.goto("/");
  await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#servidor")).toHaveValue(origin);
  // The server's /api/salud told it the Mac's other address.
  await expect(page.locator("#direcciones")).toHaveText("También la conozco en: http://localhost:4173");
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("flexfit.ajustes")));
  expect(guardado.servidores).toEqual([origin, "http://localhost:4173"]);
});

test("the Android app switches to another known address when the one in use doesn't answer", async ({ page }) => {
  await comoApp(page, []);
  // The app's native HTTP has no CORS; here the other address is another origin, so let it through.
  await page.route("http://localhost:4173/api/**", async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, headers: { ...res.headers(), "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
  });
  // The address in use is dead (nothing listens on port 9); the Tailscale one, say, answers.
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes",
    JSON.stringify({ servidor: "http://127.0.0.1:9", servidores: ["http://127.0.0.1:9", "http://localhost:4173"] })));
  await page.goto("/");
  await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.locator("#servidor")).toHaveValue("http://localhost:4173");
  expect(await page.evaluate(() => window.__busquedas)).toBe(0);
});

test("Buscar el Mac says so when it isn't on this Wi-Fi, and the web version has no such button", async ({ page, browser }) => {
  await comoApp(page, []);
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  await page.goto("/");
  await expect(page.locator("#syncPill")).toHaveText("Solo en este dispositivo");
  await page.getByRole("button", { name: "Perfil" }).click();
  await page.getByRole("button", { name: "Buscar el Mac en esta wifi" }).click();
  await expect(page.locator("#syncEstado")).toHaveText(/No encuentro el Mac en esta wifi/);

  const web = await browser.newPage();
  await web.goto(page.url());
  await web.getByRole("button", { name: "Perfil" }).click();
  await expect(web.locator("#buscarMac")).toBeHidden();
  await web.close();
});

// A reverse proxy like the Mac's: /fitness and /fitness/... go to the app with the prefix stripped (so /fitness
// serves the page without the last slash, as some proxies do), every other path is another web (here a 404).
async function proxyFitness() {
  const server = http.createServer((req, res) => {
    if (!/^\/fitness(\/|\?|$)/.test(req.url)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("otra web");
    }
    const up = http.request({ host: "127.0.0.1", port: 4173, path: req.url.slice("/fitness".length).replace(/^(?!\/)/, "/"), method: req.method, headers: req.headers },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${server.address().port}/fitness`, close: () => new Promise((ok) => server.close(ok)) };
}

test("works behind a proxy under /fitness, even typed without the last slash", async ({ page }) => {
  const proxy = await proxyFitness();
  // Outside /fitness/ nothing may be asked for once the page is at /fitness/ (before that, the browser's preload
  // scanner can fetch a few files at the wrong place: harmless, the address bar is fixed before anything runs).
  const fuera = [];
  page.on("request", (r) => { if (page.url().endsWith("/fitness/") && !r.url().startsWith(`${proxy.base}/`)) fuera.push(r.url()); });
  try {
    await page.goto(proxy.base);
    await expect(page).toHaveURL(`${proxy.base}/`);
    await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
    const notas = unique();
    await logSession(page, { notas });
    await expect.poll(() => pendingCount(page)).toBe(0);
    await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
    await page.getByRole("button", { name: "Perfil" }).click();
    await expect(page.locator("#servidor")).toHaveValue(proxy.base);
    expect(fuera).toEqual([]);
  } finally {
    await proxy.close();
  }
});

test("the Android app keeps the /fitness path of a typed address", async ({ page }) => {
  const proxy = await proxyFitness();
  try {
    await comoApp(page, []);
    // The app's native HTTP has no CORS; here the proxy is another origin, so let it through.
    await page.route(`${proxy.base}/api/**`, async (r) => {
      const res = await r.fetch();
      await r.fulfill({ response: res, headers: { ...res.headers(), "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    });
    await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
    await page.goto("/");
    await page.getByRole("button", { name: "Perfil" }).click();
    await page.fill("#servidor", `${proxy.base}/`);
    await page.getByRole("button", { name: "Guardar y sincronizar" }).click();
    await expect(page.locator("#syncPill")).toHaveText("Sincronizado");
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("flexfit.ajustes")));
    expect(guardado.servidor).toBe(proxy.base);
    expect(guardado.servidores[0]).toBe(proxy.base);
  } finally {
    await proxy.close();
  }
});
