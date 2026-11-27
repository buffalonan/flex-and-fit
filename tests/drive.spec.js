// The copy of the whole history in Google Drive (Android app only): the "Drive" plugin is faked, and Google's
// Drive API is answered by the test from an in-memory file in the app's folder.
const { test, expect } = require("@playwright/test");

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };
const sesion = (notas, fecha = "2026-11-20") => ({
  tipo: "gimnasio", fecha, rutina: "g3", nombre: "Tren superior · Tirón", volumenKg: 240, notas,
  ejercicios: [{ n: "Peso muerto", series: [{ kg: 24, reps: 5, hecho: true }, { kg: 24, reps: 5, hecho: true }] }],
});
const copiaCon = (...registros) => ({ app: "flex-and-fit", version: 1, exportado: "2026-11-20T10:00:00Z", registros });
const reg = (id, data, actualizado = 1_700_000_000_000) => ({ tabla: "sesiones", id, data, actualizado, borrado: false });

// Google's side: about (the account), the file list, creating the file, downloading and uploading it, and revoking.
function driveFalso(page, { copia = null } = {}) {
  const d = { copia, id: copia ? "f1" : null, creado: null, subidas: [], revocados: 0, listas: [] };
  page.route("https://www.googleapis.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const u = new URL(req.url());
    const ok = (json) => route.fulfill({ json, headers: CORS });
    if (req.headers().authorization !== "Bearer tok-ok") return route.fulfill({ status: 401, json: {}, headers: CORS });
    if (u.pathname === "/drive/v3/about") return ok({ user: { emailAddress: "ferran@example.com", displayName: "Ferran" } });
    if (u.pathname === "/drive/v3/files" && req.method() === "GET") {
      d.listas.push(Object.fromEntries(u.searchParams));
      return ok({ files: d.id ? [{ id: d.id, modifiedTime: "2026-11-20T10:00:00Z" }] : [] });
    }
    if (u.pathname === "/drive/v3/files" && req.method() === "POST") { d.creado = req.postDataJSON(); d.id = "f1"; return ok({ id: "f1" }); }
    if (u.pathname === "/drive/v3/files/f1" && u.searchParams.get("alt") === "media") return ok(d.copia);
    if (u.pathname === "/upload/drive/v3/files/f1" && req.method() === "PATCH") { d.copia = req.postDataJSON(); d.subidas.push(d.copia); return ok({ id: "f1" }); }
    return route.fulfill({ status: 404, json: {}, headers: CORS });
  });
  page.route("https://oauth2.googleapis.com/revoke", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    d.revocados++;
    return route.fulfill({ json: {}, headers: CORS });
  });
  return d;
}

// tokens: what the plugin hands out, first one first; olvidar drops it. `conectada`: whether Google already has
// this app's permission (else only an interactive call gets a token).
async function abrirComoAndroid(page, { tokens = ["tok-ok"], conectada = false, ajustes = {} } = {}) {
  await page.addInitScript(({ tokens, conectada, ajustes }) => {
    if (!sessionStorage.getItem("iniciado")) {
      sessionStorage.setItem("iniciado", "1");
      localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "", ...ajustes }));
      sessionStorage.setItem("drive", JSON.stringify({ tokens, conectada, olvidados: [], interactivos: 0 }));
    }
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
    const estado = () => JSON.parse(sessionStorage.getItem("drive"));
    const guardar = (s) => sessionStorage.setItem("drive", JSON.stringify(s));
    const plugins = {
      App: { addListener() {}, exitApp() {} },
      Descubrir: { buscar: async () => ({ direcciones: [] }) },
      Drive: {
        disponible: async () => ({ disponible: true }),
        token: async ({ interactivo }) => {
          const s = estado();
          if (interactivo) { s.interactivos++; s.conectada = true; }
          guardar(s);
          if (!s.conectada) throw Object.assign(new Error("Hace falta iniciar sesión con Google."), { code: "permiso" });
          return { token: s.tokens[0] };
        },
        olvidar: async ({ token }) => {
          const s = estado();
          s.olvidados.push(token);
          if (s.tokens.length > 1 && s.tokens[0] === token) s.tokens.shift();
          guardar(s);
        },
      },
    };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n in plugins, registerPlugin: (n) => plugins[n] };
  }, { tokens, conectada, ajustes });
  await page.goto("/");
  await expect(page.locator("#version")).not.toBeEmpty();
}
const plugin = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("drive")));
const guardar = (page, id, data) => page.evaluate(async ([id, data]) => (await import("./store.js")).put("sesiones", id, data), [id, data]);
const ids = (copia) => copia.registros.map((r) => r.id).sort();

test("a fresh install connects to Google and gets the whole history back from Drive", async ({ page }) => {
  const d = driveFalso(page, { copia: copiaCon(reg("s1", sesion("De hace un año", "2025-11-20")), reg("s2", sesion("Del martes"))) });
  await abrirComoAndroid(page);
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#driveCard")).toBeVisible();
  await expect(page.locator("#driveEstado")).toHaveText("Sin conectar.");
  await expect(page.locator("#driveCopiar")).toBeHidden();

  await page.click("#driveConectar");
  await expect(page.locator("#driveEstado")).toContainText("Conectada: ferran@example.com.");
  await expect(page.locator("#driveEstado")).toContainText("Recuperados 2 registros de tu copia en Drive.");
  await expect(page.locator("#driveEstado")).toContainText("2 registros");
  await expect(page.locator("#driveConectar")).toBeHidden();
  await expect(page.locator("#driveCopiar")).toBeVisible();
  // Only the app's own folder, and nothing to upload: the device has nothing the copy hasn't.
  expect(d.listas[0].spaces).toBe("appDataFolder");
  expect(d.subidas).toHaveLength(0);
  expect((await plugin(page)).interactivos).toBe(1);

  await page.click('[data-tab="historial"]');
  await expect(page.locator('#lista [data-ver="s1"]')).toContainText("De hace un año");
  await expect(page.locator('#lista [data-ver="s2"]')).toContainText("Del martes");
  // What came back is pending, so it reaches the Mac too.
  const pendientes = await page.evaluate(async () => (await (await import("./store.js")).pending()).map((r) => r.id).sort());
  expect(pendientes).toEqual(["s1", "s2"]);
});

test("the first copy creates the file in the app's folder, and later copies upload only when something changed", async ({ page }) => {
  const d = driveFalso(page);
  await abrirComoAndroid(page);
  await guardar(page, "s1", sesion("Primera"));
  await page.click('[data-tab="perfil"]');
  await page.click("#driveConectar");
  await expect(page.locator("#driveEstado")).toContainText("Última copia:");
  expect(d.creado).toEqual({ name: "flex-and-fit-copia.json", parents: ["appDataFolder"], mimeType: "application/json" });
  expect(d.subidas).toHaveLength(1);
  expect(ids(d.copia)).toEqual(["s1"]);
  expect(d.copia.app).toBe("flex-and-fit");

  await guardar(page, "s2", sesion("Segunda"));
  await page.click("#driveCopiar");
  await expect.poll(() => d.subidas.length).toBe(2);
  expect(ids(d.copia)).toEqual(["s1", "s2"]);

  await page.click("#driveCopiar");
  await expect(page.locator("#driveCopiar")).toBeEnabled();
  await expect.poll(() => d.listas.length).toBe(3);
  expect(d.subidas).toHaveLength(2);
});

test("a copy merges both ways: the newest version of each record wins", async ({ page }) => {
  const d = driveFalso(page, { copia: copiaCon(reg("s1", sesion("Vieja en Drive"), 1000), reg("s3", sesion("Solo en Drive"))) });
  await abrirComoAndroid(page);
  await guardar(page, "s1", sesion("Nueva en el móvil"));
  await guardar(page, "s2", sesion("Solo en el móvil"));
  await page.click('[data-tab="perfil"]');
  await page.click("#driveConectar");
  await expect(page.locator("#driveEstado")).toContainText("Recuperado 1 registro de tu copia en Drive.");
  expect(ids(d.copia)).toEqual(["s1", "s2", "s3"]);
  expect(d.copia.registros.find((r) => r.id === "s1").data.notas).toBe("Nueva en el móvil");
  await page.click('[data-tab="historial"]');
  await expect(page.locator('#lista [data-ver="s1"]')).toContainText("Nueva en el móvil");
  await expect(page.locator('#lista [data-ver="s3"]')).toContainText("Solo en Drive");
});

test("an expired token is dropped and a fresh one used", async ({ page }) => {
  const d = driveFalso(page, { copia: copiaCon(reg("s1", sesion("En Drive"))) });
  await abrirComoAndroid(page, { tokens: ["tok-viejo", "tok-ok"] });
  await page.click('[data-tab="perfil"]');
  await page.click("#driveConectar");
  await expect(page.locator("#driveEstado")).toContainText("Recuperado 1 registro");
  expect((await plugin(page)).olvidados).toEqual(["tok-viejo"]);
  expect(d.listas).toHaveLength(1);
});

test("once connected, opening the app copies on its own; if Google wants a sign-in again it asks in Perfil", async ({ page }) => {
  const d = driveFalso(page);
  await abrirComoAndroid(page, { conectada: true, ajustes: { drive: { email: "ferran@example.com" } } });
  await guardar(page, "s1", sesion("Sin tocar nada"));
  await page.reload();
  await expect.poll(() => d.subidas.length).toBe(1);
  expect(ids(d.copia)).toEqual(["s1"]);
  expect((await plugin(page)).interactivos).toBe(0);

  // Google took the permission back (e.g. from the Google account's settings).
  await page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem("drive")); s.conectada = false; sessionStorage.setItem("drive", JSON.stringify(s)); });
  await guardar(page, "s2", sesion("Otra"));
  await page.evaluate(async () => (await import("./store.js")).setMeta("drive", null));
  await page.reload();
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#driveEstado")).toContainText("Google pide iniciar sesión otra vez");
  await expect(page.locator("#driveConectar")).toBeVisible();
  await expect(page.locator("#driveCopiar")).toBeHidden();
  await page.click("#driveConectar");
  await expect.poll(() => d.subidas.length).toBe(2);
  await expect(page.locator("#driveEstado")).not.toContainText("Google pide");
});

test("Desconectar takes Google's permission back and keeps the copy in Drive", async ({ page }) => {
  const d = driveFalso(page, { copia: copiaCon(reg("s1", sesion("En Drive"))) });
  await abrirComoAndroid(page);
  await page.click('[data-tab="perfil"]');
  await page.click("#driveConectar");
  await expect(page.locator("#driveDesconectar")).toBeVisible();
  await page.click("#driveDesconectar");
  await expect(page.locator("#driveEstado")).toContainText("Desconectada. La copia sigue en tu Drive");
  await expect(page.locator("#driveConectar")).toBeVisible();
  await expect(page.locator("#driveDesconectar")).toBeHidden();
  expect(d.revocados).toBe(1);
  expect((await plugin(page)).olvidados).toEqual(["tok-ok"]);
  expect(d.copia.registros).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("flexfit.ajustes")).drive)).toBeNull();
});

test("the web (the Mac's page and the demo) has no Drive card", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#exportar")).toBeVisible();
  await expect(page.locator("#driveCard")).toBeHidden();
});

test("the Drive card speaks the app's language", async ({ page }) => {
  driveFalso(page, { copia: copiaCon(reg("s1", sesion("En Drive")), reg("s2", sesion("Otra"))) });
  await abrirComoAndroid(page, { ajustes: { idioma: "de" } });
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#driveConectar")).toHaveText("Mit Google verbinden");
  await expect(page.locator("#driveEstado")).toHaveText("Nicht verbunden.");
  await page.click("#driveConectar");
  await expect(page.locator("#driveEstado")).toContainText("Verbunden: ferran@example.com.");
  await expect(page.locator("#driveEstado")).toContainText("2 Datensätze aus deiner Drive-Kopie wiederhergestellt.");
  const faltan = await page.evaluate(async () => [...(await import("./i18n.js")).faltan]);
  expect(faltan).toEqual([]);
});

test("Perfil says before connecting that health data goes to Google, and says so if Google doesn't take the permission back", async ({ page }) => {
  driveFalso(page);
  await page.route("https://oauth2.googleapis.com/revoke", (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 500, json: {}, headers: CORS }));
  await abrirComoAndroid(page);
  await page.click('[data-tab="perfil"]');
  await expect(page.locator("#driveCard")).toContainText("Incluye tus datos de salud (entrenos, frecuencia cardiaca, calorías y peso), que se suben así a Google.");
  await page.click("#driveConectar");
  await page.click("#driveDesconectar");
  await expect(page.locator("#driveEstado")).toContainText("No se pudo quitar el permiso en Google");
  await expect(page.locator("#driveEstado")).toHaveClass(/error/);
  await expect(page.locator("#driveConectar")).toBeVisible();
});
