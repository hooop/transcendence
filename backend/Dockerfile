FROM node:20-alpine

# Creer le repertoire de travail
WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./

# Installer les dependances
RUN npm install

# Copier le reste du code
COPY . .

# Exposer le port
EXPOSE 3000

# Commande par defaut
CMD ["npm", "run", "dev"]