# VJTI Placements

[![CI](https://github.com/PruthviRajSolase/vjti-placements/actions/workflows/ci.yml/badge.svg)](https://github.com/PruthviRajSolase/vjti-placements/actions/workflows/ci.yml)

An unofficial, student-run placement portal demo for **Veermata Jijabai Technological Institute (VJTI), Mumbai**. Students can browse placement statistics, visiting companies and interview experiences, see common preparation themes from placed seniors, check upcoming drives and track their applications privately; placement staff manage that content and review submitted write-ups.

> All numbers and experiences in the UI are **sample data for presentations**, not official TPO records. The application is not affiliated with or endorsed by VJTI.

## Features

- Year-wise placement stats, company visit data, branch-wise placement totals/percentages and a company detail view
- Searchable, filterable library of approved interview experiences with shareable filters
- Prep insights: ranked "what to prepare" themes derived from tags in approved student write-ups
- Accounts with `@vjti.ac.in` sign-up, httpOnly cookie sessions and role-based permissions
- Student experience submission, editing and review workflow (approve / request changes / reject), with named or anonymous publication
- TPO admin panel: edit stats and companies, import companies from CSV, manage roles, view audit log
- Private saved companies, account settings and a notification inbox
- Alumni outreach: contact import, mailto/copy templates, status tracking and bulk actions
- Upcoming drives with deadlines and eligibility filters, plus a private student application pipeline (Applied → OA → Interview → Offer)
- Dark mode, responsive layout and a global demo-data disclaimer

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7, plain CSS with custom properties |
| Backend | Express 5, Node's built-in `node:sqlite`, JWT in an httpOnly cookie, bcryptjs |
| Tests | Node `node:test` (API integration tests), Playwright (browser flows) |
| Tooling | ESLint 10, GitHub Actions CI, npm scripts |

## Getting started

Requires **Node 24+** and npm (see `engines` in `package.json`).

```bash
npm install
npm run seed        # create the first TPO in-charge account (once)
npm run seed:demo   # load sample content and demo accounts (safe to repeat)
npm run dev:full    # API + frontend together
```

Open **http://localhost:5173/**. The API health check is at **http://localhost:3001/api/health**.

### Demo accounts

Created by `npm run seed:demo`:

| Role | Email | Password |
| --- | --- | --- |
| TPO staff | `tpo@vjti.ac.in` | `Tpo1234!` |
| TPO in-charge | `tpoi@vjti.ac.in` | `ChangeMe123!` |
| Student | `student@vjti.ac.in` | `Student123!` |
| Contributor | `contributor@vjti.ac.in` | `Contributor123!` |
| Experience authors | `aditya@` / `priya@` / `rahul@vjti.ac.in` | `Author123!` |

### Configuration

Environment variables are optional for local development. Copy [`.env.example`](./.env.example) as a starting point.

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Session signing secret. In production the server refuses to start if it is missing or shorter than 32 characters. |
| `TPOI_EMAIL`, `TPOI_PASSWORD`, `TPOI_NAME` | Credentials for the first in-charge created by `npm run seed` |
| `DB_PATH` | Override the SQLite file location (default `server/data/placements.db`) |
| `API_PORT` | Change the API/production server port (default `3001`) |
| `APP_MODE` | `demo` (default) or `launch`. Launch mode hides/disables TPO placement surfaces but keeps experience sharing, review, and admin accounts/audit. |
| `TRUST_PROXY` | Express trust proxy setting for deployments behind a reverse proxy (`1`, `true`, or proxy IP). Needed so rate limiting sees real client IPs. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | SMTP settings for email verification and password reset OTPs. If SMTP is missing outside production, OTP/reset codes are logged to the server console. In production with `APP_MODE=launch`, missing SMTP settings cause startup to fail; never log OTP codes or SMTP secrets in production. |
| `PLAYWRIGHT_CHANNEL` | Set to `msedge` to run browser tests in Edge on Windows |

Restart Vite after editing `vite.config.js` — a stale dev server can serve `index.html` instead of JSON for `/api` calls.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Frontend only (`:5173`) |
| `npm run dev:api` | API only (`:3001`) |
| `npm run dev:full` | Both, with hot reload — use this for demos |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the API and built SPA from one Express process |
| `npm run preview` | Preview the production build locally |
| `npm test` | 93 API integration tests against a throwaway database |
| `npm run test:ui` | Build, then run 17 Playwright flows against a throwaway database |
| `npm run lint` | ESLint across source, server, tests and config |
| `npm run backup` | Write a timestamped SQLite backup to `server/data/backups/` (or `BACKUP_DIR`) |
| `npm run mail:test -- you@example.com` | Send one test email using configured SMTP settings |
| `npm run seed`, `npm run seed:demo` | Seed the first admin / reset demo presentation data |
| `npm run seed:launch` | Create/update only the initial TPOI account from `TPOI_*` env vars (no sample content) |

For a full reset, stop the servers, delete `server/data/placements.db`, then run `npm run seed && npm run seed:demo`. See `DEMO.md` for the full presenter runbook and `DEMO-SHORT.md` for the 5-minute version.

## Testing and CI

`npm test`, `npm run test:ui` and `npm run lint` all run in CI on every push and pull request. The API and browser suites use isolated temporary SQLite databases, so demo content is never modified. On Windows, run browser tests in Edge with `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:ui`.

## Deployment

```bash
npm run build
npm start
```

Express serves the API and `dist/` from one origin on `:3001`, with an SPA fallback for deep links such as `/admin`; unknown `/api/*` paths stay JSON 404s. `public/_redirects` provides the same fallback on static hosts.

For launch-mode deployment (persistent SQLite volume, SMTP, trust proxy, seed:launch, backups/restore, first-launch checklist), see [`DEPLOY.md`](./DEPLOY.md).

## Repository layout

```text
src/              React app (pages, components, contexts, styles)
server/           Express API, SQLite schema, auth and demo seed
tests/            API integration tests and Playwright flows
scripts/          Helper for the browser-test server
.github/          CI workflow
DEMO.md           Presentation click-through script
DEVELOPMENT.md    Detailed technical notes and development log
```

## Documentation

- [`DEMO.md`](./DEMO.md) — exact presentation script, accounts and troubleshooting.
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — architecture, routes, state ownership, data model, design system, roadmap, product specification, known limitations and the full dated development log.

## Known limitations

There is no global search across sections, alumni outreach uses mailto/copy with manual tracking rather than SMTP, and prep insights are tag-frequency advice rather than AI or TPO-verified guidance. The browser suite is a smoke test, not exhaustive coverage. See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the full list.
