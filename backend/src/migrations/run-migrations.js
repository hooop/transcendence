const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données PostgreSQL');

    // Lire et exécuter chaque fichier de migration
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier pour exécuter dans l'ordre

    for (const file of migrationFiles) {
      console.log(`\n📄 Exécution de la migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query(sql);
      console.log(`✅ Migration ${file} exécutée avec succès`);
    }

    console.log('\n🎉 Toutes les migrations ont été exécutées avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
