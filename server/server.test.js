const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const store = require("./db");
const backup = require("./backup");
const { createServer } = require("./server");

let dir, db, server, base;

async function start(token = "", direcciones = []) {
  server = createServer({ db, webDir: path.join(__dirname, "..", "web"), token, version: "test", direcciones });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
}
const sync = (body, headers = {}) =>
  fetch(`${base}/api/sync`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const rec = (id, actualizado, data = {}, extra = {}) => ({ tabla: "sesiones", id, actualizado, data, ...extra });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flexfit-"));
  db = store.open(path.join(dir, "flexfit.db"));
});
afterEach(async () => {
  if (server) await new Promise((r) => server.close(r));
  server = null;
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("two devices see each other's changes through the server", async () => {
  await start();
  let r = await (await sync({ desde: 0, cambios: [rec("a", 100, { tipo: "gimnasio" })] })).json();
  assert.equal(r.cambios.length, 1);
  const seqMovil = r.seq;

  r = await (await sync({ desde: 0, cambios: [rec("b", 200, { tipo: "flexibilidad" })] })).json();
  assert.deepEqual(r.cambios.map((c) => c.id), ["a", "b"]);

  r = await (await sync({ desde: seqMovil, cambios: [] })).json();
  assert.deepEqual(r.cambios.map((c) => c.id), ["b"]);
  assert.deepEqual(r.cambios[0].data, { tipo: "flexibilidad" });
});

test("the newest edit wins and an older one is ignored", async () => {
  await start();
  await sync({ desde: 0, cambios: [rec("a", 200, { notas: "nuevo" })] });
  const r = await (await sync({ desde: 0, cambios: [rec("a", 100, { notas: "viejo" })] })).json();
  assert.equal(r.cambios.length, 1);
  assert.equal(r.cambios[0].data.notas, "nuevo");
});

test("deletes travel as records with borrado", async () => {
  await start();
  await sync({ desde: 0, cambios: [rec("a", 100)] });
  const r = await (await sync({ desde: 0, cambios: [rec("a", 150, {}, { borrado: true })] })).json();
  assert.equal(r.cambios[0].borrado, true);
  assert.equal(db.count(), 0);
});

test("bad changes are refused", async () => {
  await start();
  assert.equal((await sync({ cambios: [{ tabla: "otra", id: "a", actualizado: 1 }] })).status, 400);
  assert.equal((await sync({ cambios: [rec("../x", 1)] })).status, 400);
  assert.equal((await sync({ cambios: [rec("a", -1)] })).status, 400);
  const bad = await fetch(`${base}/api/sync`, { method: "POST", body: "{nope" });
  assert.equal(bad.status, 400);
});

test("a token, when set, is required", async () => {
  await start("secreto");
  assert.equal((await sync({ cambios: [] })).status, 401);
  assert.equal((await sync({ cambios: [] }, { Authorization: "Bearer otro" })).status, 401);
  assert.equal((await sync({ cambios: [] }, { Authorization: "Bearer secreto" })).status, 200);
  const salud = await (await fetch(`${base}/api/salud`)).json();
  assert.equal(salud.token, true);
});

test("/api/salud tells the app the Mac's other addresses, only well-formed ones", async () => {
  // Documentation addresses (RFC 5737), never the owner's.
  await start("", ["http://192.0.2.10:3334/", " http://198.51.100.7:3334", "ftp://192.0.2.1", "no es una url", "http://192.0.2.10:3334"]);
  const salud = await (await fetch(`${base}/api/salud`)).json();
  assert.deepEqual(salud.direcciones, ["http://192.0.2.10:3334", "http://198.51.100.7:3334"]);
});

test("serves the web app and nothing outside it", async () => {
  await start();
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Flex &amp; Fit/);
  assert.equal((await fetch(`${base}/..%2fserver%2fserver.js`)).status, 404);
  assert.equal((await fetch(`${base}/no-existe.js`)).status, 404);
});

test("weekly backups: one per week per folder, newest twelve kept", () => {
  db.sync(0, [rec("a", 1)]);
  const a = path.join(dir, "local"), b = path.join(dir, "drive");
  const t0 = Date.parse("2026-01-05T10:00:00Z");
  assert.equal(backup.runDue(db, [a, b], t0).length, 2);
  assert.equal(backup.runDue(db, [a, b], t0 + 3 * 864e5).length, 0);
  for (let w = 1; w <= 14; w++) backup.runDue(db, [a], t0 + w * 7 * 864e5);
  const files = fs.readdirSync(a).sort();
  assert.equal(files.length, backup.KEEP);
  assert.equal(files.at(-1), "flexfit-2026-04-13.db");
  const copy = store.open(path.join(a, files.at(-1)));
  assert.equal(copy.count(), 1);
  copy.close();
});

test("the public web app holds no default server address", () => {
  // The repo and the Pages demo are public: the phone's server address is typed by the owner, never shipped.
  const web = path.join(__dirname, "..", "web");
  const texts = fs.readdirSync(web, { recursive: true }).filter((f) => /\.(html|js|css|json|webmanifest|svg)$/.test(f));
  assert.ok(texts.includes("app.js"));
  for (const f of texts) {
    const text = fs.readFileSync(path.join(web, f), "utf8");
    const hosts = (text.match(/https?:\/\/[\w.-]+:\d+/g) || []).filter((u) => !/^https?:\/\/(nombre-del-mac|localhost):/.test(u));
    assert.deepEqual(hosts, [], `${f} has a host:port address`);
    assert.doesNotMatch(text, /\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+\b/, `${f} has a Tailscale IP`);
  }
});
