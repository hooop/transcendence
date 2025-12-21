import {ApiService} from '../services/api'
import { i18n } from '../services/i18n'
import dashboardTemplate from '../templates/dashboard.html?raw'
import Chart from 'chart.js/auto'
import { escapeHtml, escapeHtmlAttr } from '../utils/security'
import { ChatService } from '../services/ChatService'

interface Match {
	id: number;
	player1_id: number;
	player2_id: number;
	player1_score: number;
	player2_score: number;
	player1_ranking_after: number;
	player2_ranking_after: number;
	winner_id: number | null;
	created_at: string;
	ended_at: string;
	opponent_name?: string;
	player1_username?: string;
	player2_username?: string;
	player1_display_name?: string;
	player2_display_name?: string;
}

export class DashboardPage
{

	private static rankingChart: Chart | null = null;

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
			html = html.replace('{{WINS_LABEL}}', i18n.t('dashboard.wins', 'victoires'));
			html = html.replace('{{LOSSES_LABEL}}', i18n.t('dashboard.losses', 'défaites'));
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
				container.innerHTML = `<p class="empty-state">${i18n.t('dashboard.noFriends', 'Aucun ami pour le moment')}</p>`;
				return;
			}

			container.innerHTML = friendsData.friends.map(friend => `
				<div class="friend-item">
					<div class="friend-info">
						<div class="avatar-wrapper">
							${this.getAvatarHTML(friend)}
							${friend.is_online ? '<span class="online-indicator"></span>' : ''}
						</div>
						<span class="friend-name">${escapeHtml(friend.display_name || friend.username)}</span>
					</div>
					<div class="friend-actions">
						<button class="btn-chat" onclick="window.openChatWithFriend('${escapeHtmlAttr(friend.id)}', '${escapeHtmlAttr(friend.username)}', '${escapeHtmlAttr(friend.display_name || friend.username)}', '${escapeHtmlAttr(friend.avatar_url || '')}', ${friend.is_online})">${i18n.t('dashboard.chat', 'Chat')}</button>
						<button class="btn-remove-friend" onclick="window.removeFriend('${escapeHtmlAttr(friend.friendship_id)}')">${i18n.t('dashboard.delete', 'Supprimer')}</button>
					</div>
				</div>
			`).join('');

		} catch (error) {
			container.innerHTML = `<p class="error-state">${i18n.t('dashboard.loadingError', 'Erreur de chargement')}</p>`;
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
										<div class="friend-name">${escapeHtml(user.display_name || user.username)}</div>
										<div class="friend-username">@${escapeHtml(user.username)}</div>
									</div>
								</div>
								<button class="btn-add" onclick="window.sendFriendRequest('${escapeHtmlAttr(user.id)}')">
									${i18n.t('dashboard.add', 'Ajouter')}
								</button>
							</div>
						`).join('');
						searchResults.style.display = 'block';
					} else {
						searchResults.innerHTML = `<div class="empty-state">${i18n.t('dashboard.noUserFound', 'Aucun utilisateur trouvé')}</div>`;
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
					avatarEl.innerHTML = `<img src="${escapeHtml(player.avatar_url)}" alt="${escapeHtml(player.username)}">`;
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




	// Traduit tous les labels du dashboard
	private static translateDashboardLabels(): void
	{
		const matchesLabel = document.getElementById('dashboard-label-matches');
		if (matchesLabel) {
			matchesLabel.textContent = i18n.t('dashboard.matchesPlayed', 'Match joués');
		}

		const victoriesLabel = document.getElementById('dashboard-label-victories');
		if (victoriesLabel) {
			victoriesLabel.textContent = i18n.t('dashboard.victories', 'Victoires');
		}

		const performancesLabel = document.getElementById('dashboard-label-performances');
		if (performancesLabel) {
			performancesLabel.textContent = i18n.t('dashboard.performances', 'PERFORMANCES');
		}

		const friendsLabel = document.getElementById('dashboard-label-friends');
		if (friendsLabel) {
			const friendsCount = friendsLabel.querySelector('.friends-count');
			const friendsText = i18n.t('dashboard.friends', 'AMIS');
			friendsLabel.innerHTML = `${friendsText} (<span class="friends-count">${friendsCount?.textContent || '0'}</span> )`;
		}

		const pendingLabel = document.getElementById('dashboard-label-pending');
		if (pendingLabel) {
			const pendingCount = pendingLabel.querySelector('.pending-count');
			const pendingText = i18n.t('dashboard.pending', 'EN ATTENTE');
			pendingLabel.innerHTML = `${pendingText} (<span class="pending-count">${pendingCount?.textContent || '0'}</span> )`;
		}

		const historyLabel = document.getElementById('dashboard-label-history');
		if (historyLabel) {
			historyLabel.textContent = i18n.t('dashboard.history', 'HISTORIQUE');
		}

		const searchInput = document.getElementById('dashboard-search-users') as HTMLInputElement;
		if (searchInput) {
			searchInput.placeholder = i18n.t('dashboard.searchUser', 'Rechercher un utilisateur...');
		}

		const ctaLabel = document.getElementById('dashboard-cta');
		if (ctaLabel) {
			ctaLabel.innerHTML = i18n.t('dashboard.cta', 'Défiez<br>vos amis<br>en<br>ligne');
		}

		const playButton = document.getElementById('dashboard-play-button');
		if (playButton) {
			playButton.textContent = i18n.t('dashboard.playButton', 'Jouer');
		}

		// Mettre à jour les labels des victoires et défaites
		this.updateWinsLossesLabels();
	}

	// Met à jour les labels "victoires" et "défaites" selon la langue
	private static updateWinsLossesLabels(): void
	{
		const winsLossesElements = document.querySelectorAll('.wins-losses');
		if (winsLossesElements.length >= 2) {
			const winsLabel = i18n.t('dashboard.wins', 'victoires');
			const lossesLabel = i18n.t('dashboard.losses', 'défaites');

			// Les éléments contiennent déjà le nombre, on doit extraire juste le nombre
			winsLossesElements[0].textContent = winsLossesElements[0].textContent.split(' ')[0] + ' ' + winsLabel;
			winsLossesElements[1].textContent = winsLossesElements[1].textContent.split(' ')[0] + ' ' + lossesLabel;
		}
	}

	// Initialise le dashboard : charge les données (top3, amis, demandes),
	// configure la recherche et définit les fonctions globales (ajout/suppression ami, chat)
	static setupEventListeners(): void
	{
		// Écouter les notifications WebSocket de demandes d'amis acceptées
		const chatService = ChatService.getInstance();
		chatService.onFriendshipAccepted((friendship) => {
			console.log('Demande d\'ami acceptée:', friendship);
			// Rafraîchir la liste d'amis et les demandes en attente
			this.loadFriendsList();
			this.loadPendingRequests();
		});

		chatService.onFriendshipRemoved((data) => {
			console.log('Ami supprimé:', data);
			// Rafraîchir la liste d'amis
			this.loadFriendsList();
		});

		// Écouter les changements de langue
		window.addEventListener('languageChanged', () => {
			this.translateDashboardLabels();
			this.loadFriendsList();
			this.loadPendingRequests();
			this.loadMatchHistory();
		});

		this.translateDashboardLabels();

		this.loadTop3Ranking();
		this.loadFriendsList();
		this.loadPendingRequests();
		this.loadMatchHistory();
		this.loadRankingChart();

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
				alert(i18n.t('dashboard.friendRequestSent', 'Demande d\'ami envoyée !'));
				// Rafraîchir la liste d'amis
				await this.loadFriendsList();
				// Fermer les résultats de recherche
				const searchResults = document.getElementById('dashboard-search-results');
				if (searchResults) {
					searchResults.style.display = 'none';
				}
			} catch (error: any) {
				alert(error.message || i18n.t('dashboard.failedToSendRequest', 'Échec de l\'envoi de la demande'));
			}
		};

		// Fonction globale pour supprimer un ami
		(window as any).removeFriend = async (friendshipId: string) => {
			if (confirm(i18n.t('dashboard.deleteFriendConfirm', 'Supprimer cet ami ?'))) {
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
				alert(error.message || i18n.t('dashboard.error', 'Erreur'));
			}
		};

		// Fonction globale pour refuser une demande d'ami
		(window as any).rejectFriendRequest = async (friendshipId: string) => {
			try {
				await ApiService.rejectFriendRequest(friendshipId);
				await this.loadPendingRequests();
			} catch (error: any) {
				alert(error.message || i18n.t('dashboard.error', 'Erreur'));
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
				container.innerHTML = `<p class="empty-state">${i18n.t('dashboard.noPendingRequests', 'Aucune demande en attente')}</p>`;
				return;
			}

			container.innerHTML = pendingData.received.map(request => `
				<div class="friend-item">
					<div class="friend-info">
						${this.getAvatarHTML(request)}
						<div class="friend-details">
							<div class="friend-name">${escapeHtml(request.display_name)}</div>
						</div>
					</div>



					<div class="friend-actions">
						<button class="btn-accept" onclick="window.acceptFriendRequest('${escapeHtmlAttr(request.friendship_id)}')">${i18n.t('dashboard.accept', 'Accepter')}</button>
						<button class="btn-reject" onclick="window.rejectFriendRequest('${escapeHtmlAttr(request.friendship_id)}')">${i18n.t('dashboard.reject', 'Refuser')}</button>
					</div>
				</div>
			`).join('');

		} catch (error) {
			container.innerHTML = `<p class="error-state">${i18n.t('dashboard.loadingError', 'Erreur de chargement')}</p>`;
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
				container.innerHTML = `<p class="empty-state">${i18n.t('dashboard.noMatches', 'Aucun match')}</p>`;
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
							<div class="match-score">
								${match.player1_id === user.id ? match.player1_score : match.player2_score} · ${match.player1_id === user.id ? match.player2_score : match.player1_score}
								${isWinner ? `<svg class="victory-icon" viewBox="-5 -10 98 98" xmlns="http://www.w3.org/2000/svg">
    <path d="M 44,-10 C 44,17.062 22.062,39 -5,39 22.062,39 44,60.938 44,88 44,60.938 65.938,39 93,39 65.938,39 44,17.062 44,-10 Z"/>
</svg>` : ''}
							</div>
							<div class="match-opponent-line">
							<!--    <span class="result-history ${isWinner ? 'victory' : 'defeat'}">${isWinner ? 'Victoire' : 'Défaite'}</span> -->
								<span class="match-opponent">&nbsp;vs ${escapeHtml(opponentName)}</span>
							</div>
						</div>
					</div>
				`;
			}).join('');

		} catch (error) {
			console.error('[DashboardPage] Failed to load match history:', error);
			console.error('[DashboardPage] Error details:', error instanceof Error ? error.message : error);
			container.innerHTML = `<p class="error-state">${i18n.t('dashboard.loadingError', 'Erreur de chargement')}</p>`;
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


	private static async loadRankingChart(): Promise<void>
	{
		const canvas = document.getElementById('ranking-chart') as HTMLCanvasElement;
		if (!canvas) return;

		try {
			const user = await ApiService.getMe();
			const matches = await ApiService.getUserMatches(user.id, 5) as any[];

	console.log('[RankingChart] Matches récupérés:', matches);
	console.log('[RankingChart] Premier match complet:', JSON.stringify(matches[0], null, 2));

			// Détruire l'ancien chart s'il existe
			if (this.rankingChart) {
				this.rankingChart.destroy();
				this.rankingChart = null;
			}

			// Pas de matches = graphique vide
			if (matches.length === 0) {
				this.renderEmptyChart(canvas);
				return;
			}

			// Extraire les rankings dans l'ordre chronologique
			const sortedMatches = [...matches].sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);

			const rankings = sortedMatches.map(match => {
				return match.player1_id === user.id
					? match.player1_ranking_after
					: match.player2_ranking_after;
			});

			/* rankings.unshift(1000); */
			
			console.log('[RankingChart] Rankings extraits:', rankings);
			console.log('[RankingChart] User ID:', user.id);

			const labels = rankings.map((_, index) => `M${index}`);

			
			// Récupérer le contexte pour le dégradé
			const ctx = canvas.getContext('2d');

			// Dégradé vertical (du haut vers le bas)
			const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

			gradient.addColorStop(0, "rgba(230, 132, 6, 0.35)");   // Orange léger
			gradient.addColorStop(1, "rgba(44, 31, 22, 0)");       // Transparent

		// Créer le graphique
		this.rankingChart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: labels,
				datasets: [{
					label: 'Ranking',
					data: rankings,
					borderColor: '#e68406',
					backgroundColor: gradient,   // <-- dégradé ici
					borderWidth: 3,
					tension: 0.4,
					pointRadius: 5,
					pointHoverRadius: 7,
					pointBackgroundColor: '#ffffffff',
					pointBorderColor: '#ffffff',
					pointBorderWidth: 1,
					fill: true
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#e68406',
						borderWidth: 1,
						padding: 10,
						displayColors: false,
						callbacks: {
							title: () => 'Ranking',
							label: (context) => `${context.parsed.y} pts`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: false,
						ticks: {
							display: false
						},
						grid: {
							color: 'rgba(139, 139, 139, 0.1)',
							drawBorder: false
						}
					},
					x: {
						ticks: {
							display: false
						},
						grid: {
							display: false
						}
					}
				}
			}
		});


		} catch (error) {
			console.error('[DashboardPage] Failed to load ranking chart:', error);
		}
	}

	private static renderEmptyChart(canvas: HTMLCanvasElement): void
	{
		this.rankingChart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: ['M1', 'M2', 'M3', 'M4', 'M5'],
				datasets: [{
					label: 'Ranking',
					data: [],
					borderColor: '#5ACB3C',
					backgroundColor: 'rgba(90, 203, 60, 0.1)',
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }
				}
			}
		});
	}

}
