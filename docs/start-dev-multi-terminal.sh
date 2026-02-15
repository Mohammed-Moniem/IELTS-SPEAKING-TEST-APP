#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting IELTS Speaking Test App (Multi-Terminal)${NC}\n"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/micro-service-boilerplate-main 2"
MOBILE_DIR="$SCRIPT_DIR/mobile"

# Kill any existing processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f "ts-node.*src/app.ts" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
pkill -f "expo start" 2>/dev/null
sleep 2

# Create helper script for backend + ngrok
cat > /tmp/start-backend-ngrok.sh << 'BACKEND_SCRIPT'
#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$1"
BACKEND_DIR="$SCRIPT_DIR/micro-service-boilerplate-main 2"
MOBILE_DIR="$SCRIPT_DIR/mobile"

echo -e "${GREEN}🔧 Terminal 1: Backend + Ngrok${NC}\n"

# Start Backend
echo -e "${BLUE}Starting backend server...${NC}"
cd "$BACKEND_DIR"
npm start serve > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

sleep 8

if ! lsof -i :4000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to start backend${NC}"
    tail -20 /tmp/backend.log
    exit 1
fi

echo -e "${GREEN}✅ Backend running on http://localhost:4000${NC}\n"

# Start Ngrok
echo -e "${BLUE}Starting ngrok tunnel...${NC}"
ngrok http 4000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

sleep 5

# Get ngrok URL
NGROK_URL=""
for i in {1..10}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[a-zA-Z0-9\-]*\.ngrok-free\.app' | head -1)
    if [ ! -z "$NGROK_URL" ]; then
        break
    fi
    sleep 2
done

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}❌ Failed to get ngrok URL${NC}"
    tail -20 /tmp/ngrok.log
    exit 1
fi

echo -e "${GREEN}✅ Ngrok tunnel: ${NGROK_URL}${NC}\n"

API_URL="${NGROK_URL}/api/v1"

# Update config files
echo -e "${BLUE}Updating configuration files...${NC}"

# Update mobile/src/config.ts
cat > "$MOBILE_DIR/src/config.ts" << EOF
// API Configuration
// Using ngrok tunnel for development to work from anywhere
// ⚠️ This URL is auto-generated on each restart by start-dev-multi-terminal.sh
export const API_BASE_URL = __DEV__
  ? "${API_URL}"
  : "https://api.ielts-practice.com";

export const SOCKET_URL = API_BASE_URL;

// App Configuration
export const APP_CONFIG = {
  MAX_FRIEND_REQUESTS_PER_DAY: 20,
  MAX_FRIENDS: 500,
  MAX_GROUP_MEMBERS: 15,
  MAX_GROUPS_PER_USER: 10,
  MAX_REFERRALS_PER_DAY: 5,
  MAX_MESSAGE_LENGTH: 2000,
  MESSAGE_LOAD_LIMIT: 50,
  LEADERBOARD_PAGE_SIZE: 100,
  XP_PER_LEVEL: 100,
};

export const FEATURES = {
  SOCIAL: true,
  CHAT: true,
  STUDY_GROUPS: true,
  REFERRALS: true,
  LEADERBOARD: true,
  ACHIEVEMENTS: true,
  QR_CODE_SHARING: true,
};
EOF

sed -i '' "s|const defaultApiUrl = \".*\";|const defaultApiUrl = \"${API_URL}\";|" "$MOBILE_DIR/src/api/client.ts" 2>/dev/null
sed -i '' "s|Constants.expoConfig?.extra?.apiUrl || \".*\";|Constants.expoConfig?.extra?.apiUrl || \"${API_URL}\";|" "$MOBILE_DIR/src/api/speechApi.ts" 2>/dev/null
sed -i '' "s|Constants.expoConfig?.extra?.apiUrl || \".*\";|Constants.expoConfig?.extra?.apiUrl || \"${API_URL}\";|" "$MOBILE_DIR/src/api/topicApi.ts" 2>/dev/null
sed -i '' "s|\"apiUrl\": \".*\"|\"apiUrl\": \"${API_URL}\"|" "$MOBILE_DIR/app.json" 2>/dev/null

echo -e "${GREEN}✅ Configuration updated${NC}\n"

# Save to file
cat > "$SCRIPT_DIR/CURRENT-NGROK-URL.txt" << URLEOF
===========================================
BACKEND + NGROK TUNNEL INFO
===========================================
Backend: ${NGROK_URL}
API: ${API_URL}
Dashboard: http://localhost:4040
Updated: $(date)
===========================================
URLEOF

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Backend + Ngrok Running Successfully! ✅       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}\n"
echo -e "${BLUE}📡 API URL:${NC} ${API_URL}"
echo -e "${BLUE}🌐 Ngrok Dashboard:${NC} http://localhost:4040"
echo -e "${BLUE}📝 Backend Logs:${NC} tail -f /tmp/backend.log"
echo -e "${BLUE}📝 Ngrok Logs:${NC} tail -f /tmp/ngrok.log\n"
echo -e "${YELLOW}✨ Config files updated! Terminal 2 will start Expo now.${NC}\n"
echo -e "${RED}⚠️  Keep this terminal open! Press Ctrl+C to stop.${NC}\n"

# Keep running
wait
BACKEND_SCRIPT

chmod +x /tmp/start-backend-ngrok.sh

# Create helper script for Expo
cat > /tmp/start-expo.sh << 'EXPO_SCRIPT'
#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$1"
MOBILE_DIR="$SCRIPT_DIR/mobile"

echo -e "${GREEN}📱 Terminal 2: Expo Dev Server${NC}\n"

# Wait for ngrok URL to be ready
echo -e "${YELLOW}⏳ Waiting for ngrok URL to be configured...${NC}"
for i in {1..30}; do
    if [ -f "$SCRIPT_DIR/CURRENT-NGROK-URL.txt" ]; then
        echo -e "${GREEN}✅ Configuration ready!${NC}\n"
        cat "$SCRIPT_DIR/CURRENT-NGROK-URL.txt"
        echo -e "\n"
        break
    fi
    sleep 2
    echo -e "${YELLOW}   Still waiting... ($i/30)${NC}"
done

cd "$MOBILE_DIR"

echo -e "${BLUE}Starting Expo with tunnel...${NC}"
echo -e "${YELLOW}📱 Scan the QR code below with Expo Go app${NC}\n"

NODE_OPTIONS="--require ./scripts/availableParallelismPolyfill.js" npx expo start --tunnel

EXPO_SCRIPT

chmod +x /tmp/start-expo.sh

# Open terminals based on OS
echo -e "${GREEN}Opening terminal windows...${NC}\n"

# Terminal 1: Backend + Ngrok
osascript <<EOF
tell application "Terminal"
    do script "bash /tmp/start-backend-ngrok.sh '$SCRIPT_DIR'"
    activate
end tell
EOF

sleep 3

# Terminal 2: Expo
osascript <<EOF
tell application "Terminal"
    do script "bash /tmp/start-expo.sh '$SCRIPT_DIR'"
end tell
EOF

echo -e "\n${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 TERMINALS OPENED!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Two terminal windows have been opened:${NC}"
echo -e "  ${GREEN}1️⃣  Backend + Ngrok${NC} (will show API URL)"
echo -e "  ${GREEN}2️⃣  Expo Dev Server${NC} (will show QR code)\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Wait for Terminal 1 to show the ngrok URL (~10 sec)"
echo -e "  2. Wait for Terminal 2 to show the QR code (~20 sec)"
echo -e "  3. Scan the QR code with Expo Go app on your phone\n"

echo -e "${BLUE}📋 Current session info saved to:${NC}"
echo -e "   CURRENT-NGROK-URL.txt\n"

echo -e "${RED}⚠️  Remember:${NC} Keep both terminals open while testing!"
echo -e "${RED}⚠️  Ngrok URL changes with each restart!${NC}\n"

echo -e "${GREEN}✅ You can close this terminal now.${NC}\n"
