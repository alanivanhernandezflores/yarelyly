/* =========================================================================
   snake-game.js
   Motor del juego Snake: tablero/canvas, estado de la serpiente, dibujo
   (serpiente, manzanas normales y especiales, tablero), partículas,
   bucle de juego (tick + render interpolado), fin de partida, compartir
   puntaje y confeti.

   Se mantiene como un solo archivo (en vez de dividirlo más) porque todas
   estas partes comparten el mismo estado del juego (canvas, ctx, snake,
   apple, score, particles, etc.) y separarlas más habría aumentado el
   riesgo de romper algo, sin una ganancia real de organización.
   ========================================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const box = 20;
const cols = canvas.width / box;
const rows = canvas.height / box;

const SNAKE_COLOR = '#ff6fb5';       // rosa
const SNAKE_HEAD_COLOR = '#ff3d9a';  // rosa más fuerte para la cabeza
const APPLE_COLOR = '#d9b3ff';       // morado bajito

const START_SPEED = 180;   // ms por movimiento al inicio (más alto = más lento)
const MIN_SPEED = 80;      // velocidad máxima (no baja de aquí)
const SPEED_STEP = 4;      // cuánto acelera por cada manzana comida
// NOTA: HEART_APPLE_EVERY y DIAMOND_APPLE_EVERY ya NO se usan para decidir
// cuándo aparece una manzana especial — ese sistema de "cada X manzanas" fue
// reemplazado por probabilidades reales (ver RARITY_TABLE en content-data.js
// y pickRarity() más abajo). Se dejan aquí sin borrar por si en el futuro
// se necesitan de referencia; no afectan el comportamiento actual del juego.
const HEART_APPLE_EVERY = 5;
const DIAMOND_APPLE_EVERY = 25;
const GIFT_APPLE_EVERY = 20; // este SÍ sigue en uso: ritmo fijo del cupón de amor


// --- récord de puntaje (se restaura desde AppStorage) ---
let snake, direction, nextDirection, apple, score, gameOver, loopId, speed;
let highScore = AppStorage.getHighScore();
let applesEaten = 0;
let specialEaten = 0;
let started = false;
let paused = false;

// --- estado para el movimiento interpolado (fluido) ---
let prevPts = [];
let currPts = [];
let lastTickTime = 0;

// --- partículas ---
let particles = [];

// --- tiempo de juego (excluyendo pausas) ---
let playTimeMs = 0;
let lastResumeTime = 0;

// ================= PARTÍCULAS =================
// Cantidad/paleta/tamaño de partículas según la rareza de la manzana comida.
// 'normal' y 'gift' conservan EXACTAMENTE los mismos valores que tenía el
// sistema anterior (8 y 16 partículas respectivamente); special/rare/epic/
// legendary son nuevos, cada vez más intensos, para que la rareza se sienta
// progresivamente más especial sin llegar a saturar la pantalla.
const PARTICLE_TIERS = {
  normal:    { n: 8,  palette: ['#ffb6d9', '#ffd6ec', '#ffffff'],                         sizeMax: 2.2 },
  gift:      { n: 16, palette: ['#ff8ecb', '#e0c3fc', '#fff0f6', '#ffd6ec'],               sizeMax: 3.2 },
  special:   { n: 12, palette: ['#ff8ecb', '#e0c3fc', '#fff0f6', '#ffd6ec'],               sizeMax: 3.0 },
  rare:      { n: 18, palette: ['#c9a3f0', '#a875e0', '#fff0f6', '#e0c3fc'],               sizeMax: 3.4 },
  epic:      { n: 24, palette: ['#a8e8ff', '#7fd4f5', '#e8fbff', '#ffffff'],               sizeMax: 3.8 },
  legendary: { n: 32, palette: ['#ffe27a', '#ffb84d', '#ff6fb5', '#c9a3f0', '#ffffff'],     sizeMax: 4.4 },
};
function spawnParticles(x, y, rarity) {
  const tier = PARTICLE_TIERS[rarity] || PARTICLE_TIERS.normal;
  const { n, palette, sizeMax } = tier;
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 0.6 + Math.random() * 1.8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      size: 1.5 + Math.random() * sizeMax,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawApple(cx, cy) {
  const r = 6.5;
  ctx.save();

  // sombra suave debajo de la manzana
  ctx.fillStyle = 'rgba(180,100,150,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r*1.15, r*0.7, r*0.22, 0, 0, Math.PI*2);
  ctx.fill();

  // cuerpo de la manzana (dos lóbulos con hendidura arriba)
  const grad = ctx.createRadialGradient(cx - r*0.4, cy - r*0.3, r*0.2, cx, cy, r*1.5);
  grad.addColorStop(0, '#f3e0ff');
  grad.addColorStop(0.55, APPLE_COLOR);
  grad.addColorStop(1, '#b98ce0');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r*0.55);
  ctx.bezierCurveTo(cx - r*0.4, cy - r*1.15, cx - r*1.35, cy - r*0.5, cx - r*1.05, cy + r*0.25);
  ctx.bezierCurveTo(cx - r*0.85, cy + r*1.25, cx - r*0.2, cy + r*1.35, cx, cy + r*0.95);
  ctx.bezierCurveTo(cx + r*0.2, cy + r*1.35, cx + r*0.85, cy + r*1.25, cx + r*1.05, cy + r*0.25);
  ctx.bezierCurveTo(cx + r*1.35, cy - r*0.5, cx + r*0.4, cy - r*1.15, cx, cy - r*0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,20,100,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // línea central sutil (gajo)
  ctx.strokeStyle = 'rgba(70,20,100,0.2)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r*0.4);
  ctx.quadraticCurveTo(cx - r*0.1, cy + r*0.3, cx, cy + r*0.9);
  ctx.stroke();

  // textura de pequeñas pecas/poros para dar realismo a la piel
  ctx.fillStyle = 'rgba(90,20,110,0.18)';
  const freckles = [
    [-0.55, 0.15], [-0.2, 0.55], [0.35, -0.15], [0.5, 0.4],
    [0.05, 0.75], [-0.65, -0.35], [0.65, -0.45]
  ];
  freckles.forEach(([fx, fy]) => {
    ctx.beginPath();
    ctx.arc(cx + fx*r, cy + fy*r, 0.55, 0, Math.PI*2);
    ctx.fill();
  });

  // brillo principal
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - r*0.45, cy - r*0.05, r*0.22, r*0.38, -0.4, 0, Math.PI*2);
  ctx.fill();

  // brillo secundario, más pequeño
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx - r*0.15, cy - r*0.35, r*0.1, r*0.16, -0.3, 0, Math.PI*2);
  ctx.fill();

  // tallo
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r*0.55);
  ctx.quadraticCurveTo(cx + r*0.25, cy - r*0.9, cx + r*0.18, cy - r*1.25);
  ctx.stroke();

  // hoja
  ctx.fillStyle = '#8fd694';
  ctx.beginPath();
  ctx.ellipse(cx + r*0.55, cy - r*1.05, r*0.32, r*0.16, -0.6, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,90,40,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

function drawHeartApple(cx, cy) {
  const r = 7;
  ctx.save();

  const pulse = 1 + Math.sin(Date.now() / 200) * 0.06;
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  // brillo exterior
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2);
  glow.addColorStop(0, 'rgba(255,111,181,0.5)');
  glow.addColorStop(1, 'rgba(255,111,181,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, 1, 0, 0, r*1.4);
  grad.addColorStop(0, '#ffd6ec');
  grad.addColorStop(1, '#ff5fa8');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r*1.3, -r*0.3, -r*0.5, -r*1.3, 0, -r*0.4);
  ctx.bezierCurveTo(r*0.5, -r*1.3, r*1.3, -r*0.3, 0, r*0.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,20,90,0.4)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-r*0.35, -r*0.35, r*0.18, r*0.28, -0.5, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawStarApple(cx, cy) {
  const r = 7.5;
  ctx.save();
  const pulse = 1 + Math.sin(Date.now() / 180) * 0.08;
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.1);
  glow.addColorStop(0, 'rgba(255,210,90,0.55)');
  glow.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(-r*0.2, -r*0.2, 1, 0, 0, r*1.3);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(1, '#ffb84d');
  ctx.fillStyle = grad;

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI/2 + i * (Math.PI*2/5);
    const innerAngle = outerAngle + Math.PI/5;
    const ox = Math.cos(outerAngle) * r, oy = Math.sin(outerAngle) * r;
    const ix = Math.cos(innerAngle) * r * 0.45, iy = Math.sin(innerAngle) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,90,10,0.35)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-r*0.15, -r*0.15, r*0.18, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawGiftApple(cx, cy) {
  const s = 8; // medio-ancho de la caja
  ctx.save();
  ctx.translate(cx, cy);
  const bob = Math.sin(Date.now() / 220) * 1;
  ctx.translate(0, bob);

  // sombra
  ctx.fillStyle = 'rgba(150,90,190,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, s*0.95, s*0.75, s*0.22, 0, 0, Math.PI*2);
  ctx.fill();

  // caja
  const grad = ctx.createLinearGradient(-s, -s*0.6, s, s*0.9);
  grad.addColorStop(0, '#e0c3fc');
  grad.addColorStop(1, '#b57dfa');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-s*0.75, -s*0.55, s*1.5, s*1.35, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,30,140,0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // listón vertical y horizontal
  ctx.fillStyle = '#fff0f6';
  ctx.fillRect(-s*0.14, -s*0.55, s*0.28, s*1.35);
  ctx.fillRect(-s*0.75, -s*0.05, s*1.5, s*0.28);

  // moño arriba
  ctx.fillStyle = '#ff8ecb';
  ctx.beginPath();
  ctx.moveTo(0, -s*0.55);
  ctx.bezierCurveTo(-s*0.55, -s*1.15, -s*0.6, -s*0.35, 0, -s*0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s*0.55);
  ctx.bezierCurveTo(s*0.55, -s*1.15, s*0.6, -s*0.35, 0, -s*0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(0, -s*0.5, s*0.16, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawMemoryApple(cx, cy) {
  const s = 8;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);

  // sombra tipo polaroid
  ctx.fillStyle = 'rgba(150,90,190,0.22)';
  ctx.fillRect(-s*0.72+1, -s*0.85+2, s*1.44, s*1.7);

  // marco polaroid crema
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(-s*0.72, -s*0.85, s*1.44, s*1.7);
  ctx.strokeStyle = 'rgba(180,140,90,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-s*0.72, -s*0.85, s*1.44, s*1.7);

  // "foto" interior con degradado cielo-corazon
  const grad = ctx.createLinearGradient(0, -s*0.65, 0, s*0.45);
  grad.addColorStop(0, '#ffd9ec');
  grad.addColorStop(1, '#e0c3fc');
  ctx.fillStyle = grad;
  ctx.fillRect(-s*0.6, -s*0.65, s*1.2, s*1.05);

  // corazoncito dentro de la foto
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-s*0.12, -s*0.1, s*0.16, 0, Math.PI*2);
  ctx.arc(s*0.12, -s*0.1, s*0.16, 0, Math.PI*2);
  ctx.moveTo(-s*0.28, -s*0.06);
  ctx.lineTo(0, s*0.22);
  ctx.lineTo(s*0.28, -s*0.06);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDiamondApple(cx, cy) {
  const r = 8.5;
  ctx.save();
  const pulse = 1 + Math.sin(Date.now() / 150) * 0.1;
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
  glow.addColorStop(0, 'rgba(140,220,255,0.6)');
  glow.addColorStop(1, 'rgba(140,220,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#e8fbff');
  grad.addColorStop(0.5, '#a8e8ff');
  grad.addColorStop(1, '#7fbfe0');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r*0.65, -r*0.15);
  ctx.lineTo(r*0.4, r*0.9);
  ctx.lineTo(-r*0.4, r*0.9);
  ctx.lineTo(-r*0.65, -r*0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,90,120,0.4)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // facetas internas
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(0, r*0.9);
  ctx.moveTo(-r*0.65, -r*0.15); ctx.lineTo(r*0.65, -r*0.15);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-r*0.2, -r*0.35, r*0.16, r*0.28, -0.4, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawLegendaryApple(cx, cy) {
  const r = 9;
  ctx.save();
  const pulse = 1 + Math.sin(Date.now() / 130) * 0.12;
  const spin = (Date.now() / 900) % (Math.PI * 2);
  ctx.translate(cx, cy);

  // brillo exterior grande, el más intenso de todas las manzanas
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.8);
  glow.addColorStop(0, 'rgba(255,180,90,0.6)');
  glow.addColorStop(0.5, 'rgba(255,111,181,0.3)');
  glow.addColorStop(1, 'rgba(255,111,181,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  // anillo de destellos girando lentamente alrededor
  ctx.save();
  ctx.rotate(spin);
  ctx.fillStyle = 'rgba(255,230,150,0.9)';
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    const sx = Math.cos(a) * r * 2, sy = Math.sin(a) * r * 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -2.6); ctx.lineTo(0.7, 0); ctx.lineTo(0, 2.6); ctx.lineTo(-0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.scale(pulse, pulse);

  // cuerpo: estrella dorada de 6 puntas (corona estilizada)
  const grad = ctx.createRadialGradient(-r*0.2, -r*0.2, 1, 0, 0, r*1.4);
  grad.addColorStop(0, '#fff6d9');
  grad.addColorStop(0.5, '#ffd76a');
  grad.addColorStop(1, '#ff9f4d');
  ctx.fillStyle = grad;

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const outerAngle = -Math.PI/2 + i * (Math.PI*2/6);
    const innerAngle = outerAngle + Math.PI/6;
    const ox = Math.cos(outerAngle) * r, oy = Math.sin(outerAngle) * r;
    const ix = Math.cos(innerAngle) * r * 0.5, iy = Math.sin(innerAngle) * r * 0.5;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,60,10,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // gema rosa en el centro (guiño al resto de la paleta romántica del juego)
  ctx.fillStyle = '#ff6fb5';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,20,90,0.5)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // brillo
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-r*0.25, -r*0.35, r*0.16, r*0.26, -0.4, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawBoard() {
  // fondo base pastel con leve degradado
  const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 40, canvas.width/2, canvas.height/2, canvas.width*0.75);
  bgGrad.addColorStop(0, '#fff8fb');
  bgGrad.addColorStop(1, '#fbe8f2');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // cuadrícula sutil tipo tablero
  ctx.strokeStyle = 'rgba(214,120,170,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * box + 0.5, 0);
    ctx.lineTo(x * box + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * box + 0.5);
    ctx.lineTo(canvas.width, y * box + 0.5);
    ctx.stroke();
  }

  // casillas en patrón de tablero de ajedrez muy sutil
  ctx.fillStyle = 'rgba(214,120,170,0.035)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * box, y * box, box, box);
      }
    }
  }

  // viñeta suave en los bordes
  const vignette = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width*0.35, canvas.width/2, canvas.height/2, canvas.width*0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(214,120,170,0.18)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw(pts) {
  drawBoard();

  // manzana (normal o uno de los 5 tipos especiales)
  const ax = apple.x * box + box/2, ay = apple.y * box + box/2;
  if (apple.special) {
    if (apple.specialType === 'star') drawStarApple(ax, ay);
    else if (apple.specialType === 'gift') drawGiftApple(ax, ay);
    else if (apple.specialType === 'memory') drawMemoryApple(ax, ay);
    else if (apple.specialType === 'diamond') drawDiamondApple(ax, ay);
    else if (apple.specialType === 'legendary') drawLegendaryApple(ax, ay);
    else drawHeartApple(ax, ay);
  } else {
    drawApple(ax, ay);
  }

  if (pts.length > 1) {
    // sombra proyectada del cuerpo (da sensación de profundidad sobre el tablero)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(214,120,170,0.3)';
    ctx.lineWidth = box - 5;
    ctx.filter = 'blur(2px)';
    ctx.translate(1.5, 3);
    tracePath(pts);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const bodyGrad = ctx.createLinearGradient(pts[pts.length-1].x, pts[pts.length-1].y, pts[0].x, pts[0].y);
    bodyGrad.addColorStop(0, '#ffb8de');
    bodyGrad.addColorStop(0.5, '#ff7fc0');
    bodyGrad.addColorStop(1, SNAKE_HEAD_COLOR);

    // contorno (borde oscuro sutil para dar volumen)
    ctx.strokeStyle = 'rgba(150,20,90,0.4)';
    ctx.lineWidth = box - 3;
    tracePath(pts);
    ctx.stroke();

    // cuerpo principal
    ctx.strokeStyle = bodyGrad;
    ctx.lineWidth = box - 6;
    tracePath(pts);
    ctx.stroke();

    // sombreado ventral (línea inferior más oscura, simula panza)
    ctx.strokeStyle = 'rgba(120,10,70,0.22)';
    ctx.lineWidth = box - 10;
    tracePath(pts);
    ctx.stroke();

    // brillo superior a lo largo del cuerpo
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.2;
    tracePath(pts);
    ctx.stroke();
    ctx.restore();

    // --- textura de escamas tipo diamante, alternadas ---
    for (let i = 1; i < pts.length; i += 1) {
      const p = pts[i];
      const prev = pts[i-1] || p;
      const dx = p.x - prev.x, dy = p.y - prev.y;
      const angle = Math.atan2(dy, dx) + Math.PI/2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(120,10,70,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, box/2 - 4, 0.25*Math.PI, 0.75*Math.PI);
      ctx.stroke();

      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(0, -1, box/6, box/10, 0, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- cabeza con ojos y lengua ---
  const head = pts[0];
  let dx = 1, dy = 0;
  if (direction === 'RIGHT') { dx = 1; dy = 0; }
  if (direction === 'LEFT')  { dx = -1; dy = 0; }
  if (direction === 'UP')    { dx = 0; dy = -1; }
  if (direction === 'DOWN')  { dx = 0; dy = 1; }
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);

  // lengua (detrás de la cabeza para que se vea saliendo de la punta)
  const flick = Math.sin(Date.now() / 90) * 2;
  ctx.strokeStyle = '#ff2255';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(box/2 - 3, 0);
  ctx.lineTo(box/2 + 5, 0);
  ctx.moveTo(box/2 + 5, 0);
  ctx.lineTo(box/2 + 8, -2.5 + flick*0.3);
  ctx.moveTo(box/2 + 5, 0);
  ctx.lineTo(box/2 + 8, 2.5 - flick*0.3);
  ctx.stroke();

  // cabeza (círculo con degradado, encima de la lengua)
  const headGrad = ctx.createRadialGradient(-2, -3, 1, 0, 0, box/1.6);
  headGrad.addColorStop(0, '#ffc2e6');
  headGrad.addColorStop(1, SNAKE_HEAD_COLOR);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, box/2 - 1, box/2.3 - 1, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,20,90,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ojos
  ctx.fillStyle = '#1a1a2e';
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.arc(box*0.1, side*box*0.22, 2, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.arc(box*0.1 + 0.6, side*box*0.22 - 0.6, 0.6, 0, Math.PI*2);
    ctx.fill();
  });

  // moñito decorativo en la parte de atrás de la cabeza
  ctx.save();
  ctx.translate(-box*0.12, -box*0.32);
  ctx.rotate(-0.15);
  const bowGrad = ctx.createLinearGradient(-4, 0, 4, 0);
  bowGrad.addColorStop(0, '#e0c3fc');
  bowGrad.addColorStop(1, '#c9a3f0');
  ctx.fillStyle = bowGrad;
  // lóbulo izquierdo
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-4.5, -3.5, -4.5, 3.5, 0, 0);
  ctx.closePath();
  ctx.fill();
  // lóbulo derecho
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(4.5, -3.5, 4.5, 3.5, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,90,190,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // nudo central
  ctx.fillStyle = '#f5e6ff';
  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // --- partículas encima de todo ---
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}


function pixelPts(arr) {
  return arr.map(s => ({x: s.x * box + box/2, y: s.y * box + box/2}));
}

function randomApple() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));

  const nextCount = applesEaten + 1;

  if (nextCount % GIFT_APPLE_EVERY === 0) {
    // el cupón de amor mantiene su propio ritmo fijo y predecible: es un
    // mecanismo narrativo aparte, no una rareza del sistema RARITY_TABLE
    pos.special = true;
    pos.specialType = 'gift';
    pos.rarity = 'gift';
    return pos;
  }

  const rarity = pickRarity();
  if (rarity === 'normal') {
    pos.special = false;
    pos.rarity = 'normal';
  } else {
    pos.special = true;
    pos.rarity = rarity;
    pos.specialType = pickFlavorForRarity(rarity);
  }
  return pos;
}

// --- selección real por probabilidad, usando RARITY_TABLE (content-data.js) ---
// RARITY_TABLE va de la más rara a la más común, así que basta con ir
// acumulando el porcentaje de cada tramo hasta que el número aleatorio caiga
// dentro de uno de ellos. Como las probabilidades suman 100, siempre habrá
// un tramo que lo cubra.
function pickRarity() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const tier of RARITY_TABLE) {
    acc += tier.chance;
    if (roll < acc) return tier.key;
  }
  return 'normal'; // red de seguridad ante cualquier error de redondeo
}

// --- "sabor"/mensaje que le toca a cada rareza (solo decide qué pool de
// mensajes y qué dibujo usar; la recompensa en puntos la decide RARITY_BONUS,
// no el sabor) ---
function pickFlavorForRarity(rarity) {
  if (rarity === 'special') {
    const flavors = ['heart', 'memory'];
    return flavors[Math.floor(Math.random() * flavors.length)];
  }
  if (rarity === 'rare') return 'star';
  if (rarity === 'epic') return 'diamond';
  if (rarity === 'legendary') return 'legendary';
  return 'heart';
}

function scheduleTick() {
  if (loopId) clearTimeout(loopId);
  loopId = setTimeout(() => {
    tick();
    if (!gameOver && !paused) scheduleTick();
  }, speed);
}
function startLoop() {
  if (loopId) clearTimeout(loopId);
  lastTickTime = performance.now();
  scheduleTick();
}

function init() {
  snake = [{x: 8, y: 10}, {x: 7, y: 10}, {x: 6, y: 10}];
  direction = 'RIGHT';
  nextDirection = 'RIGHT';
  score = 0;
  applesEaten = 0;
  specialEaten = 0;
  gameOver = false;
  paused = false;
  speed = START_SPEED;
  apple = randomApple();
  prevPts = pixelPts(snake);
  currPts = pixelPts(snake);
  lastTickTime = performance.now();
  particles = [];
  playTimeMs = 0;
  lastResumeTime = Date.now();

  document.getElementById('currentScore').textContent = '🍎 0';
  document.getElementById('highScore').textContent = '🏆 ' + highScore;
  document.getElementById('msg').innerHTML = '';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('shareBtn').style.display = 'none';
  document.getElementById('pauseOverlay').style.display = 'none';
  document.getElementById('pauseBtn').textContent = '⏸';
  refreshMemoriesBadge();
  refreshCouponsBadge();

  if (started) startLoop();
}

function tick() {
  if (gameOver || paused) return;
  direction = nextDirection;

  const head = {...snake[0]};
  if (direction === 'UP') head.y--;
  if (direction === 'DOWN') head.y++;
  if (direction === 'LEFT') head.x--;
  if (direction === 'RIGHT') head.x++;

  // colisión con pared
  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
    return endGame();
  }
  // colisión consigo misma
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return endGame();
  }

  prevPts = pixelPts(snake); // posiciones antes de mover, para interpolar

  snake.unshift(head);

  if (head.x === apple.x && head.y === apple.y) {
    score++;
    applesEaten++;
    document.getElementById('currentScore').textContent = '🍎 ' + score;
    spawnParticles(apple.x * box + box/2, apple.y * box + box/2, apple.rarity);
    vibrate(25);

    if (apple.special) {
      const type = apple.specialType;   // "sabor": qué mensaje/dibujo le toca
      const rarity = apple.rarity;      // "rareza": gift | special | rare | epic | legendary
      const bonus = rarity === 'gift' ? (SPECIAL_BONUS['gift'] || 1) : (RARITY_BONUS[rarity] || 1);
      score += bonus;
      specialEaten++;
      document.getElementById('currentScore').textContent = '🍎 ' + score;
      showSpecialMessage(type);
      if (rarity !== 'gift') showRarityBadge(rarity);
      playSpecialSound();
      if (rarity === 'epic' || rarity === 'legendary') {
        launchConfetti();
        vibrate(rarity === 'legendary' ? [25, 40, 25, 40, 25, 40, 25] : [20, 30, 20, 30, 20]);
      }
    } else {
      playEatSound();
    }

    apple = randomApple();
    if (speed > MIN_SPEED) {
      speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
    }
    checkMilestones();
  } else {
    snake.pop();
  }

  currPts = pixelPts(snake);
  // si la serpiente creció, duplicamos el último punto anterior para que los índices coincidan
  while (prevPts.length < currPts.length) {
    prevPts.push(prevPts[prevPts.length - 1]);
  }
  lastTickTime = performance.now();
}

// --- bucle de renderizado fluido (interpola entre el tick anterior y el actual) ---
function renderLoop() {
  const now = performance.now();
  let t = speed > 0 ? (now - lastTickTime) / speed : 1;
  if (t > 1) t = 1;
  if (t < 0) t = 0;
  if (gameOver || paused) t = 1;

  const interp = currPts.map((p, i) => {
    const pp = prevPts[i] || p;
    return { x: pp.x + (p.x - pp.x) * t, y: pp.y + (p.y - pp.y) * t };
  });

  draw(interp);
  updateParticles();
  requestAnimationFrame(renderLoop);
}

function tracePath(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i+1].x) / 2;
    const yc = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  if (pts.length > 1) {
    ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return (m > 0 ? m + 'm ' : '') + s + 's';
}

function endGame() {
  gameOver = true;
  if (loopId) clearTimeout(loopId);
  stopMusic();
  playGameOverSound();
  vibrate([40, 30, 40]);

  const totalMs = playTimeMs + (Date.now() - lastResumeTime);
  const elapsedSec = Math.max(0, Math.round(totalMs / 1000));

  let newRecord = false;
  if (score > highScore) {
    highScore = score;
    AppStorage.setHighScore(highScore);
    newRecord = true;
    launchConfetti();
  }
  document.getElementById('highScore').textContent = '🏆 ' + highScore;

  const title = newRecord ? '¡Nuevo récord! 🎉' : '¡Juego terminado!';
  document.getElementById('msg').innerHTML =
    title + '<br>Puntos: ' + score + ' · Tiempo: ' + formatTime(elapsedSec) + ' · Especiales 💗: ' + specialEaten;

  document.getElementById('restartBtn').style.display = 'inline-block';
  document.getElementById('shareBtn').style.display = 'inline-block';
}

function shareScore() {
  const text = `¡Anoté ${score} puntos en mi Snake Rosa 🎀💗! Mi récord es ${highScore}.`;
  if (navigator.share) {
    navigator.share({ title: 'Snake Rosa 🎀', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('shareBtn');
      const original = btn.textContent;
      btn.textContent = '¡Copiado! 💕';
      setTimeout(() => { btn.textContent = original; }, 1800);
    }).catch(() => {});
  }
}

function launchConfetti() {
  const layer = document.getElementById('confettiLayer');
  const emojis = ['💗','💕','💖','🌸','✨'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-heart';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (2 + Math.random() * 2) + 's';
    el.style.fontSize = (16 + Math.random() * 14) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
}
