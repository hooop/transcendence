const bcrypt = require('bcrypt');

// Fonction de validation des données d'inscription
function validateRegistrationData(username, email, password, display_name) {
  const errors = [];

  // Validation USERNAME
  if (!username || username.trim().length === 0) {
    errors.push('Le username est requis');
  } else {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      errors.push('Le username doit contenir entre 3 et 20 caractères');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      errors.push('Le username ne peut contenir que des lettres, chiffres, tirets et underscores');
    }
  }

  // Validation EMAIL
  if (!email || email.trim().length === 0) {
    errors.push('L\'email est requis');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Format d\'email invalide');
    }
    if (email.length > 254) {
      errors.push('L\'email est trop long (maximum 254 caractères)');
    }
  }

  // Validation PASSWORD
  if (!password) {
    errors.push('Le password est requis');
  } else {
    if (password.length < 8) {
      errors.push('Le password doit contenir au minimum 8 caractères');
    }
    if (password.length > 128) {
      errors.push('Le password est trop long (maximum 128 caractères)');
    }
    if (/\s/.test(password)) {  // Bloque TOUS les espaces (début, milieu, fin)
      errors.push('Le password ne peut pas contenir d\'espaces');
    }
  }

  // Validation DISPLAY_NAME (optionnel)
  if (display_name && display_name.length > 30) {
    errors.push('Le display_name est trop long (maximum 30 caractères)');
  }

  return errors;
}

async function authRoutes(fastify, options) {

  // POST /api/auth/register - Créer un nouvel utilisateur
fastify.post('/register', async (request, reply) => {
  const { username, email, password, display_name } = request.body;

  // Validation complète des données
  const validationErrors = validateRegistrationData(username, email, password, display_name);
  if (validationErrors.length > 0) {
    return reply.status(400).send({
      error: 'Données invalides',
      details: validationErrors,
    });
  }

  // Nettoyer les données (trim)
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanDisplayName = display_name ? display_name.trim() : cleanUsername;

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = fastify.db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(cleanUsername, cleanEmail);

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

    insertUser.run(cleanUsername, cleanEmail, passwordHash, cleanDisplayName);

    // Récupérer l'utilisateur créé par son username
    const user = fastify.db.prepare(
      'SELECT id, username, email, display_name, created_at FROM users WHERE username = ?'
    ).get(cleanUsername);

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

  // Validation basique
  if (!username || !password) {
    return reply.status(400).send({
      error: 'Username et password requis',
    });
  }

  // Nettoyer et valider les données
  const cleanUsername = username.trim();
  
  if (cleanUsername.length === 0) {
    return reply.status(400).send({
      error: 'Username ne peut pas être vide',
    });
  }

  if (cleanUsername.length > 254) {
    return reply.status(400).send({
      error: 'Username trop long',
    });
  }

  if (password.length < 1 || password.length > 128) {
    return reply.status(400).send({
      error: 'Password invalide',
    });
  }

  try {
    // Récupérer l'utilisateur
    const user = fastify.db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(cleanUsername, cleanUsername);

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
      return reply.send({
        two_factor_required: true,
        message: 'Authentification à deux facteurs requise',
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
