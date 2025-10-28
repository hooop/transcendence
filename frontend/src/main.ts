// Point d'entrée principal de l'application
import { Router } from './router.ts'
import { App } from './App.ts'
import { ChatService } from './services/ChatService'
import { ChatButton } from './components/ChatButton'

class TranscendenceApp {
    private app: App
    private router: Router
    private chatService: ChatService | null = null
    private chatButton: ChatButton | null = null

    constructor() {
        console.log('ft_transcendence starting...')

        // Initialiser l'application
        this.app = new App()

        // Initialiser le routeur pour la SPA
        this.router = new Router()

        // Démarrer l'app
        this.start()
    }

    private start(): void {
        // Vérifier que le DOM est chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init())
        } else {
            this.init()
        }
    }

    private init(): void {
        console.log('App initialized')

        // Monter l'application dans le DOM
        this.app.mount('#app')

        // Démarrer le routeur
        this.router.start()

        // Initialiser le chat si l'utilisateur est connecté
        this.initChat()
    }

    private initChat(): void {
        const token = localStorage.getItem('token')
        const user = localStorage.getItem('user')

        if (token && user) {
            // Connecter au WebSocket
            this.chatService = ChatService.getInstance()
            this.chatService.connect(token)

            // Afficher le bouton de chat
            this.chatButton = new ChatButton()
            this.chatButton.mount(document.body)

            console.log('Chat initialized')
        }
    }
}

// Lancer l'application
new TranscendenceApp()