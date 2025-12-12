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
};