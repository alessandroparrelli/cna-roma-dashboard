// ============================================================================
// BACKEND PROXY - Registro Imprese
// Node.js + Express per chiamare l'API senza CORS
// ============================================================================

const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Parser XML
const xmlParser = new xml2js.Parser({explicitArray: false});

// ============================================================================
// ENDPOINT: GET /api/impresa/:piva
// Riceve: Partita IVA
// Ritorna: JSON con dati impresa
// ============================================================================

app.post('/api/impresa', async (req, res) => {
  try {
    const { partitaIva } = req.body;
    
    if (!partitaIva) {
      return res.status(400).json({error: 'partitaIva obbligatoria'});
    }
    
    if (!/^\d{11}$/.test(partitaIva)) {
      return res.status(400).json({error: 'Partita IVA non valida (11 cifre)'});
    }
    
    console.log(`[${new Date().toISOString()}] Ricerca: ${partitaIva}`);
    
    // Chiama API Registro Imprese
    const apiUrl = 'https://accessoallebanchedati.registroimprese.it/abdo/download-file-api';
    
    const response = await axios.post(apiUrl, 
      `<Richiesta>
        <ListaRichiedenti>
          <Richiedente>
            <PartitaIVA>${partitaIva}</PartitaIVA>
          </Richiedente>
        </ListaRichiedenti>
      </Richiesta>`,
      {
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }
    );
    
    console.log('API Response ricevuta');
    
    // Parse XML
    const result = await xmlParser.parseStringPromise(response.data);
    
    // Estrai dati dalla risposta
    const impresa = result.Risposta?.ListaImpreseRI?.Impresa;
    
    if (!impresa) {
      return res.status(404).json({error: 'Impresa non trovata'});
    }
    
    const ana = impresa.AnagraficaImpresa;
    const sede = ana.IndirizzoSede;
    
    // Formatta risposta
    const impresaData = {
      denominazione: ana.Denominazione || '',
      partitaIva: partitaIva,
      codFisc: ana.CodFisc || '',
      codiceRea: ana.NRea || '',
      natGiu: ana.DescNatGiu || '',
      cciaa: ana.DescCciaa || '',
      statoAttivita: ana.DescStatoAttivita || '',
      
      // Sede
      indirizzo: formatIndirizzo(sede),
      viaSede: sede.ViaSede || '',
      nCivico: sede.NCivicoSede || '',
      cap: sede.CapSede || '',
      comune: sede.DescComSede || '',
      codComune: sede.CodComSede || '',
      provincia: sede.DescPrvSede || '',
      siglaProvincja: sede.SglPrvSede || '',
      
      // Raw XML per debug
      xmlRaw: response.data
    };
    
    console.log('✅ Dati estratti:', impresaData.denominazione);
    
    res.json({
      success: true,
      data: impresaData
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'Errore nella richiesta API'
    });
  }
});

// ============================================================================
// ENDPOINT: GET /health
// Health check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({status: 'online', timestamp: new Date().toISOString()});
});

// ============================================================================
// FUNZIONI UTILITY
// ============================================================================

function formatIndirizzo(sede) {
  const via = sede?.ViaSede || '';
  const civico = sede?.NCivicoSede || '';
  const topon = sede?.DescToponSede || '';
  
  if (!via) return '';
  return `${topon ? topon + ' ' : ''}${via}${civico ? ', ' + civico : ''}`;
}

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 SERVER REGISTRO IMPRESE AVVIATO                       ║
║  📌 Endpoint: POST http://localhost:${PORT}/api/impresa    ║
║  Body: {"partitaIva": "18149101000"}                       ║
║  Health: GET http://localhost:${PORT}/health              ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
