/**
 * Service d'internationalisation (i18n)
 * Gère les traductions en FR, ES, EN
 */

export type Language = 'fr' | 'es' | 'en'

export interface TranslationKeys {
  [key: string]: string | TranslationKeys
}

export class I18nService {
  private static instance: I18nService
  private currentLanguage: Language = 'fr'
  private translations: Record<Language, TranslationKeys> = {
    fr: {},
    es: {},
    en: {},
  }

  private constructor() {
    this.loadSavedLanguage()
    // Charger les traductions de manière asynchrone
    this.initializeTranslations()
  }

  /**
   * Initialise les traductions de manière asynchrone
   */
  private async initializeTranslations(): Promise<void> {
    await this.loadTranslations()
  }

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService()
    }
    return I18nService.instance
  }

  /**
   * Charge les traductions depuis les fichiers JSON
   */
  private async loadTranslations(): Promise<void> {
    try {
      // Charger les fichiers de traduction avec import dynamique
      const frTranslations = await import('../i18n/fr.json')
      const esTranslations = await import('../i18n/es.json')
      const enTranslations = await import('../i18n/en.json')

      this.translations.fr = frTranslations.default
      this.translations.es = esTranslations.default
      this.translations.en = enTranslations.default

      console.log('Translations loaded successfully')

      // Émettre un événement pour notifier que les traductions sont chargées
      window.dispatchEvent(new CustomEvent('translationsLoaded', {
        detail: { language: this.currentLanguage }
      }))
    } catch (error) {
      console.error('Failed to load translations:', error)
    }
  }

  /**
   * Charge la langue sauvegardée dans localStorage
   */
  private loadSavedLanguage(): void {
    const savedLanguage = localStorage.getItem('language') as Language | null
    if (savedLanguage && ['fr', 'es', 'en'].includes(savedLanguage)) {
      this.currentLanguage = savedLanguage
    }
  }

  /**
   * Obtient la traduction d'une clé
   * Exemple: t('sidebar.logout') retourne "Déconnexion"
   */
  public t(key: string, defaultValue: string = key): string {
    const keys = key.split('.')
    let translation: any = this.translations[this.currentLanguage]

    for (const k of keys) {
      if (translation && typeof translation === 'object' && k in translation) {
        translation = translation[k]
      } else {
        return defaultValue
      }
    }

    return typeof translation === 'string' ? translation : defaultValue
  }

  /**
   * Change la langue courante et met à jour l'affichage
   */
  public setLanguage(language: Language): void {
    if (['fr', 'es', 'en'].includes(language)) {
      this.currentLanguage = language
      localStorage.setItem('language', language)

      // Émettre un événement pour notifier les changements
      // Tous les composants écoutent cet événement et se mettent à jour
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language }
      }))

      console.log(`Language changed to: ${language}`)
    }
  }

  /**
   * Obtient la langue courante
   */
  public getLanguage(): Language {
    return this.currentLanguage
  }

  /**
   * Obtient toutes les traductions pour la langue courante
   */
  public getAllTranslations(): TranslationKeys {
    return this.translations[this.currentLanguage]
  }

  /**
   * Retourne les informations des drapeaux
   */
  public getLanguageFlags(): Array<{ code: Language; flag: string; name: string }> {
    return [
      { code: 'fr', flag: '🇫🇷', name: 'Français' },
      { code: 'es', flag: '🇪🇸', name: 'Español' },
      { code: 'en', flag: '🇬🇧', name: 'English' },
    ]
  }
}

// Export une instance unique
export const i18n = I18nService.getInstance()
