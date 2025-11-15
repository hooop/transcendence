const GameRoom = require('./GameRoom');
const crypto = require('crypto');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> GameRoom
  }

  // Créer une nouvelle room
  createRoom(creatorId, creatorUsername, roomName, password = null, maxScore = 5) {
    const roomId = crypto.randomBytes(8).toString('hex');
    const room = new GameRoom(roomId, creatorId, creatorUsername, roomName, password, maxScore);
    this.rooms.set(roomId, room);
    return room;
  }

  // Obtenir une room
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Supprimer une room
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.cleanup();
      this.rooms.delete(roomId);
      return true;
    }
    return false;
  }

  // Lister toutes les rooms publiques
  listPublicRooms() {
    const publicRooms = [];
    for (const room of this.rooms.values()) {
      if (room.status !== 'finished') {
        publicRooms.push(room.getPublicInfo());
      }
    }
    return publicRooms;
  }

  // Rejoindre une room
  joinRoom(roomId, playerId, username, password = null) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.status === 'finished') {
      return { success: false, error: 'Game is finished' };
    }

    if (room.status === 'playing') {
      return { success: false, error: 'Game already in progress' };
    }

    if (room.opponent) {
      return { success: false, error: 'Room is full' };
    }

    if (!room.verifyPassword(password)) {
      return { success: false, error: 'Invalid password' };
    }

    const added = room.addPlayer(playerId, username, null);
    if (!added) {
      return { success: false, error: 'Failed to join room' };
    }

    return { success: true, room };
  }

  // Quitter une room
  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Si c'est le créateur qui part, supprimer la room
    if (room.creator.id === playerId) {
      this.deleteRoom(roomId);
      return true;
    }

    // Sinon, retirer l'adversaire
    const removed = room.removePlayer(playerId);
    return removed;
  }

  // Nettoyer les rooms vides ou finies depuis longtemps
  cleanup() {
    const now = Date.now();
    const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    for (const [roomId, room] of this.rooms.entries()) {
      // Supprimer les rooms finies depuis plus de 5 minutes
      if (room.status === 'finished' && now - room.createdAt > 5 * 60 * 1000) {
        this.deleteRoom(roomId);
        continue;
      }

      // Supprimer les rooms en attente depuis plus de 30 minutes
      if (room.status === 'waiting' && !room.opponent && now - room.createdAt > ROOM_TIMEOUT) {
        this.deleteRoom(roomId);
      }
    }
  }
}

// Singleton
const roomManager = new RoomManager();

// Cleanup périodique toutes les 5 minutes
setInterval(() => {
  roomManager.cleanup();
}, 5 * 60 * 1000);

module.exports = roomManager;
