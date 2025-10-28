// Service API pour communiquer avec le backend

const API_URL = 'http://localhost:3000';

export interface User {
    id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    is_online?: boolean;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface Friend {
    friendship_id: string;
    friends_since?: string;
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_online: boolean;
    last_seen?: string;
}

export interface FriendRequest {
    friendship_id: string;
    created_at: string;
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
}

export class ApiService {
    private static token: string | null = localStorage.getItem('token');

    // Récupérer le token
    static getToken(): string | null {
        return this.token;
    }

    // Définir le token
    static setToken(token: string): void {
        this.token = token;
        localStorage.setItem('token', token);
    }

    // Supprimer le token
    static clearToken(): void {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    // Headers avec authentification
    private static getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // ===== Authentification =====

    static async register(username: string, email: string, password: string, display_name?: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, display_name }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        this.setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    static async login(username: string, password: string): Promise<AuthResponse> {
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
        this.setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    static async logout(): Promise<void> {
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: this.getHeaders(),
            });
        } finally {
            this.clearToken();
        }
    }

    static async getMe(): Promise<User> {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Not authenticated');
        }

        return await response.json();
    }

    // ===== Amis =====

    static async getFriends(): Promise<{ friends: Friend[]; total: number }> {
        const response = await fetch(`${API_URL}/api/friendships`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch friends');
        }

        return await response.json();
    }

    static async getPendingRequests(): Promise<{ received: FriendRequest[]; sent: FriendRequest[] }> {
        const response = await fetch(`${API_URL}/api/friendships/pending`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch pending requests');
        }

        return await response.json();
    }

    static async searchUsers(query: string): Promise<{ users: User[]; total: number }> {
        const response = await fetch(`${API_URL}/api/friendships/search?query=${encodeURIComponent(query)}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to search users');
        }

        return await response.json();
    }

    static async sendFriendRequest(friendId: string): Promise<any> {
        const response = await fetch(`${API_URL}/api/friendships`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ friend_id: friendId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send friend request');
        }

        return await response.json();
    }

    static async acceptFriendRequest(friendshipId: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/friendships/${friendshipId}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ action: 'accept' }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept friend request');
        }
    }

    static async rejectFriendRequest(friendshipId: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/friendships/${friendshipId}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ action: 'reject' }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reject friend request');
        }
    }

    static async removeFriend(friendshipId: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/friendships/${friendshipId}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove friend');
        }
    }

    // ===== Upload =====

    static async uploadAvatar(file: File): Promise<{ user: User; avatar_url: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/api/upload/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload avatar');
        }

        const data = await response.json();

        // Mettre à jour l'utilisateur en localStorage
        localStorage.setItem('user', JSON.stringify(data.user));

        return data;
    }

    static async deleteAvatar(): Promise<void> {
        const response = await fetch(`${API_URL}/api/upload/avatar`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete avatar');
        }
    }
}
