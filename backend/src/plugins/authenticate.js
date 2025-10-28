const fp = require('fastify-plugin');

// Plugin pour ajouter le middleware d'authentification
async function authenticatePlugin(fastify, options) {
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (error) {
      reply.status(401).send({
        error: 'Token invalide ou manquant',
        message: 'Vous devez être connecté pour accéder à cette ressource',
      });
    }
  });
}

// Utiliser fastify-plugin pour éviter l'encapsulation
module.exports = fp(authenticatePlugin);
