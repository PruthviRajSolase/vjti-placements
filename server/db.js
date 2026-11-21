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

  if (version < 3) {
    if (!hasColumn("branch_stats", "total_students")) {
      db.exec("ALTER TABLE branch_stats ADD COLUMN total_students INTEGER NOT NULL DEFAULT 0");
    }
    if (!hasColumn("branch_stats", "placed_students")) {
      db.exec("ALTER TABLE branch_stats ADD COLUMN placed_students INTEGER NOT NULL DEFAULT 0");
    }
    // Preserve existing percent as a placeholder only. Real totals/placed are
    // provided by seed-demo; admins should update rows through the new API.
    db.exec(`
      UPDATE branch_stats
      SET total_students = 100,
          placed_students = CAST(ROUND(percent) AS INTEGER)
      WHERE total_students = 0 AND placed_students = 0
    `);
    version = 3;
    db.exec(`PRAGMA user_version = ${version}`);
  }

  if (version < 4) {
    if (!hasColumn("users", "email_verified")) {
      db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    }
    db.exec("UPDATE users SET email_verified = 1 WHERE email_verified = 0");
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL COLLATE NOCASE,
        purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
        code_hash  TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose)");
    version = 4;
    db.exec(`PRAGMA user_version = ${version}`);
  }

  if (version < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS experience_reports (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        experience_id INTEGER NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
        reporter_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason        TEXT NOT NULL,
        details       TEXT,
        status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
        resolved_by   INTEGER REFERENCES users(id),
        resolved_at   TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (experience_id, reporter_id)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_experience_reports_status ON experience_reports(status, created_at DESC)");
    version = 5;
    db.exec(`PRAGMA user_version = ${version}`);
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
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
  };
}

export function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function withTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
