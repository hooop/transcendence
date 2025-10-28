require('dotenv').config();

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'transcendence',
  password: process.env.POSTGRES_PASSWORD || 'transcendence123',
  database: process.env.POSTGRES_DB || 'transcendence',
  // Options de pool de connexion
  max: 20, // Maximum de connexions dans le pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

module.exports = dbConfig;
