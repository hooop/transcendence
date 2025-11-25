-- Add ranking_points snapshot columns for match history evolution charts
ALTER TABLE matches ADD COLUMN player1_ranking_after INTEGER;
ALTER TABLE matches ADD COLUMN player2_ranking_after INTEGER;