# 💬 Guide du Système de Chat

Le système de chat en temps réel est maintenant opérationnel ! Il fonctionne avec WebSocket et offre une interface style "Facebook Messenger" avec des fenêtres popup en bas à droite.

## 🎯 Fonctionnalités

### Backend
- ✅ WebSocket pour la communication temps réel
- ✅ Messages privés entre utilisateurs
- ✅ Historique des messages persistant en base de données
- ✅ Statut "en train d'écrire" (typing indicator)
- ✅ Notifications de statut en ligne/hors ligne des amis
- ✅ Marquage des messages comme lus
- ✅ API REST pour récupérer les conversations et l'historique

### Frontend
- ✅ Bouton de chat flottant en bas à droite (style Facebook)
- ✅ Badge de notifications pour les messages non lus
- ✅ Liste des conversations avec aperçu du dernier message
- ✅ Fenêtres de chat popup (jusqu'à 3 simultanées)
- ✅ Design moderne et responsive
- ✅ Indicateur "en train d'écrire"
- ✅ Statut en ligne/hors ligne avec pastille de couleur
- ✅ Reconnexion automatique en cas de déconnexion

## 📁 Structure des fichiers

### Backend
```
backend/src/routes/chat.js          # Routes WebSocket et HTTP pour le chat
```

### Frontend
```
frontend/src/
├── services/
│   └── ChatService.ts              # Service WebSocket et API HTTP
├── components/
│   ├── ChatButton.ts               # Bouton flottant + liste des conversations
│   ├── ChatWindow.ts               # Fenêtre de chat individuelle
│   └── ChatManager.ts              # Gestionnaire des fenêtres ouvertes
└── utils/
    └── chatHelper.ts               # Helper pour ouvrir le chat facilement
```

## 🚀 Utilisation

### Backend

#### Routes HTTP

**GET** `/api/chat/conversations` (authentifié)
- Récupère la liste des conversations de l'utilisateur
- Retourne : `{ conversations: Conversation[], total: number }`

**GET** `/api/chat/messages/:userId` (authentifié)
- Récupère l'historique des messages avec un utilisateur
- Query params : `limit` (défaut: 50), `before` (timestamp)
- Retourne : `{ messages: ChatMessage[], total: number }`

**POST** `/api/chat/messages` (authentifié)
- Envoie un message (fallback HTTP si WebSocket indisponible)
- Body : `{ recipient_id: string, content: string }`

#### WebSocket

**Connexion** : `ws://localhost:3000/api/chat/ws?token=YOUR_JWT_TOKEN`

**Messages envoyés au serveur** :
```javascript
// Envoyer un message
{
  type: 'send_message',
  recipient_id: 'user-uuid',
  content: 'Hello!'
}

// Marquer comme lu
{
  type: 'mark_as_read',
  sender_id: 'user-uuid'
}

// Indicateur "en train d'écrire"
{
  type: 'typing',
  recipient_id: 'user-uuid',
  is_typing: true
}
```

**Messages reçus du serveur** :
```javascript
// Nouveau message reçu
{
  type: 'new_message',
  message: { id, sender_id, content, created_at, ... }
}

// Message envoyé avec succès
{
  type: 'message_sent',
  message: { ... }
}

// Quelqu'un tape un message
{
  type: 'typing',
  sender_id: 'user-uuid',
  is_typing: true
}

// Changement de statut d'un ami
{
  type: 'friend_status',
  user_id: 'user-uuid',
  is_online: true
}
```

### Frontend

#### 1. Initialisation automatique

Le chat s'initialise automatiquement quand un utilisateur est connecté :
```typescript
// Dans main.ts (déjà fait)
const token = localStorage.getItem('token')
if (token) {
  const chatService = ChatService.getInstance()
  chatService.connect(token)

  const chatButton = new ChatButton()
  chatButton.mount(document.body)
}
```

#### 2. Ouvrir une fenêtre de chat

**Méthode 1 : Depuis la liste d'amis**
```typescript
import { ChatHelper } from './utils/chatHelper'
import { Friend } from './services/api'

// friend est un objet Friend
ChatHelper.openChatWithFriend(friend)
```

**Méthode 2 : Manuellement**
```typescript
import { ChatManager } from './components/ChatManager'

const chatManager = ChatManager.getInstance()
chatManager.openChat({
  userId: 'user-uuid',
  username: 'john_doe',
  displayName: 'John Doe',
  avatarUrl: 'http://...',
  isOnline: true
})
```

**Méthode 3 : Via le bouton de chat**
L'utilisateur clique sur le bouton flottant, puis sur une conversation dans la liste.

#### 3. Envoyer un message programmatiquement

```typescript
import { ChatService } from './services/ChatService'

const chatService = ChatService.getInstance()
chatService.sendMessage('recipient-user-id', 'Hello!')
```

#### 4. Écouter les événements

```typescript
const chatService = ChatService.getInstance()

// Nouveau message
const unsubMessage = chatService.onMessage((message) => {
  console.log('New message:', message)
})

// Quelqu'un tape
const unsubTyping = chatService.onTyping((userId, isTyping) => {
  console.log(`User ${userId} is typing: ${isTyping}`)
})

// Changement de statut
const unsubStatus = chatService.onStatusChange((userId, isOnline) => {
  console.log(`User ${userId} is now ${isOnline ? 'online' : 'offline'}`)
})

// Se désabonner
unsubMessage()
unsubTyping()
unsubStatus()
```

## 🎨 Personnalisation du style

Les styles sont injectés directement dans les composants. Pour les modifier :

### Couleurs principales
- Gradient : `#667eea` → `#764ba2`
- Messages envoyés : `#667eea`
- Messages reçus : `#e4e6eb`

### Tailles
- Fenêtre de chat : `320px × 400px`
- Nombre max de fenêtres : `3` (modifiable dans `ChatManager.maxWindows`)
- Bouton flottant : `56px × 56px`

## 🔧 Intégration avec la liste d'amis

Pour ajouter un bouton "Envoyer un message" dans votre liste d'amis :

```typescript
import { ChatHelper } from './utils/chatHelper'

// Dans le template de votre liste d'amis
friends.forEach(friend => {
  const chatBtn = document.createElement('button')
  chatBtn.textContent = 'Message'
  chatBtn.onclick = () => ChatHelper.openChatWithFriend(friend)
  // Ajouter le bouton à votre UI
})
```

## 📊 Base de données

La table `messages` existe déjà :
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID REFERENCES users(id),
    room_id VARCHAR(100),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🐛 Débogage

### Vérifier la connexion WebSocket
```javascript
// Dans la console du navigateur
const chatService = ChatService.getInstance()
// Vérifier l'état de connexion dans l'onglet Network → WS
```

### Logs backend
```bash
docker-compose logs -f backend
# Vous devriez voir :
# "Client connecté au chat: user-uuid"
# "Client déconnecté du chat: user-uuid"
```

### Tester l'envoi de messages
```bash
# Méthode HTTP (fallback)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient_id":"user-uuid","content":"Test message"}'
```

## 🚀 Prochaines améliorations possibles

- [ ] Rooms de groupe (chat à plusieurs)
- [ ] Envoi d'images/fichiers
- [ ] Réactions aux messages (emojis)
- [ ] Messages vocaux
- [ ] Historique infini (infinite scroll)
- [ ] Recherche dans les messages
- [ ] Suppression de messages
- [ ] Messages éphémères
- [ ] Notifications push
- [ ] Indicateur de "vu à..."

## 📝 Notes

- Les messages sont automatiquement marqués comme lus quand la fenêtre de chat est ouverte
- Le système se reconnecte automatiquement en cas de déconnexion
- Maximum 3 fenêtres de chat simultanées (la plus ancienne se ferme automatiquement)
- Le statut en ligne est mis à jour en temps réel via WebSocket
- Les conversations sont triées par date du dernier message
