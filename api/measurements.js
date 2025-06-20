// API endpoint for Raspberry Pi measurements
const { Pool } = require('pg');

// Configuration de la base PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // POST - Ajouter une mesure (pour Raspberry Pi)
    try {
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const values = [
        timestamp || new Date().toISOString(),
        ph, redox, temperature, salt, alarm, warning,
        alarm_redox, regulator_type, pump_plus_active, pump_minus_active,
        pump_chlore_active, filter_relay_active
      ];

      const result = await pool.query(query, values);
      
      console.log(`✅ Mesure ajoutée avec l'ID: ${result.rows[0].id} - pH=${ph}, T=${temperature}°C`);
      res.status(200).json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Mesure ajoutée avec succès'
      });

    } catch (err) {
      console.error('❌ Erreur insertion:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de l\'insertion des données' 
      });
    }
  } else {
    // GET - Récupérer les mesures
    res.status(405).json({ error: 'Méthode non autorisée' });
  }
};