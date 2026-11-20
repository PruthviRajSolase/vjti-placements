# DEMO.md — TPO presentation runbook

This is the **presenter's script** for showing the placement portal to the TPO. It assumes no prior context and takes about **9–10 minutes** plus questions (§1–§4 are the core; §4b is the "what to prepare" pass; §3b is a short student-convenience pass; §3c is the unplaced-student drives/application pass; §5 is the staff-controls closer; §5b is notifications/company CSV import; §5c is alumni outreach with bulk actions). Keep `README.md` (and `DEVELOPMENT.md` for deeper detail) open in another tab for technical questions — this file is only about what to click and what to say.

---

## 0. Before they walk in (2 minutes)

```bash
cd D:\Placement
npm run seed:demo      # resets sample content + all demo accounts
npm run dev:full       # starts API (:3001) AND web (:5173) together
```

- Open **http://localhost:5173/** in the browser you will present from.
- Confirm the demo banner is visible at the top: *"Demo build — all statistics and experiences shown here are sample data, not official TPO records."*
- Open `http://localhost:3001/api/content` in a second tab to prove the data comes from a database, not a hardcoded file.
- `seed:demo` also inserts **six approved write-ups** (J.P. Morgan, Microsoft, L&T, Cisco, Morgan Stanley, Goldman Sachs) so the **Prep insights** page and the experience filters have a meaningful ranking. They are owned by the three seeded author accounts.
- `seed:demo` also inserts **two pending submissions** — an anonymous Amazon one from the student and a named Barclays one from a contributor — so the review queue is never empty.
- It also gives the student **two saved companies** (Microsoft and J.P. Morgan Chase & Co.), so the **Saved** page in §3b has content immediately.
- The bell in the header starts with sample notifications: staff see two unread submissions, the student sees one unread approval and the contributor one already-read review note (§5b). Reseeding clears old notifications first, so the badge is predictable.
- `seed:demo` also inserts sample **alumni outreach contacts** in different states (contacted/interested/referred/no-response, including **Meera Iyer** as not contacted), so §5c has data to select, bulk-update and track.
- It also seeds **three upcoming drives** (Microsoft, J.P. Morgan Chase & Co., Tata Motors) and **two private student applications** (Applied and Online assessment), so §3c has content immediately.
- **Gotcha:** if `/api/content` in the browser shows HTML instead of JSON, the Vite dev server is stale. Stop it and rerun `npm run dev:full` (see §7).

### Demo accounts

| Who | Email | Password | Use for |
|---|---|---|---|
| TPO staff | `tpo@vjti.ac.in` | `Tpo123!` | **Main hero** — admin panel |
| TPO in-charge | `tpoi@vjti.ac.in` | `ChangeMe123!` | Super-admin — staff controls & audit (§5) |
| Student | `student@vjti.ac.in` | `Student123!` | Role-guard check, saved companies / account (§3b) and the application pipeline (§3c) |
| Contributor | `contributor@vjti.ac.in` | `Contributor123!` | Placed student (mention only) |
| Authors | `aditya@` / `priya@` / `rahul@vjti.ac.in` | `Author123!` | Owners of the six public write-ups |

All of these are created by `npm run seed:demo`; none are real people.

---

## 1. Opening — the problem (30 seconds)

> "Right now placement data lives in spreadsheets and WhatsApp forwards. Students can't see verified numbers, and when a senior writes an experience, someone has to check it before it goes in front of everyone. I built a small portal that handles both — and staff can edit the numbers themselves."

Click through the **public homepage** (`/`):

1. Point at the four stat cards (512 placed, ₹58 LPA highest, etc.).
2. Scroll to **Companies — 2026**; type `micro` in the search box → list narrows to Microsoft; click the **IT** pill → filters combine.
3. Click **Microsoft** → the detail page shows every year this company visited and its packages.
4. Scroll to **Interview Experiences** → six write-ups with names and branches.
5. Type `dsa` in **Search** → four write-ups remain (J.P. Morgan, Microsoft, Cisco, Goldman Sachs). Click **Clear filters**.
6. Choose **Microsoft** in the Company dropdown, then the **On-campus** topic pill → filters combine; point at the "Showing 1 of 6 write-ups" count. Mention that the filters live in the URL, so this view is shareable.
7. Click the card → the detail page shows the full write-up, clickable topic chips and related write-ups. Click **← All experiences** → the same filtered view comes back.
8. Switch year tabs 2026 → 2025 → 2024.

> "Everything you see is sample data — I've put a banner on every page so nobody mistakes it for official records. The important part is that it's now **database-backed** and staff-editable."

Optional: click the **🌙 Dark / ☀️ Light** button in the header and switch back. Say nothing about it unless asked.

---

## 2. The money moment — staff edit goes live (90 seconds)

This is the interaction to linger on. It answers the TPO's real question: *"Do I still need a developer to change a number?"*

1. Click **Sign in** (top right).
2. Enter `tpo@vjti.ac.in` / `Tpo123!` → **Sign in**.
   - Say: *"This is a real login — passwords are hashed, the session is an httpOnly cookie, and the server checks who I am on every request. Not a fake front-end screen."*
3. The header now shows **Hi, TPO Office** and an **Admin** nav link. Click **Admin**.
4. In the **2026 statistics** card, change **Students placed** from `512` to `520`.
5. Click **Save statistics**. Green message: *"Saved 2026 statistics. The homepage now shows the new numbers."*
6. Click **Home** in the nav. The stat card now reads **520**.

> "I changed the number as TPO staff, saved, and the public site updated — no code change, no developer, no redeploy. Companies and branch percentages work the same way."

7. Go back to **Admin**. In the company form, fill:
   - Company name: `Infosis Technologies`
   - Role: `Software Engineer`
   - Package: `10.5`
   - Hired: `12`
   - Branches: `CS, IT`
8. Click **Add company** → it appears in the table.
9. Click **Home** → the new company is in the 2026 table; click it → its detail page exists automatically.

> "One company record gives you the table row, the search result, the branch filter and the multi-year detail page. Add a year to a company later and the detail page fills itself in."

10. (Optional, if time) **Edit** that company's role to `Technology Analyst` and save → public page changes again. Then **Delete** it and confirm → public page cleans up.

---

## 3. Access control — proving it's not just hidden buttons (45 seconds)

> "Hiding a button is not security. Let me show you the server actually refuses."

1. Click **Sign out**.
2. Sign in as `student@vjti.ac.in` / `Student123!`.
3. The **Admin** nav link is gone. Type `/admin` directly in the address bar → you are redirected to the homepage.
4. In a terminal (or a second tab), show one direct API call with no staff session:

   ```bash
   curl -i http://localhost:3001/api/admin/content
   # HTTP/1.1 401 Unauthorized
   ```

   If you are still signed in as the student in the browser, a direct call from that tab's context would be **403 Forbidden**. Either way, the write is refused.

> "A student can browse and submit their own experience, but only TPO staff can write placement data or decide what gets published. That rule lives on the server, so it holds even if someone bypasses the UI."

---

## 3b. Student conveniences — saved shortlist & account (30 seconds)

You are still signed in as the **student**. These two screens are the "little things that make students come back".

1. Click **Saved** in the nav. Two companies are already there from the seed.
   > "This shortlist is stored against my account on the server — not in the browser. Sign in as anyone else and it's empty."
2. Click **Microsoft** on a saved row → the company detail page. Press the **★ Saved** button beside the back link to remove it → the row disappears from **Saved**. Go back to **Companies**, find Microsoft and press **☆ Save** on its card → it returns.
3. Click the **Hi, Asha Patil** chip in the header (or open `/account`). Change **Full name** to `Asha Patil (Final year)` and click **Save details**. The header name updates immediately. Point at the read-only college email and the note: email and role are managed by the placement office; the API ignores attempts to change them.
4. In **Change password**, deliberately type a wrong current password and click **Update password** → *"Current password is incorrect."* Explain that the server verifies the old hash before accepting a new one, and that both profile and password changes appear in the audit log. Do **not** complete a real password change unless you reseed afterwards.
5. Click **Sign out**. The **Saved** link disappears; visiting `/saved` directly sends you to sign-in.

> "No local-storage tricks and no client-only hiding — the shortlist and the account fields are enforced by the same session on the server."

---

## 3c. Upcoming drives + application pipeline — what an unplaced student does next (60 seconds)

Sign in again as the **student** (`student@vjti.ac.in` / `Student123!`) — §3b ended with a sign-out. This is the answer to *"I've seen last year's stats — what do I do this week?"*

1. Click **Drives** in the nav. Three drives are already published with package, location, deadline countdown and eligibility pills.
   > "This is the live board, not last year's history. The TPO publishes one record here and every student sees the same deadline and eligibility."
2. Type `tata` in **Search drives** → only **Tata Motors** remains. Clear the search, tick **Only drives for my batch** → all three still show because Asha is IT/2027 and each drive includes her batch or is open to all. Say that this filter reads the account's branch/year from the session, not from the browser.
3. Microsoft and J.P. Morgan already say **Tracking ✓** (seeded applications). Click **+ Track application** on **Tata Motors** → the app creates a private row on the server and opens `/my-applications` with a green *"Now tracking Tata Motors"* notice.
4. The board has columns **Applied → Online assessment → Interview → Offer** (plus Rejected/Withdrawn when used). On the **J.P. Morgan Chase & Co.** card, change **Stage** to `Interview`, type a private note like `Technical round confirmed.`, click **Save** → the card moves columns.
   > "Each student owns their own pipeline. The notes are private — they are stored against my account and the API refuses to read or change anyone else's row."
5. **Sign out**, sign in as `contributor@vjti.ac.in` / `Contributor123!`, open `/my-applications` → the board is empty. Sign back out. That proves the rows are per user, not a shared list.
6. (Optional, 30 seconds) Sign in as `tpo@vjti.ac.in` / `Tpo123!`, open **Admin → Placement drives**. Point at the **Tracking** and **Self-reported offers** columns (Tata now has one applicant), then publish a test drive with deadline `2026-12-31`, eligible branch `Information Technology` and year `2027`. The green confirmation says eligible students were notified; sign in as the student again and the bell shows a **New drive** message linking to `/drives`.

> "Students get a concrete next action and a private tracker; TPO gets one publication point with audit entries and targeted alerts instead of a WhatsApp forward."

---

## 4. The differentiator — submit → review → publish live (90 seconds)

Sign in again as the **student** (`student@vjti.ac.in` / `Student123!`) after the §3c sign-out. If you skipped §3b/§3c, sign in now.

1. Click **My experiences** in the nav. There's a seeded Amazon write-up with an amber **Awaiting review** badge and an **Anonymous** chip.

   > "A student submitted this and chose to be anonymous. It's not on the public site yet — that's the whole point."

2. Click **+ Share a new experience**. Point at the three-step strip (*You submit → TPO reviews → Published*), then fill in:
   - Company: `Google`
   - Role: `Software Engineer`
   - Placement year: `2026`
   - Title: `Google — SDE (2026)`
   - Body: `OA had two coding questions in 90 minutes, then three interview rounds on DSA, system design and behavioural questions. Timed mock interviews helped the most.`
   - Tags: `Online Assessment, System Design, On-campus`
   - Choose **Anonymous** — point at the note: *"the TPO still sees your real name."*
3. Click **Submit for review**. The tracker shows the new item as **Awaiting review**; the public homepage still shows only the six approved write-ups.
4. **Sign out**, then sign in as `tpo@vjti.ac.in` / `Tpo123!`. Click **Reviews** in the nav.
5. Point at the dashed identity panel on the anonymous submissions: **"Submitted by Asha Patil · student@vjti.ac.in"**.

   > "This is the trust bit. The student asked for anonymity, so juniors see ‘Anonymous senior’ — but the TPO always knows who wrote it."

6. Click **Approve & publish** on the Google submission. Green confirmation appears. Click **Home** → the new write-up is on the public page with the **Anonymous senior** byline, while the queue still shows the real name. If you scroll to **What seniors say to prepare**, the counts have already picked up the new tags — that is §4b.
7. (Optional, 30 seconds) On the Barclays item, type a note and click **Request changes**. Sign in as `contributor@vjti.ac.in` / `Contributor123!`, open **My experiences** → the item now shows **Changes requested** and the exact feedback. Edit it → it goes back to **Awaiting review**.

> "One review click publishes; a rejection or change request is a real two-way conversation with the student, not a silent deletion. Nothing reaches the public site without staff approval."

**What's next if they ask:** *"Who manages the managers?"* — that's built too. Show §5.

If asked **"How do students become contributors?"** — they register with a `@vjti.ac.in` email and the TPO verifies they were actually placed, then promotes the account. In this demo both students and contributors can submit; contributors are the verified senior authors.

---

## 4b. What to prepare — common themes from the experiences (60 seconds)

No extra sign-in: this page is public, and you are still signed in as TPO from §4. This is the answer to *"I've read the experiences — what should I actually study?"*

1. Scroll to the bottom of the homepage: **What seniors say to prepare** shows the top three actionable themes with counts and a one-line action each, e.g. *"Mentioned in 4 of 7 write-ups"*. Point out that the counts include the Google write-up you just approved.
2. Click **Full prep plan →** (or the **Prep insights** nav link) → `/prep-insights`.
   - The three stat cards read **7 approved write-ups**, distinct themes and common themes.
   - **Your prep checklist** is the five most repeated *actionable* themes with a concrete next step each.
   - **All themes** shows a frequency bar per theme, the companies that mentioned it, and links to the source write-ups (`#id`) or a pre-filtered experience list.
3. Point at **DSA**: `4 of 7 · 57%`, seen at J.P. Morgan, Microsoft, Cisco and Goldman Sachs. Click one `#id` link → the approved write-up it came from.
4. Scroll to a process tag like **On-campus**: it appears at the top of the ranking but is marked as a process fact, not a prep task, so it is excluded from the checklist.
5. Say the trust line: *"Only approved write-ups feed this. The Amazon and Barclays submissions still waiting in the review queue cannot influence a single number, and no real name or email is exposed."*

> "The TPO doesn't write this list by hand. Every approval recomputes the ranking from the tags students actually used, so the advice stays current as more seniors contribute. It is frequency — what keeps coming up — not a guarantee, so it tells a student where to start rather than what to memorise."

**If you skipped §4:** the same page reads **6 approved write-ups** and DSA shows `4 of 6 · 67%`. Everything else is identical.

---

## 5. Who manages the managers — roles & audit (60 seconds)

Sign in as **TPO** (`tpo@vjti.ac.in` / `Tpo123!`) if you aren't already — the optional last step of §4 left you as a contributor.

1. Click **Admin** → the landing page has shortcut cards for reviews and accounts plus the CSV import panel. (A third shortcut, **Audit log**, appears only for the TPO in-charge.)
2. Click **Accounts & roles**. Search for `student@vjti.ac.in` and change the role dropdown from **Student** to **Contributor**, then click **Save**.

   > "The TPO verifies a senior was actually placed and grants contributor status in one click. No developer involved."

3. **Sign out**, sign in as `tpoi@vjti.ac.in` / `ChangeMe123!`, open **Admin → Accounts & roles**.

   > "This is the TPO in-charge account. Only this role can create other staff accounts or change staff roles — a regular TPO can't touch them."

4. Fill the **Create a staff account** form: name `Nisha Rao`, email `nisha@vjti.ac.in`, password `DemoStaff123!`, role **TPO staff** → **Create account**. Point out the new row in the table; mention the new person can now sign in immediately.
5. Change that new account's role to **Student** and click **Save**. Then, in a second browser tab signed in as `nisha@vjti.ac.in` / `DemoStaff123!`, try `/admin` — it redirects. The same cookie that worked a moment ago now has no admin access, without a re-login.

   > "Role changes are enforced on the server on every request. Revoke access and it's gone immediately — no waiting for a token to expire."

6. Back as TPOI, click **Admin → Audit log**. Point at the top rows: who, what (`change_role`, `create_staff`), the target (`nisha@vjti.ac.in: tpo -> student`) and the UTC time.

   > "Every staff action and every review decision is recorded. If someone asks 'who published this?' the answer is one search away."

Clean up after the demo: `npm run seed:demo` restores all seeded roles and passwords, but it keeps extra accounts like `nisha@vjti.ac.in`. For a truly clean slate, stop the servers, delete `server/data/placements.db`, then run `npm run seed && npm run seed:demo` (§7).

---

## 5b. Notifications & CSV import — closing the loop (60 seconds)

You are still signed in as **TPOI** from §5. These two features make the workflow feel finished rather than one-way.

**In-app notifications**

1. Point at the **🔔 bell** in the header — it has a red unread badge (`2` from the seeded pending submissions; more if you submitted in §4). Click it.
2. The **Notifications** page lists "New experience to review" with the Amazon/Barclays titles and an **Open →** link to the review queue.
   > "Every new or resubmitted write-up tells the staff inbox. Nothing depends on someone refreshing the review page."
3. Click **Mark all as read** → the message changes to *"You're all caught up"* and the badge disappears.
4. Sign out, sign in as `student@vjti.ac.in` / `Student123!`. The bell shows an unread badge again. Click it → **"Your experience was approved"** (plus the Google one if you did §4). Click **Open →** → the published write-up.
   > "The student gets the decision and a direct link, even when the write-up is anonymous to everyone else. The note from a change request or rejection appears here too."
5. On `/notifications`, click **Mark as read** on one row and show that only that row loses its highlight.

**CSV import**

6. Sign out, sign in as `tpo@vjti.ac.in` / `Tpo123!`, open **Admin**. In the **Import companies — 2026** card, paste this into the text box:

   ```csv
   name,role,package,hired,branches
   Wipro,Project Engineer,6.5,18,"CS,IT,Extc"
   ```

   Point at the quotes around `CS,IT,Extc`: *"commas inside a field must be quoted, so branches stay one value."*
7. Click **Import into 2026** → *"Imported 1 row(s): 1 new, 0 updated."* The company table shows **Wipro**; click **Home** to see it in the public table with its branch tags.
8. Now paste `name,role` + a row and click import again → red error **"Missing CSV column"** with the expected header listed.
   > "Every row is validated first. If anything is wrong, nothing is written — no half-imported year."
9. Re-paste the good CSV but change `6.5` to `7.0` and import → *"Imported 1 row(s): 0 new, 1 updated."* There is still exactly one Wipro row.
   > "Re-importing an updated spreadsheet edits the existing records instead of creating duplicates. That's how the office can keep a year's list in one sheet."

---

## 5c. Alumni outreach — bring companies via alumni (60 seconds)

Sign in as `tpo@vjti.ac.in` / `Tpo123!` if needed (end of §5b left you signed in as TPO). This shows the TPO **initiating contact** with previously placed alumni to help bring their current companies for **placement/internship** campus drives.

1. Open **Admin** → click **Alumni outreach** (`/admin/alumni`). Point at the seeded list: different outreach statuses, placed/current company, and referral/notes for contacts like Neha (interested/referral shared) and Meera (not contacted yet).
   > "TPO already knows who was placed where in previous years. This page turns that list into an outreach workflow — who to contact, for what drive, and what came back."

2. **CSV import:** in **Import alumni contacts (CSV)**, paste:
   ```csv
   full_name,email,branch,graduation_year,placed_company,current_company
   Karan Mehta,karan.mehta.alumni@example.com,IT,2022,Infosys,Infosys
   ```
   Click **Import contacts** → *"Imported 1 contact(s): 1 new, 0 updated."* Paste a bad header like `email,company` and try again → red error with the expected columns.
   > "TPO can upload their alumni/placed-student list. Re-importing the same email updates contact details but keeps outreach history."

3. **Compose & send (mailto/copy):** search for `Meera`, click **Select** on Meera Iyer. In **Outreach composer**, choose **Placement drive** (or Internship) → point at the personalized subject/message preview. Click **Open in mail app** or **Copy message**.
   > "Messages are personalized from known alumni data and sent from the TPO's mailbox now (mailto/copy). No SMTP is required for this MVP, but every outreach can still be tracked."

4. **Bulk actions:** keep `Meera` filtered (or clear filter and select multiple contacts). Tick Meera's checkbox (or **Select all visible**) → the bulk bar shows selection count. Click **Mark contacted now** in the bulk bar (optionally set a type first) → success toast and Meera's status becomes **Contacted** with a last-contacted timestamp.
   > "TPO can select many alumni, copy emails for BCC, apply a status/type/follow-up in bulk, or mark everyone contacted in one step."

5. **Track response/referral:** click **Select** on Neha (or search `Neha`), scroll to **Update outreach**. Show status/type, follow-up date, and referral company/contact/details/notes.
   > "When an alum replies, TPO records interest, follow-ups and the HR/referrer contact — the real outcome is a warm lead that can bring a company to campus."

**If asked what's next:** real in-app SMTP sending/logs, follow-up reminders/notifications, CSV export, and converting a referral into a company/drive record (and automated tests for this flow).

---

## 6. Close — the ask (30 seconds)

> "So: one place for verified numbers, staff-controlled updates, a trusted path for student experiences, a 'what to prepare' view built from those approved experiences, upcoming drives with a private application tracker for students who aren't placed yet, and a way for TPO to reach alumni to bring companies for campus drives. This is a demo on sample data, running locally. If it looks useful, I'd like to know which part your office would actually use first, and what data you'd want imported for a pilot."

Then ask two concrete questions:
1. **"Which screen would your team touch most — stats, companies, review queue, drives, prep insights, or alumni outreach?"**
2. **"What would you need to see before calling it a pilot?"** — if they mention an existing spreadsheet, point back to §5b (company CSV import) and §5c (alumni CSV import + outreach tracking/bulk actions).

Write the answers down. They decide what gets built next.

---

## 7. If something goes wrong

| Symptom | Fix |
|---|---|
| `http://localhost:5173/api/content` returns HTML, not JSON | The Vite dev server is stale. Stop it (`Ctrl+C` in the `dev:full` terminal), rerun `npm run dev:full`. Vite only reads `vite.config.js` at startup. |
| API errors / "Couldn't load placement data" | Check the API tab shows *"VJTI Placements API listening on http://localhost:3001"*. If not, run `npm run dev:api`. |
| Port 3001 or 5173 already in use | Stop the process holding the port: `Get-NetTCPConnection -LocalPort 3001 -State Listen` then `Stop-Process -Id <OwningProcess> -Force`. |
| Login says "Incorrect email or password" | Run `npm run seed:demo` again — it restores all demo passwords. |
| Login says "Password must be at least 8 characters" | Stale frontend bundle from before the sign-in validation fix. Hard-refresh (`Ctrl+F5`) or restart Vite. `Tpo123!` is 7 characters and is valid for sign-in; the 8-character rule applies only when creating a new account. |
| Changes don't show up after saving | The admin panel refreshes public data automatically. If the tab was left open for a long time, hard-refresh (`Ctrl+F5`). |
| Review queue looks empty | Run `npm run seed:demo` — it inserts two pending submissions. |
| Approve button does nothing | A note is only required for **Reject** and **Request changes**; Approve is one click. If the item was already reviewed, it cannot be reviewed again. |
| "Accounts & roles" shows no audit card / audit link 403s | Audit is TPOI-only — sign in as `tpoi@vjti.ac.in`. |
| **Saved** page looks empty | Run `npm run seed:demo` — it inserts two student bookmarks. Also confirm you are signed in as `student@vjti.ac.in`; every other account starts with an empty shortlist. |
| Save button does nothing / shows a sign-in link | You are signed out. Sign in first — bookmarks are per user and the button becomes a ★ toggle. |
| Account page says "Current password is incorrect" | That is correct behaviour if you typed the wrong old password. Use `Student123!` for the seeded student, or reseed with `npm run seed:demo`. |
| The bell has no unread badge | You are signed out, you already clicked **Mark all as read**, or you are the contributor (whose seeded note is already read). Run `npm run seed:demo` to restore the sample notifications. |
| `/prep-insights` is empty or shows a theme you didn't expect | The page needs at least one **approved** write-up. Run `npm run seed:demo`; pending submissions are ignored by design. Counts change after §4 because the Google write-up was approved. |
| `/drives` looks empty | Run `npm run seed:demo` — it inserts three drives. Also check the status filter isn't set to **Closed** or that the search box isn't still filtering. |
| "Track application" says *You are already tracking this drive* | That drive's Microsoft/J.P. Morgan seeded application already exists for the demo student. Use **Tracking ✓** to open the board, or track Tata Motors instead. |
| A drive publish shows no student notification | Notifications are targeted by branch + graduation year only. Use eligible branch `Information Technology` and year `2027` for the demo student, or leave both blank for everyone. |
| CSV import says "Missing CSV column" | The first line must be exactly `name,role,package,hired,branches` (order does not matter, names do). The error lists the expected header. |
| CSV import reports "Line 2: …" errors | Check that `package` is a number ≥ 0, `hired` is a whole number ≥ 0, and no company name is duplicated. No rows were written — fix the file and try again. |
| CSV import says "Choose a CSV file first" | Paste rows into the text box or choose a `.csv` file before clicking **Import into {year}** (companies) or **Import contacts** (alumni). |
| Alumni CSV import says "Missing required CSV columns" | Alumni import expects at least `full_name` (or `name`) and `email`. Check the header and quoted commas; fix and re-import (no rows are written on validation errors). |
| Alumni bulk action does nothing / shows an error | Select at least one contact and choose an action (status/type/follow-up or **Mark contacted now**). Use **Select all visible** if you filtered the list; reseed with `npm run seed:demo` to restore sample contacts. |
| `npm run test:ui` says port 3107 is in use | Stop the stale UI test server: `Get-NetTCPConnection -LocalPort 3107 -State Listen`, then `Stop-Process -Id <OwningProcess> -Force`. |
| Browser suite cannot find a browser | On this Windows machine, run `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui`. In CI Chromium is installed automatically. |
| Want a completely clean slate | Stop servers, delete `server/data/placements.db`, then `npm run seed && npm run seed:demo`. |

After the presentation, restore the sample state with `npm run seed:demo` and refresh the browser. If you created a test staff account in §5, follow the clean-slate row above instead to remove it.

---

## 8. Optional deeper cut (only if asked)

- **Tech:** React 19 + Vite frontend, Express 5 + Node's built-in `node:sqlite` backend, bcrypt + signed JWT in an httpOnly cookie, server-side role middleware. No native modules to compile.
- **Data:** `server/data/placements.db`; content immediately available at `GET /api/content`.
- **Public experience API:** `GET /api/content` carries approved cards only (stable id, company, role, year, excerpt, tags, display byline). `GET /api/experiences/:id` returns the full approved write-up and 404s for pending/rejected/unknown ids. Neither endpoint exposes real names, college emails or staff review notes.
- **Review API:** `POST /api/experiences` (always pending), `PUT /api/experiences/:id` (own open items only), `GET /api/experiences/mine`, `GET /api/admin/experiences`, `POST /api/admin/experiences/:id/review`. Accepted review actions are `approve`, `reject` and `request_changes`.
- **Staff API:** `GET /api/admin/users`, `POST /api/admin/users` (TPOI only), `PUT /api/admin/users/:id/role`, `GET /api/admin/audit` (TPOI only). Role changes take effect on the next request because the user is reloaded from the DB.
- **Bookmark/account API:** `GET`/`POST`/`DELETE /api/bookmarks` (scoped to `req.user.id`, real slugs only), `PUT /api/me` (display fields only — `email` and `role` are ignored), `POST /api/me/password` (current password required). All five refuse anonymous callers with 401.
- **Notification/import API:** `GET /api/notifications` and `POST /api/notifications/:id/read` / `read-all` (every row scoped to `req.user.id`); `POST /api/admin/companies/import` (tpo/tpoi) validates the whole CSV, returns per-line `details` on failure, and upserts by `(year, slug)` on success. Submit/resubmit/review handlers create the notifications server-side.
- **Alumni outreach API:** `GET /api/admin/alumni`, `POST /api/admin/alumni/import` (upsert by email, outreach state preserved), `PUT /api/admin/alumni/:id` and `PUT /api/admin/alumni/bulk` (tpo/tpoi, audited). Outreach sending is mailto/copy in this MVP (no SMTP).
- **Audit:** every submission, edit, review, staff write, CSV/company/alumni import, outreach update/bulk action, drive create/update/delete, application create/update/delete, role change, profile edit and password change records who did it and when (`audit_log` table), readable at `/admin/audit`.
- **Drives/application API:** `GET /api/drives` is public; `GET`/`POST`/`PUT`/`DELETE /api/applications` are session-scoped (one private row per user + drive, statuses `applied`/`oa`/`interview`/`offer`/`rejected`/`withdrawn`); `GET`/`POST`/`PUT`/`DELETE /api/admin/drives` are tpo/tpoi-only. Publishing audits `create_drive` and notifies only students whose branch/year match; every application change is audited too.
- **Prep insights:** `prepInsights` is computed in `server/insights.js` from the public `experiences` array in the same `GET /api/content` response — no extra request. Tags are counted once per approved write-up; a theme is "common" at ≥ half the write-ups (minimum two); the checklist is the five highest-ranked actionable themes. Pending submissions, private names, emails and staff notes never enter the calculation. The advice copy is curated per tag, and unknown tags get generic guidance.
- **Testing:** `npm test` runs 48 automated API integration tests and `npm run test:ui` runs 14 Playwright browser flows, both on throwaway databases — demo data is never touched. `npm run lint` is clean. Locally the browser suite uses Edge via `PLAYWRIGHT_CHANNEL=msedge`; CI uses Chromium.
- **Deployment:** `npm run build && npm start` serves the API and the built React app from one Express process on `:3001`, including deep-link fallback for routes like `/admin`.
- **Known limitations:** prep insights are tag-frequency advice, not AI or TPO-verified guidance, and free-text tag variants are counted separately. The 4 high `npm audit` advisories are dev-tooling only (`picomatch` ReDoS via Vite); no patched version exists upstream, and the production Express server is unaffected. Don't expose the Vite dev server to an untrusted network.
