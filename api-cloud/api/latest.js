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
};