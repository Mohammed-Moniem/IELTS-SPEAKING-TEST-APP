#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       IELTS Speaking Test App - Quick Start       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}Choose how to start the development environment:${NC}\n"
echo -e "  ${YELLOW}1)${NC} Single Terminal Mode (all logs in one window)"
echo -e "  ${YELLOW}2)${NC} Multi-Terminal Mode (separate windows for better monitoring)"
echo -e "  ${YELLOW}3)${NC} View Current Ngrok URL"
echo -e "  ${YELLOW}4)${NC} Stop All Servers"
echo -e "  ${YELLOW}5)${NC} Exit\n"

read -p "$(echo -e ${BLUE}Enter your choice [1-5]:${NC} )" choice

case $choice in
    1)
        echo -e "\n${GREEN}🚀 Starting in Single Terminal Mode...${NC}\n"
        bash "$SCRIPT_DIR/start-dev.sh"
        ;;
    2)
        echo -e "\n${GREEN}🚀 Starting in Multi-Terminal Mode...${NC}\n"
        bash "$SCRIPT_DIR/start-dev-multi-terminal.sh"
        ;;
    3)
        echo -e "\n${BLUE}📡 Current Ngrok Configuration:${NC}\n"
        if [ -f "$SCRIPT_DIR/CURRENT-NGROK-URL.txt" ]; then
            cat "$SCRIPT_DIR/CURRENT-NGROK-URL.txt"
            echo -e "\n${GREEN}✅ Sessions are running${NC}\n"
        else
            echo -e "${YELLOW}⚠️  No active session found. Start the servers first.${NC}\n"
        fi
        ;;
    4)
        echo -e "\n${YELLOW}🛑 Stopping all servers...${NC}\n"
        pkill -f "ts-node.*src/app.ts" 2>/dev/null && echo -e "${GREEN}✅ Backend stopped${NC}"
        pkill -f "ngrok" 2>/dev/null && echo -e "${GREEN}✅ Ngrok stopped${NC}"
        pkill -f "expo start" 2>/dev/null && echo -e "${GREEN}✅ Expo stopped${NC}"
        rm -f "$SCRIPT_DIR/CURRENT-NGROK-URL.txt" 2>/dev/null
        rm -f /tmp/backend.log /tmp/ngrok.log 2>/dev/null
        echo -e "\n${GREEN}✅ All servers stopped and logs cleaned${NC}\n"
        ;;
    5)
        echo -e "\n${GREEN}👋 Goodbye!${NC}\n"
        exit 0
        ;;
    *)
        echo -e "\n${RED}❌ Invalid choice. Please run the script again.${NC}\n"
        exit 1
        ;;
esac
