# Performance Gate Report

- Source report: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/20260222T112323Z/modules-current.json`
- Gate mode: `best`
- Target p95: `3500.00 ms`
- Target error rate: `2.00%`
- Min throughput: `0.00 RPS`
- Max timeouts: `0`
- Scenario/Profile groups: `3`
- Failing groups: `2`

| Scenario | Profile | Runs | Verdict | Selected Run | p95 ms | Error % | RPS |
|---|---|---:|---|---|---:|---:|---:|
| listening-start | sweep | 3 | FAIL | scenario=listening-start, profile=sweep, phase=sweep, c=4 | 596.67 | 100.00 | 8.00 |
| reading-start | sweep | 3 | FAIL | scenario=reading-start, profile=sweep, phase=sweep, c=4 | 638.79 | 100.00 | 6.44 |
| writing-task-generate | sweep | 2 | PASS | scenario=writing-task-generate, profile=sweep, phase=sweep, c=2 | 199.31 | 0.00 | 10.11 |

## Failure Details

- listening-start | sweep
  - scenario=listening-start, profile=sweep, phase=sweep, c=4: error rate 100.00% > 2.00%
- reading-start | sweep
  - scenario=reading-start, profile=sweep, phase=sweep, c=4: error rate 100.00% > 2.00%
