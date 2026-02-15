# Supabase Setup (Spokio)

This repo is configured to use **Supabase Postgres + Auth + Storage**.

## Project

Project ref (dev): `nhgdjnqfqpjiavkdosfx`

Buckets (private):
- `audio`
- `chat-files`
- `avatars`

## Apply Migrations

Run from anywhere (uses your Supabase PAT via Keychain/env):

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-db-query \
  --ref nhgdjnqfqpjiavkdosfx \
  --sql-file supabase/migrations/0001_init.sql
```

Seed minimal dev data:

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-db-query \
  --ref nhgdjnqfqpjiavkdosfx \
  --sql-file supabase/seed.sql
```

## Auth Settings (Dashboard)

In Supabase Dashboard:
- Auth providers: enable **Email**, **Anonymous**, **Google**
- URL configuration:
  - Add Redirect URLs:
    - `spokio://auth/callback`
    - `spokio://auth/reset`

### Auth Settings (CLI via supabase-admin)

You can also enable the critical Auth flags via Supabase Management API (no secrets printed):

Enable anonymous sign-ins + manual identity linking + deep-link allow list:

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-request \
  --method PATCH \
  --path /v1/projects/nhgdjnqfqpjiavkdosfx/config/auth \
  --body-json '{"external_anonymous_users_enabled":true,"security_manual_linking_enabled":true,"uri_allow_list":"spokio://auth/callback,spokio://auth/reset"}' \
  --yes
```

Enable Google OAuth (requires credentials). Do NOT paste secrets into the shell; use a JSON file:

```bash
cat > /tmp/spokio_google_auth.json <<'JSON'
{
  "external_google_enabled": true,
  "external_google_client_id": "YOUR_GOOGLE_CLIENT_ID",
  "external_google_secret": "YOUR_GOOGLE_CLIENT_SECRET"
}
JSON

python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-request \
  --method PATCH \
  --path /v1/projects/nhgdjnqfqpjiavkdosfx/config/auth \
  --body-file /tmp/spokio_google_auth.json \
  --yes
```

## Local Env Files

Do not commit secrets.

Mobile (`/mobile/.env`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Backend (`/micro-service-boilerplate-main/.env`):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
