#!/usr/bin/env python3
"""
Pool Regulator Bluetooth Monitor
Script Python pour récupérer les données du régulateur CORELEC via Bluetooth
"""

import asyncio
import struct
import logging
import json
import time
from datetime import datetime
from bleak import BleakClient, BleakScanner
import requests
from requests.exceptions import RequestException

# Configuration
BT_NAMES = ["CORELEC Regulateur", "REGUL."]
BT_UART_SERVICE = "0bd51666-e7cb-469b-8e4d-2742f1ba77cc"
BT_UART_CHARACTERISTIC = "e7add780-b042-4876-aae1-112855353cc1"
API_URL = "http://localhost:3000/api/measurements"
MEASUREMENT_INTERVAL = 30  # secondes

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/pool_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PoolRegulatorMonitor:
    def __init__(self):
        self.client = None
        self.ble_buffer = bytearray()
        self.is_connected = False
        
    async def find_regulator(self):
        """Recherche le régulateur CORELEC"""
        logger.info("Recherche du régulateur CORELEC...")
        
        devices = await BleakScanner.discover(timeout=10.0)
        
        for device in devices:
            if device.name in BT_NAMES:
                logger.info(f"Régulateur trouvé: {device.name} ({device.address})")
                return device.address
        
        raise Exception("Aucun régulateur CORELEC trouvé")
    
    async def connect(self, address):
        """Connexion au régulateur"""
        logger.info(f"Connexion au régulateur {address}...")
        
        self.client = BleakClient(address)
        await self.client.connect()
        
        if not self.client.is_connected:
            raise Exception("Impossible de se connecter au régulateur")
        
        # Activation des notifications
        await self.client.start_notify(BT_UART_CHARACTERISTIC, self.notification_handler)
        self.is_connected = True
        
        logger.info("Connexion établie avec le régulateur")
    
    async def notification_handler(self, sender, data):
        """Gestionnaire des notifications Bluetooth"""
        self.ble_buffer.extend(data)
        
        # Recherche d'une trame complète
        trame = self.parse_buffer()
        if trame:
            logger.debug(f"Trame reçue: {trame.hex()}")
            pool_data = self.process_trame(trame)
            if pool_data:
                await self.send_to_api(pool_data)
    
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
                'ph': self.bytes_to_double(trame[2], trame[3]) / 100.0,
                'redox': self.bytes_to_double(trame[4], trame[5]),
                'temperature': self.bytes_to_double(trame[6], trame[7]) / 10.0,
                'salt': self.bytes_to_double(trame[8], trame[9]) / 10.0,
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
        """Envoi des données vers l'API"""
        try:
            response = requests.post(
                API_URL,
                json=data,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                logger.info(f"Données envoyées: pH={data['ph']:.2f}, T={data['temperature']:.1f}°C, Sel={data['salt']:.1f}g/L")
            else:
                logger.error(f"Erreur API: {response.status_code} - {response.text}")
                
        except RequestException as e:
            logger.error(f"Erreur envoi API: {e}")
    
    async def send_command(self, command):
        """Envoi d'une commande au régulateur"""
        if not self.is_connected:
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
            await asyncio.sleep(0.5)
        
        logger.info("Initialisation terminée")
    
    async def monitoring_loop(self):
        """Boucle principale de monitoring"""
        logger.info("Démarrage du monitoring...")
        
        while self.is_connected:
            try:
                # Demande des mesures principales
                await self.send_command('M')
                await asyncio.sleep(MEASUREMENT_INTERVAL)
                
            except Exception as e:
                logger.error(f"Erreur dans la boucle de monitoring: {e}")
                await asyncio.sleep(5)
    
    async def run(self):
        """Fonction principale"""
        try:
            # Recherche et connexion au régulateur
            address = await self.find_regulator()
            await self.connect(address)
            
            # Initialisation
            await self.initialize_regulator()
            
            # Boucle de monitoring
            await self.monitoring_loop()
            
        except Exception as e:
            logger.error(f"Erreur fatale: {e}")
        finally:
            if self.client and self.client.is_connected:
                await self.client.disconnect()
                logger.info("Déconnexion du régulateur")

async def main():
    """Point d'entrée principal"""
    monitor = PoolRegulatorMonitor()
    
    while True:
        try:
            await monitor.run()
        except KeyboardInterrupt:
            logger.info("Arrêt demandé par l'utilisateur")
            break
        except Exception as e:
            logger.error(f"Redémarrage après erreur: {e}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())