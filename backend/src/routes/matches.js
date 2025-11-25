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

      const params = [];

      if (status) {
        query += ' WHERE m.status = ?';
        params.push(status);
      }

      query += ' ORDER BY m.created_at DESC LIMIT ?';
      params.push(limit);

      const result = fastify.db.prepare(query).all(...params);
      return result;

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

   // Vérifier que player2 existe (seulement si fourni)
	if (player2_id) {
	if (player1_id === player2_id) {
		return reply.status(400).send({
		error: 'Vous ne pouvez pas jouer contre vous-même',
		});
	}

	const userCheck = fastify.db.prepare(
		'SELECT id FROM users WHERE id = ?'
	).get(player2_id);

	if (!userCheck) {
		return reply.status(404).send({
		error: 'Joueur 2 non trouvé',
		});
	}
	}

    try {
      // Vérifier que player2 existe
      const userCheck = fastify.db.prepare(
        'SELECT id FROM users WHERE id = ?'
      ).get(player2_id);

      if (!userCheck) {
        return reply.status(404).send({
          error: 'Joueur 2 non trouvé',
        });
      }

      // Créer le match
      const insertResult = fastify.db.prepare(
        `INSERT INTO matches (player1_id, player2_id, game_mode, status, started_at)
         VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`
      ).run(player1_id, player2_id, game_mode);

      // Récupérer le match créé
      const match = fastify.db.prepare(
        'SELECT * FROM matches WHERE id = ?'
      ).get(insertResult.lastInsertRowid);

      return reply.status(201).send(match);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la création du match',
      });
    }
  });


  // POST /api/matches/complete - Enregistrer un match déjà terminé
 // POST /api/matches/complete - Enregistrer un match déjà terminé
  fastify.post('/complete', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { player2_id, opponent_name, winner_id, player1_score, player2_score, game_mode = 'local' } = request.body;
    const player1_id = request.user.id;

    // Validation des données obligatoires
    if (player1_score === undefined || player2_score === undefined) {
      return reply.status(400).send({
        error: 'Données manquantes : player1_score et player2_score sont obligatoires',
      });
    }

    try {
      // 1. Créer le match d'abord (sans rankings)
      const insertResult = fastify.db.prepare(
        `INSERT INTO matches (player1_id, player2_id, opponent_name, winner_id, player1_score, player2_score, game_mode, status, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run(
        player1_id,
        player2_id || null,
        opponent_name || null,
        winner_id,
        player1_score,
        player2_score,
        game_mode
      );

      const match_id = insertResult.lastInsertRowid;

      // 2. Mettre à jour les stats

      if (winner_id) {
        const loser_id = winner_id === player1_id ? player2_id : player1_id;

        // Mettre à jour les stats du gagnant
        const winnerStats = fastify.db.prepare(
          'SELECT id FROM game_stats WHERE user_id = ?'
        ).get(winner_id);

        if (!winnerStats) {
          // Créer les stats si elles n'existent pas
          fastify.db.prepare(
            `INSERT INTO game_stats (user_id, total_matches, wins, losses, total_points_scored, total_points_conceded, win_streak, best_win_streak, ranking_points)
             VALUES (?, 1, 1, 0, ?, ?, 1, 1, 1025)`
          ).run(winner_id, winner_id === player1_id ? player1_score : player2_score, winner_id === player1_id ? player2_score : player1_score);
        } else {
          fastify.db.prepare(
            `UPDATE game_stats SET
            total_matches = total_matches + 1,
            wins = wins + 1,
            total_points_scored = total_points_scored + ?,
            total_points_conceded = total_points_conceded + ?,
            win_streak = win_streak + 1,
            best_win_streak = MAX(best_win_streak, win_streak + 1),
            ranking_points = ranking_points + 25
            WHERE user_id = ?`
          ).run(
            winner_id === player1_id ? player1_score : player2_score,
            winner_id === player1_id ? player2_score : player1_score,
            winner_id
          );
        }

        // Mettre à jour les stats du perdant (seulement si c'est un vrai joueur)
        if (loser_id) {
          const loserStats = fastify.db.prepare(
            'SELECT id FROM game_stats WHERE user_id = ?'
          ).get(loser_id);

          if (!loserStats) {
            // Créer les stats si elles n'existent pas
            fastify.db.prepare(
              `INSERT INTO game_stats (user_id, total_matches, wins, losses, total_points_scored, total_points_conceded, win_streak, best_win_streak, ranking_points)
               VALUES (?, 1, 0, 1, ?, ?, 0, 0, 985)`
            ).run(loser_id, loser_id === player1_id ? player1_score : player2_score, loser_id === player1_id ? player2_score : player1_score);
          } else {
            fastify.db.prepare(
              `UPDATE game_stats SET
              total_matches = total_matches + 1,
              losses = losses + 1,
              total_points_scored = total_points_scored + ?,
              total_points_conceded = total_points_conceded + ?,
              win_streak = 0,
              ranking_points = MAX(ranking_points - 15, 0)
              WHERE user_id = ?`
            ).run(
              loser_id === player1_id ? player1_score : player2_score,
              loser_id === player1_id ? player2_score : player1_score,
              loser_id
            );
          }
        }
      }

      // 3. Maintenant sauvegarder les rankings APRÈS
      const player1RankingAfter = fastify.db.prepare(
        'SELECT ranking_points FROM game_stats WHERE user_id = ?'
      ).get(player1_id);

      const player2RankingAfter = player2_id ? fastify.db.prepare(
        'SELECT ranking_points FROM game_stats WHERE user_id = ?'
      ).get(player2_id) : null;

      // Mettre à jour le match avec les rankings APRÈS
      fastify.db.prepare(
        `UPDATE matches SET 
          player1_ranking_after = ?,
          player2_ranking_after = ?
        WHERE id = ?`
      ).run(
        player1RankingAfter?.ranking_points || 1000,
        player2RankingAfter?.ranking_points || null,
        match_id
      );

      // Récupérer le match créé


      // Récupérer le match créé
      const match = fastify.db.prepare(
        'SELECT * FROM matches WHERE id = ?'
      ).get(match_id);

      return reply.status(201).send(match);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de l\'enregistrement du match',
      });
    }
  });



  // GET /api/matches/:id - Détails d'un match
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const result = fastify.db.prepare(
        `SELECT m.*,
                p1.username as player1_username, p1.display_name as player1_display_name,
                p2.username as player2_username, p2.display_name as player2_display_name,
                w.username as winner_username
         FROM matches m
         JOIN users p1 ON m.player1_id = p1.id
         JOIN users p2 ON m.player2_id = p2.id
         LEFT JOIN users w ON m.winner_id = w.id
         WHERE m.id = ?`
      ).get(id);

      if (!result) {
        return reply.status(404).send({ error: 'Match non trouvé' });
      }

      return result;

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
      const matchCheck = fastify.db.prepare(
        'SELECT * FROM matches WHERE id = ? AND (player1_id = ? OR player2_id = ?)'
      ).get(id, request.user.id, request.user.id);

      if (!matchCheck) {
        return reply.status(404).send({
          error: 'Match non trouvé ou vous n\'êtes pas autorisé à le modifier',
        });
      }

      // Construire la requête de mise à jour
      const updates = [];
      const values = [];

      if (player1_score !== undefined) {
        updates.push(`player1_score = ?`);
        values.push(player1_score);
      }
      if (player2_score !== undefined) {
        updates.push(`player2_score = ?`);
        values.push(player2_score);
      }
      if (status) {
        updates.push(`status = ?`);
        values.push(status);
        if (status === 'completed') {
          updates.push(`ended_at = CURRENT_TIMESTAMP`);
        }
      }
      if (winner_id) {
        updates.push(`winner_id = ?`);
        values.push(winner_id);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          error: 'Aucune donnée à mettre à jour',
        });
      }

      values.push(id);

      fastify.db.prepare(
        `UPDATE matches SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);

      // Récupérer le match mis à jour
      const match = fastify.db.prepare(
        'SELECT * FROM matches WHERE id = ?'
      ).get(id);

      // Si le match est terminé, sauvegarder les rankings AVANT de mettre à jour les stats
      if (status === 'completed' && winner_id) {
        // Récupérer les rankings AVANT mise à jour
        const player1RankingBefore = fastify.db.prepare(
          'SELECT ranking_points FROM game_stats WHERE user_id = ?'
        ).get(match.player1_id);

        const player2RankingBefore = fastify.db.prepare(
          'SELECT ranking_points FROM game_stats WHERE user_id = ?'
        ).get(match.player2_id);

        // Sauvegarder les rankings AVANT dans le match
        fastify.db.prepare(
          `UPDATE matches SET 
            player1_ranking_after = ?,
            player2_ranking_after = ?
          WHERE id = ?`
        ).run(
          player1RankingBefore?.ranking_points || null,
          player2RankingBefore?.ranking_points || null,
          id
        );

        // Maintenant mettre à jour les statistiques
        const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;

        // Mettre à jour les stats du gagnant
        const winnerStats = fastify.db.prepare(
          'SELECT id FROM game_stats WHERE user_id = ?'
        ).get(winner_id);

        if (winnerStats) {
          fastify.db.prepare(
            `UPDATE game_stats SET
            total_matches = total_matches + 1,
            wins = wins + 1,
            total_points_scored = total_points_scored + ?,
            total_points_conceded = total_points_conceded + ?,
            win_streak = win_streak + 1,
            best_win_streak = MAX(best_win_streak, win_streak + 1),
            ranking_points = ranking_points + 25
            WHERE user_id = ?`
          ).run(
            winner_id === match.player1_id ? match.player1_score : match.player2_score,
            winner_id === match.player1_id ? match.player2_score : match.player1_score,
            winner_id
          );
        }

        // Mettre à jour les stats du perdant (seulement si c'est un vrai joueur)
        const loserStats = fastify.db.prepare(
          'SELECT id FROM game_stats WHERE user_id = ?'
        ).get(loser_id);

        if (loserStats) {
          fastify.db.prepare(
            `UPDATE game_stats SET
            total_matches = total_matches + 1,
            losses = losses + 1,
            total_points_scored = total_points_scored + ?,
            total_points_conceded = total_points_conceded + ?,
            win_streak = 0,
            ranking_points = MAX(ranking_points - 15, 0)
            WHERE user_id = ?`
          ).run(
            loser_id === match.player1_id ? match.player1_score : match.player2_score,
            loser_id === match.player1_id ? match.player2_score : match.player1_score,
            loser_id
          );
        }
      }

      return match;

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
      const result = fastify.db.prepare(
        'DELETE FROM matches WHERE id = ? AND (player1_id = ? OR player2_id = ?)'
      ).run(id, request.user.id, request.user.id);

      if (result.changes === 0) {
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
