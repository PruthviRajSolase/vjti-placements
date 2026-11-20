/*
  Phase 1 — server/db.js
  Uses Node's BUILT-IN SQLite (node:sqlite), so there is no native
  npm package to compile. The database file lives in server/data/
  and is gitignored — deleting that file resets the whole database.
*/
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBranch } from "../src/branches.js";

const here = dirname(fileURLToPath(import.meta.url));
// DB_PATH lets the test suite run against a throwaway database instead of
// touching the demo data. Normal dev/production still use server/data/.
const dbPath = process.env.DB_PATH || join(here, "data", "placements.db");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync(join(here, "schema.sql"), "utf8"));

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all()
    .some((entry) => entry.name === column);
}

function applyMigrations() {
  let version = db.prepare("PRAGMA user_version").get().user_version;

  if (version < 1) {
    if (!hasColumn("users", "token_version")) {
      db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0");
    }
    version = 1;
    db.exec(`PRAGMA user_version = ${version}`);
  }

  if (version < 2) {
    db.exec("BEGIN");
    try {
      const users = db.prepare("SELECT id, branch FROM users WHERE branch IS NOT NULL AND branch != ''").all();
      const updateUser = db.prepare("UPDATE users SET branch = ? WHERE id = ?");
      for (const row of users) {
        const normalized = normalizeBranch(row.branch);
        if (normalized && normalized !== row.branch) updateUser.run(normalized, row.id);
      }

      const drives = db.prepare("SELECT id, eligibility_branches FROM drives").all();
      const updateDrive = db.prepare("UPDATE drives SET eligibility_branches = ? WHERE id = ?");
      for (const drive of drives) {
        let branches = [];
        try {
          const parsed = JSON.parse(drive.eligibility_branches);
          if (Array.isArray(parsed)) branches = parsed.filter((item) => typeof item === "string");
        } catch {
          branches = [];
        }
        const normalized = [...new Set(branches.map(normalizeBranch).filter(Boolean))];
        const next = JSON.stringify(normalized);
        if (next !== drive.eligibility_branches) updateDrive.run(next, drive.id);
      }

      version = 2;
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

applyMigrations();

// Never send password_hash (or other internals) to the browser.
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    branch: row.branch,
    graduationYear: row.graduation_year,
    createdAt: row.created_at,
  };
}

export function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}
