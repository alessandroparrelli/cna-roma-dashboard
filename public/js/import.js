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
  importData = { diretti: null, anagrafiche: null, contrattiservizio: null };
  G('diretti-status').style.display = 'none';
  G('anagrafiche-status').style.display = 'none';
  G('contrattiservizio-status').style.display = 'none';
  G('import-preview').style.display = 'none';
  G('upload-diretti-input').value = '';
  G('upload-anagrafiche-input').value = '';
  G('upload-contrattiservizio-input').value = '';
  toast('Dati cancellati', 'info');
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
    if (btnInfo) btnInfo.addEventListener('click', function(){document.getElementById('modal-info').style.display='flex';});
    
    var btnDarkmode = G('btn-darkmode');
    if (btnDarkmode) btnDarkmode.addEventListener('click', toggleDarkMode);
    
    var btnDarkmodeMob = G('btn-darkmode-mob');
    if (btnDarkmodeMob) btnDarkmodeMob.addEventListener('click', function(){toggleDarkMode();closeDrawer();});
    
    var btnInfoMob = G('btn-info-mob');
    if (btnInfoMob) btnInfoMob.addEventListener('click', function(){document.getElementById('modal-info').style.display='flex';});
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
  if (!importData.diretti && !importData.anagrafiche && !importData.contrattiservizio) {
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
  
  if (results.errors && results.errors.length > 0) {
    html += '<div style="margin:15px 0;padding:10px;background:rgba(220,38,38,0.1);border-left:3px solid #dc2626;border-radius:4px">';
    html += '<strong style="color:#dc2626">[ERRORE] ERRORI</strong><br>';
    results.errors.forEach(function(err) {
      html += '<span style="font-size:12px;color:var(--text-sub);display:block;margin:5px 0">' + escapeHtml(err) + '</span>';
    });
    html += '</div>';
  }
  
  html += '<div style="margin-top:20px;display:flex;gap:10px">';
  html += '<button class="btn btn-primary" onclick="this.closest(\'[role=dialog]\').remove()">Chiudi</button>';
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
  
  // Mostra il comando SQL necessario
  var sqlCommands = 'Esegui questi comandi in Supabase SQL Editor:\n\n' +
    'DELETE FROM diretti;\n' +
    'DELETE FROM "Anagrafiche";\n\n' +
    'Poi clicca "Invia a Supabase" per caricare i nuovi dati.';
  
  G('clean-status').innerHTML = '<strong>SQL da eseguire in Supabase SQL Editor:</strong><br><br>' +
    '<code style="background:var(--surface2);padding:10px;border-radius:4px;display:block;overflow-x:auto;font-family:monospace;font-size:11px">' +
    'DELETE FROM diretti;<br>' +
    'DELETE FROM "Anagrafiche";' +
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
    
    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', doLogout);
      console.log('✅ btn-logout listener attaccato');
    }
    
    var btnInfo = document.getElementById('btn-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', function(){document.getElementById('modal-info').style.display='flex';});
      console.log('✅ btn-info listener attaccato');
    }
    
    var btnDarkmode = document.getElementById('btn-darkmode');
    if (btnDarkmode) {
      btnDarkmode.addEventListener('click', toggleDarkMode);
      console.log('✅ btn-darkmode listener attaccato');
    }
    
    var btnDarkmodeMob = document.getElementById('btn-darkmode-mob');
    if (btnDarkmodeMob) {
      btnDarkmodeMob.addEventListener('click', function(){toggleDarkMode();closeDrawer();});
      console.log('✅ btn-darkmode-mob listener attaccato');
    }
    
    var btnInfoMob = document.getElementById('btn-info-mob');
    if (btnInfoMob) {
      btnInfoMob.addEventListener('click', function(){document.getElementById('modal-info').style.display='flex';});
      console.log('✅ btn-info-mob listener attaccato');
    }
    
    console.log('🎉 TUTTI i listener attaccati!');
  }, 100);
});
G('file-input').addEventListener('change',function(e){handleFile(e.target.files[0],false);e.target.value='';});
G('file-add').addEventListener('change',function(e){handleFile(e.target.files[0],true);e.target.value='';});
G('btn-reset').addEventListener('click',async function(){
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
});
G('btn-go-admin').addEventListener('click',showAdminPanel);
G('btn-back').addEventListener('click',function(){if(allData.length)showDashboard();else{G('admin-panel').style.display='none';G('upload-zone').style.display='flex';}});
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

G('btn-crea-utente').addEventListener('click',createUser);
G('btn-clr-filters').addEventListener('click',function(){['f-anno','f-mese','f-tiporete','f-promotore','f-acuradi'].forEach(function(id){G(id).value='';});renderOverview();});
G('btn-clr-pfilters').addEventListener('click',function(){['fp-anno','fp-mese-da','fp-mese-a','fp-tiporete'].forEach(function(id){G(id).value='';});renderPromoTrend();});
['f-anno','f-mese','f-tiporete','f-promotore','f-acuradi'].forEach(function(id){G(id).addEventListener('change',renderOverview);});
['fp-anno','fp-mese-da','fp-mese-a','fp-tiporete'].forEach(function(id){G(id).addEventListener('change',renderPromoTrend);});

// TABS
document.querySelectorAll('.tab-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var tabId=this.getAttribute('data-tab');
    
    // Controllo autorizzazione
    if(!canAccessTab(tabId)){
      toast('❌ Non hai permessi per accedere a questa sezione','error');
      return;
    }
    
    document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    this.classList.add('active');
    G(tabId).classList.add('active');
    // Gestione upload-zone: visibile solo su overview per admin senza dati tesseramento
    if(tabId==='tab-overview' && allData.length===0 && isAdmin()){
      G('upload-zone').style.display='flex';
    } else {
      G('upload-zone').style.display='none';
    }
    // Lazy-load anagrafiche on first visit
    if(tabId==='tab-anagrafiche' && !anaLoaded && !anaLoading){ anaLoad(); }
  });
});

// ANAGRAFICHE EVENTS
G('ana-btn-apply').addEventListener('click', anaApply);
G('ana-btn-reset').addEventListener('click', anaReset);
G('ana-btn-reload').addEventListener('click', function(){ anaLoaded=false; anaLoad(true); });
G('ana-btn-export').addEventListener('click', anaExport);
G('ana-selall').addEventListener('change', anaToggleAll);
// Invio nei campi testo = applica
['ana-f-rs','ana-f-piva','ana-f-cf','ana-f-cap'].forEach(function(id){
  G(id).addEventListener('keypress', function(e){ if(e.key==='Enter') anaApply(); });
});
// Cambio di un select = applica immediatamente
['ana-f-comune','ana-f-sesso','ana-f-ateco','ana-f-servizio','ana-f-anno','ana-f-raggr','ana-f-sede','ana-f-acuradi','ana-f-motivo','ana-f-unione','ana-f-settore','ana-f-mestiere'].forEach(function(id){
  G(id).addEventListener('change', anaApply);
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

// ADMIN INTERNAL TABS
document.querySelectorAll('.admin-tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    var tabId=this.getAttribute('data-atab');
    document.querySelectorAll('.admin-tab').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.atab-content').forEach(function(c){c.classList.remove('active');});
    this.classList.add('active');
    G(tabId).classList.add('active');
    if(tabId==='atab-logs') loadLogs();
    if(tabId==='atab-ruoli') loadRuoli();
  });
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