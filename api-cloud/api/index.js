const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const { getStorageService } = require('../lib/storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Logging uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000
});
app.use('/api/', limiter);

// Storage service
let storage = null;

function getStorage() {
  if (!storage) {
    storage = getStorageService();
  }
  return storage;
}

// ==================== MEASUREMENTS ====================

// POST /api/measurements - Ajouter une mesure
app.post('/api/measurements', async (req, res) => {
  try {
    const {
      timestamp,
      ph,
      redox,
      temperature,
      salt,
      alarm,
      warning,
      alarm_redox,
      regulator_type,
      pump_plus_active,
      pump_minus_active,
      pump_chlore_active,
      filter_relay_active
    } = req.body;

    const measurement = {
      timestamp,
      ph,
      redox,
      temperature,
      salt,
      alarm,
      warning,
      alarm_redox,
      regulator_type,
      pump_plus_active,
      pump_minus_active,
      pump_chlore_active,
      filter_relay_active
    };

    const result = await getStorage().insertMeasurement(measurement);

    console.log(`Mesure ajoutée: ${result.timestamp}`);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Mesure ajoutée avec succès'
    });

  } catch (err) {
    console.error('Erreur insertion:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'insertion des données',
      message: err.message
    });
  }
});

// GET /api/measurements - Récupérer les mesures
app.get('/api/measurements', async (req, res) => {
  try {
    const { limit, offset, from, to } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      from,
      to
    };

    const result = await getStorage().getMeasurements(options);

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      count: result.data.length,
      limit: result.limit,
      offset: result.offset
    });

  } catch (err) {
    console.error('Erreur récupération:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données',
      message: err.message
    });
  }
});

// GET /api/measurements/latest - Dernière mesure
app.get('/api/measurements/latest', async (req, res) => {
  try {
    const latest = await getStorage().getLatestMeasurement();

    res.json({
      success: true,
      data: latest
    });

  } catch (err) {
    console.error('Erreur récupération dernière mesure:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la dernière mesure',
      message: err.message
    });
  }
});

// GET /api/measurements/stats - Statistiques
app.get('/api/measurements/stats', async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours) : 24;

    const stats = await getStorage().getStats(hours);

    res.json({
      success: true,
      data: stats,
      period_hours: hours
    });

  } catch (err) {
    console.error('Erreur récupération stats:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
      message: err.message
    });
  }
});

// GET /api/measurements/chart-data - Données pour graphiques
app.get('/api/measurements/chart-data', async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours) : 24;
    const interval = req.query.interval || 'hour';

    const data = await getStorage().getChartData({ hours, interval });

    // Formatage des données pour Highcharts
    const chartData = {
      categories: data.map(row => {
        const date = new Date(row.timestamp);
        return interval === 'minute'
          ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : interval === 'hour'
          ? date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit' })
          : date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      }),
      series: [
        {
          name: 'pH',
          data: data.map(row => row.ph),
          yAxis: 0
        },
        {
          name: 'Redox (mV)',
          data: data.map(row => row.redox),
          yAxis: 1
        },
        {
          name: 'Température (°C)',
          data: data.map(row => row.temperature),
          yAxis: 2
        },
        {
          name: 'Sel (g/L)',
          data: data.map(row => row.salt),
          yAxis: 3
        }
      ]
    };

    res.json({
      success: true,
      data: chartData,
      period_hours: hours,
      interval: interval
    });

  } catch (err) {
    console.error('Erreur récupération données graphique:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données graphique',
      message: err.message
    });
  }
});

// GET /api/measurements/history - Historique (moyennes journalières)
app.get('/api/measurements/history', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;

    const history = await getStorage().getDailyAverages(days);

    res.json({
      success: true,
      data: history,
      count: history.length,
      period_days: days
    });

  } catch (err) {
    console.error('Erreur récupération historique:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique',
      message: err.message
    });
  }
});

// ==================== ERROR LOGS ====================

// POST /api/error-logs - Ajouter un log d'erreur
app.post('/api/error-logs', async (req, res) => {
  try {
    const { timestamp, error_type, error_message, context, source } = req.body;

    if (!timestamp || !error_type || !error_message) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes (timestamp, error_type, error_message requis)'
      });
    }

    const error = {
      timestamp,
      error_type,
      error_message,
      context,
      source
    };

    const result = await getStorage().logError(error);

    console.log(`Log d'erreur ajouté: ${result.timestamp}`);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Log d\'erreur enregistré'
    });

  } catch (err) {
    console.error('Erreur insertion log d\'erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement du log',
      message: err.message
    });
  }
});

// GET /api/error-logs - Récupérer les logs d'erreur
app.get('/api/error-logs', async (req, res) => {
  try {
    const { hours, limit, error_type } = req.query;

    const options = {
      hours: hours ? parseInt(hours) : 24,
      limit: limit ? parseInt(limit) : 50,
      error_type
    };

    const logs = await getStorage().getErrorLogs(options);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
      period_hours: options.hours
    });

  } catch (err) {
    console.error('Erreur récupération logs d\'erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des logs',
      message: err.message
    });
  }
});

// ==================== ALERTS ====================

// GET /api/alerts - Récupérer les alertes actives
app.get('/api/alerts', async (req, res) => {
  try {
    const { active } = req.query;

    let alerts;
    if (active === 'true') {
      alerts = await getStorage().getActiveAlerts();
    } else {
      const hours = req.query.hours ? parseInt(req.query.hours) : 24;
      alerts = await getStorage().getRecentAlerts(hours);
    }

    res.json({
      success: true,
      data: alerts
    });

  } catch (err) {
    console.error('Erreur récupération alertes:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des alertes',
      message: err.message
    });
  }
});

// POST /api/alerts/:id/acknowledge - Acquitter une alerte
app.post('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getStorage().acknowledgeAlert(id);

    res.json({
      success: true,
      data: result,
      message: 'Alerte acquittée avec succès'
    });

  } catch (err) {
    console.error('Erreur acquittement alerte:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'acquittement de l\'alerte',
      message: err.message
    });
  }
});

// ==================== MAINTENANCE ====================

// POST /api/cron - Tâche de maintenance quotidienne
app.post('/api/cron', async (req, res) => {
  try {
    // Vérifier le secret
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const result = await getStorage().performMaintenance();

    console.log('Maintenance effectuée:', result);
    res.json({
      success: true,
      ...result,
      message: 'Maintenance effectuée avec succès'
    });

  } catch (err) {
    console.error('Erreur maintenance:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la maintenance',
      message: err.message
    });
  }
});

// ==================== HEALTH CHECK ====================

// GET /api/health - Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test de connexion à Google Drive
    const storage = getStorage();
    const latest = await storage.getLatestMeasurement();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      storage: 'connected',
      lastMeasurement: latest ? latest.timestamp : null
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      storage: 'disconnected',
      error: err.message
    });
  }
});

// ==================== ERROR HANDLERS ====================

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trouvé'
  });
});

// Démarrage serveur local (si pas sur Vercel)
if (require.main === module || process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 API démarrée sur http://localhost:${PORT}`);
    console.log(`📊 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Storage: Google Drive JSON`);
  });
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Erreur handler Vercel:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
};
