import mainTemplate from './templates/main.html?raw'
import { i18n } from './services/i18n'


export class App
{
	private container: HTMLElement | null = null

	mount(selector: string): void
	{
		this.container = document.querySelector(selector)

		if (!this.container) {
			throw new Error(`Container ${selector} not found`)
		}

		this.render()

		// Appliquer les traductions au démarrage après que les traductions soient chargées
		window.addEventListener('translationsLoaded', () => {
			this.updateNavigationText()
		})

		// Si les traductions sont déjà chargées, les appliquer immédiatement
		setTimeout(() => {
			if (Object.keys(i18n.getAllTranslations()).length > 0) {
				this.updateNavigationText()
			}
		}, 100)

		this.setupLanguageChangeListener()
	}

	// INJECTION DU HTML DU MAIN
	private render(): void
	{
		if (!this.container) return

		this.container.innerHTML = mainTemplate

	}

	// Update navigation text based on current language
	private updateNavigationText(): void {
		const navLinks = document.querySelectorAll('.nav-links a')
		const authButton = document.querySelector('.auth-buttons a')
		const footerBanner = document.querySelectorAll('.scrolling-banner span')
		const footerCredit = document.querySelector('.app-footer p')

		if (navLinks.length >= 4) {
			navLinks[0].textContent = i18n.t('header.home', 'Accueil')
			navLinks[1].textContent = i18n.t('header.training', 'Entrainement')
			navLinks[2].textContent = i18n.t('header.tournament', 'Tournoi')
			navLinks[3].textContent = i18n.t('header.onlineMatch', 'Match en ligne')
		}

		if (authButton) {
			authButton.textContent = i18n.t('header.login', 'Connexion')
		}

		if (footerBanner.length > 0) {
			footerBanner.forEach(span => {
				span.textContent = i18n.t('footer.banner', 'Super Pong • Ecole 42 • Transcendence • 2025')
			})
		}

		if (footerCredit) {
			footerCredit.textContent = i18n.t('footer.credits', 'Transcendé par : sviallon - emmmarti - agilibert')
		}
	}

	// Listen for language changes and update navigation
	private setupLanguageChangeListener(): void {
		window.addEventListener('languageChanged', () => {
			this.updateNavigationText()
		})
	}

}
