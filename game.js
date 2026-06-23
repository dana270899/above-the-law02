// ═══════════════════════════════════════════════
// GAME STATE
// One object holds everything that changes at runtime.
// Nothing else in the code stores "what's happening" —
// it all lives here.
// ═══════════════════════════════════════════════
const state = {
  currentScreen: 'login',  // which screen is active
  currentPlayer: null,     // will hold player data after login
};


// ═══════════════════════════════════════════════
// SCALING
// The game is designed at 1920×1080.
// This function scales it to fit any screen size
// without stretching — like a cinema letterbox.
// ═══════════════════════════════════════════════
function scaleGame() {
  const scaleX = window.innerWidth  / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale  = Math.min(scaleX, scaleY); // fit inside, never crop

  // Center the scaled canvas in the window
  const offsetX = (window.innerWidth  - 1920 * scale) / 2;
  const offsetY = (window.innerHeight - 1080 * scale) / 2;

  document.getElementById('game').style.transform =
    `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

window.addEventListener('resize', scaleGame);


// ═══════════════════════════════════════════════
// LOGIN
// Called when the player clicks the green arrow
// or presses Enter on the password field.
// ═══════════════════════════════════════════════
function handleLogin() {
  const input    = document.getElementById('password-input');
  const password = input.value.trim();

  if (!password) return; // do nothing if empty

  // TODO: validate password against player data
  // For now, log and clear the field
  console.log('Login attempted:', password);
  input.value = '';
}

document.getElementById('login-btn').addEventListener('click', handleLogin);

document.getElementById('password-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleLogin();
});


// ═══════════════════════════════════════════════
// INIT
// Runs once when the page loads.
// Add any one-time setup here.
// ═══════════════════════════════════════════════
function init() {
  scaleGame();
}

init();
