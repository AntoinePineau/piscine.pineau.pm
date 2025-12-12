const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de la base PostgreSQL (Neon, Supabase, ou autre)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Initialisation de la base de données
async function initializeDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS measurements (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        ph DECIMAL(4,2),
        redox DECIMAL(6,2),
        temperature DECIMAL(4,1),
        salt DECIMAL(4,1),
        alarm INTEGER,
        warning INTEGER,
        alarm_redox INTEGER,
        regulator_type INTEGER,
        pump_plus_active BOOLEAN,
        pump_minus_active BOOLEAN,
        pump_chlore_active BOOLEAN,
        filter_relay_active BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp);
      CREATE INDEX IF NOT EXISTS idx_measurements_created_at ON measurements(created_at);
      
      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_message TEXT NOT NULL,
        context JSONB DEFAULT '{}',
        source VARCHAR(50) DEFAULT 'unknown',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
      CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
    `;
    
    await pool.query(createTableQuery);
    console.log('Base de données PostgreSQL initialisée');
  } catch (err) {
    console.error('Erreur initialisation base de données:', err);
    throw err;
  }
}

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

    const query = `
      INSERT INTO measurements (
        timestamp, ph, redox, temperature, salt, alarm, warning, 
        alarm_redox, regulator_type, pump_plus_active, pump_minus_active,
        pump_chlore_active, filter_relay_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const values = [
      timestamp || new Date().toISOString(),
      ph, redox, temperature, salt, alarm, warning,
      alarm_redox, regulator_type, pump_plus_active, pump_minus_active,
      pump_chlore_active, filter_relay_active
    ];

    const result = await pool.query(query, values);
    
    console.log(`Mesure ajoutée avec l'ID: ${result.rows[0].id}`);
    res.status(200).json({ 
      success: true, 
      id: result.rows[0].id,
      message: 'Mesure ajoutée avec succès'
    });

  } catch (err) {
    console.error('Erreur insertion:', err);
    res.status(500).json({ error: 'Erreur lors de l\'insertion des données' });
  }
});

// GET /api/measurements - Récupérer les mesures
app.get('/api/measurements', async (req, res) => {
  try {
    const { limit = 100, offset = 0, from, to } = req.query;
    
    let query = 'SELECT * FROM measurements';
    let values = [];
    let valueIndex = 1;
    
    // Filtrage par date
    const conditions = [];
    if (from) {
      conditions.push(`timestamp >= $${valueIndex++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`timestamp <= $${valueIndex++}`);
      values.push(to);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${valueIndex++} OFFSET $${valueIndex}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Erreur récupération:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
});

// GET /api/measurements/latest - Dernière mesure
app.get('/api/measurements/latest', async (req, res) => {
  try {
    const query = 'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1';
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows[0] || null
    });

  } catch (err) {
    console.error('Erreur récupération dernière mesure:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la dernière mesure' });
  }
});

// GET /api/measurements/stats - Statistiques
app.get('/api/measurements/stats', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const query = `
      SELECT 
        COUNT(*) as count,
        AVG(ph) as avg_ph,
        MIN(ph) as min_ph,
        MAX(ph) as max_ph,
        AVG(temperature) as avg_temperature,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        AVG(redox) as avg_redox,
        MIN(redox) as min_redox,
        MAX(redox) as max_redox,
        AVG(salt) as avg_salt,
        MIN(salt) as min_salt,
        MAX(salt) as max_salt
      FROM measurements 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(hours)} hours'
    `;

    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows[0],
      period_hours: hours
    });

  } catch (err) {
    console.error('Erreur récupération stats:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// GET /api/measurements/chart-data - Données pour graphiques
app.get('/api/measurements/chart-data', async (req, res) => {
  try {
    const { hours = 24, interval = 'hour' } = req.query;
    
    let groupBy;
    switch (interval) {
      case 'minute':
        groupBy = "DATE_TRUNC('minute', timestamp)";
        break;
      case 'hour':
        groupBy = "DATE_TRUNC('hour', timestamp)";
        break;
      case 'day':
        groupBy = "DATE_TRUNC('day', timestamp)";
        break;
      default:
        groupBy = "DATE_TRUNC('hour', timestamp)";
    }
    
    const query = `
      SELECT 
        ${groupBy} as period,
        AVG(ph) as ph,
        AVG(redox) as redox,
        AVG(temperature) as temperature,
        AVG(salt) as salt,
        COUNT(*) as count
      FROM measurements 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(hours)} hours'
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `;

    const result = await pool.query(query);
    
    // Formatage des données pour Highcharts
    const chartData = {
      categories: result.rows.map(row => {
        const date = new Date(row.period);
        return interval === 'minute' 
          ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : interval === 'hour'
          ? date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit' })
          : date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      }),
      series: [
        {
          name: 'pH',
          data: result.rows.map(row => row.ph ? parseFloat(parseFloat(row.ph).toFixed(2)) : null),
          yAxis: 0
        },
        {
          name: 'Redox (mV)',
          data: result.rows.map(row => row.redox ? parseFloat(parseFloat(row.redox).toFixed(0)) : null),
          yAxis: 1
        },
        {
          name: 'Température (°C)',
          data: result.rows.map(row => row.temperature ? parseFloat(parseFloat(row.temperature).toFixed(1)) : null),
          yAxis: 2
        },
        {
          name: 'Sel (g/L)',
          data: result.rows.map(row => row.salt ? parseFloat(parseFloat(row.salt).toFixed(1)) : null),
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
    res.status(500).json({ error: 'Erreur lors de la récupération des données graphique' });
  }
});

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

    const query = `
      INSERT INTO error_logs (timestamp, error_type, error_message, context, source)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      new Date(timestamp).toISOString(),
      error_type,
      error_message,
      JSON.stringify(context || {}),
      source || 'unknown'
    ];

    const result = await pool.query(query, values);
    
    console.log(`Log d'erreur ajouté avec l'ID: ${result.rows[0].id}`);
    res.status(201).json({
      success: true,
      id: result.rows[0].id,
      message: 'Log d\'erreur enregistré'
    });

  } catch (err) {
    console.error('Erreur insertion log d\'erreur:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'enregistrement du log' 
    });
  }
});

// GET /api/error-logs - Récupérer les logs d'erreur
app.get('/api/error-logs', async (req, res) => {
  try {
    const { hours = 24, limit = 50, error_type } = req.query;
    
    let query = `
      SELECT id, timestamp, error_type, error_message, context, source, created_at
      FROM error_logs 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(hours)} hours'
    `;
    
    let values = [];
    let valueIndex = 1;
    
    if (error_type) {
      query += ` AND error_type = $${valueIndex++}`;
      values.push(error_type);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${valueIndex}`;
    values.push(parseInt(limit));

    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      period_hours: hours
    });

  } catch (err) {
    console.error('Erreur récupération logs d\'erreur:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des logs' 
    });
  }
});

// GET /api/health - Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test de connexion à la base
    await pool.query('SELECT 1');
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      error: err.message
    });
  }
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Initialize database on first request
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    await initializeDatabase();
    isInitialized = true;
  }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    await ensureInitialized();
    return app(req, res);
  } catch (error) {
    console.error('Erreur handler Vercel:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};