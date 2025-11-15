class GameRoom {
  constructor(roomId, creatorId, creatorUsername, roomName, password = null, maxScore = 5) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.password = password;
    this.maxScore = maxScore;
    this.isPrivate = !!password;
    this.status = 'waiting'; // waiting, playing, finished

    // Players
    this.creator = { id: creatorId, username: creatorUsername, socket: null, ready: false };
    this.opponent = null;

    // Game state
    this.gameState = {
      ball: { x: 400, y: 225, vx: 200, vy: 150 },
      leftPaddle: { y: 175 },
      rightPaddle: { y: 175 },
      leftScore: 0,
      rightScore: 0,
      winner: null
    };

    // Game config
    this.config = {
      width: 800,
      height: 450,
      paddleSpeed: 300,
      ballSpeed: 300,
      paddleHeight: 100,
      paddleWidth: 10,
      ballSize: 10
    };

    // Game loop
    this.gameInterval = null;
    this.lastUpdate = Date.now();

    this.createdAt = Date.now();
  }

  // Vérifier le mot de passe
  verifyPassword(password) {
    if (!this.password) return true;
    return this.password === password;
  }

  // Ajouter un joueur
  addPlayer(playerId, username, socket) {
    if (this.opponent) return false;

    this.opponent = { id: playerId, username, socket, ready: false };
    return true;
  }

  // Retirer un joueur
  removePlayer(playerId) {
    if (this.opponent && this.opponent.id === playerId) {
      this.opponent = null;
      this.stopGame();
      return true;
    }
    return false;
  }

  // Marquer un joueur comme prêt
  setPlayerReady(playerId, ready) {
    if (this.creator.id === playerId) {
      this.creator.ready = ready;
    } else if (this.opponent && this.opponent.id === playerId) {
      this.opponent.ready = ready;
    }

    // Si les deux joueurs sont prêts, démarrer le jeu
    if (this.creator.ready && this.opponent && this.opponent.ready && this.status === 'waiting') {
      this.startGame();
    }
  }

  // Démarrer le jeu
  startGame() {
    this.status = 'playing';
    this.resetBall();

    // Boucle de jeu à 60 FPS
    this.gameInterval = setInterval(() => {
      this.updateGame();
    }, 1000 / 60);

    this.broadcast({ type: 'GAME_START', gameState: this.gameState });
  }

  // Arrêter le jeu
  stopGame() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    this.status = 'waiting';
    this.creator.ready = false;
    if (this.opponent) this.opponent.ready = false;
  }

  // Réinitialiser la balle
  resetBall() {
    this.gameState.ball.x = this.config.width / 2;
    this.gameState.ball.y = this.config.height / 2;

    // Direction aléatoire
    const angle = (Math.random() - 0.5) * Math.PI / 3;
    const direction = Math.random() < 0.5 ? 1 : -1;
    this.gameState.ball.vx = Math.cos(angle) * this.config.ballSpeed * direction;
    this.gameState.ball.vy = Math.sin(angle) * this.config.ballSpeed;
  }

  // Mettre à jour le jeu
  updateGame() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Déplacer la balle
    this.gameState.ball.x += this.gameState.ball.vx * deltaTime;
    this.gameState.ball.y += this.gameState.ball.vy * deltaTime;

    // Collision avec les murs haut/bas
    if (this.gameState.ball.y <= this.config.ballSize / 2 ||
        this.gameState.ball.y >= this.config.height - this.config.ballSize / 2) {
      this.gameState.ball.vy *= -1;
      this.gameState.ball.y = Math.max(this.config.ballSize / 2,
                                       Math.min(this.config.height - this.config.ballSize / 2, this.gameState.ball.y));
    }

    // Collision avec paddle gauche
    if (this.gameState.ball.x <= this.config.paddleWidth + this.config.ballSize / 2 &&
        this.gameState.ball.y >= this.gameState.leftPaddle.y &&
        this.gameState.ball.y <= this.gameState.leftPaddle.y + this.config.paddleHeight) {
      this.gameState.ball.vx = Math.abs(this.gameState.ball.vx);
      this.gameState.ball.x = this.config.paddleWidth + this.config.ballSize / 2;

      // Ajuster l'angle en fonction de où la balle frappe le paddle
      const hitPos = (this.gameState.ball.y - this.gameState.leftPaddle.y) / this.config.paddleHeight;
      this.gameState.ball.vy = (hitPos - 0.5) * this.config.ballSpeed * 1.5;
    }

    // Collision avec paddle droit
    if (this.gameState.ball.x >= this.config.width - this.config.paddleWidth - this.config.ballSize / 2 &&
        this.gameState.ball.y >= this.gameState.rightPaddle.y &&
        this.gameState.ball.y <= this.gameState.rightPaddle.y + this.config.paddleHeight) {
      this.gameState.ball.vx = -Math.abs(this.gameState.ball.vx);
      this.gameState.ball.x = this.config.width - this.config.paddleWidth - this.config.ballSize / 2;

      const hitPos = (this.gameState.ball.y - this.gameState.rightPaddle.y) / this.config.paddleHeight;
      this.gameState.ball.vy = (hitPos - 0.5) * this.config.ballSpeed * 1.5;
    }

    // Points marqués
    if (this.gameState.ball.x <= 0) {
      this.gameState.rightScore++;
      this.checkWinner();
      if (this.status === 'playing') this.resetBall();
    } else if (this.gameState.ball.x >= this.config.width) {
      this.gameState.leftScore++;
      this.checkWinner();
      if (this.status === 'playing') this.resetBall();
    }

    // Broadcast game state
    this.broadcast({ type: 'GAME_STATE', gameState: this.gameState });
  }

  // Vérifier s'il y a un gagnant
  checkWinner() {
    if (this.gameState.leftScore >= this.maxScore) {
      this.gameState.winner = 'left';
      this.endGame();
    } else if (this.gameState.rightScore >= this.maxScore) {
      this.gameState.winner = 'right';
      this.endGame();
    }
  }

  // Terminer le jeu
  endGame() {
    this.stopGame();
    this.status = 'finished';

    const winnerId = this.gameState.winner === 'left' ? this.creator.id : this.opponent.id;
    const winnerUsername = this.gameState.winner === 'left' ? this.creator.username : this.opponent.username;

    this.broadcast({
      type: 'GAME_END',
      winner: this.gameState.winner,
      winnerId,
      winnerUsername,
      finalScore: {
        left: this.gameState.leftScore,
        right: this.gameState.rightScore
      }
    });
  }

  // Mettre à jour la position du paddle
  updatePaddle(playerId, y) {
    if (this.status !== 'playing') return;

    // Limiter la position du paddle
    y = Math.max(0, Math.min(this.config.height - this.config.paddleHeight, y));

    if (this.creator.id === playerId) {
      this.gameState.leftPaddle.y = y;
    } else if (this.opponent && this.opponent.id === playerId) {
      this.gameState.rightPaddle.y = y;
    }
  }

  // Envoyer un message à tous les joueurs
  broadcast(message) {
    if (this.creator.socket) {
      this.creator.socket.send(JSON.stringify(message));
    }
    if (this.opponent && this.opponent.socket) {
      this.opponent.socket.send(JSON.stringify(message));
    }
  }

  // Obtenir les infos publiques de la room
  getPublicInfo() {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      isPrivate: this.isPrivate,
      hasPassword: !!this.password,
      status: this.status,
      playerCount: this.opponent ? 2 : 1,
      maxPlayers: 2,
      creator: {
        id: this.creator.id,
        username: this.creator.username
      },
      opponent: this.opponent ? {
        id: this.opponent.id,
        username: this.opponent.username
      } : null,
      createdAt: this.createdAt
    };
  }

  // Nettoyer la room
  cleanup() {
    this.stopGame();
  }
}

module.exports = GameRoom;
