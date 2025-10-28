FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./

# Installer les dependances
RUN npm install

# Copier tout le code source
COPY . .

# Exposer le port du serveur de dev Vite
EXPOSE 8080

# D�marrer Vite en mode developpement
CMD ["npm", "run", "dev"]
