# Antakshari Ants 🐜 — Name • Country • City • Object • Animal • Surname

A real-time multiplayer word game for 2–5 players, made for Indian players. Every round
a letter is picked, and everyone races to fill in a Name, Country, City, Object, Animal,
and Surname starting with that letter before the timer runs out.

## 1. Project structure

```
namecity-game/
├── package.json              # dependencies + start script
├── server/
│   ├── index.js               # Express + Socket.IO server, all game events
│   └── game/
│       ├── Room.js             # one room's state (players, round, timers)
│       ├── RoomManager.js      # creates/looks up rooms by code
│       ├── scoring.js          # scoring rules (EDIT HERE to change points)
│       └── wordbank.js         # Indian example words shown as input hints
└── public/                    # everything sent to the browser
    ├── index.html               # all screens (home, lobby, game, results...)
    ├── css/style.css            # colours, layout, animations
    └── js/
        ├── main.js                # client game logic + Socket.IO events
        ├── sounds.js              # tiny Web-Audio sound effects
        └── confetti.js            # confetti burst animation
```

No database is required — a room's entire state lives in the server's memory
(a `Map` in `RoomManager.js`) for as long as the process runs. This is enough for
a casual party game. If you want games to survive a server restart, or want to run
more than one server instance, see "Scaling beyond memory" at the bottom.

## 2. How it works (major components)

**Server is authoritative.** The browser never decides the alphabet, the timer, or
the score — it only sends what the player typed and displays what the server tells it.
This is what stops one player's browser from cheating or crashing the game for others.

- **Room.js** — a plain class holding one room: its code, player list, current round
  number, current letter, round-end timestamp, and the scoring/timer configuration.
- **RoomManager.js** — a `Map<code, Room>` with helpers to create a room with a random
  5-character code (`AB3K9`-style, no confusing 0/O/1/I), find a room by code, and find
  which room a given player is in.
- **scoring.js** — pure functions, no server state. `calculateRoundScores(answers, letter,
  categories, scoringConfig)` returns each player's per-category result and round total.
  Because it's a pure function, it's easy to unit-test and easy to change (see §7).
- **index.js** — wires Socket.IO events to the Room/RoomManager/scoring logic:
  `createRoom`, `joinRoom`, `startGame`, `submitAnswers`, `leaveRoom`, `disconnect`.
  It also runs the round loop with `setTimeout` (`startRound` → `endRound` → next
  `startRound`), so the game keeps moving even if some players' browsers lag behind.
- **main.js (client)** — keeps a small `state` object, renders the right screen, and
  starts a local countdown from the `endsAt` timestamp the server sent (rather than
  asking the server for a tick every second) so the timer stays smooth even on a
  patchy mobile connection.

### Real-time flow for one round
1. Server picks a letter, sets `roundEndsAt = now + roundTime`, and emits `roundStart`
   with that letter, round number, categories, and the exact end timestamp to everyone
   in the room.
2. Each client renders 6 input boxes and starts a local countdown from `endsAt`.
3. When a player clicks **Submit**, the client sends `submitAnswers`. The server checks
   they haven't already submitted, stores the answers, and tells everyone (`playerSubmitted`)
   so all screens show a ✅ next to that player's name — this is the "visual indicator."
4. The round ends the moment either (a) every *connected* player has submitted, or
   (b) the server's own timer fires — whichever happens first. Both paths call the
   same `endRound()` function, so scoring only ever runs once.
5. `endRound()` scores every category with `scoring.js`, updates each player's total,
   and emits `roundResult` (per-player answers + points + live leaderboard) to everyone.
6. After a short "review" pause (default 8s, configurable), the server automatically
   starts the next round — or, after round 10, emits `gameOver` with the final leaderboard
   and winner(s) (ties are supported).

### Multiplayer correctness details
- **Same alphabet for everyone**: chosen once on the server and broadcast — never
  chosen client-side.
- **Synchronized timer**: server sends an absolute end time; every client computes its
  own countdown from that, so small network delays don't desync the display.
- **No double submits**: the server keeps a `Set` of who has submitted this round and
  ignores a second `submitAnswers` from the same player.
- **A disconnected player doesn't stall the game**: on `disconnect`, the player is
  marked `connected: false` (not deleted immediately, so a quick refresh can rejoin).
  The "everyone submitted" check only counts *connected* players, so the round can
  still end normally. If the host disconnects, host powers move to the next connected
  player automatically. If everyone leaves, the room is cleaned up after 2 minutes.

## 3. Setup instructions

Requirements: [Node.js](https://nodejs.org) 16 or newer (includes `npm`).

```bash
cd namecity-game
npm install
npm start
```

You should see:
```
Name-Country-City game server running on http://localhost:3000
```

Open `http://localhost:3000` in your browser.

## 4. Local testing with multiple players

**On one computer:** open `http://localhost:3000` in several browser tabs (or one
normal + one incognito window, so they don't share the same `localStorage` player ID).
Create a room in one tab, and join with the room code in the others.

**On your phone, same Wi-Fi:**
1. Find your computer's local IP address (e.g. `192.168.1.5`) — on Mac/Linux run
   `ifconfig` or `ip addr`, on Windows run `ipconfig`.
2. Start the server (`npm start`).
3. On your phone's browser, go to `http://192.168.1.5:3000` and join the room.

## 5. Deployment instructions

This is a normal Node.js + Socket.IO app, so any Node host works. Two easy free-tier options:

**Render.com**
1. Push this project to a GitHub repo.
2. In Render, "New → Web Service", connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Render sets the `PORT` environment variable automatically — the server already
   reads `process.env.PORT`, so no code changes are needed.

**Railway.app**
1. Push to GitHub, then "New Project → Deploy from GitHub repo" in Railway.
2. Railway auto-detects Node and runs `npm start`. Also reads `PORT` automatically.

**Any VPS (e.g. a small DigitalOcean/AWS box)**
```bash
git clone <your-repo>
cd namecity-game
npm install
PORT=3000 npm start          # or use pm2 to keep it running:
npm install -g pm2
pm2 start server/index.js --name namecity-game
```
Put Nginx in front of it for HTTPS if you want a custom domain.

Note: Socket.IO uses WebSockets, so make sure whatever proxy/host you use allows
WebSocket connections (Render, Railway, and Nginx-with-proxy_pass all do this fine).

## 6. Configuration (round timer, number of rounds, scoring)

- **Round timer & number of rounds**: set per-room on the "Create Room" screen (also
  clamped server-side in `Room.js` between 15–180s and 3–15 rounds so nobody can
  break the game with a silly value).
- **Scoring**: edit `DEFAULT_SCORING` at the top of `server/game/scoring.js`:
  ```js
  const DEFAULT_SCORING = {
    unique: 10,   // one player has this exact valid answer
    duplicate: 5, // two or more players share this exact valid answer
    invalid: 0    // empty, or doesn't start with the round's letter
  };
  ```
  You can also pass a custom `scoring` object per room by extending the `config`
  sent in the `createRoom` event from the client.
- **Categories**: `DEFAULT_CATEGORIES` in the same file. Add or remove categories
  there and the game screen, scoring, and results table all pick it up automatically.

## 7. Indian-friendly touches

- Input placeholders show example Indian names, cities (Mumbai, Pune, Nagpur, Nashik,
  Yavatmal, Bengaluru, etc.), and surnames for each letter (`server/game/wordbank.js`)
  — these are hints only, not a restriction, so players can answer with anything.
- All answer matching is case-insensitive and trims stray spaces.
- Simple, plain English throughout the UI; big tap targets and a mobile-first layout
  for Android phones.

## 8. Scaling beyond memory (optional, for later)

Right now everything lives in one Node process's RAM, which is perfectly fine for a
casual game with a handful of concurrent rooms. If you later want multiple server
instances behind a load balancer, swap the in-memory `Map` in `RoomManager.js` for
Redis (`ioredis`) and use the `socket.io-redis` adapter so all instances share room
events. The `Room`/`scoring` logic itself wouldn't need to change.
