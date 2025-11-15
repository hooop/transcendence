import { ApiService } from '../services/api';
import { GameSocketService } from '../services/gameSocket';
import { OnlinePongGame } from '../game/OnlinePongGame';

interface Room {
    id: number;
    name: string;
    host: {
        id: number;
        username: string;
    };
    guest: {
        id: number;
        username: string;
    } | null;
    hasPassword: boolean;
    maxScore: number;
    status: 'waiting' | 'playing' | 'finished';
}

interface GameState {
    player1: {
        y: number;
        score: number;
    };
    player2: {
        y: number;
        score: number;
    };
    ball: {
        x: number;
        y: number;
    };
}

export class OnlineGamePage {
    private container: HTMLElement;
    private apiService: ApiService;
    private gameSocketService: GameSocketService;
    private onlinePongGame: OnlinePongGame | null = null;
    private currentRoomId: number | null = null;
    private refreshInterval: number | null = null;
    private isHost: boolean = false;
    private isReady: boolean = false;
    private opponentReady: boolean = false;

    constructor(container: HTMLElement, apiService: ApiService) {
        this.container = container;
        this.apiService = apiService;
        this.gameSocketService = new GameSocketService();
    }

    public async render(): Promise<void> {
        this.container.innerHTML = `
            <div class="online-game-page">
                <div class="page-header">
                    <h1>Online Multiplayer</h1>
                    <button id="refresh-rooms-btn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                <div id="online-game-content">
                    ${this.renderRoomBrowser()}
                </div>
            </div>

            <!-- Create Room Modal -->
            <div id="create-room-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create Room</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="create-room-form">
                            <div class="form-group">
                                <label for="room-name">Room Name *</label>
                                <input
                                    type="text"
                                    id="room-name"
                                    class="form-control"
                                    placeholder="Enter room name"
                                    required
                                    maxlength="50"
                                >
                            </div>
                            <div class="form-group">
                                <label for="room-password">Password (Optional)</label>
                                <input
                                    type="password"
                                    id="room-password"
                                    class="form-control"
                                    placeholder="Leave empty for public room"
                                    maxlength="50"
                                >
                            </div>
                            <div class="form-group">
                                <label for="max-score">Max Score</label>
                                <select id="max-score" class="form-control">
                                    <option value="5">5</option>
                                    <option value="10" selected>10</option>
                                    <option value="15">15</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-create-btn">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Create Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Join Room Password Modal -->
            <div id="join-room-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Enter Password</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="join-room-form">
                            <div class="form-group">
                                <label for="join-password">Room Password</label>
                                <input
                                    type="password"
                                    id="join-password"
                                    class="form-control"
                                    placeholder="Enter room password"
                                    required
                                >
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-join-btn">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Join Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        await this.loadRooms();
        this.startRoomRefresh();
    }

    private renderRoomBrowser(): string {
        return `
            <div class="room-browser">
                <div class="room-browser-header">
                    <h2>Available Rooms</h2>
                    <button id="create-room-btn" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Create Room
                    </button>
                </div>
                <div id="rooms-list" class="rooms-list">
                    <div class="loading">Loading rooms...</div>
                </div>
            </div>
        `;
    }

    private renderRoomsList(rooms: Room[]): string {
        if (rooms.length === 0) {
            return `
                <div class="no-rooms">
                    <i class="fas fa-inbox"></i>
                    <p>No rooms available</p>
                    <p class="text-muted">Create a new room to start playing!</p>
                </div>
            `;
        }

        return `
            <div class="rooms-grid">
                ${rooms.map(room => this.renderRoomCard(room)).join('')}
            </div>
        `;
    }

    private renderRoomCard(room: Room): string {
        const playerCount = room.guest ? '2/2' : '1/2';
        const isFull = room.guest !== null;
        const isPlaying = room.status === 'playing';
        const canJoin = !isFull && !isPlaying;

        return `
            <div class="room-card ${isPlaying ? 'playing' : ''} ${isFull ? 'full' : ''}">
                <div class="room-header">
                    <h3 class="room-name">
                        ${room.name}
                        ${room.hasPassword ? '<i class="fas fa-lock" title="Password protected"></i>' : ''}
                    </h3>
                    <span class="room-status ${room.status}">${room.status}</span>
                </div>
                <div class="room-info">
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <span>Host: ${room.host.username}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span>Players: ${playerCount}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-trophy"></i>
                        <span>Max Score: ${room.maxScore}</span>
                    </div>
                </div>
                <div class="room-actions">
                    ${canJoin ? `
                        <button class="btn btn-primary join-room-btn" data-room-id="${room.id}" data-has-password="${room.hasPassword}">
                            <i class="fas fa-sign-in-alt"></i> Join
                        </button>
                    ` : `
                        <button class="btn btn-secondary" disabled>
                            ${isPlaying ? 'In Progress' : 'Full'}
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    private renderWaitingRoom(room: Room): string {
        const currentUser = this.apiService.getCurrentUser();
        this.isHost = room.host.id === currentUser.id;
        const opponent = this.isHost ? room.guest : room.host;

        return `
            <div class="waiting-room">
                <div class="waiting-room-header">
                    <h2>${room.name}</h2>
                    <button id="leave-room-btn" class="btn btn-danger">
                        <i class="fas fa-sign-out-alt"></i> Leave Room
                    </button>
                </div>
                <div class="room-details">
                    <div class="detail-item">
                        <i class="fas fa-trophy"></i>
                        <span>First to ${room.maxScore} points</span>
                    </div>
                    ${room.hasPassword ? `
                        <div class="detail-item">
                            <i class="fas fa-lock"></i>
                            <span>Password Protected</span>
                        </div>
                    ` : ''}
                </div>
                <div class="players-status">
                    <div class="player-card ${this.isHost ? 'current-user' : ''}">
                        <i class="fas fa-user"></i>
                        <h3>${room.host.username}</h3>
                        <span class="player-role">Host</span>
                        <div class="ready-indicator ${this.isHost && this.isReady ? 'ready' : ''}">
                            ${this.isHost && this.isReady ? '<i class="fas fa-check"></i> Ready' : '<i class="fas fa-clock"></i> Not Ready'}
                        </div>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="player-card ${!this.isHost ? 'current-user' : ''}">
                        ${opponent ? `
                            <i class="fas fa-user"></i>
                            <h3>${opponent.username}</h3>
                            <span class="player-role">Guest</span>
                            <div class="ready-indicator ${!this.isHost && this.isReady ? 'ready' : ''}">
                                ${!this.isHost && this.isReady ? '<i class="fas fa-check"></i> Ready' : '<i class="fas fa-clock"></i> Not Ready'}
                            </div>
                        ` : `
                            <i class="fas fa-user-plus"></i>
                            <h3>Waiting for opponent...</h3>
                            <div class="loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                        `}
                    </div>
                </div>
                <div class="waiting-room-actions">
                    <button id="ready-btn" class="btn btn-primary ${this.isReady ? 'ready' : ''}" ${!opponent ? 'disabled' : ''}>
                        ${this.isReady ? '<i class="fas fa-check"></i> Ready!' : '<i class="fas fa-hand-paper"></i> Ready'}
                    </button>
                </div>
                ${opponent && !this.isReady ? `
                    <div class="info-message">
                        <i class="fas fa-info-circle"></i>
                        Click "Ready" when you're prepared to start the game
                    </div>
                ` : ''}
                ${opponent && this.isReady && !this.opponentReady ? `
                    <div class="info-message">
                        <i class="fas fa-hourglass-half"></i>
                        Waiting for opponent to ready up...
                    </div>
                ` : ''}
            </div>
        `;
    }

    private renderGameCanvas(): string {
        return `
            <div class="game-canvas-container">
                <div class="game-header">
                    <div class="player-info">
                        <h3 id="player1-name">Player 1</h3>
                        <div class="score" id="player1-score">0</div>
                    </div>
                    <div class="game-timer">
                        <i class="fas fa-gamepad"></i>
                        <span>LIVE</span>
                    </div>
                    <div class="player-info">
                        <h3 id="player2-name">Player 2</h3>
                        <div class="score" id="player2-score">0</div>
                    </div>
                </div>
                <div class="canvas-wrapper">
                    <canvas id="game-canvas" width="800" height="600"></canvas>
                </div>
                <div class="game-controls-info">
                    <div class="control-item">
                        <i class="fas fa-keyboard"></i>
                        <span>W/S - Move Paddle Up/Down</span>
                    </div>
                    <div class="control-item">
                        <i class="fas fa-trophy"></i>
                        <span id="max-score-display">First to 10 wins</span>
                    </div>
                </div>
            </div>
        `;
    }

    private renderGameEndScreen(winner: string, finalScore: { player1: number; player2: number }): string {
        const currentUser = this.apiService.getCurrentUser();
        const isWinner = winner === currentUser.username;

        return `
            <div class="game-end-screen">
                <div class="result-container ${isWinner ? 'victory' : 'defeat'}">
                    <div class="result-icon">
                        ${isWinner ? '<i class="fas fa-trophy"></i>' : '<i class="fas fa-frown"></i>'}
                    </div>
                    <h1 class="result-title">
                        ${isWinner ? 'Victory!' : 'Defeat'}
                    </h1>
                    <h2 class="winner-announcement">
                        ${winner} wins!
                    </h2>
                    <div class="final-score">
                        <h3>Final Score</h3>
                        <div class="score-display">
                            <div class="score-item">
                                <span class="score-label" id="end-player1-name">Player 1</span>
                                <span class="score-value">${finalScore.player1}</span>
                            </div>
                            <span class="score-separator">-</span>
                            <div class="score-item">
                                <span class="score-label" id="end-player2-name">Player 2</span>
                                <span class="score-value">${finalScore.player2}</span>
                            </div>
                        </div>
                    </div>
                    <div class="end-actions">
                        <button id="back-to-rooms-btn" class="btn btn-primary">
                            <i class="fas fa-arrow-left"></i> Back to Rooms
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        // Create Room Button
        const createRoomBtn = document.getElementById('create-room-btn');
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
        }

        // Refresh Rooms Button
        const refreshBtn = document.getElementById('refresh-rooms-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRooms());
        }

        // Create Room Modal
        this.setupCreateRoomModal();

        // Join Room Modal
        this.setupJoinRoomModal();

        // Setup WebSocket Event Handlers
        this.setupWebSocketHandlers();
    }

    private setupCreateRoomModal(): void {
        const modal = document.getElementById('create-room-modal') as HTMLElement;
        const closeBtn = modal?.querySelector('.close') as HTMLElement;
        const cancelBtn = document.getElementById('cancel-create-btn');
        const form = document.getElementById('create-room-form') as HTMLFormElement;

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideCreateRoomModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideCreateRoomModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideCreateRoomModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateRoom();
            });
        }
    }

    private setupJoinRoomModal(): void {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        const closeBtn = modal?.querySelector('.close') as HTMLElement;
        const cancelBtn = document.getElementById('cancel-join-btn');
        const form = document.getElementById('join-room-form') as HTMLFormElement;

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideJoinRoomModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideJoinRoomModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideJoinRoomModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleJoinRoomWithPassword();
            });
        }
    }

    private setupWebSocketHandlers(): void {
        // Player joined room
        this.gameSocketService.on('playerJoined', (data: { room: Room }) => {
            if (this.currentRoomId === data.room.id) {
                this.updateWaitingRoom(data.room);
            }
        });

        // Player left room
        this.gameSocketService.on('playerLeft', (data: { room: Room }) => {
            if (this.currentRoomId === data.room.id) {
                this.updateWaitingRoom(data.room);
                this.isReady = false;
                this.opponentReady = false;
            }
        });

        // Player ready status changed
        this.gameSocketService.on('playerReady', (data: { userId: number; ready: boolean }) => {
            const currentUser = this.apiService.getCurrentUser();
            if (data.userId !== currentUser.id) {
                this.opponentReady = data.ready;
                this.updateReadyStatus();
            }
        });

        // Game starting
        this.gameSocketService.on('gameStarting', (data: { room: Room }) => {
            this.startGame(data.room);
        });

        // Game state update
        this.gameSocketService.on('gameState', (data: GameState) => {
            this.updateGameState(data);
        });

        // Game ended
        this.gameSocketService.on('gameEnded', (data: { winner: string; finalScore: { player1: number; player2: number } }) => {
            this.endGame(data.winner, data.finalScore);
        });

        // Opponent disconnected
        this.gameSocketService.on('opponentDisconnected', () => {
            this.handleOpponentDisconnected();
        });

        // Room closed
        this.gameSocketService.on('roomClosed', () => {
            this.handleRoomClosed();
        });
    }

    private async loadRooms(): Promise<void> {
        try {
            const roomsList = document.getElementById('rooms-list');
            if (!roomsList) return;

            const rooms = await this.apiService.getRooms();
            roomsList.innerHTML = this.renderRoomsList(rooms);

            // Add event listeners to join buttons
            const joinButtons = roomsList.querySelectorAll('.join-room-btn');
            joinButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.currentTarget as HTMLElement;
                    const roomId = parseInt(target.getAttribute('data-room-id') || '0');
                    const hasPassword = target.getAttribute('data-has-password') === 'true';
                    this.handleJoinRoom(roomId, hasPassword);
                });
            });
        } catch (error) {
            console.error('Failed to load rooms:', error);
            const roomsList = document.getElementById('rooms-list');
            if (roomsList) {
                roomsList.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load rooms. Please try again.</p>
                    </div>
                `;
            }
        }
    }

    private showCreateRoomModal(): void {
        const modal = document.getElementById('create-room-modal') as HTMLElement;
        if (modal) {
            modal.style.display = 'flex';
            const roomNameInput = document.getElementById('room-name') as HTMLInputElement;
            if (roomNameInput) {
                roomNameInput.focus();
            }
        }
    }

    private hideCreateRoomModal(): void {
        const modal = document.getElementById('create-room-modal') as HTMLElement;
        if (modal) {
            modal.style.display = 'none';
            const form = document.getElementById('create-room-form') as HTMLFormElement;
            if (form) {
                form.reset();
            }
        }
    }

    private showJoinRoomModal(roomId: number): void {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('data-room-id', roomId.toString());
            const passwordInput = document.getElementById('join-password') as HTMLInputElement;
            if (passwordInput) {
                passwordInput.focus();
            }
        }
    }

    private hideJoinRoomModal(): void {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        if (modal) {
            modal.style.display = 'none';
            const form = document.getElementById('join-room-form') as HTMLFormElement;
            if (form) {
                form.reset();
            }
        }
    }

    private async handleCreateRoom(): Promise<void> {
        const roomNameInput = document.getElementById('room-name') as HTMLInputElement;
        const passwordInput = document.getElementById('room-password') as HTMLInputElement;
        const maxScoreSelect = document.getElementById('max-score') as HTMLSelectElement;

        const roomName = roomNameInput.value.trim();
        const password = passwordInput.value.trim();
        const maxScore = parseInt(maxScoreSelect.value);

        if (!roomName) {
            alert('Please enter a room name');
            return;
        }

        try {
            const room = await this.apiService.createRoom({
                name: roomName,
                password: password || undefined,
                maxScore
            });

            this.hideCreateRoomModal();
            this.currentRoomId = room.id;

            // Connect to WebSocket and join room
            await this.gameSocketService.connect();
            this.gameSocketService.joinRoom(room.id);

            // Stop refreshing rooms list
            this.stopRoomRefresh();

            // Show waiting room
            this.showWaitingRoom(room);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room. Please try again.');
        }
    }

    private async handleJoinRoom(roomId: number, hasPassword: boolean): Promise<void> {
        if (hasPassword) {
            this.showJoinRoomModal(roomId);
        } else {
            await this.joinRoom(roomId);
        }
    }

    private async handleJoinRoomWithPassword(): Promise<void> {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        const roomId = parseInt(modal.getAttribute('data-room-id') || '0');
        const passwordInput = document.getElementById('join-password') as HTMLInputElement;
        const password = passwordInput.value.trim();

        if (!password) {
            alert('Please enter the room password');
            return;
        }

        await this.joinRoom(roomId, password);
    }

    private async joinRoom(roomId: number, password?: string): Promise<void> {
        try {
            const room = await this.apiService.joinRoom(roomId, password);

            this.hideJoinRoomModal();
            this.currentRoomId = room.id;

            // Connect to WebSocket and join room
            await this.gameSocketService.connect();
            this.gameSocketService.joinRoom(room.id);

            // Stop refreshing rooms list
            this.stopRoomRefresh();

            // Show waiting room
            this.showWaitingRoom(room);
        } catch (error) {
            console.error('Failed to join room:', error);
            alert('Failed to join room. The password may be incorrect or the room may be full.');
        }
    }

    private showWaitingRoom(room: Room): void {
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderWaitingRoom(room);
            this.setupWaitingRoomListeners();
        }
    }

    private updateWaitingRoom(room: Room): void {
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderWaitingRoom(room);
            this.setupWaitingRoomListeners();
        }
    }

    private setupWaitingRoomListeners(): void {
        const leaveBtn = document.getElementById('leave-room-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.handleLeaveRoom());
        }

        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            readyBtn.addEventListener('click', () => this.handleToggleReady());
        }
    }

    private async handleLeaveRoom(): Promise<void> {
        if (!this.currentRoomId) return;

        try {
            await this.apiService.leaveRoom(this.currentRoomId);
            this.gameSocketService.leaveRoom(this.currentRoomId);
            this.gameSocketService.disconnect();

            this.currentRoomId = null;
            this.isReady = false;
            this.opponentReady = false;

            // Return to room browser
            const content = document.getElementById('online-game-content');
            if (content) {
                content.innerHTML = this.renderRoomBrowser();
            }

            await this.loadRooms();
            this.startRoomRefresh();
        } catch (error) {
            console.error('Failed to leave room:', error);
            alert('Failed to leave room. Please try again.');
        }
    }

    private handleToggleReady(): void {
        if (!this.currentRoomId) return;

        this.isReady = !this.isReady;
        this.gameSocketService.setReady(this.currentRoomId, this.isReady);

        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            if (this.isReady) {
                readyBtn.classList.add('ready');
                readyBtn.innerHTML = '<i class="fas fa-check"></i> Ready!';
            } else {
                readyBtn.classList.remove('ready');
                readyBtn.innerHTML = '<i class="fas fa-hand-paper"></i> Ready';
            }
        }

        this.updateReadyStatus();
    }

    private updateReadyStatus(): void {
        const currentUser = this.apiService.getCurrentUser();
        const hostReadyIndicator = document.querySelector('.player-card:first-child .ready-indicator');
        const guestReadyIndicator = document.querySelector('.player-card:last-child .ready-indicator');

        if (this.isHost) {
            if (hostReadyIndicator) {
                if (this.isReady) {
                    hostReadyIndicator.classList.add('ready');
                    hostReadyIndicator.innerHTML = '<i class="fas fa-check"></i> Ready';
                } else {
                    hostReadyIndicator.classList.remove('ready');
                    hostReadyIndicator.innerHTML = '<i class="fas fa-clock"></i> Not Ready';
                }
            }
            if (guestReadyIndicator) {
                if (this.opponentReady) {
                    guestReadyIndicator.classList.add('ready');
                    guestReadyIndicator.innerHTML = '<i class="fas fa-check"></i> Ready';
                } else {
                    guestReadyIndicator.classList.remove('ready');
                    guestReadyIndicator.innerHTML = '<i class="fas fa-clock"></i> Not Ready';
                }
            }
        } else {
            if (guestReadyIndicator) {
                if (this.isReady) {
                    guestReadyIndicator.classList.add('ready');
                    guestReadyIndicator.innerHTML = '<i class="fas fa-check"></i> Ready';
                } else {
                    guestReadyIndicator.classList.remove('ready');
                    guestReadyIndicator.innerHTML = '<i class="fas fa-clock"></i> Not Ready';
                }
            }
            if (hostReadyIndicator) {
                if (this.opponentReady) {
                    hostReadyIndicator.classList.add('ready');
                    hostReadyIndicator.innerHTML = '<i class="fas fa-check"></i> Ready';
                } else {
                    hostReadyIndicator.classList.remove('ready');
                    hostReadyIndicator.innerHTML = '<i class="fas fa-clock"></i> Not Ready';
                }
            }
        }
    }

    private startGame(room: Room): void {
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderGameCanvas();

            // Set player names
            const currentUser = this.apiService.getCurrentUser();
            const player1Name = document.getElementById('player1-name');
            const player2Name = document.getElementById('player2-name');

            if (this.isHost) {
                if (player1Name) player1Name.textContent = currentUser.username;
                if (player2Name && room.guest) player2Name.textContent = room.guest.username;
            } else {
                if (player1Name) player1Name.textContent = room.host.username;
                if (player2Name) player2Name.textContent = currentUser.username;
            }

            // Update max score display
            const maxScoreDisplay = document.getElementById('max-score-display');
            if (maxScoreDisplay) {
                maxScoreDisplay.textContent = `First to ${room.maxScore} wins`;
            }

            // Initialize game
            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
            if (canvas) {
                this.onlinePongGame = new OnlinePongGame(
                    canvas,
                    this.gameSocketService,
                    this.currentRoomId!,
                    this.isHost
                );
                this.onlinePongGame.start();
            }
        }
    }

    private updateGameState(state: GameState): void {
        // Update score display
        const player1Score = document.getElementById('player1-score');
        const player2Score = document.getElementById('player2-score');

        if (player1Score) player1Score.textContent = state.player1.score.toString();
        if (player2Score) player2Score.textContent = state.player2.score.toString();

        // Update game if it exists
        if (this.onlinePongGame) {
            this.onlinePongGame.updateState(state);
        }
    }

    private async endGame(winner: string, finalScore: { player1: number; player2: number }): Promise<void> {
        // Stop the game
        if (this.onlinePongGame) {
            this.onlinePongGame.stop();
            this.onlinePongGame = null;
        }

        // Save match to database
        if (this.currentRoomId) {
            try {
                const currentUser = this.apiService.getCurrentUser();
                await this.apiService.saveMatch({
                    roomId: this.currentRoomId,
                    winner: winner,
                    player1Score: finalScore.player1,
                    player2Score: finalScore.player2
                });
            } catch (error) {
                console.error('Failed to save match:', error);
            }
        }

        // Show end screen
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderGameEndScreen(winner, finalScore);

            // Set player names on end screen
            if (this.currentRoomId) {
                const player1NameElem = document.getElementById('end-player1-name');
                const player2NameElem = document.getElementById('end-player2-name');
                // These would be set based on the room data
            }

            const backBtn = document.getElementById('back-to-rooms-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => this.handleBackToRooms());
            }
        }
    }

    private async handleBackToRooms(): Promise<void> {
        // Leave room and disconnect
        if (this.currentRoomId) {
            try {
                await this.apiService.leaveRoom(this.currentRoomId);
                this.gameSocketService.leaveRoom(this.currentRoomId);
            } catch (error) {
                console.error('Failed to leave room:', error);
            }
        }

        this.gameSocketService.disconnect();
        this.currentRoomId = null;
        this.isReady = false;
        this.opponentReady = false;

        // Return to room browser
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderRoomBrowser();
        }

        await this.loadRooms();
        this.startRoomRefresh();
    }

    private handleOpponentDisconnected(): void {
        if (this.onlinePongGame) {
            this.onlinePongGame.stop();
            this.onlinePongGame = null;
        }

        alert('Your opponent has disconnected. Returning to room browser.');
        this.handleBackToRooms();
    }

    private handleRoomClosed(): void {
        if (this.onlinePongGame) {
            this.onlinePongGame.stop();
            this.onlinePongGame = null;
        }

        alert('The room has been closed. Returning to room browser.');
        this.handleBackToRooms();
    }

    private startRoomRefresh(): void {
        // Refresh rooms every 5 seconds
        this.refreshInterval = window.setInterval(() => {
            this.loadRooms();
        }, 5000);
    }

    private stopRoomRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    public destroy(): void {
        // Clean up
        this.stopRoomRefresh();

        if (this.onlinePongGame) {
            this.onlinePongGame.stop();
            this.onlinePongGame = null;
        }

        if (this.currentRoomId) {
            this.gameSocketService.leaveRoom(this.currentRoomId);
        }

        this.gameSocketService.disconnect();

        this.container.innerHTML = '';
    }

    // Static methods for router compatibility
    private static instance: OnlineGamePage | null = null;

    public static render(): string {
        return `
            <div id="online-game-container" class="online-game-wrapper"></div>
        `;
    }

    public static setupEventListeners(): void {
        const container = document.getElementById('online-game-container');
        if (!container) {
            console.error('Online game container not found');
            return;
        }

        // Clean up previous instance
        if (this.instance) {
            this.instance.destroy();
        }

        // Create new instance
        this.instance = new OnlineGamePage(container as HTMLElement, ApiService);
        this.instance.render();
    }
}
