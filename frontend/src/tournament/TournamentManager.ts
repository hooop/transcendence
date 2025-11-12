/*
* Gère la logique pure d'un tournoi :

* ajouter/retirer un joueur
* Savoir si on peut démarrer le tournoi (règles : 2, 4, 8 joueurs)
* Comment générer les matchs
* Qui joue contre qui
* Qui a gagné
* L'état actuel du tournoi (registration, ready, ongoing, completed)
*/

import { TournamentState, TournamentConfig, Player, Match } from './types'
import { PongGame } from '../game/PongGame'


export class TournamentManager {
    private state: TournamentState
    private config: TournamentConfig
    private currentGame: PongGame | null = null

    constructor(config: TournamentConfig) {
        this.config = config
        this.state = {
            id: this.generateId(),
            name: config.name,
            players: [],
            matches: [],
            currentMatch: null,
            status: 'registration',
            winner: null,
            maxPlayers: config.maxPlayers
        }

        console.log(`🏆 Tournament "${config.name}" created`)
    }

    private generateId(): string {
        return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Gestion des joueurs
    addPlayer(alias: string): { success: boolean; message: string; player?: Player } {
        // Vérifications
        if (this.state.status !== 'registration') {
            return { success: false, message: 'Registration is closed' }
        }

        if (this.state.players.length >= this.config.maxPlayers) {
            return { success: false, message: 'Tournament is full' }
        }

        if (this.state.players.some(p => p.alias.toLowerCase() === alias.toLowerCase())) {
            return { success: false, message: 'This alias is already taken' }
        }

        if (alias.trim().length < 2) {
            return { success: false, message: 'Alias must be at least 2 characters' }
        }

        // Créer le joueur
        const player: Player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            alias: alias.trim(),
            joinedAt: new Date()
        }

        this.state.players.push(player)
        console.log(`👤 Player "${alias}" joined the tournament`)

        return { success: true, message: 'Player added successfully', player }
    }

    removePlayer(playerId: string): boolean {
        if (this.state.status !== 'registration') return false

        const index = this.state.players.findIndex(p => p.id === playerId)
        if (index === -1) return false

        const player = this.state.players[index]
        this.state.players.splice(index, 1)
        console.log(`👤 Player "${player.alias}" left the tournament`)

        return true
    }

    // Ajouter une IA au tournoi
    addAI(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): { success: boolean; message: string; player?: Player } {
        if (this.state.status !== 'registration') {
            return { success: false, message: 'Registration is closed' }
        }

        if (this.state.players.length >= this.config.maxPlayers) {
            return { success: false, message: 'Tournament is full' }
        }

        // Compter le nombre d'IA déjà présentes
        const aiCount = this.state.players.filter(p => p.isAI).length
        const difficultyLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
        const alias = `AI ${difficultyLabels[difficulty]} #${aiCount + 1}`

        const player: Player = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            alias,
            joinedAt: new Date(),
            isAI: true,
            aiDifficulty: difficulty
        }

        this.state.players.push(player)
        console.log(`🤖 AI "${alias}" joined the tournament`)

        return { success: true, message: 'AI added successfully', player }
    }

    // Vérifier si un nombre est une puissance de 2
    private isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0
    }

    // Obtenir la prochaine puissance de 2
    private getNextPowerOfTwo(n: number): number {
        let power = 1
        while (power < n) {
            power *= 2
        }
        return power
    }

    // Gestion du tournoi
    canStart(): { canStart: boolean; reason?: string } {
        if (this.state.players.length < this.config.minPlayers) {
            return {
                canStart: false,
                reason: `Au moins ${this.config.minPlayers} joueurs (currently ${this.state.players.length})`
            }
        }

        // Vérifier que le nombre de joueurs est une puissance de 2 (2, 4, 8, 16, etc.)
        if (!this.isPowerOfTwo(this.state.players.length)) {
            const nextValid = this.getNextPowerOfTwo(this.state.players.length)
            const prevValid = nextValid / 2
            return {
                canStart: false,
                reason: `Need 2, 4, 8, 16... players. Add ${prevValid - this.state.players.length} or ${nextValid - this.state.players.length} more players (currently ${this.state.players.length})`
            }
        }

        if (this.state.status !== 'registration') {
            return { canStart: false, reason: 'Tournament already started or completed' }
        }

        return { canStart: true }
    }

    startTournament(): boolean {
        const check = this.canStart()
        if (!check.canStart) {
            console.error('Cannot start tournament:', check.reason)
            return false
        }

        // Générer les matchs
        this.generateMatches()
        this.state.status = 'ready'

        console.log(`🚀 Tournament started with ${this.state.players.length} players`)
        return true
    }

    private generateMatches(): void {
        const players = [...this.state.players]

        // Mélanger les joueurs pour plus de fairness
        this.shuffleArray(players)

        // Créer les matchs du premier tour
        this.state.matches = []
        let round = 1

        for (let i = 0; i < players.length; i += 2) {
            if (i + 1 < players.length) {
                const match: Match = {
                    id: `match_${round}_${(i / 2) + 1}`,
                    player1: players[i],
                    player2: players[i + 1],
                    winner: null,
                    score: { player1: 0, player2: 0 },
                    status: 'pending',
                    round
                }
                this.state.matches.push(match)
            }
        }

        // Si nombre impair de joueurs, le dernier passe automatiquement au tour suivant
        if (players.length % 2 === 1) {
            const bye = players[players.length - 1]
            console.log(`👤 ${bye.alias} gets a bye to the next round`)
        }
    }

    private shuffleArray<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
        }
    }

    // Matchmaking
    getNextMatch(): Match | null {
        return this.state.matches.find(m => m.status === 'pending') || null
    }

    startMatch(matchId: string): Match | null {
        const match = this.state.matches.find(m => m.id === matchId)
        if (!match || match.status !== 'pending') return null

        match.status = 'playing'
        this.state.currentMatch = match
        this.state.status = 'ongoing'

        console.log(`🏓 Match started: ${match.player1.alias} vs ${match.player2.alias}`)
        return match
    }

    endMatch(matchId: string, winnerId: string, score: { player1: number; player2: number }): boolean {
        const match = this.state.matches.find(m => m.id === matchId)
        if (!match || match.status !== 'playing') return false

        // Déterminer le gagnant
        const winner = match.player1.id === winnerId ? match.player1 : match.player2
        match.winner = winner
        match.score = score
        match.status = 'completed'
        this.state.currentMatch = null

        console.log(`🏆 Match completed: ${winner.alias} wins ${score.player1}-${score.player2}`)

        // Vérifier si le tournoi est terminé
        this.checkTournamentCompletion()

        return true
    }

    private checkTournamentCompletion(): void {
        const pendingMatches = this.state.matches.filter(m => m.status === 'pending')
        const playingMatches = this.state.matches.filter(m => m.status === 'playing')

        if (pendingMatches.length === 0 && playingMatches.length === 0) {
            // Tous les matchs du round actuel sont terminés
            const currentRound = Math.max(...this.state.matches.map(m => m.round))
            const currentRoundMatches = this.state.matches.filter(m => m.round === currentRound)
            const winners = currentRoundMatches
                .filter(m => m.status === 'completed' && m.winner)
                .map(m => m.winner!)

            console.log(`Round ${currentRound} completed. Winners: ${winners.length}`)

            // Si un seul gagnant, c'est le champion du tournoi
            if (winners.length === 1) {
                this.state.winner = winners[0]
                this.state.status = 'completed'
                console.log(`🏆 Tournament completed! Winner: ${this.state.winner?.alias}`)
            } else if (winners.length >= 2) {
                // Générer le prochain tour
                this.generateNextRound()
            } else {
                // Erreur : aucun gagnant ?
                console.error('No winners found!')
                this.state.status = 'completed'
            }
        } else {
            this.state.status = 'ready' // Prêt pour le prochain match
        }
    }

    private generateNextRound(): void {
        // Obtenir seulement les gagnants du round actuel
        const currentRound = Math.max(...this.state.matches.map(m => m.round))
        const currentRoundMatches = this.state.matches.filter(m => m.round === currentRound)
        const winners = currentRoundMatches
            .filter(m => m.status === 'completed' && m.winner)
            .map(m => m.winner!)

        if (winners.length < 2) {
            // Plus assez de joueurs, le tournoi est terminé
            this.state.winner = winners[0] || null
            this.state.status = 'completed'
            console.log(`🏆 Tournament completed! Winner: ${this.state.winner?.alias}`)
            return
        }

        const nextRound = currentRound + 1

        // Créer les matchs du prochain tour
        for (let i = 0; i < winners.length; i += 2) {
            if (i + 1 < winners.length) {
                const match: Match = {
                    id: `match_${nextRound}_${(i / 2) + 1}`,
                    player1: winners[i],
                    player2: winners[i + 1],
                    winner: null,
                    score: { player1: 0, player2: 0 },
                    status: 'pending',
                    round: nextRound
                }
                this.state.matches.push(match)
            }
        }

        this.state.status = 'ready'
        console.log(`🔄 Round ${nextRound} generated with ${Math.floor(winners.length / 2)} matches`)
    }

    // Getters
    getState(): TournamentState {
        return { ...this.state }
    }

    getPlayers(): Player[] {
        return [...this.state.players]
    }

    getMatches(): Match[] {
        return [...this.state.matches]
    }

    getRounds(): number {
        if (this.state.matches.length === 0) return 0
        return Math.max(...this.state.matches.map(m => m.round))
    }

    getMatchesForRound(round: number): Match[] {
        return this.state.matches.filter(m => m.round === round)
    }

    reset(): void {
        this.state = {
            id: this.generateId(),
            name: this.config.name,
            players: [],
            matches: [],
            currentMatch: null,
            status: 'registration',
            winner: null,
            maxPlayers: this.config.maxPlayers
        }

        if (this.currentGame) {
            this.currentGame.destroy()
            this.currentGame = null
        }

        console.log('🔄 Tournament reset')
    }
}
