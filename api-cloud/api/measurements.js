const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let isInitialized = false;

async function initializeDatabase() {
  if (isInitialized) return;
  
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS measurements (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        ph DECIMAL(4,2),
        redox DECIMAL(6,2),
        temperature DECIMAL(4,1),
        salt DECIMAL(4,1),
        alarm INTEGER,
        warning INTEGER,
        alarm_redox INTEGER,
        regulator_type INTEGER,
        pump_plus_active BOOLEAN,
        pump_minus_active BOOLEAN,
        pump_chlore_active BOOLEAN,
        filter_relay_active BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp);
      CREATE INDEX IF NOT EXISTS idx_measurements_created_at ON measurements(created_at);
    `;
    
    await pool.query(createTableQuery);
    isInitialized = true;
  } catch (err) {
    console.error('Erreur initialisation base de données:', err);
    throw err;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await initializeDatabase();

    if (req.method === 'POST') {
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
      
      res.status(200).json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Mesure ajoutée avec succès'
      });

    } else if (req.method === 'GET') {
      const { limit = 100, offset = 0, from, to } = req.query;
      
      let query = 'SELECT * FROM measurements';
      let values = [];
      let valueIndex = 1;
      
      const conditions = [];
      if (from) {
        conditions.push(`timestamp >= $${valueIndex++}`);
        values.push(from);
      }
      if (to) {
        conditions.push(`timestamp <= $${valueIndex++}`);
        values.push(to);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ` ORDER BY timestamp DESC LIMIT $${valueIndex++} OFFSET $${valueIndex}`;
      values.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, values);
      
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    }

  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};