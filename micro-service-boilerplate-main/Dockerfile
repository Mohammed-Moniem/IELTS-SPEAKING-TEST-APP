# ── Backend API Dockerfile ───────────────────────────────────────────────────
# Multi-stage build: compile TypeScript → slim production image

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# env.ts does require("../package.json") — compiled to dist/src/env.js,
# so package.json must exist at dist/package.json for the import to resolve.
RUN cp package.json dist/

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./
# Install production deps + tsconfig-paths for runtime path-alias resolution
RUN npm ci --omit=dev && npm install tsconfig-paths@4.2.0 --no-save

# Compiled output
COPY --from=builder /app/dist ./dist

# tsconfig.json is read by tsconfig-paths-bootstrap.js for path mappings
COPY --from=builder /app/tsconfig.json ./
COPY tsconfig-paths-bootstrap.js ./

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

# Use the bootstrap script to register path aliases, then start the app
CMD ["node", "-r", "./tsconfig-paths-bootstrap.js", "dist/src/app.js"]