/* =========================================================================
   audio.js
   Todo el sonido del juego: efectos (comer, especial, game over, pausa),
   vibración táctil y la música de fondo generada con Web Audio API
   (no usa archivos de audio externos).
   ========================================================================= */

// ================= SONIDO Y MÚSICA =================
let audioCtx;
let musicOn = true;
let musicTimer = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playEatSound() {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  } catch(e) {}
}

function playSpecialSound() {
  try {
    const ac = ensureAudio();
    const notes = [660, 880, 1100];
    notes.forEach((f, i) => {
      const t = ac.currentTime + i * 0.09;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  } catch(e) {}
}

function playGameOverSound() {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.4);
  } catch(e) {}
}

function playPauseSound() {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ac.currentTime);
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.12);
  } catch(e) {}
}

function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch(e) {}
}

// música de fondo suave, generada (sin archivos externos)
function startMusic() {
  if (!musicOn || musicTimer) return;
  const ac = ensureAudio();
  const notes = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33]; // melodía suave y repetitiva
  let i = 0;
  function playNote() {
    if (!musicOn) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = notes[i % notes.length];
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.9);
    i++;
  }
  playNote();
  musicTimer = setInterval(playNote, 950);
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
function toggleMusic() {
  musicOn = !musicOn;
  document.getElementById('musicBtn').textContent = musicOn ? '🎵' : '🔇';
  const homeIcon = document.getElementById('homeMusicIcon');
  if (homeIcon) homeIcon.textContent = musicOn ? '🎵' : '🔇';
  if (musicOn) {
    const ac = ensureAudio();
    if (ac.state === 'suspended') ac.resume();
    if (started && !paused && !gameOver) startMusic();
  } else {
    stopMusic();
  }
}
