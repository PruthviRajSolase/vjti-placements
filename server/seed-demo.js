/*
  Phase 2 — server/seed-demo.js
  Fills the database with realistic presentation data and four ready-made
  accounts. Run before demonstrating; it is safe to run repeatedly.

    npm run seed:demo
*/
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { slugify } from "./content.js";
import {
  STATS_BY_YEAR,
  COMPANIES_BY_YEAR,
  BRANCH_STATS_BY_YEAR,
  EXPERIENCES,
} from "../src/data.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run seed-demo in production.");
  process.exit(1);
}

console.log("Seeding demo content...");

// True reset: clear all app data, then rebuild the full demo state so reseeding
// always starts from a predictable database.
db.exec("PRAGMA foreign_keys = OFF;");
db.exec(`
  DELETE FROM notifications;
  DELETE FROM saved_companies;
  DELETE FROM applications;
  DELETE FROM audit_log;
  DELETE FROM experiences;
  DELETE FROM drives;
  DELETE FROM alumni_contacts;
  DELETE FROM companies;
  DELETE FROM branch_stats;
  DELETE FROM stats;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);
db.exec("PRAGMA foreign_keys = ON;");

const accounts = [
  {
    email: "student@vjti.ac.in",
    password: "Student123!",
    fullName: "Asha Patil",
    role: "student",
    branch: "Information Technology",
    graduationYear: "2027",
  },
  {
    email: "contributor@vjti.ac.in",
    password: "Contributor123!",
    fullName: "Rohan Deshmukh",
    role: "contributor",
    branch: "Computer Engineering",
    graduationYear: "2026",
  },
  // Three placed students who own the public write-ups. Each experience row
  // points at a REAL user, so the TPO can always see who wrote what — even
  // when the public page shows "Anonymous senior".
  {
    email: "aditya@vjti.ac.in",
    password: "Author123!",
    fullName: "Aditya S.",
    role: "contributor",
    branch: "Computer Engineering",
    graduationYear: "2026",
  },
  {
    email: "priya@vjti.ac.in",
    password: "Author123!",
    fullName: "Priya K.",
    role: "contributor",
    branch: "Information Technology",
    graduationYear: "2026",
  },
  {
    email: "rahul@vjti.ac.in",
    password: "Author123!",
    fullName: "Rahul M.",
    role: "contributor",
    branch: "Mechanical Engineering",
    graduationYear: "2026",
  },
  {
    email: "tpo@vjti.ac.in",
    password: "Tpo1234!",
    fullName: "TPO Office",
    role: "tpo",
    branch: null,
    graduationYear: null,
  },
  {
    email: "tpoi@vjti.ac.in",
    password: "ChangeMe123!",
    fullName: "TPO In-Charge",
    role: "tpoi",
    branch: null,
    graduationYear: null,
  },
];

const upsertUser = db.prepare(
  `INSERT INTO users (full_name, email, password_hash, role, branch, graduation_year)
   VALUES (@fullName, @email, @hash, @role, @branch, @graduationYear)
   ON CONFLICT(email) DO UPDATE SET
     full_name = excluded.full_name,
     password_hash = excluded.password_hash,
     role = excluded.role,
     branch = excluded.branch,
     graduation_year = excluded.graduation_year,
     updated_at = datetime('now')`
);

for (const account of accounts) {
  // node:sqlite is strict: pass ONLY the named parameters used in the SQL.
  upsertUser.run({
    fullName: account.fullName,
    email: account.email,
    hash: bcrypt.hashSync(account.password, 10),
    role: account.role,
    branch: account.branch,
    graduationYear: account.graduationYear,
  });
}

const userId = (email) => db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
const contributor = userId("contributor@vjti.ac.in");
const student = userId("student@vjti.ac.in");

// Two sample saves so the student's Saved page is useful on first open.
const insertBookmark = db.prepare(
  `INSERT OR IGNORE INTO saved_companies (user_id, slug, company_name) VALUES (?, ?, ?)`
);
insertBookmark.run(student, "northbridge_software", "Northbridge Software");
insertBookmark.run(student, "summit_bank_group", "Summit Bank Group");

const authorEmails = [
  "aditya@vjti.ac.in",
  "priya@vjti.ac.in",
  "rahul@vjti.ac.in",
];

const insertStat = db.prepare(
  `INSERT INTO stats (year, students_placed, highest_package, average_package, companies_visited)
   VALUES (?, ?, ?, ?, ?)`
);
for (const [year, s] of Object.entries(STATS_BY_YEAR)) {
  insertStat.run(year, s.studentsPlaced, s.highest, s.average, s.companies);
}

const insertCompany = db.prepare(
  `INSERT INTO companies (year, name, slug, role, package_lpa, hired, branches)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const [year, list] of Object.entries(COMPANIES_BY_YEAR)) {
  for (const c of list) {
    insertCompany.run(
      year, c.name, slugify(c.name), c.role, c.package, c.hired,
      JSON.stringify(c.branches)
    );
  }
}

const insertBranch = db.prepare(
  `INSERT INTO branch_stats (year, branch, percent, total_students, placed_students)
   VALUES (?, ?, ?, ?, ?)`
);
for (const [year, rows] of Object.entries(BRANCH_STATS_BY_YEAR)) {
  for (const row of rows) {
    const totalStudents = Number(row.totalStudents ?? 100);
    const placedStudents = Number(row.placedStudents ?? Math.round(row.percent));
    const percent = totalStudents > 0
      ? Math.round((placedStudents / totalStudents) * 1000) / 10
      : Number(row.percent ?? 0);
    insertBranch.run(year, row.branch, percent, totalStudents, placedStudents);
  }
}

const insertExperience = db.prepare(
  `INSERT INTO experiences
     (user_id, company, role, placement_year, heading, body, tags, visibility, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const [index, exp] of EXPERIENCES.entries()) {
  insertExperience.run(
    userId(authorEmails[index % authorEmails.length]),
    exp.company,
    exp.heading.split("—").pop().trim(),
    exp.author.year,
    exp.heading,
    exp.excerpt,
    JSON.stringify(exp.tags),
    "named",
    "approved"
  );
}

// Two pending submissions give the TPO something to review in the demo.
insertExperience.run(
  student,
  "Bluepeak Retail",
  "Software Engineer",
  "2026",
  "Bluepeak Retail — SDE (2026)",
  "OA had three DSA questions and one debugging task. Two interview rounds focused on data structures, a system design discussion and leadership principles. Practising timed mock interviews helped the most.",
  JSON.stringify(["Online Assessment", "System Design", "On-campus"]),
  "anonymous",
  "pending"
);
insertExperience.run(
  contributor,
  "Silvergate Bank",
  "Graduate Analyst",
  "2026",
  "Silvergate Bank — Graduate Analyst",
  "Aptitude test followed by a technical interview on SQL, OOPs and a puzzle. The final round was with the manager and focused on projects and willingness to relocate.",
  JSON.stringify(["Aptitude", "SQL", "On-campus"]),
  "named",
  "pending"
);

// Sample notifications so the bell is useful on first open. A mix of unread
// and already-read rows demonstrates both states in the UI.
const insertNotification = db.prepare(
  `INSERT INTO notifications (user_id, type, title, body, link, read_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const tpo = userId("tpo@vjti.ac.in");
const tpoi = userId("tpoi@vjti.ac.in");

// Staff see the two pending submissions waiting for review (unread).
for (const staffId of [tpo, tpoi]) {
  insertNotification.run(
    staffId, "submission", "New experience to review",
    "Bluepeak Retail: Bluepeak Retail — SDE (2026)", "/admin/reviews", null
  );
  insertNotification.run(
    staffId, "submission", "New experience to review",
    "Silvergate Bank: Silvergate Bank — Graduate Analyst", "/admin/reviews", null
  );
}
// The student has one unread approval and one older, already-read note.
insertNotification.run(
  student, "review", "Your experience was approved",
  "Northbridge Software: Interview preparation story is now live.",
  "/experience/1",
  null
);
// Bound parameters are literal strings, so generate the timestamp in JS
// rather than passing a SQL function that would never be evaluated.
const readAt = new Date().toISOString().replace("T", " ").slice(0, 19);
insertNotification.run(
  contributor, "review", "Changes requested on your experience",
  "Add a little more detail about the final round.",
  "/my-experiences",
  readAt
);

// Alumni outreach demo data: previously placed students TPO can contact to
// help bring their current companies for campus placement/internship drives.
const insertAlumni = db.prepare(
  `INSERT INTO alumni_contacts
     (full_name, email, phone, branch, graduation_year, placed_company, placed_role, placed_year,
      current_company, outreach_status, outreach_type, last_contacted_at, follow_up_at,
      response_note, referral_company, referral_contact, referral_details)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

insertAlumni.run(
  "Neha Kulkarni", "neha.kulkarni.alumni@example.com", "9876500001",
  "Computer Engineering", "2022", "Northbridge Software", "Software Engineer", "2022",
  "Northbridge Software", "interested", "placement", "2026-11-10 10:00:00", "2026-11-25 10:00:00",
  "Happy to connect TPO with the campus recruiting team for next season.",
  "Northbridge Software", "Priya Nair (Campus Recruiting)", "Shared recruiter contact; expects hiring plan by Dec."
);
insertAlumni.run(
  "Siddharth Rao", "siddharth.rao.alumni@example.com", "9876500002",
  "Information Technology", "2021", "Summit Bank Group", "Analyst", "2021",
  "Ironvale Partners", "contacted", "internship", "2026-11-12 09:30:00", "2026-11-22 09:30:00",
  "Replied that he will check internship intake with his team.",
  null, null, null
);
insertAlumni.run(
  "Meera Iyer", "meera.iyer.alumni@example.com", null,
  "Electronics Engineering", "2023", "Keystone Engineering", "GET", "2023",
  "Keystone Engineering", "not_contacted", null, null, null,
  null, null, null, null
);
insertAlumni.run(
  "Arjun Shah", "arjun.shah.alumni@example.com", "9876500004",
  "Mechanical Engineering", "2020", "Harbor Automotive", "Graduate Engineer Trainee", "2020",
  "Harbor Automotive", "referred", "both", "2026-11-05 11:15:00", null,
  "Forwarded official invitation to HR; HR asked for placement brochure.",
  "Harbor Automotive", "HR Campus Team", "Placement + internship interest; requested drive details for 2027."
);
insertAlumni.run(
  "Pooja Nair", "pooja.nair.alumni@example.com", null,
  "Computer Engineering", "2022", "Peregrine Systems", "Software Engineer", "2022",
  "Peregrine Systems", "no_response", "placement", "2026-10-28 14:00:00", "2026-11-20 14:00:00",
  "No reply yet to initial placement outreach.",
  null, null, null
);

// Upcoming drives and a small private application pipeline for the student.
const insertDrive = db.prepare(
  `INSERT INTO drives
     (company, role, package_lpa, location, eligibility_branches, graduation_years,
      registration_deadline, drive_date, apply_link, description, status, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
);
const driveOne = Number(insertDrive.run(
  "Northbridge Software", "Software Engineer", 12.5, "Mumbai / Remote",
  JSON.stringify(["Computer Engineering", "Information Technology"]), JSON.stringify(["2026", "2027"]),
  "2026-12-05", "2026-12-12", "https://careers.northbridge.example/",
  "Campus placement drive for final-year engineering students. Online assessment followed by two technical rounds.",
  tpo
).lastInsertRowid);
insertDrive.run(
  "Summit Bank Group", "Analyst", 9.75, "Mumbai",
  JSON.stringify(["Computer Engineering", "Information Technology", "Electronics Engineering"]), JSON.stringify(["2027"]),
  "2026-11-28", "2026-12-03", "https://www.summitbank.example/careers",
  "Internship + placement pipeline for 2027 graduates. Shortlisting based on resume and academics.",
  tpo
).lastInsertRowid;
insertDrive.run(
  "Harbor Automotive", "Graduate Engineer Trainee", 7.0, "Pune",
  JSON.stringify([]), JSON.stringify(["2026", "2027"]),
  "2026-12-18", "2027-01-08", "https://www.harborauto.example/careers/",
  "Open to all engineering branches. Written test, technical interview and HR discussion.",
  tpo
).lastInsertRowid;

const insertApplication = db.prepare(
  `INSERT INTO applications (user_id, drive_id, status, notes) VALUES (?, ?, ?, ?)`
);
insertApplication.run(student, driveOne, "applied", "Submitted resume on the portal. OA prep pending.");
insertApplication.run(
  student,
  db.prepare("SELECT id FROM drives WHERE company = ?").get("Summit Bank Group").id,
  "oa", "Online assessment scheduled — focus on aptitude and SQL."
);

db.prepare(
  "INSERT INTO audit_log (actor_id, action, target) VALUES (?, 'seed_demo', 'content + accounts')"
).run(contributor);

console.log("Demo data ready.");
console.log("Accounts:");
for (const account of accounts) {
  console.log(`  ${account.role.padEnd(11)} ${account.email} / ${account.password}`);
}
