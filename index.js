const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const RoomManager = require('./game/RoomManager');
const { calculateRoundScores } = require('./game/scoring');
const { getExample } = require('./game/wordbank');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.static(PUBLIC_DIR));

const rooms = new RoomManager();

// Map socket.id -> { playerId, roomCode }  (helps us find who disconnected)
const socketIndex = new Map();

io.on('connection', (socket) => {

  // ---------- CREATE ROOM ----------
  socket.on('createRoom', ({ playerId, playerName, config }, cb) => {
    try {
      const room = rooms.createRoom(playerId, playerName, config || {});
      socket.join(room.code);
      socketIndex.set(socket.id, { playerId, roomCode: room.code });
      const player = room.players.get(playerId);
      player.socketId = socket.id;

      cb && cb({ ok: true, roomCode: room.code, config: room.config, players: room.publicPlayerList(), hostId: room.hostId });
    } catch (err) {
      cb && cb({ ok: false, error: 'Could not create room. Please try again.' });
    }
  });

  // ---------- JOIN ROOM ----------
  socket.on('joinRoom', ({ playerId, playerName, roomCode }, cb) => {
    const room = rooms.getRoom(roomCode);
    if (!room) return cb && cb({ ok: false, error: 'Room not found. Check the code and try again.' });

    const existing = room.players.get(playerId);
    if (existing) {
      // Reconnecting player
      existing.connected = true;
      existing.socketId = socket.id;
      if (playerName) existing.name = playerName.slice(0, 20);
    } else {
      if (room.state !== 'lobby') return cb && cb({ ok: false, error: 'This game has already started.' });
      if (room.playerCount >= 5) return cb && cb({ ok: false, error: 'Room is full (max 5 players).' });
      room.addPlayer(playerId, playerName, socket.id);
    }

    socket.join(room.code);
    socketIndex.set(socket.id, { playerId, roomCode: room.code });

    io.to(room.code).emit('playerListUpdate', { players: room.publicPlayerList(), hostId: room.hostId });
    cb && cb({
      ok: true,
      roomCode: room.code,
      config: room.config,
      players: room.publicPlayerList(),
      hostId: room.hostId,
      state: room.state,
      // If joining mid-game (reconnect), send them current round info
      current: room.state === 'playing' ? {
        round: room.round, alphabet: room.alphabet, endsAt: room.roundEndsAt,
        totalRounds: room.config.totalRounds, categories: room.config.categories,
        alreadySubmitted: room.submitted.has(playerId)
      } : null
    });
  });

  // ---------- START GAME ----------
  socket.on('startGame', ({ roomCode, playerId }) => {
    const room = rooms.getRoom(roomCode);
    if (!room) return;
    if (room.hostId !== playerId) return;
    if (room.playerCount < 2) return socket.emit('errorMsg', 'You need at least 2 players to start.');
    if (room.state !== 'lobby') return;

    startRound(room);
  });

  // ---------- SUBMIT ANSWERS ----------
  socket.on('submitAnswers', ({ roomCode, playerId, answers }) => {
    const room = rooms.getRoom(roomCode);
    if (!room || room.state !== 'playing') return;
    if (room.submitted.has(playerId)) return; // no double submits
    if (!room.players.has(playerId)) return;

    const clean = {};
    room.config.categories.forEach((cat) => {
      const val = answers && typeof answers[cat] === 'string' ? answers[cat].slice(0, 40) : '';
      clean[cat] = val;
    });
    room.answers.set(playerId, clean);
    room.submitted.add(playerId);

    io.to(room.code).emit('playerSubmitted', { playerId, submittedCount: room.submitted.size, total: room.connectedPlayers.length });

    const allConnectedSubmitted = room.connectedPlayers.every((p) => room.submitted.has(p.id));
    if (allConnectedSubmitted) {
      endRound(room);
    }
  });

  // ---------- LEAVE ROOM ----------
  socket.on('leaveRoom', ({ roomCode, playerId }) => {
    handleLeave(socket, roomCode, playerId);
  });

  // ---------- DISCONNECT ----------
  socket.on('disconnect', () => {
    const info = socketIndex.get(socket.id);
    socketIndex.delete(socket.id);
    if (!info) return;
    handleLeave(socket, info.roomCode, info.playerId, true);
  });

  function handleLeave(socket, roomCode, playerId, isDisconnect = false) {
    const room = rooms.getRoom(roomCode);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    if (isDisconnect) {
      player.connected = false;
    } else {
      room.players.delete(playerId);
      room.submitted.delete(playerId);
      room.answers.delete(playerId);
    }

    // Reassign host if needed
    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((p) => p.connected);
      room.hostId = nextHost ? nextHost.id : null;
    }

    if (room.playerCount === 0 || room.connectedPlayers.length === 0) {
      // Give the room a grace period before deleting (covers brief refreshes)
      if (room.emptyRoomTimeoutHandle) clearTimeout(room.emptyRoomTimeoutHandle);
      room.emptyRoomTimeoutHandle = setTimeout(() => {
        if (room.connectedPlayers.length === 0) rooms.removeRoom(room.code);
      }, 2 * 60 * 1000);
    } else {
      io.to(room.code).emit('playerListUpdate', { players: room.publicPlayerList(), hostId: room.hostId });
      // If everyone left who hadn't submitted, the round might now be able to end
      if (room.state === 'playing') {
        const allConnectedSubmitted = room.connectedPlayers.every((p) => room.submitted.has(p.id));
        if (allConnectedSubmitted) endRound(room);
      }
    }
  }
});

function startRound(room) {
  room.clearTimers();
  room.round += 1;
  room.state = 'playing';
  room.alphabet = room.pickAlphabet();
  room.answers = new Map();
  room.submitted = new Set();
  room.roundEndsAt = Date.now() + room.config.roundTime * 1000;

  const examples = {};
  room.config.categories.forEach((cat) => { examples[cat] = getExample(cat, room.alphabet); });

  io.to(room.code).emit('roundStart', {
    round: room.round,
    totalRounds: room.config.totalRounds,
    alphabet: room.alphabet,
    endsAt: room.roundEndsAt,
    categories: room.config.categories,
    examples
  });

  room.roundTimeoutHandle = setTimeout(() => endRound(room), room.config.roundTime * 1000 + 300);
}

function endRound(room) {
  if (room.state !== 'playing') return;
  room.clearTimers();
  room.state = 'roundResult';

  const playersAnswers = {};
  room.players.forEach((p, id) => {
    playersAnswers[id] = room.answers.get(id) || {};
  });

  const { results, totals } = calculateRoundScores(playersAnswers, room.alphabet, room.config.categories, room.config.scoring);

  room.players.forEach((p, id) => {
    p.score += totals[id] || 0;
  });

  const perPlayer = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
    roundPoints: totals[p.id] || 0,
    totalScore: p.score,
    answers: results[p.id]
  }));

  const isLastRound = room.round >= room.config.totalRounds;
  room.nextRoundAt = isLastRound ? null : Date.now() + room.config.reviewTime * 1000;

  io.to(room.code).emit('roundResult', {
    round: room.round,
    totalRounds: room.config.totalRounds,
    alphabet: room.alphabet,
    players: perPlayer,
    leaderboard: room.publicPlayerList(),
    isLastRound,
    nextRoundAt: room.nextRoundAt
  });

  if (isLastRound) {
    room.state = 'finished';
    const leaderboard = room.publicPlayerList();
    const topScore = leaderboard.length ? leaderboard[0].score : 0;
    const winners = leaderboard.filter((p) => p.score === topScore);
    io.to(room.code).emit('gameOver', { leaderboard, winners });
  } else {
    room.nextRoundTimeoutHandle = setTimeout(() => startRound(room), room.config.reviewTime * 1000);
  }
}

server.listen(PORT, () => {
  console.log(`Name-Country-City game server running on http://localhost:${PORT}`);
});
