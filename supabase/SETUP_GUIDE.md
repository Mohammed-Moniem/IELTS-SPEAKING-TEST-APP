# Supabase Setup (Spokio)

This repo is configured to use **Supabase Postgres + Auth + Storage**.

## Project (Dev)

Project ref: `nhgdjnqfqpjiavkdosfx`

Repo link file (non-secret): `.supabase-admin.json`

Buckets (private):
- `audio`
- `chat-files`
- `avatars`

## One-Time Setup (Local)

1. Save Supabase PAT to Keychain (recommended; avoids shell history):

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-keychain-save-token
```

2. Fetch project API keys into the local secrets file used by `start-backend-and-mobile-local.sh` (never commit):

```bash
mkdir -p .secrets
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-api-keys \
  --ref nhgdjnqfqpjiavkdosfx \
  --reveal \
  --out .secrets/supabase_api_keys.json
```

3. Ensure Storage buckets exist (private):

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py storage-create-bucket --ref nhgdjnqfqpjiavkdosfx --name audio --private
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py storage-create-bucket --ref nhgdjnqfqpjiavkdosfx --name chat-files --private
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py storage-create-bucket --ref nhgdjnqfqpjiavkdosfx --name avatars --private
```

4. Apply DB migrations (fresh projects only):

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py repo-apply-migrations \
  --repo . \
  --ref nhgdjnqfqpjiavkdosfx \
  --mode mgmt
```

5. Seed minimal dev data:

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py repo-apply-seed \
  --repo . \
  --ref nhgdjnqfqpjiavkdosfx \
  --seed-file supabase/seed.sql \
  --mode mgmt \
  --yes
```

## Auth Settings (CLI via supabase-admin)

Ensure guest mode + identity linking + deep-link allow-list:

```bash
python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py platform-request \
  --method PATCH \
  --path /v1/projects/nhgdjnqfqpjiavkdosfx/config/auth \
  --body-json '{"external_anonymous_users_enabled":true,"security_manual_linking_enabled":true,"uri_allow_list":"spokio://auth/callback,spokio://auth/reset"}' \
  --yes
```

Optional: enable Google OAuth (requires credentials). Do NOT paste secrets into the shell; use a JSON file:

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

## Run Locally

- Backend needs `OPENAI_API_KEY` (set in `micro-service-boilerplate-main/.env` or exported in your shell).
- Start everything (writes `mobile/.env` automatically and injects Supabase env vars into the backend process):

```bash
./start-backend-and-mobile-local.sh
```

## Notes

- `.secrets/` is git-ignored.
- Mobile uses `EXPO_PUBLIC_SUPABASE_*` (anon key only).
- Backend uses `SUPABASE_SERVICE_ROLE_KEY` (server-only).
