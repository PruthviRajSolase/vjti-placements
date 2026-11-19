/*
  Browser-level smoke tests for the built app — `npm run test:ui`.

  Playwright drives a real browser against the production Express process
  started by scripts/serve-ui-test.js with a throwaway SQLite database.
  These tests cover the public API-backed pages, authentication, private
  bookmarks, account settings and route guards from a user's point of view.
*/
import { test, expect } from "@playwright/test";

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

  const companySearch = page.getByPlaceholder("Search company or role…");
  await companySearch.fill("micro");
  await expect(page.locator(".company-table tbody tr")).toHaveCount(1);
  await expect(page.getByText("Showing 1 of 8 companies")).toBeVisible();

  const experienceSearch = page.getByRole("searchbox", {
    name: "Search interview experiences",
  });
  await experienceSearch.fill("dsa");
  await expect(page.getByText(/Showing 1 of 3 write-ups/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.getByText(/Showing 3 of 3 write-ups/)).toBeVisible();
});

test("signed-in bookmarks are private and can be toggled from cards and detail pages", async ({ page }) => {
  await signIn(page, "student@vjti.ac.in", "Student123!");

  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved companies" })).toBeVisible();
  await expect(page.locator(".saved-item")).toHaveCount(2);
  await expect(page.locator(".saved-item", { hasText: "Microsoft" })).toBeVisible();
  await expect(page.locator(".saved-item", { hasText: "J.P. Morgan Chase & Co." })).toBeVisible();

  await page.locator(".saved-item", { hasText: "Microsoft" })
    .getByRole("button", { name: "Remove from saved companies" })
    .click();
  await expect(page.locator(".saved-item")).toHaveCount(1);
  await expect(page.locator(".saved-item", { hasText: "Microsoft" })).toHaveCount(0);

  await page.goto("/company/microsoft");
  await page.getByRole("button", { name: "Save company" }).click();
  await expect(page.getByRole("button", { name: "Remove from saved companies" })).toBeVisible();

  await page.goto("/saved");
  await expect(page.locator(".saved-item")).toHaveCount(2);

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
  await signIn(page, "tpo@vjti.ac.in", "Tpo123!");
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

test("TPO manages alumni outreach import and bulk actions", async ({ page }) => {
  await signIn(page, "tpo@vjti.ac.in", "Tpo123!");
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
    "full_name,email,branch,graduation_year,placed_company,current_company\nUI Alumni,ui.alumni@example.com,IT,2022,Infosys,Infosys"
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
