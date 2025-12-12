const { getGeminiService } = require('./gemini');
const { getDriveService } = require('./google-drive');

/**
 * Analyseur d'alertes intelligent pour surveiller les mesures de piscine
 * Détecte les anomalies et génère des alertes avec conseils Gemini
 */

// Seuils de surveillance pour déclencher les alertes
const THRESHOLDS = {
  ph: {
    min: 7.0,
    max: 7.6,
    critical_min: 6.8,
    critical_max: 7.8,
  },
  redox: {
    min: 650,
    max: 750,
    critical_min: 550,
    critical_max: 850,
  },
  temperature: {
    min: 15,
    max: 32,
    critical_min: 10,
    critical_max: 35,
  },
  salt: {
    min: 3.0,
    max: 5.0,
    critical_min: 2.0,
    critical_max: 6.0,
  },
};

// Temps minimum entre deux alertes similaires (en millisecondes)
const ALERT_COOLDOWN = 3 * 60 * 60 * 1000; // 3 heures

class AlertAnalyzer {
  constructor() {
    this.geminiService = getGeminiService();
    this.driveService = getDriveService();
    this.lastAlerts = new Map(); // Cache des dernières alertes pour éviter spam
  }

  /**
   * Analyse une nouvelle mesure et génère une alerte si nécessaire
   * @param {Object} measurement - Mesure actuelle
   * @returns {Promise<Object|null>} Alerte générée ou null
   */
  async analyzeMeasurement(measurement) {
    try {
      // 1. Vérifier s'il y a des problèmes détectés
      const issues = this._detectIssues(measurement);

      if (issues.length === 0 && !measurement.alarm && !measurement.warning) {
        // Tout va bien, pas d'alerte
        return null;
      }

      // 2. Vérifier le cooldown (éviter spam d'alertes)
      const alertKey = this._generateAlertKey(issues, measurement);
      if (this._isInCooldown(alertKey)) {
        console.log(`Alert in cooldown: ${alertKey}`);
        return null;
      }

      // 3. Récupérer l'historique récent pour contexte
      const recentHistory = await this.driveService.getLatestEntries('measurements', 20);

      // 4. Demander l'analyse à Gemini
      let geminiAnalysis;
      if (measurement.alarm || measurement.warning || measurement.alarm_redox) {
        // Alarme système - diagnostic approfondi
        const alarmHistory = recentHistory.filter(m => m.alarm || m.warning);
        geminiAnalysis = await this.geminiService.diagnoseSystemAlarms(measurement, alarmHistory);
      } else {
        // Problème de paramètres eau
        geminiAnalysis = await this.geminiService.analyzeMeasurement(measurement, recentHistory);
      }

      // 5. Créer l'objet alerte
      const alert = {
        id: this._generateAlertId(),
        timestamp: new Date().toISOString(),
        severity: geminiAnalysis.severity || this._calculateSeverity(issues),
        issues: issues,
        measurement: {
          ph: measurement.ph,
          redox: measurement.redox,
          temperature: measurement.temperature,
          salt: measurement.salt,
          alarm: measurement.alarm,
          warning: measurement.warning,
          alarm_redox: measurement.alarm_redox,
        },
        geminiAnalysis: geminiAnalysis,
        notified: false,
        acknowledged: false,
      };

      // 6. Sauvegarder l'alerte
      await this.driveService.appendEntry('alerts', alert);

      // 7. Mettre à jour le cache de cooldown
      this._updateCooldown(alertKey);

      console.log(`🚨 Alert generated: ${alert.severity} - ${alert.id}`);
      return alert;

    } catch (error) {
      console.error('Error analyzing measurement for alerts:', error);
      return null;
    }
  }

  /**
   * Récupère les alertes actives (non acquittées)
   */
  async getActiveAlerts() {
    try {
      const allAlerts = await this.driveService.getLatestEntries('alerts', 100);
      return allAlerts.filter(alert => !alert.acknowledged);
    } catch (error) {
      console.error('Error getting active alerts:', error);
      return [];
    }
  }

  /**
   * Récupère les alertes récentes (dernières 24h)
   */
  async getRecentAlerts(hours = 24) {
    try {
      const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      const toDate = new Date();
      return await this.driveService.getEntriesByDateRange('alerts', fromDate, toDate);
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Acquitte une alerte (marque comme lue/traitée)
   */
  async acknowledgeAlert(alertId) {
    try {
      const allAlerts = await this.driveService.readJSON('alerts');
      const alert = allAlerts.data.find(a => a.id === alertId);

      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();

      await this.driveService.writeJSON('alerts', allAlerts);
      return alert;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Détecte les problèmes dans une mesure
   */
  _detectIssues(measurement) {
    const issues = [];

    // Vérifier pH
    if (measurement.ph !== null) {
      if (measurement.ph < THRESHOLDS.ph.critical_min || measurement.ph > THRESHOLDS.ph.critical_max) {
        issues.push({
          metric: 'ph',
          value: measurement.ph,
          severity: 'critical',
          message: `pH critique : ${measurement.ph}`,
        });
      } else if (measurement.ph < THRESHOLDS.ph.min || measurement.ph > THRESHOLDS.ph.max) {
        issues.push({
          metric: 'ph',
          value: measurement.ph,
          severity: 'warning',
          message: `pH hors plage optimale : ${measurement.ph}`,
        });
      }
    }

    // Vérifier Redox
    if (measurement.redox !== null) {
      if (measurement.redox < THRESHOLDS.redox.critical_min) {
        issues.push({
          metric: 'redox',
          value: measurement.redox,
          severity: 'critical',
          message: `Redox très bas (désinfection insuffisante) : ${measurement.redox} mV`,
        });
      } else if (measurement.redox < THRESHOLDS.redox.min) {
        issues.push({
          metric: 'redox',
          value: measurement.redox,
          severity: 'warning',
          message: `Redox bas : ${measurement.redox} mV`,
        });
      } else if (measurement.redox > THRESHOLDS.redox.critical_max) {
        issues.push({
          metric: 'redox',
          value: measurement.redox,
          severity: 'warning',
          message: `Redox très élevé : ${measurement.redox} mV`,
        });
      }
    }

    // Vérifier température
    if (measurement.temperature !== null) {
      if (measurement.temperature < THRESHOLDS.temperature.critical_min ||
          measurement.temperature > THRESHOLDS.temperature.critical_max) {
        issues.push({
          metric: 'temperature',
          value: measurement.temperature,
          severity: 'warning',
          message: `Température extrême : ${measurement.temperature} °C`,
        });
      }
    }

    // Vérifier salinité
    if (measurement.salt !== null) {
      if (measurement.salt < THRESHOLDS.salt.critical_min ||
          measurement.salt > THRESHOLDS.salt.critical_max) {
        issues.push({
          metric: 'salt',
          value: measurement.salt,
          severity: 'warning',
          message: `Salinité anormale : ${measurement.salt} g/L`,
        });
      }
    }

    // Vérifier alarmes système
    if (measurement.alarm) {
      issues.push({
        metric: 'system',
        value: 'alarm',
        severity: 'critical',
        message: 'Alarme système active',
      });
    }

    if (measurement.warning) {
      issues.push({
        metric: 'system',
        value: 'warning',
        severity: 'warning',
        message: 'Avertissement système actif',
      });
    }

    if (measurement.alarm_redox) {
      issues.push({
        metric: 'redox',
        value: 'alarm',
        severity: 'critical',
        message: 'Alarme Redox active',
      });
    }

    return issues;
  }

  /**
   * Calcule la sévérité globale
   */
  _calculateSeverity(issues) {
    if (issues.length === 0) return 'ok';
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    return 'warning';
  }

  /**
   * Génère une clé unique pour identifier le type d'alerte
   */
  _generateAlertKey(issues, measurement) {
    const metrics = issues.map(i => i.metric).sort().join('-');
    const alarms = [
      measurement.alarm && 'alarm',
      measurement.warning && 'warning',
      measurement.alarm_redox && 'alarm_redox'
    ].filter(Boolean).join('-');

    return `${metrics}|${alarms}`;
  }

  /**
   * Vérifie si une alerte est en cooldown
   */
  _isInCooldown(alertKey) {
    const lastAlert = this.lastAlerts.get(alertKey);
    if (!lastAlert) return false;

    const timeSinceLastAlert = Date.now() - lastAlert;
    return timeSinceLastAlert < ALERT_COOLDOWN;
  }

  /**
   * Met à jour le timestamp de la dernière alerte
   */
  _updateCooldown(alertKey) {
    this.lastAlerts.set(alertKey, Date.now());
  }

  /**
   * Génère un ID unique pour l'alerte
   */
  _generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Nettoie le cache de cooldown (appeler périodiquement)
   */
  cleanupCooldownCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.lastAlerts.entries()) {
      if (now - timestamp > ALERT_COOLDOWN * 2) {
        this.lastAlerts.delete(key);
      }
    }
  }
}

// Singleton
let alertAnalyzerInstance = null;

function getAlertAnalyzer() {
  if (!alertAnalyzerInstance) {
    alertAnalyzerInstance = new AlertAnalyzer();
  }
  return alertAnalyzerInstance;
}

module.exports = {
  AlertAnalyzer,
  getAlertAnalyzer,
  THRESHOLDS,
};
