# Deploying VJTI Placements (Launch Mode)

This guide is for deploying the student experience portal in **launch mode** (`APP_MODE=launch`). Launch mode hides/disables TPO placement surfaces (stats, companies, drives, alumni, etc.) but keeps experience sharing, review, notifications, and admin accounts/audit.

## Build and run

### Node (without Docker)

```bash
npm ci
npm run build
npm start
```

`npm start` runs `server/start.js`, which sets `NODE_ENV=production` and serves the built React app from `dist/` with the API.

### Docker

```bash
docker build -t vjti-placements .
docker run --env-file .env -p 3001:3001 -v vjti-data:/app/server/data vjti-placements
```

Mount a persistent volume at the directory containing your SQLite DB (default: `/app/server/data`, file `placements.db`). If you set `DB_PATH`, mount that path instead.

## Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `APP_MODE` | Yes | Set to `launch` for the student deployment. |
| `JWT_SECRET` | Yes | Session signing secret. Must be at least 32 characters; server refuses to start in production without it. |
| `DB_PATH` | Recommended | SQLite file path on a persistent volume, e.g. `/data/placements.db`. Default is `server/data/placements.db`. |
| `TRUST_PROXY` | Recommended behind proxy | Express trust proxy setting (`1`, `true`, or proxy IP). Required so rate limiting sees real client IPs behind a host reverse proxy. |
| `SMTP_HOST` | Yes in production launch | SMTP host for verification/reset OTP emails (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Yes in production launch | SMTP port (`587` STARTTLS or `465` TLS). |
| `SMTP_USER` | Yes in production launch | SMTP username. |
| `SMTP_PASS` | Yes in production launch | SMTP password/App Password. |
| `MAIL_FROM` | Yes in production launch | From address, e.g. `"VJTI Placements <no-reply@example.com>"`. |
| `TPOI_EMAIL` | For initial admin seed | Initial TPO in-charge email for `npm run seed:launch`. |
| `TPOI_PASSWORD` | For initial admin seed | Initial TPO in-charge password (min 8 chars). |
| `TPOI_NAME` | Optional | Initial TPO in-charge display name. |
| `API_PORT` | Optional | API/server port (default `3001`). |

Notes:
- If SMTP is missing outside production, OTP/reset codes are logged to the server console. In production with `APP_MODE=launch`, missing SMTP settings cause startup to fail. Never log OTP codes or SMTP secrets in production.
- `seed-demo` is blocked in production and in launch mode.

## Persistent SQLite volume

SQLite data must live on a **persistent volume/disk**. Set `DB_PATH` to a file on that mounted volume.

Create the initial admin account once:

```bash
npm run seed:launch
```

This creates/updates only the pre-verified TPOI account from `TPOI_*` env vars. It creates no sample content.

## Backups and restore

Run backups on a schedule (cron/host scheduler):

```bash
npm run backup
```

`BACKUP_DIR` can override the backup output directory (default: `server/data/backups/`). Keep backups off the same ephemeral disk when possible.

**Restore:**

1. Stop the app.
2. Replace the DB file at `DB_PATH` (or `server/data/placements.db`) with the chosen backup file.
3. Start the app.
4. Verify sign-in, review queue, and recent content.

## First-launch checklist

1. Set required env vars and mount a persistent volume for `DB_PATH`.
2. Deploy/build and start the app.
3. Run `npm run seed:launch` (once) to create the TPOI account.
4. Register a student account with a `@vjti.ac.in` email.
5. Verify the email using the OTP (or console log in non-SMTP dev).
6. Submit an experience as the student.
7. Sign in as TPOI/staff, approve the experience in the review queue.
8. Confirm it appears on the home page and prep insights.

## Host options with volumes

Do not pick a host blindly; confirm pricing, backups, and operational fit. Two options that support persistent volumes/disks:

- **Fly.io (Volumes)** — supports persistent volumes attached to Machines; suitable for a single-node SQLite app when the volume is mounted.
- **Render (Persistent Disks)** — supports persistent disks for services; mount the disk and point `DB_PATH` at it.

## Ephemeral disk warning

**Free hosts with ephemeral disks lose data.** SQLite files stored on ephemeral filesystems can be wiped on redeploy, restart, or instance replacement. Use a persistent volume and scheduled backups for any real launch.
