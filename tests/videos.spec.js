// Each exercise's YouTube clip (VIDEOS in datos.js, video.js): on demand in its sheet, with the figure as fallback.
const { test, expect } = require("@playwright/test");

const MIERCOLES = new Date("2026-11-25T10:00:00");
// YouTube is never reached from the tests: the embed is a stub page that reports "ended" like the real player.
const STUB = `<!doctype html><body><script>
  addEventListener("message", (e) => {
    const d = JSON.parse(e.data);
    (window.recibidos ||= []).push(d);
    if (d.event === "listening") parent.postMessage(JSON.stringify({ event: "onStateChange", info: 0 }), "*");
  });
</script></body>`;

async function abrirApp(page) {
  await page.clock.install({ time: MIERCOLES });
  await page.addInitScript(() => localStorage.setItem("flexfit.ajustes", JSON.stringify({ servidor: "" })));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/.test(tipo) ? null : get.call(this, tipo, ...r); };
  });
  await page.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ contentType: "text/html", body: STUB }));
  await page.goto("/");
}

test("every clip points at an exercise the app has, and is a short piece of a YouTube video", async ({ page }) => {
  await page.goto("/");
  const malos = await page.evaluate(async () => {
    const { VIDEOS, EX, FIG_FUERZA } = await import("./datos.js");
    const figs = new Set([...Object.keys(EX), ...Object.values(FIG_FUERZA)]);
    return Object.entries(VIDEOS).filter(([fig, v]) => !figs.has(fig) || !/^[\w-]{11}$/.test(v.id) || !v.canal
      || !(v.ini >= 0) || !(v.fin - v.ini >= 5 && v.fin - v.ini <= 25)).map(([fig]) => fig);
  });
  expect(malos).toEqual([]);
});

test("a gym exercise's sheet plays its clip on demand, loops it, and goes back to the figure", async ({ page }) => {
  await abrirApp(page);
  await page.click('#listaFuerza [data-abrir="kb"]');
  await page.locator("#detLista .ej", { hasText: "Molino" }).click();
  const fig = page.locator("#fichaFig .fig3d");
  await expect(fig).toBeVisible();
  await expect(page.locator("#fichaFig iframe")).toHaveCount(0);

  await page.click("#fichaVideo");
  const iframe = page.locator("#fichaFig iframe");
  await expect(iframe).toBeVisible();
  await expect(fig).toBeHidden();
  const src = new URL(await iframe.getAttribute("src"));
  expect(src.origin).toBe("https://www.youtube-nocookie.com");
  expect(src.searchParams.get("mute")).toBe("1");
  expect(Number(src.searchParams.get("end"))).toBeGreaterThan(Number(src.searchParams.get("start")));
  await expect(page.locator("#fichaFig .video-pie a")).toHaveAttribute("href", /youtube\.com\/watch\?v=[\w-]{11}&t=\d+s/);
  await expect(page.locator("#fichaFig .video-pie")).toContainText("Vídeo:");
  // On "ended" the app sends it back to the clip's start and plays again.
  const frame = page.frameLocator("#fichaFig iframe");
  await expect.poll(() => frame.locator("body").evaluate(() => (window.recibidos || []).map((d) => d.func || d.event).join(",")))
    .toContain("seekTo,playVideo");
  const vuelta = await frame.locator("body").evaluate(() => window.recibidos.find((d) => d.func === "seekTo").args[0]);
  expect(vuelta).toBe(Number(src.searchParams.get("start")));

  await expect(page.locator("#fichaVideo")).toHaveText("Ver la figura");
  await page.click("#fichaVideo");
  await expect(iframe).toHaveCount(0);
  await expect(fig).toBeVisible();

  // Leaving the sheet removes the player.
  await page.click("#fichaVideo");
  await page.click("#fichaSalir");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("a stretch has its clip too, and offline the figure stays with a note", async ({ page, context }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.locator("#detLista .ej").nth(5).click(); // Isquios con toalla
  await expect(page.locator("#fichaVideo")).toBeVisible();
  await context.setOffline(true);
  await page.click("#fichaVideo");
  await expect(page.locator("#fichaFig .video")).toContainText("Sin conexión");
  await expect(page.locator("#fichaFig iframe")).toHaveCount(0);
  await expect(page.locator("#fichaFig .fig3d")).toBeVisible();
  await context.setOffline(false);
});

test("an exercise with no clip (the breathing) shows no video button", async ({ page }) => {
  await abrirApp(page);
  await page.click('#hoyCard [data-abrir="F1"]');
  await page.locator("#detLista .ej").first().click(); // Respiración boca arriba
  await expect(page.locator("#fichaTitulo")).toHaveText("Respiración boca arriba");
  await expect(page.locator("#fichaVideo")).toHaveCount(0);
});
