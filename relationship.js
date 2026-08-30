/* =========================================================================
   relationship.js
   Lógica del contador de tiempo juntos (años/meses/días) y del texto
   especial que aparece el día del mesiversario (día 24 de cada mes).
   Usa RELATIONSHIP_START definido en content-data.js.
   ========================================================================= */

function getRelationshipStats() {
  const now = new Date();
  let years = now.getFullYear() - RELATIONSHIP_START.getFullYear();
  let months = now.getMonth() - RELATIONSHIP_START.getMonth();
  let days = now.getDate() - RELATIONSHIP_START.getDate();
  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const totalDays = Math.max(0, Math.floor((now - RELATIONSHIP_START) / (1000 * 60 * 60 * 24)));
  const totalMonths = years * 12 + months;
  return { years, months, days, totalDays, totalMonths, isAnniversaryDay: now.getDate() === 24 };
}

function updateRelationshipBadge() {
  const badge = document.getElementById('relationshipBadge');
  if (!badge) return;
  const stats = getRelationshipStats();

  let text = '💕 ';
  const parts = [];
  if (stats.years > 0) parts.push(stats.years + (stats.years === 1 ? ' año' : ' años'));
  if (stats.months > 0) parts.push(stats.months + (stats.months === 1 ? ' mes' : ' meses'));
  if (parts.length === 0) parts.push(stats.totalDays + (stats.totalDays === 1 ? ' día' : ' días'));
  text += parts.join(' y ') + ' juntos';

  if (stats.isAnniversaryDay) {
    text = `🎉 ¡Hoy cumplimos ${stats.totalMonths} meses! 💗`;
    badge.classList.add('anniversary');
  } else {
    badge.classList.remove('anniversary');
  }
  badge.textContent = text;
}
