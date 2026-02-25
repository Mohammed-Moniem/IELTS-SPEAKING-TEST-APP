# Performance Gate Report

- Source report: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/20260222T112452Z/modules-current.json`
- Gate mode: `best`
- Target p95: `3500.00 ms`
- Target error rate: `2.00%`
- Min throughput: `0.00 RPS`
- Max timeouts: `0`
- Scenario/Profile groups: `3`
- Failing groups: `0`

| Scenario | Profile | Runs | Verdict | Selected Run | p95 ms | Error % | RPS |
|---|---|---:|---|---|---:|---:|---:|
| listening-start | sweep | 3 | PASS | scenario=listening-start, profile=sweep, phase=sweep, c=4 | 1881.76 | 0.00 | 2.32 |
| reading-start | sweep | 3 | PASS | scenario=reading-start, profile=sweep, phase=sweep, c=4 | 1346.71 | 0.00 | 3.01 |
| writing-task-generate | sweep | 2 | PASS | scenario=writing-task-generate, profile=sweep, phase=sweep, c=2 | 203.40 | 0.00 | 10.00 |
