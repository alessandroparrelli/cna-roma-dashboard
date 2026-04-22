// Gestione dati CCIAA da Supabase
import { SB, H } from './utils.js';

let currentCCIAAData = null;

async function loadCCIAAData(partitaIva) {
  currentCCIAAData = null;
  try {
    console.log('⏳ Caricamento CCIAA per partita_iva:', partitaIva);
    const resp = await fetch(SB + '/rest/v1/cciaa?partita_iva=eq.' + encodeURIComponent(partitaIva), {
      headers: H()
    });
    if (resp.ok) {
      const results = await resp.json();
      if (results && results.length > 0) {
        currentCCIAAData = results[0];
        console.log('✅ CCIAA dati caricati - Stato:', currentCCIAAData.stato_attivita, 'Addetti:', currentCCIAAData.num_addetti_sub, currentCCIAAData.num_addetti_fam_ul);
      }
    }
  } catch(e) {
    console.error('❌ Errore CCIAA:', e);
  }
  return currentCCIAAData;
}

function traduciStatoAttivita(codice) {
  const statMap = {
    '0': { testo: 'ATTIVA', color: '#10B981' },
    '1': { testo: 'IN LIQUIDAZIONE', color: '#F59E0B' },
    '2': { testo: 'FALLITA', color: '#EF4444' },
    '3': { testo: 'SOSPESA', color: '#F59E0B' },
    '4': { testo: 'INATTIVA', color: '#9CA3AF' },
    '5': { testo: 'CESSATA', color: '#EF4444' }
  };
  return statMap[String(codice)] || { testo: 'SCONOSCIUTO', color: '#6B7280' };
}

function traduciTipoImpresa(codice) {
  const tipoMap = {
    'A': { testo: 'Artigiano', bgColor: '#EF4444', textColor: 'white' },
    'C': { testo: 'Commerciante', bgColor: '#FBBF24', textColor: 'black' }
  };
  return tipoMap[codice] || { testo: 'Varie', bgColor: '#F97316', textColor: 'black' };
}

function getCurrentCCIAAData() {
  return currentCCIAAData;
}

export { loadCCIAAData, traduciStatoAttivita, traduciTipoImpresa, getCurrentCCIAAData };

// Esponi currentCCIAAData a livello globale per compatibilità con HTML monolite
window.currentCCIAAData = null;
function updateGlobalCCIAAData(data) {
  window.currentCCIAAData = data;
  currentCCIAAData = data;
}
