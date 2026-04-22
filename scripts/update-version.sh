#!/bin/bash

# Script per aggiornare automaticamente la versione in tutti i file

if [ -z "$1" ]; then
  echo "❌ Errore: Specifica la versione!"
  echo "Uso: ./scripts/update-version.sh v85.5"
  exit 1
fi

NEW_VERSION=$1
TODAY=$(date +"%d %B %Y")

echo "🔄 Aggiornamento versione a $NEW_VERSION..."

# Aggiorna public/index.html
sed -i "s/v[0-9]\+\.[0-9]\+/$NEW_VERSION/g" public/index.html
sed -i "s/Data rilascio: [0-9]\+ [A-Za-z]\+ [0-9]\+/Data rilascio: $TODAY/g" public/index.html

echo "✅ Versione aggiornata a $NEW_VERSION"
echo "✅ Data aggiornata a: $TODAY"

# Commit automatico
git add public/index.html
git commit -m "Version bump: $NEW_VERSION - Aggiornamento versione e data"

echo ""
echo "🚀 Pronto per il deploy!"
echo "Esegui: git push origin main"

