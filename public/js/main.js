// Discord Authentication & Session Management
let currentUser = {
  userId: null,
  username: null,
  mbucks: 0
};

function getUrlParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function initializeAuth() {
  // Check if user ID is in URL params (from Discord OAuth callback)
  let userId = getUrlParameter('user');
  let username = getUrlParameter('username');
  
  // If not in URL, check localStorage for existing session
  if (!userId) {
    userId = localStorage.getItem('discord_user_id');
    username = localStorage.getItem('discord_username');
  }
  
  // If still no user, redirect to login
  if (!userId || !username) {
    window.location.href = '/login.html';
    return false;
  }
  
  // Save to localStorage for persistence
  localStorage.setItem('discord_user_id', userId);
  localStorage.setItem('discord_username', username);
  
  // Set global user object
  currentUser.userId = userId;
  currentUser.username = username;
  window.currentUser = currentUser;
  
  return true;
}

async function refreshBalance() {
  if (!currentUser.userId) {
    console.error('No user logged in');
    return;
  }

  try {
    const res = await fetch('/balance', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({userId: currentUser.userId})
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch balance');
    }
    
    const data = await res.json();
    currentUser.mbucks = data.mbucks || 0;
    
    // Update display
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
      balanceElement.textContent = currentUser.mbucks;
    }
    
    return currentUser.mbucks;
  } catch (err) {
    console.error('Error refreshing balance:', err);
    alert('Error loading balance. Please refresh the page.');
  }
}

function logout() {
  localStorage.removeItem('discord_user_id');
  localStorage.removeItem('discord_username');
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize authentication
  if (!initializeAuth()) {
    return; // User will be redirected to login
  }

  // Update username display if element exists
  const usernameElement = document.getElementById('username');
  if (usernameElement) {
    usernameElement.textContent = currentUser.username;
  }

  // Setup logout button if exists
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Setup refresh balance button
  const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
  if (refreshBalanceBtn) {
    refreshBalanceBtn.addEventListener('click', refreshBalance);
  }

  // Setup exchange button
  const exchangeBtn = document.getElementById('exchangeBtn');
  if (exchangeBtn) {
    exchangeBtn.addEventListener('click', async () => {
      const amount = parseInt(prompt('Enter MBucks to exchange\n(Minimum: 300, 10 MBucks = 1 Stream Point):'));
      
      if (isNaN(amount)) {
        return;
      }

      if (amount < 300) {
        alert('❌ You need at least 300 MBucks to exchange.');
        return;
      }

      try {
        const res = await fetch('/exchange', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId: currentUser.userId,
            username: currentUser.username,
            amount
          })
        });

        if (!res.ok) {
          const error = await res.json();
          alert('❌ ' + (error.message || 'Exchange failed'));
          return;
        }

        const data = await res.json();
        alert('✅ ' + data.message);
        await refreshBalance();
      } catch (err) {
        alert('❌ Error exchanging MBucks: ' + err.message);
      }
    });
  }

  // Initial balance load
  refreshBalance();
});

