function handleDrop(e, table) {
  e.preventDefault();
  e.stopPropagation();
  var files = e.dataTransfer.files;
  if (files.length > 0) processFile(files[0], table);
}

function handleFileSelect(e, table) {
  if (e.target.files.length > 0) processFile(e.target.files[0], table);
}

function processFile(file, table) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Leggi a partire da riga 3 (gli header sono in riga 3, i dati da riga 4)
      var rows = XLSX.utils.sheet_to_json(sheet, { range: 2, defval: '' });
      
      // Pulisci i nomi delle colonne dai prefissi Excel e gestisci i duplicati
      rows = rows.map(function(row) {
        var cleaned = {};
        for (var key in row) {
          if (row.hasOwnProperty(key)) {
            // Rimuovi prefisso come "A,1: " o "B,2: " ecc.
            var cleanKey = key.replace(/^[A-Z]+,\d+:\s*/, '').trim();
            
            // Se la colonna esiste già (duplicato), aggiungi un suffisso
            if (cleaned.hasOwnProperty(cleanKey)) {
              var suffix = 2;
              while (cleaned.hasOwnProperty(cleanKey + '_' + suffix)) {
                suffix++;
              }
              cleanKey = cleanKey + '_' + suffix;
            }
            cleaned[cleanKey] = row[key];
          }
        }
        return cleaned;
      });
      
      importData[table] = rows;
      G(table + '-status').textContent = rows.length + ' righe caricate';
      G(table + '-status').style.display = 'block';
      
      updateImportPreview();
      G('import-preview').style.display = 'block';
      
      toast(table.toUpperCase() + ': ' + rows.length + ' righe caricate', 'success');
      console.log('Righe caricate:', rows.length);
      console.log('Colonne:', Object.keys(rows[0]));
      console.log('Prima riga:', rows[0]);
    } catch(err) {
      toast('Errore caricamento: ' + err.message, 'error');
      console.error('Errore processFile:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function convertDateFormat(dateStr) {
  if (!dateStr || dateStr === '') return '';
  
  dateStr = String(dateStr).trim();
  
  // Se è già ISO (YYYY-MM-DD), lascia come è
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
  
  // YYYY/MM/DD → YYYY-MM-DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
    return dateStr.replace(/\//g, '-');
  }
  
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    var p = dateStr.split('/');
    return p[2] + '-' + String(p[1]).padStart(2,'0') + '-' + String(p[0]).padStart(2,'0');
  }
  
  // DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
    var p = dateStr.split('-');
    return p[2] + '-' + String(p[1]).padStart(2,'0') + '-' + String(p[0]).padStart(2,'0');
  }
  
  return dateStr;
}

// Mappa colonne da file Excel al database
function mapColumnNames(row, table) {
  var mapping = {
    diretti: {
      'A,1: Cliente': 'Cliente',
      'B,2: Partita IVA': 'partitaiva',
      'C,3: Codice Cliente': 'codiceanagrafica',
      'D,4: Ragione Sociale/Denominazione': 'Ragione Sociale/Denominazione',
      'E,5: Servizio': 'servizio',
      'F,6: Data Stipula': 'datastipula',
      'G,7: Data Disdetta': 'datadisdetta',
      'H,8: Raggruppamento': 'raggruppamento',
      'I,9: Sede Erogazione': 'sedeerogazione',
      'J,10: Centro gestionale': 'Centro gestionale',
      'K,11: A cura di': 'acuradi',
      'L,12: Motivo inizio': 'motivoinizio',
      'M,13: Zona Cliente': 'zonacliente',
      'N,14: Cap': 'cap',
      'O,15: Disdetta': 'Disdetta',
      'P,16: Email': 'Email',
      'Q,17: Pec': 'Pec',
      'R,18: Telefono': 'Telefono',
      'S,19: Cellulare': 'Cellulare',
      'T,20: Ateco 2025': 'Ateco 2025',
      'U,21: Descrizione Ateco 2025': 'Descrizione Ateco 2007',
      'V,22: Ateco 2007': 'Ateco 2007',
      'W,23: Descrizione Ateco 2007': 'Descrizione Ateco 2007',
      'X,24: Contratto': 'Contratto',
      'Y,25: Importo': 'importo',
      'Z,26: Codice Fiscale': 'Codice Fiscale',
      'AA,27: Importo Paghe/Mov. Contab.': 'Importo Paghe/Mov. Contab.',
      'AB,28: Motivo Disdetta': 'Motivo Disdetta',
      'AC,29: Pagamento': 'Pagamento',
      'AD,30: null': 'null',
      'AE,31: Codice Fiscale': 'AE,31: Codice Fiscale',
      'AF,32: null': 'AF,32: null',
      // FALLBACK: colonne senza prefissi
      'Cliente': 'Cliente',
      'Partita IVA': 'partitaiva',
      'Codice Cliente': 'codiceanagrafica',
      'Ragione Sociale/Denominazione': 'Ragione Sociale/Denominazione',
      'Servizio': 'servizio',
      'Data Stipula': 'datastipula',
      'Data Disdetta': 'datadisdetta',
      'Raggruppamento': 'raggruppamento',
      'Sede Erogazione': 'sedeerogazione',
      'Centro gestionale': 'Centro gestionale',
      'A cura di': 'acuradi',
      'Motivo inizio': 'motivoinizio',
      'Zona Cliente': 'zonacliente',
      'Cap': 'cap',
      'Disdetta': 'Disdetta',
      'Email': 'Email',
      'Pec': 'Pec',
      'Telefono': 'Telefono',
      'Cellulare': 'Cellulare',
      'Ateco 2025': 'Ateco 2025',
      'Descrizione Ateco 2025': 'Descrizione Ateco 2007',
      'Ateco 2007': 'Ateco 2007',
      'Descrizione Ateco 2007': 'Descrizione Ateco 2007',
      'Contratto': 'Contratto',
      'Importo': 'importo',
      'Codice Fiscale': 'Codice Fiscale',
      'Importo Paghe/Mov. Contab.': 'Importo Paghe/Mov. Contab.',
      'Motivo Disdetta': 'Motivo Disdetta',
      'Pagamento': 'Pagamento',
      'null': 'null'
    },
    anagrafiche: {
      'A,1: Soggetto': 'soggettogiuridico',
      'B,2: Codice Anagrafica': 'codiceanagrafica',
      'C,3: Partita IVA': 'partitaiva',
      'D,4: Codice Fiscale': 'codicefiscale',
      'E,5: Ragione Sociale/Denominazione': 'ragionesociale',
      'F,6: Contatti': 'Contatti',
      'G,7: Zona Cliente': 'zoncliente',
      'H,8: codice mestiere': 'codicemestiere',
      'I,9: Mestiere': 'mestiere',
      'J,10: Ateco 2025': null, // ESCLUSA - non importarla
      'K,11: Ateco 2007': 'codiceateco',
      'L,12: email': 'email',
      'M,13: Telefono': 'telefono',
      'N,14: Cellulare': 'cellulare',
      'O,15: Natura Giuridica': 'naturagiuridica',
      'P,16: Indirizzo': 'indirizzo',
      'Q,17: Provincia': 'provincia',
      'R,18: Cap': 'cap',
      'S,19: Comune': 'comune',
      'T,20: Sesso': 'sesso',
      'U,21: Provincia': 'U,21: Provincia',
      'V,22: Cognome Titolare': 'cognometitolare',
      'W,23: Nome Titolare': 'nometitolare',
      'X,24: Data Nascita': 'datanascita',
      'Y,25: Luogo Nascita': 'luogonascita',
      'Z,26: Prov Nasc': 'provnascita',
      'AA,27: carica': 'carica',
      'AB,28: CF Titolare': 'cftitolare',
      'AC,29: Condizione pagamento cliente': 'condizionipagamento',
      'AD,30: Carica CNA': 'Carica CNA',
      'AE,31: StatoGiuridico': 'statogiuridico',
      // FALLBACK: colonne senza prefissi
      'Soggetto': 'soggettogiuridico',
      'Codice Anagrafica': 'codiceanagrafica',
      'Partita IVA': 'partitaiva',
      'Codice Fiscale': 'codicefiscale',
      'Ragione Sociale/Denominazione': 'ragionesociale',
      'Contatti': 'Contatti',
      'Zona Cliente': 'zoncliente',
      'codice mestiere': 'codicemestiere',
      'Mestiere': 'mestiere',
      'Ateco 2025': null, // ESCLUSA
      'Ateco 2007': 'codiceateco',
      'email': 'email',
      'Telefono': 'telefono',
      'Cellulare': 'cellulare',
      'Natura Giuridica': 'naturagiuridica',
      'Indirizzo': 'indirizzo',
      'Provincia': 'provincia',
      'Cap': 'cap',
      'Comune': 'comune',
      'Sesso': 'sesso',
      'Cognome Titolare': 'cognometitolare',
      'Nome Titolare': 'nometitolare',
      'Data Nascita': 'datanascita',
      'Luogo Nascita': 'luogonascita',
      'Prov Nasc': 'provnascita',
      'carica': 'carica',
      'CF Titolare': 'cftitolare',
      'Condizione pagamento cliente': 'condizionipagamento',
      'Carica CNA': 'Carica CNA',
      'StatoGiuridico': 'statogiuridico'
    },
    contrattiservizio: {
      'A,1: Cliente': 'cliente',
      // 'B,2: Partita IVA': 'partitaiva', // NON esiste nella tabella contrattiservizio
      'C,3: Codice Cliente': 'codicecliente',
      // 'D,4: Ragione Sociale/Denominazione': 'ragionesociale', // NON esiste nella tabella
      'E,5: Servizio': 'tipocontratto',
      'F,6: Data Stipula': 'datastipulacontratto',
      'G,7: Data Disdetta': 'datadisdetta',
      'H,8: Raggruppamento': 'raggruppamento',
      'I,9: Sede Erogazione': 'sedeerogazione',
      'J,10: Centro gestionale': 'centrogestionale',
      'K,11: A cura di': 'nomeconsulente',
      'L,12: Motivo inizio': 'motivoinizio',
      'M,13: Zona Cliente': 'zonacliente',
      'N,14: Cap': 'cap',
      'O,15: Disdetta': 'disdetta',
      'P,16: Email': 'email',
      'Q,17: Pec': 'pec',
      'R,18: Telefono': 'telefono',
      'S,19: Cellulare': 'cellulare',
      // FALLBACK: colonne senza prefissi
      'Cliente': 'cliente',
      // 'Partita IVA': 'partitaiva', // NON esiste
      'Codice Cliente': 'codicecliente',
      // 'Ragione Sociale/Denominazione': 'ragionesociale', // NON esiste
      'Servizio': 'tipocontratto',
      'Data Stipula': 'datastipulacontratto',
      'Data Disdetta': 'datadisdetta',
      'Raggruppamento': 'raggruppamento',
      'Sede Erogazione': 'sedeerogazione',
      'Centro gestionale': 'centrogestionale',
      'A cura di': 'nomeconsulente',
      'Motivo inizio': 'motivoinizio',
      'Zona Cliente': 'zonacliente',
      'Cap': 'cap',
      'Disdetta': 'disdetta',
      'Email': 'email',
      'Pec': 'pec',
      'Telefono': 'telefono',
      'Cellulare': 'cellulare'
    }
  };
  
  var tableMapping = mapping[table] || {};
  var cleaned = {};
  
  for (var key in row) {
    if (row.hasOwnProperty(key)) {
      // Cerca nel mapping - prima esattamente, poi pulendo i prefissi
      var dbCol = tableMapping[key];
      
      // Se non trovo il mapping esatto, prova pulendo il prefisso
      if (!dbCol) {
        var cleanKey = key.replace(/^[A-Z]+,\d+:\s*/, '').trim();
        dbCol = tableMapping[cleanKey];
      }
      
      if (dbCol) {
        // Converti stringhe vuote in null per colonne numeriche
        var val = row[key];
        if ((dbCol === 'partitaiva' || dbCol === 'cap') && (val === '' || val === null)) {
          val = null;
        }
        cleaned[dbCol] = val;
      }
    }
  }
  
  return cleaned;
}

function convertRowData(row, table) {
  // PRIMO: Mappa le colonne usando mapColumnNames
  var mapped = mapColumnNames(row, table);
  
  // SECONDO: Converti stringhe vuote in null, date e numeri come text
  var dateFields = ['datastipula', 'datanascita', 'datadisdetta', 'datastipulacontratto'];
  var textFields = ['cap', 'partitaiva']; // Mantieni come TEXT per preservare zeri iniziali
  var converted = {};
  
  for (var key in mapped) {
    if (mapped.hasOwnProperty(key)) {
      var val = mapped[key];
      
      // Converti stringhe vuote in null
      if (val === '' || val === null || val === undefined) {
        converted[key] = null;
      }
      // Converti date da numero Excel a data ISO
      else if (dateFields.includes(key) && val) {
        // Se è un numero (formato Excel), converti
        if (!isNaN(val) && val > 0) {
          // Excel date: giorni dal 1900-01-01
          var excelDate = parseInt(val);
          var date = new Date((excelDate - 25569) * 86400 * 1000);
          converted[key] = date.getFullYear() + '-' + 
                          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(date.getDate()).padStart(2, '0');
        } else {
          // Già formato testo, converti se necessario
          converted[key] = convertDateFormat(val);
        }
      }
      // Mantieni cap e partita IVA come text (preserva zeri iniziali)
      else if (textFields.includes(key)) {
        converted[key] = String(val).trim();
      }
      else {
        converted[key] = val;
      }
    }
  }
  
  return converted;
}

function updateImportPreview() {
  var preview = '';
  
  if (importData.diretti && importData.diretti.length > 0) {
    preview += '<strong>DIRETTI (' + importData.diretti.length + ' righe)</strong><br>';
    preview += '<span style="color:var(--text-dim)">Campi: ' + Object.keys(importData.diretti[0]).join(', ') + '</span><br>';
    preview += 'Prima riga:<br>' + JSON.stringify(importData.diretti[0]).substring(0, 200) + '...<br><br>';
  }
  
  if (importData.anagrafiche && importData.anagrafiche.length > 0) {
    preview += '<strong>ANAGRAFICHE (' + importData.anagrafiche.length + ' righe)</strong><br>';
    preview += '<span style="color:var(--text-dim)">Campi: ' + Object.keys(importData.anagrafiche[0]).join(', ') + '</span><br>';
    preview += 'Prima riga:<br>' + JSON.stringify(importData.anagrafiche[0]).substring(0, 200) + '...<br><br>';
  }
  
  if (importData.contrattiservizio && importData.contrattiservizio.length > 0) {
    preview += '<strong>CONTRATTISERVIZIO (' + importData.contrattiservizio.length + ' righe)</strong><br>';
    preview += '<span style="color:var(--text-dim)">Campi: ' + Object.keys(importData.contrattiservizio[0]).join(', ') + '</span><br>';
    preview += 'Prima riga:<br>' + JSON.stringify(importData.contrattiservizio[0]).substring(0, 200) + '...';
  }
  
  G('import-preview-content').innerHTML = preview;
}

function clearImportData() {
  importData = { diretti: null, anagrafiche: null, contrattiservizio: null, incassi: null };
  G('diretti-status').style.display = 'none';
  G('anagrafiche-status').style.display = 'none';
  G('contrattiservizio-status').style.display = 'none';
  var incSt = G('incassi-status'); if(incSt) incSt.style.display='none';
  G('import-preview').style.display = 'none';
  G('upload-diretti-input').value = '';
  G('upload-anagrafiche-input').value = '';
  G('upload-contrattiservizio-input').value = '';
  var incInp = G('upload-incassi-input'); if(incInp) incInp.value='';
  toast('Dati cancellati', 'info');
}

// ====================================
// INCASSI UPLOAD
// ====================================
function handleIncassiFile(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = new Uint8Array(ev.target.result);
      // cellDates:true → XLSX converte i numeri seriali Excel in oggetti Date JS
      var wb = XLSX.read(data, { type: 'array', cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];

      // Leggi con raw:true per ottenere Date objects (non stringhe formattate)
      // range:0 → usa la prima riga come header (che contiene "A,1: Codice Cliente" ecc.)
      var rows = XLSX.utils.sheet_to_json(ws, { range: 0, defval: null, raw: true });

      if (!rows || rows.length === 0) {
        toast('File vuoto o formato non riconosciuto', 'error');
        return;
      }

      // Log per debug: mostra le chiavi della prima riga
      console.log('[INCASSI] Colonne rilevate:', Object.keys(rows[0]));
      console.log('[INCASSI] Prima riga raw:', rows[0]);

      // Funzione per trovare il valore di una colonna cercando per nome pulito
      // (gestisce sia "A,1: Codice Cliente" che "Codice Cliente")
      function cleanKey(k) {
        return String(k).replace(/^[A-Z]+,\d+:\s*/, '').trim().toLowerCase();
      }

      // Costruisce una mappa normalizzata per ogni riga
      function normalize(row) {
        var out = {};
        for (var k in row) {
          out[cleanKey(k)] = row[k];
        }
        return out;
      }

      // Converte qualsiasi valore data in stringa ISO YYYY-MM-DD
      function toIso(d) {
        if (!d) return null;
        // Oggetto Date JS (da cellDates:true)
        if (d instanceof Date) {
          if (isNaN(d.getTime())) return null;
          // Evita shift timezone: usa UTC
          var y = d.getFullYear();
          var m = String(d.getMonth() + 1).padStart(2, '0');
          var g = String(d.getDate()).padStart(2, '0');
          return y + '-' + m + '-' + g;
        }
        var s = String(d).trim();
        if (!s || s === '') return null;
        // Già ISO: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        // DD/MM/YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
          var p = s.split('/');
          return p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0');
        }
        // MM/DD/YYYY (formato XLSX raw:false)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
          var p = s.split('/');
          // Euristico: se il secondo numero > 12 è il giorno → MM/DD
          if (parseInt(p[1]) > 12) {
            return p[2] + '-' + p[0].padStart(2,'0') + '-' + p[1].padStart(2,'0');
          }
        }
        return null;
      }

      function toNum(v) {
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'number') return v;
        return parseFloat(String(v).replace(',', '.')) || 0;
      }

      var mapped = [];
      for (var i = 0; i < rows.length; i++) {
        var nr = normalize(rows[i]);
        var codice = String(nr['codice cliente'] || '').trim();
        if (!codice || codice === 'codice cliente') continue; // salta header ripetuto o riga vuota

        var avere = toNum(nr['avere'] || nr['f,6: avere']);
        var dare  = toNum(nr['dare']  || nr['g,7: dare']);
        var dataPag = toIso(nr['data pagamento'] || nr['e,5: data pagamento']);
        var dataDoc = toIso(nr['data doc']        || nr['j,10: data doc']);

        mapped.push({
          codice_cliente:   codice,
          cliente:          String(nr['cliente'] || '').trim(),
          sede:             String(nr['sede'] || '').trim(),
          promotore:        String(nr['promotore'] || '').trim(),
          data_pagamento:   dataPag,
          avere:            avere,
          dare:             dare,
          partita_tipo_doc: String(nr['partita tipo doc'] || '').trim(),
          num_doc:          String(nr['num.doc.'] || '').trim(),
          data_doc:         dataDoc,
          documento:        String(nr['documento'] || '').trim().substring(0, 500),
          importo_insoluto: toNum(nr['importo da pagare insoluto']) || null,
          cassa:            String(nr['cassa'] || '').trim(),
          sepa:             String(nr['sepa'] || '').trim(),
          compensazione:    String(nr['compensazione'] || '').trim(),
          tipo_doc:         String(nr['tipo doc'] || '').trim(),
          tipo_doc_az:      String(nr['tipo doc az'] || '').trim()
        });
      }

      if (mapped.length === 0) {
        toast('Nessuna riga valida trovata nel file. Controlla il formato.', 'error');
        console.warn('[INCASSI] Nessuna riga mappata. Colonne trovate:', Object.keys(rows[0] || {}));
        return;
      }

      console.log('[INCASSI] Esempio riga mappata:', mapped[0]);
      importData.incassi = mapped;
      var st = G('incassi-status');
      if (st) { st.textContent = mapped.length + ' righe caricate'; st.style.display = 'block'; }
      toast('INCASSI: ' + mapped.length + ' righe pronte', 'success');
      updateImportPreview();
      G('import-preview').style.display = 'block';
    } catch(err) {
      toast('Errore file incassi: ' + err.message, 'error');
      console.error('[INCASSI] Errore handleIncassiFile:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ====================================
// CONTRATTISERVIZIO UPLOAD - Usa logica standard
// ====================================

// Per contrattiservizio, usa lo stesso flusso di diretti e anagrafiche
// Aggiungi event listener al file input
document.addEventListener('DOMContentLoaded', function() {
  var inputCS = G('upload-contrattiservizio-input');
  if (inputCS) {
    inputCS.addEventListener('change', function(e) {
      handleFileSelect(e, 'contrattiservizio');
    
  
  // LOGIN E NAVIGAZIONE LISTENERS
  setTimeout(function() {
    var btnLogin = G('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', doLogin);
    var inpPwd = G('inp-pwd');
    if (inpPwd) inpPwd.addEventListener('keypress', function(e){if(e.key==='Enter')doLogin();});
    var inpEmail = G('inp-email');
    if (inpEmail) inpEmail.addEventListener('keypress', function(e){if(e.key==='Enter')doLogin();});
    
    var btnLogout = G('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', doLogout);
    
    var btnInfo = G('btn-info');
    if (btnInfo) btnInfo.addEventListener('click', function(){closeDrawer();document.getElementById('modal-info').style.display='flex';});
    
    var btnDarkmode = G('btn-darkmode');
    if (btnDarkmode) btnDarkmode.addEventListener('click', function(){toggleDarkMode();closeDrawer();});
  }, 100);
});
  }
  
  var dropCS = G('upload-contrattiservizio-drop');
  if (dropCS) {
    dropCS.addEventListener('click', function() {
      G('upload-contrattiservizio-input').click();
    });
    
    dropCS.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.background = 'rgba(0,92,169,0.1)';
      this.style.borderColor = 'var(--primary)';
    });
    
    dropCS.addEventListener('dragleave', function() {
      this.style.background = 'var(--surface2)';
      this.style.borderColor = 'var(--border)';
    });
    
    dropCS.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.background = 'var(--surface2)';
      this.style.borderColor = 'var(--border)';
      
      if (e.dataTransfer.files.length > 0) {
        G('upload-contrattiservizio-input').files = e.dataTransfer.files;
        handleFileSelect({ target: { files: e.dataTransfer.files } }, 'contrattiservizio');
      }
    });
  }
});



async function importDataToSupabase() {
  if (!importData.diretti && !importData.anagrafiche && !importData.contrattiservizio && !importData.incassi) {
    toast('Carica almeno un file', 'warning');
    return;
  }
  
  G('btn-import-send').disabled = true;
  var originalText = G('btn-import-send').innerHTML;
  G('btn-import-send').innerHTML = '⏳ Invio in corso...';
  
  var results = { diretti: null, anagrafiche: null, contrattiservizio: null, errors: [] };
  var BATCH_SIZE = 1000; // Carica 1000 righe alla volta
  
  // Funzione helper per caricare un batch
  async function uploadBatch(table, rows, startIdx) {
    var resp = await fetch(SB + '/rest/v1/' + table, {
      method: 'POST',
      headers: H(),
      body: JSON.stringify(rows)
    });
    
    if (!resp.ok) {
      var respText = await resp.text();
      throw new Error(table + ' batch ' + startIdx + ': HTTP ' + resp.status + ' - ' + respText);
    }
    return resp;
  }
  
  try {
    // Converti e invia diretti
    if (importData.diretti && importData.diretti.length > 0) {
      console.log('DIRETTI: Convertendo ' + importData.diretti.length + ' righe...');
      var direttiConverted = importData.diretti.map(function(r) { return convertRowData(r, 'diretti'); });
      console.log('DIRETTI: Prima riga convertita:', direttiConverted[0]);
      
      // Carica in batch
      for (var i = 0; i < direttiConverted.length; i += BATCH_SIZE) {
        var batch = direttiConverted.slice(i, i + BATCH_SIZE);
        console.log('DIRETTI: Caricando batch ' + (i/BATCH_SIZE + 1) + ' (' + batch.length + ' righe)...');
        await uploadBatch('diretti', batch, i);
        G('btn-import-send').innerHTML = '⏳ DIRETTI: ' + Math.min(i + BATCH_SIZE, direttiConverted.length) + '/' + direttiConverted.length;
      }
      
      results.diretti = { righe: direttiConverted.length, status: 'OK' };
      toast('✓ ' + direttiConverted.length + ' record diretti caricati', 'success');
    }
    
    // Converti e invia anagrafiche
    if (importData.anagrafiche && importData.anagrafiche.length > 0) {
      console.log('ANAGRAFICHE: Convertendo ' + importData.anagrafiche.length + ' righe...');
      var anagraifcheConverted = importData.anagrafiche.map(function(r) { return convertRowData(r, 'anagrafiche'); });
      console.log('ANAGRAFICHE: Prima riga prima della conversione:', importData.anagrafiche[0]);
      console.log('ANAGRAFICHE: Prima riga dopo conversione:', anagraifcheConverted[0]);
      console.log('ANAGRAFICHE: Colonne inviate:', Object.keys(anagraifcheConverted[0]));
      
      // Carica in batch
      for (var i = 0; i < anagraifcheConverted.length; i += BATCH_SIZE) {
        var batch = anagraifcheConverted.slice(i, i + BATCH_SIZE);
        console.log('ANAGRAFICHE: Caricando batch ' + (i/BATCH_SIZE + 1) + ' (' + batch.length + ' righe)...');
        await uploadBatch('Anagrafiche', batch, i);
        G('btn-import-send').innerHTML = '⏳ ANAGRAFICHE: ' + Math.min(i + BATCH_SIZE, anagraifcheConverted.length) + '/' + anagraifcheConverted.length;
      }
      
      results.anagrafiche = { righe: anagraifcheConverted.length, status: 'OK' };
      toast('✓ ' + anagraifcheConverted.length + ' record anagrafiche caricati', 'success');
    }
    
    // Converti e invia contrattiservizio
    if (importData.contrattiservizio && importData.contrattiservizio.length > 0) {
      console.log('CONTRATTISERVIZIO: Convertendo ' + importData.contrattiservizio.length + ' righe...');
      var contrattiConverted = importData.contrattiservizio.map(function(r) { return convertRowData(r, 'contrattiservizio'); });
      console.log('CONTRATTISERVIZIO: Prima riga dopo conversione:', contrattiConverted[0]);
      console.log('CONTRATTISERVIZIO: Colonne inviate:', Object.keys(contrattiConverted[0]));
      
      // Carica in batch
      for (var i = 0; i < contrattiConverted.length; i += BATCH_SIZE) {
        var batch = contrattiConverted.slice(i, i + BATCH_SIZE);
        console.log('CONTRATTISERVIZIO: Caricando batch ' + (i/BATCH_SIZE + 1) + ' (' + batch.length + ' righe)...');
        await uploadBatch('contrattiservizio', batch, i);
        G('btn-import-send').innerHTML = '⏳ CONTRATTISERVIZIO: ' + Math.min(i + BATCH_SIZE, contrattiConverted.length) + '/' + contrattiConverted.length;
      }
      
      results.contrattiservizio = { righe: contrattiConverted.length, status: 'OK' };
      toast('✓ ' + contrattiConverted.length + ' record contrattiservizio caricati', 'success');
    }

    // Carica incassi
    if (importData.incassi && importData.incassi.length > 0) {
      var incRows = importData.incassi;
      console.log('INCASSI: Caricando ' + incRows.length + ' righe...');
      for (var i = 0; i < incRows.length; i += BATCH_SIZE) {
        var batch = incRows.slice(i, i + BATCH_SIZE);
        await uploadBatch('incassi', batch, i);
        G('btn-import-send').innerHTML = '⏳ INCASSI: ' + Math.min(i + BATCH_SIZE, incRows.length) + '/' + incRows.length;
      }
      results.incassi = { righe: incRows.length, status: 'OK' };
      toast('✓ ' + incRows.length + ' record incassi caricati', 'success');
      // Forza reload del tab incassi
      incassiLoaded = false;
    }
    
    // Mostra modale con risultati
    showImportResults(results);
    toast('✅ Caricamento completato!', 'success');
    clearImportData();
    
  } catch(err) {
    console.error('ERRORE IMPORT:', err);
    results.errors.push(err.message);
    showImportResults(results);
    toast('❌ Errore: ' + err.message, 'error');
  } finally {
    G('btn-import-send').disabled = false;
    G('btn-import-send').innerHTML = originalText;
  }
}

function showImportResults(results) {
  var html = '<div style="background:var(--surface2);padding:20px;border-radius:8px;max-width:600px;position:relative">';
  html += '<button onclick="this.closest(\'[role=dialog]\').remove()" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-dim);padding:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center">×</button>';
  html += '<h3 style="margin-top:0;color:var(--text)">📊 Risultati Caricamento</h3>';
  
  if (results.diretti) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(34,197,94,0.1);border-left:3px solid var(--green);border-radius:4px">';
    html += '<strong style="color:var(--green)">[OK] DIRETTI</strong><br>';
    html += 'Righe caricate: <strong>' + results.diretti.righe + '</strong>';
    html += '</div>';
  }
  
  if (results.anagrafiche) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(34,197,94,0.1);border-left:3px solid var(--green);border-radius:4px">';
    html += '<strong style="color:var(--green)">[OK] ANAGRAFICHE</strong><br>';
    html += 'Righe caricate: <strong>' + results.anagrafiche.righe + '</strong>';
    html += '</div>';
  }
  
  if (results.contrattiservizio) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(34,197,94,0.1);border-left:3px solid var(--green);border-radius:4px">';
    html += '<strong style="color:var(--green)">[OK] CONTRATTISERVIZIO</strong><br>';
    html += 'Righe caricate: <strong>' + results.contrattiservizio.righe + '</strong>';
    html += '</div>';
  }

  if (results.incassi) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(5,150,105,0.1);border-left:3px solid #059669;border-radius:4px">';
    html += '<strong style="color:#059669">✓ INCASSI</strong><br>';
    html += 'Righe caricate: <strong>' + results.incassi.righe + '</strong>';
    html += '</div>';
  }
  
  if (results.errors && results.errors.length > 0) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(220,38,38,0.1);border-left:3px solid #dc2626;border-radius:4px">';
    html += '<strong style="color:#dc2626">[ERRORE] ERRORI</strong><br>';
    results.errors.forEach(function(err) {
      html += '<span style="font-size:12px;color:var(--text-sub);display:block;margin:5px 0">' + escapeHtml(err) + '</span>';
    });
    html += '</div>';
  }
  
  html += '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">';
  html += '<button class="btn btn-primary" onclick="this.closest(\'[role=dialog]\').remove()">Chiudi</button>';
  if (results.anagrafiche) {
    html += '<button class="btn btn-secondary" id="btn-sync-zone" onclick="sincronizzaZone(this)" style="background:#14B8A6;color:white;border:none">'
      + '🗺️ Sincronizza Zone da CAP</button>';
    html += '<span style="font-size:11px;color:var(--text-sub);align-self:center">Associa la zona geografica ai nuovi associati tramite il CAP</span>';
  }
  html += '</div>';
  html += '</div>';
  
  var modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  modal.innerHTML = html;
  modal.onclick = function(e) { if(e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function downloadTemplate(table) {
  var columns = table === 'diretti' 
    ? ['id','partitaiva','codicefiscale','ragionesociale','telefono','email','cellulare','indirizzo','cap','comune','sesso','cognometitolare','nometitolare','datanascita','luogonascita','codiceateco','servizio','datastipula','datadisdetta','raggruppamento','sedeerogazione','acuradi','motivoinizio','importo','unione','settore','mestiere']
    : ['id','partitaiva','codicefiscale','ragionesociale','telefono','email','cellulare','indirizzo','cap','comune','sesso','cognometitolare','nometitolare','datanascita','luogonascita','codiceateco','servizio','datastipula','datadisdetta','raggruppamento','sedeerogazione','acuradi','motivoinizio','importo','unione','settore','mestiere'];
  
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet([columns]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dati');
  XLSX.writeFile(wb, 'template_' + table + '.xlsx');
  toast('Template ' + table + ' scaricato', 'info');
}

function cleanTablesSQL() {
  G('clean-status').textContent = 'Eliminazione in corso...';
  G('clean-status').style.display = 'block';
  G('clean-status').style.background = 'rgba(37,99,235,0.1)';
  G('clean-status').style.color = 'var(--blue)';
  
  G('clean-status').innerHTML = '<strong>SQL da eseguire in Supabase SQL Editor:</strong><br><br>' +
    '<code style="background:var(--surface2);padding:10px;border-radius:4px;display:block;overflow-x:auto;font-family:monospace;font-size:11px">' +
    'DELETE FROM diretti;<br>' +
    'DELETE FROM "Anagrafiche";<br>' +
    'DELETE FROM contrattiservizio;' +
    '</code><br>' +
    '<span style="color:var(--text-sub);font-size:11px">Copia i comandi sopra, incollali in Supabase SQL Editor e esegui.<br>Poi carica i nuovi file qui sopra.</span>';
}

// ══════════════════════════════════════════════════════════════════════════════
// RUOLI MODULE - Gestione ruoli utenti
// ══════════════════════════════════════════════════════════════════════════════



// EVENTS - ATTACHMENT GARANTITO
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 DOMContentLoaded - Attaccando event listeners...');
  
  setTimeout(function() {
    console.log('⏱️  setTimeout 100ms - Cercando elementi...');
    
    var btnLogin = document.getElementById('btn-login');
    console.log('btn-login trovato?', !!btnLogin);
    if (btnLogin) {
      btnLogin.addEventListener('click', function(e) {
        console.log('🖱️  btn-login CLICCATO!');
        e.preventDefault();
        doLogin();
      });
      console.log('✅ btn-login listener attaccato');
    }
    
    var inpPwd = document.getElementById('inp-pwd');
    if (inpPwd) {
      inpPwd.addEventListener('keypress', function(e){
        console.log('⌨️  inp-pwd KEYPRESS:', e.key);
        if(e.key==='Enter') doLogin();
      });
      console.log('✅ inp-pwd listener attaccato');
    }
    
    var inpEmail = document.getElementById('inp-email');
    if (inpEmail) {
      inpEmail.addEventListener('keypress', function(e){
        if(e.key==='Enter') doLogin();
      });
      console.log('✅ inp-email listener attaccato');
    }
    
    var btnOpenRichiesta = document.getElementById('btn-open-richiesta-accesso');
    if (btnOpenRichiesta) {
      btnOpenRichiesta.addEventListener('click', openRichiestaAccesso);
      console.log('✅ btn-open-richiesta-accesso listener attaccato');
    }

    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', doLogout);
      console.log('✅ btn-logout listener attaccato');
    }
    
    var btnInfo = document.getElementById('btn-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', function(){closeDrawer();document.getElementById('modal-info').style.display='flex';});
      console.log('✅ btn-info listener attaccato');
    }
    
    var btnDarkmode = document.getElementById('btn-darkmode');
    if (btnDarkmode) {
      btnDarkmode.addEventListener('click', function(){toggleDarkMode();closeDrawer();});
      console.log('✅ btn-darkmode listener attaccato');
    }
    
    console.log('🎉 TUTTI i listener attaccati!');
  }, 100);
});
G('file-input').addEventListener('change',function(e){handleFile(e.target.files[0],false);e.target.value='';});
G('file-add').addEventListener('change',function(e){console.log('🔼 File-add click! File:',e.target.files[0]?.name);handleFile(e.target.files[0],true);e.target.value='';});
async function resetTesseramentoDB(){
  if(!isAdmin())return;
  if(!confirm('Eliminare TUTTI i dati di tesseramento?\nOperazione irreversibile. I dati delle anagrafiche non saranno toccati.'))return;
  showLoad('Eliminazione…');
  try{
    await sbDel(TR+'?id=neq.00000000-0000-0000-0000-000000000000');
    allData=[];Object.keys(charts).forEach(function(k){charts[k].destroy();});charts={};
    // La tabs-bar resta visibile: il tab Anagrafiche è un modulo indipendente
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    G('upload-zone').style.display='flex';
    toast('Database tesseramento svuotato');
  }catch(e){toast('Errore: '+e.message,'error');}
  finally{hideLoad();}
}
G('btn-reset').addEventListener('click',resetTesseramentoDB);
G('btn-go-admin').addEventListener('click',showAdminPanel);
G('btn-back').addEventListener('click',function(){if(allData.length)showDashboard();else{document.body.classList.remove('admin-open');G('sidebar').style.display='flex';G('upload-zone').style.display='flex';}});
// IMPORT EVENTS - Drag and Drop + Click
var uploadDirettiDrop = G('upload-diretti-drop');
var uploadAnagraficheDrop = G('upload-anagrafiche-drop');

if(uploadDirettiDrop) {
  uploadDirettiDrop.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.style.background = 'var(--surface)';
    this.style.borderColor = 'var(--blue)';
  });
  uploadDirettiDrop.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.style.background = 'var(--surface2)';
    this.style.borderColor = 'var(--border)';
  });
  uploadDirettiDrop.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.style.background = 'var(--surface2)';
    this.style.borderColor = 'var(--border)';
    handleDrop(e, 'diretti');
  });
  uploadDirettiDrop.addEventListener('click', function() {
    G('upload-diretti-input').click();
  });
}

if(uploadAnagraficheDrop) {
  uploadAnagraficheDrop.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.style.background = 'var(--surface)';
    this.style.borderColor = 'var(--accent2)';
  });
  uploadAnagraficheDrop.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.style.background = 'var(--surface2)';
    this.style.borderColor = 'var(--border)';
  });
  uploadAnagraficheDrop.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.style.background = 'var(--surface2)';
    this.style.borderColor = 'var(--border)';
    handleDrop(e, 'anagrafiche');
  });
  uploadAnagraficheDrop.addEventListener('click', function() {
    G('upload-anagrafiche-input').click();
  });
}

var _btnCreaUtente = G('btn-crea-utente'); if(_btnCreaUtente) _btnCreaUtente.addEventListener('click',createUser);
G('btn-clr-filters').addEventListener('click',function(){['f-anno','f-mese','f-tiporete','f-promotore','f-acuradi'].forEach(function(id){G(id).value='';});renderOverview();});
G('btn-clr-pfilters').addEventListener('click',function(){['fp-anno','fp-mese-da','fp-mese-a','fp-tiporete'].forEach(function(id){G(id).value='';});renderPromoTrend();});
['f-anno','f-mese','f-tiporete','f-promotore','f-acuradi'].forEach(function(id){G(id).addEventListener('change',renderOverview);});
['fp-anno','fp-mese-da','fp-mese-a','fp-tiporete'].forEach(function(id){G(id).addEventListener('change',renderPromoTrend);});

// TABS
document.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var tabId=this.getAttribute('data-tab');
    if(!tabId) return;
    
    // Controllo autorizzazione
    if(!canAccessTab(tabId)){
      toast('❌ Non hai permessi per accedere a questa sezione','error');
      return;
    }
    
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    this.classList.add('active');
    G(tabId).classList.add('active');

    // Aggiorna freccia scroll
    if(typeof tabsUpdateArrow === 'function') setTimeout(tabsUpdateArrow, 50);

    // Gestione upload-zone: visibile solo su overview per admin senza dati tesseramento
    if(tabId==='tab-overview' && allData.length===0 && isAdmin()){
      G('upload-zone').style.display='flex';
    } else {
      G('upload-zone').style.display='none';
    }
    // Lazy-load anagrafiche: ora è on-demand, non fare nulla all'apertura tab
    if(tabId==='tab-anagrafiche'){ /* on-demand: l'utente usa i filtri */ }
    // Lazy-load ateco on first visit
    if(tabId==='tab-ateco' && !atecoLoaded && !atecoLoading){ atecoLoad(); }
    if(tabId==='tab-raggruppamenti' && !raggLoaded && !raggLoading){ raggLoad(); }
    // Lazy-load consulenti on first visit
    if(tabId==='tab-consulenti' && !consulentiLoaded && !consulentiLoading){ consulentiLoad(); }
    // Lazy-load serie storica on first visit
    if(tabId==='tab-storica' && !storicaLoaded && !storicaLoading){ storicaInit(); }
    // Lazy-load incassi on first visit
    if(tabId==='tab-incassi' && !incassiLoaded && !incassiLoading){ incassiInit(); }
    // Lazy-load raggruppamenti on first visit
    if(tabId==='tab-raggruppamenti' && !raggLoaded && !raggLoading){ raggLoad(); }
    // Assicura che il toggle filtri sia inizializzato anche su tab iniettati
    setTimeout(reInitFiltersToggle, 100);
    // Rilancia animazione countUp al click su Andamento
    if(tabId==='tab-overview' && typeof renderOverview === 'function'){ renderOverview(); }
    // Centra il tab attivo nelle frecce della top nav
    if(typeof sbScrollToActive === 'function') sbScrollToActive();
  });
});

// ANAGRAFICHE EVENTS
G('ana-btn-apply').addEventListener('click', anaSearch);
G('ana-btn-reset').addEventListener('click', anaReset);
G('ana-btn-reload').addEventListener('click', function(){ anaSearch(); });
G('ana-btn-export').addEventListener('click', anaExport);
G('ana-selall').addEventListener('change', anaToggleAll);
// Invio nei campi testo = cerca
['ana-f-rs','ana-f-piva','ana-f-cap','ana-f-comune-text','ana-f-ateco-text','ana-f-sede-text','ana-f-acuradi-text','ana-f-mestiere-text'].forEach(function(id){
  var el = G(id); if (!el) return;
  el.addEventListener('keypress', function(e){ if(e.key==='Enter') anaSearch(); });
});
// Cambio di un select = cerca
['ana-f-sesso','ana-f-raggr-analisi','ana-f-disdetta-status'].forEach(function(id){
  G(id).addEventListener('change', anaSearch);
});
// Delegate checkbox clicks on tbody
G('ana-tbody').addEventListener('change', function(e){
  var t=e.target;
  if(t && t.tagName==='INPUT' && t.type==='checkbox'){
    var idx=parseInt(t.getAttribute('data-idx'),10);
    if(!isNaN(idx)){
      var tr=t.closest('tr');
      anaToggleRow(idx, tr);
    }
  }
});

// DOUBLE-CLICK PER APRIRE SCHEDA ANAGRAFICA
G('ana-tbody').addEventListener('dblclick', function(e){
  var tr = e.target.closest('tr');
  if(tr && tr.hasAttribute('data-idx')){
    var idx = parseInt(tr.getAttribute('data-idx'), 10);
    if(!isNaN(idx)){
      openAnagraficaModal(idx);
    }
  }
});

// MODAL PASSWORD
G('btn-save-pwd').addEventListener('click', saveNewPwd);
G('modal-confirm-pwd').addEventListener('keypress',function(e){if(e.key==='Enter')saveNewPwd();});
G('modal-pwd').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ADMIN INTERNAL TABS — event delegation robusta su document
document.addEventListener('click', function(e){
  var btn = e.target.closest('.admin-tab-new');
  if(!btn) return;
  var tabId = btn.getAttribute('data-atab');
  if(!tabId) return;
  document.querySelectorAll('.admin-tab-new').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.atab-content').forEach(function(c){c.classList.remove('active');});
  btn.classList.add('active');
  var tc = G(tabId);
  if(tc) tc.classList.add('active');
  if(tabId==='atab-logs') loadLogs();
  if(tabId==='atab-ruoli') loadRuoli();
});

// LOG FILTERS
var logFilterUser=G('log-filter-user'),logFilterEsito=G('log-filter-esito');
if(logFilterUser) logFilterUser.addEventListener('change',function(){logPage=0;loadLogs();});
if(logFilterEsito) logFilterEsito.addEventListener('change',function(){logPage=0;loadLogs();});
G('btn-clear-logs').addEventListener('click',async function(){
  if(!confirm('Eliminare tutti i log di connessione?\nQuesta operazione non può essere annullata.')) return;
  showLoad('Eliminazione log…');
  try{
    await sbDel('cna_login_logs?id=neq.00000000-0000-0000-0000-000000000000');
    logPage=0; loadLogs();
    toast('Log eliminati','success');
  }catch(e){toast('Errore: '+e.message,'error');}
  finally{hideLoad();}
});

// DRAG & DROP
var drop=G('drop-area');
drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('drag-over');});
drop.addEventListener('dragleave',function(){drop.classList.remove('drag-over');});
drop.addEventListener('drop',function(e){e.preventDefault();drop.classList.remove('drag-over');handleFile(e.dataTransfer.files[0],false);});

// HAMBURGER MENU
// ── Sincronizza zone da CAP dopo import Anagrafiche ──────────────────────────
async function sincronizzaZone(btn) {
  btn.disabled = true;
  btn.textContent = '⏳ Sincronizzazione in corso…';
  try {
    var resp = await fetch(SB + '/rest/v1/rpc/sincronizza_zone_da_cap', {
      method: 'POST',
      headers: H({ 'Content-Type': 'application/json' }),
      body: '{}'
    });
    if (!resp.ok) {
      var err = await resp.text();
      throw new Error('HTTP ' + resp.status + ': ' + err);
    }
    var result = await resp.json();
    // result è un array di oggetti {aggiornati, inseriti}
    var r = Array.isArray(result) ? result[0] : result;
    btn.textContent = '✅ Zone sincronizzate';
    btn.style.background = '#10B981';
    toast('Zone sincronizzate: ' + (r.aggiornati||0) + ' aggiornati, ' + (r.inseriti||0) + ' inseriti', 'success');
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '🗺️ Sincronizza Zone da CAP';
    toast('Errore sincronizzazione zone: ' + e.message, 'error');
    console.error(e);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PANDORA — Import CSV gestionali (solo admin)
// ══════════════════════════════════════════════════════════════════════════════

// Mostra sezione Pandora solo agli admin, quando si apre Carica Dati
function pandoraInitVisibility() {
  var sec = document.getElementById('pandora-section');
  if (!sec) return;
  sec.style.display = (typeof isAdmin === 'function' && isAdmin()) ? 'block' : 'none';
}

// Mostra Pandora ogni volta che upload-zone diventa visibile
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    pandoraInitVisibility();
    // Observer: ogni volta che upload-zone viene mostrata, reinit Pandora
    var uz = document.getElementById('upload-zone');
    if (uz) {
      new MutationObserver(function() {
        if (uz.style.display !== 'none' && uz.style.display !== '') {
          pandoraInitVisibility();
        }
      }).observe(uz, { attributes: true, attributeFilter: ['style'] });
    }
  }, 600);
});

var PANDORA_EXPECTED = [
  'G1000001_scadenze',
  'G1000003_scadenze',
  'G1000001_serviziFatturazione',
  'G1000003_serviziFatturazione'
];

var PANDORA_AZIENDE = {
  'G1000001_scadenze':            { codice:'G1000001', azienda:'CNA ROMA ASSOCIAZIONE AREA METROPOLITANA', tipo:'sc' },
  'G1000003_scadenze':            { codice:'G1000003', azienda:'CNA CAF LAZIO SRL',                        tipo:'sc' },
  'G1000001_serviziFatturazione': { codice:'G1000001', azienda:'CNA ROMA ASSOCIAZIONE AREA METROPOLITANA', tipo:'fat' },
  'G1000003_serviziFatturazione': { codice:'G1000003', azienda:'CNA CAF LAZIO SRL',                        tipo:'fat' }
};

var pandoraFiles = {};

function pandoraLog(msg, cls) {
  var box = document.getElementById('pandora-log');
  if (!box) return;
  var d = document.createElement('div');
  var ts = new Date().toLocaleTimeString('it-IT');
  d.style.color = cls === 'ok' ? '#16A34A' : cls === 'warn' ? '#D97706' : cls === 'err' ? '#DC2626' : cls === 'info' ? '#2563EB' : '';
  d.textContent = '[' + ts + ']  ' + msg;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function pandoraSetProgress(pct, label) {
  var bar = document.getElementById('pandora-progress-bar');
  var pctEl = document.getElementById('pandora-progress-pct');
  var lbl = document.getElementById('pandora-progress-label');
  if (bar) bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (lbl) lbl.textContent = label;
}

function pandoraScanFiles(files) {
  pandoraFiles = {};
  var found = 0;
  var promises = [];

  Array.from(files).forEach(function(file) {
    var basename = file.name.replace(/\.csv$/i, '');
    var key = PANDORA_EXPECTED.find(function(k) { return k.toLowerCase() === basename.toLowerCase(); });
    if (!key) return;
    pandoraFiles[key] = file;
    found++;

    var card = document.getElementById('pfc-' + key);
    var meta = document.getElementById('pfm-' + key);
    if (card) {
      card.classList.add('found');
      card.querySelector('.pandora-fc-icon').textContent = '✅';
      card.querySelector('.pandora-fc-badge').textContent = 'Trovato';
    }

    var p = new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        var lines = text.split('\n').filter(function(l){ return l.trim(); }).length - 1;
        file._cachedText = text;
        if (meta) {
          meta.innerHTML =
            '<div>Righe: <strong>' + lines.toLocaleString('it-IT') + '</strong></div>' +
            '<div>Dim: <strong>' + (file.size < 1048576 ? (file.size/1024).toFixed(1)+'KB' : (file.size/1048576).toFixed(1)+'MB') + '</strong></div>' +
            '<div>Modifica: <strong>' + new Date(file.lastModified).toLocaleDateString('it-IT') + '</strong></div>' +
            '<div>Ora: <strong>' + new Date(file.lastModified).toLocaleTimeString('it-IT') + '</strong></div>';
        }
        resolve();
      };
      reader.readAsText(file, 'latin1');
    });
    promises.push(p);
  });

  Promise.all(promises).then(function() {
    var btn = document.getElementById('pandora-btn-import');
    if (btn) { btn.disabled = found === 0; btn.style.opacity = found > 0 ? '1' : '.35'; }
  });
}

function pandoraReset() {
  pandoraFiles = {};
  var inp = document.getElementById('pandora-input');
  if (inp) inp.value = '';
  PANDORA_EXPECTED.forEach(function(k) {
    var card = document.getElementById('pfc-' + k);
    var meta = document.getElementById('pfm-' + k);
    if (card) { card.classList.remove('found'); card.querySelector('.pandora-fc-icon').textContent = '📄'; card.querySelector('.pandora-fc-badge').textContent = 'In attesa'; }
    if (meta) meta.innerHTML = '';
  });
  var btn = document.getElementById('pandora-btn-import');
  if (btn) { btn.disabled = true; btn.style.opacity = '.35'; }
  var pw = document.getElementById('pandora-progress-wrap');
  var lw = document.getElementById('pandora-log-wrap');
  var sw = document.getElementById('pandora-summary');
  if (pw) pw.style.display = 'none';
  if (lw) lw.style.display = 'none';
  if (sw) sw.style.display = 'none';
  var log = document.getElementById('pandora-log');
  if (log) log.innerHTML = '';
}

function pandoraParseCSV(text) {
  var lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  if (lines.length < 2) return [];
  var first = lines[0];
  var sep = first.indexOf('\t') >= 0 ? '\t' : first.indexOf(';') >= 0 ? ';' : ',';
  var headers = first.split(sep).map(function(h){ return h.trim().replace(/^"|"$/g,''); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim(); if (!line) continue;
    var vals = [], cur = '', inQ = false;
    for (var c = 0; c < line.length; c++) {
      var ch = line[c];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    var row = {};
    headers.forEach(function(h, i){ row[h] = (vals[i]||'').replace(/^"|"$/g,'') || null; });
    rows.push(row);
  }
  return rows;
}

function pandoraMapSc(row, codice_azienda, azienda) {
  var n = function(v){ if(!v||v==='NULL') return null; var x=parseFloat(String(v).replace(',','.')); return isNaN(x)?null:x; };
  var d = function(v){ if(!v||v==='NULL') return null; var x=new Date(v); return isNaN(x)?null:x.toISOString().split('T')[0]; };
  return {
    customer_trx_id: row.CUSTOMER_TRX_ID ? parseInt(row.CUSTOMER_TRX_ID) : null,
    codice_cliente: (row.CODICE_CLIENTE||'').trim(), cliente: row.CLIENTE||null,
    numero_fattura: row.NUMERO_FATTURA||null, riferimento: row.RIFERIMENTO||null,
    tipo: row.TIPO||null, unita_operativa: row.UNITA_OPERATIVA||null,
    totale_fattura: n(row.TOTALE_FATTURA), totale_imponibile: n(row.TOTALE_IMPONIBILE),
    totale_iva: n(row.TOTALE_IVA), tipo_pagamento: row.TIPO_PAGAMENTO||null,
    saldo: n(row.SALDO), data_fattura: d(row.DATA_FATTURA), data_scadenza: d(row.DATA_SCADENZA),
    sede: row.SEDE||null, p_iva: row.P_IVA||null, codice_fiscale: row.CODICE_FISCALE||null,
    indirizzo: row.INDIRIZZO||null, cap: row.CAP||null, comune: row.COMUNE||null,
    prov: row.PROV||null, condiz_pagam: row.CONDIZ_PAGAM||null,
    org_idi: row.ORG_IDi ? parseInt(row.ORG_IDi) : null,
    codice_azienda: codice_azienda, azienda: azienda,
    codicetipodoc: row.CODICETIPODOC||null, codicetipodocaz: row.codicetipodocaz||null
  };
}

function pandoraMapFat(row, codice_azienda, azienda) {
  var n = function(v){ if(!v||v==='NULL') return null; var x=parseFloat(String(v).replace(',','.')); return isNaN(x)?null:x; };
  var d = function(v){ if(!v||v==='NULL') return null; var x=new Date(v); return isNaN(x)?null:x.toISOString().split('T')[0]; };
  return {
    codice_cliente: (row.CODICE_CLIENTE||'').trim(), p_iva: row.P_IVA||null,
    scadenza: d(row.SCADENZA), codice: row.CODICE||null,
    descrizione: (row.DESCRIZIONE||'').replace(/<br\s*\/?>/gi,' ').trim()||null,
    importo: n(row.IMPORTO), codice_azienda: codice_azienda, azienda: azienda
  };
}

async function pandoraLoadCodici() {
  var set = {};
  var from = 0, PAGE = 1000;
  while (true) {
    var to = from + PAGE - 1;
    var r = await fetch(SB + '/rest/v1/Anagrafiche?select=codiceanagrafica', {
      headers: Object.assign({}, H(), { 'Range': from+'-'+to, 'Range-Unit': 'items', 'Prefer': 'count=none' })
    });
    var data = await r.json();
    if (!Array.isArray(data) || !data.length) break;
    data.forEach(function(d){ if(d.codiceanagrafica) set[d.codiceanagrafica.trim()] = true; });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return set;
}

async function pandoraUpsertBatch(table, rows, onConflict) {
  var BATCH = 500, done = 0, errs = 0;
  for (var i = 0; i < rows.length; i += BATCH) {
    var chunk = rows.slice(i, i + BATCH);
    var r = await fetch(SB + '/rest/v1/' + table + '?on_conflict=' + onConflict, {
      method: 'POST',
      headers: Object.assign({}, H(), { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'Content-Type': 'application/json' }),
      body: JSON.stringify(chunk)
    });
    if (r.ok) { done += chunk.length; }
    else {
      var errText = await r.text();
      if (errText.indexOf('21000') >= 0) {
        // Fallback riga per riga
        for (var ri = 0; ri < chunk.length; ri++) {
          var r2 = await fetch(SB + '/rest/v1/' + table + '?on_conflict=' + onConflict, {
            method: 'POST',
            headers: Object.assign({}, H(), { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'Content-Type': 'application/json' }),
            body: JSON.stringify([chunk[ri]])
          });
          if (r2.ok) done++; else errs++;
        }
      } else { errs += chunk.length; pandoraLog('⚠ Errore batch ' + i + '-' + (i+BATCH) + ': ' + errText.substring(0,100), 'err'); }
    }
  }
  return { done: done, errs: errs };
}

async function pandoraStartImport() {
  if (typeof isAdmin === 'function' && !isAdmin()) { toast('Accesso negato', 'error'); return; }
  var btn = document.getElementById('pandora-btn-import');
  if (btn) btn.disabled = true;
  document.getElementById('pandora-spin').style.display = 'inline';
  document.getElementById('pandora-progress-wrap').style.display = 'block';
  document.getElementById('pandora-log-wrap').style.display = 'block';
  document.getElementById('pandora-summary').style.display = 'none';
  document.getElementById('pandora-log').innerHTML = '';

  var totFiles = Object.keys(pandoraFiles).length;
  var sum = { sc: { done:0, skip:0, err:0 }, fat: { done:0, skip:0, err:0 } };

  try {
    pandoraSetProgress(2, 'Caricamento codici Anagrafiche…');
    pandoraLog('Caricamento codici cliente da Anagrafiche…', 'info');
    var codici = await pandoraLoadCodici();
    pandoraLog('✓ ' + Object.keys(codici).length.toLocaleString('it-IT') + ' codici caricati', 'ok');

    var fi = 0;
    for (var key in pandoraFiles) {
      if (!pandoraFiles.hasOwnProperty(key)) continue;
      fi++;
      var file = pandoraFiles[key];
      var meta = PANDORA_AZIENDE[key];
      if (!meta) continue;

      pandoraSetProgress(5 + (fi-1)/totFiles*85, 'Lettura ' + key + '.csv…');
      pandoraLog('\n── ' + key + '.csv ──', 'info');

      var text = file._cachedText || await new Promise(function(res){ var rd=new FileReader(); rd.onload=function(e){res(e.target.result);}; rd.readAsText(file,'latin1'); });
      var rows = pandoraParseCSV(text);
      pandoraLog('  ' + rows.length.toLocaleString('it-IT') + ' righe lette');

      var valid = rows.filter(function(r){ return codici[(r.CODICE_CLIENTE||'').trim()]; });
      var skip = rows.length - valid.length;
      pandoraLog('  ' + valid.length.toLocaleString('it-IT') + ' valide · ' + skip.toLocaleString('it-IT') + ' scartate', skip > 0 ? 'warn' : '');

      pandoraSetProgress(5 + (fi-.4)/totFiles*85, 'Upsert ' + key + '…');

      if (meta.tipo === 'sc') {
        var rawSc = valid.map(function(r){ return pandoraMapSc(r, meta.codice, meta.azienda); }).filter(function(r){ return r.customer_trx_id !== null; });
        var scMap = {};
        rawSc.forEach(function(r){ scMap[r.customer_trx_id+'|'+r.codice_azienda] = r; });
        var mapped = Object.values ? Object.values(scMap) : Object.keys(scMap).map(function(k){ return scMap[k]; });
        pandoraLog('  Upsert incassipandora (' + mapped.length.toLocaleString('it-IT') + ' record)…', 'info');
        var res = await pandoraUpsertBatch('incassipandora', mapped, 'customer_trx_id,codice_azienda');
        sum.sc.done += res.done; sum.sc.skip += skip; sum.sc.err += res.errs;
        pandoraLog('  ✓ ' + res.done.toLocaleString('it-IT') + ' record upserted', 'ok');
      } else {
        var rawFat = valid.map(function(r){ return pandoraMapFat(r, meta.codice, meta.azienda); });
        var fatMap = {};
        rawFat.forEach(function(r){ fatMap[(r.codice_cliente||'')+'|'+r.codice_azienda+'|'+r.scadenza+'|'+r.codice] = r; });
        var mapped2 = Object.values ? Object.values(fatMap) : Object.keys(fatMap).map(function(k){ return fatMap[k]; });
        pandoraLog('  Upsert fatturazionepandora (' + mapped2.length.toLocaleString('it-IT') + ' record)…', 'info');
        var res2 = await pandoraUpsertBatch('fatturazionepandora', mapped2, 'codice_cliente,codice_azienda,scadenza,codice');
        sum.fat.done += res2.done; sum.fat.skip += skip; sum.fat.err += res2.errs;
        pandoraLog('  ✓ ' + res2.done.toLocaleString('it-IT') + ' record upserted', 'ok');
      }
    }

    pandoraSetProgress(100, 'Import completato ✓');
    pandoraLog('\n══ COMPLETATO ══', 'ok');

    var sc = document.getElementById('pandora-summary');
    var cards = document.getElementById('pandora-summary-cards');
    if (sc && cards) {
      sc.style.display = 'block';
      var totErr = sum.sc.err + sum.fat.err;
      cards.innerHTML =
        '<div style="background:var(--surface2);border:1px solid var(--border);border-top:3px solid #16A34A;border-radius:8px;padding:14px">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Incassi upserted</div>' +
          '<div style="font-size:24px;font-weight:700;color:#16A34A">' + sum.sc.done.toLocaleString('it-IT') + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim)">' + sum.sc.skip.toLocaleString('it-IT') + ' scartati</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-top:3px solid #2563EB;border-radius:8px;padding:14px">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Fatturazione upserted</div>' +
          '<div style="font-size:24px;font-weight:700;color:#2563EB">' + sum.fat.done.toLocaleString('it-IT') + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim)">' + sum.fat.skip.toLocaleString('it-IT') + ' scartati</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-top:3px solid ' + (totErr>0?'#DC2626':'#16A34A') + ';border-radius:8px;padding:14px">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Errori</div>' +
          '<div style="font-size:24px;font-weight:700;color:' + (totErr>0?'#DC2626':'#16A34A') + '">' + totErr.toLocaleString('it-IT') + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim)">' + (totErr===0?'Nessun errore':'Vedi log') + '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-top:3px solid var(--border);border-radius:8px;padding:14px">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">File elaborati</div>' +
          '<div style="font-size:24px;font-weight:700;color:var(--text)">' + totFiles + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim)">' + new Date().toLocaleString('it-IT') + '</div>' +
        '</div>';
    }
    toast('Import Pandora completato', 'success');
  } catch(e) {
    pandoraLog('ERRORE: ' + e.message, 'err');
    toast('Errore import Pandora: ' + e.message, 'error');
    console.error(e);
  }

  if (btn) { btn.disabled = false; }
  document.getElementById('pandora-spin').style.display = 'none';
}
