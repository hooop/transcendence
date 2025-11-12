
// Affiche les données et permet à l'utilisateur d'intéragir

// Comment afficher la liste des joueurs à l'écran
// Où mettre les boutons
// Comment réagir aux clics
// Comment réagir aux clics
// Quand afficher un message d'erreur

// TournamentConfigPage.render()								Retourne le HTML
// TournamentConfigPage.update(manager)							Affiche les données du manager à l'écran
// TournamentConfigPage.setupEventListeners(manager, onUpdate)	Gère les clics

import { TournamentManager }	from '../tournament/TournamentManager'
import tournamentConfigTemplate	from '../templates/tournament-config.html?raw'

export class TournamentConfigPage
{

	// Retourne le HTML statique de la page
	static render(): string
	{
		return tournamentConfigTemplate
	}

	// Met à jour les données dynamiques dans le DOM
	static update(tournamentManager: TournamentManager): void
	{
		const state = tournamentManager.getState()
		const canStart = tournamentManager.canStart()

		// 1. Mettre à jour le compteur de joueurs
const playerCountNumber = document.getElementById('player-count-number')
const playerCountLabel = document.getElementById('player-label')
const playerCountInfo = document.getElementById('player-count-info')

if (playerCountNumber)
{
	playerCountNumber.textContent = state.players.length.toString()
}

// Ajouter le "s" si plus d’un joueur
if (playerCountLabel)
{
	playerCountLabel.textContent = state.players.length > 1 ? 'joueurs' : 'joueur'
}

		// Ajouter la classe valid-count si le nombre est valide
		const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0

		if (playerCountInfo)
		{
			if (isPowerOfTwo(state.players.length) && state.players.length >= 2)
			{
				playerCountInfo.classList.add('valid-count')
			}
			else
			{
				playerCountInfo.classList.remove('valid-count')
			}
		}

		// 2. Mettre à jour la liste des joueurs
		const playersListContent = document.getElementById('players-list-content')

		if (playersListContent)
		{
		// ICI POUR GERER LISTE JOUEUR AJOUTE CONFIG TOURNOI
				playersListContent.innerHTML = state.players.map(player => `
					<div class="player-item">
						<span class="player-alias">├ ${player.alias}</span>
						<button class="btn-remove-player" data-remove-player="${player.id}">✕</button>
					</div>
				`).join('')

		}

		// 3. Mettre à jour les actions (bouton toujours présent, disabled si conditions non remplies)
		const actionsContainer = document.getElementById('tournament-actions-container')
		if (actionsContainer)
		{
			actionsContainer.innerHTML = `
				<button id="start-tournament" class="btn-start-tournament" ${!canStart.canStart ? 'disabled' : ''}>
					Commencer le tournoi
				</button>
			`
		}
	}

	/**
	 * Attache tous les event listeners
	 */
	static setupEventListeners(tournamentManager: TournamentManager, onUpdate: () => void): void
	{
		// Toggle AI
		const aiToggle = document.getElementById('ai-toggle') as HTMLInputElement
		const aiDifficultySelect = document.getElementById('ai-difficulty-select') as HTMLSelectElement
		const playerAliasInput = document.getElementById('player-alias') as HTMLInputElement

		if (aiToggle && aiDifficultySelect)
		{
			aiToggle.addEventListener('change', () => {
				if (aiToggle.checked)
				{
					aiDifficultySelect.disabled = false

					if (playerAliasInput && !playerAliasInput.value.trim())
					{
						playerAliasInput.value = 'AI Player'
					}
				}
				else
				{
					aiDifficultySelect.disabled = true

					if (playerAliasInput && playerAliasInput.value === 'AI Player')
					{
						playerAliasInput.value = ''
					}
				}
			})
		}

		// Soumettre le formulaire
		const addPlayerForm = document.getElementById('add-player-form')

		if (addPlayerForm)
		{
			addPlayerForm.addEventListener('submit', (e) => {
				e.preventDefault()

				const input = document.getElementById('player-alias') as HTMLInputElement
				const isAI = aiToggle?.checked || false

				if (input && input.value.trim())
				{
					let result

					if (isAI)
					{
						// Ajouter une IA
						const difficulty = aiDifficultySelect.value as 'easy' | 'medium' | 'hard'
						result = tournamentManager.addAI(difficulty)
					}
					else
					{
						// Ajouter un joueur humain
						result = tournamentManager.addPlayer(input.value.trim())
					}

					if (result?.success)
					{
						input.value = ''
						if (aiToggle)
						{
							aiToggle.checked = false
							if (aiDifficultySelect)
							{
								aiDifficultySelect.disabled = true
							}
						}
						onUpdate()
					}
					else
					{
						alert(result?.message || 'Failed to add player')
					}
				}
			})
		}

		// Bouton pour démarrer le tournoi
		const startBtn = document.getElementById('start-tournament')
		if (startBtn) {
			startBtn.addEventListener('click', () => {
				if (tournamentManager.startTournament()) {
					onUpdate()
				}
			})
		}

		// Bouton pour reset le tournoi
		const resetBtn = document.getElementById('reset-tournament')

		if (resetBtn)
		{
			resetBtn.addEventListener('click', () => {

				if (confirm('Reset the tournament? All progress will be lost.'))
				{
					tournamentManager.reset()
					onUpdate()
				}
			})
		}

		// Boutons pour supprimer des joueurs
		document.querySelectorAll('[data-remove-player]').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const playerId = (e.target as HTMLElement).getAttribute('data-remove-player')

				if (playerId && tournamentManager.removePlayer(playerId))
				{
					onUpdate()
				}
			})
		})
	}
}
