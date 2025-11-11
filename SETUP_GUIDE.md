# Mikeyy's Minigames - Setup Guide

## Discord OAuth Setup (IMPORTANT!)

To get Discord authentication working, you need to:

### 1. Create a Discord Application
- Go to https://discord.com/developers/applications
- Click "New Application"
- Give it a name (e.g., "Mikeyy's Minigames")
- Go to "OAuth2" → "General"
- Copy your **Client ID**
- Click "Reset Secret" and copy your **Client Secret**

### 2. Set Redirect URI
- In the Discord app settings, go to "OAuth2" → "Redirects"
- Add: `http://localhost:3000/auth/discord/callback`

### 3. Update server.js
In `server.js`, replace:
```javascript
const DISCORD_CLIENT_ID = 'YOUR_DISCORD_CLIENT_ID'; // Add your Discord app client ID
const DISCORD_CLIENT_SECRET = 'YOUR_DISCORD_CLIENT_SECRET'; // Add your Discord app secret
```

With your actual credentials from step 1.

## Running the Server

```bash
npm install
node server.js
```

Then open: http://localhost:3000

## How It Works

1. **Login**: Users click "Login with Discord" button
2. **Authentication**: They authorize your app with their Discord account
3. **Session**: Their Discord ID and username are saved in localStorage
4. **Games**: They play minigames to earn MBucks
5. **Persistence**: MBucks are saved in `db.json` using their Discord ID
6. **Exchange**: They can exchange MBucks for stream points

## Data Storage

- All user data is stored in `db.json`
- Each user is identified by their Discord User ID
- Balances persist across sessions

## Features

✅ Discord OAuth login (no passwords!)
✅ Real-time MBucks tracking
✅ Persistent balance storage
✅ 4 fun minigames
✅ MBucks to Stream Points exchange
✅ Discord webhook notifications

Enjoy! 🎮
