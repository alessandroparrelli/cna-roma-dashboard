# CNA Roma Dashboard — Documentazione Tecnica v97.1

**Data:** 30 Aprile 2026  
**Versione:** v97.1  
**Autore:** Alessandro Parrelli  
**Live:** https://cna-roma-dashboard.vercel.app  
**Repo:** https://github.com/alessandroparrelli/cna-roma-dashboard

---

## 1. Architettura del Progetto

### 1.1 Stack Tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | Supabase (PostgreSQL) |
| Autenticazione | SHA-256 hash + Supabase REST |
| PDF Generation | jsPDF + html2canvas |
| Excel Export | SheetJS (xlsx) |
| Grafici | Chart.js |
| Hosting | Vercel (auto-deploy da GitHub) |
| Version Control | Git + GitHub |

### 1.2 Struttura File

```
cna-roma-dashboard/
│
├── public/                          ← Directory servita da Vercel
│   ├── index.html                   (906 righe) — Solo HTML, no JS/CSS inline
│   ├── favicon.ico                  — Icona CNA
│   ├── favicon-32.png               — Icona PNG fallback
│   ├── _headers                     — MIME types per Vercel
│   ├── _redirects                   — Redirect rules
│   │
│   ├── css/
│   │   └── main.css                 (484 righe) — Tutti gli stili CSS
│   │
│   └── js/
│       ├── config.js                ( 89 righe) — Configurazione e utility
│       ├── auth.js                  (308 righe) — Autenticazione e profilo
│       ├── dashboard.js             (588 righe) — Overview e grafici
│       ├── admin.js                 (331 righe) — Pannello amministrazione
│       ├── anagrafiche.js           (395 righe) — Lista imprese e filtri
│       ├── contratti.js             (430 righe) — Archivio contratti
│       ├── import.js                (881 righe) — Upload Excel/CSV
│       └── scheda.js               (1481 righe) — Scheda anagrafica, PDF, eventi
│
├── backend/
│   ├── package.json
│   └── server_registro_imprese.js   — Server Node.js per API Registro Imprese
│
├── netlify/
│   └── functions/
│       └── api-impresa.js           — Netlify Function per verifica anagrafica
│
├── scripts/
│   └── update-version.sh            — Script aggiornamento versione automatico
│
├── src/config/
│   ├── api-endpoints.json           — Endpoint API
│   ├── app-config.json              — Configurazione app
│   ├── colors.json                  — Palette colori CNA
│   └── permissions.json             — Matrice permessi per ruolo
│
├── docs/
│   ├── ARCHITETTURA_PROGETTO.md     — Architettura (legacy)
│   ├── CHANGELOG.md                 — Storico versioni (legacy)
│   └── SETUP_BACKEND.md             — Setup backend
│
├── vercel.json                      — Configurazione Vercel
├── package.json                     — Metadati progetto (version: 97)
├── netlify.toml                     — Configurazione Netlify (legacy)
├── wrangler.toml                    — Configurazione Cloudflare (legacy)
├── .gitignore
└── README.md
```

---

## 2. Database (Supabase)

### 2.1 Connessione

| Parametro | Valore |
|-----------|--------|
| URL | `https://ohahuqlfzqckaevaffbt.supabase.co` |
| Anon Key | `eyJhbGciOiJIUzI1NiIs...` (in config.js) |

### 2.2 Tabelle Principali

#### `cna_users` — Utenti del sistema
| Campo | Tipo | Note |
|-------|------|------|
| id | UUID | PK, auto-generated |
| nome | TEXT | Nome utente |
| cognome | TEXT | Cognome utente |
| email | TEXT | Email login (unique) |
| password_sha256 | TEXT | Hash SHA-256 della password |
| ruolo | TEXT | 'admin', 'supervisore', 'utente' |
| attivo | BOOLEAN | Account attivo/disattivo |
| last_login | TIMESTAMP | Ultimo accesso |
| avatar_base64 | TEXT | Foto profilo in base64 (max ~500KB) |
| created_at | TIMESTAMP | Data creazione |

#### `tesseramento_records` — Dati tesseramento
| Campo | Tipo | Note |
|-------|------|------|
| id | SERIAL | PK |
| tiporete | TEXT | Tipo rete |
| promotore | TEXT | Nome promotore |
| acuradi | TEXT | A cura di |
| importo | NUMERIC | Importo tesseramento |
| anno | INTEGER | Anno |
| mese | INTEGER | Mese (1-12) |

#### `anagrafiche` — Anagrafica imprese
| Campo | Tipo | Note |
|-------|------|------|
| id | SERIAL | PK |
| codiceanagrafica | TEXT | Codice univoco anagrafica |
| codicecliente | TEXT | Codice cliente |
| ragionesociale | TEXT | Ragione sociale |
| partitaiva | TEXT | Partita IVA |
| indirizzo | TEXT | Indirizzo sede |
| cap | TEXT | CAP |
| comune | TEXT | Comune |
| provincia | TEXT | Provincia |
| email | TEXT | Email azienda |
| telefono | TEXT | Telefono |
| cellulare | TEXT | Cellulare |

#### `diretti` — Servizi/contratti diretti
| Campo | Tipo | Note |
|-------|------|------|
| id | SERIAL | PK |
| codiceanagrafica | TEXT | FK → anagrafiche.codiceanagrafica |
| servizio | TEXT | Nome servizio |
| datastipula | TEXT | Data stipula contratto |

#### `cciaa` — Dati Camera di Commercio
| Campo | Tipo | Note |
|-------|------|------|
| codice_fiscale | TEXT | Codice fiscale impresa |
| stato_attivita | TEXT | Codice stato (0=Attiva, 1=Liquidazione, etc) |
| art_com_tur | TEXT | Tipo impresa (A=Artigiano, C=Commerciante, V=Varie) |
| num_addetti_sub | INTEGER | Addetti subordinati |
| num_addetti_fam_ul | INTEGER | Addetti familiari |
| data_iscrizione_rea | TEXT | Data iscrizione REA |
| natura_giuridica | TEXT | Natura giuridica |

#### `contratti` — Archivio contratti
| Campo | Tipo | Note |
|-------|------|------|
| id | SERIAL | PK |
| servizio | TEXT | Tipo servizio |
| promotore | TEXT | Promotore |
| importo | NUMERIC | Importo |
| datastipula | TEXT | Data stipula |

#### `cna_permissions` — Permessi utente
| Campo | Tipo | Note |
|-------|------|------|
| user_id | UUID | FK → cna_users.id |
| feature | TEXT | Nome feature (es: 'export', 'import') |
| granted | BOOLEAN | Permesso concesso |

#### `cna_logs` — Log accessi
| Campo | Tipo | Note |
|-------|------|------|
| id | SERIAL | PK |
| user_id | UUID | FK → cna_users.id |
| email | TEXT | Email utente |
| nome_completo | TEXT | Nome completo |
| esito | TEXT | 'successo' o 'fallito' |
| created_at | TIMESTAMP | Timestamp accesso |

---

## 3. Moduli JavaScript — Dettaglio Funzioni

### 3.1 `config.js` (89 righe) — Configurazione e Utility

**Variabili globali:**
- `SB` — URL Supabase
- `KEY` — Anon key Supabase
- `session` — Oggetto sessione utente corrente (null se non loggato)
- `allData` — Array dati tesseramento caricati
- `anaFiltered` — Array anagrafiche filtrate
- `currentAnaIdx` — Indice anagrafica aperta
- `currentCCIAAData` — Dati CCIAA dell'anagrafica aperta
- `TR` — Nome tabella tesseramento ('tesseramento_records')
- `MESI` — Array nomi mesi italiani
- `COLORS_PROMO` — Palette colori per promotori

**Funzioni:**

| Funzione | Descrizione |
|----------|-------------|
| `sha256hex(s)` | Hash SHA-256 di una stringa, ritorna hex |
| `saveSession(u)` | Salva sessione in sessionStorage |
| `loadSession()` | Carica sessione da sessionStorage |
| `clearSession()` | Cancella sessione |
| `isAdmin()` | Ritorna true se ruolo = 'admin' |
| `isSupervisore()` | Ritorna true se ruolo = 'supervisore' |
| `isUser()` | Ritorna true se ruolo = 'utente' |
| `userRole()` | Ritorna il ruolo corrente |
| `canAccessTab(tabId)` | Verifica se l'utente può accedere a un tab |
| `canAccessPanel(panel)` | Verifica accesso a un pannello |
| `H(ex)` | Genera headers HTTP per Supabase (apikey + auth) |
| `sbGet(p)` | GET su Supabase REST API |
| `sbGetAll(table)` | GET paginato (1000 record alla volta) |
| `sbPost(p, b, ex)` | POST su Supabase |
| `sbPatch(p, b)` | PATCH su Supabase |
| `sbDel(p)` | DELETE su Supabase |
| `dbCount()` | Conta record nella tabella tesseramento |
| `showLoad(m)` | Mostra overlay di caricamento |
| `hideLoad()` | Nasconde overlay di caricamento |
| `toast(m, t)` | Mostra notifica toast (success/error) |
| `G(id)` | Shortcut per `document.getElementById` |
| `fmt(n, d)` | Formatta numero in italiano (es: 1.234,56) |

### 3.2 `auth.js` (308 righe) — Autenticazione e Profilo

| Funzione | Descrizione |
|----------|-------------|
| `doLogin()` | Esegue login: hash password → query Supabase → salva session → showApp() |
| `doLogout()` | Cancella sessione e ricarica pagina |
| `loadPermissionsCheckboxes()` | Carica checkbox permessi nel pannello admin |
| `loadUserPermissions()` | Carica permessi utente da cna_permissions |
| `savePermissions()` | Salva permessi modificati dall'admin |
| `hasPermission(feature)` | Verifica se utente ha un permesso specifico |
| `checkExportPermission()` | Verifica permesso export |
| `updateUIPermissions()` | Aggiorna UI in base ai permessi |
| `showApp()` | Nasconde login, mostra app, carica dashboard |
| `getInitials()` | Ritorna iniziali nome+cognome |
| `updateChipAvatar()` | Aggiorna avatar nel chip header |
| `openProfilo()` | Apre modal profilo utente |
| `uploadAvatar(file)` | Upload foto profilo: resize → base64 → Supabase |
| `resizeImage(base64, maxSize)` | Ridimensiona immagine a maxSize×maxSize |
| `rimuoviAvatar()` | Rimuove foto profilo da Supabase |

### 3.3 `dashboard.js` (588 righe) — Overview e Grafici

| Funzione | Descrizione |
|----------|-------------|
| `loadDashboard()` | Carica dati tesseramento da Supabase e renderizza overview |
| `mapRow(r)` | Mappa un record raw in formato interno |
| `handleFile(file, isAdd)` | Gestisce upload file Excel nel tab overview |
| `parseRows(rows)` | Parsa righe Excel in formato interno |
| `getFiltered()` | Ritorna dati filtrati per anno/mese/rete |
| `getPromoFiltered()` | Ritorna dati filtrati per promotore |
| `unique(d, k)` | Valori univoci di una chiave in un dataset |
| `rebuildFilters()` | Ricostruisce i filtri select |
| `rSel(id, vals, lFn, all)` | Popola un select con opzioni |
| `agg(data, key)` | Aggrega dati per chiave |
| `renderOverview()` | Renderizza tab Overview con KPI, grafici, tabelle |
| `setDelta(elId, subId, valNow, valPrev, ...)` | Calcola e mostra delta anno su anno (↗ ↘) |
| `rReport(id, data, key, colors)` | Renderizza grafico Chart.js (barre) |
| `rTable(tid, a, isTrend)` | Renderizza tabella dati con sort |
| `sSort(tid, key)` | Gestisce sort colonne tabella |
| `renderPromoTrend()` | Renderizza trend promotori con grafici e sparkline |
| `renderPromoCards(data, anni, matrix, ...)` | Renderizza cards promotori con dettagli |
| `showDashboard()` | Mostra tab overview |

### 3.4 `admin.js` (331 righe) — Pannello Amministrazione

| Funzione | Descrizione |
|----------|-------------|
| `showAdminPanel()` | Apre pannello admin (solo admin) |
| `loadUsers()` | Carica e renderizza lista utenti |
| `escQ(s)` | Escape HTML per sicurezza XSS |
| `fmtDate(iso)` | Formatta data ISO in dd/mm/yyyy HH:mm |
| `toggleU(id, active)` | Attiva/disattiva utente |
| `deleteU(id, nome)` | Elimina utente (con conferma) |
| `openChangePwd(id, nome)` | Apre modal cambio password |
| `closeModal()` | Chiude modal admin |
| `saveNewPwd()` | Salva nuova password (hash SHA-256) |
| `createUser()` | Crea nuovo utente |
| `writeLog(userId, email, nomeCompleto, esito)` | Scrive log accesso in cna_logs |
| `loadRuoli()` | Carica e renderizza gestione ruoli |
| `updateUserRole(id, newRole)` | Aggiorna ruolo utente |
| `loadLogs()` | Carica e renderizza log accessi (paginati) |
| `logGoPage(p)` | Navigazione pagine log |
| `escapeHtml(s)` | Escape HTML completo |
| `parseUA(ua)` | Parsa User-Agent per log |

### 3.5 `anagrafiche.js` (395 righe) — Lista Imprese

| Funzione | Descrizione |
|----------|-------------|
| `anaFetchAll(table)` | Fetch paginato di tutti i record di una tabella |
| `anaSetStatus(table, count, st)` | Aggiorna status bar caricamento |
| `anaSetProgress(pct, msg)` | Aggiorna progress bar |
| `anaJoin(ana, dir, cod)` | Join anagrafiche + diretti + codici (costruisce tabella servizi) |
| `anaLoad(force)` | Carica anagrafiche, diretti, codici da Supabase e fa il join |
| `anaPopulateFilters()` | Popola filtri select (comune, provincia, servizio) |
| `uniq(key, transform)` | Helper: valori univoci |
| `fillSel(id, vals, firstLabel)` | Helper: popola select |
| `anaApply()` | Applica filtri e ricerca alla lista anagrafiche |
| `anaReset()` | Reset tutti i filtri |
| `anaFmtDate(v)` | Formatta data per visualizzazione |
| `anaEsc(v)` | Escape HTML per valori anagrafica |
| `anaRender()` | Renderizza tabella anagrafiche con paginazione |
| `anaUpdateSelCount()` | Aggiorna contatore righe selezionate |
| `anaToggleRow(i, row)` | Toggle selezione riga |
| `anaToggleAll()` | Toggle selezione tutte le righe |
| `anaExport()` | Export Excel delle anagrafiche selezionate |

### 3.6 `contratti.js` (430 righe) — Archivio Contratti

| Funzione | Descrizione |
|----------|-------------|
| `contrattiSetProgress(pct, msg)` | Progress bar caricamento contratti |
| `contrattiSetStatus(tipo, pct, msg)` | Status caricamento |
| `contrattiLoad(force)` | Carica contratti da Supabase (paginato) |
| `contrattisFetchAll(table)` | Fetch paginato contratti |
| `contrattiPopulateFilters(serviziSet)` | Popola filtro servizi |
| `contrattiRender()` | Renderizza tabella contratti |
| `contrattiUpdateSelCount()` | Contatore selezione |
| `contrattiToggleRow(i)` | Toggle riga |
| `contrattiToggleAll()` | Toggle tutte le righe |
| `contrattiExportExcel()` | Export Excel contratti selezionati |

### 3.7 `import.js` (881 righe) — Upload Dati

| Funzione | Descrizione |
|----------|-------------|
| `handleDrop(e, table)` | Gestisce drag&drop file |
| `handleFileSelect(e, table)` | Gestisce selezione file da input |
| `processFile(file, table)` | Processa file Excel/CSV: parse → preview → mapping |
| `convertDateFormat(dateStr)` | Converte formati data (dd/mm/yyyy → yyyy-mm-dd) |
| `mapColumnNames(row, table)` | Mappa colonne Excel a campi database |
| `convertRowData(row, table)` | Converte valori riga per il database |
| `updateImportPreview()` | Aggiorna anteprima dati da importare |
| `clearImportData()` | Cancella dati importazione |
| `importDataToSupabase()` | Importa dati in batch in Supabase (500 record alla volta) |
| `uploadBatch(table, rows, startIdx)` | Upload singolo batch |
| `showImportResults(results)` | Mostra risultati importazione |
| `downloadTemplate(table)` | Scarica template Excel vuoto |
| `cleanTablesSQL()` | Svuota tabelle (solo admin) |

### 3.8 `scheda.js` (1481 righe) — Scheda Anagrafica e PDF

| Funzione | Descrizione |
|----------|-------------|
| `closeDrawer()` | Chiude menu hamburger mobile |
| `syncMobileAdmin()` | Sincronizza bottoni admin per mobile |
| `traduciTipoImpresa(codice)` | Traduce codice tipo impresa (A→Artigiano, C→Commerciante, V→Varie) con colori |
| `traduciStatoAttivita(codice)` | Traduce codice stato (0→Attiva, 1→Liquidazione, 2→Fallita, etc) con colori |
| `openAnagraficaModal(anaIdx)` | Apre scheda anagrafica completa: carica CCIAA, servizi, contratti, dipendenti |
| `exportSchemaPDF()` | Genera PDF screenshot della scheda (html2canvas + jsPDF + logo CNA) |
| `exportAnaToExcel(anaIdx)` | Export Excel singola anagrafica |
| `loadContratti()` | Carica contratti nella scheda anagrafica |
| `estraiBtnClick()` | Gestisce click bottone "Estrai" |
| `toggleDarkMode()` | Toggle tema scuro |
| `initDarkMode()` | Inizializza tema scuro da localStorage |
| `generaReportPDF()` | Genera report PDF promotori completo (multi-pagina) |
| `drawHeader(doc, pageNum, totalPages)` | Disegna header report PDF |
| `drawFooter(doc)` | Disegna footer report PDF |
| `hexToRgb(hex)` | Converte colore hex in RGB |

---

## 4. Interfaccia Utente — Tab

### 4.1 Tab disponibili

| # | Tab | ID | Descrizione |
|---|-----|----|-------------|
| 1 | 📊 Tesseramento \| Andamento | `tab-overview` | KPI, grafici trend, tabelle riepilogative |
| 2 | 📈 Tesseramento \| Analisi | `tab-promotori` | Analisi per promotore, sparkline, trend |
| 3 | 🗂️ Archivio Imprese CNA | `tab-anagrafiche` | Lista imprese con filtri, ricerca, export |
| 4 | 📋 Archivio Contratti | `tab-contratti` | Lista contratti con filtri e export |
| 5 | ⬆️ Carica Dati | `tab-import` | Upload Excel/CSV per anagrafiche, diretti, contratti |

### 4.2 Componenti Principali

- **Header** — Logo CNA, navigazione tab, chip utente con avatar, dark mode, info, logout
- **Login** — Email + password con hash SHA-256
- **Loading Overlay** — Overlay semitrasparente con spinner e messaggio
- **Toast** — Notifiche temporanee (success/error)
- **Modal Scheda** — Scheda anagrafica completa con BOX stato/tipo, dipendenti, servizi, contratti
- **Modal Profilo** — Upload foto profilo, info utente
- **Modal Admin** — Gestione utenti, ruoli, permessi, log accessi
- **Modal Info** — Versione, changelog, crediti

---

## 5. Flussi Principali

### 5.1 Login
```
Utente → Email + Password
  → sha256hex(password)
  → sbGet('cna_users?email=eq.X&password_sha256=eq.HASH&attivo=eq.true')
  → Se trovato: saveSession(user) → showApp() → loadDashboard()
  → Se non trovato: mostra errore
```

### 5.2 Apertura Scheda Anagrafica
```
Click su riga tabella anagrafiche
  → openAnagraficaModal(idx)
  → Fetch CCIAA per partitaiva (sbGet)
  → currentCCIAAData = risultato[0]
  → cciaaData = currentCCIAAData (alias locale)
  → Genera HTML con:
    - BOX Stato Attività (traduciStatoAttivita → colore)
    - BOX Tipo Impresa (traduciTipoImpresa → colore)
    - Dati principali (ragionesociale, P.IVA, indirizzo, etc)
    - Dati CCIAA (codice fiscale, data REA, natura giuridica)
    - Sezione Dipendenti (num_addetti_sub + num_addetti_fam_ul)
    - Servizi attivi (da diretti)
    - Contratti (da contratti)
```

### 5.3 Export PDF
```
Click "Download PDF" nella scheda
  → exportSchemaPDF()
  → Trova modal-scheda-bg
  → Nascondi mappa e bottoni
  → html2canvas(cardElement, {scale: 2})
  → Scala per entrare in 1 pagina A4
  → Aggiungi logo CNA in alto a sinistra
  → jsPDF.save(filename)
```

### 5.4 Upload Dati
```
Drag&drop o selezione file Excel/CSV
  → processFile(file, table)
  → Parse con SheetJS
  → mapColumnNames() per ogni riga
  → Anteprima nella UI
  → Click "Importa"
  → importDataToSupabase() in batch da 500
  → Mostra risultati
```

---

## 6. Variabili Globali Critiche

| Variabile | File | Descrizione | ATTENZIONE |
|-----------|------|-------------|-----------|
| `session` | config.js | Utente loggato | Dichiarare UNA SOLA VOLTA |
| `currentCCIAAData` | config.js | Dati CCIAA dell'anagrafica aperta | Dichiarare UNA SOLA VOLTA |
| `currentAnaIdx` | config.js | Indice anagrafica aperta | Dichiarare UNA SOLA VOLTA |
| `anaFiltered` | config.js | Lista anagrafiche filtrate | Dichiarare UNA SOLA VOLTA |
| `allData` | config.js | Dati tesseramento | Dichiarare UNA SOLA VOLTA |

**⚠️ REGOLA CRITICA:** Queste variabili sono dichiarate SOLO in `config.js`. NON dichiararle mai di nuovo in altri file! La doppia dichiarazione causa il reset dei valori e la sparizione dei dati nella UI.

---

## 7. Campi CCIAA — Mapping Corretto

| Campo Supabase | Descrizione | Funzione |
|----------------|-------------|----------|
| `stato_attivita` | Codice stato | `traduciStatoAttivita(codice)` |
| `art_com_tur` | Codice tipo impresa | `traduciTipoImpresa(codice)` |
| `num_addetti_sub` | Addetti subordinati | ⚠️ NON `addetti_subordinati` |
| `num_addetti_fam_ul` | Addetti familiari | ⚠️ NON `addetti_familiari` |
| `codice_fiscale` | CF impresa | — |
| `data_iscrizione_rea` | Data iscrizione REA | — |
| `natura_giuridica` | Natura giuridica | — |

### Codici Stato Attività
| Codice | Stato | Colore |
|--------|-------|--------|
| 0 | ATTIVA | #10B981 (verde) |
| 1 | LIQUIDAZIONE | #F59E0B (arancio) |
| 2 | FALLITA | #EF4444 (rosso) |
| 3 | SOSPESA | #F59E0B (arancio) |
| 4 | INATTIVA | #9CA3AF (grigio) |
| 5 | CESSATA | #EF4444 (rosso) |

### Codici Tipo Impresa
| Codice | Tipo | Background | Testo |
|--------|------|------------|-------|
| A | Artigiano | #EF4444 | bianco |
| C | Commerciante | #FBBF24 | nero |
| V/null | Varie | #F97316 | nero |

---

## 8. Ruoli e Permessi

| Ruolo | Dashboard | Anagrafiche | Contratti | Import | Admin | Export |
|-------|-----------|-------------|-----------|--------|-------|--------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supervisore | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| utente | ✅ | ✅ | ✅ | ❌ | ❌ | Configurabile |

I permessi granulari sono gestiti nella tabella `cna_permissions` e configurabili dall'admin nel pannello utenti.

---

## 9. Deploy

### 9.1 Workflow
```bash
# 1. Modifica i file necessari (JS, CSS, HTML)
# 2. Aggiorna versione
./scripts/update-version.sh v97.2

# 3. Commit e push
git add -A
git commit -m "v97.2: Descrizione modifiche"
git push origin main

# 4. Vercel deploya automaticamente in 2-3 minuti
```

### 9.2 Configurazione Vercel
```json
{
  "buildCommand": "echo 'Static site'",
  "outputDirectory": "public",
  "public": true,
  "headers": [
    { "source": "/js/(.*)", "headers": [{"key": "Content-Type", "value": "application/javascript"}] },
    { "source": "/css/(.*)", "headers": [{"key": "Content-Type", "value": "text/css"}] }
  ]
}
```

---

## 10. CDN Esterne

| Libreria | Versione | URL |
|----------|----------|-----|
| Chart.js | 4.4.1 | cdnjs.cloudflare.com |
| jsPDF | 2.5.1 | cdnjs.cloudflare.com |
| html2canvas | 1.4.1 | cdnjs.cloudflare.com |
| SheetJS | 0.18.5 | cdn.sheetjs.com |

---

## 11. Regole di Sviluppo

1. **NON riscrivere index.html** — Modificare solo i file JS/CSS specifici
2. **NON dichiarare variabili globali** in file diversi da config.js
3. **Aggiornare SEMPRE la versione** con `./scripts/update-version.sh` prima del commit
4. **Testare in locale** prima di pushare
5. **Nomi campi CCIAA:** `num_addetti_sub` e `num_addetti_fam_ul` (mai varianti)
6. **currentCCIAAData** è GLOBALE — usato da PDF, Dipendenti, BOX Stato/Tipo
7. **Excel:** apostrofo davanti ai campi numerici per preservare zeri
8. **Deploy:** git push → Vercel auto-deploy in 2-3 minuti

---

*Documento generato il 30 Aprile 2026 — v97.1*
