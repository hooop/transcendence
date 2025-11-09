import { Vector2D, GameConfig } from './types'

export class Paddle {
    public position: Vector2D
    public width: number
    public height: number
    private moveDirection: number = 0

    constructor(
        private config: GameConfig,
        startPosition: Vector2D
    ) {
        this.position = { ...startPosition }
        this.width = config.paddleWidth
        this.height = config.paddleHeight
    }

    // Contrôle du mouvement
    setMoveDirection(direction: number): void {
        // direction: -1 (haut), 0 (stop), 1 (bas)
        this.moveDirection = Math.max(-1, Math.min(1, direction))
    }

    update(deltaTime: number): void {
        if (this.moveDirection === 0) return

        // Calculer la nouvelle position
        const newY = this.position.y + (this.moveDirection * this.config.paddleSpeed * deltaTime)

        // Limiter aux bords de l'écran
        const minY = this.height / 2
        const maxY = this.config.height - this.height / 2

        this.position.y = Math.max(minY, Math.min(maxY, newY))
    }

	// Remet la position des raquettes par défaut
	reset(): void {
	this.position.y = this.config.height / 2
	this.moveDirection = 0
	}

    // Collision avec la balle
    checkCollision(ballPosition: Vector2D, ballSize: number): boolean {
        const ballRadius = ballSize / 2
        const paddleLeft = this.position.x - this.width / 2
        const paddleRight = this.position.x + this.width / 2
        const paddleTop = this.position.y - this.height / 2
        const paddleBottom = this.position.y + this.height / 2

        return (
            ballPosition.x - ballRadius < paddleRight &&
            ballPosition.x + ballRadius > paddleLeft &&
            ballPosition.y - ballRadius < paddleBottom &&
            ballPosition.y + ballRadius > paddleTop
        )
    }

    render(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = '#fff'
        ctx.fillRect(
            this.position.x - this.width / 2,
            this.position.y - this.height / 2,
            this.width,
            this.height
        )
    }
}
