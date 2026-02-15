# ElevenLabs Configuration Update

## Changes Made

### Environment Variables

Updated ElevenLabs configuration to use simplified parameters:

```bash
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_v3
ELEVENLABS_STABILITY=0.5        # Must be exactly 0.0, 0.5, or 1.0
ELEVENLABS_SPEED=1.0            # Range: 0.5 to 2.0
```

**Important**: ElevenLabs TTD stability **must** be one of:

- `0.0` = Creative
- `0.5` = Natural (recommended)
- `1.0` = Robust

### Backend Changes

#### 1. `src/env.ts`

- Updated default stability from `0.65` to `0.5`
- Added `speed` parameter (default: `1.0`)
- Removed `similarityBoost`, `style`, and `useSpeakerBoost` (no longer configurable via env)

#### 2. `src/api/services/SpeechService.ts`

- Added `snapToAllowedStability()` helper to enforce allowed stability values
- Removed `similarityBoost` and `style` parameters
- Added `speed` parameter with validation (0.5 - 2.0 range)
- Updated cache key generation to use new parameters
- Voice speed now sent as `voice_speed` in ElevenLabs API request

#### 3. `src/api/controllers/SpeechController.ts`

- Updated request schema to include `speed` parameter
- Removed `similarityBoost` and `style` from request body

### Mobile App Changes

#### 1. `mobile/src/services/textToSpeechService.ts`

- Fixed Expo audio mode configuration (proper enum imports)
- Switched to `expo-file-system/legacy` for base64 file writing
- Added safety check for cache directory availability

### Files Updated

- `.env` - Updated stability value to `0.5`
- `.env.example` - Updated default stability to `0.5`
- `src/env.ts` - New ElevenLabs config structure
- `src/api/services/SpeechService.ts` - Stability snapping, speed support
- `src/api/controllers/SpeechController.ts` - Updated API contract
- `mobile/src/services/textToSpeechService.ts` - Fixed Expo integration

## Testing

Backend server is now running successfully with the corrected configuration. The stability value is automatically snapped to the nearest allowed value (0.0, 0.5, or 1.0) to prevent API errors.

## Migration Notes

If you have custom stability values in your configuration:

- Values < 0.25 will round to `0.0` (Creative)
- Values 0.25-0.74 will round to `0.5` (Natural)
- Values ≥ 0.75 will round to `1.0` (Robust)

The `speed` parameter can be used to control speech rate (0.5x to 2.0x normal speed).
