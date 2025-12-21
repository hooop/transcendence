const chatClients = require('./chat').clients;

async function friendshipsRoutes(fastify, options) {

  // GET /api/friendships - Liste de tous les amis de l'utilisateur connecté
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
	console.log('GET friendships - user:', request.user);
    try {
      const userId = request.user.id;

      // Récupérer tous les amis acceptés (dans les deux sens)
      const result = fastify.db.prepare(
      `SELECT
        f.id as friendship_id,
        f.created_at as friends_since,
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.is_online,
        u.last_seen
      FROM friendships f
      JOIN users u ON (
        (f.user_id = ? AND u.id = f.friend_id)
        OR (f.friend_id = ? AND u.id = f.user_id)
      )
      WHERE (f.user_id = ? OR f.friend_id = ?)
      AND f.status = 'accepted'
      ORDER BY u.is_online DESC, u.username ASC`
      ).all(userId, userId, userId, userId);

      return {
        friends: result,
        total: result.length,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération de la liste d\'amis',
      });
    }
  });

  // GET /api/friendships/pending - Demandes d'amis en attente
  fastify.get('/pending', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Récupérer les demandes reçues (en attente)
      const received = fastify.db.prepare(
        `SELECT
          f.id as friendship_id,
          f.created_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.is_online
         FROM friendships f
         JOIN users u ON u.id = f.user_id
         WHERE f.friend_id = ?
         AND f.status = 'pending'
         ORDER BY f.created_at DESC`
      ).all(userId);

      // Récupérer les demandes envoyées (en attente)
      const sent = fastify.db.prepare(
        `SELECT
          f.id as friendship_id,
          f.created_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.is_online
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ?
         AND f.status = 'pending'
         ORDER BY f.created_at DESC`
      ).all(userId);

      return {
        received: received,
        sent: sent,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des demandes d\'amis',
      });
    }
  });

  // GET /api/friendships/blocked - Utilisateurs bloqués
  fastify.get('/blocked', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      const result = fastify.db.prepare(
        `SELECT
          f.id as friendship_id,
          f.created_at as blocked_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ?
         AND f.status = 'blocked'
         ORDER BY f.created_at DESC`
      ).all(userId);

      return {
        blocked: result,
        total: result.length,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des utilisateurs bloqués',
      });
    }
  });

  // POST /api/friendships - Envoyer une demande d'ami
  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { friend_id } = request.body;
    const userId = request.user.id;

    // Validation
    if (!friend_id) {
      return reply.status(400).send({
        error: 'friend_id requis',
      });
    }

    // Vérifier qu'on ne s'ajoute pas soi-même
    if (friend_id === userId) {
      return reply.status(400).send({
        error: 'Vous ne pouvez pas vous ajouter vous-même comme ami',
      });
    }

    try
	{
      // Vérifier que l'utilisateur cible existe
      const userCheck = fastify.db.prepare(
        'SELECT id, username FROM users WHERE id = ?'
      ).get(friend_id);

      if (!userCheck) {
        return reply.status(404).send({
          error: 'Utilisateur non trouvé',
        });
      }

      // Vérifier qu'une relation n'existe pas déjà (dans les deux sens)
      const existingFriendship = fastify.db.prepare(
        `SELECT id, status FROM friendships
         WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)`
      ).get(userId, friend_id, friend_id, userId);

      if (existingFriendship) {
        const status = existingFriendship.status;
        if (status === 'accepted') {
          return reply.status(409).send({
            error: 'Vous êtes déjà amis',
          });
        } else if (status === 'pending') {
          return reply.status(409).send({
            error: 'Une demande d\'ami est déjà en attente',
          });
        } else if (status === 'blocked') {
          return reply.status(403).send({
            error: 'Impossible d\'envoyer une demande d\'ami',
          });
        }
      }

      // Créer la demande d'ami
      const insertResult = fastify.db.prepare(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES (?, ?, 'pending')`
      ).run(userId, friend_id);

		console.log('insertResult:', insertResult);
		console.log('lastInsertRowid:', insertResult.lastInsertRowid);

     // Notifier le destinataire via WebSocket
    const recipientWs = chatClients.get(friend_id);
    if (recipientWs && recipientWs.readyState === 1) {
      recipientWs.send(JSON.stringify({
        type: 'friendship_request_received',
        request: {
          id: Number(insertResult.lastInsertRowid),
          sender: {
            id: request.user.id,
            username: request.user.username,
            display_name: request.user.display_name,
            avatar_url: request.user.avatar_url
          },
          created_at: new Date().toISOString()
        }
      }));
    }

    // Retourner la demande créée
    return reply.status(201).send({
      message: 'Demande d\'ami envoyée',
      friendship: {
        id: Number(insertResult.lastInsertRowid),
        friend: userCheck,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    });

    }
	catch (error)
	{
		fastify.log.error(error);
		return reply.status(500).send({
		error: 'Erreur lors de l\'envoi de la demande d\'ami',
      });
    }
  });

  // PATCH /api/friendships/:id - Accepter/refuser une demande, ou bloquer
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { action } = request.body; // 'accept', 'reject', 'block'
    const userId = request.user.id;

    // Validation
    if (!action || !['accept', 'reject', 'block'].includes(action)) {
      return reply.status(400).send({
        error: 'Action invalide. Utilisez: accept, reject ou block',
      });
    }

    try {
      // Récupérer la demande d'ami
      const friendship = fastify.db.prepare(
        'SELECT * FROM friendships WHERE id = ?'
      ).get(id);

      if (!friendship) {
        return reply.status(404).send({
          error: 'Demande d\'ami non trouvée',
        });
      }

      // Vérifier les permissions selon l'action
      if (action === 'accept') {
        // Seul le destinataire peut accepter
        if (friendship.friend_id !== userId) {
          return reply.status(403).send({
            error: 'Vous ne pouvez accepter que les demandes qui vous sont adressées',
          });
        }

        if (friendship.status !== 'pending') {
          return reply.status(400).send({
            error: 'Cette demande n\'est pas en attente',
          });
        }

        // Accepter la demande
        fastify.db.prepare(
          'UPDATE friendships SET status = ? WHERE id = ?'
        ).run('accepted', id);

        // Récupérer les informations de l'utilisateur qui a accepté
        const accepter = fastify.db.prepare(
          'SELECT id, username, display_name, avatar_url FROM users WHERE id = ?'
        ).get(userId);

        // Notifier l'utilisateur qui a envoyé la demande via WebSocket
        const senderWs = chatClients.get(friendship.user_id);
        if (senderWs && senderWs.readyState === 1) {
          senderWs.send(JSON.stringify({
            type: 'friendship_accepted',
            friendship: {
              id: friendship.id,
              friend: accepter,
              status: 'accepted',
            },
          }));
        }

        return {
          message: 'Demande d\'ami acceptée',
          friendship: {
            id: friendship.id,
            status: 'accepted',
          },
        };

      } else if (action === 'reject') {
        // Seul le destinataire peut refuser
        if (friendship.friend_id !== userId) {
          return reply.status(403).send({
            error: 'Vous ne pouvez refuser que les demandes qui vous sont adressées',
          });
        }

        if (friendship.status !== 'pending') {
          return reply.status(400).send({
            error: 'Cette demande n\'est pas en attente',
          });
        }

        // Supprimer la demande (refus)
        fastify.db.prepare(
          'DELETE FROM friendships WHERE id = ?'
        ).run(id);

        return {
          message: 'Demande d\'ami refusée',
        };

      } else if (action === 'block') {
        // Vérifier que l'utilisateur est impliqué dans cette relation
        if (friendship.user_id !== userId && friendship.friend_id !== userId) {
          return reply.status(403).send({
            error: 'Vous n\'êtes pas autorisé à bloquer cet utilisateur via cette relation',
          });
        }

        // Si la demande vient de l'autre personne, on la supprime et on crée un blocage
        if (friendship.user_id !== userId) {
          fastify.db.prepare('DELETE FROM friendships WHERE id = ?').run(id);

          // Créer une nouvelle entrée de blocage
          fastify.db.prepare(
            `INSERT INTO friendships (user_id, friend_id, status)
             VALUES (?, ?, 'blocked')
             ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'blocked'`
          ).run(userId, friendship.user_id);
        } else {
          // Sinon, on change simplement le statut
          fastify.db.prepare(
            'UPDATE friendships SET status = ? WHERE id = ?'
          ).run('blocked', id);
        }

        return {
          message: 'Utilisateur bloqué',
        };
      }

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la modification de la demande d\'ami',
      });
    }
  });

  // DELETE /api/friendships/:id - Supprimer un ami (retirer de la liste d'amis)
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;

    try {
      // Vérifier que la relation existe et que l'utilisateur en fait partie
      const friendship = fastify.db.prepare(
        `SELECT * FROM friendships
         WHERE id = ?
         AND (user_id = ? OR friend_id = ?)`
      ).get(id, userId, userId);

      if (!friendship) {
        return reply.status(404).send({
          error: 'Relation d\'amitié non trouvée',
        });
      }

      // Supprimer la relation
      fastify.db.prepare(
        'DELETE FROM friendships WHERE id = ?'
      ).run(id);

      // Déterminer qui est l'autre personne
      let otherUserId;
      if (friendship.user_id === userId) {
        otherUserId = friendship.friend_id;
      } else {
        otherUserId = friendship.user_id;
      }

      // Récupérer sa connexion WebSocket
      const otherUserWs = chatClients.get(otherUserId);

      // Si connecté, le notifier
      if (otherUserWs && otherUserWs.readyState === 1) {
        otherUserWs.send(JSON.stringify({
          type: 'friendship_removed',
          friendship_id: id,
          removed_by: userId
        }));
      }

      return {
        message: 'Ami retiré avec succès',
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la suppression de l\'ami',
      });
    }
  });

  // GET /api/friendships/search - Rechercher des utilisateurs à ajouter en ami
  fastify.get('/search', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { query } = request.query;
    const userId = request.user.id;

    if (!query || query.length < 2) {
      return reply.status(400).send({
        error: 'La recherche doit contenir au moins 2 caractères',
      });
    }

    try {
      // Rechercher des utilisateurs par username ou display_name
      // Exclure l'utilisateur connecté et les amis/demandes existantes
      const result = fastify.db.prepare(
        `SELECT
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.is_online
         FROM users u
         WHERE (u.username LIKE ? OR u.display_name LIKE ?)
         AND u.id != ?
         AND u.id NOT IN (
           SELECT friend_id FROM friendships WHERE user_id = ?
           UNION
           SELECT user_id FROM friendships WHERE friend_id = ?
         )
         LIMIT 20`
      ).all(`%${query}%`, `%${query}%`, userId, userId, userId);

      return {
        users: result,
        total: result.length,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la recherche d\'utilisateurs',
      });
    }
  });
}

module.exports = friendshipsRoutes;
