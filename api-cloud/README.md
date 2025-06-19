# 🏊‍♂️ API Monitoring Piscine

API de surveillance en temps réel pour les paramètres de qualité d'eau de piscine.

## 🚀 Déploiement

- **Site web :** https://piscinepineau-bjq4jd5rs-antoinepineau.vercel.app
- **Base de données :** PostgreSQL (Neon)
- **Hébergement :** Vercel (Serverless Functions)

## 📊 Endpoints API

### Mesures en temps réel
- `GET /api/health` - Santé de l'API
- `GET /api/measurements` - Liste des mesures (7 derniers jours)
- `POST /api/measurements` - Ajouter une nouvelle mesure
- `GET /api/latest` - Dernière mesure enregistrée
- `GET /api/stats?hours=24` - Statistiques sur une période
- `GET /api/chart-data?hours=24&interval=hour` - Données pour graphiques

### Historique et maintenance
- `GET /api/history?days=30&type=daily` - Moyennes quotidiennes historiques
- `GET /api/cleanup` - Nettoyage manuel des anciennes données
- `GET /api/cron` - Nettoyage automatique (tâche quotidienne)

## 🔧 Configuration Raspberry Pi

### Fréquence recommandée
Pour rester dans les limites gratuites de Neon et Vercel :

```bash
# ✅ RECOMMANDÉ: Toutes les 5 minutes
*/5 * * * * /usr/bin/python3 /home/pi/pool_monitor.py

# ⚠️ ACCEPTABLE: Toutes les 2 minutes  
*/2 * * * * /usr/bin/python3 /home/pi/pool_monitor.py

# ❌ ÉVITER: Toutes les minutes (risque de dépassement)
* * * * * /usr/bin/python3 /home/pi/pool_monitor.py
```

### Format des données POST
```json
{
  "ph": 7.2,
  "redox": 650,
  "temperature": 24.5,
  "salt": 3.2,
  "alarm": 0,
  "warning": 0,
  "alarm_redox": 0,
  "regulator_type": 1,
  "pump_plus_active": false,
  "pump_minus_active": false,
  "pump_chlore_active": true,
  "filter_relay_active": true
}
```

## 🎯 Seuils d'alerte

| Paramètre | Optimal | Acceptable | Critique |
|-----------|---------|------------|----------|
| **pH** | 7.0 - 7.4 | 6.8 - 7.6 | < 6.8 ou > 7.6 |
| **Redox** | 600 - 700 mV | 550 - 750 mV | < 550 ou > 750 |
| **Température** | 20 - 28°C | 15 - 32°C | < 15 ou > 32 |
| **Sel** | 3.0 - 5.0 g/L | 2.5 - 6.0 g/L | < 2.5 ou > 6.0 |

## 🗂️ Stratégie de rétention des données

### Automatique (via CRON quotidien)
1. **7 derniers jours :** Mesures détaillées conservées
2. **8 jours à 2 ans :** Moyennes quotidiennes uniquement  
3. **> 2 ans :** Données supprimées automatiquement

### Calculs de consommation
- **5 min/mesure :** ~105K mesures/an = 20MB ✅
- **2 min/mesure :** ~262K mesures/an = 50MB ✅  
- **1 min/mesure :** ~525K mesures/an = 100MB ⚠️

## 🔄 Maintenance automatique

### Nettoyage CRON (recommandé)
Ajoutez à votre service de cron externe (ex: cron-job.org) :
```
# Tous les jours à 2h du matin
0 2 * * * curl "https://votre-api.vercel.app/api/cron"
```

### Nettoyage manuel
```bash
curl "https://votre-api.vercel.app/api/cleanup"
```

## 📱 Interface web

### Fonctionnalités
- **Tableau de bord** en temps réel
- **Graphiques Highcharts** interactifs
- **Indicateurs visuels** pour valeurs hors normes
- **Historique** sur 6h, 24h, 48h, 7j
- **Actualisation automatique** toutes les 30s
- **Design responsive** mobile/desktop

### Codes couleur
- 🟢 **Vert :** Valeurs normales (✅)
- 🟠 **Orange :** Attention requise (◀️ ▶️)  
- 🔴 **Rouge :** Intervention urgente (⬇️ ⬆️)

## 🔒 Sécurité

- **CORS** configuré pour tous domaines
- **Rate limiting** sur les endpoints
- **Validation** des données d'entrée
- **Gestion d'erreurs** robuste

## 📈 Monitoring des limites

Surveillez vos quotas via :
- **Vercel :** Dashboard Vercel > Usage
- **Neon :** Console Neon > Storage & Compute
- **API :** `/api/cleanup` pour statistiques DB