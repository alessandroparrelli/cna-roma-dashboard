// ============================================================
//  INCASSI.JS  v7 — Cache tables REST, nessuna RPC, nessun timeout
//  Fonte: incassi_stats_cache (367 righe), incassi_tasso_cache,
//         incassi_top_cache, incassi_clienti_cache
// ============================================================
'use strict';

var incassiLoaded  = false;
var incassiLoading = false;
var allStats    = [];   // {anno,mese,codice_azienda,metodo,avere,n}
var allTasso    = [];   // {anno,codice_azienda,fatturato,incassato}
var allTop      = [];   // {codice_cliente,cliente,codice_azienda,avere}
var allClienti  = [];   // {anno,codice_azienda,clienti_unici}
var filtrati    = [];
var charts      = {};

// ─── Entry point ───────────────────────────────────────────
async function incassiInit() {
  if (incassiLoading) return;
  if (incassiLoaded) { incassiRender(); return; }
  incassiLoading = true;
  showLoad('Caricamento incassi…');
  try { await incassiLoad(); }
  catch(e) { toast('Errore incassi: ' + e.message, 'error'); console.error(e); }
  finally { incassiLoading = false; hideLoad(); }
}

async function incassiLoad(force) {
  if (incassiLoaded && !force) return;
  showLoad('Caricamento statistiche…');

  var [r1,r2,r3,r4] = await Promise.all([
    fetch(SB+'/rest/v1/incassi_stats_cache?select=*&order=anno.asc,mese.asc', {headers:H()}),
    fetch(SB+'/rest/v1/incassi_tasso_cache?select=*&order=anno.desc',          {headers:H()}),
    fetch(SB+'/rest/v1/incassi_top_cache?select=*&order=avere.desc&limit=50',  {headers:H()}),
    fetch(SB+'/rest/v1/incassi_clienti_cache?select=*',                        {headers:H()})
  ]);

  if (!r1.ok) throw new Error('stats_cache HTTP '+r1.status);
  allStats   = await r1.json();
  allTasso   = r2.ok ? await r2.json() : [];
  allTop     = r3.ok ? await r3.json() : [];
  allClienti = r4.ok ? await r4.json() : [];

  incassiLoaded = true;
  incassiBuildFilters();
  incassiApply();
  hideLoad();
}

// ─── Filtri ────────────────────────────────────────────────
function incassiBuildFilters() {
  var anniSet = {};
  allStats.forEach(function(r){ if(r.anno) anniSet[r.anno]=true; });
  var anni = Object.keys(anniSet).map(Number).sort(function(a,b){return b-a;});
  ['inc-f-anno-da','inc-f-anno-a'].forEach(function(id){
    var sel=G(id); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">—</option>';
    anni.forEach(function(a){ sel.innerHTML+='<option value="'+a+'"'+(String(cur)===String(a)?' selected':'')+'>'+a+'</option>'; });
  });
}

function filtro() {
  return {
    annoDa:  parseInt((G('inc-f-anno-da')||{}).value||0)||0,
    annoA:   parseInt((G('inc-f-anno-a') ||{}).value||0)||0,
    meseDa:  parseInt((G('inc-f-mese-da')||{}).value||0)||0,
    meseA:   parseInt((G('inc-f-mese-a') ||{}).value||0)||0,
    metodo:  ((G('inc-f-metodo') ||{}).value||'').trim(),
    societa: ((G('inc-f-societa')||{}).value||'').trim()
  };
}

async function incassiApply() {
  _clCache = {};
  var f = filtro();

  // Feedback visivo sul pulsante
  var btn = G('inc-btn-applica');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Calcolo…'; }

  // 1. Filtra i dati aggregati dalla cache locale (istantaneo)
  filtrati = allStats.filter(function(r) {
    var a = r.anno||0, m = r.mese||0;
    if (f.annoDa && a < f.annoDa) return false;
    if (f.annoA  && a > f.annoA)  return false;
    if (f.meseDa && f.meseA) {
      if(f.meseDa<=f.meseA){if(m<f.meseDa||m>f.meseA)return false;}
      else{if(m<f.meseDa&&m>f.meseA)return false;}
    } else if(f.meseDa&&m<f.meseDa) return false;
      else if(f.meseA &&m>f.meseA)  return false;
    if (f.metodo  && r.metodo         !== f.metodo)  return false;
    if (f.societa && r.codice_azienda !== f.societa) return false;
    return true;
  });

  // 2. Carica clienti unici con filtro anni PRIMA del render (valore esatto)
  try {
    var body = {};
    if (f.annoDa) body.p_anno_da = f.annoDa;
    if (f.annoA)  body.p_anno_a  = f.annoA;
    var rCl = await fetch(SB+'/rest/v1/rpc/get_clienti_unici_range', {
      method:'POST', headers:H(), body:JSON.stringify(body)
    });
    if (rCl.ok) {
      var dCl = await rCl.json();
      _clCache['G1000001'] = parseInt(dCl.g1)||0;
      _clCache['G1000003'] = parseInt(dCl.g3)||0;
    }
  } catch(e) { /* usa fallback dalla cache locale */ }

  // 3. Render completo — tutti i dati sono pronti
  incassiRender();

  // Ripristina pulsante
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Applica filtri';
  }
}

function incassiReset() {
  ['inc-f-anno-da','inc-f-anno-a','inc-f-mese-da','inc-f-mese-a','inc-f-metodo','inc-f-societa'].forEach(function(id){
    var el=G(id); if(el) el.value='';
  });
  incassiApply();
}

// ─── KPI helpers ───────────────────────────────────────────
function sum(arr, key) { return arr.reduce(function(s,r){return s+(parseFloat(r[key])||0);},0); }
function sumN(arr)     { return arr.reduce(function(s,r){return s+(parseInt(r.n)||0);},0); }
function glow(c){return({'var(--blue)':'rgba(0,92,169,.55)','var(--accent2)':'rgba(6,182,212,.55)','#0284C7':'rgba(2,132,199,.55)','#D97706':'rgba(217,119,6,.55)','#059669':'rgba(5,150,105,.55)','#7C3AED':'rgba(124,58,237,.55)','#2563EB':'rgba(37,99,235,.55)','var(--green)':'rgba(16,185,129,.55)'}[c]||'rgba(0,92,169,.5)');}

function kpi(icon,label,value,sub,color) {
  return '<div class="inc-kpi-card" style="border-top:3px solid '+color+';--kpi-glow:'+glow(color)+'">'
    +'<div class="inc-kpi-icon" style="color:'+color+'">'+icon+'</div>'
    +'<div class="inc-kpi-body">'
      +'<div class="inc-kpi-label">'+label+'</div>'
      +'<div class="inc-kpi-value">'+value+'</div>'
      +(sub?'<div class="inc-kpi-sub">'+sub+'</div>':'')
    +'</div></div>';
}

var SVG = {
  euro:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  receipt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  users:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  sepa:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  cal:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

// ─── Clienti unici — RPC con filtro anni ─────────────────
var _clCache = {};  // cache risultati RPC per evitare fetch ripetuti

function clientiUnici(societa) {
  // Restituisce il valore in cache (aggiornato da incassiAggiornaCl)
  var key = societa || 'all';
  if (_clCache[key] !== undefined) return _clCache[key];
  // Fallback: usa la cache per anno singolo
  var f = filtro();
  var src = allClienti.filter(function(r){
    if (r.codice_azienda !== societa) return false;
    if (f.annoDa && f.annoA && f.annoDa === f.annoA) return r.anno === f.annoDa;
    return true;
  });
  if (f.annoDa && f.annoA && f.annoDa === f.annoA) {
    return src.reduce(function(s,r){return s+(parseInt(r.clienti_unici)||0);},0);
  }
  // Senza filtro anno: usa valore massimo anno più recente come stima
  var sorted = src.slice().sort(function(a,b){return b.anno-a.anno;});
  return sorted.length ? (parseInt(sorted[0].clienti_unici)||0) : 0;
}

// incassiAggiornaCl rimossa — logica integrata in incassiApply async


// ─── RENDER ────────────────────────────────────────────────
function incassiRender() {
  incassiRenderKPI();
  incassiRenderStats();
  incassiRenderCharts();
}

function incassiRenderKPI() {
  var f   = filtro();
  var tot = sum(filtrati,'avere');
  var nFat= sumN(filtrati);
  var totG1 = sum(filtrati.filter(function(r){return r.codice_azienda==='G1000001';}),'avere');
  var totG3 = sum(filtrati.filter(function(r){return r.codice_azienda==='G1000003';}),'avere');
  var totSepa=sum(filtrati.filter(function(r){return r.metodo==='SEPA';}),'avere');
  var pctSepa=tot>0?(totSepa/tot*100).toFixed(1):0;
  var clG1=clientiUnici('G1000001');
  var clG3=clientiUnici('G1000003');

  // Trend YoY
  var trendSub='';
  if(f.annoDa&&f.annoA&&f.annoDa===f.annoA){
    var prev=sum(allStats.filter(function(r){return r.anno===f.annoDa-1&&(!f.societa||r.codice_azienda===f.societa)&&(!f.metodo||r.metodo===f.metodo);}), 'avere');
    if(prev>0){var p=((tot-prev)/prev*100).toFixed(1);trendSub='<span style="color:'+(p>=0?'var(--green)':'var(--red)')+'">'+( p>=0?'▲':'▼')+' '+Math.abs(p)+'% vs '+(f.annoDa-1)+'</span>';}
  }

  // Mese migliore
  var mm={}; filtrati.forEach(function(r){if(r.mese)mm[r.mese]=(mm[r.mese]||0)+(parseFloat(r.avere)||0);});
  var mb=Object.entries(mm).sort(function(a,b){return b[1]-a[1];})[0];

  var el=G('inc-kpi-container'); if(!el) return;
  el.innerHTML=
    kpi(SVG.euro,   'Totale Incassato', '€ '+N(tot),          trendSub,                             'var(--blue)')+
    kpi(SVG.receipt,'Fatture Saldate',   I(nFat),             '',                                    'var(--accent2)')+
    kpi(SVG.euro,   'CNA Roma',   '€ '+N(totG1), I(clG1)+' clienti unici', '#0284C7')+
    kpi(SVG.euro,   'CNA CAF Lazio', '€ '+N(totG3), I(clG3)+' clienti unici', '#D97706')+
    kpi(SVG.users,  'Clienti unici CNA',        I(clG1), 'distinti nel periodo', '#059669')+
    kpi(SVG.users,  'Clienti unici CNA CAF Lazio', I(clG3), 'distinti nel periodo', '#7C3AED')+
    kpi(SVG.sepa,   'SEPA',              '€ '+N(totSepa),     pctSepa+'% del totale',                '#2563EB')+
    kpi(SVG.cal,    'Mese Migliore',     mb?MESI[+mb[0]]:'—', mb?'€ '+N(mb[1]):'',                  '#059669');
}

// ─── Stats ─────────────────────────────────────────────────
function incassiRenderStats() {
  var f=filtro();
  var tot=sum(filtrati,'avere');

  // Per sede: rimosso

  // Per metodo + società
  var mBody=G('inc-metodo-body');
  if(mBody){
    var byM={SEPA:{tot:0,n:0},Cassa:{tot:0,n:0},Bonifico:{tot:0,n:0}};
    filtrati.forEach(function(r){var m=r.metodo||'Cassa';if(!byM[m])byM[m]={tot:0,n:0};byM[m].tot+=(parseFloat(r.avere)||0);byM[m].n+=(parseInt(r.n)||0);});
    var byS={G1000001:{tot:0,n:0},G1000003:{tot:0,n:0}};
    filtrati.forEach(function(r){if(byS[r.codice_azienda]){byS[r.codice_azienda].tot+=(parseFloat(r.avere)||0);byS[r.codice_azienda].n+=(parseInt(r.n)||0);}});
    mBody.innerHTML=
      tbl(['Metodo','Importo','%','N°'],[['SEPA','#0284C7'],['Cassa','#059669'],['Bonifico','#7C3AED']].map(function(p,i){var d=byM[p[0]]||{tot:0,n:0};var pc=tot>0?(d.tot/tot*100).toFixed(1):0;return row(i,['<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:'+p[1]+';display:inline-block"></span><strong>'+p[0]+'</strong></span>','<span style="color:'+p[1]+';font-weight:600">€ '+N(d.tot)+'</span>',pc+'%',I(d.n)]);}))
      +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin:14px 0 6px">Per Società</div>'
      +tbl(['Società','Importo','%','N°'],[['G1000001','CNA Roma','#2563EB'],['G1000003','CAF Lazio','#D97706']].map(function(t,i){var d=byS[t[0]]||{tot:0,n:0};var pc=tot>0?(d.tot/tot*100).toFixed(1):0;return row(i,['<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:'+t[2]+';display:inline-block"></span><strong>'+t[1]+'</strong></span>','<span style="color:'+t[2]+';font-weight:600">€ '+N(d.tot)+'</span>',pc+'%',I(d.n)]);}));
  }

  // Riepilogo annuale
  var aWrap=G('inc-anno-wrapper');
  if(aWrap){
    var byAnno={};filtrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,n:0};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);});
    var anniS=Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];});
    aWrap.innerHTML=anniS.length>1?'<div class="inc-stat-card inc-full"><div class="inc-stat-header">'+SVG.cal+'<span>Riepilogo Annuale</span></div>'
      +tbl(['Anno','Totale','Var. %','N°'],anniS.map(function(e,i){var prev=anniS[i+1];var vp=prev&&prev[1].tot>0?((e[1].tot-prev[1].tot)/prev[1].tot*100).toFixed(1):null;var vh=vp!=null?'<span style="color:'+(vp>=0?'var(--green)':'var(--red)')+'">'+( vp>=0?'▲':'▼')+' '+Math.abs(vp)+'%</span>':'—';return row(i,['<strong>'+e[0]+'</strong>','<span style="color:var(--blue);font-weight:600">€ '+N(e[1].tot)+'</span>',vh,I(e[1].n)]);}))
      +'</div>':'';
  }

  // Totale mensile per anno (ex "media" — ora totale effettivo)
  var mmBody=G('inc-mese-stats-body');
  if(mmBody){
    var anniD={};filtrati.forEach(function(r){if(r.anno)anniD[r.anno]=true;});
    var anniL=Object.keys(anniD).map(Number).sort(function(a,b){return b-a;}).slice(0,5);
    var byAM={};anniL.forEach(function(a){byAM[a]={};for(var m=1;m<=12;m++)byAM[a][m]=0;});
    filtrati.forEach(function(r){if(byAM[r.anno]&&r.mese)byAM[r.anno][r.mese]+=(parseFloat(r.avere)||0);});
    var c=['#005CA9','#059669','#D97706','#7C3AED','#DC2626'];
    mmBody.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface2)"><th style="padding:6px 8px;text-align:left">Mese</th>'+anniL.map(function(a,i){return '<th style="padding:6px 8px;text-align:right;color:'+c[i]+'">'+a+'</th>';}).join('')+'</tr></thead><tbody>'+[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m,mi){return '<tr style="border-bottom:1px solid var(--border)'+(mi%2?';background:var(--surface2)':'')+'"><td style="padding:5px 8px;font-weight:600">'+MESI[m]+'</td>'+anniL.map(function(a,i){var v=(byAM[a]||{})[m]||0;return '<td style="padding:5px 8px;text-align:right;color:'+(v>0?c[i]:'var(--text-dim)')+'">'+( v>0?'€ '+N(v):'—')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';
  }

  // Tasso incasso per anno
  var tBody=G('inc-tasso-body');
  if(tBody){
    var byAnnoT={};
    allTasso.forEach(function(t){
      if(f.societa&&t.codice_azienda!==f.societa) return;
      if(f.annoDa&&t.anno<f.annoDa) return;
      if(f.annoA&&t.anno>f.annoA) return;
      if(!byAnnoT[t.anno]) byAnnoT[t.anno]={fat:0,pag:0};
      byAnnoT[t.anno].fat+=parseFloat(t.fatturato)||0;
      byAnnoT[t.anno].pag+=parseFloat(t.incassato)||0;
    });
    var tr2=Object.entries(byAnnoT).sort(function(a,b){return b[0]-a[0];});
    tBody.innerHTML=tbl(['Anno','Fatturato','Incassato','Insoluto','Tasso %'],tr2.map(function(e,i){var fat=e[1].fat,pag=e[1].pag,ins=fat-pag,tasso=fat>0?(pag/fat*100).toFixed(1):0,col=tasso>=90?'var(--green)':tasso>=70?'#D97706':'var(--red)';return row(i,['<strong>'+e[0]+'</strong>','€ '+N(fat),'<span style="color:var(--green);font-weight:600">€ '+N(pag)+'</span>','<span style="color:var(--red)">€ '+N(ins)+'</span>','<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px"><div style="width:50px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:'+tasso+'%;height:100%;background:'+col+'"></div></div><strong style="color:'+col+'">'+tasso+'%</strong></div>']);}));
  }
}

// ─── Chart ─────────────────────────────────────────────────
function incassiRenderCharts() {
  chartMensile();
  chartMetodo();
  chartAnni();
}

function chartMensile() {
  var ctxEl=G('inc-chart-mensile'); if(!ctxEl) return;
  var sm={},cm={},bm={};
  for(var m=1;m<=12;m++){sm[m]=0;cm[m]=0;bm[m]=0;}
  filtrati.forEach(function(r){var m=r.mese;if(m<1||m>12)return;if(r.metodo==='SEPA')sm[m]+=(parseFloat(r.avere)||0);else if(r.metodo==='Bonifico')bm[m]+=(parseFloat(r.avere)||0);else cm[m]+=(parseFloat(r.avere)||0);});
  var sv=[],cv=[],bv=[],tv=[];
  for(var i=1;i<=12;i++){sv.push(sm[i]);cv.push(cm[i]);bv.push(bm[i]);tv.push(sm[i]+cm[i]+bm[i]);}
  var nz=tv.filter(Boolean);var med=nz.length?nz.reduce(function(s,v){return s+v;},0)/nz.length:0;
  if(charts.mensile){try{charts.mensile.destroy();}catch(e){}}
  charts.mensile=new Chart(ctxEl,{type:'bar',
    data:{labels:MESI.slice(1),datasets:[
      {label:'SEPA',data:sv,backgroundColor:'rgba(37,99,235,.8)',borderRadius:3},
      {label:'Cassa',data:cv,backgroundColor:'rgba(255,179,0,.8)',borderRadius:3},
      {label:'Bonifico',data:bv,backgroundColor:'rgba(124,58,237,.75)',borderRadius:3},
      {label:'Media',data:Array(12).fill(med),type:'line',borderColor:'#EF4444',borderWidth:2,borderDash:[5,4],pointRadius:0,fill:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},
      plugins:{legend:{display:true,position:'top',labels:{font:{size:11},boxWidth:12}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+N(c.raw);}}}},
      scales:{x:{stacked:true},y:{stacked:false,beginAtZero:true,ticks:{callback:function(v){return '€'+I(v);}}}}}});
}

function chartMetodo() {
  var ctxEl=G('inc-chart-metodo'); if(!ctxEl) return;
  var ts=0,tc=0,tb=0;
  filtrati.forEach(function(r){var m=r.metodo||'Cassa';if(m==='SEPA')ts+=(parseFloat(r.avere)||0);else if(m==='Bonifico')tb+=(parseFloat(r.avere)||0);else tc+=(parseFloat(r.avere)||0);});
  if(charts.metodo){try{charts.metodo.destroy();}catch(e){}}
  var tt=ts+tc+tb||1;
  charts.metodo=new Chart(ctxEl,{type:'doughnut',
    data:{labels:['SEPA','Cassa','Bonifico'],datasets:[{data:[ts,tc,tb],backgroundColor:['rgb(37,99,235)','rgb(255,179,0)','rgb(124,58,237)'],borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},boxWidth:14,padding:12}},
      tooltip:{callbacks:{label:function(c){return c.label+': €'+N(c.raw)+' ('+(c.raw/tt*100).toFixed(1)+'%)';}}}},cutout:'65%'}});
}

function chartTop() {
  var ctxEl=G('inc-chart-top'); if(!ctxEl) return;
  var f=filtro();
  var src=allTop.filter(function(t){return !f.societa||t.codice_azienda===f.societa;}).slice(0,10);
  if(!src.length) return;
  var mx=parseFloat(src[0].avere)||1;
  if(charts.top){try{charts.top.destroy();}catch(e){}}
  charts.top=new Chart(ctxEl,{type:'bar',
    data:{labels:src.map(function(t){var n=t.cliente||t.codice_cliente||'—';return n.length>28?n.substring(0,26)+'…':n;}),
      datasets:[{label:'Importo',data:src.map(function(t){return parseFloat(t.avere)||0;}),
        backgroundColor:src.map(function(t){return 'rgba(37,99,235,'+(0.3+0.7*(parseFloat(t.avere)||0)/mx).toFixed(2)+')';}),borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '€'+N(c.raw);}}}},
      scales:{x:{ticks:{callback:function(v){return '€'+I(v);}}}}}});
}

function chartAnni() {
  var ctxEl=G('inc-chart-anni'); if(!ctxEl) return;
  var f=filtro();
  var anniD={};filtrati.forEach(function(r){if(r.anno)anniD[r.anno]=true;});
  var anniL=Object.keys(anniD).map(Number).sort(function(a,b){return a-b;}).slice(-6);
  if(anniL.length===0) return;
  if(anniL.length===1){
    // Anno singolo: mostra solo quell'anno senza messaggio d'errore
  }
  var c=['#005CA9','#059669','#D97706','#7C3AED','#DC2626','#0891B2'];
  var ds=anniL.map(function(anno,idx){
    var mm={}; for(var m=1;m<=12;m++) mm[m]=null;
    filtrati.filter(function(r){return r.anno===anno;}).forEach(function(r){if(r.mese>=1&&r.mese<=12)mm[r.mese]=(mm[r.mese]||0)+(parseFloat(r.avere)||0);});
    return {label:String(anno),data:Object.values(mm),borderColor:c[idx%c.length],borderWidth:2.5,pointRadius:3,tension:0.35,fill:false};
  });
  if(charts.anni){try{charts.anni.destroy();}catch(e){}}
  charts.anni=new Chart(ctxEl,{type:'line',data:{labels:MESI.slice(1),datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},
      plugins:{legend:{display:true,position:'top',labels:{font:{size:11},boxWidth:14,padding:10}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': €'+N(c.raw);}}}},
      scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '€'+I(v);}}}}}});
}

// ─── Export ────────────────────────────────────────────────
function incassiExport() {
  if(!filtrati.length){toast('Nessun dato','warning');return;}
  var wb=XLSX.utils.book_new();
  var byAnno={};filtrati.forEach(function(r){var a=r.anno||'?';if(!byAnno[a])byAnno[a]={tot:0,sepa:0,cassa:0,bon:0,n:0};byAnno[a].tot+=(parseFloat(r.avere)||0);byAnno[a].n+=(parseInt(r.n)||0);if(r.metodo==='SEPA')byAnno[a].sepa+=(parseFloat(r.avere)||0);else if(r.metodo==='Bonifico')byAnno[a].bon+=(parseFloat(r.avere)||0);else byAnno[a].cassa+=(parseFloat(r.avere)||0);});
  var s=[['Anno','Totale €','SEPA €','Cassa €','Bonifico €','N° Fatture']];
  Object.entries(byAnno).sort(function(a,b){return b[0]-a[0];}).forEach(function(e){s.push([e[0],e[1].tot,e[1].sepa,e[1].cassa,e[1].bon,e[1].n]);});
  var ws=XLSX.utils.aoa_to_sheet(s);ws['!cols']=[8,16,14,14,14,12].map(function(w){return{wch:w};});
  XLSX.utils.book_append_sheet(wb,ws,'Riepilogo');
  XLSX.writeFile(wb,'CNA_Incassi_'+new Date().toISOString().substring(0,10)+'.xlsx');
  toast('Export completato','success');
}

// ─── Tiny HTML helpers ─────────────────────────────────────
function N(n){return '<span class="amt">'+Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>';}
function I(n){return Number(n||0).toLocaleString('it-IT');}
function bar(pct){return '<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px"><div style="width:44px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:var(--blue)"></div></div>'+pct+'%</div>';}
function row(i,cells){return '<tr style="border-bottom:1px solid var(--border)'+(i%2?';background:var(--surface2)':'')+'">'+cells.map(function(c,j){return '<td style="padding:6px 10px'+(j>0?';text-align:right':'')+'">'+c+'</td>';}).join('')+'</tr>';}
function tbl(hdrs,rows){return '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)">'+hdrs.map(function(h,i){return '<th style="padding:7px 10px;text-align:'+(i>0?'right':'left')+'">'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';}

// fmtNum/fmtInt alias per compatibilità
function fmtNum(n){return N(n);}
function fmtInt(n){return I(n);}
