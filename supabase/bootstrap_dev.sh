#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ADMIN="python3 /Users/mohammedosman/.codex/skills/supabase-admin/scripts/supabase_admin.py"

resolve_ref() {
  if [ $# -ge 1 ] && [ -n "${1:-}" ]; then
    echo "$1"
    return
  fi

  if [ -f "${REPO_ROOT}/.supabase-admin.json" ]; then
    python3 - <<'PY'
import json
try:
    data = json.load(open(".supabase-admin.json"))
    ref = str(data.get("project_ref", "")).strip()
    if ref:
        print(ref)
except Exception:
    pass
PY
    return
  fi

  echo ""
}

REF="$(resolve_ref "${1:-}")"
if [ -z "${REF}" ]; then
  echo "Error: Supabase project ref is required."
  echo "Pass it as the first argument, or add .supabase-admin.json with {\"project_ref\": \"...\"}."
  exit 1
fi

echo "Supabase ref: ${REF}"

mkdir -p "${REPO_ROOT}/.secrets"

KEYS_FILE="${REPO_ROOT}/.secrets/supabase_api_keys.json"
if [ ! -f "${KEYS_FILE}" ]; then
  echo "Writing ${KEYS_FILE} (contains secrets; git-ignored)..."
  ${SUPABASE_ADMIN} platform-api-keys --ref "${REF}" --reveal --out "${KEYS_FILE}"
fi

echo "Ensuring Storage buckets..."
for bucket in audio chat-files avatars; do
  if ! ${SUPABASE_ADMIN} storage-get-bucket --ref "${REF}" --bucket "${bucket}" >/dev/null 2>&1; then
    ${SUPABASE_ADMIN} storage-create-bucket --ref "${REF}" --name "${bucket}" --private
  fi
done

echo "Ensuring Auth settings (anonymous + manual linking + deep links)..."
${SUPABASE_ADMIN} platform-request \
  --method PATCH \
  --path "/v1/projects/${REF}/config/auth" \
  --body-json '{"external_anonymous_users_enabled":true,"security_manual_linking_enabled":true,"uri_allow_list":"spokio://auth/callback,spokio://auth/reset"}' \
  --yes \
  >/dev/null

echo "Checking schema..."
HAS_PROFILES="$(
  ${SUPABASE_ADMIN} platform-db-query \
    --ref "${REF}" \
    --read-only \
    --sql "select to_regclass('public.profiles') as profiles;" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); row=data[0] if isinstance(data,list) and data else {}; print("1" if row.get("profiles") else "0")'
)"

if [ "${HAS_PROFILES}" = "0" ]; then
  echo "Applying migrations (fresh project detected)..."
  ${SUPABASE_ADMIN} repo-apply-migrations --repo "${REPO_ROOT}" --ref "${REF}" --mode mgmt
else
  echo "Base schema exists; applying idempotent repo migrations (0006+)..."
  ${SUPABASE_ADMIN} platform-db-query --ref "${REF}" --sql-file "${REPO_ROOT}/supabase/migrations/0006_favorites.sql"
  ${SUPABASE_ADMIN} platform-db-query --ref "${REF}" --sql-file "${REPO_ROOT}/supabase/migrations/0007_practice_sessions_voice_and_audio.sql"
  ${SUPABASE_ADMIN} platform-db-query --ref "${REF}" --sql-file "${REPO_ROOT}/supabase/migrations/0008_support_tickets.sql"
fi

echo "Seeding dev data..."
${SUPABASE_ADMIN} repo-apply-seed --repo "${REPO_ROOT}" --ref "${REF}" --seed-file supabase/seed.sql --mode mgmt --yes

echo "Done."
