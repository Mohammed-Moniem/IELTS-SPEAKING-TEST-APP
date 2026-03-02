# Load Test Summary

- Generated at: `2026-02-22T11:24:52.923515+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 598.09 | 793.43 | 822.78 | 1.57 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 600.39 | 1375.21 | 1864.27 | 2.60 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 607.16 | 2019.83 | 2021.68 | 4.12 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 199.99 | 284.89 | 316.17 | 4.63 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 245.51 | 769.87 | 982.71 | 5.62 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 201.53 | 205.54 | 205.62 | 16.54 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 200.34 | 260.23 | 280.81 | 4.75 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 198.42 | 224.68 | 224.79 | 9.78 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 199.64 | 201.27 | 201.33 | 16.65 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
