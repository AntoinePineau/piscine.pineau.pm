/**
 * Module de gestion des alertes intelligentes Gemini
 *
 * Affiche les alertes, conseils et recommandations
 * basés sur l'analyse IA des paramètres de piscine
 */

const AlertsModule = (() => {
  const ALERT_REFRESH_INTERVAL = 60000; // 1 minute
  let alertsRefreshTimer = null;
  let activeAlerts = [];

  /**
   * Initialise le module d'alertes
   */
  function init() {
    console.log('Initializing Alerts Module...');
    loadAlerts();
    startAutoRefresh();
  }

  /**
   * Charge les alertes depuis l'API
   */
  async function loadAlerts() {
    try {
      // Récupérer les alertes actives
      const response = await fetch(`${ACTUAL_API_URL}/alerts?active=true`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      activeAlerts = data.alerts || [];

      // Afficher les alertes
      displayAlerts(activeAlerts);

    } catch (error) {
      console.error('Error loading alerts:', error);
      displayErrorState('Impossible de charger les alertes');
    }
  }

  /**
   * Affiche les alertes dans le DOM
   */
  function displayAlerts(alerts) {
    const container = document.getElementById('gemini-alerts-container');

    if (!container) {
      console.warn('Gemini alerts container not found');
      return;
    }

    // Vider le conteneur
    container.innerHTML = '';

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="alert-card alert-ok">
          <div class="alert-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="alert-content">
            <h4>Tout va bien !</h4>
            <p>Aucune alerte active. Vos paramètres sont dans les normes.</p>
          </div>
        </div>
      `;
      return;
    }

    // Afficher chaque alerte
    alerts.forEach(alert => {
      const alertCard = createAlertCard(alert);
      container.appendChild(alertCard);
    });
  }

  /**
   * Crée une carte d'alerte HTML
   */
  function createAlertCard(alert) {
    const card = document.createElement('div');
    card.className = `alert-card alert-${alert.severity}`;
    card.dataset.alertId = alert.id;

    const icon = getSeverityIcon(alert.severity);
    const timestamp = new Date(alert.timestamp).toLocaleString('fr-FR');

    // Structure HTML de la carte
    card.innerHTML = `
      <div class="alert-header">
        <div class="alert-icon">
          <i class="${icon}"></i>
        </div>
        <div class="alert-meta">
          <span class="alert-severity">${getSeverityText(alert.severity)}</span>
          <span class="alert-time">${formatRelativeTime(alert.timestamp)}</span>
        </div>
        ${!alert.acknowledged ? `
          <button class="alert-dismiss" onclick="AlertsModule.acknowledgeAlert('${alert.id}')" title="Marquer comme lue">
            <i class="fas fa-times"></i>
          </button>
        ` : ''}
      </div>

      <div class="alert-body">
        <div class="alert-summary">
          ${alert.geminiAnalysis.summary || 'Alerte générée'}
        </div>

        ${alert.geminiAnalysis.canSwim !== null ? `
          <div class="swim-status swim-${alert.geminiAnalysis.canSwim ? 'ok' : 'not-ok'}">
            <i class="fas fa-swimmer"></i>
            <strong>Baignade ${alert.geminiAnalysis.canSwim ? 'autorisée' : 'non recommandée'}</strong>
          </div>
        ` : ''}

        ${alert.geminiAnalysis.issues && alert.geminiAnalysis.issues.length > 0 ? `
          <div class="alert-issues">
            <h5><i class="fas fa-exclamation-circle"></i> Problèmes détectés</h5>
            <ul>
              ${alert.geminiAnalysis.issues.map(issue => `
                <li>
                  <strong>${getMetricLabel(issue.metric)}</strong> : ${issue.problem}
                  ${issue.impact ? `<br><small>${issue.impact}</small>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${alert.geminiAnalysis.recommendations && alert.geminiAnalysis.recommendations.length > 0 ? `
          <div class="alert-recommendations">
            <h5><i class="fas fa-lightbulb"></i> Actions recommandées</h5>
            <ol>
              ${alert.geminiAnalysis.recommendations.map(rec => `
                <li class="recommendation recommendation-${rec.priority}">
                  <div class="recommendation-header">
                    <strong>${rec.action}</strong>
                    <span class="priority-badge priority-${rec.priority}">${getPriorityText(rec.priority)}</span>
                  </div>
                  <p>${rec.details}</p>
                  ${rec.quantity ? `<p class="quantity"><i class="fas fa-balance-scale"></i> ${rec.quantity}</p>` : ''}
                </li>
              `).join('')}
            </ol>
          </div>
        ` : ''}

        ${alert.geminiAnalysis.reasoning ? `
          <details class="alert-reasoning">
            <summary><i class="fas fa-brain"></i> Diagnostic détaillé</summary>
            <p>${alert.geminiAnalysis.reasoning}</p>
          </details>
        ` : ''}

        <div class="alert-measurements">
          <h6>Mesures au moment de l'alerte</h6>
          <div class="measurements-grid">
            ${alert.measurement.ph !== null ? `<div>pH: <strong>${alert.measurement.ph}</strong></div>` : ''}
            ${alert.measurement.redox !== null ? `<div>Redox: <strong>${alert.measurement.redox} mV</strong></div>` : ''}
            ${alert.measurement.temperature !== null ? `<div>Temp: <strong>${alert.measurement.temperature} °C</strong></div>` : ''}
            ${alert.measurement.salt !== null ? `<div>Sel: <strong>${alert.measurement.salt} g/L</strong></div>` : ''}
          </div>
        </div>
      </div>

      <div class="alert-footer">
        <small>
          <i class="fas fa-robot"></i> Analyse Gemini
          • ${timestamp}
        </small>
      </div>
    `;

    return card;
  }

  /**
   * Acquitte (marque comme lue) une alerte
   */
  async function acknowledgeAlert(alertId) {
    try {
      const response = await fetch(`${ACTUAL_API_URL}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Recharger les alertes
      await loadAlerts();

      // Animation de succès
      showNotification('Alerte acquittée', 'success');

    } catch (error) {
      console.error('Error acknowledging alert:', error);
      showNotification('Erreur lors de l\'acquittement', 'error');
    }
  }

  /**
   * Affiche l'état d'erreur
   */
  function displayErrorState(message) {
    const container = document.getElementById('gemini-alerts-container');
    if (container) {
      container.innerHTML = `
        <div class="alert-card alert-warning">
          <div class="alert-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="alert-content">
            <h4>Erreur de chargement</h4>
            <p>${message}</p>
            <button onclick="AlertsModule.loadAlerts()" class="btn-retry">
              <i class="fas fa-redo"></i> Réessayer
            </button>
          </div>
        </div>
      `;
    }
  }

  /**
   * Démarre le rafraîchissement automatique
   */
  function startAutoRefresh() {
    if (alertsRefreshTimer) {
      clearInterval(alertsRefreshTimer);
    }

    alertsRefreshTimer = setInterval(() => {
      loadAlerts();
    }, ALERT_REFRESH_INTERVAL);
  }

  /**
   * Arrête le rafraîchissement automatique
   */
  function stopAutoRefresh() {
    if (alertsRefreshTimer) {
      clearInterval(alertsRefreshTimer);
      alertsRefreshTimer = null;
    }
  }

  // --- Fonctions utilitaires ---

  function getSeverityIcon(severity) {
    const icons = {
      ok: 'fas fa-check-circle',
      warning: 'fas fa-exclamation-triangle',
      critical: 'fas fa-exclamation-circle'
    };
    return icons[severity] || 'fas fa-info-circle';
  }

  function getSeverityText(severity) {
    const texts = {
      ok: 'Information',
      warning: 'Attention',
      critical: 'Critique'
    };
    return texts[severity] || severity;
  }

  function getPriorityText(priority) {
    const texts = {
      high: 'Urgent',
      medium: 'Important',
      low: 'À faire'
    };
    return texts[priority] || priority;
  }

  function getMetricLabel(metric) {
    const labels = {
      ph: 'pH',
      redox: 'Redox/ORP',
      temperature: 'Température',
      salt: 'Salinité',
      system: 'Système'
    };
    return labels[metric] || metric;
  }

  function formatRelativeTime(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now - then) / 1000); // en secondes

    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return `Il y a ${Math.floor(diff / 86400)} j`;
  }

  function showNotification(message, type = 'info') {
    // Simple notification (peut être amélioré avec une bibliothèque)
    console.log(`[${type.toUpperCase()}] ${message}`);

    // TODO: Implémenter une vraie notification visuelle
    // Pour l'instant, utiliser alert comme fallback
    if (type === 'error') {
      alert(message);
    }
  }

  // API publique du module
  return {
    init,
    loadAlerts,
    acknowledgeAlert,
    stopAutoRefresh,
    get activeAlerts() { return activeAlerts; }
  };
})();

// Auto-initialisation si le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AlertsModule.init());
} else {
  AlertsModule.init();
}
