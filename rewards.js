/* =========================================================================
   rewards.js
   Sistema de recompensas: qué mensaje/cupón le toca al jugador cada vez
   que come una manzana especial, qué mensajes ya se mostraron (para no
   repetir), los hitos de puntaje (10/25/50/100) y el desbloqueo de
   mensajes para la galería "Mis Recuerdos".

   El progreso (cupón actual, cupón secreto, hitos, mensajes desbloqueados)
   se guarda a través de AppStorage (ver storage.js), nunca con
   localStorage directamente.
   ========================================================================= */

// --- progreso del cupón de amor actual (se restaura desde AppStorage) ---
let giftIndex = AppStorage.getGiftIndex();
let secretClaimed = AppStorage.getSecretClaimed();

let usedMessagesByType = { heart: [], star: [], gift: [], memory: [], diamond: [], legendary: [] };

function pickSpecialMessage(type) {
  if (type === 'gift') {
    if (giftIndex < LOVE_COUPONS.length) {
      const msg = LOVE_COUPONS[giftIndex];
      giftIndex++;
      AppStorage.setGiftIndex(giftIndex);
      return msg;
    }
    if (!secretClaimed) {
      secretClaimed = true;
      AppStorage.setSecretClaimed();
    }
    return SECRET_COUPON;
  }

  const pool = SPECIAL_POOLS[type];
  let used = usedMessagesByType[type];
  if (used.length >= pool.length) used = usedMessagesByType[type] = [];
  let msg;
  do {
    msg = pool[Math.floor(Math.random() * pool.length)];
  } while (used.includes(msg));
  used.push(msg);
  return msg;
}

let usedMessages = [];

// --- hitos de puntaje ya mostrados (se restauran desde AppStorage) ---
let milestonesShown = AppStorage.getMilestonesShown();

// --- colección de mensajes desbloqueados (galería "Mis Recuerdos") ---
let unlockedMessages = AppStorage.getUnlockedMessages();
function unlockMessage(msg) {
  if (!unlockedMessages.includes(msg)) {
    unlockedMessages.push(msg);
    AppStorage.setUnlockedMessages(unlockedMessages);
  }
}

function showSpecialMessage(type) {
  const msg = pickSpecialMessage(type);
  const isSecret = msg === SECRET_COUPON;
  unlockMessage(msg);
  refreshMemoriesBadge();
  if (type === 'gift') refreshCouponsBadge();

  const toast = document.getElementById('msgToast');
  toast.textContent = msg;
  toast.style.background = isSecret ? 'linear-gradient(135deg, #ffe27a, #ffb84d)' : (SPECIAL_TOAST_BG[type] || SPECIAL_TOAST_BG.heart);
  toast.classList.add('show');
  clearTimeout(showSpecialMessage._t);
  const duration = (type === 'diamond' || type === 'legendary' || isSecret) ? 5200 : 4200;
  showSpecialMessage._t = setTimeout(() => toast.classList.remove('show'), duration);

  if (isSecret) {
    launchConfetti();
    vibrate([20, 30, 20, 30, 20, 30, 20]);
  }
}

// --- insignia breve que anuncia la RAREZA (normal/especial/rara/épica/
// legendaria) apenas se come la manzana. Es independiente del toast de
// arriba: éste muestra el mensaje romántico y dura varios segundos; la
// insignia es solo un destello rápido para que la rareza se "sienta" al
// instante, y no reemplaza ni retrasa al mensaje. No se usa para manzanas
// normales ni para el cupón (que ya tiene su propia identidad visual). ---
function showRarityBadge(rarity) {
  const tier = RARITY_TABLE.find(t => t.key === rarity);
  if (!tier) return;
  const badge = document.getElementById('rarityBadge');
  if (!badge) return;
  badge.textContent = tier.icon + ' ' + tier.label;
  badge.className = 'rarity-' + rarity;
  // classList.add en el siguiente frame para que el navegador registre el
  // cambio de className anterior y sí dispare la transición de "aparecer"
  requestAnimationFrame(() => badge.classList.add('show'));
  clearTimeout(showRarityBadge._t);
  showRarityBadge._t = setTimeout(() => badge.classList.remove('show'), 1100);
}

function checkMilestones() {
  Object.keys(MILESTONE_MESSAGES).forEach(key => {
    const threshold = parseInt(key, 10);
    if (score >= threshold && !milestonesShown.includes(threshold)) {
      milestonesShown.push(threshold);
      AppStorage.setMilestonesShown(milestonesShown);
      const msg = MILESTONE_MESSAGES[threshold];
      unlockMessage('🏅 ' + msg);
      refreshMemoriesBadge();
      showMilestoneBanner(msg);
    }
  });
}

function showMilestoneBanner(msg) {
  const banner = document.getElementById('milestoneBanner');
  banner.textContent = '🏅 ' + msg;
  banner.classList.add('show');
  playSpecialSound();
  vibrate([20, 40, 20, 40]);
  clearTimeout(showMilestoneBanner._t);
  showMilestoneBanner._t = setTimeout(() => banner.classList.remove('show'), 3800);
}
