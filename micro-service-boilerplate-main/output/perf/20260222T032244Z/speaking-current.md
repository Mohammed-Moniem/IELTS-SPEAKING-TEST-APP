# Load Test Summary

- Generated at: `2026-02-22T03:22:44.675494+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 688.99 | 907.96 | 1036.13 | 1.40 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 703.02 | 846.30 | 861.82 | 2.78 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 1049.09 | 2411.16 | 2412.79 | 2.66 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 230.12 | 300.58 | 325.70 | 4.27 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 208.52 | 248.68 | 248.94 | 9.27 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 242.97 | 250.36 | 250.66 | 14.02 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 232.68 | 341.44 | 381.94 | 3.96 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 204.71 | 242.40 | 245.63 | 9.36 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 221.25 | 237.12 | 237.58 | 14.90 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
