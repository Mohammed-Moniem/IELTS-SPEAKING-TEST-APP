# Permanent Tunnel Solutions (No Payment Required)

## The Problem

Ngrok free tier changes URLs on every restart, breaking the mobile app connection.

## ✅ Solution 1: LocalTunnel (RECOMMENDED)

### Why LocalTunnel?

- ✅ **100% Free Forever**
- ✅ **Custom Subdomains** (permanent URLs!)
- ✅ **No Account Required**
- ✅ **No Time Limits**
- ✅ **Works with Socket.IO**

### Installation

```bash
npm install -g localtunnel
```

### Usage

Just use the new script:

```bash
./start-backend-localtunnel.sh
```

### Your Permanent URL

Your tunnel URL will be based on your username:

```
https://ielts-speaking-dev-[your-username].loca.lt
```

This URL **never changes** - even after restarts! 🎉

### How It Works

1. LocalTunnel creates a subdomain based on your username
2. The script auto-updates `app.json` with this URL
3. The URL stays the same every time you restart
4. No more manual URL updates needed!

### First Time Setup

The first time you visit the LocalTunnel URL in your browser, you'll see a page asking to confirm. Just click "Continue" - this is a one-time security check.

---

## ✅ Solution 2: Cloudflare Tunnel (Alternative)

### Why Cloudflare Tunnel?

- ✅ **100% Free Forever**
- ✅ **More Reliable** than LocalTunnel
- ✅ **Faster Performance**
- ✅ **Custom Domains** (if you have one)
- ⚠️ Requires Cloudflare account (free)

### Installation

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### Usage

```bash
# Start tunnel (run once, keep it running)
cloudflared tunnel --url http://localhost:4000
```

### Getting Your Permanent URL

1. Create a Cloudflare account (free)
2. Create a named tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create ielts-backend
cloudflared tunnel route dns ielts-backend ielts-backend.yourdomain.com
```

---

## ✅ Solution 3: Serveo (Simplest)

### Why Serveo?

- ✅ **No Installation** required
- ✅ **Free Forever**
- ✅ **Custom Subdomains**
- ⚠️ Less reliable than others

### Usage

```bash
# Just one command!
ssh -R ielts-dev:80:localhost:4000 serveo.net
```

Your URL: `https://ielts-dev.serveo.net`

---

## ✅ Solution 4: Expose (Good Alternative)

### Why Expose?

- ✅ **Free Tier Available**
- ✅ **Custom Subdomains**
- ✅ **Good Performance**

### Installation

```bash
npm install -g @beyondco/expose
```

### Usage

```bash
expose share http://localhost:4000 --subdomain=ielts-dev
```

---

## Comparison Table

| Solution              | Free?    | Permanent URL? | Installation | Reliability | Speed  |
| --------------------- | -------- | -------------- | ------------ | ----------- | ------ |
| **LocalTunnel**       | ✅ Yes   | ✅ Yes         | Easy         | Good        | Medium |
| **Cloudflare Tunnel** | ✅ Yes   | ✅ Yes         | Medium       | Excellent   | Fast   |
| **Serveo**            | ✅ Yes   | ✅ Yes         | None (SSH)   | Fair        | Medium |
| **Ngrok Free**        | ✅ Yes   | ❌ No          | Easy         | Good        | Fast   |
| **Ngrok Paid**        | ❌ $8/mo | ✅ Yes         | Easy         | Excellent   | Fast   |

---

## Current Setup

We've set up **LocalTunnel** because:

1. No account required
2. Permanent subdomain based on your username
3. Works immediately
4. Free forever

Your permanent URL: `https://ielts-speaking-dev-[your-username].loca.lt`

---

## Troubleshooting

### LocalTunnel Not Working?

```bash
# Reinstall
npm uninstall -g localtunnel
npm install -g localtunnel

# Or use npx (no installation)
npx localtunnel --port 4000 --subdomain ielts-dev-$(whoami)
```

### Connection Issues?

1. Make sure backend is running on port 4000
2. Check firewall settings
3. Try a different tunnel solution from above

### Want Even More Reliability?

Use **Cloudflare Tunnel** - it's the most stable option and still 100% free!

---

## Need Help?

1. **LocalTunnel Docs**: https://github.com/localtunnel/localtunnel
2. **Cloudflare Tunnel**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
3. **Serveo**: https://serveo.net/

---

## Quick Start (TL;DR)

Just run this:

```bash
./start-backend-localtunnel.sh
```

That's it! Your URL will be permanent and auto-configured. 🚀
