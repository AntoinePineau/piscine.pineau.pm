# Pool Monitor - Système de monitoring de piscine

Ce projet permet de surveiller à distance votre régulateur de piscine CORELEC via Bluetooth depuis un Raspberry Pi, avec déploiement cloud pour un accès depuis n'importe où.

## Architecture Cloud

```
Régulateur CORELEC (Bluetooth) 
    ↓
Raspberry Pi (Script Python)
    ↓
API Cloud (Vercel + PostgreSQL)
    ↓
Interface Web Cloud (Vercel/Netlify)
    ↓
Accès depuis n'importe où via Internet
```

## Deux versions disponibles

### 🌐 Version Cloud (Recommandée)
- **API** déployée sur Vercel avec base PostgreSQL (Neon/Supabase)
- **Interface web** accessible depuis partout
- **Raspberry Pi** envoie les données vers le cloud
- **Accès universel** via URL publique

### 🏠 Version Locale
- **API** sur Raspberry Pi avec SQLite
- **Interface web** accessible uniquement sur réseau local
- **Données** stockées localement

## Fonctionnalités

- **Connexion Bluetooth** au régulateur CORELEC
- **Collecte automatique** des données : pH, redox, température, taux de sel
- **API REST** pour stocker et récupérer les données
- **Interface web** avec graphiques en temps réel
- **Alertes** en cas de valeurs anormales
- **Historique** des mesures avec statistiques

## Structure du projet

```
regulapp/
├── raspberry-pi/              # Scripts Python pour Raspberry Pi
│   ├── bluetooth_monitor.py       # Version locale (SQLite)
│   ├── bluetooth_monitor_cloud.py # Version cloud (PostgreSQL)
│   ├── requirements.txt           # Dépendances Python
│   └── install.sh                # Script d'installation
├── api/                      # API Node.js locale
│   ├── server.js                # Serveur Express + SQLite
│   └── package.json            # Dépendances Node.js
├── api-cloud/               # API Node.js pour déploiement cloud
│   ├── index.js                # Serveur Express + PostgreSQL
│   ├── package.json            # Dépendances cloud
│   └── vercel.json             # Configuration Vercel
├── web/                     # Interface web locale
│   ├── index.html              # Page principale
│   ├── styles.css              # CSS
│   └── app.js                  # JavaScript + Highcharts
├── web-cloud/               # Interface web cloud
│   ├── index.html              # Page principale cloud
│   ├── styles.css              # CSS optimisé
│   ├── app.js                  # JavaScript cloud
│   └── package.json            # Configuration build
└── csharp/                  # Classes C# de référence (décompilées)
```

# 🚀 Déploiement Cloud (Recommandé)

## 1. Créer la base de données PostgreSQL

### Option A: Neon (Gratuit)
1. Aller sur [neon.tech](https://neon.tech)
2. Créer un compte et un nouveau projet
3. Copier l'URL de connexion PostgreSQL

### Option B: Supabase (Gratuit)
1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Aller dans Settings > Database
4. Copier l'URL de connexion PostgreSQL

## 2. Déployer l'API sur Vercel

```bash
cd api-cloud
npm install
```

1. Installer Vercel CLI: `npm i -g vercel`
2. Se connecter: `vercel login`
3. Déployer: `vercel --prod`
4. Ajouter les variables d'environnement:
   - `DATABASE_URL`: URL PostgreSQL (Neon/Supabase)
   - `NODE_ENV`: `production`

## 3. Déployer l'interface web

### Option A: Vercel
```bash
cd web-cloud
vercel --prod
```

### Option B: Netlify
1. Aller sur [netlify.com](https://netlify.com)
2. Connecter votre repo GitHub
3. Déployer le dossier `web-cloud`

## 4. Configuration du Raspberry Pi

```bash
git clone <votre-repo>
cd regulapp/raspberry-pi
chmod +x install.sh
./install.sh
```

Configurer les variables d'environnement:
```bash
sudo nano /etc/environment
```

Ajouter:
```
API_URL=https://votre-api.vercel.app/api/measurements
MEASUREMENT_INTERVAL=30
```

Démarrer le service:
```bash
sudo systemctl start pool-monitor.service
sudo systemctl enable pool-monitor.service
```

---

# 🏠 Installation Locale (Alternative)

## Installation sur Raspberry Pi

1. **Cloner le projet**
```bash
git clone <votre-repo>
cd regulapp
```

2. **Rendre le script d'installation exécutable**
```bash
chmod +x raspberry-pi/install.sh
```

3. **Lancer l'installation**
```bash
cd raspberry-pi
./install.sh
```

4. **Redémarrer le système**
```bash
sudo reboot
```

## Configuration

### Script Python (bluetooth_monitor.py)

Le script recherche automatiquement les appareils nommés :
- "CORELEC Regulateur"  
- "REGUL."

Configuration modifiable :
```python
API_URL = "http://localhost:3000/api/measurements"  # URL de l'API
MEASUREMENT_INTERVAL = 30  # Intervalle en secondes
```

### API Node.js (server.js)

Configuration via variables d'environnement :
```bash
PORT=3000                    # Port du serveur
DB_PATH=./pool_data.db      # Chemin vers la base SQLite
```

## Utilisation

### Démarrage manuel

```bash
# API
cd api
npm start

# Script Bluetooth (dans un autre terminal)
cd raspberry-pi
source /home/pi/pool-monitor-env/bin/activate
python3 bluetooth_monitor.py
```

### Services systemd (automatique)

```bash
# Démarrer les services
sudo systemctl start pool-monitor.service
sudo systemctl start pool-api.service

# Voir les logs
sudo journalctl -u pool-monitor.service -f
sudo journalctl -u pool-api.service -f
```

### Interface web

Accéder à : `http://[IP_RASPBERRY]:3000`

## API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/measurements` | POST | Ajouter une mesure |
| `/api/measurements` | GET | Récupérer les mesures |
| `/api/measurements/latest` | GET | Dernière mesure |
| `/api/measurements/stats` | GET | Statistiques |
| `/api/measurements/chart-data` | GET | Données pour graphiques |
| `/api/health` | GET | État de l'API |

### Exemple de données

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "ph": 7.21,
  "redox": 432,
  "temperature": 19.7,
  "salt": 1.8,
  "alarm": 0,
  "warning": 0,
  "alarm_redox": 0,
  "regulator_type": 5,
  "pump_plus_active": false,
  "pump_minus_active": false,
  "pump_chlore_active": true,
  "filter_relay_active": true
}
```

## Communication Bluetooth

### Protocole CORELEC

- **Service UUID** : `0bd51666-e7cb-469b-8e4d-2742f1ba77cc`
- **Caractéristique** : `e7add780-b042-4876-aae1-112855353cc1`
- **Format de trame** : 17 bytes avec CRC

### Commandes supportées

| Commande | Description |
|----------|-------------|
| `M` | Mesures principales (pH, redox, temp, sel) |
| `S` | Consignes pH |
| `E` | Consignes redox |
| `A` | Production électrolyse |
| `D` | Seuils d'alarme |
| `B` | Boost |

## Dépannage

### Problèmes Bluetooth

```bash
# Vérifier le statut Bluetooth
sudo systemctl status bluetooth

# Scanner les appareils
sudo bluetoothctl
scan on
```

### Logs

```bash
# Logs du script Python
tail -f /var/log/pool_monitor.log

# Logs des services
sudo journalctl -u pool-monitor.service -f
sudo journalctl -u pool-api.service -f
```

### Base de données

```bash
# Accéder à la base SQLite
sqlite3 api/pool_data.db
.tables
SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 10;
```

## Personnalisation

### Seuils d'alarme

Modifiez les fonctions dans `web/app.js` :
- `getPhStatus()` - Seuils pH
- `getTemperatureStatus()` - Seuils température
- `getRedoxStatus()` - Seuils redox
- `getSaltStatus()` - Seuils sel

### Intervalles de mesure

Modifiez `MEASUREMENT_INTERVAL` dans `bluetooth_monitor.py`

### Couleurs graphiques

Modifiez `CHART_COLORS` dans `web/app.js`

## Développement

### Prérequis

- Raspberry Pi avec Bluetooth
- Node.js 16+
- Python 3.8+
- Régulateur CORELEC compatible

### Tests

```bash
# Test de l'API
curl http://localhost:3000/api/health

# Test du script Python (mode simulation)
python3 bluetooth_monitor.py --demo
```

## Licence

MIT License

## Support

Pour toute question ou problème, consultez les logs ou créez une issue.