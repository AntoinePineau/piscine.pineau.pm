# 🏊‍♂️ Installation Pool Monitor Cloud sur Raspberry Pi

Guide complet pour installer le système de monitoring de piscine connecté à votre API Vercel.

## 📋 Prérequis

### Matériel requis
- **Raspberry Pi 4** (recommandé) ou Pi 3B+
- **Carte microSD** 32GB+ (Classe 10)
- **Régulateur CORELEC** avec Bluetooth
- Connexion Internet (WiFi ou Ethernet)

### Systèmes supportés
- Raspberry Pi OS (Bookworm/Bullseye)
- Ubuntu Server pour ARM64

## 🚀 Installation rapide

### 1. Préparation de la carte SD

1. **Téléchargez Raspberry Pi Imager** : https://rpi.org/imager
2. **Flashez l'image** Raspberry Pi OS Lite (64-bit)
3. **Activez SSH** en créant un fichier `ssh` vide sur la partition boot
4. **Configurez WiFi** (optionnel) avec `wpa_supplicant.conf` :

```bash
country=FR
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="VotreWiFi"
    psk="VotreMotDePasse"
}
```

### 2. Premier démarrage

1. **Insérez la carte SD** et démarrez le Pi
2. **Connectez-vous via SSH** :
   ```bash
   ssh pi@raspberrypi.local
   # ou ssh pi@[adresse-ip]
   ```
3. **Mot de passe par défaut** : `raspberry` (changez-le immédiatement!)

### 3. Installation automatique

1. **Téléchargez le script d'installation** :
   ```bash
   wget https://raw.githubusercontent.com/votre-repo/install_cloud.sh
   chmod +x install_cloud.sh
   ```

2. **Lancez l'installation** :
   ```bash
   ./install_cloud.sh
   ```

3. **Suivez les instructions** :
   - Entrez votre URL API Vercel
   - Choisissez l'intervalle de mesure (300s recommandé)

### 4. Démarrage du service

```bash
cd /home/pi/pool-monitor
./control.sh start
```

## 📁 Structure du projet

```
/home/pi/pool-monitor/
├── pool_monitor_cloud.py    # Script principal
├── control.sh               # Contrôle du service
├── test_bluetooth.py        # Test Bluetooth
├── .env                     # Configuration
├── requirements.txt         # Dépendances Python
└── INSTALLATION.md         # Cette documentation
```

## ⚙️ Configuration

### Variables d'environnement (.env)

```bash
# URL de votre API Vercel
API_URL=https://piscinepineau-xxx.vercel.app/api/measurements

# Intervalle entre les mesures (secondes)
MEASUREMENT_INTERVAL=300

# Timeout des requêtes API
API_TIMEOUT=15

# Nombre de tentatives en cas d'échec
MAX_RETRIES=3

# Niveau de logs (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO
```

### Fréquences recommandées

| Intervalle | Mesures/jour | Mesures/mois | Usage |
|------------|--------------|--------------|--------|
| **300s (5min)** | 288 | 8,640 | ✅ **Recommandé** |
| **120s (2min)** | 720 | 21,600 | ⚠️ Acceptable |
| **60s (1min)** | 1,440 | 43,200 | ❌ Éviter |

## 🎛️ Contrôle du service

### Script de contrôle

```bash
./control.sh start          # Démarrer
./control.sh stop           # Arrêter  
./control.sh restart        # Redémarrer
./control.sh status         # Statut
./control.sh logs           # Logs temps réel
./control.sh config         # Afficher config
./control.sh test-api       # Tester l'API
```

### Commandes systemd

```bash
sudo systemctl start pool-monitor-cloud
sudo systemctl stop pool-monitor-cloud
sudo systemctl status pool-monitor-cloud
sudo systemctl enable pool-monitor-cloud   # Démarrage automatique
sudo systemctl disable pool-monitor-cloud  # Désactiver auto-start
```

## 📋 Logs et débogage

### Emplacements des logs

- **Service principal** : `/var/log/pool_monitor_cloud.log`
- **Logs systemd** : `sudo journalctl -u pool-monitor-cloud -f`

### Commandes de diagnostic

```bash
# Statut du service
./control.sh status

# Logs en temps réel
./control.sh logs

# Test Bluetooth
./test_bluetooth.py

# Test API
./control.sh test-api

# Vérifier la connectivité
ping google.com

# État du Bluetooth
sudo systemctl status bluetooth
hciconfig -a
```

### Messages d'erreur courants

#### ❌ "Aucun régulateur CORELEC trouvé"
```bash
# Vérifications:
sudo systemctl restart bluetooth
sudo hciconfig hci0 up
./test_bluetooth.py
```

#### ❌ "Erreur connexion API"
```bash
# Vérifications:
curl https://votre-api.vercel.app/api/health
ping 8.8.8.8  # Test internet
```

#### ❌ "Service failed to start"
```bash
# Diagnostics:
sudo journalctl -u pool-monitor-cloud --no-pager -l
sudo systemctl reset-failed pool-monitor-cloud
```

## 🔧 Maintenance

### Mises à jour

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Mise à jour des dépendances Python
source /home/pi/pool-monitor-env/bin/activate
pip install --upgrade bleak requests aiohttp
```

### Nettoyage des logs

```bash
# Rotation automatique des logs
sudo nano /etc/logrotate.d/pool-monitor
```

Contenu du fichier :
```
/var/log/pool_monitor_cloud.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

### Surveillance

```bash
# Espace disque
df -h

# Utilisation RAM
free -h

# Température CPU
vcgencmd measure_temp

# Activité réseau
sudo iftop
```

## 🔒 Sécurité

### Changement des mots de passe

```bash
# Mot de passe utilisateur pi
passwd

# Mot de passe root (optionnel)
sudo passwd root
```

### Configuration SSH sécurisée

```bash
sudo nano /etc/ssh/sshd_config
```

Modifications recommandées :
```
Port 2222                    # Changer le port par défaut
PermitRootLogin no          # Désactiver root
PasswordAuthentication no   # Utiliser les clés SSH uniquement
```

### Firewall basique

```bash
sudo ufw enable
sudo ufw allow 2222/tcp  # SSH
sudo ufw allow 80/tcp    # HTTP (si interface web locale)
```

## 🧪 Tests de validation

### Test complet du système

```bash
cd /home/pi/pool-monitor

# 1. Test Bluetooth
./test_bluetooth.py

# 2. Test API
./control.sh test-api

# 3. Démarrage du service
./control.sh start

# 4. Vérification des logs
./control.sh logs

# 5. Test d'envoi (vérifiez les logs)
```

### Validation de l'installation

✅ **Checklist de validation** :

- [ ] Raspberry Pi démarré et connecté
- [ ] Bluetooth activé et fonctionnel  
- [ ] Internet accessible
- [ ] Régulateur CORELEC détecté
- [ ] API Vercel accessible
- [ ] Service démarré sans erreur
- [ ] Logs montrent "Envoyé: pH=..."
- [ ] Données visibles sur le site web

## 🆘 Support et dépannage

### FAQ

**Q: Le régulateur n'est pas détecté**
R: Vérifiez que le Bluetooth est activé sur le régulateur et le Pi. Essayez `sudo hciconfig hci0 reset`.

**Q: Erreurs de connexion API**
R: Vérifiez l'URL dans `.env`, testez avec `curl`, contrôlez votre connexion internet.

**Q: Service qui redémarre en boucle**
R: Consultez les logs avec `sudo journalctl -u pool-monitor-cloud -l` pour identifier l'erreur.

**Q: Consommation de data élevée**
R: Augmentez `MEASUREMENT_INTERVAL` dans `.env` et redémarrez le service.

### Contacts

- **Documentation API** : README.md du projet
- **Site de monitoring** : https://piscinepineau-xxx.vercel.app
- **Logs API** : Dashboard Vercel

## 📚 Ressources

- [Documentation Raspberry Pi](https://www.raspberrypi.org/documentation/)
- [Guide Bluetooth Low Energy](https://learn.adafruit.com/introduction-to-bluetooth-low-energy)
- [API Vercel](https://vercel.com/docs)
- [PostgreSQL Neon](https://neon.tech/docs)