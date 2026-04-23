#!/bin/bash

# Script per aggiornare la versione in tutti i file del progetto
# Architettura modulare v97+

if [ -z "$1" ]; then
  echo "❌ Errore: Specifica la versione!"
  echo "Uso: ./scripts/update-version.sh v97.1"
  exit 1
fi

NEW_VERSION=$1
TODAY=$(date +"%d %B %Y")

echo "🔄 Aggiornamento versione a $NEW_VERSION..."

# 1. index.html - Login footer
sed -i "s/Dashboard Tesseramento v[0-9a-z.]*/Dashboard Tesseramento $NEW_VERSION/g" public/index.html

# 2. index.html - Modal info versione
sed -i "s/<div><strong>Versione:<\/strong> v[0-9a-z.]*<\/div>/<div><strong>Versione:<\/strong> $NEW_VERSION<\/div>/" public/index.html

# 3. index.html - Modal info data rilascio
sed -i "s/Data rilascio:<\/strong> [0-9]* [A-Za-z]* [0-9]*/Data rilascio:<\/strong> $TODAY/" public/index.html

# 4. CSS header comment
sed -i "s/CNA ROMA DASHBOARD — v[0-9a-z.]*/CNA ROMA DASHBOARD — $NEW_VERSION/" public/css/main.css

# 5. package.json
sed -i "s/\"version\": \"[0-9a-z.]*\"/\"version\": \"${NEW_VERSION#v}\"/" package.json

echo "✅ Versione aggiornata a $NEW_VERSION in:"
echo "   - public/index.html (login + modal info)"
echo "   - public/css/main.css"
echo "   - package.json"
echo "✅ Data: $TODAY"

# Stage files
git add public/index.html public/css/main.css package.json

echo ""
echo "🚀 Pronto per commit e push!"
