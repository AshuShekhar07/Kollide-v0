# Edge functions

| Function | Called by | Auth |
|---|---|---|
| `admin-video-url` | Admin UI (`supabase.functions.invoke`) | User JWT; caller must be in `admins`. Logs `view_video` before returning a 5-minute signed URL. |
| `send-email` | `email_outbox` insert trigger via `pg_net`; `retry-emails` cron every 15 min | `x-kollide-secret` header (`verify_jwt = false`) |
| `cleanup-videos` | `cleanup-videos` cron, hourly | `x-kollide-secret` header (`verify_jwt = false`). Deletes video files past `delete_after` through the Storage API. |
| `sweep-orphan-uploads` | `sweep-orphan-uploads` cron, hourly | `x-kollide-secret` header (`verify_jwt = false`). Deletes `photos` / `verification-videos` files older than 24 h that no row points at, through the Storage API. Logs counts only. |
| `delete-account` | Settings → Delete account (`supabase.functions.invoke`) | User JWT. Deletes the caller's photos, any unreviewed video, then the auth user. |

The cron jobs (migration `20261003000001_hardening`) reach functions through the same Vault
secrets as the email trigger: the functions base URL comes from `send_email_url`, and
`email_hook_secret` is sent as `x-kollide-secret`. No extra secrets are needed.

## Local

Nothing to do: `supabase start` serves these functions with the values in
`[edge_runtime.secrets]` (config.toml), and `seed.sql` stores the matching
Vault secrets. Emails land in Mailpit at http://127.0.0.1:54324.

## Hosted setup (once)

1. **Deploy the functions**

   ```bash
   supabase functions deploy admin-video-url
   supabase functions deploy delete-account
   supabase functions deploy send-email --no-verify-jwt
   supabase functions deploy cleanup-videos --no-verify-jwt
   supabase functions deploy sweep-orphan-uploads --no-verify-jwt
   ```

2. **Set function secrets.** Generate the hook secret with `openssl rand -hex 32`. For Gmail, use an
   App Password (Google Account → Security → 2-Step Verification → App passwords).

   **Use `scripts/hosted-secrets.sh`, not `supabase secrets set` directly.** Run from inside this
   repo, the CLI also pushes the local-only `[edge_runtime.secrets]` from `supabase/config.toml`
   to the hosted project, overwriting `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` and
   `EMAIL_HOOK_SECRET` with the local values and adding `PUBLIC_API_URL`. That breaks sign-in
   emails until they are put back. The script runs the CLI from an empty temporary folder
   instead. Run `supabase login` once first.

   ```bash
   scripts/hosted-secrets.sh set \
     SITE_URL=https://kollide.in \
     ALLOWED_ORIGINS=https://kollide.in,https://kollide.pages.dev,http://localhost:5173 \
     EMAIL_HOOK_SECRET=<random hex> \
     SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
     SMTP_USER=<you>@gmail.com SMTP_PASS=<app password> \
     SMTP_FROM="Kollide <<you>@gmail.com>"
   ```

   `scripts/hosted-secrets.sh list` shows the names and SHA-256 fingerprints of what is set
   (never the values), so you can check a change took effect. `SITE_URL` is the address used in
   email links; `ALLOWED_ORIGINS` is an exact-match list of the sites allowed to call the functions.

   Supabase blocks outbound ports 25 and 587 from edge functions, so use 465.

   Don't copy `PUBLIC_API_URL` from `config.toml`: it's local-only (it points at your own machine).

3. **Store the Vault secrets** so the database can call `send-email`. Run this in the
   SQL editor, using the same hook secret:

   ```sql
   select vault.create_secret('https://hehttlojshqmuszpzqsb.supabase.co/functions/v1/send-email', 'send_email_url');
   select vault.create_secret('<same random hex>', 'email_hook_secret');
   ```

4. **Auth email templates.** In Authentication → Email Templates, paste
   `supabase/templates/otp.html` into both **Confirm signup** and **Magic Link**, so users get a
   6-digit code instead of a link.

## Debugging email

```sql
select status, attempts, last_error, created_at from email_outbox order by created_at desc limit 10;
select status_code, content, error_msg from net._http_response order by created desc limit 10;
```

## Testing the cleanup job

Locally, after adding a new function, restart the stack (`supabase stop && supabase start`) so the
edge runtime picks it up. Then upload a file to `verification-videos`, insert a
`verification_videos` row pointing at it with `delete_after` in the past, and run:

```sql
select private.call_edge_function('cleanup-videos');
select status_code, content from net._http_response order by created desc limit 1;  -- {"deleted":1}
```

The row gets `deleted_at` and the file returns 400/404 from Storage.

## Testing the orphan sweep

There is no Deno test setup, so this is a manual test (the query deciding what counts as an orphan,
`orphaned_storage_objects`, is covered by `supabase/tests/10_upload_caps.test.sql`). Restart the
stack after adding the function, upload a file to `photos` or `verification-videos` as a seeded
user without creating a row for it, then age it and run the job:

```sql
update storage.objects set created_at = now() - interval '25 hours' where name = '<the uploaded path>';
select private.call_edge_function('sweep-orphan-uploads');
select status_code, content from net._http_response order by created desc limit 1;  -- {"deleted":{"photos":1,...}}
```

The file now returns 400/404 from Storage, and files with a row, or younger than 24 h, are left alone.
The function logs counts only, never paths or user ids.

Hosted, check the job history:

```sql
select jobname, status, return_message, start_time from cron.job_run_details
join cron.job using (jobid) order by start_time desc limit 10;
```
