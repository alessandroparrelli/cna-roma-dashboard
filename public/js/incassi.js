// ============================================================
//  INCASSI.JS  v4 — fonte: incassipandora
//  Filtri: anno da/a, mese da/a, società, metodo
//  Grafici: mensile, SEPA/Cassa, distribuzione, top clienti,
//           confronto anni, media mensile, tasso incasso
// ============================================================

var incassiLoaded   = false;
var incassiLoading  = false;
var allIncassi      = [];   // record pagati da incassipandora
var allIncassiTutti = [];   // tutti i record (anche aperti) per tasso incasso
var incassiFiltrati = [];
var incassiCharts   = {};

function incassiMetodo(r) {
  var tp = String(r.tipo_pagamento || '').toUpperCase().trim();
  return (tp === 'RID' || tp === 'SEPA') ? 'SEPA' : 'Cassa';
}

function incassiAvere(r) {
  return (parseFloat(r.totale_fattura) || 0) - (parseFloat(r.saldo) || 0);
}

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────
async function incassiInit() {
  if (incassiLoading) return;
  if (incassiLoaded) { incassiRender(); return; }
  incassiLoading = true;
  showLoad('Caricamento incassi…');
  try { await incassiLoad(); }
  catch(e) { toast('Errore: ' + e.message, 'error'); console.error(e); }
  finally { incassiLoading = false; hideLoad(); }
}

async function incassiLoad(force) {
  if (incassiLoaded && !force) return;
  showLoad('Caricamento dati Pandora…');

  // Carica record PAGATI (per statistiche incassi)
  var pagati = await incassiFetch('pagato=eq.true');
  pagati.forEach(function(r) {
    r._avere = incassiAvere(r);
    r._anno  = r.data_fattura ? parseInt(r.data_fattura.substring(0,4)) : null;
    r._mese  = r.data_fattura ? parseInt(r.data_fattura.substring(5,7)) : null;
  });
  allIncassi = pagati;

  // Carica TUTTI i record (per calcolo tasso incasso)
  var tutti = await incassiFetch('');
  tutti.forEach(function(r) {
    r._anno = r.data_fattura ? parseInt(r.data_fattura.substring(0,4)) : null;
    r._mese = r.data_fattura ? parseInt(r.data_fattura.substring(5,7)) : null;
  });
  allIncassiTutti = tutti;

  incassiLoaded = true;
  incassiBuildFilters();
  incassiApply();
  hideLoad();
}

async function incassiFetch(extraFilter) {
  var rows = [], from = 0, CHUNK = 1000;
  while (true) {
    var url = SB + '/rest/v1/incassipandora?order=data_fattura.desc&limit=' + CHUNK +
              (extraFilter ? '&' + extraFilter : '');
    var r = await fetch(url, {
      headers: Object.assign({}, H(), { 'Range': from+'-'+(from+CHUNK-1), 'Range-Unit':'items', 'Prefer':'count=none' })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var chunk = await r.json();
    if (!Array.isArray(chunk) || !chunk.length) break;
    rows = rows.concat(chunk);
    if (chunk.length < CHUNK) break;
    from += CHUNK;
  }
  return rows;
}

// ─────────────────────────────────────────────
//  FILTRI
// ─────────────────────────────────────────────
function incassiBuildFilters() {
  var anniSet = {};
  allIncassi.forEach(function(r){ if(r._anno) anniSet[r._anno] = true; });
  var anni = Object.keys(anniSet).map(Number).sort(function(a,b){ return b-a; });

  ['inc-f-anno-da','inc-f-anno-a'].forEach(function(id) {
    var sel = G(id); if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">—</option>';
    anni.forEach(function(a) {
      sel.innerHTML += '<option value="'+a+'"'+(cur==a?' selected':'')+'>'+a+'</option>';
    });
  });
  // Default: anno corrente in "da" e "a" (se non impostato)
  var da = G('inc-f-anno-da'), oa = G('inc-f-anno-a');
  if (da && !da.value && anni[0]) da.value = anni[anni.length-1]; // anno più vecchio come "da"
  if (oa && !oa.value && anni[0]) oa.value = anni[0]; // anno più recente come "a"
}

function incassiApply() {
  var annoDa  = parseInt((G('inc-f-anno-da') ||{}).value||'0')||0;
  var annoA   = parseInt((G('inc-f-anno-a')  ||{}).value||'0')||0;
  var meseDa  = parseInt((G('inc-f-mese-da') ||{}).value||'0')||0;
  var meseA   = parseInt((G('inc-f-mese-a')  ||{}).value||'0')||0;
  var metodo  = (G('inc-f-metodo')  ||{}).value||'';
  var societa = (G('inc-f-societa') ||{}).value||'';

  incassiFiltrati = allIncassi.filter(function(r) {
    var a = r._anno || 0, m = r._mese || 0;
    if (annoDa && a < annoDa) return false;
    if (annoA  && a > annoA)  return false;
    if (meseDa && meseA) {
      if (meseDa <= meseA) { if (m < meseDa || m > meseA) return false; }
      else { if (m < meseDa && m > meseA) return false; }
    } else if (meseDa && m < meseDa) return false;
    else if (meseA  && m > meseA)  return false;
    if (metodo  && incassiMetodo(r) !== metodo)  return false;
    if (societa && r.codice_azienda !== societa) return false;
    return true;
  });

  incassiRender();
}

function incassiReset() {
  ['inc-f-anno-da','inc-f-anno-a','inc-f-mese-da','inc-f-mese-a','inc-f-metodo','inc-f-societa'].forEach(function(id){
    var el=G(id); if(el) el.value='';
  });
  incassiBuildFilters();
  incassiApply();
}

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
function incassiRender() {
  incassiRenderKPI();
  incassiRenderStats();
  incassiRenderCharts();
}

// ─────────────────────────────────────────────
//  SVG
// ─────────────────────────────────────────────
var ISVG = {
  euro:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  receipt:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>',
  users:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  avg:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  sepa:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  cash:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  trend:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

// ─────────────────────────────────────────────
//  KPI
// ─────────────────────────────────────────────
function incassiRenderKPI() {
  var data   = incassiFiltrati;
  var totale = data.reduce(function(s,r){ return s+r._avere; },0);
  var numPag = data.length;
  var clientiSet = {};
  data.forEach(function(r){ if(r.codice_cliente) clientiSet[r.codice_cliente]=1; });
  var clientiUnici = Object.keys(clientiSet).length;
  var mediaXCliente = clientiUnici > 0 ? totale/clientiUnici : 0;
  var mediaXPag = numPag > 0 ? totale/numPag : 0;

  var totSepa  = data.filter(function(r){ return incassiMetodo(r)==='SEPA'; }).reduce(function(s,r){ return s+r._avere; },0);
  var totCassa = data.filter(function(r){ return incassiMetodo(r)==='Cassa'; }).reduce(function(s,r){ return s+r._avere; },0);
  var pctSepa  = totale>0 ? (totSepa/totale*100).toFixed(1) : 0;
  var totG1    = data.filter(function(r){ return r.codice_azienda==='G1000001'; }).reduce(function(s,r){ return s+r._avere; },0);
  var totG3    = data.filter(function(r){ return r.codice_azienda==='G1000003'; }).reduce(function(s,r){ return s+r._avere; },0);

  // Trend rispetto all'anno precedente del range selezionato
  var annoDa = parseInt((G('inc-f-anno-da')||{}).value||'0')||0;
  var annoA  = parseInt((G('inc-f-anno-a') ||{}).value||'0')||0;
  var trendSub = '';
  if (annoDa && annoA && annoDa === annoA) {
    var prevAnno = annoDa - 1;
    var totPrev = allIncassi.filter(function(r){ return r._anno===prevAnno; }).reduce(function(s,r){ return s+r._avere; },0);
    if (totPrev > 0) {
      var pct = ((totale-totPrev)/totPrev*100).toFixed(1);
      trendSub = '<span style="color:'+(pct>=0?'var(--green)':'var(--red)')+'">'+( pct>=0?'▲':'▼')+' '+Math.abs(pct)+'% vs '+prevAnno+'</span>';
    }
  }

  // Mese migliore
  var byMese = {};
  data.forEach(function(r){ if(r._mese) byMese[r._mese]=(byMese[r._mese]||0)+r._avere; });
  var meseMigl = Object.entries(byMese).sort(function(a,b){ return b[1]-a[1]; })[0];
  var meseMiglVal  = meseMigl ? MESI[parseInt(meseMigl[0])] : '—';
  var meseMiglImpo = meseMigl ? '€ '+fmtNum(meseMigl[1]) : '';

  var el = G('inc-kpi-container'); if(!el) return;
  el.innerHTML =
    kpiCard(ISVG.euro,     'Totale Incassato',  '€ '+fmtNum(totale),        trendSub,                                           'var(--blue)') +
    kpiCard(ISVG.receipt,  'Fatture Saldate',   fmtInt(numPag),              '',                                                 'var(--accent2)') +
    kpiCard(ISVG.users,    'Clienti Unici',     fmtInt(clientiUnici),        '',                                                 'var(--accent3)') +
    kpiCard(ISVG.avg,      'Media / Cliente',   '€ '+fmtNum(mediaXCliente),  '',                                                 'var(--green)') +
    kpiCard(ISVG.euro,     'CNA Roma',          '€ '+fmtNum(totG1),          'G1000001',                                         '#0284C7') +
    kpiCard(ISVG.euro,     'CNA CAF Lazio',     '€ '+fmtNum(totG3),          'G1000003',                                         '#D97706') +
    kpiCard(ISVG.sepa,     'SEPA',              '€ '+fmtNum(totSepa),        pctSepa+'% del totale',                             '#7C3AED') +
    kpiCard(ISVG.calendar, 'Mese Migliore',     meseMiglVal,                 meseMiglImpo,                                       '#059669');
}

function colorToGlow(c){
  var m={'var(--blue)':'rgba(0,92,169,.55)','var(--accent2)':'rgba(6,182,212,.55)','var(--accent3)':'rgba(139,92,246,.55)','var(--green)':'rgba(16,185,129,.55)','#0284C7':'rgba(2,132,199,.55)','#D97706':'rgba(217,119,6,.55)','#7C3AED':'rgba(124,58,237,.55)','#059669':'rgba(5,150,105,.55)'};
  return m[c]||'rgba(0,92,169,.5)';
}

function kpiCard(icon,label,value,extra,color){
  return '<div class="inc-kpi-card" style="border-top:3px solid '+color+';--kpi-glow:'+colorToGlow(color)+'">'+
    '<div class="inc-kpi-icon" style="color:'+color+'">'+icon+'</div>'+
    '<div class="inc-kpi-body">'+
      '<div class="inc-kpi-label">'+label+'</div>'+
      '<div class="inc-kpi-value" title="'+value+'">'+value+'</div>'+
      (extra?'<div class="inc-kpi-sub">'+extra+'</div>':'')+
    '</div></div>';
}

// ─────────────────────────────────────────────
//  STATISTICHE
// ─────────────────────────────────────────────
function incassiRenderStats() {
  var data    = incassiFiltrati;
  var totGlob = data.reduce(function(s,r){ return s+r._avere; },0);

  // ── Per sede ──
  var sBody = G('inc-sede-body');
  if (sBody) {
    var bySede = {};
    data.forEach(function(r){
      var k=r.unita_operativa||'Non specificata';
      if(!bySede[k]) bySede[k]={tot:0,n:0,cl:{}};
      bySede[k].tot+=r._avere; bySede[k].n++;
      if(r.codice_cliente) bySede[k].cl[r.codice_cliente]=1;
    });
    var sedeRows=Object.entries(bySede).sort(function(a,b){return b[1].tot-a[1].tot;});
    sBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:var(--surface2)">'+
        '<th style="padding:7px 10px;text-align:left">Sede</th>'+
        '<th style="padding:7px 10px;text-align:right">Incassato</th>'+
        '<th style="padding:7px 10px;text-align:right">%</th>'+
        '<th style="padding:7px 10px;text-align:right">N°</th>'+
        '<th style="padding:7px 10px;text-align:right">Clienti</th>'+
      '</tr></thead><tbody>'+
      sedeRows.map(function(e,i){
        var pct=totGlob>0?(e[1].tot/totGlob*100).toFixed(1):0;
        return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'">' +
          '<td style="padding:6px 10px">'+escHtml(e[0])+'</td>'+
          '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ '+fmtNum(e[1].tot)+'</td>'+
          '<td style="padding:6px 10px;text-align:right">'+
            '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">'+
              '<div style="width:50px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">'+
                '<div style="width:'+pct+'%;height:100%;background:var(--blue);border-radius:3px"></div>'+
              '</div>'+pct+'%</div></td>'+
          '<td style="padding:6px 10px;text-align:right">'+fmtInt(e[1].n)+'</td>'+
          '<td style="padding:6px 10px;text-align:right">'+Object.keys(e[1].cl).length+'</td>'+
        '</tr>';
      }).join('')+'</tbody></table>';
  }

  // ── Per metodo + società ──
  var mBody = G('inc-metodo-body');
  if (mBody) {
    var byMetodo={SEPA:{tot:0,n:0},Cassa:{tot:0,n:0}};
    data.forEach(function(r){ var m=incassiMetodo(r); byMetodo[m].tot+=r._avere; byMetodo[m].n++; });
    var bySoc={G1000001:{tot:0,n:0},G1000003:{tot:0,n:0}};
    data.forEach(function(r){ var s=r.codice_azienda; if(bySoc[s]){bySoc[s].tot+=r._avere;bySoc[s].n++;} });

    mBody.innerHTML=
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">'+
        '<thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Metodo</th><th style="padding:7px 10px;text-align:right">€</th><th style="padding:7px 10px;text-align:right">%</th><th style="padding:7px 10px;text-align:right">N°</th></tr></thead><tbody>'+
        [['SEPA','#0284C7'],['Cassa','#059669']].map(function(p){
          var d=byMetodo[p[0]]; var pct=totGlob>0?(d.tot/totGlob*100).toFixed(1):0;
          return '<tr style="border-bottom:1px solid var(--border)">'+
            '<td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+p[1]+';display:inline-block"></span><strong>'+p[0]+'</strong></span></td>'+
            '<td style="padding:7px 10px;text-align:right;font-weight:600;color:'+p[1]+'">€ '+fmtNum(d.tot)+'</td>'+
            '<td style="padding:7px 10px;text-align:right">'+pct+'%</td>'+
            '<td style="padding:7px 10px;text-align:right">'+fmtInt(d.n)+'</td></tr>';
        }).join('')+'</tbody></table>'+
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:8px">Per Società</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Società</th><th style="padding:7px 10px;text-align:right">€</th><th style="padding:7px 10px;text-align:right">%</th><th style="padding:7px 10px;text-align:right">N°</th></tr></thead><tbody>'+
        [['G1000001','CNA Roma','#2563EB'],['G1000003','CAF Lazio','#D97706']].map(function(t){
          var d=bySoc[t[0]]||{tot:0,n:0}; var pct=totGlob>0?(d.tot/totGlob*100).toFixed(1):0;
          return '<tr style="border-bottom:1px solid var(--border)">'+
            '<td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+t[2]+';display:inline-block"></span><strong>'+t[1]+'</strong></span></td>'+
            '<td style="padding:7px 10px;text-align:right;font-weight:600;color:'+t[2]+'">€ '+fmtNum(d.tot)+'</td>'+
            '<td style="padding:7px 10px;text-align:right">'+pct+'%</td>'+
            '<td style="padding:7px 10px;text-align:right">'+fmtInt(d.n)+'</td></tr>';
        }).join('')+'</tbody></table>';
  }

  // ── Riepilogo annuale (solo se range anni > 1 o non filtrato) ──
  var annoDa=parseInt((G('inc-f-anno-da')||{}).value||'0')||0;
  var annoA =parseInt((G('inc-f-anno-a') ||{}).value||'0')||0;
  var aWrap = G('inc-anno-wrapper');
  if (aWrap && !(annoDa && annoA && annoDa===annoA)) {
    var byAnno={};
    incassiFiltrati.forEach(function(r){
      var a=r._anno||'?'; if(!byAnno[a]) byAnno[a]={tot:0,n:0,cl:{}};
      byAnno[a].tot+=r._avere; byAnno[a].n++;
      if(r.codice_cliente) byAnno[a].cl[r.codice_cliente]=1;
    });
    var anniS=Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];});
    aWrap.innerHTML=anniS.length?'<div class="inc-stat-card inc-full">'+
      '<div class="inc-stat-header">'+ISVG.calendar+'<span>Riepilogo Annuale</span></div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="background:var(--surface2)">'+
          '<th style="padding:7px 10px;text-align:left">Anno</th>'+
          '<th style="padding:7px 10px;text-align:right">Totale</th>'+
          '<th style="padding:7px 10px;text-align:right">Var. %</th>'+
          '<th style="padding:7px 10px;text-align:right">N°</th>'+
          '<th style="padding:7px 10px;text-align:right">Clienti</th>'+
          '<th style="padding:7px 10px;text-align:right">Media/fattura</th>'+
        '</tr></thead><tbody>'+
        anniS.map(function(e,i){
          var prev=anniS[i+1];
          var varPct=prev&&prev[1].tot>0?((e[1].tot-prev[1].tot)/prev[1].tot*100).toFixed(1):null;
          var varH=varPct!==null?'<span style="color:'+(varPct>=0?'var(--green)':'var(--red)')+'">'+( varPct>=0?'▲':'▼')+' '+Math.abs(varPct)+'%</span>':'—';
          return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'">'+
            '<td style="padding:6px 10px;font-weight:700">'+e[0]+'</td>'+
            '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ '+fmtNum(e[1].tot)+'</td>'+
            '<td style="padding:6px 10px;text-align:right">'+varH+'</td>'+
            '<td style="padding:6px 10px;text-align:right">'+fmtInt(e[1].n)+'</td>'+
            '<td style="padding:6px 10px;text-align:right">'+Object.keys(e[1].cl).length+'</td>'+
            '<td style="padding:6px 10px;text-align:right">€ '+fmtNum(e[1].tot/e[1].n)+'</td></tr>';
        }).join('')+'</tbody></table></div>':'';
  } else if (aWrap) aWrap.innerHTML='';

  // ── Media mensile per anno ──
  var mmBody = G('inc-mese-stats-body');
  if (mmBody) {
    var anniDisp = {};
    incassiFiltrati.forEach(function(r){ if(r._anno) anniDisp[r._anno]=true; });
    var anniList = Object.keys(anniDisp).map(Number).sort(function(a,b){return b-a;}).slice(0,5);
    var byAnnoMese = {};
    anniList.forEach(function(a){ byAnnoMese[a]={}; for(var m=1;m<=12;m++) byAnnoMese[a][m]=0; });
    incassiFiltrati.forEach(function(r){
      if(byAnnoMese[r._anno] && r._mese) byAnnoMese[r._anno][r._mese]+=r._avere;
    });
    var colori=['#005CA9','#059669','#D97706','#7C3AED','#DC2626'];
    var header='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface2)"><th style="padding:6px 8px;text-align:left">Mese</th>'+
      anniList.map(function(a,i){ return '<th style="padding:6px 8px;text-align:right;color:'+colori[i]+'">'+a+'</th>'; }).join('')+'</tr></thead><tbody>';
    var rows='';
    for(var m=1;m<=12;m++){
      rows+='<tr style="border-bottom:1px solid var(--border)'+(m%2?';background:var(--surface2)':'')+'">'+
        '<td style="padding:5px 8px;font-weight:600">'+MESI[m]+'</td>'+
        anniList.map(function(a,i){
          var v=byAnnoMese[a][m]||0;
          return '<td style="padding:5px 8px;text-align:right;color:'+(v>0?colori[i]:'var(--text-dim)')+'">'+
            (v>0?'€ '+fmtNum(v):'—')+'</td>';
        }).join('')+'</tr>';
    }
    mmBody.innerHTML=header+rows+'</tbody></table>';
  }

  // ── Tasso incasso per anno ──
  var tBody = G('inc-tasso-body');
  if (tBody) {
    var byAnnoTot={}, byAnnoPag={};
    allIncassiTutti.forEach(function(r){
      if(!r._anno) return;
      var fat=parseFloat(r.totale_fattura)||0;
      byAnnoTot[r._anno]=(byAnnoTot[r._anno]||0)+fat;
      if(r.pagato) byAnnoPag[r._anno]=(byAnnoPag[r._anno]||0)+fat;
    });
    var anni=Object.keys(byAnnoTot).map(Number).sort(function(a,b){return b-a;});
    tBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:var(--surface2)">'+
        '<th style="padding:7px 10px;text-align:left">Anno</th>'+
        '<th style="padding:7px 10px;text-align:right">Fatturato</th>'+
        '<th style="padding:7px 10px;text-align:right">Incassato</th>'+
        '<th style="padding:7px 10px;text-align:right">Insoluto</th>'+
        '<th style="padding:7px 10px;text-align:right">Tasso %</th>'+
      '</tr></thead><tbody>'+
      anni.map(function(a,i){
        var tot=byAnnoTot[a]||0, pag=byAnnoPag[a]||0, ins=tot-pag;
        var tasso=tot>0?(pag/tot*100).toFixed(1):0;
        var colTasso=tasso>=90?'var(--green)':tasso>=70?'#D97706':'var(--red)';
        return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'">'+
          '<td style="padding:6px 10px;font-weight:700">'+a+'</td>'+
          '<td style="padding:6px 10px;text-align:right">€ '+fmtNum(tot)+'</td>'+
          '<td style="padding:6px 10px;text-align:right;color:var(--green);font-weight:600">€ '+fmtNum(pag)+'</td>'+
          '<td style="padding:6px 10px;text-align:right;color:var(--red)">€ '+fmtNum(ins)+'</td>'+
          '<td style="padding:6px 10px;text-align:right">'+
            '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">'+
              '<div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">'+
                '<div style="width:'+tasso+'%;height:100%;background:'+colTasso+';border-radius:3px"></div>'+
              '</div>'+
              '<strong style="color:'+colTasso+'">'+tasso+'%</strong>'+
            '</div></td></tr>';
      }).join('')+'</tbody></table>';
  }
}

// ─────────────────────────────────────────────
//  GRAFICI
// ─────────────────────────────────────────────
function incassiRenderCharts() {
  incassiChartMensile();
  incassiChartMensileSepa();
  incassiChartMetodo();
  incassiChartTopClienti();
  incassiChartAnni();
}

// 1. Andamento mensile anno selezionato (o range)
function incassiChartMensile() {
  var ctxEl=G('inc-chart-mensile'); if(!ctxEl) return;
  var meseMap={}; for(var m=1;m<=12;m++) meseMap[m]=0;
  var societaSel=(G('inc-f-societa')||{}).value||'';
  var metodoSel=(G('inc-f-metodo')||{}).value||'';
  var src=incassiFiltrati;
  src.forEach(function(r){ var m=r._mese; if(m>=1&&m<=12) meseMap[m]+=r._avere; });
  var values=[]; for(var i=1;i<=12;i++) values.push(meseMap[i]);
  var nonZero=values.filter(function(v){return v>0;});
  var media=nonZero.length?nonZero.reduce(function(s,v){return s+v;},0)/nonZero.length:0;
  if(incassiCharts.mensile){try{incassiCharts.mensile.destroy();}catch(e){}}
  incassiCharts.mensile=new Chart(ctxEl,{type:'bar',data:{labels:MESI.slice(1),datasets:[
    {label:'Incassato',data:values,backgroundColor:values.map(function(v){return v===Math.max.apply(null,values)?'#005CA9':'rgba(0,92,169,0.55)';}),borderColor:'#005CA9',borderWidth:1,borderRadius:5,order:2},
    {label:'Media mensile',data:Array(12).fill(media),type:'line',borderColor:'#F59E0B',borderWidth:2,borderDash:[5,4],pointRadius:0,fill:false,order:1}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},
    plugins:{legend:{display:true,labels:{font:{size:11},boxWidth:14}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+fmtNum(c.raw);}}}},
    scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

// 2. SEPA vs Cassa per mese
function incassiChartMensileSepa() {
  var ctxEl=G('inc-chart-sepa'); if(!ctxEl) return;
  var sepaMap={},cassaMap={}; for(var m=1;m<=12;m++){sepaMap[m]=0;cassaMap[m]=0;}
  incassiFiltrati.forEach(function(r){
    var m=r._mese; if(m<1||m>12) return;
    if(incassiMetodo(r)==='SEPA') sepaMap[m]+=r._avere; else cassaMap[m]+=r._avere;
  });
  var sv=[],cv=[]; for(var i=1;i<=12;i++){sv.push(sepaMap[i]);cv.push(cassaMap[i]);}
  if(incassiCharts.sepa){try{incassiCharts.sepa.destroy();}catch(e){}}
  incassiCharts.sepa=new Chart(ctxEl,{type:'bar',data:{labels:MESI.slice(1),datasets:[
    {label:'SEPA',data:sv,backgroundColor:'rgba(142,0,26,0.85)',borderRadius:3},
    {label:'Cassa',data:cv,backgroundColor:'rgba(255,179,0,0.85)',borderRadius:3}
  ]},options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:true,labels:{font:{size:11},boxWidth:12}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+fmtNum(c.raw);}}}},
    scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

// 3. Distribuzione metodo doughnut
function incassiChartMetodo() {
  var ctxEl=G('inc-chart-metodo'); if(!ctxEl) return;
  var ts=0,tc=0;
  incassiFiltrati.forEach(function(r){ if(incassiMetodo(r)==='SEPA') ts+=r._avere; else tc+=r._avere; });
  if(incassiCharts.metodo){try{incassiCharts.metodo.destroy();}catch(e){}}
  incassiCharts.metodo=new Chart(ctxEl,{type:'doughnut',data:{labels:['SEPA','Cassa'],datasets:[{data:[ts,tc],backgroundColor:['rgb(142,0,26)','rgb(255,179,0)'],borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},boxWidth:14,padding:16}},
      tooltip:{callbacks:{label:function(c){return c.label+': €'+fmtNum(c.raw)+' ('+((c.raw/(ts+tc||1))*100).toFixed(1)+'%)';}}}},cutout:'65%'}});
}

// 4. Top 10 clienti
function incassiChartTopClienti() {
  var ctxEl=G('inc-chart-top'); if(!ctxEl) return;
  var byCl={};
  incassiFiltrati.forEach(function(r){ var k=(r.cliente||r.codice_cliente||'N/D').trim(); byCl[k]=(byCl[k]||0)+r._avere; });
  var top=Object.entries(byCl).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  var maxV=top.length?top[0][1]:1;
  if(incassiCharts.top){try{incassiCharts.top.destroy();}catch(e){}}
  incassiCharts.top=new Chart(ctxEl,{type:'bar',data:{
    labels:top.map(function(x){return x[0].length>32?x[0].substring(0,30)+'…':x[0];}),
    datasets:[{label:'Totale €',data:top.map(function(x){return x[1];}),
      backgroundColor:top.map(function(x){return 'rgba(124,58,237,'+(0.4+0.6*x[1]/maxV).toFixed(2)+')';}),borderRadius:4}]
  },options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '€'+fmtNum(c.raw);}}}},
    scales:{x:{ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

// 5. Confronto anni — linee mensili per anno
function incassiChartAnni() {
  var ctxEl=G('inc-chart-anni'); if(!ctxEl) return;
  var anniDisp={};
  incassiFiltrati.forEach(function(r){ if(r._anno) anniDisp[r._anno]=true; });
  var anniList=Object.keys(anniDisp).map(Number).sort(function(a,b){return a-b;}).slice(-6); // max 6 anni
  var colori=['#005CA9','#059669','#D97706','#7C3AED','#DC2626','#0891B2'];
  var datasets=anniList.map(function(anno,idx){
    var meseMap={}; for(var m=1;m<=12;m++) meseMap[m]=null;
    incassiFiltrati.filter(function(r){return r._anno===anno;}).forEach(function(r){
      if(r._mese>=1&&r._mese<=12) meseMap[r._mese]=(meseMap[r._mese]||0)+r._avere;
    });
    return {
      label:String(anno),
      data:Object.values(meseMap),
      borderColor:colori[idx%colori.length],
      backgroundColor:colori[idx%colori.length].replace(')',',0.1)').replace('rgb','rgba'),
      borderWidth:2.5,pointRadius:4,tension:0.3,fill:false
    };
  });
  if(incassiCharts.anni){try{incassiCharts.anni.destroy();}catch(e){}}
  incassiCharts.anni=new Chart(ctxEl,{type:'line',data:{labels:MESI.slice(1),datasets:datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},
      plugins:{legend:{display:true,position:'top',labels:{font:{size:11},boxWidth:16,padding:12}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+fmtNum(c.raw);}}}},
      scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

// ─────────────────────────────────────────────
//  EXPORT EXCEL
// ─────────────────────────────────────────────
function incassiExport() {
  if(!incassiFiltrati.length){toast('Nessun dato da esportare','warning');return;}
  var wb=XLSX.utils.book_new();
  // Riepilogo per anno
  var byA={}; incassiFiltrati.forEach(function(r){var a=r._anno||'?';if(!byA[a])byA[a]={tot:0,sepa:0,cassa:0,n:0,cl:{}};byA[a].tot+=r._avere;byA[a].n++;if(r.codice_cliente)byA[a].cl[r.codice_cliente]=1;if(incassiMetodo(r)==='SEPA')byA[a].sepa+=r._avere;else byA[a].cassa+=r._avere;});
  var sum=[['Anno','Totale €','SEPA €','Cassa €','N° Fatture','Clienti']];
  Object.entries(byA).sort(function(a,b){return b[0]-a[0];}).forEach(function(e){sum.push([e[0],e[1].tot,e[1].sepa,e[1].cassa,e[1].n,Object.keys(e[1].cl).length]);});
  var ws1=XLSX.utils.aoa_to_sheet(sum); ws1['!cols']=[{wch:8},{wch:16},{wch:14},{wch:14},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws1,'Riepilogo Annuale');
  // Dettaglio
  var det=[['Data','Anno','Mese','Ragione Sociale','Cod. Cliente','Società','Riferimento','Tipo','Importo €','Sede']];
  incassiFiltrati.forEach(function(r){det.push([r.data_fattura||'',r._anno||'',MESI[r._mese||0]||'',r.cliente||'',r.codice_cliente||'',r.codice_azienda==='G1000001'?'CNA Roma':'CNA CAF Lazio',(r.riferimento||'').toLowerCase(),r.tipo||'',r._avere,r.unita_operativa||'']);});
  var ws2=XLSX.utils.aoa_to_sheet(det); ws2['!cols']=[{wch:12},{wch:6},{wch:10},{wch:40},{wch:12},{wch:16},{wch:35},{wch:18},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws2,'Dettaglio');
  XLSX.writeFile(wb,'CNA_Incassi_'+new Date().toISOString().substring(0,10)+'.xlsx');
  toast('Export completato','success');
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function fmtNum(n){return Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtInt(n){return Number(n||0).toLocaleString('it-IT');}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
