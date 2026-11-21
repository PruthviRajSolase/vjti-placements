-- VJTI Placements — Phase 1 schema.
-- Kept as a .sql file so the structure is readable without JS noise.

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'contributor', 'tpo', 'tpoi')),
  branch          TEXT,
  graduation_year TEXT,
  token_version   INTEGER NOT NULL DEFAULT 0,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Created now; used by the experience workflow in Phase 3.
CREATE TABLE IF NOT EXISTS experiences (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  placement_year  TEXT NOT NULL,
  heading         TEXT NOT NULL,
  body            TEXT NOT NULL,
  tags            TEXT NOT NULL DEFAULT '[]',
  visibility      TEXT NOT NULL DEFAULT 'anonymous'
                  CHECK (visibility IN ('named', 'anonymous')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  review_note     TEXT,
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status);
CREATE INDEX IF NOT EXISTS idx_experiences_user ON experiences(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  target     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Content the TPO edits through the admin panel (Phase 2).
-- These replace the hardcoded arrays in src/data.js for the live site.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stats (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  year             TEXT NOT NULL UNIQUE,
  students_placed  INTEGER NOT NULL,
  highest_package  TEXT NOT NULL,
  average_package  TEXT NOT NULL,
  companies_visited INTEGER NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year        TEXT NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  role        TEXT NOT NULL,
  package_lpa REAL NOT NULL,
  hired       INTEGER NOT NULL,
  branches    TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (year, slug)
);

CREATE INDEX IF NOT EXISTS idx_companies_year ON companies(year);

CREATE TABLE IF NOT EXISTS branch_stats (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  year             TEXT NOT NULL,
  branch           TEXT NOT NULL,
  percent          REAL NOT NULL DEFAULT 0,
  total_students   INTEGER NOT NULL DEFAULT 0,
  placed_students  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (year, branch)
);

-- Phase 6 — private company bookmarks, one row per signed-in user + slug.
CREATE TABLE IF NOT EXISTS saved_companies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  company_name TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_saved_companies_user ON saved_companies(user_id);

-- Phase 8 — in-app notifications. Every row belongs to one user and may link
-- to the page where they should act (my experiences, review queue, detail).
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

-- TPO alumni outreach: past placed students/alumni contacts that TPO can
-- email to request help bringing their current company for campus drives.
CREATE TABLE IF NOT EXISTS alumni_contacts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone            TEXT,
  branch           TEXT,
  graduation_year  TEXT,
  placed_company   TEXT,
  placed_role      TEXT,
  placed_year      TEXT,
  current_company  TEXT,
  outreach_status  TEXT NOT NULL DEFAULT 'not_contacted'
                   CHECK (outreach_status IN ('not_contacted', 'contacted', 'responded', 'interested', 'referred', 'not_interested', 'no_response')),
  outreach_type    TEXT CHECK (outreach_type IN ('placement', 'internship', 'both')),
  last_contacted_at TEXT,
  follow_up_at     TEXT,
  response_note    TEXT,
  referral_company TEXT,
  referral_contact TEXT,
  referral_details TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alumni_outreach_status ON alumni_contacts(outreach_status);
CREATE INDEX IF NOT EXISTS idx_alumni_grad_year ON alumni_contacts(graduation_year);

-- Upcoming placement/internship drives published by the TPO. Eligibility is
-- stored as JSON arrays, matching the JSON columns used for companies.
CREATE TABLE IF NOT EXISTS drives (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  company               TEXT NOT NULL,
  role                  TEXT NOT NULL,
  package_lpa           REAL,
  location              TEXT,
  eligibility_branches  TEXT NOT NULL DEFAULT '[]',
  graduation_years      TEXT NOT NULL DEFAULT '[]',
  registration_deadline TEXT,
  drive_date            TEXT,
  apply_link            TEXT,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
  created_by            INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drives_status ON drives(status, registration_deadline);

-- Private per-student application pipeline. One row per user + drive.
CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_id   INTEGER NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'applied'
             CHECK (status IN ('applied', 'oa', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, drive_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);

-- Email OTP codes for verification and password reset.
CREATE TABLE IF NOT EXISTS email_otps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL COLLATE NOCASE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose);

-- Student reports on public experiences.
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
);

CREATE INDEX IF NOT EXISTS idx_experience_reports_status ON experience_reports(status, created_at DESC);
