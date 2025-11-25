const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function runMigrations() {
  const dbPath = process.env.SQLITE_PATH || './data/transcendence.db';
  const dbDir = path.dirname(dbPath);

  // Créer le dossier data s'il n'existe pas
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    console.log('✅ Connecté à la base de données SQLite');

    // Activer les foreign keys
    db.pragma('foreign_keys = ON');

    // Créer la table de tracking des migrations si elle n'existe pas
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table migrations initialisée');

    // Récupérer les migrations déjà appliquées
    const appliedMigrations = db.prepare('SELECT filename FROM migrations').all();
    const appliedSet = new Set(appliedMigrations.map(m => m.filename));

    // Lire et exécuter chaque fichier de migration
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier pour exécuter dans l'ordre

    for (const file of migrationFiles) {
      // Vérifier si la migration a déjà été appliquée
      if (appliedSet.has(file)) {
        console.log(`⏭️  Migration ${file} déjà appliquée, skip`);
        continue;
      }

      console.log(`\n📄 Exécution de la migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        db.exec(sql);
        
        // Enregistrer la migration comme appliquée
        db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
        
        console.log(`✅ Migration ${file} exécutée avec succès`);
      } catch (error) {
        console.error(`❌ Erreur lors de l'exécution de ${file}:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 Toutes les migrations ont été exécutées avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

runMigrations();