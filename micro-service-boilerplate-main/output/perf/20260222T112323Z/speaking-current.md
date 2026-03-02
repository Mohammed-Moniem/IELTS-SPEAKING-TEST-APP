# Load Test Summary

- Generated at: `2026-02-22T11:23:23.790115+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 598.15 | 702.01 | 751.47 | 1.62 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 608.04 | 1393.73 | 1898.42 | 2.60 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 634.97 | 3181.42 | 3470.74 | 2.82 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 240.14 | 444.29 | 450.80 | 3.61 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 198.80 | 210.97 | 211.84 | 9.97 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 199.41 | 202.45 | 202.60 | 16.64 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 196.81 | 201.63 | 203.27 | 5.06 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 202.32 | 214.82 | 214.84 | 9.79 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 197.32 | 201.96 | 203.13 | 16.71 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
