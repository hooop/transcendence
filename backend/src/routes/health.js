async function healthRoutes(fastify, options) {
  // Health check - vérifie que le serveur et la DB fonctionnent
  fastify.get('/health', async (request, reply) => {
    try {
      // Tester la connexion à la base de données
      fastify.db.prepare('SELECT 1').get();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        uptime: process.uptime(),
      };
    } catch (error) {
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message,
      });
    }
  });

  // Informations sur l'API
  fastify.get('/info', async (request, reply) => {
    return {
      name: 'ft_transcendence API',
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      node_version: process.version,
    };
  });
}

module.exports = healthRoutes;
