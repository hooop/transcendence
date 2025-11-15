const fp = require('fastify-plugin');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function sqlitePlugin(fastify, options) {
  const dbPath = options.path || './data/transcendence.db';
  const dbDir = path.dirname(dbPath);

  // Créer le dossier data s'il n'existe pas
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialiser la base de données SQLite
  const db = new Database(dbPath);

  // Activer le mode WAL pour de meilleures performances
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Décorer l'instance Fastify avec la base de données
  fastify.decorate('db', db);

  // Fermer la connexion à la base de données lors de l'arrêt du serveur
  fastify.addHook('onClose', (instance, done) => {
    db.close();
    done();
  });
}

module.exports = fp(sqlitePlugin);
