// Weekly copies of the database, like the Ghostfolio backups: one file per week in each backup folder
// (on the Mac, ~/Documents/fitness-backups/weekly and Google Drive's Backups/Fitness), keeping the newest KEEP.
/* eslint-disable security/detect-non-literal-fs-filename -- folders come from BACKUP_DIRS, set by the owner */
const fs = require("node:fs");
const path = require("node:path");

const WEEK = 7 * 24 * 3600 * 1000;
const KEEP = 12;
const NAME = /^flexfit-(\d{4}-\d{2}-\d{2})\.db$/;

const day = (t) => new Date(t).toISOString().slice(0, 10);

function newest(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => NAME.test(f)).sort().pop() || null;
  } catch {
    return null;
  }
}

/** Makes a backup in each folder whose newest copy is a week old or more. Returns the files written. */
function runDue(db, dirs, now = Date.now()) {
  const written = [];
  for (const dir of dirs) {
    const last = newest(dir);
    if (last && now - Date.parse(NAME.exec(last)[1]) < WEEK) continue;
    const file = path.join(dir, `flexfit-${day(now)}.db`);
    db.backup(file);
    written.push(file);
    const old = fs.readdirSync(dir).filter((f) => NAME.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP))) fs.rmSync(path.join(dir, f));
  }
  return written;
}

module.exports = { runDue, newest, KEEP };
