# Spokio — Production Deployment Guide

## Prerequisites

| Requirement                   | Minimum version                   |
| ----------------------------- | --------------------------------- |
| Docker                        | 24+                               |
| Docker Compose                | v2+ (bundled with Docker Desktop) |
| Node.js (local dev only)      | 20 LTS                            |
| MongoDB (if not using Docker) | 7.x                               |

---

## 1. Quick Start with Docker Compose

```bash
# Clone the repository
git clone <repo-url> && cd IELTS-SPEAKING-TEST-APP

# Copy environment templates
cp micro-service-boilerplate-main/.env.example micro-service-boilerplate-main/.env
cp web-saas/.env.example web-saas/.env.local

# Edit both files with your production secrets (see Section 2 below)

# Build and start all services
docker compose up -d --build

# Verify
docker compose ps          # All services should be "running" / "healthy"
curl http://localhost:4000/api/v1/health   # Should return 200
curl http://localhost:3000                  # Should return HTML
```

The stack exposes:

| Service     | URL                         | Container name |
| ----------- | --------------------------- | -------------- |
| Frontend    | `http://localhost:3000`     | `web`          |
| Backend API | `http://localhost:4000`     | `api`          |
| MongoDB     | `mongodb://localhost:27017` | `mongo`        |

---

## 2. Required Environment Variables

### Backend (`micro-service-boilerplate-main/.env`)

These **must** be changed from defaults before going live:

| Variable             | Why                                                   |
| -------------------- | ----------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | Auth tokens — generate with `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Refresh tokens — same generation method               |
| `OPENAI_API_KEY`     | Powers AI speaking/writing feedback                   |
| `CORS_ORIGIN`        | Set to your production domain(s)                      |
| `MONITOR_PASSWORD`   | Status monitor access                                 |

These are **required** for their respective features:

| Variable                                                               | Feature                            |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                           | Payments / subscriptions           |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                  | Password reset, email verification |
| `FRONTEND_URL`                                                         | Email link targets                 |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Web push notifications             |

### Frontend (`web-saas/.env.local`)

| Variable                 | Notes                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| `API_INTERNAL_BASE_URL`  | Points to backend (Docker: `http://api:4000`, local: `http://127.0.0.1:4000`) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase config for analytics + push                                          |

---

## 3. Reverse Proxy / TLS

In production, place an HTTPS reverse proxy in front of the Docker stack:

### Caddy (simplest)

```
# Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Stripe Webhook Setup

1. Create a webhook endpoint in the Stripe Dashboard pointing to:
   ```
   https://api.yourdomain.com/api/v1/stripe/webhooks
   ```
2. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
3. Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in `.env`

---

## 5. Database

### Docker default (MongoDB)

Docker Compose includes MongoDB 7 with a persistent volume. Data survives `docker compose down` but not `docker compose down -v`.

### Backups

```bash
# Dump
docker compose exec mongo mongodump --out /data/backup --db ielts-speaking

# Copy to host
docker compose cp mongo:/data/backup ./backups/$(date +%Y%m%d)

# Restore
docker compose exec mongo mongorestore /data/backup
```

### Using an external MongoDB (Atlas, etc.)

Set `MONGO_URL` in `.env` to your connection string and remove the `mongo` service from `docker-compose.yml`.

---

## 6. Monitoring & Health

| Endpoint             | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `GET /api/v1/health` | Liveness check — returns component status                  |
| `GET /status`        | Status monitor (password-protected)                        |
| `GET /metrics`       | Prometheus metrics (when `TELEMETRY_METRICS_ENABLED=true`) |

### Docker health checks

The `api` and `mongo` services have built-in Docker health checks. Monitor with:

```bash
docker compose ps
docker inspect --format='{{.State.Health.Status}}' <container>
```

---

## 7. Scaling Considerations

### Horizontal scaling

- The backend is stateless (JWT auth, no server sessions) and can be scaled behind a load balancer.
- Use `docker compose up -d --scale api=3` for multiple backend instances.
- Ensure `MONGO_URL` points to a replica set for connection load.

### Memory

- Backend: ~150–300 MB per instance
- Frontend: ~80–150 MB per instance (Next.js standalone)
- MongoDB: depends on data volume; recommend 1 GB minimum

---

## 8. Production Checklist

### Security

- [ ] All secrets changed from defaults (`JWT_*`, encryption keys, `MONITOR_PASSWORD`)
- [ ] `CORS_ORIGIN` restricted to production domain(s)
- [ ] HTTPS enabled via reverse proxy
- [ ] Stripe webhook secret configured
- [ ] Firebase private key securely stored
- [ ] `NODE_ENV=production` set

### Functionality

- [ ] `curl /api/v1/health` returns 200
- [ ] Frontend loads at `/` with correct branding
- [ ] User registration + email verification flow works
- [ ] Password reset email arrives and link works
- [ ] Login / logout cycle works
- [ ] Stripe checkout creates subscription
- [ ] AI feedback returns for practice sessions
- [ ] Push notifications deliver (if enabled)

### Operations

- [ ] Database backup strategy in place
- [ ] Log aggregation configured (stdout → your log service)
- [ ] Monitoring / alerting set up for health endpoint
- [ ] DNS configured for domain(s)
- [ ] SSL certificate auto-renewal (Caddy does this automatically, certbot cron for nginx)

---

## 9. Updating

```bash
git pull origin main

# Rebuild and restart with zero-downtime
docker compose up -d --build

# Or rebuild a specific service
docker compose up -d --build api
docker compose up -d --build web
```

---

## 10. Troubleshooting

| Symptom                    | Check                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| API returns 502            | `docker compose logs api` — likely missing env vars                    |
| Frontend blank page        | `docker compose logs web` — check `API_INTERNAL_BASE_URL`              |
| Auth fails                 | Verify `JWT_ACCESS_SECRET` matches between restarts                    |
| Stripe webhooks fail       | Check `STRIPE_WEBHOOK_SECRET`, verify endpoint URL in Stripe Dashboard |
| Email not sending          | Verify `RESEND_API_KEY` and that sender domain is verified in Resend   |
| MongoDB connection refused | `docker compose logs mongo` — check volume permissions                 |

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f api

# Restart a crashed service
docker compose restart api

# Full rebuild from scratch
docker compose down && docker compose up -d --build
```
