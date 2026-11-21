import { createBackup } from "../server/backup.js";

try {
  const { backupPath, removed } = createBackup();
  console.log(`Backup written to ${backupPath}`);
  if (removed.length) console.log(`Pruned ${removed.length} old backup(s).`);
} catch (err) {
  console.error(err?.message || String(err));
  process.exit(1);
}
