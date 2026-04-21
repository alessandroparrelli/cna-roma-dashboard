// Netlify Function - Proxy API Registro Imprese
// Endpoint: /.netlify/functions/api-impresa

const axios = require('axios');
const xml2js = require('xml2js');

const xmlParser = new xml2js.Parser({explicitArray: false});

exports.handler = async (event, context) => {
  try {
    // Solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({error: 'Metodo non consentito'})
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({error: 'JSON invalido'})
      };
    }

    const {partitaIva} = body;

    // Validazione
    if (!partitaIva) {
      return {
        statusCode: 400,
        body: JSON.stringify({error: 'partitaIva obbligatoria'})
      };
    }

    if (!/^\d{11}$/.test(partitaIva)) {
      return {
        statusCode: 400,
        body: JSON.stringify({error: 'Partita IVA non valida (11 cifre)'})
      };
    }

    console.log(`[${new Date().toISOString()}] Ricerca: ${partitaIva}`);

    // Chiama API Registro Imprese
    const apiUrl = 'https://accessoallebanchedati.registroimprese.it/abdo/download-file-api';

    const xmlRequest = `<Richiesta>
      <ListaRichiedenti>
        <Richiedente>
          <PartitaIVA>${partitaIva}</PartitaIVA>
        </Richiedente>
      </ListaRichiedenti>
    </Richiesta>`;

    const response = await axios.post(apiUrl, xmlRequest, {
      headers: {
        'Content-Type': 'application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    console.log('API Response ricevuta');

    // Parse XML
    const result = await xmlParser.parseStringPromise(response.data);

    // Estrai dati
    const impresa = result.Risposta?.ListaImpreseRI?.Impresa;

    if (!impresa) {
      return {
        statusCode: 404,
        body: JSON.stringify({error: 'Impresa non trovata'})
      };
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
      siglaProvincja: sede.SglPrvSede || ''
    };

    console.log('✅ Dati estratti:', impresaData.denominazione);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: impresaData
      })
    };

  } catch (error) {
    console.error('❌ Errore:', error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response?.data || 'Errore nella richiesta API'
      })
    };
  }
};

function formatIndirizzo(sede) {
  const via = sede?.ViaSede || '';
  const civico = sede?.NCivicoSede || '';
  const topon = sede?.DescToponSede || '';

  if (!via) return '';
  return `${topon ? topon + ' ' : ''}${via}${civico ? ', ' + civico : ''}`;
}
