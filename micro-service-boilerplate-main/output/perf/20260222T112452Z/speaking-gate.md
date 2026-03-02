# Performance Gate Report

- Source report: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/20260222T112452Z/speaking-current.json`
- Gate mode: `best`
- Target p95: `2500.00 ms`
- Target error rate: `2.00%`
- Min throughput: `0.00 RPS`
- Max timeouts: `0`
- Scenario/Profile groups: `3`
- Failing groups: `0`

| Scenario | Profile | Runs | Verdict | Selected Run | p95 ms | Error % | RPS |
|---|---|---:|---|---|---:|---:|---:|
| speaking-practice-history | sweep | 3 | PASS | scenario=speaking-practice-history, profile=sweep, phase=sweep, c=4 | 205.54 | 0.00 | 16.54 |
| speaking-simulation-history | sweep | 3 | PASS | scenario=speaking-simulation-history, profile=sweep, phase=sweep, c=4 | 201.27 | 0.00 | 16.65 |
| speaking-topics-practice | sweep | 3 | PASS | scenario=speaking-topics-practice, profile=sweep, phase=sweep, c=4 | 2019.83 | 0.00 | 4.12 |
