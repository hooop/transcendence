async function usersRoutes(fastify, options) {

  // GET /api/users - Liste des utilisateurs
  fastify.get('/', async (request, reply) => {
    try {
      const result = fastify.db.prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online,
                gs.wins, gs.losses, gs.ranking_points
         FROM users u
         LEFT JOIN game_stats gs ON u.id = gs.user_id
         ORDER BY gs.ranking_points DESC
         LIMIT 50`
      ).all();

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des utilisateurs',
      });
    }
  });

  // GET /api/users/:id - Profil d'un utilisateur
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const result = fastify.db.prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online,
                u.created_at,
                gs.total_matches, gs.wins, gs.losses, gs.draws,
                gs.total_points_scored, gs.total_points_conceded,
                gs.win_streak, gs.best_win_streak, gs.ranking_points
         FROM users u
         LEFT JOIN game_stats gs ON u.id = gs.user_id
         WHERE u.id = ?`
      ).get(id);

      if (!result) {
        return reply.status(404).send({ error: 'Utilisateur non trouvé' });
      }

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération de l\'utilisateur',
      });
    }
  });

  // GET /api/users/:id/matches - Historique des matchs d'un utilisateur
  fastify.get('/:id/matches', async (request, reply) => {
    const { id } = request.params;
    const { limit = 10 } = request.query;

    try {
      const result = fastify.db.prepare(
        `SELECT m.id, m.player1_score, m.player2_score, m.status,
                m.game_mode, m.duration_seconds, m.ended_at,
                p1.id as player1_id, p1.username as player1_username,
                p1.display_name as player1_display_name,
                p2.id as player2_id, p2.username as player2_username,
                p2.display_name as player2_display_name,
                w.username as winner_username
         FROM matches m
         JOIN users p1 ON m.player1_id = p1.id
         JOIN users p2 ON m.player2_id = p2.id
         LEFT JOIN users w ON m.winner_id = w.id
         WHERE m.player1_id = ? OR m.player2_id = ?
         ORDER BY m.ended_at DESC
         LIMIT ?`
      ).all(id, id, limit);

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des matchs',
      });
    }
  });

  // GET /api/users/:id/stats - Statistiques détaillées
  fastify.get('/:id/stats', async (request, reply) => {
    const { id } = request.params;

    try {
      const stats = fastify.db.prepare(
        'SELECT * FROM game_stats WHERE user_id = ?'
      ).get(id);

      if (!stats) {
        return reply.status(404).send({ error: 'Statistiques non trouvées' });
      }

      // Calculer le ratio victoires/défaites
      const winRate = stats.total_matches > 0
        ? ((stats.wins / stats.total_matches) * 100).toFixed(2)
        : 0;

      return {
        ...stats,
        win_rate: parseFloat(winRate),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des statistiques',
      });
    }
  });
}

module.exports = usersRoutes;
