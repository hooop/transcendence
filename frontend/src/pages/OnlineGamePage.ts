import { ApiService } from '../services/api';
import { GameSocketService } from '../services/gameSocket';
import { OnlinePongGame } from '../game/OnlinePongGame';
import { i18n } from '../services/i18n';

interface Room {
    roomId: string;
    roomName: string;
    creator: {
        id: string;
        username: string;
    };
    opponent: {
        id: string;
        username: string;
    } | null;
    hasPassword: boolean;
    maxScore: number;
    status: 'waiting' | 'playing' | 'finished';
}

export class OnlineGamePage {
    private container: HTMLElement;
    private gameSocketService: GameSocketService;
    private onlinePongGame: OnlinePongGame | null = null;
    private currentRoomId: string | null = null;
    private currentRoom: Room | null = null;
    private refreshInterval: number | null = null;
    private isHost: boolean = false;
    private isReady: boolean = false;
    private opponentReady: boolean = false;

    constructor(container: HTMLElement) {
        this.container = container;
        this.gameSocketService = new GameSocketService();
    }

    public async render(): Promise<void> {
        this.container.innerHTML = `
            <div class="online-game-page">
                <div class="page-header">
                    <h1>${i18n.t('online.title', 'Multijoueur en ligne')}</h1>
                    <button id="refresh-rooms-btn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> ${i18n.t('online.refresh', 'Actualiser')}
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
                        <h2>${i18n.t('online.createRoomModal', 'Créer une salle')}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="create-room-form">
                            <div class="form-group">
                                <label for="room-name">${i18n.t('online.roomName', 'Nom de la salle *')}</label>
                                <input
                                    type="text"
                                    id="room-name"
                                    class="form-control"
                                    placeholder="${i18n.t('online.enterRoomName', 'Entrez le nom de la salle')}"
                                    required
                                    maxlength="50"
                                >
                            </div>
                            <div class="form-group">
                                <label for="room-password">${i18n.t('online.password', 'Mot de passe (Optionnel)')}</label>
                                <input
                                    type="password"
                                    id="room-password"
                                    class="form-control"
                                    placeholder="${i18n.t('online.leaveEmptyPublic', 'Laissez vide pour une salle publique')}"
                                    maxlength="50"
                                >
                            </div>
                            <div class="form-group">
                                <label for="max-score">${i18n.t('online.maxScore', 'Score maximal')}</label>
                                <select id="max-score" class="form-control">
                                    <option value="5">5</option>
                                    <option value="10" selected>10</option>
                                    <option value="15">15</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-create-btn">
                                    ${i18n.t('online.cancel', 'Annuler')}
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    ${i18n.t('online.create', 'Créer une salle')}
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
                        <h2>${i18n.t('online.roomPassword', 'Mot de passe de la salle')}</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="join-room-form">
                            <div class="form-group">
                                <label for="join-password">${i18n.t('online.roomPassword', 'Mot de passe de la salle')}</label>
                                <input
                                    type="password"
                                    id="join-password"
                                    class="form-control"
                                    placeholder="${i18n.t('online.enterRoomPassword', 'Entrez le mot de passe de la salle')}"
                                    required
                                >
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-join-btn">
                                    ${i18n.t('online.cancel', 'Annuler')}
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    ${i18n.t('online.join', 'Rejoindre une salle')}
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
                    <h2>${i18n.t('online.availableRooms', 'Salles disponibles')}</h2>
                    <button id="create-room-btn" class="btn btn-primary">
                        <i class="fas fa-plus"></i> ${i18n.t('online.createRoom', 'Créer une salle')}
                    </button>
                </div>
                <div id="rooms-list" class="rooms-list">
                    <div class="loading">${i18n.t('online.loadingRooms', 'Chargement des salles...')}</div>
                </div>
            </div>
        `;
    }

    private renderRoomsList(rooms: Room[]): string {
        if (rooms.length === 0) {
            return `
                <div class="no-rooms">
                    <i class="fas fa-inbox"></i>
                    <p>${i18n.t('online.noRoomsAvailable', 'Aucune salle disponible')}</p>
                    <p class="text-muted">${i18n.t('online.createRoomHelp', 'Créez une nouvelle salle pour commencer à jouer!')}</p>
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
        const playerCount = room.opponent ? '2/2' : '1/2';
        const isFull = room.opponent !== null;
        const isPlaying = room.status === 'playing';
        const canJoin = !isFull && !isPlaying;

        return `
            <div class="room-card ${isPlaying ? 'playing' : ''} ${isFull ? 'full' : ''}">
                <div class="room-header">
                    <h3 class="room-name">
                        ${room.roomName}
                        ${room.hasPassword ? '<i class="fas fa-lock" title="Password protected"></i>' : ''}
                    </h3>
                    <span class="room-status ${room.status}">${room.status}</span>
                </div>
                <div class="room-info">
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <span>${i18n.t('online.host', 'Hôte')}: ${room.creator.username}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span>Players: ${playerCount}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-trophy"></i>
                        <span>${i18n.t('online.maxScore', 'Score maximal')}: ${room.maxScore}</span>
                    </div>
                </div>
                <div class="room-actions">
                    ${canJoin ? `
                        <button class="btn btn-primary join-room-btn" data-room-id="${room.roomId}" data-has-password="${room.hasPassword}">
                            <i class="fas fa-sign-in-alt"></i> ${i18n.t('online.join', 'Rejoindre une salle')}
                        </button>
                    ` : `
                        <button class="btn btn-secondary" disabled>
                            ${isPlaying ? i18n.t('online.inProgress', 'En cours') : i18n.t('online.full', 'Pleine')}
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    private renderWaitingRoom(room: Room): string {
        const userStr = localStorage.getItem('user');
        if (!userStr) return '';
        const currentUser = JSON.parse(userStr);

        this.isHost = room.creator.id === currentUser.id;
        const opponent = this.isHost ? room.opponent : room.creator;

        return `
            <div class="waiting-room">
                <div class="waiting-room-header">
                    <h2>${room.roomName}</h2>
                    <button id="leave-room-btn" class="btn btn-danger">
                        <i class="fas fa-sign-out-alt"></i> ${i18n.t('online.leaveRoom', 'Quitter la salle')}
                    </button>
                </div>
                <div class="room-details">
                    <div class="detail-item">
                        <i class="fas fa-trophy"></i>
                        <span>${i18n.t('online.firstToPoints', `Premier à ${room.maxScore} points`)}</span>
                    </div>
                    ${room.hasPassword ? `
                        <div class="detail-item">
                            <i class="fas fa-lock"></i>
                            <span>${i18n.t('online.passwordProtected', 'Protégée par un mot de passe')}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="players-status">
                    <div class="player-card ${this.isHost ? 'current-user' : ''}">
                        <i class="fas fa-user"></i>
                        <h3>${room.creator.username}</h3>
                        <span class="player-role">${i18n.t('online.host', 'Hôte')}</span>
                        <div class="ready-indicator ${this.isHost && this.isReady ? 'ready' : ''}">
                            ${this.isHost && this.isReady ? `<i class="fas fa-check"></i> ${i18n.t('online.ready', 'Prêt')}` : `<i class="fas fa-clock"></i> ${i18n.t('online.notReady', 'Non prêt')}`}
                        </div>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="player-card ${!this.isHost ? 'current-user' : ''}">
                        ${opponent ? `
                            <i class="fas fa-user"></i>
                            <h3>${opponent.username}</h3>
                            <span class="player-role">${i18n.t('online.guest', 'Invité')}</span>
                            <div class="ready-indicator ${!this.isHost && this.isReady ? 'ready' : ''}">
                                ${!this.isHost && this.isReady ? `<i class="fas fa-check"></i> ${i18n.t('online.ready', 'Prêt')}` : `<i class="fas fa-clock"></i> ${i18n.t('online.notReady', 'Non prêt')}`}
                            </div>
                        ` : `
                            <i class="fas fa-user-plus"></i>
                            <h3>${i18n.t('online.waitingForOpponent', 'En attente de l\'adversaire...')}</h3>
                            <div class="loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                        `}
                    </div>
                </div>
                <div class="waiting-room-actions">
                    <button id="ready-btn" class="btn btn-primary ${this.isReady ? 'ready' : ''}" ${!opponent ? 'disabled' : ''}>
                        ${this.isReady ? `<i class="fas fa-check"></i> ${i18n.t('online.ready', 'Prêt')}!` : `<i class="fas fa-hand-paper"></i> ${i18n.t('online.ready', 'Prêt')}`}
                    </button>
                </div>
                ${opponent && !this.isReady ? `
                    <div class="info-message">
                        <i class="fas fa-info-circle"></i>
                        ${i18n.t('online.readyMessage', 'Cliquez sur "Prêt" lorsque vous êtes prêt à commencer le jeu')}
                    </div>
                ` : ''}
                ${opponent && this.isReady && !this.opponentReady ? `
                    <div class="info-message">
                        <i class="fas fa-hourglass-half"></i>
                        ${i18n.t('online.waitingForOpponentReady', 'En attente que l\'adversaire soit prêt...')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    private renderGameCanvas(): string {
        return `
            <div class="game-canvas-container">
                <canvas id="game-canvas" width="800" height="450"></canvas>
            </div>
        `;
    }

    private renderGameEndScreen(winner: string, finalScore: { left: number; right: number }): string {
        const userStr = localStorage.getItem('user');
        if (!userStr) return '';
        const currentUser = JSON.parse(userStr);
        const isWinner = winner === currentUser.username;

        return `
            <div class="game-end-screen">
                <div class="result-container ${isWinner ? 'victory' : 'defeat'}">
                    <div class="result-icon">
                        ${isWinner ? '<i class="fas fa-trophy"></i>' : '<i class="fas fa-frown"></i>'}
                    </div>
                    <h1 class="result-title">
                        ${isWinner ? i18n.t('online.victory', 'Victoire !') : i18n.t('online.defeat', 'Défaite')}
                    </h1>
                    <h2 class="winner-announcement">
                        ${i18n.t('online.wins', `${winner} gagne !`)}
                    </h2>
                    <div class="final-score">
                        <h3>${i18n.t('online.finalScore', 'Score final')}</h3>
                        <div class="score-display">
                            <div class="score-item">
                                <span class="score-label" id="end-player1-name">${i18n.t('online.player1', 'Joueur 1')}</span>
                                <span class="score-value">${finalScore.left}</span>
                            </div>
                            <span class="score-separator">-</span>
                            <div class="score-item">
                                <span class="score-label" id="end-player2-name">${i18n.t('online.player2', 'Joueur 2')}</span>
                                <span class="score-value">${finalScore.right}</span>
                            </div>
                        </div>
                    </div>
                    <div class="end-actions">
                        <button id="back-to-rooms-btn" class="btn btn-primary">
                            <i class="fas fa-arrow-left"></i> ${i18n.t('online.backToRooms', 'Retour aux salles')}
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
        // Room updated (player joined/left)
        this.gameSocketService.onRoomUpdate = (room: Room) => {
            if (this.currentRoomId === room.roomId) {
                this.currentRoom = room;
                this.updateWaitingRoom(room);
            }
        };

        // Player ready status changed
        this.gameSocketService.onPlayerReady = (playerId: string, ready: boolean) => {
            const userStr = localStorage.getItem('user');
            if (!userStr) return;
            const currentUser = JSON.parse(userStr);

            if (playerId !== currentUser.id) {
                this.opponentReady = ready;
                this.updateReadyStatus();
            }
        };

        // Game starting
        this.gameSocketService.onGameStart = () => {
            if (this.currentRoom) {
                this.startGame(this.currentRoom);
            }
            if (this.onlinePongGame) {
                this.onlinePongGame.handleGameStart();
            }
        };

        // Game state update
        this.gameSocketService.onGameState = (state) => {
            if (this.onlinePongGame) {
                this.onlinePongGame.updateGameState(state);
            }
        };

        // Game ended
        this.gameSocketService.onGameEnd = (_winner, _winnerId, winnerUsername, finalScore) => {
            if (this.onlinePongGame) {
                this.onlinePongGame.handleGameEnd(_winner, _winnerId, winnerUsername, finalScore);
            }
        };

        // Opponent disconnected
        this.gameSocketService.onOpponentLeft = () => {
            if (this.onlinePongGame) {
                this.onlinePongGame.handleOpponentDisconnection();
            } else {
                this.handleOpponentDisconnected();
            }
        };
    }

    private async loadRooms(): Promise<void> {
        try {
            const roomsList = document.getElementById('rooms-list');
            if (!roomsList) return;

            const response = await ApiService.getRooms();
            const rooms: Room[] = response.rooms || [];
            roomsList.innerHTML = this.renderRoomsList(rooms);

            // Add event listeners to join buttons
            const joinButtons = roomsList.querySelectorAll('.join-room-btn');
            joinButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.currentTarget as HTMLElement;
                    const roomId = target.getAttribute('data-room-id') || '';
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

    private showJoinRoomModal(roomId: string): void {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('data-room-id', roomId);
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
            const response = await ApiService.createRoom({
                name: roomName,
                password: password || undefined,
                maxScore
            });

            this.hideCreateRoomModal();
            this.currentRoomId = response.roomId;
            this.currentRoom = response.room;

            // Connect to WebSocket and join room
            await this.gameSocketService.connect();
            this.gameSocketService.joinRoom(response.roomId);

            // Stop refreshing rooms list
            this.stopRoomRefresh();

            // Show waiting room
            this.showWaitingRoom(response.room);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room. Please try again.');
        }
    }

    private async handleJoinRoom(roomId: string, hasPassword: boolean): Promise<void> {
        if (hasPassword) {
            this.showJoinRoomModal(roomId);
        } else {
            await this.joinRoom(roomId);
        }
    }

    private async handleJoinRoomWithPassword(): Promise<void> {
        const modal = document.getElementById('join-room-modal') as HTMLElement;
        const roomId = modal.getAttribute('data-room-id') || '';
        const passwordInput = document.getElementById('join-password') as HTMLInputElement;
        const password = passwordInput.value.trim();

        if (!password) {
            alert('Please enter the room password');
            return;
        }

        await this.joinRoom(roomId, password);
    }

    private async joinRoom(roomId: string, password?: string): Promise<void> {
        try {
            const response = await ApiService.joinRoom(roomId, password);

            this.hideJoinRoomModal();
            this.currentRoomId = response.roomId;
            this.currentRoom = response.room;

            // Connect to WebSocket and join room
            await this.gameSocketService.connect();
            this.gameSocketService.joinRoom(response.roomId);

            // Stop refreshing rooms list
            this.stopRoomRefresh();

            // Show waiting room
            this.showWaitingRoom(response.room);
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
            await ApiService.leaveRoom(this.currentRoomId);
            this.gameSocketService.leaveRoom();
            this.gameSocketService.disconnect();

            this.currentRoomId = null;
            this.currentRoom = null;
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
        this.gameSocketService.setReady(this.isReady);

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
        // Enable fullscreen game mode
        document.body.classList.add('fullscreen-game');

        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderGameCanvas();

            // Initialize game
            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
            if (canvas) {
                this.onlinePongGame = new OnlinePongGame(canvas, this.gameSocketService);

                // Setup game end handler
                this.onlinePongGame.onGameEnd = (_winner, _winnerId, winnerUsername, finalScore) => {
                    this.endGame(winnerUsername, finalScore);
                };

                this.onlinePongGame.onOpponentLeft = () => {
                    this.handleOpponentDisconnected();
                };
            }
        }
    }

    private async endGame(winner: string, finalScore: { left: number; right: number }): Promise<void> {
        // Disable fullscreen game mode
        document.body.classList.remove('fullscreen-game');

        // Stop the game
        if (this.onlinePongGame) {
            this.onlinePongGame.cleanup();
            this.onlinePongGame = null;
        }

        // Show end screen
        const content = document.getElementById('online-game-content');
        if (content) {
            content.innerHTML = this.renderGameEndScreen(winner, finalScore);

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
                await ApiService.leaveRoom(this.currentRoomId);
                this.gameSocketService.leaveRoom();
            } catch (error) {
                console.error('Failed to leave room:', error);
            }
        }

        this.gameSocketService.disconnect();
        this.currentRoomId = null;
        this.currentRoom = null;
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
        // Disable fullscreen game mode
        document.body.classList.remove('fullscreen-game');

        if (this.onlinePongGame) {
            this.onlinePongGame.cleanup();
            this.onlinePongGame = null;
        }

        alert('Your opponent has disconnected. Returning to room browser.');
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
        // Disable fullscreen game mode
        document.body.classList.remove('fullscreen-game');

        // Clean up
        this.stopRoomRefresh();

        if (this.onlinePongGame) {
            this.onlinePongGame.cleanup();
            this.onlinePongGame = null;
        }

        if (this.currentRoomId) {
            this.gameSocketService.leaveRoom();
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
        this.instance = new OnlineGamePage(container as HTMLElement);
        this.instance.render();
    }
}
