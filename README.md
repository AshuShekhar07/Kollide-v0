# Kollide

Friends and groups for Garba nights. A React + Vite app in `web/`, a Supabase
project (Postgres, RLS, SECURITY DEFINER functions, Edge Functions) in
`supabase/`. The product plan is in [KOLLIDE_PLAN.md](KOLLIDE_PLAN.md); Edge
Function setup is in [supabase/functions/README.md](supabase/functions/README.md).

## Checks that run on GitHub

| Workflow | When | What it does |
|---|---|---|
| `CI` (`.github/workflows/ci.yml`) | every push and pull request | Database job: starts a local Postgres with the Supabase CLI, applies every migration and the seed (`supabase db reset`), runs the pgTAP tests (`supabase test db`). Web job: `npm ci`, `npm run build`, `npm run lint` in `web/`. Any error fails the run; lint warnings do not. |
| `Database backup` (`backup.yml`) | daily at 21:00 UTC, or run it by hand | Dumps the hosted database (roles, schema, data including accounts), encrypts it with gpg and keeps it as a workflow artifact for 14 days. |
| `Uptime` (`uptime.yml`) | every 15 minutes, or run it by hand | Expects a 200 from the app, and calls `public.ping()` through the REST API with the anon key. Any other answer fails the run. |
| `Apply migrations` (`migrate.yml`) | only by hand | Lists the migrations in `supabase/migrations` that the hosted database is missing (`supabase db push --dry-run`), and applies them when you tick **apply**. Run it unticked first and check the list. |

Scheduled workflows only run from the default branch (`main`), start on a
best-effort basis (a 15-minute schedule can be a few minutes late), and GitHub
pauses them on a public repository after 60 days without activity. When a
scheduled run fails, GitHub emails the person who last edited that schedule
(subject to their notification settings), not the repository owners as a group.

## Secrets to create

In the repository: **Settings -> Secrets and variables -> Actions -> New
repository secret**. The workflows read them through the environment, never
print them, and GitHub masks them in logs. Do not paste them into an issue, a
PR or a workflow file.

| Secret | Used by | What to put in it |
|---|---|---|
| `SUPABASE_DB_URL` | Backup, Apply migrations | The **session pooler** connection string of the hosted project: Dashboard -> Connect -> Session pooler, port `5432`, user `postgres.<project-ref>`, with your database password filled in and percent-encoded (`@` becomes `%40`, and so on). Do **not** use the direct `db.<ref>.supabase.co` host: on the free plan it is IPv6-only and GitHub's runners are IPv4-only. Do not use the transaction pooler (port `6543`); it does not suit `pg_dump`. |
| `BACKUP_PASSPHRASE` | Backup | A long random passphrase used to encrypt every backup (`openssl rand -base64 32`). **Also store it somewhere outside GitHub** (a password manager): without it the backups cannot be opened. |
| `SUPABASE_URL` | Uptime | The project URL, `https://<project-ref>.supabase.co` (Dashboard -> Project Settings -> API). |
| `SUPABASE_ANON_KEY` | Uptime | The public anon (publishable) key from the same page. It is the key already shipped in the web app, but keep it in a secret so it is masked in logs. |
| `APP_URL` | Uptime | The address people open, for example `https://kollide.in`. It must answer `200` directly (no redirect). |

After adding them, open **Actions -> Database backup -> Run workflow** and
**Actions -> Uptime -> Run workflow** once to check they work.

## Backups

A backup is one gpg-encrypted file (`kollide-db-<timestamp>.sql.gpg`) attached
to the workflow run: **Actions -> Database backup -> the run -> Artifacts**.
Runs older than 14 days are deleted by GitHub.

**What is in it:** the roles, the full schema, and the data of every table,
including the `auth` tables (accounts) and the `storage` tables (bucket and
object rows), plus the cron job definitions.

**What is not in it:**

- **Photos and verification videos.** A database dump only contains the
  `storage.objects` rows that point at the files, not the files themselves.
  Files stay in Supabase Storage and are not backed up by this workflow.
- **Vault secrets** (`send_email_url`, `email_hook_secret`). After a restore,
  create them again (step 3 of [supabase/functions/README.md](supabase/functions/README.md)).
- Edge Function secrets and Auth provider settings, which live in the
  Supabase dashboard.

**Restoring** into an empty Supabase/Postgres database:

```bash
# 1. Download the artifact and unzip it. 2. Decrypt (prompts for the passphrase):
gpg --decrypt kollide-db-<timestamp>.sql.gpg > kollide.sql
# 3. Load it:
psql "$TARGET_DATABASE_URL" -f kollide.sql
```

Delete `kollide.sql` afterwards: it contains everyone's data. Backup files are
never committed to the repository (`*.sql.gpg` and `/backup/` are ignored).

## Running the concurrency checks by hand

`web/scripts/` has two checks that fire parallel requests at a local stack and
confirm the chat history window and the group member limit hold. They need the
full local stack and its seeded users:

```bash
supabase start
supabase db reset
cd web && npm ci
eval "$(supabase status -o env | sed 's/^/export /')"
node scripts/chat-cap-concurrency.mjs
node scripts/group-capacity-concurrency.mjs
```

Each prints `PASS: ...` and exits 0, or exits 1 on failure. They refuse to run
against anything but a local address.
