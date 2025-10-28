// Fenêtre de chat style Facebook (popup en bas à droite)

import { ChatService, ChatMessage } from '../services/ChatService';

export interface ChatWindowOptions {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isOnline: boolean;
}

export class ChatWindow {
    private container: HTMLElement;
    private options: ChatWindowOptions;
    private chatService: ChatService;
    private messages: ChatMessage[] = [];
    private isMinimized: boolean = false;
    private isTyping: boolean = false;
    private typingTimeout: number | null = null;
    private unsubscribers: Array<() => void> = [];
    private onCloseCallback?: () => void;

    constructor(options: ChatWindowOptions, onClose?: () => void) {
        this.options = options;
        this.onCloseCallback = onClose;
        this.chatService = ChatService.getInstance();
        this.container = this.createWindow();
        this.attachEventListeners();
        this.loadMessages();
        this.setupRealtimeListeners();
    }

    private createWindow(): HTMLElement {
        const windowDiv = document.createElement('div');
        windowDiv.className = 'chat-window';
        windowDiv.dataset.userId = this.options.userId;

        windowDiv.innerHTML = `
            <div class="chat-window-header">
                <div class="chat-window-user">
                    <div class="chat-avatar ${this.options.isOnline ? 'online' : 'offline'}">
                        ${this.options.avatarUrl
                            ? `<img src="${this.options.avatarUrl}" alt="${this.options.displayName}">`
                            : `<div class="avatar-placeholder">${this.options.displayName[0]}</div>`
                        }
                    </div>
                    <span class="chat-username">${this.options.displayName}</span>
                </div>
                <div class="chat-window-actions">
                    <button class="btn-close" title="Fermer">×</button>
                </div>
            </div>
            <div class="chat-window-body">
                <div class="chat-messages" id="chat-messages-${this.options.userId}"></div>
                <div class="chat-typing-indicator" style="display: none;">
                    <span>${this.options.displayName} est en train d'écrire...</span>
                </div>
            </div>
            <div class="chat-window-footer">
                <input type="text" class="chat-input" placeholder="Écrivez un message..." />
                <button class="btn-send">Envoyer</button>
            </div>
        `;

        return windowDiv;
    }

    private attachEventListeners(): void {
        // Fermer (bouton ×)
        const btnClose = this.container.querySelector('.btn-close');
        btnClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        // Envoyer message
        const input = this.container.querySelector('.chat-input') as HTMLInputElement;
        const btnSend = this.container.querySelector('.btn-send');

        btnSend?.addEventListener('click', () => this.sendMessage());
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Indicateur "en train d'écrire"
        input?.addEventListener('input', () => {
            if (!this.isTyping) {
                this.isTyping = true;
                this.chatService.sendTyping(this.options.userId, true);
            }

            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }

            this.typingTimeout = window.setTimeout(() => {
                this.isTyping = false;
                this.chatService.sendTyping(this.options.userId, false);
            }, 2000);
        });
    }

    private setupRealtimeListeners(): void {
        // Écouter les nouveaux messages
        const unsubMessage = this.chatService.onMessage((message) => {
            if (message.sender_id === this.options.userId || message.recipient_id === this.options.userId) {
                this.messages.push(message);
                this.renderMessages();
                this.scrollToBottom();

                // Marquer comme lu si la fenêtre est ouverte
                if (!this.isMinimized && message.sender_id === this.options.userId) {
                    this.chatService.markAsRead(this.options.userId);
                }
            }
        });

        // Écouter l'indicateur "en train d'écrire"
        const unsubTyping = this.chatService.onTyping((userId, isTyping) => {
            if (userId === this.options.userId) {
                const indicator = this.container.querySelector('.chat-typing-indicator') as HTMLElement;
                if (indicator) {
                    indicator.style.display = isTyping ? 'block' : 'none';
                }
            }
        });

        // Écouter les changements de statut
        const unsubStatus = this.chatService.onStatusChange((userId, isOnline) => {
            if (userId === this.options.userId) {
                this.options.isOnline = isOnline;
                const avatar = this.container.querySelector('.chat-avatar');
                if (avatar) {
                    avatar.className = `chat-avatar ${isOnline ? 'online' : 'offline'}`;
                }
            }
        });

        this.unsubscribers.push(unsubMessage, unsubTyping, unsubStatus);
    }

    private async loadMessages(): Promise<void> {
        try {
            const { messages } = await ChatService.getMessages(this.options.userId);
            this.messages = messages;
            this.renderMessages();
            this.scrollToBottom();

            // Marquer comme lu
            this.chatService.markAsRead(this.options.userId);
        } catch (error) {
            console.error('Erreur lors du chargement des messages:', error);
        }
    }

    private renderMessages(): void {
        const messagesContainer = this.container.querySelector(`#chat-messages-${this.options.userId}`);
        if (!messagesContainer) return;

        const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

        messagesContainer.innerHTML = this.messages.map(msg => {
            const isMine = msg.sender_id === currentUserId;
            const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="chat-message ${isMine ? 'mine' : 'theirs'}">
                    <div class="message-content">${this.escapeHtml(msg.content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');
    }

    private sendMessage(): void {
        const input = this.container.querySelector('.chat-input') as HTMLInputElement;
        const content = input.value.trim();

        if (!content) return;

        this.chatService.sendMessage(this.options.userId, content);
        input.value = '';

        // Arrêter l'indicateur "en train d'écrire"
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        this.isTyping = false;
        this.chatService.sendTyping(this.options.userId, false);
    }

    private scrollToBottom(): void {
        const messagesContainer = this.container.querySelector(`#chat-messages-${this.options.userId}`);
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    close(): void {
        // Nettoyer les abonnements
        this.unsubscribers.forEach(unsub => unsub());
        this.container.remove();

        // Notifier le ChatManager
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    mount(parent: HTMLElement): void {
        parent.appendChild(this.container);
        this.addStyles();
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private addStyles(): void {
        if (document.getElementById('chat-window-styles')) return;

        const style = document.createElement('style');
        style.id = 'chat-window-styles';
        style.textContent = `
            .chat-window {
                position: fixed;
                bottom: 0;
                width: 320px;
                height: 400px;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 8px 8px 0 0;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
                z-index: 1000;
            }

            .chat-window-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 8px 8px 0 0;
                user-select: none;
            }

            .chat-window-user {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .chat-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                position: relative;
                background: #fff;
            }

            .chat-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }

            .chat-avatar::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 2px solid white;
                z-index: 10;
            }

            .chat-avatar.online::after {
                background: #44b700;
            }

            .chat-avatar.offline::after {
                background: #999;
            }

            .avatar-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #667eea;
                color: white;
                font-weight: bold;
                font-size: 16px;
            }

            .chat-username {
                font-weight: 600;
                font-size: 14px;
            }

            .chat-window-actions {
                display: flex;
                gap: 8px;
            }

            .chat-window-actions button {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .chat-window-actions button:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .chat-window-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #f5f5f5;
            }

            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .chat-message {
                display: flex;
                flex-direction: column;
                max-width: 70%;
            }

            .chat-message.mine {
                align-self: flex-end;
            }

            .chat-message.theirs {
                align-self: flex-start;
            }

            .message-content {
                padding: 8px 12px;
                border-radius: 18px;
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.4;
            }

            .chat-message.mine .message-content {
                background: #667eea;
                color: white;
                border-bottom-right-radius: 4px;
            }

            .chat-message.theirs .message-content {
                background: #e4e6eb;
                color: #050505;
                border-bottom-left-radius: 4px;
            }

            .message-time {
                font-size: 11px;
                color: #65676b;
                margin-top: 4px;
                padding: 0 8px;
            }

            .chat-typing-indicator {
                padding: 8px 16px;
                font-size: 12px;
                color: #65676b;
                font-style: italic;
            }

            .chat-window-footer {
                display: flex;
                padding: 12px;
                background: #fff;
                border-top: 1px solid #e4e6eb;
                gap: 8px;
            }

            .chat-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 20px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .chat-input:focus {
                border-color: #667eea;
            }

            .btn-send {
                background: #667eea;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: background 0.2s;
            }

            .btn-send:hover {
                background: #5568d3;
            }

            .btn-send:active {
                transform: scale(0.98);
            }
        `;
        document.head.appendChild(style);
    }
}
