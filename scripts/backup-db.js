import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDb = join(here, "..", "server", "data", "placements.db");
const dbPath = resolve(process.env.DB_PATH || defaultDb);

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const backupDir = resolve(process.env.BACKUP_DIR || join(dirname(dbPath), "backups"));
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(backupDir, `placements-${stamp}.db`);

try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
} catch (err) {
  // Fallback for environments where VACUUM INTO is unavailable.
  copyFileSync(dbPath, backupPath);
  console.warn(`VACUUM INTO failed (${err.message}); copied database file instead.`);
}

console.log(`Backup written to ${backupPath}`);
