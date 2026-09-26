# Edge functions

| Function | Called by | Auth |
|---|---|---|
| `admin-video-url` | Admin UI (`supabase.functions.invoke`) | User JWT; caller must be in `admins`. Logs `view_video` before returning a 5-minute signed URL. |
| `send-email` | `email_outbox` insert trigger via `pg_net` | `x-kollide-secret` header (`verify_jwt = false`) |

## Local

Nothing to do: `supabase start` serves these functions with the values in
`[edge_runtime.secrets]` (config.toml), and `seed.sql` stores the matching
Vault secrets. Emails land in Mailpit at http://127.0.0.1:54324.

## Hosted setup (once)

1. **Deploy the functions**

   ```bash
   supabase functions deploy admin-video-url
   supabase functions deploy send-email --no-verify-jwt
   ```

2. **Set function secrets.** Generate the hook secret with `openssl rand -hex 32`. For Gmail, use an
   App Password (Google Account → Security → 2-Step Verification → App passwords).

   ```bash
   supabase secrets set \
     SITE_URL=https://kollide-v0.ashushekhar07.workers.dev \
     ALLOWED_ORIGINS=https://kollide-v0.ashushekhar07.workers.dev,http://localhost:5173 \
     EMAIL_HOOK_SECRET=<random hex> \
     SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
     SMTP_USER=<you>@gmail.com SMTP_PASS=<app password> \
     SMTP_FROM="Kollide <<you>@gmail.com>"
   ```

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
