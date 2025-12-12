const { getDriveService } = require('./google-drive');
const { getAlertAnalyzer } = require('./alert-analyzer');
const { getEmailService } = require('./email-service');

/**
 * Couche d'abstraction de stockage
 * Remplace PostgreSQL par Google Drive + JSON
 * API compatible avec l'ancien système pour faciliter la migration
 */

class StorageService {
  constructor() {
    this.drive = getDriveService();
    this.alertAnalyzer = getAlertAnalyzer();
    this.emailService = getEmailService();
    this.cache = new Map();
    this.cacheTTL = {
      latest: 30 * 1000, // 30 secondes
      stats: 5 * 60 * 1000, // 5 minutes
      charts: 10 * 60 * 1000, // 10 minutes
    };
  }

  // ==================== MEASUREMENTS ====================

  /**
   * Insère une nouvelle mesure
   * @param {Object} measurement
   * @returns {Promise<Object>}
   */
  async insertMeasurement(measurement) {
    const entry = {
      ...measurement,
      timestamp: measurement.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Sauvegarder la mesure
    await this.drive.appendEntry('measurements', entry);

    // Invalider le cache
    this.cache.delete('latest');
    this.cache.delete('stats');
    this.cache.delete('charts');

    // Analyser pour détecter les alertes
    try {
      const alert = await this.alertAnalyzer.analyzeMeasurement(entry);

      // Si une alerte est générée, envoyer l'email
      if (alert && alert.severity !== 'ok') {
        await this.emailService.sendAlert(alert);
      }
    } catch (error) {
      console.error('Error analyzing measurement for alerts:', error);
      // Ne pas bloquer l'insertion si l'analyse échoue
    }

    return entry;
  }

  /**
   * Récupère la dernière mesure
   */
  async getLatestMeasurement() {
    const cached = this._getCached('latest');
    if (cached) return cached;

    const latest = await this.drive.getLatestEntry('measurements');
    this._setCached('latest', latest, this.cacheTTL.latest);

    return latest;
  }

  /**
   * Récupère les mesures avec pagination et filtres
   * @param {Object} options - { limit, offset, from, to }
   */
  async getMeasurements(options = {}) {
    const { limit = 100, offset = 0, from, to } = options;

    let measurements;

    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to) : new Date();
      measurements = await this.drive.getEntriesByDateRange('measurements', fromDate, toDate);
    } else {
      measurements = await this.drive.getLatestEntries('measurements', limit + offset);
    }

    // Appliquer offset et limit
    const result = measurements.slice(offset, offset + limit);

    return {
      data: result,
      total: measurements.length,
      limit,
      offset,
    };
  }

  /**
   * Calcule les statistiques sur une période
   * @param {number} hours - Nombre d'heures
   */
  async getStats(hours = 24) {
    const cacheKey = `stats-${hours}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    const measurements = await this.drive.getEntriesByDateRange('measurements', fromDate, toDate);

    if (measurements.length === 0) {
      return {
        count: 0,
        period_hours: hours,
        ph: null,
        redox: null,
        temperature: null,
        salt: null,
      };
    }

    const stats = {
      count: measurements.length,
      period_hours: hours,
      ph: this._calculateMetricStats(measurements, 'ph'),
      redox: this._calculateMetricStats(measurements, 'redox'),
      temperature: this._calculateMetricStats(measurements, 'temperature'),
      salt: this._calculateMetricStats(measurements, 'salt'),
    };

    this._setCached(cacheKey, stats, this.cacheTTL.stats);
    return stats;
  }

  /**
   * Récupère les données pour les graphiques
   * @param {Object} options - { hours, interval }
   */
  async getChartData(options = {}) {
    const { hours = 24, interval = 'hour' } = options;
    const cacheKey = `charts-${hours}-${interval}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    const measurements = await this.drive.getEntriesByDateRange('measurements', fromDate, toDate);

    if (measurements.length === 0) {
      return [];
    }

    // Grouper par intervalle
    const grouped = this._groupByInterval(measurements, interval);

    this._setCached(cacheKey, grouped, this.cacheTTL.charts);
    return grouped;
  }

  // ==================== DAILY AVERAGES ====================

  /**
   * Récupère l'historique des moyennes journalières
   * @param {number} days - Nombre de jours
   */
  async getDailyAverages(days = 30) {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const averages = await this.drive.getEntriesByDateRange('dailyAverages', fromDate, toDate);
    return averages.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Crée une moyenne journalière à partir des mesures
   * @param {Date} date
   */
  async createDailyAverage(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const measurements = await this.drive.getEntriesByDateRange('measurements', startOfDay, endOfDay);

    if (measurements.length === 0) {
      return null;
    }

    const average = {
      date: startOfDay.toISOString().split('T')[0],
      avg_ph: this._calculateAverage(measurements, 'ph'),
      avg_redox: this._calculateAverage(measurements, 'redox'),
      avg_temperature: this._calculateAverage(measurements, 'temperature'),
      avg_salt: this._calculateAverage(measurements, 'salt'),
      min_ph: this._calculateMin(measurements, 'ph'),
      max_ph: this._calculateMax(measurements, 'ph'),
      min_redox: this._calculateMin(measurements, 'redox'),
      max_redox: this._calculateMax(measurements, 'redox'),
      min_temperature: this._calculateMin(measurements, 'temperature'),
      max_temperature: this._calculateMax(measurements, 'temperature'),
      min_salt: this._calculateMin(measurements, 'salt'),
      max_salt: this._calculateMax(measurements, 'salt'),
      measurement_count: measurements.length,
      created_at: new Date().toISOString(),
    };

    await this.drive.appendEntry('dailyAverages', average);
    return average;
  }

  // ==================== ERROR LOGS ====================

  /**
   * Enregistre une erreur
   */
  async logError(error) {
    const entry = {
      timestamp: error.timestamp || new Date().toISOString(),
      error_type: error.error_type || 'unknown',
      error_message: error.error_message || error.message || '',
      context: error.context || {},
      source: error.source || 'api',
      created_at: new Date().toISOString(),
    };

    await this.drive.appendEntry('errorLogs', entry);
    return entry;
  }

  /**
   * Récupère les logs d'erreur
   */
  async getErrorLogs(options = {}) {
    const { hours = 24, limit = 50, error_type } = options;

    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    let logs = await this.drive.getEntriesByDateRange('errorLogs', fromDate, toDate);

    // Filtrer par type si spécifié
    if (error_type) {
      logs = logs.filter(log => log.error_type === error_type);
    }

    return logs.slice(0, limit);
  }

  // ==================== ALERTS ====================

  /**
   * Récupère les alertes actives
   */
  async getActiveAlerts() {
    return await this.alertAnalyzer.getActiveAlerts();
  }

  /**
   * Récupère les alertes récentes
   */
  async getRecentAlerts(hours = 24) {
    return await this.alertAnalyzer.getRecentAlerts(hours);
  }

  /**
   * Acquitte une alerte
   */
  async acknowledgeAlert(alertId) {
    return await this.alertAnalyzer.acknowledgeAlert(alertId);
  }

  // ==================== MAINTENANCE ====================

  /**
   * Nettoie les anciennes mesures et crée les moyennes journalières
   */
  async performMaintenance() {
    console.log('Starting maintenance...');

    try {
      // 1. Créer les moyennes journalières pour hier
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await this.createDailyAverage(yesterday);

      // 2. Nettoyer les anciennes mesures (garder seulement 7 jours)
      const allMeasurements = await this.drive.readJSON('measurements');
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentMeasurements = allMeasurements.data.filter(m => {
        return new Date(m.timestamp) > sevenDaysAgo;
      });

      const deletedCount = allMeasurements.data.length - recentMeasurements.length;

      allMeasurements.data = recentMeasurements;
      allMeasurements.count = recentMeasurements.length;
      allMeasurements.lastUpdated = new Date().toISOString();

      await this.drive.writeJSON('measurements', allMeasurements);

      // 3. Nettoyer les anciennes alertes (garder seulement 60 jours)
      const allAlerts = await this.drive.readJSON('alerts');
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const recentAlerts = allAlerts.data.filter(a => {
        return new Date(a.timestamp) > sixtyDaysAgo;
      });

      allAlerts.data = recentAlerts;
      allAlerts.count = recentAlerts.length;
      allAlerts.lastUpdated = new Date().toISOString();

      await this.drive.writeJSON('alerts', allAlerts);

      console.log(`Maintenance completed: ${deletedCount} measurements archived`);

      return {
        success: true,
        measurementsArchived: deletedCount,
        measurementsRemaining: recentMeasurements.length,
        alertsCleaned: allAlerts.data.length,
      };

    } catch (error) {
      console.error('Maintenance error:', error);
      throw error;
    }
  }

  // ==================== HELPERS ====================

  _calculateMetricStats(measurements, metric) {
    const values = measurements
      .map(m => m[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;

    return {
      avg: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      min: parseFloat(Math.min(...values).toFixed(2)),
      max: parseFloat(Math.max(...values).toFixed(2)),
    };
  }

  _calculateAverage(measurements, metric) {
    const values = measurements
      .map(m => m[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;
    return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
  }

  _calculateMin(measurements, metric) {
    const values = measurements
      .map(m => m[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;
    return parseFloat(Math.min(...values).toFixed(2));
  }

  _calculateMax(measurements, metric) {
    const values = measurements
      .map(m => m[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;
    return parseFloat(Math.max(...values).toFixed(2));
  }

  _groupByInterval(measurements, interval) {
    const groups = new Map();

    measurements.forEach(m => {
      const date = new Date(m.timestamp);
      let key;

      switch (interval) {
        case 'minute':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
            date.getHours(), date.getMinutes()).getTime();
          break;
        case 'hour':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
            date.getHours()).getTime();
          break;
        case 'day':
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          break;
        default:
          key = date.getTime();
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(m);
    });

    // Calculer les moyennes pour chaque groupe
    const result = [];
    for (const [timestamp, groupMeasurements] of groups) {
      result.push({
        timestamp: new Date(timestamp).toISOString(),
        ph: this._calculateAverage(groupMeasurements, 'ph'),
        redox: this._calculateAverage(groupMeasurements, 'redox'),
        temperature: this._calculateAverage(groupMeasurements, 'temperature'),
        salt: this._calculateAverage(groupMeasurements, 'salt'),
        count: groupMeasurements.length,
      });
    }

    return result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  _getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const { data, expires } = cached;
    if (Date.now() > expires) {
      this.cache.delete(key);
      return null;
    }

    return data;
  }

  _setCached(key, data, ttl) {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

// Singleton
let storageServiceInstance = null;

function getStorageService() {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

module.exports = {
  StorageService,
  getStorageService,
};
