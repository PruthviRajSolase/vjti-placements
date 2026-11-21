/*
  Automated API integration tests — `npm test`.

  The real Express app is started as a child process against a throwaway
  SQLite database (DB_PATH) on an OS-assigned port (API_PORT=0). No demo
  data is ever modified. Covers auth, permissions, admin CRUD, the review
  workflow and staff controls at the HTTP level.
*/
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { buildPrepInsights } from "../server/insights.js";
import { sendMail, sendOtpEmail, _setTransporterForTest, _resetTransporterForTest } from "../server/mailer.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempDir = mkdtempSync(join(tmpdir(), "vjti-api-"));
const dbPath = join(tempDir, "placements.db");

let child;
let base;
const session = {};

function waitForServer() {
  return new Promise((resolveReady, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("API did not start within 15 seconds")),
      15000
    );
    const finish = (fn, value) => {
      clearTimeout(timer);
      fn(value);
    };
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/listening on http:\/\/localhost:(\d+)/);
      if (match) finish(resolveReady, `http://localhost:${match[1]}`);
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("exit", (code) => finish(reject, new Error(`API exited early (${code})`)));
  });
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, cookie: response.headers.get("set-cookie") };
}

async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(result.status, 200, `login ${email}: ${result.data.error}`);
  return result.cookie.split(";")[0];
}

before(async () => {
  execFileSync(process.execPath, ["server/seed-demo.js"], {
    cwd: root,
    env: { ...process.env, DB_PATH: dbPath },
    stdio: "pipe",
  });
  child = spawn(process.execPath, ["server/index.js"], {
    cwd: root,
    env: { ...process.env, DB_PATH: dbPath, API_PORT: "0", NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  base = await waitForServer();
  session.tpo = await login("tpo@vjti.ac.in", "Tpo1234!");
  session.tpoi = await login("tpoi@vjti.ac.in", "ChangeMe123!");
  session.student = await login("student@vjti.ac.in", "Student123!");
  session.contributor = await login("contributor@vjti.ac.in", "Contributor123!");
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((done) => child.once("exit", done));
  }
  rmSync(tempDir, { recursive: true, force: true });
});

describe("public API", () => {
  test("health and content load with the demo years", async () => {
    const health = await request("/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.data.service, "vjti-placements-api");

    const content = await request("/api/content");
    assert.equal(content.status, 200);
    assert.deepEqual(Object.keys(content.data.stats), ["2024", "2025", "2026"]);
    assert.equal(content.data.currentYear, "2026");
  });

  test("security headers include CSP and omit HSTS outside production", async () => {
    const res = await fetch(base + "/api/health");
    assert.ok(res.headers.get("content-security-policy"));
    assert.equal(res.headers.get("strict-transport-security"), null);
  });

  test("public experiences are approved only and carry no real identity", async () => {
    const { data } = await request("/api/content");
    assert.equal(data.experiences.length, 6);
    for (const experience of data.experiences) {
      assert.doesNotMatch(JSON.stringify(experience), /email|realName|reviewNote|@vjti/);
    }
    const pending = await request("/api/admin/experiences", { cookie: session.tpo });
    assert.equal(pending.data.counts.pending, 2);
    for (const company of ["Bluepeak Retail", "Silvergate Bank"]) {
      assert.ok(!data.experiences.some((e) => e.company === company));
    }
  });
});

describe("public experience detail", () => {
  test("cards carry stable ids and filterable fields", async () => {
    const { data } = await request("/api/content");
    assert.equal(data.experiences.length, 6);
    for (const experience of data.experiences) {
      assert.equal(typeof experience.id, "number");
      assert.ok(experience.id > 0);
      assert.ok(experience.company && experience.role && experience.heading);
      assert.match(experience.placementYear, /^\d{4}$/);
      assert.ok(Array.isArray(experience.tags));
      assert.ok(experience.excerpt.length <= 180);
    }
  });

  test("detail returns the full body with only public byline fields", async () => {
    const { data: content } = await request("/api/content");
    const summary = content.experiences[0];
    const result = await request(`/api/experiences/${summary.id}`);
    assert.equal(result.status, 200);

    const detail = result.data.experience;
    assert.equal(detail.id, summary.id);
    assert.equal(detail.heading, summary.heading);
    assert.equal(detail.company, summary.company);
    assert.deepEqual(detail.tags, summary.tags);
    assert.ok(detail.body.length > 0);
    assert.ok(detail.body.startsWith(summary.excerpt.slice(0, 100)));
    assert.deepEqual(Object.keys(detail.author).sort(), ["branch", "name", "year"]);
    assert.doesNotMatch(JSON.stringify(result.data), /@vjti|realName|reviewNote|author_email/);
  });

  test("pending, unknown and malformed ids never resolve publicly", async () => {
    const queue = await request("/api/admin/experiences", { cookie: session.tpo });
    const pending = queue.data.experiences.find((e) => e.status === "pending");
    assert.equal((await request(`/api/experiences/${pending.id}`)).status, 404);
    assert.equal((await request("/api/experiences/999999")).status, 404);
    assert.equal((await request("/api/experiences/not-a-number")).status, 404);
  });
});

describe("prep insights from approved experiences", () => {
  test("ranks common themes with actionable advice", async () => {
    const { data } = await request("/api/content");
    const insights = data.prepInsights;
    assert.ok(insights);
    assert.equal(insights.totalExperiences, 6);
    assert.ok(insights.topicCount >= 10);
    assert.ok(insights.commonCount >= 6);

    const dsa = insights.topics.find((topic) => topic.tag === "DSA");
    assert.ok(dsa);
    assert.equal(dsa.count, 4);
    assert.equal(dsa.share, 67);
    assert.equal(dsa.category, "Technical");
    assert.ok(dsa.companies.includes("Northbridge Software"));
    assert.ok(dsa.advice.length > 40);
    assert.ok(dsa.action.length > 20);
    assert.equal(dsa.actionable, true);

    const onCampus = insights.topics.find((topic) => topic.tag === "On-campus");
    assert.equal(onCampus.count, 6);
    assert.equal(onCampus.actionable, false);
    assert.ok(insights.commonTopics.some((topic) => topic.tag === "DSA"));
    assert.ok(!insights.commonTopics.some((topic) => topic.tag === "Core Mechanical"));

    assert.equal(insights.checklist.length, 5);
    assert.ok(insights.checklist.every((item) => item.action && /write-ups/.test(item.why)));
    assert.doesNotMatch(JSON.stringify(insights), /@vjti|realName|reviewNote|author_email/);
  });

  test("only cites public write-ups and never pending companies", async () => {
    const { data } = await request("/api/content");
    const publicIds = new Set(data.experiences.map((experience) => experience.id));
    for (const topic of data.prepInsights.topics) {
      for (const id of topic.experienceIds) assert.ok(publicIds.has(id));
      assert.ok(!topic.companies.some((company) => ["Bluepeak Retail", "Silvergate Bank"].includes(company)));
    }
  });

  test("normalizes tag case, whitespace, plurals and aliases to one canonical theme", () => {
    const insights = buildPrepInsights([
      { id: 1, company: "A", tags: ["dsa", " online   assessments ", "behavioural"] },
      { id: 2, company: "B", tags: ["DSA", "Online Assessment", "Behavioral"] },
    ]);
    const dsa = insights.topics.find((topic) => topic.tag === "DSA");
    const oa = insights.topics.find((topic) => topic.tag === "Online Assessment");
    const behavioral = insights.topics.find((topic) => topic.tag === "Behavioral");
    assert.equal(insights.topicCount, 3);
    assert.equal(dsa?.count, 2);
    assert.equal(oa?.count, 2);
    assert.equal(behavioral?.count, 2);
  });
});

describe("authentication", () => {
  test("session cookie is httpOnly and /auth/me reloads the user", async () => {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { email: "student@vjti.ac.in", password: "Student123!" },
    });
    assert.match(result.cookie, /HttpOnly/i);
    assert.equal(result.data.user.role, "student");

    const me = await request("/api/auth/me", { cookie: result.cookie.split(";")[0] });
    assert.equal(me.data.user.email, "student@vjti.ac.in");
  });

  test("wrong password is refused", async () => {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { email: "student@vjti.ac.in", password: "nope" },
    });
    assert.equal(result.status, 401);
  });

  test("login is rate limited after repeated attempts", async () => {
    const limitDir = mkdtempSync(join(tmpdir(), "vjti-rate-"));
    const limitDb = join(limitDir, "placements.db");
    execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root, env: { ...process.env, DB_PATH: limitDb }, stdio: "pipe",
    });
    const limitChild = spawn(process.execPath, ["server/index.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: limitDb, API_PORT: "0", AUTH_RATE_LIMIT_MAX: "2" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const limitBase = await new Promise((resolveReady, reject) => {
      let buffer = "";
      const timer = setTimeout(() => reject(new Error("rate-limit API did not start")), 15000);
      limitChild.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        const match = buffer.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolveReady(`http://localhost:${match[1]}`);
        }
      });
      limitChild.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`rate-limit API exited early (${code})`));
      });
    });
    try {
      for (let i = 0; i < 2; i += 1) {
        const res = await fetch(`${limitBase}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "student@vjti.ac.in", password: "wrong" }),
        });
        assert.equal(res.status, 401);
      }
      const limited = await fetch(`${limitBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "student@vjti.ac.in", password: "wrong" }),
      });
      assert.equal(limited.status, 429);
      const body = await limited.json();
      assert.match(body.error, /Too many attempts/);
    } finally {
      if (limitChild.exitCode === null) {
        limitChild.kill();
        await new Promise((done) => limitChild.once("exit", done));
      }
      rmSync(limitDir, { recursive: true, force: true });
    }
  });

  test("sign-up accepts college email only, always creates a student, and requires verification", async () => {
    const bad = await request("/api/auth/register", {
      method: "POST",
      body: { fullName: "Outsider", email: "x@gmail.com", password: "Password123!" },
    });
    assert.equal(bad.status, 400);

    const badBranch = await request("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Bad Branch", email: "badbranch@vjti.ac.in",
        password: "Password123!", branch: "Not A Branch",
      },
    });
    assert.equal(badBranch.status, 400);

    const created = await request("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "New Student", email: "newbie@vjti.ac.in",
        password: "Password123!", role: "tpo",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.needsVerification, true);
    assert.equal(created.data.email, "newbie@vjti.ac.in");
    assert.ok(created.data.devCode);

    const loginBefore = await request("/api/auth/login", {
      method: "POST",
      body: { email: "newbie@vjti.ac.in", password: "Password123!" },
    });
    assert.equal(loginBefore.status, 403);
    assert.equal(loginBefore.data.needsVerification, true);

    const verify = await request("/api/auth/verify-email", {
      method: "POST",
      body: { email: "newbie@vjti.ac.in", code: created.data.devCode },
    });
    assert.equal(verify.status, 200);
    assert.equal(verify.data.verified, true);

    const loginAfter = await request("/api/auth/login", {
      method: "POST",
      body: { email: "newbie@vjti.ac.in", password: "Password123!" },
    });
    assert.equal(loginAfter.status, 200);
    assert.equal(loginAfter.data.user.role, "student");

    const duplicate = await request("/api/auth/register", {
      method: "POST",
      body: { fullName: "Dup", email: "newbie@vjti.ac.in", password: "Password123!" },
    });
    assert.equal(duplicate.status, 409);

    const normalized = await request("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Alias Student", email: "aliasbranch@vjti.ac.in",
        password: "Password123!", branch: "IT",
      },
    });
    assert.equal(normalized.status, 201);
    assert.equal(normalized.data.needsVerification, true);
    const verify2 = await request("/api/auth/verify-email", {
      method: "POST",
      body: { email: "aliasbranch@vjti.ac.in", code: normalized.data.devCode },
    });
    assert.equal(verify2.status, 200);
    const login2 = await request("/api/auth/login", {
      method: "POST",
      body: { email: "aliasbranch@vjti.ac.in", password: "Password123!" },
    });
    assert.equal(login2.status, 200);
    assert.equal(login2.data.user.branch, "Information Technology");
  });
});

describe("permissions and admin content", () => {
  test("admin routes refuse anonymous and student callers", async () => {
    assert.equal((await request("/api/admin/content")).status, 401);
    assert.equal((await request("/api/admin/content", { cookie: session.student })).status, 403);
    assert.equal((await request("/api/admin/ping", { cookie: session.student })).status, 403);
  });

  test("headline Students placed is derived from branch rows when present, else falls back to stats", async () => {
    const content = await request("/api/content");
    const rows = content.data.branchStatsByYear["2026"] || [];
    const sum = rows.reduce((n, r) => n + r.placedStudents, 0);
    assert.equal(content.data.stats["2026"].studentsPlaced, sum);

    // Year without branch rows falls back to stored stats.
    const saved = await request("/api/admin/stats/2099", {
      method: "PUT", cookie: session.tpo,
      body: { studentsPlaced: 77, highest: "₹10 LPA", average: "₹5 LPA", companies: 3 },
    });
    assert.equal(saved.status, 200);
    const after = await request("/api/content");
    assert.equal(after.data.stats["2099"].studentsPlaced, 77);
  });

  test("TPO creates, edits and deletes a company", async () => {
    const created = await request("/api/admin/companies", {
      method: "POST", cookie: session.tpo,
      body: {
        year: "2026", name: "Test Corp", role: "Engineer",
        package: 9.5, hired: 4, branches: ["CS", "IT"],
      },
    });
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.ok((await request("/api/content")).data.companiesByYear["2026"]
      .some((c) => c.name === "Test Corp"));

    const edited = await request(`/api/admin/companies/${id}`, {
      method: "PUT", cookie: session.tpo,
      body: {
        year: "2026", name: "Test Corp", role: "Senior Engineer",
        package: 11, hired: 5, branches: ["CS"],
      },
    });
    assert.equal(edited.status, 200);
    assert.equal((await request("/api/content")).data.companiesBySlug["test_corp"]["2026"].role,
      "Senior Engineer");

    const deleted = await request(`/api/admin/companies/${id}`, {
      method: "DELETE", cookie: session.tpo,
    });
    assert.equal(deleted.status, 200);
    assert.ok(!(await request("/api/content")).data.companiesByYear["2026"]
      .some((c) => c.name === "Test Corp"));
  });

  test("unknown API paths return JSON 404", async () => {
    const result = await request("/api/does-not-exist");
    assert.equal(result.status, 404);
    assert.equal(result.data.error, "Not found.");
  });
});

describe("experience review workflow", () => {
  let submissionId;

  const submission = {
    company: "Workflow Labs",
    role: "Software Engineer",
    placementYear: "2026",
    heading: "Workflow Labs — Engineer",
    body: "Two coding rounds followed by a system design discussion and a short HR call about my projects.",
    tags: ["DSA", "On-campus"],
    visibility: "anonymous",
  };

  test("students cannot read or act on the review queue", async () => {
    assert.equal((await request("/api/admin/experiences", { cookie: session.student })).status, 403);
    const queue = await request("/api/admin/experiences", { cookie: session.tpo });
    const target = queue.data.experiences.find((e) => e.company === "Bluepeak Retail");
    assert.equal(target.visibility, "anonymous");
    assert.equal(target.author.realName, "Asha Patil");
    assert.ok(target.author.email);
    const attempt = await request(`/api/admin/experiences/${target.id}/review`, {
      method: "POST", cookie: session.student, body: { action: "approve" },
    });
    assert.equal(attempt.status, 403);
  });

  test("invalid submissions are rejected", async () => {
    const result = await request("/api/experiences", {
      method: "POST", cookie: session.student,
      body: { ...submission, placementYear: "26", body: "too short" },
    });
    assert.equal(result.status, 400);
  });

  test("a submission stays private until approved", async () => {
    const result = await request("/api/experiences", {
      method: "POST", cookie: session.student, body: submission,
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.status, "pending");
    submissionId = result.data.id;

    assert.ok(!(await request("/api/content")).data.experiences
      .some((e) => e.company === "Workflow Labs"));
    const mine = await request("/api/experiences/mine", { cookie: session.student });
    assert.ok(mine.data.experiences.some((e) => e.id === submissionId));
    assert.equal((await request(`/api/experiences/${submissionId}`)).status, 404);
  });

  test("students may edit only their own open submission", async () => {
    const other = await request("/api/experiences", {
      method: "POST", cookie: session.contributor,
      body: { ...submission, company: "Other Labs" },
    });
    assert.equal(other.status, 201);
    const blocked = await request(`/api/experiences/${other.data.id}`, {
      method: "PUT", cookie: session.student,
      body: { ...submission, company: "Other Labs" },
    });
    assert.equal(blocked.status, 403);

    const edited = await request(`/api/experiences/${submissionId}`, {
      method: "PUT", cookie: session.student,
      body: { ...submission, heading: "Workflow Labs — Senior Engineer" },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.status, "pending");
  });

  test("request-changes requires a note the student can read", async () => {
    const noNote = await request(`/api/admin/experiences/${submissionId}/review`, {
      method: "POST", cookie: session.tpo, body: { action: "request_changes" },
    });
    assert.equal(noNote.status, 400);

    const changed = await request(`/api/admin/experiences/${submissionId}/review`, {
      method: "POST", cookie: session.tpo,
      body: { action: "request_changes", note: "Please add a sentence about the HR round." },
    });
    assert.equal(changed.data.status, "changes_requested");
    const mine = await request("/api/experiences/mine", { cookie: session.student });
    const item = mine.data.experiences.find((e) => e.id === submissionId);
    assert.match(item.reviewNote, /HR round/);
  });

  test("resubmission resets the review, then approval publishes anonymously", async () => {
    const resubmit = await request(`/api/experiences/${submissionId}`, {
      method: "PUT", cookie: session.student,
      body: { ...submission, body: submission.body + " The HR round was short and friendly." },
    });
    assert.equal(resubmit.data.status, "pending");

    const approved = await request(`/api/admin/experiences/${submissionId}/review`, {
      method: "POST", cookie: session.tpo, body: { action: "approve" },
    });
    assert.equal(approved.data.status, "approved");

    const published = (await request("/api/content")).data.experiences
      .find((e) => e.company === "Workflow Labs");
    assert.ok(published);
    assert.equal(published.author.name, "Anonymous senior");
    assert.doesNotMatch(JSON.stringify(published), /email|realName|reviewNote/);

    const detail = await request(`/api/experiences/${published.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.experience.author.name, "Anonymous senior");
    assert.ok(detail.data.experience.body.includes("HR round"));
    assert.doesNotMatch(JSON.stringify(detail.data), /@vjti|realName|reviewNote/);

    const again = await request(`/api/admin/experiences/${submissionId}/review`, {
      method: "POST", cookie: session.tpo, body: { action: "approve" },
    });
    assert.equal(again.status, 409);
    const lateEdit = await request(`/api/experiences/${submissionId}`, {
      method: "PUT", cookie: session.student, body: submission,
    });
    assert.equal(lateEdit.status, 409);
  });

  test("rejection keeps the note but stays off the public site", async () => {
    const queue = await request("/api/admin/experiences", { cookie: session.tpo });
    const target = queue.data.experiences.find((e) => e.company === "Silvergate Bank");
    const rejected = await request(`/api/admin/experiences/${target.id}/review`, {
      method: "POST", cookie: session.tpo,
      body: { action: "reject", note: "Include the exact role title next time." },
    });
    assert.equal(rejected.data.status, "rejected");
    const row = (await request("/api/admin/experiences", { cookie: session.tpo }))
      .data.experiences.find((e) => e.id === target.id);
    assert.match(row.reviewNote, /role title/);
    assert.ok(row.reviewedBy);
    assert.ok(!(await request("/api/content")).data.experiences
      .some((e) => e.company === "Silvergate Bank"));
  });
});

describe("staff controls and audit", () => {
  test("students cannot list users or read the audit log", async () => {
    assert.equal((await request("/api/admin/users", { cookie: session.student })).status, 403);
    assert.equal((await request("/api/admin/audit", { cookie: session.student })).status, 403);
    assert.equal((await request("/api/admin/users")).status, 401);
  });

  test("TPO can grant contributor but cannot manage staff or read audit", async () => {
    const users = await request("/api/admin/users", { cookie: session.tpo });
    assert.equal(users.status, 200);
    assert.doesNotMatch(JSON.stringify(users.data.users), /password_hash/);
    const studentRow = users.data.users.find((u) => u.email === "newbie@vjti.ac.in");

    const promoted = await request(`/api/admin/users/${studentRow.id}/role`, {
      method: "PUT", cookie: session.tpo, body: { role: "contributor" },
    });
    assert.equal(promoted.data.user.role, "contributor");

    assert.equal((await request("/api/admin/audit", { cookie: session.tpo })).status, 403);
    assert.equal((await request("/api/admin/users", {
      method: "POST", cookie: session.tpo,
      body: { fullName: "Nope", email: "nope@vjti.ac.in", password: "Password123!", role: "tpo" },
    })).status, 403);
    assert.equal((await request(`/api/admin/users/${studentRow.id}/role`, {
      method: "PUT", cookie: session.tpo, body: { role: "tpo" },
    })).status, 403);
  });

  test("TPOI creates staff; demotion revokes access on the next request", async () => {
    const created = await request("/api/admin/users", {
      method: "POST", cookie: session.tpoi,
      body: {
        fullName: "Test Staff", email: "stafftest@vjti.ac.in",
        password: "Staff123!", role: "tpo",
      },
    });
    assert.equal(created.status, 201);
    const id = created.data.user.id;
    const staffCookie = await login("stafftest@vjti.ac.in", "Staff123!");
    assert.equal((await request("/api/admin/content", { cookie: staffCookie })).status, 200);
    assert.equal((await request("/api/admin/audit", { cookie: staffCookie })).status, 403);

    const demoted = await request(`/api/admin/users/${id}/role`, {
      method: "PUT", cookie: session.tpoi, body: { role: "student" },
    });
    assert.equal(demoted.data.user.role, "student");
    assert.equal((await request("/api/admin/content", { cookie: staffCookie })).status, 403);
  });

  test("role-change and staff-creation safety rails hold", async () => {
    const users = (await request("/api/admin/users", { cookie: session.tpoi })).data.users;
    const self = users.find((u) => u.email === "tpoi@vjti.ac.in");
    assert.equal((await request(`/api/admin/users/${self.id}/role`, {
      method: "PUT", cookie: session.tpoi, body: { role: "tpo" },
    })).status, 403);
    assert.equal((await request("/api/admin/users", {
      method: "POST", cookie: session.tpoi,
      body: { fullName: "X", email: "x@gmail.com", password: "Password123!", role: "tpo" },
    })).status, 400);
    assert.equal((await request("/api/admin/users", {
      method: "POST", cookie: session.tpoi,
      body: { fullName: "Dup", email: "tpo@vjti.ac.in", password: "Password123!", role: "tpo" },
    })).status, 409);
  });

  test("audit log records actors and from -> to role targets", async () => {
    const { data } = await request("/api/admin/audit", { cookie: session.tpoi });
    assert.ok(data.entries.length > 0);
    const create = data.entries.find((e) => e.action === "create_staff");
    assert.equal(create.actor.name, "TPO In-Charge");
    assert.ok(data.entries.some((e) =>
      e.action === "change_role" && e.target.includes("student -> contributor")));
  });
});

describe("saved companies and account settings", () => {
  test("anonymous callers cannot read or write bookmarks or profile", async () => {
    assert.equal((await request("/api/bookmarks")).status, 401);
    assert.equal((await request("/api/bookmarks", {
      method: "POST", body: { slug: "northbridge_software" },
    })).status, 401);
    assert.equal((await request("/api/bookmarks/northbridge_software", { method: "DELETE" })).status, 401);
    assert.equal((await request("/api/me", {
      method: "PUT", body: { fullName: "Anyone" },
    })).status, 401);
    assert.equal((await request("/api/me/password", {
      method: "POST", body: { currentPassword: "x", newPassword: "Password123!" },
    })).status, 401);
  });

  test("seeded bookmarks are private to their owner", async () => {
    const mine = await request("/api/bookmarks", { cookie: session.student });
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.data.bookmarks.map((b) => b.slug).sort(),
      ["northbridge_software", "summit_bank_group"]);
    assert.ok(mine.data.bookmarks.every((b) => b.name && b.createdAt));
    const other = await request("/api/bookmarks", { cookie: session.contributor });
    assert.equal(other.data.bookmarks.length, 0);
  });

  test("bookmarks validate the company, are idempotent and scope deletes", async () => {
    const missing = await request("/api/bookmarks", {
      method: "POST", cookie: session.student, body: { slug: "not_a_company" },
    });
    assert.equal(missing.status, 404);

    for (let i = 0; i < 2; i += 1) {
      const added = await request("/api/bookmarks", {
        method: "POST", cookie: session.student, body: { slug: "hexanet_systems" },
      });
      assert.equal(added.status, 201);
    }
    assert.equal((await request("/api/bookmarks", { cookie: session.student }))
      .data.bookmarks.length, 3);
    assert.equal((await request("/api/bookmarks", { cookie: session.contributor }))
      .data.bookmarks.length, 0);

    // A contributor cannot delete the student's bookmark by guessing its slug.
    await request("/api/bookmarks/hexanet_systems", {
      method: "DELETE", cookie: session.contributor,
    });
    assert.ok((await request("/api/bookmarks", { cookie: session.student }))
      .data.bookmarks.some((b) => b.slug === "hexanet_systems"));

    assert.equal((await request("/api/bookmarks/hexanet_systems", {
      method: "DELETE", cookie: session.student,
    })).status, 200);
    assert.equal((await request("/api/bookmarks", { cookie: session.student }))
      .data.bookmarks.length, 2);
  });

  test("profile edits update display fields but never role or email", async () => {
    const badYear = await request("/api/me", {
      method: "PUT", cookie: session.student,
      body: { fullName: "Asha Patil", graduationYear: "27" },
    });
    assert.equal(badYear.status, 400);
    const emptyName = await request("/api/me", {
      method: "PUT", cookie: session.student, body: { fullName: "" },
    });
    assert.equal(emptyName.status, 400);
    const badBranch = await request("/api/me", {
      method: "PUT", cookie: session.student,
      body: { fullName: "Asha Patil", branch: "Not A Branch" },
    });
    assert.equal(badBranch.status, 400);

    const saved = await request("/api/me", {
      method: "PUT", cookie: session.student,
      body: {
        fullName: "Asha Patil (Final year)", branch: "CS",
        graduationYear: "2027", role: "tpo", email: "hacker@gmail.com",
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.user.fullName, "Asha Patil (Final year)");
    assert.equal(saved.data.user.role, "student");
    assert.equal(saved.data.user.email, "student@vjti.ac.in");

    const me = await request("/api/auth/me", { cookie: session.student });
    assert.equal(me.data.user.branch, "Computer Engineering");
    assert.equal(me.data.user.graduationYear, "2027");
    assert.doesNotMatch(JSON.stringify(me.data.user), /password_hash/);
  });

  test("password change checks the current password and new-password length", async () => {
    const wrong = await request("/api/me/password", {
      method: "POST", cookie: session.student,
      body: { currentPassword: "nope", newPassword: "NewPass123!" },
    });
    assert.equal(wrong.status, 401);
    const short = await request("/api/me/password", {
      method: "POST", cookie: session.student,
      body: { currentPassword: "Student123!", newPassword: "short" },
    });
    assert.equal(short.status, 400);

    const changed = await request("/api/me/password", {
      method: "POST", cookie: session.student,
      body: { currentPassword: "Student123!", newPassword: "NewPass123!" },
    });
    assert.equal(changed.status, 200);
    const refreshedCookie = changed.cookie.split(";")[0];
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: "student@vjti.ac.in", password: "Student123!" },
    })).status, 401);
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: "student@vjti.ac.in", password: "NewPass123!" },
    })).status, 200);
    // The old token is revoked; the password change reissues a cookie for this session.
    assert.equal((await request("/api/bookmarks", { cookie: session.student })).status, 401);
    assert.equal((await request("/api/bookmarks", { cookie: refreshedCookie })).status, 200);
    session.student = refreshedCookie;
  });

  test("profile and password changes are recorded in the audit log", async () => {
    const { data } = await request("/api/admin/audit", { cookie: session.tpoi });
    assert.ok(data.entries.some((e) => e.action === "update_profile"
      && e.actor.email === "student@vjti.ac.in"));
    assert.ok(data.entries.some((e) => e.action === "change_password"
      && e.actor.email === "student@vjti.ac.in"));
  });
});

describe("in-app notifications", () => {
  test("notification lists require a session and are scoped to their owner", async () => {
    assert.equal((await request("/api/notifications")).status, 401);

    const student = await request("/api/notifications", { cookie: session.student });
    const staff = await request("/api/notifications", { cookie: session.tpo });
    assert.equal(student.status, 200);
    assert.ok(student.data.notifications.length > 0);
    assert.ok(student.data.unreadCount >= 1);
    assert.ok(student.data.notifications.some((n) => n.title === "Your experience was approved"));
    assert.ok(!student.data.notifications.some((n) => n.title === "New experience to review"));
    assert.ok(staff.data.notifications.some((n) => n.title === "New experience to review"));
    assert.ok(!staff.data.notifications.some((n) => n.title === "Your experience was approved"));
  });

  test("a submission and its review notify both staff and the author", async () => {
    const body = {
      company: "Notify Labs",
      role: "Engineer",
      placementYear: "2026",
      heading: "Notify Labs — Engineer",
      body: "One online assessment and two technical interviews covering data structures and projects.",
      tags: ["On-campus"],
      visibility: "named",
    };
    const created = await request("/api/experiences", {
      method: "POST", cookie: session.contributor, body,
    });
    assert.equal(created.status, 201);
    const id = created.data.id;

    const staff = (await request("/api/notifications", { cookie: session.tpo })).data;
    assert.ok(staff.notifications.some((n) => n.type === "submission"
      && n.body.includes("Notify Labs") && n.link === "/admin/reviews"));

    const changed = await request(`/api/admin/experiences/${id}/review`, {
      method: "POST", cookie: session.tpo,
      body: { action: "request_changes", note: "Please add the round timings." },
    });
    assert.equal(changed.status, 200);
    const author = (await request("/api/notifications", { cookie: session.contributor })).data;
    assert.ok(author.notifications.some((n) => n.type === "review"
      && n.body === "Please add the round timings."
      && n.link === "/my-experiences"));

    const resubmitted = await request(`/api/experiences/${id}`, {
      method: "PUT", cookie: session.contributor, body,
    });
    assert.equal(resubmitted.status, 200);
    const afterResubmit = (await request("/api/notifications", { cookie: session.tpoi })).data;
    assert.ok(afterResubmit.notifications.some((n) => n.title === "Experience resubmitted"
      && n.body.includes("Notify Labs")));

    const approved = await request(`/api/admin/experiences/${id}/review`, {
      method: "POST", cookie: session.tpo, body: { action: "approve" },
    });
    assert.equal(approved.status, 200);
    const afterApprove = (await request("/api/notifications", { cookie: session.contributor })).data;
    assert.ok(afterApprove.notifications.some((n) => n.title === "Your experience was approved"
      && n.link === `/experience/${id}`));
  });

  test("marking one or all notifications read cannot touch another user's rows", async () => {
    const studentRows = (await request("/api/notifications", { cookie: session.student })).data;
    const target = studentRows.notifications.find((n) => !n.readAt);
    assert.ok(target, "expected an unread student notification");

    // A contributor cannot mark the student's notification by guessing its id.
    const denied = await request(`/api/notifications/${target.id}/read`, {
      method: "POST", cookie: session.contributor,
    });
    assert.equal(denied.status, 404);
    assert.equal((await request("/api/notifications", { cookie: session.student })).data
      .notifications.find((n) => n.id === target.id).readAt, null);

    const marked = await request(`/api/notifications/${target.id}/read`, {
      method: "POST", cookie: session.student,
    });
    assert.equal(marked.status, 200);
    const studentAfter = (await request("/api/notifications", { cookie: session.student })).data;
    assert.ok(studentAfter.notifications.find((n) => n.id === target.id).readAt);
    assert.equal(studentAfter.unreadCount, studentRows.unreadCount - 1);

    assert.equal((await request("/api/notifications/read-all", {
      method: "POST", cookie: session.contributor,
    })).status, 200);
    const contributorAfter = (await request("/api/notifications", { cookie: session.contributor })).data;
    assert.equal(contributorAfter.unreadCount, 0);
    assert.ok(contributorAfter.notifications.every((n) => n.readAt));
    // Clearing one inbox did not mark staff rows as read.
    assert.ok((await request("/api/notifications", { cookie: session.tpo })).data.unreadCount > 0);
  });
});

describe("staff CSV import", () => {
  const csv = [
    "name,role,package,hired,branches",
    '"Import Corp, Inc.",Engineer,7.25,6,"CS,IT"',
    "Second Corp,Analyst,5.5,3,Mech",
  ].join("\n");

  test("import requires a staff session", async () => {
    assert.equal((await request("/api/admin/companies/import", {
      method: "POST", body: { year: "2025", csv },
    })).status, 401);
    assert.equal((await request("/api/admin/companies/import", {
      method: "POST", cookie: session.student, body: { year: "2025", csv },
    })).status, 403);
  });

  test("validation errors report details and write nothing", async () => {
    const noHeader = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo,
      body: { year: "2025", csv: "name,role\nOnly,Two" },
    });
    assert.equal(noHeader.status, 400);
    assert.ok(noHeader.data.details.some((d) => d.includes("name,role,package,hired,branches")));

    const badRow = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo,
      body: { year: "2025", csv: "name,role,package,hired,branches\nBad Corp,Eng,not-a-number,3,CS" },
    });
    assert.equal(badRow.status, 400);
    assert.ok(badRow.data.details.some((d) => d.includes("Line 2")));

    const blankNumbers = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo,
      body: { year: "2025", csv: "name,role,package,hired,branches\nBlank Corp,Eng,," },
    });
    assert.equal(blankNumbers.status, 400);
    assert.ok(blankNumbers.data.details.some((d) => d.includes("Line 2")));
    assert.ok(!(await request("/api/content")).data.companiesByYear["2025"]
      .some((c) => c.name === "Bad Corp" || c.name === "Blank Corp"));

    const duplicate = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo,
      body: {
        year: "2025",
        csv: "name,role,package,hired,branches\nDup Corp,Eng,5,1,CS\ndup_corp,Eng,6,2,IT",
      },
    });
    assert.equal(duplicate.status, 400);
    assert.ok(duplicate.data.details.some((d) => d.includes("Duplicate")));
  });

  test("a valid CSV imports quoted branches and upserts by name", async () => {
    const first = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo, body: { year: "2025", csv },
    });
    assert.equal(first.status, 200);
    assert.deepEqual(
      [first.data.created, first.data.updated, first.data.imported], [2, 0, 2]
    );

    let rows = (await request("/api/content")).data.companiesByYear["2025"];
    const imported = rows.find((c) => c.name === "Import Corp, Inc.");
    assert.equal(imported.role, "Engineer");
    assert.equal(imported.package, 7.25);
    assert.deepEqual(imported.branches, ["CS", "IT"]);

    const changed = csv
      .replace('"Import Corp, Inc.",Engineer,7.25', '"Import Corp, Inc.",Engineer,9.75')
      .replace("Second Corp,Analyst,5.5,3,Mech", "Second Corp,Analyst,6,4,Mech");
    const second = await request("/api/admin/companies/import", {
      method: "POST", cookie: session.tpo, body: { year: "2025", csv: changed },
    });
    assert.equal(second.status, 200);
    assert.deepEqual(
      [second.data.created, second.data.updated, second.data.imported], [0, 2, 2]
    );

    rows = (await request("/api/content")).data.companiesByYear["2025"];
    assert.equal(rows.filter((c) => c.name === "Import Corp, Inc.").length, 1);
    assert.equal(rows.find((c) => c.name === "Import Corp, Inc.").package, 9.75);
  });

  test("import is recorded in the audit log by the acting staff member", async () => {
    const { data } = await request("/api/admin/audit", { cookie: session.tpoi });
    assert.ok(data.entries.some((e) => e.action === "import_companies"
      && e.target.startsWith("2025:") && e.actor.email === "tpo@vjti.ac.in"));
  });
});

describe("alumni outreach", () => {
  const csv = [
    "full_name,email,branch,graduation_year,placed_company,placed_role,placed_year,current_company",
    "Alumni One,alumni.one@example.com,Computer Engineering,2022,Northbridge Software,SDE,2022,Northbridge Software",
    "Alumni Two,alumni.two@example.com,Information Technology,2021,Peregrine Systems,SWE,2021,Peregrine Systems",
  ].join("\n");

  test("alumni outreach requires a staff session", async () => {
    assert.equal((await request("/api/admin/alumni")).status, 401);
    assert.equal((await request("/api/admin/alumni", { cookie: session.student })).status, 403);
    assert.equal((await request("/api/admin/alumni/import", {
      method: "POST", body: { csv },
    })).status, 401);
    assert.equal((await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.student, body: { csv },
    })).status, 403);
    assert.equal((await request("/api/admin/alumni/1", {
      method: "PUT", body: { outreachStatus: "contacted" },
    })).status, 401);
    assert.equal((await request("/api/admin/alumni/1", {
      method: "PUT", cookie: session.student, body: { outreachStatus: "contacted" },
    })).status, 403);
    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", body: { ids: [1], outreachStatus: "contacted" },
    })).status, 401);
    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.student, body: { ids: [1], outreachStatus: "contacted" },
    })).status, 403);
  });

  test("alumni CSV import validates rows and upserts by email while preserving outreach state", async () => {
    const missingHeader = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo, body: { csv: "email,company\nx@example.com,X" },
    });
    assert.equal(missingHeader.status, 400);
    assert.ok(missingHeader.data.details.some((d) => d.includes("full_name")));

    const badRow = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo,
      body: { csv: "full_name,email\n,not-an-email" },
    });
    assert.equal(badRow.status, 400);
    assert.ok(badRow.data.details.some((d) => d.includes("Line 2")));
    assert.equal((await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni
      .some((a) => a.email === "not-an-email"), false);

    const first = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo, body: { csv },
    });
    assert.equal(first.status, 200);
    assert.deepEqual([first.data.created, first.data.updated, first.data.imported], [2, 0, 2]);

    let list = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    let one = list.find((a) => a.email === "alumni.one@example.com");
    assert.ok(one);
    assert.equal(one.placedCompany, "Northbridge Software");
    assert.equal(one.outreachStatus, "not_contacted");

    const updatedOne = await request(`/api/admin/alumni/${one.id}`, {
      method: "PUT", cookie: session.tpo,
      body: {
        outreachStatus: "interested",
        outreachType: "placement",
        followUpAt: "2026-12-01 10:00:00",
        responseNote: "Wants to help.",
        referralCompany: "Northbridge Software",
        referralContact: "HR Team",
        referralDetails: "Intro offered",
        currentCompany: "Northbridge Software",
        lastContactedAt: "2026-11-20 09:00:00",
      },
    });
    assert.equal(updatedOne.status, 200);

    const changedCsv = csv
      .replace("Alumni One,alumni.one@example.com,Computer Engineering,2022,Northbridge Software,SDE,2022,Northbridge Software",
        "Alumni One,alumni.one@example.com,Computer Engineering,2022,Northbridge Software,SDE,2022,Northbridge Software India")
      .replace("Alumni Two,alumni.two@example.com,Information Technology,2021,Peregrine Systems,SWE,2021,Peregrine Systems",
        "Alumni Two Updated,alumni.two@example.com,Information Technology,2021,Peregrine Systems,SWE,2021,Alphabet");
    const second = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo, body: { csv: changedCsv },
    });
    assert.equal(second.status, 200);
    assert.deepEqual([second.data.created, second.data.updated, second.data.imported], [0, 2, 2]);

    list = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    one = list.find((a) => a.email === "alumni.one@example.com");
    const two = list.find((a) => a.email === "alumni.two@example.com");
    assert.equal(one.currentCompany, "Northbridge Software India");
    assert.equal(one.outreachStatus, "interested");
    assert.equal(one.responseNote, "Wants to help.");
    assert.equal(one.referralCompany, "Northbridge Software");
    assert.equal(two.fullName, "Alumni Two Updated");
    assert.equal(two.currentCompany, "Alphabet");
  });

  test("staff can bulk update outreach and audit actions are recorded", async () => {
    const list = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    const one = list.find((a) => a.email === "alumni.one@example.com");
    const two = list.find((a) => a.email === "alumni.two@example.com");
    assert.ok(one && two);

    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: [] },
    })).status, 400);
    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: [one.id, two.id] },
    })).status, 400);

    const applied = await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo,
      body: { ids: [one.id, two.id], outreachStatus: "responded", outreachType: "internship", followUpAt: "2026-12-10 11:00:00" },
    });
    assert.equal(applied.status, 200);
    assert.equal(applied.data.updated, 2);

    let after = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    assert.equal(after.find((a) => a.id === one.id).outreachStatus, "responded");
    assert.equal(after.find((a) => a.id === one.id).outreachType, "internship");
    assert.equal(after.find((a) => a.id === two.id).outreachType, "internship");
    assert.equal(after.find((a) => a.id === two.id).followUpAt, "2026-12-10 11:00:00");

    // Reset one contact to not_contacted so mark-contacted promotion is observable.
    assert.equal((await request(`/api/admin/alumni/${one.id}`, {
      method: "PUT", cookie: session.tpo,
      body: { outreachStatus: "not_contacted", outreachType: "", lastContactedAt: null, followUpAt: null,
        responseNote: null, referralCompany: null, referralContact: null, referralDetails: null, currentCompany: one.currentCompany },
    })).status, 200);

    const marked = await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo,
      body: { ids: [one.id, two.id], markContacted: true, outreachType: "placement" },
    });
    assert.equal(marked.status, 200);
    after = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    const afterOne = after.find((a) => a.id === one.id);
    const afterTwo = after.find((a) => a.id === two.id);
    assert.equal(afterOne.outreachStatus, "contacted");
    assert.ok(afterOne.lastContactedAt);
    assert.equal(afterOne.outreachType, "placement");
    assert.equal(afterTwo.outreachStatus, "responded"); // not promoted when already beyond not_contacted
    assert.ok(afterTwo.lastContactedAt);

    assert.equal((await request("/api/admin/alumni/999999", {
      method: "PUT", cookie: session.tpo, body: { outreachStatus: "contacted" },
    })).status, 404);

    const audit = await request("/api/admin/audit", { cookie: session.tpoi });
    assert.ok(audit.data.entries.some((e) => e.action === "import_alumni" && e.actor.email === "tpo@vjti.ac.in"));
    assert.ok(audit.data.entries.some((e) => e.action === "update_alumni_outreach" && e.target.includes("alumni.one@example.com")));
    assert.ok(audit.data.entries.some((e) => e.action === "bulk_alumni_outreach" && e.actor.email === "tpo@vjti.ac.in"));
  });

  test("alumni CSV import rejects duplicates and oversized input, and normalizes emails", async () => {
    const oversized = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo, body: { csv: "x".repeat(100_001) },
    });
    assert.equal(oversized.status, 400);
    assert.match(oversized.data.error, /too large/);

    const headerOnly = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo, body: { csv: "full_name,email" },
    });
    assert.equal(headerOnly.status, 400);
    assert.match(headerOnly.data.error, /header row/);

    const duplicates = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo,
      body: { csv: [
        "full_name,email",
        "Twin One,dup.alumni@example.com",
        "Twin Two,DUP.ALUMNI@EXAMPLE.COM",
      ].join("\n") },
    });
    assert.equal(duplicates.status, 400);
    assert.ok(duplicates.data.details.some((d) => d.includes("duplicate email")));
    assert.equal((await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni
      .some((a) => a.email === "dup.alumni@example.com"), false);

    const alias = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo,
      body: { csv: "name,email\nAlias Alumni,Alias.Mixed@Example.com" },
    });
    assert.equal(alias.status, 200);
    assert.deepEqual([alias.data.created, alias.data.updated], [1, 0]);

    let list = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    let contact = list.find((a) => a.email === "alias.mixed@example.com");
    assert.ok(contact);
    assert.equal(contact.fullName, "Alias Alumni");

    const upsert = await request("/api/admin/alumni/import", {
      method: "POST", cookie: session.tpo,
      body: { csv: "full_name,email\nAlias Renamed,alias.mixed@example.com" },
    });
    assert.equal(upsert.status, 200);
    assert.deepEqual([upsert.data.created, upsert.data.updated], [0, 1]);
    list = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni;
    contact = list.find((a) => a.email === "alias.mixed@example.com");
    assert.equal(contact.fullName, "Alias Renamed");
  });

  test("bulk outreach validates input and skips ids that do not exist", async () => {
    const auditCount = async () => (await request("/api/admin/audit", { cookie: session.tpoi }))
      .data.entries.filter((e) => e.action === "bulk_alumni_outreach").length;
    const before = await auditCount();

    const contact = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni
      .find((a) => a.email === "alias.mixed@example.com");
    assert.ok(contact);

    const badStatus = await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: [contact.id], outreachStatus: "bogus" },
    });
    assert.equal(badStatus.status, 400);
    assert.match(badStatus.data.error, /Unknown outreach status/);

    const badType = await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: [contact.id], outreachType: "bogus" },
    });
    assert.equal(badType.status, 400);
    assert.match(badType.data.error, /Unknown outreach type/);

    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: Array.from({ length: 501 }, (_, i) => i + 1), outreachStatus: "contacted" },
    })).status, 400);
    assert.equal((await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo, body: { ids: [contact.id] },
    })).status, 400);
    assert.equal(await auditCount(), before);

    const mixed = await request("/api/admin/alumni/bulk", {
      method: "PUT", cookie: session.tpo,
      body: { ids: ["abc", 0, -1, contact.id, 999999], outreachStatus: "contacted" },
    });
    assert.equal(mixed.status, 200);
    assert.equal(mixed.data.updated, 1);
    const after = (await request("/api/admin/alumni", { cookie: session.tpo })).data.alumni
      .find((a) => a.id === contact.id);
    assert.equal(after.outreachStatus, "contacted");
    assert.equal(await auditCount(), before + 1);
  });

  test("the in-charge can manage alumni outreach too", async () => {
    const list = await request("/api/admin/alumni", { cookie: session.tpoi });
    assert.equal(list.status, 200);
    assert.ok(list.data.alumni.length > 0);

    const contact = list.data.alumni.find((a) => a.email === "alias.mixed@example.com");
    const updated = await request(`/api/admin/alumni/${contact.id}`, {
      method: "PUT", cookie: session.tpoi, body: { outreachStatus: "contacted", responseNote: "TPOI reviewed the lead." },
    });
    assert.equal(updated.status, 200);
    const after = (await request("/api/admin/alumni", { cookie: session.tpoi })).data.alumni
      .find((a) => a.id === contact.id);
    assert.equal(after.responseNote, "TPOI reviewed the lead.");
  });
});

describe("drives and applications", () => {
  test("public drives load and staff drive routes are gated", async () => {
    const list = await request("/api/drives");
    assert.equal(list.status, 200);
    assert.ok(list.data.drives.length >= 3);
    const northbridge = list.data.drives.find((drive) => drive.company === "Northbridge Software");
    assert.ok(northbridge);
    assert.equal(northbridge.registrationDeadline, "2026-12-05");
    assert.deepEqual(northbridge.eligibilityBranches, ["Computer Engineering", "Information Technology"]);

    assert.equal((await request("/api/admin/drives")).status, 401);
    assert.equal((await request("/api/admin/drives", { cookie: session.student })).status, 403);
    assert.equal((await request("/api/admin/drives", { method: "POST", body: {} })).status, 401);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.student, body: {},
    })).status, 403);
  });

  test("TPO publishes, edits and removes drives with validation, audit and targeted alerts", async () => {
    const countFor = async (cookie) => (await request("/api/notifications", { cookie })).data.notifications.length;
    const studentBefore = await countFor(session.student);
    const contributorBefore = await countFor(session.contributor);

    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo, body: { role: "Engineer" },
    })).status, 400);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: { company: "Bad Date", role: "Engineer", registrationDeadline: "12/05/2026" },
    })).status, 400);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: { company: "Bad Status", role: "Engineer", status: "draft" },
    })).status, 400);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: { company: "Bad Link", role: "Engineer", applyLink: "javascript:alert(1)" },
    })).status, 400);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: { company: "Bad Link", role: "Engineer", applyLink: "ftp://example.com/job" },
    })).status, 400);
    assert.equal((await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: { company: "Bad Branch", role: "Engineer", eligibilityBranches: ["Not A Branch"] },
    })).status, 400);

    const created = await request("/api/admin/drives", {
      method: "POST", cookie: session.tpo,
      body: {
        company: "Test Drive Corp", role: "Graduate Engineer", package: 8.5,
        eligibilityBranches: ["Computer Engineering"], graduationYears: ["2027"],
        registrationDeadline: "2026-12-20", driveDate: "2026-12-28",
        applyLink: "https://example.com/apply", description: "Demo drive.", status: "open",
      },
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.data.drive.eligibilityBranches, ["Computer Engineering"]);
    assert.deepEqual(created.data.drive.graduationYears, ["2027"]);
    assert.equal(created.data.drive.applicantCount, 0);

    // The student is CS/2027 after the profile test; the contributor is CS/2026.
    assert.equal(await countFor(session.student), studentBefore + 1);
    assert.equal(await countFor(session.contributor), contributorBefore);

    const adminList = await request("/api/admin/drives", { cookie: session.tpo });
    const row = adminList.data.drives.find((drive) => drive.company === "Test Drive Corp");
    assert.ok(row);

    const edited = await request(`/api/admin/drives/${row.id}`, {
      method: "PUT", cookie: session.tpo,
      body: { ...created.data.drive, status: "closed", package: 9 },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.drive.status, "closed");
    const publicList = await request("/api/drives");
    assert.equal(publicList.data.drives.find((drive) => drive.id === row.id).status, "closed");

    assert.equal((await request(`/api/admin/drives/${row.id}`, {
      method: "POST", cookie: session.tpo, body: {},
    })).status, 404);
    assert.equal((await request("/api/admin/drives/999999", {
      method: "PUT", cookie: session.tpo, body: { company: "X", role: "Y" },
    })).status, 404);

    assert.equal((await request(`/api/admin/drives/${row.id}`, {
      method: "DELETE", cookie: session.tpo,
    })).status, 200);
    assert.equal((await request(`/api/admin/drives/${row.id}`, {
      method: "DELETE", cookie: session.tpo,
    })).status, 404);

    const audit = await request("/api/admin/audit", { cookie: session.tpoi });
    for (const action of ["create_drive", "update_drive", "delete_drive"]) {
      assert.ok(audit.data.entries.some((e) => e.action === action && e.actor.email === "tpo@vjti.ac.in"));
    }
  });

  test("applications are private, scoped and validated", async () => {
    assert.equal((await request("/api/applications")).status, 401);

    const mine = await request("/api/applications", { cookie: session.student });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.applications.length, 2);
    assert.equal((await request("/api/applications", { cookie: session.contributor })).data.applications.length, 0);

    const drives = (await request("/api/drives")).data.drives;
    const northbridge = drives.find((drive) => drive.company === "Northbridge Software");
    const harbor = drives.find((drive) => drive.company === "Harbor Automotive");
    assert.ok(northbridge && harbor);

    assert.equal((await request("/api/applications", {
      method: "POST", cookie: session.student, body: { driveId: northbridge.id },
    })).status, 409);
    assert.equal((await request("/api/applications", {
      method: "POST", cookie: session.student, body: { driveId: 999999 },
    })).status, 404);
    assert.equal((await request("/api/applications", {
      method: "POST", cookie: session.student, body: {},
    })).status, 400);
    assert.equal((await request("/api/applications", {
      method: "POST", cookie: session.student, body: { driveId: harbor.id, status: "bogus" },
    })).status, 400);

    const contributed = await request("/api/applications", {
      method: "POST", cookie: session.contributor, body: { driveId: harbor.id, notes: "Interested in Pune." },
    });
    assert.equal(contributed.status, 201);
    const foreignId = contributed.data.application.id;
    assert.equal((await request(`/api/applications/${foreignId}`, {
      method: "PUT", cookie: session.student, body: { status: "offer" },
    })).status, 404);
    assert.equal((await request(`/api/applications/${foreignId}`, {
      method: "DELETE", cookie: session.student,
    })).status, 404);

    const ownId = mine.data.applications.find((item) => item.company === "Northbridge Software").id;
    const updated = await request(`/api/applications/${ownId}`, {
      method: "PUT", cookie: session.student,
      body: { status: "interview", notes: "Technical round on Friday." },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.application.status, "interview");
    const after = await request("/api/applications", { cookie: session.student });
    assert.equal(after.data.applications.find((item) => item.id === ownId).notes, "Technical round on Friday.");

    assert.equal((await request(`/api/applications/${ownId}`, {
      method: "DELETE", cookie: session.student,
    })).status, 200);
    assert.equal((await request(`/api/applications/${ownId}`, {
      method: "DELETE", cookie: session.student,
    })).status, 404);

    const audit = await request("/api/admin/audit", { cookie: session.tpoi });
    for (const action of ["create_application", "update_application", "delete_application"]) {
      assert.ok(audit.data.entries.some((e) => e.action === action));
    }
  });
});

describe("production startup checks", () => {
  test("reports JWT_SECRET issues in startup checklist", () => {
    const dir = mkdtempSync(join(tmpdir(), "vjti-startup-"));
    const env = { ...process.env, NODE_ENV: "production", APP_MODE: "demo", DB_PATH: join(dir, "placements.db"), API_PORT: "0" };
    delete env.JWT_SECRET;
    assert.throws(() => execFileSync(process.execPath, ["server/index.js"], { cwd: root, env, stdio: "pipe" }), (err) => {
      const out = String(err.stderr || err.stdout || "");
      assert.match(out, /Startup check failed/);
      assert.match(out, /JWT_SECRET/);
      return true;
    });

    env.JWT_SECRET = "short-secret";
    assert.throws(() => execFileSync(process.execPath, ["server/index.js"], { cwd: root, env, stdio: "pipe" }), (err) => {
      const out = String(err.stderr || err.stdout || "");
      assert.match(out, /JWT_SECRET/);
      return true;
    });

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("production seed guards", () => {
  test("seed refuses default or missing TPOI password in production", () => {
    const seedDb = join(tempDir, "seed-prod.db");
    const baseEnv = { ...process.env, NODE_ENV: "production", DB_PATH: seedDb };
    delete baseEnv.TPOI_PASSWORD;

    assert.throws(() => execFileSync(process.execPath, ["server/seed.js"], {
      cwd: root, env: baseEnv, stdio: "pipe",
    }));
    assert.throws(() => execFileSync(process.execPath, ["server/seed.js"], {
      cwd: root, env: { ...baseEnv, TPOI_PASSWORD: "ChangeMe123!" }, stdio: "pipe",
    }));
  });

  test("seed-demo refuses to run in production", () => {
    assert.throws(() => execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root, env: { ...process.env, NODE_ENV: "production", DB_PATH: join(tempDir, "demo-prod.db") }, stdio: "pipe",
    }));
  });

  test("seed-demo performs a true reset and uses 8+ char passwords", () => {
    const dir = mkdtempSync(join(tmpdir(), "vjti-seed-reset-"));
    const resetDbPath = join(dir, "placements.db");
    execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root, env: { ...process.env, DB_PATH: resetDbPath }, stdio: "pipe",
    });

    const db = new DatabaseSync(resetDbPath);
    try {
      db.prepare(
        "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, 'x', 'student')"
      ).run("Leftover", "leftover@vjti.ac.in");
      db.prepare("INSERT INTO audit_log (actor_id, action, target) VALUES (1, 'test', 'leftover')").run();
    } finally {
      db.close();
    }

    execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root, env: { ...process.env, DB_PATH: resetDbPath }, stdio: "pipe",
    });

    const check = new DatabaseSync(resetDbPath, { readOnly: true });
    try {
      assert.equal(
        check.prepare("SELECT id FROM users WHERE email = ?").get("leftover@vjti.ac.in"),
        undefined
      );
      const auditRows = check.prepare("SELECT action, target FROM audit_log ORDER BY id").all()
        .map((r) => ({ action: r.action, target: r.target }));
      assert.deepEqual(auditRows, [{ action: "seed_demo", target: "content + accounts" }]);
      assert.ok(check.prepare("SELECT id FROM users WHERE email = ?").get("tpo@vjti.ac.in"));
    } finally {
      check.close();
      rmSync(dir, { recursive: true, force: true });
    }

    const seedSrc = readFileSync(join(root, "server/seed-demo.js"), "utf8");
    for (const m of seedSrc.matchAll(/password:\s*"([^"]+)"/g)) {
      assert.ok(m[1].length >= 8, `seed password too short: ${m[1]}`);
    }
  });
});

describe("branch stats admin API", () => {
  test("PUT /api/admin/branch-stats computes percent and returns shaped fields", async () => {
    const res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: {
        rows: [
          { branch: "Computer Engineering", totalStudents: 120, placedStudents: 115 },
          { branch: "Information Technology", totalStudents: 110, placedStudents: 104 },
        ],
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.saved, 2);

    const content = await request("/api/content");
    const rows = content.data.branchStatsByYear["2026"];
    const cs = rows.find((r) => r.branch === "Computer Engineering");
    assert.equal(cs.totalStudents, 120);
    assert.equal(cs.placedStudents, 115);
    assert.equal(cs.unplacedStudents, 5);
    assert.equal(cs.percent, 95.8);
  });

  test("rejects placed students greater than total students", async () => {
    const res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: { rows: [{ branch: "Computer Engineering", totalStudents: 10, placedStudents: 11 }] },
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /cannot exceed total students/i);
  });

  test("rejects invalid branch, negative counts, and non-integer counts", async () => {
    let res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: { rows: [{ branch: "Not A Branch", totalStudents: 10, placedStudents: 5 }] },
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /valid branch/i);

    res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: { rows: [{ branch: "Computer Engineering", totalStudents: -1, placedStudents: 0 }] },
    });
    assert.equal(res.status, 400);

    res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: { rows: [{ branch: "Computer Engineering", totalStudents: 10, placedStudents: 1.5 }] },
    });
    assert.equal(res.status, 400);
  });

  test("ignores client-supplied percent and computes it on the server", async () => {
    const res = await request("/api/admin/branch-stats/2026", {
      method: "PUT",
      cookie: session.tpo,
      body: { rows: [{ branch: "Computer Engineering", totalStudents: 100, placedStudents: 50, percent: 999 }] },
    });
    assert.equal(res.status, 200);
    const content = await request("/api/content");
    const cs = content.data.branchStatsByYear["2026"].find((r) => r.branch === "Computer Engineering");
    assert.equal(cs.percent, 50);
  });
});

describe("database migrations", () => {
  test("migrates an old-schema database and normalizes branches", () => {
    const oldPath = join(tempDir, "old.db");
    const oldDb = new DatabaseSync(oldPath);
    oldDb.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        branch TEXT,
        graduation_year TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE drives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        package_lpa REAL,
        location TEXT,
        eligibility_branches TEXT NOT NULL DEFAULT '[]',
        graduation_years TEXT NOT NULL DEFAULT '[]',
        registration_deadline TEXT,
        drive_date TEXT,
        apply_link TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE branch_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year TEXT NOT NULL,
        branch TEXT NOT NULL,
        percent INTEGER NOT NULL,
        UNIQUE (year, branch)
      );
      INSERT INTO users (full_name, email, password_hash, role, branch, graduation_year)
        VALUES ('Old Student', 'old@vjti.ac.in', 'x', 'student', 'IT', '2027');
      INSERT INTO drives (company, role, eligibility_branches, graduation_years)
        VALUES ('Test Co', 'Engineer', '["IT","Mech"]', '["2027"]');
      INSERT INTO branch_stats (year, branch, percent) VALUES ('2026', 'Computer Engineering', 91);
    `);
    oldDb.close();

    execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { DatabaseSync } from "node:sqlite";
      import "./server/db.js";
      const db = new DatabaseSync(process.env.DB_PATH);
      const version = db.prepare("PRAGMA user_version").get().user_version;
      const user = db.prepare("SELECT branch, token_version FROM users WHERE email = ?").get("old@vjti.ac.in");
      const drive = db.prepare("SELECT eligibility_branches FROM drives WHERE company = ?").get("Test Co");
      const branch = db.prepare("SELECT year, branch, percent, total_students, placed_students FROM branch_stats WHERE year = ?").get("2026");
      if (version !== 6) throw new Error("version=" + version);
      if (user.token_version !== 0) throw new Error("token=" + user.token_version);
      if (user.branch !== "Information Technology") throw new Error("branch=" + user.branch);
      const verified = db.prepare("SELECT email_verified FROM users WHERE email = ?").get("old@vjti.ac.in");
      if (Number(verified.email_verified) !== 1) throw new Error("verified=" + verified.email_verified);
      const otpTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_otps'").get();
      if (!otpTable) throw new Error("missing email_otps");
      const reportTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='experience_reports'").get();
      if (!reportTable) throw new Error("missing experience_reports");
      const sendLogTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_send_log'").get();
      if (!sendLogTable) throw new Error("missing email_send_log");
      if (drive.eligibility_branches !== JSON.stringify(["Information Technology","Mechanical Engineering"])) {
        throw new Error("drive=" + drive.eligibility_branches);
      }
      if (!branch) throw new Error("missing branch_stats row");
      if (branch.total_students !== 100) throw new Error("total=" + branch.total_students);
      if (branch.placed_students !== 91) throw new Error("placed=" + branch.placed_students);
      if (Number(branch.percent) !== 91) throw new Error("percent=" + branch.percent);
      db.close();
    `], { cwd: root, env: { ...process.env, DB_PATH: oldPath }, stdio: "pipe" });
  });
});

describe("backup script", () => {
  test("creates a timestamped SQLite backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "vjti-backup-"));
    const backupDir = join(dir, "backups");
    const srcDb = join(dir, "placements.db");
    execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: srcDb },
      stdio: "pipe",
    });

    const out = execFileSync(process.execPath, ["scripts/backup-db.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: srcDb, BACKUP_DIR: backupDir },
      encoding: "utf8",
      stdio: "pipe",
    });

    assert.match(out, /Backup written to/);
    const backupFile = out.match(/Backup written to (.+)/)?.[1]?.trim();
    assert.ok(backupFile && existsSync(backupFile));
    const backupDb = new DatabaseSync(backupFile, { readOnly: true });
    try {
      const count = backupDb.prepare("SELECT COUNT(*) AS count FROM users").get().count;
      assert.ok(count > 0);
    } finally {
      backupDb.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("access-control matrix", () => {
  const cases = [
    { method: "GET", path: "/api/admin/content", allow: ["tpo", "tpoi"] },
    { method: "PUT", path: "/api/admin/stats/bad-year", body: { studentsPlaced: 1, highest: "1", average: "1", companies: 1 }, allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/companies", body: {}, allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/companies/import", body: { year: "2026", csv: "" }, allow: ["tpo", "tpoi"] },
    { method: "GET", path: "/api/admin/experiences", allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/experiences/1/review", body: { action: "bogus" }, allow: ["tpo", "tpoi"] },
    { method: "GET", path: "/api/admin/users", allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/users", body: {}, allow: ["tpoi"] },
    { method: "PUT", path: "/api/admin/users/1/role", body: { role: "invalid-role" }, allow: ["tpo", "tpoi"] },
    { method: "GET", path: "/api/admin/audit", allow: ["tpoi"] },
    { method: "GET", path: "/api/admin/drives", allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/drives", body: {}, allow: ["tpo", "tpoi"] },
    { method: "GET", path: "/api/admin/alumni", allow: ["tpo", "tpoi"] },
    { method: "POST", path: "/api/admin/alumni/import", body: { csv: "" }, allow: ["tpo", "tpoi"] },
    { method: "GET", path: "/api/bookmarks", allow: ["student", "contributor", "tpo", "tpoi"] },
    { method: "PUT", path: "/api/me", body: { fullName: "" }, allow: ["student", "contributor", "tpo", "tpoi"] },
    { method: "GET", path: "/api/notifications", allow: ["student", "contributor", "tpo", "tpoi"] },
  ];

  for (const c of cases) {
    test(`${c.method} ${c.path} enforces role access`, async () => {
      const anon = await request(c.path, { method: c.method, body: c.body });
      assert.equal(anon.status, 401, `anon ${c.method} ${c.path}`);

      for (const [role, cookie] of Object.entries(session)) {
        const res = await request(c.path, { method: c.method, body: c.body, cookie });
        if (c.allow.includes(role)) {
          assert.notEqual(res.status, 401, `${role} should be authenticated for ${c.path}`);
          assert.notEqual(res.status, 403, `${role} should be authorized for ${c.path}`);
        } else {
          assert.equal(res.status, 403, `${role} should be forbidden for ${c.path}`);
        }
      }
    });
  }
});


describe("email verification OTP", () => {
  function openDb() { return new DatabaseSync(dbPath); }

  test("unverified user cannot login or submit; verification enforces attempt limit", async () => {
    const email = "verifytest@vjti.ac.in";
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { fullName: "Verify Test", email, password: "Password123!" },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.needsVerification, true);
    assert.match(reg.data.devCode || "", /^\d{6}$/);

    const login = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(login.status, 403);
    assert.equal(login.data.needsVerification, true);

    for (let i = 0; i < 5; i++) {
      const bad = await request("/api/auth/verify-email", { method: "POST", body: { email, code: "000000" } });
      assert.equal(bad.status, 400);
    }
    const afterLimit = await request("/api/auth/verify-email", { method: "POST", body: { email, code: reg.data.devCode } });
    assert.equal(afterLimit.status, 400);
  });

  test("resend cooldown, one active code, and resend issues fresh code", async () => {
    const email = "resendtest@vjti.ac.in";
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { fullName: "Resend Test", email, password: "Password123!" },
    });
    assert.equal(reg.status, 201);
    const firstCode = reg.data.devCode;

    const cooldown = await request("/api/auth/resend-verification", { method: "POST", body: { email } });
    assert.equal(cooldown.status, 429);

    const db = openDb();
    db.prepare("UPDATE email_otps SET created_at = datetime('now', '-61 seconds') WHERE email = ? AND purpose = 'verify_email'").run(email);
    db.close();

    const resend = await request("/api/auth/resend-verification", { method: "POST", body: { email } });
    assert.equal(resend.status, 200);
    assert.match(resend.data.devCode || "", /^\d{6}$/);
    assert.notEqual(resend.data.devCode, firstCode);

    const oldCode = await request("/api/auth/verify-email", { method: "POST", body: { email, code: firstCode } });
    assert.equal(oldCode.status, 400);

    const ok = await request("/api/auth/verify-email", { method: "POST", body: { email, code: resend.data.devCode } });
    assert.equal(ok.status, 200);
    const login = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(login.status, 200);
  });

  test("expired code is rejected and unverified user cannot submit experience", async () => {
    const email = "expirytest@vjti.ac.in";
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { fullName: "Expiry Test", email, password: "Password123!" },
    });
    assert.equal(reg.status, 201);

    const db = openDb();
    db.prepare("UPDATE email_otps SET expires_at = datetime('now', '-1 minute') WHERE email = ? AND purpose = 'verify_email'").run(email);
    db.close();

    const expired = await request("/api/auth/verify-email", { method: "POST", body: { email, code: reg.data.devCode } });
    assert.equal(expired.status, 400);

    // Make user verified to get session, then mark unverified and ensure submit blocked.
    const db2 = openDb();
    db2.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email);
    db2.close();
    const login = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(login.status, 200);
    const cookie = login.cookie.split(";")[0];
    const db3 = openDb();
    db3.prepare("UPDATE users SET email_verified = 0 WHERE email = ?").run(email);
    db3.close();

    const submit = await request("/api/experiences", {
      method: "POST",
      cookie,
      body: { company: "TestCo", role: "Intern", placementYear: "2026", heading: "A heading", body: "This body is long enough to pass validation rules for experiences.", tags: [], visibility: "anonymous" },
    });
    assert.equal(submit.status, 403);
  });
});

describe("password reset", () => {
  test("forgot password does not reveal account existence", async () => {
    const missing = await request("/api/auth/forgot-password", { method: "POST", body: { email: "missing@vjti.ac.in" } });
    assert.equal(missing.status, 200);
    assert.equal(missing.data.ok, true);
    assert.equal(missing.data.devCode, undefined);
  });

  test("reset password sets new password, increments token_version, and kills old sessions", async () => {
    const email = "resetflow@vjti.ac.in";
    const reg = await request("/api/auth/register", { method: "POST", body: { fullName: "Reset Flow", email, password: "Password123!" } });
    assert.equal(reg.status, 201);
    const verify = await request("/api/auth/verify-email", { method: "POST", body: { email, code: reg.data.devCode } });
    assert.equal(verify.status, 200);
    const login = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(login.status, 200);
    const oldCookie = login.cookie.split(";")[0];

    const forgot = await request("/api/auth/forgot-password", { method: "POST", body: { email } });
    assert.equal(forgot.status, 200);
    assert.match(forgot.data.devCode || "", /^\d{6}$/);

    const bad = await request("/api/auth/reset-password", { method: "POST", body: { email, code: forgot.data.devCode, newPassword: "short" } });
    assert.equal(bad.status, 400);

    const reset = await request("/api/auth/reset-password", { method: "POST", body: { email, code: forgot.data.devCode, newPassword: "NewPassword123!" } });
    assert.equal(reset.status, 200);

    const oldSession = await request("/api/auth/me", { cookie: oldCookie });
    assert.equal(oldSession.status, 200);
    assert.equal(oldSession.data.user, null);

    const oldPw = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(oldPw.status, 401);

    const newPw = await request("/api/auth/login", { method: "POST", body: { email, password: "NewPassword123!" } });
    assert.equal(newPw.status, 200);
  });
});

describe("experience reports and guidelines", () => {
  test("logged-in user can report once; staff can dismiss or unpublish", async () => {
    const content = await request("/api/content");
    const exp = content.data.experiences[0];
    assert.ok(exp);

    const anon = await request(`/api/experiences/${exp.id}/report`, { method: "POST", body: { reason: "Spam or irrelevant" } });
    assert.equal(anon.status, 401);

    const bad = await request(`/api/experiences/${exp.id}/report`, { method: "POST", cookie: session.student, body: { reason: "bad" } });
    assert.equal(bad.status, 400);

    const rep = await request(`/api/experiences/${exp.id}/report`, {
      method: "POST", cookie: session.student,
      body: { reason: "Spam or irrelevant", details: "Looks off" },
    });
    assert.equal(rep.status, 201);

    const dup = await request(`/api/experiences/${exp.id}/report`, {
      method: "POST", cookie: session.student,
      body: { reason: "Spam or irrelevant" },
    });
    assert.equal(dup.status, 409);

    const admin = await request("/api/admin/reports", { cookie: session.tpo });
    assert.equal(admin.status, 200);
    assert.ok(admin.data.openCount >= 1);
    const report = admin.data.reports.find((r) => r.experienceId === exp.id && r.status === "open");
    assert.ok(report);

    const dismiss = await request(`/api/admin/reports/${report.id}/dismiss`, { method: "POST", cookie: session.tpo });
    assert.equal(dismiss.status, 200);

    // report another and unpublish
    const exp2 = content.data.experiences[1];
    const rep2 = await request(`/api/experiences/${exp2.id}/report`, { method: "POST", cookie: session.contributor, body: { reason: "Other", details: "x" } });
    assert.equal(rep2.status, 201);
    const admin2 = await request("/api/admin/reports", { cookie: session.tpo });
    const report2 = admin2.data.reports.find((r) => r.experienceId === exp2.id && r.status === "open");
    const unpub = await request(`/api/admin/reports/${report2.id}/unpublish`, { method: "POST", cookie: session.tpo });
    assert.equal(unpub.status, 200);

    const detail = await request(`/api/experiences/${exp2.id}`);
    assert.equal(detail.status, 404);
  });
});

describe("account deletion and privacy", () => {
  test("delete account removes user data and anonymizes published experiences", async () => {
    const email = "deleteme@vjti.ac.in";
    const reg = await request("/api/auth/register", { method: "POST", body: { fullName: "Delete Me", email, password: "Password123!" } });
    assert.equal(reg.status, 201);
    await request("/api/auth/verify-email", { method: "POST", body: { email, code: reg.data.devCode } });
    const login = await request("/api/auth/login", { method: "POST", body: { email, password: "Password123!" } });
    assert.equal(login.status, 200);
    const cookie = login.cookie.split(";")[0];

    const submit = await request("/api/experiences", { method: "POST", cookie, body: {
      company: "DeleteCo", role: "SWE", placementYear: "2026", heading: "Delete test", body: "This is long enough for the experience body validation.", tags: ["DSA"], visibility: "named"
    }});
    assert.equal(submit.status, 201);
    const expId = submit.data.id;
    await request(`/api/admin/experiences/${expId}/review`, { method: "POST", cookie: session.tpo, body: { action: "approve", note: "" } });

    const del = await request("/api/me", { method: "DELETE", cookie });
    assert.equal(del.status, 200);

    const me = await request("/api/auth/me", { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.data.user, null);

    const detail = await request(`/api/experiences/${expId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.experience.author.name, "Anonymous senior");

    // audit should not contain plain email
    const audit = await request("/api/admin/audit", { cookie: session.tpoi });
    const delLog = (audit.data.entries || []).find((l) => l.action === "delete_account" && String(l.target).includes(String(login.data.user.id)));
    assert.ok(delLog);
    assert.ok(!String(delLog.target).includes(email));
  });
});

describe("launch seed and production guards", () => {
  test("seed-demo refuses in launch mode", () => {
    assert.throws(
      () => execFileSync(process.execPath, ["server/seed-demo.js"], {
        cwd: root, env: { ...process.env, DB_PATH: dbPath, APP_MODE: "launch" }, stdio: "pipe",
      }),
      /Refusing/
    );
  });

  test("seed:launch creates only pre-verified TPOI and no sample content", () => {
    const dir = mkdtempSync(join(tmpdir(), "vjti-launch-seed-"));
    const launchDb = join(dir, "placements.db");
    execFileSync(process.execPath, ["server/seed-launch.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: launchDb, TPOI_EMAIL: "admin@vjti.ac.in", TPOI_PASSWORD: "StrongPass123!", TPOI_NAME: "Admin" },
      stdio: "pipe",
    });
    const db = new DatabaseSync(launchDb);
    const users = db.prepare("SELECT email, role, email_verified FROM users").all();
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "admin@vjti.ac.in");
    assert.equal(users[0].role, "tpoi");
    assert.equal(Number(users[0].email_verified), 1);
    const counts = db.prepare("SELECT (SELECT COUNT(*) FROM experiences) e, (SELECT COUNT(*) FROM companies) c, (SELECT COUNT(*) FROM drives) d").get();
    assert.equal(counts.e, 0);
    assert.equal(counts.c, 0);
    assert.equal(counts.d, 0);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("launch mode", () => {
  let childL;
  let baseL;
  const sess = {};
  const tempDirL = mkdtempSync(join(tmpdir(), "vjti-launch-api-"));
  const dbPathL = join(tempDirL, "placements.db");

  function waitForServerL() {
    return new Promise((resolveReady, reject) => {
      let buffer = "";
      const timer = setTimeout(() => reject(new Error("launch API did not start")), 15000);
      const finish = (fn, value) => { clearTimeout(timer); fn(value); };
      childL.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        const match = buffer.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) finish(resolveReady, `http://localhost:${match[1]}`);
      });
      childL.stderr.on("data", (chunk) => process.stderr.write(chunk));
      childL.once("exit", (code) => finish(reject, new Error(`launch API exited early (${code})`)));
    });
  }

  async function reqL(path, { method = "GET", body, cookie } = {}) {
    const response = await fetch(baseL + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data, cookie: response.headers.get("set-cookie") };
  }

  async function loginL(email, password) {
    const result = await reqL("/api/auth/login", { method: "POST", body: { email, password } });
    assert.equal(result.status, 200, `login ${email}: ${result.data.error}`);
    return result.cookie.split(";")[0];
  }

  before(async () => {
    execFileSync(process.execPath, ["server/seed-demo.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: dbPathL },
      stdio: "pipe",
    });
    childL = spawn(process.execPath, ["server/index.js"], {
      cwd: root,
      env: { ...process.env, DB_PATH: dbPathL, API_PORT: "0", NODE_ENV: "test", APP_MODE: "launch" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    baseL = await waitForServerL();
    sess.tpo = await loginL("tpo@vjti.ac.in", "Tpo1234!");
    sess.tpoi = await loginL("tpoi@vjti.ac.in", "ChangeMe123!");
    sess.student = await loginL("student@vjti.ac.in", "Student123!");
    sess.contributor = await loginL("contributor@vjti.ac.in", "Contributor123!");
  });

  after(async () => {
    if (childL && childL.exitCode === null) {
      childL.kill();
      await new Promise((done) => childL.once("exit", done));
    }
    rmSync(tempDirL, { recursive: true, force: true });
  });

  test("content reports launch mode", async () => {
    const res = await reqL("/api/content");
    assert.equal(res.status, 200);
    assert.equal(res.data.mode, "launch");
  });

  test("disabled routes return 404 for every role", async () => {
    const roles = [null, sess.student, sess.contributor, sess.tpo, sess.tpoi];
    const checks = [
      ["GET", "/api/drives"],
      ["GET", "/api/applications"],
      ["GET", "/api/bookmarks"],
      ["GET", "/api/admin/content"],
      ["PUT", "/api/admin/stats/2026"],
      ["POST", "/api/admin/companies"],
      ["POST", "/api/admin/companies/import"],
      ["PUT", "/api/admin/branch-stats/2026"],
      ["GET", "/api/admin/alumni"],
      ["GET", "/api/admin/drives"],
    ];
    for (const cookie of roles) {
      for (const [method, path] of checks) {
        const res = await reqL(path, { method, cookie, body: method === "GET" ? undefined : {} });
        assert.equal(res.status, 404, `${method} ${path} as ${cookie ? "auth" : "anon"} should be 404`);
        assert.equal(res.data.error, "Not available");
      }
    }
  });

  test("enabled routes still work in launch mode", async () => {
    const content = await reqL("/api/content");
    assert.equal(content.status, 200);
    assert.ok(Array.isArray(content.data.experiences));
    const me = await reqL("/api/auth/me", { cookie: sess.student });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, "student@vjti.ac.in");
    const notifs = await reqL("/api/notifications", { cookie: sess.student });
    assert.equal(notifs.status, 200);
    const reviews = await reqL("/api/admin/experiences", { cookie: sess.tpo });
    assert.equal(reviews.status, 200);
    const users = await reqL("/api/admin/users", { cookie: sess.tpo });
    assert.equal(users.status, 200);
    const audit = await reqL("/api/admin/audit", { cookie: sess.tpoi });
    assert.equal(audit.status, 200);
  });
});

describe('mailer', () => {
  test('sendMail uses stubbed transport when injected', async () => {
    const calls = [];
    _setTransporterForTest({ sendMail: async (opts) => { calls.push(opts); return { accepted: [opts.to] }; } });
    try {
      const result = await sendMail({ to: 'a@vjti.ac.in', subject: 'Hi', text: 'Body' });
      assert.equal(result.ok, true);
      assert.equal(result.delivered, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].to, 'a@vjti.ac.in');
      assert.match(calls[0].subject, /Hi/);
    } finally {
      _resetTransporterForTest();
    }
  });

  test('sendMail returns friendly error on send failure', async () => {
    _setTransporterForTest({ sendMail: async () => { throw new Error('SMTP boom'); } });
    try {
      const result = await sendMail({ to: 'a@vjti.ac.in', subject: 'Hi', text: 'Body' });
      assert.equal(result.ok, false);
      assert.equal(result.delivered, false);
      assert.match(result.error, /try again later/i);
    } finally {
      _resetTransporterForTest();
    }
  });

  test('sendOtpEmail builds verification and reset emails', async () => {
    const calls = [];
    _setTransporterForTest({ sendMail: async (opts) => { calls.push(opts); } });
    try {
      const v = await sendOtpEmail({ to: 'a@vjti.ac.in', purpose: 'verify_email', code: '123456' });
      assert.equal(v.ok, true);
      assert.match(calls[0].subject, /verification/i);
      assert.match(calls[0].text, /123456/);
      const r = await sendOtpEmail({ to: 'a@vjti.ac.in', purpose: 'reset_password', code: '654321' });
      assert.equal(r.ok, true);
      assert.match(calls[1].subject, /reset/i);
      assert.match(calls[1].text, /654321/);
    } finally {
      _resetTransporterForTest();
    }
  });
});

describe('email send caps', () => {
  test('per-address hourly cap blocks OTP sends', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vjti-cap-addr-'));
    const capDb = join(dir, 'placements.db');
    const capServer = spawn(process.execPath, ['server/index.js'], {
      cwd: root,
      env: { ...process.env, DB_PATH: capDb, API_PORT: '0', NODE_ENV: 'test', JWT_SECRET: 'test-secret-that-is-at-least-32-chars' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let capBase = '';
    await new Promise((resolveReady, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('cap server timeout')), 15000);
      capServer.stdout.on('data', (d) => { buf += d.toString(); const m = buf.match(/http:\/\/localhost:(\d+)/); if (m) { capBase = 'http://127.0.0.1:' + m[1]; clearTimeout(t); resolveReady(); } });
      capServer.once('exit', (c) => { clearTimeout(t); reject(new Error('exit ' + c)); });
    });
    try {
      // Pre-fill 5 send log rows for same address in last hour.
      const db = new DatabaseSync(capDb);
      for (let i = 0; i < 5; i++) db.prepare("INSERT INTO email_send_log (email, purpose) VALUES (?, 'verify_email')").run('cap@vjti.ac.in');
      db.close();
      const res = await fetch(capBase + '/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Cap User', email: 'cap@vjti.ac.in', password: 'Password123!' }),
      });
      const data = await res.json();
      assert.ok([429,503].includes(res.status));
      assert.match(data.error || data.message, /too many email requests|try again later/i);
    } finally {
      capServer.kill();
      await new Promise((d) => capServer.once('exit', d));
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('global daily cap blocks sends and returns try again later', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vjti-cap-global-'));
    const capDb = join(dir, 'placements.db');
    const capServer = spawn(process.execPath, ['server/index.js'], {
      cwd: root,
      env: { ...process.env, DB_PATH: capDb, API_PORT: '0', NODE_ENV: 'test', JWT_SECRET: 'test-secret-that-is-at-least-32-chars', MAX_EMAILS_PER_DAY: '2' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let capBase = '';
    await new Promise((resolveReady, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('cap server timeout')), 15000);
      capServer.stdout.on('data', (d) => { buf += d.toString(); const m = buf.match(/http:\/\/localhost:(\d+)/); if (m) { capBase = 'http://127.0.0.1:' + m[1]; clearTimeout(t); resolveReady(); } });
      capServer.once('exit', (c) => { clearTimeout(t); reject(new Error('exit ' + c)); });
    });
    try {
      const db = new DatabaseSync(capDb);
      db.prepare("INSERT INTO email_send_log (email, purpose) VALUES ('a@vjti.ac.in', 'verify_email')").run();
      db.prepare("INSERT INTO email_send_log (email, purpose) VALUES ('b@vjti.ac.in', 'verify_email')").run();
      db.close();
      const res = await fetch(capBase + '/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Cap User', email: 'capg@vjti.ac.in', password: 'Password123!' }),
      });
      const data = await res.json();
      assert.ok([429,503].includes(res.status));
      assert.match(data.error || data.message, /try again later/i);
    } finally {
      capServer.kill();
      await new Promise((d) => capServer.once('exit', d));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('launch startup safety', () => {
  test('reports all missing production+launch startup items at once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vjti-startup-all-'));
    const env = { ...process.env, NODE_ENV: 'production', APP_MODE: 'launch', DB_PATH: join(dir, 'placements.db'), API_PORT: '0' };
    delete env.JWT_SECRET;
    delete env.TRUST_PROXY;
    delete env.SMTP_HOST;
    delete env.SMTP_PORT;
    delete env.SMTP_USER;
    delete env.SMTP_PASS;
    delete env.MAIL_FROM;
    delete env.TPOI_EMAIL;
    delete env.TPOI_PASSWORD;
    assert.throws(() => execFileSync(process.execPath, ['server/index.js'], { cwd: root, env, stdio: 'pipe' }), (err) => {
      const out = String(err.stderr || '') + String(err.stdout || '');
      assert.match(out, /Startup check failed/);
      assert.match(out, /JWT_SECRET/);
      assert.match(out, /SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM/);
      assert.match(out, /TRUST_PROXY/);
      assert.match(out, /TPOI_EMAIL/);
      assert.match(out, /TPOI_PASSWORD/);
      assert.doesNotMatch(out, /supersecret|password123/i);
      return true;
    });
    rmSync(dir, { recursive: true, force: true });
  });

  test('creates pre-verified TPOI on first production+launch start when no staff exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vjti-startup-tpoi-'));
    const dbPath = join(dir, 'placements.db');
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        APP_MODE: 'launch',
        DB_PATH: dbPath,
        API_PORT: '0',
        JWT_SECRET: 'test-secret-that-is-at-least-32-chars',
        TRUST_PROXY: '1',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        MAIL_FROM: 'Test <test@example.com>',
        TPOI_EMAIL: 'first@vjti.ac.in',
        TPOI_PASSWORD: 'FirstPassword123!',
        TPOI_NAME: 'First Admin',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let base = '';
    await new Promise((resolveReady, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('startup timeout')), 15000);
      child.stdout.on('data', (d) => { buf += d.toString(); const m = buf.match(/http:\/\/localhost:(\d+)/); if (m) { base = 'http://127.0.0.1:' + m[1]; clearTimeout(t); resolveReady(); } });
      child.once('exit', (c) => { clearTimeout(t); reject(new Error('exit ' + c + ' ' + buf)); });
    });
    try {
      const db = new DatabaseSync(dbPath);
      const user = db.prepare("SELECT email, role, email_verified, full_name FROM users WHERE email = ?").get('first@vjti.ac.in');
      assert.equal(user.role, 'tpoi');
      assert.equal(Number(user.email_verified), 1);
      assert.equal(user.full_name, 'First Admin');
      db.close();
      const health = await (await fetch(base + '/api/health')).json();
      assert.equal(health.ok, true);
    } finally {
      child.kill();
      await new Promise((d) => child.once('exit', d));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
