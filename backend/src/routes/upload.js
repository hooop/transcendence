const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

async function uploadRoutes(fastify, options) {

  // Configuration du dossier uploads
  const uploadsDir = path.join(__dirname, '../../uploads/avatars');

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // POST /api/upload/avatar - Upload d'avatar
  fastify.post('/avatar', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded',
        });
      }

      // Vérifier le type de fichier
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Only JPEG, PNG, GIF and WebP are allowed',
        });
      }

      // Vérifier la taille (max 5MB)
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      let fileSize = 0;

      // Générer un nom de fichier unique
      const userId = request.user.id;
      const fileExtension = path.extname(data.filename);
      const filename = `${userId}-${Date.now()}${fileExtension}`;
      const filepath = path.join(uploadsDir, filename);

      // Écrire le fichier
      const writeStream = fs.createWriteStream(filepath);

      // Vérifier la taille pendant l'upload
      data.file.on('data', (chunk) => {
        fileSize += chunk.length;
        if (fileSize > MAX_SIZE) {
          writeStream.destroy();
          fs.unlinkSync(filepath);
          throw new Error('File too large. Maximum size is 5MB');
        }
      });

      await pipeline(data.file, writeStream);

      // URL de l'avatar
      const avatarUrl = `http://localhost:3000/uploads/avatars/${filename}`;

      // Mettre à jour l'utilisateur dans la base de données
      fastify.db.prepare(
        'UPDATE users SET avatar_url = ? WHERE id = ?'
      ).run(avatarUrl, userId);

      // Récupérer l'utilisateur mis à jour
      const user = fastify.db.prepare(
        'SELECT id, username, email, display_name, avatar_url FROM users WHERE id = ?'
      ).get(userId);

      return {
        message: 'Avatar uploaded successfully',
        user: user,
        avatar_url: avatarUrl,
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error.message || 'Failed to upload avatar',
      });
    }
  });

  // DELETE /api/upload/avatar - Supprimer l'avatar
  fastify.delete('/avatar', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Récupérer l'ancien avatar
      const user = fastify.db.prepare(
        'SELECT avatar_url FROM users WHERE id = ?'
      ).get(userId);

      const oldAvatarUrl = user?.avatar_url;

      // Supprimer l'ancien fichier s'il existe
      if (oldAvatarUrl && oldAvatarUrl.includes('localhost:3000')) {
        const filename = path.basename(oldAvatarUrl);
        const filepath = path.join(uploadsDir, filename);

        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }

      // Mettre à jour la base de données
      fastify.db.prepare(
        'UPDATE users SET avatar_url = NULL WHERE id = ?'
      ).run(userId);

      return {
        message: 'Avatar deleted successfully',
      };

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to delete avatar',
      });
    }
  });
}

module.exports = uploadRoutes;
