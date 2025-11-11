const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const DB_FILE = './db.json';
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1437734443501621300/s9Nqdv4iNp4uXzXOFP40OW17ofLnysy0r4cTa4JkPAI2-KKBWn12yGT4r7TVf4Le19NJ';
const DISCORD_CLIENT_ID = '1437736975397294150'; // Add your Discord app client ID
const DISCORD_CLIENT_SECRET = 'dmyzdw7EJ2Fb30yCji2vxOquzabpilN-'; // Add your Discord app secret
const REDIRECT_URI = 'http://localhost:3000/auth/discord/callback';

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
    // Exchange code for access token
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

    // Get user info from Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const user = await userRes.json();
    const userId = user.id;
    const username = user.username;

    // Initialize user in database if new
    const db = readDB();
    if (!db[userId]) {
      db[userId] = 0;
      writeDB(db);
    }

    // Set cookie/session and redirect to main page
    res.cookie('discord_user_id', userId, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.cookie('discord_username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect(`/?user=${userId}&username=${username}`);
  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Get balance
app.post('/balance', (req,res)=>{
  const {userId} = req.body;
  const db = readDB();
  res.send({mbucks: db[userId]||0});
});

// Earn MBucks
app.post('/earn',(req,res)=>{
  const {userId, mbucks} = req.body;
  const db = readDB();
  db[userId] = (db[userId]||0)+mbucks;
  writeDB(db);
  res.send({message:`Added ${mbucks} MBucks`, mbucks: db[userId]});
});

// Exchange MBucks
app.post('/exchange', async(req,res)=>{
  const {userId, username, amount} = req.body;
  const db = readDB();
  if(!db[userId]||db[userId]<amount||amount<300) return res.status(400).send({message:'Not enough MBucks'});
  const streamPoints = Math.floor(amount/10);
  db[userId]-= streamPoints*10;
  writeDB(db);
  await fetch(DISCORD_WEBHOOK,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({content:`@${username} exchanged ${streamPoints*10} MBucks for ${streamPoints} stream points! 🎉`})
  }).catch(err => console.error('Discord webhook error:', err));
  res.send({message:`Exchanged ${streamPoints*10} MBucks for ${streamPoints} stream points!`, mbucks: db[userId]});
});

// Get current user session
app.get('/current-user', (req, res) => {
  const userId = req.query.user;
  const username = req.query.username;
  
  if (!userId) return res.status(401).send('Not authenticated');
  
  const db = readDB();
  res.send({
    userId,
    username,
    mbucks: db[userId] || 0
  });
});

app.listen(3000,()=>console.log('Server running on http://localhost:3000'));
