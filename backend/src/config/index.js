require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: '7d',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // OAuth42
  oauth42: {
    clientId: process.env.OAUTH42_CLIENT_ID,
    clientSecret: process.env.OAUTH42_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH42_CALLBACK_URL || 'http://localhost:3000/api/auth/42/callback',
  },

  // Email configuration for 2FA
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@transcendence.com',
  },

  // 2FA Configuration
  twoFactor: {
    codeLength: 6,
    expirationMinutes: 10,
  },
};

module.exports = config;
