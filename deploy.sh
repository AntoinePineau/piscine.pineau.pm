#!/bin/bash

# Script de déploiement automatique Pool Monitor Cloud

set -e

echo "🚀 === Déploiement Pool Monitor Cloud ==="
echo ""

# Vérifications préalables
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI non trouvé. Installation..."
    npm install -g vercel
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git non trouvé. Veuillez l'installer."
    exit 1
fi

echo "✅ Outils vérifiés"

# Variables
DATABASE_URL="postgresql://piscinedb_owner:npg_UkAxwd3TiJo1@ep-icy-meadow-a9fx6xx3-pooler.gwc.azure.neon.tech/piscinedb?sslmode=require"
API_PROJECT_NAME="pool-monitor-api"
WEB_PROJECT_NAME="pool-monitor-web"

echo ""
echo "📡 === Déploiement de l'API ==="
cd api-cloud

# Installation des dépendances
echo "📦 Installation des dépendances API..."
npm install

# Déploiement
echo "🚀 Déploiement API sur Vercel..."
vercel --prod --name "$API_PROJECT_NAME" --yes

# Configuration des variables d'environnement
echo "⚙️  Configuration des variables d'environnement..."
vercel env add DATABASE_URL production <<< "$DATABASE_URL"
vercel env add NODE_ENV production <<< "production"

echo "✅ API déployée"

# Récupération de l'URL de l'API
API_URL=$(vercel ls 2>/dev/null | grep "$API_PROJECT_NAME" | awk '{print $2}' | head -1)
if [ -z "$API_URL" ]; then
    echo "⚠️  Impossible de récupérer l'URL automatiquement"
    echo "📝 Veuillez noter l'URL de votre API et la configurer manuellement dans web-cloud/app.js"
    read -p "Entrez l'URL de votre API (sans /api): " API_URL
fi

echo "🌐 URL de l'API: https://$API_URL"

echo ""
echo "🌐 === Déploiement de l'interface web ==="
cd ../web-cloud

# Mise à jour de l'URL de l'API
echo "🔧 Configuration de l'URL de l'API..."
sed -i.bak "s|https://pool-monitor-api.vercel.app|https://$API_URL|g" app.js

# Déploiement
echo "🚀 Déploiement interface web sur Vercel..."
vercel --prod --name "$WEB_PROJECT_NAME" --yes

# Récupération de l'URL du web
WEB_URL=$(vercel ls 2>/dev/null | grep "$WEB_PROJECT_NAME" | awk '{print $2}' | head -1)

echo "✅ Interface web déployée"
echo "🌐 URL de l'interface: https://$WEB_URL"

echo ""
echo "🔄 === Mise à jour de la configuration CORS ==="
cd ../api-cloud

# Mise à jour FRONTEND_URL
vercel env add FRONTEND_URL production <<< "https://$WEB_URL"

# Redéploiement pour prendre en compte le CORS
echo "🔄 Redéploiement API avec configuration CORS..."
vercel --prod --yes

echo ""
echo "🎉 === Déploiement terminé ==="
echo ""
echo "📊 Interface web: https://$WEB_URL"
echo "📡 API: https://$API_URL"
echo "🗄️  Base de données: Neon PostgreSQL configurée"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Tester l'API: curl https://$API_URL/api/health"
echo "2. Ouvrir l'interface: https://$WEB_URL"
echo "3. Configurer le Raspberry Pi avec:"
echo "   API_URL=https://$API_URL/api/measurements"
echo ""
echo "📖 Voir DEPLOYMENT.md pour la configuration du Raspberry Pi"

# Création du fichier de configuration pour le Raspberry Pi
cd ..
echo "📄 Création du fichier de configuration Raspberry Pi..."
cat > raspberry-pi/config-cloud.env << EOF
# Configuration générée automatiquement
API_URL=https://$API_URL/api/measurements
MEASUREMENT_INTERVAL=30
LOG_LEVEL=INFO
API_TIMEOUT=15
MAX_RETRIES=3
EOF

echo "✅ Configuration sauvée dans raspberry-pi/config-cloud.env"
echo ""
echo "🔧 Pour configurer le Raspberry Pi:"
echo "scp raspberry-pi/config-cloud.env pi@votre-raspberry.local:/home/pi/"
echo "ssh pi@votre-raspberry.local"
echo "sudo cp config-cloud.env /etc/environment"