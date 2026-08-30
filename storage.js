/* =========================================================================
   storage.js
   Capa de almacenamiento/persistencia, aislada del resto de la app.

   Todo el juego guarda y lee sus datos ÚNICAMENTE a través del objeto
   AppStorage definido aquí (nunca llamando a localStorage directamente
   desde otros archivos). Esto es intencional: el día que se quiera migrar
   de localStorage a almacenamiento en la nube, solo hay que reescribir
   las funciones de ESTE archivo — el resto del juego no se entera del
   cambio porque sigue llamando a los mismos métodos (AppStorage.getX /
   AppStorage.setX).

   Las claves de localStorage y el formato de los valores son EXACTAMENTE
   los mismos que usaba la versión anterior (un solo archivo), para no
   perder ningún progreso ya guardado en el navegador de nadie.
   ========================================================================= */

const AppStorage = (function () {
  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  return {
    // --- progreso de cupones de amor ---
    getGiftIndex() {
      const saved = safeGet('snakeRosaGiftIndex');
      return saved !== null ? (parseInt(saved, 10) || 0) : 0;
    },
    setGiftIndex(value) {
      safeSet('snakeRosaGiftIndex', value);
    },

    getSecretClaimed() {
      return safeGet('snakeRosaSecretClaimed') === '1';
    },
    setSecretClaimed() {
      safeSet('snakeRosaSecretClaimed', '1');
    },

    // --- hitos de puntaje ya mostrados ---
    getMilestonesShown() {
      const saved = safeGet('snakeRosaMilestones');
      if (!saved) return [];
      try { return JSON.parse(saved); } catch (e) { return []; }
    },
    setMilestonesShown(arr) {
      safeSet('snakeRosaMilestones', JSON.stringify(arr));
    },

    // --- mensajes desbloqueados (galería "Mis Recuerdos") ---
    getUnlockedMessages() {
      const saved = safeGet('snakeRosaUnlocked');
      if (!saved) return [];
      try { return JSON.parse(saved); } catch (e) { return []; }
    },
    setUnlockedMessages(arr) {
      safeSet('snakeRosaUnlocked', JSON.stringify(arr));
    },

    // --- récord de puntaje ---
    getHighScore() {
      const saved = safeGet('snakeRosaHighScore');
      return saved !== null ? (parseInt(saved, 10) || 0) : 0;
    },
    setHighScore(value) {
      safeSet('snakeRosaHighScore', value);
    },

    // --- mensaje de bienvenida de primera visita ---
    getFirstVisitShown() {
      return safeGet('snakeRosaFirstVisitShown') === '1';
    },
    setFirstVisitShown() {
      safeSet('snakeRosaFirstVisitShown', '1');
    },
  };
})();
