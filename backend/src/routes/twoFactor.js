const emailService = require('../services/emailService');

async function twoFactorRoutes(fastify, options) {

  // POST /api/2fa/enable - Activer le 2FA pour l'utilisateur connecté
  fastify.post('/enable', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Vérifier si le 2FA n'est pas déjà activé
      const user = fastify.db.prepare(
        'SELECT two_factor_enabled FROM users WHERE id = ?'
      ).get(userId);

      if (user.two_factor_enabled) {
        return reply.status(400).send({
          error: 'Le 2FA est déjà activé sur votre compte',
        });
      }

      // Activer le 2FA
      fastify.db.prepare(
        'UPDATE users SET two_factor_enabled = 1 WHERE id = ?'
      ).run(userId);

      return {
        message: 'Authentification à deux facteurs activée avec succès',
        two_factor_enabled: true,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de l\'activation du 2FA',
      });
    }
  });

  // POST /api/2fa/disable - Désactiver le 2FA
  fastify.post('/disable', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Désactiver le 2FA et supprimer le code en cours
      fastify.db.prepare(
        `UPDATE users
         SET two_factor_enabled = 0,
             two_factor_code = NULL,
             two_factor_expires_at = NULL
         WHERE id = ?`
      ).run(userId);

      return {
        message: 'Authentification à deux facteurs désactivée',
        two_factor_enabled: false,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la désactivation du 2FA',
      });
    }
  });

  // POST /api/2fa/send-code - Envoyer un code 2FA par email
  fastify.post('/send-code', async (request, reply) => {
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
      const bcrypt = require('bcrypt');
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({
          error: 'Identifiants invalides',
        });
      }

      // Vérifier si le 2FA est activé
      if (!user.two_factor_enabled) {
        return reply.status(400).send({
          error: 'Le 2FA n\'est pas activé sur ce compte',
        });
      }

      // Générer un code 2FA
      const code = emailService.generateCode();
      const expiresAt = emailService.getExpirationDate();

      // Stocker le code en base
      fastify.db.prepare(
        `UPDATE users
         SET two_factor_code = ?,
             two_factor_expires_at = ?
         WHERE id = ?`
      ).run(code, expiresAt.toISOString(), user.id);

      // Envoyer l'email
      await emailService.send2FACode(user.email, code, user.username);

      return {
        message: 'Code de vérification envoyé par email',
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Masquer partiellement l'email
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de l\'envoi du code',
      });
    }
  });

  // POST /api/2fa/verify - Vérifier le code 2FA et retourner le JWT
  fastify.post('/verify', async (request, reply) => {
    const { username, code } = request.body;

    if (!username || !code) {
      return reply.status(400).send({
        error: 'Username et code requis',
      });
    }

    try {
      // Récupérer l'utilisateur avec son code 2FA
      const user = fastify.db.prepare(
        `SELECT * FROM users
         WHERE (username = ? OR email = ?)
         AND two_factor_enabled = 1`
      ).get(username, username);

      if (!user) {
        return reply.status(404).send({
          error: 'Utilisateur non trouvé ou 2FA non activé',
        });
      }

      // Vérifier le code
      const isValid = emailService.verifyCode(
        user.two_factor_code,
        code.trim(),
        user.two_factor_expires_at
      );

      if (!isValid) {
        return reply.status(401).send({
          error: 'Code invalide ou expiré',
        });
      }

      // Code valide - supprimer le code utilisé
      fastify.db.prepare(
        `UPDATE users
         SET two_factor_code = NULL,
             two_factor_expires_at = NULL,
             is_online = 1
         WHERE id = ?`
      ).run(user.id);

      // Générer le JWT
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
      });

      return {
        message: 'Authentification réussie',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          two_factor_enabled: true,
        },
        token,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la vérification du code',
      });
    }
  });

  // GET /api/2fa/status - Vérifier le statut 2FA de l'utilisateur connecté
  fastify.get('/status', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = fastify.db.prepare(
        'SELECT two_factor_enabled FROM users WHERE id = ?'
      ).get(request.user.id);

      return {
        two_factor_enabled: !!user.two_factor_enabled,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Erreur lors de la récupération du statut 2FA',
      });
    }
  });
}

module.exports = twoFactorRoutes;
