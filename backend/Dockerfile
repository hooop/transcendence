FROM node:20-slim

# Installer les outils de compilation necessaires pour better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Creer le repertoire de travail
WORKDIR /app

# Copier le script d'entrée
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copier les fichiers de dependances
COPY package*.json ./

# Copier le reste du code
COPY . .

# Exposer le port
EXPOSE 3000

# Définir l'entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Commande par defaut
CMD ["npm", "run", "dev"]