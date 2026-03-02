# Load Test Summary

- Generated at: `2026-02-22T13:41:49.988203+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 602.32 | 613.03 | 616.33 | 1.66 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 600.77 | 1377.20 | 1878.40 | 2.62 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 599.22 | 2001.05 | 2003.89 | 4.15 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 196.86 | 205.79 | 207.62 | 5.04 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 199.78 | 201.73 | 201.97 | 10.01 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 204.41 | 214.41 | 214.44 | 16.30 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 197.61 | 201.77 | 203.29 | 5.05 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 199.58 | 210.88 | 212.82 | 9.90 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 205.87 | 209.86 | 210.73 | 16.27 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
