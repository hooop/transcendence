async function friendshipsRoutes(fastify, options) {

  // GET /api/friendships - Liste de tous les amis de l'utilisateur connecté
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Récupérer tous les amis acceptés (dans les deux sens)
      const result = await fastify.pg.query(
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
           CASE
             WHEN f.user_id = $1 THEN u.id = f.friend_id
             WHEN f.friend_id = $1 THEN u.id = f.user_id
           END
         )
         WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status = 'accepted'
         ORDER BY u.is_online DESC, u.username ASC`,
        [userId]
      );

      return {
        friends: result.rows,
        total: result.rows.length,
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
      const received = await fastify.pg.query(
        `SELECT
          f.id as friendship_id,
          f.created_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = f.user_id
         WHERE f.friend_id = $1
         AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );

      // Récupérer les demandes envoyées (en attente)
      const sent = await fastify.pg.query(
        `SELECT
          f.id as friendship_id,
          f.created_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1
         AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );

      return {
        received: received.rows,
        sent: sent.rows,
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

      const result = await fastify.pg.query(
        `SELECT
          f.id as friendship_id,
          f.created_at as blocked_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1
         AND f.status = 'blocked'
         ORDER BY f.created_at DESC`,
        [userId]
      );

      return {
        blocked: result.rows,
        total: result.rows.length,
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

    try {
      // Vérifier que l'utilisateur cible existe
      const userCheck = await fastify.pg.query(
        'SELECT id, username FROM users WHERE id = $1',
        [friend_id]
      );

      if (userCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Utilisateur non trouvé',
        });
      }

      // Vérifier qu'une relation n'existe pas déjà (dans les deux sens)
      const existingFriendship = await fastify.pg.query(
        `SELECT id, status FROM friendships
         WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)`,
        [userId, friend_id]
      );

      if (existingFriendship.rows.length > 0) {
        const status = existingFriendship.rows[0].status;
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
      const result = await fastify.pg.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, user_id, friend_id, status, created_at`,
        [userId, friend_id]
      );

      const friendship = result.rows[0];

      return reply.status(201).send({
        message: 'Demande d\'ami envoyée',
        friendship: {
          id: friendship.id,
          friend: userCheck.rows[0],
          status: friendship.status,
          created_at: friendship.created_at,
        },
      });

    } catch (error) {
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
      const friendshipResult = await fastify.pg.query(
        'SELECT * FROM friendships WHERE id = $1',
        [id]
      );

      if (friendshipResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Demande d\'ami non trouvée',
        });
      }

      const friendship = friendshipResult.rows[0];

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
        await fastify.pg.query(
          'UPDATE friendships SET status = $1 WHERE id = $2',
          ['accepted', id]
        );

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
        await fastify.pg.query(
          'DELETE FROM friendships WHERE id = $1',
          [id]
        );

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
          await fastify.pg.query('DELETE FROM friendships WHERE id = $1', [id]);

          // Créer une nouvelle entrée de blocage
          await fastify.pg.query(
            `INSERT INTO friendships (user_id, friend_id, status)
             VALUES ($1, $2, 'blocked')
             ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'blocked'`,
            [userId, friendship.user_id]
          );
        } else {
          // Sinon, on change simplement le statut
          await fastify.pg.query(
            'UPDATE friendships SET status = $1 WHERE id = $2',
            ['blocked', id]
          );
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
      const friendshipResult = await fastify.pg.query(
        `SELECT * FROM friendships
         WHERE id = $1
         AND (user_id = $2 OR friend_id = $2)`,
        [id, userId]
      );

      if (friendshipResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Relation d\'amitié non trouvée',
        });
      }

      // Supprimer la relation
      await fastify.pg.query(
        'DELETE FROM friendships WHERE id = $1',
        [id]
      );

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
      const result = await fastify.pg.query(
        `SELECT
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.is_online
         FROM users u
         WHERE (u.username ILIKE $1 OR u.display_name ILIKE $1)
         AND u.id != $2
         AND u.id NOT IN (
           SELECT friend_id FROM friendships WHERE user_id = $2
           UNION
           SELECT user_id FROM friendships WHERE friend_id = $2
         )
         LIMIT 20`,
        [`%${query}%`, userId]
      );

      return {
        users: result.rows,
        total: result.rows.length,
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
