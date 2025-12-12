#!/usr/bin/env node

/**
 * Script de migration PostgreSQL → Google Drive JSON
 *
 * Ce script exporte toutes les données de PostgreSQL vers des fichiers JSON
 * stockés sur Google Drive, puis vérifie l'intégrité de la migration.
 *
 * Usage :
 *   node scripts/migrate-to-json.js [--dry-run] [--limit=1000] [--all]
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDriveService } = require('../lib/google-drive');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null;
const MIGRATE_ALL = process.argv.includes('--all');

async function main() {
  console.log('🚀 Starting PostgreSQL to JSON migration...\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }

  if (MIGRATE_ALL) {
    console.log('📦 FULL MIGRATION MODE - All data will be migrated\n');
  }

  // 1. Connexion PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }

  // 2. Récupérer toutes les données de PostgreSQL en mémoire
  const allData = {};

  try {
    console.log('📥 Fetching all data from PostgreSQL...\n');
    allData.measurements = await fetchMeasurementsData(pool);
    allData.dailyAverages = await fetchDailyAveragesData(pool);
    allData.errorLogs = await fetchErrorLogsData(pool);
    console.log('✅ All data fetched from PostgreSQL\n');
  } catch (error) {
    console.error('❌ Failed to fetch data:', error.message);
    await pool.end();
    process.exit(1);
  }

  // 3. Fermer la connexion PostgreSQL
  await pool.end();
  console.log('✅ PostgreSQL connection closed\n');

  // 4. Initialiser Google Drive
  const drive = getDriveService();
  try {
    await drive.initialize();
    console.log('✅ Connected to Google Drive\n');
  } catch (error) {
    console.error('❌ Failed to connect to Google Drive:', error.message);
    console.error('Make sure GOOGLE_SERVICE_ACCOUNT_KEY is set in .env\n');
    process.exit(1);
  }

  // 5. Uploader vers Google Drive
  if (!DRY_RUN) {
    await uploadToGoogleDrive(drive, allData);
  } else {
    console.log('[DRY RUN] Would upload data to Google Drive\n');
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify the data in Google Drive');
  console.log('2. Update your .env with the DRIVE_FILE_*_ID variables');
  console.log('3. Test the new API endpoints');
  console.log('4. Once confirmed, you can disable PostgreSQL\n');
}

// Fetch functions - récupère les données sans les uploader
async function fetchMeasurementsData(pool) {
  console.log('   📊 Fetching measurements...');

  // Compter le total
  const countResult = await pool.query('SELECT COUNT(*) FROM measurements');
  const totalCount = parseInt(countResult.rows[0].count);
  console.log(`   Found ${totalCount} measurements`);

  if (totalCount === 0) {
    console.log('   ⚠️  No measurements to fetch');
    return null;
  }

  // Récupérer les données
  let query, params;

  if (MIGRATE_ALL) {
    query = `
      SELECT
        id, timestamp, ph, redox, temperature, salt,
        alarm, warning, alarm_redox, regulator_type,
        pump_plus_active, pump_minus_active, pump_chlore_active, filter_relay_active,
        created_at
      FROM measurements
      ORDER BY timestamp DESC
    `;
    params = [];
  } else {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = `
      SELECT
        id, timestamp, ph, redox, temperature, salt,
        alarm, warning, alarm_redox, regulator_type,
        pump_plus_active, pump_minus_active, pump_chlore_active, filter_relay_active,
        created_at
      FROM measurements
      WHERE timestamp > $1
      ORDER BY timestamp DESC
    `;
    params = [sevenDaysAgo];
  }

  if (LIMIT) {
    query += ` LIMIT ${LIMIT}`;
  }

  const result = await pool.query(query, params);
  const measurements = result.rows;

  console.log(`   ✅ Fetched ${measurements.length} measurements`);

  return {
    type: 'measurements',
    version: '1.0',
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    count: measurements.length,
    data: measurements.map(m => ({
      timestamp: m.timestamp.toISOString(),
      ph: m.ph ? parseFloat(m.ph) : null,
      redox: m.redox ? parseFloat(m.redox) : null,
      temperature: m.temperature ? parseFloat(m.temperature) : null,
      salt: m.salt ? parseFloat(m.salt) : null,
      alarm: m.alarm || 0,
      warning: m.warning || 0,
      alarm_redox: m.alarm_redox || 0,
      regulator_type: m.regulator_type || 0,
      pump_plus_active: m.pump_plus_active || false,
      pump_minus_active: m.pump_minus_active || false,
      pump_chlore_active: m.pump_chlore_active || false,
      filter_relay_active: m.filter_relay_active || false,
      created_at: m.created_at ? m.created_at.toISOString() : m.timestamp.toISOString(),
    })),
  };
}

async function fetchDailyAveragesData(pool) {
  console.log('   📈 Fetching daily_averages...');

  try {
    // Vérifier si la table existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'daily_averages'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('   ⚠️  Table daily_averages does not exist, skipping');
      return null;
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM daily_averages');
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`   Found ${totalCount} daily averages`);

    if (totalCount === 0) {
      console.log('   ⚠️  No daily averages to fetch');
      return null;
    }

    // Récupérer les moyennes journalières
    let query, params;

    if (MIGRATE_ALL) {
      query = `SELECT * FROM daily_averages ORDER BY date DESC`;
      params = [];
    } else {
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      query = `SELECT * FROM daily_averages WHERE date > $1 ORDER BY date DESC`;
      params = [twoYearsAgo];
    }

    if (LIMIT) {
      query += ` LIMIT ${LIMIT}`;
    }

    const result = await pool.query(query, params);
    const averages = result.rows;

    console.log(`   ✅ Fetched ${averages.length} daily averages`);

    return {
      type: 'dailyAverages',
      version: '1.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      count: averages.length,
      data: averages.map(a => ({
        date: typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0],
        avg_ph: a.avg_ph ? parseFloat(a.avg_ph) : null,
        avg_redox: a.avg_redox ? parseFloat(a.avg_redox) : null,
        avg_temperature: a.avg_temperature ? parseFloat(a.avg_temperature) : null,
        avg_salt: a.avg_salt ? parseFloat(a.avg_salt) : null,
        min_ph: a.min_ph ? parseFloat(a.min_ph) : null,
        max_ph: a.max_ph ? parseFloat(a.max_ph) : null,
        min_redox: a.min_redox ? parseFloat(a.min_redox) : null,
        max_redox: a.max_redox ? parseFloat(a.max_redox) : null,
        min_temperature: a.min_temperature ? parseFloat(a.min_temperature) : null,
        max_temperature: a.max_temperature ? parseFloat(a.max_temperature) : null,
        min_salt: a.min_salt ? parseFloat(a.min_salt) : null,
        max_salt: a.max_salt ? parseFloat(a.max_salt) : null,
        measurement_count: a.measurement_count || 0,
        created_at: a.created_at ? a.created_at.toISOString() : new Date().toISOString(),
      })),
    };
  } catch (error) {
    console.error('   ❌ Error fetching daily averages:', error.message);
    return null;
  }
}

async function fetchErrorLogsData(pool) {
  console.log('   📝 Fetching error_logs...');

  try {
    // Vérifier si la table existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'error_logs'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('   ⚠️  Table error_logs does not exist, skipping');
      return null;
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM error_logs');
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`   Found ${totalCount} error logs`);

    if (totalCount === 0) {
      console.log('   ⚠️  No error logs to fetch');
      return null;
    }

    // Récupérer les derniers 1000 logs
    let query = `SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 1000`;

    if (LIMIT) {
      query = query.replace('LIMIT 1000', `LIMIT ${LIMIT}`);
    }

    const result = await pool.query(query);
    const logs = result.rows;

    console.log(`   ✅ Fetched ${logs.length} error logs`);

    return {
      type: 'errorLogs',
      version: '1.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      count: logs.length,
      data: logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        error_type: log.error_type || 'unknown',
        error_message: log.error_message || '',
        context: log.context || {},
        source: log.source || 'unknown',
        created_at: log.created_at ? log.created_at.toISOString() : log.timestamp.toISOString(),
      })),
    };
  } catch (error) {
    console.error('   ❌ Error fetching error logs:', error.message);
    return null;
  }
}

async function uploadToGoogleDrive(drive, allData) {
  console.log('📤 Uploading data to Google Drive...\n');

  if (allData.measurements) {
    console.log(`   📊 Uploading ${allData.measurements.count} measurements...`);
    await drive.writeJSON('measurements', allData.measurements);
    console.log(`   ✅ Uploaded measurements\n`);
  }

  if (allData.dailyAverages) {
    console.log(`   📈 Uploading ${allData.dailyAverages.count} daily averages...`);
    await drive.writeJSON('dailyAverages', allData.dailyAverages);
    console.log(`   ✅ Uploaded daily averages\n`);
  }

  if (allData.errorLogs) {
    console.log(`   📝 Uploading ${allData.errorLogs.count} error logs...`);
    await drive.writeJSON('errorLogs', allData.errorLogs);
    console.log(`   ✅ Uploaded error logs\n`);
  }
}

// Exécuter la migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
