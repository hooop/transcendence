# 📚 ft_transcendence - Guide Complet du Projet

**Ce document explique EN DÉTAIL tout ce qui a été mis en place pour ft_transcendence.**

Prenez le temps de le lire. À la fin, vous comprendrez comment tout fonctionne !

---

## 📖 Table des matières

1. [Qu'est-ce que ft_transcendence ?](#1-quest-ce-que-ft_transcendence-)
2. [Architecture Globale](#2-architecture-globale)
3. [Vite - L'Outil de Build Frontend](#3-vite---loutil-de-build-frontend)
4. [Le Backend - Serveur API](#4-le-backend---serveur-api)
5. [PostgreSQL - La Base de Données](#5-postgresql---la-base-de-données)
6. [Le Jeu Pong - Explication Complète](#6-le-jeu-pong---explication-complète)
7. [Authentification et Sécurité](#7-authentification-et-sécurité)
8. [Docker - Conteneurisation](#8-docker---conteneurisation)
9. [Système d'Amis](#9-système-damis)
10. [Comment Utiliser ce Projet](#10-comment-utiliser-ce-projet)
11. [Prochaines Étapes](#11-prochaines-étapes)

---

## 1. Qu'est-ce que ft_transcendence ?

**ft_transcendence** est un projet web complet qui implémente :

- 🏓 **Un jeu Pong multijoueur** en temps réel
- 👤 **Système d'authentification** (inscription, connexion, OAuth42)
- 👥 **Système d'amis** (ajout, acceptation, refus)
- 📊 **Statistiques de jeu** (victoires, défaites, classement)
- 🏆 **Tournois** (système de brackets)
- 💬 **Chat en temps réel** (WebSocket)

### 🧠 L'Analogie du Restaurant

Imaginez l'application comme un restaurant :

- **Frontend** (ce que vous voyez) = La salle du restaurant, le menu, les serveurs
- **Backend** (invisible) = La cuisine, les chefs, la gestion des commandes
- **Base de données** = Le réfrigérateur et les placards (stockage permanent)
- **Docker** = Le conteneur qui emballe tout le restaurant pour le transporter

---

## 2. Architecture Globale

```
┌─────────────────────────────────────────────────────────┐
│                    ft_transcendence                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  HTTP/WS   ┌──────────────┐  SQL    │
│  │   Frontend   │◄──────────►│   Backend    │◄────────┤
│  │   (Vite)     │            │  (Fastify)   │         │
│  │              │            │              │         │
│  │ - TypeScript │            │ - API REST   │         │
│  │ - Canvas 2D  │            │ - WebSocket  │  ┌──────┴─────┐
│  │ - Pong Game  │            │ - Auth JWT   │  │ PostgreSQL │
│  │ - UI/Router  │            │ - Bcrypt     │  │            │
│  └──────────────┘            └──────────────┘  │ - users    │
│       :8080                       :3000        │ - matches  │
│                                                 │ - stats    │
└─────────────────────────────────────────────────│ - friends  │
                                                  └────────────┘
                      Docker Network                   :5432
```

### 🔄 Flux d'une Requête

```
1. User clique "Play Pong" dans le frontend
   ↓
2. Frontend → GET /api/users/me (avec JWT token)
   ↓
3. Backend vérifie le token JWT
   ↓
4. Backend → PostgreSQL: SELECT * FROM users WHERE id = $1
   ↓
5. PostgreSQL renvoie les données
   ↓
6. Backend → Frontend: { user: { id, username, stats } }
   ↓
7. Frontend initialise le jeu Pong avec les données user
```

---

## 3. Vite - L'Outil de Build Frontend

### ⚡ Qu'est-ce que Vite ?

**Vite** (prononcé "vit", du français "rapide") est un **outil de build** ultra-rapide pour le développement frontend.

#### Analogie : Le Restaurant Rapide vs Traditionnel

**Restaurant Traditionnel (Webpack)** :
- Prépare TOUS les plats à l'avance
- Démarrage : 30-60 secondes

**Restaurant Rapide (Vite)** :
- Ne prépare QUE les plats commandés
- Démarrage : 1-2 secondes

### 🎯 Les 3 Rôles de Vite

#### 1. **Serveur de Développement Ultra-Rapide** 🔥

```bash
cd frontend
npm run dev
# ✓ Ready in 523ms
```

Vite sert les fichiers **SANS les compiler tous** ! Il utilise les **ES Modules (ESM)** natifs du navigateur.

#### 2. **Hot Module Replacement (HMR)** 🔄

Quand vous modifiez un fichier :
- ⚡ Mise à jour **instantanée** (< 50ms)
- 🎮 Le jeu continue de tourner
- 💾 L'état est préservé

#### 3. **Build de Production Optimisé** 📦

```bash
npm run build
# ✓ 154 modules transformed in 2.35s
```

**Optimisations automatiques** :
- Minification (réduit la taille de 70%)
- Tree-shaking (supprime le code mort)
- Code splitting (chargement à la demande)

---

## 4. Le Backend - Serveur API

### ⚡ Fastify - Le Framework

Fastify est un framework Node.js **ultra-rapide** qui gère les requêtes HTTP.

### 🗺️ Les Routes de l'API

#### **Authentification** (`/api/auth`)

```
POST   /api/auth/register    → Créer un compte
POST   /api/auth/login       → Se connecter
GET    /api/auth/me          → Infos utilisateur connecté
GET    /api/auth/42          → OAuth 42 (redirection)
GET    /api/auth/42/callback → Callback OAuth 42
```

#### **Utilisateurs** (`/api/users`)

```
GET    /api/users            → Liste des utilisateurs
GET    /api/users/:id        → Profil d'un utilisateur
GET    /api/users/:id/stats  → Statistiques
```

#### **Matchs** (`/api/matches`)

```
GET    /api/matches          → Liste des matchs
POST   /api/matches          → Créer un match
PATCH  /api/matches/:id      → Mettre à jour (score, winner)
```

#### **Amis** (`/api/friendships`)

```
GET    /api/friendships                  → Liste des amis
GET    /api/friendships/pending          → Demandes en attente
GET    /api/friendships/search?query=... → Rechercher
POST   /api/friendships                  → Envoyer demande
PATCH  /api/friendships/:id              → Accepter/refuser
DELETE /api/friendships/:id              → Supprimer
```

### 📊 Codes de Statut HTTP

| Code | Signification | Exemple |
|------|---------------|---------|
| 200  | OK            | Données récupérées |
| 201  | Created       | Utilisateur créé |
| 400  | Bad Request   | Données invalides |
| 401  | Unauthorized  | Token manquant/invalide |
| 404  | Not Found     | Ressource introuvable |
| 409  | Conflict      | Username déjà pris |
| 500  | Server Error  | Erreur backend |

---

## 5. PostgreSQL - La Base de Données

### 🗄️ Les Tables

#### 1️⃣ **Table `users`** - Les Utilisateurs

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    is_online BOOLEAN DEFAULT false,
    oauth_provider VARCHAR(50),     -- '42', 'google'
    oauth_id VARCHAR(255),           -- ID chez le provider
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2️⃣ **Table `friendships`** - Les Amitiés

```sql
CREATE TABLE friendships (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    friend_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Exemple** :
```
| user_id (Alice) | friend_id (Bob) | status   |
|-----------------|-----------------|----------|
| uuid-alice      | uuid-bob        | accepted |
```

#### 3️⃣ **Table `matches`** - Les Matchs de Pong

```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY,
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    winner_id UUID REFERENCES users(id),
    status VARCHAR(20),                -- pending, in_progress, completed
    game_mode VARCHAR(50),             -- classic, tournament, ranked
    duration_seconds INTEGER,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);
```

#### 4️⃣ **Table `game_stats`** - Statistiques

```sql
CREATE TABLE game_stats (
    user_id UUID UNIQUE REFERENCES users(id),
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_points_scored INTEGER DEFAULT 0,
    total_points_conceded INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_win_streak INTEGER DEFAULT 0,
    ranking_points INTEGER DEFAULT 1000  -- Points ELO
);
```

### 🔍 Concepts Importants

#### **Relations entre tables**

```
users (id: 1) ──┐
                ├── matches (player1_id: 1, player2_id: 2)
users (id: 2) ──┘
```

#### **Index** (pour la performance)

```sql
CREATE INDEX idx_users_username ON users(username);
-- Recherche 100x plus rapide !
```

#### **Migrations**

Un script SQL qui crée/modifie la structure de la DB :

```bash
docker-compose exec backend npm run migrate
# Exécute 001_initial_schema.sql, 002_add_oauth.sql, etc.
```

---

## 6. Le Jeu Pong - Explication Complète

### 🏓 Architecture du Jeu

Le jeu Pong est **entièrement côté frontend** (TypeScript + Canvas 2D). Il utilise une architecture orientée objet.

```
PongGame (Class principale)
├── Ball (Balle)
├── Paddle (Raquette gauche)
├── Paddle (Raquette droite)
└── AIPlayer (Intelligence artificielle)
```

### 🎮 Les Classes du Jeu

#### **1. PongGame** - Le Moteur Principal

```typescript
class PongGame {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private config: GameConfig
    private state: GameState

    private ball: Ball
    private leftPaddle: Paddle
    private rightPaddle: Paddle
    private ai?: AIPlayer
}
```

**Responsabilités** :
- Initialiser le jeu
- Gérer la boucle de jeu (game loop)
- Détecter les collisions
- Gérer le score
- Afficher le rendu (render)

#### **2. Ball** - La Balle

```typescript
class Ball {
    public position: Vector2D        // { x, y }
    public velocity: Vector2D        // Vitesse et direction
    public size: number
    private baseSpeed: number
}
```

**Physique de la balle** :

```typescript
update(deltaTime: number): void {
    // 1. Déplacer la balle selon sa vitesse
    this.position.x += this.velocity.x * deltaTime
    this.position.y += this.velocity.y * deltaTime

    // 2. Rebond sur les bords haut/bas
    if (this.position.y <= this.size/2) {
        this.velocity.y = -this.velocity.y  // Inverser direction Y
    }
}
```

**Direction initiale aléatoire** :

```typescript
const direction = Math.random() > 0.5 ? 1 : -1  // Gauche ou droite
const angle = (Math.random() - 0.5) * Math.PI / 3  // Entre -30° et +30°

this.velocity = {
    x: direction * ballSpeed * Math.cos(angle),
    y: ballSpeed * Math.sin(angle)
}
```

**Augmentation progressive de vitesse** :

```typescript
increaseSpeed(percentage: number): void {
    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2)
    const newSpeed = currentSpeed * (1 + percentage / 100)

    // Appliquer la nouvelle vitesse en gardant la direction
    const angle = Math.atan2(this.velocity.y, this.velocity.x)
    this.velocity.x = newSpeed * Math.cos(angle)
    this.velocity.y = newSpeed * Math.sin(angle)
}
```

#### **3. Paddle** - Les Raquettes

```typescript
class Paddle {
    public position: Vector2D
    public width: number
    public height: number
    private moveDirection: number = 0  // -1 (haut), 0 (stop), 1 (bas)
}
```

**Mouvement fluide** :

```typescript
update(deltaTime: number): void {
    if (this.moveDirection === 0) return

    // Calculer nouvelle position
    const newY = this.position.y + (this.moveDirection * paddleSpeed * deltaTime)

    // Limiter aux bords de l'écran
    const minY = this.height / 2
    const maxY = this.config.height - this.height / 2
    this.position.y = Math.max(minY, Math.min(maxY, newY))
}
```

**Détection de collision avec la balle** :

```typescript
checkCollision(ballPosition: Vector2D, ballSize: number): boolean {
    const ballRadius = ballSize / 2
    const paddleLeft = this.position.x - this.width / 2
    const paddleRight = this.position.x + this.width / 2
    const paddleTop = this.position.y - this.height / 2
    const paddleBottom = this.position.y + this.height / 2

    // Vérifier si la balle touche la raquette
    return (
        ballPosition.x - ballRadius < paddleRight &&
        ballPosition.x + ballRadius > paddleLeft &&
        ballPosition.y - ballRadius < paddleBottom &&
        ballPosition.y + ballRadius > paddleTop
    )
}
```

### 🎯 La Boucle de Jeu (Game Loop)

Le cœur du jeu est une boucle infinie qui se répète 60 fois par seconde :

```typescript
private gameLoop = (currentTime: number): void => {
    // 1. Calculer le temps écoulé depuis la dernière frame
    const deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // 2. Mettre à jour la logique du jeu
    this.update(deltaTime)

    // 3. Dessiner le nouveau frame
    this.render()

    // 4. Demander le prochain frame
    this.animationFrame = requestAnimationFrame(this.gameLoop)
}
```

**Pourquoi deltaTime ?**

Sans deltaTime, le jeu tournerait à des vitesses différentes selon la puissance de l'ordinateur.

```
Ordinateur puissant : 120 FPS → Balle très rapide
Ordinateur lent : 30 FPS → Balle lente

Avec deltaTime :
- deltaTime = 1/120 = 0.0083s (PC puissant)
- deltaTime = 1/30 = 0.033s (PC lent)
- position += velocity * deltaTime
→ Même vitesse réelle sur tous les PC !
```

### 🎨 Le Rendu (Rendering)

À chaque frame, on redessine tout l'écran :

```typescript
private render(): void {
    // 1. Effacer l'écran (fond noir)
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.config.width, this.config.height)

    // 2. Dessiner la ligne centrale (pointillés)
    this.ctx.strokeStyle = '#fff'
    this.ctx.setLineDash([5, 5])
    this.ctx.beginPath()
    this.ctx.moveTo(this.config.width / 2, 0)
    this.ctx.lineTo(this.config.width / 2, this.config.height)
    this.ctx.stroke()

    // 3. Dessiner les raquettes et la balle
    this.leftPaddle.render(this.ctx)
    this.rightPaddle.render(this.ctx)
    this.ball.render(this.ctx)

    // 4. Dessiner le score
    this.ctx.fillStyle = '#fff'
    this.ctx.font = '48px monospace'
    this.ctx.fillText(this.state.leftScore.toString(), width/4, 60)
    this.ctx.fillText(this.state.rightScore.toString(), width*3/4, 60)
}
```

### ⚽ Détection des Collisions

#### **Collision Raquette-Balle**

```typescript
private checkPaddleCollisions(): void {
    // Collision avec raquette de gauche
    if (this.ball.velocity.x < 0 &&  // Balle va vers la gauche
        this.leftPaddle.checkCollision(this.ball.position, this.ball.size)) {

        // Inverser la direction horizontale
        this.ball.velocity.x = -this.ball.velocity.x

        // Ajouter un effet selon où la balle touche
        const paddleCenter = this.leftPaddle.position.y
        const hitPosition = (this.ball.position.y - paddleCenter) / (this.leftPaddle.height / 2)
        this.ball.velocity.y += hitPosition * 100
        //   ↑
        //   Si la balle touche en haut de la raquette : effet vers le haut
        //   Si elle touche en bas : effet vers le bas
    }
}
```

**Schéma de l'effet** :

```
Raquette         Effet sur la balle
┌──────┐
│  ↑   │ ─────→  Balle monte fortement
│  │   │
├──────┤ ─────→  Balle va tout droit (centre)
│  │   │
│  ↓   │ ─────→  Balle descend fortement
└──────┘
```

### 🏆 Gestion du Score

```typescript
private checkScoring(): void {
    const outOfBounds = this.ball.isOutOfBounds()

    if (outOfBounds === 'left') {
        // Point pour le joueur de droite
        this.state.rightScore++
        this.ball.reset()
        this.ball.resetSpeed()
    } else if (outOfBounds === 'right') {
        // Point pour le joueur de gauche
        this.state.leftScore++
        this.ball.reset()
        this.ball.resetSpeed()
    }
}

private checkWinCondition(): void {
    const winScore = 5  // Premier à 5 points

    if (this.state.leftScore >= winScore) {
        this.state.winner = 'left'
        this.state.isRunning = false
        console.log('🏆 Left player wins!')
    }
}
```

### 🎮 Contrôles Clavier

```typescript
private keys: Set<string> = new Set()  // Touches actuellement pressées

document.addEventListener('keydown', (e) => {
    if (this.isGameKey(e.key)) {
        e.preventDefault()  // Empêcher scroll de la page
    }
    this.keys.add(e.key.toLowerCase())
})

private handleInput(): void {
    // Joueur de gauche (W/S)
    if (this.keys.has('w')) {
        this.leftPaddle.setMoveDirection(-1)  // Monter
    } else if (this.keys.has('s')) {
        this.leftPaddle.setMoveDirection(1)   // Descendre
    } else {
        this.leftPaddle.setMoveDirection(0)   // Stop
    }

    // Joueur de droite (Flèches)
    if (!this.isAIEnabled) {
        if (this.keys.has('arrowup')) {
            this.rightPaddle.setMoveDirection(-1)
        }
        // ...
    }
}
```

**Pourquoi un Set ?** Permet de détecter plusieurs touches en même temps !

### 🤖 Intelligence Artificielle

L'IA prédit où la balle va aller et se déplace vers cette position :

```typescript
class AIPlayer {
    update(paddle: Paddle, ball: Ball, deltaTime: number): void {
        // 1. Prédire où la balle va arriver
        const predictedY = this.predictBallY(ball)

        // 2. Ajouter une erreur selon la difficulté
        const error = (Math.random() - 0.5) * this.config.errorMargin
        const targetY = predictedY + error

        // 3. Se déplacer vers la position prédite
        if (paddle.position.y < targetY - 10) {
            this.desiredDirection = 1   // Descendre
        } else if (paddle.position.y > targetY + 10) {
            this.desiredDirection = -1  // Monter
        } else {
            this.desiredDirection = 0   // Stop
        }
    }
}
```

**Niveaux de difficulté** :

| Difficulté | Vitesse | Marge d'erreur | Temps de réaction |
|------------|---------|----------------|-------------------|
| EASY       | 70%     | ±80 pixels     | 300ms             |
| MEDIUM     | 85%     | ±40 pixels     | 200ms             |
| HARD       | 100%    | ±15 pixels     | 100ms             |

---

## 7. Authentification et Sécurité

### 🎫 JWT - JSON Web Token

Un JWT est un **token crypté** qui contient des informations sur l'utilisateur.

#### Structure d'un JWT

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiaWF0IjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

[Header].[Payload].[Signature]
```

1. **Header** : Algorithme de chiffrement
2. **Payload** : Données utilisateur (`{ userId: 123 }`)
3. **Signature** : Garantit que le token n'a pas été modifié

#### Flux JWT

```
1. User se connecte avec username + password
   ↓
2. Backend vérifie les identifiants
   ↓
3. Backend crée un JWT
   const token = jwt.sign({ id: user.id, username: user.username }, 'secret')
   ↓
4. Frontend reçoit et stocke le token (localStorage)
   ↓
5. Chaque requête inclut le token
   Authorization: Bearer eyJhbG...
   ↓
6. Backend vérifie le token
   const decoded = jwt.verify(token, 'secret')
   → Si valide : { id: 123, username: "alice" }
   → Si invalide : 401 Unauthorized
```

### 🔒 Bcrypt - Hashage de Mots de Passe

**Problème** : On ne peut PAS stocker les mots de passe en clair !

**Solution** : Hasher avec bcrypt

```javascript
// Inscription
const passwordHash = await bcrypt.hash("password123", 10)
// → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Connexion
const validPassword = await bcrypt.compare("password123", passwordHash)
// → true
```

**Pourquoi bcrypt et pas SHA256 ?**
- SHA256 est trop rapide (attaquant = milliards de tests/seconde)
- Bcrypt est **intentionnellement lent**
- Ajoute un **salt** unique par mot de passe

```
alice : "password123" → $2b$10$abc...
bob   : "password123" → $2b$10$xyz...  (différent !)
```

### 🛡️ OAuth 42

Permet de se connecter avec son compte 42 :

```
1. User clique "Sign in with 42"
   ↓
2. Redirection vers api.intra.42.fr
   ↓
3. User autorise l'application
   ↓
4. 42 redirige vers /api/auth/42/callback?code=...
   ↓
5. Backend échange le code contre un access_token
   ↓
6. Backend récupère les infos user depuis api.intra.42.fr/v2/me
   ↓
7. Backend cherche/crée l'utilisateur dans la DB
   ↓
8. Backend génère un JWT
   ↓
9. Frontend reçoit le token et redirige vers dashboard
```

---

## 8. Docker - Conteneurisation

### 🐳 Architecture Docker

```
┌─────────────────────────────────────────────┐
│              Docker Network                 │
│  (transcendence_network)                    │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ postgres │  │ backend  │  │ frontend │ │
│  │  :5432   │←─│  :3000   │←─│  :8080   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│       ↓                                     │
│  ┌──────────┐                               │
│  │ Volume   │ (données persistantes)        │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

### 📋 docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: transcendence
      POSTGRES_PASSWORD: transcendence123
      POSTGRES_DB: transcendence
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U transcendence"]
      interval: 10s

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://transcendence:transcendence123@postgres:5432/transcendence
      JWT_SECRET: your-super-secret-jwt-key
    ports:
      - "3000:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "8080:8080"
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

---

## 9. Système d'Amis

### 📊 Flux Complet

```
1. Alice recherche "bob"
   GET /api/friendships/search?query=bob
   ↓
2. Alice envoie une demande
   POST /api/friendships { friend_id: "uuid-bob" }
   ↓
   INSERT INTO friendships (user_id, friend_id, status)
   VALUES ('uuid-alice', 'uuid-bob', 'pending')
   ↓
3. Bob voit la demande
   GET /api/friendships/pending
   → [{ id: "...", user: { username: "alice" }, status: "pending" }]
   ↓
4. Bob accepte
   PATCH /api/friendships/:id { status: "accepted" }
   ↓
   UPDATE friendships SET status = 'accepted' WHERE id = $1
   ↓
5. Alice et Bob sont amis !
   GET /api/friendships
   → [{ friend: { username: "bob", is_online: true } }]
```

---

## 10. Comment Utiliser ce Projet

### 🚀 Démarrage Rapide

```bash
# 1. Cloner le projet
cd /home/sviallon/Desktop/ft_transcendence

# 2. Lancer les services
docker-compose up -d

# 3. Exécuter les migrations (une seule fois)
docker-compose exec backend npm run migrate

# 4. Accéder à l'application
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
```

### 🧪 Tester l'API avec curl

#### Créer un compte

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123"
  }'
```

Réponse :
```json
{
  "user": {
    "id": "550e8400-...",
    "username": "alice",
    "email": "alice@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Utiliser une route protégée

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 🎮 Jouer au Pong

1. Créer un compte / Se connecter
2. Aller dans l'onglet "Play"
3. Choisir "vs AI" ou "Local 2 Players"
4. Appuyer sur ESPACE pour commencer

**Contrôles** :
- Joueur gauche : W (haut) / S (bas)
- Joueur droite : ↑ (haut) / ↓ (bas)
- Restart : R

### 🛠️ Commandes Utiles

```bash
# Voir les logs en temps réel
docker-compose logs -f

# Arrêter les services
docker-compose down

# Rebuild après modification du Dockerfile
docker-compose up -d --build

# Accéder au conteneur backend
docker-compose exec backend sh

# Accéder à PostgreSQL
docker-compose exec postgres psql -U transcendence -d transcendence

# Voir toutes les tables
\dt

# Voir tous les users
SELECT * FROM users;

# Quitter
\q
```

---

## 11. Prochaines Étapes

### ✅ Déjà Implémenté

- [x] Backend Fastify avec API REST
- [x] Base de données PostgreSQL
- [x] Authentification (register, login, JWT)
- [x] OAuth 42
- [x] Système d'amis complet
- [x] Jeu Pong local (vs AI, 2 joueurs)
- [x] Statistiques de jeu
- [x] Docker avec docker-compose

### 🚧 À Faire

- [ ] **WebSocket pour Pong multijoueur en temps réel**
  - Synchronisation de la balle entre 2 joueurs
  - Latency compensation

- [ ] **Chat en temps réel**
  - Messages privés
  - Salons de chat
  - Notifications

- [ ] **Système de tournois**
  - Brackets à élimination directe
  - Génération automatique des matchs

- [ ] **Upload d'avatars**
  - Upload d'images
  - Resize et crop

- [ ] **Classement ELO**
  - Système de ranking
  - Leaderboard

### 🎯 Modules du Sujet

| Module | Status | Description |
|--------|--------|-------------|
| Web Backend | ✅ | Fastify + PostgreSQL |
| Base de données | ✅ | PostgreSQL avec migrations |
| Authentification | ✅ | JWT + bcrypt + OAuth42 |
| Jeu Pong | ✅ | Local 2P + AI |
| Système d'amis | ✅ | Complet |
| Chat | ⏳ | À faire (WebSocket) |
| Tournois | ⏳ | Partiellement (DB prête) |

---

## 📚 Glossaire

| Terme | Définition |
|-------|------------|
| **API** | Interface pour que deux apps communiquent |
| **REST** | Architecture pour créer des APIs avec HTTP |
| **Backend** | Serveur (logique + DB) |
| **Frontend** | Interface utilisateur |
| **PostgreSQL** | Base de données relationnelle |
| **JWT** | Token crypté pour l'authentification |
| **Bcrypt** | Algorithme de hashage sécurisé |
| **WebSocket** | Protocole temps réel bidirectionnel |
| **Docker** | Conteneurisation d'applications |
| **Fastify** | Framework web ultra-rapide pour Node.js |
| **Vite** | Outil de build frontend |
| **Canvas 2D** | API pour dessiner en 2D dans le navigateur |
| **Game Loop** | Boucle infinie qui met à jour et affiche le jeu |
| **deltaTime** | Temps écoulé entre deux frames |

---

## 📖 Ressources

- **Fastify** : https://www.fastify.io/
- **PostgreSQL** : https://www.postgresql.org/docs/
- **JWT** : https://jwt.io/
- **Vite** : https://vitejs.dev/
- **Canvas API** : https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Docker** : https://docs.docker.com/
- **TypeScript** : https://www.typescriptlang.org/docs/

---

## 🎉 Conclusion

Vous avez maintenant un projet **complet et fonctionnel** pour ft_transcendence !

**Ce que vous avez** :
- ✅ Backend sécurisé avec API REST
- ✅ Base de données PostgreSQL bien structurée
- ✅ Authentification robuste (JWT + OAuth42)
- ✅ Jeu Pong avec IA
- ✅ Système d'amis
- ✅ Docker pour faciliter le déploiement

**Prochaines étapes** :
1. Tester toutes les fonctionnalités
2. Implémenter le Pong multijoueur (WebSocket)
3. Ajouter le chat en temps réel
4. Finaliser les tournois

N'hésitez pas à relire ce document quand vous avez besoin de comprendre une partie spécifique !

**Bon courage pour la suite ! 🚀**
