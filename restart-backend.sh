#!/bin/bash

# Script pour redémarrer le backend après modifications

echo "🔄 Redémarrage du backend..."

# Arrêter le processus existant
pkill -f "nest start" || true
pkill -f "node.*main.js" || true

# Attendre que le processus se termine
sleep 2

echo "✅ Backend arrêté"
echo "🚀 Démarrage du backend..."

# Démarrer le backend en mode développement
npm run start:dev

echo "✅ Backend démarré"
