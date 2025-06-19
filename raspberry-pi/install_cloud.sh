#!/bin/bash

# Script d'installation Pool Monitor Cloud pour Raspberry Pi
# Version optimisée pour API Vercel avec gestion de la rétention des données

echo "🏊‍♂️ === Installation Pool Monitor Cloud ===" 
echo "Compatible avec API Vercel et base Neon PostgreSQL"
echo ""

# Variables de configuration
INSTALL_DIR="/home/pi/pool-monitor"
SERVICE_NAME="pool-monitor-cloud"
LOG_FILE="/var/log/pool_monitor_cloud.log"
PYTHON_ENV_DIR="/home/pi/pool-monitor-env"

# Vérification des privilèges
if [ "$EUID" -eq 0 ]; then
    echo "❌ Ne lancez pas ce script en tant que root"
    echo "Utilisez: bash install_cloud.sh"
    exit 1
fi

echo "📋 Configuration:"
echo "   - Répertoire d'installation: $INSTALL_DIR"
echo "   - Service systemd: $SERVICE_NAME"
echo "   - Logs: $LOG_FILE"
echo "   - Environnement Python: $PYTHON_ENV_DIR"
echo ""

# Demande de confirmation de l'URL API
read -p "🌐 URL de votre API Vercel (ex: https://piscinepineau-xxx.vercel.app/api/measurements): " API_URL
if [ -z "$API_URL" ]; then
    echo "❌ URL API requise"
    exit 1
fi

# Demande de l'intervalle de mesure
echo ""
echo "⏱️  Fréquence de mesure recommandée:"
echo "   - 300s (5 min) - Optimal pour limites gratuites"
echo "   - 120s (2 min) - Acceptable"
echo "   - 60s (1 min)  - À éviter (risque dépassement)"
echo ""
read -p "Intervalle en secondes [300]: " MEASUREMENT_INTERVAL
MEASUREMENT_INTERVAL=${MEASUREMENT_INTERVAL:-300}

echo ""
echo "🚀 Démarrage de l'installation..."

# Mise à jour du système
echo "📦 Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# Installation des dépendances système
echo "📦 Installation des dépendances..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    bluetooth \
    bluez \
    libbluetooth-dev \
    curl \
    git \
    nano

# Activation du Bluetooth
echo "📡 Configuration du Bluetooth..."
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Ajout de l'utilisateur pi au groupe bluetooth
sudo usermod -a -G bluetooth pi

# Création du répertoire d'installation
echo "📁 Création des répertoires..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Création de l'environnement Python
echo "🐍 Configuration de l'environnement Python..."
python3 -m venv "$PYTHON_ENV_DIR"
source "$PYTHON_ENV_DIR/bin/activate"

# Mise à jour de pip
pip install --upgrade pip

# Installation des dépendances Python
echo "📦 Installation des packages Python..."
pip install \
    bleak==0.21.1 \
    requests==2.31.0 \
    aiohttp==3.9.1

# Création du fichier requirements.txt
cat > requirements.txt << EOF
bleak==0.21.1
requests==2.31.0
aiohttp==3.9.1
EOF

# Création du script Python optimisé
echo "🐍 Création du script de monitoring..."
cat > pool_monitor_cloud.py << 'PYTHON_SCRIPT_EOF'
#!/usr/bin/env python3
"""
Pool Monitor Cloud - Version optimisée pour API Vercel
Monitoring du régulateur CORELEC avec envoi vers API cloud
"""

import asyncio
import struct
import logging
import json
import time
import os
import signal
from datetime import datetime
from bleak import BleakClient, BleakScanner
import requests
from requests.exceptions import RequestException

# Configuration depuis les variables d'environnement
BT_NAMES = ["CORELEC Regulateur", "REGUL."]
BT_UART_SERVICE = "0bd51666-e7cb-469b-8e4d-2742f1ba77cc"
BT_UART_CHARACTERISTIC = "e7add780-b042-4876-aae1-112855353cc1"

API_URL = os.getenv('API_URL')
MEASUREMENT_INTERVAL = int(os.getenv('MEASUREMENT_INTERVAL', 300))
API_TIMEOUT = int(os.getenv('API_TIMEOUT', 15))
MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Configuration du logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper()),
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/pool_monitor_cloud.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PoolMonitorCloud:
    def __init__(self):
        self.client = None
        self.ble_buffer = bytearray()
        self.is_connected = False
        self.failed_attempts = 0
        self.last_successful_send = None
        self.should_stop = False
        
    def setup_signal_handlers(self):
        """Configuration des gestionnaires de signaux"""
        def signal_handler(signum, frame):
            logger.info(f"Signal {signum} reçu, arrêt en cours...")
            self.should_stop = True
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
    async def find_regulator(self):
        """Recherche le régulateur CORELEC"""
        logger.info("🔍 Recherche du régulateur CORELEC...")
        
        try:
            devices = await BleakScanner.discover(timeout=15.0)
            
            for device in devices:
                if device.name in BT_NAMES:
                    logger.info(f"✓ Régulateur trouvé: {device.name} ({device.address})")
                    return device.address
            
            # Recherche étendue
            logger.warning("⚠️ Recherche étendue...")
            devices = await BleakScanner.discover(timeout=30.0)
            
            for device in devices:
                if device.name and any(name.lower() in device.name.lower() for name in ['corelec', 'regul']):
                    logger.info(f"✓ Régulateur potentiel: {device.name} ({device.address})")
                    return device.address
                    
        except Exception as e:
            logger.error(f"❌ Erreur recherche: {e}")
        
        raise Exception("❌ Aucun régulateur CORELEC trouvé")
    
    async def connect(self, address):
        """Connexion au régulateur avec retry"""
        max_attempts = 3
        
        for attempt in range(max_attempts):
            try:
                logger.info(f"🔗 Connexion {attempt + 1}/{max_attempts} au {address}...")
                
                self.client = BleakClient(address)
                await self.client.connect()
                
                if not self.client.is_connected:
                    raise Exception("Connexion échouée")
                
                # Vérification du service UART
                services = await self.client.get_services()
                service_found = False
                for service in services:
                    if service.uuid.lower() == BT_UART_SERVICE.lower():
                        service_found = True
                        break
                
                if not service_found:
                    await self.client.disconnect()
                    raise Exception("Service UART non trouvé")
                
                # Activation des notifications
                await self.client.start_notify(BT_UART_CHARACTERISTIC, self.notification_handler)
                self.is_connected = True
                self.failed_attempts = 0
                
                logger.info("✓ Connexion Bluetooth établie")
                return
                
            except Exception as e:
                logger.error(f"❌ Tentative {attempt + 1} échouée: {e}")
                if self.client and self.client.is_connected:
                    await self.client.disconnect()
                
                if attempt < max_attempts - 1:
                    await asyncio.sleep(5 * (attempt + 1))
        
        raise Exception(f"❌ Connexion impossible après {max_attempts} tentatives")
    
    async def notification_handler(self, sender, data):
        """Gestionnaire des notifications Bluetooth"""
        try:
            self.ble_buffer.extend(data)
            
            # Analyse du buffer pour extraire une trame
            trame = self.parse_buffer()
            if trame:
                logger.debug(f"📡 Trame reçue: {trame.hex()}")
                pool_data = self.process_trame(trame)
                if pool_data:
                    await self.send_to_api(pool_data)
        except Exception as e:
            logger.error(f"❌ Erreur notification: {e}")
    
    def parse_buffer(self):
        """Extraction d'une trame complète du buffer"""
        if len(self.ble_buffer) < 17:
            return None
        
        # Recherche de trame valide (0x2A...0x2A)
        for i in range(len(self.ble_buffer) - 16):
            if self.ble_buffer[i] == 0x2A and self.ble_buffer[i + 16] == 0x2A:
                trame = self.ble_buffer[i:i + 17]
                
                # Vérification CRC
                if self.calculate_crc(trame[:15]) == trame[15]:
                    self.ble_buffer = self.ble_buffer[i + 17:]
                    return trame
        
        # Nettoyage du buffer si trop volumineux
        if len(self.ble_buffer) > 500:
            self.ble_buffer = self.ble_buffer[-100:]
        
        return None
    
    def calculate_crc(self, data):
        """Calcul du CRC XOR"""
        crc = 0
        for byte in data:
            crc ^= byte
        return crc
    
    def bytes_to_double(self, high_byte, low_byte):
        """Conversion 2 bytes vers entier"""
        return (high_byte << 8) + low_byte
    
    def process_trame(self, trame):
        """Traitement d'une trame de mesures"""
        if len(trame) < 17:
            return None
        
        mnemo = chr(trame[1])
        
        if mnemo == 'M':  # Trame mesures principales
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'ph': round(self.bytes_to_double(trame[2], trame[3]) / 100.0, 2),
                'redox': round(self.bytes_to_double(trame[4], trame[5]), 0),
                'temperature': round(self.bytes_to_double(trame[6], trame[7]) / 10.0, 1),
                'salt': round(self.bytes_to_double(trame[8], trame[9]) / 10.0, 1),
                'alarm': trame[10],
                'warning': trame[11] & 15,
                'alarm_redox': trame[11] >> 4,
                'regulator_type': trame[12] & 15,
                'pump_plus_active': bool(trame[12] & 0x80),
                'pump_minus_active': bool(trame[12] & 0x40),
                'pump_chlore_active': bool(trame[12] & 0x20),
                'filter_relay_active': bool(trame[12] & 0x10)
            }
        
        return None
    
    async def send_to_api(self, data):
        """Envoi optimisé vers l'API Vercel"""
        for attempt in range(MAX_RETRIES):
            try:
                response = requests.post(
                    API_URL,
                    json=data,
                    timeout=API_TIMEOUT,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'PoolMonitorCloud/2.0'
                    }
                )
                
                if response.status_code in [200, 201]:
                    self.last_successful_send = datetime.now()
                    self.failed_attempts = 0
                    logger.info(f"✅ Envoyé: pH={data['ph']}, T={data['temperature']}°C, Sel={data['salt']}g/L, Redox={data['redox']}mV")
                    return
                else:
                    logger.warning(f"⚠️ API réponse: {response.status_code}")
                    
            except requests.exceptions.Timeout:
                logger.error(f"⏱️ Timeout API (tentative {attempt + 1})")
            except requests.exceptions.ConnectionError:
                logger.error(f"🌐 Connexion API échouée (tentative {attempt + 1})")
            except Exception as e:
                logger.error(f"❌ Erreur API (tentative {attempt + 1}): {e}")
            
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)
        
        self.failed_attempts += 1
        logger.error(f"❌ Échec envoi API (échecs: {self.failed_attempts})")
    
    async def send_command(self, command):
        """Envoi d'une commande au régulateur"""
        if not self.is_connected or not self.client:
            return
        
        cmd_frame = bytearray([0x2A, 0x52, 0x3F, ord(command), 0xFF, 0x2A])
        cmd_frame[4] = self.calculate_crc(cmd_frame[:4])
        
        try:
            await self.client.write_gatt_char(BT_UART_CHARACTERISTIC, cmd_frame)
            logger.debug(f"📤 Commande: {command}")
        except Exception as e:
            logger.error(f"❌ Erreur commande {command}: {e}")
    
    async def initialize_regulator(self):
        """Initialisation du régulateur"""
        logger.info("🔧 Initialisation du régulateur...")
        
        commands = ['M', 'E', 'S', 'A', 'D', 'B']
        
        for cmd in commands:
            await self.send_command(cmd)
            await asyncio.sleep(0.8)
        
        logger.info("✓ Initialisation terminée")
    
    async def health_check(self):
        """Vérification de l'état du système"""
        try:
            # Test API
            health_url = API_URL.replace('/measurements', '/health')
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                logger.debug("✓ API accessible")
            else:
                logger.warning(f"⚠️ API statut: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"❌ Health check: {e}")
        
        # Vérification Bluetooth
        if not self.is_connected or not self.client or not self.client.is_connected:
            raise Exception("❌ Connexion Bluetooth perdue")
    
    async def monitoring_loop(self):
        """Boucle principale optimisée"""
        logger.info(f"🔄 Démarrage monitoring (intervalle: {MEASUREMENT_INTERVAL}s)")
        
        health_check_interval = 300  # 5 minutes
        last_health_check = 0
        
        while self.is_connected and not self.should_stop:
            try:
                current_time = time.time()
                
                # Health check périodique
                if current_time - last_health_check > health_check_interval:
                    await self.health_check()
                    last_health_check = current_time
                
                # Demande de mesures
                await self.send_command('M')
                
                # Statistiques
                if self.last_successful_send:
                    time_since = datetime.now() - self.last_successful_send
                    if time_since.total_seconds() > 600:  # 10 minutes
                        logger.warning(f"⚠️ Pas d'envoi depuis {time_since}")
                
                await asyncio.sleep(MEASUREMENT_INTERVAL)
                
            except Exception as e:
                logger.error(f"❌ Erreur monitoring: {e}")
                break
    
    async def run(self):
        """Fonction principale avec reconnexion automatique"""
        self.setup_signal_handlers()
        
        while not self.should_stop:
            try:
                # Recherche et connexion
                address = await self.find_regulator()
                await self.connect(address)
                
                # Initialisation
                await self.initialize_regulator()
                
                # Monitoring
                await self.monitoring_loop()
                
            except KeyboardInterrupt:
                logger.info("🛑 Arrêt demandé")
                break
            except Exception as e:
                logger.error(f"❌ Erreur: {e}")
                self.failed_attempts += 1
                
                # Délai progressif
                delay = min(60, 10 * self.failed_attempts)
                logger.info(f"🔄 Nouvelle tentative dans {delay}s...")
                
                for i in range(delay):
                    if self.should_stop:
                        break
                    await asyncio.sleep(1)
                
            finally:
                # Nettoyage
                self.is_connected = False
                if self.client and self.client.is_connected:
                    try:
                        await self.client.disconnect()
                        logger.info("🔌 Déconnexion Bluetooth")
                    except:
                        pass

async def main():
    """Point d'entrée principal"""
    if not API_URL:
        logger.error("❌ Variable API_URL non définie")
        return
    
    logger.info("🏊‍♂️ === Pool Monitor Cloud - Démarrage ===")
    logger.info(f"🌐 API: {API_URL}")
    logger.info(f"⏱️ Intervalle: {MEASUREMENT_INTERVAL}s")
    
    monitor = PoolMonitorCloud()
    
    try:
        await monitor.run()
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt du programme")
    except Exception as e:
        logger.error(f"💥 Erreur fatale: {e}")
    finally:
        logger.info("🏊‍♂️ === Pool Monitor Cloud - Arrêt ===")

if __name__ == "__main__":
    asyncio.run(main())
PYTHON_SCRIPT_EOF

# Rendre le script exécutable
chmod +x pool_monitor_cloud.py

# Création du fichier de configuration
echo "📝 Création de la configuration..."
cat > .env << EOF
# Configuration Pool Monitor Cloud
API_URL=${API_URL}
MEASUREMENT_INTERVAL=${MEASUREMENT_INTERVAL}
API_TIMEOUT=15
MAX_RETRIES=3
LOG_LEVEL=INFO
EOF

# Création du fichier log
echo "📋 Configuration des logs..."
sudo touch "$LOG_FILE"
sudo chown pi:pi "$LOG_FILE"

# Création du service systemd
echo "⚙️ Création du service systemd..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Pool Monitor Cloud Service
After=bluetooth.service network.target
Requires=bluetooth.service
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=${INSTALL_DIR}
Environment=PATH=${PYTHON_ENV_DIR}/bin
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${PYTHON_ENV_DIR}/bin/python3 ${INSTALL_DIR}/pool_monitor_cloud.py
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

# Politique de redémarrage robuste
StartLimitInterval=300
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
EOF

# Activation du service
echo "🔧 Configuration du service..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}.service

# Création du script de contrôle
echo "🎛️ Création des scripts de contrôle..."
cat > control.sh << 'EOF'
#!/bin/bash
# Script de contrôle Pool Monitor Cloud

SERVICE_NAME="pool-monitor-cloud"
LOG_FILE="/var/log/pool_monitor_cloud.log"

case "$1" in
    start)
        echo "🚀 Démarrage du service..."
        sudo systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "🛑 Arrêt du service..."
        sudo systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "🔄 Redémarrage du service..."
        sudo systemctl restart $SERVICE_NAME
        ;;
    status)
        echo "📊 Statut du service:"
        sudo systemctl status $SERVICE_NAME
        ;;
    logs)
        echo "📋 Logs en temps réel (Ctrl+C pour quitter):"
        tail -f $LOG_FILE
        ;;
    logs-journal)
        echo "📋 Logs systemd:"
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    config)
        echo "⚙️ Configuration actuelle:"
        cat .env
        ;;
    test-api)
        echo "🧪 Test de l'API..."
        source .env
        curl -s "$API_URL" | head -200
        ;;
    *)
        echo "Pool Monitor Cloud - Contrôle"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|logs-journal|config|test-api}"
        echo ""
        echo "Commandes:"
        echo "  start         - Démarrer le service"
        echo "  stop          - Arrêter le service" 
        echo "  restart       - Redémarrer le service"
        echo "  status        - Afficher le statut"
        echo "  logs          - Suivre les logs"
        echo "  logs-journal  - Logs systemd"
        echo "  config        - Afficher la config"
        echo "  test-api      - Tester l'API"
        ;;
esac
EOF

chmod +x control.sh

# Création du script de test
cat > test_bluetooth.py << 'PYTHON_TEST_EOF'
#!/usr/bin/env python3
"""Script de test pour vérifier la détection du régulateur"""

import asyncio
from bleak import BleakScanner

async def scan_devices():
    print("🔍 Recherche d'appareils Bluetooth...")
    devices = await BleakScanner.discover(timeout=15.0)
    
    print(f"\n📱 {len(devices)} appareils trouvés:")
    for device in devices:
        name = device.name or "Nom inconnu"
        print(f"  - {name} ({device.address}) - RSSI: {device.rssi}")
        
        if any(target in name.upper() for target in ['CORELEC', 'REGUL']):
            print(f"    ✅ RÉGULATEUR DÉTECTÉ!")

if __name__ == "__main__":
    asyncio.run(scan_devices())
PYTHON_TEST_EOF

chmod +x test_bluetooth.py

echo ""
echo "🎉 === Installation terminée avec succès! ==="
echo ""
echo "📍 Répertoire d'installation: $INSTALL_DIR"
echo "🌐 API configurée: $API_URL"
echo "⏱️ Intervalle de mesure: ${MEASUREMENT_INTERVAL}s"
echo ""
echo "🎛️ Commandes disponibles:"
echo "   cd $INSTALL_DIR"
echo "   ./control.sh start     # Démarrer le service"
echo "   ./control.sh status    # Voir le statut"
echo "   ./control.sh logs      # Suivre les logs"
echo "   ./control.sh stop      # Arrêter le service"
echo ""
echo "🧪 Tests disponibles:"
echo "   ./test_bluetooth.py    # Test détection Bluetooth"
echo "   ./control.sh test-api  # Test connexion API"
echo ""
echo "📋 Logs du service:"
echo "   $LOG_FILE"
echo ""
echo "⚠️ Prochaines étapes:"
echo "1. Redémarrez le Raspberry Pi: sudo reboot"
echo "2. Après redémarrage: cd $INSTALL_DIR && ./control.sh start"
echo "3. Surveillez les logs: ./control.sh logs"
echo ""

# Test final de la configuration
echo "🧪 Test de configuration..."
source .env
if curl -s --connect-timeout 5 "${API_URL/measurements/health}" > /dev/null 2>&1; then
    echo "✅ API accessible"
else
    echo "⚠️ API non accessible (vérifiez l'URL)"
fi

echo ""
echo "✅ Installation réussie!"
echo "📚 Consultez le README.md pour plus d'informations"