var contrattiAll = [];
var contrattiFiltered = [];
var contrattiSelected = new Set();
var contrattiLoaded = false;
var contrattiLoading = false;
var contrattiPage = 0;         // pagina corrente (0-based)
var contrattiPageSize = 50;    // record per pagina

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
  ['contratti', 'anagrafiche', 'cciaa', 'diretti', 'join'].forEach(function(t) {
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
    
    // Carica Diretti e CCIAA in parallelo
    contrattiSetProgress(60, 'Caricamento Diretti e CCIAA…');
    contrattiSetStatus('diretti', 60, null);
    contrattiSetStatus('cciaa', 60, null);

    var results = await Promise.all([
      contrattisFetchAll('diretti?select=codiceanagrafica,servizio'),
      contrattisFetchAll('cciaa?select=partita_iva,art_com_tur,num_addetti_sub,num_addetti_fam_ul')
    ]);
    var diretti  = results[0];
    var cciaaAll = results[1];

    contrattiSetStatus('diretti', 100, 'done');
    contrattiSetStatus('cciaa', 100, 'done');

    // Mappa CCIAA per partita_iva
    var cciaaMap = {};
    cciaaAll.forEach(function(cc) {
      if (cc.partita_iva) cciaaMap[String(cc.partita_iva).trim()] = cc;
    });
    
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
    
    console.log('CCIAA trovati:', Object.keys(cciaaMap).length);
    
    contratti.forEach(function(c) {
      var ana = anaMap[c.codicecliente];
      if (!ana) return;

      // Dati CCIAA per questa impresa
      var piva  = String(ana.partitaiva || '').trim();
      var cciaa = cciaaMap[piva] || null;
      var addSub  = cciaa ? (parseInt(cciaa.num_addetti_sub)    || 0) : 0;
      var addFam  = cciaa ? (parseInt(cciaa.num_addetti_fam_ul) || 0) : 0;
      var tipoImp = '';
      if (cciaa && cciaa.art_com_tur) {
        var tc = String(cciaa.art_com_tur).trim().toUpperCase();
        tipoImp = tc === 'A' ? 'Artigiano' : tc === 'C' ? 'Commerciante' : 'Varie';
      }

      if (!impreseMap[c.codicecliente]) {
        impreseMap[c.codicecliente] = {
          partitaiva:     ana.partitaiva,
          ragionesociale: ana.ragionesociale,
          codicecliente:  c.codicecliente,
          comune:         ana.comune,
          provincia:      ana.provincia,
          mestiere:       ana.mestiere,
          email:          ana.email,
          telefono:       ana.telefono,
          iscritto:       iscritti[ana.codiceanagrafica] || false,
          inps:           inps[ana.codiceanagrafica]     || false,
          tipoimpresa:    tipoImp,
          addetti_sub:    addSub,
          addetti_fam:    addFam,
          totale_addetti: addSub + addFam,
          servizi: {}
        };
      }
      // Aggiunge servizio — mantieni il contratto più recente per tipo
      var dataC    = c.datastipulacontratto ? new Date(c.datastipulacontratto) : new Date(0);
      var existing = impreseMap[c.codicecliente].servizi[c.tipocontratto];
      if (!existing || dataC > new Date(existing.data || 0)) {
        impreseMap[c.codicecliente].servizi[c.tipocontratto] = {
          data:      c.datastipulacontratto || null,
          consulente: c.nomeconsulente || ''
        };
      }
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
    contrattiRenderKPI();
    
    contrattiLoaded = true;
    
    setTimeout(function() {
      G('contratti-loader').classList.remove('active');
      G('contratti-content').style.display = 'block';
      if(window.reInitFiltersToggle) reInitFiltersToggle();
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

  // Reset alla prima pagina quando cambia il filtro
  var totalPages = Math.max(1, Math.ceil(contrattiFiltered.length / contrattiPageSize));
  if (contrattiPage >= totalPages) contrattiPage = 0;

  var tb = G('contratti-tbody');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="24" class="ana-empty">Nessun record trovato</td></tr>';
    contrattiUpdateSelCount();
    var pag = G('contratti-pagination');
    if (pag) pag.style.display = 'none';
    return;
  }
  
  // Lista servizi per le colonne
  var servizi = [];
  Object.keys(contrattiAll.reduce(function(acc, r) {
    Object.keys(r.servizi || {}).forEach(function(s) { acc[s] = true; });
    return acc;
  }, {})).sort().forEach(function(s) { servizi.push(s); });
  
  // Aggiorna header — ricostruisce dinamicamente le colonne servizi (3 per servizio)
  var thead = G('contratti-table').querySelector('thead tr');
  if (thead) {
    // Rimuovi tutto dopo la th Tot.Dip. (indice 14) e prima di TOT (ultimo)
    var thList = Array.from(thead.querySelectorAll('th'));
    var totTh = thList[thList.length - 1];
    for (var j = thList.length - 2; j >= 15; j--) {
      thList[j].parentNode.removeChild(thList[j]);
    }
    // Inserisci 3 th per ogni servizio prima di TOT
    servizi.forEach(function(s) {
      var th1 = document.createElement('th');
      th1.textContent = s;
      th1.style.cssText = 'text-align:center;border-left:2px solid #ddd';
      var th2 = document.createElement('th');
      th2.style.cssText = 'font-size:11px;color:#666;text-align:center';
      th2.innerHTML = 'Data<br><small>' + s + '</small>';
      var th3 = document.createElement('th');
      th3.style.cssText = 'font-size:11px;color:#666';
      th3.innerHTML = 'Consulente<br><small>' + s + '</small>';
      totTh.parentNode.insertBefore(th1, totTh);
      totTh.parentNode.insertBefore(th2, totTh);
      totTh.parentNode.insertBefore(th3, totTh);
    });
  }

  // Slice della pagina corrente
  var start = contrattiPage * contrattiPageSize;
  var end   = Math.min(start + contrattiPageSize, contrattiFiltered.length);
  var pageRows = contrattiFiltered.slice(start, end);
  
  var html = [];
  for (var i = 0; i < pageRows.length; i++) {
    var globalIdx = start + i;
    var r = pageRows[i];
    var sel = contrattiSelected.has(globalIdx) ? ' class="selected"' : '';
    var chk = contrattiSelected.has(globalIdx) ? ' checked' : '';
    
    html.push('<tr' + sel + ' data-idx="' + globalIdx + '">');
    html.push('<td class="col-check"><input type="checkbox" data-idx="' + globalIdx + '"' + chk + '></td>');
    html.push('<td>' + (r.partitaiva || '-') + '</td>');
    html.push('<td>' + (r.ragionesociale || '-') + '</td>');
    html.push('<td>' + (r.codicecliente || '-') + '</td>');
    html.push('<td>' + (r.comune || '-') + '</td>');
    html.push('<td>' + (r.provincia || '-') + '</td>');
    html.push('<td>' + (r.mestiere || '-') + '</td>');
    html.push('<td>' + (r.email || '-') + '</td>');
    html.push('<td>' + (r.telefono || '-') + '</td>');
    
    var conteggio = 0;
    
    html.push('<td style="text-align:center;font-size:11px;font-weight:700;' + (r.iscritto ? 'color:#fff;background:#10B981' : '') + '">' + (r.iscritto ? 'Attivo' : '') + '</td>');
    html.push('<td style="text-align:center;font-size:11px;font-weight:700;' + (r.inps ? 'color:#fff;background:#10B981' : '') + '">' + (r.inps ? 'Attivo' : '') + '</td>');
    if (r.iscritto) conteggio++;
    if (r.inps) conteggio++;

    // Tipo impresa
    var tipoBg  = r.tipoimpresa === 'Artigiano' ? '#FEE2E2' : r.tipoimpresa === 'Commerciante' ? '#FEF3C7' : r.tipoimpresa ? '#FFEDD5' : '';
    var tipoCol = r.tipoimpresa === 'Artigiano' ? '#B91C1C' : r.tipoimpresa === 'Commerciante' ? '#92400E' : '#9A3412';
    html.push('<td style="text-align:center;font-size:11px;font-weight:700;' + (r.tipoimpresa ? 'background:' + tipoBg + ';color:' + tipoCol : 'color:#999') + '">' + (r.tipoimpresa || '-') + '</td>');
    // Dipendenti
    html.push('<td style="text-align:center">' + (r.addetti_sub > 0 ? r.addetti_sub : '-') + '</td>');
    html.push('<td style="text-align:center">' + (r.addetti_fam > 0 ? r.addetti_fam : '-') + '</td>');
    html.push('<td style="text-align:center;font-weight:700;color:#005CA9;background:#E8F0FE;border-left:2px solid #005CA9">' + (r.totale_addetti > 0 ? r.totale_addetti : '-') + '</td>');
    
    servizi.forEach(function(srv) {
      var c = r.servizi && r.servizi[srv];
      if (c) {
        conteggio++;
        var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '-';
        html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#10B981;border-left:2px solid #ddd">Attivo</td>');
        html.push('<td style="text-align:center;font-size:12px;white-space:nowrap">' + dataStr + '</td>');
        html.push('<td style="font-size:12px">' + (c.consulente || '-') + '</td>');
      } else {
        html.push('<td style="border-left:2px solid #ddd"></td><td></td><td></td>');
      }
    });
    
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9;background:#F0F4FF;border-left:2px solid #005CA9">' + conteggio + '</td>');
    html.push('</tr>');
  }
  
  tb.innerHTML = html.join('');
  contrattiUpdateSelCount();
  G('contratti-count').textContent = contrattiFiltered.length + ' imprese';

  // ── Paginazione ──
  contrattiRenderPagination(totalPages, start, end);
}

function contrattiRenderPagination(totalPages, start, end) {
  var pag = G('contratti-pagination');
  var info = G('contratti-pag-info');
  var btns = G('contratti-pag-buttons');
  if (!pag || !info || !btns) return;

  pag.style.display = totalPages > 1 ? 'flex' : 'none';

  // Info testo
  info.textContent = 'Mostrati ' + (start + 1) + '–' + end + ' di ' + contrattiFiltered.length + ' imprese';

  // CSS bottoni (iniettato una sola volta)
  if (!document.getElementById('pag-style')) {
    var s = document.createElement('style');
    s.id = 'pag-style';
    s.textContent = [
      '.pag-btn{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:#fff;color:var(--text);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;}',
      '.pag-btn:hover:not(:disabled){background:#EFF6FF;border-color:#005CA9;color:#005CA9;}',
      '.pag-btn.active{background:#005CA9;border-color:#005CA9;color:#fff;}',
      '.pag-btn:disabled{opacity:.35;cursor:default;}',
      'body.dark-mode .pag-btn{background:var(--surface);color:var(--text);}',
      'body.dark-mode .pag-btn:hover:not(:disabled){background:var(--surface2);}',
    ].join('');
    document.head.appendChild(s);
  }

  var html = '';
  var cur = contrattiPage;

  // Prima
  html += '<button class="pag-btn" onclick="contrattiGoPage(0)" ' + (cur === 0 ? 'disabled' : '') + ' title="Prima pagina">«</button>';
  // Precedente
  html += '<button class="pag-btn" onclick="contrattiGoPage(' + (cur - 1) + ')" ' + (cur === 0 ? 'disabled' : '') + ' title="Precedente">‹</button>';

  // Numeri pagina — finestra scorrevole di max 7 pagine
  var winStart = Math.max(0, Math.min(cur - 3, totalPages - 7));
  var winEnd   = Math.min(totalPages, winStart + 7);

  if (winStart > 0) {
    html += '<button class="pag-btn" onclick="contrattiGoPage(0)">1</button>';
    if (winStart > 1) html += '<span style="padding:0 4px;color:var(--text-secondary);font-size:12px">…</span>';
  }
  for (var p = winStart; p < winEnd; p++) {
    html += '<button class="pag-btn' + (p === cur ? ' active' : '') + '" onclick="contrattiGoPage(' + p + ')">' + (p + 1) + '</button>';
  }
  if (winEnd < totalPages) {
    if (winEnd < totalPages - 1) html += '<span style="padding:0 4px;color:var(--text-secondary);font-size:12px">…</span>';
    html += '<button class="pag-btn" onclick="contrattiGoPage(' + (totalPages - 1) + ')">' + totalPages + '</button>';
  }

  // Successiva
  html += '<button class="pag-btn" onclick="contrattiGoPage(' + (cur + 1) + ')" ' + (cur >= totalPages - 1 ? 'disabled' : '') + ' title="Successiva">›</button>';
  // Ultima
  html += '<button class="pag-btn" onclick="contrattiGoPage(' + (totalPages - 1) + ')" ' + (cur >= totalPages - 1 ? 'disabled' : '') + ' title="Ultima pagina">»</button>';

  btns.innerHTML = html;
}

function contrattiGoPage(p) {
  var totalPages = Math.ceil(contrattiFiltered.length / contrattiPageSize);
  contrattiPage = Math.max(0, Math.min(p, totalPages - 1));
  contrattiRender();
  // Scroll alla tabella
  var tw = G('contratti-table');
  if (tw) tw.closest('.table-wrap').scrollTop = 0;
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
  
  // Riga 2: Header — Iscritto e INPS prima, poi per ogni servizio: Servizio | Data | Consulente
  var headerRow = ['PARTITA IVA', 'RAGIONE SOCIALE', 'CODICE CLIENTE', 'COMUNE', 'PROVINCIA', 'MESTIERE', 'EMAIL', 'TELEFONO', 'TIPO IMPRESA', 'DIP. SUBORDINATI', 'DIP. FAMILIARI', 'TOT. DIPENDENTI', 'ISCRITTO', 'TESSERAMENTO INPS'];
  servizi.forEach(function(s) {
    headerRow.push(s);
    headerRow.push('DATA STIPULA ' + s.toUpperCase());
    headerRow.push('CONSULENTE ' + s.toUpperCase());
  });
  headerRow.push('NUMERO SERVIZI ACQUISTATI');
  wsData.push(headerRow);
  
  // Dati
  var indices = Array.from(contrattiSelected).sort(function(a, b) { return a - b; });
  indices.forEach(function(i) {
    var r = contrattiFiltered[i];
    var row = [r.partitaiva || '', r.ragionesociale || '', r.codicecliente || '', r.comune || '', r.provincia || '', r.mestiere || '', r.email || '', r.telefono || '',
               r.tipoimpresa || '', r.addetti_sub || '', r.addetti_fam || '', r.totale_addetti || ''];
    
    var conteggio = 0;
    row.push(r.iscritto ? 'Attivo' : '');
    row.push(r.inps ? 'Attivo' : '');
    if (r.iscritto) conteggio++;
    if (r.inps) conteggio++;

    servizi.forEach(function(srv) {
      var c = r.servizi && r.servizi[srv];
      if (c) {
        conteggio++;
        var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '';
        row.push('Attivo');
        row.push(dataStr);
        row.push(c.consulente || '');
      } else {
        row.push('', '', '');
      }
    });
    
    row.push(conteggio);
    wsData.push(row);
  });
  
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // --- MERGE TITOLO ---
  var colCount = 14 + (servizi.length * 3) + 1;
  ws['!merges'] = [{s: {r: 0, c: 0}, e: {r: 0, c: colCount - 1}}];
  
  // --- COLONNE LARGHEZZE ---
  var colWidths = [12.16, 60.83, 14.33, 19.33, 10.33, 40, 35, 18, 16, 14, 14, 14, 12, 18];
  servizi.forEach(function() { colWidths.push(25, 14, 30); });
  colWidths.push(22);
  ws['!cols'] = colWidths.map(function(w) { return {wch: w}; });
  
  // --- FORMATTAZIONE ---

  // Riga 1: TITOLO
  ws['A1'].s = {
    font: {name: 'Calibri', bold: true, sz: 22, color: {rgb: 'FFFFFFFF'}},
    fill: {patternType: 'solid', fgColor: {rgb: 'FF005CA9'}},
    alignment: {horizontal: 'left', vertical: 'center'}
  };

  // Righe 1 e 2: intestazione blu CNA, Calibri 12 bold centrato
  for (var col = 0; col < colCount; col++) {
    // Riga 1 (titolo) — celle oltre A1 vanno comunque colorate per il merge visivo
    var r1ref = XLSX.utils.encode_col(col) + '1';
    if (!ws[r1ref]) ws[r1ref] = {v: ''};
    if (r1ref !== 'A1') {
      ws[r1ref].s = {
        fill: {patternType: 'solid', fgColor: {rgb: 'FF005CA9'}},
        font: {name: 'Calibri', sz: 12, color: {rgb: 'FFFFFFFF'}}
      };
    }

    // Riga 2 (header colonne)
    var r2ref = XLSX.utils.encode_col(col) + '2';
    if (!ws[r2ref]) ws[r2ref] = {v: headerRow[col] || ''};
    ws[r2ref].s = {
      font: {name: 'Calibri', bold: true, sz: 12, color: {rgb: 'FFFFFFFF'}},
      fill: {patternType: 'solid', fgColor: {rgb: 'FF005CA9'}},
      alignment: {horizontal: 'center', vertical: 'center', wrapText: true},
      border: {
        left:   {style: 'thin', color: {rgb: 'FFFFFFFF'}},
        right:  {style: 'thin', color: {rgb: 'FFFFFFFF'}},
        top:    {style: 'thin', color: {rgb: 'FFFFFFFF'}},
        bottom: {style: 'thin', color: {rgb: 'FFFFFFFF'}}
      }
    };
  }

  // Righe dati: Calibri 11, righe alternate bianco / grigio chiarissimo
  var colorePari   = 'FFF2F2F2'; // grigio molto chiaro
  var coloreDispari = 'FFFFFFFF'; // bianco
  for (var dataRow = 3; dataRow <= wsData.length; dataRow++) {
    var isGrigio = (dataRow % 2 === 0); // righe pari → grigio, dispari → bianco
    var bgColor = isGrigio ? colorePari : coloreDispari;
    for (var dataCol = 0; dataCol < colCount; dataCol++) {
      var dataCellRef = XLSX.utils.encode_col(dataCol) + dataRow;
      if (!ws[dataCellRef]) ws[dataCellRef] = {v: ''};
      ws[dataCellRef].s = {
        font: {name: 'Calibri', sz: 11},
        fill: {patternType: 'solid', fgColor: {rgb: bgColor}},
        alignment: {horizontal: 'left', vertical: 'center'}
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

// ── KPI STRIP CONTRATTI ──
function contrattiRenderKPI() {
  var strip = G('contratti-kpi-strip');
  if (!strip) return;

  var totale = contrattiAll.length;
  var serviziCount = {};
  contrattiAll.forEach(function(r) {
    Object.keys(r.servizi || {}).forEach(function(srv) {
      serviziCount[srv] = (serviziCount[srv] || 0) + 1;
    });
  });
  var serviziOrdinati = Object.keys(serviziCount).sort();

  // Inietta CSS una sola volta
  if (!document.getElementById('ck-grid-style')) {
    var s = document.createElement('style');
    s.id = 'ck-grid-style';
    s.textContent = [
      '.ck-grid{',
        'display:grid;',
        'grid-template-columns:repeat(auto-fit,minmax(120px,1fr));',
        'gap:1px;background:var(--border);',
        'border:1px solid var(--border);border-radius:var(--radius-xl);',
        'overflow:hidden;box-shadow:var(--shadow-glass);margin-bottom:0;width:100%;',
      '}',
      '.ck-cell{',
        'background:#fff;padding:14px 12px 14px;',
        'display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:8px;',
        'transition:all .2s cubic-bezier(0.4,0,0.2,1);cursor:default;',
        'text-align:center;min-height:90px;',
      '}',
      'body.dark-mode .ck-cell{background:var(--surface);}',
      '.ck-cell:hover{',
        'background:#fff;',
        'box-shadow:0 4px 20px rgba(0,92,169,.15);',
        'transform:translateY(-2px);z-index:2;position:relative;',
        'border-radius:var(--radius-md);',
      '}',
      'body.dark-mode .ck-cell:hover{background:var(--surface2);}',
      '.ck-cell-label{',
        'font-family:var(--font-display);font-size:13px;font-weight:700;',
        'color:var(--primary);text-transform:none;letter-spacing:0;',
        'text-align:center;line-height:1.35;',
        'word-break:normal;overflow-wrap:break-word;hyphens:auto;',
        'width:100%;',
      '}',
      '.ck-cell-num{',
        'font-family:var(--font-display);font-size:32px;font-weight:800;',
        'color:var(--text);letter-spacing:-0.04em;line-height:1;',
        'font-variant-numeric:tabular-nums;',
        'width:100%;text-align:center;',
      '}',
      '@keyframes ckPop{0%{transform:scale(.88);opacity:.4}65%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}',
      '.ck-cell-num.popped{animation:ckPop .38s cubic-bezier(0.34,1.56,0.64,1) forwards;}',
    ].join('');
    document.head.appendChild(s);
  }

  // Costruisce la griglia
  var html = '<div class="ck-grid">';

  // Cella Totale
  html += '<div class="ck-cell">' +
    '<div class="ck-cell-label">Imprese con contratti attivi</div>' +
    '<div class="ck-cell-num" id="ck-totale">–</div>' +
    '</div>';

  // Una cella per ogni tipocontratto
  serviziOrdinati.forEach(function(srv, i) {
    var label = srv.charAt(0).toUpperCase() + srv.slice(1).toLowerCase();
    html += '<div class="ck-cell">' +
      '<div class="ck-cell-label">' + label + '</div>' +
      '<div class="ck-cell-num" id="ck-' + i + '">–</div>' +
      '</div>';
  });

  html += '</div>';
  strip.innerHTML = html;
  strip.style.display = 'block';

  // CountUp
  homeCountUp('ck-totale', totale, false);
  serviziOrdinati.forEach(function(srv, i) {
    homeCountUp('ck-' + i, serviziCount[srv], false);
  });
}
