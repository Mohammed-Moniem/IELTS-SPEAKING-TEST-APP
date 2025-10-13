# 🚀 Development Automation Scripts

This directory contains scripts to automatically start and manage the IELTS Speaking Test App development environment with ngrok tunneling.

## 📋 Overview

The scripts handle:

- ✅ Starting backend server (Node.js/TypeScript)
- ✅ Creating ngrok tunnel for backend
- ✅ Auto-updating all config files with new ngrok URL
- ✅ Starting Expo dev server with tunnel mode
- ✅ Cleaning up processes on exit

## 🎯 Quick Start

### Easiest Way (Interactive Menu)

```bash
./quick-start.sh
```

Then choose your preferred mode!

### Two Terminals Method (Recommended)

**Terminal 1: Backend + Ngrok**

```bash
./start-dev-multi-terminal.sh
```

- This will open **2 separate terminal windows automatically**
- Terminal 1 shows backend + ngrok logs
- Terminal 2 shows Expo dev server + QR code

**What to expect:**

1. Terminal 1 appears first (~10 seconds)
   - Shows backend starting
   - Shows ngrok URL (save this!)
   - Updates config files automatically
2. Terminal 2 appears next (~20 seconds)
   - Shows Expo starting
   - Shows QR code to scan
   - Ready to test on your phone!

### Single Terminal Method (All-in-One)

```bash
./start-dev.sh
```

- Everything runs in one terminal
- Good for quick testing
- All logs mixed together

## 📱 Testing on Your Phone

1. Install **Expo Go** app from App Store/Play Store
2. Wait for the QR code to appear in Terminal 2
3. Open Expo Go app
4. Tap "Scan QR Code"
5. Point camera at the QR code
6. App will load and connect to backend via ngrok

## 🔧 Scripts Reference

### `quick-start.sh` (Recommended)

Interactive menu with options:

1. Single Terminal Mode
2. Multi-Terminal Mode ⭐ **Best for monitoring**
3. View Current Ngrok URL
4. Stop All Servers
5. Exit

### `start-dev-multi-terminal.sh`

- Opens 2 terminal windows automatically
- Better for monitoring logs separately
- Backend + Ngrok in Terminal 1
- Expo in Terminal 2
- Creates `CURRENT-NGROK-URL.txt` with session info

### `start-dev.sh`

- All-in-one terminal
- Good for quick starts
- All logs in one place
- Easier for beginners

## 🛠 Manual Start (If Scripts Fail)

### Terminal 1: Backend + Ngrok

```bash
cd "micro-service-boilerplate-main 2"
npm start serve &
ngrok http 4000
```

### Terminal 2: Get Ngrok URL & Update Configs

```bash
# Get URL
curl http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app'

# Then manually update these files with the URL:
# - mobile/src/config.ts
# - mobile/src/api/client.ts
# - mobile/src/api/speechApi.ts
# - mobile/src/api/topicApi.ts
# - mobile/app.json
```

### Terminal 3: Expo

```bash
cd mobile
NODE_OPTIONS="--require ./scripts/availableParallelismPolyfill.js" npx expo start --tunnel
```

## ⚠️ Important Notes

### Ngrok Free Tier Limitations

- **URL changes on every restart**
- Scripts automatically update configs each time
- Don't hardcode the URL anywhere
- Free tier has bandwidth limits
- Consider ngrok paid plan for stable URLs

### Port Conflicts

If you get "port already in use" errors:

```bash
# Kill existing processes
pkill -f "ts-node.*src/app.ts"
pkill -f ngrok
pkill -f "expo start"

# Or use the quick-start menu option 4
```

### Firewall Issues

If backend won't start:

```bash
# Check if port 4000 is blocked
lsof -i :4000

# macOS: Allow Node.js through firewall
# System Preferences > Security & Privacy > Firewall > Firewall Options
# Add Node.js to allowed apps
```

## 📊 Monitoring

### Check Backend Status

```bash
curl https://YOUR-NGROK-URL/health
# Should return: {"status":"ok"}
```

### View Live Logs

```bash
# Backend logs
tail -f /tmp/backend.log

# Ngrok logs
tail -f /tmp/ngrok.log
```

### Ngrok Dashboard

Open browser: http://localhost:4040

- See all HTTP requests
- Inspect headers/bodies
- Replay requests

## 🐛 Troubleshooting

### "Backend failed to start"

1. Check if port 4000 is already in use: `lsof -i :4000`
2. Kill the process: `kill -9 <PID>`
3. Check backend logs: `tail -20 /tmp/backend.log`
4. Try manual start to see errors

### "Failed to get ngrok URL"

1. Check if ngrok is running: `ps aux | grep ngrok`
2. Visit http://localhost:4040 in browser
3. Check ngrok logs: `tail -20 /tmp/ngrok.log`
4. Verify ngrok is installed: `which ngrok`

### "Expo won't start"

1. Check Node version: `node --version` (should be 16+)
2. Clear Expo cache: `cd mobile && npx expo start -c`
3. Reinstall dependencies: `cd mobile && rm -rf node_modules && npm install`
4. Check if polyfill exists: `ls -la mobile/scripts/availableParallelismPolyfill.js`

### "Can't scan QR code"

1. Make sure your phone and Mac are on same WiFi
2. Try the tunnel URL shown in Terminal 2 (exp://...)
3. In Expo Go app, manually enter the URL
4. Check if Expo tunnel is working: look for "Tunnel ready" message

### "App loads but can't connect to API"

1. Check ngrok URL in `CURRENT-NGROK-URL.txt`
2. Verify config files were updated:
   ```bash
   grep -r "ngrok" mobile/src/config.ts
   ```
3. Test backend: `curl https://YOUR-NGROK-URL/health`
4. Restart Expo: Press `r` in Terminal 2

## 💡 Pro Tips

1. **Keep Terminal 1 visible** to see the ngrok URL
2. **Bookmark ngrok dashboard** (localhost:4040) for debugging
3. **Use multi-terminal mode** for better log visibility
4. **Check CURRENT-NGROK-URL.txt** to see current session info
5. **Restart both servers together** to keep URLs in sync
6. **Test backend health** before testing app
7. **Clear Expo cache** if app behaves strangely: `expo start -c`

## 🎓 Understanding the Flow

```
┌─────────────────────────────────────────────────────┐
│  1. Start Backend (localhost:4000)                  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  2. Start Ngrok Tunnel                              │
│     (exposes localhost:4000 to internet)            │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  3. Get Ngrok URL from API                          │
│     (curl localhost:4040/api/tunnels)               │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  4. Update All Config Files                         │
│     - config.ts                                     │
│     - client.ts                                     │
│     - speechApi.ts                                  │
│     - topicApi.ts                                   │
│     - app.json                                      │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  5. Start Expo with Tunnel                          │
│     (creates QR code)                               │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  6. Scan QR Code → App Loads → Connects to Backend │
└─────────────────────────────────────────────────────┘
```

## 📞 Support

If scripts don't work:

1. Check this README's troubleshooting section
2. Try manual start method
3. Check logs in `/tmp/backend.log` and `/tmp/ngrok.log`
4. Verify all dependencies are installed:
   - Node.js 16+
   - npm
   - ngrok (`brew install ngrok`)
   - @expo/ngrok in mobile project

## 🔄 Updating Scripts

All scripts are in the project root:

- `quick-start.sh` - Interactive menu
- `start-dev-multi-terminal.sh` - Multi-terminal automation
- `start-dev.sh` - Single-terminal automation

After editing, make executable:

```bash
chmod +x *.sh
```

## 🎉 Ready to Go!

Everything is set up! Just run:

```bash
./quick-start.sh
```

And choose option 2 (Multi-Terminal Mode) for the best experience! 🚀
