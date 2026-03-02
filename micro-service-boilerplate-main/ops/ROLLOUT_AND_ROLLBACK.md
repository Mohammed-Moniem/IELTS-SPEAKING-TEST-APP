# Web SaaS Feature Rollout and Rollback

This runbook provides staged rollout controls for learner/admin feature flags without deploy rollback.

## Script

Use:

`/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/scripts/ops/rollout_feature_flags.sh`

## Preflight

1. Confirm API health is stable on target environment.
2. Use an `ADMIN_TOKEN` from a `superadmin` account.
3. Select flags and rollout steps.
4. Start with dry run.

## Dry Run

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
DRY_RUN=1 \
BASE_URL="https://api.example.com/api/v1" \
FLAGS="writing_module,reading_module,listening_module,full_exam_module" \
ROLLOUT_STEPS="5,25,50,100" \
bash scripts/ops/rollout_feature_flags.sh
```

## Live Rollout

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
BASE_URL="https://api.example.com/api/v1" \
ADMIN_TOKEN="<superadmin-jwt>" \
FLAGS="writing_module,reading_module,listening_module,full_exam_module" \
ROLLOUT_STEPS="5,25,50,100" \
STEP_SLEEP_SECONDS=180 \
bash scripts/ops/rollout_feature_flags.sh
```

## Monitoring During Rollout

Track these at each step before proceeding:

1. API p95/p99 latency and error rate.
2. AI request volume/cost trend.
3. Queue depth and timeout rates.
4. Frontend fatal errors and auth/session failures.

If any SLO breaches, stop rollout and run rollback.

## Rollback

Disable all rollout flags immediately:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main
BASE_URL="https://api.example.com/api/v1" \
ADMIN_TOKEN="<superadmin-jwt>" \
FLAGS="writing_module,reading_module,listening_module,full_exam_module" \
ROLLOUT_STEPS="0" \
bash scripts/ops/rollout_feature_flags.sh
```

## Notes

- Script logs to `/tmp/spokio_rollout_<timestamp>.log` unless `ROLLOUT_LOG` is set.
- `ROLLBACK_ON_FAIL=1` auto-disables flags if any patch/health step fails.
