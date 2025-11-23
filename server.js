const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

const DB_FILE = './db.json';
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1438090257655529568/tWGEyR2XDyzfcCRFXajp4XlNOCs3JNSkUG82SwT9g6yljVjkloLxALUqRc91nDzWFZl7';
const DISCORD_CLIENT_ID = '1437736975397294150';
const DISCORD_CLIENT_SECRET = 'dmyzdw7EJ2Fb30yCji2vxOquzabpilN-';
const REDIRECT_URI = 'https://mikeyy-minigames.onrender.com/auth/discord/callback';

if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE)); }
function writeDB(data){ fs.writeFileSync(DB_FILE, JSON.stringify(data, null,2)); }

// Discord OAuth Login - Redirect to Discord
app.get('/auth/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
  res.redirect(discordAuthUrl);
});

// Discord OAuth Callback
app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('Failed to get access token');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const user = await userRes.json();
    const userId = user.id;
    const username = user.username;

    const db = readDB();
    if (!db[userId]) {
      db[userId] = 0;
      writeDB(db);
    }

    res.cookie('discord_user_id', userId, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.cookie('discord_username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect(`/?user=${userId}&username=${username}`);
  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Get balance - FIXED: better error handling
app.post('/balance', (req,res)=>{
  const {userId} = req.body;
  if (!userId) return res.status(400).send({message: 'User ID required'});
  const db = readDB();
  res.send({mbucks: db[userId]||0});
});

// Earn MBucks - FIXED: validation and logging
app.post('/earn',(req,res)=>{
  const {userId, mbucks} = req.body;
  if (!userId || !mbucks) return res.status(400).send({message: 'Invalid request'});
  const db = readDB();
  db[userId] = (db[userId]||0)+mbucks;
  writeDB(db);
  console.log(`User ${userId} earned ${mbucks} MBucks. New balance: ${db[userId]}`);
  res.send({message:`Added ${mbucks} MBucks`, mbucks: db[userId]});
});

// Exchange MBucks - FIXED: better validation
app.post('/exchange', async(req,res)=>{
  const {userId, username, amount} = req.body;
  const db = readDB();
  if(!db[userId]||db[userId]<amount||amount<300) {
    return res.status(400).send({message:'Not enough MBucks or minimum not met (300 MBucks)'});
  }
  const streamPoints = Math.floor(amount/10);
  db[userId]-= streamPoints*10;
  writeDB(db);
  await fetch(DISCORD_WEBHOOK,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({content:`@🔧 Moderator🔧 **${username}** exchanged **${streamPoints*10} MBucks** for **${streamPoints} stream points**! 🎉`})
  }).catch(err => console.error('Discord webhook error:', err));
  res.send({message:`Exchanged ${streamPoints*10} MBucks for ${streamPoints} stream points!`, mbucks: db[userId]});
});

// Get current user session - FIXED: check cookies too
app.get('/current-user', (req, res) => {
  const userId = req.query.user || req.cookies.discord_user_id;
  const username = req.query.username || req.cookies.discord_username;
  
  if (!userId) return res.status(401).send({message: 'Not authenticated'});
  
  const db = readDB();
  res.send({
    userId,
    username,
    mbucks: db[userId] || 0
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
