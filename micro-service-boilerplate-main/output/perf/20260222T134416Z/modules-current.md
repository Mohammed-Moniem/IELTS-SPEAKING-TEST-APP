# Load Test Summary

- Generated at: `2026-02-22T13:44:38.689274+00:00`
- Runs: `8`
- Default profile: `sweep`
- Default concurrency levels: `1,2,4`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| writing-task-generate | sweep | sweep | 1 | count | 8 | 0.00 | 200.86 | 203.35 | 203.62 | 4.97 | - |
| writing-task-generate | sweep | sweep | 2 | count | 8 | 0.00 | 199.66 | 204.48 | 205.72 | 9.97 | - |
| reading-start | sweep | sweep | 1 | count | 8 | 0.00 | 1002.29 | 1042.45 | 1047.15 | 0.99 | - |
| reading-start | sweep | sweep | 2 | count | 8 | 0.00 | 1001.33 | 1368.24 | 1397.49 | 1.71 | - |
| reading-start | sweep | sweep | 4 | count | 8 | 0.00 | 1017.99 | 1309.17 | 1309.57 | 3.44 | - |
| listening-start | sweep | sweep | 1 | count | 8 | 0.00 | 997.20 | 1017.51 | 1017.85 | 1.00 | - |
| listening-start | sweep | sweep | 2 | count | 8 | 0.00 | 1006.51 | 1140.39 | 1189.98 | 1.90 | - |
| listening-start | sweep | sweep | 4 | count | 8 | 0.00 | 1214.14 | 1369.11 | 1422.93 | 3.02 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
