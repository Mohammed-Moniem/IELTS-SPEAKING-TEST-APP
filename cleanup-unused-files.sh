#!/bin/bash

# Safe cleanup script for unused files
# Run this from the project root directory

echo "🧹 Starting cleanup of unused files..."
echo ""

# File 1: Old VoiceConversation component (replaced by VoiceConversationV2)
FILE1="mobile/src/components/VoiceConversation.tsx"
if [ -f "$FILE1" ]; then
    echo "✅ Removing: $FILE1"
    rm "$FILE1"
else
    echo "⚠️  Not found: $FILE1"
fi

# File 2: PostgreSQL test users script (app uses MongoDB)
FILE2="micro-service-boilerplate-main/create-test-users.ts"
if [ -f "$FILE2" ]; then
    echo "✅ Removing: $FILE2"
    rm "$FILE2"
else
    echo "⚠️  Not found: $FILE2"
fi

# File 3: Duplicate MongoDB test users script
FILE3="micro-service-boilerplate-main/create-test-users-mongo.ts"
if [ -f "$FILE3" ]; then
    echo "✅ Removing: $FILE3"
    rm "$FILE3"
else
    echo "⚠️  Not found: $FILE3"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "📋 Summary:"
echo "   - Removed old VoiceConversation component (VoiceConversationV2 is used)"
echo "   - Removed PostgreSQL test user script (app uses MongoDB)"
echo "   - Removed duplicate MongoDB test user script"
echo ""
echo "📝 Note: create-test-user.ts was kept (MongoDB single user script)"
echo ""
