/*
  Phase 2 — server/content.js
  Shapes database rows into the same object shape the React components
  already expect, so the public pages barely have to change.
*/
import { db } from "./db.js";
import { buildPrepInsights } from "./insights.js";

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseList(json) {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// One joined SELECT reused by the public, student and staff views.
const EXPERIENCE_SELECT = `
  SELECT e.*,
         u.full_name AS author_name, u.email AS author_email,
         u.branch AS author_branch, r.full_name AS reviewer_name
  FROM experiences e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN users r ON r.id = e.reviewed_by
`;

function shapeExperience(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    placementYear: row.placement_year,
    heading: row.heading,
    body: row.body,
    tags: parseList(row.tags),
    visibility: row.visibility,
    status: row.status,
    reviewNote: row.review_note,
    reviewedBy: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // `author.name` is the PUBLIC byline. Staff pages use realName/email to
    // show who actually wrote an anonymous submission.
    author: {
      name: row.visibility === "anonymous" ? "Anonymous senior" : row.author_name,
      branch: row.visibility === "anonymous" ? "" : row.author_branch,
      year: row.placement_year,
      realName: row.author_name,
      email: row.author_email,
      realBranch: row.author_branch,
    },
  };
}

// Card previews stay short; the full write-up lives behind the detail API.
// 179 + the trailing ellipsis keeps the card preview at 180 characters.
const EXCERPT_LENGTH = 179;

function publicByline(row) {
  return {
    name: row.visibility === "anonymous" ? "Anonymous senior" : row.author_name,
    branch: row.visibility === "anonymous" ? "" : row.author_branch,
    year: row.placement_year,
  };
}

// Public payload deliberately carries ONLY the display fields — no real name,
// email or review notes can leak through GET /api/content. The id is stable so
// a card can link to its detail page, and company/year/tags are included so
// the browser can filter without another request.
export function publicExperiences() {
  return db.prepare(
    `${EXPERIENCE_SELECT} WHERE e.status = 'approved'
     ORDER BY e.placement_year DESC, e.id DESC`
  ).all().map((row) => ({
    id: row.id,
    company: row.company,
    role: row.role,
    placementYear: row.placement_year,
    heading: row.heading,
    excerpt: row.body.length > EXCERPT_LENGTH
      ? `${row.body.slice(0, EXCERPT_LENGTH).trimEnd()}…`
      : row.body,
    tags: parseList(row.tags),
    author: publicByline(row),
  }));
}

// Same privacy rule for the detail page: only approved rows, only display
// fields. Pending / changes-requested / rejected rows are treated as missing.
export function publicExperienceDetail(id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = db.prepare(
    `${EXPERIENCE_SELECT} WHERE e.id = ? AND e.status = 'approved'`
  ).get(id);
  if (!row) return null;
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    placementYear: row.placement_year,
    heading: row.heading,
    body: row.body,
    tags: parseList(row.tags),
    createdAt: row.created_at,
    author: publicByline(row),
  };
}

// Staff queue: real names + review info, newest actionable items first.
export function staffExperiences() {
  return db.prepare(
    `${EXPERIENCE_SELECT} ORDER BY
       CASE e.status
         WHEN 'pending' THEN 0 WHEN 'changes_requested' THEN 1
         WHEN 'approved' THEN 2 ELSE 3 END,
       e.id DESC`
  ).all().map(shapeExperience);
}

export function userExperiences(userId) {
  return db.prepare(
    `${EXPERIENCE_SELECT} WHERE e.user_id = ? ORDER BY e.id DESC`
  ).all(userId).map(shapeExperience);
}

export function findExperience(id) {
  const row = db.prepare(`${EXPERIENCE_SELECT} WHERE e.id = ?`).get(id);
  return row ? shapeExperience(row) : null;
}

export function getPublicContent() {
  const stats = {};
  for (const row of db.prepare("SELECT * FROM stats ORDER BY year").all()) {
    stats[row.year] = {
      studentsPlaced: row.students_placed,
      highest: row.highest_package,
      average: row.average_package,
      companies: row.companies_visited,
    };
  }

  const companiesByYear = {};
  const companiesBySlug = {};
  for (const row of db.prepare(
    "SELECT * FROM companies ORDER BY year DESC, package_lpa DESC"
  ).all()) {
    const company = {
      name: row.name,
      role: row.role,
      package: row.package_lpa,
      hired: row.hired,
      branches: parseList(row.branches),
    };
    (companiesByYear[row.year] ??= []).push(company);
    (companiesBySlug[row.slug] ??= {})[row.year] = company;
  }

  const branchStatsByYear = {};
  for (const row of db.prepare(
    "SELECT * FROM branch_stats ORDER BY year DESC, percent DESC"
  ).all()) {
    const totalStudents = Number(row.total_students ?? 0);
    const placedStudents = Number(row.placed_students ?? 0);
    const percent = totalStudents > 0
      ? Math.round((placedStudents / totalStudents) * 1000) / 10
      : Number(row.percent ?? 0);
    (branchStatsByYear[row.year] ??= []).push({
      branch: row.branch,
      totalStudents,
      placedStudents,
      unplacedStudents: Math.max(0, totalStudents - placedStudents),
      percent,
    });
  }

  const years = Object.keys(stats).sort().reverse();
  const experiences = publicExperiences();
  return {
    currentYear: years[0] || "2026",
    stats,
    companiesByYear,
    companiesBySlug,
    branchStatsByYear,
    experiences,
    // Derived only from the public rows above — never from pending submissions.
    prepInsights: buildPrepInsights(experiences),
  };
}

// Raw rows (with ids) for the admin panel.
export function getRawContent() {
  return {
    stats: db.prepare("SELECT * FROM stats ORDER BY year DESC").all(),
    companies: db.prepare(
      "SELECT * FROM companies ORDER BY year DESC, package_lpa DESC"
    ).all().map((row) => ({ ...row, branches: parseList(row.branches).join(", ") })),
    branchStats: db.prepare(
      "SELECT * FROM branch_stats ORDER BY year DESC, percent DESC"
    ).all(),
  };
}
