const { notifyFriendsOfProfileUpdate } = require('./chat');


async function usersRoutes(fastify, options)
{
	// GET /api/users/ranking/top3 - Top 3 des joueurs
	fastify.get('/ranking/top3', async (request, reply) => {
	try {
		const result = fastify.db.prepare(
		`SELECT u.id, u.username, u.display_name, u.avatar_url,
				gs.wins, gs.losses, gs.ranking_points
		FROM users u
		INNER JOIN game_stats gs ON u.id = gs.user_id
		ORDER BY gs.ranking_points DESC
		LIMIT 3`
		).all();

		return result;
	} catch (error) {
		fastify.log.error(error);
		return reply.status(500).send({
		error: 'Erreur lors de la récupération du classement',
		});
	}
	});


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
		`SELECT m.id, m.player1_score, m.player2_score, m.status, m.winner_id,
				m.game_mode, m.duration_seconds, m.ended_at, m.opponent_name, m.created_at,
				m.player1_ranking_after, m.player2_ranking_after,
				p1.id as player1_id, p1.username as player1_username,
				p1.display_name as player1_display_name,
				p2.id as player2_id, p2.username as player2_username,
				p2.display_name as player2_display_name,
				w.username as winner_username
			FROM matches m
			JOIN users p1 ON m.player1_id = p1.id
			LEFT JOIN users p2 ON m.player2_id = p2.id
			LEFT JOIN users w ON m.winner_id = w.id
			WHERE (m.player1_id = ? OR m.player2_id = ?)
			  AND m.status = 'completed'
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

	// PATCH /api/users/:id - Mettre à jour le profil utilisateur
	fastify.patch('/:id', {
	onRequest: [fastify.authenticate],
	}, async (request, reply) => {
	const { id } = request.params;
	const userId = request.user.id;
	const { display_name, username, email } = request.body;

	// Vérifier que l'utilisateur modifie son propre profil
	if (id !== userId) {
		return reply.status(403).send({
		error: 'Non autorisé à modifier ce profil',
		});
	}

	try {
		// Construire la requête dynamiquement selon les champs fournis
		const updates = [];
		const values = [];

		if (display_name !== undefined) {
		updates.push('display_name = ?');
		values.push(display_name);
		}
		if (username !== undefined) {
		updates.push('username = ?');
		values.push(username);
		}
		if (email !== undefined) {
		updates.push('email = ?');
		values.push(email);
		}

		if (updates.length === 0) {
		return reply.status(400).send({
			error: 'Aucun champ à mettre à jour',
		});
		}

		// Ajouter l'ID en dernier paramètre
		values.push(id);

		// Exécuter la mise à jour
		fastify.db.prepare(
		`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`
		).run(...values);

		// Récupérer l'utilisateur mis à jour
		const user = fastify.db.prepare(
		'SELECT id, username, email, display_name, avatar_url FROM users WHERE id = ?'
		).get(id);

		// Notifier les amis du changement de profil
		await notifyFriendsOfProfileUpdate(fastify, id);

		return {
		message: 'Profil mis à jour avec succès',
		user: user,
		};

	} catch (error) {
		fastify.log.error(error);
		return reply.status(500).send({
		error: 'Erreur lors de la mise à jour du profil',
		});
	}
	});

}

module.exports = usersRoutes;
