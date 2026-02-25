#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
FORWARD_URL="${1:-http://localhost:4000/api/v1/subscription/webhook}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd stripe
require_cmd jq

if [ ! -f "${ENV_FILE}" ]; then
  touch "${ENV_FILE}"
fi

cfg="$(stripe config --list)"
secret_key="$(printf '%s\n' "${cfg}" | awk -F"'" '/test_mode_api_key =/{print $2; exit}')"
publishable_key="$(printf '%s\n' "${cfg}" | awk -F"'" '/test_mode_pub_key =/{print $2; exit}')"

if [ -z "${secret_key}" ] || [ -z "${publishable_key}" ]; then
  echo "Stripe CLI test-mode keys were not found. Run: stripe login" >&2
  exit 1
fi

upsert_env() {
  local key="$1"
  local value="$2"

  if grep -qE "^${key}=" "${ENV_FILE}"; then
    perl -0pi -e "s|^${key}=.*$|${key}=${value}|mg" "${ENV_FILE}"
  else
    printf '\n%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

get_or_create_product() {
  local name="$1"
  local description="$2"
  local existing

  existing="$(stripe products list --limit 100 | jq -r --arg name "${name}" '.data[] | select(.name == $name) | .id' | head -n1)"
  if [ -n "${existing}" ]; then
    echo "${existing}"
    return
  fi

  stripe products create --name "${name}" --description "${description}" | jq -r '.id'
}

get_or_create_price() {
  local product_id="$1"
  local amount="$2"
  local interval="$3"
  local nickname="$4"
  local existing

  existing="$(
    stripe prices list --limit 100 --product "${product_id}" \
      | jq -r --argjson amount "${amount}" --arg interval "${interval}" '.data[] | select(.unit_amount == $amount and .currency == "usd" and .recurring.interval == $interval) | .id' \
      | head -n1
  )"

  if [ -n "${existing}" ]; then
    echo "${existing}"
    return
  fi

  stripe prices create \
    --unit-amount "${amount}" \
    --currency usd \
    --recurring.interval "${interval}" \
    --product "${product_id}" \
    --nickname "${nickname}" \
    | jq -r '.id'
}

premium_prod="$(get_or_create_product "Spokio Premium" "Daily IELTS prep across all modules")"
pro_prod="$(get_or_create_product "Spokio Pro" "High-intensity IELTS preparation")"
team_prod="$(get_or_create_product "Spokio Team" "Cohort and coach-focused IELTS package")"

premium_monthly="$(get_or_create_price "${premium_prod}" 1400 month "Premium Monthly")"
premium_annual="$(get_or_create_price "${premium_prod}" 14000 year "Premium Annual")"
pro_monthly="$(get_or_create_price "${pro_prod}" 2900 month "Pro Monthly")"
pro_annual="$(get_or_create_price "${pro_prod}" 29000 year "Pro Annual")"
team_monthly="$(get_or_create_price "${team_prod}" 7900 month "Team Monthly")"
team_annual="$(get_or_create_price "${team_prod}" 79000 year "Team Annual")"
webhook_secret="$(stripe listen --forward-to "${FORWARD_URL}" --print-secret)"

upsert_env STRIPE_SECRET_KEY "${secret_key}"
upsert_env STRIPE_PUBLISHABLE_KEY "${publishable_key}"
upsert_env STRIPE_WEBHOOK_SECRET "${webhook_secret}"
upsert_env STRIPE_DEFAULT_SUCCESS_URL "http://localhost:3000/app/billing?checkout=success"
upsert_env STRIPE_DEFAULT_CANCEL_URL "http://localhost:3000/app/billing?checkout=cancel"
upsert_env STRIPE_BILLING_PORTAL_RETURN_URL "http://localhost:3000/app/billing"
upsert_env STRIPE_PRICE_PREMIUM_MONTHLY "${premium_monthly}"
upsert_env STRIPE_PRICE_PREMIUM_ANNUAL "${premium_annual}"
upsert_env STRIPE_PRICE_PRO_MONTHLY "${pro_monthly}"
upsert_env STRIPE_PRICE_PRO_ANNUAL "${pro_annual}"
upsert_env STRIPE_PRICE_TEAM_MONTHLY "${team_monthly}"
upsert_env STRIPE_PRICE_TEAM_ANNUAL "${team_annual}"

echo "Stripe test mode bootstrap complete."
echo "Next step: run webhook forwarding in another terminal:"
echo "  stripe listen --forward-to ${FORWARD_URL}"
echo "STRIPE_WEBHOOK_SECRET has been updated in ${ENV_FILE}."
