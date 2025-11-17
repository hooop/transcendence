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
