/*
  Browser-level smoke tests for the built app — `npm run test:ui`.

  Playwright drives a real browser against the production Express process
  started by scripts/serve-ui-test.js with a throwaway SQLite database.
  These tests cover the public API-backed pages, authentication, private
  bookmarks, account settings and route guards from a user's point of view.
*/
import { test, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function signIn(page, email, password) {
  await page.goto("/signin");
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".user-chip")).toBeVisible();
}

test("public pages load API content and filters update the lists", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "VJTI Placements" })).toBeVisible();
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Unplaced" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Placed %" })).toBeVisible();
  await expect(page.locator(".branch-table tfoot")).toContainText("Total");

  const companySearch = page.getByPlaceholder("Search company or role…");
  await companySearch.fill("north");
  await expect(page.locator(".company-table tbody tr")).toHaveCount(1);
  await expect(page.getByText("Showing 1 of 8 companies")).toBeVisible();

  const experienceSearch = page.getByRole("searchbox", {
    name: "Search interview experiences",
  });
  await experienceSearch.fill("dsa");
  await expect(page.getByText(/Showing 4 of 6 write-ups/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.getByText(/Showing 6 of 6 write-ups/)).toBeVisible();
});

test("prep insights rank common themes from approved experiences", async ({ page }) => {
  await page.goto("/prep-insights");
  await expect(page.getByRole("heading", { name: "Preparation insights" })).toBeVisible();
  await expect(page.getByText(/Based on 6 approved write-ups/)).toBeVisible();

  const dsa = page.locator(".insight-topic", {
    has: page.getByRole("heading", { name: "DSA" }),
  });
  await expect(dsa).toContainText("4 of 6");
  await expect(dsa).toContainText("67%");
  await expect(page.locator(".prep-checklist")).toContainText("DSA");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What seniors say to prepare" })).toBeVisible();
  await expect(page.locator(".insight-card-grid")).toContainText("DSA");
});

test("signed-in bookmarks are private and can be toggled from cards and detail pages", async ({ page }) => {
  await signIn(page, "student@vjti.ac.in", "Student123!");

  await page.locator(".user-chip").click();
  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved companies" })).toBeVisible();
  await expect(page.locator(".saved-item")).toHaveCount(2);
  await expect(page.locator(".saved-item", { hasText: "Northbridge Software" })).toBeVisible();
  await expect(page.locator(".saved-item", { hasText: "Summit Bank Group" })).toBeVisible();

  await page.locator(".saved-item", { hasText: "Northbridge Software" })
    .getByRole("button", { name: "Remove from saved companies" })
    .click();
  await expect(page.locator(".saved-item")).toHaveCount(1);
  await expect(page.locator(".saved-item", { hasText: "Northbridge Software" })).toHaveCount(0);

  await page.goto("/company/northbridge_software");
  await page.getByRole("button", { name: "Save company" }).click();
  await expect(page.getByRole("button", { name: "Remove from saved companies" })).toBeVisible();

  await page.goto("/saved");
  await expect(page.locator(".saved-item")).toHaveCount(2);

  await page.locator(".user-chip").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "contributor@vjti.ac.in", "Contributor123!");
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
  await expect(page.locator(".saved-item")).toHaveCount(0);
});

test("account settings update the header and check the current password", async ({ page }) => {
  await signIn(page, "student@vjti.ac.in", "Student123!");

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await expect(page.getByLabel("College email")).toHaveValue("student@vjti.ac.in");
  await expect(page.getByLabel("College email")).toHaveJSProperty("readOnly", true);

  await page.getByLabel("Full name").fill("Asha Patil (UI test)");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await expect(page.locator(".user-chip")).toContainText("Asha Patil (UI test)");

  await page.getByLabel("Current password").fill("WrongPassword123!");
  await page.getByLabel("New password (at least 8 characters)").fill("Changed123!");
  await page.getByLabel("Confirm new password").fill("Changed123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Current password is incorrect.")).toBeVisible();
});

test("protected pages redirect anonymous visitors and students", async ({ page }) => {
  await page.goto("/saved");
  await expect(page).toHaveURL(/\/signin$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin$/);

  await signIn(page, "student@vjti.ac.in", "Student123!");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /VJTI/ }).first()).toBeVisible();
});

test("the header bell opens a private inbox and marks messages read", async ({ page }) => {
  await signIn(page, "student@vjti.ac.in", "Student123!");

  const bell = page.getByRole("link", { name: /Notifications/ });
  await expect(bell).toBeVisible();
  await expect(page.locator(".notification-badge")).toHaveText("1");

  await bell.click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(1);
  await expect(page.getByText("1 unread message.")).toBeVisible();

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByText("You're all caught up.")).toBeVisible();
  await expect(page.locator(".notification-badge")).toHaveCount(0);
  await expect(page.locator(".notification-item.unread")).toHaveCount(0);
});

test("TPO imports companies from pasted CSV and sees validation details", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin");

  const card = page.locator(".csv-import-card");
  await expect(card.getByRole("heading", { name: "Import companies — 2026" })).toBeVisible();
  const textarea = card.getByRole("textbox", { name: "Paste companies CSV" });

  await textarea.fill("name,role\nOnly,Two");
  await card.getByRole("button", { name: "Import into 2026" }).click();
  await expect(page.locator(".admin-message.error")).toContainText("Missing CSV column");
  await expect(page.locator(".admin-message-details li").first())
    .toContainText("name,role,package,hired,branches");

  await textarea.fill('name,role,package,hired,branches\nUI Import Corp,Engineer,7.5,4,"CS,IT"');
  await card.getByRole("button", { name: "Import into 2026" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Imported 1 row(s)");
  await expect(page.locator(".admin-table tbody tr", { hasText: "UI Import Corp" })).toBeVisible();
});

test("TPO edits branch placement and the derived headline updates", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin");

  await expect(page.getByText("Calculated from the branch table.")).toBeVisible();
  const totalInput = page.getByLabel("Information Technology total students");
  const placedInput = page.getByLabel("Information Technology placed students");
  await totalInput.fill("118");
  await placedInput.fill("111");
  await page.getByRole("button", { name: "Save branch placement" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Saved 2026 branch placement data.");

  await page.goto("/");
  await expect(page.locator(".stat-card", { hasText: "Students Placed" })).toContainText("520");
});

test("TPO manages alumni outreach import and bulk actions", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin");
  await page.getByRole("link", { name: /Alumni outreach/ }).click();
  await expect(page).toHaveURL(/\/admin\/alumni$/);
  await expect(page.getByRole("heading", { name: "Alumni outreach" })).toBeVisible();

  const importCard = page.locator(".csv-import-card");
  const alumniTextarea = importCard.getByRole("textbox", { name: "Paste alumni CSV" });
  await alumniTextarea.fill("email,company\nbad@example.com,X");
  await importCard.getByRole("button", { name: "Import contacts" }).click();
  await expect(page.locator(".admin-message.error")).toContainText("Missing required CSV columns");
  await expect(page.locator(".admin-message-details li").first()).toContainText("full_name");

  await alumniTextarea.fill(
    "full_name,email,branch,graduation_year,placed_company,current_company\nUI Alumni,ui.alumni@example.com,IT,2022,Asterline Consulting,Asterline Consulting"
  );
  await importCard.getByRole("button", { name: "Import contacts" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Imported 1 contact(s)");

  await page.getByPlaceholder("Search name, email, company, branch…").fill("Meera");
  const meeraRow = page.locator("tbody tr", { hasText: "Meera Iyer" });
  await expect(meeraRow).toBeVisible();
  await expect(meeraRow.locator(".status-badge")).toContainText("Not contacted");
  await meeraRow.getByRole("checkbox", { name: "Select Meera Iyer" }).check();

  const bulkBar = page.locator(".alumni-bulk-bar");
  await expect(bulkBar).toContainText("1 selected");
  await bulkBar.getByRole("button", { name: "Mark contacted now" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Marked 1 contact(s) as contacted");
  await expect(page.locator("tbody tr", { hasText: "Meera Iyer" }).locator(".status-badge")).toContainText("Contacted");

  await page.getByPlaceholder("Search name, email, company, branch…").fill("UI Alumni");
  await expect(page.locator("tbody tr", { hasText: "ui.alumni@example.com" })).toBeVisible();
});

test("TPO personalizes an outreach template and marks a contact contacted", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin/alumni");
  await page.getByPlaceholder("Search name, email, company, branch…").fill("Meera Iyer");
  const row = page.locator("tbody tr", { hasText: "Meera Iyer" });
  await row.getByRole("button", { name: "Select", exact: true }).click();

  const composer = page.locator(".alumni-composer");
  await expect(composer).toContainText("meera.iyer.alumni@example.com");
  const subject = composer.locator('input[type="text"]');
  await expect(subject).toHaveValue("Invitation to participate in VJTI {drive_label} campus drive");

  await composer.getByText("Preview personalized message").click();
  const preview = composer.locator(".alumni-preview");
  await expect(preview).toContainText("Invitation to participate in VJTI placement campus drive");
  await expect(preview).toContainText("Meera Iyer");
  await expect(preview).toContainText("Keystone Engineering");
  await expect(preview).not.toContainText("{name}");

  await page.getByRole("button", { name: "Internship drive" }).click();
  await expect(subject).toHaveValue("Invitation to offer internships to VJTI students");
  await expect(preview).toContainText("internship");

  await composer.getByRole("button", { name: "Copy subject" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Subject copied.");

  await composer.getByRole("button", { name: "Mark contacted now" }).click();
  await expect(page.locator(".admin-message.success")).toContainText("Outreach marked as contacted.");
  await expect(row).toContainText("Last:");
});

test("TPO records an alumni response and referral details", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin/alumni");
  await page.getByPlaceholder("Search name, email, company, branch…").fill("Pooja Nair");
  const row = page.locator("tbody tr", { hasText: "Pooja Nair" });
  await row.getByRole("button", { name: "Select", exact: true }).click();

  const edit = page.locator(".alumni-edit-card");
  await edit.getByLabel("Status").selectOption("interested");
  await edit.getByLabel("Drive type").selectOption("both");
  await edit.getByLabel("Response / notes").fill("Happy to introduce the campus team.");
  await edit.getByLabel("Referral details").fill("Asked for the 2027 brochure.");
  await edit.getByPlaceholder("Company alumni can help bring").fill("Peregrine Systems");
  await edit.getByPlaceholder("HR/recruiter name, email, etc.").fill("Peregrine Systems Campus Team");
  await edit.getByRole("button", { name: "Save outreach update" }).click();

  await expect(page.locator(".admin-message.success")).toContainText("Alumni outreach updated.");
  await expect(row.locator(".status-badge")).toContainText("Interested");
  await expect(row).toContainText("Peregrine Systems");
  await expect(row).toContainText("Happy to introduce the campus team.");
});

test("TPO applies bulk status and type to all visible alumni contacts", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin/alumni");
  await page.getByRole("button", { name: /^Not contacted \(/ }).click();

  const rows = page.locator(".alumni-table tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  await page.getByRole("checkbox", { name: "Select all visible contacts" }).check();
  const bulkBar = page.locator(".alumni-bulk-bar");
  await expect(bulkBar).toContainText(`${count} selected`);
  await page.getByLabel("Bulk status").selectOption("responded");
  await page.getByLabel("Bulk outreach type").selectOption("internship");
  await bulkBar.getByRole("button", { name: "Apply to selected" }).click();
  await expect(page.locator(".admin-message.success")).toContainText(`Updated ${count} contact(s).`);

  await page.getByRole("button", { name: /^Responded \(/ }).click();
  await expect(rows.first().locator(".status-badge")).toContainText("Responded");
  await expect(rows.first()).toContainText("Internship");
});

test("drives can be filtered and a student can track one", async ({ page }) => {
  await page.goto("/drives");
  await expect(page.getByRole("heading", { name: "Upcoming drives" })).toBeVisible();
  await expect(page.locator(".drive-card")).toHaveCount(3);

  await page.getByRole("searchbox", { name: "Search drives" }).fill("harbor");
  await expect(page.locator(".drive-card")).toHaveCount(1);
  await expect(page.locator(".drive-card")).toContainText("Harbor Automotive");

  await signIn(page, "student@vjti.ac.in", "Student123!");
  await page.goto("/drives");
  await page.getByRole("searchbox", { name: "Search drives" }).fill("harbor");
  await page.getByRole("button", { name: "+ Track application" }).click();

  await expect(page).toHaveURL(/\/my-applications$/);
  await expect(page.locator(".admin-message.success")).toContainText("Now tracking Harbor Automotive");
  await expect(page.locator(".application-card", { hasText: "Harbor Automotive" })).toBeVisible();
});

test("a student moves an application forward with private notes", async ({ page }) => {
  await signIn(page, "student@vjti.ac.in", "Student123!");
  await page.goto("/my-applications");
  const card = page.locator(".application-card", { hasText: "Summit Bank Group" });
  await card.getByLabel("Stage for Summit Bank Group").selectOption("interview");
  await card.getByLabel("Notes for Summit Bank Group").fill("Technical round confirmed.");
  await card.getByRole("button", { name: "Save" }).click();

  await expect(page.locator(".admin-message.success")).toContainText("Application updated.");
  const interview = page.locator(".pipeline-column", { has: page.getByRole("heading", { name: /^Interview/ }) });
  await expect(interview.locator(".application-card", { hasText: "Summit Bank Group" })).toBeVisible();
});

test("TPO publishes a drive and it appears on the public page", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await page.goto("/admin");
  await page.getByRole("link", { name: /Placement drives/ }).click();
  await expect(page).toHaveURL(/\/admin\/drives$/);

  const form = page.locator("form.admin-card").first();
  await form.getByLabel("Company").fill("UI Drive Corp");
  await form.getByLabel("Role").fill("Graduate Engineer");
  await form.getByLabel("Registration deadline").fill("2026-12-31");
  await form.getByLabel("Eligible branches").selectOption("Information Technology");
  await form.getByLabel("Graduation years (comma separated)").fill("2027");
  await form.getByRole("button", { name: "Publish drive" }).click();

  await expect(page.locator(".admin-message.success")).toContainText("Published UI Drive Corp");
  await expect(page.locator("tbody tr", { hasText: "UI Drive Corp" })).toBeVisible();

  await page.goto("/drives");
  await page.getByRole("searchbox", { name: "Search drives" }).fill("UI Drive Corp");
  await expect(page.locator(".drive-card", { hasText: "UI Drive Corp" })).toBeVisible();
});

test("key pages have no horizontal overflow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const assertNoOverflow = async (path) => {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow, `overflow at ${path}`).toBeFalsy();
  };

  await assertNoOverflow("/");
  await assertNoOverflow("/companies");
  await assertNoOverflow("/drives");

  await signIn(page, "tpo@vjti.ac.in", "Tpo1234!");
  await assertNoOverflow("/admin");
  await assertNoOverflow("/admin/alumni");
  await assertNoOverflow("/admin/users");

  await page.context().clearCookies();
  await page.goto("/");
  await signIn(page, "student@vjti.ac.in", "Student123!");
  await assertNoOverflow("/my-applications");
});


test("launch mode home page hides placement sections", async ({ browser }) => {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const tempDir = mkdtempSync(join(tmpdir(), "vjti-launch-ui-"));
  const dbPath = join(tempDir, "placements.db");
  execFileSync(process.execPath, ["server/seed-demo.js"], {
    cwd: root, env: { ...process.env, DB_PATH: dbPath }, stdio: "pipe",
  });
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: root,
    env: { ...process.env, DB_PATH: dbPath, API_PORT: "3109", NODE_ENV: "production", JWT_SECRET: "ui-test-secret-key-that-is-at-least-32-chars", APP_MODE: "launch", TRUST_PROXY: "1", SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_USER: "test@example.com", SMTP_PASS: "test-pass", MAIL_FROM: "Test <test@example.com>" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolveReady, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("launch UI server did not start")), 15000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes("listening on http://localhost:3109")) { clearTimeout(timer); resolveReady(); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error("exit "+code)); });
  });
  try {
    const context = await browser.newContext({ baseURL: "http://127.0.0.1:3109" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Interview experiences from VJTI seniors, for juniors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Share your experience" })).toBeVisible();
    await expect(page.locator(".stat-card")).toHaveCount(0);
    await expect(page.locator(".company-table, .company-cards-mobile")).toHaveCount(0);
    await expect(page.getByText(/Placement statistics, company data/i)).toHaveCount(0);
    await expect(page.locator('nav a', { hasText: 'Companies' })).toHaveCount(0);
    await expect(page.locator('nav a', { hasText: 'Drives' })).toHaveCount(0);
    await context.close();
  } finally {
    child.kill();
    await new Promise((done) => child.once("exit", done));
    rmSync(tempDir, { recursive: true, force: true });
  }
});
