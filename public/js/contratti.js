var contrattiAll = [];
var contrattiFiltered = [];
var contrattiSelected = new Set();
var contrattiLoaded = false;
var contrattiLoading = false;

function contrattiSetProgress(pct, msg) {
  var prog = G('contratti-progress');
  if (prog) prog.style.width = pct + '%';
  var el = G('contratti-load-msg');
  if (el) el.textContent = msg;
}

function contrattiSetStatus(tipo, pct, msg) {
  var el = G('contratti-status-' + tipo);
  if (!el) return;
  var val = el.querySelector('.ana-sval');
  if (val) val.textContent = msg || pct + '%';
}

async function contrattiLoad(force) {
  if (contrattiLoading) return;
  if (contrattiLoaded && !force) return;
  contrattiLoading = true;
  
  G('contratti-loader').classList.add('active');
  G('contratti-content').style.display = 'none';
  ['contratti', 'anagrafiche', 'diretti', 'join'].forEach(function(t) {
    contrattiSetStatus(t, 0, null);
  });
  
  contrattiSetProgress(0, 'Connessione a Supabase…');
  
  try {
    // Carica contratti attivi con paginazione
    contrattiSetProgress(10, 'Caricamento contratti attivi…');
    contrattiSetStatus('contratti', 10, null);
    var contratti = await contrattisFetchAll('contrattiservizio?datadisdetta=is.null');
    
    // Carica Anagrafiche
    contrattiSetProgress(30, 'Caricamento Anagrafiche…');
    contrattiSetStatus('anagrafiche', 30, null);
    var anagrafiche = await contrattisFetchAll('Anagrafiche');
    
    // Carica Diretti
    contrattiSetProgress(60, 'Caricamento Diretti…');
    contrattiSetStatus('diretti', 60, null);
    var diretti = await contrattisFetchAll('diretti');
    
    console.log('=== DIRETTI TABLE ===');
    console.log('Total rows:', diretti.length);
    if (diretti.length > 0) {
      console.log('Sample diretti[0]:', diretti[0]);
      console.log('Campi diretti[0]:', Object.keys(diretti[0]));
    }
    
    // Crea mappe
    var anaMap = {};
    anagrafiche.forEach(function(a) {
      anaMap[a.codiceanagrafica] = a;
    });
    
    var direttiMap = {};
    diretti.forEach(function(d) {
      if (!direttiMap[d.codiceanagrafica]) {
        direttiMap[d.codiceanagrafica] = { iscritto: false, inps: false };
      }
      if (d.servizio && d.servizio.indexOf('Iscritto') !== -1) {
        direttiMap[d.codiceanagrafica].iscritto = true;
      }
      if (d.servizio && d.servizio.indexOf('INPS') !== -1) {
        direttiMap[d.codiceanagrafica].inps = true;
      }
    });
    
    contrattiSetProgress(80, 'Unificazione dati…');
    contrattiSetStatus('join', 80, null);
    
    // Crea array di imprese UNICHE con tutti i servizi
    var impreseMap = {};
    
    // Raccoglie ISCRITTO e TESSERAMENTO INPS dalla tabella diretti
    var iscritti = {};
    var inps = {};
    diretti.forEach(function(d) {
      if (!d.servizio) return;
      var servizio = String(d.servizio).trim().toUpperCase();
      if (servizio === 'ISCRITTO') {
        iscritti[d.codiceanagrafica] = true;
      }
      if (servizio === 'TESSERAMENTO INPS') {
        inps[d.codiceanagrafica] = true;
      }
    });
    
    console.log('ISCRITTI trovati:', Object.keys(iscritti).length);
    console.log('INPS trovati:', Object.keys(inps).length);
    
    contratti.forEach(function(c) {
      var ana = anaMap[c.codicecliente];
      if (!ana) return;
      
      if (!impreseMap[c.codicecliente]) {
        impreseMap[c.codicecliente] = {
          partitaiva: ana.partitaiva,
          ragionesociale: ana.ragionesociale,
          codicecliente: c.codicecliente,
          comune: ana.comune,
          provincia: ana.provincia,
          mestiere: ana.mestiere,
          email: ana.email,
          telefono: ana.telefono,
          iscritto: iscritti[ana.codiceanagrafica] || false,
          inps: inps[ana.codiceanagrafica] || false,
          servizi: {}
        };
      }
      // Aggiunge servizio a questa impresa
      impreseMap[c.codicecliente].servizi[c.tipocontratto] = true;
    });
    
    // Converte in array
    contrattiAll = [];
    var serviziSet = {};
    for (var codice in impreseMap) {
      var imp = impreseMap[codice];
      for (var srv in imp.servizi) {
        serviziSet[srv] = true;
      }
      contrattiAll.push(imp);
    }
    
    // Ordina per ragione sociale
    contrattiAll.sort(function(a, b) {
      return (a.ragionesociale || '').localeCompare(b.ragionesociale || '');
    });
    
    contrattiFiltered = contrattiAll.slice();
    contrattiSelected.clear();
    
    contrattiSetProgress(90, 'Popolamento filtri…');
    contrattiPopulateFilters(serviziSet);
    
    contrattiSetProgress(100, 'Rendering…');
    contrattiRender();
    
    contrattiLoaded = true;
    
    setTimeout(function() {
      G('contratti-loader').classList.remove('active');
      G('contratti-content').style.display = 'block';
    }, 300);
    
  } catch(e) {
    console.error('Errore caricamento contratti:', e);
    G('contratti-load-msg').textContent = '❌ ' + e.message;
    toast('Errore: ' + e.message, 'error');
  } finally {
    contrattiLoading = false;
  }
}

// Fetch con paginazione (come anaFetchAll)
async function contrattisFetchAll(table) {
  var all = [], offset = 0, size = 1000;
  while (true) {
    contrattiSetStatus(table, all.length, 'loading');
    var r = await fetch(SB + '/rest/v1/' + table + '?select=*&offset=' + offset + '&limit=' + size, { headers: H() });
    if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
    var rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      contrattiSetStatus(table, all.length, 'done');
      break;
    }
    all = all.concat(rows);
    offset += size;
    if (rows.length < size) {
      contrattiSetStatus(table, all.length, 'done');
      break;
    }
    await new Promise(function(res) { setTimeout(res, 150); });
  }
  return all;
}

function contrattiPopulateFilters(serviziSet) {
  var sel = G('contratti-f-servizio');
  if (!sel) return;
  
  var current = sel.value;
  sel.innerHTML = '<option value="">-- Tutti i servizi --</option>';
  
  Object.keys(serviziSet).sort().forEach(function(s) {
    var o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    if (s === current) o.selected = true;
    sel.appendChild(o);
  });
}

function contrattiRender() {
  var filterServizio = G('contratti-f-servizio').value;
  var rows = contrattiAll;
  
  if (filterServizio) {
    rows = contrattiAll.filter(function(r) {
      return r.servizi && r.servizi[filterServizio];
    });
  }
  
  contrattiFiltered = rows;
  
  var tb = G('contratti-tbody');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="24" class="ana-empty">Nessun record trovato</td></tr>';
    contrattiUpdateSelCount();
    return;
  }
  
  // Lista di servizi per le colonne
  var servizi = [];
  Object.keys(contrattiAll.reduce(function(acc, r) {
    Object.keys(r.servizi || {}).forEach(function(s) { acc[s] = true; });
    return acc;
  }, {})).sort().forEach(function(s) { servizi.push(s); });
  
  // Aggiorna header con nomi servizi
  var thead = G('contratti-table').querySelector('thead tr');
  if (thead) {
    var th_cells = thead.querySelectorAll('th');
    for (var i = 0; i < servizi.length; i++) {
      var th = th_cells[9 + i]; // 9 = checkbox + 8 colonne base
      if (th) th.textContent = servizi[i];
    }
  }
  
  var html = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var sel = contrattiSelected.has(i) ? ' class="selected"' : '';
    var chk = contrattiSelected.has(i) ? ' checked' : '';
    
    html.push('<tr' + sel + ' data-idx="' + i + '">');
    html.push('<td class="col-check"><input type="checkbox" data-idx="' + i + '"' + chk + '></td>');
    html.push('<td>' + (r.partitaiva || '-') + '</td>');
    html.push('<td>' + (r.ragionesociale || '-') + '</td>');
    html.push('<td>' + (r.codicecliente || '-') + '</td>');
    html.push('<td>' + (r.comune || '-') + '</td>');
    html.push('<td>' + (r.provincia || '-') + '</td>');
    html.push('<td>' + (r.mestiere || '-') + '</td>');
    html.push('<td>' + (r.email || '-') + '</td>');
    html.push('<td>' + (r.telefono || '-') + '</td>');
    
    // Servizi con X + conteggio
    var conteggio = 0;
    servizi.forEach(function(srv) {
      var haServizio = r.servizi && r.servizi[srv];
      html.push('<td style="text-align:center;font-weight:bold;color:#005CA9">' + (haServizio ? 'X' : '') + '</td>');
      if (haServizio) conteggio++;
    });
    
    // ISCRITTO e TESSERAMENTO INPS + conteggio
    var iscritto_mark = r.iscritto ? 'X' : '';
    var inps_mark = r.inps ? 'X' : '';
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9">' + iscritto_mark + '</td>');
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9">' + inps_mark + '</td>');
    if (r.iscritto) conteggio++;
    if (r.inps) conteggio++;
    
    // TOTALE SERVIZI
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9;background:#F0F4FF;border-left:2px solid #005CA9">' + conteggio + '</td>');
    html.push('</tr>');
  }
  
  tb.innerHTML = html.join('');
  contrattiUpdateSelCount();
  G('contratti-count').textContent = rows.length + ' imprese';
}

function contrattiUpdateSelCount() {
  var n = contrattiSelected.size;
  var chip = G('contratti-selcount');
  if (chip) {
    if (n > 0) {
      chip.style.display = 'inline-flex';
      chip.textContent = n.toLocaleString('it-IT') + ' selezionati';
    } else {
      chip.style.display = 'none';
    }
  }
}

function contrattiToggleRow(i) {
  if (contrattiSelected.has(i)) {
    contrattiSelected.delete(i);
  } else {
    contrattiSelected.add(i);
  }
  contrattiRender();
}

function contrattiToggleAll() {
  var chk = G('contratti-selall');
  if (!chk) return;
  
  if (chk.checked) {
    for (var i = 0; i < contrattiFiltered.length; i++) {
      contrattiSelected.add(i);
    }
  } else {
    contrattiSelected.clear();
  }
  contrattiRender();
}

function contrattiExportExcel() {
  if (contrattiSelected.size === 0) {
    alert('Seleziona almeno una riga');
    return;
  }
  
  // Raccoglie servizi
  var servizi = [];
  Object.keys(contrattiAll.reduce(function(acc, r) {
    Object.keys(r.servizi || {}).forEach(function(s) { acc[s] = true; });
    return acc;
  }, {})).sort().forEach(function(s) { servizi.push(s); });
  
  // Crea workbook
  var wb = XLSX.utils.book_new();
  
  // --- PREPARAZIONE DATI ---
  var wsData = [];
  
  // Riga 1: Titolo
  wsData.push(['Analisi contratti CNA']);
  
  // Riga 2: Header
  var headerRow = ['PARTITA IVA', 'RAGIONE SOCIALE', 'CODICE CLIENTE', 'COMUNE', 'PROVINCIA', 'MESTIERE', 'EMAIL', 'TELEFONO'];
  headerRow = headerRow.concat(servizi);
  headerRow.push('ISCRITTO', 'TESSERAMENTO INPS', 'NUMERO SERVIZI ACQUISTATI');
  wsData.push(headerRow);
  
  // Dati
  var indices = Array.from(contrattiSelected).sort(function(a, b) { return a - b; });
  indices.forEach(function(i) {
    var r = contrattiFiltered[i];
    var row = [r.partitaiva || '', r.ragionesociale || '', r.codicecliente || '', r.comune || '', r.provincia || '', r.mestiere || '', r.email || '', r.telefono || ''];
    
    var conteggio = 0;
    servizi.forEach(function(srv) {
      var hasServizio = (r.servizi && r.servizi[srv]) ? true : false;
      row.push(hasServizio ? 'X' : '');
      if (hasServizio) conteggio++;
    });
    
    var hasIscritto = r.iscritto ? true : false;
    var hasInps = r.inps ? true : false;
    row.push(hasIscritto ? 'X' : '');
    row.push(hasInps ? 'X' : '');
    if (hasIscritto) conteggio++;
    if (hasInps) conteggio++;
    
    row.push(conteggio);
    
    wsData.push(row);
  });
  
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // --- MERGE TITOLO ---
  var colCount = 8 + servizi.length + 3;
  ws['!merges'] = [{s: {r: 0, c: 0}, e: {r: 0, c: colCount - 1}}];
  
  // --- COLONNE LARGHEZZE (come file allegato) ---
  var colWidths = [12.16, 60.83, 14.33, 19.33, 10.33, 70.83, 39.66, 19.66];
  servizi.forEach(function() { colWidths.push(27); });
  colWidths.push(15.33, 19.33, 22);
  ws['!cols'] = colWidths.map(function(w) { return {wch: w}; });
  
  // --- FORMATTAZIONE ---
  // Riga 1: TITOLO - Blu CNA, grande 22
  ws['A1'].s = {
    font: {bold: false, sz: 22, color: {theme: 0}},
    fill: {patternType: 'solid', fgColor: {rgb: 'FF005CA9'}},
    alignment: {horizontal: 'left', vertical: 'center'}
  };
  
  // Riga 2: HEADER - Blu CNA sfondo, tema colore, size 12
  for (var col = 0; col < colCount; col++) {
    var cellRef = XLSX.utils.encode_col(col) + '2';
    if (!ws[cellRef]) {
      ws[cellRef] = {v: headerRow[col]};
    }
    ws[cellRef].s = {
      font: {bold: false, sz: 12, color: {theme: 0}},
      fill: {patternType: 'solid', fgColor: {rgb: 'FF005CA9'}},
      alignment: {horizontal: 'left', vertical: 'center', wrapText: false},
      border: {
        left: {style: 'thin', color: {rgb: 'FF005CA9'}},
        right: {style: 'thin', color: {rgb: 'FF005CA9'}},
        top: {style: 'thin', color: {rgb: 'FF005CA9'}},
        bottom: {style: 'thin', color: {rgb: 'FF005CA9'}}
      }
    };
  }
  
  // Dati - nessuna formattazione (colori neutri)
  for (var dataRow = 3; dataRow <= wsData.length; dataRow++) {
    for (var dataCol = 0; dataCol < colCount; dataCol++) {
      var dataCellRef = XLSX.utils.encode_col(dataCol) + dataRow;
      if (!ws[dataCellRef]) ws[dataCellRef] = {v: ''};
      ws[dataCellRef].s = {
        alignment: {horizontal: 'left', vertical: 'center'},
        font: {sz: 11}
      };
    }
  }
  
  // --- FREEZE PANES: le prime 2 righe rimangono visibili ---
  ws['!freeze'] = {xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomRight'};
  
  XLSX.utils.book_append_sheet(wb, ws, 'Contratti');
  
  var nome = 'Contratti_' + new Date().toISOString().split('T')[0] + '.xlsx';
  XLSX.writeFile(wb, nome);
  
  toast('✅ Excel esportato', 'success');
}
