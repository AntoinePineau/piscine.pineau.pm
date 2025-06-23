// API endpoint for error logging
const { Pool } = require('pg');

// Configuration de la base PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialisation de la table error_logs
async function ensureErrorLogsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_message TEXT NOT NULL,
        context JSONB DEFAULT '{}',
        source VARCHAR(50) DEFAULT 'unknown',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
      CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Table error_logs initialisée');
  } catch (err) {
    console.error('❌ Erreur initialisation table error_logs:', err);
  }
}

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Assurer que la table existe
  await ensureErrorLogsTable();

  if (req.method === 'POST') {
    // POST - Ajouter un log d'erreur
    try {
      const { timestamp, error_type, error_message, context, source } = req.body;

      if (!timestamp || !error_type || !error_message) {
        return res.status(400).json({
          success: false,
          error: 'Données manquantes (timestamp, error_type, error_message requis)'
        });
      }

      const query = `
        INSERT INTO error_logs (timestamp, error_type, error_message, context, source)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const values = [
        new Date(timestamp).toISOString(),
        error_type,
        error_message,
        JSON.stringify(context || {}),
        source || 'unknown'
      ];

      const result = await pool.query(query, values);
      
      console.log(`✅ Log d'erreur ajouté avec l'ID: ${result.rows[0].id} - Type: ${error_type}`);
      res.status(201).json({
        success: true,
        id: result.rows[0].id,
        message: 'Log d\'erreur enregistré'
      });

    } catch (err) {
      console.error('❌ Erreur insertion log d\'erreur:', err);
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de l\'enregistrement du log' 
      });
    }

  } else if (req.method === 'GET') {
    // GET - Récupérer les logs d'erreur
    try {
      const { hours = 24, limit = 50, error_type } = req.query;
      
      let query = `
        SELECT id, timestamp, error_type, error_message, context, source, created_at
        FROM error_logs 
        WHERE timestamp >= NOW() - INTERVAL '${parseInt(hours)} hours'
      `;
      
      let values = [];
      let valueIndex = 1;
      
      if (error_type) {
        query += ` AND error_type = $${valueIndex++}`;
        values.push(error_type);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT $${valueIndex}`;
      values.push(parseInt(limit));

      const result = await pool.query(query, values);
      
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
        period_hours: hours
      });

    } catch (err) {
      console.error('❌ Erreur récupération logs d\'erreur:', err);
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la récupération des logs' 
      });
    }

  } else {
    res.status(405).json({ 
      success: false,
      error: 'Méthode non autorisée' 
    });
  }
};