const { DEFAULT_SCORING, DEFAULT_CATEGORIES } = require('./scoring');

const ALPHABET_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** One game room. Holds all state for that room in memory. */
class Room {
  constructor(code, hostId, hostName, config = {}) {
    this.code = code;
    this.hostId = hostId;
    this.createdAt = Date.now();

    // players: Map<playerId, { id, name, score, connected, socketId }>
    this.players = new Map();
    this.addPlayer(hostId, hostName, null);

    this.config = {
      totalRounds: clampInt(config.totalRounds, 10, 3, 15),
      roundTime: clampInt(config.roundTime, 60, 15, 180),
      reviewTime: clampInt(config.reviewTime, 8, 4, 20),
      categories: DEFAULT_CATEGORIES,
      scoring: { ...DEFAULT_SCORING, ...(config.scoring || {}) }
    };

    this.state = 'lobby'; // lobby | playing | roundResult | finished
    this.round = 0;
    this.alphabet = null;
    this.usedLetters = [];
    this.roundEndsAt = null;
    this.nextRoundAt = null;

    // answers: Map<playerId, { [category]: string }>
    this.answers = new Map();
    this.submitted = new Set();

    this.roundTimeoutHandle = null;
    this.nextRoundTimeoutHandle = null;
    this.emptyRoomTimeoutHandle = null;
  }

  addPlayer(id, name, socketId) {
    this.players.set(id, {
      id,
      name: (name || 'Player').slice(0, 20),
      score: 0,
      connected: true,
      socketId
    });
  }

  get playerCount() {
    return this.players.size;
  }

  get connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  publicPlayerList() {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected, isHost: p.id === this.hostId }))
      .sort((a, b) => b.score - a.score);
  }

  pickAlphabet() {
    let pool = ALPHABET_LETTERS.filter((l) => !this.usedLetters.includes(l));
    if (pool.length === 0) {
      pool = ALPHABET_LETTERS;
      this.usedLetters = [];
    }
    const letter = pool[Math.floor(Math.random() * pool.length)];
    this.usedLetters.push(letter);
    return letter;
  }

  clearTimers() {
    if (this.roundTimeoutHandle) clearTimeout(this.roundTimeoutHandle);
    if (this.nextRoundTimeoutHandle) clearTimeout(this.nextRoundTimeoutHandle);
    this.roundTimeoutHandle = null;
    this.nextRoundTimeoutHandle = null;
  }
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

module.exports = Room;
