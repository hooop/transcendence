-- Migration pour ajouter le support OAuth42
-- Ajoute les colonnes oauth_provider et oauth_id à la table users

-- Ajouter les colonnes OAuth si elles n'existent pas
ALTER TABLE users
ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);

-- Rendre le password_hash optionnel (NULL) pour les utilisateurs OAuth
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- Créer un index sur oauth_provider et oauth_id pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Contrainte pour s'assurer qu'un utilisateur a soit un password_hash, soit un oauth_id
ALTER TABLE users
ADD CONSTRAINT check_auth_method
CHECK (
    (password_hash IS NOT NULL) OR
    (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
);
