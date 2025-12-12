#!/bin/bash

# Script pour configurer les variables d'environnement Vercel
# Usage: ./scripts/setup-vercel-env.sh

set -e

echo "🚀 Configuration des variables d'environnement Vercel..."
echo ""

# Charger le .env
if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable"
  exit 1
fi

source .env

# Variables à configurer
declare -a vars=(
  "GOOGLE_SERVICE_ACCOUNT_KEY"
  "GOOGLE_DRIVE_FOLDER_ID"
  "DRIVE_FILE_MEASUREMENTS_ID"
  "DRIVE_FILE_DAILY_AVERAGES_ID"
  "DRIVE_FILE_ERROR_LOGS_ID"
  "DRIVE_FILE_ALERTS_ID"
  "GEMINI_API_KEY"
  "EMAIL_PROVIDER"
  "GMAIL_USER"
  "GMAIL_APP_PASSWORD"
  "EMAIL_TO"
  "FRONTEND_URL"
  "CRON_SECRET"
)

echo "📋 Variables à configurer:"
for var in "${vars[@]}"; do
  echo "  - $var"
done
echo ""

read -p "Voulez-vous continuer ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Annulé"
  exit 1
fi

echo ""
echo "⏳ Configuration en cours..."
echo ""

for var in "${vars[@]}"; do
  value="${!var}"
  if [ -n "$value" ]; then
    echo "  ✓ Configuration de $var..."
    echo "$value" | vercel env add "$var" production --force > /dev/null 2>&1 || true
  else
    echo "  ⚠️  $var est vide, ignoré"
  fi
done

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Vérifier: vercel env ls"
echo "  2. Déployer: vercel --prod"
