-- Corriger les types des IDs pour correspondre à users (TEXT/UUID)
CREATE TABLE matches_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player1_id TEXT NOT NULL,
  player2_id TEXT,
  opponent_name TEXT,
  winner_id TEXT,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  game_mode TEXT DEFAULT 'classic',
  duration_seconds INTEGER,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player1_id) REFERENCES users(id),
  FOREIGN KEY (player2_id) REFERENCES users(id),
  FOREIGN KEY (winner_id) REFERENCES users(id)
);

-- Copier les données existantes
INSERT INTO matches_new SELECT * FROM matches;

-- Supprimer l'ancienne table
DROP TABLE matches;

-- Renommer la nouvelle table
ALTER TABLE matches_new RENAME TO matches;
