# Prometheus Setup

Prometheus can be configured to scrape telemetry exposed by this microservice so that request traces and metrics are visualised centrally. The following steps describe a generic workflow that applies to local development or small deployments.

## 1. Enable Telemetry in the Service

Prometheus requires the service to expose a scrapeable endpoint. Configure the runtime by setting telemetry-related flags (for example inside `.env`):

```env
TELEMETRY_ENABLED=true
TELEMETRY_METRICS_ENABLED=true
TELEMETRY_METRICS_PORT=9464
TELEMETRY_METRICS_PATH=/metrics
```

After setting the flags, start the microservice. The telemetry loader exposes Prometheus metrics on `http://<host>:<TELEMETRY_METRICS_PORT><TELEMETRY_METRICS_PATH>`.

## 2. Provide a Prometheus Configuration

Prometheus uses a YAML configuration file to identify scrape targets. The following minimal configuration can be saved as `prometheus.yml` in the repository root or any convenient directory:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'chat-service'
    static_configs:
      - targets:
          - 'host.docker.internal:9464'
        labels:
          service: 'chat-service'
```

When Prometheus runs on the same host as the microservice, `localhost:9464` can be substituted for `host.docker.internal:9464`. In containerised environments, adjust the hostname to match the service endpoint that Prometheus can reach.

## 3. Launch Prometheus

Prometheus can be started with Docker or by executing the binary directly.

**Docker example:**

```bash
docker run --rm -p 9090:9090   -v "$(pwd)/prometheus.yml":/etc/prometheus/prometheus.yml   prom/prometheus
```

**Binary example:**

1. Download the Prometheus release from https://prometheus.io/download/ and extract it.
2. Place `prometheus.yml` alongside the binary.
3. Run: `./prometheus --config.file=prometheus.yml`

Prometheus listens on `http://localhost:9090` by default.

## 4. Verify the Scrape

Once Prometheus is running:

- Navigate to `http://localhost:9090/targets` to confirm that the configured target reports an `UP` status.
- Use the *Graph* tab in the Prometheus UI to query metrics such as `http_requests_total` or `http_request_duration_seconds_bucket`.
- If the target is `DOWN`, confirm that the microservice is running, the telemetry endpoint is reachable, and that the hostname/port in `prometheus.yml` matches the actual deployment topology.

This setup can be extended by adding additional scrape jobs for other microservices, integrating Alertmanager, or exporting the scraped metrics into Grafana dashboards.
