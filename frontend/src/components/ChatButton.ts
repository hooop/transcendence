// Bouton de chat avec liste des conversations (style Facebook)

import { ChatService, Conversation } from '../services/ChatService';
import { ChatManager } from './ChatManager';

export class ChatButton {
    private container: HTMLElement;
    private chatService: ChatService;
    private chatManager: ChatManager;
    private conversations: Conversation[] = [];
    private isOpen: boolean = false;
    private unreadCount: number = 0;

    constructor() {
        this.chatService = ChatService.getInstance();
        this.chatManager = ChatManager.getInstance();
        this.container = this.createButton();
        this.loadConversations();
        this.setupRealtimeUpdates();
    }

    private createButton(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'chat-button-container';

        container.innerHTML = `
            <button class="chat-button" id="chat-toggle-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 0C4.477 0 0 4.477 0 10c0 1.89.525 3.66 1.438 5.168L0 20l4.832-1.438A9.956 9.956 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm0 18c-1.657 0-3.2-.5-4.478-1.357l-.322-.214-3.342.994.994-3.342-.214-.322A7.963 7.963 0 012 10c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
                </svg>
                <span class="chat-unread-badge" style="display: none;">0</span>
            </button>
            <div class="chat-dropdown" style="display: none;">
                <div class="chat-dropdown-header">
                    <h3>Messages</h3>
                </div>
                <div class="chat-conversations-list" id="conversations-list">
                    <div class="chat-loading">Chargement...</div>
                </div>
            </div>
        `;

        // Toggle dropdown
        const toggleBtn = container.querySelector('#chat-toggle-btn');
        toggleBtn?.addEventListener('click', () => this.toggleDropdown());

        // Fermer le dropdown si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target as Node)) {
                this.closeDropdown();
            }
        });

        return container;
    }

    private async loadConversations(): Promise<void> {
        try {
            const { conversations } = await ChatService.getConversations();
            this.conversations = conversations;
            this.renderConversations();
            this.updateUnreadCount();
        } catch (error) {
            console.error('Erreur lors du chargement des conversations:', error);
            const list = this.container.querySelector('#conversations-list');
            if (list) {
                list.innerHTML = '<div class="chat-error">Erreur de chargement</div>';
            }
        }
    }

    private renderConversations(): void {
        const list = this.container.querySelector('#conversations-list');
        if (!list) return;

        if (this.conversations.length === 0) {
            list.innerHTML = `
                <div class="chat-empty">
                    <p>Aucune conversation</p>
                    <small>Commencez à discuter avec vos amis !</small>
                </div>
            `;
            return;
        }

        list.innerHTML = this.conversations.map(conv => {
            const lastMessagePreview = this.getMessagePreview(conv);
            const timeAgo = this.getTimeAgo(conv.last_message_at);

            return `
                <div class="conversation-item" data-user-id="${conv.user_id}">
                    <div class="conversation-avatar ${conv.is_online ? 'online' : 'offline'}">
                        ${conv.avatar_url
                            ? `<img src="${conv.avatar_url}" alt="${conv.display_name}">`
                            : `<div class="avatar-placeholder">${conv.display_name[0]}</div>`
                        }
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-header">
                            <span class="conversation-name">${conv.display_name}</span>
                            <span class="conversation-time">${timeAgo}</span>
                        </div>
                        <div class="conversation-preview">
                            ${lastMessagePreview}
                            ${conv.unread_count > 0 ? `<span class="unread-indicator">${conv.unread_count}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attacher les event listeners
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.getAttribute('data-user-id');
                if (userId) {
                    const conv = this.conversations.find(c => c.user_id === userId);
                    if (conv) {
                        this.openChatWindow(conv);
                    }
                }
            });
        });
    }

    private getMessagePreview(conv: Conversation): string {
        const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
        const isYou = conv.last_message_sender_id === currentUserId;
        const prefix = isYou ? 'Vous: ' : '';
        const message = conv.last_message.length > 40
            ? conv.last_message.substring(0, 40) + '...'
            : conv.last_message;
        return `${prefix}${message}`;
    }

    private getTimeAgo(timestamp: string): string {
        const now = new Date().getTime();
        const then = new Date(timestamp).getTime();
        const diffMinutes = Math.floor((now - then) / 60000);

        if (diffMinutes < 1) return 'À l\'instant';
        if (diffMinutes < 60) return `${diffMinutes}min`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}j`;

        return new Date(timestamp).toLocaleDateString('fr-FR');
    }

    private openChatWindow(conv: Conversation): void {
        // Fermer le dropdown d'abord
        this.closeDropdown();

        // Puis ouvrir la fenêtre de chat
        this.chatManager.openChat({
            userId: conv.user_id,
            username: conv.username,
            displayName: conv.display_name,
            avatarUrl: conv.avatar_url,
            isOnline: conv.is_online,
        });
    }

    private toggleDropdown(): void {
        this.isOpen = !this.isOpen;
        const dropdown = this.container.querySelector('.chat-dropdown') as HTMLElement;
        if (dropdown) {
            dropdown.style.display = this.isOpen ? 'block' : 'none';
        }

        if (this.isOpen) {
            this.loadConversations();
        }
    }

    private closeDropdown(): void {
        this.isOpen = false;
        const dropdown = this.container.querySelector('.chat-dropdown') as HTMLElement;
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    private updateUnreadCount(): void {
        this.unreadCount = this.conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
        const badge = this.container.querySelector('.chat-unread-badge') as HTMLElement;
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    private setupRealtimeUpdates(): void {
        // Mettre à jour la liste quand un nouveau message arrive
        this.chatService.onMessage(() => {
            if (this.isOpen) {
                this.loadConversations();
            } else {
                // Juste mettre à jour le compteur
                this.unreadCount++;
                this.updateUnreadCount();
            }
        });

        // Mettre à jour le statut en ligne
        this.chatService.onStatusChange((userId, isOnline) => {
            const conv = this.conversations.find(c => c.user_id === userId);
            if (conv) {
                conv.is_online = isOnline;
                this.renderConversations();
            }
        });
    }

    mount(parent: HTMLElement): void {
        parent.appendChild(this.container);
        this.addStyles();
    }

    private addStyles(): void {
        if (document.getElementById('chat-button-styles')) return;

        const style = document.createElement('style');
        style.id = 'chat-button-styles';
        style.textContent = `
            .chat-button-container {
                position: relative;
            }

            .chat-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                z-index: 1001;
            }

            .chat-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
            }

            .chat-button:active {
                transform: scale(0.95);
            }

            .chat-unread-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4444;
                color: white;
                border-radius: 12px;
                min-width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: bold;
                padding: 0 6px;
                border: 2px solid white;
            }

            .chat-dropdown {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: 360px;
                max-height: 500px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                z-index: 1000;
            }

            .chat-dropdown-header {
                padding: 16px;
                border-bottom: 1px solid #e4e6eb;
                background: #f5f5f5;
            }

            .chat-dropdown-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #050505;
            }

            .chat-conversations-list {
                max-height: 420px;
                overflow-y: auto;
            }

            .conversation-item {
                display: flex;
                padding: 12px 16px;
                cursor: pointer;
                transition: background 0.2s;
                gap: 12px;
            }

            .conversation-item:hover {
                background: #f5f5f5;
            }

            .conversation-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                position: relative;
                flex-shrink: 0;
                overflow: hidden;
                background: #e4e6eb;
            }

            .conversation-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .conversation-avatar::after {
                content: '';
                position: absolute;
                bottom: 0;
                right: 0;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid white;
            }

            .conversation-avatar.online::after {
                background: #44b700;
            }

            .conversation-avatar.offline::after {
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
                font-size: 20px;
            }

            .conversation-info {
                flex: 1;
                min-width: 0;
            }

            .conversation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }

            .conversation-name {
                font-weight: 600;
                font-size: 14px;
                color: #050505;
            }

            .conversation-time {
                font-size: 12px;
                color: #65676b;
            }

            .conversation-preview {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                color: #65676b;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .unread-indicator {
                background: #667eea;
                color: white;
                border-radius: 10px;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: bold;
                margin-left: 8px;
                flex-shrink: 0;
            }

            .chat-loading, .chat-error, .chat-empty {
                padding: 32px 16px;
                text-align: center;
                color: #65676b;
            }

            .chat-empty small {
                display: block;
                margin-top: 8px;
                color: #999;
            }
        `;
        document.head.appendChild(style);
    }
}
