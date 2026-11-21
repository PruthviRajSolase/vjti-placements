# Deploying VJTI Placements (Zero-cost, Launch Mode)

This guide deploys the app in **launch mode** (`APP_MODE=launch`) with no paid services and no purchased domain. Launch mode keeps experience sharing, review, notifications, accounts/audit, and hides/disables TPO placement surfaces.

## Before you deploy

- Use a **dedicated project Gmail account** for OTP/reset mail (not a personal primary mailbox).
- Use a host with a **persistent disk/volume**. SQLite data is lost on ephemeral filesystems.
- Do **not** use Render's free tier for this app: its free web services use an ephemeral filesystem and SQLite data can be lost on redeploy/restart/instance replacement.

## Environment variables

| Name | Required | Example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | `production` | Enables production behavior and static SPA serving. |
| `APP_MODE` | Yes | `launch` | Enables launch mode; disables TPO placement surfaces. |
| `JWT_SECRET` | Yes | `replace-with-a-long-random-secret-32+` | Signs session cookies. Must be at least 32 characters. Never commit it. |
| `DB_PATH` | Yes (recommended explicit) | `/data/placements.db` | SQLite database file path. Must be on a persistent volume. |
| `TRUST_PROXY` | Yes in production launch | `1` | Tells Express it is behind a reverse proxy so rate limiting sees real client IPs. |
| `SMTP_HOST` | Yes in production launch | `smtp.gmail.com` | SMTP server for verification/reset emails. |
| `SMTP_PORT` | Yes in production launch | `587` | SMTP port. Use `587` for STARTTLS or `465` for TLS. |
| `SMTP_USER` | Yes in production launch | `projectmail@gmail.com` | SMTP username (Gmail address). |
| `SMTP_PASS` | Yes in production launch | `abcd efgh ijkl mnop` | Gmail App Password. Never commit it. |
| `MAIL_FROM` | Yes in production launch | `"VJTI Placements <projectmail@gmail.com>"` | From address shown in emails. |
| `MAX_EMAILS_PER_DAY` | Optional | `150` | Global OTP/reset email cap per rolling 24h. Default `150`; warning logged at 80%. Per-address cap is 5/hour. |
| `TPOI_EMAIL` | Required when no staff account exists | `tpoi@vjti.ac.in` | Initial TPO in-charge account email. Startup can create it if DB has no staff account. |
| `TPOI_PASSWORD` | Required when no staff account exists | `StrongPassword123!` | Initial TPO in-charge password (min 8 chars). Never commit it. |
| `TPOI_NAME` | Optional | `TPO In-Charge` | Display name for initial TPO in-charge account. |
| `API_PORT` | Optional | `3001` | HTTP port inside the container/process. Default `3001`. |
| `BACKUP_DIR` | Optional | `/data/backups` | Backup output directory. Default: next to `DB_PATH`. |
| `BACKUP_KEEP` | Optional | `14` | Number of newest backups to keep. Default `14`. |
| `BACKUP_DAILY` | Optional | `1` | Set to `1` to enable in-process daily backups. |

## Gmail App Password (dedicated project account)

1. Create/use a dedicated Gmail account for the project (e.g. `vjti.placements.project@gmail.com`).
2. Enable **2-Step Verification** on that Google account.
3. Open Google Account > **Security** > **2-Step Verification** > **App passwords**.
4. Create an app password for "Mail" / "Other (VJTI Placements)". Google shows a 16-character password.
5. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<that gmail>`, `SMTP_PASS=<16-char app password>`, `MAIL_FROM="VJTI Placements <that gmail>"`.
6. Verify locally before deploying:

   ```bash
   npm run mail:test -- you@example.com
   ```

   If SMTP is not configured outside production, the command logs instead of sending; configure SMTP vars to send a real test.

**What can go wrong**
- App Passwords are unavailable until 2-Step Verification is enabled.
- Gmail has sending limits; the app caps OTP/reset emails (`MAX_EMAILS_PER_DAY`, default 150, and 5/hour per address) but you should still monitor usage.
- If Google blocks sign-in/sending, regenerate the App Password and update `SMTP_PASS`.

## Option A: Oracle Cloud Always Free VM (recommended)

This option gives you an Always Free VM where you run Docker with a persistent volume.

### A1. Create the VM

1. Sign in to Oracle Cloud and create an Always Free Compute VM (Ampere A1 or AMD Micro, subject to Oracle availability).
2. Choose Ubuntu (or another Linux image you are comfortable with).
3. Add your SSH public key.
4. Create the instance and note its public IP.

### A2. Open ports

1. In Oracle Cloud networking (VCN/security list or NSG), allow inbound:
   - TCP `22` (SSH) from your IP.
   - TCP `80` (HTTP) and TCP `443` (HTTPS) from `0.0.0.0/0`.
2. On the VM firewall (Ubuntu ufw/firewalld/iptables depending on image), allow the same ports. Example with ufw:

   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

### A3. Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out/in so docker group applies
docker --version
```

### A4. Get the app and build

```bash
git clone <your-repo-url> vjti-placements
cd vjti-placements
docker build -t vjti-placements:launch .
```

### A5. Create env file and data volume

Create `/home/ubuntu/vjti-placements.env` (chmod 600). Do not commit it.

```env
NODE_ENV=production
APP_MODE=launch
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
DB_PATH=/data/placements.db
TRUST_PROXY=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=projectmail@gmail.com
SMTP_PASS=your-gmail-app-password
MAIL_FROM="VJTI Placements <projectmail@gmail.com>"
MAX_EMAILS_PER_DAY=150
TPOI_EMAIL=tpoi@vjti.ac.in
TPOI_PASSWORD=StrongPassword123!
TPOI_NAME=TPO In-Charge
BACKUP_DAILY=1
BACKUP_KEEP=14
```

Create a persistent Docker volume:

```bash
docker volume create vjti_data
```

### A6. Run the container

```bash
docker run -d \
  --name vjti-placements \
  --restart unless-stopped \
  --env-file /home/ubuntu/vjti-placements.env \
  -v vjti_data:/data \
  -p 127.0.0.1:3001:3001 \
  vjti-placements:launch
```

Check logs/health:

```bash
docker logs --tail 100 vjti-placements
curl http://127.0.0.1:3001/api/health
```

### A7. Free HTTPS option

You need HTTPS for secure cookies in production. Two free options:

**Recommended: Caddy + free DuckDNS subdomain**
1. Create a free DuckDNS subdomain (e.g. `vjti-placements.duckdns.org`) and point it to your VM public IP.
2. Install Caddy on the VM.
3. Create `/etc/caddy/Caddyfile`:

   ```caddy
   vjti-placements.duckdns.org {
     reverse_proxy 127.0.0.1:3001
   }
   ```

4. Reload Caddy. It automatically obtains/renews Let's Encrypt certificates.
5. Keep `TRUST_PROXY=1` in the app env.

**Alternative: Cloudflare Tunnel**
- Run `cloudflared` on the VM and create a tunnel that forwards to `http://127.0.0.1:3001`.
- Useful if you cannot expose ports 80/443 directly. It requires a Cloudflare account and tunnel setup; DNS/certificate handling is managed by Cloudflare.
- Keep `TRUST_PROXY=1` and confirm forwarded client IP behavior for rate limiting.

### A8. Update

```bash
cd ~/vjti-placements
git pull
docker build -t vjti-placements:launch .
docker rm -f vjti-placements
docker run -d \
  --name vjti-placements \
  --restart unless-stopped \
  --env-file /home/ubuntu/vjti-placements.env \
  -v vjti_data:/data \
  -p 127.0.0.1:3001:3001 \
  vjti-placements:launch
```

### A9. Backups on Oracle VM

- Set `BACKUP_DAILY=1` and keep the `/data` Docker volume persistent.
- Download a backup from browser as staff: `GET /api/admin/backup` (authenticated, audited).
- Or copy from volume/host:

  ```bash
  docker run --rm -v vjti_data:/data -v "$PWD":/out alpine cp /data/backups/<file>.db /out/
  ```

### Option A: What can go wrong

- **Oracle reclaim/idle risk:** Oracle Always Free resources can be reclaimed or become unavailable depending on account/resource/idle conditions. Keep backups downloaded off the VM; monitor the instance.
- **Ports blocked:** if Oracle security list/NSG or VM firewall is misconfigured, HTTPS will not work.
- **No persistent volume:** if you run without `-v vjti_data:/data`, SQLite data is lost on container replacement.
- **Wrong TRUST_PROXY:** rate limiting may see proxy IP instead of real client IP.
- **SMTP/App Password issues:** OTP email delivery fails; startup will refuse in production+launch if SMTP vars are missing.
- **Disk fills up:** backups and DB grow; keep `BACKUP_KEEP` reasonable and download backups periodically.

## Option B: Railway Free plan

Railway can run this as a Docker/container deployment with a volume, but you must watch free-plan credits and limits.

### B1. Connect repo

1. Create a Railway project and connect your GitHub repo.
2. Use the included `Dockerfile` (Railway can build from Dockerfile).

### B2. Set environment variables

In Railway service variables, set the env vars from the table above. At minimum for production launch: `NODE_ENV`, `APP_MODE`, `JWT_SECRET`, `DB_PATH=/data/placements.db`, `TRUST_PROXY=1`, all `SMTP_*`/`MAIL_FROM`, and `TPOI_*` if no staff account exists.

### B3. Add a volume

1. Add a Railway volume and mount it at `/data`.
2. Set `DB_PATH=/data/placements.db`.
3. Optionally set `BACKUP_DIR=/data/backups`, `BACKUP_DAILY=1`, `BACKUP_KEEP=14`.

### B4. Start command / port

- Dockerfile CMD is `node server/start.js`; keep it.
- The app listens on `API_PORT` (default `3001`). Configure Railway to route to the container port your service exposes (set `API_PORT` to Railway's expected port if required by the platform).

### B5. Watch credit usage

- Monitor Railway monthly free credit/usage in the dashboard.
- Set alerts/notifications where available and check usage regularly.

### Option B: What can go wrong

- **Credit exhaustion:** when free credit is exhausted, service behavior may be paused/limited; the app can become unavailable until credits reset or plan changes.
- **No volume or wrong mount:** without a persistent `/data` volume, SQLite data can be lost.
- **Ephemeral assumptions:** do not treat container filesystem as durable; only `/data` volume should hold DB/backups.
- **Port mismatch:** if Railway expects a specific port and `API_PORT`/routing is wrong, health checks fail.
- **SMTP/startup checklist failures:** missing required launch env vars causes startup to fail with a checklist error in logs.

## First-launch checklist

1. Deploy with required env vars and a persistent volume mounted at `/data`.
2. Confirm health: `GET /api/health` returns `{ ok: true, ... }`.
3. Confirm initial staff account exists (created by `npm run seed:launch` or startup auto-create when no staff exists and `TPOI_*` are set).
4. Register a student account with a `@vjti.ac.in` email.
5. Verify the email using the OTP (Gmail SMTP in production launch).
6. Submit an experience as the student.
7. Sign in as TPOI/staff and approve the experience in the review queue.
8. Confirm it appears on the home page and prep insights.

## Backup download and restore

### Download

- Staff/TPOI can download the latest backup from browser while signed in:

  ```text
  GET /api/admin/backup
  ```

  The request is authenticated, staff-only, and audited.
- You can also run `npm run backup` on the host/container; backups are pruned to newest `BACKUP_KEEP`.

### Restore

1. Stop the app/container.
2. Replace the SQLite DB at `DB_PATH` (e.g. `/data/placements.db`) with the selected backup file.
3. Start the app/container.
4. Verify sign-in, review queue, recent content, and audit log.

## Startup safety checklist (production + launch)

On startup in production+launch, the server refuses to start with one checklist-style error listing all missing items. It requires:
- `JWT_SECRET` (32+ chars)
- `TRUST_PROXY`
- SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`)
- writable `DB_PATH` directory
- `TPOI_EMAIL` and `TPOI_PASSWORD` when the database has no staff account (it creates the pre-verified TPOI account when these are present)

Secret values are never printed in startup errors/logs.
