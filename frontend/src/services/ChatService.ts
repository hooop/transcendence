// Service de chat avec WebSocket
import { config } from '../config/env';

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

export interface FriendshipAccepted {
    id: number;
    friend: {
        id: string;
        username: string;
        display_name: string;
        avatar_url?: string;
    };
    status: string;
}

type MessageHandler = (message: ChatMessage) => void;
type TypingHandler = (userId: string, isTyping: boolean) => void;
type StatusHandler = (userId: string, isOnline: boolean) => void;
type ConnectedHandler = () => void;
type FriendshipAcceptedHandler = (friendship: FriendshipAccepted) => void;
type FriendshipRemovedHandler = (data: { friendship_id: number; removed_by: string }) => void;
type FriendRequestReceivedHandler = (request: any) => void;
type FriendRequestCancelledHandler = (data: { friendship_id: number; cancelled_by: string }) => void;
type FriendRequestRejectedHandler = (data: { friendship_id: number; rejected_by: string }) => void;
type UserProfileUpdatedHandler = (user: { id: string; username: string; display_name: string; avatar_url?: string }) => void;

export class ChatService {
    private static instance: ChatService;
    private ws: WebSocket | null = null;
    private messageHandlers: Set<MessageHandler> = new Set();
    private typingHandlers: Set<TypingHandler> = new Set();
    private statusHandlers: Set<StatusHandler> = new Set();
    private connectedHandlers: Set<ConnectedHandler> = new Set();
    private friendshipAcceptedHandlers: Set<FriendshipAcceptedHandler> = new Set();
    private friendshipRemovedHandlers: Set<FriendshipRemovedHandler> = new Set();
    private friendRequestReceivedHandlers: Set<FriendRequestReceivedHandler> = new Set();
    private friendRequestCancelledHandlers: Set<FriendRequestCancelledHandler> = new Set();
    private friendRequestRejectedHandlers: Set<FriendRequestRejectedHandler> = new Set();
    private userProfileUpdatedHandlers: Set<UserProfileUpdatedHandler> = new Set();

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
        this.ws = new WebSocket(`${config.CHAT_WS_URL}?token=${token}`);

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
				console.log('[ChatService] friend_status reçu:', data);
                this.statusHandlers.forEach(handler => handler(data.user_id, data.is_online));
                break;

            case 'friendship_accepted':
                this.friendshipAcceptedHandlers.forEach(handler => handler(data.friendship));
                break;

            case 'friendship_removed':
                this.friendshipRemovedHandlers.forEach(handler => handler(data));
                break;

            case 'friendship_request_received':
                this.friendRequestReceivedHandlers.forEach(handler => handler(data.request));
                break;

            case 'friendship_request_cancelled':
                this.friendRequestCancelledHandlers.forEach(handler => handler(data));
                break;

            case 'friendship_request_rejected':
                this.friendRequestRejectedHandlers.forEach(handler => handler(data));
                break;

			case 'user_profile_updated':
				console.log('[ChatService] user_profile_updated reçu:', data);
				this.userProfileUpdatedHandlers.forEach(handler => handler(data.user));
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

    onFriendshipAccepted(handler: FriendshipAcceptedHandler): () => void {
        this.friendshipAcceptedHandlers.add(handler);
        return () => this.friendshipAcceptedHandlers.delete(handler);
    }

    onFriendshipRemoved(handler: FriendshipRemovedHandler): () => void {
        this.friendshipRemovedHandlers.add(handler);
        return () => this.friendshipRemovedHandlers.delete(handler);
    }

    onFriendRequestReceived(handler: FriendRequestReceivedHandler): () => void {
        this.friendRequestReceivedHandlers.add(handler);
        return () => this.friendRequestReceivedHandlers.delete(handler);
    }

    onFriendRequestCancelled(handler: FriendRequestCancelledHandler): () => void {
        this.friendRequestCancelledHandlers.add(handler);
        return () => this.friendRequestCancelledHandlers.delete(handler);
    }

    onFriendRequestRejected(handler: FriendRequestRejectedHandler): () => void {
        this.friendRequestRejectedHandlers.add(handler);
        return () => this.friendRequestRejectedHandlers.delete(handler);
    }

	onUserProfileUpdated(handler: UserProfileUpdatedHandler): () => void {
		this.userProfileUpdatedHandlers.add(handler);
		return () => this.userProfileUpdatedHandlers.delete(handler);
}

    // API HTTP pour récupérer les conversations et l'historique
    static async getConversations(): Promise<{ conversations: Conversation[]; total: number }> {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_URL}/api/chat/conversations`, {
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
        let url = `${config.API_URL}/api/chat/messages/${userId}?limit=${limit}`;
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
