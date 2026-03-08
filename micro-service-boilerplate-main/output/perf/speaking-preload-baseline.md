# Speaking Preload Baseline

This note tracks how to measure preloaded speaking-session startup and follow-up behavior after the package-first migration.

## What To Measure

- Cold package build time for `POST /api/v1/test-simulations`
- Warm package build time for repeated starts with the same examiner profile
- Base asset hit/miss counts from the returned `telemetry`
- Follow-up cache hit/miss counts from the runtime response after a Part 1 or Part 3 answer
- Whether ElevenLabs is disabled on the hot path via `SPEAKING_DISABLE_ELEVENLABS_HOT_PATH=true`

## Backend Contract Checks

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/codex-speaking-preloaded-session/micro-service-boilerplate-main
npx jest --no-cache --runInBand test/unit/src/api/services/TestSimulationRuntimeService.test.ts --config=./jest.config.json
```

Expected telemetry fields:

- `packageBuildDurationMs`
- `baseAudioAssetHits`
- `baseAudioAssetMisses`
- `followUpCacheHits`
- `followUpCacheMisses`
- `examinerProfileId`

## Manual API Timing

1. Start the backend locally.
2. Authenticate as a learner.
3. Measure a cold start:

```bash
curl -s -o /tmp/speaking-start.json \
  -w "status=%{http_code} total=%{time_total}\\n" \
  -X POST http://127.0.0.1:4000/api/v1/test-simulations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

4. Inspect the returned telemetry:

```bash
jq '.data.telemetry' /tmp/speaking-start.json
```

5. Repeat the same request for a warm run and compare:

- `time_total`
- `packageBuildDurationMs`
- `baseAudioAssetHits`
- `baseAudioAssetMisses`

## Web Verification

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/codex-speaking-preloaded-session/web-saas
npx playwright test tests/e2e/speaking-flow.spec.ts --project=chromium
```

Focus on:

- preloaded package startup
- examiner audio handoff
- candidate recording transitions
- Part 1 / Part 3 auto-submit after silence

## Mobile Verification

Run:

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/.claude/worktrees/codex-speaking-preloaded-session/mobile
npm test -- --runInBand src/components/AuthenticFullTestV2.test.tsx
```

Focus on:

- session package hydration
- package audio preloading
- package audio playback before TTS fallback

## Migration Guardrail

Set this env var to keep ElevenLabs out of the runtime hot path while validating the preloaded architecture:

```bash
SPEAKING_DISABLE_ELEVENLABS_HOT_PATH=true
```

Expected effect:

- fixed/package audio uses prebuilt assets
- uncached dynamic follow-ups use OpenAI TTS instead of ElevenLabs
