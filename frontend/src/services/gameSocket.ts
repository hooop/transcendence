import { ApiService } from './api';

export interface GameState {
    ball: { x: number; y: number; vx: number; vy: number };
    leftPaddle: { y: number };
    rightPaddle: { y: number };
    leftScore: number;
    rightScore: number;
    winner: 'left' | 'right' | null;
}

export interface GameConfig {
    width: number;
    height: number;
    paddleSpeed: number;
    ballSpeed: number;
    paddleHeight: number;
    paddleWidth: number;
    ballSize: number;
}

export class GameSocketService {
    private ws: WebSocket | null = null;
    private roomId: string | null = null;
    private playerSide: 'left' | 'right' | null = null;
    private config: GameConfig | null = null;

    // Event handlers
    public onGameStart?: () => void;
    public onGameState?: (state: GameState) => void;
    public onGameEnd?: (winner: 'left' | 'right', winnerId: string, winnerUsername: string, finalScore: { left: number; right: number }) => void;
    public onPlayerReady?: (playerId: string, ready: boolean) => void;
    public onRoomUpdate?: (room: any) => void;
    public onOpponentLeft?: (playerId: string) => void;
    public onError?: (error: string) => void;
    public onConnected?: (playerSide: 'left' | 'right', config: GameConfig) => void;

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const WS_URL = 'ws://localhost:3000/api/game/ws';
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                // Authentifier avec JWT
                const token = ApiService.getToken();
                if (token) {
                    this.send({ type: 'AUTH', token });
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);

                    if (message.type === 'AUTH_SUCCESS') {
                        resolve();
                    } else if (message.type === 'AUTH_ERROR') {
                        reject(new Error(message.error));
                    }
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
            };
        });
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'JOINED_ROOM':
                this.roomId = message.roomId;
                this.playerSide = message.playerSide;
                this.config = message.gameConfig;
                if (this.onConnected) {
                    this.onConnected(message.playerSide, message.gameConfig);
                }
                break;

            case 'GAME_START':
                if (this.onGameStart) {
                    this.onGameStart();
                }
                break;

            case 'GAME_STATE':
                if (this.onGameState) {
                    this.onGameState(message.gameState);
                }
                break;

            case 'GAME_END':
                if (this.onGameEnd) {
                    this.onGameEnd(message.winner, message.winnerId, message.winnerUsername, message.finalScore);
                }
                break;

            case 'PLAYER_READY':
                if (this.onPlayerReady) {
                    this.onPlayerReady(message.playerId, message.ready);
                }
                break;

            case 'ROOM_UPDATE':
                if (this.onRoomUpdate) {
                    this.onRoomUpdate(message.room);
                }
                break;

            case 'OPPONENT_LEFT':
                if (this.onOpponentLeft) {
                    this.onOpponentLeft(message.playerId);
                }
                break;

            case 'ERROR':
                console.error('Game error:', message.error);
                if (this.onError) {
                    this.onError(message.error);
                }
                break;
        }
    }

    joinRoom(roomId: string) {
        this.send({ type: 'JOIN_ROOM', roomId });
    }

    setReady(ready: boolean) {
        this.send({ type: 'READY', ready });
    }

    updatePaddle(y: number) {
        this.send({ type: 'PADDLE_MOVE', y });
    }

    leaveRoom() {
        this.send({ type: 'LEAVE_ROOM' });
    }

    private send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    getPlayerSide(): 'left' | 'right' | null {
        return this.playerSide;
    }

    getRoomId(): string | null {
        return this.roomId;
    }

    getConfig(): GameConfig | null {
        return this.config;
    }
}
