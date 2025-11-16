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

    constructor() {
		this.sidebar = document.getElementById('user-sidebar')
		this.overlay = document.getElementById('sidebar-overlay')
		this.closeBtn = document.getElementById('sidebar-close')
		this.avatarBtn = document.getElementById('header-user-avatar')
		this.avatarElement = document.getElementById('sidebar-avatar')
		this.usernameElement = document.getElementById('sidebar-username')
		this.emailElement = document.getElementById('sidebar-email')
		this.avatarWrapper = document.querySelector('.sidebar-avatar-wrapper')
		this.avatarInput = document.getElementById('sidebar-avatar-input') as HTMLInputElement

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
    }

	private async loadUserData(): Promise<void>
	{
		try {
			const user = await ApiService.getMe()

			// Avatar
			if (this.avatarElement) {
				if (user.avatar_url) {
					this.avatarElement.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`
				} else {
					this.avatarElement.textContent = user.username.charAt(0).toUpperCase()
				}
			}

			// Username
			if (this.usernameElement) {
				this.usernameElement.textContent = user.display_name || user.username
			}

			// Email
			if (this.emailElement) {
				this.emailElement.textContent = user.email
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
