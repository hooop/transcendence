/**
 * Utilitaires de sécurité pour prévenir les attaques XSS
 */

/**
 * Échappe les caractères HTML dangereux pour prévenir les attaques XSS
 * @param text - Texte potentiellement dangereux provenant d'une source non fiable
 * @returns Texte échappé sûr pour l'insertion dans le DOM
 */
export function escapeHtml(text: string | null | undefined): string {
	if (text === null || text === undefined) {
		return '';
	}

	const div = document.createElement('div');
	div.textContent = String(text);
	return div.innerHTML;
}

/**
 * Échappe les guillemets simples et doubles pour utilisation dans les attributs HTML
 * Utilisé spécifiquement pour les valeurs dans onclick, data-attributes, etc.
 * @param text - Texte à échapper
 * @returns Texte échappé sûr pour les attributs HTML
 */
export function escapeHtmlAttr(text: string | null | undefined): string {
	if (text === null || text === undefined) {
		return '';
	}

	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');
}
