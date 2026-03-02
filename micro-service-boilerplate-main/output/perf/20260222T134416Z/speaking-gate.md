# Performance Gate Report

- Source report: `/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main/output/perf/20260222T134416Z/speaking-current.json`
- Gate mode: `best`
- Target p95: `2500.00 ms`
- Target error rate: `2.00%`
- Min throughput: `0.00 RPS`
- Max timeouts: `0`
- Scenario/Profile groups: `3`
- Failing groups: `0`

| Scenario | Profile | Runs | Verdict | Selected Run | p95 ms | Error % | RPS |
|---|---|---:|---|---|---:|---:|---:|
| speaking-practice-history | sweep | 3 | PASS | scenario=speaking-practice-history, profile=sweep, phase=sweep, c=4 | 202.64 | 0.00 | 16.50 |
| speaking-simulation-history | sweep | 3 | PASS | scenario=speaking-simulation-history, profile=sweep, phase=sweep, c=4 | 207.33 | 0.00 | 16.18 |
| speaking-topics-practice | sweep | 3 | PASS | scenario=speaking-topics-practice, profile=sweep, phase=sweep, c=4 | 1997.26 | 0.00 | 4.13 |
