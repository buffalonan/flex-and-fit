// Copies the web app into a folder ready to publish:
//   www/   (default) for the Android app: adds capacitor.js, which Capacitor packs into the APK.
//   --web  for the Mac's Docker image or the GitHub Pages demo: no capacitor.js.
// Usage: node scripts/build-app-web.js [out dir] [--web]. APP_VERSION, if set, is written into the page.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const web = args.includes("--web");
const root = path.join(__dirname, "..");
const src = path.join(root, "web");
const out = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(root, "www"));

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

let page = fs.readFileSync(path.join(out, "index.html"), "utf8");
const meta = '<meta charset="utf-8">';
if (!page.includes(meta)) throw new Error(`Couldn't find ${meta} in web/index.html`);
if (process.env.APP_VERSION) page = page.replace(meta, `${meta}\n<meta name="app-version" content="${process.env.APP_VERSION.replace(/[^\w.-]/g, "")}">`);

if (!web) {
  // capacitor.js gives the page window.Capacitor (native platform check, App plugin, native HTTP).
  const tag = '<script type="module" src="app.js"></script>';
  if (!page.includes(tag)) throw new Error(`Couldn't find ${tag} in web/index.html`);
  page = page.replace(tag, `<script src="capacitor.js"></script>\n${tag}`);
  fs.copyFileSync(require.resolve("@capacitor/core/dist/capacitor.js"), path.join(out, "capacitor.js"));
}

fs.writeFileSync(path.join(out, "index.html"), page);
console.log(`Wrote ${fs.readdirSync(out).join(", ")} to ${path.relative(root, out) || "."}`);
