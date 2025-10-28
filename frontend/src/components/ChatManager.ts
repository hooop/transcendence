// Gestionnaire de fenêtres de chat (comme Facebook Messenger)

import { ChatWindow, ChatWindowOptions } from './ChatWindow';

export class ChatManager {
    private static instance: ChatManager;
    private container: HTMLElement | null = null;
    private openWindows: Map<string, ChatWindow> = new Map();
    private maxWindows: number = 3;

    private constructor() {
        this.setupContainer();
    }

    static getInstance(): ChatManager {
        if (!ChatManager.instance) {
            ChatManager.instance = new ChatManager();
        }
        return ChatManager.instance;
    }

    private setupContainer(): void {
        this.container = document.createElement('div');
        this.container.id = 'chat-windows-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 0;
            right: 20px;
            display: flex;
            gap: 12px;
            z-index: 999;
            flex-direction: row-reverse;
        `;
        document.body.appendChild(this.container);
    }

    // Ouvrir une fenêtre de chat
    openChat(options: ChatWindowOptions): void {
        // Si la fenêtre est déjà ouverte, la mettre en avant
        if (this.openWindows.has(options.userId)) {
            return;
        }

        // Fermer la fenêtre la plus ancienne si on atteint le max
        if (this.openWindows.size >= this.maxWindows) {
            const firstKey = this.openWindows.keys().next().value;
            if (firstKey) {
                this.closeChat(firstKey);
            }
        }

        // Créer et monter la nouvelle fenêtre avec callback de fermeture
        const chatWindow = new ChatWindow(options, () => {
            // Callback appelé quand la fenêtre se ferme
            this.openWindows.delete(options.userId);
            this.updateChatButtonVisibility();
        });

        if (this.container) {
            chatWindow.mount(this.container);
            this.openWindows.set(options.userId, chatWindow);
        }

        // Masquer le bouton de chat (mettre en arrière-plan)
        this.updateChatButtonVisibility();
    }

    // Fermer une fenêtre de chat
    closeChat(userId: string): void {
        const window = this.openWindows.get(userId);
        if (window) {
            window.close();
            this.openWindows.delete(userId);
        }

        // Afficher le bouton de chat si aucune fenêtre n'est ouverte
        this.updateChatButtonVisibility();
    }

    // Mettre à jour la visibilité du bouton de chat
    private updateChatButtonVisibility(): void {
        const chatButton = document.querySelector('.chat-button-container') as HTMLElement;
        if (chatButton) {
            if (this.openWindows.size > 0) {
                // Fenêtres ouvertes : réduire le z-index pour passer derrière
                chatButton.style.zIndex = '900';
            } else {
                // Aucune fenêtre : remettre au premier plan
                chatButton.style.zIndex = '1001';
            }
        }
    }

    // Fermer toutes les fenêtres
    closeAll(): void {
        this.openWindows.forEach((window) => window.close());
        this.openWindows.clear();
    }

    // Vérifier si une fenêtre est ouverte
    isOpen(userId: string): boolean {
        return this.openWindows.has(userId);
    }
}
