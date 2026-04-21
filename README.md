# 📊 Dashboard Tesseramento CNA Roma - v78

Sistema completo di gestione tesseramento, archivio imprese e contratti per CNA Roma.

**✨ Tutto su Netlify - Niente da deployare altrove!**

## 🚀 Quick Start Locale

```bash
# 1. Estrai e entra nella cartella
unzip cna-roma-dashboard-v78.zip
cd cna-roma-dashboard

# 2. Installa dipendenze
npm install

# 3. Avvia frontend
npm run dev

# 4. Browser
http://localhost:8080
```

## 🌐 Deploy su Netlify

### 1. Prepara GitHub

```bash
git init
git add .
git commit -m "v78 - Dashboard CNA Roma"
git remote add origin https://github.com/TUOUSERNAME/cna-roma-dashboard.git
git branch -M main
git push -u origin main
```

### 2. Connetti Netlify

1. Vai su https://app.netlify.com
2. **"New site from Git"**
3. Seleziona GitHub → Autorizza
4. Seleziona il repository `cna-roma-dashboard`

### 3. Configura Build

```
Build command:    npm run build
Publish directory: public
Functions folder: netlify/functions
```

### 4. Deploy

Clicca **"Deploy site"** e aspetta!

Netlify farà:
- ✅ Build del progetto
- ✅ Deploy frontend su CDN globale
- ✅ Deploy Netlify Functions (serverless backend)
- ✅ Genera URL tipo: https://cna-roma-dashboard.netlify.app

**Fatto!** 🎉

---

## 📁 Struttura

```
cna-roma-dashboard/
├── public/                    # Frontend HTML/CSS/JS
│   └── index.html            # Dashboard v77+
├── netlify/
│   └── functions/
│       └── api-impresa.js    # Proxy API (serverless)
├── src/config/
│   ├── app-config.json       # Config principale
│   ├── colors.json           # Palette CNA
│   └── api-endpoints.json    # URL API
├── netlify.toml              # Configurazione Netlify
└── package.json              # Dipendenze
```

---

## 🔧 Come Funziona

1. **Frontend** (HTML/CSS/JS) → Ospitato su Netlify CDN
2. **Netlify Functions** → Serverless backend Python/Node
3. **Supabase** → Database per dati CNA
4. **Registro Imprese API** → Chiamate via Netlify Functions

**Zero server da gestire!** 🚀

---

## ✨ Features

✅ Dashboard Tesseramento con grafici
✅ Archivio Imprese CNA (Supabase)
✅ Archivio Contratti 
✅ Verifica Anagrafica (Registro Imprese via Netlify Functions)
✅ Export Excel formattato
✅ Autenticazione Login
✅ Sistema di Ruoli e Permessi

---

## 📞 Versione

**v78 - 20 Aprile 2026**

Sviluppato da: Alessandro Parrelli
Per: CNA Roma - Confederazione Nazionale dell'Artigianato

---

## 🆘 Troubleshooting

**Errore "npm not found":**
```bash
Installa Node.js da https://nodejs.org/
```

**Le Netlify Functions non funzionano in locale:**
```bash
Usa: npm run dev (esegue solo frontend)
Le functions si testano su Netlify dopo il deploy
```

**Errore API Registro Imprese:**
```bash
L'API potrebbe essere offline. Riprova più tardi.
Controlla i log su Netlify → Functions
```
