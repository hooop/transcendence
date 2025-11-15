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

    // Lire et exécuter chaque fichier de migration
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier pour exécuter dans l'ordre

    for (const file of migrationFiles) {
      console.log(`\n📄 Exécution de la migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        db.exec(sql);
        console.log(`✅ Migration ${file} exécutée avec succès`);
      } catch (error) {
        // Ignorer l'erreur si la colonne existe déjà (pour 002_add_oauth_support.sql)
        if (error.message.includes('duplicate column name')) {
          console.log(`⚠️  Migration ${file} déjà appliquée (colonnes existantes)`);
        } else {
          throw error;
        }
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
