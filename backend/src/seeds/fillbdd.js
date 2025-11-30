const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

// Connexion à la base de données
const dbPath = path.join(__dirname, '../../data/transcendence.db');
const db = new Database(dbPath);

async function fillDatabase() {
  console.log('🌱 Remplissage de la base de données...');

  // Hash du mot de passe commun
  const passwordHash = await bcrypt.hash('pwd123', 10);

  // Nettoyer les données existantes (ordre important à cause des foreign keys)
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM tournament_participants').run();
  db.prepare('DELETE FROM tournaments').run();
  db.prepare('DELETE FROM matches').run();
  db.prepare('DELETE FROM game_stats').run();
  db.prepare('DELETE FROM friendships').run();
  db.prepare('DELETE FROM users').run();

  console.log('✓ Tables nettoyées');

  // Créer les utilisateurs
  const users = [
    {
      id: 'user-thomas-001',
      username: 'Thomas',
      email: 'thomas@superpong.fr',
      display_name: 'Tom',
      password_hash: passwordHash,
      avatar_url: '../img/thomas.png',
      is_online: 0
    },
    {
      id: 'user-marie-002',
      username: 'Marie',
      email: 'marie@superpong.fr',
      display_name: 'Marie',
      password_hash: passwordHash,
      avatar_url: '../img/marie.png',
      is_online: 0
    },
    {
      id: 'user-stephane-003',
      username: 'Stéphane',
      email: 'stephane@superpong.fr',
      display_name: 'Stef',
      password_hash: passwordHash,
      avatar_url: '../img/stef.png',
      is_online: 0
    },
    {
      id: 'user-julia-004',
      username: 'Julia',
      email: 'julia@superpong.fr',
      display_name: 'Julia',
      password_hash: passwordHash,
      avatar_url: '../img/julia.png',
      is_online: 0
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, display_name, password_hash, avatar_url, is_online, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-30 days'), datetime('now', '-1 day'))
  `);

  for (const user of users) {
    insertUser.run(
      user.id,
      user.username,
      user.email,
      user.display_name,
      user.password_hash,
      user.avatar_url,
      user.is_online
    );
  }

  console.log(`✓ ${users.length} utilisateurs créés`);

  // Initialiser les ranking points pour chaque utilisateur, 1000 points par défaut.
  const rankingPoints = {
    'user-thomas-001': 1000,
    'user-marie-002': 1000,
    'user-stephane-003': 1000,
    'user-julia-004': 1000
  };

  // Créer des matchs historiques pour THOMAS
  const thomasMatches = [
    // Thomas vs Marie (Marie gagne 5-3)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-marie-002',
      player1_score: 3,
      player2_score: 5,
      winner_id: 'user-marie-002',
      game_mode: 'classic',
      duration_seconds: 280,
      days_ago: 25
    },
    // Thomas vs Stéphane (Thomas gagne 5-1)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-stephane-003',
      player1_score: 5,
      player2_score: 1,
      winner_id: 'user-thomas-001',
      game_mode: 'ranked',
      duration_seconds: 220,
      days_ago: 22
    },
    // Thomas vs Marie (Thomas gagne 5-3)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-marie-002',
      player1_score: 5,
      player2_score: 3,
      winner_id: 'user-thomas-001',
      game_mode: 'ranked',
      duration_seconds: 270,
      days_ago: 18
    },
    // Thomas vs Stéphane (Thomas gagne 5-2)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-stephane-003',
      player1_score: 5,
      player2_score: 2,
      winner_id: 'user-thomas-001',
      game_mode: 'classic',
      duration_seconds: 240,
      days_ago: 15
    },
    // Thomas vs Julia (Julia gagne 5-3)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-julia-004',
      player1_score: 3,
      player2_score: 5,
      winner_id: 'user-julia-004',
      game_mode: 'classic',
      duration_seconds: 260,
      days_ago: 12
    },
    // Thomas vs IA Easy (Thomas gagne 5-1)
    {
      player1_id: 'user-thomas-001',
      player2_id: null,
      opponent_name: 'IA (Facile)',
      player1_score: 5,
      player2_score: 1,
      winner_id: 'user-thomas-001',
      game_mode: 'classic',
      duration_seconds: 180,
      days_ago: 8
    },
    // Thomas vs Julia (Thomas gagne 5-2)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-julia-004',
      player1_score: 5,
      player2_score: 2,
      winner_id: 'user-thomas-001',
      game_mode: 'ranked',
      duration_seconds: 230,
      days_ago: 3
    },
    // Thomas vs Marie (Marie gagne 5-4)
    {
      player1_id: 'user-thomas-001',
      player2_id: 'user-marie-002',
      player1_score: 4,
      player2_score: 5,
      winner_id: 'user-marie-002',
      game_mode: 'tournament',
      duration_seconds: 320,
      days_ago: 2
    }
  ];

  // Créer des matchs historiques pour MARIE
  const marieMatches = [
    // Marie vs Julia (Marie gagne 5-4)
    {
      player1_id: 'user-marie-002',
      player2_id: 'user-julia-004',
      player1_score: 5,
      player2_score: 4,
      winner_id: 'user-marie-002',
      game_mode: 'classic',
      duration_seconds: 300,
      days_ago: 20
    },
    // Marie vs Julia (Marie gagne 5-4)
    {
      player1_id: 'user-marie-002',
      player2_id: 'user-julia-004',
      player1_score: 5,
      player2_score: 4,
      winner_id: 'user-marie-002',
      game_mode: 'ranked',
      duration_seconds: 310,
      days_ago: 14
    },
    // Marie vs Stéphane (Marie gagne 5-0)
    {
      player1_id: 'user-marie-002',
      player2_id: 'user-stephane-003',
      player1_score: 5,
      player2_score: 0,
      winner_id: 'user-marie-002',
      game_mode: 'ranked',
      duration_seconds: 200,
      days_ago: 10
    },
    // Marie vs IA Medium (Marie gagne 5-3)
    {
      player1_id: 'user-marie-002',
      player2_id: null,
      opponent_name: 'IA (Moyen)',
      player1_score: 5,
      player2_score: 3,
      winner_id: 'user-marie-002',
      game_mode: 'classic',
      duration_seconds: 250,
      days_ago: 7
    }
  ];

  // Créer des matchs historiques pour STÉPHANE
  const stephaneMatches = [
    // Stéphane vs Julia (Julia gagne 5-2)
    {
      player1_id: 'user-stephane-003',
      player2_id: 'user-julia-004',
      player1_score: 2,
      player2_score: 5,
      winner_id: 'user-julia-004',
      game_mode: 'classic',
      duration_seconds: 250,
      days_ago: 24
    },
    // Stéphane vs IA Easy (Stéphane gagne 5-4)
    {
      player1_id: 'user-stephane-003',
      player2_id: null,
      opponent_name: 'IA (Facile)',
      player1_score: 5,
      player2_score: 4,
      winner_id: 'user-stephane-003',
      game_mode: 'classic',
      duration_seconds: 290,
      days_ago: 5
    },
    // Stéphane vs Julia (Julia gagne 5-1)
    {
      player1_id: 'user-stephane-003',
      player2_id: 'user-julia-004',
      player1_score: 1,
      player2_score: 5,
      winner_id: 'user-julia-004',
      game_mode: 'classic',
      duration_seconds: 210,
      days_ago: 1
    }
  ];

  // Créer des matchs historiques pour JULIA
  const juliaMatches = [
    // Julia vs IA Easy (Julia gagne 5-2)
    {
      player1_id: 'user-julia-004',
      player2_id: null,
      opponent_name: 'IA (Facile)',
      player1_score: 5,
      player2_score: 2,
      winner_id: 'user-julia-004',
      game_mode: 'classic',
      duration_seconds: 240,
      days_ago: 6
    }
  ];

  // Combiner tous les matchs et les trier par date (du plus ancien au plus récent)
  const allMatches = [...thomasMatches, ...marieMatches, ...stephaneMatches, ...juliaMatches]
    .sort((a, b) => b.days_ago - a.days_ago);

  const insertMatch = db.prepare(`
    INSERT INTO matches (
      player1_id, player2_id, opponent_name,
      player1_score, player2_score, winner_id,
      status, game_mode, duration_seconds,
      player1_ranking_after, player2_ranking_after,
      started_at, ended_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, 
      datetime('now', '-' || ? || ' days', '-' || ? || ' seconds'), 
      datetime('now', '-' || ? || ' days'), 
      datetime('now', '-' || ? || ' days', '-' || ? || ' seconds'))
  `);

  // Insérer les matchs en calculant les ranking points progressivement
  for (const match of allMatches) {
    // Calculer les nouveaux points
    if (match.player2_id) {
      // Match PvP
      if (match.winner_id === match.player1_id) {
        rankingPoints[match.player1_id] += 25;
        rankingPoints[match.player2_id] -= 15;
      } else {
        rankingPoints[match.player1_id] -= 15;
        rankingPoints[match.player2_id] += 25;
      }
    } else {
      // Match vs IA (seulement player1 gagne/perd des points)
      if (match.winner_id === match.player1_id) {
        rankingPoints[match.player1_id] += 25;
      } else {
        rankingPoints[match.player1_id] -= 15;
      }
    }

    insertMatch.run(
      match.player1_id,
      match.player2_id || null,
      match.opponent_name || null,
      match.player1_score,
      match.player2_score,
      match.winner_id,
      match.game_mode,
      match.duration_seconds,
      rankingPoints[match.player1_id],
      match.player2_id ? rankingPoints[match.player2_id] : null,
      match.days_ago,
      match.duration_seconds,
      match.days_ago,
      match.days_ago,
      match.duration_seconds + 60
    );
  }

  console.log(`✓ ${allMatches.length} matchs créés`);

  // Calculer les stats finales pour chaque utilisateur
  const stats = {};
  
  for (const userId of Object.keys(rankingPoints)) {
    stats[userId] = {
      total_matches: 0,
      wins: 0,
      losses: 0,
      total_points_scored: 0,
      total_points_conceded: 0,
      ranking_points: rankingPoints[userId]
    };
  }

  // Parcourir tous les matchs pour calculer les stats
  for (const match of allMatches) {
    // Stats player1
    stats[match.player1_id].total_matches++;
    stats[match.player1_id].total_points_scored += match.player1_score;
    stats[match.player1_id].total_points_conceded += match.player2_score;
    
    if (match.winner_id === match.player1_id) {
      stats[match.player1_id].wins++;
    } else {
      stats[match.player1_id].losses++;
    }

    // Stats player2 (si ce n'est pas un match contre IA)
    if (match.player2_id) {
      stats[match.player2_id].total_matches++;
      stats[match.player2_id].total_points_scored += match.player2_score;
      stats[match.player2_id].total_points_conceded += match.player1_score;
      
      if (match.winner_id === match.player2_id) {
        stats[match.player2_id].wins++;
      } else {
        stats[match.player2_id].losses++;
      }
    }
  }

  const insertStats = db.prepare(`
    INSERT INTO game_stats (
      user_id, total_matches, wins, losses, draws,
      total_points_scored, total_points_conceded,
      win_streak, best_win_streak, ranking_points
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?)
  `);

  for (const [userId, stat] of Object.entries(stats)) {
    const bestStreak = Math.min(stat.wins, 4);
    
    insertStats.run(
      userId,
      stat.total_matches,
      stat.wins,
      stat.losses,
      stat.total_points_scored,
      stat.total_points_conceded,
      bestStreak,
      stat.ranking_points
    );
  }

  console.log('✓ Statistiques créées');

  // Créer des relations d'amitié
  const friendships = [
    {
      user_id: 'user-thomas-001',
      friend_id: 'user-marie-002',
      status: 'accepted'
    },
    {
      user_id: 'user-thomas-001',
      friend_id: 'user-julia-004',
      status: 'accepted'
    },
    {
      user_id: 'user-marie-002',
      friend_id: 'user-stephane-003',
      status: 'accepted'
    },
    {
      user_id: 'user-julia-004',
      friend_id: 'user-stephane-003',
      status: 'pending'
    }
  ];

  const insertFriendship = db.prepare(`
    INSERT INTO friendships (user_id, friend_id, status, created_at)
    VALUES (?, ?, ?, datetime('now', '-20 days'))
  `);

  for (const friendship of friendships) {
    insertFriendship.run(
      friendship.user_id,
      friendship.friend_id,
      friendship.status
    );
  }

  console.log(`✓ ${friendships.length} relations d'amitié créées`);

  console.log('✅ Base de données remplie avec succès !');
  console.log('\nUtilisateurs créés :');
  console.log('  - Thomas (Tom) - thomas@superpong.fr - ' + rankingPoints['user-thomas-001'] + ' pts');
  console.log('  - Marie - marie@superpong.fr - ' + rankingPoints['user-marie-002'] + ' pts');
  console.log('  - Stéphane (Stef) - stephane@superpong.fr - ' + rankingPoints['user-stephane-003'] + ' pts');
  console.log('  - Julia - julia@superpong.fr - ' + rankingPoints['user-julia-004'] + ' pts');
  console.log('\nMot de passe pour tous : pwd123');
}

// Exécuter le script
fillDatabase()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur lors du remplissage:', error);
    db.close();
    process.exit(1);
  });