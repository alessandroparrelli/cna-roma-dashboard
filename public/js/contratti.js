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
  ['contratti', 'anagrafiche', 'diretti', 'join'].forEach(function(t) {
    contrattiSetStatus(t, 0, null);
  });
  
  contrattiSetProgress(0, 'Connessione a Supabase…');
  
  try {
    // STEP 1 — Solo i contratti attivi
    contrattiSetProgress(10, 'Caricamento contratti…');
    contrattiSetStatus('contratti', 10, null);

    var contratti = await contrattisFetchAll('contrattiservizio?datadisdetta=is.null');
    contrattiSetStatus('contratti', 100, 'done');
    contrattiSetProgress(30, 'Contratti caricati…');

    // Ricava lista codici cliente unici
    var codiciClienteSet = {};
    contratti.forEach(function(c) { if (c.codicecliente) codiciClienteSet[c.codicecliente] = true; });
    var codiciClienteList = Object.keys(codiciClienteSet);

    if (codiciClienteList.length === 0) {
      contrattiAll = [];
      contrattiFiltered = [];
      contrattiRender();
      contrattiLoaded = true;
      setTimeout(function() {
        G('contratti-loader').classList.remove('active');
        G('contratti-content').style.display = 'block';
      }, 300);
      return;
    }

    // STEP 2 — Anagrafiche: tutta la tabella ma solo i campi necessari (leggera)
    contrattiSetProgress(40, 'Caricamento anagrafiche…');
    contrattiSetStatus('anagrafiche', 40, null);

    var anagrafiche = await contrattisFetchAll('Anagrafiche?select=codiceanagrafica,ragionesociale,partitaiva,comune,provincia,codiceateco');
    contrattiSetStatus('anagrafiche', 100, 'done');

    // Mappe
    var anaMap = {};
    anagrafiche.forEach(function(a) { anaMap[a.codiceanagrafica] = a; });

    // Ricava codici ateco e partite IVA
    var atecoSet = {}, pivaSet = {}, codiciAnaSet = {};
    anagrafiche.forEach(function(a) {
      if (a.codiceateco) atecoSet[String(a.codiceateco).trim()] = true;
      if (a.partitaiva)  pivaSet[a.partitaiva] = true;
      codiciAnaSet[a.codiceanagrafica] = true;
    });
    var atecoList   = Object.keys(atecoSet);
    var pivaList    = Object.keys(pivaSet);
    var codiciAnaList = Object.keys(codiciAnaSet);

    // STEP 3 — CCIAA + Diretti + Codiciateco in parallelo, tutti filtrati
    contrattiSetProgress(55, 'Caricamento dati aggiuntivi…');
    contrattiSetStatus('cciaa', 55, null);
    contrattiSetStatus('diretti', 55, null);

    var fetchCciaa = pivaList.length > 0
      ? fetch(SB + '/rest/v1/cciaa?select=partita_iva,art_com_tur,num_addetti_sub,num_addetti_fam_ul&partita_iva=in.(' + pivaList.join(',') + ')', { headers: H() })
          .then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
      : Promise.resolve([]);

    var fetchDiretti = codiciAnaList.length > 0
      ? fetch(SB + '/rest/v1/diretti?select=codiceanagrafica,servizio&codiceanagrafica=in.(' + codiciAnaList.join(',') + ')', { headers: H() })
          .then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
      : Promise.resolve([]);

    var fetchAteco = atecoList.length > 0
      ? fetch(SB + '/rest/v1/codiciateco?select=codiceateco,mestiere&codiceateco=in.(' + atecoList.join(',') + ')', { headers: H() })
          .then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
      : Promise.resolve([]);

    var results2 = await Promise.all([fetchCciaa, fetchDiretti, fetchAteco]);
    var cciaaAll = results2[0];
    var diretti  = results2[1];
    var atecoAll = results2[2];

    contrattiSetStatus('cciaa', 100, 'done');
    contrattiSetStatus('diretti', 100, 'done');
    contrattiSetProgress(80, 'Unificazione dati…');
    contrattiSetStatus('join', 80, null);

    // Mappe
    var cciaaMap = {};
    cciaaAll.forEach(function(cc) { if (cc.partita_iva) cciaaMap[cc.partita_iva] = cc; });

    var atecoMap = {};
    atecoAll.forEach(function(a) { if (a.codiceateco) atecoMap[String(a.codiceateco).trim()] = a.mestiere || ''; });

    var iscritti = {}, inps = {};
    diretti.forEach(function(d) {
      if (!d.servizio) return;
      var srv = String(d.servizio).trim().toUpperCase();
      if (srv === 'ISCRITTO')          iscritti[d.codiceanagrafica] = true;
      if (srv === 'TESSERAMENTO INPS') inps[d.codiceanagrafica]     = true;
    });

    // Build impreseMap
    var impreseMap = {};
    contratti.forEach(function(c) {
      var ana = anaMap[c.codicecliente];
      if (!ana) return;

      var cciaa  = cciaaMap[ana.partitaiva] || null;
      var addSub = cciaa ? (parseInt(cciaa.num_addetti_sub)      || 0) : 0;
      var addFam = cciaa ? (parseInt(cciaa.num_addetti_fam_ul)   || 0) : 0;
      var tipoImp = '';
      if (cciaa && cciaa.art_com_tur) {
        var tc = String(cciaa.art_com_tur).toUpperCase();
        tipoImp = tc === 'A' ? 'Artigiana' : tc === 'C' ? 'Commerciante' : 'Varie';
      }

      if (!impreseMap[c.codicecliente]) {
        var mestiere = atecoMap[String(ana.codiceateco || '').trim()] || '';
        impreseMap[c.codicecliente] = {
          partitaiva:     ana.partitaiva,
          ragionesociale: ana.ragionesociale,
          codicecliente:  c.codicecliente,
          comune:         ana.comune,
          provincia:      ana.provincia,
          mestiere:       mestiere,
          iscritto:       iscritti[ana.codiceanagrafica] || false,
          inps:           inps[ana.codiceanagrafica]     || false,
          tipoimpresa:    tipoImp,
          addetti_sub:    addSub,
          addetti_fam:    addFam,
          totale_addetti: addSub + addFam,
          servizi: {}
        };
      }

      // Per ogni tipo contratto mantieni il più recente
      var dataC    = c.datastipulacontratto ? new Date(c.datastipulacontratto) : new Date(0);
      var existing = impreseMap[c.codicecliente].servizi[c.tipocontratto];
      if (!existing || dataC > new Date(existing.data || 0)) {
        impreseMap[c.codicecliente].servizi[c.tipocontratto] = {
          data:      c.datastipulacontratto || null,
          consulente: c.nomeconsulente || ''
        };
      }
    });

    // Converte in array e ordina
    contrattiAll = Object.values(impreseMap);
    contrattiAll.sort(function(a, b) {
      return (a.ragionesociale || '').localeCompare(b.ragionesociale || '');
    });

    contrattiFiltered = contrattiAll.slice();
    contrattiSelected.clear();

    // Set servizi per filtro dropdown
    var serviziSet = {};
    contrattiAll.forEach(function(r) {
      Object.keys(r.servizi || {}).forEach(function(s) { serviziSet[s] = true; });
    });
    
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
  // Separa nome tabella da eventuali filtri già presenti
  var parts = table.split('?');
  var tableName = parts[0];
  var extraFilter = parts[1] || '';
  var baseUrl = SB + '/rest/v1/' + tableName;
  while (true) {
    var url = baseUrl + '?select=*&offset=' + offset + '&limit=' + size;
    if (extraFilter) url += '&' + extraFilter;
    contrattiSetStatus(tableName, all.length, 'loading');
    var r = await fetch(url, { headers: H() });
    if (!r.ok) throw new Error(tableName + ': HTTP ' + r.status);
    var rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      contrattiSetStatus(tableName, all.length, 'done');
      break;
    }
    all = all.concat(rows);
    offset += size;
    if (rows.length < size) {
      contrattiSetStatus(tableName, all.length, 'done');
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

  var totalPages = Math.max(1, Math.ceil(contrattiFiltered.length / contrattiPageSize));
  if (contrattiPage >= totalPages) contrattiPage = 0;

  var tb = G('contratti-tbody');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="20" class="ana-empty">Nessun record trovato</td></tr>';
    contrattiUpdateSelCount();
    var pag = G('contratti-pagination');
    if (pag) pag.style.display = 'none';
    return;
  }
  
  // Lista servizi ordinata (da tutti i record)
  var servizi = [];
  Object.keys(contrattiAll.reduce(function(acc, r) {
    Object.keys(r.servizi || {}).forEach(function(s) { acc[s] = true; });
    return acc;
  }, {})).sort().forEach(function(s) { servizi.push(s); });
  
  // Header: colonne fisse + per ogni servizio [Servizio | Data Stipula | Consulente] + Iscritto + INPS + TOT
  var thead = G('contratti-table').querySelector('thead tr');
  if (thead) {
    var thHTML = '<th class="col-check"><input type="checkbox" id="contratti-selall"></th>';
    thHTML += '<th>Partita IVA</th>';
    thHTML += '<th>Ragione Sociale</th>';
    thHTML += '<th>Codice Cliente</th>';
    thHTML += '<th>Comune</th>';
    thHTML += '<th>Provincia</th>';
    thHTML += '<th>Mestiere</th>';
    thHTML += '<th>Tipo Impresa</th>';
    thHTML += '<th style="text-align:center">Dip.<br>Sub.</th>';
    thHTML += '<th style="text-align:center">Dip.<br>Fam.</th>';
    thHTML += '<th style="text-align:center;background:#E8F0FE;border-left:2px solid #005CA9">Tot.<br>Dip.</th>';
    servizi.forEach(function(s) {
      thHTML += '<th style="text-align:center;border-left:1px solid #ddd">' + s + '</th>';
      thHTML += '<th style="text-align:center;font-size:11px;color:#666">Data Stipula<br><em style="font-weight:400">' + s + '</em></th>';
      thHTML += '<th style="font-size:11px;color:#666">Consulente<br><em style="font-weight:400">' + s + '</em></th>';
    });
    thHTML += '<th>Iscritto</th>';
    thHTML += '<th>INPS</th>';
    thHTML += '<th style="text-align:center;font-weight:700;color:#005CA9">TOT</th>';
    thead.innerHTML = thHTML;
    var newSelAll = thead.querySelector('#contratti-selall');
    if (newSelAll) newSelAll.addEventListener('change', contrattiToggleAll);
  }

  // Slice pagina
  var start = contrattiPage * contrattiPageSize;
  var end   = Math.min(start + contrattiPageSize, contrattiFiltered.length);
  var pageRows = contrattiFiltered.slice(start, end);
  
  var html = [];
  for (var i = 0; i < pageRows.length; i++) {
    var globalIdx = start + i;
    var r = pageRows[i];
    var sel = contrattiSelected.has(globalIdx) ? ' class="selected"' : '';
    var chk = contrattiSelected.has(globalIdx) ? ' checked' : '';
    
    var tipoBg = r.tipoimpresa === 'Artigiana' ? '#FEE2E2' : r.tipoimpresa === 'Commerciante' ? '#FEF3C7' : r.tipoimpresa ? '#FFEDD5' : '';
    var tipoCol = r.tipoimpresa === 'Artigiana' ? '#B91C1C' : r.tipoimpresa === 'Commerciante' ? '#92400E' : '#9A3412';

    html.push('<tr' + sel + ' data-idx="' + globalIdx + '">');
    html.push('<td class="col-check"><input type="checkbox" data-idx="' + globalIdx + '"' + chk + '></td>');
    html.push('<td>' + (r.partitaiva || '-') + '</td>');
    html.push('<td><strong>' + (r.ragionesociale || '-') + '</strong></td>');
    html.push('<td>' + (r.codicecliente || '-') + '</td>');
    html.push('<td>' + (r.comune || '-') + '</td>');
    html.push('<td>' + (r.provincia || '-') + '</td>');
    html.push('<td>' + (r.mestiere || '-') + '</td>');
    html.push('<td style="font-size:11px;font-weight:700;text-align:center;' + (r.tipoimpresa ? 'background:' + tipoBg + ';color:' + tipoCol : 'color:#999') + '">' + (r.tipoimpresa || '-') + '</td>');
    html.push('<td style="text-align:center">' + (r.addetti_sub > 0 ? r.addetti_sub : '-') + '</td>');
    html.push('<td style="text-align:center">' + (r.addetti_fam > 0 ? r.addetti_fam : '-') + '</td>');
    html.push('<td style="text-align:center;font-weight:700;color:#005CA9;background:#E8F0FE;border-left:2px solid #005CA9">' + (r.totale_addetti > 0 ? r.totale_addetti : '-') + '</td>');
    
    var conteggio = 0;
    servizi.forEach(function(srv) {
      var c = r.servizi && r.servizi[srv];
      if (c) {
        conteggio++;
        var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '-';
        html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#10B981;border-left:1px solid #ddd;border-radius:3px">Attivo</td>');
        html.push('<td style="text-align:center;font-size:12px;white-space:nowrap">' + dataStr + '</td>');
        html.push('<td style="font-size:12px">' + (c.consulente || '-') + '</td>');
      } else {
        html.push('<td style="text-align:center;color:#ddd;border-left:1px solid #ddd">–</td>');
        html.push('<td></td>');
        html.push('<td></td>');
      }
    });
    
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9">' + (r.iscritto ? 'X' : '') + '</td>');
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9">' + (r.inps ? 'X' : '') + '</td>');
    if (r.iscritto) conteggio++;
    if (r.inps) conteggio++;
    html.push('<td style="text-align:center;font-weight:bold;color:#005CA9;background:#F0F4FF;border-left:2px solid #005CA9">' + conteggio + '</td>');
    html.push('</tr>');
  }
  
  tb.innerHTML = html.join('');
  contrattiUpdateSelCount();
  G('contratti-count').textContent = contrattiFiltered.length + ' imprese';

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
  
  // Riga 2: Header — per ogni servizio: Servizio | Data Stipula Servizio | Consulente Servizio
  var headerRow = ['PARTITA IVA', 'RAGIONE SOCIALE', 'CODICE CLIENTE', 'COMUNE', 'PROVINCIA', 'MESTIERE', 'TIPO IMPRESA', 'DIP. SUBORDINATI', 'DIP. FAMILIARI', 'TOT. DIPENDENTI'];
  servizi.forEach(function(s) {
    headerRow.push(s);
    headerRow.push('DATA STIPULA ' + s.toUpperCase());
    headerRow.push('CONSULENTE ' + s.toUpperCase());
  });
  headerRow.push('ISCRITTO', 'TESSERAMENTO INPS', 'NUMERO SERVIZI ACQUISTATI');
  wsData.push(headerRow);
  
  // Dati
  var indices = Array.from(contrattiSelected).sort(function(a, b) { return a - b; });
  indices.forEach(function(i) {
    var r = contrattiFiltered[i];
    var row = [
      r.partitaiva || '',
      r.ragionesociale || '',
      r.codicecliente || '',
      r.comune || '',
      r.provincia || '',
      r.mestiere || '',
      r.tipoimpresa || '',
      r.addetti_sub > 0 ? r.addetti_sub : '',
      r.addetti_fam > 0 ? r.addetti_fam : '',
      r.totale_addetti > 0 ? r.totale_addetti : ''
    ];
    
    var conteggio = 0;
    servizi.forEach(function(srv) {
      var c = r.servizi && r.servizi[srv];
      if (c) {
        conteggio++;
        var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '';
        row.push('Attivo');
        row.push(dataStr);
        row.push(c.consulente || '');
      } else {
        row.push('');
        row.push('');
        row.push('');
      }
    });
    
    if (r.iscritto) conteggio++;
    if (r.inps) conteggio++;
    row.push(r.iscritto ? 'X' : '');
    row.push(r.inps ? 'X' : '');
    row.push(conteggio);
    
    wsData.push(row);
  });
  
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // --- MERGE TITOLO ---
  // 10 colonne base + (servizi × 3) + 3 (iscritto, inps, tot)
  var colCount = 10 + (servizi.length * 3) + 3;
  ws['!merges'] = [{s: {r: 0, c: 0}, e: {r: 0, c: colCount - 1}}];
  
  // --- COLONNE LARGHEZZE ---
  var colWidths = [12.16, 50, 14, 16, 10, 40, 16, 14, 14, 14];
  servizi.forEach(function() { colWidths.push(20, 14, 30); }); // X | Data | Consulente
  colWidths.push(12, 18, 12);
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
