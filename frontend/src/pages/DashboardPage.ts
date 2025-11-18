import { ApiService, User, Friend, FriendRequest, Match } from '../services/api'
import dashboardTemplate from '../templates/dashboard.html?raw'

export class DashboardPage
{

	static async render(): Promise<string>
	{
		try {
			const user = await ApiService.getMe();

			// Récupérer stats et amis en parallèle
			const [stats, friendsData, pendingData] = await Promise.all([
				ApiService.getUserStats(user.id),
				ApiService.getFriends(),
				ApiService.getPendingRequests()
			]);

			// Extraire les stats
			const totalMatches = stats.total_matches || 0;
			const wins = stats.wins || 0;
			const losses = stats.losses || 0;

			// Remplacer les placeholders
			let html = dashboardTemplate;
			html = html.replace('{{TOTAL_MATCHES}}', totalMatches.toString());
			html = html.replace('{{WINS}}', wins.toString());
			html = html.replace('{{LOSSES}}', losses.toString());
			html = html.replace('{{FRIENDS_COUNT}}', friendsData.total.toString());
			html = html.replace('{{PENDING_COUNT}}', pendingData.received.length.toString());

			return html;

		} catch (error) {
			window.location.href = '/login';
			return '<div>Redirecting...</div>';
		}
	}

	// Afficher la liste d'amis
	private static async loadFriendsList(): Promise<void> {
		const container = document.getElementById('friends-list-container');
		if (!container) return;

		try {
			const friendsData = await ApiService.getFriends();

			if (friendsData.friends.length === 0) {
				container.innerHTML = '<p class="empty-state">Aucun ami pour le moment</p>';
				return;
			}

			container.innerHTML = friendsData.friends.map(friend => `
				<div class="friend-item">
					<div class="friend-info">
						<span class="friend-name">${friend.display_name || friend.username}</span>
					</div>
					<div class="friend-actions">
						<span class="friend-status">${friend.is_online ? '🟢' : '🔴'}</span>
						<button class="btn-remove-friend" onclick="window.removeFriend('${friend.friendship_id}')">✕</button>
					</div>
				</div>
			`).join('');

		} catch (error) {
			container.innerHTML = '<p class="error-state">Erreur de chargement</p>';
		}
	}


	private static setupDashboardSearch(): void {
    const searchInput = document.getElementById('dashboard-search-users') as HTMLInputElement;
    const searchResults = document.getElementById('dashboard-search-results') as HTMLDivElement;

    if (!searchInput || !searchResults) return;

    let searchTimeout: number;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();

        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = window.setTimeout(async () => {
            try {
                const results = await ApiService.searchUsers(query);
                if (results.users.length > 0) {
                    searchResults.innerHTML = results.users.map(user => `
                        <div class="search-result-item">
                            <div class="friend-info">
                                ${this.getAvatarHTML(user)}
                                <div class="friend-details">
                                    <div class="friend-name">${user.display_name || user.username}</div>
                                    <div class="friend-username">@${user.username}</div>
                                </div>
                            </div>
                            <button class="btn btn-small btn-success" onclick="window.sendFriendRequest('${user.id}')">
                                Ajouter
                            </button>
                        </div>
                    `).join('');
                    searchResults.style.display = 'block';
                } else {
                    searchResults.innerHTML = '<div class="empty-state">Aucun utilisateur trouvé</div>';
                    searchResults.style.display = 'block';
                }
            } catch (error) {
                console.error('Search failed:', error);
            }
        }, 300);
    });

    // Fermer les résultats quand on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
            searchResults.style.display = 'none';
        }
    });
}



	private static injectTop3Data(top3: any[]): void {
		// Pour chaque position (1, 2, 3)
		[1, 2, 3].forEach(rank => {
			const player = top3[rank - 1]; // Index 0, 1, 2

			const avatarEl = document.getElementById(`rank-${rank}-avatar`);
			const nameEl = document.getElementById(`rank-${rank}-name`);
			const pointsEl = document.getElementById(`rank-${rank}-points`);

			if (player && avatarEl && nameEl && pointsEl) {
				// Avatar
				if (player.avatar_url) {
					avatarEl.innerHTML = `<img src="${player.avatar_url}" alt="${player.username}">`;
				} else {
					avatarEl.textContent = player.username.charAt(0).toUpperCase();
					avatarEl.classList.add('avatar-initial');
				}

				// Nom
				nameEl.textContent = player.display_name || player.username;

				// Points
				pointsEl.textContent = `${player.ranking_points || 0} pts`;
			} else if (avatarEl && nameEl && pointsEl) {
				// Pas de joueur à cette position
				avatarEl.textContent = '?';
				avatarEl.classList.add('avatar-initial');
				nameEl.textContent = '-';
				pointsEl.textContent = '0 pts';
			}
		});
	}

	static async renderFriendsTab(): Promise<string> {
		try {
			const [friendsData, pendingData] = await Promise.all([
				ApiService.getFriends(),
				ApiService.getPendingRequests()
			]);

			return `
				<div class="friends-section">
					<!-- Search Users -->
					<div class="search-box">
						<input
							type="text"
							id="search-users"
							placeholder="🔍 Search users..."
							autocomplete="off"
						/>
						<div id="search-results" class="search-results"></div>
					</div>

					<!-- Pending Requests -->
					${pendingData.received.length > 0 ? `
						<div class="friends-card">
							<h3>📬 Friend Requests (${pendingData.received.length})</h3>
							<div class="friend-requests">
								${pendingData.received.map(req => this.renderFriendRequest(req)).join('')}
							</div>
						</div>
					` : ''}

					${pendingData.sent.length > 0 ? `
						<div class="friends-card">
							<h3>⏳ Pending Requests (${pendingData.sent.length})</h3>
							<div class="friend-requests">
								${pendingData.sent.map(req => this.renderPendingRequest(req)).join('')}
							</div>
						</div>
					` : ''}

					<!-- Friends List -->
					<div class="friends-card">
						<h3>👥 My Friends (${friendsData.total})</h3>
						${friendsData.friends.length > 0 ? `
							<div class="friends-list">
								${friendsData.friends.map(friend => this.renderFriend(friend)).join('')}
							</div>
						` : '<p class="empty-state">No friends yet. Search for users to add!</p>'}
					</div>
				</div>
			`;
		} catch (error) {
			return '<div class="error">Failed to load friends</div>';
		}
	}

	private static renderFriend(friend: Friend): string {
		const status = friend.is_online ? '🟢' : '🔴';
		return `
			<div class="friend-item">
				<div class="friend-info">
					${this.getAvatarHTML(friend)}
					<div class="friend-details">
						<div class="friend-name">${friend.display_name}</div>
						<div class="friend-username">@${friend.username} ${status}</div>
					</div>
				</div>
				<div class="friend-actions">
					<button class="btn btn-small btn-primary" onclick="window.openChatWithFriend('${friend.id}', '${friend.username}', '${friend.display_name}', '${friend.avatar_url || ''}', ${friend.is_online})">
						💬 Message
					</button>
					<button class="btn btn-small btn-danger" onclick="window.removeFriend('${friend.friendship_id}')">
						Remove
					</button>
				</div>
			</div>
		`;
	}

	private static renderFriendRequest(request: FriendRequest): string {
		return `
			<div class="friend-request-item">
				<div class="friend-info">
					${this.getAvatarHTML(request)}
					<div class="friend-details">
						<div class="friend-name">${request.display_name}</div>
						<div class="friend-username">@${request.username}</div>
					</div>
				</div>
				<div class="friend-actions">
					<button class="btn btn-small btn-success" onclick="window.acceptFriendRequest('${request.friendship_id}')">
						Accept
					</button>
					<button class="btn btn-small btn-danger" onclick="window.rejectFriendRequest('${request.friendship_id}')">
						Decline
					</button>
				</div>
			</div>
		`;
	}

	private static renderPendingRequest(request: FriendRequest): string {
		return `
			<div class="friend-request-item">
				<div class="friend-info">
					${this.getAvatarHTML(request)}
					<div class="friend-details">
						<div class="friend-name">${request.display_name}</div>
						<div class="friend-username">@${request.username}</div>
					</div>
				</div>
				<div class="friend-actions">
					<span class="pending-label">⏳ Pending</span>
				</div>
			</div>
		`;
	}

	private static getAvatarHTML(user: { avatar_url?: string; username: string }): string {
		if (user.avatar_url) {
			return `<img src="${user.avatar_url}" alt="${user.username}" class="friend-avatar">`;
		}
		return `<div class="friend-avatar avatar-initial">${user.username.charAt(0).toUpperCase()}</div>`;
	}

	private static getAvatarOrInitial(user: User): string {
		if (user.avatar_url) {
			return `<img src="${user.avatar_url}" alt="${user.username}">`;
		}
		return user.username.charAt(0).toUpperCase();
	}



	// Setup event listeners
	static setupEventListeners(): void {
		this.loadTop3Ranking();
		this.loadFriendsList();
		this.loadPendingRequests()

		// Tabs
		document.querySelectorAll('.tab-btn').forEach(btn => {
			btn.addEventListener('click', async (e) => {
				const target = e.target as HTMLButtonElement;
				const tabName = target.getAttribute('data-tab');

				// Update active tab
				document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
				target.classList.add('active');

				// Show corresponding content
				document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
				const content = document.getElementById(`tab-${tabName}`);
				if (content) {
					content.classList.add('active');

					// Load friends dynamically
					if (tabName === 'friends') {
						content.innerHTML = '<div class="loading">Loading friends...</div>';
						content.innerHTML = await this.renderFriendsTab();
						this.setupFriendsListeners();
					}

					// Load match history when profile tab is shown
					if (tabName === 'profile') {
						this.loadMatchHistory();
					}
				}
			});
		});

		// Logout
		const logoutBtn = document.getElementById('logout-btn');
		if (logoutBtn) {
			logoutBtn.addEventListener('click', async () => {
				await ApiService.logout();
				window.location.href = '/login';
			});
		}

		// Avatar upload
		this.setupAvatarUpload();

		// Load match history if profile tab is active
		if (document.getElementById('tab-profile')?.classList.contains('active')) {
			this.loadMatchHistory();
		}

		// Écouter les mises à jour du profil
		window.addEventListener('userProfileUpdated', (e: Event) => {
			const customEvent = e as CustomEvent
			localStorage.setItem('user', JSON.stringify(customEvent.detail.user))
		});

		// Recherche d'utilisateurs dans le dashboard
		this.setupDashboardSearch();

		// Fonction globale pour ajouter un ami
		(window as any).sendFriendRequest = async (userId: string) => {
			try {
				await ApiService.sendFriendRequest(userId);
				alert('Demande d\'ami envoyée !');
				// Rafraîchir la liste d'amis
				await this.loadFriendsList();
				// Fermer les résultats de recherche
				const searchResults = document.getElementById('dashboard-search-results');
				if (searchResults) {
					searchResults.style.display = 'none';
				}
			} catch (error: any) {
				alert(error.message || 'Échec de l\'envoi de la demande');
			}
		};

		// Fonction globale pour supprimer un ami
		(window as any).removeFriend = async (friendshipId: string) => {
			if (confirm('Supprimer cet ami ?')) {
				try {
					await ApiService.removeFriend(friendshipId);
					await this.loadFriendsList();
				} catch (error: any) {
					alert(error.message || 'Erreur');
				}
			}
		};

		// Fonction globale pour accepter une demande d'ami
		(window as any).acceptFriendRequest = async (friendshipId: string) => {
			try {
				await ApiService.acceptFriendRequest(friendshipId);
				await this.loadPendingRequests();
				await this.loadFriendsList();
			} catch (error: any) {
				alert(error.message || 'Erreur');
			}
		};

		// Fonction globale pour refuser une demande d'ami
		(window as any).rejectFriendRequest = async (friendshipId: string) => {
			try {
				await ApiService.rejectFriendRequest(friendshipId);
				await this.loadPendingRequests();
			} catch (error: any) {
				alert(error.message || 'Erreur');
			}
		};

	}



	private static async loadPendingRequests(): Promise<void> {
    const container = document.getElementById('pending-requests-container');
    if (!container) return;

    try {
        const pendingData = await ApiService.getPendingRequests();

		 // Mettre à jour le badge du compte
        const countBadge = document.querySelector('.pending-count');
        if (countBadge) {
            countBadge.textContent = pendingData.received.length.toString();
        }

        if (pendingData.received.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucune demande en attente</p>';
            return;
        }

        container.innerHTML = pendingData.received.map(request => `
            <div class="friend-item">
                <div class="friend-info">
                    <span class="friend-name">${request.display_name || request.username}</span>
                </div>
                <div class="friend-actions">
                    <button class="btn-accept" onclick="window.acceptFriendRequest('${request.friendship_id}')">✓</button>
                    <button class="btn-reject" onclick="window.rejectFriendRequest('${request.friendship_id}')">✕</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<p class="error-state">Erreur de chargement</p>';
    }
}

	private static async loadTop3Ranking(): Promise<void> {
		try {
			const top3 = await ApiService.getTop3Ranking();
			this.injectTop3Data(top3);
		} catch (error) {
			console.error('Failed to load top 3 ranking:', error);
		}
	}

	private static setupAvatarUpload(): void {
		const avatarInput = document.getElementById('avatar-input') as HTMLInputElement;
		const deleteAvatarBtn = document.getElementById('delete-avatar-btn');

		if (avatarInput) {
			avatarInput.addEventListener('change', async (e) => {
				const target = e.target as HTMLInputElement;
				const file = target.files?.[0];

				if (!file) return;

				// Vérifier le type de fichier
				if (!file.type.startsWith('image/')) {
					alert('Please select an image file');
					return;
				}

				// Vérifier la taille (max 5MB)
				if (file.size > 5 * 1024 * 1024) {
					alert('File is too large. Maximum size is 5MB');
					return;
				}

				try {
					// Afficher un message de chargement
					const avatarContainer = document.getElementById('current-avatar');
					if (avatarContainer) {
						avatarContainer.innerHTML = '<div class="loading-spinner"></div>';
					}

					// Uploader l'avatar
					const result = await ApiService.uploadAvatar(file);

					// Mettre à jour l'avatar dans le header
					const userAvatar = document.querySelector('.user-avatar');
					if (userAvatar && result.avatar_url) {
						userAvatar.innerHTML = `<img src="${result.avatar_url}" alt="Avatar">`;
					}

				} catch (error: any) {
					alert(error.message || 'Failed to upload avatar');
					// Recharger le profil en cas d'erreur
					window.location.reload();
				}

				// Reset input
				target.value = '';
			});
		}

		if (deleteAvatarBtn) {
			deleteAvatarBtn.addEventListener('click', async () => {
				if (!confirm('Are you sure you want to remove your avatar?')) {
					return;
				}

				try {
					await ApiService.deleteAvatar();

					// Mettre à jour l'avatar dans le header
					const user = await ApiService.getMe();
					const userAvatar = document.querySelector('.user-avatar');
					if (userAvatar) {
						userAvatar.innerHTML = user.username.charAt(0).toUpperCase();
					}

				} catch (error: any) {
					alert(error.message || 'Failed to delete avatar');
				}
			});
		}
	}

	private static setupFriendsListeners(): void {
		// Search users
		const searchInput = document.getElementById('search-users') as HTMLInputElement;
		const searchResults = document.getElementById('search-results') as HTMLDivElement;

		if (searchInput) {
			let searchTimeout: number;
			searchInput.addEventListener('input', () => {
				clearTimeout(searchTimeout);
				const query = searchInput.value.trim();

				if (query.length < 2) {
					searchResults.innerHTML = '';
					searchResults.style.display = 'none';
					return;
				}

				searchTimeout = window.setTimeout(async () => {
					try {
						const results = await ApiService.searchUsers(query);
						if (results.users.length > 0) {
							searchResults.innerHTML = results.users.map(user => `
								<div class="search-result-item">
									<div class="friend-info">
										${this.getAvatarHTML(user)}
										<div class="friend-details">
											<div class="friend-name">${user.display_name || user.username}</div>
											<div class="friend-username">@${user.username}</div>
										</div>
									</div>
									<div class="friend-actions">
										<button class="btn btn-small btn-primary" onclick="window.openChatWithFriend('${user.id}', '${user.username}', '${user.display_name || user.username}', '${user.avatar_url || ''}', false)">
											💬
										</button>
										<button class="btn btn-small btn-success" onclick="window.sendFriendRequest('${user.id}')">
											Add Friend
										</button>
									</div>
								</div>
							`).join('');
							searchResults.style.display = 'block';
						} else {
							searchResults.innerHTML = '<div class="empty-state">No users found</div>';
							searchResults.style.display = 'block';
						}
					} catch (error) {
						console.error('Search failed:', error);
					}
				}, 300);
			});
		}

		// Global functions for friend actions
		(window as any).sendFriendRequest = async (userId: string) => {
			try {
				await ApiService.sendFriendRequest(userId);
				alert('Friend request sent!');
				// Refresh friends tab
				const friendsTab = document.getElementById('tab-friends');
				if (friendsTab) {
					friendsTab.innerHTML = await this.renderFriendsTab();
					this.setupFriendsListeners();
				}
			} catch (error: any) {
				alert(error.message || 'Failed to send friend request');
			}
		};


		(window as any).openChatWithFriend = (userId: string, username: string, displayName: string, avatarUrl: string, isOnline: boolean) => {
			import('../components/ChatManager').then(({ ChatManager }) => {
				const chatManager = ChatManager.getInstance();
				chatManager.openChat({
					userId,
					username,
					displayName,
					avatarUrl: avatarUrl || undefined,
					isOnline
				});
			});
		};
	}

	// Load and display match history
	private static async loadMatchHistory(): Promise<void> {
		const container = document.getElementById('match-history-container');
		if (!container) return;

		try {
			const user = await ApiService.getMe();
			const matches = await ApiService.getUserMatches(user.id, 10);

			if (matches.length === 0) {
				container.innerHTML = '<p class="empty-state">No matches played yet. Start playing to build your history!</p>';
				return;
			}

			container.innerHTML = matches.map(match => this.renderMatchItem(match, user.id)).join('');
		} catch (error) {
			container.innerHTML = '<p class="error-state">Failed to load match history</p>';
			console.error('Failed to load match history:', error);
		}
	}

	private static renderMatchItem(match: Match, currentUserId: string): string {
		const isPlayer1 = match.player1_id === currentUserId;
		const opponentName = isPlayer1 ? match.player2_display_name : match.player1_display_name;
		const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
		const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

		let resultClass = 'match-draw';
		let resultText = 'Draw';

		if (match.winner_username) {
			const isWinner = (isPlayer1 && match.winner_username === match.player1_username) ||
						   (!isPlayer1 && match.winner_username === match.player2_username);
			resultClass = isWinner ? 'match-win' : 'match-loss';
			resultText = isWinner ? 'Win' : 'Loss';
		}

		const date = new Date(match.ended_at);
		const formattedDate = date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});

		return `
			<div class="match-item ${resultClass}">
				<div class="match-result">
					<span class="result-badge">${resultText}</span>
				</div>
				<div class="match-info">
					<div class="match-opponent">vs ${opponentName}</div>
					<div class="match-score">${playerScore} - ${opponentScore}</div>
					<div class="match-meta">
						<span class="match-date">${formattedDate}</span>
						${match.game_mode !== 'classic' ? `<span class="match-mode">${match.game_mode}</span>` : ''}
					</div>
				</div>
			</div>
		`;
	}
}
