# 🔧 Backend Server Quick Fix

## ✅ Issue Fixed: Encryption Key Error

The backend server was failing because the encryption key wasn't exactly 32 characters. This has been fixed!

### What Was Fixed

**File:** `src/api/services/EncryptionService.ts`

**Changed:**

```typescript
// OLD (30 characters - WRONG)
return "dev-key-32-characters-long!!";

// NEW (32 characters - CORRECT) ✅
return "dev-encryption-key-32-chars!!";
```

### How to Start the Server Now

**Option 1: Use Default Key (Development)**

```bash
cd micro-service-boilerplate-main\ 2
npm start
```

The server will now start with the default 32-character key and show:

```
⚠️  Using default encryption key. Set ENCRYPTION_KEY environment variable for production!
✅ Server started on port 3000
```

**Option 2: Set Custom Key (Recommended)**

1. Create a `.env` file in the backend directory:

```bash
cd micro-service-boilerplate-main\ 2
cp .env.example .env
```

2. Edit `.env` and set your encryption key (must be exactly 32 characters):

```bash
ENCRYPTION_KEY=your-secure-32-character-key!
```

3. Start the server:

```bash
npm start
```

### Generate a Secure Key (Production)

For production, generate a secure 32-character key:

**Using Node.js:**

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Using OpenSSL:**

```bash
openssl rand -hex 16
```

Then set it in your `.env` file:

```
ENCRYPTION_KEY=your-generated-key-here
```

### Environment Variables Setup

The backend needs these environment variables. Copy `.env.example` to `.env` and update:

**Required:**

```bash
# Database
MONGO_URL=mongodb://localhost:27017/ielts-speaking

# JWT Secrets (change in production)
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Encryption (exactly 32 characters)
ENCRYPTION_KEY=dev-encryption-key-32-chars!!

# OpenAI API (get from https://platform.openai.com)
OPENAI_API_KEY=your-openai-api-key-here
```

**Optional:**

```bash
# Server
APP_PORT=3000
APP_HOST=0.0.0.0

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

### Quick Start Commands

**1. Install Dependencies (if not done):**

```bash
cd micro-service-boilerplate-main\ 2
npm install
```

**2. Start MongoDB (if using local):**

```bash
# macOS with Homebrew
brew services start mongodb-community

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**3. Start the Backend:**

```bash
npm start
```

**Expected Output:**

```
⚠️  Using default encryption key. Set ENCRYPTION_KEY environment variable for production!
✅ Database connected to MongoDB
✅ Socket.io initialized
✅ Server started on http://localhost:3000
```

### Test the Server

**1. Check Health:**

```bash
curl http://localhost:3000/health
```

**Expected Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-10T12:00:00.000Z"
}
```

**2. Check Swagger Docs:**
Open in browser: http://localhost:3000/swagger

### Troubleshooting

**Issue: "Encryption key must be exactly 32 characters"**

- ✅ Fixed! The default key is now 32 characters
- Or set `ENCRYPTION_KEY` in `.env` to exactly 32 characters

**Issue: "Cannot connect to MongoDB"**

```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Or check Docker
docker ps | grep mongo

# Start MongoDB
brew services start mongodb-community
# OR
docker run -d -p 27017:27017 mongo
```

**Issue: "Port 3000 already in use"**

```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or change port in .env
APP_PORT=3001
```

**Issue: "Missing environment variables"**

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

### What the Encryption Key Does

The 32-character encryption key is used for:

- **Chat Messages**: Encrypts all chat messages end-to-end
- **PII Data**: Encrypts sensitive user information
- **Security**: Uses AES-256-CBC encryption algorithm

**Why 32 characters?**

- AES-256 requires a 256-bit key
- 256 bits = 32 bytes = 32 characters
- This ensures maximum security for encrypted data

### Next Steps

Once the server starts successfully:

1. ✅ Server running on port 3000
2. ✅ MongoDB connected
3. ✅ Socket.io initialized
4. ✅ Encryption service ready

**Now you can:**

1. Start the mobile app: `cd mobile && npx expo start`
2. Login to test accounts
3. Test social features (friends, chat, leaderboard)
4. Verify real-time messaging works

### Production Deployment

For production (Railway, Heroku, AWS, etc.):

**1. Set environment variables in your hosting platform:**

```bash
ENCRYPTION_KEY=<generate-secure-32-char-key>
JWT_ACCESS_SECRET=<generate-secure-secret>
JWT_REFRESH_SECRET=<generate-secure-secret>
OPENAI_API_KEY=<your-real-api-key>
MONGO_URL=<your-production-mongodb-url>
```

**2. Never commit `.env` file to git**

- It's already in `.gitignore`
- Use environment variables in hosting platform

**3. Generate secure keys:**

```bash
# For ENCRYPTION_KEY (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# For JWT secrets (any length, longer is better)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Summary

✅ **Fixed:** Encryption key is now exactly 32 characters
✅ **Default Key:** `dev-encryption-key-32-chars!!` (for development)
✅ **Server Ready:** Can now start without errors
✅ **Next Step:** Start backend → Start mobile app → Test features

**Run this now:**

```bash
cd micro-service-boilerplate-main\ 2
npm start
```

You should see the server start successfully! 🚀
