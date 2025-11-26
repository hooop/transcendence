/**
 * Sélecteur de langue pour le header (utilisateurs non-connectés)
 * Affiche un menu déroulant avec 3 drapeaux
 */

import { i18n, Language } from '../services/i18n'

export class HeaderLanguageSwitcher {
  private container: HTMLElement | null = null
/*   private button: HTMLButtonElement | null = null
  private dropdown: HTMLElement | null = null */
  private selectedLanguage: Language = i18n.getLanguage()

  constructor() {
    this.render()
    this.setupEventListeners()
  }

  /**
   * Render le sélecteur de langue pour le header
   */
private render(): void {
  const html = `
    <div class="header-language-switcher">
      ${i18n
        .getLanguageFlags()
        .map(
          (lang) => `
          <button
            class="language-button ${lang.code === this.selectedLanguage ? 'active' : ''}"
            data-language="${lang.code}"
            title="${lang.name}"
          >
            ${lang.code.toUpperCase()}
          </button>
        `
        )
        .join('')}
    </div>
  `

  const temp = document.createElement('div')
  temp.innerHTML = html
  this.container = temp.firstElementChild as HTMLElement
}

  /**
   * Retourne le drapeau actuel
   */
  private getCurrentFlag(): string {
    const flags = i18n.getLanguageFlags()
    const current = flags.find((f) => f.code === this.selectedLanguage)
    return current ? current.flag : '🇫🇷'
  }

  /**
   * Setup les event listeners
   */
private setupEventListeners(): void {
  if (!this.container) return

  // Sélectionner une langue
  const buttons = this.container.querySelectorAll('.language-button')
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
 * Met à jour le bouton actif
 */
private updateActiveButton(language: Language): void {
  if (!this.container) return

  const buttons = this.container.querySelectorAll('.language-button')
  buttons.forEach((button) => {
    button.classList.remove('active')
    if (button.getAttribute('data-language') === language) {
      button.classList.add('active')
    }
  })
}


  /**
   * Toggle le menu déroulant
   */
/*   private toggleDropdown(): void {
    if (!this.dropdown) return
    this.dropdown.classList.toggle('active')
  } */

  /**
   * Ferme le menu
   */
/*   private closeDropdown(): void {
    if (!this.dropdown) return
    this.dropdown.classList.remove('active')
  } */

  /**
   * Sélectionne une langue
   */
private selectLanguage(language: Language): void {
  i18n.setLanguage(language)
  this.selectedLanguage = language
  this.updateActiveButton(language)
}

  /**
   * Met à jour le drapeau affiché
   */
/*   private updateCurrentFlag(language: Language): void {
    if (!this.button) return
    const flagElement = this.button.querySelector('.flag-current')
    if (flagElement) {
      const flags = i18n.getLanguageFlags()
      const flag = flags.find((f) => f.code === language)
      if (flag) {
        flagElement.textContent = flag.flag
      }
    }
  } */

  /**
   * Met à jour l'élément actif
   */
/*   private updateActiveItem(language: Language): void {
    if (!this.container) return
    const items = this.container.querySelectorAll('.dropdown-item')
    items.forEach((item) => {
      item.classList.remove('active')
      if (item.getAttribute('data-language') === language) {
        item.classList.add('active')
      }
    })
  } */

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
