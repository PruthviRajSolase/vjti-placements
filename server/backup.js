import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveDbPath(dbPath = process.env.DB_PATH) {
  if (dbPath) return resolve(dbPath);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(join(here, "data", "placements.db"));
}

export function resolveBackupDir(dbPath, backupDir = process.env.BACKUP_DIR) {
  return resolve(backupDir || join(dirname(resolve(dbPath)), "backups"));
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `placements-${stamp}.db`;
}

export function listBackupFiles(backupDir) {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .filter((name) => /^placements-.*\.db$/.test(name))
    .map((name) => {
      const full = join(backupDir, name);
      const st = statSync(full);
      return { name, path: full, mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));
}

export function pruneBackups(backupDir, keep = Number(process.env.BACKUP_KEEP || 14)) {
  const limit = Math.max(1, Number(keep) || 14);
  const files = listBackupFiles(backupDir);
  const remove = files.slice(0, Math.max(0, files.length - limit));
  for (const file of remove) rmSync(file.path, { force: true });
  return { kept: files.slice(Math.max(0, files.length - limit)).map((f) => f.path), removed: remove.map((f) => f.path) };
}

export function createBackup({ dbPath = process.env.DB_PATH, backupDir = process.env.BACKUP_DIR, keep = process.env.BACKUP_KEEP } = {}) {
  const src = resolve(dbPath || resolveDbPath());
  if (!existsSync(src)) throw new Error(`Database not found: ${src}`);
  const dir = resolveBackupDir(src, backupDir);
  mkdirSync(dir, { recursive: true });
  const backupPath = join(dir, backupFileName());
  try {
    const db = new DatabaseSync(src, { readOnly: true });
    try {
      db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }
  } catch (err) {
    copyFileSync(src, backupPath);
    console.warn(`VACUUM INTO failed (${err.message}); copied database file instead.`);
  }
  const pruned = pruneBackups(dir, keep);
  return { backupPath, backupDir: dir, ...pruned };
}

export function latestBackup(backupDir) {
  const files = listBackupFiles(backupDir);
  return files.length ? files[files.length - 1] : null;
}

export function safeBackupDownloadName(name) {
  const base = basename(name || "");
  return /^placements-.*\.db$/.test(base) ? base : null;
}

export function startDailyBackupTimer() {
  if (process.env.BACKUP_DAILY !== "1") return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const run = () => {
    try {
      const { backupPath } = createBackup();
      console.log(`[backup] daily backup written to ${backupPath}`);
    } catch (err) {
      console.error(`[backup] daily backup failed: ${err?.message || String(err)}`);
    }
  };
  const timer = setInterval(run, dayMs);
  timer.unref?.();
  return timer;
}