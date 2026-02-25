# Checkpoint 6 Load and Regression Toolkit

This folder contains repeatable load scenarios for the remaining Web SaaS launch gates:

- speaking regression checks (`/speech/evaluate`, `/speech/synthesize`)
- new module pipeline checks (`/writing/submissions`, `/reading/tests/start`, `/listening/tests/start`)

## Files

- `perf/scenarios/speaking-regression.template.json`
- `perf/scenarios/module-pipelines.template.json`
- `scripts/perf/run_checkpoint6_load.sh`

## Run

1. Start the API in an environment that has valid auth, AI providers, and seeded data.
2. Export an auth token for a perf-capable user (recommended: Premium/Pro test account).
3. Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
PERF_AUTH_TOKEN="<jwt>" \
PERF_BASE_URL="http://127.0.0.1:3000/api/v1" \
npm run perf:checkpoint6
```

## Optional knobs

- `PERF_CONCURRENCY` default `1,2,4`
- `PERF_REQUESTS_PER_LEVEL` default `20`
- `PERF_OUTPUT_DIR` custom output directory
- `PERF_TARGET_P95_MS_SPEAKING` default `2500`
- `PERF_TARGET_P95_MS_MODULES` default `3500`
- `PERF_TARGET_ERROR_RATE_SPEAKING` default `0.02`
- `PERF_TARGET_ERROR_RATE_MODULES` default `0.02`
- `PERF_BASELINE_SPEAKING_REPORT` baseline JSON for speaking comparison
- `PERF_BASELINE_MODULES_REPORT` baseline JSON for module comparison
- `PERF_MAX_P95_REGRESSION_PCT` default `10`
- `PERF_MAX_RPS_DROP_PCT` default `10`

## Output

The runner writes machine-readable JSON and markdown summaries under `output/perf/<timestamp>/`:

- `speaking-current.json` / `speaking-current.md`
- `modules-current.json` / `modules-current.md`
- recommendations (`*-recommendations.md`)
- gate results (`*-gate.md`, `*-gate.json`)
- optional baseline comparisons (`*-compare.md`, `*-compare.json`)

## Notes

- Speaking scenarios use speaking-safe read paths (`/topics/practice`, `/practice/sessions`, `/test-simulations`) to avoid changing speaking contracts while still testing speaking stack latency.
- Module scenarios currently target generation/start endpoints (`/writing/tasks/generate`, `/reading/tests/start`, `/listening/tests/start`) for deterministic checkpoint runs.
- Do not run high-concurrency profiles against production unless explicitly approved.
