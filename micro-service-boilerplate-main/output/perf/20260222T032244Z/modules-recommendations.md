# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T03:23:10.620979+00:00`
- Target p95: `120000 ms`
- Target error rate: `99.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| listening-start | 1 | 1322.6 | 87.50 | 1.38 | Pass |
| reading-start | 1 | 1679.2 | 87.50 | 1.10 | Pass |
| writing-task-generate | 2 | 303.2 | 0.00 | 8.34 | Pass |

## Findings

- [P1] `reading-start` c=2: Error rate is 100.00%, above target 99.00%.
- [P1] `reading-start` c=2: Large p95/p50 gap suggests queueing, lock contention, or burst saturation.
- [P1] `reading-start` c=4: Error rate is 100.00%, above target 99.00%.
- [P1] `listening-start` c=2: Error rate is 100.00%, above target 99.00%.
- [P1] `listening-start` c=2: Large p95/p50 gap suggests queueing, lock contention, or burst saturation.
- [P1] `listening-start` c=4: Error rate is 100.00%, above target 99.00%.

## Prioritized Actions

1. Stabilize dependencies first: add retries with jitter, circuit breaking, and fallback paths.
2. Cap in-process concurrency and add bounded queues to avoid overload collapse.
3. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
