// ============================================================
//  INCASSI.JS  v5 — dati aggregati via RPC get_incassi_pandora_stats
//  Un solo fetch invece di 250k righe raw
// ============================================================

var incassiLoaded   = false;
var incassiLoading  = false;
var allIncassi      = [];   // righe aggregate {anno,mese,codice_azienda,tipo_pagamento,unita_operativa,avere,n}
var allTasso        = [];   // [{anno,fatturato,incassato}]
var allTopClienti     = [];   // [{codice_cliente,cliente,avere}]
var allClientiUnici   = 0;
var allClientiUniciG1 = 0;
var allClientiUniciG3 = 0;
var incassiFiltrati = [];
var incassiCharts   = {};

function incassiMetodo(r) {
  // La RPC traduce già: D→SEPA, C→Cassa, B→Bonifico
  return r.metodo || 'Cassa';
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
  showLoad('Caricamento statistiche incassi…');

  var r = await fetch(SB + '/rest/v1/rpc/get_incassi_pandora_stats', {
    method: 'POST', headers: H(), body: '{}'
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + await r.text());
  var data = await r.json();

  allIncassi    = data.per_anno_mese || [];
  allTasso      = data.tasso_per_anno || [];
  allTopClienti = data.top_clienti || [];
  // Clienti unici calcolati dai dati filtrati lato client (dinamici per filtri)

  incassiLoaded = true;
  incassiBuildFilters();
  incassiApply();
  hideLoad();
}

// ─────────────────────────────────────────────
//  FILTRI
// ─────────────────────────────────────────────
function incassiBuildFilters() {
  var anniSet = {};
  allIncassi.forEach(function(r){ if(r.anno) anniSet[r.anno] = true; });
  var anni = Object.keys(anniSet).map(Number).sort(function(a,b){ return b-a; });

  ['inc-f-anno-da','inc-f-anno-a'].forEach(function(id) {
    var sel = G(id); if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">—</option>';
    anni.forEach(function(a) {
      sel.innerHTML += '<option value="'+a+'"'+(cur==a?' selected':'')+'>'+a+'</option>';
    });
  });
  // Nessun default: l'utente sceglie il range, di default carica Tutti gli anni
}

function incassiApply() {
  var annoDa  = parseInt((G('inc-f-anno-da')||{}).value||'0')||0;
  var annoA   = parseInt((G('inc-f-anno-a') ||{}).value||'0')||0;
  var meseDa  = parseInt((G('inc-f-mese-da')||{}).value||'0')||0;
  var meseA   = parseInt((G('inc-f-mese-a') ||{}).value||'0')||0;
  var metodo  = (G('inc-f-metodo')  ||{}).value||'';
  var societa = (G('inc-f-societa') ||{}).value||'';

  incassiFiltrati = allIncassi.filter(function(r) {
    var a = r.anno||0, m = r.mese||0;
    if (annoDa && a < annoDa) return false;
    if (annoA  && a > annoA)  return false;
    if (meseDa && meseA) {
      if (meseDa <= meseA) { if (m < meseDa || m > meseA) return false; }
      else { if (m < meseDa && m > meseA) return false; }
    } else if (meseDa && m < meseDa) return false;
    else if (meseA  && m > meseA)  return false;
    if (metodo  && incassiMetodo(r) !== metodo)   return false;
    if (societa && r.codice_azienda !== societa)  return false;
    return true;
  });

  // Calcola clienti unici dinamicamente dai dati filtrati
  var clSet={}, clG1={}, clG3={};
  incassiFiltrati.forEach(function(r){
    if(r.codice_cliente){
      clSet[r.codice_cliente]=1;
      if(r.codice_azienda==='G1000001') clG1[r.codice_cliente]=1;
      if(r.codice_azienda==='G1000003') clG3[r.codice_cliente]=1;
    }
  });
  allClientiUnici   = Object.keys(clSet).length;
  allClientiUniciG1 = Object.keys(clG1).length;
  allClientiUniciG3 = Object.keys(clG3).length;

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

var ISVG = {
  euro:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  receipt:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  users:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  avg:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  sepa:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

function colorToGlow(c){ var m={'var(--blue)':'rgba(0,92,169,.55)','var(--accent2)':'rgba(6,182,212,.55)','var(--accent3)':'rgba(139,92,246,.55)','var(--green)':'rgba(16,185,129,.55)','#0284C7':'rgba(2,132,199,.55)','#D97706':'rgba(217,119,6,.55)','#7C3AED':'rgba(124,58,237,.55)','#059669':'rgba(5,150,105,.55)'}; return m[c]||'rgba(0,92,169,.5)'; }
function kpiCard(icon,label,value,extra,color){ return '<div class="inc-kpi-card" style="border-top:3px solid '+color+';--kpi-glow:'+colorToGlow(color)+'"><div class="inc-kpi-icon" style="color:'+color+'">'+icon+'</div><div class="inc-kpi-body"><div class="inc-kpi-label">'+label+'</div><div class="inc-kpi-value" title="'+value+'">'+value+'</div>'+(extra?'<div class="inc-kpi-sub">'+extra+'</div>':'')+' </div></div>'; }

// ─────────────────────────────────────────────
//  KPI
// ─────────────────────────────────────────────
function incassiRenderKPI() {
  var data    = incassiFiltrati;
  var totale  = data.reduce(function(s,r){ return s+(parseFloat(r.avere)||0); }, 0);
  var numPag  = data.reduce(function(s,r){ return s+(parseInt(r.n)||0); }, 0);
  // Clienti unici: usa il dato globale dalla RPC (filtri per anno/mese cambiano questa stima)
  // Per ora mostriamo il totale globale come indicatore
  var clientiUnici = allClientiUnici;
  var mediaXCliente = clientiUnici > 0 ? totale/clientiUnici : 0;
  var totSepa     = data.filter(function(r){ return incassiMetodo(r)==='SEPA'; }).reduce(function(s,r){ return s+(parseFloat(r.avere)||0); },0);
  var totBonifico = data.filter(function(r){ return incassiMetodo(r)==='Bonifico'; }).reduce(function(s,r){ return s+(parseFloat(r.avere)||0); },0);
  var totG1    = data.filter(function(r){ return r.codice_azienda==='G1000001'; }).reduce(function(s,r){ return s+(parseFloat(r.avere)||0); },0);
  var totG3    = data.filter(function(r){ return r.codice_azienda==='G1000003'; }).reduce(function(s,r){ return s+(parseFloat(r.avere)||0); },0);
  var pctSepa  = totale>0?(totSepa/totale*100).toFixed(1):0;
  // KPI riga 1 usa solo numeri aggregati già disponibili

  // Trend YoY
  var annoDa=parseInt((G('inc-f-anno-da')||{}).value||'0')||0;
  var annoA =parseInt((G('inc-f-anno-a') ||{}).value||'0')||0;
  var trendSub='';
  if(annoDa&&annoA&&annoDa===annoA){
    var totPrev=allIncassi.filter(function(r){return r.anno===annoDa-1;}).reduce(function(s,r){return s+(parseFloat(r.avere)||0);},0);
    if(totPrev>0){var pct=((totale-totPrev)/totPrev*100).toFixed(1);trendSub='<span style="color:'+(pct>=0?'var(--green)':'var(--red)')+'">'+( pct>=0?'▲':'▼')+' '+Math.abs(pct)+'% vs '+(annoDa-1)+'</span>';}
  }

  // Mese migliore
  var byMese={};
  data.forEach(function(r){ if(r.mese) byMese[r.mese]=(byMese[r.mese]||0)+(parseFloat(r.avere)||0); });
  var meseMigl=Object.entries(byMese).sort(function(a,b){return b[1]-a[1];})[0];
  var meseMiglVal=meseMigl?MESI[parseInt(meseMigl[0])]:'—';
  var meseMiglImpo=meseMigl?'€ '+fmtNum(meseMigl[1]):'';

  var el=G('inc-kpi-container'); if(!el) return;
  el.innerHTML=
    kpiCard(ISVG.euro,    'Totale Incassato',  '€ '+fmtNum(totale),       trendSub,               'var(--blue)')+
    kpiCard(ISVG.receipt, 'Fatture Saldate',    fmtInt(numPag),            '',                      'var(--accent2)')+
    kpiCard(ISVG.users,   'Clienti Unici',      fmtInt(clientiUnici),      '',                      'var(--accent3)')+
    kpiCard(ISVG.avg,     'Media / Cliente',    '€ '+fmtNum(mediaXCliente),'',                      'var(--green)')+
    kpiCard(ISVG.euro,    'CNA Roma',           '€ '+fmtNum(totG1),        fmtInt(allClientiUniciG1)+' clienti', '#0284C7')+
    kpiCard(ISVG.euro,    'CNA CAF Lazio',      '€ '+fmtNum(totG3),        fmtInt(allClientiUniciG3)+' clienti', '#D97706')+
    kpiCard(ISVG.users,   'Clienti CNA Roma',   fmtInt(allClientiUniciG1), 'Clienti distinti G1000001','#059669')+
    kpiCard(ISVG.users,   'Clienti CAF Lazio',  fmtInt(allClientiUniciG3), 'Clienti distinti G1000003','#7C3AED')+
    kpiCard(ISVG.sepa,    'SEPA (Dom.)',         '€ '+fmtNum(totSepa),      pctSepa+'% del totale',  '#2563EB')+
    kpiCard(ISVG.calendar,'Mese Migliore',       meseMiglVal,               meseMiglImpo,            '#059669');
}

// ─────────────────────────────────────────────
//  STATISTICHE
// ─────────────────────────────────────────────
function incassiRenderStats() {
  var data=incassiFiltrati;
  var totGlob=data.reduce(function(s,r){return s+(parseFloat(r.avere)||0);},0);

  // Per sede
  var sBody=G('inc-sede-body');
  if(sBody){
    var bySede={};
    data.forEach(function(r){var k=r.unita_operativa||'Non specificata';if(!bySede[k])bySede[k]={tot:0,n:0,cl:{}};bySede[k].tot+=(parseFloat(r.avere)||0);bySede[k].n+=(parseInt(r.n)||0);if(r.codice_cliente)bySede[k].cl[r.codice_cliente]=1;});
    var sr=Object.entries(bySede).sort(function(a,b){return b[1].tot-a[1].tot;});
    sBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Sede</th><th style="padding:7px 10px;text-align:right">Incassato</th><th style="padding:7px 10px;text-align:right">%</th><th style="padding:7px 10px;text-align:right">N°</th><th style="padding:7px 10px;text-align:right">Clienti</th></tr></thead><tbody>'+
      sr.map(function(e,i){var pct=totGlob>0?(e[1].tot/totGlob*100).toFixed(1):0;return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'"><td style="padding:6px 10px">'+e[0]+'</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ '+fmtNum(e[1].tot)+'</td><td style="padding:6px 10px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><div style="width:50px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:var(--blue);border-radius:3px"></div></div>'+pct+'%</div></td><td style="padding:6px 10px;text-align:right">'+fmtInt(e[1].n)+'</td><td style="padding:6px 10px;text-align:right">'+Object.keys(e[1].cl).length+'</td></tr>';}).join('')+'</tbody></table>';
  }

  // Per metodo + società
  var mBody=G('inc-metodo-body');
  if(mBody){
    var byM={SEPA:{tot:0,n:0},Cassa:{tot:0,n:0},Bonifico:{tot:0,n:0}};
    data.forEach(function(r){var m=incassiMetodo(r);if(!byM[m])byM[m]={tot:0,n:0};byM[m].tot+=(parseFloat(r.avere)||0);byM[m].n+=(parseInt(r.n)||0);});
    var byS={G1000001:{tot:0,n:0},G1000003:{tot:0,n:0}};
    data.forEach(function(r){var s=r.codice_azienda;if(byS[s]){byS[s].tot+=(parseFloat(r.avere)||0);byS[s].n+=(parseInt(r.n)||0);}});
    mBody.innerHTML=
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px"><thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Metodo</th><th style="padding:7px 10px;text-align:right">€</th><th style="padding:7px 10px;text-align:right">%</th><th style="padding:7px 10px;text-align:right">N°</th></tr></thead><tbody>'+
      [['SEPA','#0284C7'],['Cassa','#059669'],['Bonifico','#7C3AED']].map(function(p){var d=byM[p[0]]||{tot:0,n:0};var pct=totGlob>0?(d.tot/totGlob*100).toFixed(1):0;return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+p[1]+';display:inline-block"></span><strong>'+p[0]+'</strong></span></td><td style="padding:7px 10px;text-align:right;font-weight:600;color:'+p[1]+'">€ '+fmtNum(d.tot)+'</td><td style="padding:7px 10px;text-align:right">'+pct+'%</td><td style="padding:7px 10px;text-align:right">'+fmtInt(d.n)+'</td></tr>';}).join('')+'</tbody></table>'+
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:8px">Per Società</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Società</th><th style="padding:7px 10px;text-align:right">€</th><th style="padding:7px 10px;text-align:right">%</th><th style="padding:7px 10px;text-align:right">N°</th></tr></thead><tbody>'+
      [['G1000001','CNA Roma','#2563EB'],['G1000003','CAF Lazio','#D97706']].map(function(t){var d=byS[t[0]]||{tot:0,n:0};var pct=totGlob>0?(d.tot/totGlob*100).toFixed(1):0;return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+t[2]+';display:inline-block"></span><strong>'+t[1]+'</strong></span></td><td style="padding:7px 10px;text-align:right;font-weight:600;color:'+t[2]+'">€ '+fmtNum(d.tot)+'</td><td style="padding:7px 10px;text-align:right">'+pct+'%</td><td style="padding:7px 10px;text-align:right">'+fmtInt(d.n)+'</td></tr>';}).join('')+'</tbody></table>';
  }

  // Riepilogo annuale
  var annoDa2=parseInt((G('inc-f-anno-da')||{}).value||'0')||0;
  var annoA2 =parseInt((G('inc-f-anno-a') ||{}).value||'0')||0;
  var aWrap=G('inc-anno-wrapper');
  if(aWrap){
    if(!(annoDa2&&annoA2&&annoDa2===annoA2)){
      var byAnno={};
      incassiFiltrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,n:0,cl:{}};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);if(r.codice_cliente)byAnno[a].cl[r.codice_cliente]=1;});
      var anniS=Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];});
      aWrap.innerHTML=anniS.length?'<div class="inc-stat-card inc-full"><div class="inc-stat-header">'+ISVG.calendar+'<span>Riepilogo Annuale</span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Anno</th><th style="padding:7px 10px;text-align:right">Totale</th><th style="padding:7px 10px;text-align:right">Var. %</th><th style="padding:7px 10px;text-align:right">N° Fatture</th><th style="padding:7px 10px;text-align:right">Clienti</th></tr></thead><tbody>'+anniS.map(function(e,i){var prev=anniS[i+1];var varPct=prev&&prev[1].tot>0?((e[1].tot-prev[1].tot)/prev[1].tot*100).toFixed(1):null;var varH=varPct!==null?'<span style="color:'+(varPct>=0?'var(--green)':'var(--red)')+'">'+( varPct>=0?'▲':'▼')+' '+Math.abs(varPct)+'%</span>':'—';return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'"><td style="padding:6px 10px;font-weight:700">'+e[0]+'</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--blue)">€ '+fmtNum(e[1].tot)+'</td><td style="padding:6px 10px;text-align:right">'+varH+'</td><td style="padding:6px 10px;text-align:right">'+fmtInt(e[1].n)+'</td><td style="padding:6px 10px;text-align:right">'+Object.keys(e[1].cl).length+'</td></tr>';}).join('')+'</tbody></table></div>':'';
    } else aWrap.innerHTML='';
  }

  // Media mensile per anno
  var mmBody=G('inc-mese-stats-body');
  if(mmBody){
    var anniDisp={};incassiFiltrati.forEach(function(r){if(r.anno)anniDisp[r.anno]=true;});
    var anniList=Object.keys(anniDisp).map(Number).sort(function(a,b){return b-a;}).slice(0,5);
    var byAM={};anniList.forEach(function(a){byAM[a]={};for(var m=1;m<=12;m++)byAM[a][m]=0;});
    incassiFiltrati.forEach(function(r){if(byAM[r.anno]&&r.mese)byAM[r.anno][r.mese]+=(parseFloat(r.avere)||0);});
    var cols=['#005CA9','#059669','#D97706','#7C3AED','#DC2626'];
    mmBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface2)"><th style="padding:6px 8px;text-align:left">Mese</th>'+anniList.map(function(a,i){return '<th style="padding:6px 8px;text-align:right;color:'+cols[i]+'">'+a+'</th>';}).join('')+'</tr></thead><tbody>'+[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m,mi){return '<tr style="border-bottom:1px solid var(--border)'+(mi%2?';background:var(--surface2)':'')+'"><td style="padding:5px 8px;font-weight:600">'+MESI[m]+'</td>'+anniList.map(function(a,i){var v=(byAM[a]||{})[m]||0;return '<td style="padding:5px 8px;text-align:right;color:'+(v>0?cols[i]:'var(--text-dim)')+'">'+( v>0?'€ '+fmtNum(v):'—')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';
  }

  // Tasso incasso
  var tBody=G('inc-tasso-body');
  if(tBody&&allTasso.length){
    // Aggrega tasso per anno (filtra per società se selezionata)
    var societaFilt=(G('inc-f-societa')||{}).value||'';
    var tassoByAnno={};
    allTasso.forEach(function(t){
      if(societaFilt && t.codice_azienda !== societaFilt) return;
      var a=t.anno;
      if(!tassoByAnno[a]) tassoByAnno[a]={fat:0,pag:0};
      tassoByAnno[a].fat+=parseFloat(t.fatturato)||0;
      tassoByAnno[a].pag+=parseFloat(t.incassato)||0;
    });
    var tassoRows=Object.entries(tassoByAnno).sort(function(a,b){return b[0]-a[0];});
    tBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:7px 10px;text-align:left">Anno</th><th style="padding:7px 10px;text-align:right">Fatturato</th><th style="padding:7px 10px;text-align:right">Incassato</th><th style="padding:7px 10px;text-align:right">Insoluto</th><th style="padding:7px 10px;text-align:right">Tasso %</th></tr></thead><tbody>'+
      tassoRows.map(function(e,i){var fat=e[1].fat,pag=e[1].pag,ins=fat-pag;var tasso=fat>0?(pag/fat*100).toFixed(1):0;var col=tasso>=90?'var(--green)':tasso>=70?'#D97706':'var(--red)';return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'"><td style="padding:6px 10px;font-weight:700">'+e[0]+'</td><td style="padding:6px 10px;text-align:right">€ '+fmtNum(fat)+'</td><td style="padding:6px 10px;text-align:right;color:var(--green);font-weight:600">€ '+fmtNum(pag)+'</td><td style="padding:6px 10px;text-align:right;color:var(--red)">€ '+fmtNum(ins)+'</td><td style="padding:6px 10px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:'+tasso+'%;height:100%;background:'+col+';border-radius:3px"></div></div><strong style="color:'+col+'">'+tasso+'%</strong></div></td></tr>';}).join('')+'</tbody></table>';
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

function incassiChartMensile() {
  var ctxEl=G('inc-chart-mensile'); if(!ctxEl)return;
  var meseMap={}; for(var m=1;m<=12;m++) meseMap[m]=0;
  incassiFiltrati.forEach(function(r){var m=r.mese;if(m>=1&&m<=12)meseMap[m]+=(parseFloat(r.avere)||0);});
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

function incassiChartMensileSepa() {
  var ctxEl=G('inc-chart-sepa'); if(!ctxEl)return;
  var sepaMap={},cassaMap={}; for(var m=1;m<=12;m++){sepaMap[m]=0;cassaMap[m]=0;}
  var bonMap={}; for(var m3=1;m3<=12;m3++) bonMap[m3]=0;
  incassiFiltrati.forEach(function(r){var m=r.mese;if(m<1||m>12)return;var met=incassiMetodo(r);if(met==='SEPA')sepaMap[m]+=(parseFloat(r.avere)||0);else if(met==='Bonifico')bonMap[m]+=(parseFloat(r.avere)||0);else cassaMap[m]+=(parseFloat(r.avere)||0);});
  var sv=[],cv=[],bv=[]; for(var i=1;i<=12;i++){sv.push(sepaMap[i]);cv.push(cassaMap[i]);bv.push(bonMap[i]);}
  if(incassiCharts.sepa){try{incassiCharts.sepa.destroy();}catch(e){}}
  incassiCharts.sepa=new Chart(ctxEl,{type:'bar',data:{labels:MESI.slice(1),datasets:[{label:'SEPA (Dom.)',data:sv,backgroundColor:'rgba(37,99,235,0.85)',borderRadius:3},{label:'Cassa',data:cv,backgroundColor:'rgba(255,179,0,0.85)',borderRadius:3},{label:'Bonifico',data:bv,backgroundColor:'rgba(124,58,237,0.75)',borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{font:{size:11},boxWidth:12}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+fmtNum(c.raw);}}}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

function incassiChartMetodo() {
  var ctxEl=G('inc-chart-metodo'); if(!ctxEl)return;
  var ts=0,tc=0;
  incassiFiltrati.forEach(function(r){if(incassiMetodo(r)==='SEPA')ts+=(parseFloat(r.avere)||0);else tc+=(parseFloat(r.avere)||0);});
  if(incassiCharts.metodo){try{incassiCharts.metodo.destroy();}catch(e){}}
  var totTot2=ts+tc+tb||1;incassiCharts.metodo=new Chart(ctxEl,{type:'doughnut',data:{labels:['SEPA (Dom.)','Cassa','Bonifico'],datasets:[{data:[ts,tc,tb],backgroundColor:['rgb(37,99,235)','rgb(255,179,0)','rgb(124,58,237)'],borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},boxWidth:14,padding:16}},tooltip:{callbacks:{label:function(c){return c.label+': €'+fmtNum(c.raw)+' ('+(c.raw/totTot2*100).toFixed(1)+'%)';}}}},cutout:'65%'}});
}

function incassiChartTopClienti() {
  var ctxEl=G('inc-chart-top'); if(!ctxEl)return;
  // Usa top clienti pre-aggregati dalla RPC (più accurati, non dipendono dai filtri)
  var top = allTopClienti.slice(0,10).map(function(t){ return [t.cliente||t.codice_cliente||'N/D', parseFloat(t.avere)||0]; });
  if(!top.length) {
    // Fallback: aggrega dai dati filtrati (quando filtri riducono il set)
    var byCl={};
    incassiFiltrati.forEach(function(r){var k=(r.unita_operativa||'N/D').trim();byCl[k]=(byCl[k]||0)+(parseFloat(r.avere)||0);});
    top=Object.entries(byCl).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  }
  var maxV=top.length?top[0][1]:1;
  if(incassiCharts.top){try{incassiCharts.top.destroy();}catch(e){}}
  incassiCharts.top=new Chart(ctxEl,{type:'bar',data:{labels:top.map(function(x){return x[0].length>32?x[0].substring(0,30)+'…':x[0];}),datasets:[{label:'Totale €',data:top.map(function(x){return x[1];}),backgroundColor:top.map(function(x){return 'rgba(124,58,237,'+(0.4+0.6*x[1]/maxV).toFixed(2)+')';}),borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '€'+fmtNum(c.raw);}}}},scales:{x:{ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

function incassiChartAnni() {
  var ctxEl=G('inc-chart-anni'); if(!ctxEl)return;
  var anniDisp={};incassiFiltrati.forEach(function(r){if(r.anno)anniDisp[r.anno]=true;});
  var anniList=Object.keys(anniDisp).map(Number).sort(function(a,b){return a-b;}).slice(-6);
  var colori=['#005CA9','#059669','#D97706','#7C3AED','#DC2626','#0891B2'];
  var datasets=anniList.map(function(anno,idx){
    var meseMap={}; for(var m=1;m<=12;m++) meseMap[m]=null;
    incassiFiltrati.filter(function(r){return r.anno===anno;}).forEach(function(r){if(r.mese>=1&&r.mese<=12)meseMap[r.mese]=(meseMap[r.mese]||0)+(parseFloat(r.avere)||0);});
    return {label:String(anno),data:Object.values(meseMap),borderColor:colori[idx%colori.length],backgroundColor:colori[idx%colori.length].replace('rgb(','rgba(').replace(')',',0.1)'),borderWidth:2.5,pointRadius:4,tension:0.3,fill:false};
  });
  if(incassiCharts.anni){try{incassiCharts.anni.destroy();}catch(e){}}
  incassiCharts.anni=new Chart(ctxEl,{type:'line',data:{labels:MESI.slice(1),datasets:datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},plugins:{legend:{display:true,position:'top',labels:{font:{size:11},boxWidth:16,padding:12}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+fmtNum(c.raw);}}}},scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '€'+fmtInt(v);}}}}}});
}

// ─────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────
function incassiExport() {
  if(!incassiFiltrati.length){toast('Nessun dato','warning');return;}
  var wb=XLSX.utils.book_new();
  var byAnno={};incassiFiltrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,sepa:0,cassa:0,n:0,cl:{}};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);if(r.codice_cliente)byAnno[a].cl[r.codice_cliente]=1;if(incassiMetodo(r)==='SEPA')byAnno[a].sepa+=(parseFloat(r.avere)||0);else byAnno[a].cassa+=(parseFloat(r.avere)||0);});
  var sum=[['Anno','Totale €','SEPA €','Cassa €','N° Fatture','Clienti']];
  Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];}).forEach(function(e){sum.push([e[0],e[1].tot,e[1].sepa,e[1].cassa,e[1].n,Object.keys(e[1].cl).length]);});
  var ws=XLSX.utils.aoa_to_sheet(sum);ws['!cols']=[{wch:8},{wch:16},{wch:14},{wch:14},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,'Riepilogo');
  XLSX.writeFile(wb,'CNA_Incassi_'+new Date().toISOString().substring(0,10)+'.xlsx');
  toast('Export completato','success');
}

function fmtNum(n){return Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtInt(n){return Number(n||0).toLocaleString('it-IT');}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
