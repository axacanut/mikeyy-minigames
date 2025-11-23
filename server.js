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
const ADMIN_FILE = './admins.json';
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1438090257655529568/tWGEyR2XDyzfcCRFXajp4XlNOCs3JNSkUG82SwT9g6yljVjkloLxALUqRc91nDzWFZl7';
const DISCORD_CLIENT_ID = '1417788683024597062';
const DISCORD_CLIENT_SECRET = 'dmyzdw7EJ2Fb30yCji2vxOquzabpilN-';
const REDIRECT_URI = 'https://mikeyy-minigames.onrender.com/auth/discord/callback';

// YOUR DISCORD USER ID - Replace with your actual Discord ID
const PRIMARY_ADMIN_ID = 'YOUR_DISCORD_USER_ID_HERE';

if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if(!fs.existsSync(ADMIN_FILE)) fs.writeFileSync(ADMIN_FILE, JSON.stringify({[PRIMARY_ADMIN_ID]: {role: 'primary', username: 'Primary Admin'}}));

function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE)); }
function writeDB(data){ fs.writeFileSync(DB_FILE, JSON.stringify(data, null,2)); }
function readAdmins(){ return JSON.parse(fs.readFileSync(ADMIN_FILE)); }
function writeAdmins(data){ fs.writeFileSync(ADMIN_FILE, JSON.stringify(data, null,2)); }

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  const userId = req.cookies.discord_user_id;
  const admins = readAdmins();
  
  if (!userId || !admins[userId]) {
    return res.status(403).send({message: 'Access denied. Admin only.'});
  }
  
  req.adminRole = admins[userId].role;
  next();
}

// Discord OAuth Login
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

// Get balance
app.post('/balance', (req,res)=>{
  const {userId} = req.body;
  if (!userId) return res.status(400).send({message: 'User ID required'});
  const db = readDB();
  res.send({mbucks: db[userId]||0});
});

// Earn MBucks
app.post('/earn',(req,res)=>{
  const {userId, mbucks} = req.body;
  if (!userId || !mbucks) return res.status(400).send({message: 'Invalid request'});
  const db = readDB();
  db[userId] = (db[userId]||0)+mbucks;
  writeDB(db);
  console.log(`User ${userId} earned ${mbucks} MBucks. New balance: ${db[userId]}`);
  res.send({message:`Added ${mbucks} MBucks`, mbucks: db[userId]});
});

// Exchange MBucks
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

// Get current user session
app.get('/current-user', (req, res) => {
  const userId = req.query.user || req.cookies.discord_user_id;
  const username = req.query.username || req.cookies.discord_username;
  
  if (!userId) return res.status(401).send({message: 'Not authenticated'});
  
  const db = readDB();
  const admins = readAdmins();
  
  res.send({
    userId,
    username,
    mbucks: db[userId] || 0,
    isAdmin: !!admins[userId],
    adminRole: admins[userId]?.role || null
  });
});

// ===== ADMIN ENDPOINTS =====

// Check if current user is admin
app.get('/admin/check', (req, res) => {
  const userId = req.cookies.discord_user_id;
  const admins = readAdmins();
  
  res.send({
    isAdmin: !!admins[userId],
    role: admins[userId]?.role || null
  });
});

// Get all users (Admin only)
app.get('/admin/users', isAdmin, (req, res) => {
  const db = readDB();
  const admins = readAdmins();
  
  const users = Object.keys(db).map(userId => ({
    userId,
    mbucks: db[userId],
    isAdmin: !!admins[userId],
    adminRole: admins[userId]?.role || null
  }));
  
  res.send({users});
});

// Update user balance (Admin only)
app.post('/admin/update-balance', isAdmin, (req, res) => {
  const {userId, newBalance} = req.body;
  
  if (!userId || newBalance === undefined) {
    return res.status(400).send({message: 'User ID and new balance required'});
  }
  
  const db = readDB();
  const oldBalance = db[userId] || 0;
  db[userId] = parseInt(newBalance);
  writeDB(db);
  
  console.log(`Admin updated user ${userId} balance: ${oldBalance} -> ${newBalance}`);
  res.send({message: 'Balance updated successfully', mbucks: db[userId]});
});

// Add admin (Primary admin only)
app.post('/admin/add-admin', isAdmin, (req, res) => {
  if (req.adminRole !== 'primary') {
    return res.status(403).send({message: 'Only primary admin can add other admins'});
  }
  
  const {userId, username} = req.body;
  
  if (!userId) {
    return res.status(400).send({message: 'User ID required'});
  }
  
  const admins = readAdmins();
  admins[userId] = {
    role: 'admin',
    username: username || 'Admin',
    addedAt: new Date().toISOString()
  };
  writeAdmins(admins);
  
  console.log(`New admin added: ${userId}`);
  res.send({message: 'Admin added successfully'});
});

// Remove admin (Primary admin only)
app.post('/admin/remove-admin', isAdmin, (req, res) => {
  if (req.adminRole !== 'primary') {
    return res.status(403).send({message: 'Only primary admin can remove admins'});
  }
  
  const {userId} = req.body;
  
  if (!userId) {
    return res.status(400).send({message: 'User ID required'});
  }
  
  if (userId === PRIMARY_ADMIN_ID) {
    return res.status(403).send({message: 'Cannot remove primary admin'});
  }
  
  const admins = readAdmins();
  delete admins[userId];
  writeAdmins(admins);
  
  console.log(`Admin removed: ${userId}`);
  res.send({message: 'Admin removed successfully'});
});

// Get all admins (Admin only)
app.get('/admin/list-admins', isAdmin, (req, res) => {
  const admins = readAdmins();
  
  const adminList = Object.keys(admins).map(userId => ({
    userId,
    username: admins[userId].username,
    role: admins[userId].role,
    addedAt: admins[userId].addedAt || 'N/A'
  }));
  
  res.send({admins: adminList});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
