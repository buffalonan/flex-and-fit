const { test, expect, _android } = require("@playwright/test");

const PKG = "io.github.buffalonan.flexandfit";

test("the app opens, saves a session with no Mac in reach and keeps it", async () => {
  const [device] = await _android.devices();
  expect(device, "no emulator found by adb").toBeTruthy();
  try {
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    // Debug builds let Playwright drive the app's WebView like a browser tab.
    const page = await (await device.webView({ pkg: PKG }, { timeout: 60_000 })).page();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await expect(page.locator("#hoy")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(true);
    // Native HTTP lets the app reach the Mac's plain-http server from the app's https origin.
    expect(await page.evaluate(() => window.Capacitor.isPluginAvailable("CapacitorHttp"))).toBe(true);

    const notas = `emulador-${Date.now()}`;
    await page.fill('#nueva textarea[name="notas"]', notas);
    await page.click('#nueva button[type="submit"]');
    await expect(page.locator("#nuevaOk")).toBeVisible();
    // The emulator can't reach the Mac, so the session waits on the phone.
    await expect(page.locator("#syncPill")).toHaveText(/sin subir/, { timeout: 30_000 });
    await page.click('.tabs button[data-tab="historial"]');
    await expect(page.locator("#lista")).toContainText(notas);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  } finally {
    await device.close();
  }
});
