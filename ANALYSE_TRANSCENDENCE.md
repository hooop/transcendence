# ANALYSE EXHAUSTIVE DE FT_TRANSCENDENCE

## Document d'analyse chronologique du flux d'execution

Ce document decrit de maniere exhaustive et chronologique le fonctionnement complet de l'application ft_transcendence (plateforme de tournoi Pong).

---

# TABLE DES MATIERES

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Demarrage de l'application](#2-demarrage-de-lapplication)
3. [Schema de base de donnees](#3-schema-de-base-de-donnees)
4. [Flux d'arrivee d'un utilisateur non connecte](#4-flux-darrivee-dun-utilisateur-non-connecte)
5. [Processus d'inscription](#5-processus-dinscription)
6. [Processus de connexion](#6-processus-de-connexion)
7. [Le Dashboard (utilisateur connecte)](#7-le-dashboard-utilisateur-connecte)
8. [Le systeme de chat WebSocket](#8-le-systeme-de-chat-websocket)
9. [Le jeu Pong local](#9-le-jeu-pong-local)
10. [Le systeme de tournoi](#10-le-systeme-de-tournoi)
11. [Le jeu en ligne multijoueur](#11-le-jeu-en-ligne-multijoueur)
12. [Le systeme d'amis](#12-le-systeme-damis)
13. [L'authentification OAuth 42](#13-lauthentification-oauth-42)
14. [L'authentification a deux facteurs (2FA)](#14-lauthentification-a-deux-facteurs-2fa)
15. [La sidebar de profil](#15-la-sidebar-de-profil)
16. [L'internationalisation (i18n)](#16-linternationalisation-i18n)

---

# 1. VUE D'ENSEMBLE DE L'ARCHITECTURE

## 1.1 Stack technique

L'application ft_transcendence est une Single Page Application (SPA) composee de :

**Frontend :**
- TypeScript (vanilla, sans framework comme React ou Vue)
- Vite comme bundler et serveur de developpement
- SCSS pour le styling
- Chart.js pour les graphiques du dashboard
- Canvas HTML5 pour le rendu du jeu Pong

**Backend :**
- Node.js avec Fastify comme framework HTTP
- SQLite comme base de donnees (via better-sqlite3)
- WebSocket pour la communication temps reel (chat et jeu en ligne)
- JWT pour l'authentification
- bcrypt pour le hachage des mots de passe
- Nodemailer pour l'envoi d'emails (2FA)

**Infrastructure :**
- Docker Compose pour l'orchestration
- Nginx comme reverse proxy avec terminaison SSL
- ELK Stack (Elasticsearch, Logstash, Kibana) pour les logs
- Prometheus + Grafana pour le monitoring

## 1.2 Structure des fichiers principaux

```
transcendence/
├── frontend/
│   ├── index.html                    # Point d'entree HTML
│   ├── src/
│   │   ├── main.ts                   # Bootstrap de l'application
│   │   ├── App.ts                    # Classe App principale
│   │   ├── router.ts                 # Routeur SPA
│   │   ├── sidebar.ts                # Sidebar utilisateur
│   │   ├── config/
│   │   │   └── env.ts                # Configuration des URLs
│   │   ├── game/
│   │   │   ├── PongGame.ts           # Moteur de jeu principal
│   │   │   ├── Ball.ts               # Classe balle
│   │   │   ├── Paddle.ts             # Classe raquette
│   │   │   ├── AIPlayer.ts           # Intelligence artificielle
│   │   │   ├── OnlinePongGame.ts     # Jeu en ligne
│   │   │   └── types.ts              # Types TypeScript du jeu
│   │   ├── pages/
│   │   │   ├── AuthPages.ts          # Pages login/register
│   │   │   ├── DashboardPage.ts      # Tableau de bord
│   │   │   ├── OnlineGamePage.ts     # Page jeu en ligne
│   │   │   └── TournamentConfigPage.ts
│   │   ├── services/
│   │   │   ├── api.ts                # Client HTTP vers le backend
│   │   │   ├── ChatService.ts        # Client WebSocket chat
│   │   │   ├── gameSocket.ts         # Client WebSocket jeu
│   │   │   └── i18n.ts               # Service de traduction
│   │   ├── tournament/
│   │   │   ├── TournamentManager.ts  # Logique de tournoi
│   │   │   └── types.ts              # Types du tournoi
│   │   └── templates/                # Fichiers HTML injectes
│   │       ├── main.html
│   │       ├── home.html
│   │       ├── game.html
│   │       └── ...
│   └── css/
│       └── styles.scss
├── backend/
│   ├── src/
│   │   ├── server.js                 # Serveur Fastify principal
│   │   ├── config/
│   │   │   └── index.js              # Configuration
│   │   ├── routes/
│   │   │   ├── auth.js               # Authentification
│   │   │   ├── oauth42.js            # OAuth 42
│   │   │   ├── users.js              # Gestion utilisateurs
│   │   │   ├── matches.js            # Historique matchs
│   │   │   ├── game.js               # WebSocket jeu
│   │   │   ├── chat.js               # WebSocket chat
│   │   │   ├── friendships.js        # Amis
│   │   │   ├── twoFactor.js          # 2FA
│   │   │   └── upload.js             # Upload avatars
│   │   ├── game/
│   │   │   ├── GameRoom.js           # Salle de jeu
│   │   │   └── RoomManager.js        # Gestionnaire de salles
│   │   └── migrations/               # Scripts SQL
│   └── data/
│       └── transcendence.db          # Base SQLite
└── nginx/
    └── nginx.conf                    # Configuration reverse proxy
```

---

# 2. DEMARRAGE DE L'APPLICATION

## 2.1 Le fichier index.html

Quand un utilisateur accede a l'application via son navigateur (par exemple https://localhost:9443), le fichier `frontend/index.html` est servi. Voici ce qu'il contient :

Le fichier definit une structure HTML minimale avec :
- Un conteneur vide `<div id="app">` ou le contenu sera injecte dynamiquement
- Un chargement du script TypeScript principal via `<script type="module" src="/src/main.ts"></script>`
- Des polices Google Fonts (IBM Plex Mono, Inter, Righteous, Tiny5)
- Des icones Material Symbols

A ce stade, la page est vide. Tout le contenu sera genere par JavaScript.

## 2.2 Le fichier main.ts - Bootstrap de l'application

Le fichier `main.ts` est le point d'entree JavaScript. Voici ce qui se passe :

**Etape 1 : Imports**
Le fichier importe :
- La classe `Router` depuis `router.ts`
- La classe `App` depuis `App.ts`
- Le service `ChatService` depuis `services/ChatService`
- Le composant `ChatButton` depuis `components/ChatButton`
- La classe `Sidebar` depuis `sidebar.ts`
- Le composant `HeaderLanguageSwitcher`
- Les styles SCSS

**Etape 2 : Creation de la classe TranscendenceApp**

```typescript
class TranscendenceApp {
    private app: App
    private router: Router
    private chatService: ChatService | null = null
    private chatButton: ChatButton | null = null
    private sidebar: Sidebar | null = null
    private headerLanguageSwitcher: HeaderLanguageSwitcher | null = null
    // ...
}
```

Cette classe encapsule toute l'application. Elle stocke des references vers :
- L'instance `App` (le conteneur principal)
- L'instance `Router` (le routeur SPA)
- Le service de chat (si connecte)
- Le bouton de chat (si connecte)
- La sidebar de profil (si connecte)
- Le selecteur de langue

**Etape 3 : Le constructeur**

```typescript
constructor() {
    console.log('ft_transcendence starting...')
    this.app = new App()
    this.router = new Router()
    this.start()
}
```

Le constructeur :
1. Cree une instance de `App`
2. Cree une instance de `Router`
3. Appelle `start()` pour initialiser

**Etape 4 : La methode start()**

```typescript
private start(): void {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init())
    } else {
        this.init()
    }
}
```

Cette methode verifie si le DOM est charge. Si oui, elle appelle `init()` immediatement. Sinon, elle attend l'evenement `DOMContentLoaded`.

**Etape 5 : La methode init()**

```typescript
private init(): void {
    this.app.mount('#app')
    this.router.start()
    this.initHeaderLanguageSwitcher()
    this.initChat()
    this.initSidebar()
}
```

Cette methode :
1. Monte l'application dans le DOM (dans `<div id="app">`)
2. Demarre le routeur
3. Initialise le selecteur de langue
4. Initialise le chat si l'utilisateur est connecte
5. Initialise la sidebar si l'utilisateur est connecte

**Etape 6 : Verification de l'authentification**

Les methodes `initChat()` et `initSidebar()` verifient si l'utilisateur est connecte en lisant le localStorage :

```typescript
private initChat(): void {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')

    if (token && user) {
        this.chatService = ChatService.getInstance()
        this.chatService.connect(token)
        this.chatButton = new ChatButton()
        this.chatButton.mount(document.body)
    }
}
```

Si un token et un user sont presents dans le localStorage, l'utilisateur est considere comme connecte et le chat est initialise.

**Etape 7 : Instanciation finale**

```typescript
new TranscendenceApp()
```

A la fin du fichier, une nouvelle instance est creee, ce qui demarre toute l'application.

## 2.3 La classe App (App.ts)

La classe `App` est responsable d'injecter le template HTML principal.

**Structure de donnees :**
```typescript
export class App {
    private container: HTMLElement | null = null
}
```

**La methode mount() :**

```typescript
mount(selector: string): void {
    this.container = document.querySelector(selector)
    if (!this.container) {
        throw new Error(`Container ${selector} not found`)
    }
    this.render()
    // Ecoute les evenements de changement de langue
    window.addEventListener('translationsLoaded', () => {
        this.updateNavigationText()
    })
    // ...
}
```

**La methode render() :**

```typescript
private render(): void {
    if (!this.container) return
    this.container.innerHTML = mainTemplate
}
```

Cette methode injecte le contenu de `templates/main.html` dans le conteneur `#app`.

## 2.4 Le template main.html

Le template `main.html` definit la structure de la page :

1. **Header** avec :
   - Le logo SuperPong (SVG)
   - La navigation (Accueil, Entrainement, Tournoi, Match en ligne)
   - Les boutons de connexion (caches si connecte)
   - Les infos utilisateur (cachees si non connecte)

2. **Zone principale** `<main id="page-content">` ou le contenu des pages est injecte

3. **Banniere defilante** avec le texte "Super Pong - Ecole 42 - Transcendence"

4. **Footer** avec le selecteur de langue et les credits

5. **Sidebar** (cachee par defaut) pour modifier le profil utilisateur

## 2.5 Le routeur (router.ts)

Le routeur gere la navigation SPA (Single Page Application). Il intercepte les clics sur les liens et charge le contenu dynamiquement sans recharger la page.

**Structure de donnees :**
```typescript
export class Router {
    private routes: Map<string, () => void> = new Map()
    private currentGame: PongGame | null = null
    private tournamentManager: TournamentManager | null = null
    private isTournamentGameActive: boolean = false
}
```

- `routes` : Une Map qui associe des chemins URL a des fonctions de rendu
- `currentGame` : Reference vers le jeu Pong en cours (pour le detruire proprement)
- `tournamentManager` : Reference vers le gestionnaire de tournoi

**Configuration des routes :**

```typescript
private setupRoutes(): void {
    // Auth routes
    this.routes.set('/', () => this.renderHome())
    this.routes.set('/login', () => this.renderLogin())
    this.routes.set('/register', () => this.renderRegister())
    this.routes.set('/auth/callback', () => this.renderOAuthCallback())

    // Protected routes
    this.routes.set('/dashboard', () => this.renderDashboard())

    // Game routes
    this.routes.set('/game', () => this.renderGameModeSelection())
    this.routes.set('/online', () => this.renderOnlineGame())
    this.routes.set('/tournament', async () => await this.renderTournament())
}
```

**Demarrage du routeur :**

```typescript
start(): void {
    // Ecoute les clics sur les liens avec l'attribut data-route
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLAnchorElement
        if (target.matches('[data-route]')) {
            e.preventDefault()
            const href = target.getAttribute('href')
            if (href) {
                this.navigate(href)
            }
        }
    })

    // Ecoute le bouton retour du navigateur
    window.addEventListener('popstate', (e) => {
        // Gestion speciale si un tournoi est en cours
        // ...
        this.handleRoute()
    })

    // Charge la route initiale
    this.handleRoute()
    this.updateHeaderAuth()
}
```

**Navigation :**

```typescript
navigate(path: string): void {
    history.pushState({}, '', path)
    this.handleRoute()
}
```

La methode `navigate()` modifie l'URL dans la barre d'adresse (sans recharger la page) et appelle `handleRoute()`.

**Gestion des routes :**

```typescript
private handleRoute(): void {
    // Nettoyer le jeu precedent
    if (this.currentGame && window.location.pathname !== '/game') {
        this.currentGame.destroy()
        this.currentGame = null
    }

    // Enlever la classe fullscreen si on quitte /game
    const path = window.location.pathname
    if (path !== '/game') {
        document.body.classList.remove('fullscreen-game')
    }

    // Trouver et executer le handler de la route
    const handler = this.routes.get(path)
    if (handler) {
        handler()
        this.updateHeaderAuth()
    } else {
        this.navigate('/')  // Redirection vers l'accueil si route inconnue
    }
}
```

---

# 3. SCHEMA DE BASE DE DONNEES

La base de donnees SQLite contient les tables suivantes :

## 3.1 Table `users`

```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    oauth_provider TEXT,
    oauth_id TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_code TEXT,
    two_factor_expires_at DATETIME
);
```

**Description des colonnes :**
- `id` : Identifiant unique genere aleatoirement (hex de 16 bytes)
- `username` : Nom d'utilisateur unique (utilise pour la connexion)
- `email` : Adresse email unique
- `password_hash` : Mot de passe hache avec bcrypt (null si OAuth)
- `display_name` : Nom affiche (pseudo)
- `avatar_url` : URL de l'avatar (chemin vers le fichier uploade)
- `is_online` : 1 si l'utilisateur est connecte, 0 sinon
- `last_seen` : Date de derniere activite
- `oauth_provider` : "42" si connexion via OAuth 42
- `oauth_id` : ID de l'utilisateur chez le provider OAuth
- `two_factor_enabled` : 1 si le 2FA est active
- `two_factor_code` : Code 2FA temporaire envoye par email
- `two_factor_expires_at` : Date d'expiration du code 2FA

**Exemple de ligne :**
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "username": "sviallon",
  "email": "sviallon@student.42.fr",
  "password_hash": "$2b$10$X...",
  "display_name": "Simon",
  "avatar_url": "/api/uploads/avatars/a1b2c3d4e5f6g7h8.jpg",
  "is_online": 1,
  "last_seen": "2025-01-04 10:30:00",
  "oauth_provider": null,
  "oauth_id": null,
  "two_factor_enabled": 0
}
```

## 3.2 Table `game_stats`

```sql
CREATE TABLE IF NOT EXISTS game_stats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    total_points_scored INTEGER DEFAULT 0,
    total_points_conceded INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_win_streak INTEGER DEFAULT 0,
    ranking_points INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Description des colonnes :**
- `user_id` : Reference vers l'utilisateur
- `total_matches` : Nombre total de matchs joues
- `wins` : Nombre de victoires
- `losses` : Nombre de defaites
- `draws` : Nombre de matchs nuls (non utilise)
- `total_points_scored` : Total de points marques
- `total_points_conceded` : Total de points encaisses
- `win_streak` : Serie de victoires actuelle
- `best_win_streak` : Meilleure serie de victoires
- `ranking_points` : Points de classement (systeme ELO simplifie, demarre a 1000)

**Exemple de ligne :**
```json
{
  "id": "stats123",
  "user_id": "a1b2c3d4e5f6g7h8",
  "total_matches": 15,
  "wins": 10,
  "losses": 5,
  "draws": 0,
  "total_points_scored": 65,
  "total_points_conceded": 42,
  "win_streak": 3,
  "best_win_streak": 5,
  "ranking_points": 1125
}
```

## 3.3 Table `matches`

```sql
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    opponent_name TEXT,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    winner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    game_mode TEXT DEFAULT 'classic',
    duration_seconds INTEGER,
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    player1_ranking_after INTEGER,
    player2_ranking_after INTEGER
);
```

**Description des colonnes :**
- `player1_id` : ID du joueur 1 (toujours l'utilisateur connecte)
- `player2_id` : ID du joueur 2 (null si contre IA ou joueur local)
- `opponent_name` : Nom de l'adversaire (ex: "IA", "Joueur local")
- `player1_score` / `player2_score` : Scores finaux
- `winner_id` : ID du gagnant (null si le joueur a perdu contre IA)
- `status` : "pending", "in_progress", "completed", "abandoned"
- `game_mode` : "local", "vs_ai", "online", "tournament"
- `player1_ranking_after` : Points de classement apres le match

**Exemple de ligne :**
```json
{
  "id": "match789",
  "player1_id": "a1b2c3d4e5f6g7h8",
  "player2_id": null,
  "opponent_name": "IA",
  "player1_score": 5,
  "player2_score": 3,
  "winner_id": "a1b2c3d4e5f6g7h8",
  "status": "completed",
  "game_mode": "vs_ai",
  "ended_at": "2025-01-04 10:35:00",
  "player1_ranking_after": 1025
}
```

## 3.4 Table `friendships`

```sql
CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);
```

**Description des colonnes :**
- `user_id` : ID de l'utilisateur qui a envoye la demande
- `friend_id` : ID de l'utilisateur qui recoit la demande
- `status` : "pending" (en attente), "accepted" (acceptee), "blocked" (bloque)

**Exemple de ligne :**
```json
{
  "id": "friend456",
  "user_id": "a1b2c3d4e5f6g7h8",
  "friend_id": "x9y8z7w6v5u4",
  "status": "accepted",
  "created_at": "2025-01-03 14:00:00"
}
```

## 3.5 Table `messages`

```sql
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    room_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Description des colonnes :**
- `sender_id` : ID de l'expediteur
- `recipient_id` : ID du destinataire (null pour messages de groupe)
- `room_id` : ID de la salle de chat (non utilise actuellement)
- `content` : Contenu du message
- `message_type` : "text", "system", "game_invite"
- `is_read` : 1 si lu, 0 sinon

---

# 4. FLUX D'ARRIVEE D'UN UTILISATEUR NON CONNECTE

Quand un utilisateur non connecte arrive sur le site, voici ce qui se passe chronologiquement :

## 4.1 Chargement initial

1. Le navigateur charge `index.html`
2. Le script `main.ts` s'execute
3. `TranscendenceApp` est instancie
4. `App.mount('#app')` injecte le template `main.html` dans la page
5. Le routeur demarre et detecte le chemin `/`
6. La methode `renderHome()` est appelee

## 4.2 La methode renderHome()

```typescript
private renderHome(): void {
    // Verification de l'authentification
    const token = ApiService.getToken();
    if (token) {
        this.navigate('/dashboard');
        return;
    }

    // Afficher la page d'accueil
    this.updatePageContent(homeTemplate);

    // Mettre a jour les labels i18n
    setTimeout(() => {
        this.updateHomeLabels();
        window.addEventListener('languageChanged', () => {
            this.updateHomeLabels();
        })
    }, 50);
}
```

Cette methode :
1. Verifie si un token existe dans localStorage
2. Si oui, redirige vers le dashboard
3. Sinon, injecte le template `home.html` dans `#page-content`
4. Met a jour les textes selon la langue selectionnee

## 4.3 Le template home.html

Le template affiche :
- Un titre "1972 : Une revolution nait" (histoire de Pong)
- Une image du jeu Pong classique
- Un titre "2025 : L'heritage continue"
- Un texte de presentation de SuperPong
- Un bouton "Jouer" qui redirige vers `/game`

## 4.4 Etat du header

La methode `updateHeaderAuth()` est appelee et :
- Affiche le bouton "Connexion" car aucun token n'est present
- Cache les infos utilisateur
- Cache le lien "Match en ligne" (reserve aux utilisateurs connectes)

## 4.5 Ce qui n'est PAS initialise

Comme l'utilisateur n'est pas connecte :
- Le `ChatService` n'est pas initialise (pas de connexion WebSocket)
- Le `ChatButton` n'est pas affiche
- La `Sidebar` n'est pas initialisee

---

# 5. PROCESSUS D'INSCRIPTION

## 5.1 Navigation vers /register

Quand l'utilisateur clique sur "Connexion" puis sur le lien d'inscription, le routeur appelle `renderRegister()`.

## 5.2 La page d'inscription (AuthPages.ts)

La classe `AuthPages` genere le formulaire d'inscription :

```typescript
static renderRegister(): string {
    return `
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-box">
                    <h2 id="auth-title">Inscription</h2>
                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <input type="text" id="register-username"
                                   placeholder="Nom d'utilisateur" required />
                        </div>
                        <div class="form-group">
                            <input type="email" id="register-email"
                                   placeholder="Email" required />
                        </div>
                        <div class="form-group">
                            <input type="text" id="register-displayname"
                                   placeholder="Pseudo (optionnel)" />
                        </div>
                        <div class="form-group">
                            <input type="password" id="register-password"
                                   placeholder="Mot de passe" required />
                        </div>
                        <button type="submit" class="auth-submit">S'inscrire</button>
                    </form>
                    <!-- Bouton OAuth 42 -->
                    <button id="oauth42-btn" class="oauth42-btn">
                        Connexion avec 42
                    </button>
                </div>
            </div>
        </div>
    `
}
```

## 5.3 La methode setupRegisterForm()

```typescript
static setupRegisterForm(): void {
    const form = document.getElementById('register-form') as HTMLFormElement
    const oauth42Btn = document.getElementById('oauth42-btn')

    // Gestion du formulaire classique
    form?.addEventListener('submit', async (e) => {
        e.preventDefault()

        const username = (document.getElementById('register-username') as HTMLInputElement).value
        const email = (document.getElementById('register-email') as HTMLInputElement).value
        const displayName = (document.getElementById('register-displayname') as HTMLInputElement).value
        const password = (document.getElementById('register-password') as HTMLInputElement).value

        try {
            // Appel API d'inscription
            const response = await ApiService.register(username, email, password, displayName || undefined)

            // Redirection vers le dashboard
            window.location.href = '/dashboard'
        } catch (error: any) {
            // Affichage des erreurs
        }
    })

    // Gestion du bouton OAuth 42
    oauth42Btn?.addEventListener('click', () => {
        window.location.href = `${config.API_URL}/api/auth/42`
    })
}
```

## 5.4 L'appel API register (ApiService.ts)

```typescript
static async register(username: string, email: string, password: string, display_name?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, display_name }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw error;
    }

    const data = await response.json();
    this.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
}
```

## 5.5 Le backend : route /api/auth/register (auth.js)

```javascript
fastify.post('/register', async (request, reply) => {
    const { username, email, password, display_name } = request.body;

    // Validation avec Joi
    const schema = Joi.object({
        username: Joi.string().min(3).max(20).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        display_name: Joi.string().max(50).optional()
    });

    const { error } = schema.validate(request.body);
    if (error) {
        return reply.status(400).send({ error: 'Validation error', details: error.details });
    }

    // Verification que l'utilisateur n'existe pas deja
    const existingUser = fastify.db.prepare(
        'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existingUser) {
        return reply.status(409).send({ error: 'Username ou email deja utilise' });
    }

    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertion en base
    fastify.db.prepare(
        `INSERT INTO users (username, email, password_hash, display_name, is_online)
         VALUES (?, ?, ?, ?, 1)`
    ).run(username, email, hashedPassword, display_name || username);

    // Recuperation de l'utilisateur cree
    const user = fastify.db.prepare(
        'SELECT id, username, email, display_name, avatar_url FROM users WHERE username = ?'
    ).get(username);

    // Creation des statistiques initiales
    fastify.db.prepare(
        'INSERT INTO game_stats (user_id) VALUES (?)'
    ).run(user.id);

    // Generation du JWT
    const token = fastify.jwt.sign({
        id: user.id,
        username: user.username
    });

    return reply.status(201).send({ user, token });
});
```

## 5.6 Stockage cote client

Apres une inscription reussie :
1. Le token JWT est stocke dans `localStorage.token`
2. Les infos utilisateur sont stockees dans `localStorage.user`
3. L'utilisateur est redirige vers `/dashboard`

---

# 6. PROCESSUS DE CONNEXION

## 6.1 La page de connexion

La methode `renderLogin()` affiche le formulaire de connexion :

```typescript
static renderLogin(): string {
    return `
        <div class="auth-page">
            <div class="auth-container">
                <form id="login-form">
                    <input type="text" id="login-username" placeholder="Nom d'utilisateur" required />
                    <input type="password" id="login-password" placeholder="Mot de passe" required />
                    <button type="submit">Se connecter</button>
                </form>
                <button id="oauth42-btn">Connexion avec 42</button>
            </div>
        </div>
    `
}
```

## 6.2 La methode setupLoginForm()

```typescript
static setupLoginForm(): void {
    const form = document.getElementById('login-form') as HTMLFormElement

    form?.addEventListener('submit', async (e) => {
        e.preventDefault()

        const username = (document.getElementById('login-username') as HTMLInputElement).value
        const password = (document.getElementById('login-password') as HTMLInputElement).value

        try {
            const response = await ApiService.login(username, password)

            // Si 2FA est requis
            if ('two_factor_required' in response && response.two_factor_required) {
                // Afficher le formulaire 2FA
                this.showTwoFactorForm(username, password)
                return
            }

            // Sinon, redirection vers le dashboard
            window.location.href = '/dashboard'
        } catch (error) {
            // Affichage de l'erreur
        }
    })
}
```

## 6.3 L'appel API login

```typescript
static async login(username: string, password: string): Promise<AuthResponse | { two_factor_required: true }> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // Si 2FA requis, retourner sans stocker le token
    if (data.two_factor_required) {
        return data;
    }

    // Stocker le token et l'utilisateur
    this.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
}
```

## 6.4 Le backend : route /api/auth/login

```javascript
fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    // Recherche de l'utilisateur
    const user = fastify.db.prepare(
        'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(username, username);

    if (!user) {
        return reply.status(401).send({ error: 'Identifiants invalides' });
    }

    // Verification du mot de passe
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        return reply.status(401).send({ error: 'Identifiants invalides' });
    }

    // Si 2FA active, demander le code
    if (user.two_factor_enabled) {
        return {
            two_factor_required: true,
            message: 'Code 2FA requis'
        };
    }

    // Marquer l'utilisateur comme en ligne
    fastify.db.prepare(
        'UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(user.id);

    // Generation du JWT
    const token = fastify.jwt.sign({
        id: user.id,
        username: user.username
    });

    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url
        },
        token
    };
});
```

---

# 7. LE DASHBOARD (UTILISATEUR CONNECTE)

## 7.1 Navigation vers /dashboard

Quand l'utilisateur est connecte et accede a `/dashboard`, le routeur appelle `renderDashboard()`.

## 7.2 La methode renderDashboard()

```typescript
private renderDashboard(): void {
    // Verification de l'authentification
    const token = ApiService.getToken();
    if (!token) {
        this.navigate('/login');
        return;
    }

    // Afficher un loader
    this.updatePageContent('<div class="loading">Loading dashboard...</div>')

    // Charger le dashboard de maniere asynchrone
    DashboardPage.render().then(html => {
        this.updatePageContent(html)
        DashboardPage.setupEventListeners()
    }).catch(() => {
        this.navigate('/login')
    })
}
```

## 7.3 La classe DashboardPage

La classe `DashboardPage` genere le tableau de bord avec :
- Les statistiques de l'utilisateur
- L'historique des matchs
- Le classement (top 3)
- La liste d'amis
- Les demandes d'amis en attente

**Methode render() :**

```typescript
static async render(): Promise<string> {
    const user = await ApiService.getMe();
    const stats = await ApiService.getUserStats(user.id);
    const matches = await ApiService.getUserMatches(user.id, 10);
    const { friends } = await ApiService.getFriends();
    const pendingRequests = await ApiService.getPendingRequests();
    const top3 = await ApiService.getTop3Ranking();

    return `
        <div class="dashboard-page">
            <div class="dashboard-grid">
                <!-- Section Stats -->
                <div class="stats-card">
                    <h3>${user.display_name}</h3>
                    <p>Matchs: ${stats.total_matches}</p>
                    <p>Victoires: ${stats.wins}</p>
                    <p>Defaites: ${stats.losses}</p>
                    <p>Points de classement: ${stats.ranking_points}</p>
                </div>

                <!-- Graphique des matchs -->
                <div class="chart-card">
                    <canvas id="matches-chart"></canvas>
                </div>

                <!-- Historique des matchs -->
                <div class="matches-history">
                    ${matches.map(match => this.renderMatch(match, user.id)).join('')}
                </div>

                <!-- Top 3 -->
                <div class="ranking-card">
                    ${top3.map((player, index) => this.renderRankingPlayer(player, index)).join('')}
                </div>

                <!-- Liste d'amis -->
                <div class="friends-card">
                    ${friends.map(friend => this.renderFriend(friend)).join('')}
                </div>
            </div>
        </div>
    `;
}
```

## 7.4 Appels API effectues

Le dashboard fait plusieurs appels API :

1. `GET /api/auth/me` - Recupere les infos de l'utilisateur connecte
2. `GET /api/users/:id/stats` - Recupere les statistiques de jeu
3. `GET /api/users/:id/matches` - Recupere l'historique des matchs
4. `GET /api/friendships` - Recupere la liste d'amis
5. `GET /api/friendships/pending` - Recupere les demandes en attente
6. `GET /api/users/ranking/top3` - Recupere le top 3 du classement

## 7.5 Les graphiques Chart.js

Le dashboard utilise Chart.js pour afficher deux graphiques :

1. **Graphique circulaire (donut)** : Victoires vs Defaites
2. **Graphique en barres** : Points marques vs Points encaisses

```typescript
private static initCharts(stats: any): void {
    // Graphique victoires/defaites
    const donutCtx = document.getElementById('matches-chart') as HTMLCanvasElement;
    new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Victoires', 'Defaites'],
            datasets: [{
                data: [stats.wins, stats.losses],
                backgroundColor: ['#00ff41', '#ff4444']
            }]
        }
    });
}
```

---

# 8. LE SYSTEME DE CHAT WEBSOCKET

## 8.1 Initialisation du ChatService

Quand l'utilisateur est connecte, le `ChatService` est initialise dans `main.ts` :

```typescript
private initChat(): void {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')

    if (token && user) {
        this.chatService = ChatService.getInstance()
        this.chatService.connect(token)
        this.chatButton = new ChatButton()
        this.chatButton.mount(document.body)
    }
}
```

## 8.2 La classe ChatService (Singleton)

```typescript
export class ChatService {
    private static instance: ChatService | null = null
    private ws: WebSocket | null = null
    private messageHandlers: Set<(message: any) => void> = new Set()
    private friendsHandlers: Set<(friends: Friend[]) => void> = new Set()

    // Singleton
    static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService()
        }
        return ChatService.instance
    }
}
```

**Structure de donnees :**
- `ws` : Instance WebSocket
- `messageHandlers` : Set de callbacks appeles quand un message arrive
- `friendsHandlers` : Set de callbacks appeles quand la liste d'amis change

## 8.3 Connexion WebSocket

```typescript
connect(token: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
    }

    const WS_URL = config.CHAT_WS_URL;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
        console.log('Chat WebSocket connected');
        // Authentification
        this.send({ type: 'AUTH', token });
    };

    this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
    };
}
```

## 8.4 Types de messages WebSocket

**Messages entrants (du serveur vers le client) :**
- `AUTH_SUCCESS` : Authentification reussie
- `NEW_MESSAGE` : Nouveau message de chat
- `FRIEND_ONLINE` : Un ami se connecte
- `FRIEND_OFFLINE` : Un ami se deconnecte
- `FRIENDSHIP_REQUEST_RECEIVED` : Nouvelle demande d'ami
- `FRIENDSHIP_ACCEPTED` : Demande d'ami acceptee
- `FRIENDSHIP_REMOVED` : Ami supprime

**Messages sortants (du client vers le serveur) :**
- `AUTH` : Envoi du token JWT
- `MESSAGE` : Envoi d'un message
- `GET_HISTORY` : Demande l'historique des messages

## 8.5 Backend : route /api/chat/ws

```javascript
fastify.get('/ws', { websocket: true }, (connection, request) => {
    const { socket } = connection;
    let currentUser = null;

    socket.on('message', async (rawMessage) => {
        const message = JSON.parse(rawMessage.toString());

        switch (message.type) {
            case 'AUTH':
                // Verification du JWT
                const decoded = fastify.jwt.verify(message.token);
                currentUser = decoded;

                // Stocker la connexion
                clients.set(currentUser.id, socket);

                // Marquer l'utilisateur comme en ligne
                fastify.db.prepare(
                    'UPDATE users SET is_online = 1 WHERE id = ?'
                ).run(currentUser.id);

                // Notifier les amis
                notifyFriendsOfStatus(currentUser.id, true);

                socket.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
                break;

            case 'MESSAGE':
                // Sauvegarder le message en base
                fastify.db.prepare(
                    `INSERT INTO messages (sender_id, recipient_id, content)
                     VALUES (?, ?, ?)`
                ).run(currentUser.id, message.recipient_id, message.content);

                // Envoyer au destinataire s'il est connecte
                const recipientWs = clients.get(message.recipient_id);
                if (recipientWs && recipientWs.readyState === 1) {
                    recipientWs.send(JSON.stringify({
                        type: 'NEW_MESSAGE',
                        message: {
                            sender_id: currentUser.id,
                            content: message.content,
                            created_at: new Date().toISOString()
                        }
                    }));
                }
                break;
        }
    });

    socket.on('close', () => {
        if (currentUser) {
            clients.delete(currentUser.id);
            fastify.db.prepare(
                'UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(currentUser.id);
            notifyFriendsOfStatus(currentUser.id, false);
        }
    });
});
```

## 8.6 Le composant ChatButton

Le `ChatButton` est un bouton flottant qui apparait en bas a droite de l'ecran. Quand on clique dessus, il ouvre une fenetre de chat.

```typescript
export class ChatButton {
    private element: HTMLElement | null = null
    private chatWindow: ChatWindow | null = null
    private unreadCount: number = 0

    mount(container: HTMLElement): void {
        this.element = document.createElement('div')
        this.element.className = 'chat-button'
        this.element.innerHTML = `
            <span class="material-symbols-outlined">chat</span>
            <span class="unread-badge" style="display: none;">0</span>
        `

        this.element.addEventListener('click', () => this.toggleChat())
        container.appendChild(this.element)
    }

    private toggleChat(): void {
        if (this.chatWindow) {
            this.chatWindow.destroy()
            this.chatWindow = null
        } else {
            this.chatWindow = new ChatWindow()
            this.chatWindow.mount(document.body)
        }
    }
}
```

---

# 9. LE JEU PONG LOCAL

## 9.1 Navigation vers /game

Quand l'utilisateur clique sur "Entrainement" ou sur le bouton "Jouer", le routeur appelle `renderGameModeSelection()`.

## 9.2 La methode renderGameModeSelection()

```typescript
private renderGameModeSelection(): void {
    // Activer le mode plein ecran
    document.body.classList.add('fullscreen-game');

    // Injecter le template de jeu
    this.updatePageContent(gameModeTemplate);

    // Initialiser le jeu apres un court delai
    setTimeout(() => {
        this.initPongGame(false, AIDifficulty.MEDIUM);
        this.setupGameOptions();
    }, 100);
}
```

## 9.3 Le template game.html

Le template contient :
- Un canvas HTML5 pour le rendu du jeu
- Une barre de controle avec :
  - Un toggle "Mode IA" (on/off)
  - Un select de difficulte (Facile/Moyen/Difficile)
  - Un indicateur de score
  - Les controles clavier (W/S pour le joueur gauche, fleches pour le joueur droit)

## 9.4 La methode initPongGame()

```typescript
private async initPongGame(isAI: boolean = false, difficulty: AIDifficulty = AIDifficulty.MEDIUM): Promise<void> {
    const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement
    if (!canvas) return

    // Detruire le jeu precedent
    if (this.currentGame) {
        this.currentGame.destroy()
    }

    // Recuperer l'ID de l'utilisateur connecte
    let player1Id: string | undefined = undefined
    try {
        const user = await ApiService.getMe()
        player1Id = user.id
    } catch (error) {
        console.warn('User not authenticated, match will not be saved')
    }

    // Creer le jeu
    this.currentGame = new PongGame(
        canvas,
        isAI,                    // IA activee ?
        difficulty,              // Difficulte de l'IA
        false,                   // Mode tournoi ?
        true,                    // Afficher controles gauche ?
        true,                    // Afficher controles droite ?
        '',                      // Nom joueur 1
        '',                      // Nom joueur 2
        player1Id,               // ID joueur 1
        undefined,               // ID joueur 2
        isAI ? 'vs_ai' : 'local' // Mode de jeu
    )

    canvas.focus()
}
```

## 9.5 La classe PongGame

La classe `PongGame` est le moteur de jeu principal. Elle gere :
- Le rendu graphique sur le canvas
- La physique de la balle et des raquettes
- Les collisions
- Le score
- Les controles clavier
- L'IA (si activee)

**Structure de donnees :**

```typescript
export class PongGame {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private config: GameConfig
    private state: GameState

    private ball!: Ball
    private leftPaddle!: Paddle
    private rightPaddle!: Paddle
    private ai?: AIPlayer

    private isAIEnabled: boolean = false
    private isTournamentMode: boolean = false
    private player1Id?: string
    private player2Id?: string
    private gameMode: string = 'local'
}
```

**Interface GameConfig :**
```typescript
interface GameConfig {
    width: number        // Largeur du canvas
    height: number       // Hauteur du canvas
    paddleSpeed: number  // Vitesse des raquettes (300)
    ballSpeed: number    // Vitesse de la balle (400)
    paddleHeight: number // Hauteur des raquettes (100)
    paddleWidth: number  // Largeur des raquettes (10)
    ballSize: number     // Taille de la balle (20)
}
```

**Interface GameState :**
```typescript
interface GameState {
    leftScore: number           // Score joueur gauche
    rightScore: number          // Score joueur droit
    isRunning: boolean          // Jeu en cours ?
    winner: 'left' | 'right' | null  // Gagnant
}
```

## 9.6 Initialisation du jeu

```typescript
constructor(canvas: HTMLCanvasElement, aiEnabled: boolean, aiDifficulty: AIDifficulty, ...) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.isAIEnabled = aiEnabled

    // Configuration du jeu
    this.config = {
        width: canvas.parentElement?.clientWidth || 1600,
        height: canvas.parentElement?.clientHeight || 900,
        paddleSpeed: 300,
        ballSpeed: 400,
        paddleHeight: 100,
        paddleWidth: 10,
        ballSize: 20
    }

    // Etat initial
    this.state = {
        leftScore: 0,
        rightScore: 0,
        isRunning: false,
        winner: null
    }

    this.setupCanvas()
    this.initializeGameObjects()
    this.setupEventListeners()

    // Initialiser l'IA si activee
    if (this.isAIEnabled) {
        this.ai = new AIPlayer(this.config, aiDifficulty)
    }

    this.render()
}
```

## 9.7 Les objets du jeu

**La balle (Ball.ts) :**
```typescript
export class Ball {
    public position: Vector2D    // Position x, y
    public velocity: Vector2D    // Vitesse vx, vy
    public size: number          // Diametre
    private baseSpeed: number    // Vitesse de base

    update(deltaTime: number): void {
        // Mise a jour de la position
        this.position.x += this.velocity.x * deltaTime
        this.position.y += this.velocity.y * deltaTime

        // Rebond sur les murs haut/bas
        if (this.position.y <= this.size/2 ||
            this.position.y >= this.config.height - this.size/2) {
            this.velocity.y = -this.velocity.y
        }
    }

    isOutOfBounds(): 'left' | 'right' | null {
        if (this.position.x < -this.size) return 'left'
        if (this.position.x > this.config.width + this.size) return 'right'
        return null
    }
}
```

**Les raquettes (Paddle.ts) :**
```typescript
export class Paddle {
    public position: Vector2D
    public width: number
    public height: number
    private moveDirection: number = 0  // -1 (haut), 0 (stop), 1 (bas)

    setMoveDirection(direction: number): void {
        this.moveDirection = Math.max(-1, Math.min(1, direction))
    }

    update(deltaTime: number): void {
        if (this.moveDirection === 0) return

        const newY = this.position.y + (this.moveDirection * this.config.paddleSpeed * deltaTime)
        this.position.y = Math.max(this.height/2, Math.min(this.config.height - this.height/2, newY))
    }

    checkCollision(ballPosition: Vector2D, ballSize: number): boolean {
        // Verification de collision rectangulaire
        const paddleLeft = this.position.x - this.width / 2
        const paddleRight = this.position.x + this.width / 2
        const paddleTop = this.position.y - this.height / 2
        const paddleBottom = this.position.y + this.height / 2

        return (
            ballPosition.x - ballSize/2 < paddleRight &&
            ballPosition.x + ballSize/2 > paddleLeft &&
            ballPosition.y - ballSize/2 < paddleBottom &&
            ballPosition.y + ballSize/2 > paddleTop
        )
    }
}
```

## 9.8 La boucle de jeu

```typescript
private gameLoop = (currentTime: number): void => {
    const deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Limiter deltaTime pour eviter les gros sauts
    const clampedDeltaTime = Math.min(deltaTime, 0.016)

    this.update(clampedDeltaTime)
    this.render()

    this.animationFrame = requestAnimationFrame(this.gameLoop)
}

private update(deltaTime: number): void {
    if (!this.state.isRunning) return

    this.handleInput()

    // Mettre a jour l'IA
    if (this.isAIEnabled && this.ai) {
        this.ai.update(this.rightPaddle, this.ball, deltaTime)
        this.ai.movePaddle(this.rightPaddle)
    }

    // Mettre a jour les objets
    this.leftPaddle.update(deltaTime)
    this.rightPaddle.update(deltaTime)
    this.ball.update(deltaTime)

    // Verifier les collisions
    this.checkPaddleCollisions()
    this.checkScoring()
    this.checkWinCondition()
}
```

## 9.9 L'Intelligence Artificielle (AIPlayer.ts)

L'IA utilise la prediction de trajectoire pour anticiper la position de la balle.

**Configuration par difficulte :**

```typescript
enum AIDifficulty { EASY, MEDIUM, HARD }

interface AIConfig {
    reactionDelay: number      // Delai de reaction (ms)
    accuracy: number           // Precision (0-1)
    maxSpeed: number           // Vitesse max (0-1)
    predictionError: number    // Marge d'erreur (pixels)
}

// Facile
{ reactionDelay: 600, accuracy: 0.25, maxSpeed: 0.5, predictionError: 200 }

// Moyen
{ reactionDelay: 250, accuracy: 0.6, maxSpeed: 0.7, predictionError: 80 }

// Difficile
{ reactionDelay: 100, accuracy: 0.9, maxSpeed: 0.95, predictionError: 25 }
```

**Prediction de trajectoire :**

```typescript
private predictBallPosition(ball: Ball, paddleX: number): BallPrediction {
    let x = ball.position.x
    let y = ball.position.y
    let vx = ball.velocity.x
    let vy = ball.velocity.y

    // Simuler le mouvement jusqu'a atteindre la raquette
    while ((vx > 0 && x < paddleX) || (vx < 0 && x > paddleX)) {
        const timeToWall = vy > 0
            ? (this.config.height - y) / vy
            : -y / vy
        const timeToTarget = (paddleX - x) / vx

        if (timeToWall < timeToTarget && timeToWall > 0) {
            // Rebond sur le mur
            x += vx * timeToWall
            y = vy > 0 ? this.config.height : 0
            vy = -vy
        } else {
            // La balle atteint la raquette
            y += vy * timeToTarget
            break
        }
    }

    return { x, y }
}
```

## 9.10 Fin de partie et sauvegarde

Quand un joueur atteint 5 points, la partie se termine :

```typescript
private async showVictoryModal(): Promise<void> {
    // Sauvegarder le match si le joueur est connecte
    if (this.player1Id) {
        await ApiService.saveLocalMatch({
            player2_id: this.player2Id,
            opponent_name: this.isAIEnabled ? 'IA' : 'Joueur local',
            winner_id: this.state.winner === 'left' ? this.player1Id : null,
            player1_score: this.state.leftScore,
            player2_score: this.state.rightScore,
            game_mode: this.gameMode
        });
    }

    // Afficher la modale de victoire
    const modal = document.getElementById('victoryModal')
    modal.style.display = 'flex'
}
```

---

# 10. LE SYSTEME DE TOURNOI

## 10.1 La classe TournamentManager

Le gestionnaire de tournoi gere :
- L'inscription des joueurs (humains et IA)
- La generation des matchs
- La progression du tournoi

**Structure de donnees :**

```typescript
interface Player {
    id: string
    alias: string
    joinedAt: Date
    isAI?: boolean
    aiDifficulty?: 'easy' | 'medium' | 'hard'
}

interface Match {
    id: string
    player1: Player
    player2: Player
    winner: Player | null
    score: { player1: number; player2: number }
    status: 'pending' | 'playing' | 'completed'
    round: number
}

interface TournamentState {
    id: string
    name: string
    players: Player[]
    matches: Match[]
    currentMatch: Match | null
    status: 'registration' | 'ready' | 'ongoing' | 'completed'
    winner: Player | null
    maxPlayers: number
}
```

## 10.2 Inscription des joueurs

```typescript
addPlayer(alias: string): { success: boolean; message: string; player?: Player } {
    // Verifications
    if (this.state.status !== 'registration') {
        return { success: false, message: 'Registration is closed' }
    }

    if (this.state.players.length >= this.config.maxPlayers) {
        return { success: false, message: 'Tournament is full' }
    }

    if (this.state.players.some(p => p.alias.toLowerCase() === alias.toLowerCase())) {
        return { success: false, message: 'This alias is already taken' }
    }

    // Creer le joueur
    const player: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alias: alias.trim(),
        joinedAt: new Date()
    }

    this.state.players.push(player)
    return { success: true, player }
}
```

## 10.3 Generation des matchs

Le tournoi necessite un nombre de joueurs en puissance de 2 (2, 4, 8, 16...).

```typescript
private generateMatches(): void {
    const players = [...this.state.players]

    // Melanger les joueurs aleatoirement
    this.shuffleArray(players)

    // Creer les matchs du premier tour
    for (let i = 0; i < players.length; i += 2) {
        const match: Match = {
            id: `match_1_${(i / 2) + 1}`,
            player1: players[i],
            player2: players[i + 1],
            winner: null,
            score: { player1: 0, player2: 0 },
            status: 'pending',
            round: 1
        }
        this.state.matches.push(match)
    }
}
```

## 10.4 Progression du tournoi

Apres chaque match, le tournoi verifie s'il faut generer le tour suivant :

```typescript
private checkTournamentCompletion(): void {
    const pendingMatches = this.state.matches.filter(m => m.status === 'pending')

    if (pendingMatches.length === 0) {
        // Tous les matchs du round sont termines
        const currentRound = Math.max(...this.state.matches.map(m => m.round))
        const winners = this.state.matches
            .filter(m => m.round === currentRound && m.winner)
            .map(m => m.winner!)

        if (winners.length === 1) {
            // Un seul gagnant = champion
            this.state.winner = winners[0]
            this.state.status = 'completed'
        } else {
            // Generer le tour suivant
            this.generateNextRound()
        }
    }
}

private generateNextRound(): void {
    const currentRound = Math.max(...this.state.matches.map(m => m.round))
    const winners = this.state.matches
        .filter(m => m.round === currentRound && m.winner)
        .map(m => m.winner!)

    const nextRound = currentRound + 1

    for (let i = 0; i < winners.length; i += 2) {
        const match: Match = {
            id: `match_${nextRound}_${(i / 2) + 1}`,
            player1: winners[i],
            player2: winners[i + 1],
            winner: null,
            score: { player1: 0, player2: 0 },
            status: 'pending',
            round: nextRound
        }
        this.state.matches.push(match)
    }

    this.state.status = 'ready'
}
```

---

# 11. LE JEU EN LIGNE MULTIJOUEUR

## 11.1 Architecture

Le jeu en ligne utilise :
- **Frontend** : `OnlineGamePage.ts` + `OnlinePongGame.ts` + `GameSocketService.ts`
- **Backend** : `game.js` + `GameRoom.js` + `RoomManager.js`

La logique du jeu est entierement geree cote serveur pour eviter la triche. Les clients envoient uniquement la position de leur raquette.

## 11.2 Le RoomManager (backend)

Le `RoomManager` est un singleton qui gere toutes les salles de jeu.

```javascript
class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> GameRoom
    }

    createRoom(creatorId, creatorUsername, roomName, password, maxScore) {
        const roomId = crypto.randomBytes(8).toString('hex');
        const room = new GameRoom(roomId, creatorId, creatorUsername, roomName, password, maxScore);
        this.rooms.set(roomId, room);
        return room;
    }

    joinRoom(roomId, playerId, username, password) {
        const room = this.rooms.get(roomId);

        if (!room) return { success: false, error: 'Room not found' };
        if (room.status === 'playing') return { success: false, error: 'Game in progress' };
        if (room.opponent) return { success: false, error: 'Room is full' };
        if (!room.verifyPassword(password)) return { success: false, error: 'Invalid password' };

        room.addPlayer(playerId, username);
        return { success: true, room };
    }
}
```

## 11.3 La GameRoom (backend)

Chaque salle de jeu contient :
- Les informations des deux joueurs
- L'etat du jeu (balle, raquettes, scores)
- La boucle de jeu cote serveur

```javascript
class GameRoom {
    constructor(roomId, creatorId, creatorUsername, roomName, password, maxScore) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.password = password;
        this.maxScore = maxScore;
        this.status = 'waiting';

        this.creator = { id: creatorId, username: creatorUsername, socket: null, ready: false };
        this.opponent = null;

        this.gameState = {
            ball: { x: 400, y: 225, vx: 200, vy: 150 },
            leftPaddle: { y: 175 },
            rightPaddle: { y: 175 },
            leftScore: 0,
            rightScore: 0,
            winner: null
        };

        this.config = {
            width: 800,
            height: 450,
            paddleSpeed: 300,
            ballSpeed: 300,
            paddleHeight: 100,
            paddleWidth: 10,
            ballSize: 10
        };
    }

    startGame() {
        this.status = 'playing';
        this.resetBall();

        // Boucle de jeu a 60 FPS
        this.gameInterval = setInterval(() => {
            this.updateGame();
        }, 1000 / 60);

        this.broadcast({ type: 'GAME_START', gameState: this.gameState });
    }

    updateGame() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        // Deplacer la balle
        this.gameState.ball.x += this.gameState.ball.vx * deltaTime;
        this.gameState.ball.y += this.gameState.ball.vy * deltaTime;

        // Collisions avec les murs
        // Collisions avec les raquettes
        // Verification des points
        // ...

        // Envoyer l'etat aux deux joueurs
        this.broadcast({ type: 'GAME_STATE', gameState: this.gameState });
    }

    broadcast(message) {
        if (this.creator.socket) {
            this.creator.socket.send(JSON.stringify(message));
        }
        if (this.opponent && this.opponent.socket) {
            this.opponent.socket.send(JSON.stringify(message));
        }
    }
}
```

## 11.4 Le GameSocketService (frontend)

```typescript
export class GameSocketService {
    private ws: WebSocket | null = null
    private roomId: string | null = null
    private playerSide: 'left' | 'right' | null = null

    // Callbacks
    public onGameStart?: () => void
    public onGameState?: (state: GameState) => void
    public onGameEnd?: (winner: string, ...) => void

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(config.GAME_WS_URL);

            this.ws.onopen = () => {
                const token = ApiService.getToken();
                this.send({ type: 'AUTH', token });
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);

                if (message.type === 'AUTH_SUCCESS') resolve();
            };
        });
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'JOINED_ROOM':
                this.roomId = message.roomId;
                this.playerSide = message.playerSide;
                break;

            case 'GAME_STATE':
                if (this.onGameState) {
                    this.onGameState(message.gameState);
                }
                break;

            case 'GAME_END':
                if (this.onGameEnd) {
                    this.onGameEnd(message.winner, message.winnerId, ...);
                }
                break;
        }
    }

    updatePaddle(y: number) {
        this.send({ type: 'PADDLE_MOVE', y });
    }
}
```

## 11.5 Flux de jeu en ligne

1. **Creation de salle** : Le joueur 1 cree une salle via `POST /api/game/rooms`
2. **Connexion WebSocket** : Le joueur 1 se connecte au WebSocket et envoie `AUTH`
3. **Rejoindre la salle** : Le joueur 1 envoie `JOIN_ROOM` avec l'ID de la salle
4. **Attente** : Le joueur 2 rejoint via `POST /api/game/rooms/:id/join`
5. **Pret** : Les deux joueurs envoient `READY: true`
6. **Demarrage** : Le serveur detecte que les deux sont prets et envoie `GAME_START`
7. **Jeu** : Le serveur envoie `GAME_STATE` a 60 FPS, les clients envoient `PADDLE_MOVE`
8. **Fin** : Le serveur envoie `GAME_END` avec le gagnant

---

# 12. LE SYSTEME D'AMIS

## 12.1 Envoi d'une demande d'ami

**Frontend :**
```typescript
// Dans DashboardPage.ts
static async handleAddFriend(userId: string) {
    await ApiService.sendFriendRequest(userId);
    // Rafraichir l'interface
}
```

**Backend (friendships.js) :**
```javascript
fastify.post('/', async (request, reply) => {
    const { friend_id } = request.body;
    const userId = request.user.id;

    // Verifier que l'utilisateur cible existe
    const userCheck = fastify.db.prepare(
        'SELECT id, username FROM users WHERE id = ?'
    ).get(friend_id);

    if (!userCheck) {
        return reply.status(404).send({ error: 'Utilisateur non trouve' });
    }

    // Verifier qu'une relation n'existe pas deja
    const existingFriendship = fastify.db.prepare(
        `SELECT id, status FROM friendships
         WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
    ).get(userId, friend_id, friend_id, userId);

    if (existingFriendship) {
        // Gerer les differents cas...
    }

    // Creer la demande
    const result = fastify.db.prepare(
        `INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')`
    ).run(userId, friend_id);

    // Notifier le destinataire via WebSocket
    const recipientWs = chatClients.get(friend_id);
    if (recipientWs) {
        recipientWs.send(JSON.stringify({
            type: 'friendship_request_received',
            request: { id: result.lastInsertRowid, sender: { id: userId, username: request.user.username } }
        }));
    }

    return reply.status(201).send({ message: 'Demande envoyee' });
});
```

## 12.2 Acceptation/Refus d'une demande

```javascript
fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params;
    const { action } = request.body; // 'accept', 'reject', 'block'
    const userId = request.user.id;

    const friendship = fastify.db.prepare(
        'SELECT * FROM friendships WHERE id = ?'
    ).get(id);

    if (action === 'accept') {
        // Seul le destinataire peut accepter
        if (friendship.friend_id !== userId) {
            return reply.status(403).send({ error: 'Non autorise' });
        }

        fastify.db.prepare(
            'UPDATE friendships SET status = ? WHERE id = ?'
        ).run('accepted', id);

        // Notifier l'expediteur
        const senderWs = chatClients.get(friendship.user_id);
        if (senderWs) {
            senderWs.send(JSON.stringify({
                type: 'friendship_accepted',
                friendship: { id, status: 'accepted' }
            }));
        }
    }

    if (action === 'reject') {
        fastify.db.prepare('DELETE FROM friendships WHERE id = ?').run(id);
    }

    // ...
});
```

---

# 13. L'AUTHENTIFICATION OAUTH 42

## 13.1 Flux OAuth

1. L'utilisateur clique sur "Connexion avec 42"
2. Le frontend redirige vers `{API_URL}/api/auth/42`
3. Fastify redirige vers l'API 42 pour l'autorisation
4. L'utilisateur s'authentifie sur le site de 42
5. 42 redirige vers `{API_URL}/api/auth/42/callback` avec un code
6. Le backend echange le code contre un token d'acces
7. Le backend recupere les infos utilisateur depuis l'API 42
8. Le backend cree ou met a jour l'utilisateur en base
9. Le backend genere un JWT et redirige vers le frontend

## 13.2 Configuration OAuth (oauth42.js)

```javascript
await fastify.register(require('@fastify/oauth2'), {
    name: 'oauth42',
    credentials: {
        client: {
            id: config.oauth42.clientId,
            secret: config.oauth42.clientSecret,
        },
        auth: {
            authorizeHost: 'https://api.intra.42.fr',
            authorizePath: '/oauth/authorize',
            tokenHost: 'https://api.intra.42.fr',
            tokenPath: '/oauth/token',
        },
    },
    startRedirectPath: '/42',
    callbackUri: config.oauth42.callbackUrl,
    scope: ['public'],
});
```

## 13.3 Le callback

```javascript
fastify.get('/42/callback', async (request, reply) => {
    // Echanger le code contre un token
    const token = await fastify.oauth42.getAccessTokenFromAuthorizationCodeFlow(request);

    // Recuperer les infos utilisateur
    const response = await fetch('https://api.intra.42.fr/v2/me', {
        headers: { Authorization: `Bearer ${token.token.access_token}` }
    });
    const userData = await response.json();

    // Extraire les informations
    const oauth_id = userData.id.toString();
    const username = userData.login;
    const email = userData.email;
    const avatar_url = userData.image?.link;

    // Verifier si l'utilisateur existe
    let user = fastify.db.prepare(
        'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
    ).get('42', oauth_id);

    if (!user) {
        // Creer le compte
        fastify.db.prepare(
            `INSERT INTO users (username, email, display_name, avatar_url, oauth_provider, oauth_id, is_online)
             VALUES (?, ?, ?, ?, ?, ?, 1)`
        ).run(username, email, userData.displayname, avatar_url, '42', oauth_id);

        user = fastify.db.prepare(
            'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
        ).get('42', oauth_id);

        // Creer les stats
        fastify.db.prepare('INSERT INTO game_stats (user_id) VALUES (?)').run(user.id);
    }

    // Generer le JWT
    const jwtToken = fastify.jwt.sign({ id: user.id, username: user.username });

    // Rediriger vers le frontend avec le token
    return reply.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify(user))}`);
});
```

---

# 14. L'AUTHENTIFICATION A DEUX FACTEURS (2FA)

## 14.1 Activation du 2FA

```javascript
// POST /api/2fa/enable
fastify.post('/enable', async (request, reply) => {
    const userId = request.user.id;

    fastify.db.prepare(
        'UPDATE users SET two_factor_enabled = 1 WHERE id = ?'
    ).run(userId);

    return { message: '2FA active', two_factor_enabled: true };
});
```

## 14.2 Processus de connexion avec 2FA

1. L'utilisateur soumet ses identifiants
2. Le backend verifie les identifiants
3. Si le 2FA est active, le backend retourne `{ two_factor_required: true }`
4. Le frontend affiche le formulaire de code
5. L'utilisateur demande l'envoi du code (`POST /api/2fa/send-code`)
6. Le backend genere un code a 6 chiffres et l'envoie par email
7. L'utilisateur entre le code
8. Le frontend envoie le code (`POST /api/2fa/verify`)
9. Le backend verifie le code et retourne le JWT

## 14.3 Envoi du code par email

```javascript
// POST /api/2fa/send-code
fastify.post('/send-code', async (request, reply) => {
    const { username, password } = request.body;

    // Verifier les identifiants
    const user = fastify.db.prepare(
        'SELECT * FROM users WHERE username = ?'
    ).get(username);

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        return reply.status(401).send({ error: 'Identifiants invalides' });
    }

    // Generer le code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Stocker en base
    fastify.db.prepare(
        `UPDATE users SET two_factor_code = ?, two_factor_expires_at = ? WHERE id = ?`
    ).run(code, expiresAt.toISOString(), user.id);

    // Envoyer l'email
    await emailService.send2FACode(user.email, code, user.username);

    return { message: 'Code envoye', email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') };
});
```

---

# 15. LA SIDEBAR DE PROFIL

## 15.1 La classe Sidebar (sidebar.ts)

La sidebar permet a l'utilisateur de :
- Modifier son pseudo (display_name)
- Changer son avatar
- Activer/desactiver le 2FA
- Se deconnecter

```typescript
export class Sidebar {
    private isOpen: boolean = false

    constructor() {
        this.setupEventListeners()
        this.loadUserData()
    }

    private setupEventListeners(): void {
        // Ouvrir la sidebar quand on clique sur l'avatar du header
        const headerAvatar = document.getElementById('header-user-avatar')
        headerAvatar?.addEventListener('click', () => this.toggle())

        // Fermer la sidebar
        const closeBtn = document.getElementById('sidebar-close')
        closeBtn?.addEventListener('click', () => this.close())

        // Upload d'avatar
        const avatarInput = document.getElementById('sidebar-avatar-input')
        avatarInput?.addEventListener('change', (e) => this.handleAvatarUpload(e))

        // Enregistrer le pseudo
        const saveBtn = document.getElementById('save-displayname-btn')
        saveBtn?.addEventListener('click', () => this.saveDisplayName())

        // Toggle 2FA
        const toggle2FA = document.getElementById('toggle-2fa-checkbox')
        toggle2FA?.addEventListener('change', () => this.handle2FAToggle())

        // Deconnexion
        const logoutLink = document.getElementById('sidebar-logout-link')
        logoutLink?.addEventListener('click', (e) => {
            e.preventDefault()
            this.handleLogout()
        })
    }

    private async loadUserData(): Promise<void> {
        const user = await ApiService.getMe()

        // Remplir les champs
        document.getElementById('sidebar-username').value = user.username
        document.getElementById('sidebar-email').value = user.email
        document.getElementById('sidebar-display-name').value = user.display_name

        // Afficher l'avatar
        const avatarEl = document.getElementById('sidebar-avatar')
        if (user.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.avatar_url}">`
        }

        // Etat du 2FA
        const status = await ApiService.get2FAStatus()
        document.getElementById('toggle-2fa-checkbox').checked = status.two_factor_enabled
    }

    private async handleAvatarUpload(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return

        const result = await ApiService.uploadAvatar(file)

        // Mettre a jour l'affichage
        document.getElementById('sidebar-avatar').innerHTML = `<img src="${result.avatar_url}">`

        // Emettre un evenement pour mettre a jour le header
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: { user: result.user } }))
    }
}
```

---

# 16. L'INTERNATIONALISATION (i18n)

## 16.1 Le service I18nService

```typescript
export type Language = 'fr' | 'es' | 'en'

export class I18nService {
    private static instance: I18nService
    private currentLanguage: Language = 'fr'
    private translations: Record<Language, object> = { fr: {}, es: {}, en: {} }

    private constructor() {
        this.loadSavedLanguage()
        this.loadTranslations()
    }

    static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService()
        }
        return I18nService.instance
    }

    private async loadTranslations(): Promise<void> {
        const frTranslations = await import('../i18n/fr.json')
        const esTranslations = await import('../i18n/es.json')
        const enTranslations = await import('../i18n/en.json')

        this.translations.fr = frTranslations.default
        this.translations.es = esTranslations.default
        this.translations.en = enTranslations.default

        window.dispatchEvent(new CustomEvent('translationsLoaded'))
    }

    t(key: string, defaultValue: string = key): string {
        const keys = key.split('.')
        let translation: any = this.translations[this.currentLanguage]

        for (const k of keys) {
            if (translation && k in translation) {
                translation = translation[k]
            } else {
                return defaultValue
            }
        }

        return typeof translation === 'string' ? translation : defaultValue
    }

    setLanguage(language: Language): void {
        this.currentLanguage = language
        localStorage.setItem('language', language)
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }))
    }
}

export const i18n = I18nService.getInstance()
```

## 16.2 Fichiers de traduction

Les fichiers JSON sont dans `frontend/src/i18n/` :

**fr.json (extrait) :**
```json
{
  "header": {
    "home": "Accueil",
    "training": "Entrainement",
    "tournament": "Tournoi",
    "onlineMatch": "Match en ligne",
    "login": "Connexion"
  },
  "game": {
    "aiMode": "Mode IA",
    "difficulty": "Difficulte",
    "easy": "Facile",
    "medium": "Moyen",
    "hard": "Difficile",
    "startGame": "Toucher ESPACE pour lancer une partie"
  }
}
```

## 16.3 Utilisation dans le code

```typescript
// Dans un composant
import { i18n } from './services/i18n'

const title = i18n.t('header.home', 'Accueil')  // Retourne la traduction ou 'Accueil' par defaut

// Ecouter les changements de langue
window.addEventListener('languageChanged', () => {
    this.updateLabels()
})
```

---

# CONCLUSION

Cette analyse couvre l'ensemble du fonctionnement de ft_transcendence :

1. **Architecture SPA** avec un routeur custom, pas de framework frontend
2. **Backend Fastify** avec SQLite et WebSocket pour le temps reel
3. **Jeu Pong** avec physique, IA configurable, mode local et en ligne
4. **Systeme de tournoi** avec brackets et progression automatique
5. **Chat temps reel** via WebSocket avec notifications d'etat
6. **Authentification** classique, OAuth 42, et 2FA par email
7. **Gestion d'amis** avec demandes, acceptation, blocage
8. **Internationalisation** FR/EN/ES

L'application utilise des patterns modernes (Singleton, Observer via CustomEvents) et une separation claire entre frontend et backend. La logique du jeu en ligne est entierement cote serveur pour la securite.
