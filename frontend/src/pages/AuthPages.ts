import { ApiService } from '../services/api'

import loginTemplate from '../templates/login.html?raw'
import registerTemplate from '../templates/register.html?raw'

export class AuthPages
{

	// Injection html page login
	static renderLogin(): string
	{
		return loginTemplate;
	}

	// Injection html page d'inscription
	static renderRegister(): string
	{
		return registerTemplate;
	}

    // Page de callback OAuth42
    static renderOAuthCallback(): string {
        // Récupérer le token et les données utilisateur depuis l'URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const userParam = params.get('user');

        if (token && userParam) {
            try {
                const user = JSON.parse(decodeURIComponent(userParam));
                ApiService.setToken(token);
                localStorage.setItem('user', JSON.stringify(user));

                // Rediriger vers le dashboard après un court délai
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);

                return `
                    <div class="auth-page">
                        <div class="auth-container">
                            <h2>✅ Authentication Successful!</h2>
                            <p>Welcome ${user.display_name || user.username}!</p>
                            <p>Redirecting to dashboard...</p>
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Failed to parse user data:', error);
            }
        }

        // Si erreur
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <h2>❌ Authentication Failed</h2>
                    <p>There was a problem with your authentication.</p>
                    <a href="/login" data-route class="btn btn-primary">Back to Login</a>
                </div>
            </div>
        `;
    }

	// Gérer la soumission du formulaire de connexion
	static setupLoginForm(): void
	{
		const form = document.getElementById('login-form') as HTMLFormElement;
		const errorDiv = document.getElementById('login-error') as HTMLDivElement;
		const twoFAForm = document.getElementById('2fa-form') as HTMLFormElement;
		const twoFAErrorDiv = document.getElementById('2fa-error') as HTMLDivElement;
		const twoFAMessage = document.getElementById('2fa-message') as HTMLParagraphElement;
		const backToLoginBtn = document.getElementById('back-to-login') as HTMLButtonElement;

		let currentUsername = '';
		let currentPassword = '';

		// Toggle password visibility
		const passwordInput = document.getElementById('password') as HTMLInputElement;
		const togglePasswordBtn = document.querySelector('.toggle-password') as HTMLButtonElement;

		if (togglePasswordBtn && passwordInput)
		{
			togglePasswordBtn.addEventListener('click', () => {
				const isPassword = passwordInput.type === 'password';
				passwordInput.type = isPassword ? 'text' : 'password';

				// Changer l'icône SVG
				const eyeIcon = togglePasswordBtn.querySelector('.eye-icon') as SVGElement;
				if (isPassword)
				{
					// Œil avec barre (masqué)
					eyeIcon.innerHTML = `
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
						<circle cx="12" cy="12" r="3"/>
						<line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
					`;
				}
				else
				{
					// Œil normal (visible)
					eyeIcon.innerHTML = `
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
						<circle cx="12" cy="12" r="3"/>
					`;
				}
			});
		}

		// Bouton retour au login
		if (backToLoginBtn) {
			backToLoginBtn.addEventListener('click', () => {
				form.style.display = 'block';
				twoFAForm.style.display = 'none';
				twoFAErrorDiv.style.display = 'none';
				const twoFACodeInput = document.getElementById('2fa-code') as HTMLInputElement;
				if (twoFACodeInput) twoFACodeInput.value = '';
			});
		}

        if (form)
		{
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;

                currentUsername = username;
                currentPassword = password;

                // Cacher les erreurs précédentes
                errorDiv.style.display = 'none';

                // Désactiver le bouton
                const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Connexion...';

                try
				{
                    const response = await ApiService.login(username, password);

                    // Si 2FA requis
                    if ('two_factor_required' in response && response.two_factor_required) {
                        // Envoyer le code par email
                        const codeResponse = await ApiService.send2FACode(username, password);

                        // Afficher le formulaire 2FA
                        form.style.display = 'none';
                        twoFAForm.style.display = 'block';
                        twoFAMessage.textContent = `Un code de verification a ete envoye a ${codeResponse.email}`;

                        // Focus sur l'input du code
                        const twoFACodeInput = document.getElementById('2fa-code') as HTMLInputElement;
                        if (twoFACodeInput) twoFACodeInput.focus();
                    } else {
                        // Connexion réussie sans 2FA
                        window.location.href = '/dashboard';
                    }

                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Se connecter';
                }
				catch (error: any)
				{
                    errorDiv.textContent = error.message || 'Login failed';
                    errorDiv.style.display = 'block';

                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Se connecter';
                }
            });
        }

        // Gérer la soumission du formulaire 2FA
        if (twoFAForm) {
            twoFAForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(twoFAForm);
                const code = formData.get('code') as string;

                // Cacher les erreurs précédentes
                twoFAErrorDiv.style.display = 'none';

                // Désactiver le bouton
                const submitBtn = twoFAForm.querySelector('button[type="submit"]') as HTMLButtonElement;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verification...';

                try {
                    await ApiService.verify2FACode(currentUsername, code);

                    // Rediriger vers le dashboard
                    window.location.href = '/dashboard';
                } catch (error: any) {
                    twoFAErrorDiv.textContent = error.message || 'Code invalide';
                    twoFAErrorDiv.style.display = 'block';

                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Verifier';
                }
            });
        }
    }

	// Gérer la soumission du formulaire d'inscription
	static setupRegisterForm(): void {
		const form = document.getElementById('register-form') as HTMLFormElement;
		const errorDiv = document.getElementById('register-error') as HTMLDivElement;

		if (form)
		{
			// Toggle password visibility
			const passwordInput = document.getElementById('password') as HTMLInputElement;
			const togglePasswordBtn = document.querySelector('.toggle-password') as HTMLButtonElement;

			if (togglePasswordBtn && passwordInput) {
				togglePasswordBtn.addEventListener('click', () => {
					const isPassword = passwordInput.type === 'password';
					passwordInput.type = isPassword ? 'text' : 'password';

					const eyeIcon = togglePasswordBtn.querySelector('.eye-icon') as SVGElement;
					if (isPassword) {
						eyeIcon.innerHTML = `
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
							<circle cx="12" cy="12" r="3"/>
							<line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
						`;
					} else {
						eyeIcon.innerHTML = `
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
							<circle cx="12" cy="12" r="3"/>
						`;
					}
				});
			}

			form.addEventListener('submit', async (e) => {
				e.preventDefault();

				const formData = new FormData(form);
				const username = formData.get('username') as string;
				const email = formData.get('email') as string;
				const display_name = formData.get('display_name') as string;
				const password = formData.get('password') as string;

				// Cacher les erreurs précédentes
				errorDiv.style.display = 'none';

				// Désactiver le bouton
				const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
				submitBtn.disabled = true;
				submitBtn.textContent = 'Creating account...';

				try
				{
					await ApiService.register(username, email, password, display_name || undefined);

					// Rediriger vers le dashboard
					window.location.href = '/dashboard';
				}
				catch (error: any)
				{
					errorDiv.textContent = error.message || 'Registration failed';
					errorDiv.style.display = 'block';

					// Réactiver le bouton
					submitBtn.disabled = false;
					submitBtn.textContent = 'S\'inscrire';
				}
			});
		}
	}
}
