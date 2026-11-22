// The central store on the Mac: one SQLite file with every record from every device.
// Each record is { tabla, id, data, actualizado, borrado }. `seq` grows with every write the server accepts,
// so a device asks for "everything after the last seq I saw" instead of trusting its own clock.
const { DatabaseSync } = require("node:sqlite");
/* eslint-disable security/detect-non-literal-fs-filename -- paths come from DATA_DIR and BACKUP_DIRS, set by the owner */
const fs = require("node:fs");
const path = require("node:path");

const TABLAS = ["ejercicios", "sesiones", "series", "tests", "rutinas", "ajustes"];

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS registros (
      tabla TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      actualizado INTEGER NOT NULL,
      borrado INTEGER NOT NULL DEFAULT 0,
      seq INTEGER NOT NULL,
      PRIMARY KEY (tabla, id)
    );
    CREATE INDEX IF NOT EXISTS registros_seq ON registros (seq);
  `);
  const maxSeq = db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM registros");
  // Last write wins by `actualizado`; a tie keeps what the server already has.
  const upsert = db.prepare(`
    INSERT INTO registros (tabla, id, data, actualizado, borrado, seq) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (tabla, id) DO UPDATE SET data = excluded.data, actualizado = excluded.actualizado,
      borrado = excluded.borrado, seq = excluded.seq
    WHERE excluded.actualizado > registros.actualizado
  `);
  const since = db.prepare("SELECT tabla, id, data, actualizado, borrado, seq FROM registros WHERE seq > ? ORDER BY seq LIMIT ?");

  return {
    file,
    /** Applies a device's changes and returns everything newer than `desde`, including what was just written. */
    sync(desde, cambios, limite = 5000) {
      db.exec("BEGIN IMMEDIATE");
      try {
        let seq = maxSeq.get().s;
        for (const c of cambios) {
          seq += 1;
          const r = upsert.run(c.tabla, c.id, JSON.stringify(c.data ?? {}), c.actualizado, c.borrado ? 1 : 0, seq);
          if (r.changes === 0) seq -= 1;
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      const rows = since.all(desde, limite + 1);
      const mas = rows.length > limite;
      const lote = rows.slice(0, limite).map((r) => ({ tabla: r.tabla, id: r.id, data: JSON.parse(r.data), actualizado: r.actualizado, borrado: !!r.borrado, seq: r.seq }));
      return { seq: lote.length ? lote[lote.length - 1].seq : Math.max(desde, maxSeq.get().s), cambios: lote, mas };
    },
    count() {
      return db.prepare("SELECT COUNT(*) AS n FROM registros WHERE borrado = 0").get().n;
    },
    /** A consistent copy of the whole database, safe while the server keeps running. */
    backup(to) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.rmSync(to, { force: true });
      db.prepare("VACUUM INTO ?").run(to);
    },
    close() {
      db.close();
    },
  };
}

/** Checks one incoming change; returns an error message or null. */
function invalid(c) {
  if (!c || typeof c !== "object") return "cambio no es un objeto";
  if (!TABLAS.includes(c.tabla)) return `tabla desconocida: ${String(c.tabla).slice(0, 40)}`;
  if (typeof c.id !== "string" || !/^[\w-]{1,80}$/.test(c.id)) return "id no válido";
  if (!Number.isSafeInteger(c.actualizado) || c.actualizado <= 0) return "actualizado no válido";
  if (c.data !== undefined && (typeof c.data !== "object" || Array.isArray(c.data))) return "data debe ser un objeto";
  return null;
}

module.exports = { open, invalid, TABLAS };
