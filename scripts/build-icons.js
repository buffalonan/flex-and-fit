// Draws the Android launcher icons and splash screens from web/icon.svg, using Playwright's Chromium.
// Run after changing the icon: node scripts/build-icons.js (PW_CHROMIUM=/path/to/chrome to use a local Chromium).
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const root = path.join(__dirname, "..");
const res = path.join(root, "android/app/src/main/res");
const svg = fs.readFileSync(path.join(root, "web/icon.svg"), "utf8");
const BG = "#23725f";
// The figure alone (no rounded square), for the adaptive icon's foreground layer.
const figure = svg.replace(/<rect[^>]*\/>/, "");
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function shoot(page, markup, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${markup}</body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true });
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage();
  const sized = (s, px) => s.replace("<svg ", `<svg width="${px}" height="${px}" style="display:block" `);
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(res, `mipmap-${d}`);
    await shoot(page, sized(svg, 48 * k), 48 * k, 48 * k, path.join(dir, "ic_launcher.png"));
    await shoot(page, `<div style="width:${48 * k}px;height:${48 * k}px;border-radius:50%;overflow:hidden;background:${BG}">${sized(figure, 48 * k)}</div>`, 48 * k, 48 * k, path.join(dir, "ic_launcher_round.png"));
    // Adaptive icons are 108dp with the middle 66dp always visible: shrink the figure into that zone.
    const fg = 108 * k, inner = Math.round(72 * k);
    await shoot(page, `<div style="width:${fg}px;height:${fg}px;display:grid;place-items:center">${sized(figure, inner)}</div>`, fg, fg, path.join(dir, "ic_launcher_foreground.png"));
  }
  // Splash screens: keep each existing file's size, draw the icon in the middle on the brand colour.
  const { execFileSync } = require("child_process");
  for (const dir of fs.readdirSync(res).filter((d) => d.startsWith("drawable"))) {
    const file = path.join(res, dir, "splash.png");
    if (!fs.existsSync(file)) continue;
    const [w, h] = execFileSync("python3", ["-c", "import struct,sys;d=open(sys.argv[1],'rb').read(24);print(*struct.unpack('>II',d[16:24]))", file]).toString().trim().split(" ").map(Number);
    const icon = Math.round(Math.min(w, h) * 0.28);
    await shoot(page, `<div style="width:${w}px;height:${h}px;display:grid;place-items:center;background:${BG}">${sized(figure, icon)}</div>`, w, h, file);
  }
  await browser.close();
  fs.writeFileSync(path.join(res, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  console.log("Icons and splash screens written to android/app/src/main/res");
})();
