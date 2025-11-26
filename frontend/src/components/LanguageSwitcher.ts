/**
 * Composant pour changer la langue
 * Affiche 3 drapeaux: FR, ES, EN
 */

import { i18n, Language } from '../services/i18n'

export class LanguageSwitcher {
  private container: HTMLElement | null = null
  private selectedLanguage: Language = i18n.getLanguage()

  constructor() {
    this.render()
    this.setupEventListeners()
  }

  /**
   * Render le sélecteur de langue
   */
  private render(): void {
    const html = `
      <div class="language-switcher">
        <label class="language-label">${i18n.t('sidebar.language', 'Langue')}</label>
        <div class="language-flags">
          ${i18n.getLanguageFlags()
            .map(
              (lang) => `
              <button
                class="flag-button ${lang.code === this.selectedLanguage ? 'active' : ''}"
                data-language="${lang.code}"
                title="${lang.name}"
                aria-label="${lang.name}"
              >
                <span class="flag">${lang.flag}</span>
              </button>
            `
            )
            .join('')}
        </div>
      </div>
    `

    // Créer temporairement un conteneur
    const temp = document.createElement('div')
    temp.innerHTML = html
    this.container = temp.firstElementChild as HTMLElement
  }

  /**
   * Setup les event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return

    const buttons = this.container.querySelectorAll('.flag-button')

    buttons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault()
        const lang = button.getAttribute('data-language') as Language
        this.selectLanguage(lang)
      })
    })

    // Écouter les changements de langue
    window.addEventListener('languageChanged', (e: any) => {
      this.updateActiveButton(e.detail.language)
    })
  }

  /**
   * Sélectionne une langue
   */
  private selectLanguage(language: Language): void {
    i18n.setLanguage(language)
    this.selectedLanguage = language
    this.updateActiveButton(language)

    // Mettre à jour l'interface
    this.updateUI()
  }

  /**
   * Met à jour le bouton actif
   */
  private updateActiveButton(language: Language): void {
    if (!this.container) return

    const buttons = this.container.querySelectorAll('.flag-button')
    buttons.forEach((button) => {
      button.classList.remove('active')
      if (button.getAttribute('data-language') === language) {
        button.classList.add('active')
      }
    })
  }

  /**
   * Met à jour l'interface avec la nouvelle langue
   * (À appeler après changement de langue)
   */
  private updateUI(): void {
    // Mettre à jour le label
    const label = this.container?.querySelector('.language-label')
    if (label) {
      label.textContent = i18n.t('sidebar.language', 'Langue')
    }

    // Émettre un événement personnalisé pour notifier les autres composants
    window.dispatchEvent(new CustomEvent('uiTranslationNeeded', {
      detail: { language: this.selectedLanguage }
    }))
  }

  /**
   * Monte le composant dans le DOM
   */
  public mount(parent: HTMLElement): void {
    if (this.container && parent) {
      parent.appendChild(this.container)
    }
  }

  /**
   * Retourne le conteneur
   */
  public getElement(): HTMLElement | null {
    return this.container
  }
}
