#!/bin/bash

# IELTS Speaking App - Firewall Configuration Script
# This script helps configure macOS firewall to allow Node.js connections

echo "🔥 Firewall Configuration for IELTS App"
echo "========================================"
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
  echo "⚠️  This script needs administrator privileges"
  echo "Please run: sudo bash fix-firewall.sh"
  exit 1
fi

echo "1️⃣ Checking firewall status..."
firewall_status=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate)
echo "   $firewall_status"
echo ""

# Find Node.js binary
NODE_PATH=$(which node)
echo "2️⃣ Found Node.js at: $NODE_PATH"
echo ""

echo "3️⃣ Adding Node.js to firewall allow list..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH"
echo "   ✅ Node.js added to firewall"
echo ""

echo "4️⃣ Allowing incoming connections for Node.js..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_PATH"
echo "   ✅ Incoming connections allowed"
echo ""

echo "5️⃣ Restarting firewall..."
sudo pkill -HUP socketfilterfw
echo "   ✅ Firewall restarted"
echo ""

echo "✅ Firewall configuration complete!"
echo ""
echo "📱 Next steps:"
echo "1. Restart your backend server (npm start serve)"
echo "2. Restart your mobile app"
echo "3. Test connection again"
echo ""
echo "⚡ Quick test: curl http://192.168.0.149:4000/api/v1/topics"
