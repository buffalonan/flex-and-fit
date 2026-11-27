// Daily copies of the database: one file per day (UTC) in each backup folder, keeping the newest KEEP.
// On the Mac the folder is ~/Documents/fitness-backups/weekly (its name is older than the daily copies), and
// scripts/mac/update.sh copies each new file into Google Drive's Backups/Fitness from outside Docker.
/* eslint-disable security/detect-non-literal-fs-filename -- folders come from BACKUP_DIRS, set by the owner */
const fs = require("node:fs");
const path = require("node:path");

const KEEP = 30;
const NAME = /^flexfit-(\d{4}-\d{2}-\d{2})\.db$/;

const day = (t) => new Date(t).toISOString().slice(0, 10);

function newest(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => NAME.test(f)).sort().pop() || null;
  } catch {
    return null;
  }
}

/** Makes a backup in each folder that has none from today yet. Returns the files written. */
function runDue(db, dirs, now = Date.now()) {
  const written = [];
  for (const dir of dirs) {
    const last = newest(dir);
    if (last && NAME.exec(last)[1] >= day(now)) continue;
    const file = path.join(dir, `flexfit-${day(now)}.db`);
    db.backup(file);
    written.push(file);
    const old = fs.readdirSync(dir).filter((f) => NAME.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP))) fs.rmSync(path.join(dir, f));
  }
  return written;
}

module.exports = { runDue, newest, KEEP };
