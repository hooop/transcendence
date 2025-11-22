import { GameSocketService, GameState as NetworkGameState, GameConfig } from '../services/gameSocket';

export class OnlinePongGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private gameSocket: GameSocketService;
    private config!: GameConfig;
    private playerSide: 'left' | 'right' | null = null;

    private gameState: NetworkGameState = {
        ball: { x: 400, y: 225, vx: 0, vy: 0 },
        leftPaddle: { y: 175 },
        rightPaddle: { y: 175 },
        leftScore: 0,
        rightScore: 0,
        winner: null
    };

    private keys: Set<string> = new Set();
    private animationFrame: number = 0;
    private isGameStarted: boolean = false;

    public onGameEnd?: (winner: 'left' | 'right', winnerId: string, winnerUsername: string, finalScore: { left: number; right: number }) => void;
    public onOpponentLeft?: () => void;

    constructor(canvas: HTMLCanvasElement, gameSocket: GameSocketService) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;
        this.gameSocket = gameSocket;

        // Get config from gameSocket if already connected
        const existingConfig = this.gameSocket.getConfig();
        const existingPlayerSide = this.gameSocket.getPlayerSide();

        if (existingConfig && existingPlayerSide) {
            this.playerSide = existingPlayerSide;
            this.config = existingConfig;
            this.canvas.width = existingConfig.width;
            this.canvas.height = existingConfig.height;
            this.render();
        }

        this.setupControls();
    }

    // Public methods to be called by OnlineGamePage when socket events occur
    public handleGameStart(): void {
        this.isGameStarted = true;
        this.startGameLoop();
    }

    public updateGameState(state: NetworkGameState): void {
        this.gameState = state;
    }

    public handleGameEnd(winner: 'left' | 'right', winnerId: string, winnerUsername: string, finalScore: { left: number; right: number }): void {
        this.isGameStarted = false;
        this.stopGameLoop();
        if (this.onGameEnd) {
            this.onGameEnd(winner, winnerId, winnerUsername, finalScore);
        }
    }

    public handleOpponentDisconnection(): void {
        this.isGameStarted = false;
        this.stopGameLoop();
        if (this.onOpponentLeft) {
            this.onOpponentLeft();
        }
    }

    private setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key);
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key);
        });
    }

    private startGameLoop() {
        const gameLoop = () => {
            this.handleInput();
            this.render();

            if (this.isGameStarted) {
                this.animationFrame = requestAnimationFrame(gameLoop);
            }
        };
        gameLoop();
    }

    private stopGameLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    private handleInput() {
        if (!this.config || !this.playerSide) return;

        const myPaddle = this.playerSide === 'left' ? this.gameState.leftPaddle : this.gameState.rightPaddle;
        let newY = myPaddle.y;

        // Contrôles pour le joueur local
        if (this.playerSide === 'left') {
            if (this.keys.has('w') || this.keys.has('W')) {
                newY -= this.config.paddleSpeed * (1/60);
            }
            if (this.keys.has('s') || this.keys.has('S')) {
                newY += this.config.paddleSpeed * (1/60);
            }
        } else {
            if (this.keys.has('ArrowUp')) {
                newY -= this.config.paddleSpeed * (1/60);
            }
            if (this.keys.has('ArrowDown')) {
                newY += this.config.paddleSpeed * (1/60);
            }
        }

        // Limiter la position
        newY = Math.max(0, Math.min(this.config.height - this.config.paddleHeight, newY));

        // Envoyer au serveur si changé
        if (newY !== myPaddle.y) {
            this.gameSocket.updatePaddle(newY);
        }
    }

    private render() {
        if (!this.config) return;

        // Clear - fond noir pur comme le mode entraînement
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Ligne centrale - blanche comme le mode entraînement
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;
        const centerX = Math.floor(this.canvas.width / 2) + 0.5;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.restore();

        // Paddles - blancs comme le mode entraînement
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(0, this.gameState.leftPaddle.y, this.config.paddleWidth, this.config.paddleHeight);
        this.ctx.fillRect(
            this.canvas.width - this.config.paddleWidth,
            this.gameState.rightPaddle.y,
            this.config.paddleWidth,
            this.config.paddleHeight
        );

        // Balle - blanche
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(this.gameState.ball.x, this.gameState.ball.y, this.config.ballSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Scores
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(String(this.gameState.leftScore), this.canvas.width / 4, 60);
        this.ctx.fillText(String(this.gameState.rightScore), (this.canvas.width * 3) / 4, 60);

        // Contrôles
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#888';
        this.ctx.textAlign = 'left';
        if (this.playerSide === 'left') {
            this.ctx.fillText('W / S to move', 20, this.canvas.height - 20);
        }
        this.ctx.textAlign = 'right';
        if (this.playerSide === 'right') {
            this.ctx.fillText('↑ / ↓ to move', this.canvas.width - 20, this.canvas.height - 20);
        }
    }

    cleanup() {
        this.stopGameLoop();
        this.keys.clear();
    }
}
