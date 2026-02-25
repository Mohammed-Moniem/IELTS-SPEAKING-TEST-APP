# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T13:42:10.514857+00:00`
- Target p95: `3500 ms`
- Target error rate: `2.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| listening-start | 2 | 545.2 | 100.00 | 4.36 | Fail |
| reading-start | 4 | 612.8 | 100.00 | 7.82 | Fail |
| writing-task-generate | 2 | 201.8 | 0.00 | 10.08 | Pass |

## Findings

- [P0] `reading-start` c=1: Error rate is 87.50%, which indicates overload or failing dependencies.
- [P0] `reading-start` c=2: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `reading-start` c=4: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=1: Error rate is 87.50%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=2: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=4: Error rate is 100.00%, which indicates overload or failing dependencies.

## Prioritized Actions

1. Stabilize dependencies first: add retries with jitter, circuit breaking, and fallback paths.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
