const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { days = 30, type = 'daily' } = req.query;
    
    if (type === 'daily') {
      // Récupérer les moyennes quotidiennes
      const query = `
        SELECT 
          date,
          avg_ph,
          avg_redox,
          avg_temperature,
          avg_salt,
          min_ph,
          max_ph,
          min_redox,
          max_redox,
          min_temperature,
          max_temperature,
          min_salt,
          max_salt,
          measurement_count
        FROM daily_averages 
        WHERE date >= NOW() - INTERVAL '${parseInt(days)} days'
        ORDER BY date ASC
      `;
      
      const result = await pool.query(query);
      
      // Formatage pour Highcharts
      const chartData = {
        categories: result.rows.map(row => {
          const date = new Date(row.date);
          return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
        }),
        series: [
          {
            name: 'pH moyen',
            data: result.rows.map(row => row.avg_ph ? parseFloat(parseFloat(row.avg_ph).toFixed(2)) : null),
            yAxis: 0
          },
          {
            name: 'Redox moyen (mV)',
            data: result.rows.map(row => row.avg_redox ? parseFloat(parseFloat(row.avg_redox).toFixed(0)) : null),
            yAxis: 1
          },
          {
            name: 'Température moyenne (°C)',
            data: result.rows.map(row => row.avg_temperature ? parseFloat(parseFloat(row.avg_temperature).toFixed(1)) : null),
            yAxis: 2
          },
          {
            name: 'Sel moyen (g/L)',
            data: result.rows.map(row => row.avg_salt ? parseFloat(parseFloat(row.avg_salt).toFixed(1)) : null),
            yAxis: 3
          }
        ]
      };
      
      res.json({
        success: true,
        data: chartData,
        raw_data: result.rows,
        period_days: days,
        type: 'daily_averages'
      });
      
    } else {
      res.status(400).json({ error: 'Type non supporté. Utilisez type=daily' });
    }

  } catch (err) {
    console.error('Erreur récupération historique:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
};