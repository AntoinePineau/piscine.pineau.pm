#!/usr/bin/env python3
"""
Pool Regulator Bluetooth Monitor - Version Cloud
Script Python pour récupérer les données du régulateur CORELEC via Bluetooth
et les envoyer vers une API cloud (Vercel/Netlify)
"""

import asyncio
import struct
import logging
import json
import time
import os
from datetime import datetime
from bleak import BleakClient, BleakScanner
import requests
from requests.exceptions import RequestException

# Configuration
BT_NAMES = ["CORELEC Regulateur", "REGUL."]
BT_UART_SERVICE = "0bd51666-e7cb-469b-8e4d-2742f1ba77cc"
BT_UART_CHARACTERISTIC = "e7add780-b042-4876-aae1-112855353cc1"

# URL de l'API cloud - À modifier avec votre URL Vercel
API_URL = os.getenv('API_URL', 'https://votre-api.vercel.app/api/measurements')
MEASUREMENT_INTERVAL = int(os.getenv('MEASUREMENT_INTERVAL', 30))  # secondes
API_TIMEOUT = int(os.getenv('API_TIMEOUT', 15))  # secondes
MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))

# Configuration du logging
log_level = os.getenv('LOG_LEVEL', 'INFO')
logging.basicConfig(
    level=getattr(logging, log_level.upper()),
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/pool_monitor_cloud.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PoolRegulatorMonitor:
    def __init__(self):
        self.client = None
        self.ble_buffer = bytearray()
        self.is_connected = False
        self.failed_attempts = 0
        self.last_successful_send = None
        
    async def find_regulator(self):
        """Recherche le régulateur CORELEC"""
        logger.info("Recherche du régulateur CORELEC...")
        
        try:
            devices = await BleakScanner.discover(timeout=15.0)
            
            for device in devices:
                if device.name in BT_NAMES:
                    logger.info(f"Régulateur trouvé: {device.name} ({device.address})")
                    return device.address
            
            # Recherche étendue si aucun appareil trouvé
            logger.warning("Aucun régulateur trouvé, recherche étendue...")
            devices = await BleakScanner.discover(timeout=30.0)
            
            for device in devices:
                if device.name and any(name.lower() in device.name.lower() for name in ['corelec', 'regul']):
                    logger.info(f"Régulateur potentiel trouvé: {device.name} ({device.address})")
                    return device.address
                    
        except Exception as e:
            logger.error(f"Erreur lors de la recherche: {e}")
        
        raise Exception("Aucun régulateur CORELEC trouvé")
    
    async def connect(self, address):
        """Connexion au régulateur avec retry"""
        max_attempts = 3
        
        for attempt in range(max_attempts):
            try:
                logger.info(f"Tentative de connexion {attempt + 1}/{max_attempts} au régulateur {address}...")
                
                self.client = BleakClient(address)
                await self.client.connect()
                
                if not self.client.is_connected:
                    raise Exception("Connexion échouée")
                
                # Vérification du service
                services = await self.client.get_services()
                service_found = False
                for service in services:
                    if service.uuid.lower() == BT_UART_SERVICE.lower():
                        service_found = True
                        break
                
                if not service_found:
                    await self.client.disconnect()
                    raise Exception(f"Service UART non trouvé")
                
                # Activation des notifications
                await self.client.start_notify(BT_UART_CHARACTERISTIC, self.notification_handler)
                self.is_connected = True
                self.failed_attempts = 0
                
                logger.info("Connexion établie avec le régulateur")
                return
                
            except Exception as e:
                logger.error(f"Tentative {attempt + 1} échouée: {e}")
                if self.client and self.client.is_connected:
                    await self.client.disconnect()
                
                if attempt < max_attempts - 1:
                    await asyncio.sleep(5 * (attempt + 1))  # Délai progressif
        
        raise Exception(f"Impossible de se connecter après {max_attempts} tentatives")
    
    async def notification_handler(self, sender, data):
        """Gestionnaire des notifications Bluetooth"""
        try:
            self.ble_buffer.extend(data)
            
            # Recherche d'une trame complète
            trame = self.parse_buffer()
            if trame:
                logger.debug(f"Trame reçue: {trame.hex()}")
                pool_data = self.process_trame(trame)
                if pool_data:
                    await self.send_to_api(pool_data)
        except Exception as e:
            logger.error(f"Erreur dans notification_handler: {e}")
    
    def parse_buffer(self):
        """Analyse du buffer pour extraire une trame complète"""
        if len(self.ble_buffer) < 17:
            return None
        
        # Recherche du début de trame (0x2A) et fin (0x2A à la position 16)
        for i in range(len(self.ble_buffer) - 16):
            if self.ble_buffer[i] == 0x2A and self.ble_buffer[i + 16] == 0x2A:
                trame = self.ble_buffer[i:i + 17]
                
                # Vérification du CRC
                if self.calculate_crc(trame[:15]) == trame[15]:
                    # Suppression de la trame traitée du buffer
                    self.ble_buffer = self.ble_buffer[i + 17:]
                    return trame
        
        # Nettoyage du buffer si trop gros
        if len(self.ble_buffer) > 500:
            self.ble_buffer = self.ble_buffer[-100:]
        
        return None
    
    def calculate_crc(self, data):
        """Calcul du CRC"""
        crc = 0
        for byte in data:
            crc ^= byte
        return crc
    
    def bytes_to_double(self, high_byte, low_byte):
        """Conversion de 2 bytes en double"""
        return (high_byte << 8) + low_byte
    
    def process_trame(self, trame):
        """Traitement d'une trame reçue"""
        if len(trame) < 17:
            return None
        
        mnemo = chr(trame[1])
        
        # Traitement selon le type de trame
        if mnemo == 'M':  # Trame des mesures principales
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
        """Envoi des données vers l'API cloud avec retry"""
        for attempt in range(MAX_RETRIES):
            try:
                response = requests.post(
                    API_URL,
                    json=data,
                    timeout=API_TIMEOUT,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'PoolMonitor/1.0'
                    }
                )
                
                if response.status_code in [200, 201]:
                    self.last_successful_send = datetime.now()
                    self.failed_attempts = 0
                    logger.info(f"✓ Données envoyées: pH={data['ph']}, T={data['temperature']}°C, Sel={data['salt']}g/L, Redox={data['redox']}mV")
                    return
                else:
                    logger.warning(f"Réponse API non-OK: {response.status_code} - {response.text[:200]}")
                    
            except requests.exceptions.Timeout:
                logger.error(f"Timeout API (tentative {attempt + 1}/{MAX_RETRIES})")
            except requests.exceptions.ConnectionError:
                logger.error(f"Erreur de connexion API (tentative {attempt + 1}/{MAX_RETRIES})")
            except RequestException as e:
                logger.error(f"Erreur requête API (tentative {attempt + 1}/{MAX_RETRIES}): {e}")
            except Exception as e:
                logger.error(f"Erreur inattendue envoi API (tentative {attempt + 1}/{MAX_RETRIES}): {e}")
            
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)  # Backoff exponentiel
        
        self.failed_attempts += 1
        logger.error(f"✗ Échec envoi API après {MAX_RETRIES} tentatives (échecs consécutifs: {self.failed_attempts})")
    
    async def send_command(self, command):
        """Envoi d'une commande au régulateur"""
        if not self.is_connected or not self.client:
            return
        
        # Création de la trame de commande
        cmd_frame = bytearray([0x2A, 0x52, 0x3F, ord(command), 0xFF, 0x2A])
        cmd_frame[4] = self.calculate_crc(cmd_frame[:4])
        
        try:
            await self.client.write_gatt_char(BT_UART_CHARACTERISTIC, cmd_frame)
            logger.debug(f"Commande envoyée: {command}")
        except Exception as e:
            logger.error(f"Erreur envoi commande {command}: {e}")
    
    async def initialize_regulator(self):
        """Séquence d'initialisation du régulateur"""
        logger.info("Initialisation du régulateur...")
        
        commands = ['M', 'E', 'S', 'A', 'D', 'B']
        
        for cmd in commands:
            await self.send_command(cmd)
            await asyncio.sleep(0.8)  # Délai un peu plus long pour la stabilité
        
        logger.info("Initialisation terminée")
    
    async def health_check(self):
        """Vérification périodique de l'état du système"""
        try:
            # Test de l'API cloud
            health_response = requests.get(
                API_URL.replace('/measurements', '/health'),
                timeout=10
            )
            
            if health_response.status_code == 200:
                logger.debug("API cloud accessible")
            else:
                logger.warning(f"API cloud répond avec le code: {health_response.status_code}")
                
        except Exception as e:
            logger.warning(f"Health check API échoué: {e}")
        
        # Vérification de la connexion Bluetooth
        if not self.is_connected or not self.client or not self.client.is_connected:
            logger.warning("Connexion Bluetooth perdue")
            raise Exception("Connexion Bluetooth interrompue")
    
    async def monitoring_loop(self):
        """Boucle principale de monitoring"""
        logger.info(f"Démarrage du monitoring (intervalle: {MEASUREMENT_INTERVAL}s)...")
        
        health_check_interval = 300  # 5 minutes
        last_health_check = 0
        
        while self.is_connected:
            try:
                current_time = time.time()
                
                # Health check périodique
                if current_time - last_health_check > health_check_interval:
                    await self.health_check()
                    last_health_check = current_time
                
                # Demande des mesures principales
                await self.send_command('M')
                
                # Statistiques
                if self.last_successful_send:
                    time_since_last = datetime.now() - self.last_successful_send
                    if time_since_last.total_seconds() > 300:  # 5 minutes
                        logger.warning(f"Pas d'envoi réussi depuis {time_since_last}")
                
                await asyncio.sleep(MEASUREMENT_INTERVAL)
                
            except Exception as e:
                logger.error(f"Erreur dans la boucle de monitoring: {e}")
                await asyncio.sleep(5)
                break
    
    async def run(self):
        """Fonction principale avec gestion de reconnexion"""
        while True:
            try:
                # Recherche et connexion au régulateur
                address = await self.find_regulator()
                await self.connect(address)
                
                # Initialisation
                await self.initialize_regulator()
                
                # Boucle de monitoring
                await self.monitoring_loop()
                
            except KeyboardInterrupt:
                logger.info("Arrêt demandé par l'utilisateur")
                break
            except Exception as e:
                logger.error(f"Erreur: {e}")
                self.failed_attempts += 1
                
                # Délai progressif en cas d'échecs répétés
                delay = min(60, 10 * self.failed_attempts)
                logger.info(f"Nouvelle tentative dans {delay} secondes...")
                await asyncio.sleep(delay)
                
            finally:
                # Nettoyage
                self.is_connected = False
                if self.client and self.client.is_connected:
                    try:
                        await self.client.disconnect()
                        logger.info("Déconnexion du régulateur")
                    except:
                        pass

async def main():
    """Point d'entrée principal"""
    logger.info("=== Pool Monitor Cloud - Démarrage ===")
    logger.info(f"API URL: {API_URL}")
    logger.info(f"Intervalle de mesure: {MEASUREMENT_INTERVAL}s")
    
    monitor = PoolRegulatorMonitor()
    
    try:
        await monitor.run()
    except KeyboardInterrupt:
        logger.info("Arrêt du programme")
    except Exception as e:
        logger.error(f"Erreur fatale: {e}")
    finally:
        logger.info("=== Pool Monitor Cloud - Arrêt ===")

if __name__ == "__main__":
    # Configuration des signaux pour un arrêt propre
    import signal
    
    def signal_handler(signum, frame):
        logger.info(f"Signal {signum} reçu, arrêt en cours...")
        raise KeyboardInterrupt()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    asyncio.run(main())