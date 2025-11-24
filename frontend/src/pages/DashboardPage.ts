import {ApiService} from '../services/api'
import dashboardTemplate from '../templates/dashboard.html?raw'

export class DashboardPage
{

	// Charge les données utilisateur (stats, amis, demandes en attente)
	// et injecte les valeurs dans le template HTML
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
			const winPercent = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
			const lossPercent = totalMatches > 0 ? Math.round((losses / totalMatches) * 100) : 0;
			

			// Remplacer les placeholders
			let html = dashboardTemplate;
			html = html.replace('{{TOTAL_MATCHES}}', totalMatches.toString());
			html = html.replace('{{WINS}}', wins.toString());
			html = html.replace('{{LOSSES}}', losses.toString());
			html = html.replace('{{WIN_PERCENT}}', winPercent.toString());
			html = html.replace('{{LOSS_PERCENT}}', lossPercent.toString());
			html = html.replace('{{FRIENDS_COUNT}}', friendsData.total.toString());
			html = html.replace('{{PENDING_COUNT}}', pendingData.received.length.toString());
		

			return html;

		} catch (error) {
			window.location.href = '/login';
			return '<div>Redirecting...</div>';
		}
	}




	// Récupère la liste d'amis via l'API et génère le HTML
	// pour chaque ami avec avatar, nom et boutons d'action
	private static async loadFriendsList(): Promise<void>
	{
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
						<div class="avatar-wrapper">
							${this.getAvatarHTML(friend)}
							${friend.is_online ? '<span class="online-indicator"></span>' : ''}
						</div>
						<span class="friend-name">${friend.display_name || friend.username}</span>
					</div>
					<div class="friend-actions">
						<button class="btn-chat" onclick="window.openChatWithFriend('${friend.id}', '${friend.username}', '${friend.display_name || friend.username}', '${friend.avatar_url || ''}', ${friend.is_online})">Chat</button>
						<button class="btn-remove-friend" onclick="window.removeFriend('${friend.friendship_id}')">Supprimer</button>
					</div>
				</div>
			`).join('');

		} catch (error) {
			container.innerHTML = '<p class="error-state">Erreur de chargement</p>';
		}
	}



	// Configure la recherche d'utilisateurs avec debounce de 300ms,
	// affiche les résultats et ferme le dropdown au clic extérieur
	private static setupDashboardSearch(): void
	{
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
								<button class="btn-add" onclick="window.sendFriendRequest('${user.id}')">
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



	// Injecte les données du top 3 ranking dans le DOM
	// (avatar, nom, points) pour chaque position du podium
	private static injectTop3Data(top3: any[]): void
	{
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



	// Retourne le HTML de l'avatar : image si disponible, sinon initiale du username
	private static getAvatarHTML(user: { avatar_url?: string; username: string }): string
	{
		if (user.avatar_url) {
			return `<img src="${user.avatar_url}" alt="${user.username}" class="friend-avatar">`;
		}
		return `<div class="friend-avatar avatar-initial">${user.username.charAt(0).toUpperCase()}</div>`;
	}




	// Initialise le dashboard : charge les données (top3, amis, demandes),
	// configure la recherche et définit les fonctions globales (ajout/suppression ami, chat)
	static setupEventListeners(): void
	{
		this.loadTop3Ranking();
		this.loadFriendsList();
		this.loadPendingRequests()
		this.loadMatchHistory();

		ApiService.getMe().then(async user => {
			const stats = await ApiService.getUserStats(user.id);
			const totalMatches = stats.total_matches || 0;
			const wins = stats.wins || 0;
			const winPercent = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
			
			DashboardPage.updateDonutChart(winPercent);
		});

		// Logout
		const logoutBtn = document.getElementById('logout-btn');
		if (logoutBtn) {
			logoutBtn.addEventListener('click', async () => {
				await ApiService.logout();
				window.location.href = '/login';
			});
		}


		// Écouter les mises à jour du profil
		window.addEventListener('userProfileUpdated', async (e: Event) => {
			const customEvent = e as CustomEvent
			localStorage.setItem('user', JSON.stringify(customEvent.detail.user))

			// Recharger le top 3 depuis l'API
			const topUsers = await ApiService.getTop3Ranking();
			DashboardPage.injectTop3Data(topUsers);
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

	// Récupère les demandes d'ami en attente et génère le HTML avec boutons accepter / refuser
	private static async loadPendingRequests(): Promise<void>
	{
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
						${this.getAvatarHTML(request)}
						<div class="friend-details">
							<div class="friend-name">${request.display_name}</div>
						</div>
					</div>



					<div class="friend-actions">
						<button class="btn-accept" onclick="window.acceptFriendRequest('${request.friendship_id}')">Accepter</button>
						<button class="btn-reject" onclick="window.rejectFriendRequest('${request.friendship_id}')">Refuser</button>
					</div>
				</div>
			`).join('');

		} catch (error) {
			container.innerHTML = '<p class="error-state">Erreur de chargement</p>';
		}
	}


	// Récupère le top 3 du classement via l'API et appelle injectTop3Data pour l'affichage
	private static async loadTop3Ranking(): Promise<void>
	{
		try {
			const top3 = await ApiService.getTop3Ranking();
			this.injectTop3Data(top3);
		} catch (error) {
			console.error('Failed to load top 3 ranking:', error);
		}
	}


	// Récupère les 5 derniers matchs de l'utilisateur et génère le HTML
	private static async loadMatchHistory(): Promise<void>
	{
		const container = document.getElementById('match-history-container');
		if (!container) return;

		try {
			const user = await ApiService.getMe();
			const matches = await ApiService.getUserMatches(user.id, 5);

			console.log('[DashboardPage] User:', user);
			console.log('[DashboardPage] Matches received:', matches);

			if (matches.length === 0) {
				container.innerHTML = '<p class="empty-state">Aucun match joué</p>';
				return;
			}

			container.innerHTML = matches.map(match => {
				const isWinner = match.winner_id === user.id;

				// Déterminer qui est l'adversaire en fonction de qui est l'utilisateur courant
				let opponentName: string;
				if (match.opponent_name) {
					// Match local/IA avec un nom personnalisé
					opponentName = match.opponent_name;
				} else if (match.player1_id === user.id) {
					// L'utilisateur est player1, donc l'adversaire est player2
					opponentName = match.player2_display_name || match.player2_username || 'Adversaire';
				} else {
					// L'utilisateur est player2, donc l'adversaire est player1
					opponentName = match.player1_display_name || match.player1_username || 'Adversaire';
				}

				return `
					<div class="match-item">
						<div class="match-details">
							<div class="match-date">${new Date(match.ended_at).toLocaleDateString('fr-FR')}</div>
							<div class="match-opponent-line">
								<span class="result-history ${isWinner ? 'victory' : 'defeat'}">${isWinner ? 'Victoire' : 'Défaite'}</span>
								<span class="match-opponent">&nbsp;contre ${opponentName}</span>
							</div>
							<div class="match-score">${match.player1_score} - ${match.player2_score}</div>
						</div>
					</div>
				`;
			}).join('');

		} catch (error) {
			console.error('[DashboardPage] Failed to load match history:', error);
			console.error('[DashboardPage] Error details:', error instanceof Error ? error.message : error);
			container.innerHTML = '<p class="error-state">Erreur de chargement</p>';
		}
	}

	private static updateDonutChart(winPercent: number): void
	{
		const winCircle = document.getElementById('win-circle');
		if (!winCircle) return;

		const radius = 50;
		const circumference = 2 * Math.PI * radius;
		const offset = circumference - (winPercent / 100) * circumference;

		winCircle.setAttribute('stroke-dasharray', circumference.toString());
		winCircle.setAttribute('stroke-dashoffset', offset.toString());
	}

}
