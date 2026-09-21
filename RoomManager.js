const Room = require('./Room');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I

class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> Room
  }

  generateCode() {
    let code;
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId, hostName, config) {
    const code = this.generateCode();
    const room = new Room(code, hostId, hostName, config);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase()) || null;
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (room) room.clearTimers();
    this.rooms.delete(code);
  }

  findRoomByPlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) return room;
    }
    return null;
  }
}

module.exports = RoomManager;
