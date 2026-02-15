#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting IELTS Speaking Test App with Ngrok Tunnels${NC}"
echo -e "${YELLOW}⚠️  Note: Ngrok URL changes with each restart${NC}\n"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/micro-service-boilerplate-main 2"
MOBILE_DIR="$SCRIPT_DIR/mobile"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down servers...${NC}"
    pkill -f "ts-node.*src/app.ts"
    pkill -f "ngrok"
    pkill -f "expo start"
    exit 0
}

trap cleanup INT TERM

# Kill any existing processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f "ts-node.*src/app.ts" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
pkill -f "expo start" 2>/dev/null
sleep 2

# Start Backend Server in background
echo -e "${GREEN}1️⃣  Starting Backend Server...${NC}"
cd "$BACKEND_DIR"
npm start serve > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 8

if ! lsof -i :4000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to start backend server${NC}"
    tail -20 /tmp/backend.log
    exit 1
fi

echo -e "${GREEN}✅ Backend started on http://localhost:4000${NC}"

# Start Ngrok tunnel for backend
echo -e "${GREEN}2️⃣  Starting Ngrok tunnel for backend...${NC}"
ngrok http 4000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get the URL
echo -e "${YELLOW}⏳ Waiting for ngrok tunnel...${NC}"
sleep 5

# Extract ngrok URL
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
    echo -e "${YELLOW}📋 Ngrok logs:${NC}"
    tail -20 /tmp/ngrok.log
    cleanup
fi

echo -e "${GREEN}✅ Ngrok tunnel: ${NGROK_URL}${NC}"

# Update all config files with new ngrok URL
echo -e "${GREEN}3️⃣  Updating configuration files...${NC}"

API_URL="${NGROK_URL}/api/v1"

# Update mobile/src/config.ts
cat > "$MOBILE_DIR/src/config.ts" << EOF
// API Configuration
// Using ngrok tunnel for development to work from anywhere
// ⚠️ This URL is auto-generated on each restart by start-dev.sh
export const API_BASE_URL = __DEV__
  ? "${API_URL}"
  : "https://api.ielts-practice.com";

export const SOCKET_URL = API_BASE_URL;

// App Configuration
export const APP_CONFIG = {
  // Friends
  MAX_FRIEND_REQUESTS_PER_DAY: 20,
  MAX_FRIENDS: 500,

  // Study Groups
  MAX_GROUP_MEMBERS: 15,
  MAX_GROUPS_PER_USER: 10,

  // Referrals
  MAX_REFERRALS_PER_DAY: 5,

  // Chat
  MAX_MESSAGE_LENGTH: 2000,
  MESSAGE_LOAD_LIMIT: 50,

  // Leaderboard
  LEADERBOARD_PAGE_SIZE: 100,

  // Achievements
  XP_PER_LEVEL: 100,
};

// Feature Flags
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

# Update mobile/src/api/client.ts
sed -i '' "s|const defaultApiUrl = \".*\";|const defaultApiUrl = \"${API_URL}\";|" "$MOBILE_DIR/src/api/client.ts"

# Update mobile/src/api/speechApi.ts
sed -i '' "s|Constants.expoConfig?.extra?.apiUrl || \".*\";|Constants.expoConfig?.extra?.apiUrl || \"${API_URL}\";|" "$MOBILE_DIR/src/api/speechApi.ts"

# Update mobile/src/api/topicApi.ts
sed -i '' "s|Constants.expoConfig?.extra?.apiUrl || \".*\";|Constants.expoConfig?.extra?.apiUrl || \"${API_URL}\";|" "$MOBILE_DIR/src/api/topicApi.ts"

# Update mobile/app.json
sed -i '' "s|\"apiUrl\": \".*\"|\"apiUrl\": \"${API_URL}\"|" "$MOBILE_DIR/app.json"

echo -e "${GREEN}✅ Configuration files updated${NC}"

# Test backend connection
echo -e "${GREEN}4️⃣  Testing backend connection...${NC}"
HEALTH_CHECK=$(curl -s -H "x-api-key: local-dev-api-key" "${API_URL}/health" 2>/dev/null | grep -o '"status":"ok"')
if [ ! -z "$HEALTH_CHECK" ]; then
    echo -e "${GREEN}✅ Backend is accessible via ngrok${NC}"
else
    echo -e "${RED}⚠️  Backend health check failed, but continuing...${NC}"
fi

# Create a summary file
cat > "$SCRIPT_DIR/CURRENT-NGROK-URL.txt" << EOF
===========================================
IELTS SPEAKING TEST APP - CURRENT SESSION
===========================================

Started: $(date)

Backend Server:
  Local:  http://localhost:4000
  Public: ${NGROK_URL}
  API:    ${API_URL}

Ngrok Dashboard:
  http://localhost:4040

Status:
  Backend PID: $BACKEND_PID
  Ngrok PID:   $NGROK_PID

Updated Files:
  ✅ mobile/src/config.ts
  ✅ mobile/src/api/client.ts
  ✅ mobile/src/api/speechApi.ts
  ✅ mobile/src/api/topicApi.ts
  ✅ mobile/app.json

Next Steps:
  1. This script will now start Expo
  2. Scan QR code with Expo Go app
  3. App will connect via ngrok tunnels

To stop servers:
  Press Ctrl+C in this terminal
===========================================
EOF

echo -e "\n${BLUE}📋 Session details saved to: CURRENT-NGROK-URL.txt${NC}"

# Display summary
echo -e "\n${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🎉 SETUP COMPLETE!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}📡 Backend API:${NC} ${API_URL}"
echo -e "${BLUE}🌐 Ngrok Dashboard:${NC} http://localhost:4040"
echo -e "${BLUE}📝 Backend Logs:${NC} tail -f /tmp/backend.log"
echo -e "${BLUE}📝 Ngrok Logs:${NC} tail -f /tmp/ngrok.log\n"

echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo -e "   • Ngrok URL changes each time you restart this script"
echo -e "   • This terminal must stay open to keep servers running"
echo -e "   • Press ${RED}Ctrl+C${NC} to stop all servers\n"

# Start Expo
echo -e "${YELLOW}🚀 Starting Expo Dev Server...${NC}"
echo -e "${YELLOW}   (This will show the QR code to scan)${NC}\n"

cd "$MOBILE_DIR"
NODE_OPTIONS="--require ./scripts/availableParallelismPolyfill.js" npx expo start --tunnel

# If expo exits, cleanup
cleanup
