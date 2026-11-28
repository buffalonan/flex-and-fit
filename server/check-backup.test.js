const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const store = require("./db");
const backup = require("./backup");
const { check } = require("./check-backup");

let dir, db;
const rec = (tabla, id, data = {}, extra = {}) => ({ tabla, id, actualizado: Date.parse("2026-11-27T10:00:00Z"), data, ...extra });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flexfit-check-"));
  db = store.open(path.join(dir, "flexfit.db"));
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A real daily copy, made the way the server makes them. */
function copy() {
  const [file] = backup.runDue(db, [path.join(dir, "copias")], Date.parse("2026-11-29T10:00:00Z"));
  return file;
}

test("backup check: a real copy passes and is left untouched", () => {
  db.sync(0, [rec("sesiones", "s1", { nombre: "F1" }), rec("sesiones", "s2", {}, { borrado: true }), rec("ajustes", "peso")]);
  const file = copy();
  const before = fs.readFileSync(file);
  const { lines, problems } = check(file);
  assert.deepEqual(problems, []);
  assert.deepEqual(lines, ["registros: 2 (ajustes 1, sesiones 1)", "último cambio: 2026-11-27"]);
  assert.deepEqual(fs.readFileSync(file), before);
});

test("backup check: an empty copy, or one under the minimum, fails", () => {
  assert.deepEqual(check(copy()).problems, ["solo hay 0 registros (mínimo 1)"]);
  db.sync(0, [rec("sesiones", "s1")]);
  fs.rmSync(path.join(dir, "copias"), { recursive: true });
  assert.deepEqual(check(copy(), { minRecords: 5 }).problems, ["solo hay 1 registros (mínimo 5)"]);
});

test("backup check: a missing, truncated or foreign file fails", () => {
  assert.match(check(path.join(dir, "no-existe.db")).problems[0], /no existe o está vacío/);

  db.sync(0, [rec("sesiones", "s1")]);
  const file = copy();
  fs.truncateSync(file, 1000);
  assert.ok(check(file).problems.length > 0);

  const other = path.join(dir, "otra.db");
  const foreign = new DatabaseSync(other);
  foreign.exec("CREATE TABLE cosas (x)");
  foreign.close();
  assert.deepEqual(check(other).problems, ["no tiene la tabla registros"]);

  const text = path.join(dir, "texto.db");
  fs.writeFileSync(text, "esto no es una base de datos");
  assert.match(check(text).problems[0], /no se puede abrir/);
});

test("backup check: records whose data isn't JSON, or from an unknown table, fail", () => {
  db.sync(0, [rec("sesiones", "s1")]);
  const file = copy();
  const raw = new DatabaseSync(file);
  raw.exec("UPDATE registros SET data = '{roto' WHERE id = 's1'");
  raw.exec("INSERT INTO registros (tabla, id, data, actualizado, borrado, seq) VALUES ('raros', 'x', '{}', 1, 0, 99)");
  raw.close();
  assert.deepEqual(check(file).problems, ["tablas desconocidas: raros", "1 registros con datos que no son JSON"]);
});

test("backup check: the command line prints a summary and exits 1 on a problem", () => {
  db.sync(0, [rec("sesiones", "s1")]);
  const file = copy();
  const script = path.join(__dirname, "check-backup.js");
  assert.match(execFileSync(process.execPath, [script, file], { encoding: "utf8" }), /OK: la copia se puede restaurar/);
  assert.throws(() => execFileSync(process.execPath, [script, file, "5"], { encoding: "utf8" }), (error) => {
    assert.equal(error.status, 1);
    assert.match(error.stdout, /FALLO: 1 problemas/);
    return true;
  });
});
