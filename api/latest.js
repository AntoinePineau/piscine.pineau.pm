// GET /api/measurements/latest
const { pool, cache } = require('../lib/db-pool');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Vérifier le cache d'abord
    const cacheKey = cache.key('latest');
    let data = cache.get(cacheKey);
    
    if (!data) {
      // Seulement si pas en cache
      const query = 'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1';
      const result = await pool.query(query);
      
      if (result.rows.length === 0) {
        return res.json({ success: false, message: 'Aucune donnée trouvée' });
      }
      
      data = result.rows[0];
      cache.set(cacheKey, data, cache.TTL.latest);
    }
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erreur récupération dernière mesure:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};