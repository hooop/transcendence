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
	private toggle2FACheckbox: HTMLInputElement | null = null
	private twoFAEnabled: boolean = false

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
		this.toggle2FACheckbox = document.getElementById('toggle-2fa-checkbox') as HTMLInputElement

		this.setupEventListeners()
		this.loadUserData()
		this.load2FAStatus()
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

		// Toggle 2FA
		this.toggle2FACheckbox?.addEventListener('change', async (e) => {
			await this.handleToggle2FA(e)
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

			// Email (disabled mais affiche la valeur)
			if (this.emailElement) {
				(this.emailElement as HTMLInputElement).value = user.email
			}

			// Username (disabled mais affiche la valeur)
			if (this.usernameElement) {
				(this.usernameElement as HTMLInputElement).value = user.username
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
			// Upload avatar et récupère l'utilisateur mis à jour
			const updatedUser = await ApiService.uploadAvatar(file);

			// Recharger les données dans la sidebar
			await this.loadUserData()

			window.dispatchEvent(new CustomEvent('userProfileUpdated', {
				detail: { user: updatedUser.user}
			}));

			console.log('Avatar updated successfully');

		} catch (error: any) {
			alert(error.message || 'Échec de l\'upload')
		}

		// Reset input
		target.value = ''
	}

		private async handleDeleteAvatar(): Promise<void>
{
    if (!confirm('Voulez-vous vraiment supprimer votre photo de profil ?')) {
        return
    }

    try {
        await ApiService.deleteAvatar()
        
        // Récupérer l'utilisateur mis à jour
        const updatedUser = await ApiService.getMe()
        
        await this.loadUserData()

        window.dispatchEvent(new CustomEvent('userProfileUpdated', {
            detail: { user: updatedUser }
        }))

        console.log('Avatar deleted successfully')

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

	private async load2FAStatus(): Promise<void>
	{
		try {
			const status = await ApiService.get2FAStatus()
			this.twoFAEnabled = status.two_factor_enabled
			this.update2FACheckbox()
		} catch (error: any) {
			console.log('2FA status not loaded (user may not be authenticated)')
			this.twoFAEnabled = false
			this.update2FACheckbox()
		}
	}

	private update2FACheckbox(): void
	{
		if (!this.toggle2FACheckbox) return

		this.toggle2FACheckbox.checked = this.twoFAEnabled
	}

	private async handleToggle2FA(e: Event): Promise<void>
	{
		const checkbox = e.target as HTMLInputElement
		const newState = checkbox.checked

		try {
			if (newState) {
				const response = await ApiService.enable2FA()
				this.twoFAEnabled = true
				alert('Authentification a deux facteurs activee ! Un code vous sera envoye par email lors de votre prochaine connexion.')
			} else {
				if (!confirm('Voulez-vous vraiment desactiver l\'authentification a deux facteurs ?')) {
					checkbox.checked = true
					return
				}
				const response = await ApiService.disable2FA()
				this.twoFAEnabled = false
				alert('Authentification a deux facteurs desactivee')
			}
		} catch (error: any) {
			console.error('Erreur toggle 2FA:', error)
			const errorMessage = error.message || 'Echec de la modification 2FA'
			alert(errorMessage)
			checkbox.checked = this.twoFAEnabled
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
