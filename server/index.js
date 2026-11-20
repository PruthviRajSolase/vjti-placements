/*
  Phase 1 — server/index.js
  The API. All permission checks happen HERE, not in the React UI.
*/
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, findUserById, publicUser } from "./db.js";
import {
  slugify,
  getPublicContent,
  getRawContent,
  publicExperienceDetail,
  staffExperiences,
  userExperiences,
} from "./content.js";
import {
  setAuthCookie,
  clearAuthCookie,
  optionalAuth,
  requireAuth,
  requireRole,
} from "./auth.js";
import { parseCsv } from "./csv.js";

const app = express();
const PORT = process.env.API_PORT === undefined
  ? 3001
  : Number(process.env.API_PORT);
const COLLEGE_DOMAIN = "@vjti.ac.in";

// Used only in production, after `npm run build` has created dist/.
const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "..", "dist");
const distIndex = join(distDir, "index.html");

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'"],
      "font-src": ["'self'", "data:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
  },
  hsts: process.env.NODE_ENV === "production",
}));
app.use(express.json());
app.use(cookieParser());

const text = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);
const rateBuckets = new Map();

function rateLimit(routeKey) {
  const disabled = process.env.RATE_LIMIT_DISABLED === "1" || process.env.NODE_ENV === "test";
  const max = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
  const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  return (req, res, next) => {
    if (disabled) return next();
    const email = routeKey === "password"
      ? (req.user?.email || "")
      : text(req.body?.email, 120).toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${routeKey}:${ip}:${email}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      rateBuckets.set(key, { start: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }
    next();
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vjti-placements-api" });
});

// ---------------------------------------------------------------- auth
app.post("/api/auth/register", rateLimit("register"), async (req, res) => {
  const fullName = text(req.body?.fullName, 80);
  const email = text(req.body?.email, 120).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const branch = text(req.body?.branch, 80);
  const graduationYear = text(req.body?.graduationYear, 4);

  if (!fullName) {
    return res.status(400).json({ error: "Enter your full name." });
  }
  if (!email.endsWith(COLLEGE_DOMAIN)) {
    return res.status(400).json({ error: `Use your ${COLLEGE_DOMAIN} email address.` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role, branch, graduation_year)
     VALUES (?, ?, ?, 'student', ?, ?)`
  ).run(fullName, email, hash, branch || null, graduationYear || null);

  const user = publicUser(findUserById(Number(result.lastInsertRowid)));
  db.prepare("INSERT INTO audit_log (actor_id, action, target) VALUES (?, 'register', ?)")
    .run(user.id, email);

  setAuthCookie(res, user.id, 0);
  res.status(201).json({ user });
});

app.post("/api/auth/login", rateLimit("login"), async (req, res) => {
  const email = text(req.body?.email, 120).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const hash = row?.password_hash || DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const user = publicUser(row);
  setAuthCookie(res, user.id, row.token_version ?? 0);
  res.json({ user });
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", optionalAuth, (req, res) => {
  res.json({ user: req.user });
});

// Small role-gate endpoint used to verify middleware (real admin routes
// arrive in Phase 2). Try it as a student -> 403.
app.get("/api/admin/ping", requireAuth, requireRole("tpo", "tpoi"), (req, res) => {
  res.json({ ok: true, role: req.user.role });
});

// ------------------------------------------------------------- content
// Public read — everything the student-facing pages need in ONE request.
app.get("/api/content", (_req, res) => {
  res.json(getPublicContent());
});

// Admin uses the same middleware stack for every write below.
const admin = [requireAuth, requireRole("tpo", "tpoi")];

function audit(req, action, target) {
  db.prepare("INSERT INTO audit_log (actor_id, action, target) VALUES (?, ?, ?)")
    .run(req.user.id, action, target);
}

// Phase 8 — one line per recipient. Every notification is scoped to a user,
// so a caller can only ever see (or mark read) their own rows.
function notify(userId, type, title, body, link) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, type, title, body || null, link || null);
}

function notifyStaff(type, title, body, link) {
  const staff = db.prepare("SELECT id FROM users WHERE role IN ('tpo', 'tpoi')").all();
  for (const person of staff) notify(person.id, type, title, body, link);
}

const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// Eligibility columns hold JSON arrays, like companies.branches does.
function jsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function stringList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(items.map((item) => text(item, 80)).filter(Boolean))].slice(0, 30);
}

// ------------------------------------------- Phase 6: bookmarks + my account
// All four routes need only a session; every query is scoped to req.user.id,
// so no caller can read or remove someone else's saved companies.
app.get("/api/bookmarks", requireAuth, (req, res) => {
  const bookmarks = db.prepare(
    `SELECT slug, company_name AS name, created_at AS createdAt
     FROM saved_companies WHERE user_id = ? ORDER BY id DESC`
  ).all(req.user.id);
  res.json({ bookmarks });
});

app.post("/api/bookmarks", requireAuth, (req, res) => {
  const slug = text(req.body?.slug, 160);
  // Only real, seeded companies can be saved — no arbitrary client strings.
  const company = db.prepare("SELECT name FROM companies WHERE slug = ? LIMIT 1").get(slug);
  if (!company) return res.status(404).json({ error: "Company not found." });
  db.prepare(
    `INSERT INTO saved_companies (user_id, slug, company_name) VALUES (?, ?, ?)
     ON CONFLICT(user_id, slug) DO NOTHING`
  ).run(req.user.id, slug, company.name);
  res.status(201).json({ ok: true, slug });
});

app.delete("/api/bookmarks/:slug", requireAuth, (req, res) => {
  db.prepare("DELETE FROM saved_companies WHERE user_id = ? AND slug = ?")
    .run(req.user.id, text(req.params.slug, 160));
  res.json({ ok: true });
});

app.put("/api/me", requireAuth, (req, res) => {
  const fullName = text(req.body?.fullName, 80);
  const branch = text(req.body?.branch, 80);
  const graduationYear = text(req.body?.graduationYear, 4);
  if (!fullName) return res.status(400).json({ error: "Name is required." });
  if (graduationYear && !/^\d{4}$/.test(graduationYear)) {
    return res.status(400).json({ error: "Graduation year must be four digits." });
  }
  // Email and role are deliberately not accepted from the client.
  db.prepare(
    `UPDATE users SET full_name = ?, branch = ?, graduation_year = ?,
       updated_at = datetime('now') WHERE id = ?`
  ).run(fullName, branch || null, graduationYear || null, req.user.id);
  audit(req, "update_profile", req.user.email);
  res.json({ user: publicUser(findUserById(req.user.id)) });
});

app.post("/api/me/password", requireAuth, rateLimit("password"), async (req, res) => {
  const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const next = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  // publicUser() strips the hash, so read the raw row for the comparison.
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  const hash = row?.password_hash || DUMMY_HASH;
  const ok = await bcrypt.compare(current, hash);
  if (!row || !ok) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  if (next.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  const nextHash = await bcrypt.hash(next, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?"
  ).run(nextHash, req.user.id);
  const updated = db.prepare("SELECT token_version FROM users WHERE id = ?").get(req.user.id);
  setAuthCookie(res, req.user.id, updated?.token_version ?? 0);
  audit(req, "change_password", req.user.email);
  res.json({ ok: true });
});

// ------------------------------------------- Phase 8: notifications
app.get("/api/notifications", requireAuth, (req, res) => {
  const notifications = db.prepare(
    `SELECT id, type, title, body, link,
            read_at AS readAt, created_at AS createdAt
     FROM notifications WHERE user_id = ?
     ORDER BY read_at IS NOT NULL, id DESC LIMIT 50`
  ).all(req.user.id);
  const unreadCount = db.prepare(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL"
  ).get(req.user.id).count;
  res.json({ notifications, unreadCount });
});

app.post("/api/notifications/read-all", requireAuth, (req, res) => {
  db.prepare(
    "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL"
  ).run(req.user.id);
  res.json({ ok: true });
});

app.post("/api/notifications/:id/read", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare(
    "UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL"
  ).run(id, req.user.id);
  if (!result.changes) {
    return res.status(404).json({ error: "Notification not found." });
  }
  res.json({ ok: true });
});

app.get("/api/admin/content", ...admin, (_req, res) => {
  res.json(getRawContent());
});

app.put("/api/admin/stats/:year", ...admin, (req, res) => {
  const year = text(req.params.year, 4);
  const values = {
    studentsPlaced: number(req.body?.studentsPlaced),
    highest: text(req.body?.highest, 30),
    average: text(req.body?.average, 30),
    companies: number(req.body?.companies),
  };
  if (!/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: "Year must be four digits." });
  }
  db.prepare(
    `INSERT INTO stats (year, students_placed, highest_package, average_package, companies_visited)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(year) DO UPDATE SET
       students_placed = excluded.students_placed,
       highest_package = excluded.highest_package,
       average_package = excluded.average_package,
       companies_visited = excluded.companies_visited,
       updated_at = datetime('now')`
  ).run(year, values.studentsPlaced, values.highest, values.average, values.companies);
  audit(req, "update_stats", year);
  res.json({ ok: true });
});

function companyFields(body) {
  const name = text(body?.name, 120);
  return {
    year: text(body?.year, 4),
    name,
    slug: slugify(name),
    role: text(body?.role, 120),
    packageLpa: number(body?.package),
    hired: number(body?.hired),
    branches: Array.isArray(body?.branches)
      ? body.branches.map((b) => text(b, 40)).filter(Boolean)
      : text(body?.branches, 200).split(",").map((b) => b.trim()).filter(Boolean),
  };
}

app.post("/api/admin/companies", ...admin, (req, res) => {
  const c = companyFields(req.body);
  if (!c.name || !c.role || !/^\d{4}$/.test(c.year)) {
    return res.status(400).json({ error: "Year, company name and role are required." });
  }
  const exists = db.prepare("SELECT id FROM companies WHERE year = ? AND slug = ?")
    .get(c.year, c.slug);
  if (exists) {
    return res.status(409).json({ error: "That company already exists for this year." });
  }
  const result = db.prepare(
    `INSERT INTO companies (year, name, slug, role, package_lpa, hired, branches)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(c.year, c.name, c.slug, c.role, c.packageLpa, c.hired, JSON.stringify(c.branches));
  audit(req, "create_company", `${c.year}:${c.name}`);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Phase 8 — bulk import. The browser reads a .csv file as text and posts it
// here; the server parses and validates every row before writing anything.
app.post("/api/admin/companies/import", ...admin, (req, res) => {
  const year = text(req.body?.year, 4);
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: "A four-digit year is required." });
  }
  if (!csv.trim()) return res.status(400).json({ error: "Choose a CSV file first." });
  if (csv.length > 50_000) {
    return res.status(400).json({ error: "CSV is too large (50,000 character limit)." });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: "CSV needs a header row and at least one company." });
  }
  const header = rows[0].map((cell) => cell.toLowerCase().replace(/[\s-]+/g, "_"));
  const columns = ["name", "role", "package", "hired", "branches"];
  const missing = columns.filter((column) => !header.includes(column));
  if (missing.length) {
    return res.status(400).json({
      error: `Missing CSV column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
      details: ["Expected header: name,role,package,hired,branches"],
    });
  }
  const index = Object.fromEntries(columns.map((column) => [column, header.indexOf(column)]));

  const problems = [];
  const staged = [];
  rows.slice(1).forEach((cells, position) => {
    const line = position + 2;
    const rowProblems = [];
    const name = text(cells[index.name], 120);
    const role = text(cells[index.role], 120);
    // Number("") is 0, so treat blank cells as invalid rather than free data.
    const rawPackage = text(cells[index.package], 40);
    const rawHired = text(cells[index.hired], 40);
    const packageLpa = rawPackage ? Number(rawPackage) : NaN;
    const hired = rawHired ? Number(rawHired) : NaN;
    const branches = text(cells[index.branches], 200)
      .split(",").map((branch) => branch.trim()).filter(Boolean);

    if (!name || !role) rowProblems.push(`Line ${line}: name and role are required.`);
    if (!Number.isFinite(packageLpa) || packageLpa < 0) {
      rowProblems.push(`Line ${line}: package must be a number ≥ 0.`);
    }
    if (!Number.isInteger(hired) || hired < 0) {
      rowProblems.push(`Line ${line}: hired must be a whole number ≥ 0.`);
    }
    problems.push(...rowProblems);
    if (rowProblems.length === 0) {
      staged.push({ name, slug: slugify(name), role, packageLpa, hired, branches });
    }
  });

  const seen = new Set();
  for (const company of staged) {
    if (seen.has(company.slug)) {
      problems.push(`Duplicate company "${company.name}" in this CSV.`);
    }
    seen.add(company.slug);
  }
  if (problems.length) {
    return res.status(400).json({
      error: "CSV import failed — no rows were written.",
      details: problems.slice(0, 10),
    });
  }

  let created = 0;
  let updated = 0;
  for (const company of staged) {
    const existing = db.prepare(
      "SELECT id FROM companies WHERE year = ? AND slug = ?"
    ).get(year, company.slug);
    const values = [
      company.name, company.slug, company.role,
      company.packageLpa, company.hired, JSON.stringify(company.branches),
    ];
    if (existing) {
      db.prepare(
        `UPDATE companies SET name = ?, slug = ?, role = ?, package_lpa = ?,
           hired = ?, branches = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(...values, existing.id);
      updated += 1;
    } else {
      db.prepare(
        `INSERT INTO companies (year, name, slug, role, package_lpa, hired, branches)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(year, ...values);
      created += 1;
    }
  }

  audit(req, "import_companies", `${year}: ${staged.length} rows`);
  res.json({ ok: true, imported: staged.length, created, updated });
});

app.put("/api/admin/companies/:id", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Company not found." });

  const c = companyFields(req.body);
  if (!c.name || !c.role || !/^\d{4}$/.test(c.year)) {
    return res.status(400).json({ error: "Year, company name and role are required." });
  }
  const clash = db.prepare(
    "SELECT id FROM companies WHERE year = ? AND slug = ? AND id != ?"
  ).get(c.year, c.slug, id);
  if (clash) return res.status(409).json({ error: "Another company has that name this year." });

  db.prepare(
    `UPDATE companies SET year = ?, name = ?, slug = ?, role = ?, package_lpa = ?,
       hired = ?, branches = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(c.year, c.name, c.slug, c.role, c.packageLpa, c.hired, JSON.stringify(c.branches), id);
  audit(req, "update_company", `${c.year}:${c.name}`);
  res.json({ ok: true });
});

app.delete("/api/admin/companies/:id", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT name FROM companies WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Company not found." });
  db.prepare("DELETE FROM companies WHERE id = ?").run(id);
  audit(req, "delete_company", existing.name);
  res.json({ ok: true });
});

// Replace all branch percentages for a year in one go.
app.put("/api/admin/branch-stats/:year", ...admin, (req, res) => {
  const year = text(req.params.year, 4);
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: "Invalid year." });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const clean = rows.map((r) => ({
    branch: text(r?.branch, 80),
    percent: Math.min(100, Math.max(0, number(r?.percent))),
  })).filter((r) => r.branch);

  db.prepare("DELETE FROM branch_stats WHERE year = ?").run(year);
  const insert = db.prepare(
    "INSERT OR REPLACE INTO branch_stats (year, branch, percent) VALUES (?, ?, ?)"
  );
  for (const row of clean) insert.run(year, row.branch, row.percent);
  audit(req, "update_branch_stats", year);
  res.json({ ok: true, saved: clean.length });
});

// ------------------------------------------- Alumni outreach (TPO-initiated)
// TPO has past placed-student/alumni contacts and reaches out asking them to
// help bring their current company for placement/internship campus drives.
app.get("/api/admin/alumni", ...admin, (_req, res) => {
  const alumni = db.prepare(
    `SELECT id, full_name AS fullName, email, phone, branch,
            graduation_year AS graduationYear, placed_company AS placedCompany,
            placed_role AS placedRole, placed_year AS placedYear,
            current_company AS currentCompany, outreach_status AS outreachStatus,
            outreach_type AS outreachType, last_contacted_at AS lastContactedAt,
            follow_up_at AS followUpAt, response_note AS responseNote,
            referral_company AS referralCompany, referral_contact AS referralContact,
            referral_details AS referralDetails, created_at AS createdAt,
            updated_at AS updatedAt
     FROM alumni_contacts
     ORDER BY CASE outreach_status
       WHEN 'referred' THEN 0 WHEN 'interested' THEN 1 WHEN 'responded' THEN 2
       WHEN 'contacted' THEN 3 WHEN 'not_contacted' THEN 4
       WHEN 'no_response' THEN 5 ELSE 6 END, id DESC`
  ).all();
  res.json({ alumni });
});

app.post("/api/admin/alumni/import", ...admin, (req, res) => {
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!csv.trim()) return res.status(400).json({ error: "Choose a CSV file first." });
  if (csv.length > 100_000) {
    return res.status(400).json({ error: "CSV is too large (100,000 character limit)." });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: "CSV needs a header row and at least one contact." });
  }

  const header = rows[0].map((cell) => cell.toLowerCase().replace(/[\s-]+/g, "_"));
  const findIndex = (...names) => names.map((n) => header.indexOf(n)).find((i) => i !== -1) ?? -1;
  const nameIdx = findIndex("full_name", "name");
  const emailIdx = header.indexOf("email");
  if (nameIdx === -1 || emailIdx === -1) {
    return res.status(400).json({
      error: "Missing required CSV columns.",
      details: ["Expected at least: full_name (or name), email. Optional: phone, branch, graduation_year, placed_company, placed_role, placed_year, current_company"],
    });
  }

  const col = {
    phone: findIndex("phone", "mobile"),
    branch: header.indexOf("branch"),
    graduationYear: findIndex("graduation_year", "grad_year"),
    placedCompany: findIndex("placed_company", "company_placed_at", "company"),
    placedRole: findIndex("placed_role", "role"),
    placedYear: findIndex("placed_year", "placement_year"),
    currentCompany: findIndex("current_company", "currentcompany"),
  };
  const pick = (cells, idx) => (idx >= 0 ? text(cells[idx], 160) : "");

  const problems = [];
  const staged = [];
  const seen = new Set();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  rows.slice(1).forEach((cells, position) => {
    const line = position + 2;
    const fullName = text(cells[nameIdx], 120);
    const email = text(cells[emailIdx], 160).toLowerCase();
    const rowProblems = [];
    if (!fullName) rowProblems.push(`Line ${line}: name is required.`);
    if (!emailPattern.test(email)) rowProblems.push(`Line ${line}: a valid email is required.`);
    if (email && seen.has(email)) rowProblems.push(`Line ${line}: duplicate email "${email}" in this CSV.`);
    if (email) seen.add(email);
    problems.push(...rowProblems);
    if (rowProblems.length === 0) {
      staged.push({
        fullName,
        email,
        phone: pick(cells, col.phone),
        branch: pick(cells, col.branch),
        graduationYear: pick(cells, col.graduationYear),
        placedCompany: pick(cells, col.placedCompany),
        placedRole: pick(cells, col.placedRole),
        placedYear: pick(cells, col.placedYear),
        currentCompany: pick(cells, col.currentCompany),
      });
    }
  });

  if (problems.length) {
    return res.status(400).json({
      error: "CSV import failed — no rows were written.",
      details: problems.slice(0, 12),
    });
  }

  let created = 0;
  let updated = 0;
  const selectByEmail = db.prepare("SELECT id FROM alumni_contacts WHERE email = ?");
  const insert = db.prepare(
    `INSERT INTO alumni_contacts
       (full_name, email, phone, branch, graduation_year, placed_company, placed_role, placed_year, current_company)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE alumni_contacts
     SET full_name = ?, phone = ?, branch = ?, graduation_year = ?, placed_company = ?,
         placed_role = ?, placed_year = ?, current_company = ?, updated_at = datetime('now')
     WHERE email = ?`
  );

  for (const a of staged) {
    const existing = selectByEmail.get(a.email);
    if (existing) {
      update.run(
        a.fullName, a.phone || null, a.branch || null, a.graduationYear || null,
        a.placedCompany || null, a.placedRole || null, a.placedYear || null,
        a.currentCompany || null, a.email
      );
      updated += 1;
    } else {
      insert.run(
        a.fullName, a.email, a.phone || null, a.branch || null, a.graduationYear || null,
        a.placedCompany || null, a.placedRole || null, a.placedYear || null,
        a.currentCompany || null
      );
      created += 1;
    }
  }

  audit(req, "import_alumni", `${staged.length} contacts`);
  res.json({ ok: true, imported: staged.length, created, updated });
});

const ALUMNI_STATUSES = new Set(["not_contacted", "contacted", "responded", "interested", "referred", "not_interested", "no_response"]);
const OUTREACH_TYPES = new Set(["placement", "internship", "both", ""]);

app.put("/api/admin/alumni/bulk", ...admin, (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return res.status(400).json({ error: "Select at least one contact." });
  if (ids.length > 500) return res.status(400).json({ error: "Select 500 contacts or fewer at a time." });

  const hasStatus = typeof req.body?.outreachStatus === "string" && req.body.outreachStatus !== "";
  const status = hasStatus ? text(req.body.outreachStatus, 30) : null;
  if (hasStatus && !ALUMNI_STATUSES.has(status)) {
    return res.status(400).json({ error: "Unknown outreach status." });
  }
  const hasType = Object.prototype.hasOwnProperty.call(req.body || {}, "outreachType");
  const typeRaw = hasType ? text(req.body.outreachType, 20) : null;
  if (hasType && !OUTREACH_TYPES.has(typeRaw)) {
    return res.status(400).json({ error: "Unknown outreach type." });
  }
  const hasFollowUp = Object.prototype.hasOwnProperty.call(req.body || {}, "followUpAt");
  const followUpAt = hasFollowUp ? (text(req.body.followUpAt, 30) || null) : null;
  const markContacted = req.body?.markContacted === true;

  if (!hasStatus && !hasType && !hasFollowUp && !markContacted) {
    return res.status(400).json({ error: "Choose a bulk action to apply." });
  }

  const select = db.prepare("SELECT * FROM alumni_contacts WHERE id = ?");
  const update = db.prepare(
    `UPDATE alumni_contacts
     SET outreach_status = ?, outreach_type = ?, last_contacted_at = ?, follow_up_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  );
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  let updated = 0;

  db.exec("BEGIN");
  try {
    for (const id of ids) {
      const existing = select.get(id);
      if (!existing) continue;
      let nextStatus = existing.outreach_status;
      let nextType = existing.outreach_type;
      let nextLast = existing.last_contacted_at;
      let nextFollow = existing.follow_up_at;

      if (hasType) nextType = typeRaw || null;
      if (hasFollowUp) nextFollow = followUpAt || null;
      if (markContacted) {
        nextLast = now;
        if (nextStatus === "not_contacted") nextStatus = "contacted";
        if (!nextType && hasType) nextType = typeRaw || null;
      }
      if (hasStatus) nextStatus = status;

      update.run(nextStatus, nextType, nextLast, nextFollow, id);
      updated += 1;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  audit(req, "bulk_alumni_outreach", `${updated} contacts`);
  res.json({ ok: true, updated });
});

app.put("/api/admin/alumni/:id", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM alumni_contacts WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Alumni contact not found." });

  const outreachStatus = text(req.body?.outreachStatus, 30) || existing.outreach_status;
  if (!ALUMNI_STATUSES.has(outreachStatus)) {
    return res.status(400).json({ error: "Unknown outreach status." });
  }
  const outreachTypeRaw = text(req.body?.outreachType, 20);
  if (!OUTREACH_TYPES.has(outreachTypeRaw) && outreachTypeRaw !== null) {
    // allow empty to clear
  }
  const outreachType = OUTREACH_TYPES.has(outreachTypeRaw) ? (outreachTypeRaw || null) : existing.outreach_type;

  const followUpAt = text(req.body?.followUpAt, 30) || null;
  const lastContactedAt = text(req.body?.lastContactedAt, 30) || null;
  const responseNote = text(req.body?.responseNote, 2000) || null;
  const referralCompany = text(req.body?.referralCompany, 160) || null;
  const referralContact = text(req.body?.referralContact, 200) || null;
  const referralDetails = text(req.body?.referralDetails, 2000) || null;
  const currentCompany = text(req.body?.currentCompany, 160) || null;

  db.prepare(
    `UPDATE alumni_contacts
     SET outreach_status = ?, outreach_type = ?, last_contacted_at = ?, follow_up_at = ?,
         response_note = ?, referral_company = ?, referral_contact = ?, referral_details = ?,
         current_company = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    outreachStatus, outreachType, lastContactedAt, followUpAt,
    responseNote, referralCompany, referralContact, referralDetails,
    currentCompany, id
  );

  audit(req, "update_alumni_outreach", `${existing.email}:${outreachStatus}`);
  res.json({ ok: true });
});

// -------------------------------------------------- Phase 4: staff controls
const superAdmin = [requireAuth, requireRole("tpoi")];
const USER_ROLES = ["student", "contributor", "tpo", "tpoi"];

// Both staff roles may browse users (TPO needs to find placed students to
// promote); only TPOI can create staff accounts or change staff roles.
app.get("/api/admin/users", ...admin, (_req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY role, full_name").all().map(publicUser);
  res.json({ users });
});

app.post("/api/admin/users", ...superAdmin, (req, res) => {
  const fullName = text(req.body?.fullName, 80);
  const email = text(req.body?.email, 120).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = text(req.body?.role, 20);

  if (!fullName) return res.status(400).json({ error: "Enter the staff member's name." });
  if (!email.endsWith(COLLEGE_DOMAIN)) {
    return res.status(400).json({ error: `Use a ${COLLEGE_DOMAIN} email address.` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!["tpo", "tpoi"].includes(role)) {
    return res.status(400).json({ error: "Staff accounts must be tpo or tpoi." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const result = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`
  ).run(fullName, email, bcrypt.hashSync(password, 10), role);
  audit(req, "create_staff", `${email}:${role}`);
  res.status(201).json({ user: publicUser(findUserById(Number(result.lastInsertRowid))) });
});

app.put("/api/admin/users/:id/role", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const target = findUserById(id);
  if (!target) return res.status(404).json({ error: "User not found." });

  const role = text(req.body?.role, 20);
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Unknown role." });
  }
  if (target.id === req.user.id) {
    return res.status(403).json({ error: "You cannot change your own role." });
  }
  // TPO moderators may only promote/verify students as contributors.
  if (req.user.role !== "tpoi" && ["tpo", "tpoi"].includes(target.role)) {
    return res.status(403).json({ error: "Only the TPO in-charge can change staff roles." });
  }
  if (req.user.role !== "tpoi" && !["student", "contributor"].includes(role)) {
    return res.status(403).json({ error: "TPO staff can only grant or revoke contributor status." });
  }
  // Never lock the system out of its last super-admin.
  if (target.role === "tpoi" && role !== "tpoi") {
    const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'tpoi'").get().n;
    if (count <= 1) {
      return res.status(409).json({ error: "At least one TPO in-charge must remain." });
    }
  }

  if (role !== target.role) {
    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .run(role, id);
    audit(req, "change_role", `${target.email}: ${target.role} -> ${role}`);
  }
  // auth.js reloads the user on every request, so this takes effect instantly.
  res.json({ ok: true, user: publicUser(findUserById(id)) });
});

app.get("/api/admin/audit", ...superAdmin, (req, res) => {
  const limit = Math.min(500, Math.max(1, number(req.query?.limit, 200)));
  const entries = db.prepare(
    `SELECT a.*, u.full_name AS actor_name, u.email AS actor_email
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.id DESC LIMIT ?`
  ).all(limit).map((row) => ({
    id: row.id,
    action: row.action,
    target: row.target,
    createdAt: row.created_at,
    actor: row.actor_name
      ? { name: row.actor_name, email: row.actor_email }
      : { name: "System", email: "" },
  }));
  res.json({ entries });
});

// ------------------------------------------------------- Phase 3: reviews
// Students AND contributors may submit; staff approval is what publishes.
const submitter = [requireAuth, requireRole("student", "contributor")];

function experienceFields(body) {
  const tags = Array.isArray(body?.tags)
    ? body.tags.map((tag) => text(tag, 40)).filter(Boolean).slice(0, 8)
    : text(body?.tags, 300).split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
  return {
    company: text(body?.company, 120),
    role: text(body?.role, 120),
    placementYear: text(body?.placementYear, 4),
    heading: text(body?.heading, 160),
    body: typeof body?.body === "string" ? body.body.trim().slice(0, 5000) : "",
    tags,
    // Explicit choice only — never trust a client-supplied status.
    visibility: body?.visibility === "named" ? "named" : "anonymous",
  };
}

function experienceError(fields) {
  if (!fields.company || !fields.role || !fields.heading) {
    return "Company, role and title are required.";
  }
  if (!/^\d{4}$/.test(fields.placementYear)) {
    return "Enter a four-digit placement year.";
  }
  if (fields.body.length < 30) {
    return "Write at least 30 characters so the experience is useful to juniors.";
  }
  return null;
}

app.post("/api/experiences", ...submitter, (req, res) => {
  const fields = experienceFields(req.body);
  const invalid = experienceError(fields);
  if (invalid) return res.status(400).json({ error: invalid });

  const result = db.prepare(
    `INSERT INTO experiences
       (user_id, company, role, placement_year, heading, body, tags, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    req.user.id, fields.company, fields.role, fields.placementYear,
    fields.heading, fields.body, JSON.stringify(fields.tags), fields.visibility
  );
  audit(req, "submit_experience", `${fields.company}:${fields.heading}`);
  notifyStaff(
    "submission",
    "New experience to review",
    `${fields.company}: ${fields.heading}`,
    "/admin/reviews"
  );
  res.status(201).json({ id: Number(result.lastInsertRowid), status: "pending" });
});

// A student may edit only their own submissions, and only while they are
// still pending or after the TPO asks for changes. Editing resubmits.
app.put("/api/experiences/:id", ...submitter, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM experiences WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Submission not found." });
  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ error: "This is not your submission." });
  }
  if (!["pending", "changes_requested"].includes(existing.status)) {
    return res.status(409).json({ error: "Only pending submissions can be edited." });
  }

  const fields = experienceFields(req.body);
  const invalid = experienceError(fields);
  if (invalid) return res.status(400).json({ error: invalid });

  db.prepare(
    `UPDATE experiences SET company = ?, role = ?, placement_year = ?, heading = ?,
       body = ?, tags = ?, visibility = ?, status = 'pending',
       review_note = NULL, reviewed_by = NULL, reviewed_at = NULL,
       updated_at = datetime('now') WHERE id = ?`
  ).run(
    fields.company, fields.role, fields.placementYear, fields.heading,
    fields.body, JSON.stringify(fields.tags), fields.visibility, id
  );
  audit(req, "resubmit_experience", String(id));
  notifyStaff(
    "submission",
    "Experience resubmitted",
    `${fields.company}: ${fields.heading}`,
    "/admin/reviews"
  );
  res.json({ ok: true, status: "pending" });
});

app.get("/api/experiences/mine", ...submitter, (req, res) => {
  res.json({ experiences: userExperiences(req.user.id) });
});

// Public detail page. Registered after /mine so the literal path wins, and
// the lookup itself only ever returns approved rows with display fields.
app.get("/api/experiences/:id", (req, res) => {
  const experience = publicExperienceDetail(Number(req.params.id));
  if (!experience) return res.status(404).json({ error: "Experience not found." });
  res.json({ experience });
});

// Staff sees real identities, review history and every status.
app.get("/api/admin/experiences", ...admin, (_req, res) => {
  const experiences = staffExperiences();
  res.json({
    experiences,
    counts: {
      pending: experiences.filter((e) => e.status === "pending").length,
      changes_requested: experiences.filter((e) => e.status === "changes_requested").length,
      approved: experiences.filter((e) => e.status === "approved").length,
      rejected: experiences.filter((e) => e.status === "rejected").length,
    },
  });
});

const REVIEW_ACTIONS = {
  approve: "approved",
  request_changes: "changes_requested",
  reject: "rejected",
};

app.post("/api/admin/experiences/:id/review", ...admin, (req, res) => {
  const action = req.body?.action;
  const status = REVIEW_ACTIONS[action];
  if (!status) {
    return res.status(400).json({ error: "Unknown review action." });
  }
  const note = text(req.body?.note, 1000);
  if (action !== "approve" && !note) {
    return res.status(400).json({ error: "Add a note so the student knows what to fix." });
  }

  const id = Number(req.params.id);
  const existing = db.prepare(
    "SELECT id, user_id, company, heading, status FROM experiences WHERE id = ?"
  ).get(id);
  if (!existing) return res.status(404).json({ error: "Submission not found." });
  if (!["pending", "changes_requested"].includes(existing.status)) {
    return res.status(409).json({ error: "This submission has already been reviewed." });
  }

  db.prepare(
    `UPDATE experiences SET status = ?, review_note = ?, reviewed_by = ?,
       reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(status, action === "approve" ? note || null : note, req.user.id, id);
  audit(req, `review_${action}`, String(id));

  // The author always sees the real outcome (and the reviewer's note), even
  // when the write-up is anonymous to everyone else.
  const decision = {
    approve: {
      title: "Your experience was approved",
      body: `${existing.company}: ${existing.heading} is now live.`,
      link: `/experience/${id}`,
    },
    request_changes: {
      title: "Changes requested on your experience",
      body: note,
      link: "/my-experiences",
    },
    reject: {
      title: "Your experience was not published",
      body: note,
      link: "/my-experiences",
    },
  }[action];
  notify(existing.user_id, "review", decision.title, decision.body, decision.link);

  res.json({ ok: true, status });
});

// ------------------------------------------------ upcoming drives + pipeline
const APPLICATION_STATUSES = new Set(["applied", "oa", "interview", "offer", "rejected", "withdrawn"]);
const DRIVE_STATUSES = new Set(["open", "closed"]);

function shapeDrive(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    package: row.package_lpa,
    location: row.location || "",
    eligibilityBranches: jsonArray(row.eligibility_branches),
    graduationYears: jsonArray(row.graduation_years),
    registrationDeadline: row.registration_deadline || "",
    driveDate: row.drive_date || "",
    applyLink: row.apply_link || "",
    description: row.description || "",
    status: row.status,
    applicantCount: row.applicantCount ?? null,
    offerCount: row.offerCount ?? null,
    createdAt: row.created_at,
  };
}

function adminDrive(id) {
  const row = db.prepare(
    `SELECT d.*,
            (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id) AS applicantCount,
            (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id AND a.status = 'offer') AS offerCount
     FROM drives d WHERE d.id = ?`
  ).get(id);
  return shapeDrive(row);
}

function readDriveFields(body) {
  const company = text(body?.company, 120);
  const role = text(body?.role, 120);
  if (!company || !role) return { error: "Company and role are required." };

  const packageLpa = body?.package === "" || body?.package === null || body?.package === undefined
    ? null : number(body.package, -1);
  if (packageLpa !== null && (!Number.isFinite(packageLpa) || packageLpa < 0)) {
    return { error: "Package must be a positive number." };
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const registrationDeadline = text(body?.registrationDeadline, 30);
  const driveDate = text(body?.driveDate, 30);
  if (registrationDeadline && !datePattern.test(registrationDeadline)) {
    return { error: "Registration deadline must use YYYY-MM-DD." };
  }
  if (driveDate && !datePattern.test(driveDate)) {
    return { error: "Drive date must use YYYY-MM-DD." };
  }

  const status = body?.status === undefined || body?.status === "" ? "open" : text(body.status, 20);
  if (!DRIVE_STATUSES.has(status)) return { error: "Unknown drive status." };

  return {
    fields: {
      company,
      role,
      packageLpa,
      location: text(body?.location, 120) || null,
      eligibilityBranches: JSON.stringify(stringList(body?.eligibilityBranches)),
      graduationYears: JSON.stringify(stringList(body?.graduationYears)),
      registrationDeadline: registrationDeadline || null,
      driveDate: driveDate || null,
      applyLink: text(body?.applyLink, 500) || null,
      description: text(body?.description, 2000) || null,
      status,
    },
  };
}

// Only students whose branch and graduation year match the drive are alerted;
// an empty eligibility list means the drive is open to everyone.
function notifyEligibleStudents(drive) {
  const students = db.prepare(
    "SELECT id, branch, graduation_year FROM users WHERE role IN ('student', 'contributor')"
  ).all();
  for (const person of students) {
    const branchOk = drive.eligibilityBranches.length === 0
      || (person.branch && drive.eligibilityBranches.includes(person.branch));
    const yearOk = drive.graduationYears.length === 0
      || (person.graduation_year && drive.graduationYears.includes(person.graduation_year));
    if (branchOk && yearOk) {
      notify(person.id, "drive", `New drive: ${drive.company}`,
        `${drive.role} — registrations close ${drive.registrationDeadline || "soon"}.`, "/drives");
    }
  }
}

// Public: upcoming drives. Applications stay private to their owner.
app.get("/api/drives", (_req, res) => {
  const drives = db.prepare(
    `SELECT * FROM drives
     ORDER BY status DESC,
              CASE WHEN registration_deadline IS NULL OR registration_deadline = '' THEN 1 ELSE 0 END,
              registration_deadline ASC, id DESC`
  ).all().map(shapeDrive);
  res.json({ drives });
});

app.get("/api/applications", requireAuth, (req, res) => {
  const applications = db.prepare(
    `SELECT a.id, a.drive_id AS driveId, a.status, a.notes,
            a.created_at AS createdAt, a.updated_at AS updatedAt,
            d.company, d.role, d.package_lpa AS package, d.registration_deadline AS registrationDeadline,
            d.drive_date AS driveDate, d.apply_link AS applyLink, d.status AS driveStatus
     FROM applications a JOIN drives d ON d.id = a.drive_id
     WHERE a.user_id = ? ORDER BY a.updated_at DESC, a.id DESC`
  ).all(req.user.id);
  res.json({ applications });
});

app.post("/api/applications", requireAuth, (req, res) => {
  const driveId = Number(req.body?.driveId);
  if (!Number.isInteger(driveId) || driveId <= 0) {
    return res.status(400).json({ error: "Choose a drive to track." });
  }
  const drive = db.prepare("SELECT id, status FROM drives WHERE id = ?").get(driveId);
  if (!drive) return res.status(404).json({ error: "Drive not found." });
  if (drive.status !== "open") return res.status(400).json({ error: "This drive is closed." });

  const status = text(req.body?.status, 20) || "applied";
  if (!APPLICATION_STATUSES.has(status)) {
    return res.status(400).json({ error: "Unknown application status." });
  }
  if (db.prepare("SELECT id FROM applications WHERE user_id = ? AND drive_id = ?").get(req.user.id, driveId)) {
    return res.status(409).json({ error: "You are already tracking this drive." });
  }

  const result = db.prepare(
    `INSERT INTO applications (user_id, drive_id, status, notes) VALUES (?, ?, ?, ?)`
  ).run(req.user.id, driveId, status, text(req.body?.notes, 2000) || null);
  audit(req, "create_application", `drive:${driveId}`);
  res.status(201).json({ application: { id: Number(result.lastInsertRowid), driveId, status } });
});

app.put("/api/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Application not found." });

  const status = req.body?.status === undefined ? existing.status : text(req.body.status, 20);
  if (!APPLICATION_STATUSES.has(status)) {
    return res.status(400).json({ error: "Unknown application status." });
  }
  const notes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes")
    ? text(req.body.notes, 2000) || null : existing.notes;

  db.prepare(
    `UPDATE applications SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, notes, id);
  audit(req, "update_application", `application:${id}`);
  res.json({ application: { id, status, notes } });
});

app.delete("/api/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM applications WHERE id = ? AND user_id = ?").run(id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Application not found." });
  audit(req, "delete_application", `application:${id}`);
  res.json({ ok: true });
});

// Staff drive management. Writes are audited; publishing a drive alerts the
// students it is aimed at through the existing notification inbox.
app.get("/api/admin/drives", ...admin, (_req, res) => {
  const drives = db.prepare(
    `SELECT d.*,
            (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id) AS applicantCount,
            (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id AND a.status = 'offer') AS offerCount
     FROM drives d ORDER BY id DESC`
  ).all().map(shapeDrive);
  res.json({ drives });
});

app.post("/api/admin/drives", ...admin, (req, res) => {
  const parsed = readDriveFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const f = parsed.fields;
  const result = db.prepare(
    `INSERT INTO drives
       (company, role, package_lpa, location, eligibility_branches, graduation_years,
        registration_deadline, drive_date, apply_link, description, status, created_by)
     VALUES (@company, @role, @packageLpa, @location, @eligibilityBranches, @graduationYears,
             @registrationDeadline, @driveDate, @applyLink, @description, @status, @createdBy)`
  ).run({ ...f, createdBy: req.user.id });

  audit(req, "create_drive", `${f.company}:${f.role}`);
  notifyEligibleStudents({
    company: f.company, role: f.role,
    eligibilityBranches: jsonArray(f.eligibilityBranches),
    graduationYears: jsonArray(f.graduationYears),
    registrationDeadline: f.registrationDeadline,
  });
  res.status(201).json({ drive: adminDrive(Number(result.lastInsertRowid)) });
});

app.put("/api/admin/drives/:id", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM drives WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Drive not found." });
  const parsed = readDriveFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const f = parsed.fields;
  db.prepare(
    `UPDATE drives SET company = @company, role = @role, package_lpa = @packageLpa,
       location = @location, eligibility_branches = @eligibilityBranches,
       graduation_years = @graduationYears, registration_deadline = @registrationDeadline,
       drive_date = @driveDate, apply_link = @applyLink, description = @description,
       status = @status, updated_at = datetime('now')
     WHERE id = @id`
  ).run({ ...f, id });
  audit(req, "update_drive", `drive:${id}`);
  res.json({ drive: adminDrive(id) });
});

app.delete("/api/admin/drives/:id", ...admin, (req, res) => {
  const id = Number(req.params.id);
  const drive = db.prepare("SELECT company FROM drives WHERE id = ?").get(id);
  if (!drive) return res.status(404).json({ error: "Drive not found." });
  db.prepare("DELETE FROM drives WHERE id = ?").run(id);
  audit(req, "delete_drive", `${id}:${drive.company}`);
  res.json({ ok: true });
});

// Unknown API paths must stay JSON, even when the SPA fallback is active.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Production deployment: one Express process serves both the API and the
// built React app. Client-side routes (/company/:slug, /admin/...) all get
// index.html so React Router can resolve them after a hard refresh.
if (process.env.NODE_ENV === "production" && existsSync(distIndex)) {
  app.use(express.static(distDir, { index: false }));
  // Express 5 requires a RegExp here — a bare "*" throws at startup.
  app.get(/.*/, (_req, res) => res.sendFile(distIndex));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const server = app.listen(PORT, () => {
  // Print the real bound port; with API_PORT=0 the OS picks a free one.
  console.log(`VJTI Placements API listening on http://localhost:${server.address()?.port ?? PORT}`);
});
