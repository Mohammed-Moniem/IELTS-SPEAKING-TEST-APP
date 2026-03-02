#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PERF_DIR="$ROOT_DIR/perf"
SCENARIO_DIR="$PERF_DIR/scenarios"

LOAD_SKILL="${LOAD_SKILL:-$HOME/.codex/skills/load-performance-analysis}"
HTTP_LOAD_SCRIPT="$LOAD_SKILL/scripts/http_load_test.py"
RECOMMEND_SCRIPT="$LOAD_SKILL/scripts/perf_recommendations.py"
GATE_SCRIPT="$LOAD_SKILL/scripts/perf_gate.py"
COMPARE_SCRIPT="$LOAD_SKILL/scripts/compare_runs.py"

for required in "$HTTP_LOAD_SCRIPT" "$RECOMMEND_SCRIPT" "$GATE_SCRIPT" "$COMPARE_SCRIPT"; do
  if [[ ! -f "$required" ]]; then
    echo "Missing load analysis tool: $required" >&2
    exit 1
  fi
done

BASE_URL="${PERF_BASE_URL:-http://127.0.0.1:3000/api/v1}"
AUTH_TOKEN="${PERF_AUTH_TOKEN:-}"
if [[ -z "$AUTH_TOKEN" ]]; then
  echo "PERF_AUTH_TOKEN is required." >&2
  echo "Example: PERF_AUTH_TOKEN=<jwt> npm run perf:checkpoint6" >&2
  exit 1
fi

CONCURRENCY="${PERF_CONCURRENCY:-1,2,4}"
REQUESTS_PER_LEVEL="${PERF_REQUESTS_PER_LEVEL:-20}"
OUTPUT_DIR="${PERF_OUTPUT_DIR:-$ROOT_DIR/output/perf/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUTPUT_DIR"

SPEAKING_TEMPLATE="$SCENARIO_DIR/speaking-regression.template.json"
MODULE_TEMPLATE="$SCENARIO_DIR/module-pipelines.template.json"

SPEAKING_SCENARIO="$OUTPUT_DIR/speaking-regression.scenario.json"
MODULE_SCENARIO="$OUTPUT_DIR/module-pipelines.scenario.json"

SPEAKING_REPORT_JSON="$OUTPUT_DIR/speaking-current.json"
SPEAKING_REPORT_MD="$OUTPUT_DIR/speaking-current.md"
MODULE_REPORT_JSON="$OUTPUT_DIR/modules-current.json"
MODULE_REPORT_MD="$OUTPUT_DIR/modules-current.md"

echo "Performance output directory: $OUTPUT_DIR"

render_scenario() {
  local template_path="$1"
  local output_path="$2"
  python3 - <<'PY' "$template_path" "$output_path" "$BASE_URL" "$AUTH_TOKEN"
import json
import sys
from pathlib import Path

template_path, output_path, base_url, auth_token = sys.argv[1:5]
template = Path(template_path).read_text()
rendered = (
    template
    .replace("{{BASE_URL}}", base_url.rstrip("/"))
    .replace("{{AUTH_TOKEN}}", auth_token)
)

# Validate JSON before writing.
json.loads(rendered)
Path(output_path).write_text(rendered)
PY
}

render_scenario "$SPEAKING_TEMPLATE" "$SPEAKING_SCENARIO"
render_scenario "$MODULE_TEMPLATE" "$MODULE_SCENARIO"

echo "Running speaking regression load scenarios..."
python3 "$HTTP_LOAD_SCRIPT" \
  --scenario-file "$SPEAKING_SCENARIO" \
  --concurrency "$CONCURRENCY" \
  --requests-per-level "$REQUESTS_PER_LEVEL" \
  --output-json "$SPEAKING_REPORT_JSON" \
  --output-markdown "$SPEAKING_REPORT_MD"

echo "Running writing/reading/listening pipeline load scenarios..."
python3 "$HTTP_LOAD_SCRIPT" \
  --scenario-file "$MODULE_SCENARIO" \
  --concurrency "$CONCURRENCY" \
  --requests-per-level "$REQUESTS_PER_LEVEL" \
  --output-json "$MODULE_REPORT_JSON" \
  --output-markdown "$MODULE_REPORT_MD"

echo "Generating optimization recommendations..."
python3 "$RECOMMEND_SCRIPT" \
  --report "$SPEAKING_REPORT_JSON" \
  --target-p95-ms "${PERF_TARGET_P95_MS_SPEAKING:-2500}" \
  --target-error-rate "${PERF_TARGET_ERROR_RATE_SPEAKING:-0.02}" \
  --output-md "$OUTPUT_DIR/speaking-recommendations.md"

python3 "$RECOMMEND_SCRIPT" \
  --report "$MODULE_REPORT_JSON" \
  --target-p95-ms "${PERF_TARGET_P95_MS_MODULES:-3500}" \
  --target-error-rate "${PERF_TARGET_ERROR_RATE_MODULES:-0.02}" \
  --output-md "$OUTPUT_DIR/modules-recommendations.md"

echo "Applying performance gates..."
python3 "$GATE_SCRIPT" \
  --report "$SPEAKING_REPORT_JSON" \
  --target-p95-ms "${PERF_TARGET_P95_MS_SPEAKING:-2500}" \
  --target-error-rate "${PERF_TARGET_ERROR_RATE_SPEAKING:-0.02}" \
  --gate-mode best \
  --output-md "$OUTPUT_DIR/speaking-gate.md" \
  --output-json "$OUTPUT_DIR/speaking-gate.json"

python3 "$GATE_SCRIPT" \
  --report "$MODULE_REPORT_JSON" \
  --target-p95-ms "${PERF_TARGET_P95_MS_MODULES:-3500}" \
  --target-error-rate "${PERF_TARGET_ERROR_RATE_MODULES:-0.02}" \
  --gate-mode best \
  --output-md "$OUTPUT_DIR/modules-gate.md" \
  --output-json "$OUTPUT_DIR/modules-gate.json"

if [[ -n "${PERF_BASELINE_SPEAKING_REPORT:-}" && -f "${PERF_BASELINE_SPEAKING_REPORT}" ]]; then
  echo "Comparing speaking run against baseline: $PERF_BASELINE_SPEAKING_REPORT"
  python3 "$COMPARE_SCRIPT" \
    --base-report "$PERF_BASELINE_SPEAKING_REPORT" \
    --candidate-report "$SPEAKING_REPORT_JSON" \
    --max-p95-regression-pct "${PERF_MAX_P95_REGRESSION_PCT:-10}" \
    --max-rps-drop-pct "${PERF_MAX_RPS_DROP_PCT:-10}" \
    --output-md "$OUTPUT_DIR/speaking-compare.md" \
    --output-json "$OUTPUT_DIR/speaking-compare.json"
fi

if [[ -n "${PERF_BASELINE_MODULES_REPORT:-}" && -f "${PERF_BASELINE_MODULES_REPORT}" ]]; then
  echo "Comparing module run against baseline: $PERF_BASELINE_MODULES_REPORT"
  python3 "$COMPARE_SCRIPT" \
    --base-report "$PERF_BASELINE_MODULES_REPORT" \
    --candidate-report "$MODULE_REPORT_JSON" \
    --max-p95-regression-pct "${PERF_MAX_P95_REGRESSION_PCT:-10}" \
    --max-rps-drop-pct "${PERF_MAX_RPS_DROP_PCT:-10}" \
    --output-md "$OUTPUT_DIR/modules-compare.md" \
    --output-json "$OUTPUT_DIR/modules-compare.json"
fi

echo "Load suite complete."
echo "Reports:"
echo "  - $SPEAKING_REPORT_MD"
echo "  - $MODULE_REPORT_MD"
echo "  - $OUTPUT_DIR/speaking-gate.md"
echo "  - $OUTPUT_DIR/modules-gate.md"
