const bcrypt = require('bcrypt');

async function authRoutes(fastify, options) {

  // POST /api/auth/register - Créer un nouvel utilisateur
  fastify.post('/register', async (request, reply) => {
    const { username, email, password, display_name } = request.body;

    // Validation basique
    if (!username || !email || !password) {
      return reply.status(400).send({
        error: 'Username, email et password sont requis',
      });
    }

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await fastify.pg.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return reply.status(409).send({
          error: 'Username ou email déjà utilisé',
        });
      }

      // Hasher le mot de passe
      const passwordHash = await bcrypt.hash(password, 10);

      // Créer l'utilisateur
      const result = await fastify.pg.query(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, display_name, created_at`,
        [username, email, passwordHash, display_name || username]
      );

      const user = result.rows[0];

      // Créer les statistiques de jeu pour l'utilisateur
      await fastify.pg.query(
        'INSERT INTO game_stats (user_id) VALUES ($1)',
        [user.id]
      );

      // Générer un token JWT
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
        },
        token,
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la création du compte',
      });
    }
  });

  // POST /api/auth/login - Se connecter
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({
        error: 'Username et password requis',
      });
    }

    try {
      // Récupérer l'utilisateur
      const result = await fastify.pg.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({
          error: 'Identifiants invalides',
        });
      }

      const user = result.rows[0];

      // Vérifier le mot de passe
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({
          error: 'Identifiants invalides',
        });
      }

      // Mettre à jour le statut en ligne
      await fastify.pg.query(
        'UPDATE users SET is_online = true WHERE id = $1',
        [user.id]
      );

      // Générer un token JWT
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
        token,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la connexion',
      });
    }
  });

  // POST /api/auth/logout - Se déconnecter
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      // Mettre à jour le statut hors ligne
      await fastify.pg.query(
        'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [request.user.id]
      );

      return { message: 'Déconnexion réussie' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la déconnexion',
      });
    }
  });

  // GET /api/auth/me - Obtenir l'utilisateur connecté
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const result = await fastify.pg.query(
        `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
                u.is_online, u.created_at,
                gs.total_matches, gs.wins, gs.losses, gs.ranking_points
         FROM users u
         LEFT JOIN game_stats gs ON u.id = gs.user_id
         WHERE u.id = $1`,
        [request.user.id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Utilisateur non trouvé' });
      }

      return result.rows[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des données',
      });
    }
  });
}

module.exports = authRoutes;
