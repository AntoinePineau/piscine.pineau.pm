// GET /api/measurements/latest
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
    const query = 'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1';
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Aucune donnée trouvée' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur récupération dernière mesure:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};