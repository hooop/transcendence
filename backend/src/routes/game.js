const roomManager = require('../game/RoomManager');

async function gameRoutes(fastify, options) {

  // GET /api/game/rooms - Lister toutes les rooms publiques
  fastify.get('/rooms', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const rooms = roomManager.listPublicRooms();
    return { rooms };
  });

  // POST /api/game/rooms - Créer une nouvelle room
  fastify.post('/rooms', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { roomName, password, maxScore } = request.body;

    if (!roomName || roomName.trim().length === 0) {
      return reply.status(400).send({ error: 'Room name is required' });
    }

    const room = roomManager.createRoom(
      request.user.id,
      request.user.username,
      roomName.trim(),
      password || null,
      maxScore || 5
    );

    return {
      roomId: room.roomId,
      room: room.getPublicInfo()
    };
  });

  // POST /api/game/rooms/:roomId/join - Rejoindre une room
  fastify.post('/rooms/:roomId/join', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { roomId } = request.params;
    const { password } = request.body;

    const result = roomManager.joinRoom(
      roomId,
      request.user.id,
      request.user.username,
      password || null
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return {
      roomId: result.room.roomId,
      room: result.room.getPublicInfo()
    };
  });

  // DELETE /api/game/rooms/:roomId/leave - Quitter une room
  fastify.delete('/rooms/:roomId/leave', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { roomId } = request.params;

    const success = roomManager.leaveRoom(roomId, request.user.id);

    if (!success) {
      return reply.status(404).send({ error: 'Room not found or already left' });
    }

    return { message: 'Left room successfully' };
  });

  // WebSocket pour le jeu en temps réel
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const { socket } = connection;
    let currentRoom = null;
    let currentUser = null;

    socket.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        switch (message.type) {
          case 'AUTH': {
            // Authentifier l'utilisateur via JWT
            try {
              const decoded = fastify.jwt.verify(message.token);
              currentUser = {
                id: decoded.id,
                username: decoded.username
              };
              socket.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: currentUser }));
            } catch (error) {
              socket.send(JSON.stringify({ type: 'AUTH_ERROR', error: 'Invalid token' }));
              socket.close();
            }
            break;
          }

          case 'JOIN_ROOM': {
            if (!currentUser) {
              socket.send(JSON.stringify({ type: 'ERROR', error: 'Not authenticated' }));
              break;
            }

            const room = roomManager.getRoom(message.roomId);
            if (!room) {
              socket.send(JSON.stringify({ type: 'ERROR', error: 'Room not found' }));
              break;
            }

            // Attacher le socket au joueur
            if (room.creator.id === currentUser.id) {
              room.creator.socket = socket;
              currentRoom = room;
            } else if (room.opponent && room.opponent.id === currentUser.id) {
              room.opponent.socket = socket;
              currentRoom = room;
            } else {
              socket.send(JSON.stringify({ type: 'ERROR', error: 'Not a player in this room' }));
              break;
            }

            // Notifier tous les joueurs
            room.broadcast({
              type: 'ROOM_UPDATE',
              room: room.getPublicInfo()
            });

            socket.send(JSON.stringify({
              type: 'JOINED_ROOM',
              roomId: room.roomId,
              playerSide: room.creator.id === currentUser.id ? 'left' : 'right',
              gameConfig: room.config
            }));
            break;
          }

          case 'READY': {
            if (!currentRoom || !currentUser) {
              socket.send(JSON.stringify({ type: 'ERROR', error: 'Not in a room' }));
              break;
            }

            currentRoom.setPlayerReady(currentUser.id, message.ready);

            // Notifier de l'état prêt
            currentRoom.broadcast({
              type: 'PLAYER_READY',
              playerId: currentUser.id,
              ready: message.ready
            });
            break;
          }

          case 'PADDLE_MOVE': {
            if (!currentRoom || !currentUser) break;
            if (currentRoom.status !== 'playing') break;

            currentRoom.updatePaddle(currentUser.id, message.y);
            break;
          }

          case 'LEAVE_ROOM': {
            if (currentRoom && currentUser) {
              roomManager.leaveRoom(currentRoom.roomId, currentUser.id);

              // Notifier l'autre joueur
              currentRoom.broadcast({
                type: 'OPPONENT_LEFT',
                playerId: currentUser.id
              });

              currentRoom = null;
            }
            break;
          }

          default:
            socket.send(JSON.stringify({ type: 'ERROR', error: 'Unknown message type' }));
        }
      } catch (error) {
        fastify.log.error('WebSocket message error:', error);
        socket.send(JSON.stringify({ type: 'ERROR', error: 'Invalid message format' }));
      }
    });

    socket.on('close', () => {
      if (currentRoom && currentUser) {
        roomManager.leaveRoom(currentRoom.roomId, currentUser.id);

        // Notifier l'autre joueur
        if (currentRoom.creator.socket || (currentRoom.opponent && currentRoom.opponent.socket)) {
          currentRoom.broadcast({
            type: 'OPPONENT_LEFT',
            playerId: currentUser.id
          });
        }
      }
    });

    socket.on('error', (error) => {
      fastify.log.error('WebSocket error:', error);
    });
  });

  // POST /api/game/match - Sauvegarder un match terminé
  fastify.post('/match', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { roomId, winnerId, player1Id, player2Id, player1Score, player2Score, duration } = request.body;

    try {
      // Créer le match
      const matchId = fastify.db.prepare(
        `INSERT INTO matches (player1_id, player2_id, player1_score, player2_score, winner_id, status, game_mode, duration_seconds, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, 'completed', 'online', ?, datetime('now'), datetime('now'))`
      ).run(player1Id, player2Id, player1Score, player2Score, winnerId, duration || 0);

      // Mettre à jour les statistiques des joueurs
      const updateStats = (playerId, won, score, opponentScore) => {
        const stats = fastify.db.prepare('SELECT * FROM game_stats WHERE user_id = ?').get(playerId);

        if (stats) {
          fastify.db.prepare(
            `UPDATE game_stats SET
              total_matches = total_matches + 1,
              wins = wins + ?,
              losses = losses + ?,
              total_points_scored = total_points_scored + ?,
              total_points_conceded = total_points_conceded + ?,
              win_streak = CASE WHEN ? = 1 THEN win_streak + 1 ELSE 0 END,
              best_win_streak = MAX(best_win_streak, CASE WHEN ? = 1 THEN win_streak + 1 ELSE win_streak END)
             WHERE user_id = ?`
          ).run(won ? 1 : 0, won ? 0 : 1, score, opponentScore, won ? 1 : 0, won ? 1 : 0, playerId);
        }
      };

      updateStats(player1Id, winnerId === player1Id, player1Score, player2Score);
      updateStats(player2Id, winnerId === player2Id, player2Score, player1Score);

      return { matchId, message: 'Match saved successfully' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to save match' });
    }
  });
}

module.exports = gameRoutes;
