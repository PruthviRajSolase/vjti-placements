# VJTI Placements — development notes

This file holds the detailed internals, design decisions, tutorial-style explanations and development log. [`README.md`](./README.md) is the short, practical entry point (setup, scripts, links to the other docs), and [`DEMO.md`](./DEMO.md) is the presentation script.

> **Important:** all numbers and write-ups shown in the UI are **sample/dummy data** for a presentation, not official TPO records. A working backend (auth + SQLite + role permissions) now exists behind the app. Older source files still contain teaching comments labelled `STEP 1` through `STEP 10`; newer backend/API files are labelled `Phase 1` / `Phase 2`.
>
> **Note on history:** earlier changelog entries below were originally written in the combined README and still say “this README” or “README section 13”. They are kept verbatim; after the documentation split they refer to this file and to its product-specification section.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Features](#4-features)
5. [Routes](#5-routes)
6. [State ownership](#6-state-ownership)
7. [Data model](#7-data-model)
8. [Design system & styling](#8-design-system--styling)
9. [Archived vanilla version](#9-archived-vanilla-version)
10. [Tutorial progression](#10-tutorial-progression)
11. [Current status & known limitations](#11-current-status--known-limitations)
12. [Future work / roadmap](#12-future-work--roadmap)
13. [Product specification](#13-product-specification)
14. [Changelog & development log](#14-changelog--development-log)
15. [Demo runbook (DEMO.md)](#15-demo-runbook-demomd)

---

## 1. Quick start

```bash
cd D:\Placement
npm install          # only needed once / after changing dependencies
npm run seed         # create the first TPOI admin (once, on an empty DB)
npm run seed:demo    # load presentation data + all demo accounts (safe to repeat)
npm run dev:full     # start API (:3001) AND Vite (:5173) together ← use this to present
npm run dev          # frontend only -> http://localhost:5173/
npm run dev:api      # backend only -> http://localhost:3001/api/health
npm run build        # production build into dist/
npm run preview      # preview the production build locally
npm start            # production: ONE Express process serves API + built SPA on :3001
npm test             # 48 API integration tests (isolated temp database)
npm run lint         # ESLint across src/, server/, tests/ and config files
npm run test:ui      # build + 14 Playwright browser tests (isolated temp database)
```

- `npm run test:ui` drives **Edge** on this Windows machine via `PLAYWRIGHT_CHANNEL=msedge`; CI uses bundled Chromium. In PowerShell: `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui`. It builds first, then serves the production app on port **3107** with a throwaway SQLite DB, so demo data is never touched.

- Web: **http://localhost:5173/** · API health: **http://localhost:3001/api/health** · content: `GET /api/content`
- **Before presenting:** run `npm run seed:demo`, then `npm run dev:full`. Restart Vite after changing `vite.config.js` — a stale dev server will not apply the `/api` proxy and every API call will silently return `index.html` instead of JSON.
- Dev TPOI login: `tpoi@vjti.ac.in` / `ChangeMe123!` (override with `TPOI_EMAIL` / `TPOI_PASSWORD` before `npm run seed`).
- Demo accounts (all created by `seed:demo`):

  | Role | Email | Password |
  |---|---|---|
  | TPO staff | `tpo@vjti.ac.in` | `Tpo123!` |
  | TPO in-charge | `tpoi@vjti.ac.in` | `ChangeMe123!` |
  | Student | `student@vjti.ac.in` | `Student123!` |
  | Contributor | `contributor@vjti.ac.in` | `Contributor123!` |
  | Experience authors | `aditya@` / `priya@` / `rahul@vjti.ac.in` | `Author123!` |

- Sign-up accepts only `@vjti.ac.in` email addresses and creates a `student` account; TPO promotes verified students to `contributor`.
- `seed:demo` gives the student two saved companies (so **Saved** has content on first open), sample notifications (two unread submissions for staff, one unread approval for the student and one already-read review note for the contributor), sample alumni outreach contacts in different states, six approved write-ups (used by prep insights), three upcoming drives and two private student applications. Reseeding clears old notifications, alumni contacts, applications and drives first.
- Set `JWT_SECRET` in the environment for anything beyond local development.
- **Deploying:** run `npm run build` then `npm start`. Express serves `dist/` and the API from one origin on `:3001`; deep links such as `/admin` fall back to `index.html`, while unknown `/api/*` paths stay JSON 404s. `public/_redirects` gives the same SPA fallback on static hosts (e.g. Netlify). Use `API_PORT` to change the port.
- `DB_PATH` overrides the SQLite file location; `npm test` uses it to run against a throwaway database so demo data is never touched.
- Hot Module Replacement is enabled on the frontend; use `dev:full` so the API is up too.
- `.gitignore` excludes `node_modules`, `dist`, `server/data/` (the SQLite file) and `.env`.
- Full reset: stop the servers, delete `server/data/placements.db`, then `npm run seed && npm run seed:demo`.

---

## 2. Tech stack

| Item | Detail |
|---|---|
| Frontend | React 19.1 (`react`, `react-dom`) |
| Routing | `react-router-dom` 7.18.5 (`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useParams`, `useNavigate`, `useLocation`) |
| Build tool | Vite 7 (installed 7.3.8) with `@vitejs/plugin-react` 5; `/api` proxied to `:3001` in dev |
| Module system | ESM (`"type": "module"` in `package.json`) — frontend and backend |
| Styling | Plain CSS with custom properties — no CSS framework |
| Backend | Node + Express 5 on port 3001; Node's built-in `node:sqlite` (no native build) |
| Auth | bcryptjs hashes + jsonwebtoken signed token in an httpOnly, SameSite=Lax cookie; user reloaded from DB per request |
| Data | SQLite at `server/data/placements.db`; `src/data.js` remains only as the demo seed's source of sample content |
| Tests | `npm test` — 48 Node `node:test` API checks + `npm run test:ui` — 14 Playwright browser flows, both on isolated temp DBs |
| Lint / CI | ESLint 10 flat config (`eslint.config.js`) + `.github/workflows/ci.yml` (lint, API tests, build, browser tests) |
| Browser automation | `@playwright/test` 1.65 — Edge channel locally, Chromium in CI |
| Version control | Git + GitHub: `PruthviRajSolase/vjti-placements`, default branch `main`; `.github/workflows/ci.yml` runs on pushes and PRs |

---

## 3. Project structure

```
D:\Placement
├── README.md                      # short entry point: setup, scripts, links
├── DEVELOPMENT.md                 # THIS FILE — internals, design notes, dev log
├── index.html                     # SPA shell: empty <div id="root"> + module script
├── public/_redirects              # SPA fallback for static hosts (Netlify-style)
├── package.json / package-lock.json
├── vite.config.js                 # Vite + React plugin
├── eslint.config.js               # ESLint 10 flat config (src, server, tests, configs)
├── playwright.config.js           # Playwright browser suite on an isolated prod server
├── .github/workflows/ci.yml       # lint → API tests → build → browser tests
├── .gitignore
├── dist/                          # production build output (generated)
├── node_modules/                  # dependencies (generated)
├── DEMO.md                        # presentation click-through script + accounts
├── scripts/
│   └── serve-ui-test.js           # starts built app on :3107 with a throwaway DB
├── tests/
│   ├── api.test.js                # 48 HTTP integration tests on a throwaway DB (npm test)
│   └── ui/portal.spec.js          # 14 Playwright browser flows (npm run test:ui)
├── vanilla-version/               # ARCHIVED Steps 1–6, plain HTML/CSS/JS
│   ├── index.html
│   ├── style.css
│   ├── data.js
│   └── script.js
├── server/                        # Express API (Phases 1–8)
│   ├── index.js                   # routes + production static/SPA fallback
│   ├── start.js                   # production entry point (NODE_ENV=production)
│   ├── db.js                      # node:sqlite connection, DB_PATH override, publicUser()
│   ├── schema.sql                 # users, experiences, audit_log, stats, companies, branch_stats, saved_companies, notifications, alumni_contacts, drives, applications
│   ├── auth.js                    # JWT cookie, requireAuth / requireRole / optionalAuth
│   ├── content.js                 # shapes public/staff content + approved-only detail lookup + prepInsights
│   ├── insights.js                # ranks approved experience tags into prep themes and advice
│   ├── csv.js                     # RFC-4180-ish CSV parser for staff/company and alumni imports
│   ├── seed.js                    # creates only the first TPOI
│   ├── seed-demo.js               # presentation data + 7 accounts + 2 bookmarks + notifications + alumni contacts + 6 approved write-ups + 3 drives + 2 applications
│   └── data/placements.db         # generated, gitignored
└── src/
    ├── main.jsx                   # ErrorBoundary + BrowserRouter + Auth/Bookmarks/Content/Notifications providers
    ├── App.jsx                    # theme + year state, routes, demo banner, loading/error states
    ├── api.js                     # fetch wrapper for /api (cookies included, error.details preserved)
    ├── AuthContext.jsx            # real session: signIn / signUp / signOut / updateUser / /auth/me
    ├── BookmarksContext.jsx       # GET /api/bookmarks + per-user save/remove state
    ├── ContentContext.jsx         # GET /api/content + refresh() after admin saves
    ├── NotificationsContext.jsx   # GET /api/notifications + unread count + mark-read actions (Phase 8)
    ├── data.js                    # sample data — imported by seed-demo.js only (6 approved write-ups)
    ├── index.css                  # complete stylesheet (incl. admin, account, alumni, drives and prep-insight styles)
    ├── pages/
    │   ├── HomePage.jsx           # composition of the homepage sections
    │   ├── CompaniesPage.jsx      # /companies grid
    │   ├── CompanyPage.jsx        # /company/:slug dynamic detail page
    │   ├── DrivesPage.jsx         # /drives — public upcoming drives, filters and tracking
    │   ├── MyApplicationsPage.jsx # /my-applications — private application pipeline board
    │   ├── ExperienceDetailPage.jsx # /experience/:id — full approved write-up
    │   ├── PrepInsightsPage.jsx   # /prep-insights — ranked themes + checklist from approved write-ups
    │   ├── SignInPage.jsx         # /signin real login/register with demo credentials
    │   ├── AdminPage.jsx          # /admin TPO panel: stats, companies (incl. CSV import), branch %
    │   ├── ReviewQueuePage.jsx    # /admin/reviews staff review queue with real identities
    │   ├── AdminUsersPage.jsx     # /admin/users — roles, contributor grants, staff creation (TPOI)
    │   ├── AuditLogPage.jsx       # /admin/audit — TPOI-only readable audit trail
    │   ├── AdminAlumniPage.jsx    # /admin/alumni — TPO outreach to alumni (import, mailto/copy, tracking, bulk actions)
    │   ├── AdminDrivesPage.jsx    # /admin/drives — TPO drive CRUD with applicant/offer counts
    │   ├── SubmitExperiencePage.jsx # /submit + /submit/:id — write/resubmit a reviewable write-up
    │   ├── MyExperiencesPage.jsx  # /my-experiences — student submission tracker + feedback
    │   ├── SavedCompaniesPage.jsx # /saved — private shortlist from /api/bookmarks
    │   ├── AccountPage.jsx        # /account — profile + password settings
    │   ├── NotificationsPage.jsx  # /notifications — private review/submission inbox (Phase 8)
    │   └── NotFoundPage.jsx       # catch-all 404
    └── components/
        ├── ErrorBoundary.jsx      # catch render crashes, show reload/retry fallback
        ├── RequireRole.jsx        # cosmetic route guard (server is the real gate)
        ├── RequireAuth.jsx        # thin wrapper for any signed-in page
        ├── Header.jsx             # brand, nav (+ Prep insights/Drives/My applications/Saved/Admin links), notification bell, auth slot, theme toggle
        ├── Footer.jsx
        ├── Hero.jsx               # title + year tabs
        ├── YearTabs.jsx           # reusable 2024/2025/2026 selector
        ├── StatsSection.jsx       # four stat cards from API content
        ├── CompaniesSection.jsx   # homepage table + search + branch filters from API content
        ├── CompanyCard.jsx        # one tile in the /companies grid, with Save button
        ├── BookmarkButton.jsx     # shared save/remove toggle for cards, detail and Saved page
        ├── BranchSection.jsx      # branch-wise table from API content
        ├── ExperiencesSection.jsx # approved write-ups + search/company/year/topic filters
        └── PrepInsightsSection.jsx # homepage preview of common prep themes
```

---

## 4. Features

### 4.1 Sample data source — `src/data.js`
> No browser component imports these arrays any more. `server/seed-demo.js` imports them once to fill the SQLite database; public pages read that data through `GET /api/content`.

- `CURRENT_YEAR = "2026"` — default selection.
- `STATS_BY_YEAR` — students placed, highest package, average package, companies visited, for 2024 / 2025 / 2026.
- `COMPANIES_BY_YEAR` — 8 companies (2026), 5 (2025), 4 (2024). Fields: `name`, `role`, `package` (LPA number), `hired`, `branches[]`.
- `BRANCH_STATS_BY_YEAR` — 7 engineering branches × 3 years with placement percentages.
- `EXPERIENCES` — 6 approved write-ups: `company`, `heading`, `excerpt`, `tags[]`, `author { name, branch, year }`. Tags are the raw material for prep insights.
- `slugify(name)` — `"J.P. Morgan Chase & Co."` → `"jp_morgan_chase_co"` (lowercase, `&` → `and`, non-alphanumeric runs → `_`, trim).
- `COMPANIES_BY_SLUG` — startup-built index: `slug → { year → company }`, which powers the dynamic detail route without repeated searches.

### 4.2 Homepage (`/`)
- **Hero** — site title, description, reusable `YearTabs`.
- **StatsSection** — four cards derived from `content.stats[year]` (API).
- **CompaniesSection** — interactive table:
  - search by company name or role (case-insensitive, trimmed)
  - branch filter pills derived from the data via `flatMap` + `Set`
  - live "Showing X of Y companies" count
  - friendly "no matches" row
  - company names link to `/company/<slug>`
- **BranchSection** — placement % table; values ≥ 90% are bolded.
- **ExperiencesSection** — the public write-up library: cards with excerpt/tags/author, hover lift animation, plus search and company/year/topic filters (filters live in the URL query string so a view is shareable). Cards link to `/experience/:id`.
- **PrepInsightsSection** — a preview of the three most repeated actionable themes with counts and a link to `/prep-insights`.

### 4.3 Companies page (`/companies`)
- Intro with year tabs (shared state with the homepage).
- Responsive grid of `CompanyCard`s showing name, role, package, hired count and "View details →". The card body is a link; a sibling **Save** button pins to its corner.
- Signed-out visitors see a sign-in prompt in place of the Save button; signed-in users get an instant ★ toggle backed by `POST`/`DELETE /api/bookmarks`.

### 4.4 Company detail page (`/company/:slug`)
- `useParams()` reads the slug; `content.companiesBySlug` returns that company's visits keyed by year.
- One card per year, newest first: role, package, students hired, eligible-branch tags.
- "Roles across years" summary (deduplicated with `Set`).
- A Save/★ control beside the back link toggles the same private shortlist as the grid.
- Unknown slug → in-page friendly not-found with a back link.
- `useEffect` scrolls to top whenever the slug changes.

### 4.5 Sign-in / auth UI (`/signin`) — Phase 2, real API
- Sign-in ↔ sign-up toggle in one form; controlled inputs for name, branch, graduation year (sign-up), email and password.
- Validation: email format, **`@vjti.ac.in` domain required**, password ≥ 8 characters, name required for sign-up; inline errors with `role="alert"`.
- `POST /api/auth/login` / `POST /api/auth/register` set an httpOnly cookie. No password or session token is stored in `localStorage` any more.
- `AuthContext` calls `GET /api/auth/me` on mount, so a page reload keeps the session from the server, not from browser storage.
- On success, `useNavigate()` returns the user to `location.state.from`; staff see an extra "Open admin panel" link.
- The card lists all demo credentials for the presenter.
- Header shows a real `<Link to="/signin">` when signed out; when signed in it shows **Saved**, a notification **bell** with an unread badge, a "Hi, <full name>" chip that links to `/account`, and a working **Sign out** button, plus role-aware **My experiences** / **Reviews** / **Admin** links. These links are cosmetic; the API re-checks the session and role.

### 4.6 404 page (`*`)
- Catch-all `NotFoundPage` with a link back to the homepage.

### 4.7 Styling & accessibility
- Design tokens as CSS variables: `--bg`, `--surface`, `--text`, `--text-soft`, `--border`, `--accent`, `--accent-soft`, `--good`, `--mid`, `--radius`, `--shadow`. Changing `--accent` restyles the whole site.
- Sticky rounded header, centered `max-width: 1100px` sections, CSS Grid card layouts, striped/hover tables, pill buttons.
- Responsive breakpoint at **760px**: header wraps to two rows, tables become horizontally scrollable via `.table-scroll`, spacing tightens.
- `prefers-reduced-motion` support, visible `:focus` outlines, semantic `scope="col"` headers, `<noscript>` warning in `index.html`.

### 4.8 Dark mode switch — Step 10
- Moon/sun button in the header (with a visible "Dark"/"Light" action label) toggles `data-theme` on `<html>`; `aria-pressed` and a descriptive `aria-label` keep it accessible. The toggle reads the current value from the DOM attribute (not from a possibly stale React closure) and applies the new value immediately, so it can never get stuck on one mode.
- `:root[data-theme="dark"]` only redefines the CSS variables — every component restyles automatically. Added `--surface-alt` for striped rows plus dark overrides for the fixed-colour error/notice blocks.
- A tiny inline script in `index.html` applies the theme **before first paint** (no white flash), using the saved choice or falling back to the OS `prefers-color-scheme` on a first visit.
- Explicit user choices persist in `localStorage` under `vjti-placements-theme`; all storage access is try/catch-guarded.

### 4.9 Content API + TPO admin panel — Phase 2
- `GET /api/content` returns the entire public data set in one request: `currentYear`, `stats`, `companiesByYear`, `companiesBySlug`, `branchStatsByYear`, `experiences` (approved only) and `prepInsights` (derived from those experiences only).
- `ContentProvider` shares that object and exposes `refresh()`, called after every admin save so public pages update without a manual reload.
- `GET /api/admin/content` returns raw rows (with ids) for editing; all admin routes run `requireAuth` + `requireRole("tpo", "tpoi")`.
- Write endpoints: `PUT /api/admin/stats/:year`, `POST /api/admin/companies`, `PUT /api/admin/companies/:id`, `DELETE /api/admin/companies/:id`, `PUT /api/admin/branch-stats/:year`. Every write also inserts an `audit_log` row.
- `/admin` has three cards: yearly statistics, company CRUD with an editable table, and branch percentages for the selected year. Year tabs are shared with the public pages.
- `RequireRole` hides `/admin` in the UI for non-staff; the API independently returns 401/403, so hiding the link is not the security boundary.
- Global demo banner and footer disclaimer state that the numbers are samples, not official TPO records.

### 4.10 Experience submission + review — Phase 3
- `/submit` — students and contributors write a company/role/year/title/body/tags and choose **named** or **anonymous** publication. The API always stores `status = 'pending'`; the client cannot self-publish.
- `/submit/:id` — edit only your own `pending` or `changes_requested` submission. Editing clears the old review note, resets the reviewer and returns the item to `pending`.
- `/my-experiences` — the student's tracker: status badge, staff feedback, reviewer name, date, and an Edit button while the item is still open.
- `/admin/reviews` — staff queue with filter tabs and counts. Each card shows the **real** author name, email and branch even for anonymous submissions, plus the review note and reviewer.
- Review actions: **Approve & publish** (one click; public content refreshes immediately), **Request changes** and **Reject** (both require a note that the student can read).
- Server rules: only `student`/`contributor` may submit or edit their own open item; only `tpo`/`tpoi` may read the queue or review; already-reviewed items cannot be reviewed twice (409).
- Public `/api/content` carries only approved rows and display names — no real identities, emails or review notes can leak through it.

### 4.11 Staff controls + audit log — Phase 4
- `/admin/users` — searchable account list with role badges and inline role editing. **TPO** may only grant/revoke `contributor` for students; **TPOI** may change any role and create new `tpo`/`tpoi` accounts with a college email and temporary password.
- Safety rails enforced on the server: nobody can change their own role, TPO cannot touch staff accounts, and the last TPOI cannot be demoted. Because `auth.js` reloads the user from the DB on every request, a role change revokes access on the very next request — no re-login or token wait.
- `/admin/audit` (TPOI only) — readable log of registrations, staff writes, submissions, edits and reviews: actor name + email, action, target and UTC timestamp, with a search box.
- The admin landing page now links to all three staff tools (reviews, accounts, audit).

### 4.12 Experience search, filters and detail pages — Phase 5
- `/api/content` now gives every approved write-up a stable `id`, `role`, `placementYear`, a ≤180-character `excerpt`, `tags` and a public byline. The browser derives filter options from those fields — no hard-coded company/tag lists.
- Filters in `ExperiencesSection`: free-text search across company, role, title, excerpt, tags and author; a company dropdown; a year dropdown; and topic pills. They combine with AND, show a live "Showing X of Y write-ups" count, have a one-click **Clear filters**, and an empty state with the same escape hatch. State is stored in `?q=&company=&year=&tag=` via `useSearchParams`, so a filtered view can be bookmarked or shared.
- Each card links to `/experience/:id` and passes the active filters in router state; the detail page's **← All experiences** link restores them.
- `GET /api/experiences/:id` returns the full approved body plus display fields. It deliberately has **no auth requirement** but is server-gated: non-approved, unknown and malformed ids all return JSON 404, and the payload never contains `realName`, `email`, `reviewNote` or `@vjti` addresses. The same rule applies to pending write-ups before approval — not even the author can open a public detail page.
- `ExperienceDetailPage` fetches that endpoint on mount/id change, shows loading and friendly not-found states, renders the body with preserved line breaks, links each topic back to a filtered list, and shows **More at {company}** plus the usual role-aware submit CTA.
- Deep links work in production: `npm start` serves `/experience/:id` through the SPA fallback (verified).

### 4.13 Saved companies & account settings — Phase 6
- `/saved` is a **private shortlist**. `GET /api/bookmarks` returns only rows whose `user_id` matches the session cookie; the browser never filters a global list. The seeded student has two saves (Microsoft and J.P. Morgan Chase & Co.).
- The same `BookmarkButton` works on company cards, the company detail page and the Saved list. Saving an unknown slug is refused server-side (404), and duplicate saves are idempotent (`ON CONFLICT DO NOTHING`). Deletes are scoped to `user_id`, so guessing another user's slug cannot remove their bookmark.
- Signed-out visitors are sent to `/signin` with a `state.from` return path; providers clear the cache on sign-out and reload it on sign-in.
- `/account` edits `full_name`, `branch` and `graduation_year` via `PUT /api/me`, then calls `updateUser()` so the header name changes immediately. `email` and `role` are shown read-only and are **not accepted** by the API — this page cannot be used to escalate privileges.
- Password changes require the current password plus an ≥8-character new password (`POST /api/me/password`); both profile and password changes write `audit_log` entries. Existing sessions stay valid because cookies track the user id, not the password.
- Route guards (`RequireAuth`) hide these pages from anonymous visitors, but the server is still the real boundary: every bookmark/profile/password endpoint returns 401 without a session.

### 4.14 Notifications and staff CSV import — Phase 8
- `/notifications` is a **private inbox** behind `RequireAuth`. `GET /api/notifications` selects only rows whose `user_id` matches the session, newest first, with an `unreadCount`; `POST /api/notifications/:id/read` and `POST /api/notifications/read-all` also filter by `req.user.id`, so guessing another user's id returns 404.
- The header bell shows the unread badge and links to the inbox; the page supports per-item and bulk mark-as-read and links each message to `/experience/:id`, `/my-experiences` or `/admin/reviews`. `NotificationsContext` reloads on sign-in and when the tab regains focus.
- New or resubmitted write-ups notify every `tpo`/`tpoi` ("New experience to review" / "Experience resubmitted"). Every review decision notifies the real author with the reviewer's note: approval links to the published detail page, changes/rejection link back to `/my-experiences`. Anonymous write-ups still notify the author privately.
- `/admin` has a card to paste CSV or choose a `.csv` file and import companies into the selected year. The browser reads the file as text and posts `{ year, csv }`; `server/csv.js` handles quoted fields, escaped quotes, CRLF and a BOM.
- The server validates **every** row before writing anything: four-digit year, required `name,role,package,hired,branches` header, numeric package (≥ 0), whole-number hired (≥ 0), duplicate company detection and a 50,000-character limit. Any problem returns HTTP 400 with per-line `details` and zero rows written; `src/api.js` preserves those details on the thrown error so the card can list them all.
- Company imports **upsert by `(year, slug)`**, so re-importing an edited file updates existing companies instead of duplicating them. The response reports `{ imported, created, updated }`; the write is recorded in `audit_log` as `import_companies`.

### 4.15 Alumni outreach (TPO-initiated)
- `/admin/alumni` (TPO/TPOI) is a staff workflow for contacting **previously placed students/alumni** to ask them to help bring their current company for **placement** and/or **internship** campus drives. Alumni are managed as TPO contact records (not app user accounts).
- **Import:** paste/upload CSV via `POST /api/admin/alumni/import` (reuses `server/csv.js`). Required columns: `full_name` (or `name`) and `email`; optional: `phone, branch, graduation_year, placed_company, placed_role, placed_year, current_company`. Every row is validated before writing; imports **upsert by email** (contact fields updated, outreach status/notes/referrals preserved).
- **Outreach:** select a contact, choose a **Placement / Internship / Placement + Internship** template, personalize placeholders (name, batch/branch, placed/current company), then **open in mail app (mailto)** or copy subject/message/email. No SMTP/in-app sending is configured in this MVP.
- **Tracking:** per-contact status (`not_contacted`, `contacted`, `responded`, `interested`, `referred`, `not_interested`, `no_response`), outreach type, last contacted/follow-up dates, current company, response notes and referral details (company/contact/notes). **Mark contacted now** timestamps the outreach and promotes `not_contacted → contacted` when appropriate.
- **Bulk actions:** multi-select (including select-all visible), **copy selected emails**, and bulk **apply** (status/type/follow-up) or **mark contacted now** via `PUT /api/admin/alumni/bulk` (transactional, audited as `bulk_alumni_outreach`; import/update audited as `import_alumni` / `update_alumni_outreach`). `seed:demo` includes sample alumni contacts in different outreach states.

### 4.16 Upcoming drives + private application pipeline (Phase 10)
- `/drives` is public: company, role, package, location, registration deadline, drive date, apply link and eligibility pills (branches + graduation years), with search by company/role/branch, open/closed/all filtering and an optional "Only drives for my batch" toggle for signed-in users. Countdown badges highlight deadlines under three days.
- "Track application" is a real `POST /api/applications` call (not just a link). It creates a private row for the signed-in user and navigates to `/my-applications` with a success notice; already-tracked drives show **Tracking ✓** and link to the board instead.
- `/my-applications` is a private kanban-style board grouped by stage: `applied`, `oa`, `interview`, `offer`, `rejected`, `withdrawn`. Saving a card issues `PUT /api/applications/:id` for its status and notes; Remove issues `DELETE /api/applications/:id` after confirmation. Every query is scoped by `req.user.id`, so another student's card cannot be read or changed by guessing an id.
- `/admin/drives` (TPO/TPOI) publishes, edits and deletes drives, sees applicant and offer counts per drive, and can close a drive without deleting it. All writes append to `audit_log` (`create_drive`, `update_drive`, `delete_drive`).
- Publishing a drive calls `notifyEligibleStudents()`: students/contributors whose `branch` and `graduation_year` match are notified through the existing private inbox; an empty eligibility list means everyone. The alert links to `/drives`.
- This feature deliberately reuses existing infrastructure: role guards, notifications, audit logging and per-user scoping. It gives unplaced students a concrete "what to do next" view while giving TPO a single publication point instead of circulating messages.

### 4.17 Prep insights from student experiences (Phase 11)
- `server/insights.js` counts each tag once per **approved** experience and produces `topics` (tag, count, share %, category, companies, source ids, advice/action), `commonTopics` (≥ half the write-ups), and a five-item `checklist`. `buildPrepInsights()` is fed the already-public `publicExperiences()` rows, so pending write-ups and private identities can never influence it.
- Advice is a curated map keyed by the tags seniors actually submit (`DSA`, `Online Assessment`, `Resume Projects`, `Behavioral`, `SQL`, `Aptitude`, `System Design`, `Core Mechanical`, `HR Interview`, `On-campus`, …). Unknown tags still surface with a generic "find a write-up and mirror its plan" prompt; process-only tags like `On-campus` are marked `actionable: false` and excluded from the checklist.
- `/prep-insights` renders the checklist, frequency bars for every theme, the companies that mentioned it, and links back to the source write-ups or a pre-filtered experience list. The homepage section previews the top three themes. Both read `content.prepInsights` from `ContentContext`; no extra request and no client-side recomputation.
- `seed:demo` now has six approved write-ups so the ranking is meaningful: `On-campus` 6/6, `DSA` 4/6, `Resume Projects` 4/6, `Behavioral` 4/6, `SQL` 3/6, `Aptitude` 3/6. Approving a new experience refreshes the ranking automatically because `ContentContext.refresh()` reloads `/api/content`.

---

## 5. Routes

| URL | Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Hero, stats, companies table with filters, branch table, experiences |
| `/companies` | `CompaniesPage` | Year tabs + company card grid |
| `/company/:slug` | `CompanyPage` | Multi-year detail for one company |
| `/drives` | `DrivesPage` | Public upcoming drives, deadlines, eligibility filters and tracking |
| `/my-applications` | `MyApplicationsPage` (behind `RequireRole`, student/contributor) | Private application pipeline with stage and notes editing |
| `/experience/:id` | `ExperienceDetailPage` | Full approved write-up (public, server-gated) |
| `/prep-insights` | `PrepInsightsPage` | Ranked preparation themes and checklist from approved write-ups |
| `/signin` | `SignInPage` | Real sign-in / registration against the API |
| `/submit` | `SubmitExperiencePage` | Student/contributor writes a submission (always pending) |
| `/submit/:id` | `SubmitExperiencePage` | Student edits their own pending submission |
| `/my-experiences` | `MyExperiencesPage` | Student submission tracker + staff feedback |
| `/saved` | `SavedCompaniesPage` (behind `RequireAuth`) | Private, server-scoped company shortlist |
| `/notifications` | `NotificationsPage` (behind `RequireAuth`) | Private review/submission inbox with mark-as-read |
| `/account` | `AccountPage` (behind `RequireAuth`) | Edit display details, change password |
| `/admin` | `AdminPage` (behind `RequireRole`) | TPO-only stats, company and branch editor |
| `/admin/reviews` | `ReviewQueuePage` (behind `RequireRole`) | TPO review queue: approve, reject, request changes |
| `/admin/alumni` | `AdminAlumniPage` (behind `RequireRole`, `tpo`/`tpoi`) | Alumni outreach: CSV import, mailto/copy templates, tracking and bulk actions |
| `/admin/drives` | `AdminDrivesPage` (behind `RequireRole`, `tpo`/`tpoi`) | Publish/edit/close/delete drives; see applicant and offer counts |
| `/admin/users` | `AdminUsersPage` (behind `RequireRole`) | Roles, contributor grants, staff account creation |
| `/admin/audit` | `AuditLogPage` (behind `RequireRole`, TPOI only) | Readable audit trail |
| `*` | `NotFoundPage` | 404 catch-all |

> Deployment note: `BrowserRouter` requires the host to rewrite unknown paths to `index.html`, otherwise direct visits to `/companies` etc. will 404 on a static server.

---

## 6. State ownership

| State | Owner | Purpose / lifetime |
|---|---|---|
| `year` | `App` | Shared by homepage + companies page; lives above `<Routes>` so it survives navigation |
| `user`, `loading` | `AuthContext` | Shared by Header, SignInPage, RequireRole, AccountPage; source of truth is the server session cookie, rechecked via `/auth/me` on load; `updateUser()` applies a saved profile immediately |
| `bookmarks`, `isSaved`, `toggle`, `refresh` | `BookmarksContext` | Shared shortlist from `GET /api/bookmarks`; cleared on sign-out, reloaded on sign-in; one toggle updates every card and the Saved page |
| `notifications`, `unreadCount`, `markRead`, `markAllRead`, `refresh` | `NotificationsContext` | Private inbox from `GET /api/notifications`; drives the header badge and `/notifications`; reloaded on sign-in and tab focus |
| `drives`, `tracked`, `search`, `status`, `onlyMine`, `busyId` | `DrivesPage` | Public drive list plus the signed-in user's tracked ids; filters are local because the list is small; `track()` posts an application before navigating |
| `items`, `drafts`, `message`, `busyId` | `MyApplicationsPage` | Private application rows and unsaved stage/note drafts, keyed by application id; reloaded after each save/delete |
| `drives`, `form`, `editingId`, `message`, `busy` | `AdminDrivesPage` | Staff drive list and the publish/edit form; local drafts only, with one success/error message |
| `content`, `loading`, `error`, `refresh` | `ContentContext` | Shared by all public pages + AdminPage; one `GET /api/content` (including derived `prepInsights`), refreshed after admin writes |
| `theme` | `App` | Shared with Header; mirrored to `<html data-theme>` and persisted after explicit toggles |
| `search`, `branch` | `CompaniesSection` | Local to the homepage table |
| `mode`, `name`, `email`, `password`, `error` | `SignInPage` | Local form state |
| `raw`, `statsForm`, `companyForm`, `branchRows` | `AdminPage` | Raw editable rows and form state, local to the admin panel |
| `csvText`, `csvFileName` | `AdminPage` | Pasted/uploaded CSV text and chosen filename for the Phase 8 import card |
| `form`, `error` | `SubmitExperiencePage` | Form state; preloaded from `/experiences/mine` when editing |
| `items`, `notice` | `MyExperiencesPage` | Own submissions and success message after submit/edit |
| `profile`, `passwords`, `notice`, `error`, `busy` | `AccountPage` | Local draft for profile/password forms, success/error text and in-flight state |
| `data`, `filter`, `notes`, `busyId` | `ReviewQueuePage` | Staff queue, active status tab, per-card note drafts, pending action |
| `users`, `drafts`, `search`, `staff` | `AdminUsersPage` | Account list, unsaved role selections, search text, new-staff form |
| `entries`, `search` | `AuditLogPage` | Audit rows and search text |
| `alumni`, `selectedId`, `selectedIds`, `edit`, `bulk*`, composer fields | `AdminAlumniPage` | Local alumni list, per-contact selection/edit, bulk selection/actions and outreach composer/import drafts |
| `q`, `company`, `year`, `tag` | URL query via `useSearchParams()` in `ExperiencesSection` | Shareable write-up filters; no extra requests |
| `experience`, `loading`, `error` | `ExperienceDetailPage` | Full write-up fetched from `/api/experiences/:id` |
| `slug` | URL via `useParams()` | Input to `CompanyPage` |
| `id` | URL via `useParams()` | Input to `ExperienceDetailPage` and `SubmitExperiencePage` when editing |

Rule in use: **lift state up** when more than one component needs it; otherwise keep it local.

---

## 7. Data model

**Database tables** (`server/schema.sql`, SQLite at `server/data/placements.db`):

| Table | Key columns | Purpose |
|---|---|---|
| `users` | `id`, `full_name`, `email` (unique), `password_hash`, `role`, `branch`, `graduation_year` | Accounts and permissions |
| `experiences` | `id`, `user_id`, `company`, `role`, `placement_year`, `heading`, `body`, `tags` (JSON), `visibility`, `status`, `review_note`, `reviewed_by` | Student write-ups + review state |
| `audit_log` | `id`, `actor_id`, `action`, `target`, `created_at` | Record of staff writes |
| `stats` | `year`, `students_placed`, `highest_package`, `average_package`, `companies_visited` | Homepage numbers |
| `companies` | `year`, `name`, `slug`, `role`, `package_lpa`, `hired`, `branches` (JSON) | Visiting companies |
| `branch_stats` | `year`, `branch`, `percent` | Branch placement table |
| `saved_companies` | `id`, `user_id`, `slug`, `company_name`, `created_at` | Private per-user shortlist, unique on `(user_id, slug)`, cascades on user delete |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at` | Private per-user messages for submission/review events; unread rows sort first |
| `alumni_contacts` | `id`, `full_name`, `email` (unique), contact/batch/placed/current-company fields, `outreach_status`, `outreach_type`, `last_contacted_at`, `follow_up_at`, notes/referral fields | TPO-managed alumni outreach contacts and response/referral tracking (staff-only, not user accounts) |
| `drives` | `id`, `company`, `role`, `package_lpa`, `location`, `eligibility_branches` (JSON), `graduation_years` (JSON), `registration_deadline`, `drive_date`, `apply_link`, `description`, `status` (`open`/`closed`), `created_by` | Upcoming drives published by TPO staff; indexed by status/deadline |
| `applications` | `id`, `user_id`, `drive_id`, `status`, `notes`, timestamps | Private per-student pipeline, unique on `(user_id, drive_id)`; both foreign keys cascade on delete |

**API content object** (`server/content.js` → `GET /api/content`), shaped to match what the old React components expected:

```js
{
  currentYear: "2026",
  stats: { "2026": { studentsPlaced, highest, average, companies }, ... },
  companiesByYear: { "2026": [ { name, role, package, hired, branches[] }, ... ] },
  companiesBySlug: { "microsoft": { "2026": {...}, "2025": {...} } },
  branchStatsByYear: { "2026": [ { branch, percent }, ... ] },
  experiences: [
    { id, company, role, placementYear, heading, excerpt, tags[],
      author: { name, branch, year } }
  ],
  prepInsights: {
    totalExperiences, topicCount, commonCount,
    topics: [
      { tag, category, count, share, companies[], experienceIds[],
        advice, action, actionable }
    ],
    commonTopics: [...],   // count >= half of totalExperiences
    checklist: [           // top 5 actionable topics
      { tag, category, why, action, companies[], experienceIds[] }
    ]
  }
}
```

Public `experiences` contain only rows with `status = 'approved'`; anonymous rows get the display name "Anonymous senior". The staff/student endpoints carry `realName`, `email` and `reviewNote` — deliberately absent from the public payload. Statuses are `pending` → `approved` / `changes_requested` / `rejected`; an edit of a `changes_requested` item resets it to `pending`. `src/data.js` still holds the original arrays, but only `server/seed-demo.js` imports them.

`GET /api/experiences/:id` returns `{ experience }` with `{ id, company, role, placementYear, heading, body, tags[], createdAt, author: { name, branch, year } }` for an **approved** row only (404 otherwise). `createdAt` is the submission timestamp, not a review decision. Neither public endpoint exposes identity or staff notes; filtering is done client-side over the content already loaded.

**Phase 6 API:** `GET /api/bookmarks` → `{ bookmarks: [{ slug, name, createdAt }] }` for the session user only; `POST /api/bookmarks` accepts a real company `slug`; `DELETE /api/bookmarks/:slug` removes only that user's row. `PUT /api/me` updates `{ fullName, branch, graduationYear }` and returns the fresh public user; `POST /api/me/password` checks the current password and stores a new bcrypt hash. All five routes require a session; profile writes never accept `email` or `role`.

**Phase 8 API:** `GET /api/notifications` → `{ notifications: [{ id, type, title, body, link, readAt, createdAt }], unreadCount }` (max 50, newest/unread first); `POST /api/notifications/:id/read` marks one row read and 404s when it is not the caller's; `POST /api/notifications/read-all` clears only the caller's unread rows. `POST /api/admin/companies/import` (tpo/tpoi) accepts `{ year, csv }` and returns `{ ok, imported, created, updated }` after validating and upserting every row; validation failures are HTTP 400 with `{ error, details: ["Line 2: …", …] }`. Notifications are created by the submit/resubmit/review handlers, not by the browser.

**Alumni outreach API (tpo/tpoi):** `GET /api/admin/alumni` lists contacts and outreach/referral state; `POST /api/admin/alumni/import` accepts `{ csv }`, validates every row, and upserts by email (contact fields updated, outreach state preserved) returning `{ ok, imported, created, updated }` or 400 with `details`; `PUT /api/admin/alumni/:id` updates outreach tracking/referral fields; `PUT /api/admin/alumni/bulk` applies status/type/follow-up and/or `markContacted` to selected contacts transactionally. Writes are audited (`import_alumni`, `update_alumni_outreach`, `bulk_alumni_outreach`). Outreach sending is mailto/copy-driven (no SMTP endpoint).

**Prep insights API:** `prepInsights` is computed in `server/insights.js` from the public `experiences` array in the same `/api/content` response. A tag is counted at most once per write-up; `share` is rounded to a whole percent, `commonTopics` need at least half the write-ups (and at least two), and `checklist` takes the five highest-count actionable topics. Only company names, public ids and tags are emitted — no author identity or private note. The excerpt constant is 179 characters plus an ellipsis so card previews stay ≤ 180.

**Drives/applications API:** `GET /api/drives` is public and returns drives ordered by status then registration deadline; `GET /api/applications` returns only the session user's rows, joined to drive fields. `POST /api/applications` accepts `{ driveId, status?, notes? }` and refuses missing/closed/unknown drives and duplicates (400/404/409). `PUT /api/applications/:id` accepts `{ status?, notes? }`; `DELETE /api/applications/:id` removes only the caller's row. Statuses are `applied`, `oa`, `interview`, `offer`, `rejected`, `withdrawn`. Staff endpoints are `GET`/`POST`/`PUT`/`DELETE /api/admin/drives` (tpo/tpoi); admin list and create/edit responses include `applicantCount` and `offerCount`. Publishing writes `create_drive` to the audit log and sends targeted `drive` notifications; all drive/application writes are audited.

---

## 8. Design system & styling

- `src/index.css` is the single stylesheet, organised in numbered sections (some out of numeric order because sections were appended as the project grew).
- All colours/spacing come from `:root` variables.
- `.btn-primary`, `.btn-signin`, `.btn-signout`, `.pill`, `.year-tab` are the shared interactive styles.
- Auth UI (section 15), API-UI additions (section 16: demo banner, loading states, admin cards/tables) reuse the same tokens; small-screen overrides live inside the `@media (max-width: 760px)` block.
- Phase 5 filters/detail styles are in section 19: `.experience-filters` / `.filter-select` / `.exp-tag-filters`, clickable `.experience-card`, `.experience-body` with `white-space: pre-wrap`, and related-write-up links.
- Phase 6 styles are in section 20: `.company-card` as a positioned `<article>` with a full-size `.company-card-link` and a floating `.bookmark-btn`; `.floating`, `.saved` and `:disabled` states; `.company-detail-actions`; `.saved-list` / `.saved-item` / `.saved-link` / `.saved-hint`; `.account-form` / `.field-hint` / `.form-success` plus a dark-theme success notice and mobile fallbacks.
- Phase 8 styles are in section 21: `.notification-link` / `.notification-badge` in the header, `.notification-toolbar` / `.notification-list` / `.notification-item.unread` / `.notification-dot` / `.notification-actions`, and the `.csv-import-card` controls (`.csv-format`, `.csv-controls`, `.csv-file-label`, `.csv-paste-label`) plus `.admin-message-details` for per-row validation errors.
- Alumni outreach styles are in section 22: outreach composer/template controls, status pills/badges, `.alumni-bulk-bar` / bulk controls, selected-row highlighting and responsive fallbacks.
- Drives/pipeline styles are in section 23: `.drive-filters` / `.drive-mine-toggle`, `.drive-grid` / `.drive-card` / `.drive-deadline.urgent`, `.drive-eligibility` pills, and `.pipeline-board` / `.pipeline-column` / `.application-card` with stacked labels and mobile fallbacks.
- Prep insight styles are in section 24: `.insight-card-grid` / `.insight-card` / `.insight-rank`, `.insight-stats`, `.prep-checklist` / `.checklist-index`, `.insight-topic-grid` / `.insight-topic` / `.insight-bar`, and mobile stacking rules.

---

## 9. Archived vanilla version

`vanilla-version/` holds the original plain HTML/CSS/JS build from Steps 1–6, kept for side-by-side comparison. It uses empty containers filled by `renderStats()`, `renderCompanies()`, `renderBranchPills()`, `renderBranches()`, `renderExperiences()`, manual state variables, `innerHTML`, event delegation and `data-*` attributes. It needs no build step — open `vanilla-version/index.html` directly.

---

## 10. Tutorial progression

| Step | Content | Where |
|---|---|---|
| 1–4 | HTML structure, CSS, responsive design | `vanilla-version/` |
| 5 | Data + rendering functions | `vanilla-version/data.js`, `script.js` |
| 6 | State, events, search/filtering, year tabs | `vanilla-version/script.js` |
| 7 | React migration: components, JSX, props, hooks, ES module imports | `src/components/`, `src/data.js`, `src/index.css` |
| 8 | React Router: routes, dynamic slug route, 404, extracted reusable components | `src/App.jsx`, `src/main.jsx`, `src/pages/` |
| 9 | Client-side auth UI: controlled form, validation, shared user state, localStorage | `src/pages/SignInPage.jsx`, `App.jsx`, `Header.jsx`, `index.css` |
| 10 | Dark mode: CSS-variable theme swap, pre-paint inline script, persistence | `index.html`, `src/App.jsx`, `src/components/Header.jsx`, `src/index.css` |
| Phase 1 | Express + SQLite backend, bcrypt/JWT auth, server-side roles | `server/` |
| Phase 2 | API-driven frontend, demo seed, TPO admin panel, role guard, demo banner | `src/api.js`, `src/AuthContext.jsx`, `src/ContentContext.jsx`, `src/pages/AdminPage.jsx`, `server/seed-demo.js`, `DEMO.md` |
| Phase 3 | Experience submission, student tracker, staff review queue, anonymity | `src/pages/SubmitExperiencePage.jsx`, `src/pages/ReviewQueuePage.jsx`, `server/content.js` |
| Phase 4 | Staff account creation, role management, audit log UI | `src/pages/AdminUsersPage.jsx`, `src/pages/AuditLogPage.jsx`, `server/index.js` |
| Quality pass | Automated API tests, error boundary, single-process deployment, audit review | `tests/api.test.js`, `src/components/ErrorBoundary.jsx`, `server/start.js` |
| Phase 5 | Approved-only experience detail API, shareable search/company/year/topic filters, detail page | `server/content.js`, `src/components/ExperiencesSection.jsx`, `src/pages/ExperienceDetailPage.jsx` |
| Phase 6 | Private saved companies, account settings, server-scoped bookmarks | `server/schema.sql`, `server/index.js`, `src/BookmarksContext.jsx`, `src/components/BookmarkButton.jsx`, `src/pages/SavedCompaniesPage.jsx`, `src/pages/AccountPage.jsx` |
| Phase 7 | Browser smoke tests, ESLint and CI pipeline | `playwright.config.js`, `eslint.config.js`, `.github/workflows/ci.yml`, `tests/ui/portal.spec.js` |
| Phase 8 | In-app notifications + staff CSV import | `server/csv.js`, `server/schema.sql`, `server/index.js`, `src/NotificationsContext.jsx`, `src/pages/NotificationsPage.jsx`, `src/pages/AdminPage.jsx` |
| Phase 9 | Alumni outreach (post-Phase 8) | `server/schema.sql`, `server/index.js`, `server/csv.js`, `src/pages/AdminAlumniPage.jsx`, `tests/api.test.js`, `tests/ui/portal.spec.js` |
| Phase 10 | Upcoming drives + private application pipeline | `server/schema.sql`, `server/index.js`, `server/seed-demo.js`, `src/pages/DrivesPage.jsx`, `src/pages/MyApplicationsPage.jsx`, `src/pages/AdminDrivesPage.jsx`, `tests/api.test.js`, `tests/ui/portal.spec.js` |
| Phase 11 | Prep insights from approved write-ups | `server/insights.js`, `server/content.js`, `src/components/PrepInsightsSection.jsx`, `src/pages/PrepInsightsPage.jsx`, `tests/api.test.js`, `tests/ui/portal.spec.js` |

---

## 11. Current status & known limitations

**Working (demo slice):**
- All routes (including `/drives`, `/my-applications`, `/notifications` and `/admin/alumni`); year switching; stats, company search/branch filters, branch table, company detail pages and the filterable write-up library now read from `GET /api/content`.
- Real accounts: college-email registration, bcrypt login, httpOnly cookie session restored via `/auth/me`, working sign-out.
- Server-enforced permissions: 401 without a session, 403 for students on every admin route (verified by HTTP smoke test).
- TPO admin panel: edit stats, add/edit/delete companies, set branch percentages; saves immediately refresh public pages.
- `npm run seed:demo` recreates realistic data and all presentation accounts.
- Phase 3: student submission + editing, own-submission tracker, and a staff review queue with real identities, named/anonymous choice, approve/reject/request-changes and student-visible feedback. Approval updates the public site immediately.
- Phase 4: TPOI can create staff accounts and change roles; TPO can grant contributor; role changes revoke access on the next request. Readable audit log for TPOI.
- Quality pass: `npm test` runs 48 isolated API integration tests, `npm run test:ui` runs 14 real-browser flows against the built app, `npm run lint` is clean, and `.github/workflows/ci.yml` wires them together; a React error boundary prevents blank screens; `npm start` serves the API + built SPA from one Express process with deep-link fallback.
- Phase 5: public write-up library with shareable search/company/year/topic filters and approved-only detail pages (`/experience/:id`); privacy enforced by both the list and detail endpoints.
- Phase 6: private company shortlist and account settings. Bookmarks are scoped by `req.user.id`, only real company slugs can be saved, profile edits cannot change email/role, and password changes require the current password. Demo seed includes two student bookmarks.
- Phase 8: private notification inbox (bell + unread badge) for submission and review events; staff CSV import with full-row validation, per-line error details and upsert-by-`(year, slug)`. All notification reads/writes are scoped by `req.user.id`, and import is tpo/tpoi-only.
- Alumni outreach (post-Phase 8): TPO/TPOI can import alumni contacts (CSV, upsert by email), compose personalized placement/internship outreach via **mailto/copy** (no SMTP), track status/follow-ups/notes/referrals, and run **bulk actions** (select visible, copy emails, bulk apply, mark contacted). APIs are staff-only and audited; `seed:demo` includes sample contacts.
- Phase 10: public upcoming drives with deadline/eligibility filters and targeted publish notifications; private per-student application pipeline with stage/notes editing; TPO drive CRUD with applicant/offer counts. All writes are audited and all student reads/writes are scoped by `req.user.id`; `seed:demo` includes three drives and two student applications.
- Phase 11: public `/prep-insights` page plus a homepage preview that turn tags from approved write-ups into a ranked "what to prepare" checklist, with counts, frequency bars, source companies/ids and a curated next action per theme. The ranking is derived server-side from `publicExperiences()` only, so pending submissions and private identities never influence it.
- Dark mode, responsive layout, 404 page, demo banner; `npm run build` succeeds (81 modules, CSS 37.91 kB, JS 367.89 kB).

**Not built / limitations:**
- Search is per section — there is no single global search across stats, companies and write-ups.
- Alumni outreach uses **mailto/copy + manual tracking** (no SMTP/in-app sending, delivery logs, or automated follow-up reminders). Referred companies/contacts are tracked as notes/fields, not converted into company/drive records.
- Browser coverage is a 14-flow smoke suite, not exhaustive or visual-regression tested. Notifications update on sign-in and tab focus rather than live polling. CI is configured and now runs on GitHub because the folder is a git repository.
- Prep insights are **tag-frequency advice**, not AI-generated or TPO-verified guidance. Tags are free text, so synonyms/spelling variants split a theme (`Behavioral`/`behavioural` share one advice entry but not one count); a theme is ranked by how many write-ups mention it, not by how strongly it affected the outcome. There is no per-company/per-role breakdown yet, and the advice copy is curated in `server/insights.js` — adding a new tag yields generic guidance until that map is extended.
- Drives show eligibility and filter by it, but tracking a drive is not hard-gated by branch/batch; the TPO still owns eligibility decisions. There is no aggregate funnel/dashboard yet — `applicantCount` and `offerCount` are the only staff-side metrics.
- Vite dev server must be restarted after editing `vite.config.js` (stale proxy serves `index.html` for `/api/*`).
- `npm audit` reports 4 high-severity advisories from `picomatch` (via `fdir`/`tinyglobby`/Vite). They affect **dev tooling only** — the Express production server has no vulnerable dependency. No patched `picomatch` version exists upstream; older Vite majors were checked and trade this for more serious dev-server advisories, so Vite 7.3.8 was kept deliberately. Do not expose the Vite dev server to an untrusted network.
- Minor behaviour difference from vanilla: homepage search text is not reset when the year changes (harmless with the current branch data).

---

## 12. Future work / roadmap

Candidate next steps, in no particular order:

1. **TPO dashboard:** live funnel counts from `applications` (applied → OA → interview → offer), upcoming deadlines, pending reviews and unplaced-by-branch — using real per-student placement status instead of typed-in percentages.
2. **Prep insights upgrades:** per-company/per-role breakdowns, tag synonym normalization, and TPO review of the advice copy. The first version — a ranked, actionable checklist from approved write-up tags — is **DONE (Phase 11)**.
3. **Alumni outreach upgrades:** real SMTP/in-app sending (logs, sender config), follow-up reminders/due-today view + notifications, CSV export of outreach/referrals, and converting a referral into a company/drive record.
4. Optionally add live notification polling / push and expand the browser suite beyond smoke flows.
5. Revisit `npm audit` when `picomatch` ships a fix.
6. ~~**Upcoming drives + private application pipeline**~~ **DONE (Phase 10)** · ~~**Automated tests for alumni outreach and bulk actions**~~ **DONE (2026-11-19)** · ~~**Alumni outreach MVP (import, mailto/copy, tracking, bulk actions)**~~ **DONE (post-Phase 8)** · ~~**Notifications + CSV import**~~ **DONE (Phase 8)** · ~~**Browser tests + linter/CI**~~ **DONE (Phase 7)** · ~~**Student conveniences**~~ **DONE (Phase 6)** · ~~**Experience detail pages and filters**~~ **DONE (Phase 5)** · ~~**Quality pass**~~ **DONE** · ~~**Dark mode toggle**~~ **DONE** · ~~**Real backend / API / TPO admin / review workflow / staff controls**~~ **DONE (Phases 1–4)**.

---

## 13. Product specification

This is the **real build** the static demo is being converted into: a placement portal for students (stats, visiting companies, interview experiences), with staff-managed content and a review workflow for student-submitted experiences.

### 13.1 Vision

- **Students** see verified placement stats, companies that visited campus, interview experiences from seniors who were actually placed, and common preparation themes derived from those approved write-ups.
- **Placed students** can contribute their own experience, but it is published only after staff review.
- **TPO staff** own the data and the review queue; the **TPOI** owns the whole system (accounts, roles, permissions).

### 13.2 Roles and permissions

| Role | Who | Permissions |
|---|---|---|
| `visitor` | not signed in | Read published stats, companies, approved experiences and derived prep insights |
| `student` | signed up with a `@vjti.ac.in` email | Everything a visitor can do + submit experiences, edit own open submissions, track feedback, receive private review notifications, save companies, track private drives/applications, read prep insights and manage own profile/password |
| `contributor` | placed student, verified and granted by TPO | Same submission, notification and application rights as `student`, plus recognition as a verified senior author |
| `tpo` | placement staff | CRUD placement data (including CSV import), publish/manage drives and see aggregate applicant counts, review/approve/reject experiences, grant/revoke `contributor` |
| `tpoi` | head of placement (super admin) | Everything + create staff accounts, manage roles, view audit log |

**Locked decisions:** Node + Express + SQLite backend · TPOI is super-admin above TPO moderators · students choose named or anonymous publication (TPO always sees real identity) · open sign-up with college email, TPO grants contributor status after verification.

### 13.3 Experience workflow

```
student submits ──► pending ──► TPO approves ──► approved (public)
                       │
                       ├──► changes_requested ──► student edits ──► pending
                       └──► rejected (with reason)
```

- Statuses: `pending`, `approved`, `changes_requested`, `rejected`.
- Students see only their own submissions; TPO sees the full review queue.
- `visibility`: `named` or `anonymous` — controls public attribution only.
- Every permission check is enforced **on the server**; UI hiding is cosmetic.

### 13.4 Data model (SQLite schema)

- `users` — `id`, `full_name`, `email` (unique, case-insensitive), `password_hash`, `role`, `branch`, `graduation_year`, timestamps.
- `experiences` — `id`, `user_id`, `company`, `role`, `placement_year`, `heading`, `body`, `tags` (JSON), `visibility`, `status`, `review_note`, `reviewed_by`, timestamps.
- `audit_log` — `id`, `actor_id`, `action`, `target`, `created_at`.
- `companies`, `stats`, `branch_stats` (added in Phase 2) replace the hardcoded arrays in `src/data.js`; all content writes are recorded in `audit_log`.
- `saved_companies` (Phase 6) — `id`, `user_id`, `slug`, `company_name`, `created_at`; unique per `(user_id, slug)` so shortlists are private and idempotent. Profile/password edits update `users.full_name` / `branch` / `graduation_year` / `password_hash` only; `email` and `role` stay under staff control.
- `notifications` (Phase 8) — `id`, `user_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at`; one row per recipient per event, cascading on user delete. Every read/write is scoped to the session user; staff get `submission` rows and authors get `review` rows.
- `alumni_contacts` (post-Phase 8) — `id`, `full_name`, `email` (unique), contact/batch/placed/current-company fields, `outreach_status`, `outreach_type`, `last_contacted_at`, `follow_up_at`, response/referral fields, timestamps. TPO-managed outreach records (not user accounts); imports upsert by email and writes are audited.
- `drives` (Phase 10) — `id`, `company`, `role`, `package_lpa`, `location`, `eligibility_branches` / `graduation_years` (JSON arrays), `registration_deadline`, `drive_date`, `apply_link`, `description`, `status`, `created_by`, timestamps. Published by TPO/TPOI; publication alerts matching students.
- `applications` (Phase 10) — `id`, `user_id`, `drive_id`, `status`, `notes`, timestamps; unique per `(user_id, drive_id)`. Private per student; `user_id` and `drive_id` cascade on delete.

### 13.5 Architecture

- **Frontend:** existing React 19 + Vite SPA on port 5173.
- **Backend:** Express on port 3001 using Node's built-in `node:sqlite` (no native build step).
- **Auth:** bcrypt password hashes + signed JWT in an httpOnly, SameSite=Lax cookie; server re-reads the user from the DB on every request so revoked roles take effect immediately.
- **Dev wiring:** Vite proxies `/api` → `http://localhost:3001`, so the browser sees one origin.
- **DB file:** `server/data/placements.db` (gitignored).
- **Secrets:** `JWT_SECRET`, `TPOI_EMAIL`, `TPOI_PASSWORD` from environment variables.

### 13.6 Build phases

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Roles, workflow, data model, architecture documented here | ✅ Done |
| 1 | DB schema, auth API (register/login/logout/me), role middleware, seeded TPOI | ✅ Done |
| 2 | TPO admin panel (stats/companies CRUD); public pages read from API; demo seed | ✅ Done — presentable vertical slice |
| 3 | Experience submission + review workflow, anonymity | ✅ Done — student form, tracker, staff queue |
| 4 | TPOI user management (grant/revoke roles), audit log UI | ✅ Done — staff creation, role matrix, audit trail |
| 5 | Experience search/filters + approved-only detail pages; deployment | ✅ Done — write-up library and `/experience/:id` |
| 6 | Private saved companies + account settings | ✅ Done — `/saved`, `/account`, server-scoped bookmarks |
| 7 | Browser smoke tests, ESLint and CI pipeline | ✅ Done — Playwright, ESLint 10, GitHub Actions |
| 8 | Notifications, CSV import, deeper browser coverage | ✅ Done — private inbox + validated staff CSV import |
| 9 | Alumni outreach (post-Phase 8) | ✅ Done — TPO-initiated alumni contact import, mailto/copy outreach, tracking/referrals, bulk actions |
| 10 | Upcoming drives + private application pipeline | ✅ Done — public drive list, TPO publication, targeted alerts, private student pipeline |
| 11 | Prep insights from approved write-ups | ✅ Done — ranked themes, five-item prep checklist and homepage preview |

---

## 14. Changelog & development log

> **Working agreement:** after every task, add a dated entry here describing what was done, which files changed, and how it was verified. Keep older entries; never rewrite history.

### 2026-11-19 — Full-product QA sweep (bug fixes)

- Ran an end-to-end QA pass over every route and role on throwaway databases: public pages, filters, details, prep insights, student bookmarks/account/notifications/submission/drive tracking, the review workflow (approve, request changes, resubmit, publish) and the TPO/TPOI admin tools (stats, companies + CSV, branches, drives, alumni outreach, staff creation, live role revocation, audit search). A temporary six-test Playwright harness covered all of it and was deleted after the run; the permanent suites are unchanged.
- Fixed a real bug in `src/pages/AdminPage.jsx`: `saveCompany` passed an already-started `api()` promise to `run()`, which calls `action()`, so **Add company** / **Update** failed with `M is not a function` even though the API itself worked. `run()` now returns a success flag and the company form is cleared only after a successful save.
- Verified: `npm run lint` clean, `npm test` 48/48, and the full QA harness 6/6 in Edge, including TPOI staff creation, immediate revocation in a second browser session and audit-log search.

### 2026-11-19 — Prep insights from approved write-ups (Phase 11)

- Added `server/insights.js`: counts each tag at most once per **approved** experience, ranks topics by frequency/share, marks a theme "common" at ≥ half the write-ups (minimum two), and builds a five-item checklist from the highest-ranked actionable topics. A curated `TOPIC_ADVICE` map supplies category, advice and a concrete next action; unknown tags fall back to generic guidance and process-only tags (`On-campus`, `3 Rounds`) are excluded from the checklist. `server/content.js` now calls `buildPrepInsights(publicExperiences())` and returns the result as `prepInsights` in `GET /api/content` — pending submissions and private identities never enter the calculation.
- Expanded the demo seed from three to six approved write-ups (`src/data.js`) with realistic tag overlap (`On-campus` 6/6, `DSA` 4/6, `Resume Projects` 4/6, `Behavioral` 4/6, `SQL` 3/6, `Aptitude` 3/6); `server/seed-demo.js` cycles the three author accounts so every write-up has a real owner. The excerpt constant is now 179 characters plus an ellipsis to keep card previews at ≤180.
- Added `src/components/PrepInsightsSection.jsx` (homepage preview of the top three themes), `src/pages/PrepInsightsPage.jsx` (`/prep-insights`: stats, checklist, all-theme frequency bars, source companies/ids and links to a pre-filtered experience list), the `/prep-insights` route and nav link in `src/App.jsx` / `src/components/Header.jsx`, and section 24 styles in `src/index.css`.
- Added two API tests (ranking/advice/common-theme rules and public-source-only citations), one Playwright flow (prep page counts + homepage preview), and updated the experience counts/filters from 3 to 6. Updated `README.md`, `DEMO.md` and this file.
- Verified: `npm run lint` clean; `npm test` **48/48 pass** (12 suites, isolated temp DB); `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui` **14/14 pass** in Edge on a throwaway DB; `npm run build` succeeds (81 modules, CSS 37.91 kB, JS 367.89 kB). Two test adjustments were needed: the excerpt test assumed the old length (fixed by making the constant 179 + ellipsis), and the first browser assertion assumed DSA was the first checklist item (changed to assert checklist content instead of order).

### 2026-11-19 — Upcoming drives + private application pipeline

- Added `drives` and `applications` tables to `server/schema.sql` (JSON eligibility arrays, status CHECKs, unique `(user_id, drive_id)`, cascading deletes and indexes). `server/seed-demo.js` now replaces drive/application rows on reseed and inserts three upcoming drives plus two private applications for the student.
- Added API routes in `server/index.js`: public `GET /api/drives`; session-scoped `GET`/`POST`/`PUT`/`DELETE /api/applications`; and tpo/tpoi `GET`/`POST`/`PUT`/`DELETE /api/admin/drives` with validation, `applicantCount`/`offerCount`, audit entries (`create_drive`, `update_drive`, `delete_drive`, `create_application`, `update_application`, `delete_application`) and branch/year-targeted publish notifications. Added `jsonArray`, `stringList` and `adminDrive` helpers.
- Added `src/pages/DrivesPage.jsx` (search, open/closed/all and batch filters, deadline countdown, real "Track application" POST), `src/pages/MyApplicationsPage.jsx` (private stage board with notes), and `src/pages/AdminDrivesPage.jsx` (publish/edit/delete/close with counts). Wired `/drives`, `/my-applications` and `/admin/drives` in `src/App.jsx`, added Header/Admin links and section 23 styles in `src/index.css`.
- Added three API tests (gating/validation, staff CRUD + audit + targeted alerts, private/scoped application CRUD) and three Playwright flows (filtering + tracking, stage/note update, TPO publish → public page). Updated `README.md`, `DEMO.md` and this file with routes, API/data-model notes, status and new counts.
- Verified: `npm run lint` clean; `npm test` **46/46 pass** (11 suites, isolated temp DB); `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui` **13/13 pass** in Edge on a throwaway DB; `npm run build` succeeds (79 modules, CSS 35.26 kB, JS 362.58 kB). One initial API test assumption was corrected because a prior profile test changes the student's branch to Computer Engineering; one invalid UI assertion targeting a checkbox as a textbox was removed before the browser run.

### 2026-11-19 — Alumni outreach test coverage

- Added three API integration tests to `tests/api.test.js`: CSV import rejects duplicate emails in one file, oversized input and header-only files, accepts the `name` alias and normalizes emails (including case-insensitive upserts); bulk outreach rejects unknown status/type, >500 ids and empty payloads without auditing, and ignores invalid/non-existent ids; the TPOI can also manage alumni contacts.
- Added three Playwright flows to `tests/ui/portal.spec.js`: template selection, personalization preview, copy and mark-contacted from the composer; single-contact response/referral tracking; select-all-visible plus bulk status/type apply.
- Updated test counts in `README.md`, `DEMO.md` and this file (43 API tests, 10 browser flows), removed the stale “alumni outreach is not yet covered” limitation and marked the roadmap item done.
- Verified: `npm run lint` clean; `npm test` **43/43 pass** (10 suites, isolated temp DB); `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui` **10/10 pass** in Edge on a throwaway DB; `npm run build` succeeds (76 modules, CSS 32.62 kB, JS 347.11 kB). One initial browser assertion was corrected after it assumed the editable subject field was pre-filled — it deliberately keeps `{placeholders}` while only the preview is personalized.

### 2026-11-19 — Documentation split

- Moved the detailed architecture, routes, state-ownership, data-model, design-system, status, roadmap, product-specification and development-log content out of `README.md` into the new `DEVELOPMENT.md`. Older changelog entries are kept verbatim, with a note explaining that their “this README” references now mean this file.
- Rewrote `README.md` as a conventional project README: overview, features, tech stack, setup, demo accounts, configuration, scripts, testing/CI, deployment, repository layout, links to the other docs and a short limitations summary.
- Updated the `DEMO.md` cross-reference and the project-structure tree in this file, and added the CI badge to the new README.
- Verified: all relative Markdown links resolve to existing files; no stale “single source of truth” wording remains outside historical changelog entries; `git status` shows only the intended documentation changes.

### 2026-11-19 — Git repository + GitHub remote

- Initialised `D:\Placement` as a git repo on branch `main` and created the public GitHub remote `PruthviRajSolase/vjti-placements`. The initial commit contains all 65 project files; `node_modules/`, `dist/`, `server/data/` (SQLite file), `.env`, `playwright-report/` and `test-results/` remain gitignored.
- Updated this README to reflect that version control now exists and CI is active, and corrected the stale "6-flow" browser-suite count to 7.
- Verified: `git status` shows a clean tree after the initial commit and the push to `origin/main` succeeds; `.github/workflows/ci.yml` is now picked up by GitHub Actions.

### 2026-11-19 — Alumni outreach (TPO-initiated) + bulk actions

- Added `alumni_contacts` to `server/schema.sql` for TPO-managed alumni/previously placed-student outreach records (contact, batch/placed/current-company, outreach status/type, contacted/follow-up dates, response notes, referral details). `server/seed-demo.js` now clears and seeds sample alumni contacts in different outreach states.
- Added staff-only (`tpo`/`tpoi`) APIs in `server/index.js`: `GET /api/admin/alumni`, `POST /api/admin/alumni/import` (CSV, all-row validation, upsert by email preserving outreach state), `PUT /api/admin/alumni/:id`, and `PUT /api/admin/alumni/bulk` (transactional status/type/follow-up apply and/or mark-contacted-now). Audit actions: `import_alumni`, `update_alumni_outreach`, `bulk_alumni_outreach`.
- Added `src/pages/AdminAlumniPage.jsx` and wired route `/admin/alumni` (`RequireRole tpo/tpoi`) in `src/App.jsx` with an Admin shortcut in `src/pages/AdminPage.jsx`: CSV import, placement/internship/both outreach templates with personalized **mailto/copy**, per-contact tracking/referral capture, and multi-select bulk actions (select-all visible, copy emails, bulk apply, mark contacted). Added section 22 styles in `src/index.css`.
- Added API integration coverage for alumni outreach (`tests/api.test.js`: permissions/scoping, CSV validation + upsert preserving outreach state, single/bulk updates/mark-contacted, audit entries) and a Playwright flow for `/admin/alumni` (`tests/ui/portal.spec.js`: import validation/import, bulk mark-contacted). Updated `DEMO.md` with an alumni-outreach + bulk-actions script (§5c) and refreshed test/API notes.
- Verified: `npm run lint` clean; `npm test` **40/40 pass** (10 suites, isolated temp DB); `npm run build` succeeds (76 modules, CSS 32.62 kB, JS 347.11 kB); `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui` **7/7 pass** on a throwaway DB.

### 2026-11-19 — Phase 8: notifications and staff CSV import

- `server/schema.sql` added `notifications` (`user_id` cascade, `type`, `title`, `body`, `link`, `read_at`, timestamps) with a `(user_id, read_at)` index. `server/index.js` gained `notify()` / `notifyStaff()` helpers, `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` (all scoped by `req.user.id`) and `POST /api/admin/companies/import`. Submit/resubmit notify all staff; approve / request-changes / reject notify the real author with the reviewer's note and an action link.
- Added dependency-free `server/csv.js` (quoted fields, `""` escapes, commas/newlines inside quotes, CRLF, BOM). The import endpoint validates the year, header, every data row, numeric ranges and duplicates **before** writing, returns up to ten `details` lines on failure, then upserts by `(year, slug)` and reports `{ imported, created, updated }`. `src/api.js` now preserves `error.details` for the form to render.
- Frontend: new `src/NotificationsContext.jsx` (reload on sign-in/tab focus), a header bell with unread badge, `src/pages/NotificationsPage.jsx` with per-item/bulk mark-as-read, and a CSV card in `src/pages/AdminPage.jsx` (file input + paste box + sample header). Wired the provider in `main.jsx`, the route in `App.jsx`, and section 21 styles in `src/index.css`.
- `server/seed-demo.js` clears notifications on reseed and seeds two unread submissions for staff, one unread approval for the student and one read review note for the contributor.
- Tests: added 7 API checks (notification auth/scoping, submit+review events, scoped read/read-all; import permissions, validation with no writes, upsert with quoted branches, audit entry) — `npm test` is **37/37** — plus 2 Playwright flows (bell/inbox, CSV import) — `npm run test:ui` is **6/6**.
- Verified: `npm run lint` clean; `npm run build` succeeds (75 modules, CSS 29.59 kB, JS 327.87 kB); browser suite 6/6 in Edge (`PLAYWRIGHT_CHANNEL=msedge`) on the throwaway DB; restarted the API, reseeded demo data and confirmed the student sees `unread=1` with the seeded approval; `npm start` on port 3010 serves `/notifications` as SPA HTML (200, `id="root"`) while `/api/nope` stays JSON 404.

### 2026-11-19 — Phase 8: notifications, CSV import and deeper browser coverage

- Wired the Phase 8 frontend: `src/main.jsx` now wraps the app in `NotificationsProvider`, and `src/App.jsx` adds the `/notifications` route behind `RequireAuth` (with a corrected single import/route). This exposes the existing private inbox UI (`src/NotificationsContext.jsx`, `src/pages/NotificationsPage.jsx`) and header bell/unread badge.
- Backend/UI already present and now integrated: `notifications` table and session-scoped endpoints/helpers in `server/schema.sql` and `server/index.js` (submit/resubmit/review emit notifications), seeded sample notifications in `server/seed-demo.js`, and staff company CSV import via `server/csv.js` + `POST /api/admin/companies/import` with all-row validation, per-line `details`, upsert by `(year, slug)` and `audit_log` entry. `src/pages/AdminPage.jsx` posts pasted/uploaded CSV and surfaces `error.details`; `src/api.js` preserves `details`/`status`.
- Deepened browser coverage in `tests/ui/portal.spec.js`: added flows for the notification inbox (student sees seeded approval, marks read, unread badge clears) and TPO CSV import (validation shows line details with no writes, valid upload imports/updates and appears publicly). Updated `README.md` and `DEMO.md` to reflect Phase 8 completion, counts and demo steps.
- Verified: `npm run lint` clean; `npm test` **37/37 pass** (9 suites, isolated temp DB); `npm run build` succeeds (75 modules, CSS 29.59 kB, JS 327.87 kB); `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui` **6/6 pass** on a throwaway DB (demo data untouched).

### 2026-11-19 — Phase 7: browser tests, lint and CI

- Added `@playwright/test`, ESLint 10 (`@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) and a flat `eslint.config.js`. `npm run lint` is clean across `src/`, `server/`, `tests/` and config files; the archived vanilla snapshot is deliberately ignored.
- Added `playwright.config.js` and `tests/ui/portal.spec.js`: four real-browser flows covering API-backed public filters, private bookmark toggles and isolation, account settings, and route guards. `scripts/serve-ui-test.js` builds on a **throwaway** SQLite DB at port 3107 (`npm run test:ui` builds first, then Playwright starts the production server), so demo data is never modified.
- Changed `npm test` to `node --test tests/api.test.js`. Node 24 auto-discovered the new Playwright spec under `tests/` and tried to run it with the wrong runner, which hung the suite; the API command is now explicit.
- Added `.github/workflows/ci.yml` (Node 24, `npm ci`, lint, API tests, build, Chromium install, browser tests, failure report upload). Added Playwright output dirs to `.gitignore`. The workflow is ready but inactive until this folder becomes a git repo.
- Verified locally with Edge (`PLAYWRIGHT_CHANNEL=msedge`): `npm run test:ui` **4/4 pass** in ~8s; `npm test` **30/30**; `npm run lint` clean; `npm run build` unchanged (73 modules). After the UI run the demo DB still had the seeded student name and exactly 2 bookmarks. `npm audit` still reports only the same 4 dev-only `picomatch`/Vite advisories.

### 2026-11-18 — Phase 6: saved companies and account settings

- `server/schema.sql` added `saved_companies` (`user_id + slug` unique, cascade on user delete); `server/seed-demo.js` now clears bookmarks on reseed and gives the student two sample saves (Microsoft and J.P. Morgan Chase & Co.).
- `server/index.js` added `GET`/`POST`/`DELETE /api/bookmarks`, `PUT /api/me` and `POST /api/me/password`. Every route requires a session; bookmarks are filtered/written with `req.user.id`, unknown slugs 404, duplicate saves are ignored, deletes cannot touch another user's rows, profile writes ignore `email`/`role`, and password changes verify the current hash. Both profile and password changes append to `audit_log`.
- Frontend: `AuthContext.updateUser()`, a new `BookmarksContext`, `RequireAuth`, a shared `BookmarkButton`, a refactored `CompanyCard` (link and button as siblings, not nested), bookmark controls on company cards/detail/Saved list, and two new routes/pages: `/saved` (private shortlist) and `/account` (profile + password forms). Header now links to both; `main.jsx` wraps the app in `BookmarksProvider`.
- Styles: section 20 in `src/index.css` covers `.bookmark-btn` (`floating`, `saved`, disabled), `.company-card-link`, `.company-detail-actions`, the saved list, account forms, `.form-success`, dark-theme success colours and mobile fallbacks.
- Tests: added 6 integration tests (anonymous access, private seeded saves, slug validation/idempotency/scoped deletes, profile field safety, password checks, audit entries) — `npm test` is **30/30** on an isolated DB.
- Verified: `npm test` 30/30; `npm run build` succeeds (73 modules, CSS 26.67 kB, JS 322.12 kB); restarted the API, reseeded the demo DB and confirmed via HTTP that the student sees exactly the two seeded bookmarks while a contributor sees none; Vite dev returns `/saved` and `/account` as SPA HTML and proxies `/api/health` as JSON; `npm start` serves `/saved`, `/account` and `/experience/1` as SPA HTML while `/api/*` stays JSON 404. Interactive browser clicks (save/remove, form submissions) still need a manual pass. `DEMO.md` gained a short Phase 6 click-through.

### 2026-11-18 — Phase 5: experience search, filters and detail pages

- `server/content.js`: `publicExperiences()` now emits stable `id`, `role`, `placementYear`, an ≤180-char `excerpt` and the existing display byline. New `publicExperienceDetail(id)` returns the full `body` for **approved rows only**, with the same byline and no `realName` / `email` / `reviewNote`. `server/index.js` exposes it as `GET /api/experiences/:id`, registered after `/api/experiences/mine` so the literal path still wins; 404 for pending, unknown and malformed ids.
- `src/components/ExperiencesSection.jsx`: keyboard-friendly search box, company dropdown, year dropdown and topic pills, derived from the loaded content. Filters combine with AND, live in URL query params (`q`, `company`, `year`, `tag`), show a result count and clear/empty states. Cards are links to `/experience/:id` and pass their filters along in router state.
- Added `src/pages/ExperienceDetailPage.jsx` + route in `src/App.jsx`: fetches the full write-up, handles loading/not-found, preserves body line breaks, links topics back to filtered lists, shows related write-ups at the same company and the role-aware submit CTA. Added section 19 styles to `src/index.css`.
- Tests: added 3 new suites/tests for card fields, detail privacy and non-approved 404s, plus detail checks inside the existing pending/approval workflow — `npm test` now runs **24/24** on an isolated DB.
- Verified: `npm test` 24/24; `npm run build` succeeds (68 modules, CSS 24.09 kB, JS 315.45 kB); dev proxy returns the new fields and detail JSON; production `npm start` serves `/experience/:id` as SPA HTML while `/api/experiences/:id` stays JSON. Manual browser pass of the filter interactions still pending.

### 2026-11-18 — Bug fix: TPO sign-in blocked by sign-up validation

- `src/pages/SignInPage.jsx` applied the 8-character password minimum in **both** sign-in and sign-up modes. The seeded TPO password `Tpo123!` is 7 characters, so the browser rejected the login with "Password must be at least 8 characters" before any request reached the server — even though the API accepts it (covered by `npm test`).
- Moved the length check under `if (isSignUp)` only. Sign-in now sends the credentials as typed; the server compares the bcrypt hash and returns 401 on a real mismatch. No other credential or seed change needed.
- Verified: `npm run build` succeeds (67 modules). Browser re-check needed from the presenter.

### 2026-11-18 — Quality pass 4/4: dependency advisory review

- Reviewed all 4 high `npm audit` advisories: `picomatch` ReDoS reached through Vite's `fdir`/`tinyglobby` dev-time globbing. No patched `picomatch` release exists (latest is 4.0.7, advisory covers `<=4.0.7`).
- Evaluated alternatives in a scratch project: Vite 6.2.7 removes the chain but carries a high "arbitrary file read via dev-server WebSocket" advisory plus several others; Vite 5.4.21 and 6.4.x still have a high dev-server advisory, and 6.4.x reintroduces `picomatch`. None is an improvement, so Vite was restored to `^7.3.8` and the residual risk documented in §11 (dev tooling only, do not expose the dev server).
- Verified after the dependency churn: `npm run build` succeeds (67 modules), `npm test` still passes 21/21, and the restarted Vite proxy returns JSON from `/api/content`.

### 2026-11-18 — Quality pass 3/4: automated API tests

- Added `tests/api.test.js` using Node's built-in `node:test` runner: 21 integration tests across five suites (public API, auth, permissions/admin content, review workflow, staff controls/audit). The test harness seeds a throwaway SQLite file (`DB_PATH`) and starts the real Express app with `API_PORT=0`; `npm test` runs it in about 2 seconds and leaves demo data untouched.
- Fixed a bug the tests exposed: `Number("0") || 3001` made `API_PORT=0` fall back to 3001. Port parsing now treats `0` as a valid OS-assigned port.
- Verified: `npm test` → 21 passed, 0 failed; demo DB still holds the same users/experiences afterwards.

### 2026-11-18 — Quality pass 2/4: React error boundary

- Added `src/components/ErrorBoundary.jsx`: a class component with `getDerivedStateFromError` / `componentDidCatch`. A render crash anywhere in the tree now shows a styled "Something went wrong" card with **Reload page** and **Try again** buttons instead of a blank screen; the error text is shown only in dev builds.
- Wrapped the whole app in it from `src/main.jsx` (outside the providers), and added `.crash-*` styles to `src/index.css`.
- Verified: `npm run build` succeeds (67 modules, CSS 21.83 kB, JS 309.00 kB). Browser-level verification of the fallback still requires a manual click-through.

### 2026-11-18 — Quality pass 1/4: single-process deployment config

- `server/index.js` now serves the built SPA in production: after all API routes it returns JSON 404s for unknown `/api/*` paths, then serves `dist/` via `express.static` and falls back to `index.html` for client-side routes (Express 5 needs a `/.*/` RegExp instead of `*`). It also prints the real bound port, so `API_PORT=0` works for tests.
- Added `server/start.js` (`NODE_ENV=production` then import the API) and the `npm start` script; added `public/_redirects` for static hosts.
- `server/db.js` now honours `DB_PATH`, so tests can use an isolated SQLite file without touching demo data.
- Verified with `npm run build` then `npm start` on port 3010: `/`, `/admin` and `/company/microsoft` all return the SPA HTML; `/api/health` returns JSON; `/api/does-not-exist` returns `404 {"error":"Not found."}`.

### 2026-11-18 — Phase 4: staff controls + audit log

- `server/index.js` added `GET /api/admin/users`, `POST /api/admin/users` (TPOI only, staff roles only, college email + password checks), `PUT /api/admin/users/:id/role` with a permission matrix, and `GET /api/admin/audit` (TPOI only, last 200 events with actor details). No endpoint ever returns a password hash.
- Role safety rails: self-change refused; TPO limited to `student ↔ contributor`; TPO cannot touch staff; the last TPOI cannot be demoted. Because the user is reloaded from the DB on every request, a demotion revokes the existing cookie's admin access immediately.
- Added `src/pages/AdminUsersPage.jsx` (searchable account table, inline role selects, TPOI staff-creation form) and `src/pages/AuditLogPage.jsx` (searchable audit table with coloured action badges). Added both routes in `src/App.jsx` with `RequireRole`, replaced the single admin shortcut with a three-card shortcut grid in `AdminPage.jsx`, and added Phase 4 styles to `src/index.css`.
- Verified with a 23-check HTTP smoke test: student/anonymous 401/403 across all new routes; TPO can grant contributor but cannot read audit, create staff or change staff roles; TPOI can create a staff account whose login and admin access work; demotion instantly revokes that access; self-change, non-college email and duplicate email are refused; audit entries contain actor names and `from -> to` role targets. Test-only users were cleaned up and roles restored afterwards. `npm run build` succeeds (66 modules).
- Extended `DEMO.md` with an optional Phase 4 click-through and the corresponding talking points.

### 2026-11-18 — Phase 3: experience submission + TPO review workflow

- `server/content.js` gained one joined `EXPERIENCE_SELECT` plus four shaped views: `publicExperiences()` (approved rows, display fields only), `staffExperiences()` (real identity + review history, actionable items first), `userExperiences(userId)` and `findExperience(id)`. `getPublicContent()` now calls `publicExperiences()`.
- `server/index.js` added: `POST /api/experiences` and `PUT /api/experiences/:id` for `student`/`contributor` (status is forced to `pending` server-side; students can only edit their own open item), `GET /api/experiences/mine`, `GET /api/admin/experiences` (with status counts), and `POST /api/admin/experiences/:id/review` with `approve` / `reject` / `request_changes` actions. Reject/request-changes require a note; reviewed items return 409. All actions write to `audit_log`.
- Added `src/pages/SubmitExperiencePage.jsx` (new + edit via `/submit/:id`, named/anonymous choice, review-flow strip), `src/pages/MyExperiencesPage.jsx` (status badges, feedback, edit link) and `src/pages/ReviewQueuePage.jsx` (filter tabs with counts, real-identity panel, note drafts, one-click approve).
- Rewired `src/App.jsx` with 4 protected routes, extended `Header.jsx` with "My experiences" / "Reviews" links, added a submission CTA to `ExperiencesSection.jsx` and a review-queue shortcut to `AdminPage.jsx`.
- Added Phase 3 styles to `src/index.css` (section 17) with dark-mode and mobile rules.
- Verified: 21-check HTTP smoke test passed end-to-end — pending stays off public site, student cannot read/approve the queue (403), invalid submissions rejected, student edits own item, note required, approve publishes with "Anonymous senior" byline and no identity leak, reject keeps note + reviewer and stays private, double review 409. Re-ran the 23 Phase 2 checks after reseeding — all pass. `npm run build` succeeds (64 modules, CSS 19.32 kB, JS 300.38 kB). Restored clean demo state with `npm run seed:demo`.
- Extended `DEMO.md` with the Phase 3 click-through (approve a seeded anonymous submission live, show the student's feedback view).

### 2026-11-18 — Phase 2: presentable demo slice (API + seed + TPO admin)

- Added `server/schema.sql` tables `stats`, `companies`, `branch_stats`; added `server/content.js` to shape DB rows into the exact object the existing React components expect (`getPublicContent()` / `getRawContent()`).
- Added API routes in `server/index.js`: public `GET /api/content`; TPO-only `GET /api/admin/content`, `PUT /api/admin/stats/:year`, `POST`/`PUT`/`DELETE /api/admin/companies`, `PUT /api/admin/branch-stats/:year`. All admin writes also append to `audit_log`.
- Added `server/seed-demo.js` + `npm run seed:demo`: 2024–2026 stats/companies/branch data, 3 approved experiences linked to real author accounts (Aditya S. / Priya K. / Rahul M.), 2 pending submissions for the future review demo, and 7 ready-made accounts. Content tables are replaced; users and audit rows are preserved.
- Added `src/api.js`, `src/AuthContext.jsx`, `src/ContentContext.jsx` and `src/components/RequireRole.jsx`; rewired `src/main.jsx` with real providers.
- Public pages (`StatsSection`, `CompaniesSection`, `BranchSection`, `ExperiencesSection`, `CompaniesPage`, `CompanyPage`) now read from `/api/content`; no browser code imports the content arrays from `src/data.js` any more (only `slugify` helpers remain).
- Rewrote `src/pages/SignInPage.jsx` for real login/register with college-email validation and visible demo credentials; rewrote `src/pages/AdminPage.jsx` with stats/company/branch editing and `refresh()` after each save.
- Rewrote `src/App.jsx` (year state, demo banner, API loading/error states, `/admin` route with role guard), fixed `Header.jsx` to show `user.fullName` and an Admin link for staff, and updated the stale "dummy data" copy in `CompaniesSection.jsx` and `Footer.jsx`.
- Added admin/banner/loading styles to `src/index.css` (section 16) plus mobile rules; added a global demo banner stating the numbers are samples.
- Verified: `npm run seed:demo` succeeds; 23-check HTTP smoke test passed (public content, hidden pending rows, 401 without cookie, TPO login + httpOnly cookie, admin read/write, public data changing after a save, company create/edit/delete, student 403 on read and write, wrong password 401); Vite proxy confirmed serving JSON after restarting the dev server; `npm run build` succeeds (61 modules, CSS 13.40 kB, JS 286.72 kB).
- Wrote `DEMO.md` — exact presentation click-through, accounts, safety notes and fallbacks.

### 2026-11-18 — Phase 1: backend foundation (auth + database)

- Added `server/` with `schema.sql`, `db.js` (Node's built-in `node:sqlite` — no native build), `auth.js` (JWT in httpOnly cookie, `requireAuth`/`requireRole`, user reloaded from DB on every request), `seed.js` and `index.js`.
- API endpoints: `GET /api/health`, `POST /api/auth/register` (college email only, bcrypt hash), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, and a role-gated `GET /api/admin/ping`.
- Tables: `users`, `experiences`, `audit_log` with status/visibility CHECK constraints and indexes.
- Added npm scripts `dev:api`, `dev:full`, `seed`; installed `express`, `bcryptjs`, `cookie-parser`, `jsonwebtoken`, `concurrently`.
- Added Vite `/api` → `:3001` proxy; gitignored `server/data/` and `.env`.
- Wrote the full product spec into README section 13 (roles, workflow, data model, architecture, phases).
- Verified: seeded TPOI, logged in, `/auth/me` returned the user, `/admin/ping` returned 200 for TPOI; a `@vjti.ac.in` registration succeeded, a Gmail registration was rejected, and the student got 403 on `/admin/ping`. `npm run build` still succeeds.

### 2026-11-18 — Phase 0: product design decisions

- Agreed the real product model: public visitors, students, placed-student contributors, TPO moderators and a TPOI super-admin.
- Agreed the experience workflow: student submits → TPO reviews → approve publishes; named or anonymous chosen by the student.
- Chose Node + Express + SQLite, college-email sign-up with TPO-granted contributor role.

### 2026-11-18 — Dark mode toggle fix

- Bug report: the switch turned dark mode on but would not switch back to light.
- `toggleTheme()` in `src/App.jsx` now reads the live `data-theme` attribute from `<html>` instead of relying on the React state closure, and applies the new attribute imperatively before updating state. This removes stale-closure / batched-click failure modes.
- Added a visible "Dark"/"Light" action label to the header button in `src/components/Header.jsx` and restyled `.theme-toggle` as a pill in `src/index.css`.
- Updated this README section 4.8.
- Verified with `npm run build` — succeeded (56 modules).

### 2026-11-18 — Step 10: Dark mode switch

- Added a moon/sun theme button to `src/components/Header.jsx` with `aria-pressed`, `aria-label` and `title`.
- Added `theme` state to `src/App.jsx` plus a `useEffect` that mirrors it onto `<html data-theme>` and a `toggleTheme()` that persists an explicit choice to `localStorage` (`vjti-placements-theme`).
- Added a pre-paint inline script to `index.html` that reads the saved choice or falls back to `prefers-color-scheme`, preventing a white flash.
- Extended `src/index.css`: `color-scheme` hint, a full `:root[data-theme="dark"]` token set, a new `--surface-alt` token for striped rows, dark overrides for error/notice colours, and `.theme-toggle` styles.
- Updated this README: sections 4.8, 6, 10, 11, 12 and this changelog.
- Verified with `npm run build` — succeeded (56 modules).

### 2026-11-18 — README created

- Created `README.md` as the single source of truth for project overview, features, architecture, data, roadmap and this changelog.
- Established the rule: implement a task, then immediately update this file.
- Verified by reading all source files in `src/`, `vanilla-version/`, root config files and the built `dist/` output.

### 2026-11-18 — Step 9: Sign-in / auth UI

- Added `src/pages/SignInPage.jsx` with sign-in/sign-up toggle, controlled inputs, validation, inline errors, demo hint and already-signed-in state.
- Added `path="/signin"` route in `src/App.jsx`; added shared `user` state with `signIn`/`signOut` and guarded `localStorage` persistence (`vjti-placements-user`).
- Replaced the dead `href="#"` sign-in button in `src/components/Header.jsx` with a real `<Link to="/signin">` carrying `state={{ from }}`; added a signed-in chip and working **Sign out** button.
- Added auth styles to `src/index.css` (section 15) plus mobile tweaks in the 760px media query.
- Verified with `npm run build` — succeeded (56 modules).

### Earlier sessions (dates not recorded) — Steps 1–8

- Built the vanilla HTML/CSS/JS version (Steps 1–6), archived in `vanilla-version/`.
- Migrated to React + Vite with components, props, hooks and ES modules (Step 7).
- Added React Router with homepage, companies grid, dynamic company detail, 404 and reusable `YearTabs` (Step 8).
- Added Vite config, `index.html` shell, design-token stylesheet and responsive rules.

---

## 15. Demo runbook (DEMO.md)

[`DEMO.md`](./DEMO.md) is the presenter's script: how to reset the database, the exact accounts to use, a 5–6 minute click-through of the TPO admin flow, the live **submit → review → publish** workflow, the **staff controls / audit log** closer, the **saved companies / account settings** convenience pass and the **notifications / CSV import** pass, the role-guard check, the story to tell around each click, troubleshooting, and what to ask for at the end. Keep it next to `README.md` when presenting; this file remains the technical source of truth.
