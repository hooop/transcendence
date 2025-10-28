async function matchesRoutes(fastify, options) {

  // GET /api/matches - Liste des matchs récents
  fastify.get('/', async (request, reply) => {
    const { limit = 20, status } = request.query;

    try {
      let query = `
        SELECT m.id, m.player1_score, m.player2_score, m.status,
               m.game_mode, m.duration_seconds, m.started_at, m.ended_at,
               p1.id as player1_id, p1.username as player1_username,
               p1.display_name as player1_display_name, p1.avatar_url as player1_avatar,
               p2.id as player2_id, p2.username as player2_username,
               p2.display_name as player2_display_name, p2.avatar_url as player2_avatar,
               w.username as winner_username
        FROM matches m
        JOIN users p1 ON m.player1_id = p1.id
        JOIN users p2 ON m.player2_id = p2.id
        LEFT JOIN users w ON m.winner_id = w.id
      `;

      const params = [limit];

      if (status) {
        query += ' WHERE m.status = $2';
        params.push(status);
      }

      query += ' ORDER BY m.created_at DESC LIMIT $1';

      const result = await fastify.pg.query(query, params);
      return result.rows;

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des matchs',
      });
    }
  });

  // POST /api/matches - Créer un nouveau match
  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { player2_id, game_mode = 'classic' } = request.body;
    const player1_id = request.user.id;

    if (!player2_id) {
      return reply.status(400).send({
        error: 'player2_id est requis',
      });
    }

    if (player1_id === player2_id) {
      return reply.status(400).send({
        error: 'Vous ne pouvez pas jouer contre vous-même',
      });
    }

    try {
      // Vérifier que player2 existe
      const userCheck = await fastify.pg.query(
        'SELECT id FROM users WHERE id = $1',
        [player2_id]
      );

      if (userCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Joueur 2 non trouvé',
        });
      }

      // Créer le match
      const result = await fastify.pg.query(
        `INSERT INTO matches (player1_id, player2_id, game_mode, status, started_at)
         VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
         RETURNING *`,
        [player1_id, player2_id, game_mode]
      );

      return reply.status(201).send(result.rows[0]);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la création du match',
      });
    }
  });

  // GET /api/matches/:id - Détails d'un match
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await fastify.pg.query(
        `SELECT m.*,
                p1.username as player1_username, p1.display_name as player1_display_name,
                p2.username as player2_username, p2.display_name as player2_display_name,
                w.username as winner_username
         FROM matches m
         JOIN users p1 ON m.player1_id = p1.id
         JOIN users p2 ON m.player2_id = p2.id
         LEFT JOIN users w ON m.winner_id = w.id
         WHERE m.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Match non trouvé' });
      }

      return result.rows[0];

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération du match',
      });
    }
  });

  // PATCH /api/matches/:id - Mettre à jour un match (score, statut)
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { player1_score, player2_score, status, winner_id } = request.body;

    try {
      // Vérifier que le match existe et que l'utilisateur est un des joueurs
      const matchCheck = await fastify.pg.query(
        'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
        [id, request.user.id]
      );

      if (matchCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Match non trouvé ou vous n\'êtes pas autorisé à le modifier',
        });
      }

      // Construire la requête de mise à jour
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (player1_score !== undefined) {
        updates.push(`player1_score = $${paramCount++}`);
        values.push(player1_score);
      }
      if (player2_score !== undefined) {
        updates.push(`player2_score = $${paramCount++}`);
        values.push(player2_score);
      }
      if (status) {
        updates.push(`status = $${paramCount++}`);
        values.push(status);
        if (status === 'completed') {
          updates.push(`ended_at = CURRENT_TIMESTAMP`);
        }
      }
      if (winner_id) {
        updates.push(`winner_id = $${paramCount++}`);
        values.push(winner_id);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          error: 'Aucune donnée à mettre à jour',
        });
      }

      values.push(id);

      const result = await fastify.pg.query(
        `UPDATE matches SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      // Si le match est terminé, mettre à jour les statistiques
      if (status === 'completed' && winner_id) {
        const match = result.rows[0];
        const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;

        // Mettre à jour les stats du gagnant
        await fastify.pg.query(
          `UPDATE game_stats SET
           total_matches = total_matches + 1,
           wins = wins + 1,
           total_points_scored = total_points_scored + $1,
           total_points_conceded = total_points_conceded + $2,
           win_streak = win_streak + 1,
           best_win_streak = GREATEST(best_win_streak, win_streak + 1),
           ranking_points = ranking_points + 25
           WHERE user_id = $3`,
          [
            winner_id === match.player1_id ? match.player1_score : match.player2_score,
            winner_id === match.player1_id ? match.player2_score : match.player1_score,
            winner_id
          ]
        );

        // Mettre à jour les stats du perdant
        await fastify.pg.query(
          `UPDATE game_stats SET
           total_matches = total_matches + 1,
           losses = losses + 1,
           total_points_scored = total_points_scored + $1,
           total_points_conceded = total_points_conceded + $2,
           win_streak = 0,
           ranking_points = GREATEST(ranking_points - 15, 0)
           WHERE user_id = $3`,
          [
            loser_id === match.player1_id ? match.player1_score : match.player2_score,
            loser_id === match.player1_id ? match.player2_score : match.player1_score,
            loser_id
          ]
        );
      }

      return result.rows[0];

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la mise à jour du match',
      });
    }
  });

  // DELETE /api/matches/:id - Supprimer un match
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await fastify.pg.query(
        'DELETE FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2) RETURNING id',
        [id, request.user.id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Match non trouvé ou vous n\'êtes pas autorisé à le supprimer',
        });
      }

      return { message: 'Match supprimé avec succès' };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la suppression du match',
      });
    }
  });
}

module.exports = matchesRoutes;
