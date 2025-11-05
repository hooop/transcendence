export interface Vector2D {
    x: number
    y: number
}

export interface GameConfig {
    width: number
    height: number
    paddleSpeed: number
    ballSpeed: number
    paddleHeight: number
    paddleWidth: number
    ballSize: number
}

export interface GameState {
    leftScore: number
    rightScore: number
    isRunning: boolean
    winner: 'left' | 'right' | null
}
