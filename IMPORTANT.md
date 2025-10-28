# 📚 IMPORTANT - Guide Complet du Backend ft_transcendence

**Ce document explique EN DÉTAIL tout ce qui a été mis en place pour le backend de ft_transcendence.**

Prenez le temps de le lire, même si c'est long. À la fin, vous comprendrez comment tout fonctionne !

---

## 📖 Table des matières

1. [Vite - L'Outil de Build Frontend](#1-vite---loutil-de-build-frontend)
2. [Qu'est-ce qu'un Backend ?](#2-quest-ce-quun-backend-)
3. [PostgreSQL - La Base de Données](#3-postgresql---la-base-de-données)
4. [API REST - Comment le Frontend et le Backend Communiquent](#4-api-rest---comment-le-frontend-et-le-backend-communiquent)
5. [Fastify - Le Framework Backend](#5-fastify---le-framework-backend)
6. [Authentification et Sécurité](#6-authentification-et-sécurité)
7. [Docker - Conteneurisation](#7-docker---conteneurisation)
8. [Explication Détaillée du Code](#8-explication-détaillée-du-code)
9. [Flux Complet d'une Requête](#9-flux-complet-dune-requête)
10. [Comment Utiliser ce Backend](#10-comment-utiliser-ce-backend)

---

## 1. Vite - L'Outil de Build Frontend

### ⚡ Qu'est-ce que Vite ?

**Vite** (prononcé "vit", du français "rapide") est un **outil de build** moderne pour les applications web frontend. Il a été créé par Evan You, le créateur de Vue.js, pour résoudre les problèmes de lenteur des outils traditionnels comme Webpack.

#### Analogie : Le Restaurant Rapide vs Traditionnel

Imaginons deux restaurants qui servent le même menu :

**Restaurant Traditionnel (Webpack, Parcel)** :
- Prépare TOUS les plats du menu à l'avance (même ceux que personne ne commande)
- Quand un client arrive, il attend que toute la cuisine soit prête
- Chaque modification de recette = refaire toute la cuisine
- ⏱️ Démarrage : 30-60 secondes

**Restaurant Rapide (Vite)** :
- Ne prépare QUE les plats commandés
- Utilise des ingrédients pré-découpés (ESM)
- Modification de recette = refaire uniquement ce plat
- ⏱️ Démarrage : 1-2 secondes

### 🎯 À Quoi Sert Vite dans Notre Projet ?

Dans **ft_transcendence**, Vite est utilisé pour le **frontend** (pas le backend). Il remplit 3 rôles principaux :

#### 1. **Serveur de Développement Ultra-Rapide** 🔥

Quand vous lancez `npm run dev` dans le frontend, Vite démarre un serveur de développement.

```bash
cd frontend
npm run dev
```

**Ce qui se passe** :
```
┌─────────────────────────────────────┐
│  Vite Dev Server                    │
│  http://localhost:8080              │
│                                     │
│  ✓ Ready in 523ms                   │
└─────────────────────────────────────┘
```

Vite sert vos fichiers TypeScript/JavaScript **SANS les compiler tous à l'avance** !

**Comment ?** : Vite utilise les **ES Modules (ESM)** natifs du navigateur.

```javascript
// Votre code TypeScript
import { Game } from './game.ts';
import { Player } from './player.ts';

// Le navigateur moderne peut charger ces modules directement !
```

Vite transforme uniquement le fichier demandé par le navigateur, à la volée.

---

#### 2. **Hot Module Replacement (HMR)** 🔄

Le HMR permet de **mettre à jour le code sans recharger toute la page**.

**Scénario** :
1. Vous modifiez la couleur de la balle Pong dans `game.ts`
2. Vous sauvegardez le fichier
3. **Instantanément** (< 50ms), la couleur change dans le navigateur
4. **Le jeu continue de tourner**, l'état est préservé

**Sans HMR (rechargement classique)** :
- Le navigateur recharge toute la page
- Vous perdez l'état du jeu
- Vous devez recommencer pour tester

**Avec Vite HMR** :
- Seul le module modifié est rechargé
- L'état est préservé
- Feedback immédiat

```javascript
// Vite détecte automatiquement les changements
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // Remplacer le module à chaud
  });
}
```

---

#### 3. **Build de Production Optimisé** 📦

Quand vous êtes prêt à déployer, Vite compile et optimise tout votre code.

```bash
npm run build
```

**Ce que fait Vite** :

```
Étape 1 : Compilation TypeScript → JavaScript
  ├─ game.ts     → game.js
  ├─ player.ts   → player.js
  └─ index.ts    → index.js

Étape 2 : Bundling (Regroupement avec Rollup)
  ├─ Combiner les fichiers liés
  ├─ Éliminer le code mort (tree-shaking)
  └─ Créer des chunks optimisés

Étape 3 : Minification
  ├─ Supprimer les espaces et commentaires
  ├─ Raccourcir les noms de variables
  │  const playerPosition = 100; → const a=100;
  └─ Réduire la taille du fichier de 70%

Étape 4 : Code Splitting
  ├─ Découper en plusieurs fichiers
  ├─ index.[hash].js (10 KB)
  ├─ game.[hash].js (50 KB)
  └─ vendor.[hash].js (100 KB - librairies)

Résultat : dist/ (dossier de production)
  ├─ index.html
  ├─ assets/
  │   ├─ index-a3f8b2c1.js (minifié)
  │   ├─ game-d5e2f1a9.js (minifié)
  │   └─ styles-e8c3d5f2.css (minifié)
  └─ favicon.ico
```

**Optimisations automatiques** :
- **Minification** : Réduction de la taille des fichiers
- **Tree-shaking** : Suppression du code non utilisé
- **Code splitting** : Chargement à la demande
- **Cache busting** : Hashes dans les noms de fichiers (`game-d5e2f1a9.js`)

---

### 🔧 Configuration de Vite

Notre fichier `vite.config.ts` (s'il existe) pourrait ressembler à :

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,              // Port du serveur de dev
    host: '0.0.0.0',         // Écouter sur toutes les interfaces
    proxy: {
      '/api': {
        target: 'http://backend:3000',  // Rediriger /api vers le backend
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',          // Dossier de sortie
    sourcemap: true,         // Générer des source maps pour le debug
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['three.js'],  // Séparer les librairies externes
        }
      }
    }
  }
});
```

---

### 🌐 Vite vs Autres Outils de Build

| Outil | Vitesse Dev | Vitesse Build | HMR | Complexité |
|-------|------------|---------------|-----|-----------|
| **Vite** | ⚡⚡⚡ Très rapide | ⚡⚡ Rapide | ✅ Excellent | 😊 Simple |
| **Webpack** | 🐢 Lent | ⚡ Rapide | ✅ Bon | 😰 Complexe |
| **Parcel** | ⚡⚡ Rapide | ⚡ Moyen | ✅ Bon | 😊 Simple |
| **ESBuild** | ⚡⚡⚡ Très rapide | ⚡⚡⚡ Très rapide | ❌ Limité | 😊 Simple |

**Pourquoi Vite est plus rapide que Webpack ?**

1. **Pas de bundling en dev** : Vite sert les fichiers directement via ESM
2. **esbuild** : Vite utilise esbuild (écrit en Go) pour la transpilation TypeScript
3. **Compilation à la demande** : Seuls les fichiers requis sont transformés

**Schéma : Webpack vs Vite en Développement**

```
WEBPACK (Bundle-based)
┌────────────────────────────────────┐
│ Démarrage                          │
│ 1. Analyser TOUS les fichiers      │ ⏱️ 20s
│ 2. Compiler TOUS les fichiers      │
│ 3. Bundler TOUS les fichiers       │
│ 4. Servir le bundle                │
└────────────────────────────────────┘

VITE (ESM-based)
┌────────────────────────────────────┐
│ Démarrage                          │
│ 1. Démarrer le serveur             │ ⏱️ 1s
│ 2. Attendre les requêtes           │
│ 3. Compiler À LA DEMANDE           │
└────────────────────────────────────┘
```

---

### 📂 Structure de Notre Frontend avec Vite

```
frontend/
├── src/
│   ├── game/              # Logique du jeu Pong
│   ├── components/        # Composants UI
│   ├── api/               # Appels vers le backend
│   └── index.ts           # Point d'entrée
├── public/                # Fichiers statiques (images, etc.)
├── index.html             # HTML principal
├── vite.config.ts         # Configuration Vite
├── tsconfig.json          # Configuration TypeScript
├── package.json
└── Dockerfile
```

**Point d'entrée** : `index.html`

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>ft_transcendence</title>
</head>
<body>
  <div id="app"></div>

  <!-- Vite injecte automatiquement le script -->
  <script type="module" src="/src/index.ts"></script>
</body>
</html>
```

Vite voit `type="module"` et sait qu'il doit traiter ce fichier comme un module ESM.

---

### 🔗 Vite et Docker

Dans notre `docker-compose.yml`, le frontend utilise Vite :

```yaml
frontend:
  build:
    context: ./frontend
  ports:
    - "8080:8080"
  volumes:
    - ./frontend:/app
    - /app/node_modules
  command: npm run dev
```

**Développement (npm run dev)** :
- Vite démarre le serveur de dev
- HMR activé
- Source maps pour débugger

**Production (npm run build)** :
- Vite compile tout
- Fichiers optimisés dans `dist/`
- Prêt pour le déploiement

---

### 🎨 Pourquoi Vite pour ft_transcendence ?

**1. Développement Rapide** ⚡
- Feedback instantané lors du développement du jeu Pong
- Tester rapidement les modifications (couleurs, physique, UI)

**2. TypeScript Natif** 📘
- Vite supporte TypeScript out-of-the-box
- Pas de configuration complexe
- Type checking pendant le développement

**3. Module Simple** 🧩
- Importer des fichiers facilement
```typescript
import { Ball } from './game/ball';
import './styles/game.css';
import ballTexture from './assets/ball.png';
```

**4. Build Optimisé** 📦
- Code minifié pour la production
- Chargement rapide de l'application
- Meilleure expérience utilisateur

---

### 🧪 Tester Vite

#### Démarrer le serveur de développement

```bash
cd frontend
npm run dev
```

Résultat :
```
  VITE v4.4.0  ready in 523 ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: http://172.18.0.4:8080/
```

#### Modifier un fichier et voir le HMR

1. Ouvrez `src/game/ball.ts`
2. Changez la couleur : `color = '#ff0000'`
3. Sauvegardez
4. 🎉 Le navigateur se met à jour instantanément !

Console du navigateur :
```
[vite] hot updated: /src/game/ball.ts
[vite] hmr update /src/game/ball.ts (x1) in 42ms
```

#### Builder pour la production

```bash
npm run build
```

Résultat :
```
vite v4.4.0 building for production...
✓ 154 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-a3f8b2c1.js    127.35 kB │ gzip: 42.17 kB
dist/assets/game-d5e2f1a9.js      58.12 kB │ gzip: 21.04 kB
✓ built in 2.35s
```

---

### 📊 Comparaison : Avec vs Sans Vite

**Scénario** : Projet avec 500 fichiers TypeScript

| Métrique | Sans Vite (Webpack) | Avec Vite |
|----------|---------------------|-----------|
| **Démarrage initial** | 45 secondes | 1.2 secondes |
| **Modification + Reload** | 3-8 secondes | 50-200 ms |
| **Build production** | 120 secondes | 90 secondes |
| **Taille des fichiers** | ~800 KB | ~650 KB (tree-shaking) |

---

### 🛠️ Commandes Vite Utiles

```bash
# Démarrer le serveur de développement
npm run dev

# Builder pour la production
npm run build

# Prévisualiser le build de production localement
npm run preview

# Nettoyer le cache de Vite
rm -rf node_modules/.vite
```

---

### 🔍 Concepts Avancés de Vite

#### **Pre-bundling des Dépendances**

Vite pré-compile les librairies lourdes (node_modules) avec **esbuild**.

```
Première visite :
1. Vite détecte les dépendances (three.js, etc.)
2. Les pré-compile avec esbuild → node_modules/.vite/
3. Les met en cache
4. Prêt en 1-2 secondes

Visites suivantes :
1. Vite utilise le cache
2. Démarrage instantané (< 500ms)
```

#### **Proxy API**

Vite peut rediriger les appels `/api` vers le backend :

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

Le frontend appelle `fetch('/api/users')`, Vite redirige vers `http://localhost:3000/api/users`.

**Avantage** : Pas de problèmes CORS en développement !

---

### 📚 Ressources pour Aller Plus Loin

- **Documentation officielle** : https://vitejs.dev/
- **Guide de migration depuis Webpack** : https://vitejs.dev/guide/migration.html
- **Comparaison des outils de build** : https://tool-comparison.vitejs.dev/

---

## 2. Qu'est-ce qu'un Backend ?

### 🧠 Le Cerveau de Votre Application

Imaginez une application web comme un restaurant :

- **Frontend** (ce que vous voyez) = La salle du restaurant, le menu, les serveurs
- **Backend** (invisible) = La cuisine, les chefs, le stock de nourriture
- **Base de données** = Le réfrigérateur et les placards

Quand un client (utilisateur) passe commande (clique sur un bouton) :
1. Le serveur (frontend) prend la commande
2. Il transmet la commande à la cuisine (backend via API)
3. La cuisine vérifie les ingrédients (base de données)
4. Prépare le plat (traite la logique)
5. Le serveur apporte le plat au client (renvoie les données au frontend)

### 🎯 Rôle du Backend

Le backend est responsable de :

1. **Stocker les données de manière permanente**
   - Informations des utilisateurs
   - Historique des matchs
   - Messages du chat

2. **Traiter la logique métier**
   - Vérifier qu'un mot de passe est correct
   - Calculer le score d'un match
   - Déterminer qui a gagné

3. **Sécuriser l'application**
   - Empêcher quelqu'un de tricher
   - Protéger les données sensibles
   - Vérifier les permissions

4. **Gérer le temps réel**
   - Position de la balle dans Pong
   - Chat en direct
   - Notifications

---

## 2. PostgreSQL - La Base de Données

### 🗄️ Qu'est-ce que PostgreSQL ?

PostgreSQL (ou "Postgres") est un **système de gestion de base de données relationnelle** (SGBDR).

#### Analogie : Un Classeur Géant

Imaginez une armoire avec des tiroirs :
- Chaque **tiroir** = une **TABLE** (users, matches, messages)
- Chaque **dossier dans le tiroir** = une **LIGNE** (un utilisateur spécifique)
- Chaque **fiche du dossier** = une **COLONNE** (nom, email, mot de passe)

### 📊 Les Tables Créées

Voici les 7 tables principales et leur rôle :

#### 1️⃣ **Table `users`** - Les Utilisateurs

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,              -- Identifiant unique
    username VARCHAR(50) UNIQUE,      -- Nom d'utilisateur
    email VARCHAR(255) UNIQUE,        -- Email
    password_hash VARCHAR(255),       -- Mot de passe chiffré
    display_name VARCHAR(100),        -- Nom affiché
    avatar_url VARCHAR(500),          -- URL de l'avatar
    is_online BOOLEAN DEFAULT false,  -- En ligne ?
    last_seen TIMESTAMP,              -- Dernière connexion
    created_at TIMESTAMP              -- Date de création
);
```

**Explications** :
- `UUID` = Un identifiant unique universel (ex: `550e8400-e29b-41d4-a716-446655440000`)
- `VARCHAR(50)` = Texte de maximum 50 caractères
- `UNIQUE` = Pas de doublons (deux users ne peuvent pas avoir le même username)
- `PRIMARY KEY` = Clé principale pour identifier chaque ligne
- `BOOLEAN` = Vrai ou Faux
- `TIMESTAMP` = Date et heure

**Pourquoi ?** : On stocke tous les utilisateurs ici. Quand vous créez un compte, une nouvelle ligne est ajoutée.

---

#### 2️⃣ **Table `friendships`** - Les Amitiés

```sql
CREATE TABLE friendships (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),      -- L'utilisateur
    friend_id UUID REFERENCES users(id),    -- Son ami
    status VARCHAR(20) DEFAULT 'pending',   -- pending, accepted, blocked
    created_at TIMESTAMP
);
```

**Explications** :
- `REFERENCES users(id)` = **Clé étrangère** : lie cette table à la table `users`
- Si un utilisateur est supprimé, toutes ses amitiés sont aussi supprimées (CASCADE)

**Exemple concret** :
```
| id | user_id (Alice) | friend_id (Bob) | status   |
|----|-----------------|-----------------|----------|
| 1  | uuid-alice      | uuid-bob        | accepted |
```

Alice et Bob sont amis !

---

#### 3️⃣ **Table `matches`** - Les Matchs de Pong

```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY,
    player1_id UUID REFERENCES users(id),   -- Joueur 1
    player2_id UUID REFERENCES users(id),   -- Joueur 2
    player1_score INTEGER DEFAULT 0,        -- Score joueur 1
    player2_score INTEGER DEFAULT 0,        -- Score joueur 2
    winner_id UUID REFERENCES users(id),    -- Le gagnant
    status VARCHAR(20),                     -- pending, in_progress, completed
    game_mode VARCHAR(50),                  -- classic, tournament, ranked
    duration_seconds INTEGER,               -- Durée du match
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);
```

**Exemple de match** :
```
Alice vs Bob
player1_score: 11
player2_score: 7
winner_id: uuid-alice
status: completed
```

---

#### 4️⃣ **Table `game_stats`** - Statistiques de Jeu

```sql
CREATE TABLE game_stats (
    user_id UUID UNIQUE REFERENCES users(id),
    total_matches INTEGER DEFAULT 0,        -- Nombre total de matchs
    wins INTEGER DEFAULT 0,                 -- Victoires
    losses INTEGER DEFAULT 0,               -- Défaites
    total_points_scored INTEGER,            -- Points marqués
    total_points_conceded INTEGER,          -- Points encaissés
    win_streak INTEGER DEFAULT 0,           -- Série de victoires actuelle
    best_win_streak INTEGER DEFAULT 0,      -- Meilleure série
    ranking_points INTEGER DEFAULT 1000     -- Points ELO
);
```

**Pourquoi une table séparée ?** : Au lieu de recalculer les stats à chaque fois, on les stocke. C'est plus rapide !

Quand un match se termine, les stats sont automatiquement mises à jour.

---

#### 5️⃣ **Table `messages`** - Chat

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    sender_id UUID REFERENCES users(id),     -- Qui envoie
    recipient_id UUID REFERENCES users(id),  -- Qui reçoit (NULL = groupe)
    room_id VARCHAR(100),                    -- Salon de chat
    content TEXT,                            -- Le message
    message_type VARCHAR(20),                -- text, system, game_invite
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);
```

**Types de messages** :
- `text` : Message normal ("Salut !")
- `system` : Message automatique ("Alice a rejoint le chat")
- `game_invite` : Invitation à jouer

---

#### 6️⃣ & 7️⃣ **Tables `tournaments` et `tournament_participants`** - Tournois

Ces tables gèrent les tournois (module bonus). Un tournoi a plusieurs participants, et chaque match fait partie d'un tournoi.

---

### 🔍 Concepts Importants PostgreSQL

#### **Relations entre tables**

Les tables sont **liées** entre elles via des **clés étrangères** :

```
users (id: 1) ──┐
                ├── matches (player1_id: 1, player2_id: 2)
users (id: 2) ──┘
```

Si vous supprimez un utilisateur, PostgreSQL peut automatiquement supprimer ses matchs (CASCADE).

#### **Index**

Un index, c'est comme l'index d'un livre : il permet de trouver rapidement une information.

```sql
CREATE INDEX idx_users_username ON users(username);
```

Au lieu de lire toute la table pour trouver un username, PostgreSQL utilise l'index. **100x plus rapide !**

#### **Triggers**

Un trigger est une action automatique quand quelque chose se passe.

```sql
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

À chaque fois qu'un utilisateur est modifié, la colonne `updated_at` est automatiquement mise à jour avec la date actuelle.

---

### 📝 Migrations - Pourquoi ?

Une **migration** est un fichier SQL qui crée ou modifie la structure de la base de données.

**Pourquoi ne pas créer les tables manuellement ?**

1. **Reproductibilité** : Vous pouvez recréer la DB identique sur n'importe quelle machine
2. **Versioning** : Historique des changements
3. **Collaboration** : Toute l'équipe a la même structure

**Notre migration** : `001_initial_schema.sql`
- Crée toutes les tables
- Ajoute les index
- Configure les triggers

**Comment l'exécuter ?**
```bash
docker-compose exec backend npm run migrate
```

Le script `run-migrations.js` lit tous les fichiers `.sql` et les exécute dans l'ordre.

---

## 3. API REST - Comment le Frontend et le Backend Communiquent

### 🌐 Qu'est-ce qu'une API REST ?

**API** = Application Programming Interface (Interface de Programmation)
**REST** = REpresentational State Transfer

Une API REST, c'est un **ensemble de règles** pour que deux applications communiquent via HTTP (comme les sites web).

### 📡 Analogie : Le Serveur dans un Restaurant

Vous (frontend) voulez commander un plat (données) :

1. Vous appelez le serveur : `GET /api/users` (récupérer la liste des users)
2. Le serveur va en cuisine : le backend interroge la DB
3. Le serveur revient avec le plat : le backend renvoie les données

### 🔤 Les Méthodes HTTP (Verbes)

| Méthode  | Signification | Exemple                          | Effet                        |
|----------|---------------|----------------------------------|------------------------------|
| **GET**  | Lire          | `GET /api/users/123`             | Récupère l'utilisateur 123   |
| **POST** | Créer         | `POST /api/users`                | Crée un nouvel utilisateur   |
| **PUT**  | Remplacer     | `PUT /api/users/123`             | Remplace l'utilisateur 123   |
| **PATCH**| Modifier      | `PATCH /api/matches/456`         | Modifie partiellement 456    |
| **DELETE**| Supprimer    | `DELETE /api/matches/456`        | Supprime le match 456        |

### 🎯 Structure d'une Requête HTTP

```http
POST /api/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "username": "alice",
  "password": "motdepasse123"
}
```

**Décomposition** :
- `POST` : Méthode (créer/envoyer)
- `/api/auth/login` : Chemin (endpoint)
- `Host` : Serveur cible
- `Content-Type` : Format des données (JSON)
- `Authorization` : Token pour s'authentifier
- `{ ... }` : Corps de la requête (body) avec les données

### 📦 Structure d'une Réponse HTTP

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Décomposition** :
- `200 OK` : Code de statut (succès)
- `Content-Type` : Format de la réponse
- `{ ... }` : Données renvoyées

### 🔢 Codes de Statut HTTP

| Code | Signification         | Exemple                                  |
|------|-----------------------|------------------------------------------|
| 200  | OK (Succès)           | Données récupérées avec succès           |
| 201  | Created (Créé)        | Utilisateur créé                         |
| 400  | Bad Request           | Données invalides                        |
| 401  | Unauthorized          | Token manquant ou invalide               |
| 403  | Forbidden             | Pas les permissions                      |
| 404  | Not Found             | Ressource introuvable                    |
| 409  | Conflict              | Username déjà pris                       |
| 500  | Internal Server Error | Erreur côté serveur                      |

### 🗺️ Les Routes de Notre API

#### **Authentification** (`/api/auth`)

```
POST   /api/auth/register  → Créer un compte
POST   /api/auth/login     → Se connecter
POST   /api/auth/logout    → Se déconnecter (nécessite token)
GET    /api/auth/me        → Infos utilisateur connecté (nécessite token)
```

#### **Utilisateurs** (`/api/users`)

```
GET    /api/users          → Liste des utilisateurs
GET    /api/users/:id      → Profil d'un utilisateur
GET    /api/users/:id/matches  → Historique des matchs
GET    /api/users/:id/stats    → Statistiques
```

`:id` = paramètre dynamique (ex: `/api/users/550e8400-e29b-41d4-a716-446655440000`)

#### **Matchs** (`/api/matches`)

```
GET    /api/matches        → Liste des matchs
POST   /api/matches        → Créer un match (nécessite token)
GET    /api/matches/:id    → Détails d'un match
PATCH  /api/matches/:id    → Modifier un match (nécessite token)
DELETE /api/matches/:id    → Supprimer un match (nécessite token)
```

#### **Santé**

```
GET    /health             → Vérifier si le serveur fonctionne
GET    /info               → Infos sur l'API
```

---

## 4. Fastify - Le Framework Backend

### ⚡ Qu'est-ce que Fastify ?

Fastify est un **framework web** pour Node.js. Un framework, c'est une boîte à outils qui facilite la création d'un serveur web.

**Pourquoi Fastify ?**
- **Ultra rapide** (plus rapide qu'Express.js)
- **Validation automatique** des données
- **Plugins** pour tout (WebSocket, DB, JWT, etc.)
- **TypeScript friendly**

### 🏗️ Architecture d'un Serveur Fastify

```javascript
const fastify = require('fastify');
const app = fastify({ logger: true });

// 1. Enregistrer des plugins
app.register(require('@fastify/cors'));
app.register(require('@fastify/jwt'), { secret: 'clé-secrète' });

// 2. Définir des routes
app.get('/hello', async (request, reply) => {
  return { message: 'Hello World' };
});

// 3. Démarrer le serveur
app.listen({ port: 3000 });
```

### 🔌 Les Plugins Fastify Utilisés

#### 1. `@fastify/cors` - Cross-Origin Resource Sharing

**Problème** : Par défaut, un navigateur bloque les requêtes entre différents domaines.

Exemple :
- Frontend : `http://localhost:8080`
- Backend : `http://localhost:3000`

Sans CORS, le frontend NE PEUT PAS appeler le backend !

**Solution** : Autoriser les requêtes cross-origin

```javascript
app.register(require('@fastify/cors'), {
  origin: '*',  // Autoriser tous les domaines (à restreindre en prod)
  credentials: true  // Autoriser les cookies
});
```

---

#### 2. `@fastify/jwt` - JSON Web Tokens

**Problème** : Comment savoir si une requête vient d'un utilisateur connecté ?

**Solution** : Utiliser des tokens JWT (voir section Authentification)

```javascript
app.register(require('@fastify/jwt'), {
  secret: 'clé-super-secrète'
});

// Utiliser le JWT
const token = app.jwt.sign({ userId: 123 });
const decoded = app.jwt.verify(token);
```

---

#### 3. `@fastify/postgres` - Connexion PostgreSQL

**Rôle** : Gérer la connexion à la base de données

```javascript
app.register(require('@fastify/postgres'), {
  host: 'postgres',
  user: 'transcendence',
  password: 'transcendence123',
  database: 'transcendence'
});

// Utiliser la DB
app.get('/users', async (request, reply) => {
  const result = await app.pg.query('SELECT * FROM users');
  return result.rows;
});
```

Le plugin crée un **pool de connexions** : au lieu de créer une nouvelle connexion à chaque requête (lent), il en réutilise.

---

#### 4. `@fastify/websocket` - Communication Temps Réel

Les WebSockets permettent une communication **bidirectionnelle** en temps réel.

**HTTP classique** :
```
Client → Serveur : "Donne-moi les données"
Client ← Serveur : "Voici les données"
(connexion fermée)
```

**WebSocket** :
```
Client ↔ Serveur : Connexion permanente ouverte
Client → Serveur : "Quelle est la position de la balle ?"
Client ← Serveur : "x: 100, y: 200"
(quelques millisecondes plus tard)
Client ← Serveur : "x: 105, y: 198"
```

Parfait pour :
- Jeu Pong en temps réel
- Chat instantané
- Notifications live

---

### 📂 Structure des Routes

Chaque fichier de route est un **module** :

```javascript
// routes/users.js
async function usersRoutes(fastify, options) {
  // GET /api/users
  fastify.get('/', async (request, reply) => {
    // Logique ici
    return { users: [...] };
  });

  // GET /api/users/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    // Logique ici
  });
}

module.exports = usersRoutes;
```

Dans le serveur principal :

```javascript
app.register(require('./routes/users'), { prefix: '/api/users' });
```

Toutes les routes du fichier auront le préfixe `/api/users`.

---

## 5. Authentification et Sécurité

### 🔐 Le Problème de l'Authentification

**Question** : Comment le serveur sait-il qui vous êtes ?

HTTP est **sans état** (stateless) : chaque requête est indépendante. Le serveur ne se "souvient" pas de vous entre deux requêtes.

**Mauvaise solution** : Envoyer username + password à chaque requête ❌
- Dangereux (mot de passe exposé)
- Lent (vérifier le hash à chaque fois)

**Bonne solution** : Utiliser des **tokens** ✅

### 🎫 JWT - JSON Web Token

Un JWT est un **token crypté** qui contient des informations.

#### Structure d'un JWT

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiaWF0IjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Un JWT a **3 parties** séparées par des points :

```
[Header].[Payload].[Signature]
```

1. **Header** : Métadonnées (algorithme de chiffrement)
   ```json
   { "alg": "HS256", "typ": "JWT" }
   ```

2. **Payload** : Données (informations sur l'utilisateur)
   ```json
   { "userId": 123, "username": "alice" }
   ```

3. **Signature** : Garantit que le token n'a pas été modifié
   ```
   HMACSHA256(
     base64UrlEncode(header) + "." + base64UrlEncode(payload),
     secret
   )
   ```

#### Fonctionnement JWT dans Notre App

```
1. Utilisateur se connecte
   POST /api/auth/login { username: "alice", password: "xxx" }

2. Backend vérifie les identifiants
   → Cherche l'utilisateur dans la DB
   → Compare le mot de passe hashé

3. Backend crée un JWT
   const token = jwt.sign({ id: user.id, username: user.username }, 'secret');

4. Backend renvoie le token
   { user: {...}, token: "eyJhbG..." }

5. Frontend stocke le token (localStorage, cookie)

6. Pour chaque requête authentifiée, frontend envoie le token
   Authorization: Bearer eyJhbG...

7. Backend vérifie le token
   const decoded = jwt.verify(token, 'secret');
   → Si valide : decoded = { id: 123, username: "alice" }
   → Si invalide : erreur 401 Unauthorized
```

#### Avantages JWT

- **Sans état** : Le serveur n'a pas besoin de stocker les sessions
- **Scalable** : Fonctionne même avec plusieurs serveurs
- **Sécurisé** : Impossible de modifier sans connaître la clé secrète

#### Notre Code JWT

```javascript
// Créer un token (lors du login)
const token = fastify.jwt.sign({
  id: user.id,
  username: user.username
});

// Middleware pour protéger une route
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();  // Vérifie le token
    // Si ok, request.user = { id: 123, username: "alice" }
  } catch (error) {
    reply.status(401).send({ error: 'Token invalide' });
  }
});

// Route protégée
fastify.get('/me', {
  onRequest: [fastify.authenticate]  // Exécute le middleware avant
}, async (request, reply) => {
  // Ici, on est sûr que l'utilisateur est authentifié
  const userId = request.user.id;
  // ...
});
```

---

### 🔒 Bcrypt - Hashage de Mots de Passe

**Problème** : On ne peut PAS stocker les mots de passe en clair dans la DB !

Si quelqu'un vole la DB, il a tous les mots de passe ❌

**Solution** : **Hasher** les mots de passe

#### Qu'est-ce qu'un Hash ?

Un hash est une fonction **à sens unique** :

```
hash("motdepasse123") → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
```

**Impossible** de retrouver `"motdepasse123"` à partir du hash !

Mais on peut **vérifier** si un mot de passe correspond :

```javascript
const isValid = await bcrypt.compare("motdepasse123", hash);
// → true
```

#### Bcrypt dans Notre Code

**Lors de l'inscription** :

```javascript
// Hasher le mot de passe
const passwordHash = await bcrypt.hash(password, 10);
// 10 = "salt rounds" (nombre de fois que l'algorithme tourne)
// Plus c'est élevé, plus c'est sécurisé (mais lent)

// Stocker dans la DB
await db.query(
  'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
  [username, passwordHash]
);
```

**Lors de la connexion** :

```javascript
// Récupérer le hash depuis la DB
const user = await db.query('SELECT password_hash FROM users WHERE username = $1');

// Comparer
const validPassword = await bcrypt.compare(password, user.password_hash);

if (!validPassword) {
  return reply.status(401).send({ error: 'Mot de passe incorrect' });
}
```

#### Pourquoi Bcrypt et pas SHA256 ?

SHA256 est trop rapide ! Un attaquant peut tester des milliards de mots de passe/seconde.

Bcrypt est **intentionnellement lent** (configurable) et ajoute un **salt** (chaîne aléatoire) pour chaque mot de passe.

Même si deux utilisateurs ont le même mot de passe, le hash sera différent !

```
alice : "password123" → $2b$10$abc...
bob   : "password123" → $2b$10$xyz...  (différent !)
```

---

### 🛡️ Middleware d'Authentification

Un **middleware** est une fonction qui s'exécute **avant** la route.

```
Requête → Middleware 1 → Middleware 2 → Route → Réponse
```

Notre middleware `authenticate` :

```javascript
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
    // Si le token est valide, on continue
  } catch (error) {
    // Si invalide, on arrête et renvoie 401
    reply.status(401).send({ error: 'Non authentifié' });
  }
});
```

Utilisation :

```javascript
// Route publique (pas de middleware)
fastify.get('/api/users', async (request, reply) => {
  // Tout le monde peut accéder
});

// Route privée (avec middleware)
fastify.post('/api/matches', {
  onRequest: [fastify.authenticate]  // Exécute le middleware
}, async (request, reply) => {
  // Seulement les utilisateurs authentifiés
  const userId = request.user.id;  // Disponible grâce au JWT
});
```

---

## 6. Docker - Conteneurisation

### 🐳 Qu'est-ce que Docker ?

Docker permet de **packager** une application avec toutes ses dépendances dans un **conteneur**.

#### Analogie : Les Conteneurs de Cargo

Un conteneur Docker, c'est comme un conteneur maritime :
- Standardisé (même format partout)
- Isolé (le contenu ne peut pas s'échapper)
- Portable (fonctionne sur n'importe quel navire/serveur)

### 📦 Concepts Clés

#### **Image Docker**

Une **image** est un **modèle** pour créer un conteneur.

Exemple : `node:20-alpine` est une image qui contient :
- Linux Alpine (distribution légère)
- Node.js version 20

#### **Conteneur Docker**

Un **conteneur** est une **instance** d'une image en cours d'exécution.

Analogie :
- Image = Recette de cuisine
- Conteneur = Plat préparé à partir de la recette

#### **Dockerfile**

Un `Dockerfile` est un fichier qui décrit **comment construire une image**.

Notre Dockerfile :

```dockerfile
FROM node:20-alpine
# Partir de l'image Node.js 20 sur Alpine Linux

WORKDIR /app
# Définir /app comme répertoire de travail

COPY package*.json ./
# Copier package.json et package-lock.json

RUN npm install
# Installer les dépendances

COPY . .
# Copier tout le code source

EXPOSE 3000
# Indiquer que le conteneur écoute sur le port 3000

CMD ["npm", "run", "dev"]
# Commande à exécuter au démarrage
```

**Ordre des commandes** : Les layers sont mis en cache. Si `package.json` ne change pas, Docker réutilise le cache de `npm install` (plus rapide !).

#### **Docker Compose**

Docker Compose permet de gérer **plusieurs conteneurs** qui travaillent ensemble.

Notre `docker-compose.yml` définit 3 services :

```yaml
services:
  postgres:     # Base de données
  backend:      # Serveur Fastify
  frontend:     # Application web
```

### 🔗 Notre Architecture Docker

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
        ↑
    localhost:3000 (backend)
    localhost:8080 (frontend)
```

### 📋 Explication du docker-compose.yml

```yaml
version: '3.8'

services:
  # Service PostgreSQL
  postgres:
    image: postgres:15-alpine
    # Utiliser l'image PostgreSQL 15 (version légère)

    container_name: ft_transcendence_db
    # Nom du conteneur

    restart: unless-stopped
    # Redémarrer automatiquement si crash (sauf arrêt manuel)

    environment:
      POSTGRES_USER: transcendence
      POSTGRES_PASSWORD: transcendence123
      POSTGRES_DB: transcendence
    # Variables d'environnement

    volumes:
      - postgres_data:/var/lib/postgresql/data
    # Stocker les données dans un volume (persistent)

    ports:
      - "5432:5432"
    # Exposer le port 5432 (format: host:container)

    networks:
      - transcendence_network
    # Connecter au réseau

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U transcendence"]
      interval: 10s
      timeout: 5s
      retries: 5
    # Vérifier toutes les 10s si PostgreSQL est prêt

  # Service Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    # Construire l'image à partir du Dockerfile

    container_name: ft_transcendence_backend

    environment:
      DATABASE_URL: postgresql://transcendence:transcendence123@postgres:5432/transcendence
      # Note: "postgres" est le nom du service (résolu par Docker DNS)
      JWT_SECRET: your-super-secret-jwt-key

    ports:
      - "3000:3000"

    volumes:
      - ./backend:/app
      # Synchroniser le code (hot reload en dev)
      - /app/node_modules
      # Exclure node_modules (utiliser ceux du conteneur)

    depends_on:
      postgres:
        condition: service_healthy
    # Attendre que PostgreSQL soit prêt avant de démarrer

    command: npm run dev
    # Commande de démarrage (override le CMD du Dockerfile)

  # Service Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile

    container_name: ft_transcendence_frontend

    ports:
      - "8080:8080"

    volumes:
      - ./frontend:/app
      - /app/node_modules

    depends_on:
      - backend
    # Démarrer après le backend

volumes:
  postgres_data:
    driver: local
  # Volume pour persister les données PostgreSQL

networks:
  transcendence_network:
    driver: bridge
  # Réseau interne pour la communication entre conteneurs
```

### 🎯 Avantages de Docker pour ft_transcendence

1. **Isolation** : Postgres, Backend et Frontend sont isolés
2. **Reproductibilité** : Même environnement partout (dev, prod, correction)
3. **Facilité** : `docker-compose up` et tout démarre !
4. **Pas de pollution** : Pas besoin d'installer Postgres sur votre machine

---

## 7. Explication Détaillée du Code

### 📂 Fichier par Fichier

#### 1. `backend/src/config/index.js` - Configuration Générale

```javascript
require('dotenv').config();
// Charge les variables depuis .env

const config = {
  port: process.env.PORT || 3000,
  // Si PORT existe dans .env, utilise-le, sinon 3000

  host: process.env.HOST || '0.0.0.0',
  // 0.0.0.0 = écouter sur toutes les interfaces réseau

  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  // Clé secrète pour signer les JWT

  jwtExpiresIn: '7d',
  // Les tokens expirent après 7 jours

  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Autoriser tous les domaines (à restreindre en prod)
};

module.exports = config;
```

**Pourquoi un fichier séparé ?** : Centraliser la config. Facile à modifier !

---

#### 2. `backend/src/server.js` - Serveur Principal

```javascript
const fastify = require('fastify');
const config = require('./config');

// Créer l'instance Fastify avec logger
const app = fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'error',
    // En dev : logs détaillés, en prod : seulement les erreurs

    transport: config.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      // pino-pretty = logs colorés et lisibles
    } : undefined,
  },
});

async function start() {
  try {
    // 1. Enregistrer les plugins
    await app.register(require('@fastify/cors'), { ... });
    await app.register(require('@fastify/jwt'), { ... });
    await app.register(require('@fastify/postgres'), { ... });
    await app.register(require('@fastify/websocket'));
    await app.register(require('./plugins/authenticate'));

    // 2. Enregistrer les routes avec préfixes
    await app.register(require('./routes/health'));
    await app.register(require('./routes/auth'), { prefix: '/api/auth' });
    await app.register(require('./routes/users'), { prefix: '/api/users' });
    await app.register(require('./routes/matches'), { prefix: '/api/matches' });

    // 3. Route racine
    app.get('/', async (request, reply) => {
      return { message: 'ft_transcendence API', version: '1.0.0' };
    });

    // 4. Gestion globale des erreurs
    app.setErrorHandler((error, request, reply) => {
      app.log.error(error);
      reply.status(error.statusCode || 500).send({
        error: error.message || 'Internal Server Error',
      });
    });

    // 5. Démarrer le serveur
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 Serveur démarré sur http://${config.host}:${config.port}`);

  } catch (error) {
    app.log.error(error);
    process.exit(1);  // Arrêter le processus en cas d'erreur
  }
}

// Gestion de l'arrêt gracieux
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`\n${signal} reçu, arrêt du serveur...`);
    await app.close();  // Fermer proprement les connexions
    process.exit(0);
  });
});

start();
```

**SIGINT/SIGTERM** : Signaux envoyés quand on arrête le serveur (Ctrl+C, docker stop). On ferme proprement les connexions DB avant de quitter.

---

#### 3. `backend/src/routes/auth.js` - Routes d'Authentification

##### **POST /api/auth/register** - Inscription

```javascript
fastify.post('/register', async (request, reply) => {
  const { username, email, password, display_name } = request.body;

  // 1. Validation
  if (!username || !email || !password) {
    return reply.status(400).send({ error: 'Champs requis manquants' });
  }

  // 2. Vérifier si l'utilisateur existe déjà
  const existingUser = await fastify.pg.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );

  if (existingUser.rows.length > 0) {
    return reply.status(409).send({ error: 'Username ou email déjà pris' });
  }

  // 3. Hasher le mot de passe
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Créer l'utilisateur dans la DB
  const result = await fastify.pg.query(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, display_name, created_at`,
    [username, email, passwordHash, display_name || username]
  );

  const user = result.rows[0];

  // 5. Créer les statistiques de jeu (une ligne par utilisateur)
  await fastify.pg.query(
    'INSERT INTO game_stats (user_id) VALUES ($1)',
    [user.id]
  );

  // 6. Générer un JWT
  const token = fastify.jwt.sign({
    id: user.id,
    username: user.username,
  });

  // 7. Renvoyer l'utilisateur + token
  return reply.status(201).send({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
    },
    token,
  });
});
```

**$1, $2, $3** : Paramètres préparés (prepared statements). Protège contre les **injections SQL** !

❌ **Dangereux** :
```javascript
const query = `SELECT * FROM users WHERE username = '${username}'`;
// Si username = "admin' OR '1'='1", on récupère tous les users !
```

✅ **Sécurisé** :
```javascript
const query = 'SELECT * FROM users WHERE username = $1';
await db.query(query, [username]);
// PostgreSQL échappe automatiquement les caractères spéciaux
```

---

##### **POST /api/auth/login** - Connexion

```javascript
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body;

  // 1. Récupérer l'utilisateur (on accepte username OU email)
  const result = await fastify.pg.query(
    'SELECT * FROM users WHERE username = $1 OR email = $1',
    [username]
  );

  if (result.rows.length === 0) {
    return reply.status(401).send({ error: 'Identifiants invalides' });
  }

  const user = result.rows[0];

  // 2. Vérifier le mot de passe
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    return reply.status(401).send({ error: 'Identifiants invalides' });
  }

  // 3. Mettre à jour le statut en ligne
  await fastify.pg.query(
    'UPDATE users SET is_online = true WHERE id = $1',
    [user.id]
  );

  // 4. Générer le token
  const token = fastify.jwt.sign({
    id: user.id,
    username: user.username,
  });

  // 5. Renvoyer les données (sans le password_hash !)
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    },
    token,
  };
});
```

**Sécurité** : On ne renvoie JAMAIS le `password_hash` au frontend !

---

##### **GET /api/auth/me** - Utilisateur Connecté

```javascript
fastify.get('/me', {
  onRequest: [fastify.authenticate],  // Middleware
}, async (request, reply) => {
  // Le middleware a vérifié le token
  // request.user = { id: 123, username: "alice" }

  const result = await fastify.pg.query(
    `SELECT u.*, gs.total_matches, gs.wins, gs.losses, gs.ranking_points
     FROM users u
     LEFT JOIN game_stats gs ON u.id = gs.user_id
     WHERE u.id = $1`,
    [request.user.id]
  );

  if (result.rows.length === 0) {
    return reply.status(404).send({ error: 'Utilisateur non trouvé' });
  }

  return result.rows[0];
});
```

**LEFT JOIN** : Jointure SQL. On récupère les données de `users` ET `game_stats` en une seule requête.

Sans JOIN (2 requêtes) :
```javascript
const user = await db.query('SELECT * FROM users WHERE id = $1');
const stats = await db.query('SELECT * FROM game_stats WHERE user_id = $1');
```

Avec JOIN (1 requête, plus rapide) :
```sql
SELECT u.*, gs.*
FROM users u
LEFT JOIN game_stats gs ON u.id = gs.user_id
WHERE u.id = $1
```

---

#### 4. `backend/src/routes/matches.js` - Gestion des Matchs

##### **PATCH /api/matches/:id** - Mettre à Jour un Match

Cette route est complexe car elle met à jour les **statistiques** automatiquement.

```javascript
fastify.patch('/:id', {
  onRequest: [fastify.authenticate],
}, async (request, reply) => {
  const { id } = request.params;
  const { player1_score, player2_score, status, winner_id } = request.body;

  // 1. Vérifier que l'utilisateur est un des joueurs
  const matchCheck = await fastify.pg.query(
    'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
    [id, request.user.id]
  );

  if (matchCheck.rows.length === 0) {
    return reply.status(404).send({ error: 'Non autorisé' });
  }

  // 2. Construire dynamiquement la requête UPDATE
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (player1_score !== undefined) {
    updates.push(`player1_score = $${paramCount++}`);
    values.push(player1_score);
  }
  if (player2_score !== undefined) {
    updates.push(`player2_score = $${paramCount++}`);
    values.push(player2_score);
  }
  if (status) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
    if (status === 'completed') {
      updates.push(`ended_at = CURRENT_TIMESTAMP`);
    }
  }
  if (winner_id) {
    updates.push(`winner_id = $${paramCount++}`);
    values.push(winner_id);
  }

  values.push(id);

  // 3. Exécuter l'UPDATE
  const result = await fastify.pg.query(
    `UPDATE matches SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  // 4. Si le match est terminé, mettre à jour les stats
  if (status === 'completed' && winner_id) {
    const match = result.rows[0];
    const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;

    // Stats du gagnant
    await fastify.pg.query(
      `UPDATE game_stats SET
       total_matches = total_matches + 1,
       wins = wins + 1,
       total_points_scored = total_points_scored + $1,
       total_points_conceded = total_points_conceded + $2,
       win_streak = win_streak + 1,
       best_win_streak = GREATEST(best_win_streak, win_streak + 1),
       ranking_points = ranking_points + 25
       WHERE user_id = $3`,
      [
        winner_id === match.player1_id ? match.player1_score : match.player2_score,
        winner_id === match.player1_id ? match.player2_score : match.player1_score,
        winner_id
      ]
    );

    // Stats du perdant
    await fastify.pg.query(
      `UPDATE game_stats SET
       total_matches = total_matches + 1,
       losses = losses + 1,
       total_points_scored = total_points_scored + $1,
       total_points_conceded = total_points_conceded + $2,
       win_streak = 0,
       ranking_points = GREATEST(ranking_points - 15, 0)
       WHERE user_id = $3`,
      [
        loser_id === match.player1_id ? match.player1_score : match.player2_score,
        loser_id === match.player1_id ? match.player2_score : match.player1_score,
        loser_id
      ]
    );
  }

  return result.rows[0];
});
```

**GREATEST(a, b)** : Fonction SQL qui retourne le maximum entre `a` et `b`. Évite que `ranking_points` devienne négatif.

---

#### 5. `backend/src/migrations/run-migrations.js` - Exécuter les Migrations

```javascript
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  // 1. Se connecter à PostgreSQL
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log('✅ Connecté à PostgreSQL');

  // 2. Lire tous les fichiers .sql dans le dossier
  const migrationsDir = __dirname;
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();  // Trier par nom (001_, 002_, etc.)

  // 3. Exécuter chaque migration
  for (const file of migrationFiles) {
    console.log(`📄 Exécution: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    await client.query(sql);
    console.log(`✅ ${file} OK`);
  }

  console.log('🎉 Migrations terminées !');
  await client.end();
}

runMigrations();
```

**Pourquoi trier ?** : Les migrations peuvent dépendre les unes des autres. On les exécute dans l'ordre numérique.

---

## 8. Flux Complet d'une Requête

### 🔄 Exemple : Un Utilisateur Crée un Match

Suivons le parcours complet d'une requête `POST /api/matches` :

```
┌─────────────┐
│  Frontend   │ Alice clique sur "Défier Bob"
└──────┬──────┘
       │
       │ 1. Envoie une requête HTTP
       ▼
POST /api/matches
Authorization: Bearer eyJhbG...
Content-Type: application/json
{
  "player2_id": "uuid-bob",
  "game_mode": "classic"
}
       │
       ▼
┌─────────────────────────────────────────┐
│         Serveur Fastify                 │
│                                         │
│  1. Reçoit la requête                   │
│  2. Logger Pino affiche la requête      │
│  3. Plugin CORS vérifie l'origine       │
│  4. Route matching: POST /api/matches   │
│  5. Exécute le middleware authenticate  │
│     ┌─────────────────────────────────┐ │
│     │ Middleware authenticate         │ │
│     │ - Extrait le token Bearer       │ │
│     │ - Vérifie avec JWT              │ │
│     │ - Décode: { id: "uuid-alice" }  │ │
│     │ - Ajoute request.user           │ │
│     └─────────────────────────────────┘ │
│  6. Exécute le handler de la route      │
│     ┌─────────────────────────────────┐ │
│     │ Handler POST /api/matches       │ │
│     │                                 │ │
│     │ const player1_id = request.user │ │
│     │ const player2_id = request.body │ │
│     │                                 │ │
│     │ // Vérifier que player2 existe  │ │
│     │ query: SELECT id FROM users...  │ │───┐
│     └─────────────────────────────────┘ │   │
└─────────────────────────────────────────┘   │
       │                                       │
       │ 7. Requête SQL                        │
       ▼                                       ▼
┌──────────────────────────────┐    ┌────────────────┐
│   Pool de Connexions         │───▶│   PostgreSQL   │
│   @fastify/postgres          │    │                │
│   - Prend une connexion      │    │ Exécute:       │
│   - Envoie la requête        │    │ SELECT id      │
│   - Attend la réponse        │    │ FROM users     │
│   - Libère la connexion      │    │ WHERE id=$1    │
└──────────────────────────────┘    └────────────────┘
       │                                       │
       │ 8. Résultat: { rows: [{ id: ... }] } │
       ◀───────────────────────────────────────┘
       │
       │ 9. Si OK, créer le match
       ▼
query: INSERT INTO matches (player1_id, player2_id, game_mode, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *
       │
       │ 10. PostgreSQL renvoie le match créé
       ▼
{ id: "uuid-match", player1_id: "uuid-alice", player2_id: "uuid-bob", ... }
       │
       │ 11. Fastify renvoie la réponse
       ▼
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "uuid-match",
  "player1_id": "uuid-alice",
  "player2_id": "uuid-bob",
  "status": "pending",
  "game_mode": "classic",
  ...
}
       │
       │ 12. Frontend reçoit la réponse
       ▼
┌─────────────┐
│  Frontend   │ Affiche "Match créé ! En attente de Bob..."
└─────────────┘
```

**Temps total** : ~10-50ms

---

## 9. Comment Utiliser ce Backend

### 🚀 Démarrage

#### 1. Lancer les services

```bash
cd /home/sviallon/Desktop/ft_transcendence
docker-compose up -d
```

Cela démarre :
- PostgreSQL (port 5432)
- Backend (port 3000)
- Frontend (port 8080)

#### 2. Vérifier les logs

```bash
docker-compose logs -f backend
```

Vous devriez voir :
```
🚀 Serveur démarré sur http://0.0.0.0:3000
📊 Environnement: development
```

#### 3. Exécuter les migrations

```bash
docker-compose exec backend npm run migrate
```

Cela crée toutes les tables dans PostgreSQL.

#### 4. Tester l'API

```bash
curl http://localhost:3000/health
```

Réponse :
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 12.456
}
```

---

### 🧪 Tester les Routes avec curl

#### Créer un compte

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123",
    "display_name": "Alice Wonderland"
  }'
```

Réponse :
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com",
    "display_name": "Alice Wonderland"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**IMPORTANT** : Copiez le `token` !

#### Se connecter

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "password123"
  }'
```

#### Utiliser une route protégée

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### Créer un match

```bash
# D'abord, créer un 2e utilisateur (bob)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob",
    "email": "bob@example.com",
    "password": "password123"
  }'

# Copier l'ID de Bob
BOB_ID="..."

# Créer un match (avec le token d'Alice)
curl -X POST http://localhost:3000/api/matches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "player2_id": "'$BOB_ID'",
    "game_mode": "classic"
  }'
```

#### Récupérer la liste des matchs

```bash
curl http://localhost:3000/api/matches
```

---

### 🔍 Accéder à PostgreSQL Directement

```bash
docker-compose exec postgres psql -U transcendence -d transcendence
```

Commandes SQL utiles :

```sql
-- Voir toutes les tables
\dt

-- Voir tous les users
SELECT * FROM users;

-- Voir tous les matchs avec les noms des joueurs
SELECT
  m.id,
  p1.username as player1,
  p2.username as player2,
  m.player1_score,
  m.player2_score,
  m.status
FROM matches m
JOIN users p1 ON m.player1_id = p1.id
JOIN users p2 ON m.player2_id = p2.id;

-- Voir les stats d'Alice
SELECT u.username, gs.*
FROM users u
JOIN game_stats gs ON u.id = gs.user_id
WHERE u.username = 'alice';

-- Quitter
\q
```

---

### 🛠️ Commandes Utiles

```bash
# Arrêter les services
docker-compose down

# Arrêter ET supprimer les volumes (⚠️ supprime la DB)
docker-compose down -v

# Redémarrer le backend
docker-compose restart backend

# Voir les logs en temps réel
docker-compose logs -f

# Entrer dans le conteneur backend
docker-compose exec backend sh

# Installer une nouvelle dépendance
docker-compose exec backend npm install bcryptjs

# Rebuild les images (après modification du Dockerfile)
docker-compose up -d --build
```

---

### 🐛 Débugger

#### Le backend ne démarre pas

1. Vérifier les logs :
```bash
docker-compose logs backend
```

2. Vérifier que PostgreSQL est prêt :
```bash
docker-compose exec postgres pg_isready
```

#### Erreur de connexion à la DB

Vérifier le `DATABASE_URL` dans `.env` :
```
DATABASE_URL=postgresql://transcendence:transcendence123@postgres:5432/transcendence
```

**IMPORTANT** : Utiliser `@postgres` (nom du service Docker), PAS `@localhost` !

#### Token invalide / 401 Unauthorized

1. Vérifier que le token est bien envoyé :
```bash
curl -v http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

2. Vérifier que `JWT_SECRET` est le même partout

#### Migration échoue

1. Supprimer la DB et recommencer :
```bash
docker-compose down -v
docker-compose up -d
docker-compose exec backend npm run migrate
```

---

## 📚 Glossaire des Termes

| Terme | Définition |
|-------|------------|
| **API** | Interface permettant à deux applications de communiquer |
| **REST** | Architecture pour créer des APIs (utilise HTTP) |
| **Endpoint** | Une route spécifique de l'API (ex: `/api/users`) |
| **Backend** | Partie serveur d'une application (logique, DB) |
| **Frontend** | Partie client d'une application (interface utilisateur) |
| **Base de données** | Système de stockage permanent de données |
| **PostgreSQL** | Système de gestion de base de données relationnelle |
| **Table** | Structure qui stocke des données (comme un tableau Excel) |
| **Ligne / Row** | Une entrée dans une table (ex: un utilisateur) |
| **Colonne / Column** | Un champ d'une table (ex: username, email) |
| **Clé primaire** | Identifiant unique d'une ligne (souvent `id`) |
| **Clé étrangère** | Référence à une clé primaire d'une autre table |
| **Index** | Structure pour accélérer les recherches dans une table |
| **Migration** | Script pour créer/modifier la structure de la DB |
| **SQL** | Langage pour interroger des bases de données |
| **JWT** | Token crypté pour l'authentification |
| **Hash** | Fonction à sens unique pour chiffrer (mots de passe) |
| **Bcrypt** | Algorithme de hashage sécurisé |
| **Middleware** | Fonction qui s'exécute avant une route |
| **CORS** | Mécanisme de sécurité pour les requêtes cross-origin |
| **Docker** | Outil pour conteneuriser des applications |
| **Conteneur** | Environnement isolé qui exécute une application |
| **Image Docker** | Modèle pour créer un conteneur |
| **Volume** | Stockage persistent pour Docker |
| **Fastify** | Framework web ultra-rapide pour Node.js |
| **Plugin** | Extension qui ajoute des fonctionnalités |
| **WebSocket** | Protocole pour la communication temps réel |
| **Node.js** | Environnement pour exécuter JavaScript côté serveur |
| **npm** | Gestionnaire de paquets pour Node.js |
| **package.json** | Fichier qui liste les dépendances d'un projet Node |
| **async/await** | Syntaxe JavaScript pour gérer l'asynchrone |
| **Promise** | Objet représentant une opération asynchrone |
| **UUID** | Identifiant unique universel (128 bits) |
| **Timestamp** | Date et heure (ex: 2024-01-15 14:30:00) |
| **HTTP Status Code** | Code indiquant le résultat d'une requête (200, 404, etc.) |
| **JSON** | Format de données léger (JavaScript Object Notation) |
| **Environment Variable** | Variable de configuration (ex: PORT, DB_URL) |
| **.env** | Fichier contenant les variables d'environnement |

---

## 🎓 Concepts Avancés

### Transactions SQL

Une transaction regroupe plusieurs opérations SQL. **Tout réussit ou tout échoue**.

```javascript
const client = await fastify.pg.connect();

try {
  await client.query('BEGIN');

  // 1. Créer l'utilisateur
  const user = await client.query('INSERT INTO users ...');

  // 2. Créer ses stats
  await client.query('INSERT INTO game_stats (user_id) VALUES ($1)', [user.id]);

  // 3. Envoyer un message de bienvenue
  await client.query('INSERT INTO messages ...');

  await client.query('COMMIT');  // Tout OK, on valide

} catch (error) {
  await client.query('ROLLBACK');  // Erreur, on annule TOUT
  throw error;
} finally {
  client.release();
}
```

**Pourquoi ?** : Éviter les incohérences. Si la création des stats échoue, on ne veut pas avoir un utilisateur sans stats.

---

### Injection SQL

**Attaque courante** : Un attaquant essaie d'injecter du SQL malveillant.

```javascript
// ❌ DANGEREUX
const username = "admin' OR '1'='1";
const query = `SELECT * FROM users WHERE username = '${username}'`;
await db.query(query);

// Devient:
// SELECT * FROM users WHERE username = 'admin' OR '1'='1'
// Retourne TOUS les utilisateurs !
```

```javascript
// ✅ SÉCURISÉ
const query = 'SELECT * FROM users WHERE username = $1';
await db.query(query, [username]);

// PostgreSQL échappe automatiquement
```

**Toujours** utiliser des paramètres préparés !

---

### Rate Limiting

Pour éviter les abus, on peut limiter le nombre de requêtes par IP.

```javascript
await app.register(require('@fastify/rate-limit'), {
  max: 100,        // 100 requêtes
  timeWindow: '15 minutes'
});
```

Si un utilisateur dépasse 100 requêtes en 15 minutes → 429 Too Many Requests

---

### Validation avec Joi

Valider les données entrantes pour éviter les erreurs.

```javascript
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

fastify.post('/register', async (request, reply) => {
  const { error, value } = registerSchema.validate(request.body);

  if (error) {
    return reply.status(400).send({ error: error.details[0].message });
  }

  // Continuer avec value (données validées)
});
```

---

### Tests Automatisés

Tester le code automatiquement pour éviter les régressions.

```javascript
// tests/auth.test.js
const { test } = require('tap');
const build = require('../src/server');

test('POST /api/auth/register should create a user', async (t) => {
  const app = await build();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    }
  });

  t.equal(response.statusCode, 201);
  t.ok(response.json().token);
});
```

Lancer les tests :
```bash
npm test
```

---

## 🎯 Prochaines Étapes

Maintenant que vous comprenez le backend, voici ce qu'il reste à faire :

### 1. **WebSockets pour le Jeu Pong** ⚡

Implémenter la communication temps réel pour le jeu.

```javascript
// routes/game.js
fastify.register(async function (fastify) {
  fastify.get('/ws/game/:matchId', { websocket: true }, (connection, req) => {
    connection.socket.on('message', message => {
      // Recevoir la position de la raquette
      // Calculer la physique
      // Broadcaster la position de la balle
      connection.socket.send(JSON.stringify({ ball: { x, y } }));
    });
  });
});
```

### 2. **Chat en Temps Réel** 💬

WebSockets pour le chat.

```javascript
// Stocker les connexions actives
const connections = new Map();

fastify.get('/ws/chat', { websocket: true }, (connection, req) => {
  const userId = req.user.id;
  connections.set(userId, connection);

  connection.socket.on('message', async (data) => {
    const { room_id, content } = JSON.parse(data);

    // Sauvegarder dans la DB
    await db.query('INSERT INTO messages ...');

    // Broadcaster à tous les membres du salon
    broadcastToRoom(room_id, { sender: userId, content });
  });
});
```

### 3. **Upload d'Avatars** 🖼️

Permettre aux utilisateurs de télécharger une photo de profil.

```javascript
await app.register(require('@fastify/multipart'));

fastify.post('/api/users/avatar', async (request, reply) => {
  const data = await request.file();
  const buffer = await data.toBuffer();

  // Sauvegarder dans /uploads ou un service cloud (AWS S3)
  const filename = `${userId}-${Date.now()}.jpg`;
  fs.writeFileSync(`./uploads/${filename}`, buffer);

  // Mettre à jour la DB
  await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [filename, userId]);
});
```

### 4. **OAuth avec 42** 🔐

Permettre la connexion avec l'API de 42.

```javascript
await app.register(require('@fastify/oauth2'), {
  name: 'oauth42',
  credentials: {
    client: {
      id: process.env.OAUTH_42_CLIENT_ID,
      secret: process.env.OAUTH_42_CLIENT_SECRET,
    },
    auth: {
      authorizeHost: 'https://api.intra.42.fr',
      authorizePath: '/oauth/authorize',
      tokenHost: 'https://api.intra.42.fr',
      tokenPath: '/oauth/token',
    }
  },
  startRedirectPath: '/login/42',
  callbackUri: 'http://localhost:3000/login/42/callback',
});
```

### 5. **Système d'Amis** 👥

Envoyer/accepter des demandes d'amis.

```javascript
// POST /api/friendships
fastify.post('/api/friendships', async (request, reply) => {
  const { friend_id } = request.body;

  await db.query(
    'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, \'pending\')',
    [request.user.id, friend_id]
  );

  // Envoyer une notification (WebSocket)
  notifyUser(friend_id, { type: 'friend_request', from: request.user.id });
});

// PATCH /api/friendships/:id (accepter/refuser)
fastify.patch('/api/friendships/:id', async (request, reply) => {
  const { status } = request.body;  // 'accepted' ou 'blocked'

  await db.query(
    'UPDATE friendships SET status = $1 WHERE id = $2 AND friend_id = $3',
    [status, req.params.id, request.user.id]
  );
});
```

### 6. **Tournois** 🏆

Gérer des tournois à élimination directe.

```javascript
// Créer un tournoi
POST /api/tournaments
{
  "name": "Tournoi de Noël",
  "max_players": 8
}

// S'inscrire
POST /api/tournaments/:id/join

// Générer les matchs (bracket)
POST /api/tournaments/:id/start
→ Créer automatiquement tous les matchs du 1er tour
```

