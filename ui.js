/* =========================================================================
   ui.js
   Interfaz e interacción: overlays (pausa, recuerdos, sobre nosotros,
   cupones, rastreador), controles de teclado/botones/táctiles/deslizar,
   inicio de partida, decoración ambiental y el mensaje de bienvenida de
   primera visita.

   Este archivo se carga AL FINAL (después de todos los demás) porque
   arranca el juego (init, updateRelationshipBadge, requestAnimationFrame,
   checkFirstVisit) y conecta los botones, que necesitan que todo lo demás
   ya esté definido.
   ========================================================================= */

// ================= NAVEGACIÓN / PANTALLA DE INICIO =================
// Bandera para saber si un overlay (recuerdos/sobre nosotros/cupones) se
// abrió desde la pantalla de inicio. Si es así, al cerrarlo regresamos a
// inicio en vez de dejar ver la pantalla del juego. Si se abrió desde los
// botones de arriba durante una partida (como siempre funcionó), se
// comporta exactamente igual que antes.
let cameFromHome = false;

function goHome() {
  const wasPlaying = started && !paused && !gameOver;
  if (wasPlaying) togglePause();
  document.getElementById('gameCard').style.display = 'none';
  document.getElementById('homeScreen').style.display = 'flex';
}

function enterSnake() {
  cameFromHome = false;
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('gameCard').style.display = 'flex';
}

function openMemoriesFromHome() {
  cameFromHome = true;
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('gameCard').style.display = 'flex';
  openMemories();
}
function openAboutFromHome() {
  cameFromHome = true;
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('gameCard').style.display = 'flex';
  openAbout();
}
function openCouponsFromHome() {
  cameFromHome = true;
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('gameCard').style.display = 'flex';
  openCoupons();
}

// --- "Nuestro tiempo": reutiliza getRelationshipStats(), solo agrega una
// pantalla dedicada para mostrarlo en grande ---
function openTime() {
  const stats = getRelationshipStats();
  const parts = [];
  if (stats.years > 0) parts.push(stats.years + (stats.years === 1 ? ' año' : ' años'));
  if (stats.months > 0) parts.push(stats.months + (stats.months === 1 ? ' mes' : ' meses'));
  if (parts.length === 0) parts.push(stats.totalDays + (stats.totalDays === 1 ? ' día' : ' días'));

  document.getElementById('timeBig').textContent = parts.join(' y ') + ' juntos 💗';
  document.getElementById('timeSub').textContent =
    stats.isAnniversaryDay
      ? `🎉 ¡Hoy cumplimos ${stats.totalMonths} meses!`
      : `En total, ${stats.totalDays} días compartidos.`;

  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('timeOverlay').style.display = 'flex';
}
function closeTime() {
  document.getElementById('timeOverlay').style.display = 'none';
  document.getElementById('homeScreen').style.display = 'flex';
}

// ================= PAUSA =================
function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (paused) {
    playTimeMs += Date.now() - lastResumeTime;
    if (loopId) clearTimeout(loopId);
    stopMusic();
    playPauseSound();
    document.getElementById('pauseOverlay').style.display = 'flex';
    document.getElementById('pauseBtn').textContent = '▶️';
  } else {
    lastResumeTime = Date.now();
    prevPts = currPts; // evita que la serpiente "salte" al reanudar
    lastTickTime = performance.now();
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('pauseBtn').textContent = '⏸';
    if (musicOn) startMusic();
    scheduleTick();
  }
}

// ================= GALERÍA "MIS RECUERDOS" =================
function refreshMemoriesBadge() {
  const badge = document.getElementById('memoriesBadge');
  if (badge) badge.textContent = unlockedMessages.length;
  const homeBadge = document.getElementById('homeMemoriesBadge');
  if (homeBadge) homeBadge.textContent = unlockedMessages.length;
}

function openMemories() {
  const wasPlaying = started && !paused && !gameOver;
  if (wasPlaying) togglePause();
  const list = document.getElementById('memoriesList');
  list.innerHTML = '';
  if (unlockedMessages.length === 0) {
    list.innerHTML = '<div class="memory-empty">Aún no has desbloqueado ningún mensaje 💗<br>Sigue jugando y busca las manzanas especiales en forma de corazón para ir descubriéndolos todos ✨</div>';
  } else {
    unlockedMessages.slice().reverse().forEach(msg => {
      const item = document.createElement('div');
      item.className = 'memory-item';
      item.textContent = msg;
      list.appendChild(item);
    });
  }
  document.getElementById('memoriesOverlay').style.display = 'flex';
}
function closeMemories() {
  document.getElementById('memoriesOverlay').style.display = 'none';
  if (cameFromHome) { cameFromHome = false; goHome(); }
}

// ================= "SOBRE NOSOTROS" =================
function openAbout() {
  const wasPlaying = started && !paused && !gameOver;
  if (wasPlaying) togglePause();

  const stats = getRelationshipStats();
  const parts = [];
  if (stats.years > 0) parts.push(stats.years + (stats.years === 1 ? ' año' : ' años'));
  if (stats.months > 0) parts.push(stats.months + (stats.months === 1 ? ' mes' : ' meses'));
  if (parts.length === 0) parts.push(stats.totalDays + (stats.totalDays === 1 ? ' día' : ' días'));
  document.getElementById('letterDuration').textContent = parts.join(' y ');

  document.getElementById('aboutOverlay').style.display = 'flex';
}
function closeAbout() {
  document.getElementById('aboutOverlay').style.display = 'none';
  if (cameFromHome) { cameFromHome = false; goHome(); }
}

// ================= "MIS CUPONES" =================
function refreshCouponsBadge() {
  const badge = document.getElementById('couponsBadge');
  const claimed = giftIndex + (secretClaimed ? 1 : 0);
  if (badge) badge.textContent = claimed + '/' + (LOVE_COUPONS.length + 1);
  const homeBadge = document.getElementById('homeCouponsBadge');
  if (homeBadge) homeBadge.textContent = claimed + '/' + (LOVE_COUPONS.length + 1);
}

function openCoupons() {
  const wasPlaying = started && !paused && !gameOver;
  if (wasPlaying) togglePause();

  const list = document.getElementById('couponsList');
  list.innerHTML = '';

  LOVE_COUPONS.forEach((coupon, i) => {
    const claimed = giftIndex > i;
    const item = document.createElement('div');
    item.className = 'coupon-item ' + (claimed ? 'claimed' : 'locked');
    item.textContent = claimed ? coupon : `🔒 Cupón #${i + 1} — aún no desbloqueado`;
    list.appendChild(item);
  });

  const secretItem = document.createElement('div');
  secretItem.className = 'coupon-item secret ' + (secretClaimed ? 'claimed' : 'locked');
  secretItem.textContent = secretClaimed ? SECRET_COUPON : '🔒 Cupón secreto — completa todos los demás primero';
  list.appendChild(secretItem);

  const claimedCount = giftIndex + (secretClaimed ? 1 : 0);
  document.getElementById('couponsSubtitle').textContent =
    claimedCount + ' de ' + (LOVE_COUPONS.length + 1) + ' cupones desbloqueados — 1 cupón nuevo cada ' + GIFT_APPLE_EVERY + ' manzanas';

  document.getElementById('couponsOverlay').style.display = 'flex';
}
function closeCoupons() {
  document.getElementById('couponsOverlay').style.display = 'none';
  if (cameFromHome) { cameFromHome = false; goHome(); }
}

// ================= "MI RASTREADOR" (pantalla completa) =================
function openTracker() {
  const wasPlaying = started && !paused && !gameOver;
  if (wasPlaying) togglePause();
  document.getElementById('trackerOverlay').style.display = 'flex';
}
function closeTracker() {
  document.getElementById('trackerOverlay').style.display = 'none';
}

// ================= CONTROLES DE TECLADO =================
document.addEventListener('keydown', e => {
  const key = e.key;
  if ((key === 'ArrowUp' || key === 'w') && direction !== 'DOWN') nextDirection = 'UP';
  else if ((key === 'ArrowDown' || key === 's') && direction !== 'UP') nextDirection = 'DOWN';
  else if ((key === 'ArrowLeft' || key === 'a') && direction !== 'RIGHT') nextDirection = 'LEFT';
  else if ((key === 'ArrowRight' || key === 'd') && direction !== 'LEFT') nextDirection = 'RIGHT';
  else if (key === ' ') togglePause();
});

document.getElementById('btnUp').onclick = () => { if (direction !== 'DOWN') nextDirection = 'UP'; };
document.getElementById('btnDown').onclick = () => { if (direction !== 'UP') nextDirection = 'DOWN'; };
document.getElementById('btnLeft').onclick = () => { if (direction !== 'RIGHT') nextDirection = 'LEFT'; };
document.getElementById('btnRight').onclick = () => { if (direction !== 'LEFT') nextDirection = 'RIGHT'; };
document.getElementById('restartBtn').onclick = init;
document.getElementById('shareBtn').onclick = shareScore;
document.getElementById('musicBtn').onclick = toggleMusic;

// --- Controles táctiles mejorados: respuesta inmediata con touchstart
// y sin dejar que el doble toque haga zoom en el navegador ---
function setupTouchButton(btn, action) {
  const press = (e) => {
    e.preventDefault();
    action();
    btn.classList.add('pressed');
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
  };
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
setupTouchButton(document.getElementById('btnUp'),    () => { if (direction !== 'DOWN')  nextDirection = 'UP'; });
setupTouchButton(document.getElementById('btnDown'),  () => { if (direction !== 'UP')    nextDirection = 'DOWN'; });
setupTouchButton(document.getElementById('btnLeft'),  () => { if (direction !== 'RIGHT') nextDirection = 'LEFT'; });
setupTouchButton(document.getElementById('btnRight'), () => { if (direction !== 'LEFT')  nextDirection = 'RIGHT'; });
setupTouchButton(document.getElementById('pauseBtn'), togglePause);
setupTouchButton(document.getElementById('musicBtn'), toggleMusic);
setupTouchButton(document.getElementById('memoriesBtn'), openMemories);
document.getElementById('memoriesBtn').addEventListener('click', openMemories);
document.getElementById('closeMemoriesBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeMemories(); }, { passive: false });
document.getElementById('closeMemoriesBtn').addEventListener('click', closeMemories);
setupTouchButton(document.getElementById('aboutBtn'), openAbout);
document.getElementById('aboutBtn').addEventListener('click', openAbout);
document.getElementById('closeAboutBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeAbout(); }, { passive: false });
document.getElementById('closeAboutBtn').addEventListener('click', closeAbout);
setupTouchButton(document.getElementById('couponsBtn'), openCoupons);
document.getElementById('couponsBtn').addEventListener('click', openCoupons);
document.getElementById('closeCouponsBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeCoupons(); }, { passive: false });
document.getElementById('closeCouponsBtn').addEventListener('click', closeCoupons);
setupTouchButton(document.getElementById('trackerBtn'), openTracker);
document.getElementById('trackerBtn').addEventListener('click', openTracker);
document.getElementById('closeTrackerBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeTracker(); }, { passive: false });
document.getElementById('closeTrackerBtn').addEventListener('click', closeTracker);
document.getElementById('resumeBtn').addEventListener('touchstart', (e) => { e.preventDefault(); togglePause(); }, { passive: false });
document.getElementById('resumeBtn').addEventListener('click', togglePause);

// --- navegación: botón de volver al inicio (dentro del juego) ---
setupTouchButton(document.getElementById('homeBtn'), goHome);
document.getElementById('homeBtn').addEventListener('click', goHome);

// --- navegación: tarjetas de la pantalla de inicio ---
setupTouchButton(document.getElementById('navSnake'), enterSnake);
document.getElementById('navSnake').addEventListener('click', enterSnake);

setupTouchButton(document.getElementById('navCoupons'), openCouponsFromHome);
document.getElementById('navCoupons').addEventListener('click', openCouponsFromHome);

setupTouchButton(document.getElementById('navMemories'), openMemoriesFromHome);
document.getElementById('navMemories').addEventListener('click', openMemoriesFromHome);

setupTouchButton(document.getElementById('navAbout'), openAboutFromHome);
document.getElementById('navAbout').addEventListener('click', openAboutFromHome);

setupTouchButton(document.getElementById('navTime'), openTime);
document.getElementById('navTime').addEventListener('click', openTime);

setupTouchButton(document.getElementById('navMusic'), toggleMusic);
document.getElementById('navMusic').addEventListener('click', toggleMusic);

document.getElementById('closeTimeBtn').addEventListener('touchstart', (e) => { e.preventDefault(); closeTime(); }, { passive: false });
document.getElementById('closeTimeBtn').addEventListener('click', closeTime);

// bloquea el zoom por doble toque en toda la página
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// bloquea el zoom por pellizco (dos dedos)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// --- control por deslizamiento (swipe) sobre el tablero ---
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const threshold = 20;
  if (Math.max(absX, absY) < threshold) return; // toque muy corto, lo ignoramos

  if (absX > absY) {
    if (dx > 0 && direction !== 'LEFT') nextDirection = 'RIGHT';
    else if (dx < 0 && direction !== 'RIGHT') nextDirection = 'LEFT';
  } else {
    if (dy > 0 && direction !== 'UP') nextDirection = 'DOWN';
    else if (dy < 0 && direction !== 'DOWN') nextDirection = 'UP';
  }
}, { passive: false });

document.getElementById('startBtn').addEventListener('touchstart', (e) => { e.preventDefault(); beginGame(); }, { passive: false });
document.getElementById('startBtn').addEventListener('click', beginGame);
function beginGame() {
  if (started) return;
  started = true;
  document.getElementById('startScreen').style.display = 'none';
  lastResumeTime = Date.now();
  playTimeMs = 0;
  const ac = ensureAudio();
  if (ac.state === 'suspended') ac.resume();
  if (musicOn) startMusic();
  startLoop();

  if (getRelationshipStats().isAnniversaryDay) {
    launchConfetti();
  }
}

// --- decoración ambiental: corazones flotando lentamente en el fondo ---
(function spawnBgFloaters() {
  const layer = document.getElementById('bgFloaters');
  const symbols = ['💗', '💕', '✨', '🌸', '🎀', '🦋'];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (14 + Math.random() * 12) + 's';
    el.style.animationDelay = (Math.random() * -20) + 's';
    el.style.fontSize = (14 + Math.random() * 16) + 'px';
    layer.appendChild(el);
  }
})();

init();
updateRelationshipBadge();
requestAnimationFrame(renderLoop);

// ================= SORPRESA DE PRIMERA VISITA (solo una vez, para siempre) =================
function checkFirstVisit() {
  const shown = AppStorage.getFirstVisitShown();
  if (!shown) {
    document.getElementById('firstVisitOverlay').style.display = 'flex';
  }
}
function dismissFirstVisit() {
  document.getElementById('firstVisitOverlay').style.display = 'none';
  AppStorage.setFirstVisitShown();
}
document.getElementById('firstVisitBtn').addEventListener('touchstart', (e) => { e.preventDefault(); dismissFirstVisit(); }, { passive: false });
document.getElementById('firstVisitBtn').addEventListener('click', dismissFirstVisit);
checkFirstVisit();
