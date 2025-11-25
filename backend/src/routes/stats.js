async function statsRoutes(fastify, options) {

  // POST /api/stats/:userId - Mettre à jour les statistiques d'un joueur
  fastify.post('/:userId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { userId } = request.params;
    const { won, score, opponentScore } = request.body;

    // Vérifier que l'utilisateur met à jour ses propres stats
    if (request.user.id !== userId) {
      return reply.status(403).send({
        error: 'Vous ne pouvez mettre à jour que vos propres statistiques',
      });
    }

    // Validation des données
    if (typeof won !== 'boolean' || typeof score !== 'number' || typeof opponentScore !== 'number') {
      return reply.status(400).send({
        error: 'Données invalides (won: boolean, score: number, opponentScore: number)',
      });
    }

    try {
      // Vérifier si l'utilisateur a déjà des stats
      const existingStats = fastify.db.prepare(
        'SELECT id FROM game_stats WHERE user_id = ?'
      ).get(userId);

      if (!existingStats) {
        // Créer les stats si elles n'existent pas
        fastify.db.prepare(
          `INSERT INTO game_stats (user_id, total_matches, wins, losses, total_points_scored, total_points_conceded, win_streak, best_win_streak, ranking_points)
           VALUES (?, 0, 0, 0, 0, 0, 0, 0, 1000)`
        ).run(userId);
      }

      // Mettre à jour les stats
      if (won) {
        // Victoire
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
        ).run(score, opponentScore, userId);
      } else {
        // Défaite
        fastify.db.prepare(
          `UPDATE game_stats SET
            total_matches = total_matches + 1,
            losses = losses + 1,
            total_points_scored = total_points_scored + ?,
            total_points_conceded = total_points_conceded + ?,
            win_streak = 0,
            ranking_points = MAX(ranking_points - 15, 0)
           WHERE user_id = ?`
        ).run(score, opponentScore, userId);
      }

// Récupérer les stats mises à jour
      const updatedStats = fastify.db.prepare(
        'SELECT * FROM game_stats WHERE user_id = ?'
      ).get(userId);

      // Récupérer le ranking mis à jour
      const currentRanking = updatedStats.ranking_points;

      // Récupérer le dernier match de l'utilisateur pour y sauvegarder le ranking
      const lastMatch = fastify.db.prepare(
        `SELECT id, player1_id, player2_id FROM matches 
         WHERE (player1_id = ? OR player2_id = ?) 
         AND status = 'completed'
         ORDER BY ended_at DESC 
         LIMIT 1`
      ).get(userId, userId);

      if (lastMatch) {
        // Déterminer si l'utilisateur est player1 ou player2
        if (lastMatch.player1_id === userId) {
          fastify.db.prepare(
            'UPDATE matches SET player1_ranking_after = ? WHERE id = ?'
          ).run(currentRanking, lastMatch.id);
        } else {
          fastify.db.prepare(
            'UPDATE matches SET player2_ranking_after = ? WHERE id = ?'
          ).run(currentRanking, lastMatch.id);
        }
      }

      return reply.status(200).send(updatedStats);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la mise à jour des statistiques',
      });
    }
  });

}

module.exports = statsRoutes;
