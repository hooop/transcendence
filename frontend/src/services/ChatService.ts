// Service de chat avec WebSocket

const WS_URL = 'ws://localhost:3000';

export interface ChatMessage {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    message_type: string;
    is_read: boolean;
    created_at: string;
    sender_username?: string;
    sender_display_name?: string;
    sender_avatar?: string;
}

export interface Conversation {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_online: boolean;
    last_message: string;
    last_message_sender_id: string;
    last_message_at: string;
    unread_count: number;
}

type MessageHandler = (message: ChatMessage) => void;
type TypingHandler = (userId: string, isTyping: boolean) => void;
type StatusHandler = (userId: string, isOnline: boolean) => void;
type ConnectedHandler = () => void;

export class ChatService {
    private static instance: ChatService;
    private ws: WebSocket | null = null;
    private messageHandlers: Set<MessageHandler> = new Set();
    private typingHandlers: Set<TypingHandler> = new Set();
    private statusHandlers: Set<StatusHandler> = new Set();
    private connectedHandlers: Set<ConnectedHandler> = new Set();
    private reconnectInterval: number = 3000;
    private reconnectTimer: number | null = null;
    private isManualClose: boolean = false;

    private constructor() {}

    static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    // Connexion au WebSocket
    connect(token: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket déjà connecté');
            return;
        }

        this.isManualClose = false;
        this.ws = new WebSocket(`${WS_URL}/api/chat/ws?token=${token}`);

        this.ws.onopen = () => {
            console.log('WebSocket connecté au chat');
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Erreur de parsing du message WebSocket:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket déconnecté');
            this.ws = null;

            // Reconnexion automatique si la fermeture n'est pas manuelle
            if (!this.isManualClose) {
                this.reconnectTimer = window.setTimeout(() => {
                    const token = localStorage.getItem('token');
                    if (token) {
                        console.log('Tentative de reconnexion...');
                        this.connect(token);
                    }
                }, this.reconnectInterval);
            }
        };
    }

    // Déconnexion
    disconnect(): void {
        this.isManualClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // Envoyer un message
    sendMessage(recipientId: string, content: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket non connecté');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'send_message',
            recipient_id: recipientId,
            content,
        }));
    }

    // Marquer les messages comme lus
    markAsRead(senderId: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'mark_as_read',
            sender_id: senderId,
        }));
    }

    // Indicateur "en train d'écrire"
    sendTyping(recipientId: string, isTyping: boolean): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'typing',
            recipient_id: recipientId,
            is_typing: isTyping,
        }));
    }

    // Gestion des messages reçus
    private handleMessage(data: any): void {
       console.log('WebSocket message reçu:', JSON.stringify(data, null, 2));
        switch (data.type) {
            case 'connected':
                this.connectedHandlers.forEach(handler => handler());
                break;

            case 'new_message':
            case 'message_sent':
                this.messageHandlers.forEach(handler => handler(data.message));
                break;

            case 'typing':
                this.typingHandlers.forEach(handler => handler(data.sender_id, data.is_typing));
                break;

            case 'friend_status':
                this.statusHandlers.forEach(handler => handler(data.user_id, data.is_online));
                break;

            case 'error':
                console.error('Erreur du serveur:', data.message);
                break;
        }
    }

    // Abonnements
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onTyping(handler: TypingHandler): () => void {
        this.typingHandlers.add(handler);
        return () => this.typingHandlers.delete(handler);
    }

    onStatusChange(handler: StatusHandler): () => void {
        this.statusHandlers.add(handler);
        return () => this.statusHandlers.delete(handler);
    }

    onConnected(handler: ConnectedHandler): () => void {
        this.connectedHandlers.add(handler);
        return () => this.connectedHandlers.delete(handler);
    }

    // API HTTP pour récupérer les conversations et l'historique
    static async getConversations(): Promise<{ conversations: Conversation[]; total: number }> {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/chat/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversations');
        }

        return await response.json();
    }

    static async getMessages(userId: string, limit: number = 50, before?: string): Promise<{ messages: ChatMessage[]; total: number }> {
        const token = localStorage.getItem('token');
        let url = `http://localhost:3000/api/chat/messages/${userId}?limit=${limit}`;
        if (before) {
            url += `&before=${before}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch messages');
        }

        return await response.json();
    }
}
