// GET /api/measurements/stats
const { pool, cache } = require('../lib/db-pool');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const hours = parseInt(req.query.hours) || 24;
    
    // Cache basé sur les heures demandées
    const cacheKey = cache.key('stats', { hours });
    let data = cache.get(cacheKey);
    
    if (!data) {
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
      data = result.rows[0];
      cache.set(cacheKey, data, cache.TTL.stats);
    }
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erreur récupération statistiques:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};