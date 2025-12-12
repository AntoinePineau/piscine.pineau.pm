const nodemailer = require('nodemailer');

/**
 * Service d'envoi d'emails pour les alertes de piscine
 * Supporte Gmail et autres fournisseurs SMTP
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@pool-monitor.local';
    this.toEmail = process.env.EMAIL_TO || process.env.ALERT_EMAIL;
  }

  /**
   * Initialise le transporteur email
   */
  async initialize() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';

    try {
      if (emailProvider === 'gmail') {
        // Configuration Gmail avec App Password
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // App Password (pas le mot de passe Gmail)
          },
        });
        this.fromEmail = process.env.GMAIL_USER;
      } else if (emailProvider === 'smtp') {
        // Configuration SMTP générique
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } else {
        throw new Error(`Unknown email provider: ${emailProvider}`);
      }

      // Vérifier la connexion
      await this.transporter.verify();
      console.log('Email service initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  /**
   * Envoie une alerte par email
   * @param {Object} alert - Alerte générée par AlertAnalyzer
   */
  async sendAlert(alert) {
    if (!this.transporter) {
      await this.initialize();
    }

    if (!this.toEmail) {
      console.warn('No recipient email configured (EMAIL_TO or ALERT_EMAIL)');
      return false;
    }

    try {
      const emailContent = this._buildAlertEmail(alert);

      const mailOptions = {
        from: this.fromEmail,
        to: this.toEmail,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Alert email sent:', info.messageId);

      return true;

    } catch (error) {
      console.error('Error sending alert email:', error);
      throw error;
    }
  }

  /**
   * Construit le contenu de l'email d'alerte
   */
  _buildAlertEmail(alert) {
    const { severity, measurement, geminiAnalysis, timestamp } = alert;

    // Emoji selon sévérité
    const severityEmoji = {
      ok: '✅',
      warning: '⚠️',
      critical: '🚨',
    };

    const emoji = severityEmoji[severity] || '⚠️';
    const severityText = {
      ok: 'Situation normale',
      warning: 'Attention requise',
      critical: 'Action immédiate nécessaire',
    };

    // Sujet
    const subject = `${emoji} Piscine - ${severityText[severity]}`;

    // Version texte
    let text = `ALERTE PISCINE - ${severityText[severity]}\n`;
    text += `Date : ${new Date(timestamp).toLocaleString('fr-FR')}\n\n`;

    text += `=== MESURES ACTUELLES ===\n`;
    text += `pH : ${measurement.ph !== null ? measurement.ph : 'N/A'}\n`;
    text += `Redox : ${measurement.redox !== null ? measurement.redox + ' mV' : 'N/A'}\n`;
    text += `Température : ${measurement.temperature !== null ? measurement.temperature + ' °C' : 'N/A'}\n`;
    text += `Salinité : ${measurement.salt !== null ? measurement.salt + ' g/L' : 'N/A'}\n`;

    if (measurement.alarm || measurement.warning || measurement.alarm_redox) {
      text += `\nALARMES SYSTÈME :\n`;
      if (measurement.alarm) text += `- Alarme générale ACTIVE\n`;
      if (measurement.warning) text += `- Avertissement ACTIF\n`;
      if (measurement.alarm_redox) text += `- Alarme Redox ACTIVE\n`;
    }

    text += `\n=== ANALYSE GEMINI ===\n`;
    text += `${geminiAnalysis.summary}\n\n`;

    if (geminiAnalysis.canSwim !== null) {
      text += `🏊 Baignade : ${geminiAnalysis.canSwim ? 'AUTORISÉE' : 'NON RECOMMANDÉE'}\n\n`;
    }

    if (geminiAnalysis.recommendations && geminiAnalysis.recommendations.length > 0) {
      text += `=== ACTIONS RECOMMANDÉES ===\n`;
      geminiAnalysis.recommendations.forEach((rec, i) => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        text += `${i + 1}. ${priority} ${rec.action}\n`;
        text += `   ${rec.details}\n`;
        if (rec.quantity) text += `   Quantité : ${rec.quantity}\n`;
        text += `\n`;
      });
    }

    if (geminiAnalysis.reasoning) {
      text += `\n=== DIAGNOSTIC ===\n${geminiAnalysis.reasoning}\n`;
    }

    text += `\n---\n`;
    text += `Tableau de bord : ${process.env.FRONTEND_URL || 'https://votre-app.vercel.app'}\n`;

    // Version HTML
    const html = this._buildHTMLEmail(alert, emoji, severityText[severity]);

    return {
      subject,
      text,
      html,
    };
  }

  /**
   * Construit la version HTML de l'email
   */
  _buildHTMLEmail(alert, emoji, severityText) {
    const { measurement, geminiAnalysis, timestamp } = alert;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 20px;
    }
    .severity-critical { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .severity-warning { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; }
    .severity-ok { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; }
    .section {
      background: #f8f9fa;
      padding: 15px;
      margin: 15px 0;
      border-radius: 6px;
      border-left: 4px solid #667eea;
    }
    .measurement-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 10px 0;
    }
    .measurement-item {
      background: white;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }
    .measurement-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .measurement-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .recommendation {
      background: white;
      padding: 12px;
      margin: 8px 0;
      border-radius: 4px;
      border-left: 3px solid #667eea;
    }
    .priority-high { border-left-color: #f5576c; }
    .priority-medium { border-left-color: #fcb69f; }
    .priority-low { border-left-color: #a8edea; }
    .swim-status {
      padding: 15px;
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      border-radius: 6px;
      margin: 15px 0;
    }
    .swim-ok { background: #d4edda; color: #155724; }
    .swim-not-ok { background: #f8d7da; color: #721c24; }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
      color: #6c757d;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header severity-${alert.severity}">
    <h1>${emoji} ${severityText}</h1>
    <p style="margin: 5px 0; opacity: 0.9;">
      ${new Date(timestamp).toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
    </p>
  </div>

  <div class="section">
    <h2>📊 Mesures actuelles</h2>
    <div class="measurement-grid">
      <div class="measurement-item">
        <div class="measurement-label">pH</div>
        <div class="measurement-value">${measurement.ph !== null ? measurement.ph : 'N/A'}</div>
      </div>
      <div class="measurement-item">
        <div class="measurement-label">Redox</div>
        <div class="measurement-value">${measurement.redox !== null ? measurement.redox + ' mV' : 'N/A'}</div>
      </div>
      <div class="measurement-item">
        <div class="measurement-label">Température</div>
        <div class="measurement-value">${measurement.temperature !== null ? measurement.temperature + ' °C' : 'N/A'}</div>
      </div>
      <div class="measurement-item">
        <div class="measurement-label">Salinité</div>
        <div class="measurement-value">${measurement.salt !== null ? measurement.salt + ' g/L' : 'N/A'}</div>
      </div>
    </div>
  </div>

  ${geminiAnalysis.canSwim !== null ? `
    <div class="swim-status ${geminiAnalysis.canSwim ? 'swim-ok' : 'swim-not-ok'}">
      🏊 Baignade ${geminiAnalysis.canSwim ? 'autorisée' : 'non recommandée'}
    </div>
  ` : ''}

  <div class="section">
    <h2>🤖 Analyse Gemini</h2>
    <p style="font-size: 16px; line-height: 1.8;">${geminiAnalysis.summary}</p>
  </div>

  ${geminiAnalysis.recommendations && geminiAnalysis.recommendations.length > 0 ? `
    <div class="section">
      <h2>✅ Actions recommandées</h2>
      ${geminiAnalysis.recommendations.map((rec, i) => `
        <div class="recommendation priority-${rec.priority}">
          <div style="font-weight: bold; margin-bottom: 5px;">
            ${i + 1}. ${rec.action}
          </div>
          <div style="color: #666; font-size: 14px;">
            ${rec.details}
            ${rec.quantity ? `<br><strong>Quantité :</strong> ${rec.quantity}` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="footer">
    <a href="${process.env.FRONTEND_URL || '#'}" class="button">
      Voir le tableau de bord
    </a>
    <p style="font-size: 12px; margin-top: 15px;">
      Pool Monitor - Système de surveillance intelligent
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Envoie un email de test
   */
  async sendTestEmail() {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = {
      from: this.fromEmail,
      to: this.toEmail,
      subject: '✅ Test - Pool Monitor Email Service',
      text: 'Le service d\'email fonctionne correctement !',
      html: '<p><strong>✅ Le service d\'email fonctionne correctement !</strong></p>',
    };

    const info = await this.transporter.sendMail(mailOptions);
    console.log('Test email sent:', info.messageId);
    return info;
  }
}

// Singleton
let emailServiceInstance = null;

function getEmailService() {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

module.exports = {
  EmailService,
  getEmailService,
};
