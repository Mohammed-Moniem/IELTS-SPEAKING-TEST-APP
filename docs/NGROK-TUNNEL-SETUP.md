# Ngrok Tunnel Setup

## Current Configuration

### Backend API Tunnel

- **Local URL**: `http://localhost:4000`
- **Public URL**: `https://f1e97fc29e5e.ngrok-free.app`
- **API Base**: `https://f1e97fc29e5e.ngrok-free.app/api/v1`

### Expo Dev Server Tunnel

- **Local URL**: `http://localhost:8081`
- **Public URL**: `exp://9mrgxw0-anonymous-8081.exp.direct`

## How to Start Development

### 1. Start Backend with Ngrok Tunnel

```bash
# Terminal 1: Start backend server
cd "/Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/micro-service-boilerplate-main 2"
npm start serve

# Terminal 2: Start ngrok tunnel for backend
ngrok http 4000
```

**Note**: When ngrok starts, it will show a new URL. If the URL changes, you need to update these files:

- `mobile/src/config.ts`
- `mobile/src/api/client.ts`
- `mobile/src/api/speechApi.ts`
- `mobile/src/api/topicApi.ts`
- `mobile/app.json`

### 2. Start Expo with Tunnel

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile
NODE_OPTIONS="--require ./scripts/availableParallelismPolyfill.js" npx expo start --tunnel
```

### 3. Connect from Mobile Device

1. Open **Expo Go** app on your phone
2. Scan the QR code shown in the terminal
3. The app will connect through the tunnel (works from anywhere!)

## Testing the Backend

```bash
# Test health endpoint
curl -H "x-api-key: local-dev-api-key" https://f1e97fc29e5e.ngrok-free.app/api/v1/health

# Test topics endpoint
curl -H "x-api-key: local-dev-api-key" https://f1e97fc29e5e.ngrok-free.app/api/v1/topics/practice
```

## Benefits of Ngrok Tunnels

✅ Works from anywhere (no WiFi network required)
✅ Bypasses firewall issues
✅ No need to configure Mac firewall
✅ Can test on real devices without being on the same network
✅ Can share with others for testing

## Troubleshooting

### If the ngrok URL changes:

Run this script to update all configuration files:

```bash
# Replace NEW_URL with your new ngrok URL
NEW_URL="https://your-new-url.ngrok-free.app"

cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile

# Update all config files
sed -i '' "s|https://f1e97fc29e5e.ngrok-free.app|$NEW_URL|g" src/config.ts
sed -i '' "s|https://f1e97fc29e5e.ngrok-free.app|$NEW_URL|g" src/api/client.ts
sed -i '' "s|https://f1e97fc29e5e.ngrok-free.app|$NEW_URL|g" src/api/speechApi.ts
sed -i '' "s|https://f1e97fc29e5e.ngrok-free.app|$NEW_URL|g" src/api/topicApi.ts
sed -i '' "s|https://f1e97fc29e5e.ngrok-free.app|$NEW_URL|g" app.json
```

### If you get "Network Error":

1. Check if backend is running: `lsof -i :4000`
2. Check if ngrok is running: `curl http://localhost:4040/api/tunnels`
3. Test the ngrok URL directly in browser
4. Make sure to reload the Expo app (press 'r' in terminal)

## Notes

- Free ngrok URLs change every time you restart ngrok
- Consider getting a free ngrok account for a persistent subdomain
- The Expo tunnel URL (`9mrgxw0-anonymous`) is stable across restarts
