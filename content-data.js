/* =========================================================================
   content-data.js
   Contenido "de texto" del juego: mensajes, cupones, recuerdos, hitos y la
   fecha de inicio de la relación.
   Este archivo NO contiene lógica, solo datos. Para agregar/editar mensajes
   o cupones en el futuro, este es el único archivo que hace falta tocar.
   ========================================================================= */

const SWEET_MESSAGES = [
  "Eres lo mejor que me ha pasado 💗",
  "Contigo hasta el Game Over se siente bonito 🥹",
  "Yarely, me haces sonreír sin esfuerzo 😊",
  "Cada día quiero conocerte más 💕",
  "Gracias por ser tú 🌸",
  "Eres mi persona favorita 💖",
  "Contigo todo es más fácil 🤍",
  "Te amo muchísimo, Yarely 🐍💗",
  "Esta serpiente tiene menos vueltas que lo que te quiero dar",
  "Después de 2 años y medio, sigues siendo mi manzana favorita 🍎💗",
  "Contigo hasta lo cotidiano se siente especial 💗",
  "Sigues siendo mi persona favorita para todo, incluso para nada 😌💕",
  "2 años y medio y sigo eligiéndote cada día, Yarely 🤍",
  "Me encanta que sigamos construyendo cosas juntos 🌸",
  "Contigo he aprendido lo que es un amor tranquilo y bonito 💖",
  "Eres mi lugar seguro, Yarely 🏡💗",
  "Cada etapa contigo ha valido totalmente la pena 💕",
  "Sigo enamorándome de ti en las cosas pequeñas del día a día 🥹💗",
  "Gracias por quedarte, por elegirnos, por seguir aquí 🤍",
  "Contigo el tiempo pasa rápido pero se siente para siempre 💫💗",
];

const STAR_MESSAGES = [
  "⭐ +3 puntos extra, como el extra de cariño que siempre te tengo",
  "⭐ Brillas más que esta estrella, Yarely",
  "⭐ Puntos bonus, porque tú también eres un bonus en mi vida",
  "⭐ Esta estrella me recordó a ti: rara y especial",
];

const LOVE_COUPONS = [
  "🎁 Cupón: 1 abrazo de oso, cuando tú quieras 🧸🤗",
  "🎁 Cupón: Un masaje, cuando tú quieras 💆‍♀️",
  "🎁 Cupón: 10 besos donde tú elijas 😘",
  "🎁 Cupón: Comer lo que tú quieras, donde tú quieras 🍔🍕",
  "🎁 Cupón: Reina por un día 👑",
  "🎁 Cupón: Un beso de 30 segundos ⏱️💋",
  "🎁 Cupón: Un helado 🍦",
];
const SECRET_COUPON = "🎁 Cupón secreto: Una vida juntos, para siempre 💗";

const MEMORY_PROMPTS = [
  "📸 Cada recuerdo contigo se siente como mi favorito",
  "📸 Ojalá pudiera guardar cada momento contigo en un frasco",
  "📸 Contigo hasta los días normales se vuelven recuerdos bonitos",
  "📸 Si pudiera repetir un día contigo, elegiría cualquiera, sin pensarlo",
  "📸 Estamos escribiendo una historia bonita, Yarely, y quiero seguir escribiéndola",
];

const DIAMOND_MESSAGES = [
  "💎 Esto es tan raro y especial como lo que siento por ti",
  "💎 Como un diamante, lo nuestro también está hecho para durar",
  "💎 De todo lo bueno que me ha pasado, tú eres lo más valioso",
];

const LEGENDARY_MESSAGES = [
  "👑 Esto es tan raro de encontrar... como alguien tan especial como tú",
  "👑 De todas las cosas buenas que me han pasado, tú sigues siendo la más rara y valiosa",
  "👑 Esto casi no pasa nunca... como lo que siento por ti, que no se repite con nadie más",
];

// --- sistema de manzanas especiales por tipo ---
const SPECIAL_TYPES = ['heart', 'star', 'gift', 'memory', 'diamond', 'legendary'];
const SPECIAL_POOLS = {
  heart: SWEET_MESSAGES,
  star: STAR_MESSAGES,
  gift: LOVE_COUPONS,
  memory: MEMORY_PROMPTS,
  diamond: DIAMOND_MESSAGES,
  legendary: LEGENDARY_MESSAGES,
};
const SPECIAL_BONUS = { heart: 1, star: 2, gift: 1, memory: 1, diamond: 4 };
const SPECIAL_TOAST_BG = {
  heart: 'linear-gradient(135deg, #ffb8db, #ff9ecf)',
  star: 'linear-gradient(135deg, #ffe27a, #ffb84d)',
  gift: 'linear-gradient(135deg, #c9a3f0, #a875e0)',
  memory: 'linear-gradient(135deg, #ffd9a8, #f5c37a)',
  diamond: 'linear-gradient(135deg, #a8e8ff, #7fd4f5)',
  legendary: 'linear-gradient(135deg, #ffe27a 0%, #ff6fb5 55%, #c9a3f0 100%)',
};

// --- sistema de rarezas de las manzanas (probabilidad real, no por turnos fijos) ---
// El orden importa para pickRarity() en snake-game.js: de la más rara a la más
// común, así el "roll" aleatorio cae primero en los tramos de probabilidad más
// pequeños. Las probabilidades deben sumar exactamente 100.
// El cupón (tipo "gift") NO forma parte de esta tabla: sigue apareciendo con
// su propio ritmo fijo (cada GIFT_APPLE_EVERY manzanas), tal como ya
// funcionaba, porque es un mecanismo narrativo aparte, no una rareza.
const RARITY_TABLE = [
  { key: 'legendary', label: 'LEGENDARIA', icon: '👑', chance: 0.5 },
  { key: 'epic',      label: 'ÉPICA',      icon: '💎', chance: 2.5 },
  { key: 'rare',      label: 'RARA',       icon: '💜', chance: 5 },
  { key: 'special',   label: 'ESPECIAL',   icon: '🩷', chance: 12 },
  { key: 'normal',    label: 'NORMAL',     icon: '🍎', chance: 80 },
];
// puntos extra según la rareza (independiente del "sabor"/mensaje que le toque)
const RARITY_BONUS = { special: 1, rare: 3, epic: 4, legendary: 8 };

// --- mensajes especiales por logros de puntaje ---
const MILESTONE_MESSAGES = {
  10: "¡10 puntos! Apenas estás calentando, como mi cariño por ti 💗",
  25: "25 puntos... igual de imparable que lo que siento por ti 💕",
  50: "50 puntos 🎉 Ya te mereces algo más que una manzana, te mereces todo",
  100: "¡100 PUNTOS! Eres una campeona, tal como lo eres en mi vida 👑💗",
};

// --- fecha de inicio de la relación ---
const RELATIONSHIP_START = new Date(2023, 11, 24); // 24 de diciembre de 2023
