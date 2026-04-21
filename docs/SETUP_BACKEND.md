# 🚀 Setup Backend - Registro Imprese Proxy

## Installazione

### 1️⃣ Prerequisiti
- **Node.js v16+** installato
- **npm** disponibile

### 2️⃣ Installa dipendenze
```bash
npm install
```

### 3️⃣ Avvia il server
```bash
npm start
```

Il server partirà su **http://localhost:3000**

---

## 📌 Endpoint API

### POST `/api/impresa`
Ricerca impresa per Partita IVA

**Request:**
```json
{
  "partitaIva": "18149101000"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "denominazione": "3P SERVIZI SOCIETA'",
    "partitaIva": "18149101000",
    "codFisc": "...",
    "codiceRea": "...",
    "natGiu": "Società a responsabilità limitata",
    "cciaa": "Camera di Commercio di Roma",
    "statoAttivita": "Attiva",
    "indirizzo": "Via XXX, 123",
    "cap": "00100",
    "comune": "Roma",
    "provincia": "RM"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Impresa non trovata"
}
```

---

## 🔗 Integrazione con Dashboard

Nel file HTML del dashboard, aggiungi questo codice per chiamare il backend:

```javascript
async function verificaAnagrafica(partitaIva) {
  try {
    const response = await fetch('http://localhost:3000/api/impresa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ partitaIva })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Impresa trovata:', result.data);
      // Popola form con result.data
    } else {
      console.error('Errore:', result.error);
    }
  } catch (error) {
    console.error('Errore richiesta:', error);
  }
}
```

---

## 🧪 Test Endpoint

### Con cURL:
```bash
curl -X POST http://localhost:3000/api/impresa \
  -H "Content-Type: application/json" \
  -d '{"partitaIva": "18149101000"}'
```

### Con Postman:
1. Metodo: **POST**
2. URL: `http://localhost:3000/api/impresa`
3. Body (JSON raw):
```json
{
  "partitaIva": "18149101000"
}
```

---

## 🐛 Debug

### Health Check:
```bash
curl http://localhost:3000/health
```

### Log Server:
Il server logga tutte le ricerche sulla console:
```
[2026-04-20T10:30:45.123Z] Ricerca: 18149101000
API Response ricevuta
✅ Dati estratti: 3P SERVIZI SOCIETA'
```

---

## 📦 Deploy in Produzione

### Su Heroku:
```bash
heroku create nome-app
git push heroku main
```

### Su Railway:
1. Connetti il repository GitHub
2. Seleziona `server_registro_imprese.js`
3. Deploy automatico

### Variabili Ambiente:
```bash
PORT=3000
NODE_ENV=production
```

---

## ⚠️ Note Importanti

1. **CORS** è abilitato per tutte le origini
2. **Timeout** API: 10 secondi
3. **User-Agent**: Simulato per evitare blocchi
4. **Formato XML**: Automaticamente parsato a JSON

---

## 🆘 Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Port 3000 already in use"
```bash
# Cambia PORT in server_registro_imprese.js o:
PORT=3001 npm start
```

### "API ritorna errore 503"
L'API Registro Imprese potrebbe essere offline. Riprova più tardi.

---

## 📧 Supporto
Se hai problemi, controlla i log del server (F12 Console del browser)
