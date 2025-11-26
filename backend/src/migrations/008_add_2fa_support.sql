-- Migration 008: Ajouter le support 2FA (Two-Factor Authentication)

-- Ajouter les colonnes 2FA à la table users
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN two_factor_code TEXT;
ALTER TABLE users ADD COLUMN two_factor_expires_at DATETIME;

-- Créer un index pour améliorer les performances
CREATE INDEX idx_users_two_factor ON users(two_factor_enabled);
