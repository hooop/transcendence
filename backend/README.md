# Backend ft_transcendence - Fastify avec PostgreSQL

Backend pour le projet ft_transcendence utilisant **Fastify** (Node.js) et **PostgreSQL**.

## 🚀 Démarrage rapide

### Prérequis
- Docker et Docker Compose
- Node.js 20+ (pour développement local)

### Lancer le projet avec Docker

```bash
# À la racine du projet
docker-compose up -d

# Vérifier les logs
docker-compose logs -f backend
```

### Installation locale (développement)

```bash
cd backend
npm install
npm run dev
```

## 📦 Structure du projet

```
backend/
├── src/
│   ├── config/           # Configuration (DB, JWT, etc.)
│   ├── routes/           # Routes de l'API
│   │   ├── auth.js       # Authentification (register, login)
│   │   ├── users.js      # Gestion des utilisateurs
│   │   ├── matches.js    # Gestion des matchs
│   │   └── health.js     # Health check
│   ├── plugins/          # Plugins Fastify personnalisés
│   ├── services/         # Logique métier
│   ├── models/           # Modèles de données
│   ├── utils/            # Utilitaires
│   ├── migrations/       # Migrations SQL
│   └── server.js         # Point d'entrée
├── package.json
├── Dockerfile
└── README.md
```

## 🗄️ Base de données

### Exécuter les migrations

```bash
# Avec Docker
docker-compose exec backend npm run migrate

# En local
npm run migrate
```

### Tables créées
- **users** - Utilisateurs
- **friendships** - Relations d'amitié
- **matches** - Matchs de Pong
- **game_stats** - Statistiques de jeu
- **messages** - Messages de chat
- **tournaments** - Tournois
- **tournament_participants** - Participants aux tournois

## 🔌 API Endpoints

### Authentification (`/api/auth`)
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/logout` - Se déconnecter (authentifié)
- `GET /api/auth/me` - Obtenir l'utilisateur connecté (authentifié)

### Utilisateurs (`/api/users`)
- `GET /api/users` - Liste des utilisateurs
- `GET /api/users/:id` - Profil d'un utilisateur
- `GET /api/users/:id/matches` - Historique des matchs
- `GET /api/users/:id/stats` - Statistiques

### Matchs (`/api/matches`)
- `GET /api/matches` - Liste des matchs
- `POST /api/matches` - Créer un match (authentifié)
- `GET /api/matches/:id` - Détails d'un match
- `PATCH /api/matches/:id` - Mettre à jour un match (authentifié)
- `DELETE /api/matches/:id` - Supprimer un match (authentifié)

### Santé
- `GET /health` - Vérifier l'état du serveur
- `GET /info` - Informations sur l'API

## 🔐 Authentification

L'API utilise **JWT** (JSON Web Tokens) pour l'authentification.

### Exemple d'utilisation

```bash
# 1. S'inscrire
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "email": "player1@example.com",
    "password": "password123",
    "display_name": "Player One"
  }'

# 2. Se connecter
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "password": "password123"
  }'

# Réponse : { "user": {...}, "token": "eyJhbG..." }

# 3. Utiliser le token pour les routes authentifiées
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbG..."
```

## 🧪 Tests

```bash
npm test
```

## 📝 Variables d'environnement

Les variables sont définies dans `.env` à la racine du projet :

```env
# PostgreSQL
POSTGRES_USER=transcendence
POSTGRES_PASSWORD=transcendence123
POSTGRES_DB=transcendence

# Backend
NODE_ENV=development
BACKEND_PORT=3000
JWT_SECRET=your-super-secret-jwt-key

# Database URL
DATABASE_URL=postgresql://transcendence:transcendence123@postgres:5432/transcendence
```

## 🔧 Commandes utiles

```bash
# Redémarrer le backend
docker-compose restart backend

# Voir les logs
docker-compose logs -f backend

# Accéder au shell du container
docker-compose exec backend sh

# Accéder à PostgreSQL
docker-compose exec postgres psql -U transcendence -d transcendence

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (⚠️ supprime la DB)
docker-compose down -v
```

