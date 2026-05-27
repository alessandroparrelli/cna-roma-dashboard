// ============================================================
//  INCASSI.JS  –  Tab Pagamenti / Incassi
//  Carica i dati dalla tabella `incassi` (join Anagrafiche),
//  mostra KPI, grafici e tabella filtrabile + export Excel.
// ============================================================

var incassiLoaded = false;
var incassiLoading = false;
var allIncassi = [];         // dati grezzi dal DB
var incassiFiltrati = [];    // dati filtrati correnti
var incassiCharts = {};      // istanze Chart.js
var incassiSortState = { col: 'data_pagamento', dir: 'desc' };
var incassiPage = 0;
var INCASSI_PAGE_SIZE = 50;

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────
async function incassiInit() {
  if (incassiLoading) return;
  if (incassiLoaded) { incassiRender(); return; }
  incassiLoading = true;
  showLoad('Caricamento incassi…');
  try {
    await incassiLoad();
  } catch(e) {
    toast('Errore caricamento incassi: ' + e.message, 'error');
  } finally {
    incassiLoading = false;
    hideLoad();
  }
}

async function incassiLoad(force) {
  if (incassiLoaded && !force) return;
  showLoad('Caricamento incassi…');

  // Carica tutti i record dalla tabella incassi
  var allRows = [];
  var from = 0;
  var CHUNK = 1000;
  while (true) {
    var url = SB + '/rest/v1/incassi?select=*&order=data_pagamento.desc&offset=' + from + '&limit=' + CHUNK;
    var resp = await fetch(url, { headers: H() });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var chunk = await resp.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allRows = allRows.concat(chunk);
    if (chunk.length < CHUNK) break;
    from += CHUNK;
  }

  allIncassi = allRows;
  incassiLoaded = true;

  incassiBuildFilters();
  incassiApply();
  hideLoad();
}

// ─────────────────────────────────────────────
//  FILTRI
// ─────────────────────────────────────────────
function incassiBuildFilters() {
  // Anno
  var anni = [...new Set(allIncassi.map(r => r.anno).filter(Boolean))].sort((a,b)=>b-a);
  var selAnno = G('inc-f-anno');
  if (selAnno) {
    var cur = selAnno.value;
    selAnno.innerHTML = '<option value="">Tutti gli anni</option>';
    anni.forEach(function(a) {
      selAnno.innerHTML += '<option value="' + a + '" ' + (cur==a?'selected':'') + '>' + a + '</option>';
    });
    // default all'anno più recente se nessuno selezionato
    if (!cur && anni.length > 0) selAnno.value = anni[0];
  }

  // Cassa
  var casse = [...new Set(allIncassi.map(r => r.cassa).filter(Boolean))].sort();
  var selCassa = G('inc-f-cassa');
  if (selCassa) {
    var curC = selCassa.value;
    selCassa.innerHTML = '<option value="">Tutte le casse</option>';
    casse.forEach(function(c) {
      selCassa.innerHTML += '<option value="' + escHtml(c) + '" ' + (curC==c?'selected':'') + '>' + escHtml(c) + '</option>';
    });
  }

  // Tipo doc az
  var tipi = [...new Set(allIncassi.map(r => r.tipo_doc_az).filter(Boolean))].sort();
  var selTipo = G('inc-f-tipo');
  if (selTipo) {
    var curT = selTipo.value;
    selTipo.innerHTML = '<option value="">Tutti i tipi</option>';
    tipi.forEach(function(t) {
      selTipo.innerHTML += '<option value="' + escHtml(t) + '" ' + (curT==t?'selected':'') + '>' + escHtml(t) + '</option>';
    });
  }
}

function incassiApply() {
  var anno   = (G('inc-f-anno')  || {}).value || '';
  var mese   = (G('inc-f-mese')  || {}).value || '';
  var cassa  = (G('inc-f-cassa') || {}).value || '';
  var tipo   = (G('inc-f-tipo')  || {}).value || '';
  var search = ((G('inc-f-search') || {}).value || '').trim().toLowerCase();

  incassiFiltrati = allIncassi.filter(function(r) {
    if (anno  && String(r.anno)  !== anno)  return false;
    if (mese  && String(r.mese)  !== mese)  return false;
    if (cassa && r.cassa         !== cassa) return false;
    if (tipo  && r.tipo_doc_az   !== tipo)  return false;
    if (search) {
      var hay = [r.codice_cliente, r.cliente, r.promotore, r.documento, r.compensazione]
                  .join(' ').toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });

  incassiPage = 0;
  incassiRender();
}

function incassiReset() {
  ['inc-f-anno','inc-f-mese','inc-f-cassa','inc-f-tipo','inc-f-search'].forEach(function(id) {
    var el = G(id);
    if (el) el.value = '';
  });
  incassiApply();
}

// ─────────────────────────────────────────────
//  RENDER PRINCIPALE
// ─────────────────────────────────────────────
function incassiRender() {
  incassiRenderKPI();
  incassiRenderCharts();
  incassiRenderTable();
}

// ─────────────────────────────────────────────
//  KPI CARDS
// ─────────────────────────────────────────────
function incassiRenderKPI() {
  var data = incassiFiltrati;
  var totale = data.reduce(function(s,r){ return s + (r.avere || 0); }, 0);
  var numPag = data.length;
  var clientiUnici = new Set(data.map(r => r.codice_cliente)).size;
  var mediaXCliente = clientiUnici > 0 ? totale / clientiUnici : 0;

  // Confronto mese precedente per freccia trend
  var annoSel = (G('inc-f-anno')||{}).value;
  var meseSel = (G('inc-f-mese')||{}).value;
  var trend = '';
  if (annoSel && meseSel) {
    var mPrev = parseInt(meseSel) - 1;
    var aPrev = parseInt(annoSel);
    if (mPrev === 0) { mPrev = 12; aPrev--; }
    var totPrev = allIncassi.filter(function(r){ return r.anno==aPrev && r.mese==mPrev; })
                            .reduce(function(s,r){ return s + (r.avere||0); }, 0);
    if (totPrev > 0) {
      var pct = ((totale - totPrev) / totPrev * 100).toFixed(1);
      trend = '<span style="font-size:12px;color:' + (pct>=0?'var(--green)':'var(--red)') + ';margin-left:6px">' +
              (pct>=0?'▲':'▼') + ' ' + Math.abs(pct) + '% vs mese prec.</span>';
    }
  }

  var el = G('inc-kpi-container');
  if (!el) return;
  el.innerHTML =
    kpiCard('💰', 'Totale Incassato', '€ ' + fmtNum(totale), trend, 'var(--blue)') +
    kpiCard('📄', 'N° Pagamenti', fmtInt(numPag), '', 'var(--accent2)') +
    kpiCard('🏢', 'Clienti unici', fmtInt(clientiUnici), '', 'var(--accent3)') +
    kpiCard('📊', 'Media per cliente', '€ ' + fmtNum(mediaXCliente), '', 'var(--green)');
}

function kpiCard(icon, label, value, extra, color) {
  return '<div class="inc-kpi-card" style="border-top:3px solid ' + color + '">' +
    '<div class="inc-kpi-icon" style="color:' + color + '">' + icon + '</div>' +
    '<div class="inc-kpi-body">' +
      '<div class="inc-kpi-label">' + label + '</div>' +
      '<div class="inc-kpi-value">' + value + extra + '</div>' +
    '</div>' +
  '</div>';
}

// ─────────────────────────────────────────────
//  GRAFICI
// ─────────────────────────────────────────────
function incassiRenderCharts() {
  incassiChartMensile();
  incassiChartCassa();
  incassiChartTipo();
  incassiChartTopClienti();
}

function incassiChartMensile() {
  var ctx = G('inc-chart-mensile');
  if (!ctx) return;

  // Aggrega per mese (da dati filtrati)
  var annoSel = (G('inc-f-anno')||{}).value || '';
  var source = annoSel ? incassiFiltrati : allIncassi.filter(r => r.anno == new Date().getFullYear());
  
  var byMese = {};
  source.forEach(function(r) {
    var k = (r.anno || '?') + '-' + String(r.mese || 0).padStart(2,'0');
    byMese[k] = (byMese[k] || 0) + (r.avere || 0);
  });

  var labels = Object.keys(byMese).sort();
  var values = labels.map(function(k){ return byMese[k]; });
  var nomi = labels.map(function(k){
    var parts = k.split('-');
    return MESI[parseInt(parts[1])] + ' ' + parts[0];
  });

  if (incassiCharts.mensile) incassiCharts.mensile.destroy();
  incassiCharts.mensile = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: nomi,
      datasets: [{
        label: 'Incassato (€)',
        data: values,
        backgroundColor: 'rgba(0,92,169,0.75)',
        borderColor: '#005CA9',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: function(v){ return '€' + fmtInt(v); } } }
      }
    }
  });
}

function incassiChartCassa() {
  var ctx = G('inc-chart-cassa');
  if (!ctx) return;

  var byCassa = {};
  incassiFiltrati.forEach(function(r) {
    var k = r.cassa || 'N/D';
    byCassa[k] = (byCassa[k] || 0) + (r.avere || 0);
  });

  var sorted = Object.entries(byCassa).sort((a,b)=>b[1]-a[1]).slice(0,8);
  var labels = sorted.map(x=>x[0]);
  var values = sorted.map(x=>x[1]);
  var colors = ['#005CA9','#0284C7','#06B6D4','#059669','#7C3AED','#EC4899','#F59E0B','#DC2626'];

  if (incassiCharts.cassa) incassiCharts.cassa.destroy();
  incassiCharts.cassa = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: function(c) { return c.label + ': €' + fmtNum(c.raw); }
          }
        }
      }
    }
  });
}

function incassiChartTipo() {
  var ctx = G('inc-chart-tipo');
  if (!ctx) return;

  var byTipo = {};
  incassiFiltrati.forEach(function(r) {
    var k = r.tipo_doc_az || 'N/D';
    byTipo[k] = (byTipo[k] || 0) + (r.avere || 0);
  });

  var sorted = Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
  var colors = ['#005CA9','#059669','#F59E0B','#EC4899','#7C3AED','#06B6D4'];

  if (incassiCharts.tipo) incassiCharts.tipo.destroy();
  incassiCharts.tipo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x=>x[0]),
      datasets: [{
        label: '€',
        data: sorted.map(x=>x[1]),
        backgroundColor: sorted.map((_,i)=>colors[i%colors.length]),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: function(v){ return '€' + fmtInt(v); } } } }
    }
  });
}

function incassiChartTopClienti() {
  var ctx = G('inc-chart-top');
  if (!ctx) return;

  var byCliente = {};
  incassiFiltrati.forEach(function(r) {
    var k = (r.cliente || r.codice_cliente || 'N/D').trim();
    if (!byCliente[k]) byCliente[k] = { tot: 0, codice: r.codice_cliente };
    byCliente[k].tot += (r.avere || 0);
  });

  var top = Object.entries(byCliente).sort((a,b)=>b[1].tot-a[1].tot).slice(0,10);

  if (incassiCharts.top) incassiCharts.top.destroy();
  incassiCharts.top = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(x => x[0].length > 30 ? x[0].substring(0,28)+'…' : x[0]),
      datasets: [{
        label: 'Totale €',
        data: top.map(x => x[1].tot),
        backgroundColor: 'rgba(5,150,105,0.8)',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: function(v){ return '€' + fmtInt(v); } } } }
    }
  });
}

// ─────────────────────────────────────────────
//  TABELLA
// ─────────────────────────────────────────────
function incassiRenderTable() {
  var el = G('inc-tbody');
  if (!el) return;

  var data = [...incassiFiltrati];

  // Sort
  var col = incassiSortState.col;
  var dir = incassiSortState.dir === 'asc' ? 1 : -1;
  data.sort(function(a,b) {
    var va = a[col] || '', vb = b[col] || '';
    if (typeof va === 'number') return dir * (va - vb);
    return dir * String(va).localeCompare(String(vb), 'it');
  });

  // Paginazione
  var total = data.length;
  var start = incassiPage * INCASSI_PAGE_SIZE;
  var page = data.slice(start, start + INCASSI_PAGE_SIZE);

  el.innerHTML = page.map(function(r) {
    var avere = r.avere || 0;
    var dataStr = r.data_pagamento ? r.data_pagamento.substring(0,10).split('-').reverse().join('/') : '';
    return '<tr onclick="incassiOpenDettaglio(this)" data-codice="' + escHtml(r.codice_cliente||'') + '" data-cliente="' + escHtml(r.cliente||'') + '">' +
      '<td><span style="font-family:monospace;font-size:11px;color:var(--text-dim)">' + escHtml(r.codice_cliente||'') + '</span></td>' +
      '<td style="font-weight:500">' + escHtml(r.cliente||'') + '</td>' +
      '<td>' + dataStr + '</td>' +
      '<td style="text-align:right;font-weight:600;color:var(--green)">€ ' + fmtNum(avere) + '</td>' +
      '<td>' + escHtml(r.cassa||'') + '</td>' +
      '<td>' + escHtml(r.promotore||'') + '</td>' +
      '<td><span class="badge-tipo">' + escHtml(r.tipo_doc_az||'') + '</span></td>' +
      '<td style="font-size:11px;color:var(--text-dim);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(r.compensazione||'') + '">' + escHtml((r.compensazione||'').substring(0,40) + (r.compensazione&&r.compensazione.length>40?'…':'')) + '</td>' +
    '</tr>';
  }).join('');

  // Paginazione controls
  var totalePag = Math.ceil(total / INCASSI_PAGE_SIZE);
  var pg = G('inc-pagination');
  if (pg) {
    pg.innerHTML = '<span style="color:var(--text-dim);font-size:12px">' +
      fmtInt(total) + ' pagamenti | Pagina ' + (incassiPage+1) + ' di ' + Math.max(1,totalePag) + '</span>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-secondary btn-sm" onclick="incassiPrevPage()" ' + (incassiPage===0?'disabled':'') + '>‹ Prec</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="incassiNextPage()" ' + (incassiPage>=totalePag-1?'disabled':'') + '>Succ ›</button>' +
      '</div>';
  }

  // Totale footer
  var tot = incassiFiltrati.reduce(function(s,r){ return s+(r.avere||0); }, 0);
  var tfoot = G('inc-tfoot');
  if (tfoot) {
    tfoot.innerHTML = '<tr style="background:var(--surface2);font-weight:700">' +
      '<td colspan="3" style="text-align:right;padding:8px 12px">TOTALE FILTRATO</td>' +
      '<td style="text-align:right;color:var(--green);padding:8px 12px">€ ' + fmtNum(tot) + '</td>' +
      '<td colspan="4"></td>' +
    '</tr>';
  }
}

function incassiPrevPage() {
  if (incassiPage > 0) { incassiPage--; incassiRenderTable(); }
}
function incassiNextPage() {
  var max = Math.ceil(incassiFiltrati.length / INCASSI_PAGE_SIZE) - 1;
  if (incassiPage < max) { incassiPage++; incassiRenderTable(); }
}

function incassiSort(col) {
  if (incassiSortState.col === col) {
    incassiSortState.dir = incassiSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    incassiSortState.col = col;
    incassiSortState.dir = 'asc';
  }
  incassiPage = 0;
  incassiRenderTable();
}

// ─────────────────────────────────────────────
//  DETTAGLIO CLIENTE (mini-modal)
// ─────────────────────────────────────────────
function incassiOpenDettaglio(tr) {
  var codice = tr.getAttribute('data-codice');
  var nomeCliente = tr.getAttribute('data-cliente');
  if (!codice) return;

  var righe = allIncassi.filter(function(r){ return r.codice_cliente === codice; });
  var totCliente = righe.reduce(function(s,r){ return s+(r.avere||0); }, 0);
  var byAnno = {};
  righe.forEach(function(r){ byAnno[r.anno]=(byAnno[r.anno]||0)+(r.avere||0); });

  var html = '<div role="dialog" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">' +
    '<div style="background:var(--surface);border-radius:12px;padding:28px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;position:relative">' +
      '<button onclick="this.closest(\'[role=dialog]\').remove()" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-dim)">×</button>' +
      '<h3 style="margin:0 0 4px 0;color:var(--text)">' + escHtml(nomeCliente) + '</h3>' +
      '<p style="margin:0 0 16px 0;font-size:12px;color:var(--text-dim);font-family:monospace">' + escHtml(codice) + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center">' +
          '<div style="font-size:11px;color:var(--text-dim)">Totale incassato</div>' +
          '<div style="font-size:18px;font-weight:700;color:var(--green)">€ ' + fmtNum(totCliente) + '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center">' +
          '<div style="font-size:11px;color:var(--text-dim)">N° pagamenti</div>' +
          '<div style="font-size:18px;font-weight:700;color:var(--blue)">' + righe.length + '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center">' +
          '<div style="font-size:11px;color:var(--text-dim)">Anni attivi</div>' +
          '<div style="font-size:18px;font-weight:700;color:var(--text)">' + Object.keys(byAnno).length + '</div>' +
        '</div>' +
      '</div>' +
      '<h4 style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;color:var(--text-sub)">Per anno</h4>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">' +
        '<thead><tr style="background:var(--surface2)"><th style="padding:6px 10px;text-align:left">Anno</th><th style="padding:6px 10px;text-align:right">Incassato</th><th style="padding:6px 10px;text-align:right">N° pag.</th></tr></thead>' +
        '<tbody>' +
          Object.entries(byAnno).sort((a,b)=>b[0]-a[0]).map(function(e){
            var n = righe.filter(r=>r.anno==e[0]).length;
            return '<tr style="border-bottom:1px solid var(--border)">' +
              '<td style="padding:6px 10px">' + e[0] + '</td>' +
              '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--green)">€ ' + fmtNum(e[1]) + '</td>' +
              '<td style="padding:6px 10px;text-align:right">' + n + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
      '<h4 style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;color:var(--text-sub)">Ultimi pagamenti</h4>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="background:var(--surface2)"><th style="padding:5px 8px;text-align:left">Data</th><th style="padding:5px 8px;text-align:right">€</th><th style="padding:5px 8px;text-align:left">Causale</th></tr></thead>' +
        '<tbody>' +
          righe.slice(0,20).map(function(r){
            var d = r.data_pagamento ? r.data_pagamento.substring(0,10).split('-').reverse().join('/') : '';
            return '<tr style="border-bottom:1px solid var(--border)">' +
              '<td style="padding:4px 8px">' + d + '</td>' +
              '<td style="padding:4px 8px;text-align:right;font-weight:600">€ ' + fmtNum(r.avere||0) + '</td>' +
              '<td style="padding:4px 8px;color:var(--text-dim);font-size:11px">' + escHtml((r.compensazione||r.documento||'').substring(0,50)) + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

// ─────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────
function incassiExport() {
  if (!incassiFiltrati.length) { toast('Nessun dato da esportare', 'warning'); return; }

  var wb = XLSX.utils.book_new();

  // Foglio dettaglio
  var rows = [['Codice Cliente','Cliente','Data Pagamento','Avere €','Dare €','Cassa','Promotore','Tipo Doc','Causale','Documento','Num. Doc']];
  incassiFiltrati.forEach(function(r) {
    rows.push([
      r.codice_cliente||'',
      r.cliente||'',
      r.data_pagamento||'',
      r.avere||0,
      r.dare||0,
      r.cassa||'',
      r.promotore||'',
      r.tipo_doc_az||'',
      r.compensazione||'',
      r.documento||'',
      r.num_doc||''
    ]);
  });

  var ws = XLSX.utils.aoa_to_sheet(rows);

  // Stile header
  var range = XLSX.utils.decode_range(ws['!ref']);
  for (var C = range.s.c; C <= range.e.c; C++) {
    var addr = XLSX.utils.encode_cell({r:0,c:C});
    if (!ws[addr]) continue;
    ws[addr].s = {
      fill: { fgColor: { rgb: '005CA9' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'center' }
    };
  }
  ws['!cols'] = [10,35,14,12,12,25,20,12,40,40,12].map(function(w){ return {wch:w}; });

  XLSX.utils.book_append_sheet(wb, ws, 'Incassi');

  // Foglio riepilogo per anno
  var byAnno = {};
  incassiFiltrati.forEach(function(r) {
    if (!byAnno[r.anno]) byAnno[r.anno] = {tot:0,n:0,clienti:new Set()};
    byAnno[r.anno].tot += (r.avere||0);
    byAnno[r.anno].n++;
    byAnno[r.anno].clienti.add(r.codice_cliente);
  });
  var sum = [['Anno','Totale Incassato €','N° Pagamenti','Clienti Unici']];
  Object.entries(byAnno).sort((a,b)=>b[0]-a[0]).forEach(function(e){
    sum.push([e[0], e[1].tot, e[1].n, e[1].clienti.size]);
  });
  var wsSum = XLSX.utils.aoa_to_sheet(sum);
  wsSum['!cols'] = [{wch:8},{wch:22},{wch:16},{wch:15}];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Riepilogo Anno');

  XLSX.writeFile(wb, 'CNA_Incassi_' + new Date().toISOString().substring(0,10) + '.xlsx');
  toast('Export completato', 'success');
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function fmtNum(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString('it-IT');
}
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
