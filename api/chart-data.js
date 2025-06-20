// GET /api/measurements/chart-data
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
};