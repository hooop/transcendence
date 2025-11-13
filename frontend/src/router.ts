import { PongGame }				from './game/PongGame.ts'
import { TournamentManager }	from './tournament/TournamentManager'
import { AIDifficulty }			from './game/AIPlayer'
import { AuthPages }			from './pages/AuthPages'
import { DashboardPage }		from './pages/DashboardPage'
import { ApiService }			from './services/api'
import { TournamentConfigPage } from './pages/TournamentConfigPage'

import gameModeTemplate			from './templates/game.html?raw';
import homeTemplate				from './templates/home.html?raw';
import tournamentTemplate		from './templates/tournament.html?raw';
import tournamentReadyTemplate from './templates/tournament-ready.html?raw';


export class Router
{
	private routes: Map<string, () => void> = new Map()
	private currentGame: PongGame | null = null
	private tournamentManager: TournamentManager | null = null

	constructor() {
		this.setupRoutes()
	}

	private setupRoutes(): void {
		// Auth routes
		this.routes.set('/', () => this.renderHome())
		this.routes.set('/login', () => this.renderLogin())
		this.routes.set('/register', () => this.renderRegister())
		this.routes.set('/auth/callback', () => this.renderOAuthCallback())

		// Protected routes
		this.routes.set('/dashboard', () => this.renderDashboard())

		// Game routes
		this.routes.set('/game', () => this.renderGameModeSelection())
/* 		this.routes.set('/game/vs-friend', () => this.renderGame(false))
		this.routes.set('/game/vs-ai', () => this.renderAIDifficultySelection())
		this.routes.set('/game/vs-ai/easy', () => this.renderGame(true, AIDifficulty.EASY))
		this.routes.set('/game/vs-ai/medium', () => this.renderGame(true, AIDifficulty.MEDIUM))
		this.routes.set('/game/vs-ai/hard', () => this.renderGame(true, AIDifficulty.HARD)) */
		this.routes.set('/tournament', () => this.renderTournament())
	}

	start(): void {
		document.addEventListener('click', (e) => {
			const target = e.target as HTMLAnchorElement
			if (target.matches('[data-route]')) {
				e.preventDefault()
				const href = target.getAttribute('href')
				if (href) {
					this.navigate(href)
				}
			}
		})

		window.addEventListener('popstate', () => {
			this.handleRoute()
		})

		this.handleRoute()
	}

	navigate(path: string): void {
		history.pushState({}, '', path)
		this.handleRoute()
	}

private handleRoute(): void {
    // Nettoyer le jeu quand on quitte la page
    if (this.currentGame && window.location.pathname !== '/game') {
        this.currentGame.destroy()
        this.currentGame = null
    }

    // NOUVEAU : Enlever la classe fullscreen si on quitte /game
    const path = window.location.pathname
    if (path !== '/game') {
        document.body.classList.remove('fullscreen-game')
    }

    const handler = this.routes.get(path)

    if (handler) {
        handler()
    } else {
        this.navigate('/')
    }
}

	// HOME
	private renderHome(): void
	{
		// Si l'utilisateur est connecté, rediriger vers le dashboard
		const token = ApiService.getToken();
		if (token)
		{
			this.navigate('/dashboard');
			return;
		}

		// Sinon, afficher la page d'accueil avec login/register
		this.updatePageContent(homeTemplate);
	}

	// CONNEXION
	private renderLogin(): void
	{
		this.updatePageContent(AuthPages.renderLogin())
		setTimeout(() => AuthPages.setupLoginForm(), 100)
	}

	// INSCRIPTION
	private renderRegister(): void
	{
		this.updatePageContent(AuthPages.renderRegister())
		setTimeout(() => AuthPages.setupRegisterForm(), 100)
	}

	private renderOAuthCallback(): void
	{
		this.updatePageContent(AuthPages.renderOAuthCallback())
	}

	private renderDashboard(): void
	{
		// Vérifier l'authentification
		const token = ApiService.getToken();
		if (!token)
		{
			this.navigate('/login');
			return;
		}

		// Afficher "Loading..."
		this.updatePageContent('<div class="loading">Loading dashboard...</div>')

		// Charger le dashboard de manière asynchrone
		DashboardPage.render().then(html =>
		{
			this.updatePageContent(html)
			DashboardPage.setupEventListeners()
		}).catch(() =>
		{
			this.navigate('/login')
		})
	}

	// GAME
	private renderGameModeSelection(): void
	{
		document.body.classList.add('fullscreen-game');

		this.updatePageContent(gameModeTemplate);

		setTimeout(() =>
		{
			this.initPongGame(false, AIDifficulty.MEDIUM);
			this.setupGameOptions();
		}, 100);
	}

	private setupGameOptions(): void {
		let currentMode: 'friend' | 'ai' = 'friend'
		let currentDifficulty: AIDifficulty = AIDifficulty.MEDIUM

		// Toggle mode Friend/AI
		const modeToggle = document.getElementById('mode-toggle') as HTMLInputElement
		const difficultySelect = document.getElementById('difficulty-select') as HTMLSelectElement

		if (modeToggle && difficultySelect) {
			// Au chargement, le select est désactivé (mode friend par défaut)
			difficultySelect.disabled = true

			// Écouter le changement de mode
			modeToggle.addEventListener('change', () => {
				currentMode = modeToggle.checked ? 'ai' : 'friend'

				// Activer/désactiver le select selon le mode
				difficultySelect.disabled = !modeToggle.checked

				// Relancer le jeu avec le bon mode
				if (this.currentGame) {
					this.currentGame.destroy()
				}

				// Récupérer la difficulté actuelle du select
				const selectValue = difficultySelect.value
				if (selectValue === 'easy') currentDifficulty = AIDifficulty.EASY
				else if (selectValue === 'medium') currentDifficulty = AIDifficulty.MEDIUM
				else if (selectValue === 'hard') currentDifficulty = AIDifficulty.HARD

				this.initPongGame(currentMode === 'ai', currentDifficulty)
			})

			// Écouter les changements de difficulté
			difficultySelect.addEventListener('change', () => {
				const value = difficultySelect.value

				if (value === 'easy') currentDifficulty = AIDifficulty.EASY
				else if (value === 'medium') currentDifficulty = AIDifficulty.MEDIUM
				else if (value === 'hard') currentDifficulty = AIDifficulty.HARD

				// Relancer le jeu si on est en mode AI
				if (currentMode === 'ai' && this.currentGame) {
					this.currentGame.destroy()
					this.initPongGame(true, currentDifficulty)
				}
			})
		}

		// Gestion des messages de statut du jeu
		if (this.currentGame) {
			this.currentGame.onStatusChange = (message: string, isWinner: boolean) => {
				const statusElement = document.getElementById('game-status')
				if (statusElement) {
					statusElement.innerHTML = isWinner
						? `<span class="status-message winner-message">${message}</span>`
						: `<span class="status-message">${message}</span>`
				}
			}
		}
	}


	private renderTournament(): void
	{
		if (!this.tournamentManager)
		{
			this.tournamentManager = new TournamentManager({
				name: 'Tournoi des champions',
				maxPlayers: 8,
				minPlayers: 2
			})
		}

		const state = this.tournamentManager.getState()

		// Charger le template HTML principal
		this.updatePageContent(tournamentTemplate)

		// Injecter le contenu selon l'état
		this.renderTournamentContent(state)

		// Attacher les événements
		setTimeout(() => this.setupTournamentEvents(), 0)
	}


	private renderTournamentContent(state: any): void
	{
		const contentContainer = document.getElementById('tournament-content')
		if (!contentContainer)
		{
			console.error('Tournament content container not found!')
			return
		}

		let html = ''

		switch (state.status) // REMETTRE STATE.STATUS EN MINUSUCULE COMME PARAMETRE
		{
			case 'registration':
				html = this.renderRegistration()
				break
			case 'ready':
				html = this.renderReady(state)
				break
			case 'ongoing':
				html = this.renderOngoing(state)
				break
			case 'completed':
				html = this.renderCompleted(state)
				break
			default:
				html = '<p>Unknown tournament state</p>'
		}

		contentContainer.innerHTML = html
	}

	private renderRegistration(): string
	{
		// Charger le template de configuration
		const html = TournamentConfigPage.render()

		// Insérer dans le DOM temporairement pour manipulation
		const tempDiv = document.createElement('div')
		tempDiv.innerHTML = html

		// Retourner le HTML
		return tempDiv.innerHTML
	}

	private renderReady(state: any): string
	{
		const nextMatch = this.tournamentManager?.getNextMatch()
		if (!nextMatch) return '<p>No matches available</p>'

		let html = tournamentReadyTemplate

		// Remplacer les placeholders
		html = html.replace('{{PLAYER1_ALIAS}}', nextMatch.player1.alias)
		html = html.replace('{{PLAYER2_ALIAS}}', nextMatch.player2.alias)
		html = html.replace('{{MATCH_ID}}', nextMatch.id)
		html = html.replace('{{BRACKET_CONTENT}}', this.renderBracket(state))

		return html
	}

	private renderOngoing(state: any): string {
		const currentMatch = state.currentMatch
		if (!currentMatch) return '<p>No ongoing match</p>'

		return `
			<div class="tournament-section">
				<h3>🏓 Match in Progress</h3>
				<div class="current-match">
					<div class="match-header">
						<span class="player">${currentMatch.player1.alias}</span>
						<span class="vs">VS</span>
						<span class="player">${currentMatch.player2.alias}</span>
					</div>
					<div class="game-container">
						<canvas id="tournament-canvas"></canvas>
					</div>
				</div>
			</div>
		`
	}

	private renderCompleted(state: any): string {
		return `
			<div class="tournament-section">
				<h3>Tournoi terminé</h3>
				<div class="winner-announcement">
					<h2>Champion: ${state.winner?.alias || 'Unknown'}</h2>
					<p>Congratulations!</p>
				</div>
				${this.renderBracket(state)}
				<div class="tournament-actions">
					<button id="new-tournament" class="btn white-btn">🔄 New Tournament</button>
				</div>
			</div>
		`
	}



	private renderBracket(_state: any): string
	{
		const rounds = this.tournamentManager?.getRounds() || 0
		if (rounds === 0) return ''

		let bracketHtml = '<div class="tournament-bracket"><div class="bracket-container">'

		const nextMatch = this.tournamentManager?.getNextMatch()

		for (let round = 1; round <= rounds; round++)
		{
			const matches = this.tournamentManager?.getMatchesForRound(round) || []
			const roundName = this.getRoundName(round)

			bracketHtml += `
				<div class="bracket-round round-${round}">
					<h5 class="round-title">${roundName}</h5>
						<div class="matches-column">
							${matches.map((match, index) => {
								const p1Class = match.winner?.id === match.player1.id ? 'winner' : (match.status === 'completed' ? 'loser' : '')
								const p2Class = match.winner?.id === match.player2.id ? 'winner' : (match.status === 'completed' ? 'loser' : '')

								// Vérifier si c'est le prochain match
								const isNextMatch = nextMatch && match.id === nextMatch.id
								const arrow = isNextMatch ? '<span class="next-match-arrow">▶</span>' : ''

								return `
									<div class="bracket-match-wrapper">
										<div class="bracket-match ${match.status}">
											<div class="match-player ${p1Class}">
												${arrow}${match.player1.alias} ${match.score.player1} ─┐
											</div>
											<div class="match-player ${p2Class}">
												${arrow}${match.player2.alias} ${match.score.player2} ─┘
											</div>
										</div>
									</div>
								`
								}).join('')}
						</div>
				</div>
			`
		}

		bracketHtml += '</div></div>'
		return bracketHtml
	}



	private getRoundName(round: number): string {
		// Calculer le nombre total de rounds théoriques basé sur le nombre de joueurs
		const totalPlayers = this.tournamentManager?.getState().players.length || 0
		const theoreticalTotalRounds = Math.log2(totalPlayers)

		const roundsFromEnd = theoreticalTotalRounds - round

		if (roundsFromEnd === 0) return 'Finale'
		if (roundsFromEnd === 1) return 'Demi finale'
		if (roundsFromEnd === 2) return 'Quart de finale'

		return `Round ${round}`
	}

	private updatePageContent(html: string): void {
		const container = document.getElementById('page-content')
		if (container) {
			container.innerHTML = html
			this.addPageStyles()
		}
	}

	private initPongGame(isAI: boolean = false, difficulty: AIDifficulty = AIDifficulty.MEDIUM): void {
		const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement
		if (!canvas) {
			console.error('Canvas not found!')
			return
		}
		if (this.currentGame) {
			this.currentGame.destroy()
		}
		this.currentGame = new PongGame(canvas, isAI, difficulty)
		setTimeout(() => {
			canvas.focus()
		}, 100)
		console.log(`🎮 Pong game ready! ${isAI ? '(vs AI)' : '(vs Player)'}`)
	}


	private addPageStyles(): void {
		if (document.getElementById('page-styles')) return

		const style = document.createElement('style')
		style.id = 'page-styles'
		style.textContent = `

			.welcome-header {
				text-align: center;
				margin-bottom: 0rem;
				}

			.welcome-image {
				max-width: 700px;
				width: 100%;
				height: auto;
				margin-bottom: 0rem;
				display: block;
				margin-left: auto;
				margin-right: auto;
				}


			.controls-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 1rem;
				margin: 1rem 0;
			}
			.player-controls {
				padding: 0.5rem;
				background: #2a2a2a;
				border-radius: 4px;
			}
			.player-controls h4 {
				color: #00ff41;
				margin-bottom: 0.5rem;
				font-size: 0.9rem;
			}
			.game-controls {
				margin-top: 1rem;
				padding-top: 1rem;
				border-top: 1px solid #333;
			}
			.game-controls p {
				margin: 0.3rem 0;
			}

			/* Game Mode Selector */
			.game-mode-selector {
				margin: 2rem auto;
				max-width: 600px;
			}
			.game-mode-selector h3 {
				color: #00ff41;
				margin-bottom: 1rem;
				font-size: 1.2rem;
			}
			.mode-buttons {
				display: flex;
				gap: 1rem;
				justify-content: center;
			}
			.mode-btn {
				flex: 1;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 1.5rem;
				background: #1a1a1a;
				border: 2px solid #333;
				border-radius: 12px;
				color: #fff;
				cursor: pointer;
				transition: all 0.3s ease;
			}
			.mode-btn:hover {
				border-color: #00ff41;
				background: #222;
				}
			.mode-btn.active {
				border-color: #00ff41;
				background: #1a2a1a;
				box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
			}
			.mode-icon {
				font-size: 3rem;
			}
			.mode-title {
				font-size: 1.2rem;
				font-weight: bold;
				color: #00ff41;
			}
			.mode-desc {
				font-size: 0.9rem;
				color: #999;
			}



			/* Liens sans style par défaut */
			.mode-btn-link,
			.difficulty-btn-link {
				text-decoration: none;
				color: inherit;
			}

			/* Conteneur bouton retour */
			.back-button-container {
				margin-top: 2rem;
				text-align: center;
			}

			/* Tournament Styles */
			.player-count {
				font-size: 1.2rem;
				margin-bottom: 0.5rem;
				font-weight: bold;
			}

			.player-count.valid-count {
				color: #00ff41;

			.valid-counts-hint {
				font-size: 0.9rem;
				color: #999;
				margin-bottom: 1.5rem;
				text-align: center;
			}

			/* AI Registration */
			.ai-registration {
				margin: 2rem 0;
				padding: 1.5rem;
				background: #1a1a1a;
				border-radius: 8px;
				border: 1px solid #333;
			}
			.ai-registration h4 {
				color: #00ff41;
				margin-bottom: 1rem;
			}
			.ai-buttons {
				display: flex;
				gap: 1rem;
				justify-content: center;
			}
			.btn-ai {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 1rem;
				background: #2a2a2a;
				border: 2px solid #444;
				border-radius: 8px;
				color: #fff;
				cursor: pointer;
				transition: all 0.3s ease;
			}
			.btn-ai:hover {
				box-shadow: 0 5px 15px rgba(0, 255, 65, 0.2);
			}
			.btn-ai-easy:hover {
				border-color: #4caf50;
			}
			.btn-ai-medium:hover {
				border-color: #ff9800;
			}
			.btn-ai-hard:hover {
				border-color: #f44336;
			}
			.ai-icon {
				font-size: 2rem;
			}

			/* Players List */

			.player-ai {
				border-left: 3px solid #00bcd4;
			}
			.player-human {
				border-left: 3px solid #00ff41;
			}



		`
		document.head.appendChild(style)
	}

	private setupTournamentEvents(): void
{
    const state = this.tournamentManager?.getState()

    // Si on est en registration, utiliser la nouvelle page
    if (state?.status === 'registration') {
        TournamentConfigPage.update(this.tournamentManager!)
        TournamentConfigPage.setupEventListeners(
            this.tournamentManager!,
            () => this.renderTournament()
        )
        return
    }

    // Pour les autres états (ready, ongoing, completed), garder le code existant

    // Bouton pour démarrer un match
    const startMatchBtn = document.getElementById('start-match')
    if (startMatchBtn) {
        startMatchBtn.addEventListener('click', (e) => {
            const matchId = (e.target as HTMLElement).getAttribute('data-match-id')
            if (matchId) {
                const match = this.tournamentManager?.startMatch(matchId)
                if (match) {
                    this.renderTournament()
                    setTimeout(() => this.initTournamentGame(match), 0)
                }
            }
        })
    }

    // Bouton pour nouveau tournoi
    const newTournamentBtn = document.getElementById('new-tournament')
    if (newTournamentBtn) {
        newTournamentBtn.addEventListener('click', () => {
            this.tournamentManager?.reset()
            this.renderTournament()
        })
    }
}

	private initTournamentGame(match: any): void {
		const canvas = document.getElementById('tournament-canvas') as HTMLCanvasElement
		if (!canvas) {
			console.error('Tournament canvas not found!')
			return
		}

		if (this.currentGame) {
			this.currentGame.destroy()
		}

		// Déterminer si le match implique des IA
		const player1IsAI = match.player1.isAI
		const player2IsAI = match.player2.isAI

		// Si les deux sont des IA ou si le joueur de droite est une IA, activer l'IA
		let aiEnabled = false
		let aiDifficulty = AIDifficulty.MEDIUM

		if (player2IsAI) {
			aiEnabled = true
			// Mapper la difficulté de l'IA
			switch (match.player2.aiDifficulty) {
				case 'easy':
					aiDifficulty = AIDifficulty.EASY
					break
				case 'hard':
					aiDifficulty = AIDifficulty.HARD
					break
				default:
					aiDifficulty = AIDifficulty.MEDIUM
			}
		}

		// Si les deux joueurs sont des IA, on simule automatiquement
		if (player1IsAI && player2IsAI) {
			this.simulateAIMatch(match)
			return
		}

		// Créer le jeu avec ou sans IA
		this.currentGame = new PongGame(canvas, aiEnabled, aiDifficulty)

		// Attendre la fin du jeu
		const checkGameEnd = setInterval(() => {
			if (this.currentGame) {
				const score = this.currentGame.getScore()
				// Si un joueur atteint 5 points (condition typique de fin)
				if (score.left >= 5 || score.right >= 5) {
					clearInterval(checkGameEnd)

					// Déterminer le gagnant
					const winnerId = score.left > score.right ? match.player1.id : match.player2.id

					// Enregistrer le résultat
					this.tournamentManager?.endMatch(match.id, winnerId, {
						player1: score.left,
						player2: score.right
					})

					// Nettoyer et revenir à la vue tournoi
					if (this.currentGame) {
						this.currentGame.destroy()
						this.currentGame = null
					}

					setTimeout(() => {
						this.renderTournament()
					}, 2000) // Attendre 2 secondes pour montrer le score final
				}
			} else {
				clearInterval(checkGameEnd)
			}
		}, 100)

		canvas.focus()
		console.log(`🎮 Tournament game ready! ${aiEnabled ? '(vs AI)' : '(vs Player)'}`)
	}

	private simulateAIMatch(match: any): void {
		console.log('🤖 Simulating AI vs AI match...')

		// Simuler un match entre deux IA
		const difficulty1 = match.player1.aiDifficulty || 'medium'
		const difficulty2 = match.player2.aiDifficulty || 'medium'

		// Calculer les probabilités de victoire selon les difficultés
		const strengthMap = { easy: 1, medium: 2, hard: 3 }
		const strength1 = strengthMap[difficulty1 as keyof typeof strengthMap]
		const strength2 = strengthMap[difficulty2 as keyof typeof strengthMap]

		const totalStrength = strength1 + strength2
		const player1WinChance = strength1 / totalStrength

		// Générer un score aléatoire mais réaliste
		const winner = Math.random() < player1WinChance ? match.player1 : match.player2
		const loser = winner.id === match.player1.id ? match.player2 : match.player1

		// Score du gagnant: entre 5 et 7
		const winnerScore = 5 + Math.floor(Math.random() * 3)
		// Score du perdant: entre 0 et 4
		const loserScore = Math.floor(Math.random() * 5)

		const score = winner.id === match.player1.id
			? { player1: winnerScore, player2: loserScore }
			: { player1: loserScore, player2: winnerScore }

		// Afficher le résultat dans la console
		console.log(`🏆 ${winner.alias} wins ${score.player1}-${score.player2} against ${loser.alias}`)

		// Enregistrer le résultat après un court délai
		setTimeout(() => {
			this.tournamentManager?.endMatch(match.id, winner.id, score)
			this.renderTournament()
		}, 1500)
	}
}
