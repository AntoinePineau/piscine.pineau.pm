# Guide de Migration : PostgreSQL → Google Drive JSON + Alertes Gemini

Ce guide vous accompagne dans la migration de votre application de monitoring de piscine depuis PostgreSQL vers Google Drive avec stockage JSON, et l'ajout d'un système d'alertes intelligent avec Gemini AI.

## Pourquoi migrer ?

- **Quotas** : Google Drive offre des quotas bien plus généreux que PostgreSQL gratuit
- **Coûts** : Pas de limite de stockage payante sur Drive
- **Simplicité** : Pas de serveur de base de données à maintenir
- **Intelligence** : Gemini AI analyse vos données et vous conseille sur l'entretien

---

## Étape 1 : Configuration Google Cloud

### 1.1 Créer un projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet (ex: "pool-monitor")
3. Noter le **Project ID**

### 1.2 Activer les APIs nécessaires

Dans votre projet, activez :
- **Google Drive API**
- **Gemini API** (Generative AI)

```bash
# Ou via gcloud CLI
gcloud services enable drive.googleapis.com
gcloud services enable generativelanguage.googleapis.com
```

### 1.3 Créer un Service Account (pour Google Drive)

1. Navigation : **IAM & Admin** → **Service Accounts**
2. Cliquer **Create Service Account**
3. Nom : `pool-monitor-service`
4. Rôle : Aucun rôle nécessaire (accès uniquement aux fichiers créés)
5. Cliquer **Create and Continue** → **Done**

### 1.4 Générer une clé JSON pour le Service Account

1. Cliquer sur le service account créé
2. Onglet **Keys** → **Add Key** → **Create new key**
3. Type : **JSON**
4. Télécharger le fichier `pool-monitor-service-xxxxx.json`

**⚠️ IMPORTANT** : Ce fichier contient des credentials sensibles. Ne JAMAIS le commiter dans Git !

### 1.5 Obtenir une clé API Gemini

1. Aller sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Cliquer **Get API Key**
3. Créer une nouvelle clé ou utiliser une existante
4. Copier la clé (commence par `AIza...`)

---

## Étape 2 : Configuration Email (optionnel mais recommandé)

### Option 1 : Gmail avec App Password

1. Aller dans votre compte Gmail
2. **Sécurité** → **Validation en deux étapes** (activer si nécessaire)
3. **Mots de passe d'application** → Créer un nouveau
4. Sélectionner **Autre** → Nom : "Pool Monitor"
5. Copier le mot de passe généré (16 caractères)

### Option 2 : SMTP personnalisé

Préparer :
- Host SMTP
- Port (587 ou 465)
- Username
- Password

---

## Étape 3 : Configuration de l'environnement

### 3.1 Créer/Mettre à jour le fichier `.env`

```bash
# Dans api-cloud/.env

# ==================== GOOGLE DRIVE ====================
# Service Account JSON (complet, en une ligne)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Optionnel : ID du dossier Google Drive parent
# Si non fourni, les fichiers seront créés à la racine
GOOGLE_DRIVE_FOLDER_ID=

# Ces IDs seront générés automatiquement lors de la première exécution
# Vous les récupérerez dans les logs
DRIVE_FILE_MEASUREMENTS_ID=
DRIVE_FILE_DAILY_AVERAGES_ID=
DRIVE_FILE_ERROR_LOGS_ID=
DRIVE_FILE_ALERTS_ID=

# ==================== GEMINI AI ====================
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXX

# ==================== EMAIL NOTIFICATIONS ====================
# Provider : 'gmail' ou 'smtp'
EMAIL_PROVIDER=gmail

# Configuration Gmail
GMAIL_USER=votre.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# OU Configuration SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASSWORD=password

# Destinataire des alertes
EMAIL_TO=votre.email@gmail.com
# OU
ALERT_EMAIL=votre.email@gmail.com

# ==================== API CONFIGURATION ====================
NODE_ENV=production
FRONTEND_URL=https://votre-app.vercel.app
PORT=3000

# Secret pour les tâches cron
CRON_SECRET=un-secret-securise-aleatoire

# ==================== LEGACY (optionnel, pour migration) ====================
# DATABASE_URL=postgresql://user:pass@host/db
```

### 3.2 Formater la clé Service Account

Le JSON doit être sur **une seule ligne** et **échappé correctement** :

```bash
# Méthode 1 : Utiliser jq
cat pool-monitor-service-xxxxx.json | jq -c . | sed 's/"/\\"/g'

# Méthode 2 : Manuellement
# 1. Ouvrir le fichier JSON
# 2. Supprimer tous les retours à la ligne
# 3. Échapper les guillemets internes si nécessaire
# 4. Entourer de guillemets simples dans le .env
```

Exemple :
```bash
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"pool-123","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...=\n-----END PRIVATE KEY-----\n","client_email":"pool@pool-123.iam.gserviceaccount.com","client_id":"123","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/pool%40pool-123.iam.gserviceaccount.com"}'
```

---

## Étape 4 : Installer les dépendances

```bash
cd api-cloud
npm install
```

Vérifier que `package.json` contient :
```json
{
  "dependencies": {
    "googleapis": "^128.0.0",
    "@google/generative-ai": "^0.21.0",
    "nodemailer": "^6.9.0"
  }
}
```

---

## Étape 5 : Migration des données

### 5.1 Test à blanc (dry-run)

```bash
cd api-cloud
node scripts/migrate-to-json.js --dry-run
```

Cela affichera ce qui serait migré sans rien écrire.

### 5.2 Migration réelle

```bash
node scripts/migrate-to-json.js
```

**⚠️ Attention** : Cette commande va :
- Exporter toutes les mesures des 7 derniers jours
- Exporter toutes les moyennes journalières des 2 dernières années
- Exporter les 1000 derniers logs d'erreur
- Créer des fichiers JSON sur Google Drive

**Limiter le nombre de lignes (test)** :
```bash
node scripts/migrate-to-json.js --limit=100
```

### 5.3 Récupérer les IDs des fichiers

Dans les logs de la migration, vous verrez :
```
⚠️  Add this to your .env: DRIVE_FILE_MEASUREMENTS_ID=1a2b3c4d5e6f...
⚠️  Add this to your .env: DRIVE_FILE_DAILY_AVERAGES_ID=9z8y7x6w5v...
⚠️  Add this to your .env: DRIVE_FILE_ERROR_LOGS_ID=4f3e2d1c0b...
⚠️  Add this to your .env: DRIVE_FILE_ALERTS_ID=7g6h5i4j3k...
```

**Copier ces lignes dans votre `.env`** !

---

## Étape 6 : Basculer vers la nouvelle API

### 6.1 Sauvegarder l'ancienne version

```bash
cd api-cloud/api
cp index.js index-postgres.js.backup
```

### 6.2 Remplacer par la nouvelle version

```bash
mv index.js index-postgres.js
mv index-json.js index.js
```

### 6.3 Tester localement

```bash
cd api-cloud
npm start
```

Vérifier les endpoints :
```bash
# Health check
curl http://localhost:3000/api/health

# Dernière mesure
curl http://localhost:3000/api/measurements/latest

# Alertes actives
curl http://localhost:3000/api/alerts?active=true
```

---

## Étape 7 : Déploiement Vercel

### 7.1 Configurer les variables d'environnement sur Vercel

```bash
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
vercel env add GEMINI_API_KEY
vercel env add GMAIL_USER
vercel env add GMAIL_APP_PASSWORD
vercel env add EMAIL_TO
vercel env add CRON_SECRET
vercel env add FRONTEND_URL

# Ajouter les IDs des fichiers Drive
vercel env add DRIVE_FILE_MEASUREMENTS_ID
vercel env add DRIVE_FILE_DAILY_AVERAGES_ID
vercel env add DRIVE_FILE_ERROR_LOGS_ID
vercel env add DRIVE_FILE_ALERTS_ID
```

### 7.2 Déployer

```bash
vercel --prod
```

---

## Étape 8 : Configurer la tâche cron quotidienne

### 8.1 Via Vercel Cron

Créer/Mettre à jour `vercel.json` :
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 8.2 Ou via un service externe (EasyCron, cron-job.org)

URL à appeler :
```
POST https://votre-app.vercel.app/api/cron
Header: X-CRON-SECRET: votre-secret
```

---

## Nouveaux endpoints API

### Alertes

```bash
# Récupérer les alertes actives
GET /api/alerts?active=true

# Récupérer les alertes des 24 dernières heures
GET /api/alerts?hours=24

# Récupérer une alerte spécifique
GET /api/alerts/:id

# Acquitter une alerte
POST /api/alerts/:id/acknowledge

# Statistiques sur les alertes
GET /api/alerts/stats?hours=168
```

### Historique

```bash
# Moyennes journalières (30 derniers jours par défaut)
GET /api/measurements/history?days=30
```

---

## Architecture des fichiers JSON sur Drive

```
Google Drive
├── pool-measurements.json
│   └── Mesures récentes (7 derniers jours, ~10k entrées max)
├── pool-daily-averages.json
│   └── Moyennes journalières (2 ans, ~730 entrées max)
├── pool-error-logs.json
│   └── Logs d'erreur (1000 derniers)
└── pool-alerts.json
    └── Alertes et conseils Gemini (500 dernières)
```

Chaque fichier JSON a cette structure :
```json
{
  "type": "measurements",
  "version": "1.0",
  "created": "2025-01-01T00:00:00.000Z",
  "lastUpdated": "2025-01-15T12:34:56.789Z",
  "count": 1234,
  "data": [...]
}
```

---

## Système d'alertes intelligent

### Seuils de déclenchement

| Métrique | Warning | Critical |
|----------|---------|----------|
| **pH** | < 7.0 ou > 7.6 | < 6.8 ou > 7.8 |
| **Redox** | < 650 mV | < 550 mV |
| **Température** | - | < 10°C ou > 35°C |
| **Salinité** | - | < 2 g/L ou > 6 g/L |
| **Alarmes système** | Warning flag | Alarm flag |

### Fonctionnement

1. **Détection** : Chaque mesure est analysée automatiquement
2. **Cooldown** : Une alerte n'est générée que toutes les 3 heures pour éviter le spam
3. **Analyse Gemini** : L'IA reçoit le contexte complet et génère des conseils personnalisés
4. **Notification** : Email envoyé automatiquement si configuré
5. **Dashboard** : Affichage dans l'interface web

### Exemple de réponse Gemini

```json
{
  "severity": "warning",
  "canSwim": true,
  "summary": "Le pH est légèrement bas à 6.9. L'eau est encore baignable mais nécessite une correction rapide pour éviter l'inconfort et protéger le matériel.",
  "issues": [
    {
      "metric": "ph",
      "problem": "pH en dessous de la plage optimale",
      "impact": "Risque d'irritation des yeux et de corrosion de l'équipement"
    }
  ],
  "recommendations": [
    {
      "action": "Ajouter du pH+",
      "priority": "medium",
      "details": "Utilisez du carbonate de sodium (pH+) pour remonter le pH",
      "quantity": "200g pour 50m³"
    },
    {
      "action": "Retester dans 4 heures",
      "priority": "high",
      "details": "Vérifier que le pH remonte vers 7.2-7.4"
    }
  ]
}
```

---

## Dépannage

### Erreur : "Failed to initialize Google Drive API"

- Vérifier que `GOOGLE_SERVICE_ACCOUNT_KEY` est correctement formaté (une seule ligne, entre guillemets simples)
- Vérifier que Google Drive API est activée dans Google Cloud Console

### Erreur : "Gemini API key not found"

- Vérifier que `GEMINI_API_KEY` est défini
- Vérifier que la clé commence par `AIza`
- Aller sur [Google AI Studio](https://aistudio.google.com/app/apikey) pour obtenir une nouvelle clé

### Erreur : "Failed to send email"

- Vérifier les credentials Gmail (App Password, pas le mot de passe Gmail normal)
- Vérifier que la validation en deux étapes est activée sur Gmail
- Tester avec un autre provider SMTP si Gmail ne fonctionne pas

### Les alertes ne se déclenchent pas

- Vérifier que les mesures sont bien insérées (vérifier les logs)
- Vérifier les seuils dans `api-cloud/lib/alert-analyzer.js`
- Vérifier que `EMAIL_TO` ou `ALERT_EMAIL` est configuré

### Migration incomplète

```bash
# Relancer la migration
node scripts/migrate-to-json.js

# Ou forcer avec un nouveau dossier
# 1. Créer un nouveau dossier sur Google Drive
# 2. Copier l'ID du dossier
# 3. Mettre GOOGLE_DRIVE_FOLDER_ID dans .env
# 4. Supprimer les DRIVE_FILE_*_ID du .env
# 5. Relancer la migration
```

---

## Maintenance

### Nettoyage automatique

La tâche cron quotidienne (`/api/cron`) effectue :
1. Création des moyennes journalières pour la veille
2. Suppression des mesures détaillées > 7 jours
3. Suppression des alertes > 60 jours

### Sauvegarde manuelle

Les fichiers JSON sur Drive peuvent être téléchargés manuellement pour backup :
1. Aller sur Google Drive
2. Rechercher "pool-*.json"
3. Télécharger chaque fichier

---

## Retour en arrière (rollback)

Si besoin de revenir à PostgreSQL :

```bash
cd api-cloud/api
mv index.js index-json.js.backup
mv index-postgres.js index.js
```

Puis redéployer sur Vercel.

**Note** : Les données ne sont pas automatiquement resynchronisées depuis JSON vers PostgreSQL.

---

## Support

Pour toute question ou problème :
1. Vérifier les logs Vercel
2. Vérifier les logs Google Cloud (si problème Drive/Gemini)
3. Consulter la documentation :
   - [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
   - [Gemini API](https://ai.google.dev/docs)
   - [Nodemailer](https://nodemailer.com/)

---

**Bonne migration ! 🚀**
