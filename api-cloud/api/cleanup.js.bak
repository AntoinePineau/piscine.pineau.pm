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
    console.log('Début du nettoyage automatique des données...');
    
    // 1. Créer une table pour les moyennes quotidiennes si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_averages (
        id SERIAL PRIMARY KEY,
        date DATE UNIQUE,
        avg_ph DECIMAL(4,2),
        avg_redox DECIMAL(6,2),
        avg_temperature DECIMAL(4,1),
        avg_salt DECIMAL(4,1),
        min_ph DECIMAL(4,2),
        max_ph DECIMAL(4,2),
        min_redox DECIMAL(6,2),
        max_redox DECIMAL(6,2),
        min_temperature DECIMAL(4,1),
        max_temperature DECIMAL(4,1),
        min_salt DECIMAL(4,1),
        max_salt DECIMAL(4,1),
        measurement_count INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Calculer et stocker les moyennes quotidiennes pour les données anciennes (>7 jours)
    const aggregateQuery = `
      INSERT INTO daily_averages (
        date, avg_ph, avg_redox, avg_temperature, avg_salt,
        min_ph, max_ph, min_redox, max_redox, 
        min_temperature, max_temperature, min_salt, max_salt, measurement_count
      )
      SELECT 
        DATE(timestamp) as date,
        AVG(ph) as avg_ph,
        AVG(redox) as avg_redox,
        AVG(temperature) as avg_temperature,
        AVG(salt) as avg_salt,
        MIN(ph) as min_ph,
        MAX(ph) as max_ph,
        MIN(redox) as min_redox,
        MAX(redox) as max_redox,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        MIN(salt) as min_salt,
        MAX(salt) as max_salt,
        COUNT(*) as measurement_count
      FROM measurements 
      WHERE timestamp < NOW() - INTERVAL '7 days'
        AND DATE(timestamp) NOT IN (SELECT date FROM daily_averages)
      GROUP BY DATE(timestamp)
      ON CONFLICT (date) DO NOTHING;
    `;
    
    const aggregateResult = await pool.query(aggregateQuery);
    console.log(`Moyennes quotidiennes créées: ${aggregateResult.rowCount}`);

    // 3. Supprimer les mesures détaillées anciennes (>7 jours) déjà agrégées
    const deleteQuery = `
      DELETE FROM measurements 
      WHERE timestamp < NOW() - INTERVAL '7 days'
        AND DATE(timestamp) IN (SELECT date FROM daily_averages);
    `;
    
    const deleteResult = await pool.query(deleteQuery);
    console.log(`Mesures détaillées supprimées: ${deleteResult.rowCount}`);

    // 4. Optionnel: Supprimer les moyennes quotidiennes très anciennes (>1 an)
    const deleteOldAveragesQuery = `
      DELETE FROM daily_averages 
      WHERE date < NOW() - INTERVAL '1 year';
    `;
    
    const deleteOldAveragesResult = await pool.query(deleteOldAveragesQuery);
    console.log(`Moyennes anciennes supprimées: ${deleteOldAveragesResult.rowCount}`);

    // 5. Statistiques finales
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM measurements) as current_measurements,
        (SELECT COUNT(*) FROM daily_averages) as daily_averages,
        (SELECT MIN(timestamp) FROM measurements) as oldest_measurement,
        (SELECT MAX(timestamp) FROM measurements) as newest_measurement
    `;
    
    const stats = await pool.query(statsQuery);
    const dbStats = stats.rows[0];

    res.json({
      success: true,
      message: 'Nettoyage automatique terminé',
      stats: {
        dailyAveragesCreated: aggregateResult.rowCount,
        measurementsDeleted: deleteResult.rowCount,
        oldAveragesDeleted: deleteOldAveragesResult.rowCount,
        currentMeasurements: parseInt(dbStats.current_measurements),
        dailyAverages: parseInt(dbStats.daily_averages),
        oldestMeasurement: dbStats.oldest_measurement,
        newestMeasurement: dbStats.newest_measurement
      }
    });

  } catch (err) {
    console.error('Erreur nettoyage:', err);
    res.status(500).json({ 
      error: 'Erreur lors du nettoyage automatique',
      details: err.message 
    });
  }
};