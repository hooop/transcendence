-- Migration pour ajouter le support OAuth42
-- Les colonnes oauth_provider et oauth_id sont maintenant dans 001_initial_schema.sql

-- Créer un index sur oauth_provider et oauth_id pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
