# Load Testing with k6

This directory contains k6 load testing scripts for the Sako API.

## Installation

Install k6: https://k6.io/docs/get-started/installation/

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Tests

### Smoke Test
Quick sanity check that the API is responding:
```bash
k6 run tests/load/k6-smoke.js
```

### Load Test
Sustained load to test normal operating conditions:
```bash
k6 run tests/load/k6-load.js
```

### Stress Test
Find the breaking point (only run on staging!):
```bash
k6 run tests/load/k6-stress.js
```

## Environment Variables

```bash
# Required
export API_URL=http://localhost:3001

# For authenticated tests
export AUTH_TOKEN=<clerk_session_token>
export WORKSPACE_ID=<workspace_id>
```

## Running with Docker

```bash
docker run -i grafana/k6 run - <tests/load/k6-smoke.js \
  -e API_URL=http://host.docker.internal:3001
```

## Interpreting Results

| Metric | Good | Acceptable | Bad |
|--------|------|------------|-----|
| http_req_duration p95 | <500ms | <1s | >2s |
| http_req_failed | <1% | <5% | >10% |
| http_reqs | >100/s | >50/s | <20/s |

## Grafana Dashboard

For real-time monitoring during load tests, k6 can output to InfluxDB/Grafana:

```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/load/k6-load.js
```

