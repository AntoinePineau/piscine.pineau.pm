const express = require('express');
const { getStorageService } = require('../lib/storage');

const router = express.Router();

/**
 * GET /api/alerts
 * Récupère les alertes actives ou récentes
 *
 * Query params:
 *  - active=true : Seulement les alertes non acquittées
 *  - hours=24 : Alertes des dernières X heures
 */
router.get('/', async (req, res) => {
  try {
    const storage = getStorageService();
    const { active, hours } = req.query;

    let alerts;

    if (active === 'true') {
      alerts = await storage.getActiveAlerts();
    } else {
      const hoursNum = hours ? parseInt(hours) : 24;
      alerts = await storage.getRecentAlerts(hoursNum);
    }

    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts,
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error.message,
    });
  }
});

/**
 * GET /api/alerts/:id
 * Récupère une alerte spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const storage = getStorageService();
    const allAlerts = await storage.getRecentAlerts(24 * 30); // 30 jours

    const alert = allAlerts.find(a => a.id === req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      alert: alert,
    });

  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert',
      message: error.message,
    });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acquitte une alerte (marque comme lue/traitée)
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const storage = getStorageService();
    const alert = await storage.acknowledgeAlert(req.params.id);

    res.json({
      success: true,
      alert: alert,
      message: 'Alert acknowledged successfully',
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error.message,
    });
  }
});

/**
 * GET /api/alerts/stats
 * Statistiques sur les alertes
 */
router.get('/stats', async (req, res) => {
  try {
    const storage = getStorageService();
    const hours = req.query.hours ? parseInt(req.query.hours) : 24 * 7; // 7 jours par défaut

    const allAlerts = await storage.getRecentAlerts(hours);
    const activeAlerts = await storage.getActiveAlerts();

    // Statistiques par sévérité
    const bySeverity = {
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      warning: allAlerts.filter(a => a.severity === 'warning').length,
      ok: allAlerts.filter(a => a.severity === 'ok').length,
    };

    // Statistiques par métrique
    const byMetric = {};
    allAlerts.forEach(alert => {
      alert.issues.forEach(issue => {
        byMetric[issue.metric] = (byMetric[issue.metric] || 0) + 1;
      });
    });

    res.json({
      success: true,
      period_hours: hours,
      stats: {
        total: allAlerts.length,
        active: activeAlerts.length,
        acknowledged: allAlerts.filter(a => a.acknowledged).length,
        bySeverity: bySeverity,
        byMetric: byMetric,
      },
    });

  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert stats',
      message: error.message,
    });
  }
});

module.exports = router;
