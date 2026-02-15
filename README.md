# IELTS Speaking Test App (Spokio)

This repository contains a mobile IELTS speaking practice app (Expo / React Native) plus a TypeScript/Express backend API (MongoDB + Socket.IO) that powers practice sessions, AI evaluation, audio recording storage, and social features (chat, friends, groups, achievements).

## Quick links

- Master project documentation: [docs/PROJECT-DOCUMENTATION.md](docs/PROJECT-DOCUMENTATION.md)
- Environment variables guide (mobile): [docs/ENVIRONMENT-VARIABLES-GUIDE.md](docs/ENVIRONMENT-VARIABLES-GUIDE.md)
- Architecture notes (historical; see the master doc for current reality): [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md)

## Repo layout (high level)

- `mobile/` — Expo app (React Native)
- `micro-service-boilerplate-main/` — Backend API (Express + routing-controllers)
- `docs/` — Implementation notes and guides
- `start-backend-and-mobile*.sh` — Local development automation scripts

## Run locally (recommended)

From repo root:

- Local network (same Wi‑Fi): `./start-backend-and-mobile-local.sh`
- Via ngrok tunnel: `./start-backend-and-mobile.sh`
- Via LocalTunnel (stable subdomain): `./start-backend-localtunnel.sh`

These scripts auto-generate `mobile/.env` with the correct API + Socket URL.

---

If you’re new to the project, start with [docs/PROJECT-DOCUMENTATION.md](docs/PROJECT-DOCUMENTATION.md).
