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

    constructor(canvas: HTMLCanvasElement, aiEnabled: boolean = false, aiDifficulty: AIDifficulty = AIDifficulty.MEDIUM) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not get 2D context')
        this.ctx = ctx

        this.isAIEnabled = aiEnabled

        // Configuration du jeu
        this.config = {
            width: 800,
            height: 500,
            paddleSpeed: 300,
            ballSpeed: 300,
            paddleHeight: 80,
            paddleWidth: 10,
            ballSize: 15
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

        // Initialiser l'IA si activée
        if (this.isAIEnabled) {
            this.ai = new AIPlayer(this.config, aiDifficulty)
            this.speedIncreaseInterval = this.ai.getSpeedIncreaseInterval()
            console.log(`🤖 AI initialized with difficulty: ${aiDifficulty}`)
            console.log(`⚡ Ball will increase speed by 15% every ${this.speedIncreaseInterval / 1000}s`)
        }

        console.log('🏓 Pong game initialized')
    }

    private setupCanvas(): void {
        this.canvas.width = this.config.width
        this.canvas.height = this.config.height
        this.canvas.style.border = '1px dashed #fff'
        this.canvas.style.background = '#000'
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
        's',           // S
        'r'            // R pour restart
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

        // Dessiner la ligne centrale
        this.ctx.strokeStyle = '#fff'
        this.ctx.setLineDash([5, 5])
        this.ctx.beginPath()
        this.ctx.moveTo(this.config.width / 2, 0)
        this.ctx.lineTo(this.config.width / 2, this.config.height)
        this.ctx.stroke()
        this.ctx.setLineDash([])

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
        this.ctx.fillStyle = '#fff'
        this.ctx.font = '35px monospace'
        this.ctx.textAlign = 'center'

        // Score joueur de gauche
        this.ctx.fillText(
            this.state.leftScore.toString(),
            this.config.width / 4,
            60
        )

        // Score joueur de droite
        this.ctx.fillText(
            this.state.rightScore.toString(),
            (this.config.width * 3) / 4,
            60
        )
    }

    private renderMessages(): void {
        this.ctx.fillStyle = '#fff'
        this.ctx.font = '16px monospace'
        this.ctx.textAlign = 'center'

        if (!this.state.isRunning && !this.state.winner) {
            this.ctx.fillText(
                'Press SPACE to start',
                this.config.width / 2,
                this.config.height / 2 + 100
            )

            if (this.isAIEnabled) {
                this.ctx.fillText(
                    'Left: W/S keys - Right: AI',
                    this.config.width / 2,
                    this.config.height / 2 + 120
                )
            } else {
                this.ctx.fillText(
                    'Left: W/S keys - Right: Arrow keys',
                    this.config.width / 2,
                    this.config.height / 2 + 120
                )
            }
        }

        if (this.state.winner) {
            let winner = this.state.winner === 'left' ? 'Player' : 'AI'
            if (!this.isAIEnabled) {
                winner = this.state.winner === 'left' ? 'Left Player' : 'Right Player'
            }
            this.ctx.fillText(
                `🏆 ${winner} Wins!`,
                this.config.width / 2,
                this.config.height / 2 + 100
            )

            this.ctx.fillText(
                'Press R to restart',
                this.config.width / 2,
                this.config.height / 2 + 120
            )
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
            break
        case 'r': // Restart
            if (this.state.winner) {
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
