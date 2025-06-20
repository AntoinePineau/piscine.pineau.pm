// Proxy pour toutes les routes /api/measurements/*
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Configuration de la base PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Routes measurements
// GET /api/measurements/latest
app.get('/latest', async (req, res) => {
  try {
    const query = `
      SELECT * FROM measurements 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Aucune donnée trouvée' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur récupération dernière mesure:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/measurements/stats
app.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    const query = `
      SELECT 
        MIN(ph) as min_ph, MAX(ph) as max_ph, AVG(ph) as avg_ph,
        MIN(temperature) as min_temperature, MAX(temperature) as max_temperature, AVG(temperature) as avg_temperature,
        MIN(redox) as min_redox, MAX(redox) as max_redox, AVG(redox) as avg_redox,
        MIN(salt) as min_salt, MAX(salt) as max_salt, AVG(salt) as avg_salt,
        COUNT(*) as total_measurements
      FROM measurements 
      WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
    `;
    
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur récupération statistiques:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/measurements/chart-data
app.get('/chart-data', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const interval = req.query.interval || 'hour';
    
    let timeFormat;
    let intervalStr;
    
    switch (interval) {
      case 'minute':
        timeFormat = 'YYYY-MM-DD HH24:MI';
        intervalStr = '5 minutes';
        break;
      case 'hour':
        timeFormat = 'YYYY-MM-DD HH24:00';
        intervalStr = '1 hour';
        break;
      case 'day':
        timeFormat = 'YYYY-MM-DD';
        intervalStr = '1 day';
        break;
      default:
        timeFormat = 'YYYY-MM-DD HH24:00';
        intervalStr = '1 hour';
    }
    
    const query = `
      SELECT 
        TO_CHAR(date_trunc('${interval}', timestamp), '${timeFormat}') as time_period,
        AVG(ph) as avg_ph,
        AVG(temperature) as avg_temperature,
        AVG(redox) as avg_redox,
        AVG(salt) as avg_salt
      FROM measurements 
      WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
      GROUP BY date_trunc('${interval}', timestamp)
      ORDER BY date_trunc('${interval}', timestamp)
    `;
    
    const result = await pool.query(query);
    
    const categories = result.rows.map(row => row.time_period);
    const series = [
      {
        name: 'pH',
        data: result.rows.map(row => row.avg_ph ? parseFloat(row.avg_ph) : null)
      },
      {
        name: 'Température (°C)',
        data: result.rows.map(row => row.avg_temperature ? parseFloat(row.avg_temperature) : null)
      },
      {
        name: 'Redox (mV)',
        data: result.rows.map(row => row.avg_redox ? parseFloat(row.avg_redox) : null)
      },
      {
        name: 'Sel (g/L)',
        data: result.rows.map(row => row.avg_salt ? parseFloat(row.avg_salt) : null)
      }
    ];
    
    res.json({ 
      success: true, 
      data: { categories, series }
    });
  } catch (err) {
    console.error('Erreur récupération données graphiques:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = app;