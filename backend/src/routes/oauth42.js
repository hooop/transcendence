const config = require('../config');

async function oauth42Routes(fastify, options) {

  // Enregistrer le plugin OAuth2 pour 42
  await fastify.register(require('@fastify/oauth2'), {
    name: 'oauth42',
    credentials: {
      client: {
        id: config.oauth42.clientId,
        secret: config.oauth42.clientSecret,
      },
      auth: {
        authorizeHost: 'https://api.intra.42.fr',
        authorizePath: '/oauth/authorize',
        tokenHost: 'https://api.intra.42.fr',
        tokenPath: '/oauth/token',
      },
    },
    startRedirectPath: '/42',
    callbackUri: config.oauth42.callbackUrl,
    scope: ['public'],
  });

  // La route GET /42 est automatiquement créée par le plugin @fastify/oauth2
  // Elle redirige vers la page de connexion 42
  // Pas besoin de la déclarer manuellement

  // Route callback OAuth42
  // GET /api/auth/42/callback
  fastify.get('/42/callback', async (request, reply) => {
    try {
      // Échanger le code contre un token d'accès
      const token = await fastify.oauth42.getAccessTokenFromAuthorizationCodeFlow(request);

      // Récupérer les informations de l'utilisateur depuis l'API 42
      const response = await fetch('https://api.intra.42.fr/v2/me', {
        headers: {
          Authorization: `Bearer ${token.token.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Impossible de récupérer les informations utilisateur depuis 42');
      }

      const userData = await response.json();

      // Extraire les informations nécessaires
      const oauth_id = userData.id.toString();
      const username = userData.login;
      const email = userData.email;
      const display_name = userData.displayname || username;
      const avatar_url = userData.image?.link || userData.image?.versions?.medium;

      // Vérifier si l'utilisateur existe déjà avec cet OAuth ID
      let user = fastify.db.prepare(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
      ).get('42', oauth_id);

      if (user) {
        // Utilisateur existant - mettre à jour les informations et marquer comme en ligne
        fastify.db.prepare(
          `UPDATE users
           SET is_online = 1,
               last_seen = CURRENT_TIMESTAMP,
               avatar_url = COALESCE(?, avatar_url),
               display_name = COALESCE(?, display_name)
           WHERE id = ?`
        ).run(avatar_url, display_name, user.id);
      } else {
        // Nouvel utilisateur - créer le compte

        // Vérifier si username ou email existe déjà
        const existingUser = fastify.db.prepare(
          'SELECT id FROM users WHERE username = ? OR email = ?'
        ).get(username, email);

        let finalUsername = username;

        // Si username existe, ajouter un suffixe aléatoire
        if (existingUser) {
          const randomSuffix = Math.floor(Math.random() * 10000);
          finalUsername = `${username}_${randomSuffix}`;
        }

        // Créer l'utilisateur
        fastify.db.prepare(
          `INSERT INTO users (username, email, display_name, avatar_url, oauth_provider, oauth_id, is_online)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        ).run(finalUsername, email, display_name, avatar_url, '42', oauth_id);

        // Récupérer l'utilisateur créé par oauth_id
        user = fastify.db.prepare(
          'SELECT id, username, email, display_name, avatar_url, created_at FROM users WHERE oauth_provider = ? AND oauth_id = ?'
        ).get('42', oauth_id);

        // Créer les statistiques de jeu pour le nouvel utilisateur
        fastify.db.prepare(
          'INSERT INTO game_stats (user_id) VALUES (?)'
        ).run(user.id);

        fastify.log.info(`Nouvel utilisateur créé via OAuth42: ${user.username}`);
      }

      // Générer un JWT pour l'utilisateur
      const jwtToken = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      // Rediriger vers le frontend avec le token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      return reply.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      }))}`);

      // Retourner JSON (pour API)
      // return {
      //   user: {
      //     id: user.id,
      //     username: user.username,
      //     email: user.email,
      //     display_name: user.display_name,
      //     avatar_url: user.avatar_url,
      //   },
      //   token: jwtToken,
      // };

    } catch (error) {
      fastify.log.error(error);

      // Rediriger vers le frontend avec une erreur
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      return reply.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Erreur lors de l\'authentification OAuth42')}`);
    }
  });
}

module.exports = oauth42Routes;
