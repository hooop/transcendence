// Gestion du chat en temps réel avec WebSocket
const clients = new Map(); // Map<userId, WebSocket>

async function chatRoutes(fastify, options) {

  // GET /api/chat/conversations - Liste des conversations de l'utilisateur
  fastify.get('/conversations', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Récupérer les derniers messages de chaque conversation
      const result = fastify.db.prepare(
        `WITH latest_messages AS (
          SELECT m.*,
            CASE
              WHEN sender_id = ? THEN recipient_id
              ELSE sender_id
            END as other_user_id,
            ROW_NUMBER() OVER (
              PARTITION BY CASE
                WHEN sender_id = ? THEN recipient_id
                ELSE sender_id
              END
              ORDER BY created_at DESC
            ) as rn
          FROM messages m
          WHERE (sender_id = ? OR recipient_id = ?)
          AND recipient_id IS NOT NULL
        )
        SELECT
          lm.other_user_id as user_id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.is_online,
          lm.content as last_message,
          lm.sender_id as last_message_sender_id,
          lm.created_at as last_message_at,
          (SELECT COUNT(*)
           FROM messages
           WHERE sender_id = lm.other_user_id
           AND recipient_id = ?
           AND is_read = 0) as unread_count
        FROM latest_messages lm
        JOIN users u ON u.id = lm.other_user_id
        WHERE lm.rn = 1
        ORDER BY lm.created_at DESC`
      ).all(userId, userId, userId, userId, userId);

      return {
        conversations: result,
        total: result.length,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des conversations',
      });
    }
  });

  // GET /api/chat/messages/:userId - Historique des messages avec un utilisateur
  fastify.get('/messages/:userId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const currentUserId = request.user.id;
      const { userId } = request.params;
      const { limit = 50, before } = request.query;

      let query = `
        SELECT
          m.id,
          m.sender_id,
          m.recipient_id,
          m.content,
          m.message_type,
          m.is_read,
          m.created_at,
          s.username as sender_username,
          s.display_name as sender_display_name,
          s.avatar_url as sender_avatar
        FROM messages m
        JOIN users s ON s.id = m.sender_id
        WHERE ((m.sender_id = ? AND m.recipient_id = ?)
           OR (m.sender_id = ? AND m.recipient_id = ?))
      `;

      const params = [currentUserId, userId, userId, currentUserId];

      if (before) {
        query += ` AND m.created_at < ?`;
        params.push(before);
      }

      query += ` ORDER BY m.created_at DESC LIMIT ?`;
      params.push(limit);

      const result = fastify.db.prepare(query).all(...params);

      // Marquer les messages comme lus
      fastify.db.prepare(
        `UPDATE messages
         SET is_read = 1
         WHERE sender_id = ?
         AND recipient_id = ?
         AND is_read = 0`
      ).run(userId, currentUserId);

      return {
        messages: result.reverse(), // Ordre chronologique
        total: result.length,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des messages',
      });
    }
  });

  // POST /api/chat/messages - Envoyer un message (fallback HTTP)
  fastify.post('/messages', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const senderId = request.user.id;
      const { recipient_id, content } = request.body;

      if (!recipient_id || !content || content.trim().length === 0) {
        return reply.status(400).send({
          error: 'recipient_id et content requis',
        });
      }

      // Vérifier que le destinataire existe
      const userCheck = fastify.db.prepare(
        'SELECT id FROM users WHERE id = ?'
      ).get(recipient_id);

      if (!userCheck) {
        return reply.status(404).send({
          error: 'Destinataire non trouvé',
        });
      }

      // Insérer le message
      const insertResult = fastify.db.prepare(
        `INSERT INTO messages (sender_id, recipient_id, content)
         VALUES (?, ?, ?)`
      ).run(senderId, recipient_id, content.trim());

      // Récupérer le message créé
      const message = fastify.db.prepare(
        'SELECT id, sender_id, recipient_id, content, message_type, is_read, created_at FROM messages WHERE id = ?'
      ).get(insertResult.lastInsertRowid);

      // Envoyer via WebSocket si le destinataire est connecté
      const recipientWs = clients.get(recipient_id);
      if (recipientWs && recipientWs.readyState === 1) {
        recipientWs.send(JSON.stringify({
          type: 'new_message',
          message: {
            ...message,
            sender_username: request.user.username,
            sender_display_name: request.user.display_name,
            sender_avatar: request.user.avatar_url,
          },
        }));
      }

      return reply.status(201).send({ message });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de l\'envoi du message',
      });
    }
  });

  // WebSocket /api/chat/ws
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const { socket } = connection;

    // Authentification via query params (token)
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');

    if (!token) {
      socket.close(1008, 'Token manquant');
      return;
    }

    let userId;
    try {
      const decoded = fastify.jwt.verify(token);
      userId = decoded.id;
    } catch (err) {
      socket.close(1008, 'Token invalide');
      return;
    }

    // Enregistrer le client
    clients.set(userId, socket);
    fastify.log.info(`Client connecté au chat: ${userId}`);

    // Mettre à jour le statut en ligne
    fastify.db.prepare(
      'UPDATE users SET is_online = 1 WHERE id = ?'
    ).run(userId);

    // Notifier les amis de la connexion
    notifyFriendsOfStatus(fastify, userId, true);

    // Gestion des messages entrants
    socket.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        switch (payload.type) {
          case 'send_message':
            await handleSendMessage(fastify, userId, payload, socket);
            break;

          case 'mark_as_read':
            await handleMarkAsRead(fastify, userId, payload);
            break;

          case 'typing':
            handleTyping(userId, payload);
            break;

          default:
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Type de message inconnu',
            }));
        }
      } catch (error) {
        fastify.log.error(error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Erreur de traitement du message',
        }));
      }
    });

    // Gestion de la déconnexion
    socket.on('close', async () => {
      clients.delete(userId);
      fastify.log.info(`Client déconnecté du chat: ${userId}`);

      // Mettre à jour le statut hors ligne
      fastify.db.prepare(
        'UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(userId);

      // Notifier les amis de la déconnexion
      notifyFriendsOfStatus(fastify, userId, false);
    });

    // Envoyer une confirmation de connexion
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connecté au chat',
    }));
  });
}

// Fonction pour gérer l'envoi de message via WebSocket
async function handleSendMessage(fastify, senderId, payload, senderSocket) {
  const { recipient_id, content } = payload;

  if (!recipient_id || !content || content.trim().length === 0) {
    senderSocket.send(JSON.stringify({
      type: 'error',
      message: 'recipient_id et content requis',
    }));
    return;
  }

  try {
    // Récupérer les infos de l'expéditeur
    const sender = fastify.db.prepare(
      'SELECT username, display_name, avatar_url FROM users WHERE id = ?'
    ).get(senderId);

    if (!sender) {
      senderSocket.send(JSON.stringify({
        type: 'error',
        message: 'Utilisateur non trouvé',
      }));
      return;
    }

// Insérer ET récupérer le message en une seule requête
const message = fastify.db.prepare(
  `INSERT INTO messages (sender_id, recipient_id, content)
   VALUES (?, ?, ?)
   RETURNING *`
).get(senderId, recipient_id, content.trim());

// Préparer le message complet
const fullMessage = {
  ...message,
  sender_username: sender.username,
  sender_display_name: sender.display_name,
  sender_avatar: sender.avatar_url,
};

console.log('=== FULL MESSAGE A ENVOYER ===', JSON.stringify(fullMessage, null, 2));

    // Confirmer à l'expéditeur
    senderSocket.send(JSON.stringify({
      type: 'message_sent',
      message: fullMessage,
    }));

    // Envoyer au destinataire s'il est connecté
    const recipientWs = clients.get(recipient_id);
    if (recipientWs && recipientWs.readyState === 1) {
      recipientWs.send(JSON.stringify({
        type: 'new_message',
        message: fullMessage,
      }));
    }
  } catch (error) {
    fastify.log.error(error);
    senderSocket.send(JSON.stringify({
      type: 'error',
      message: 'Erreur lors de l\'envoi du message',
    }));
  }
}

// Fonction pour marquer les messages comme lus
async function handleMarkAsRead(fastify, userId, payload) {
  const { sender_id } = payload;

  if (!sender_id) return;

  try {
    fastify.db.prepare(
      `UPDATE messages
       SET is_read = 1
       WHERE sender_id = ?
       AND recipient_id = ?
       AND is_read = 0`
    ).run(sender_id, userId);

    // Notifier l'expéditeur que ses messages ont été lus
    const senderWs = clients.get(sender_id);
    if (senderWs && senderWs.readyState === 1) {
      senderWs.send(JSON.stringify({
        type: 'messages_read',
        reader_id: userId,
      }));
    }
  } catch (error) {
    fastify.log.error(error);
  }
}

// Fonction pour gérer l'indicateur "en train d'écrire"
function handleTyping(senderId, payload) {
  const { recipient_id, is_typing } = payload;

  if (!recipient_id) return;

  const recipientWs = clients.get(recipient_id);
  if (recipientWs && recipientWs.readyState === 1) {
    recipientWs.send(JSON.stringify({
      type: 'typing',
      sender_id: senderId,
      is_typing,
    }));
  }
}

// Notifier les amis du changement de statut
async function notifyFriendsOfStatus(fastify, userId, isOnline) {
	console.log(`[notifyFriendsOfStatus] appelée pour userId=${userId}, isOnline=${isOnline}`);
	try {
    // Récupérer la liste des amis
    const friends = fastify.db.prepare(
      `SELECT
        CASE
          WHEN user_id = ? THEN friend_id
          ELSE user_id
        END as friend_id
       FROM friendships
       WHERE (user_id = ? OR friend_id = ?)
       AND status IN ('accepted', 'pending')`
    ).all(userId, userId, userId);

	console.log(`[notifyFriendsOfStatus] Amis trouvés:`, friends);

    // Notifier chaque ami connecté
    for (const row of friends) {
      const friendWs = clients.get(row.friend_id);
	  console.log(`[notifyFriendsOfStatus] Friend ${row.friend_id}, WS connecté:`, !!friendWs);
      if (friendWs && friendWs.readyState === 1) {
        friendWs.send(JSON.stringify({
          type: 'friend_status',
          user_id: userId,
          is_online: isOnline,
        }));
		console.log(`[notifyFriendsOfStatus] Notification envoyée à ${row.friend_id}`);
      }
    }
  } catch (error) {
    fastify.log.error(error);
  }
}


// Notifier les amis du changement de profil
async function notifyFriendsOfProfileUpdate(fastify, userId) {
  console.log(`[notifyFriendsOfProfileUpdate] appelée pour userId=${userId}`);
  try {
    // Récupérer les infos mises à jour de l'utilisateur
    const user = fastify.db.prepare(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = ?'
    ).get(userId);

    if (!user) {
      console.log(`[notifyFriendsOfProfileUpdate] Utilisateur ${userId} non trouvé`);
      return;
    }

    console.log(`[notifyFriendsOfProfileUpdate] Infos utilisateur:`, user);

    // Récupérer la liste des amis (acceptés et pendingg)
    const friends = fastify.db.prepare(
      `SELECT
        CASE
          WHEN user_id = ? THEN friend_id
          ELSE user_id
        END as friend_id
       FROM friendships
       WHERE (user_id = ? OR friend_id = ?)
       AND status IN ('accepted', 'pending')`
    ).all(userId, userId, userId);

    console.log(`[notifyFriendsOfProfileUpdate] Amis trouvés:`, friends);

    // Notifier chaque ami connecté
    for (const row of friends) {
      const friendWs = clients.get(row.friend_id);
      console.log(`[notifyFriendsOfProfileUpdate] Friend ${row.friend_id}, WS connecté:`, !!friendWs);
      if (friendWs && friendWs.readyState === 1) {
        friendWs.send(JSON.stringify({
          type: 'user_profile_updated',
          user: user,
        }));
        console.log(`[notifyFriendsOfProfileUpdate] Notification envoyée à ${row.friend_id}`);
      }
    }
  } catch (error) {
    fastify.log.error(error);
  }
}


module.exports = chatRoutes;
module.exports.clients = clients;
module.exports.notifyFriendsOfProfileUpdate = notifyFriendsOfProfileUpdate;
