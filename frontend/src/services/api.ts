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

export interface Match {
    id: string;
    player1_id: string;
    player1_username: string;
    player1_display_name: string;
    player2_id: string | null;
    player2_username: string | null;
    player2_display_name: string | null;
    player1_score: number;
    player2_score: number;
    winner_username?: string;
    status: string;
    game_mode: string;
    duration_seconds?: number;
    ended_at: string;
	winner_id: string;
	opponent_name: string | null;
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
    private static getHeaders(includeContentType: boolean = true): HeadersInit {
        const headers: HeadersInit = {};

        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }

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

    static async login(username: string, password: string): Promise<AuthResponse | { two_factor_required: true; message: string }> {
        console.log('[API] Login attempt for user:', username);
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        console.log('[API] Login response status:', response.status);
        if (!response.ok) {
            const error = await response.json();
            console.error('[API] Login error:', error);
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        console.log('[API] Login data received:', data);

        // Si 2FA requis, retourner la réponse telle quelle
        if (data.two_factor_required) {
            console.log('[API] 2FA required');
            return data;
        }

        // Sinon, enregistrer le token et l'utilisateur
        console.log('[API] Login successful, setting token');
        this.setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    static async send2FACode(username: string, password: string): Promise<{ message: string; email: string }> {
        const response = await fetch(`${API_URL}/api/2fa/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send 2FA code');
        }

        return await response.json();
    }

    static async verify2FACode(username: string, code: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/api/2fa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, code }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Invalid code');
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

	static async getUserStats(userId: string): Promise<any>
	{
		const response = await fetch(`${API_URL}/api/users/${userId}/stats`, {
			headers: this.getHeaders(),
		});

		if (!response.ok) {
			throw new Error('Failed to fetch user stats');
		}

		return await response.json();
	}

	static async getTop3Ranking(): Promise<any[]> {
	const response = await fetch(`${API_URL}/api/users/ranking/top3`, {
		headers: {
		'Authorization': `Bearer ${this.getToken()}`
		}
	});

	if (!response.ok) {
		throw new Error('Failed to fetch ranking');
	}

	return response.json();
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
        headers: {
            'Authorization': `Bearer ${this.token}`,
        },
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

        static async deleteAvatar(): Promise<{ user: User }> {
            const response = await fetch(`${API_URL}/api/upload/avatar`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete avatar');
            }

            const data = await response.json();
            // Mettre à jour l'utilisateur en localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            return data;
        }

	static async updateProfile(userId: number, data: { display_name?: string; username?: string; email?: string }): Promise<any>
	{
		const token = localStorage.getItem('token')

		const response = await fetch(`${API_URL}/api/users/${userId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify(data)
		})

		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.error || 'Échec de la mise à jour du profil')
		}

		return response.json()
	}

	static async updateUserStats(userId: string, won: boolean, score: number, opponentScore: number): Promise<any>
{
    const response = await fetch(`${API_URL}/api/stats/${userId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
            won,
            score,
            opponentScore
        }),
    });

    if (!response.ok)
    {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update stats');
    }

    return await response.json();
}


// Enregistrer un match terminé (local/IA/tournoi)
  static async saveLocalMatch(data: {
    player2_id?: string;
    opponent_name?: string;
    winner_id: string | null;
    player1_score: number;
    player2_score: number;
    game_mode?: string;
  }): Promise<any> {
    const response = await fetch(`${API_URL}/api/matches/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de l\'enregistrement du match');
    }

    return response.json();
  }


    // ===== Match History =====

    static async getUserMatches(userId: string, limit: number = 10): Promise<Match[]> {
        const response = await fetch(`${API_URL}/api/users/${userId}/matches?limit=${limit}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch match history');
        }

        return await response.json();
    }

    // ===== Online Game =====

    static async getRooms(): Promise<any> {
        const response = await fetch(`${API_URL}/api/game/rooms`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch rooms');
        }

        return await response.json();
    }

    static async createRoom(params: { name: string; password?: string; maxScore: number }): Promise<any> {
        const response = await fetch(`${API_URL}/api/game/rooms`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                roomName: params.name,
                password: params.password,
                maxScore: params.maxScore
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create room');
        }

        return await response.json();
    }

    static async joinRoom(roomId: string, password?: string): Promise<any> {
        const response = await fetch(`${API_URL}/api/game/rooms/${roomId}/join`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to join room');
        }

        return await response.json();
    }

    static async leaveRoom(roomId: string): Promise<void> {
        const response = await fetch(`${API_URL}/api/game/rooms/${roomId}/leave`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to leave room');
        }
    }

    static async saveMatch(matchData: {
        roomId: string;
        winnerId: string;
        player1Id: string;
        player2Id: string;
        player1Score: number;
        player2Score: number;
        duration: number;
    }): Promise<any> {
        const response = await fetch(`${API_URL}/api/game/match`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(matchData),
        });

        if (!response.ok) {
            throw new Error('Failed to save match');
        }

        return await response.json();
    }

    // ===== Two-Factor Authentication =====

    static async get2FAStatus(): Promise<{ two_factor_enabled: boolean }> {
        const response = await fetch(`${API_URL}/api/2fa/status`, {
            headers: this.getHeaders(false),
        });

        if (!response.ok) {
            throw new Error('Failed to get 2FA status');
        }

        return await response.json();
    }

    static async enable2FA(): Promise<{ message: string }> {
        const response = await fetch(`${API_URL}/api/2fa/enable`, {
            method: 'POST',
            headers: this.getHeaders(false),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to enable 2FA' }));
            throw new Error(error.error || error.message || 'Failed to enable 2FA');
        }

        return await response.json();
    }

    static async disable2FA(): Promise<{ message: string }> {
        const response = await fetch(`${API_URL}/api/2fa/disable`, {
            method: 'POST',
            headers: this.getHeaders(false),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to disable 2FA' }));
            throw new Error(error.error || error.message || 'Failed to disable 2FA');
        }

        return await response.json();
    }
}
