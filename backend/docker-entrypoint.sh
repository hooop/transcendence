#!/bin/sh
set -e

# Vérifier si node_modules existe et contient des fichiers
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo "🔧 Reconstruction de better-sqlite3..."
    npm rebuild better-sqlite3
else
    # Vérifier si better-sqlite3 doit être recompilé
    # On le recompile systématiquement pour s'assurer qu'il est compatible
    if [ -d "node_modules/better-sqlite3" ]; then
        echo "🔧 Reconstruction de better-sqlite3 pour Node.js $(node --version)..."
        npm rebuild better-sqlite3
    fi
fi

# Exécuter la commande passée en argument
exec "$@"
