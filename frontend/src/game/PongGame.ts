import { GameConfig, GameState } from './types'
import { Ball } from './Ball'
import { Paddle } from './Paddle'
import { AIPlayer, AIDifficulty } from './AIPlayer'

export class PongGame {
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

	/* private statusElement: HTMLElement | null = null */

	public onStatusChange?: (message: string, isWinner: boolean) => void

    constructor(canvas: HTMLCanvasElement, aiEnabled: boolean = false, aiDifficulty: AIDifficulty = AIDifficulty.MEDIUM)
	{
		this.canvas = canvas
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Could not get 2D context')
		this.ctx = ctx

		this.isAIEnabled = aiEnabled

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
		this.config = {
			width: width,
			height: height,
			paddleSpeed: 300,
			ballSpeed: 300,
			paddleHeight: 100,
			paddleWidth: 10,
			ballSize: 20
		}

		// État initial
		this.state = {
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
		if (this.isAIEnabled) {
			this.ai = new AIPlayer(this.config, aiDifficulty)
			this.speedIncreaseInterval = this.ai.getSpeedIncreaseInterval()
			console.log(`🤖 AI initialized with difficulty: ${aiDifficulty}`)
			console.log(`⚡ Ball will increase speed by 15% every ${this.speedIncreaseInterval / 1000}s`)
		}

		this.render()
		console.log('🏓 Pong game initialized')
	}

private setupCanvas(): void {
    // Juste définir la taille initiale du canvas
    const container = this.canvas.parentElement
    if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        this.canvas.width = container.clientWidth
        this.canvas.height = container.clientHeight
    } else {
        this.canvas.width = this.config.width
        this.canvas.height = this.config.height
    }

    // Style du canvas
    this.canvas.style.border = '0px'
    this.canvas.style.background = '#000'

    // Écouter les changements de taille de fenêtre
    window.addEventListener('resize', () => this.resizeCanvas())
}
private resizeCanvas(): void {
    // Récupérer la taille du container
    const container = this.canvas.parentElement
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Mettre à jour la taille du canvas
    this.canvas.width = width
    this.canvas.height = height

    // Mettre à jour la config du jeu
    this.config.width = width
    this.config.height = height

    // Repositionner les éléments du jeu SEULEMENT s'ils existent
    if (this.ball) {
        this.ball.position.x = width / 2
        this.ball.position.y = height / 2
    }

    if (this.leftPaddle) {
        this.leftPaddle.position.x = 30
        this.leftPaddle.position.y = height / 2
    }

    if (this.rightPaddle) {
        this.rightPaddle.position.x = width - 30
        this.rightPaddle.position.y = height / 2
    }

    // IMPORTANT : Rafraîchir l'affichage
    if (!this.state.isRunning && this.ball && this.leftPaddle && this.rightPaddle) {
        this.render()
    }
}

    private initializeGameObjects(): void {
        // Créer la balle au centre
        this.ball = new Ball(this.config, {
            x: this.config.width / 2,
            y: this.config.height / 2
        })

        // Créer les raquettes
        this.leftPaddle = new Paddle(this.config, {
            x: 30,
            y: this.config.height / 2
        })

        this.rightPaddle = new Paddle(this.config, {
            x: this.config.width - 30,
            y: this.config.height / 2
        })
    }

    private setupEventListeners(): void {
    // Écouter les touches du clavier pour le mouvement
    document.addEventListener('keydown', (e) => {
        // Empêcher le comportement par défaut pour les touches de jeu
        if (this.isGameKey(e.key)) {
            e.preventDefault()
        }
        this.keys.add(e.key.toLowerCase())
    })

    document.addEventListener('keyup', (e) => {
        // Empêcher le comportement par défaut pour les touches de jeu
        if (this.isGameKey(e.key)) {
            e.preventDefault()
        }
        this.keys.delete(e.key.toLowerCase())
    })

    // Ajouter les contrôles de jeu DÈS LE DÉBUT (pas seulement au start)
    document.addEventListener('keydown', this.handleGameControls)

    // S'assurer que le canvas peut recevoir le focus
    this.canvas.tabIndex = 0
    this.canvas.style.outline = 'none'
}

// Ajouter cette nouvelle méthode pour identifier les touches de jeu :
    private isGameKey(key: string): boolean {
    const gameKeys = [
        ' ',           // Espace
        'arrowup',     // Flèche haut
        'arrowdown',   // Flèche bas
        'w',           // W
        's'
    ]
    return gameKeys.includes(key.toLowerCase())
}

    private handleInput(): void {
    // Joueur de gauche (W/S)
    if (this.keys.has('w') || this.keys.has('W')) {
        this.leftPaddle.setMoveDirection(-1)
    } else if (this.keys.has('s') || this.keys.has('S')) {
        this.leftPaddle.setMoveDirection(1)
    } else {
        this.leftPaddle.setMoveDirection(0)
    }

    // Joueur de droite (Flèches haut/bas) - Seulement si l'IA n'est pas activée
    if (!this.isAIEnabled) {
        // Vérifier plusieurs variantes pour la compatibilité
        if (this.keys.has('arrowup') || this.keys.has('ArrowUp') || this.keys.has('Up')) {
            this.rightPaddle.setMoveDirection(-1)
        } else if (this.keys.has('arrowdown') || this.keys.has('ArrowDown') || this.keys.has('Down')) {
            this.rightPaddle.setMoveDirection(1)
        } else {
            this.rightPaddle.setMoveDirection(0)
        }
    }
}

    private update(deltaTime: number): void {
        if (!this.state.isRunning) return

        this.handleInput()

        // Mettre à jour l'IA si activée
        if (this.isAIEnabled && this.ai) {
            this.ai.update(this.rightPaddle, this.ball, deltaTime)
            this.ai.movePaddle(this.rightPaddle)

            // Gérer l'accélération progressive de la balle
            const currentTime = performance.now()
            if (currentTime - this.lastSpeedIncrease >= this.speedIncreaseInterval) {
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

    private checkPaddleCollisions(): void {
        // Collision avec la raquette de gauche
        if (this.ball.velocity.x < 0 &&
            this.leftPaddle.checkCollision(this.ball.position, this.ball.size)) {
            this.ball.velocity.x = -this.ball.velocity.x

            // Ajouter un effet selon la position sur la raquette
            const paddleCenter = this.leftPaddle.position.y
            const hitPosition = (this.ball.position.y - paddleCenter) / (this.leftPaddle.height / 2)
            this.ball.velocity.y += hitPosition * 100 // Effet
        }

        // Collision avec la raquette de droite
        if (this.ball.velocity.x > 0 &&
            this.rightPaddle.checkCollision(this.ball.position, this.ball.size)) {
            this.ball.velocity.x = -this.ball.velocity.x

            const paddleCenter = this.rightPaddle.position.y
            const hitPosition = (this.ball.position.y - paddleCenter) / (this.rightPaddle.height / 2)
            this.ball.velocity.y += hitPosition * 100
        }
    }

    private checkScoring(): void {
        const outOfBounds = this.ball.isOutOfBounds()

        if (outOfBounds === 'left') {
            // Point pour le joueur de droite
            this.state.rightScore++
            this.ball.reset()
            this.ball.resetSpeed() // Réinitialiser la vitesse après un point
            if (this.isAIEnabled) {
                this.lastSpeedIncrease = performance.now() // Réinitialiser le timer
            }
            console.log(`Score: ${this.state.leftScore} - ${this.state.rightScore}`)
        } else if (outOfBounds === 'right') {
            // Point pour le joueur de gauche
            this.state.leftScore++
            this.ball.reset()
            this.ball.resetSpeed() // Réinitialiser la vitesse après un point
            if (this.isAIEnabled) {
                this.lastSpeedIncrease = performance.now() // Réinitialiser le timer
            }
            console.log(`Score: ${this.state.leftScore} - ${this.state.rightScore}`)
        }
    }

    private checkWinCondition(): void {
        const winScore = 5 // Premier à 5 points

        if (this.state.leftScore >= winScore) {
            this.state.winner = 'left'
            this.state.isRunning = false
            console.log('Left player wins!')
        } else if (this.state.rightScore >= winScore) {
            this.state.winner = 'right'
            this.state.isRunning = false
            console.log('🏆 Right player wins!')
        }
    }

    private render(): void {
    // Effacer l'écran
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.config.width, this.config.height)

    // 🎯 LIGNE CENTRALE OPTIMISÉE
    this.ctx.save() // Sauvegarder l'état du contexte

    // Désactiver l'antialiasing pour les lignes
    this.ctx.imageSmoothingEnabled = false

    // Calculer la position exacte au pixel près
    const centerX = Math.floor(this.config.width / 2) + 0.5 // Le +0.5 est crucial !

    this.ctx.strokeStyle = '#fff'
    this.ctx.lineWidth = 2 // Ligne de 2px pour être bien visible
/*     this.ctx.setLineDash([5, 5]) // Pointillés proportionnels à la nouvelle taille */

    this.ctx.beginPath()
    this.ctx.moveTo(centerX, 0)
    this.ctx.lineTo(centerX, this.config.height)
    this.ctx.stroke()

    this.ctx.setLineDash([]) // Réinitialiser
    this.ctx.restore() // Restaurer l'état du contexte

    // Dessiner les objets du jeu
    this.leftPaddle.render(this.ctx)
    this.rightPaddle.render(this.ctx)
    this.ball.render(this.ctx)

    // Dessiner le score
    this.renderScore()

    // Dessiner les messages
    this.renderMessages()
}

private renderScore(): void {
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
}

	// MESSAGE BARRE DE CONTROLE
   private renderMessages(): void
{
    const statusElement = document.getElementById('game-status')
    const controlsElement = document.getElementById('game-controls')

    if (!statusElement || !controlsElement) {
        console.warn('game-status or game-controls element not found')
        return
    }

    // Commandes (toujours affichées à droite)
    const controls = this.isAIEnabled
        ? '<kbd>W</kbd> <kbd>S</kbd>'
        : '<kbd>W</kbd> <kbd>S</kbd> &nbsp;&nbsp; <kbd>↑</kbd> <kbd>↓</kbd>'

    controlsElement.innerHTML = `
        <span class="controls-text"><kbd>Espace</kbd> &nbsp; ${controls}</span>
    `

    // Messages dynamiques (centrés)
    if (!this.state.isRunning && !this.state.winner) {
        statusElement.innerHTML = `
            <span class="status-message"></span>
        `
    }
    else if (this.state.winner) {
        let winner = this.state.winner === 'left' ? 'Joueur de gauche' : 'Joueur de droite'
        if (this.isAIEnabled && this.state.winner === 'right') {
            winner = 'IA'
        }
        statusElement.innerHTML = `
            <span class="status-message winner-message">${winner} a gagné !</span>
        `
    }
    else {
        statusElement.innerHTML = `
            <span class="status-message">Partie en cours</span>
        `
    }
}

    private gameLoop = (currentTime: number): void => {
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
    start(): void {
        if (this.state.isRunning) return

        this.state.isRunning = true
        this.lastTime = performance.now()

        // Initialiser le timer d'accélération si IA activée
        if (this.isAIEnabled) {
            this.lastSpeedIncrease = performance.now()
        }

        this.gameLoop(this.lastTime)

        console.log('🚀 Game started!')
    }

destroy(): void {
    this.stop()

    // Nettoyer tous les listeners
    document.removeEventListener('keydown', this.handleGameControls)
    window.removeEventListener('resize', () => this.resizeCanvas())  // NOUVEAU

    console.log('🧹 Game destroyed')
}

    private handleGameControls = (e: KeyboardEvent): void => {
    // Empêcher le comportement par défaut
    if (this.isGameKey(e.key)) {
        e.preventDefault()
    }

    switch (e.key.toLowerCase()) {
        case ' ': // Espace
            if (!this.state.isRunning && !this.state.winner) {
                this.start()
			}
			else if (this.state.winner) {
                this.restart()
            }
            break
    }
}

    stop(): void {
        this.state.isRunning = false
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }
        console.log('⏹️ Game stopped')
    }

    restart(): void {
        this.stop()

        // Reset du state
        this.state = {
            leftScore: 0,
            rightScore: 0,
            isRunning: false,
            winner: null
        }

        // Reset des objets
        this.ball.reset()
        this.ball.resetSpeed() // Réinitialiser la vitesse de la balle

        // Reset de l'IA et du timer d'accélération si activée
        if (this.ai) {
            this.ai.reset()
            this.lastSpeedIncrease = 0
        }

        this.render() // Afficher l'état initial

        console.log('🔄 Game reset')
    }

    // Méthodes pour gérer l'IA
    enableAI(difficulty: AIDifficulty = AIDifficulty.MEDIUM): void {
        this.isAIEnabled = true
        this.ai = new AIPlayer(this.config, difficulty)
        console.log(`🤖 AI enabled with difficulty: ${difficulty}`)
    }

    disableAI(): void {
        this.isAIEnabled = false
        this.ai = undefined
        console.log('🤖 AI disabled')
    }

    setAIDifficulty(difficulty: AIDifficulty): void {
        if (this.ai) {
            this.ai.setDifficulty(difficulty)
            console.log(`🤖 AI difficulty set to: ${difficulty}`)
        }
    }

    getState(): GameState {
        return { ...this.state }
    }

    getScore(): { left: number; right: number } {
        return {
            left: this.state.leftScore,
            right: this.state.rightScore
        }
    }
}
