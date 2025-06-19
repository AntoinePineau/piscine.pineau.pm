const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './pool_data.db';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Base de données SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur ouverture base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite réussie');
    initializeDatabase();
  }
});

// Initialisation de la base de données
function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ph REAL,
      redox REAL,
      temperature REAL,
      salt REAL,
      alarm INTEGER,
      warning INTEGER,
      alarm_redox INTEGER,
      regulator_type INTEGER,
      pump_plus_active BOOLEAN,
      pump_minus_active BOOLEAN,
      pump_chlore_active BOOLEAN,
      filter_relay_active BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Erreur création table:', err.message);
    } else {
      console.log('Table measurements initialisée');
    }
  });
}

// Routes API

// POST /api/measurements - Ajouter une mesure
app.post('/api/measurements', (req, res) => {
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    timestamp || new Date().toISOString(),
    ph, redox, temperature, salt, alarm, warning,
    alarm_redox, regulator_type, pump_plus_active, pump_minus_active,
    pump_chlore_active, filter_relay_active
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Erreur insertion:', err.message);
      res.status(500).json({ error: 'Erreur lors de l\'insertion des données' });
    } else {
      console.log(`Mesure ajoutée avec l'ID: ${this.lastID}`);
      res.status(200).json({ 
        success: true, 
        id: this.lastID,
        message: 'Mesure ajoutée avec succès'
      });
    }
  });
});

// GET /api/measurements - Récupérer les mesures
app.get('/api/measurements', (req, res) => {
  const { limit = 100, offset = 0, from, to } = req.query;
  
  let query = 'SELECT * FROM measurements';
  let params = [];
  
  // Filtrage par date
  if (from || to) {
    const conditions = [];
    if (from) {
      conditions.push('timestamp >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('timestamp <= ?');
      params.push(to);
    }
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Erreur récupération:', err.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des données' });
    } else {
      res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    }
  });
});

// GET /api/measurements/latest - Dernière mesure
app.get('/api/measurements/latest', (req, res) => {
  const query = 'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1';
  
  db.get(query, (err, row) => {
    if (err) {
      console.error('Erreur récupération dernière mesure:', err.message);
      res.status(500).json({ error: 'Erreur lors de la récupération de la dernière mesure' });
    } else {
      res.json({
        success: true,
        data: row || null
      });
    }
  });
});

// GET /api/measurements/stats - Statistiques
app.get('/api/measurements/stats', (req, res) => {
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
    WHERE timestamp >= datetime('now', '-${hours} hours')
  `;

  db.get(query, (err, row) => {
    if (err) {
      console.error('Erreur récupération stats:', err.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    } else {
      res.json({
        success: true,
        data: row,
        period_hours: hours
      });
    }
  });
});

// GET /api/measurements/chart-data - Données pour graphiques
app.get('/api/measurements/chart-data', (req, res) => {
  const { hours = 24, interval = 'hour' } = req.query;
  
  let groupBy;
  switch (interval) {
    case 'minute':
      groupBy = "strftime('%Y-%m-%d %H:%M', timestamp)";
      break;
    case 'hour':
      groupBy = "strftime('%Y-%m-%d %H', timestamp)";
      break;
    case 'day':
      groupBy = "strftime('%Y-%m-%d', timestamp)";
      break;
    default:
      groupBy = "strftime('%Y-%m-%d %H', timestamp)";
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
    WHERE timestamp >= datetime('now', '-${hours} hours')
    GROUP BY ${groupBy}
    ORDER BY period ASC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error('Erreur récupération données graphique:', err.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des données graphique' });
    } else {
      // Formatage des données pour Highcharts
      const chartData = {
        categories: rows.map(row => row.period),
        series: [
          {
            name: 'pH',
            data: rows.map(row => parseFloat(row.ph?.toFixed(2)) || null),
            yAxis: 0
          },
          {
            name: 'Redox (mV)',
            data: rows.map(row => parseFloat(row.redox?.toFixed(0)) || null),
            yAxis: 1
          },
          {
            name: 'Température (°C)',
            data: rows.map(row => parseFloat(row.temperature?.toFixed(1)) || null),
            yAxis: 2
          },
          {
            name: 'Sel (g/L)',
            data: rows.map(row => parseFloat(row.salt?.toFixed(1)) || null),
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
    }
  });
});

// GET /api/health - Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../web')));

// Route par défaut pour le frontend
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../web/index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint non trouvé' });
  }
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Fermeture propre de la base de données
process.on('SIGINT', () => {
  console.log('\nFermeture de la base de données...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Base de données fermée.');
    }
    process.exit(0);
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur API démarré sur le port ${PORT}`);
  console.log(`Base de données: ${DB_PATH}`);
});