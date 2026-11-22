const { test, expect, _android } = require("@playwright/test");

const PKG = "io.github.buffalonan.flexandfit";

test("the app opens, has no server set until you type one, and saves a session on the phone", async () => {
  const [device] = await _android.devices();
  expect(device, "no emulator found by adb").toBeTruthy();
  try {
    // A freshly booted emulator can still have its screen off or locked; then the WebView has no size and
    // nothing in it counts as visible. Wake and unlock it first.
    await device.shell("input keyevent KEYCODE_WAKEUP");
    await device.shell("wm dismiss-keyguard");
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    // Debug builds let Playwright drive the app's WebView like a browser tab.
    const page = await (await device.webView({ pkg: PKG }, { timeout: 60_000 })).page();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await expect.poll(() => page.evaluate(() => window.innerWidth), { message: "the WebView has no size (screen off?)", timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.locator("#hoy")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(true);
    // Native HTTP lets the app reach the Mac's plain-http server from the app's https origin.
    expect(await page.evaluate(() => window.Capacitor.isPluginAvailable("CapacitorHttp"))).toBe(true);

    const notas = `emulador-${Date.now()}`;
    await page.fill('#nueva textarea[name="notas"]', notas);
    await page.click('#nueva button[type="submit"]');
    await expect(page.locator("#nuevaOk")).toBeVisible();
    // A fresh install has no server address (it's typed in Ajustes), so the session stays on the phone.
    await expect(page.locator("#syncPill")).toHaveText("Solo en este dispositivo");
    expect(await page.inputValue("#servidor")).toBe("");
    await page.click('.tabs button[data-tab="historial"]');
    await expect(page.locator("#lista")).toContainText(notas);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  } finally {
    await device.close();
  }
});
