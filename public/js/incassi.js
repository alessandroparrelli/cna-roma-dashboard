// ============================================================
//  INCASSI.JS  –  Tab Pagamenti / Incassi  v2
//  - Metodo pagamento: RID → SEPA, tutto il resto → Cassa
//  - Grafico mensile: tutti i mesi dell'anno selezionato (12 barre)
//  - KPI cards con icone SVG
//  - Statistiche aggiuntive: SEPA vs Cassa, per sede, tasso crescita
//  - Nessuna tabella elenco pagamenti
// ============================================================

var incassiLoaded  = false;
var incassiLoading = false;
var allIncassi     = [];
var incassiFiltrati = [];
var incassiCharts  = {};

// Funzione di classificazione metodo pagamento
function incassiMetodo(r) {
  var az = String(r.tipo_doc_az || '').toUpperCase().trim();
  return az === 'RID' ? 'SEPA' : 'Cassa';
}

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
  var anni = [...new Set(allIncassi.map(function(r){ return r.anno; }).filter(Boolean))].sort(function(a,b){ return b-a; });
  var selAnno = G('inc-f-anno');
  if (selAnno) {
    var cur = selAnno.value;
    selAnno.innerHTML = '<option value="">Tutti gli anni</option>';
    anni.forEach(function(a) {
      selAnno.innerHTML += '<option value="' + a + '"' + (cur==a?' selected':'') + '>' + a + '</option>';
    });
    if (!cur && anni.length > 0) selAnno.value = anni[0];
  }
  // Filtro metodo pagamento (SEPA / Cassa)
  var selMetodo = G('inc-f-metodo');
  if (selMetodo && !selMetodo.dataset.built) {
    selMetodo.dataset.built = '1';
    selMetodo.innerHTML = '<option value="">Tutti i metodi</option><option value="SEPA">SEPA (RID)</option><option value="Cassa">Cassa</option>';
  }
}

function incassiApply() {
  var anno    = (G('inc-f-anno')     || {}).value || '';
  var meseDa  = parseInt((G('inc-f-mese-da') || {}).value || '0') || 0;
  var meseA   = parseInt((G('inc-f-mese-a')  || {}).value || '0') || 0;
  var metodo  = (G('inc-f-metodo')   || {}).value || '';

  incassiFiltrati = allIncassi.filter(function(r) {
    if (anno   && String(r.anno) !== anno)  return false;
    if (metodo && incassiMetodo(r) !== metodo) return false;
    // Range mese: se solo Da, filtra >= Da; se solo A, filtra <= A; se entrambi, range
    var m = parseInt(r.mese) || 0;
    if (meseDa && meseA) {
      if (meseDa <= meseA) {
        if (m < meseDa || m > meseA) return false;
      } else {
        // range che attraversa fine anno (es. Ott → Mar)
        if (m < meseDa && m > meseA) return false;
      }
    } else if (meseDa && m < meseDa) return false;
    else if (meseA  && m > meseA)  return false;
    return true;
  });

  incassiRender();
}

function incassiReset() {
  ['inc-f-anno','inc-f-mese-da','inc-f-mese-a','inc-f-metodo'].forEach(function(id) {
    var el = G(id); if (el) el.value = '';
  });
  incassiApply();
}

// ─────────────────────────────────────────────
//  RENDER PRINCIPALE
// ─────────────────────────────────────────────
function incassiRender() {
  incassiRenderKPI();
  incassiRenderStats();
  incassiRenderCharts();
}

// ─────────────────────────────────────────────
//  SVG ICONE
// ─────────────────────────────────────────────
var ISVG = {
  euro:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  receipt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  users:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  avg:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  sepa:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  cash:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
  trend:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  calendar:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

// ─────────────────────────────────────────────
//  KPI CARDS (8 cards)
// ─────────────────────────────────────────────
function incassiRenderKPI() {
  var data = incassiFiltrati;
  var totale = data.reduce(function(s,r){ return s+(r.avere||0); },0);
  var numPag = data.length;
  var clientiUnici = new Set(data.map(function(r){ return r.codice_cliente; })).size;
  var mediaXCliente = clientiUnici > 0 ? totale / clientiUnici : 0;

  var sepaData  = data.filter(function(r){ return incassiMetodo(r)==='SEPA'; });
  var cassaData = data.filter(function(r){ return incassiMetodo(r)==='Cassa'; });
  var totSepa   = sepaData.reduce(function(s,r){  return s+(r.avere||0); },0);
  var totCassa  = cassaData.reduce(function(s,r){ return s+(r.avere||0); },0);
  var pctSepa   = totale > 0 ? (totSepa/totale*100).toFixed(1) : 0;

  var annoSel = (G('inc-f-anno')||{}).value || '';
  var meseDaSel = parseInt((G('inc-f-mese-da')||{}).value || '0') || 0;
  var meseASel  = parseInt((G('inc-f-mese-a') ||{}).value || '0') || 0;

  // Mese migliore nei dati filtrati
  var byMese = {};
  data.forEach(function(r){ var k=r.mese; byMese[k]=(byMese[k]||0)+(r.avere||0); });
  var meseMigliore    = Object.entries(byMese).sort(function(a,b){return b[1]-a[1];})[0];
  var meseMiglioreVal = meseMigliore ? MESI[parseInt(meseMigliore[0])] : '—';
  var meseMiglioreImpo= meseMigliore ? '€ ' + fmtNum(meseMigliore[1]) : '';

  // Media per pagamento
  var mediaXPag = numPag > 0 ? totale / numPag : 0;

  // Trend YoY
  var trendSub = '';
  if (annoSel) {
    var filtroBase = function(r){
      if (r.anno != (parseInt(annoSel)-1)) return false;
      var m = parseInt(r.mese)||0;
      if (meseDaSel && meseASel) { return meseDaSel<=meseASel ? (m>=meseDaSel && m<=meseASel) : (m>=meseDaSel || m<=meseASel); }
      if (meseDaSel && m < meseDaSel) return false;
      if (meseASel  && m > meseASel)  return false;
      return true;
    };
    var totPrevAnno = allIncassi.filter(filtroBase).reduce(function(s,r){return s+(r.avere||0);},0);
    if (totPrevAnno > 0) {
      var pctYoY = ((totale - totPrevAnno)/totPrevAnno*100).toFixed(1);
      var colYoY = pctYoY >= 0 ? 'var(--green)' : 'var(--red)';
      var arrYoY = pctYoY >= 0 ? '▲' : '▼';
      trendSub = '<span style="color:'+colYoY+'">'+arrYoY+' '+Math.abs(pctYoY)+'% vs '+(parseInt(annoSel)-1)+'</span>';
    }
  }

  var el = G('inc-kpi-container');
  if (!el) return;

  el.innerHTML =
    kpiCard(ISVG.euro,     'Totale Incassato',  '€ ' + fmtNum(totale),        trendSub,                                              'var(--blue)') +
    kpiCard(ISVG.receipt,  'N° Pagamenti',      fmtInt(numPag),               '',                                                    'var(--accent2)') +
    kpiCard(ISVG.users,    'Clienti Unici',     fmtInt(clientiUnici),         '',                                                    'var(--accent3)') +
    kpiCard(ISVG.avg,      'Media / Cliente',   '€ ' + fmtNum(mediaXCliente), '',                                                    'var(--green)') +
    kpiCard(ISVG.sepa,     'Totale SEPA',       '€ ' + fmtNum(totSepa),       pctSepa + '% del totale',                              '#0284C7') +
    kpiCard(ISVG.cash,     'Totale Cassa',      '€ ' + fmtNum(totCassa),      (100 - parseFloat(pctSepa)).toFixed(1) + '% del tot.', '#059669') +
    kpiCard(ISVG.avg,      'Media / Pagamento', '€ ' + fmtNum(mediaXPag),     '',                                                    '#7C3AED') +
    kpiCard(ISVG.calendar, 'Mese Migliore',     meseMiglioreVal,              meseMiglioreImpo,                                      '#D97706');
}

function kpiCard(svgIcon, label, value, extra, color) {
  return '<div class="inc-kpi-card" style="border-top:3px solid ' + color + '">' +
    '<div class="inc-kpi-icon" style="color:' + color + '">' + svgIcon + '</div>' +
    '<div class="inc-kpi-body">' +
      '<div class="inc-kpi-label">' + label + '</div>' +
      '<div class="inc-kpi-value" title="' + value + '">' + value + '</div>' +
      (extra ? '<div class="inc-kpi-sub">' + extra + '</div>' : '') +
    '</div>' +
  '</div>';
}

// ─────────────────────────────────────────────
//  STATISTICHE AGGIUNTIVE (tabelle riepilogative)
// ─────────────────────────────────────────────
function incassiRenderStats() {
  // Ora le card Per Metodo e Per Sede sono pre-esistenti nell'HTML con id specifici.
  // La funzione inietta solo il contenuto (tabelle) nei body di ciascuna card.
  var mBody = G('inc-metodo-body');
  var sBody = G('inc-sede-body');
  if (!mBody && !sBody) return;

  var data = incassiFiltrati;

  // ── Per sede ──
  var bySede = {};
  data.forEach(function(r){
    var k = r.cassa || 'Non specificata';
    if (!bySede[k]) bySede[k] = { tot:0, n:0, clienti:new Set() };
    bySede[k].tot += (r.avere||0);
    bySede[k].n++;
    bySede[k].clienti.add(r.codice_cliente);
  });
  var sedeRows = Object.entries(bySede).sort(function(a,b){ return b[1].tot-a[1].tot; });
  var totGlob = data.reduce(function(s,r){ return s+(r.avere||0); },0);

  var tableSede = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:7px 10px;text-align:left;font-weight:600">Sede / Cassa</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">Incassato</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">% Tot.</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">N° Pag.</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">Clienti</th>' +
    '</tr></thead><tbody>' +
    sedeRows.map(function(e, i){
      var pct = totGlob > 0 ? (e[1].tot/totGlob*100).toFixed(1) : 0;
      var bg = i%2===0 ? '' : 'background:var(--surface2)';
      return '<tr style="border-bottom:1px solid var(--border);' + bg + '">' +
        '<td style="padding:6px 10px">' + escHtml(e[0]) + '</td>' +
        '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ ' + fmtNum(e[1].tot) + '</td>' +
        '<td style="padding:6px 10px;text-align:right">' +
          '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">' +
            '<div style="width:50px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">' +
              '<div style="width:'+pct+'%;height:100%;background:var(--blue);border-radius:3px"></div>' +
            '</div>' + pct + '%' +
          '</div>' +
        '</td>' +
        '<td style="padding:6px 10px;text-align:right">' + fmtInt(e[1].n) + '</td>' +
        '<td style="padding:6px 10px;text-align:right">' + e[1].clienti.size + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';

  // ── Per metodo pagamento ──
  var byMetodo = { SEPA:{ tot:0,n:0 }, Cassa:{ tot:0,n:0 } };
  data.forEach(function(r){
    var m = incassiMetodo(r);
    byMetodo[m].tot += (r.avere||0);
    byMetodo[m].n++;
  });

  var tableMetodo = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:7px 10px;text-align:left;font-weight:600">Metodo</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">Incassato</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">%</th>' +
      '<th style="padding:7px 10px;text-align:right;font-weight:600">N° Pag.</th>' +
    '</tr></thead><tbody>' +
    [['SEPA','#0284C7'],['Cassa','#059669']].map(function(pair){
      var m = pair[0]; var col = pair[1];
      var d = byMetodo[m];
      var pct = totGlob>0 ? (d.tot/totGlob*100).toFixed(1) : 0;
      return '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:6px">' +
          '<span style="width:10px;height:10px;border-radius:50%;background:'+col+';display:inline-block"></span>' +
          '<strong>' + m + '</strong></span></td>' +
        '<td style="padding:7px 10px;text-align:right;font-weight:600;color:'+col+'">€ ' + fmtNum(d.tot) + '</td>' +
        '<td style="padding:7px 10px;text-align:right">' + pct + '%</td>' +
        '<td style="padding:7px 10px;text-align:right">' + fmtInt(d.n) + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';

  // ── Riepilogo per anno (se nessun anno selezionato) ──
  var annoSel = (G('inc-f-anno')||{}).value || '';
  var tableAnno = '';
  if (!annoSel) {
    var byAnno = {};
    allIncassi.forEach(function(r){
      if (!byAnno[r.anno]) byAnno[r.anno]={tot:0,n:0,clienti:new Set()};
      byAnno[r.anno].tot+=(r.avere||0); byAnno[r.anno].n++; byAnno[r.anno].clienti.add(r.codice_cliente);
    });
    var anniSorted = Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];});
    tableAnno = '<div class="inc-stat-card inc-full">' +
      '<div class="inc-stat-header">' + ISVG.calendar + '<span>Riepilogo Annuale</span></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="background:var(--surface2)">' +
          '<th style="padding:7px 10px;text-align:left">Anno</th>' +
          '<th style="padding:7px 10px;text-align:right">Totale</th>' +
          '<th style="padding:7px 10px;text-align:right">Var. %</th>' +
          '<th style="padding:7px 10px;text-align:right">N° Pag.</th>' +
          '<th style="padding:7px 10px;text-align:right">Clienti</th>' +
          '<th style="padding:7px 10px;text-align:right">Media/pag.</th>' +
        '</tr></thead><tbody>' +
        anniSorted.map(function(e, i){
          var prev = anniSorted[i+1];
          var varPct = prev && prev[1].tot>0 ? ((e[1].tot-prev[1].tot)/prev[1].tot*100).toFixed(1) : null;
          var varHtml = varPct!==null ? '<span style="color:'+(varPct>=0?'var(--green)':'var(--red)')+'">'+( varPct>=0?'▲':'▼')+' '+Math.abs(varPct)+'%</span>' : '—';
          return '<tr style="border-bottom:1px solid var(--border)'+(i%2?' ;background:var(--surface2)':'')+'">' +
            '<td style="padding:6px 10px;font-weight:700">' + e[0] + '</td>' +
            '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ ' + fmtNum(e[1].tot) + '</td>' +
            '<td style="padding:6px 10px;text-align:right">' + varHtml + '</td>' +
            '<td style="padding:6px 10px;text-align:right">' + fmtInt(e[1].n) + '</td>' +
            '<td style="padding:6px 10px;text-align:right">' + e[1].clienti.size + '</td>' +
            '<td style="padding:6px 10px;text-align:right">€ ' + fmtNum(e[1].tot/e[1].n) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';
  }

  if(mBody) mBody.innerHTML = tableMetodo;
  if(sBody) sBody.innerHTML = tableSede;
  var aWrap = G('inc-anno-wrapper');
  if(aWrap) aWrap.innerHTML = tableAnno;
}

// ─────────────────────────────────────────────
//  GRAFICI
// ─────────────────────────────────────────────
function incassiRenderCharts() {
  incassiChartMensile();
  incassiChartMetodo();
  incassiChartTopClienti();
  incassiChartMensileSepa();
}

// Grafico 1: andamento mensile — sempre 12 mesi dell'anno selezionato
function incassiChartMensile() {
  var ctxEl = G('inc-chart-mensile');
  if (!ctxEl) return;

  var annoSel = parseInt((G('inc-f-anno')||{}).value || new Date().getFullYear());
  var meseDaC = parseInt((G('inc-f-mese-da')||{}).value || '0') || 0;
  var meseAC  = parseInt((G('inc-f-mese-a') ||{}).value || '0') || 0;

  // Costruisci struttura fissa 12 mesi
  var meseMap = {};
  for (var m=1; m<=12; m++) meseMap[m] = 0;

  // Usa TUTTI i dati dell'anno selezionato, applica solo filtro metodo e range mese
  var srcAnno = allIncassi.filter(function(r){ return r.anno == annoSel; });
  var metodoSel = (G('inc-f-metodo')||{}).value || '';
  if (metodoSel) srcAnno = srcAnno.filter(function(r){ return incassiMetodo(r)===metodoSel; });
  // Applica range mese se impostato
  if (meseDaC || meseAC) {
    srcAnno = srcAnno.filter(function(r){
      var m = parseInt(r.mese)||0;
      if (meseDaC && meseAC) { return meseDaC<=meseAC ? (m>=meseDaC && m<=meseAC) : (m>=meseDaC || m<=meseAC); }
      if (meseDaC && m < meseDaC) return false;
      if (meseAC  && m > meseAC)  return false;
      return true;
    });
  }

  srcAnno.forEach(function(r){
    var m = parseInt(r.mese);
    if (m>=1 && m<=12) meseMap[m] += (r.avere||0);
  });

  var labels = MESI.slice(1); // ['Gennaio',…,'Dicembre']
  var values = [];
  for (var i=1; i<=12; i++) values.push(meseMap[i]);

  // Calcola media
  var nonZero = values.filter(function(v){ return v>0; });
  var media   = nonZero.length > 0 ? nonZero.reduce(function(s,v){return s+v;},0)/nonZero.length : 0;

  if (incassiCharts.mensile) { try { incassiCharts.mensile.destroy(); } catch(e){} }
  incassiCharts.mensile = new Chart(ctxEl, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Incassato ' + annoSel,
          data: values,
          backgroundColor: values.map(function(v){ return v === Math.max.apply(null,values) ? '#005CA9' : 'rgba(0,92,169,0.55)'; }),
          borderColor: '#005CA9',
          borderWidth: 1,
          borderRadius: 5,
          order: 2
        },
        {
          label: 'Media mensile',
          data: Array(12).fill(media),
          type: 'line',
          borderColor: '#F59E0B',
          borderWidth: 2,
          borderDash: [5,4],
          pointRadius: 0,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' },
      plugins: {
        legend: { display: true, labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: function(c){ return c.dataset.label + ': €' + fmtNum(c.raw); }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: function(v){ return '€' + fmtInt(v); } }
        }
      }
    }
  });
}

// Grafico 2: SEPA vs Cassa per mese (stacked bar)
function incassiChartMensileSepa() {
  var ctxEl = G('inc-chart-sepa');
  if (!ctxEl) return;

  var annoSel = parseInt((G('inc-f-anno')||{}).value || new Date().getFullYear());
  var meseDaC = parseInt((G('inc-f-mese-da')||{}).value || '0') || 0;
  var meseAC  = parseInt((G('inc-f-mese-a') ||{}).value || '0') || 0;
  var sepaMap = {}, cassaMap = {};
  for (var m=1; m<=12; m++) { sepaMap[m]=0; cassaMap[m]=0; }

  var src = allIncassi.filter(function(r){ return r.anno==annoSel; });
  if (meseDaC || meseAC) {
    src = src.filter(function(r){
      var m = parseInt(r.mese)||0;
      if (meseDaC && meseAC) { return meseDaC<=meseAC ? (m>=meseDaC && m<=meseAC) : (m>=meseDaC || m<=meseAC); }
      if (meseDaC && m < meseDaC) return false;
      if (meseAC  && m > meseAC)  return false;
      return true;
    });
  }
  src.forEach(function(r){
    var m = parseInt(r.mese);
    if (m<1||m>12) return;
    if (incassiMetodo(r)==='SEPA') sepaMap[m]+=(r.avere||0);
    else cassaMap[m]+=(r.avere||0);
  });

  var labels = MESI.slice(1);
  var sepaVals=[]; var cassaVals=[];
  for (var i=1; i<=12; i++){ sepaVals.push(sepaMap[i]); cassaVals.push(cassaMap[i]); }

  if (incassiCharts.sepa) { try{ incassiCharts.sepa.destroy(); }catch(e){} }
  incassiCharts.sepa = new Chart(ctxEl, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'SEPA',  data: sepaVals,  backgroundColor: 'rgba(142,0,26,0.85)',  borderRadius: 3 },
        { label: 'Cassa', data: cassaVals, backgroundColor: 'rgba(255,179,0,0.85)', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font:{size:11}, boxWidth:12 } },
        tooltip: { callbacks: { label: function(c){ return c.dataset.label+': €'+fmtNum(c.raw); } } }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero:true, ticks: { callback: function(v){ return '€'+fmtInt(v); } } }
      }
    }
  });
}

// Grafico 3: SEPA vs Cassa doughnut
function incassiChartMetodo() {
  var ctxEl = G('inc-chart-metodo');
  if (!ctxEl) return;

  var totSepa=0, totCassa=0;
  incassiFiltrati.forEach(function(r){
    if (incassiMetodo(r)==='SEPA') totSepa+=(r.avere||0);
    else totCassa+=(r.avere||0);
  });

  if (incassiCharts.metodo) { try{ incassiCharts.metodo.destroy(); }catch(e){} }
  incassiCharts.metodo = new Chart(ctxEl, {
    type: 'doughnut',
    data: {
      labels: ['SEPA (RID)', 'Cassa'],
      datasets: [{ data:[totSepa, totCassa], backgroundColor:['rgb(142,0,26)','rgb(255,179,0)'], borderWidth:3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'bottom', labels:{ font:{size:12}, boxWidth:14, padding:16 } },
        tooltip: { callbacks: { label: function(c){ return c.label+': €'+fmtNum(c.raw)+' ('+( (c.raw/(totSepa+totCassa||1))*100).toFixed(1)+'%)'; } } }
      },
      cutout: '65%'
    }
  });
}

// Grafico 4: Top 10 clienti
function incassiChartTopClienti() {
  var ctxEl = G('inc-chart-top');
  if (!ctxEl) return;

  var byCliente = {};
  incassiFiltrati.forEach(function(r){
    var k = (r.cliente||r.codice_cliente||'N/D').trim();
    byCliente[k] = (byCliente[k]||0) + (r.avere||0);
  });

  var top = Object.entries(byCliente).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  var maxVal = top.length > 0 ? top[0][1] : 1;

  if (incassiCharts.top) { try{ incassiCharts.top.destroy(); }catch(e){} }
  incassiCharts.top = new Chart(ctxEl, {
    type: 'bar',
    data: {
      labels: top.map(function(x){ return x[0].length>32?x[0].substring(0,30)+'…':x[0]; }),
      datasets: [{
        label: 'Totale €',
        data: top.map(function(x){ return x[1]; }),
        backgroundColor: top.map(function(x){ return 'rgba(124,58,237,'+(0.4+0.6*x[1]/maxVal).toFixed(2)+')'; }),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y', responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: function(c){ return '€'+fmtNum(c.raw); } } }
      },
      scales: { x: { ticks: { callback: function(v){ return '€'+fmtInt(v); } } } }
    }
  });
}

// ─────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────
function incassiExport() {
  if (!incassiFiltrati.length) { toast('Nessun dato da esportare', 'warning'); return; }
  var wb = XLSX.utils.book_new();

  // Foglio riepilogo
  var byAnno = {};
  incassiFiltrati.forEach(function(r){
    var a = r.anno||'?';
    if (!byAnno[a]) byAnno[a]={tot:0,sepa:0,cassa:0,n:0,clienti:new Set()};
    byAnno[a].tot+=(r.avere||0); byAnno[a].n++;
    byAnno[a].clienti.add(r.codice_cliente);
    if (incassiMetodo(r)==='SEPA') byAnno[a].sepa+=(r.avere||0);
    else byAnno[a].cassa+=(r.avere||0);
  });
  var sum=[['Anno','Totale €','SEPA €','Cassa €','N° Pag.','Clienti Unici']];
  Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];}).forEach(function(e){
    sum.push([e[0],e[1].tot,e[1].sepa,e[1].cassa,e[1].n,e[1].clienti.size]);
  });
  var wsSum = XLSX.utils.aoa_to_sheet(sum);
  wsSum['!cols']=[{wch:8},{wch:16},{wch:14},{wch:14},{wch:10},{wch:14}];
  for(var C=0;C<6;C++){var a=XLSX.utils.encode_cell({r:0,c:C});if(wsSum[a])wsSum[a].s={fill:{fgColor:{rgb:'005CA9'}},font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:11}};}
  XLSX.utils.book_append_sheet(wb, wsSum, 'Riepilogo');

  // Foglio dettaglio per sede
  var bySede={};
  incassiFiltrati.forEach(function(r){
    var k=r.cassa||'Non specificata';
    if(!bySede[k]) bySede[k]=[];
    bySede[k].push(r);
  });
  Object.entries(bySede).sort(function(a,b){return b[1].reduce(function(s,r){return s+(r.avere||0);},0)-a[1].reduce(function(s,r){return s+(r.avere||0);},0);}).forEach(function(e){
    var nome = e[0].substring(0,28).replace(/[^a-zA-Z0-9 ]/g,'_');
    var sedeRows=[['Codice','Cliente','Data','Avere €','Metodo','Causale']];
    e[1].forEach(function(r){
      sedeRows.push([r.codice_cliente||'',r.cliente||'',r.data_pagamento||'',r.avere||0,incassiMetodo(r),r.compensazione||'']);
    });
    var wsSede=XLSX.utils.aoa_to_sheet(sedeRows);
    wsSede['!cols']=[{wch:12},{wch:35},{wch:12},{wch:12},{wch:8},{wch:40}];
    XLSX.utils.book_append_sheet(wb,wsSede,nome||'Sede');
  });

  XLSX.writeFile(wb,'CNA_Incassi_'+new Date().toISOString().substring(0,10)+'.xlsx');
  toast('Export completato','success');
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function fmtNum(n){ return Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtInt(n){ return Number(n||0).toLocaleString('it-IT'); }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
