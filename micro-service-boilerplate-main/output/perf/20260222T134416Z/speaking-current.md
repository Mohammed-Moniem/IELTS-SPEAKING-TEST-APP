# Load Test Summary

- Generated at: `2026-02-22T13:44:16.702326+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1,2,4`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 598.04 | 621.15 | 633.80 | 1.66 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 606.93 | 1380.83 | 1883.12 | 2.61 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 604.20 | 1997.26 | 2014.68 | 4.13 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 198.08 | 242.80 | 262.06 | 4.83 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 199.67 | 202.04 | 202.38 | 10.01 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 200.38 | 202.64 | 202.81 | 16.50 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 197.46 | 202.26 | 203.00 | 5.05 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 197.40 | 203.08 | 204.29 | 10.06 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 205.85 | 207.33 | 207.54 | 16.18 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
