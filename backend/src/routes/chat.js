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
      const result = await fastify.pg.query(
        `WITH latest_messages AS (
          SELECT DISTINCT ON (
            CASE
              WHEN sender_id = $1 THEN recipient_id
              ELSE sender_id
            END
          )
          m.*,
          CASE
            WHEN sender_id = $1 THEN recipient_id
            ELSE sender_id
          END as other_user_id
          FROM messages m
          WHERE (sender_id = $1 OR recipient_id = $1)
          AND recipient_id IS NOT NULL
          ORDER BY
            CASE
              WHEN sender_id = $1 THEN recipient_id
              ELSE sender_id
            END,
            created_at DESC
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
           AND recipient_id = $1
           AND is_read = false) as unread_count
        FROM latest_messages lm
        JOIN users u ON u.id = lm.other_user_id
        ORDER BY lm.created_at DESC`,
        [userId]
      );

      return {
        conversations: result.rows,
        total: result.rows.length,
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
        WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
           OR (m.sender_id = $2 AND m.recipient_id = $1))
      `;

      const params = [currentUserId, userId];

      if (before) {
        query += ` AND m.created_at < $3`;
        params.push(before);
      }

      query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await fastify.pg.query(query, params);

      // Marquer les messages comme lus
      await fastify.pg.query(
        `UPDATE messages
         SET is_read = true
         WHERE sender_id = $1
         AND recipient_id = $2
         AND is_read = false`,
        [userId, currentUserId]
      );

      return {
        messages: result.rows.reverse(), // Ordre chronologique
        total: result.rows.length,
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
      const userCheck = await fastify.pg.query(
        'SELECT id FROM users WHERE id = $1',
        [recipient_id]
      );

      if (userCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Destinataire non trouvé',
        });
      }

      // Insérer le message
      const result = await fastify.pg.query(
        `INSERT INTO messages (sender_id, recipient_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, recipient_id, content, message_type, is_read, created_at`,
        [senderId, recipient_id, content.trim()]
      );

      const message = result.rows[0];

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
    fastify.pg.query(
      'UPDATE users SET is_online = true WHERE id = $1',
      [userId]
    ).catch(err => fastify.log.error(err));

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
      await fastify.pg.query(
        'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      ).catch(err => fastify.log.error(err));

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
    const senderResult = await fastify.pg.query(
      'SELECT username, display_name, avatar_url FROM users WHERE id = $1',
      [senderId]
    );

    if (senderResult.rows.length === 0) {
      senderSocket.send(JSON.stringify({
        type: 'error',
        message: 'Utilisateur non trouvé',
      }));
      return;
    }

    const sender = senderResult.rows[0];

    // Insérer le message dans la DB
    const result = await fastify.pg.query(
      `INSERT INTO messages (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, content, message_type, is_read, created_at`,
      [senderId, recipient_id, content.trim()]
    );

    const message = result.rows[0];

    // Préparer le message complet
    const fullMessage = {
      ...message,
      sender_username: sender.username,
      sender_display_name: sender.display_name,
      sender_avatar: sender.avatar_url,
    };

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
    await fastify.pg.query(
      `UPDATE messages
       SET is_read = true
       WHERE sender_id = $1
       AND recipient_id = $2
       AND is_read = false`,
      [sender_id, userId]
    );

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
  try {
    // Récupérer la liste des amis
    const friendsResult = await fastify.pg.query(
      `SELECT
        CASE
          WHEN user_id = $1 THEN friend_id
          ELSE user_id
        END as friend_id
       FROM friendships
       WHERE (user_id = $1 OR friend_id = $1)
       AND status = 'accepted'`,
      [userId]
    );

    // Notifier chaque ami connecté
    for (const row of friendsResult.rows) {
      const friendWs = clients.get(row.friend_id);
      if (friendWs && friendWs.readyState === 1) {
        friendWs.send(JSON.stringify({
          type: 'friend_status',
          user_id: userId,
          is_online: isOnline,
        }));
      }
    }
  } catch (error) {
    fastify.log.error(error);
  }
}

module.exports = chatRoutes;
