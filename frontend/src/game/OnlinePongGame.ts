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

        // Event handlers du socket
        this.gameSocket.onConnected = (playerSide, config) => {
            this.playerSide = playerSide;
            this.config = config;
            this.canvas.width = config.width;
            this.canvas.height = config.height;
            this.render();
        };

        this.gameSocket.onGameStart = () => {
            this.isGameStarted = true;
            this.startGameLoop();
        };

        this.gameSocket.onGameState = (state) => {
            this.gameState = state;
        };

        this.gameSocket.onGameEnd = (winner, winnerId, winnerUsername, finalScore) => {
            this.isGameStarted = false;
            this.stopGameLoop();
            if (this.onGameEnd) {
                this.onGameEnd(winner, winnerId, winnerUsername, finalScore);
            }
        };

        this.gameSocket.onOpponentLeft = () => {
            this.isGameStarted = false;
            this.stopGameLoop();
            if (this.onOpponentLeft) {
                this.onOpponentLeft();
            }
        };

        this.setupControls();
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

        // Clear
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Ligne centrale
        this.ctx.strokeStyle = '#16213e';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Paddle gauche
        this.ctx.fillStyle = this.playerSide === 'left' ? '#00d4ff' : '#ff006e';
        this.ctx.fillRect(0, this.gameState.leftPaddle.y, this.config.paddleWidth, this.config.paddleHeight);

        // Paddle droit
        this.ctx.fillStyle = this.playerSide === 'right' ? '#00d4ff' : '#ff006e';
        this.ctx.fillRect(
            this.canvas.width - this.config.paddleWidth,
            this.gameState.rightPaddle.y,
            this.config.paddleWidth,
            this.config.paddleHeight
        );

        // Balle
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.gameState.ball.x, this.gameState.ball.y, this.config.ballSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Scores
        this.ctx.fillStyle = '#ffffff';
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
