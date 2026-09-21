/**
 * sounds.js
 * Tiny Web Audio API sound effects - no audio files needed.
 * Each function plays a short tone/chord for a game event.
 */
const GameSounds = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone(freq, startTime, duration, type = 'sine', gainValue = 0.15) {
    const audio = getCtx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function safe(fn) {
    try { fn(); } catch (e) { /* audio may be blocked before first user gesture */ }
  }

  return {
    click: () => safe(() => { const t = getCtx().currentTime; tone(440, t, 0.08, 'square', 0.08); }),
    submit: () => safe(() => { const t = getCtx().currentTime; tone(660, t, 0.1); tone(880, t + 0.08, 0.15); }),
    tick: () => safe(() => { const t = getCtx().currentTime; tone(300, t, 0.05, 'square', 0.05); }),
    roundEnd: () => safe(() => { const t = getCtx().currentTime; tone(520, t, 0.12); tone(390, t + 0.1, 0.15); }),
    win: () => safe(() => {
      const t = getCtx().currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.14, 0.25, 'triangle', 0.12));
    })
  };
})();
