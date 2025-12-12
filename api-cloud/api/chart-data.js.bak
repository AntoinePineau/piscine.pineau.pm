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
};