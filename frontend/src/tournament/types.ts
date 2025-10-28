export interface Player {
    id: string
    alias: string
    joinedAt: Date
    isAI?: boolean
    aiDifficulty?: 'easy' | 'medium' | 'hard'
}

export interface Match {
    id: string
    player1: Player
    player2: Player
    winner: Player | null
    score: {
        player1: number
        player2: number
    }
    status: 'pending' | 'playing' | 'completed'
    round: number
}

export interface TournamentState {
    id: string
    name: string
    players: Player[]
    matches: Match[]
    currentMatch: Match | null
    status: 'registration' | 'ready' | 'ongoing' | 'completed'
    winner: Player | null
    maxPlayers: number
}

export interface TournamentConfig {
    maxPlayers: number
    minPlayers: number
    name: string
}