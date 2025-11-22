import { GameConfig } from './types'
import { Ball } from './Ball'
import { Paddle } from './Paddle'

/**
 * Interface pour la prédiction de trajectoire de la balle
 */
interface BallPrediction {
    x: number
    y: number
    bounces: number
}

/**
 * Niveaux de difficulté de l'IA
 */
export enum AIDifficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard'
}

/**
 * Configuration de l'IA selon la difficulté
 */
interface AIConfig {
    reactionDelay: number      // Délai de réaction en ms
    accuracy: number           // Précision (0-1)
    maxSpeed: number          // Vitesse maximale (0-1)
    predictionError: number   // Marge d'erreur dans la prédiction
    speedIncreaseInterval: number  // Intervalle d'accélération en ms
}

/**
 * Intelligence Artificielle pour le Pong
 * Basée sur la prédiction de trajectoire avec différents niveaux de difficulté
 */
export class AIPlayer {
    private config: GameConfig
    private difficulty: AIDifficulty
    private aiConfig: AIConfig
    private lastUpdateTime: number = 0
    private targetY: number = 0

    constructor(config: GameConfig, difficulty: AIDifficulty = AIDifficulty.MEDIUM) {
        this.config = config
        this.difficulty = difficulty
        this.aiConfig = this.getAIConfig(difficulty)
    }

    /**
     * Obtient la configuration de l'IA selon la difficulté
     */
    private getAIConfig(difficulty: AIDifficulty): AIConfig {
        switch (difficulty) {
            case AIDifficulty.EASY:
                return {
                    reactionDelay: 600,          // Réaction très très lente
                    accuracy: 0.25,              // 25% de précision (rate 75% du temps)
                    maxSpeed: 0.5,               // 50% de la vitesse max
                    predictionError: 200,        // Énorme marge d'erreur
                    speedIncreaseInterval: 30000 // Accélération toutes les 30s
                }
            case AIDifficulty.MEDIUM:
                return {
                    reactionDelay: 250,          // Réaction lente
                    accuracy: 0.6,               // 60% de précision (rate 40% du temps)
                    maxSpeed: 0.7,               // 70% de la vitesse max
                    predictionError: 80,         // Grande marge d'erreur
                    speedIncreaseInterval: 15000 // Accélération toutes les 15s
                }
            case AIDifficulty.HARD:
                return {
                    reactionDelay: 100,          // Réaction rapide
                    accuracy: 0.90,              // 90% de précision
                    maxSpeed: 0.95,              // 95% de la vitesse max
                    predictionError: 25,         // Petite marge d'erreur
                    speedIncreaseInterval: 10000 // Accélération toutes les 10s
                }
        }
    }

    /**
     * Prédit la position Y de la balle quand elle atteindra la raquette
     */
    private predictBallPosition(ball: Ball, paddleX: number): BallPrediction {
        let x = ball.position.x
        let y = ball.position.y
        let vx = ball.velocity.x
        let vy = ball.velocity.y
        let bounces = 0

        // Simuler le mouvement de la balle jusqu'à la raquette
        while ((vx > 0 && x < paddleX) || (vx < 0 && x > paddleX)) {
            // Calculer le temps pour atteindre la raquette ou un mur
            const timeToWall = vy > 0
                ? (this.config.height - y) / vy
                : -y / vy

            const timeToTarget = (paddleX - x) / vx

            if (timeToWall < timeToTarget && timeToWall > 0) {
                // La balle va toucher un mur avant la raquette
                x += vx * timeToWall
                y = vy > 0 ? this.config.height : 0
                vy = -vy  // Rebond
                bounces++
            } else {
                // La balle atteint la raquette
                x = paddleX
                y += vy * timeToTarget
                break
            }
        }

        return { x, y, bounces }
    }

    /**
     * Calcule la direction de mouvement de la raquette
     */
    update(paddle: Paddle, ball: Ball, deltaTime: number): void {
        const currentTime = performance.now()

        // Vérifier le délai de réaction
        if (currentTime - this.lastUpdateTime < this.aiConfig.reactionDelay) {
            return
        }

        this.lastUpdateTime = currentTime

        // Si la balle s'éloigne, revenir au centre
        const isMovingAway = (paddle.position.x > this.config.width / 2 && ball.velocity.x < 0) ||
                             (paddle.position.x < this.config.width / 2 && ball.velocity.x > 0)

        if (isMovingAway) {
            this.targetY = this.config.height / 2
        } else {
            // Prédire où la balle va arriver
            const prediction = this.predictBallPosition(ball, paddle.position.x)

            // Ajouter une erreur aléatoire selon la difficulté
            const error = (Math.random() - 0.5) * this.aiConfig.predictionError
            this.targetY = prediction.y + error

            // Appliquer la précision (parfois l'IA "rate" intentionnellement)
            if (Math.random() > this.aiConfig.accuracy) {
                // En mode facile, l'IA va parfois complètement dans la mauvaise direction
                if (this.difficulty === AIDifficulty.EASY && Math.random() > 0.5) {
                    // Aller à l'opposé de la balle
                    this.targetY = prediction.y > this.config.height / 2
                        ? paddle.height
                        : this.config.height - paddle.height
                } else {
                    // Erreur aléatoire normale
                    this.targetY += (Math.random() - 0.5) * 150
                }
            }
        }

        // Limiter la target dans les limites du jeu
        this.targetY = Math.max(
            paddle.height / 2,
            Math.min(this.config.height - paddle.height / 2, this.targetY)
        )
    }

    /**
     * Déplace la raquette vers la position cible
     */
    movePaddle(paddle: Paddle): void {
        const paddleCenter = paddle.position.y
        const distance = this.targetY - paddleCenter
        const threshold = 10 // Zone morte pour éviter les oscillations

        if (Math.abs(distance) < threshold) {
            paddle.setMoveDirection(0)
            return
        }

        // Appliquer la vitesse maximale selon la difficulté
        if (distance > 0) {
            paddle.setMoveDirection(this.aiConfig.maxSpeed)
        } else {
            paddle.setMoveDirection(-this.aiConfig.maxSpeed)
        }
    }

    /**
     * Change la difficulté de l'IA
     */
    setDifficulty(difficulty: AIDifficulty): void {
        this.difficulty = difficulty
        this.aiConfig = this.getAIConfig(difficulty)
    }

    /**
     * Retourne la difficulté actuelle
     */
    getDifficulty(): AIDifficulty {
        return this.difficulty
    }

    /**
     * Obtient l'intervalle d'accélération en ms
     */
    getSpeedIncreaseInterval(): number {
        return this.aiConfig.speedIncreaseInterval
    }

    /**
     * Réinitialise l'état de l'IA
     */
    reset(): void {
        this.lastUpdateTime = 0
        this.targetY = this.config.height / 2
    }
}
