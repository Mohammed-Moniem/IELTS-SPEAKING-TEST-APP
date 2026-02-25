# Performance Gate Report

- Source report: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/20260222T032244Z/speaking-current.json`
- Gate mode: `best`
- Target p95: `120000.00 ms`
- Target error rate: `99.00%`
- Min throughput: `0.00 RPS`
- Max timeouts: `0`
- Scenario/Profile groups: `3`
- Failing groups: `0`

| Scenario | Profile | Runs | Verdict | Selected Run | p95 ms | Error % | RPS |
|---|---|---:|---|---|---:|---:|---:|
| speaking-practice-history | sweep | 3 | PASS | scenario=speaking-practice-history, profile=sweep, phase=sweep, c=4 | 250.36 | 0.00 | 14.02 |
| speaking-simulation-history | sweep | 3 | PASS | scenario=speaking-simulation-history, profile=sweep, phase=sweep, c=4 | 237.12 | 0.00 | 14.90 |
| speaking-topics-practice | sweep | 3 | PASS | scenario=speaking-topics-practice, profile=sweep, phase=sweep, c=2 | 846.30 | 0.00 | 2.78 |
