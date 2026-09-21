/**
 * main.js — client-side game logic.
 * Talks to the server over Socket.IO and switches between "screens" (divs).
 */
(() => {
  const socket = io();

  // ---------- Persistent player identity (so a refresh can rejoin) ----------
  function getPlayerId() {
    let id = localStorage.getItem('ncg_playerId');
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('ncg_playerId', id);
    }
    return id;
  }

  const state = {
    playerId: getPlayerId(),
    playerName: '',
    roomCode: null,
    isHost: false,
    categories: [],
    totalRounds: 10,
    round: 0,
    alphabet: '',
    endsAt: null,
    submitted: false,
    players: [],
    timerHandle: null,
    lastTickSecond: null
  };

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back));
  });

  // ---------- HOME ----------
  $('btn-goto-create').addEventListener('click', () => {
    if (!requireName()) return;
    showScreen('screen-create');
  });
  $('btn-goto-join').addEventListener('click', () => {
    if (!requireName()) return;
    showScreen('screen-join');
  });
  function requireName() {
    const name = $('input-name').value.trim();
    if (!name) { toast('Please enter your name first 🙂'); return false; }
    state.playerName = name;
    return true;
  }

  // ---------- CREATE ROOM ----------
  $('btn-create-room').addEventListener('click', () => {
    GameSounds.click();
    const roundTime = parseInt($('input-round-time').value, 10) || 60;
    const totalRounds = parseInt($('input-total-rounds').value, 10) || 10;
    socket.emit('createRoom', {
      playerId: state.playerId,
      playerName: state.playerName,
      config: { roundTime, totalRounds }
    }, (res) => {
      if (!res.ok) return toast(res.error || 'Could not create room');
      enterLobby(res);
    });
  });

  // ---------- JOIN ROOM ----------
  $('btn-join-room').addEventListener('click', () => {
    GameSounds.click();
    const code = $('input-room-code').value.trim().toUpperCase();
    if (!code) return toast('Enter a room code');
    socket.emit('joinRoom', {
      playerId: state.playerId,
      playerName: state.playerName,
      roomCode: code
    }, (res) => {
      if (!res.ok) return toast(res.error || 'Could not join room');
      enterLobby(res);
      if (res.state === 'playing' && res.current) {
        // Rejoining a game already in progress
        onRoundStart(res.current, true);
      }
    });
  });

  function enterLobby(res) {
    state.roomCode = res.roomCode;
    state.isHost = res.hostId === state.playerId;
    state.totalRounds = res.config.totalRounds;
    $('lobby-room-code').textContent = res.roomCode;
    $('lobby-config-summary').innerHTML =
      `<span>⏱ ${res.config.roundTime}s / round</span><span>🔁 ${res.config.totalRounds} rounds</span><span>👥 up to 5 players</span>`;
    renderPlayerList(res.players, res.hostId);
    $('btn-start-game').classList.toggle('hidden', !state.isHost);
    $('lobby-hint').textContent = state.isHost
      ? 'You are the host. Start when everyone has joined (min 2 players).'
      : 'Waiting for the host to start the game…';
    showScreen('screen-lobby');
  }

  function renderPlayerList(players, hostId) {
    state.players = players;
    $('lobby-player-list').innerHTML = players.map((p) => `
      <li>
        <span><span class="${p.connected ? 'dot-online' : 'dot-offline'}"></span>${escapeHtml(p.name)} ${p.id === hostId ? '<span class="tag-host">HOST</span>' : ''}</span>
        <span>${p.connected ? '' : '(left)'}</span>
      </li>`).join('');
    if (state.isHost) {
      $('btn-start-game').disabled = players.filter(p => p.connected).length < 2;
    }
  }

  socket.on('playerListUpdate', ({ players, hostId }) => {
    state.isHost = hostId === state.playerId;
    renderPlayerList(players, hostId);
    $('btn-start-game').classList.toggle('hidden', !state.isHost);
  });

  $('btn-start-game').addEventListener('click', () => {
    GameSounds.click();
    socket.emit('startGame', { roomCode: state.roomCode, playerId: state.playerId });
  });

  $('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard?.writeText(state.roomCode).then(() => toast('Room code copied!'));
  });

  $('btn-leave-lobby').addEventListener('click', () => {
    socket.emit('leaveRoom', { roomCode: state.roomCode, playerId: state.playerId });
    state.roomCode = null;
    showScreen('screen-home');
  });

  // ---------- GAME ROUND ----------
  socket.on('roundStart', (payload) => onRoundStart(payload, false));

  function onRoundStart(payload, isRejoin) {
    state.round = payload.round;
    state.totalRounds = payload.totalRounds;
    state.alphabet = payload.alphabet;
    state.endsAt = payload.endsAt;
    state.categories = payload.categories;
    state.submitted = !!payload.alreadySubmitted;

    $('game-round-num').textContent = state.round;
    $('game-round-total').textContent = state.totalRounds;
    $('game-letter').textContent = state.alphabet;
    // restart the pop-in animation
    const letterEl = $('game-letter');
    letterEl.style.animation = 'none'; void letterEl.offsetWidth; letterEl.style.animation = '';

    buildAnswerForm(payload.examples || {});
    renderSubmissionChips();
    $('submitted-note').classList.toggle('hidden', !state.submitted);
    $('btn-submit-answers').classList.toggle('hidden', state.submitted);
    if (!isRejoin) GameSounds.tick();

    showScreen('screen-game');
    startTimer();
  }

  function buildAnswerForm(examples) {
    const form = $('answers-form');
    form.innerHTML = state.categories.map((cat, i) => `
      <label class="field" id="field-${i}">
        <span>${cat} (starts with "${state.alphabet}")</span>
        <input type="text" data-category="${cat}" placeholder="${examples[cat] ? 'e.g. ' + examples[cat] : ''}" autocomplete="off" ${state.submitted ? 'disabled' : ''} />
      </label>
    `).join('');
  }

  function renderSubmissionChips() {
    $('submission-status').innerHTML = state.players
      .filter(p => p.connected)
      .map(p => `<span class="chip" data-pid="${p.id}">${escapeHtml(p.name)}</span>`).join('');
  }

  socket.on('playerSubmitted', ({ playerId }) => {
    const chip = document.querySelector(`.chip[data-pid="${playerId}"]`);
    if (chip) chip.classList.add('done');
  });

  function startTimer() {
    clearInterval(state.timerHandle);
    state.lastTickSecond = null;
    const totalMs = state.endsAt - Date.now();
    const totalSeconds = Math.max(1, Math.round(totalMs / 1000));

    function tick() {
      const remainingMs = Math.max(0, state.endsAt - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      $('timer-seconds').textContent = remainingSec;
      const pct = Math.max(0, Math.min(100, (remainingMs / (totalSeconds * 1000)) * 100));
      $('timer-ring-fg').setAttribute('stroke-dasharray', `${pct} 100`);
      const ring = $('timer-ring-fg');
      ring.style.stroke = remainingSec <= 10 ? '#FF3D7F' : '#FFB100';

      if (remainingSec <= 5 && remainingSec !== state.lastTickSecond && remainingSec > 0) {
        GameSounds.tick();
      }
      state.lastTickSecond = remainingSec;

      if (remainingMs <= 0) {
        clearInterval(state.timerHandle);
        lockAnswerForm();
      }
    }
    tick();
    state.timerHandle = setInterval(tick, 200);
  }

  function lockAnswerForm() {
    document.querySelectorAll('#answers-form input').forEach((inp) => (inp.disabled = true));
    $('btn-submit-answers').disabled = true;
    if (!state.submitted) $('submitted-note').textContent = "Time's up! Waiting for results…";
    $('submitted-note').classList.remove('hidden');
  }

  $('btn-submit-answers').addEventListener('click', () => {
    if (state.submitted) return;
    const answers = {};
    document.querySelectorAll('#answers-form input').forEach((inp) => {
      answers[inp.dataset.category] = inp.value;
    });
    state.submitted = true;
    document.querySelectorAll('#answers-form input').forEach((inp) => (inp.disabled = true));
    $('btn-submit-answers').classList.add('hidden');
    $('submitted-note').textContent = 'Nice! Waiting for other players to finish… 🐜';
    $('submitted-note').classList.remove('hidden');
    GameSounds.submit();
    socket.emit('submitAnswers', { roomCode: state.roomCode, playerId: state.playerId, answers });
  });

  // ---------- ROUND RESULT ----------
  socket.on('roundResult', (payload) => {
    clearInterval(state.timerHandle);
    GameSounds.roundEnd();
    $('result-round-num').textContent = payload.round;
    $('result-letter').textContent = payload.alphabet;
    state.players = payload.leaderboard;

    const cats = state.categories;
    const rows = payload.players
      .slice()
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((p) => {
        const cells = cats.map((cat) => {
          const a = p.answers[cat];
          const cls = a.valid ? 'valid' : 'invalid';
          const text = a.answer ? escapeHtml(a.answer) : '—';
          return `<td class="${cls}">${text} <small>(${a.points}pt)</small></td>`;
        }).join('');
        return `<tr>
          <td class="leaderboard-row-name">${escapeHtml(p.name)}${p.connected ? '' : ' (left)'}</td>
          ${cells}
          <td class="points">+${p.roundPoints}</td>
          <td class="points">${p.totalScore}</td>
        </tr>`;
      }).join('');

    $('result-table-wrap').innerHTML = `
      <table class="result-table">
        <thead><tr>
          <th>Player</th>${cats.map(c => `<th>${c}</th>`).join('')}<th>Round</th><th>Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    showScreen('screen-round-result');

    if (payload.isLastRound) {
      $('next-round-hint').textContent = 'Calculating final results…';
    } else {
      startNextRoundCountdown(payload.nextRoundAt);
    }
  });

  function startNextRoundCountdown(nextRoundAt) {
    clearInterval(state.timerHandle);
    function tick() {
      const remaining = Math.max(0, Math.ceil((nextRoundAt - Date.now()) / 1000));
      $('next-round-countdown').textContent = remaining;
      if (remaining <= 0) clearInterval(state.timerHandle);
    }
    tick();
    state.timerHandle = setInterval(tick, 250);
  }

  // ---------- GAME OVER ----------
  socket.on('gameOver', ({ leaderboard, winners }) => {
    const winnerIds = new Set(winners.map((w) => w.id));
    const iAmWinner = winnerIds.has(state.playerId);

    $('final-winner-text').textContent = winners.length > 1
      ? `It's a tie between ${winners.map(w => w.name).join(' & ')}! 🎉`
      : `${winners[0].name} wins the game! 🎉`;

    $('final-leaderboard').innerHTML = leaderboard.map((p, i) => `
      <li class="${winnerIds.has(p.id) ? 'winner' : ''}">
        <span><span class="rank">#${i + 1}</span>${escapeHtml(p.name)}${p.id === state.playerId ? ' (you)' : ''}</span>
        <strong>${p.score} pts</strong>
      </li>`).join('');

    showScreen('screen-final');
    GameSounds.win();
    launchConfetti(iAmWinner ? 140 : 70);
  });

  $('btn-play-again').addEventListener('click', () => {
    socket.emit('leaveRoom', { roomCode: state.roomCode, playerId: state.playerId });
    showScreen('screen-create');
  });
  $('btn-back-home').addEventListener('click', () => {
    socket.emit('leaveRoom', { roomCode: state.roomCode, playerId: state.playerId });
    showScreen('screen-home');
  });

  socket.on('errorMsg', (msg) => toast(msg));
  socket.on('connect_error', () => toast('Connection problem. Retrying…'));

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
