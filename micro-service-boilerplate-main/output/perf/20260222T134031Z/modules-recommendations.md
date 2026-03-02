# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T13:40:52.690264+00:00`
- Target p95: `3500 ms`
- Target error rate: `2.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| listening-start | 1 | 230.2 | 100.00 | 4.64 | Fail |
| reading-start | 1 | 216.4 | 100.00 | 4.72 | Fail |
| writing-task-generate | 2 | 202.1 | 0.00 | 9.98 | Pass |

## Findings

- [P0] `reading-start` c=1: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `reading-start` c=2: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `reading-start` c=4: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=1: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=2: Error rate is 100.00%, which indicates overload or failing dependencies.
- [P0] `listening-start` c=4: Error rate is 100.00%, which indicates overload or failing dependencies.

## Prioritized Actions

1. Stabilize dependencies first: add retries with jitter, circuit breaking, and fallback paths.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
