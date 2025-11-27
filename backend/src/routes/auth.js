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
      const existingUser = fastify.db.prepare(
        'SELECT id FROM users WHERE username = ? OR email = ?'
      ).get(username, email);

      if (existingUser) {
        return reply.status(409).send({
          error: 'Username ou email déjà utilisé',
        });
      }

      // Hasher le mot de passe
      const passwordHash = await bcrypt.hash(password, 10);

      // Créer l'utilisateur
      const insertUser = fastify.db.prepare(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES (?, ?, ?, ?)`
      );

      insertUser.run(username, email, passwordHash, display_name || username);

      // Récupérer l'utilisateur créé par son username
      const user = fastify.db.prepare(
        'SELECT id, username, email, display_name, created_at FROM users WHERE username = ?'
      ).get(username);

      // Créer les statistiques de jeu pour l'utilisateur
      fastify.db.prepare(
        'INSERT INTO game_stats (user_id) VALUES (?)'
      ).run(user.id);

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
      const user = fastify.db.prepare(
        'SELECT * FROM users WHERE username = ? OR email = ?'
      ).get(username, username);

      if (!user) {
        return reply.status(401).send({
          error: 'Identifiants invalides',
        });
      }

      // Vérifier le mot de passe
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({
          error: 'Identifiants invalides',
        });
      }

      // Vérifier si le 2FA est activé
      if (user.two_factor_enabled) {
        // Ne pas se connecter immédiatement, indiquer que le 2FA est requis
        return reply.send({
          two_factor_required: true,
          message: 'Authentification à deux facteurs requise',
          // Pas de token fourni, l'utilisateur doit d'abord appeler /api/2fa/send-code
        });
      }

      // Mettre à jour le statut en ligne
      fastify.db.prepare(
        'UPDATE users SET is_online = 1 WHERE id = ?'
      ).run(user.id);

      // Générer un token JWT
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          two_factor_enabled: false,
        },
        token,
      });

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
      fastify.db.prepare(
        'UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(request.user.id);

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
      const user = fastify.db.prepare(
        `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
                u.is_online, u.created_at,
                gs.total_matches, gs.wins, gs.losses, gs.ranking_points
         FROM users u
         LEFT JOIN game_stats gs ON u.id = gs.user_id
         WHERE u.id = ?`
      ).get(request.user.id);

      if (!user) {
        return reply.status(404).send({ error: 'Utilisateur non trouvé' });
      }

      return user;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération des données',
      });
    }
  });





}




module.exports = authRoutes;
