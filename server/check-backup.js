// Checks that a backup copy of the database can be restored: `node server/check-backup.js flexfit-AAAA-MM-DD.db`.
// It opens the copy read-only (never the live database) and checks that SQLite finds it intact, that it has the
// records table, that every record's data is JSON, and that it isn't empty. Prints one line per check and exits
// with 1 on any problem. On the Mac it runs inside the app's image (see AGENTS.md, "Copias de seguridad").
/* eslint-disable security/detect-non-literal-fs-filename -- the file is the one the owner passes */
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { TABLAS } = require("./db");

/** Returns { lines, problems } for the copy in `file`. */
function check(file, { minRecords = 1 } = {}) {
  const lines = [];
  const problems = [];
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return { lines, problems: [`${file} no existe o está vacío`] };

  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const integrity = db.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
    if (integrity.join() !== "ok") problems.push(`SQLite: ${integrity.slice(0, 3).join("; ")}`);

    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registros'").get();
    if (!table) return { lines, problems: [...problems, "no tiene la tabla registros"] };

    const rows = db.prepare("SELECT tabla, COUNT(*) AS n, SUM(borrado = 0) AS vivos FROM registros GROUP BY tabla ORDER BY tabla").all();
    const live = rows.reduce((sum, r) => sum + Number(r.vivos), 0);
    lines.push(`registros: ${live} (${rows.map((r) => `${r.tabla} ${r.vivos}`).join(", ") || "ninguno"})`);
    const unknown = rows.map((r) => r.tabla).filter((t) => !TABLAS.includes(t));
    if (unknown.length) problems.push(`tablas desconocidas: ${unknown.join(", ")}`);
    if (live < minRecords) problems.push(`solo hay ${live} registros (mínimo ${minRecords})`);

    let broken = 0;
    for (const { data } of db.prepare("SELECT data FROM registros").iterate()) {
      try {
        JSON.parse(data);
      } catch {
        broken += 1;
      }
    }
    if (broken) problems.push(`${broken} registros con datos que no son JSON`);

    const last = db.prepare("SELECT MAX(actualizado) AS t FROM registros").get().t;
    if (last) lines.push(`último cambio: ${new Date(Number(last)).toISOString().slice(0, 10)}`);
  } catch (error) {
    problems.push(`no se puede abrir: ${error.message}`);
  } finally {
    db?.close();
  }
  return { lines, problems };
}

if (require.main === module) {
  const [file, min] = process.argv.slice(2);
  if (!file) {
    console.error("uso: node server/check-backup.js flexfit-AAAA-MM-DD.db [mínimo de registros]");
    process.exit(64);
  }
  const { lines, problems } = check(file, { minRecords: min ? Number(min) : 1 });
  for (const line of lines) console.log(line);
  for (const problem of problems) console.log(`ERROR: ${problem}`);
  console.log(problems.length ? `FALLO: ${problems.length} problemas` : "OK: la copia se puede restaurar");
  process.exit(problems.length ? 1 : 0);
}

module.exports = { check };
