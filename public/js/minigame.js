// Whack-a-Mole game
function startWhackGame(containerId, durationSeconds) {
  const container = document.getElementById(containerId);
  container.innerHTML = ''; // Clear container
  let score = 0;
  let gameOver = false;

  // Create 9 mole spots
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const spot = document.createElement('div');
    spot.className = 'mole-spot';
    container.appendChild(spot);
    spots.push(spot);
  }

  let activeMoleIndex = -1;

  function spawnMole() {
    if (gameOver) return;

    // Remove previous mole
    if (activeMoleIndex !== -1) spots[activeMoleIndex].style.background = '#eee';

    // Pick a new random mole
    activeMoleIndex = Math.floor(Math.random() * spots.length);
    spots[activeMoleIndex].style.background = 'green';
  }

  const moleInterval = setInterval(spawnMole, 800); // Mole changes every 0.8s

  // Handle clicks
  spots.forEach((spot, idx) => {
    spot.addEventListener('click', () => {
      if (gameOver) return;
      if (idx === activeMoleIndex) {
        score += 10; // Earn MBucks per hit
        spot.style.background = '#eee';
        activeMoleIndex = -1;
      }
    });
  });

  // End game after duration
  setTimeout(() => {
    gameOver = true;
    clearInterval(moleInterval);
    const earned = score;
    alert(`Game over! You earned ${earned} MBucks.`);

    fetch('/earn', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username: 'demoUser', mbucks: earned })
    }).then(() => {
      // Update balance
      if (typeof refreshBalance === 'function') refreshBalance();
    });
  }, durationSeconds * 1000);

  // Spawn the first mole immediately
  spawnMole();
}
