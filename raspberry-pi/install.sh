#!/bin/bash

# Script d'installation pour Pool Monitor sur Raspberry Pi

echo "=== Installation de Pool Monitor ==="

# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances système
sudo apt install -y python3 python3-pip python3-venv nodejs npm sqlite3 bluetooth bluez libbluetooth-dev

# Activation du Bluetooth
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Création de l'environnement Python
python3 -m venv /home/pi/pool-monitor-env
source /home/pi/pool-monitor-env/bin/activate

# Installation des dépendances Python
pip install -r requirements.txt

# Installation des dépendances Node.js
cd ../api
npm install

# Création des répertoires de logs
sudo mkdir -p /var/log
sudo touch /var/log/pool_monitor.log
sudo chown pi:pi /var/log/pool_monitor.log

# Création du service systemd pour le monitor Bluetooth
sudo tee /etc/systemd/system/pool-monitor.service > /dev/null <<EOF
[Unit]
Description=Pool Monitor Bluetooth Service
After=bluetooth.service
Requires=bluetooth.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pool-monitor/raspberry-pi
Environment=PATH=/home/pi/pool-monitor-env/bin
ExecStart=/home/pi/pool-monitor-env/bin/python3 bluetooth_monitor.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Création du service systemd pour l'API
sudo tee /etc/systemd/system/pool-api.service > /dev/null <<EOF
[Unit]
Description=Pool Monitor API Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pool-monitor/api
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Activation des services
sudo systemctl daemon-reload
sudo systemctl enable pool-monitor.service
sudo systemctl enable pool-api.service

# Configuration de nginx pour servir l'interface web (optionnel)
if command -v nginx &> /dev/null; then
    sudo tee /etc/nginx/sites-available/pool-monitor > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    root /home/pi/pool-monitor/web;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    sudo ln -sf /etc/nginx/sites-available/pool-monitor /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    echo "Nginx configuré pour servir l'interface web"
fi

# Permissions pour l'utilisateur pi
sudo usermod -a -G bluetooth pi

echo ""
echo "=== Installation terminée ==="
echo ""
echo "Pour démarrer les services:"
echo "  sudo systemctl start pool-monitor.service"
echo "  sudo systemctl start pool-api.service"
echo ""
echo "Pour voir les logs:"
echo "  sudo journalctl -u pool-monitor.service -f"
echo "  sudo journalctl -u pool-api.service -f"
echo "  tail -f /var/log/pool_monitor.log"
echo ""
echo "Interface web accessible sur: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Redémarrez le système pour que tous les changements prennent effet:"
echo "  sudo reboot"