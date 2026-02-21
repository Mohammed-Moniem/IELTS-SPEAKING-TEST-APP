# Environment Variables Guide

## Overview

The app now uses environment variables for configuration, making it easier to switch between development, staging, and production environments.

## Configuration Files

### 1. `.env` (Dynamic - Auto-Generated)

Located at: `mobile/.env`

This file is **automatically generated** by the startup scripts:

- `start-backend-and-mobile-local.sh` → Uses your local IP address
- `start-backend-and-mobile.sh` → Uses ngrok tunnel URL
- `start-backend-localtunnel.sh` → Uses LocalTunnel permanent subdomain

**You don't need to manually edit this file** - the scripts will update it automatically.

### 2. `.env.example` (Template)

Located at: `mobile/.env.example`

This is a template file showing all available environment variables. Copy this to create your own custom `.env` if needed.

### 3. `app.config.js` (Configuration Logic)

Located at: `mobile/app.config.js`

This file reads from `.env` and provides fallback values:

```javascript
extra: {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:4000",
  apiKey: process.env.EXPO_PUBLIC_API_KEY || "local-dev-api-key",
}
```

## Environment Variables

### Required Variables

| Variable                 | Description                | Example                            |
| ------------------------ | -------------------------- | ---------------------------------- |
| `EXPO_PUBLIC_API_URL`    | Backend API endpoint       | `http://192.168.1.100:4000/api/v1` |
| `EXPO_PUBLIC_SOCKET_URL` | WebSocket endpoint         | `http://192.168.1.100:4000`        |
| `EXPO_PUBLIC_API_KEY`    | Backend authentication key | `local-dev-api-key`                |

## How It Works

### Development Workflow

1. **Run a startup script** (any of the three)
2. **Script auto-generates `.env`** with correct URLs
3. **`app.config.js` reads `.env`**
4. **Expo uses the configuration** from `app.config.js`
5. **App connects to backend** using environment variables

### URL Priority (fallback chain)

```
1. process.env.EXPO_PUBLIC_API_URL (from .env)
   ↓ (if not found)
2. Constants.expoConfig.extra.apiUrl (from app.config.js)
   ↓ (if not found)
3. "http://localhost:4000/api/v1" (hardcoded default)
```

This is implemented in `mobile/src/api/client.ts`:

```typescript
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  defaultApiUrl;
```

## Startup Scripts

### Local IP (Same WiFi)

```bash
./start-backend-and-mobile-local.sh
```

- Uses your computer's local IP (e.g., `192.168.1.100`)
- Mobile device must be on same WiFi network
- Fastest option, no internet required

### Ngrok Tunnel

```bash
./start-backend-and-mobile.sh
```

- Creates temporary ngrok tunnel (e.g., `https://abc123.ngrok-free.app`)
- Works anywhere with internet
- URL changes on each restart
- Free tier has limitations

### LocalTunnel (Permanent)

```bash
./start-backend-localtunnel.sh
```

- Uses permanent subdomain (e.g., `https://ielts-speaking-dev-username.loca.lt`)
- URL stays the same on restart
- Works anywhere with internet
- Free and unlimited

## Manual Configuration

If you need to manually set environment variables:

1. Copy the example file:

   ```bash
   cd mobile
   cp .env.example .env
   ```

2. Edit `.env` with your values:

   ```bash
   EXPO_PUBLIC_API_URL=https://your-production-server.com/api/v1
   EXPO_PUBLIC_SOCKET_URL=https://your-production-server.com
   EXPO_PUBLIC_API_KEY=your-production-api-key
   ```

3. Restart Expo:
   ```bash
   npx expo start --clear
   ```

## Production Setup

When deploying to production:

1. **Set environment variables** in your hosting platform (Vercel, Netlify, etc.)
2. **Update `.env.example`** with production variable names
3. **DO NOT commit `.env`** to version control (already in `.gitignore`)
4. **Remove tunnel scripts** (ngrok/LocalTunnel won't be needed)

Example production `.env`:

```bash
EXPO_PUBLIC_API_URL=https://api.ielts-speaking-app.com/api/v1
EXPO_PUBLIC_SOCKET_URL=https://api.ielts-speaking-app.com
EXPO_PUBLIC_API_KEY=prod-secure-key-from-backend-team
```

## Troubleshooting

### App can't connect to backend

1. Check `.env` file exists:

   ```bash
   cat mobile/.env
   ```

2. Verify URLs are correct:

   - Local IP: Make sure IP matches your computer's WiFi IP
   - Ngrok: Check if tunnel is still active
   - LocalTunnel: Verify subdomain is accessible

3. Restart Expo with cleared cache:
   ```bash
   cd mobile
   npx expo start --clear
   ```

### Environment variables not updating

If you manually edit `.env`, you must restart Expo:

```bash
# Stop Expo (Ctrl+C)
npx expo start --clear
```

### Wrong URL after running script

Scripts overwrite `.env` completely. If you need custom values:

1. Run the script first
2. Stop the script
3. Edit `.env` manually
4. Restart Expo

## Security Notes

- ✅ `.env` is in `.gitignore` - won't be committed
- ✅ `EXPO_PUBLIC_*` prefix means values are embedded in the app bundle
- ⚠️ Don't put sensitive secrets in `EXPO_PUBLIC_*` variables
- ⚠️ Anyone can decompile the app and read these values
- ✅ Backend should validate the `API_KEY` for real security

## Migration from app.json

Previously, URLs were hardcoded in `mobile/app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://hardcoded-ngrok-url.ngrok-free.app/api/v1",
      "socketUrl": "https://hardcoded-ngrok-url.ngrok-free.app"
    }
  }
}
```

Now they're in `.env` and loaded dynamically via `app.config.js`. This allows:

- ✅ Scripts to easily update URLs
- ✅ Different developers to use different local IPs
- ✅ Easy switching between dev/staging/prod
- ✅ No need to edit JSON files manually
