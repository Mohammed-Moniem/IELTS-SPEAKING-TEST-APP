#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4000/api/v1}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
FLAGS_CSV="${FLAGS:-writing_module,reading_module,listening_module,full_exam_module}"
ROLLOUT_STEPS="${ROLLOUT_STEPS:-5,25,50,100}"
STEP_SLEEP_SECONDS="${STEP_SLEEP_SECONDS:-30}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
DRY_RUN="${DRY_RUN:-0}"
ROLLBACK_ON_FAIL="${ROLLBACK_ON_FAIL:-1}"
ROLLOUT_LOG="${ROLLOUT_LOG:-/tmp/spokio_rollout_$(date -u +%Y%m%dT%H%M%SZ).log}"

if [[ -z "$ADMIN_TOKEN" && "$DRY_RUN" != "1" ]]; then
  echo "ADMIN_TOKEN is required unless DRY_RUN=1." >&2
  exit 1
fi

IFS=',' read -r -a FLAGS <<< "$FLAGS_CSV"
IFS=',' read -r -a STEPS <<< "$ROLLOUT_STEPS"

if [[ ${#FLAGS[@]} -eq 0 ]]; then
  echo "FLAGS cannot be empty." >&2
  exit 1
fi

if [[ ${#STEPS[@]} -eq 0 ]]; then
  echo "ROLLOUT_STEPS cannot be empty." >&2
  exit 1
fi

log() {
  local msg="$1"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $msg" | tee -a "$ROLLOUT_LOG"
}

patch_flag() {
  local flag="$1"
  local enabled="$2"
  local percentage="$3"

  local payload
  payload=$(printf '{"enabled":%s,"rolloutPercentage":%s}' "$enabled" "$percentage")

  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY RUN PATCH ${BASE_URL}/admin/feature-flags/${flag} payload=${payload}"
    return 0
  fi

  local status
  status=$(
    curl -sS -o /tmp/spokio_flag_patch.json -w "%{http_code}" \
      -X PATCH "${BASE_URL}/admin/feature-flags/${flag}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -H "Unique-Reference-Code: rollout-${flag}-$(date +%s)" \
      -d "$payload"
  )

  if [[ "$status" != "200" ]]; then
    log "PATCH FAILED flag=${flag} status=${status}"
    cat /tmp/spokio_flag_patch.json | tee -a "$ROLLOUT_LOG" >/dev/null
    return 1
  fi

  log "PATCH OK flag=${flag} enabled=${enabled} rollout=${percentage}"
}

health_check() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY RUN HEALTH CHECK ${BASE_URL}${HEALTH_PATH}"
    return 0
  fi

  local status
  status=$(curl -sS -o /tmp/spokio_rollout_health.json -w "%{http_code}" "${BASE_URL}${HEALTH_PATH}")
  if [[ "$status" != "200" ]]; then
    log "HEALTH CHECK FAILED status=${status}"
    cat /tmp/spokio_rollout_health.json | tee -a "$ROLLOUT_LOG" >/dev/null
    return 1
  fi
  log "HEALTH CHECK OK"
}

rollback_all() {
  log "ROLLBACK started (disable + 0% rollout)."
  for flag in "${FLAGS[@]}"; do
    patch_flag "$flag" "false" "0" || true
  done
  log "ROLLBACK completed."
}

on_failure() {
  log "ROLLBACK trigger: rollout step failed."
  if [[ "$ROLLBACK_ON_FAIL" == "1" ]]; then
    rollback_all
  else
    log "ROLLBACK_ON_FAIL=0, skipping automatic rollback."
  fi
  exit 1
}

log "Feature-flag rollout started."
log "Flags: ${FLAGS_CSV}"
log "Steps: ${ROLLOUT_STEPS}"
log "Base URL: ${BASE_URL}"
log "Dry run: ${DRY_RUN}"
log "Log: ${ROLLOUT_LOG}"

for step in "${STEPS[@]}"; do
  step_trimmed="$(echo "$step" | xargs)"
  if ! [[ "$step_trimmed" =~ ^[0-9]+$ ]] || (( step_trimmed < 0 || step_trimmed > 100 )); then
    log "Invalid rollout step: '${step_trimmed}'"
    on_failure
  fi

  log "Applying rollout step ${step_trimmed}%..."
  for flag in "${FLAGS[@]}"; do
    flag_trimmed="$(echo "$flag" | xargs)"
    patch_flag "$flag_trimmed" "true" "$step_trimmed" || on_failure
  done

  health_check || on_failure

  if [[ "$step_trimmed" != "100" ]]; then
    log "Sleeping ${STEP_SLEEP_SECONDS}s before next step."
    sleep "$STEP_SLEEP_SECONDS"
  fi
done

log "Feature-flag rollout completed."
log "To rollback manually, run:"
log "  BASE_URL='${BASE_URL}' ADMIN_TOKEN='<token>' FLAGS='${FLAGS_CSV}' ROLLOUT_STEPS='0' /bin/bash scripts/ops/rollout_feature_flags.sh"
