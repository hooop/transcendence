const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    // Si les credentials email ne sont pas configurés, utiliser ethereal (pour dev/test)
    if (!config.email.user || !config.email.password) {
      console.warn('Email credentials not configured. Using console logging for development.');
      console.warn('Set EMAIL_USER and EMAIL_PASSWORD in .env for production.');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  /**
   * Génère un code 2FA aléatoire
   * @returns {string} Code à 6 chiffres
   */
  generateCode() {
    const length = config.twoFactor.codeLength;
    const code = Math.floor(Math.random() * Math.pow(10, length))
      .toString()
      .padStart(length, '0');
    return code;
  }

  /**
   * Calcule la date d'expiration du code
   * @returns {Date}
   */
  getExpirationDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + config.twoFactor.expirationMinutes);
    return now;
  }

  /**
   * Envoie un email avec le code 2FA
   * @param {string} email - Email du destinataire
   * @param {string} code - Code 2FA à envoyer
   * @param {string} username - Nom d'utilisateur
   */
  async send2FACode(email, code, username) {
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Votre code de vérification 2FA - ft_transcendence',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .code-box {
              background: white;
              border: 2px dashed #667eea;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #667eea;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ft_transcendence</h1>
              <p>Authentification à deux facteurs</p>
            </div>
            <div class="content">
              <h2>Bonjour ${username},</h2>
              <p>Vous avez demandé à vous connecter à votre compte ft_transcendence.</p>
              <p>Voici votre code de vérification :</p>

              <div class="code-box">
                <div class="code">${code}</div>
              </div>

              <div class="warning">
                <strong>Ce code expire dans ${config.twoFactor.expirationMinutes} minutes.</strong>
              </div>

              <p>Si vous n'avez pas demandé ce code, ignorez cet email ou contactez le support si vous pensez que votre compte est compromis.</p>

              <p>Cordialement,<br>L'équipe ft_transcendence</p>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Bonjour ${username},

Vous avez demandé à vous connecter à votre compte ft_transcendence.

Votre code de vérification : ${code}

Ce code expire dans ${config.twoFactor.expirationMinutes} minutes.

Si vous n'avez pas demandé ce code, ignorez cet email.

Cordialement,
L'équipe ft_transcendence
      `,
    };

    // Si pas de transporter configuré (mode dev), on log juste le code
    if (!this.transporter) {
      console.log('\n' + '='.repeat(60));
      console.log('EMAIL 2FA (MODE DÉVELOPPEMENT)');
      console.log('='.repeat(60));
      console.log(`À: ${email}`);
      console.log(`Utilisateur: ${username}`);
      console.log(`Code: ${code}`);
      console.log(`Expire dans: ${config.twoFactor.expirationMinutes} minutes`);
      console.log('='.repeat(60) + '\n');
      return { success: true, messageId: 'dev-mode' };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email 2FA envoyé à ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email 2FA:', error);
      throw new Error('Impossible d\'envoyer l\'email de vérification');
    }
  }

  /**
   * Vérifie si un code 2FA est valide et non expiré
   * @param {string} storedCode - Code stocké en base
   * @param {string} providedCode - Code fourni par l'utilisateur
   * @param {Date} expiresAt - Date d'expiration
   * @returns {boolean}
   */
  verifyCode(storedCode, providedCode, expiresAt) {
    if (!storedCode || !providedCode) {
      return false;
    }

    // Vérifier que le code correspond
    if (storedCode !== providedCode) {
      return false;
    }

    // Vérifier que le code n'a pas expiré
    const now = new Date();
    const expiration = new Date(expiresAt);

    if (now > expiration) {
      return false;
    }

    return true;
  }
}

module.exports = new EmailService();
