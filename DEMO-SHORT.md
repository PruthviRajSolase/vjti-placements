# DEMO-SHORT.md — 5-minute TPO demo

A short presenter script for the VJTI placement portal. For the full runbook, use `DEMO.md`.

## Before the demo

```bash
npm run seed:demo
npm run dev:full
```

- Open `http://localhost:5173/`.
- Confirm the demo banner is visible: sample data, not official TPO records.
- Optional proof: `http://localhost:3001/api/content` returns JSON from the database.

## Demo accounts

| Who | Email | Password |
|---|---|---|
| TPO staff | `tpo@vjti.ac.in` | `Tpo1234!` |
| TPO in-charge | `tpoi@vjti.ac.in` | `ChangeMe123!` |
| Student | `student@vjti.ac.in` | `Student123!` |

All accounts are created by `npm run seed:demo`.

## 1. Public view (60s)

1. On Home, point at the four stat cards and year tabs.
2. In Companies, search `north` or filter by branch to show Northbridge Software.
3. Open a company detail page, then open Prep insights / Experiences and show filters.

> "Students get verified placement stats, company history, and reviewed interview experiences in one place."

## 2. Staff edit goes live (90s)

1. Sign in as `tpo@vjti.ac.in` / `Tpo1234!`.
2. Open **Admin** and change **Students placed** for 2026.
3. Click **Save statistics**, return to Home, and show the updated number.

> "TPO staff can update placement data directly; no code change or redeploy."

## 3. Access control (45s)

1. Sign out and sign in as `student@vjti.ac.in` / `Student123!`.
2. Try `/admin` — the student is redirected.
3. Optional terminal proof:

```bash
curl -i http://localhost:3001/api/admin/content
# 401/403 depending on session
```

> "Admin actions are protected on the server, not just hidden in the UI."

## 4. Student workflow (60s)

1. As student, open **Drives** and track a drive.
2. Open **My applications** and update status/notes.
3. Open **Saved** or **Account** to show private, account-scoped data.

> "Students can track opportunities privately while staff manage official data."

## 5. Close (30s)

- Mention review queue, notifications, alumni outreach, CSV import, and audit log as staff workflows.
- Reset after demo: `npm run seed:demo`.
