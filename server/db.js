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

const here = dirname(fileURLToPath(import.meta.url));
// DB_PATH lets the test suite run against a throwaway database instead of
// touching the demo data. Normal dev/production still use server/data/.
const dbPath = process.env.DB_PATH || join(here, "data", "placements.db");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync(join(here, "schema.sql"), "utf8"));

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
