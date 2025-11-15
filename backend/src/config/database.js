require('dotenv').config();

const dbConfig = {
  path: process.env.SQLITE_PATH || './data/transcendence.db',
};

module.exports = dbConfig;
