# Copilot Agent Implementation Guide: Express Service Microservice Boilerplate

This project represents an **express js microservice boilerplate**.
These instructions are authoritative. Do **NOT** hallucinate APIs, files, environment variables, or architectural layers not explicitly described here or already present in the repository unless asked to do so.
Follow the instructions exactly as specified.

---

## 1. Architectural Snapshot (Current Codebase)

- Bootstrapped in `src/app.ts` using side-effect imports of loaders (`iocLoader`, `expressLoader`, `homeLoader`, `winstonLoader`, `DBLoader`, `RabbitMQLoader`).
- HTTP server created in `src/loaders/expressLoader.ts` via `routing-controllers#createExpressServer` with `defaultErrorHandler: false` (custom error handling used).
- Dependency Injection: `typedi` configured in `src/loaders/iocLoader.ts` for both `routing-controllers` and `class-validator`.
- Logging: Winston configured globally in `winstonLoader`; scoped logger wrapper in `src/lib/logger/Logger.ts` used as `new Logger(__filename)`.
- Environment configuration centralized in `src/env.ts`; path discovery for controllers/middlewares via `getOsPaths` / `getPaths` pattern.
- Error system: Custom `Error` / `CredError` classes + error code mapping (`errorCodes.ts`, `errorCodeConstants.ts`). Standardized output via `ErrorResponse` in global `ErrorHandleMiddleware`.
- Encryption utilities provided in `src/lib/env/helpers.ts` (`encryptValue`, `decryptValue`). Used in Mongoose pre-save hooks.
- Headers: `URCHeaderMiddleware` enforces a `Unique-Reference-Code` header for traceability and logging context.
- Response System: `StandardResponse` static class provides consistent API response formatting with CSError integration.
- RabbitMQ: `RabbitMQService` handles message queuing with queue processors, topic processors, and encrypted messaging support.

---

## 2. Do **NOT**:

- Implement user management (external service will handle users).
- Implement gateway logic (handled externally).
- Remove existing notification functionality during incremental migration.
- Invent queue workflows for service unless explicitly requested later.

### 2.1 Configuration & Testing

- Whenever you introduce new functionality, prefer to make it configurable via flags sourced from `env.ts` when it is logical or necessary.
- Default to the safest behaviour when a toggle is disabled and keep new checks/controllers wrapped behind that flag.
- Add or update tests for every new code path introduced; no feature ships without matching coverage.

---

## 3. Required New Components

### 3.1 Environment Variables (Add to `.env.example` + `src/env.ts`)

| Variable                  | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `API_KEY`                 | Static API key for request authentication (`x-api-key` header). |
| `RATE_LIMIT_WINDOW_MS`    | Rate limiting window in ms (default: 60000).                    |
| `RATE_LIMIT_MAX`          | Max requests per window per IP (default: 60).                   |
| `CORS_ORIGIN`             | Allowed CORS origin(s) (string or comma list; default: `*`).    |
| `RABBITMQ_ENABLED`        | Enable RabbitMQ service (default: false).                       |
| `RABBITMQ_URL`            | RabbitMQ connection URL (default: amqp://localhost).            |
| `RABBITMQ_EXCHANGE`       | Default exchange name (default: default.exchange).              |
| `RABBITMQ_QUEUE`          | Default queue name (default: default.queue).                    |
| `RABBITMQ_ROUTING_KEY`    | Default routing key (default: default.routing.key).             |
| `RABBITMQ_PREFETCH`       | Message prefetch count (default: 10).                           |
| `RABBITMQ_EXCHANGE_TYPE`  | Exchange type (default: direct).                                |
| `RABBITMQ_RETRIES`        | Connection retry attempts (default: 3).                         |
| `RABBITMQ_RETRY_DELAY`    | Retry delay in ms (default: 5000).                              |
| `RABBITMQ_STALE_DURATION` | Message staleness duration in ms (default: 300000).             |
| `RABBITMQ_ENCRYPTION_KEY` | Encryption key for sensitive message payloads.                  |
| `RABBITMQ_LOG_LEVEL`      | RabbitMQ logging level (default: info).                         |

Expose them under `env.app` as: `apiKey`, `rateWindowMs`, `rateMax`, `corsOrigin`.
Expose RabbitMQ vars under `env.rabbitmq` as shown in existing `env.ts`.

### 3.2 Models (`src/api/models/`)

### 3.3 Interfaces (`src/api/Interface/`)

### 3.4 Service (`src/api/services/**.ts`)

1- Methods (all accept `headers: IRequestHeaders` for logging):
2- All methods start with `constructLogMessage(__filename, '<method>', headers)`.
3- All methods are wrapped in `try/catch` to log errors before re-throwing.
4- Throw mapped errors (`CSError`) on invalid operations.

Each method:

- Logs entry via `constructLogMessage(__filename, '<method>', headers)`.
- Throws existing mapped errors (`CSError`) on invalid operations.

### 3.5 Middleware (`src/api/middlewares/**.ts`)

- Before middleware.
- If missing and environment is production, throw unauthorized (`CODES.NotAuthorized` or add mapping if missing).
- Allow pass-through in development only when key not configured.

### 3.6 Controller (`src/api/controllers/**.ts`)

Base route: `/v1/{{controller_name}}` (respects global `routePrefix`).

Use: `@UseBefore(bodyParser..., URCHeaderMiddleware, APIKeyMiddleware)`.

Endpoints:

- `POST /` → create session `{ title? }`.
- `PATCH /:id` → rename session `{ title }`.
- `PATCH /:id/favorite` → toggle favorite `{ isFavorite: boolean }`.
- `DELETE /:id` → delete session and messages.
- `POST /:id/messages` → add message `{ sender, content, context? }`.
- `GET /:id/messages?limit&skip` → list messages (paginated, newest first).
- (Bonus) `GET /health` → `{ status: 'ok', uptime, version }`.

Return raw Mongoose objects; global error middleware handles formatting.

### 3.7 Response Pattern (`src/api/responses/`)

Use `StandardResponse` static class for all API responses:

- Success responses: `StandardResponse.success(res, data, message, status, headers)`
- Created responses: `StandardResponse.created(res, data, message, headers)`
- Error responses: `StandardResponse.error(res, error, headers)` (CSError integration)
- Validation errors: `StandardResponse.validationError(res, errors, headers)`
- Not found: `StandardResponse.notFound(res, message, headers)`
- Unauthorized: `StandardResponse.unauthorized(res, message, headers)`
- Forbidden: `StandardResponse.forbidden(res, message, headers)`
- Internal errors: `StandardResponse.internalError(res, message, headers)`

Controllers should use static methods directly (no instantiation required).

### 3.8 RabbitMQ Integration (`src/loaders/RabbitMQLoader.ts`)

RabbitMQ service patterns:

- Queue processors: `rabbitMQService.registerQueueProcessor({ queue, routingKey, processor })`
- Topic processors: `rabbitMQService.registerTopicProcessor({ pattern, processor })`
- Publishing: `rabbitMQService.publish(payload, options)` with encryption support
- Message context includes: `messageId`, `routingKey`, `exchange`, `queue`, `timestamp`
- All processors accept `(event: IEventPayload, context: IMessageContext, headers: IRequestHeaders)`
- Use `IPublishPayload` for publishing, service enhances to `IEventPayload`

### 3.9 Express Loader Augmentation (`src/loaders/expressLoader.ts`)

Add (after server creation):

- CORS via `cors({ origin: env.app.corsOrigin || true })`.
- Rate limiting via `express-rate-limit` using `env.app.rateWindowMs`, `env.app.rateMax`.

Do NOT remove existing config or change `routePrefix`.

### 3.10 Error Codes (Only If Needed)

If adding new domain codes (e.g., `SESSION_NOT_FOUND`), update:

- `errorCodes.ts`
- `errorCodeConstants.ts`
- Add unit tests similar to existing error tests.

Do not add unless the code is actually used.

### 3.11 Tests (`test/unit/src/`)

Add:

- `services/**.ts` → happy path + failure for rename/delete non-existent session.
- `controllers/**.ts` → full route tests (mock service via DI container or jest spy).

### 3.12 README Updates

Add a section:

- "Service APIs" (list endpoints, request/response examples, headers required).
- Document rate limiting & API key usage.
- Add environment variable table.
- Update any existing sections as needed.

---

## 4. Coding Patterns (MUST REPLICATE)

- Logger usage: `private log = new Logger(__filename);` then `this.log.info(logMessage);`
- Log message seed: `constructLogMessage(__filename, '<functionName>', headers)`.
- Logger should be used in every branch of all functions.
- Encryption: ONLY for PII and sensitive data.
- Error throwing: `throw new CSError(HTTPCODES.BAD_REQUEST, CODES.SomeCode)`.
- Response formatting: Use `StandardResponse` static methods directly (no instantiation).
- Controller responses: Return `StandardResponse.success(res, data, message, status, headers)` format.
- Do not create new top-level directories unless asked for.
- Services use `@Service()` and are injected into controllers via constructor.

---

## 5. Sequence for Pull Request (Agent Execution Order)

1. Add env variables + `.env.example` + `env.ts` updates.
2. Add interfaces + models (session, message).
3. Add services (use StandardResponse patterns).
4. Add API key middleware.
5. Add controllers (use StandardResponse static methods).
6. Add RabbitMQ processors if needed (queue/topic processors).
7. Patch `expressLoader` (rate limit + CORS).
8. Add tests (including StandardResponse and RabbitMQ if used).
9. Update README.
10. Run lint/build/tests → ensure green.
11. Final PR description references this guide.

---

## 6. Non-Hallucination Guardrails

- Never introduce authentication, JWT, OAuth, or user schema unless asked for.
- Do not invent queue events or consumers for the application unless asked for.
- Do not add abstractions like repositories unless explicitly asked.
- Only add error codes if used in code.
- Keep naming strictly as defined here.
- If a required constant is absent and undefined in repo, STOP and request clarification instead of guessing.

If ambiguous: respond with `I need clarification: <issue>`.

---

## 7. Sample Snippets (Reference Only – Do Not Paste Verbatim Without Adjusting Imports)

Service method skeleton:

```ts
public async exampleFunction(title: string, headers: IRequestHeaders) {
  const logMessage = constructLogMessage(__filename, 'exampleFunction', headers);
  this.log.info(logMessage);
  return ExampleController.create({ title });
}
```

Controller handler pattern:

```ts
@Post('/:id/messages')
@HttpCode(StatusCodes.CREATED)
public async exampleMethod(
  @Param('id') id: string,
  @Body() body: any,
  @HeaderParam('Unique-Reference-Code') urc: string
) {
  const result = this.exampleService.exampleMethod(id, body.sender, body.content, body.context, { urc } as any);
  return StandardResponse.created(res, result, 'Message created successfully', { urc } as any);
}
```

StandardResponse usage patterns:

```ts
// Success response
return StandardResponse.success(res, data, 'Operation successful', HTTP_STATUS_CODES.SUCCESS, headers);

// Error response (CSError will be handled automatically)
throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.SessionNotFound);

// Created response
return StandardResponse.created(res, newResource, 'Resource created', headers);
```

RabbitMQ usage patterns:

```ts
// Register queue processor
rabbitMQService.registerQueueProcessor({
  queue: 'notification.queue',
  routingKey: 'notification.send',
  processor: async (event: IEventPayload, context: IMessageContext, headers: IRequestHeaders) => {
    // Process message
  }
});

// Publish message
await rabbitMQService.publish(
  {
    type: 'notification',
    event: 'send',
    payload: { userId: '123', message: 'Hello' }
  },
  { routingKey: 'notification.send', encrypt: true }
);
```

Rate limiting patch example (augment existing loader, do not rewrite):

```ts
import rateLimit from 'express-rate-limit';
import cors from 'cors';
// after createExpressServer(...)
app.use(cors({ origin: env.app.corsOrigin || true }));
app.use(rateLimit({ windowMs: Number(env.app.rateWindowMs) || 60000, max: Number(env.app.rateMax) || 60 }));
```

---

## 8. Validation Checklist (Agent Self-Review Before Commit)

- [ ] Added env vars & documented.
- [ ] Models imported nowhere unintended (no circular deps).
- [ ] All new files match glob patterns in `env.app.dirs`.
- [ ] Tests for new logic pass along with existing suite.
- [ ] No unhandled promise rejections in service methods.
- [ ] Error paths produce `ErrorResponse` output shape.
- [ ] Pagination parameters sanitized (numeric fallback defaults).
- [ ] No unused dependencies added.

---

## 9. helpers.ts Usage

- Always use `constructLogMessage` for log seeds.
- Always use `isEmptyOrNull` for all variables checks, if checking for empty or null values.
- Always use `isEmptyOrNull` for all methods branches if checking for empty or null values.

---

## 10. Future (Deferred)

- Soft delete / archival.
- Swagger generation.

---

## 11. Escalation Rule

If any requirement conflicts with existing architecture (e.g., incompatible middleware order), pause and request human decision—do not refactor core boot sequence autonomously.

---

# Repository Guidelines

## Project Structure & Module Organization

The service boots from `src/app.ts`, with HTTP contracts under `src/api` (controllers, services, models, middlewares) and shared utilities inside `src/lib` and `src/loaders`. Staging outputs land in `dist/`, so keep that directory out of commits. Unit specs mirror source folders under `test/unit/src`, while reusable fixtures and Mongo helpers live in `test/utils`. Operational scripts that generate configs or banners are in `commands/`, and high-level design notes sit in `docs/`.

## Build, Test, and Development Commands

Run `npm start serve` for a nodemon-backed loop; append `:inspector` when you need the debugger. `npm run build` executes the NPS pipeline (config, clean, transpile, copy) to populate `dist`. Execute `npm test` for the Jest suite with coverage, or `npm run test:full` to wrap tests with MongoDB setup/cleanup. Code quality checks are `npm run lint` (TSLint), `npm run lintfix` (ESLint autofix), and `npm run prettier:fix`.

## Coding Style & Naming Conventions

TypeScript is compiled with strict settings, and `tslint.json` enforces two-space indentation, single quotes, mandatory semicolons, and max 120-character lines. Classes, decorators, and DTOs stay `PascalCase`; exported functions and variables use `camelCase`; environment constants are `UPPER_SNAKE_CASE`. Prefer dependency injection through TypeDI and annotate payloads with `class-validator` decorators. Run the lint and prettier commands before committing to keep generated JavaScript predictable.

## Testing Guidelines

Place Jest specs alongside their subjects (`src/lib/foo.ts` → `test/unit/src/lib/foo.test.ts`). Mock transports with assets in `test/unit/__mocks__` and initialise Mongo through `test/utils/mongodb-setup`. Maintain coverage above current thresholds—`coverage/lcov-report/index.html` surfaces gaps. For broader flows, call `npm run test:e2e:setup`, run the targeted Jest command, then `npm run test:e2e:cleanup`.

## Commit & Pull Request Guidelines

This archive lacks Git metadata, so adopt Conventional Commit syntax (`feat: add queue publisher`, `fix(api): guard null token`) and keep change sets focused. Each PR should link a tracking issue, summarise risk, list the commands you ran (lint, build, tests), and attach API or log snippets when they clarify behaviour. Include updated fixtures whenever behaviour or contracts change.

## Security & Configuration Tips

Environment variables load from `.env` (or `.env.test` for Jest); never commit secrets. Rate limiting, RabbitMQ, and OpenAI settings default from `src/env.ts`, so document new keys in `docs/` and provide sample values in shared secret managers. Sanity-check defaults before enabling RabbitMQ or external APIs in higher environments.

### End of authoritative guide.
