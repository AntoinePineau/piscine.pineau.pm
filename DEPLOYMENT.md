# 🚀 Guide de déploiement Pool Monitor Cloud

Ce guide vous accompagne étape par étape pour déployer votre système de monitoring de piscine dans le cloud.

## Vue d'ensemble

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Raspberry Pi   │    │   API Vercel    │    │  Web Vercel     │
│   (Bluetooth)   │───▶│  (PostgreSQL)   │◀───│  (Dashboard)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │
                        ┌─────────────────┐
                        │  Base de données│
                        │  Neon/Supabase  │
                        └─────────────────┘
```

## Étape 1: Base de données PostgreSQL

### Option A: Neon.tech (Recommandé)

1. **Créer un compte**
   - Aller sur [neon.tech](https://neon.tech)
   - S'inscrire avec GitHub/Google

2. **Créer un projet**
   - Cliquer "Create Project"
   - Nom: `pool-monitor`
   - Région: Europe West (plus proche)

3. **Récupérer l'URL**
   - Copier l'URL de connexion PostgreSQL
   - Format: `postgresql://user:password@host/database?sslmode=require`

### Option B: Supabase

1. **Créer un compte**
   - Aller sur [supabase.com](https://supabase.com)
   - S'inscrire avec GitHub

2. **Créer un projet**
   - "New project"
   - Nom: `pool-monitor`
   - Mot de passe database: noter précieusement

3. **Récupérer l'URL**
   - Settings > Database
   - Connection string > URI
   - Remplacer `[YOUR-PASSWORD]` par votre mot de passe

## Étape 2: Déploiement API sur Vercel

### Préparation locale

```bash
cd regulapp/api-cloud
npm install
```

### Installation Vercel CLI

```bash
npm install -g vercel
vercel login
```

### Déploiement

```bash
vercel --prod
```

Répondre aux questions:
- Set up and deploy: `Y`
- Which scope: votre compte
- Link to existing project: `N`
- Project name: `pool-monitor-api`
- Directory: `./` (current)

### Configuration des variables d'environnement

Dans le dashboard Vercel:
1. Aller dans votre projet `pool-monitor-api`
2. Settings > Environment Variables
3. Ajouter:

| Variable | Valeur | Environment |
|----------|--------|-------------|
| `DATABASE_URL` | URL PostgreSQL complète | Production |
| `NODE_ENV` | `production` | Production |
| `FRONTEND_URL` | URL de votre interface web (étape 3) | Production |

### Test de l'API

```bash
curl https://votre-api.vercel.app/api/health
```

Réponse attendue:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected"
}
```

## Étape 3: Déploiement Interface Web

### Option A: Vercel (Recommandé)

```bash
cd regulapp/web-cloud

# Modifier l'URL de l'API dans app.js
sed -i "s|https://votre-api.vercel.app|https://VOTRE-VRAIE-URL.vercel.app|g" app.js

vercel --prod
```

### Option B: Netlify

1. **Via interface web**
   - Aller sur [netlify.com](https://netlify.com)
   - "Add new site" > "Deploy with GitHub"
   - Sélectionner votre repo
   - Build settings:
     - Publish directory: `web-cloud`
     - Build command: (laisser vide)

2. **Via CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   cd web-cloud
   netlify deploy --prod --dir .
   ```

### Configuration

1. **Modifier l'URL de l'API**
   
   Éditer `web-cloud/app.js`:
   ```javascript
   const API_BASE_URL = 'https://votre-api-reelle.vercel.app/api';
   ```

2. **Redéployer**
   ```bash
   vercel --prod
   # ou
   netlify deploy --prod --dir .
   ```

## Étape 4: Configuration Raspberry Pi

### Installation des dépendances

```bash
ssh pi@votre-raspberry-pi.local

# Cloner le projet
git clone https://github.com/votre-username/regulapp.git
cd regulapp/raspberry-pi

# Installation
chmod +x install.sh
sudo ./install.sh
```

### Configuration environnement

```bash
sudo nano /etc/environment
```

Ajouter à la fin:
```bash
API_URL="https://votre-api.vercel.app/api/measurements"
MEASUREMENT_INTERVAL="30"
LOG_LEVEL="INFO"
```

### Service systemd pour version cloud

```bash
sudo tee /etc/systemd/system/pool-monitor-cloud.service > /dev/null <<EOF
[Unit]
Description=Pool Monitor Cloud Service
After=bluetooth.service network.target
Requires=bluetooth.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/regulapp/raspberry-pi
Environment=PATH=/home/pi/pool-monitor-env/bin
EnvironmentFile=/etc/environment
ExecStart=/home/pi/pool-monitor-env/bin/python3 bluetooth_monitor_cloud.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

### Démarrage du service

```bash
sudo systemctl daemon-reload
sudo systemctl enable pool-monitor-cloud.service
sudo systemctl start pool-monitor-cloud.service
```

### Vérification

```bash
# Logs en temps réel
sudo journalctl -u pool-monitor-cloud.service -f

# Statut
sudo systemctl status pool-monitor-cloud.service
```

## Étape 5: Test complet du système

### 1. Vérifier l'API
```bash
curl https://votre-api.vercel.app/api/health
```

### 2. Vérifier l'interface web
Ouvrir `https://votre-web.vercel.app` dans un navigateur

### 3. Vérifier la connexion Raspberry Pi
```bash
# Sur le Raspberry Pi
sudo journalctl -u pool-monitor-cloud.service -f

# Rechercher des lignes comme:
# "Régulateur trouvé: CORELEC Regulateur"
# "✓ Données envoyées: pH=7.21, T=19.7°C, Sel=1.8g/L"
```

### 4. Test de bout en bout
1. Vérifier que le Raspberry Pi trouve le régulateur
2. Attendre qu'une mesure soit envoyée (logs)
3. Actualiser l'interface web
4. Vérifier que les nouvelles données apparaissent

## Dépannage

### Problème: API non accessible

```bash
# Vérifier le déploiement
vercel ls

# Voir les logs
vercel logs votre-api.vercel.app
```

### Problème: Base de données

```bash
# Tester la connexion directement
curl -X POST https://votre-api.vercel.app/api/measurements \
  -H "Content-Type: application/json" \
  -d '{"ph":7.2,"temperature":20.0,"redox":650,"salt":3.5,"alarm":0,"warning":0,"alarm_redox":0,"regulator_type":5,"pump_plus_active":false,"pump_minus_active":false,"pump_chlore_active":true,"filter_relay_active":true}'
```

### Problème: Raspberry Pi

```bash
# Vérifier Bluetooth
sudo systemctl status bluetooth

# Scanner manuellement
sudo bluetoothctl
scan on

# Tester l'API manuellement
curl -X GET https://votre-api.vercel.app/api/health
```

### Problème: Interface web

1. Ouvrir les outils développeur (F12)
2. Onglet Console: chercher les erreurs JavaScript
3. Onglet Network: vérifier les appels API

## URLs importantes à noter

Après déploiement, noter ces URLs:

- **API**: `https://votre-api.vercel.app`
- **Interface web**: `https://votre-web.vercel.app`
- **Base de données**: URL de connexion PostgreSQL
- **Logs Vercel**: Dans le dashboard Vercel > Functions > Logs

## Sécurité

### Variables d'environnement
- Ne jamais committer l'URL de la base de données
- Utiliser les variables d'environnement Vercel

### CORS
L'API est configurée pour accepter les requêtes depuis votre domaine frontend uniquement.

### Rate limiting
L'API limite les requêtes pour éviter les abus.

## Maintenance

### Mise à jour du code

```bash
# Sur votre machine de développement
git push origin main

# Redéploiement automatique sur Vercel (si configuré)
# Ou manuellement:
vercel --prod
```

### Surveillance

- Dashboard Vercel pour les métriques API
- Logs Raspberry Pi: `sudo journalctl -u pool-monitor-cloud.service`
- Interface web: vérifier "En ligne" dans le header

## Coûts

### Gratuit
- Neon: 500MB de données
- Vercel: 100GB bande passante/mois
- Netlify: 100GB bande passante/mois

### Si dépassement
- Neon: ~$20/mois pour 10GB
- Vercel: $20/mois pour usage pro
- Raspberry Pi: coût électrique ~2€/mois

---

**Félicitations !** Votre système de monitoring de piscine est maintenant accessible depuis n'importe où dans le monde ! 🌍🏊‍♂️