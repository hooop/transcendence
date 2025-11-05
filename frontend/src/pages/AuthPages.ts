import { ApiService } from '../services/api'

export class AuthPages {

    // Page de connexion
    static renderLogin(): string {
        return `
<div class="login-container">

	<!-- Côté gauche : Image -->

	<div class="login-image">
		<img src="../img/login_2.png" alt="Connexion" />
	</div>

	<!-- Côté droit : Formulaire -->

	<div class="login-form">

		<div class="login-form-content">

			<h2>Connexion</h2>
			<p class="subtitle">Connectez-vous a votre compte</p>

			<form id="login-form">

			<div class="form-group">
					<label for="username">Nom d'utilisateur ou email</label>
					<input
						type="text"
						id="username"
						name="username"
						required
						placeholder="Nom d'utilisateur ou email"
						autocomplete="username"
					/>
			</div>

			<div class="form-group">
				<label for="password">Mot de passe</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					placeholder="Mot de passe"
					autocomplete="current-password"
				/>
			</div>

			<div id="login-error" class="error-message" style="display: none;"></div>

			<button type="submit" class="btn-login">Se connecter</button>

			</form>

			<div class="divider">
				<span>ou</span>
			</div>

			<a href="http://localhost:3000/api/auth/42" class="btn-oauth">

				Se connecter avec
				<span class="oauth-icon">
					<img src="../img/42_Logo.svg" alt="42" width="30" height="30" />
				</span>
			</a>

			<p class="signup-link">
				Pas encore de compte ?
				<a href="/register" data-route>Creer un compte</a>
			</p>
		</div>
	</div>
</div>
        `;
    }

    // Page d'inscription
    static renderRegister(): string {
        return `
 <div class="login-container">

	<!-- Côté gauche : Image -->

	<div class="login-image">
		<img src="../img/inscription.png" alt="Inscription" />
	</div>

	<!-- Côté droit : Formulaire -->

	<div class="login-form">

		<div class="login-form-content">

			<h2>Inscription</h2>
			<p class="subtitle">Créez un compte</p>

			<form id="register-form">

			<div class="form-group">
				<label for="username">Nom d'utilisateur *</label>
				<input
					type="text"
					id="username"
					name="username"
					required
					placeholder="Choisir un nom d'utilisateur"
					autocomplete="username"
					minlength="3"
				/>
			</div>

			<div class="form-group">
				<label for="email">Email *</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					placeholder="your.email@example.com"
					autocomplete="email"
				/>
			</div>

			<div class="form-group">
				<label for="display_name">Pseudo</label>
				<input
					type="text"
					id="display_name"
					name="display_name"
					placeholder="Choisir un pseudo (facultatif)"
				/>
			</div>

			<div class="form-group">
				<label for="password">Mot de passe *</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					placeholder="Minimum 8 caractères"
					autocomplete="new-password"
					minlength="8"
				/>
			</div>

			<div id="register-error" class="error-message" style="display: none;"></div>

			<button type="submit" class="btn-login">S'inscrire</button>

			</form>

			<div class="divider">
				<span>ou</span>
			</div>

			<a href="http://localhost:3000/api/auth/42" class="btn-oauth">
				Se connecter avec
				<span class="oauth-icon">
					<img src="../img/42_Logo.svg" alt="42" width="30" height="30" />
				</span>
			</a>

			<p class="signup-link">
				Déjà un compte ?
				<a href="/login" data-route>Connectez-vous</a>
			</p>
		</div>
	</div>
</div>
        `;
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
    static setupLoginForm(): void {
        const form = document.getElementById('login-form') as HTMLFormElement;
        const errorDiv = document.getElementById('login-error') as HTMLDivElement;

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;

                // Cacher les erreurs précédentes
                errorDiv.style.display = 'none';

                // Désactiver le bouton
                const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';

                try {
                    await ApiService.login(username, password);

                    // Rediriger vers le dashboard
                    window.location.href = '/dashboard';
                } catch (error: any) {
                    errorDiv.textContent = error.message || 'Login failed';
                    errorDiv.style.display = 'block';

                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                }
            });
        }
    }

    // Gérer la soumission du formulaire d'inscription
    static setupRegisterForm(): void {
        const form = document.getElementById('register-form') as HTMLFormElement;
        const errorDiv = document.getElementById('register-error') as HTMLDivElement;

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const username = formData.get('username') as string;
                const email = formData.get('email') as string;
                const display_name = formData.get('display_name') as string;
                const password = formData.get('password') as string;
                const password_confirm = formData.get('password_confirm') as string;

                // Validation
                if (password !== password_confirm) {
                    errorDiv.textContent = 'Passwords do not match';
                    errorDiv.style.display = 'block';
                    return;
                }

                // Cacher les erreurs précédentes
                errorDiv.style.display = 'none';

                // Désactiver le bouton
                const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';

                try {
                    await ApiService.register(username, email, password, display_name || undefined);

                    // Rediriger vers le dashboard
                    window.location.href = '/dashboard';
                } catch (error: any) {
                    errorDiv.textContent = error.message || 'Registration failed';
                    errorDiv.style.display = 'block';

                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account';
                }
            });
        }
    }
}
