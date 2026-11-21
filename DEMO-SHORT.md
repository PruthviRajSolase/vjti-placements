# DEMO-SHORT.md — 6-minute TPO demo

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

## 1. Staff edit goes live

1. Click **Sign in** and sign in as `tpo@vjti.ac.in` / `Tpo1234!`.
2. Open **Admin**.
3. In the **2026 statistics** card, change **Students placed** from `512` to `520`.
4. Click **Save statistics**.
5. Click **Home** and show the updated **Students Placed** stat card.

> "TPO staff can update official placement numbers directly, and the public site updates immediately."

## 2. Submit -> review -> publish

1. Sign out, then sign in as `student@vjti.ac.in` / `Student123!`.
2. Open **My experiences** and click **+ Share a new experience**.
3. Fill in the form exactly:
   - **Company:** `Peregrine Systems`
   - **Role:** `Software Engineer`
   - **Placement year:** `2026`
   - **Title:** `Peregrine Systems - SDE (2026)`
   - **What was the process like?:** `OA had two coding questions in 90 minutes, then three interview rounds on DSA, system design and behavioural questions. Timed mock interviews helped the most.`
   - **Tags:** `Online Assessment, System Design, On-campus`
   - **Visibility:** choose **Anonymous**.
4. Click **Submit for review**.
5. Sign out, then sign in as `tpo@vjti.ac.in` / `Tpo1234!`.
6. Open **Reviews** and point at the real-name identity panel on the Peregrine Systems submission (*Submitted by Asha Patil · student@vjti.ac.in*).
7. Click **Approve & publish**.
8. Open **Home** and show the new write-up with the **Anonymous senior** byline.

> "Students can share anonymously, but staff always see the real identity before publishing."

## 3. Drives + private tracker

1. Sign out, then sign in as `student@vjti.ac.in` / `Student123!`.
2. Open **Drives** and click **+ Track application** on **Harbor Automotive**.
3. On **My applications**, find the **Summit Bank Group** card.
4. Change **Stage** to `Interview`, add a note like `Technical round confirmed.`, and click **Save**.
5. Mention that another account sees an empty board because applications are private to each student.

> "Students get a live drive board and a private application tracker that only they can see."

## 4. Alumni outreach

1. Sign out, then sign in as `tpo@vjti.ac.in` / `Tpo1234!`.
2. Open **Admin** → **Alumni outreach**.
3. Find **Meera Iyer** (not contacted), click **Select**, and show the **Outreach composer** preview.
4. Tick Meera Iyer's checkbox and click **Mark contacted now** in the bulk bar.
5. Point out the status/last-contacted update.

> "TPO can turn alumni relationships into outreach actions with tracked, auditable follow-up."

## Close

- Pilot ask: "Which screen would your team use first, and what data would you want imported for a pilot?"
- Note: If asked, access control can be shown quickly: a student is redirected from `/admin`, and the API returns `401/403` for unauthorized admin requests.
- Reset after demo: `npm run seed:demo`.