#!/usr/bin/env node

/**
 * Script de vérification de la configuration
 * Vérifie que toutes les variables d'environnement sont correctement configurées
 *
 * Usage : node scripts/check-config.js
 */

require('dotenv').config();

const checks = {
  googleDrive: false,
  gemini: false,
  email: false,
  general: false,
};

console.log('🔍 Vérification de la configuration...\n');

// ==================== Google Drive ====================
console.log('📁 Google Drive API :');

if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  console.log('   ❌ GOOGLE_SERVICE_ACCOUNT_KEY manquant');
} else {
  try {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    if (key.type === 'service_account' && key.private_key && key.client_email) {
      console.log('   ✅ Service Account JSON valide');
      console.log(`      Email: ${key.client_email}`);
      console.log(`      Project: ${key.project_id}`);
      checks.googleDrive = true;
    } else {
      console.log('   ❌ Service Account JSON invalide (clés manquantes)');
    }
  } catch (error) {
    console.log('   ❌ Service Account JSON mal formaté');
    console.log(`      Erreur: ${error.message}`);
  }
}

if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.log(`   ℹ️  Folder ID configuré: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
}

const driveFileIds = [
  'DRIVE_FILE_MEASUREMENTS_ID',
  'DRIVE_FILE_DAILY_AVERAGES_ID',
  'DRIVE_FILE_ERROR_LOGS_ID',
  'DRIVE_FILE_ALERTS_ID'
];

const missingIds = driveFileIds.filter(id => !process.env[id]);
if (missingIds.length > 0) {
  console.log(`   ⚠️  ${missingIds.length} file ID(s) manquant(s) (seront générés à la première exécution)`);
} else {
  console.log('   ✅ Tous les file IDs configurés');
}

console.log('');

// ==================== Gemini AI ====================
console.log('🤖 Gemini AI :');

if (!process.env.GEMINI_API_KEY) {
  console.log('   ❌ GEMINI_API_KEY manquant');
} else if (!process.env.GEMINI_API_KEY.startsWith('AIza')) {
  console.log('   ⚠️  GEMINI_API_KEY ne commence pas par "AIza" (vérifier)');
} else {
  console.log('   ✅ GEMINI_API_KEY configuré');
  console.log(`      Clé: ${process.env.GEMINI_API_KEY.substring(0, 8)}...`);
  checks.gemini = true;
}

console.log('');

// ==================== Email ====================
console.log('📧 Email :');

const provider = process.env.EMAIL_PROVIDER || 'gmail';
console.log(`   Provider: ${provider}`);

if (provider === 'gmail') {
  if (!process.env.GMAIL_USER) {
    console.log('   ❌ GMAIL_USER manquant');
  } else {
    console.log(`   ✅ GMAIL_USER: ${process.env.GMAIL_USER}`);
  }

  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('   ❌ GMAIL_APP_PASSWORD manquant');
  } else if (process.env.GMAIL_APP_PASSWORD.length < 10) {
    console.log('   ⚠️  GMAIL_APP_PASSWORD semble trop court');
  } else {
    console.log('   ✅ GMAIL_APP_PASSWORD configuré');
    checks.email = true;
  }
} else if (provider === 'smtp') {
  const smtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missingSMTP = smtpVars.filter(v => !process.env[v]);

  if (missingSMTP.length > 0) {
    console.log(`   ❌ Variables SMTP manquantes: ${missingSMTP.join(', ')}`);
  } else {
    console.log('   ✅ Configuration SMTP complète');
    console.log(`      Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(`      User: ${process.env.SMTP_USER}`);
    checks.email = true;
  }
} else {
  console.log(`   ⚠️  Provider inconnu: ${provider}`);
}

const recipient = process.env.EMAIL_TO || process.env.ALERT_EMAIL;
if (!recipient) {
  console.log('   ❌ EMAIL_TO ou ALERT_EMAIL manquant');
} else {
  console.log(`   ✅ Destinataire: ${recipient}`);
}

console.log('');

// ==================== Configuration générale ====================
console.log('⚙️  Configuration générale :');

if (!process.env.NODE_ENV) {
  console.log('   ⚠️  NODE_ENV non défini (défaut: development)');
} else {
  console.log(`   ✅ NODE_ENV: ${process.env.NODE_ENV}`);
}

if (!process.env.FRONTEND_URL) {
  console.log('   ⚠️  FRONTEND_URL non défini');
} else {
  console.log(`   ✅ FRONTEND_URL: ${process.env.FRONTEND_URL}`);
}

if (!process.env.CRON_SECRET) {
  console.log('   ❌ CRON_SECRET manquant (nécessaire pour les tâches cron)');
} else if (process.env.CRON_SECRET.length < 20) {
  console.log('   ⚠️  CRON_SECRET trop court (minimum 20 caractères recommandés)');
} else {
  console.log('   ✅ CRON_SECRET configuré');
  checks.general = true;
}

console.log('');

// ==================== Legacy (PostgreSQL) ====================
if (process.env.DATABASE_URL) {
  console.log('🗄️  PostgreSQL (Legacy) :');
  console.log('   ℹ️  DATABASE_URL configuré (pour migration seulement)');
  const dbUrl = new URL(process.env.DATABASE_URL);
  console.log(`      Host: ${dbUrl.hostname}`);
  console.log(`      Database: ${dbUrl.pathname.substring(1)}`);
  console.log('');
}

// ==================== Résumé ====================
console.log('📊 Résumé :');
console.log('');

const allChecks = [
  { name: 'Google Drive', status: checks.googleDrive, required: true },
  { name: 'Gemini AI', status: checks.gemini, required: true },
  { name: 'Email', status: checks.email, required: false },
  { name: 'Configuration générale', status: checks.general, required: true },
];

allChecks.forEach(check => {
  const icon = check.status ? '✅' : check.required ? '❌' : '⚠️';
  const label = check.required ? 'REQUIS' : 'OPTIONNEL';
  console.log(`   ${icon} ${check.name} (${label})`);
});

console.log('');

// ==================== Verdict ====================
const requiredChecks = allChecks.filter(c => c.required);
const passedRequired = requiredChecks.filter(c => c.status).length;

if (passedRequired === requiredChecks.length) {
  console.log('✅ Configuration valide ! Vous pouvez lancer la migration.\n');
  console.log('Prochaines étapes :');
  console.log('1. Test à blanc : node scripts/migrate-to-json.js --dry-run');
  console.log('2. Migration réelle : node scripts/migrate-to-json.js');
  console.log('3. Basculer l\'API : mv api/index.js api/index-postgres.js && mv api/index-json.js api/index.js');
  console.log('4. Déployer : vercel --prod\n');
  process.exit(0);
} else {
  console.log(`❌ Configuration incomplète (${passedRequired}/${requiredChecks.length} vérifications réussies)\n`);
  console.log('Consultez MIGRATION_GUIDE.md pour configurer les variables manquantes.\n');
  process.exit(1);
}
