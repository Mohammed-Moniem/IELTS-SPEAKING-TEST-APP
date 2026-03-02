# Load Test Summary

- Generated at: `2026-02-22T03:20:29.465043+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 686.17 | 9405.73 | 9429.36 | 0.30 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 687.05 | 1690.86 | 2295.44 | 2.27 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 1088.10 | 3793.04 | 3869.96 | 2.21 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 216.74 | 228.66 | 230.16 | 4.66 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 248.66 | 360.12 | 360.58 | 7.62 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 215.23 | 217.25 | 217.67 | 15.64 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 226.51 | 257.13 | 263.18 | 4.39 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 224.79 | 243.24 | 243.37 | 9.00 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 238.78 | 242.16 | 242.79 | 14.78 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
