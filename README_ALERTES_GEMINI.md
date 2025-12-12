# Système d'Alertes Intelligentes avec Gemini AI

## Résumé des améliorations

Votre application de monitoring de piscine a été entièrement modernisée avec :

### ✅ Migration du stockage
- **Avant** : PostgreSQL (quotas limités, coûteux)
- **Après** : Google Drive + JSON (gratuit, quotas généreux)

### ✅ Intelligence artificielle
- **Gemini AI** : Analyse automatique des paramètres de l'eau
- **Conseils personnalisés** : Recommandations adaptées à votre situation
- **Diagnostic expert** : Comprendre pourquoi et comment agir

### ✅ Notifications
- **Email automatique** : Alertes envoyées dès qu'un problème est détecté
- **Dashboard web** : Visualisation des alertes et conseils
- **Cooldown intelligent** : Pas de spam (1 alerte toutes les 3h max)

---

## Fichiers créés

### Backend (API)

```
api-cloud/
├── lib/
│   ├── google-drive.js       # Service Google Drive API
│   ├── gemini.js              # Service Gemini AI
│   ├── email-service.js       # Service email (Gmail/SMTP)
│   ├── alert-analyzer.js      # Détection et analyse des alertes
│   └── storage.js             # Couche d'abstraction stockage JSON
├── api/
│   ├── index-json.js          # Nouvelle API utilisant JSON
│   └── alerts.js              # Endpoints pour les alertes
├── scripts/
│   └── migrate-to-json.js     # Script de migration PostgreSQL → JSON
└── package.json               # Dépendances mises à jour
```

### Frontend (Dashboard)

```
web-cloud/
├── alerts.js                  # Module JavaScript pour les alertes
├── alerts.css                 # Styles pour les alertes
└── alerts-section.html        # Template HTML à intégrer
```

### Documentation

```
MIGRATION_GUIDE.md             # Guide complet de migration
README_ALERTES_GEMINI.md       # Ce fichier
```

---

## Architecture du système

```
┌─────────────────┐
│  Raspberry Pi   │
│   (Capteurs)    │
└────────┬────────┘
         │ POST /api/measurements
         ↓
┌─────────────────────────────────────┐
│          API Vercel                 │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Storage Service             │  │
│  │  • Sauvegarde → Drive JSON   │  │
│  │  • Cache en mémoire          │  │
│  └──────────────────────────────┘  │
│                ↓                    │
│  ┌──────────────────────────────┐  │
│  │  Alert Analyzer              │  │
│  │  • Détecte anomalies         │  │
│  │  • Vérifie seuils            │  │
│  └──────────────────────────────┘  │
│                ↓                    │
│  ┌──────────────────────────────┐  │
│  │  Gemini AI Service           │  │
│  │  • Analyse contexte          │  │
│  │  • Génère conseils           │  │
│  └──────────────────────────────┘  │
│                ↓                    │
│  ┌──────────────────────────────┐  │
│  │  Email Service               │  │
│  │  • Envoie notification       │  │
│  │  • HTML + texte brut         │  │
│  └──────────────────────────────┘  │
│                ↓                    │
│  ┌──────────────────────────────┐  │
│  │  Google Drive                │  │
│  │  • pool-alerts.json          │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         │ GET /api/alerts
         ↓
┌─────────────────┐
│   Dashboard     │
│   (Navigateur)  │
└─────────────────┘
```

---

## Seuils de déclenchement des alertes

| Paramètre | Warning | Critical |
|-----------|---------|----------|
| **pH** | < 7.0 ou > 7.6 | < 6.8 ou > 7.8 |
| **Redox** | < 650 mV | < 550 mV |
| **Température** | - | < 10°C ou > 35°C |
| **Salinité** | - | < 2 g/L ou > 6 g/L |
| **Alarmes système** | Flag warning | Flag alarm |

**Cooldown** : 3 heures entre deux alertes similaires

---

## Nouveaux endpoints API

### Alertes

```bash
# Récupérer les alertes actives (non acquittées)
GET /api/alerts?active=true

# Récupérer les alertes des 24 dernières heures
GET /api/alerts?hours=24

# Récupérer une alerte spécifique
GET /api/alerts/:id

# Acquitter une alerte (marquer comme lue)
POST /api/alerts/:id/acknowledge

# Statistiques sur les alertes
GET /api/alerts/stats?hours=168
```

### Historique

```bash
# Moyennes journalières
GET /api/measurements/history?days=30
```

---

## Format d'une alerte Gemini

```json
{
  "id": "alert-1705412345678-abc123",
  "timestamp": "2025-01-16T14:30:00.000Z",
  "severity": "warning",
  "acknowledged": false,
  "measurement": {
    "ph": 6.9,
    "redox": 680,
    "temperature": 24.5,
    "salt": 4.2,
    "alarm": 0,
    "warning": 0,
    "alarm_redox": 0
  },
  "issues": [
    {
      "metric": "ph",
      "problem": "pH en dessous de la plage optimale",
      "impact": "Risque d'irritation et corrosion équipement"
    }
  ],
  "geminiAnalysis": {
    "severity": "warning",
    "canSwim": true,
    "summary": "Le pH est légèrement bas à 6.9. L'eau est baignable mais nécessite correction.",
    "recommendations": [
      {
        "action": "Ajouter du pH+",
        "priority": "medium",
        "details": "Utiliser carbonate de sodium",
        "quantity": "200g pour 50m³"
      },
      {
        "action": "Retester dans 4 heures",
        "priority": "high",
        "details": "Vérifier remontée vers 7.2-7.4"
      }
    ],
    "reasoning": "Le pH acide peut causer inconfort et endommager équipement..."
  }
}
```

---

## Checklist de migration

### Étape 1 : Configuration Google Cloud ✓
- [ ] Créer projet Google Cloud
- [ ] Activer Google Drive API
- [ ] Activer Gemini API
- [ ] Créer Service Account
- [ ] Télécharger clé JSON
- [ ] Obtenir clé API Gemini

### Étape 2 : Configuration Email ✓
- [ ] Choisir provider (Gmail ou SMTP)
- [ ] Si Gmail : créer App Password
- [ ] Si SMTP : obtenir credentials

### Étape 3 : Variables d'environnement ✓
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `GMAIL_USER` + `GMAIL_APP_PASSWORD` (ou SMTP)
- [ ] `EMAIL_TO` ou `ALERT_EMAIL`
- [ ] `CRON_SECRET`

### Étape 4 : Installation ✓
```bash
cd api-cloud
npm install
```

### Étape 5 : Migration des données ✓
```bash
# Test
node scripts/migrate-to-json.js --dry-run

# Migration réelle
node scripts/migrate-to-json.js

# Copier les DRIVE_FILE_*_ID dans .env
```

### Étape 6 : Basculer l'API ✓
```bash
cd api-cloud/api
mv index.js index-postgres.js.backup
mv index-json.js index.js
```

### Étape 7 : Tester localement ✓
```bash
npm start

# Dans un autre terminal
curl http://localhost:3000/api/health
curl http://localhost:3000/api/measurements/latest
curl http://localhost:3000/api/alerts?active=true
```

### Étape 8 : Déployer Vercel ✓
```bash
# Configurer les env vars
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
vercel env add GEMINI_API_KEY
# ... etc

# Déployer
vercel --prod
```

### Étape 9 : Intégrer le dashboard ✓
```html
<!-- Dans index.html <head> -->
<link rel="stylesheet" href="alerts.css">

<!-- Dans index.html <body>, où vous voulez les alertes -->
<!-- Copier le contenu de alerts-section.html -->

<!-- Avant </body> -->
<script src="alerts.js"></script>
```

### Étape 10 : Configurer le cron ✓
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Test de l'email

Pour tester que les emails fonctionnent :

```bash
# Créer un fichier test-email.js
const { getEmailService } = require('./lib/email-service');

async function test() {
  const emailService = getEmailService();
  await emailService.sendTestEmail();
  console.log('Email de test envoyé !');
}

test();
```

Puis :
```bash
cd api-cloud
node test-email.js
```

---

## Exemple d'email d'alerte

**Sujet** : 🚨 Piscine - Action immédiate nécessaire

**Corps HTML** :
- Mesures actuelles (pH, Redox, Temp, Sel)
- Statut baignade (autorisée/non recommandée)
- Résumé Gemini
- Liste des actions recommandées avec priorités
- Lien vers le dashboard

**Corps texte** : Version texte brut pour les clients email basiques

---

## Coûts et quotas

### Google Drive API
- **Gratuit** : 1 milliard de requêtes/jour
- **Stockage** : 15 Go gratuits (amplement suffisant pour JSON)
- **Votre usage estimé** : ~1000 requêtes/jour = **0.0001% du quota**

### Gemini API
- **Gratuit** : 1500 requêtes/jour (Gemini 2.0 Flash)
- **Votre usage estimé** : ~20-50 requêtes/jour (alertes uniquement) = **~3% du quota**

### Gmail/SMTP
- **Gmail gratuit** : 500 emails/jour
- **Votre usage estimé** : ~5-10 emails/jour = **~2% du quota**

**Total** : **100% GRATUIT** 🎉

---

## Sécurité

### Fichiers sensibles à NE PAS commiter

```
.env
.env.local
pool-monitor-service-*.json
*credentials*.json
```

Ajouter à `.gitignore` :
```gitignore
.env
.env.local
.env.production
*.json.key
*-service-account*.json
```

### Sécuriser les variables Vercel

Les variables d'environnement sur Vercel sont chiffrées au repos et en transit.

Pour le Service Account JSON :
1. Le stocker en variable d'environnement (pas dans le code)
2. Ne jamais le logger
3. Limiter les permissions du Service Account au strict minimum

---

## Maintenance

### Tâche cron quotidienne

La tâche `/api/cron` effectue automatiquement (chaque jour à 2h) :

1. **Agrégation** : Créer moyennes journalières de la veille
2. **Nettoyage** : Supprimer mesures détaillées > 7 jours
3. **Archivage** : Supprimer alertes > 60 jours

### Sauvegarde manuelle

Les fichiers JSON sur Drive :
```
pool-measurements.json       (7 derniers jours)
pool-daily-averages.json     (2 ans)
pool-error-logs.json         (1000 derniers)
pool-alerts.json             (500 dernières)
```

Peuvent être téléchargés depuis Google Drive pour backup.

---

## Dépannage

### "Failed to initialize Google Drive API"

```bash
# Vérifier le format du JSON
echo $GOOGLE_SERVICE_ACCOUNT_KEY | jq .

# Doit afficher le JSON complet sans erreur
# Si erreur : reformater sur une ligne
```

### "Gemini API rate limit exceeded"

```bash
# Vous avez dépassé 1500 req/jour
# Solution : Attendre le lendemain
# Ou : Passer à un plan payant (mais pas nécessaire normalement)
```

### "Email not sent"

```bash
# Gmail : Vérifier App Password (pas mot de passe normal)
# Vérifier que 2FA est activée
# SMTP : Vérifier host, port, credentials
```

### Les alertes ne se déclenchent pas

```bash
# Vérifier les logs Vercel
vercel logs

# Tester manuellement
curl -X POST https://votre-app.vercel.app/api/measurements \
  -H "Content-Type: application/json" \
  -d '{"ph": 6.5, "redox": 500, "temperature": 25, "salt": 4}'

# Vérifier les alertes
curl https://votre-app.vercel.app/api/alerts?active=true
```

---

## Rollback (retour arrière)

Si besoin de revenir à PostgreSQL :

```bash
cd api-cloud/api
mv index.js index-json.js.backup
mv index-postgres.js.backup index.js
vercel --prod
```

**Note** : Les données JSON ne seront pas automatiquement reversées dans PostgreSQL.

---

## Support et documentation

### Liens utiles
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
- [Gemini API](https://ai.google.dev/docs)
- [Nodemailer](https://nodemailer.com/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

### Logs
```bash
# Logs Vercel en temps réel
vercel logs --follow

# Logs d'une fonction spécifique
vercel logs --function=api/measurements
```

---

## Prochaines améliorations possibles

- [ ] Notifications push mobile (via Pushover, Ntfy)
- [ ] Historique graphique des alertes
- [ ] Export PDF des rapports mensuels
- [ ] Intégration Home Assistant / Domoticz
- [ ] Prédiction des besoins en produits
- [ ] Commande vocale (Alexa, Google Assistant)

---

**Félicitations ! Votre système de monitoring est maintenant intelligent et économique ! 🎉**

Pour toute question : consultez `MIGRATION_GUIDE.md` pour les détails techniques.
