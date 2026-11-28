// The restore check in scripts/mac/update.sh (`update.sh --solo-comprobar`), with fake docker and osascript:
// what gets marked as checked, when it notifies, and that it retries when the check couldn't run at all.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const UPDATE = path.join(__dirname, "..", "scripts", "mac", "update.sh");
let dir, bin, copias;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flexfit-update-"));
  bin = path.join(dir, "bin");
  copias = path.join(dir, "copias");
  fs.mkdirSync(bin);
  fs.mkdirSync(copias);
  fs.copyFileSync(UPDATE, path.join(dir, "update.sh"));
  fs.writeFileSync(path.join(dir, ".env"), `BACKUP_DIR=${copias}\n`);
  // Fake docker: records its arguments, prints FAKE_OUT and exits with FAKE_CODE.
  fs.writeFileSync(path.join(bin, "docker"), `#!/bin/sh\necho "$*" >> "${dir}/docker.log"\nprintf '%s\\n' "$FAKE_OUT"\nexit "$FAKE_CODE"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "osascript"), `#!/bin/sh\necho "$*" >> "${dir}/aviso.log"\n`, { mode: 0o755 });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function run(code, out = "") {
  const result = spawnSync("sh", [path.join(dir, "update.sh"), "--solo-comprobar"], {
    encoding: "utf8",
    env: { ...process.env, HOME: dir, PATH: `${bin}:${process.env.PATH}`, FAKE_CODE: String(code), FAKE_OUT: out },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const read = (name) => (fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), "utf8") : "");
const copy = (name) => fs.writeFileSync(path.join(copias, name), "x");

test("update.sh check: a good copy is checked once, with the newest file, read-only", () => {
  copy("flexfit-2026-11-27.db");
  copy("flexfit-2026-11-28.db");
  run(0, "OK: la copia se puede restaurar");
  assert.equal(read(".copia-comprobada"), "flexfit-2026-11-28.db\n");
  const llamada = read("docker.log");
  assert.ok(llamada.includes(`-v ${copias}:/copias:ro`), llamada);
  assert.ok(llamada.includes("server/check-backup.js /copias/flexfit-2026-11-28.db"), llamada);
  run(0);
  assert.equal(read("docker.log").trim().split("\n").length, 1); // not again until a new copy
  assert.equal(read("aviso.log"), "");
});

test("update.sh check: a broken copy (exit 1) notifies once and is marked", () => {
  copy("flexfit-2026-11-28.db");
  run(1, "FALLO: 1 problemas");
  assert.match(read("aviso.log"), /flexfit-2026-11-28.db no se puede restaurar/);
  assert.equal(read(".copia-comprobada"), "flexfit-2026-11-28.db\n");
  run(1);
  assert.equal(read("aviso.log").trim().split("\n").length, 1);
});

test("update.sh check: when Docker fails, nothing is marked or notified and it retries", () => {
  copy("flexfit-2026-11-28.db");
  for (const code of [125, 126, 127]) {
    const out = run(code, "Cannot connect to the Docker daemon");
    assert.ok(out.includes(`No se pudo comprobar flexfit-2026-11-28.db (código ${code})`), out);
  }
  assert.equal(read(".copia-comprobada"), "");
  assert.equal(read("aviso.log"), "");
  assert.equal(read("docker.log").trim().split("\n").length, 3);
});

test("update.sh check: an image without the checker is skipped silently and retried", () => {
  copy("flexfit-2026-11-28.db");
  run(1, "Error: Cannot find module '/app/server/check-backup.js'");
  assert.equal(read(".copia-comprobada"), "");
  assert.equal(read("aviso.log"), "");
});

test("update.sh check: no copies, or no BACKUP_DIR, does nothing", () => {
  run(0);
  fs.writeFileSync(path.join(dir, ".env"), "");
  run(0);
  assert.equal(read("docker.log"), "");
});
