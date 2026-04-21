# 📁 Architettura Progetto - CNA Roma Dashboard

## Struttura Directory

```
cna-roma-dashboard/
├── 📄 README.md                          # Documentazione principale
├── 📄 .gitignore                         # Git ignore
├── 📄 .env.example                       # Variabili ambiente template
│
├── 📁 public/                            # File statici
│   ├── index.html                        # Entry point (versione v77+)
│   ├── 📁 assets/
│   │   ├── 📁 images/
│   │   │   ├── logo-cna.png             # Logo CNA 
│   │   │   ├── logo-cna-white.png       # Logo bianco
│   │   │   └── favicon.ico              # Favicon
│   │   ├── 📁 styles/
│   │   │   ├── main.css                 # Stili globali
│   │   │   ├── dashboard.css            # Stili dashboard
│   │   │   ├── tabelle.css              # Stili tabelle
│   │   │   └── responsive.css           # Media queries
│   │   └── 📁 fonts/
│   │       └── ...                      # Font custom
│   └── 📁 data/
│       └── constants.json               # Colori, costanti, configurazioni
│
├── 📁 backend/
│   ├── server.js                        # Express.js principale
│   ├── package.json                     # Dipendenze backend
│   ├── 📁 api/
│   │   ├── registro-imprese.js          # Proxy Registro Imprese
│   │   ├── supabase.js                  # Integrazione Supabase
│   │   └── routes.js                    # Routing principale
│   ├── 📁 middleware/
│   │   ├── auth.js                      # Autenticazione
│   │   ├── cors.js                      # CORS config
│   │   └── errorHandler.js              # Error handling
│   └── 📁 utils/
│       ├── xmlParser.js                 # Parser XML
│       ├── excelGenerator.js            # Genera Excel
│       └── logger.js                    # Logging
│
├── 📁 src/
│   ├── 📁 js/
│   │   ├── main.js                      # Script principale
│   │   ├── api-client.js                # Client API
│   │   ├── 📁 modules/
│   │   │   ├── auth.js                  # Login/Logout
│   │   │   ├── dashboard.js             # Dashboard logic
│   │   │   ├── contratti.js             # Tab Contratti
│   │   │   ├── anagrafiche.js           # Archivio Imprese
│   │   │   ├── excel-export.js          # Export Excel
│   │   │   └── registro-imprese.js      # Verifica anagrafica
│   │   └── 📁 utils/
│   │       ├── helpers.js               # Funzioni utility
│   │       ├── validators.js            # Validazioni
│   │       └── formatters.js            # Formattazione dati
│   │
│   └── 📁 config/
│       ├── app-config.json              # Configurazione app
│       ├── colors.json                  # Palette colori CNA
│       ├── api-endpoints.json           # URL endpoint
│       └── permissions.json             # Ruoli e permessi
│
├── 📁 docs/
│   ├── SETUP_BACKEND.md                 # Setup server Node.js
│   ├── SETUP_FRONTEND.md                # Setup frontend
│   ├── API_DOCUMENTATION.md             # Doc API
│   ├── ARCHITECTURE.md                  # Architettura dettagliata
│   └── CHANGELOG.md                     # Cronologia versioni
│
├── 📁 tests/
│   ├── 📁 api/
│   │   └── registro-imprese.test.js     # Test API Registro
│   └── 📁 frontend/
│       └── excel-export.test.js         # Test export Excel
│
├── 📁 scripts/
│   ├── setup-db.js                      # Setup database Supabase
│   ├── seed-data.js                     # Popola dati test
│   └── migrate.js                       # Migrazioni
│
├── 📁 deploy/
│   ├── Dockerfile                       # Containerizzazione
│   ├── docker-compose.yml               # Docker compose
│   ├── heroku-procfile                  # Deploy Heroku
│   └── railway-config.yaml              # Deploy Railway
│
└── 🔒 .env                              # Variabili segrete (gitignored)
```

---

## 📋 Benefici di questa struttura:

✅ **Separazione dei concetti** (frontend/backend/config)
✅ **Scalabilità** (facile aggiungere feature)
✅ **Manutenibilità** (codice ordinato e trovabile)
✅ **Testing** (facile testare singoli moduli)
✅ **Deployment** (deploy automatizzato)
✅ **Versionamento** (git pulito e organizzato)
✅ **Team-friendly** (facile per più sviluppatori)

---

## 🔧 File di Configurazione Centralizzati

### `src/config/app-config.json`
```json
{
  "version": "77",
  "app_name": "Dashboard Tesseramento CNA Roma",
  "supabase": {
    "url": "https://ohahuqlfzqckaevaffbt.supabase.co",
    "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "backend_url": "http://localhost:3000",
  "api_endpoints": {
    "registro_imprese": "/api/impresa",
    "contratti": "/api/contratti",
    "anagrafiche": "/api/anagrafiche"
  }
}
```

### `src/config/colors.json`
```json
{
  "primary": "#005CA9",
  "primary_dark": "#003D7A",
  "primary_light": "#0078D4",
  "success": "#388e3c",
  "error": "#c62828",
  "warning": "#f57c00",
  "info": "#1976d2",
  "text_primary": "#333",
  "text_secondary": "#666",
  "bg_light": "#f5f7fa",
  "border": "#e0e0e0"
}
```

### `src/config/api-endpoints.json`
```json
{
  "registro_imprese": "https://accessoallebanchedati.registroimprese.it/abdo/download-file-api",
  "supabase": "https://ohahuqlfzqckaevaffbt.supabase.co",
  "backend": {
    "local": "http://localhost:3000",
    "production": "https://api.cnadoroma.it"
  }
}
```

---

## 📦 Build & Deploy

### Script nel `package.json` (root):
```json
{
  "scripts": {
    "install-all": "npm install && cd backend && npm install",
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "http-server public -p 8080",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "echo 'Frontend ready (static)'",
    "build:backend": "cd backend && npm install --production",
    "test": "jest",
    "deploy": "npm run build && ./deploy.sh"
  }
}
```

---

## 🚀 Flusso di Sviluppo

1. **Setup iniziale**
   ```bash
   git clone <repo>
   npm run install-all
   cp .env.example .env
   npm run dev
   ```

2. **Sviluppa feature** in rami separati
   ```bash
   git checkout -b feature/verifica-anagrafica
   # Modifica file in src/js/modules/registro-imprese.js
   ```

3. **Test locali**
   ```bash
   npm test
   npm run dev
   ```

4. **Deploy**
   ```bash
   git commit -m "feat: verifica anagrafica"
   git push origin feature/verifica-anagrafica
   npm run deploy
   ```

---

## 📝 Documentazione

### `/docs/SETUP_FRONTEND.md`
- Come configurare il frontend
- Come collegare a Supabase
- Come testare localmente

### `/docs/SETUP_BACKEND.md`
- Come avviare il server Node.js
- Come configurare le variabili ambiente
- Come deployare

### `/docs/API_DOCUMENTATION.md`
- Documentazione completa API
- Esempi richieste/risposte
- Rate limits e auth

---

## 🔐 Sicurezza

**File sensibili (in .gitignore):**
- `.env` (API keys, tokens)
- `node_modules/`
- `.credentials/`

**Credenziali salvate in:**
- Variabili ambiente
- File `.env` locale
- Vault (produzione)

---

## 📊 Versioning

Ogni versione (v77, v78, ecc) corrisponde a:
- Nuovo tag git: `git tag v77`
- Aggiornamento `package.json`: `"version": "77"`
- Changelog in `/docs/CHANGELOG.md`

---

## ✅ Prossimo Passo

Vuoi che cominci a **refactorizzare il codice** secondo questa struttura?
