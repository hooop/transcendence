const fp = require('fastify-plugin');
const promClient = require('prom-client');

/**
 * Plugin Fastify pour exposer les métriques Prometheus
 * @param {Object} fastify - Instance Fastify
 * @param {Object} opts - Options du plugin
 */
async function metricsPlugin(fastify, opts) {
  // Créer un registre pour les métriques
  const register = new promClient.Registry();

  // Ajouter les métriques par défaut (CPU, mémoire, etc.)
  promClient.collectDefaultMetrics({
    register,
    prefix: 'transcendence_',
  });

  // Métrique personnalisée: Durée des requêtes HTTP
  const httpRequestDuration = new promClient.Histogram({
    name: 'transcendence_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });

  // Métrique personnalisée: Compteur de requêtes totales
  const httpRequestTotal = new promClient.Counter({
    name: 'transcendence_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  // Métrique personnalisée: Requêtes en cours
  const httpRequestsInProgress = new promClient.Gauge({
    name: 'transcendence_http_requests_in_progress',
    help: 'Number of HTTP requests currently in progress',
    labelNames: ['method'],
    registers: [register],
  });

  // Métrique personnalisée: Nombre d'utilisateurs connectés (WebSocket)
  const connectedUsers = new promClient.Gauge({
    name: 'transcendence_connected_users',
    help: 'Number of users currently connected via WebSocket',
    registers: [register],
  });

  // Métrique personnalisée: Nombre de parties en cours
  const activeGames = new promClient.Gauge({
    name: 'transcendence_active_games',
    help: 'Number of active Pong games',
    registers: [register],
  });

  // Exposer les métriques dans fastify pour utilisation dans d'autres plugins
  fastify.decorate('metrics', {
    register,
    httpRequestDuration,
    httpRequestTotal,
    httpRequestsInProgress,
    connectedUsers,
    activeGames,
  });

  // Hook: Avant le traitement de la requête
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
    httpRequestsInProgress.labels(request.method).inc();
  });

  // Hook: Après l'envoi de la réponse
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - request.startTime) / 1000;
    const route = request.routerPath || request.url;
    const labels = {
      method: request.method,
      route: route,
      status_code: reply.statusCode,
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    httpRequestsInProgress.labels(request.method).dec();
  });

  // Route pour exposer les métriques à Prometheus
  fastify.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });

  fastify.log.info('✅ Plugin metrics Prometheus initialisé');
}

module.exports = fp(metricsPlugin, {
  name: 'metrics',
  fastify: '4.x',
});
