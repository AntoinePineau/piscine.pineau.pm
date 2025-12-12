#!/bin/bash

# Script pour déployer et configurer l'environnement Vercel
# Usage: ./scripts/deploy-to-vercel.sh [VERCEL_TOKEN]

set -e

echo "🚀 Déploiement et configuration Vercel"
echo ""

# Charger le .env
if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable"
  exit 1
fi

source .env

# Vérifier le token
VERCEL_TOKEN=${1:-$VERCEL_TOKEN}
if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Token Vercel manquant"
  echo "Usage: ./scripts/deploy-to-vercel.sh <VERCEL_TOKEN>"
  echo "Ou définir VERCEL_TOKEN dans .env"
  exit 1
fi

echo "✅ Token Vercel trouvé"
echo ""

# Nom du projet (à adapter si nécessaire)
PROJECT_NAME="piscine-pineau-pm"

echo "📋 Configuration des variables d'environnement..."
echo ""

# Fonction pour ajouter une variable
add_env() {
  local key=$1
  local value=$2

  echo "  ⏳ Ajout de $key..."

  curl -X POST "https://api.vercel.com/v10/projects/$PROJECT_NAME/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"key\": \"$key\",
      \"value\": \"$value\",
      \"type\": \"encrypted\",
      \"target\": [\"production\", \"preview\"]
    }" \
    -s -o /dev/null -w "%{http_code}\n" | grep -q "^20" && echo "  ✅ $key ajouté" || echo "  ⚠️  $key existe déjà ou erreur"
}

# Ajouter toutes les variables
add_env "GOOGLE_SERVICE_ACCOUNT_KEY" "$GOOGLE_SERVICE_ACCOUNT_KEY"
add_env "GOOGLE_DRIVE_FOLDER_ID" "$GOOGLE_DRIVE_FOLDER_ID"
add_env "DRIVE_FILE_MEASUREMENTS_ID" "$DRIVE_FILE_MEASUREMENTS_ID"
add_env "DRIVE_FILE_DAILY_AVERAGES_ID" "$DRIVE_FILE_DAILY_AVERAGES_ID"
add_env "DRIVE_FILE_ERROR_LOGS_ID" "$DRIVE_FILE_ERROR_LOGS_ID"
add_env "DRIVE_FILE_ALERTS_ID" "$DRIVE_FILE_ALERTS_ID"
add_env "GEMINI_API_KEY" "$GEMINI_API_KEY"
add_env "EMAIL_PROVIDER" "$EMAIL_PROVIDER"
add_env "GMAIL_USER" "$GMAIL_USER"
add_env "GMAIL_APP_PASSWORD" "$GMAIL_APP_PASSWORD"
add_env "EMAIL_TO" "$EMAIL_TO"
add_env "FRONTEND_URL" "$FRONTEND_URL"
add_env "CRON_SECRET" "$CRON_SECRET"

echo ""
echo "✅ Variables configurées !"
echo ""
echo "🔄 Déclenchement du redéploiement..."

# Déclencher un redéploiement
DEPLOYMENT_RESPONSE=$(curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"gitSource\": {
      \"type\": \"github\",
      \"ref\": \"master\"
    },
    \"target\": \"production\"
  }" \
  -s)

DEPLOYMENT_URL=$(echo $DEPLOYMENT_RESPONSE | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$DEPLOYMENT_URL" ]; then
  echo "✅ Déploiement lancé !"
  echo "🔗 URL: https://$DEPLOYMENT_URL"
  echo ""
  echo "⏳ Attente de fin du déploiement (cela peut prendre 1-2 minutes)..."
  sleep 60
  echo ""
  echo "🧪 Test de l'API..."
  curl -s "https://piscine.pineau.pm/api/health" | jq . || echo "⚠️  API pas encore prête, réessayez dans quelques instants"
else
  echo "⚠️  Impossible de déclencher le déploiement automatiquement"
  echo "Déployez manuellement depuis le dashboard Vercel"
fi

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "📋 URLs à tester:"
echo "  - https://piscine.pineau.pm/api/health"
echo "  - https://piscine.pineau.pm/api/measurements/latest"
echo "  - https://piscine.pineau.pm/api/alerts?active=true"
