# Performance Recommendation Report

- Source report: `http_load_test.py`
- Generated at: `2026-02-22T03:22:44.675494+00:00`
- Target p95: `120000 ms`
- Target error rate: `99.00%`

## Best Candidate Per Scenario

| Scenario | Concurrency | p95 ms | Error % | Throughput (RPS) | Verdict |
|---|---:|---:|---:|---:|---|
| speaking-practice-history | 4 | 250.4 | 0.00 | 14.02 | Pass |
| speaking-simulation-history | 4 | 237.1 | 0.00 | 14.90 | Pass |
| speaking-topics-practice | 2 | 846.3 | 0.00 | 2.78 | Pass |

## Findings

- [P1] `speaking-topics-practice` c=4: Saturation detected: 2->4 concurrency raised latency sharply with little throughput gain.

## Prioritized Actions

1. Cap in-process concurrency and add bounded queues to avoid overload collapse.
2. Re-run the same load profile after each change and compare p95/error/throughput deltas.

## Execution Loop

1. Apply one optimization at a time.
2. Re-run the same scenario file and concurrency set.
3. Keep the change only if p95 decreases without increasing error rate.
