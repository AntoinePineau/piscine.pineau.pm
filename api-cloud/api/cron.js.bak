const { pool } = require('../../lib/db-pool');
require('dotenv').config();

module.exports = async (req, res) => {
  // Vérification basique de sécurité (optionnel)
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    console.log('CRON: Début du nettoyage quotidien...');
    
    // 1. Créer la table des moyennes si nécessaire
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

    // 2. Agréger les données de la veille
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

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
      WHERE DATE(timestamp) = $1
        AND DATE(timestamp) NOT IN (SELECT date FROM daily_averages WHERE date = $1)
      GROUP BY DATE(timestamp)
      ON CONFLICT (date) DO NOTHING;
    `;
    
    const aggregateResult = await pool.query(aggregateQuery, [yesterdayStr]);

    // 3. Supprimer les mesures détaillées anciennes (>8 jours) déjà agrégées
    const deleteQuery = `
      DELETE FROM measurements 
      WHERE timestamp < NOW() - INTERVAL '8 days'
        AND DATE(timestamp) IN (SELECT date FROM daily_averages);
    `;
    
    const deleteResult = await pool.query(deleteQuery);

    // 4. Nettoyer les moyennes très anciennes (>2 ans)
    const deleteOldQuery = `
      DELETE FROM daily_averages 
      WHERE date < NOW() - INTERVAL '2 years';
    `;
    
    const deleteOldResult = await pool.query(deleteOldQuery);

    // 5. Statistiques de la base
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM measurements) as current_measurements,
        (SELECT COUNT(*) FROM daily_averages) as daily_averages,
        (SELECT pg_size_pretty(pg_total_relation_size('measurements'))) as measurements_size,
        (SELECT pg_size_pretty(pg_total_relation_size('daily_averages'))) as averages_size
    `;
    
    const stats = await pool.query(statsQuery);

    console.log('CRON: Nettoyage terminé', {
      aggregated: aggregateResult.rowCount,
      deleted: deleteResult.rowCount,
      oldDeleted: deleteOldResult.rowCount
    });

    res.json({
      success: true,
      message: 'Nettoyage CRON terminé',
      timestamp: new Date().toISOString(),
      results: {
        yesterdayAggregated: aggregateResult.rowCount,
        oldMeasurementsDeleted: deleteResult.rowCount,
        veryOldAveragesDeleted: deleteOldResult.rowCount,
        currentStats: stats.rows[0]
      }
    });

  } catch (err) {
    console.error('CRON: Erreur nettoyage:', err);
    res.status(500).json({ 
      error: 'Erreur CRON',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
};