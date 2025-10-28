// Helper pour ouvrir le chat depuis n'importe où dans l'app

import { ChatManager } from '../components/ChatManager';
import { Friend } from '../services/api';

export class ChatHelper {
    /**
     * Ouvrir une fenêtre de chat avec un ami
     */
    static openChatWithFriend(friend: Friend): void {
        const chatManager = ChatManager.getInstance();
        chatManager.openChat({
            userId: friend.id,
            username: friend.username,
            displayName: friend.display_name,
            avatarUrl: friend.avatar_url,
            isOnline: friend.is_online,
        });
    }

    /**
     * Ouvrir une fenêtre de chat avec un utilisateur par ID
     */
    static async openChatWithUser(userId: string, username: string, displayName: string, avatarUrl?: string): Promise<void> {
        const chatManager = ChatManager.getInstance();
        chatManager.openChat({
            userId,
            username,
            displayName,
            avatarUrl,
            isOnline: false, // On ne connaît pas le statut, il sera mis à jour en temps réel
        });
    }
}
