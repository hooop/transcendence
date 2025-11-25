import { GameConfig, GameState } from './types'
import { Ball } from './Ball'
import { Paddle } from './Paddle'
import { AIPlayer, AIDifficulty } from './AIPlayer'
import { ApiService } from '../services/api'

export class PongGame
{
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private config: GameConfig
	private state: GameState

	private ball!: Ball
	private leftPaddle!: Paddle
	private rightPaddle!: Paddle

	// IA
	private ai?: AIPlayer
	private isAIEnabled: boolean = false
	private lastSpeedIncrease: number = 0
	private speedIncreaseInterval: number = 0

	private lastTime: number = 0
	private animationFrame: number = 0

	// Contrôles clavier
	private keys: Set<string> = new Set()

	// Compte à rebours
	private countdownActive: boolean = false
	private countdownValue: number = 3
	private countdownStartTime: number = 0

	private isTournamentMode: boolean = false
	private showLeftControls: boolean = true
	private showRightControls: boolean = true

	private player1Name: string = ''
	private player2Name: string = ''

	private player1Id?: string
	private player2Id?: string
	private gameMode: string = 'local'

	/* private statusElement: HTMLElement | null = null */

	public onStatusChange?: (message: string, isWinner: boolean) => void

    constructor(
				canvas: HTMLCanvasElement,
				aiEnabled: boolean = false,
				aiDifficulty: AIDifficulty = AIDifficulty.MEDIUM,
				isTournamentMode: boolean = false,
				showLeftControls: boolean = true,
				showRightControls: boolean = true,
				player1Name: string = '',
    			player2Name: string = '',
				player1Id?: string,
				player2Id?: string,
				gameMode: string = 'local'
			)
	{
		this.canvas = canvas
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Could not get 2D context')
		this.ctx = ctx

		this.isAIEnabled = aiEnabled

		this.isTournamentMode = isTournamentMode
		this.showLeftControls = showLeftControls
		this.showRightControls = showRightControls
		this.player1Name = player1Name
		this.player2Name = player2Name
		this.player1Id = player1Id
		this.player2Id = player2Id
		this.gameMode = gameMode

		// MODIFIÉ : Calculer les dimensions avec fallback
		const container = this.canvas.parentElement
		let width = 1600  // Valeur par défaut
		let height = 900  // Valeur par défaut

		if (container && container.clientWidth > 0 && container.clientHeight > 0)
		{
			width = container.clientWidth
			height = container.clientHeight
		}

		// Configuration du jeu avec dimensions dynamiques
		this.config =
		{
			width: width,
			height: height,
			paddleSpeed: 300,
			ballSpeed: 400,
			paddleHeight: 100,
			paddleWidth: 10,
			ballSize: 20
		}

		// État initial
		this.state =
		{
			leftScore: 0,
			rightScore: 0,
			isRunning: false,
			winner: null
		}

		this.setupCanvas()
		this.initializeGameObjects()
		this.setupEventListeners()

		/*  this.statusElement = document.getElementById('game-status') */

		// Initialiser l'IA si activée
		if (this.isAIEnabled)
		{
			this.ai = new AIPlayer(this.config, aiDifficulty)
			this.speedIncreaseInterval = this.ai.getSpeedIncreaseInterval()
			console.log(`🤖 AI initialized with difficulty: ${aiDifficulty}`)
			console.log(`⚡ Ball will increase speed by 15% every ${this.speedIncreaseInterval / 1000}s`)
		}

		this.render()
		console.log('🏓 Pong game initialized')
	}

	private setupCanvas(): void
	{
		// Juste définir la taille initiale du canvas
		const container = this.canvas.parentElement

		if (container && container.clientWidth > 0 && container.clientHeight > 0)
		{
			this.canvas.width = container.clientWidth
			this.canvas.height = container.clientHeight
		}
		else
		{
			this.canvas.width = this.config.width
			this.canvas.height = this.config.height
		}

		// Style du canvas
		this.canvas.style.border = '0px'
		this.canvas.style.background = '#000'

		// Écouter les changements de taille de fenêtre
		window.addEventListener('resize', () => this.resizeCanvas())
	}

	private resizeCanvas(): void
	{
		// Récupérer la taille du container
		const container = this.canvas.parentElement
		if (!container)
			return

		const width = container.clientWidth
		const height = container.clientHeight

		// Mettre à jour la taille du canvas
		this.canvas.width = width
		this.canvas.height = height

		// Mettre à jour la config du jeu
		this.config.width = width
		this.config.height = height

		// Repositionner les éléments du jeu SEULEMENT s'ils existent
		if (this.ball)
		{
			this.ball.position.x = width / 2
			this.ball.position.y = height / 2
		}

		if (this.leftPaddle)
		{
			this.leftPaddle.position.x = 30
			this.leftPaddle.position.y = height / 2
		}

		if (this.rightPaddle)
		{
			this.rightPaddle.position.x = width - 30
			this.rightPaddle.position.y = height / 2
		}

		// IMPORTANT : Rafraîchir l'affichage
		if (!this.state.isRunning && this.ball && this.leftPaddle && this.rightPaddle)
		{
			this.render()
		}
	}

	private initializeGameObjects(): void
	{
		// Créer la balle au centre
		this.ball = new Ball(
			this.config,
			{
				x: this.config.width / 2,
				y: this.config.height / 2
			}
		)

		// Créer les raquettes
		this.leftPaddle = new Paddle(
			this.config,
			{
				x: 30,
				y: this.config.height / 2
			}
		)

		this.rightPaddle = new Paddle(
			this.config,
			{
				x: this.config.width - 30,
				y: this.config.height / 2
				}
		)
	}

    private setupEventListeners(): void
	{
		// Écouter les touches du clavier pour le mouvement
		document.addEventListener(
			'keydown',
			(e) =>
			{
				// Empêcher le comportement par défaut pour les touches de jeu
				if (this.isGameKey(e.key))
				{
					e.preventDefault()
				}
				this.keys.add(e.key.toLowerCase())
			}
		)

		document.addEventListener(
			'keyup',
			(e) =>
			{
				// Empêcher le comportement par défaut pour les touches de jeu
				if (this.isGameKey(e.key))
				{
					e.preventDefault()
				}
				this.keys.delete(e.key.toLowerCase())
			}
		)

		// Ajouter les contrôles de jeu DÈS LE DÉBUT (pas seulement au start)
		document.addEventListener('keydown', this.handleGameControls)

		// S'assurer que le canvas peut recevoir le focus
		this.canvas.tabIndex = 0
		this.canvas.style.outline = 'none'
	}

	private startCountdown(): void
	{
		this.countdownActive = true
		this.countdownValue = 3
		this.countdownStartTime = performance.now()

		console.log('⏱️ Countdown started!')

		// Démarrer la loop de countdown
		this.countdownLoop(this.countdownStartTime)
	}

	private countdownLoop = (currentTime: number): void =>
	{
		if (!this.countdownActive) return

		const elapsed = (currentTime - this.countdownStartTime) / 1000 // en secondes
		const remaining = Math.ceil(3 - elapsed)

		if (remaining > 0)
		{
			this.countdownValue = remaining
			this.render() // Afficher le countdown
			requestAnimationFrame(this.countdownLoop)
		}
		else
		{
			// Countdown terminé, démarrer le jeu
			this.countdownActive = false
			this.start()
		}
	}

	// Ajouter cette nouvelle méthode pour identifier les touches de jeu :
	private isGameKey(key: string): boolean
	{
		const gameKeys =
		[
			' ',           // Espace
			'arrowup',     // Flèche haut
			'arrowdown',   // Flèche bas
			'w',           // W
			's'
		]
		return gameKeys.includes(key.toLowerCase())
	}

	private handleInput(): void
	{
		// Joueur de gauche (W/S)
		if (this.keys.has('w') || this.keys.has('W'))
		{
			this.leftPaddle.setMoveDirection(-1)
		}
		else if (this.keys.has('s') || this.keys.has('S'))
		{
			this.leftPaddle.setMoveDirection(1)
		}
		else
		{
			this.leftPaddle.setMoveDirection(0)
		}

		// Joueur de droite (Flèches haut/bas) - Seulement si l'IA n'est pas activée
		if (!this.isAIEnabled)
		{
			// Vérifier plusieurs variantes pour la compatibilité
			if (this.keys.has('arrowup') || this.keys.has('ArrowUp') || this.keys.has('Up'))
			{
				this.rightPaddle.setMoveDirection(-1)
			}
			else if (this.keys.has('arrowdown') || this.keys.has('ArrowDown') || this.keys.has('Down'))
			{
				this.rightPaddle.setMoveDirection(1)
			}
			else
			{
				this.rightPaddle.setMoveDirection(0)
			}
		}
	}

	private update(deltaTime: number): void
	{
		if (!this.state.isRunning) return

		this.handleInput()

		// Mettre à jour l'IA si activée
		if (this.isAIEnabled && this.ai)
		{
			this.ai.update(this.rightPaddle, this.ball, deltaTime)
			this.ai.movePaddle(this.rightPaddle)

			// Gérer l'accélération progressive de la balle
			const currentTime = performance.now()
			if (currentTime - this.lastSpeedIncrease >= this.speedIncreaseInterval)
			{
				this.ball.increaseSpeed(15) // Augmente de 15%
				this.lastSpeedIncrease = currentTime
				console.log('⚡ Ball speed increased by 15%!')
			}
		}

		// Mettre à jour les objets
		this.leftPaddle.update(deltaTime)
		this.rightPaddle.update(deltaTime)
		this.ball.update(deltaTime)

		// Vérifier les collisions avec les raquettes
		this.checkPaddleCollisions()

		// Vérifier si quelqu'un a marqué
		this.checkScoring()

		// Vérifier les conditions de victoire
		this.checkWinCondition()
	}

	private checkPaddleCollisions(): void
	{
		// Collision avec la raquette de gauche
		if (this.ball.velocity.x < 0 &&
			this.leftPaddle.checkCollision(this.ball.position, this.ball.size))
		{
			this.ball.velocity.x = -this.ball.velocity.x

			// Ajouter un effet selon la position sur la raquette
			const paddleCenter = this.leftPaddle.position.y
			const hitPosition = (this.ball.position.y - paddleCenter) / (this.leftPaddle.height / 2)
			this.ball.velocity.y += hitPosition * 100 // Effet
		}

		// Collision avec la raquette de droite
		if (this.ball.velocity.x > 0 &&
			this.rightPaddle.checkCollision(this.ball.position, this.ball.size))
		{
			this.ball.velocity.x = -this.ball.velocity.x

			const paddleCenter = this.rightPaddle.position.y
			const hitPosition = (this.ball.position.y - paddleCenter) / (this.rightPaddle.height / 2)
			this.ball.velocity.y += hitPosition * 100
		}
	}

	private checkScoring(): void
	{
		const outOfBounds = this.ball.isOutOfBounds()
		if (outOfBounds === 'left')
		{
			// Point pour le joueur de droite
			this.state.rightScore++
			this.ball.reset()
			this.ball.resetSpeed() // Réinitialiser la vitesse après un point
			if (this.isAIEnabled)
			{
				this.lastSpeedIncrease = performance.now() // Réinitialiser le timer
			}
			console.log(`Score: ${this.state.leftScore} - ${this.state.rightScore}`)

			// Vérifier la victoire
			if (this.state.rightScore >= 5)
			{
				this.state.winner = 'right'
				this.state.isRunning = false
				this.showVictoryModal()
			}
		}
		else if (outOfBounds === 'right')
		{
			// Point pour le joueur de gauche
			this.state.leftScore++
			this.ball.reset()
			this.ball.resetSpeed() // Réinitialiser la vitesse après un point
			if (this.isAIEnabled)
			{
				this.lastSpeedIncrease = performance.now() // Réinitialiser le timer
			}
			console.log(`Score: ${this.state.leftScore} - ${this.state.rightScore}`)

			// Vérifier la victoire
			if (this.state.leftScore >= 5)
			{
				this.state.winner = 'left'
				this.state.isRunning = false
				this.showVictoryModal()
			}
		}
	}

	private checkWinCondition(): void
	{
		const winScore = 5 // Premier à 5 points

		if (this.state.leftScore >= winScore)
		{
			this.state.winner = 'left'
			this.state.isRunning = false
			console.log('Left player wins!')
		}
		else if (this.state.rightScore >= winScore)
		{
			this.state.winner = 'right'
			this.state.isRunning = false
			console.log('🏆 Right player wins!')
		}
	}

    private render(): void
	{
		// Effacer l'écran
		this.ctx.fillStyle = '#000'
		this.ctx.fillRect(0, 0, this.config.width, this.config.height)

		// LIGNE CENTRALE OPTIMISÉE
		this.ctx.save() // Sauvegarder l'état du contexte

		// Désactiver l'antialiasing pour les lignes
		this.ctx.imageSmoothingEnabled = false

		// Calculer la position exacte au pixel près
		const centerX = Math.floor(this.config.width / 2) + 0.5

		this.ctx.strokeStyle = '#fff'
		this.ctx.lineWidth = 2
	/*     this.ctx.setLineDash([5, 5]) // Pointillés proportionnels à la nouvelle taille */

		this.ctx.beginPath()
		this.ctx.moveTo(centerX, 0)
		this.ctx.lineTo(centerX, this.config.height)
		this.ctx.stroke()

/* 		this.ctx.setLineDash([]) // Réinitialiser */
		this.ctx.restore() // Restaurer l'état du contexte

		// Dessiner les objets du jeu
		this.leftPaddle.render(this.ctx)
		this.rightPaddle.render(this.ctx)

		// Ne dessiner la balle que si le countdown n'est pas actif
		if (!this.countdownActive)
		{
			this.ball.render(this.ctx)
		}

		// Dessiner le score
	/* 	this.renderScore() */

		// Afficher le countdown si actif
		if (this.countdownActive)
		{
			this.renderCountdown()
		}

		// Dessiner les messages
		this.renderMessages()
	}

/* 	private renderScore(): void
	{
		this.ctx.save()

		this.ctx.fillStyle = '#fff'
		this.ctx.font = '50px monospace' // Augmenté car vous êtes en 1600px maintenant
		this.ctx.textAlign = 'center'
		this.ctx.textBaseline = 'top'

		const centerX = this.config.width / 2  // 800px
		const scoreOffset = 120  // Distance depuis la ligne centrale

		// Score joueur de gauche - plus proche de la ligne
		this.ctx.fillText(
			this.state.leftScore.toString(),
			centerX - scoreOffset,  // 800 - 120 = 680px
			50
		)

		// Score joueur de droite - plus proche de la ligne
		this.ctx.fillText(
			this.state.rightScore.toString(),
			centerX + scoreOffset,  // 800 + 120 = 920px
			50
		)

		this.ctx.restore()
	} */


private renderCountdown(): void
{
	this.ctx.save()

	// Position au centre du canvas
	const centerX = this.config.width / 2
	const centerY = this.config.height / 2

	// Calculer le temps depuis le début du countdown
	const elapsed = (performance.now() - this.countdownStartTime) / 1000
	const timeInCurrentCycle = elapsed % 1  // Temps dans la seconde en cours (0 à 1)

	// Durée des animations (en secondes)
	const fadeInDuration = 0.10   // 150ms pour apparaître
	const fadeOutDuration = 0.10  // 150ms pour disparaître

	let opacity = 1
	let scale = 1

	// Animation d'apparition (début de la seconde)
	if (timeInCurrentCycle < fadeInDuration)
	{
		const progress = timeInCurrentCycle / fadeInDuration
		opacity = progress
		scale = 0.8 + (progress * 0.2)  // De 0.8 à 1.0
	}
	// Animation de disparition (fin de la seconde)
	else if (timeInCurrentCycle > (1 - fadeOutDuration))
	{
		const progress = (1 - timeInCurrentCycle) / fadeOutDuration
		opacity = progress
		scale = 0.8 + (progress * 0.2)  // De 1.0 à 0.8
	}

	this.ctx.save()
	this.ctx.translate(centerX, centerY)
	this.ctx.scale(scale, scale)
	this.ctx.globalAlpha = opacity

	// Dessiner le cercle blanc
	this.ctx.beginPath()
	this.ctx.arc(0, 0, 50, 0, Math.PI * 2)
	this.ctx.fillStyle = '#fff'
	this.ctx.fill()

	// Configuration du texte en noir
	this.ctx.fillStyle = '#000'
	this.ctx.font = '80px Inter'
	this.ctx.textAlign = 'center'
	this.ctx.textBaseline = 'middle'

	// Afficher le chiffre du countdown
	this.ctx.fillText(this.countdownValue.toString(), 0, 0)

	this.ctx.restore()
	this.ctx.restore()
}

	// MESSAGE BARRE DE CONTROLE
	private renderMessages(): void
	{
		const statusElement = document.getElementById('game-status')
		const controlsElement = document.getElementById('game-controls')

		if (!statusElement || !controlsElement)
		{
			console.warn('game-status or game-controls element not found')
			return
		}

		// Gérer l'affichage des infos du match (mode tournoi uniquement)
		const matchInfoContainer = document.getElementById('match-info-container')
		const matchInfoElement = document.getElementById('match-info')

		if (matchInfoContainer && matchInfoElement)
		{
			if (this.isTournamentMode && this.player1Name && this.player2Name)
			{
				// Afficher les noms des joueurs en mode tournoi
				matchInfoContainer.style.display = 'flex'
				matchInfoElement.textContent = `${this.player1Name} vs ${this.player2Name}`
			}
			else
			{
				// Cacher en mode entraînement
				matchInfoContainer.style.display = 'none'
			}
		}

		// Commandes (gestion selon le mode)
		let controls = ''

		if (this.isTournamentMode) {
			// Mode tournoi : afficher séparément gauche et droite
			if (this.showLeftControls && this.showRightControls) {
				// Les deux : à gauche et à droite
				controls = '<kbd>W</kbd> <kbd>S</kbd> &nbsp;&nbsp; <kbd>↑</kbd> <kbd>↓</kbd>'
			} else if (this.showLeftControls) {
				// Uniquement gauche
				controls = '<kbd>W</kbd> <kbd>S</kbd>'
			} else if (this.showRightControls) {
				// Uniquement droite
				controls = '<kbd>↑</kbd> <kbd>↓</kbd>'
			}
		} else {
			// Mode entraînement : tout à droite comme avant
			controls = this.isAIEnabled
				? '<kbd>W</kbd> <kbd>S</kbd>'
				: '<kbd>W</kbd> <kbd>S</kbd> &nbsp;&nbsp; <kbd>↑</kbd> <kbd>↓</kbd>'
		}

		controlsElement.innerHTML =
		`
			<span class="controls-text">${controls}</span>
		`

		// Messages dynamiques (centrés)
		if (this.countdownActive)
		{
			statusElement.innerHTML =
			`
				<span class="status-message"></span>
			`
		}
		else if (!this.state.isRunning && !this.state.winner)
		{
			statusElement.innerHTML =
			`
				<span class="status-message start">Toucher <kbd>ESPACE</kbd> pour lancer une partie</span>
			`
		}
		else
		{
			statusElement.innerHTML =
			`
				<span class="status-message score-display">${this.state.leftScore} . ${this.state.rightScore}</span>
			`
		}
	}

	private gameLoop = (currentTime: number): void =>
	{
		// Calculer deltaTime en secondes
		const deltaTime = (currentTime - this.lastTime) / 1000
		this.lastTime = currentTime

		// Limiter deltaTime pour éviter les gros sauts
		const clampedDeltaTime = Math.min(deltaTime, 0.016) // Max 60 FPS

		this.update(clampedDeltaTime)
		this.render()

		this.animationFrame = requestAnimationFrame(this.gameLoop)
	}

	// API publique
	start(): void
	{
		if (this.state.isRunning)
			return

		this.state.isRunning = true
		this.lastTime = performance.now()

		// Initialiser le timer d'accélération si IA activée
		if (this.isAIEnabled)
		{
			this.lastSpeedIncrease = performance.now()
		}

		this.gameLoop(this.lastTime)

		console.log('🚀 Game started!')
	}

	destroy(): void
	{
		this.stop()

		// Nettoyer tous les listeners
		document.removeEventListener('keydown', this.handleGameControls)
		window.removeEventListener('resize', () => this.resizeCanvas())  // NOUVEAU

		console.log('🧹 Game destroyed')
	}

	private handleGameControls = (e: KeyboardEvent): void =>
	{
		// Empêcher le comportement par défaut
		if (this.isGameKey(e.key))
		{
			e.preventDefault()
		}

		switch (e.key.toLowerCase())
		{
			case ' ': // Espace
				if (!this.state.isRunning && !this.state.winner && !this.countdownActive)
				{
					this.startCountdown()
				}
				else if (this.state.winner)
				{
					this.restart()
				}
				break
		}
	}

	stop(): void
	{
		this.state.isRunning = false
		this.countdownActive = false // Arrêter aussi le countdown

		if (this.animationFrame)
		{
			cancelAnimationFrame(this.animationFrame)
		}

		console.log('⏹️ Game stopped')
	}

	restart(): void
	{
		this.stop()

		// Reset du state
		this.state =
		{
			leftScore: 0,
			rightScore: 0,
			isRunning: false,
			winner: null
		}

		// Reset des objets
		this.ball.reset()
		this.ball.resetSpeed() // Réinitialiser la vitesse de la balle
		this.leftPaddle.reset()  // Ajouter cette ligne
		this.rightPaddle.reset() // Ajouter cette ligne

		// Reset de l'IA et du timer d'accélération si activée
		if (this.ai)
		{
			this.ai.reset()
			this.lastSpeedIncrease = 0
		}

		this.render() // Afficher l'état initial

		console.log('🔄 Game reset')
	}

	private async showVictoryModal(): Promise<void>
	{
		console.log('🏆 showVictoryModal called');
		console.log('player1Id:', this.player1Id);

// Sauvegarder les stats si le joueur est connecté
		if (this.player1Id)
		{
			console.log('✅ Player is authenticated, updating stats...');
			try {
				const won = this.state.winner === 'left';
				const score = this.state.leftScore;
				const opponentScore = this.state.rightScore;

				// Mettre à jour les stats globales
			/* 	await ApiService.updateUserStats(
					this.player1Id,
					won,
					score,
					opponentScore
				);
 */
				// Déterminer l'opponent_name selon le contexte
				let opponentName: string | undefined;
				if (this.isAIEnabled) {
					opponentName = 'IA';
				} else if (this.isTournamentMode) {
					opponentName = this.state.winner === 'left' ? this.player2Name : this.player1Name;
				} else {
					opponentName = 'Joueur local';
				}

			// Enregistrer le match complet dans l'historique
			const winnerId = won ? this.player1Id : null;
			await ApiService.saveLocalMatch({
				player2_id: this.player2Id,
				opponent_name: opponentName,
				winner_id: winnerId,
				player1_score: score,
				player2_score: opponentScore,
				game_mode: this.gameMode
			});

				console.log('✅ Stats and match history updated successfully');
			} catch (error) {
				console.error('❌ Failed to update stats/match:', error);
			}
		} else {
			console.log('ℹ️ Player not authenticated, stats not saved');
		}

		// Mode tournoi : modale spéciale
		if (this.isTournamentMode)
		{
			const modal = document.getElementById('tournamentVictoryModal')
			const messageElement = document.getElementById('tournamentMessage')

			if (!modal || !messageElement) return

			const humanWon = (this.state.winner === 'left' && !this.player1Name.includes('IA')) ||
							(this.state.winner === 'right' && !this.player2Name.includes('IA'))

			const winnerName = this.state.winner === 'left' ? this.player1Name : this.player2Name

			if (humanWon)
			{
				messageElement.textContent = `Bravo ${winnerName}, tu passes au tour suivant !`
			}
			else
			{
				const loserName = this.state.winner === 'left' ? this.player2Name : this.player1Name
				messageElement.textContent = `Dommage ${loserName}, le tournoi s'arrête ici pour toi.`
			}

			modal.style.display = 'flex'
			return
		}

		// Mode entraînement : modale classique
		let winnerName = this.state.winner === 'left' ? 'Joueur de gauche' : 'Joueur de droite'

		if (this.isAIEnabled && this.state.winner === 'right')
		{
			winnerName = 'IA'
		}

		const modal = document.getElementById('victoryModal')
		const winnerNameElement = document.getElementById('winnerName')
		const modalScoreElement = document.getElementById('modalScore')
		const closeButton = document.querySelector('.modal-close')
		const overlay = document.querySelector('.modal-overlay')

		if (!modal || !winnerNameElement || !modalScoreElement) return

		winnerNameElement.textContent = winnerName
		modalScoreElement.textContent = `Score final : ${this.state.leftScore} - ${this.state.rightScore}`

		modal.style.display = 'flex'

		closeButton?.addEventListener('click', () => {
			modal.style.display = 'none'
			this.restart()
		})

		overlay?.addEventListener('click', (e) => {
			if (e.target === overlay) {
				modal.style.display = 'none'
				this.restart()
			}
		})
	}



	// Méthodes pour gérer l'IA
	enableAI(difficulty: AIDifficulty = AIDifficulty.MEDIUM): void
	{
		this.isAIEnabled = true
		this.ai = new AIPlayer(this.config, difficulty)
		console.log(`🤖 AI enabled with difficulty: ${difficulty}`)
	}

	disableAI(): void
	{
		this.isAIEnabled = false
		this.ai = undefined
		console.log('🤖 AI disabled')
	}

	setAIDifficulty(difficulty: AIDifficulty): void
	{
		if (this.ai)
		{
			this.ai.setDifficulty(difficulty)
			console.log(`🤖 AI difficulty set to: ${difficulty}`)
		}
	}

	getState(): GameState
	{
		return { ...this.state }
	}

	getScore(): {left: number; right: number}
	{
		return {
			left: this.state.leftScore,
			right: this.state.rightScore
		}
	}
}
