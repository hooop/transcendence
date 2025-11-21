-- Add opponent_name column to matches table for local/AI matches
ALTER TABLE matches ADD COLUMN opponent_name TEXT;
