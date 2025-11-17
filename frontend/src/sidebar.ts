import { ApiService } from './services/api'

export class Sidebar {
    private sidebar: HTMLElement | null = null
    private overlay: HTMLElement | null = null
    private closeBtn: HTMLElement | null = null
    private avatarBtn: HTMLElement | null = null
	private avatarElement: HTMLElement | null = null
	private usernameElement: HTMLElement | null = null
	private emailElement: HTMLElement | null = null
	private avatarWrapper: HTMLElement | null = null
	private avatarInput: HTMLInputElement | null = null
	private deleteAvatarBtn: HTMLElement | null = null
	private displayNameInput: HTMLInputElement | null = null
	private saveDisplayNameBtn: HTMLElement | null = null
	private logoutLink: HTMLElement | null = null

	constructor()
	{
		this.sidebar = document.getElementById('user-sidebar')
		this.overlay = document.getElementById('sidebar-overlay')
		this.closeBtn = document.getElementById('sidebar-close')
		this.avatarBtn = document.getElementById('header-user-avatar')
		this.avatarElement = document.getElementById('sidebar-avatar')
		this.usernameElement = document.getElementById('sidebar-username')
		this.emailElement = document.getElementById('sidebar-email')
		this.avatarWrapper = document.querySelector('.sidebar-avatar-wrapper')
		this.avatarInput = document.getElementById('sidebar-avatar-input') as HTMLInputElement
		this.deleteAvatarBtn = document.getElementById('sidebar-delete-avatar')
		this.deleteAvatarBtn = document.getElementById('sidebar-delete-avatar')
		this.displayNameInput = document.getElementById('sidebar-display-name') as HTMLInputElement
		this.saveDisplayNameBtn = document.getElementById('save-displayname-btn')
		this.logoutLink = document.getElementById('sidebar-logout-link')

		this.setupEventListeners()
		this.loadUserData()
	}

    private setupEventListeners(): void {
        // Ouvrir au clic sur l'avatar
        this.avatarBtn?.addEventListener('click', (e) => {
            e.preventDefault()
            this.open()
        })

        // Fermer au clic sur le bouton X
        this.closeBtn?.addEventListener('click', () => {
            this.close()
        })

        // Fermer au clic sur l'overlay
        this.overlay?.addEventListener('click', () => {
            this.close()
        })

		// Upload avatar au clic sur le wrapper
		this.avatarWrapper?.addEventListener('click', () => {
			this.avatarInput?.click()
		})

		// Gérer l'upload
		this.avatarInput?.addEventListener('change', async (e) => {
			await this.handleAvatarUpload(e)
		})

		// Supprimer l'avatar
		this.deleteAvatarBtn?.addEventListener('click', async () => {
			await this.handleDeleteAvatar()
		})

		// Sauvegarder le pseudo
		this.saveDisplayNameBtn?.addEventListener('click', async () => {
			console.log('Click détecté!')
			await this.handleSaveDisplayName()
		})

		// Logout
		this.logoutLink?.addEventListener('click', async (e) => {
			e.preventDefault()
			await this.handleLogout()
})
    }

	private async loadUserData(): Promise<void>
	{
		try {
			const user = await ApiService.getMe()

			// Avatar
			if (this.avatarElement)
			{
				if (user.avatar_url) {
					this.avatarElement.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`
					// Afficher le bouton supprimer
					if (this.deleteAvatarBtn) {
						this.deleteAvatarBtn.style.display = 'block'
					}
				} else {
					this.avatarElement.textContent = user.username.charAt(0).toUpperCase()
					// Masquer le bouton supprimer
					if (this.deleteAvatarBtn) {
						this.deleteAvatarBtn.style.display = 'none'
					}
				}
			}

			// Remplir le champ pseudo
			if (this.displayNameInput)
			{
				this.displayNameInput.value = user.display_name || user.username
			}

		} catch (error) {
			console.error('Failed to load user data:', error)
		}
	}

	private async handleAvatarUpload(e: Event): Promise<void>
	{
		const target = e.target as HTMLInputElement
		const file = target.files?.[0]

		if (!file) return

		// Vérifier le type
		if (!file.type.startsWith('image/')) {
			alert('Veuillez sélectionner une image')
			return
		}

		// Vérifier la taille (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			alert('Fichier trop volumineux. Maximum 5MB')
			return
		}

		try {
			// Upload
			await ApiService.uploadAvatar(file)

			// Recharger les données
			await this.loadUserData()

			console.log('Avatar updated successfully')
		} catch (error: any) {
			alert(error.message || 'Échec de l\'upload')
		}

		// Reset input
		target.value = ''
	}

	private async handleDeleteAvatar(): Promise<void>
	{
		console.log('handleDeleteAvatar appelée')

		if (!confirm('Voulez-vous vraiment supprimer votre photo de profil ?')) {
			return
		}

		try {
			console.log('Appel API deleteAvatar')
			await ApiService.deleteAvatar()
			console.log('Avatar supprimé avec succès')
			await this.loadUserData()
		} catch (error: any) {
			console.error('Erreur delete:', error)
			alert(error.message || 'Échec de la suppression')
		}
	}

	private async handleSaveDisplayName(): Promise<void>
	{
		const newDisplayName = this.displayNameInput?.value.trim()

		if (!newDisplayName) {
			alert('Le pseudo ne peut pas être vide')
			return
		}

		try {
			const user = JSON.parse(localStorage.getItem('user') || '{}')
			console.log('User from localStorage:', user)

			// Appel API pour mettre à jour le pseudo
			const updatedUser = await ApiService.updateProfile(user.id, {
				display_name: newDisplayName
			})

			// Mettre à jour le localStorage
			localStorage.setItem('user', JSON.stringify(updatedUser.user))

			alert('Pseudo mis à jour avec succès !')

			// Recharger les données de la sidebar
			await this.loadUserData()

			window.dispatchEvent(new CustomEvent('userProfileUpdated', {
				detail: { user: updatedUser.user }
			}))

			// Fermer la sidebar
			this.close()

		}
		catch (error: any)
		{
			alert(error.message || 'Échec de la mise à jour')
		}
	}

	private async handleLogout(): Promise<void>
	{
		if (!confirm('Voulez-vous vraiment vous déconnecter ?')) {
			return
		}

		try {
			await ApiService.logout()
			window.location.href = '/'
		} catch (error: any) {
			console.error('Erreur logout:', error)
			alert(error.message || 'Échec de la déconnexion')
		}
	}


    public open(): void {
        this.sidebar?.classList.add('active')
        this.overlay?.classList.add('active')
        console.log('Sidebar opened')
    }

    public close(): void {
        this.sidebar?.classList.remove('active')
        this.overlay?.classList.remove('active')
        console.log('Sidebar closed')
    }
}
