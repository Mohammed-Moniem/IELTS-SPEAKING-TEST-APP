# Load Test Summary

- Generated at: `2026-02-22T13:40:31.320648+00:00`
- Runs: `9`
- Default profile: `sweep`
- Default concurrency levels: `1,2`

| Scenario | Profile | Phase | C | Mode | Req | Error % | p50 ms | p95 ms | p99 ms | RPS | Top Error |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| speaking-topics-practice | sweep | sweep | 1 | count | 10 | 0.00 | 605.06 | 615.66 | 615.95 | 1.65 | - |
| speaking-topics-practice | sweep | sweep | 2 | count | 10 | 0.00 | 624.03 | 1403.51 | 1906.39 | 2.56 | - |
| speaking-topics-practice | sweep | sweep | 4 | count | 10 | 0.00 | 609.01 | 2031.65 | 2033.61 | 4.10 | - |
| speaking-practice-history | sweep | sweep | 1 | count | 10 | 0.00 | 199.84 | 430.69 | 574.04 | 4.13 | - |
| speaking-practice-history | sweep | sweep | 2 | count | 10 | 0.00 | 200.56 | 222.76 | 223.77 | 9.69 | - |
| speaking-practice-history | sweep | sweep | 4 | count | 10 | 0.00 | 205.07 | 208.85 | 209.56 | 16.27 | - |
| speaking-simulation-history | sweep | sweep | 1 | count | 10 | 0.00 | 198.18 | 208.23 | 209.65 | 5.00 | - |
| speaking-simulation-history | sweep | sweep | 2 | count | 10 | 0.00 | 208.24 | 213.80 | 214.47 | 9.70 | - |
| speaking-simulation-history | sweep | sweep | 4 | count | 10 | 0.00 | 200.32 | 201.87 | 202.14 | 16.63 | - |

## Notes

- Treat p95 and error rate as primary SLO indicators.
- Compare profile phases (ramp/spike/soak) to identify saturation points.
- Confirm improvements by rerunning identical scenarios.
