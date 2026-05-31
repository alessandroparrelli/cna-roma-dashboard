console.log('✅ ateco.js CARICATO v4 (join codice cliente + CCIAA fallback per mestiere/settore)');

var atecoLoaded=false, atecoLoading=false, atecoData=[], atecoFiltered=[];

// Fetch paginato senza ordinamento (Anagrafiche/codiciateco non hanno created_at affidabile)
async function atecoFetchAll(table){
  var all=[], offset=0, size=1000;
  while(true){
    var r=await fetch(SB+'/rest/v1/'+table+'?select=*&offset='+offset+'&limit='+size,{headers:H()});
    if(!r.ok) throw new Error(table+': HTTP '+r.status);
    var rows=await r.json();
    if(!Array.isArray(rows)||rows.length===0) break;
    all=all.concat(rows);
    offset+=size;
    if(rows.length<size) break;
  }
  return all;
}

// Fetch da cciaa SOLO per le partite IVA del tesseramento (non tutte le 945k).
// Restituisce: { partitaIVA -> primo ateco valido (non '000000') }
async function cciaaFetchPivaAteco(pivas){
  var result={};
  if(!pivas||pivas.length===0) return result;
  var CHUNK=200;
  for(var i=0;i<pivas.length;i+=CHUNK){
    var chunk=pivas.slice(i,i+CHUNK);
    var url=SB+'/rest/v1/cciaa?select=partita_iva,ateco2007&partita_iva=in.('+chunk.join(',')+')'+'&ateco2007=neq.000000&limit=1000';
    try{
      var r=await fetch(url,{headers:H()});
      if(!r.ok){console.warn('cciaa chunk HTTP',r.status);continue;}
      var rows=await r.json();
      (rows||[]).forEach(function(x){
        var k=String(x.partita_iva||'').trim();
        var v=String(x.ateco2007||'').trim();
        if(k&&v&&v!=='000000'&&!result[k]) result[k]=v;
      });
    }catch(e){console.warn('cciaa chunk error',e);}
  }
  console.log('📍 CCIAA: trovati codici ATECO per',Object.keys(result).length,'partite IVA su',pivas.length);
  return result;
}

// Ricava Unione/Mestiere/Settore (+ sesso/nazionalità) per ogni record tesseramento
// tramite join: tesseramento.codicecliente -> Anagrafiche.codiceanagrafica
//              -> Anagrafiche.codiceateco -> codiciateco.{unione,mestiere,settore}
// NB: la chiave di collegamento è il CODICE CLIENTE (= codiceanagrafica su Anagrafiche),
//     NON la partita IVA. codiceateco su Anagrafiche ha spazi finali -> TRIM su entrambi i lati.

// Valori (di codiciateco o mancanti) da trattare come "non deliberato" — case-insensitive
var ATECO_NON_DELIBERATO = {
  '':1, 'n/d':1, 'nd':1, 'n.d.':1,
  'art.ne di mestiere non deliberata':1,
  'unione non assegnata':1,
  'attività n.c.a.':1, 'attivita n.c.a.':1,
  'attività non deliberata':1, 'attivita non deliberata':1,
  'unione non deliberata':1, 'mestiere non deliberato':1, 'settore non deliberato':1
};
function atecoClassify(raw, dim){
  var key = (raw==null?'':String(raw)).trim().toLowerCase();
  if(ATECO_NON_DELIBERATO[key]){
    return dim==='unione'   ? 'Unione non deliberata'
         : dim==='mestiere' ? 'Mestiere non deliberato'
         :                     'Settore non deliberato';
  }
  return String(raw).trim();
}

function atecoEnrich(records, anagrafiche, codici, pivaAtecoMap){
  // Mappa codice cliente (= codiceanagrafica su Anagrafiche) -> anagrafica
  var anaMap={};
  (anagrafiche||[]).forEach(function(a){
    var k=String(a.codiceanagrafica||'').trim().toUpperCase();
    if(k && !anaMap[k]) anaMap[k]=a;
  });
  // Mappa codiceateco (TRIM) -> codiciateco (prima occorrenza vince)
  var codMap={};
  (codici||[]).forEach(function(c){
    var k=String(c.codiceateco||'').trim();
    if(k && !codMap[k]) codMap[k]=c;
  });

  var nAna=0, nNoAteco=0, nCod=0, nCciaa=0;
  (records||[]).forEach(function(tr){
    var cc  = String(tr.codicecliente||'').trim().toUpperCase();
    var piva= String(tr.partitaiva||'').trim();
    var ana = cc?anaMap[cc]:null;
    var cod = null;

    if(ana){
      nAna++;
      var code=String(ana.codiceateco||'').trim();
      if(!code) nNoAteco++;
      cod=code?codMap[code]:null;
      if(cod) nCod++;

      // Sesso da Anagrafiche (M/F)
      var sx=String(ana.sesso||'').trim().toUpperCase();
      if(sx==='F') tr.sesso='Femmina';
      else if(sx==='M') tr.sesso='Maschio';

      // Nazionalità: CF titolare con 12° carattere 'Z' = Straniero
      var cf=String(ana.cftitolare||'').trim();
      if(cf.length>=12){
        tr.nazionalita=(cf.charAt(11).toUpperCase()==='Z')?'Straniero':'Italiano';
      }
    }

    // Codice CCIAA come fallback (via partita IVA)
    var cciaCode = (pivaAtecoMap&&piva) ? (pivaAtecoMap[piva]||null) : null;
    var ccod     = cciaCode ? codMap[cciaCode] : null;
    if(ccod&&!cod) nCciaa++;

    // Per ogni campo: usa il valore da Anagrafiche/codiciateco se deliberato,
    // altrimenti tenta il codice CCIAA per quel campo specifico.
    function bestField(field){
      var v = cod ? String(cod[field]||'').trim() : null;
      if(v && !ATECO_NON_DELIBERATO[v.toLowerCase()]) return v;
      var cv= ccod ? String(ccod[field]||'').trim() : null;
      if(cv && !ATECO_NON_DELIBERATO[cv.toLowerCase()]) return cv;
      return null;
    }

    tr.unione   = atecoClassify(bestField('unione'),   'unione');
    tr.mestiere = atecoClassify(bestField('mestiere'), 'mestiere');
    tr.settore  = atecoClassify(bestField('settore'),  'settore');
  });

  var n = records ? records.length : 0;
  console.log('🔗 Join — record:'+n+' | match Anagrafiche:'+nAna+' | match codiciateco:'+nCod+' | recuperati da CCIAA:'+nCciaa+' | senza codiceateco:'+nNoAteco);
}

async function atecoLoad(force){
  console.log('🔄 🔄 🔄 ATECO LOAD CHIAMATO 🔄 🔄 🔄');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  var tab=G('tab-ateco');
  if(!tab){atecoLoading=false;return;}
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Lettura dati…</div></div>';

  try{
    G('ateco-msg').textContent='Caricamento tesseramento_records…';
    var data=await sbGetAll('tesseramento_records');

    // Ricava Unione/Mestiere/Settore via doppio join:
    // 1) codicecliente -> Anagrafiche.codiceanagrafica -> codiceateco  (fonte principale)
    // 2) partitaiva -> cciaa.partita_iva -> ateco2007                  (fallback per campo mancante)
    // entrambi -> codiciateco.{unione,mestiere,settore}
    var pivaList=[...new Set((data||[]).map(function(r){return String(r.partitaiva||'').trim();}).filter(Boolean))];
    G('ateco-msg').textContent='Caricamento Anagrafiche, CCIAA e codiciateco…';
    var atecoResults=await Promise.all([
      atecoFetchAll('Anagrafiche'),
      atecoFetchAll('codiciateco'),
      cciaaFetchPivaAteco(pivaList)
    ]);
    G('ateco-msg').textContent='Calcolo unione, mestiere e settore…';
    atecoEnrich(data, atecoResults[0], atecoResults[1], atecoResults[2]);

    atecoData=data;
    
    console.log('📊 Tot record caricati:',data.length);
    
    atecoFiltered=atecoData.slice();
    atecoLoaded=true;

    atecoBuildUI();
    atecoPopulateFilters();
    atecoRender();

  }catch(e){
    console.error('❌',e);
    tab.innerHTML='<div style="padding:40px;color:red"><h2>Errore</h2><p>'+e.message+'</p></div>';
  }finally{
    atecoLoading=false;
    hideLoad();
  }
}

function atecoBuildUI(){
  var tab=G('tab-ateco');
  if(!tab) return;
  
  // Inietta CSS animazioni
  if(!document.getElementById('ateco-animations')){
    var style=document.createElement('style');
    style.id='ateco-animations';
    style.textContent=`
      @keyframes atecoFadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      @keyframes atecoPulse{0%{transform:scale(1)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
      @keyframes atecoSlideIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
      @keyframes atecoGlow{0%{box-shadow:0 4px 6px rgba(0,0,0,0.07)}50%{box-shadow:0 8px 25px rgba(0,71,171,0.15)}100%{box-shadow:0 4px 6px rgba(0,0,0,0.07)}}
      .ateco-kpi{transition:var(--transition,all .25s cubic-bezier(0.4,0,0.2,1));cursor:default}
      .ateco-kpi.kpi-card:hover{transform:translateY(-5px);}
      .ateco-kpi.ak1:hover{box-shadow:0 8px 30px rgba(0,92,169,.28),0 0 0 1px rgba(0,92,169,.15)!important;}
      .ateco-kpi.ak2:hover{box-shadow:0 8px 30px rgba(220,38,38,.28),0 0 0 1px rgba(220,38,38,.15)!important;}
      .ateco-kpi.ak3:hover{box-shadow:0 8px 30px rgba(245,158,11,.28),0 0 0 1px rgba(245,158,11,.15)!important;}
      .ateco-kpi.ak4:hover{box-shadow:0 8px 30px rgba(236,72,153,.28),0 0 0 1px rgba(236,72,153,.15)!important;}
      .ateco-kpi.ak5:hover{box-shadow:0 8px 30px rgba(16,185,129,.28),0 0 0 1px rgba(16,185,129,.15)!important;}
      .ateco-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1);animation:atecoFadeIn 0.6s ease-out}
      .ateco-card:hover{box-shadow:0 12px 40px rgba(0,0,0,0.12)!important;transform:translateY(-2px)}
      .ateco-card-header{transition:all 0.3s ease}
      .ateco-card:hover .ateco-card-header{letter-spacing:1px;padding-left:24px}
      .ateco-row{transition:all 0.25s ease}
      .ateco-row:hover{background:linear-gradient(90deg,rgba(0,71,171,0.04),rgba(0,71,171,0.08))!important;transform:scale(1.005)}
      .ateco-row td{transition:all 0.25s ease}
      .ateco-row:hover td{padding-top:12px;padding-bottom:12px}
      .ateco-row:hover td:first-child{font-weight:700!important;color:#0047AB!important}
      .ateco-btn{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
      .ateco-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.15);background:var(--btn-color)!important;color:white!important}
      .ateco-btn:active{transform:translateY(0);box-shadow:0 2px 8px rgba(0,0,0,0.1)}
      .ateco-th{transition:all 0.2s ease;cursor:pointer;user-select:none}
      .ateco-th:hover{background:#E5E7EB!important;transform:scale(1.02)}
      .ateco-th:active{transform:scale(0.98)}
      .ateco-filter select{transition:all 0.3s ease}
      .ateco-filter select:hover{border-color:#0047AB!important;box-shadow:0 0 0 3px rgba(0,71,171,0.1)}
      .ateco-filter select:focus{border-color:#0047AB!important;box-shadow:0 0 0 3px rgba(0,71,171,0.2);outline:none}
      .ateco-chart-box{transition:all 0.3s ease}
      .ateco-chart-box:hover{transform:translateY(-3px);box-shadow:0 15px 40px rgba(0,0,0,0.2)}
      .ateco-reset-btn{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
      .ateco-reset-btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,71,171,0.4)!important;filter:brightness(1.1)}
      .ateco-reset-btn:active{transform:translateY(0)}
    `;
    document.head.appendChild(style);
  }
  
  var h='<div class="tab-hero"><h2 class="tab-hero-title">Unioni e mestieri</h2><p class="tab-hero-desc">Consultazione e gestione dei codici attività economica e relativi mestieri</p></div><div>';

  // FILTRI
  h+='<div id="ateco-filters-box" class="ateco-card" style="background:white;padding:16px 20px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #0047AB">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0">';
  h+='<span style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg> Filtri</span>';
  h+='<button id="at-toggle-btn" onclick="atecoToggleFiltri()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12px;font-weight:700;color:#005CA9;background:rgba(0,92,169,.07);border:1px solid rgba(0,92,169,.15);border-radius:999px;cursor:pointer;font-family:inherit;transition:all .25s"><span id="at-toggle-icon" style="display:inline-block;transition:transform .25s;font-size:10px">▼</span> Filtri</button>';
  h+='</div>';
  h+='<div id="ateco-filters-body" style="overflow:hidden;max-height:0;opacity:0;transition:max-height .35s cubic-bezier(0.4,0,0.2,1),opacity .25s ease,margin-top .25s ease;margin-top:0">';
  h+='<div class="ateco-filter" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:14px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">UNIONE</label><select id="at-unione" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">MESTIERE</label><select id="at-mest" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SETTORE</label><select id="at-sett" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" class="ateco-reset-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#0047AB,#003380);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;box-shadow:0 4px 6px rgba(0,71,171,0.3)">Reset</button></div>';
  h+='</div></div></div>';

  // KPI
  h+='<div class="kpi-strip kpi-strip-6">';
  h+='<div class="kpi-card c1 ateco-kpi ak1"><div class="kpi-label">Contratti</div><div class="kpi-value" id="at-k1">–</div><div class="kpi-sub">Totale registrazioni</div></div>';
  h+='<div class="kpi-card ateco-kpi ak2" style="--before-bg:#DC2626;"><div class="kpi-label">Unioni</div><div class="kpi-value" id="at-k2">–</div><div class="kpi-sub">Unioni attive</div></div>';
  h+='<div class="kpi-card ateco-kpi ak3" style="--before-bg:#F59E0B;"><div class="kpi-label">Mestieri</div><div class="kpi-value" id="at-k3">–</div><div class="kpi-sub">Mestieri distinti</div></div>';
  h+='<div class="kpi-card ateco-kpi ak6" style="--before-bg:#8B5CF6;"><div class="kpi-label">Settori</div><div class="kpi-value" id="at-k6">–</div><div class="kpi-sub">Settori distinti</div></div>';
  h+='<div class="kpi-card c4 ateco-kpi ak4"><div class="kpi-label">% Donne</div><div class="kpi-value" id="at-k4">–</div><div class="kpi-sub">Imprenditrici</div></div>';
  h+='<div class="kpi-card c3 ateco-kpi ak5"><div class="kpi-label">% Stranieri</div><div class="kpi-value" id="at-k5">–</div><div class="kpi-sub">Titolari stranieri</div></div>';
  h+='</div>';

  h+='<div id="at-cards-container" style="display:grid;gap:20px"></div>';

  h+='</div>';
  tab.innerHTML=h;
}

function atecoPopulateFilters(){
  var anni=new Set(), unioni=new Set(), mestieri=new Set(), settori=new Set(), sessiSet=new Set(), nazSet=new Set();
  
  atecoData.forEach(function(r){
    if(r.anno) anni.add(String(r.anno));
    if(r.unione) unioni.add(r.unione);
    if(r.mestiere) mestieri.add(r.mestiere);
    if(r.settore) settori.add(r.settore);
    if(r.sesso) sessiSet.add(r.sesso);
    if(r.nazionalita) nazSet.add(r.nazionalita);
  });
  
  var populate=function(id,arr){
    var sel=G(id);
    if(!sel) return;
    Array.from(arr).sort().forEach(function(val){
      var o=document.createElement('option');
      o.value=val;
      o.textContent=val;
      sel.appendChild(o);
    });
  };
  
  populate('at-anno',anni);
  populate('at-unione',unioni);
  populate('at-mest',mestieri);
  populate('at-sett',settori);
  populate('at-sex',sessiSet);
  populate('at-naz',nazSet);
  
  ['at-anno','at-unione','at-mest','at-sett','at-sex','at-naz'].forEach(function(id){
    var el=G(id);
    if(el) el.addEventListener('change',atecoApply);
  });
  G('at-reset').addEventListener('click',atecoReset);
}

function atecoApply(){
  var anno=G('at-anno').value;
  var unione=G('at-unione').value;
  var mest=G('at-mest').value;
  var sett=G('at-sett').value;
  var sex=G('at-sex').value;
  var naz=G('at-naz').value;
  
  atecoFiltered=atecoData.filter(function(r){
    if(anno && String(r.anno)!==anno) return false;
    if(unione && r.unione!==unione) return false;
    if(mest && r.mestiere!==mest) return false;
    if(sett && r.settore!==sett) return false;
    if(sex && r.sesso!==sex) return false;
    if(naz && r.nazionalita!==naz) return false;
    return true;
  });
  atecoRender();
}

function atecoReset(){
  ['at-anno','at-unione','at-mest','at-sett','at-sex','at-naz'].forEach(function(id){G(id).value='';});
  atecoFiltered=atecoData.slice();
  atecoRender();
}

function atecoRender(){
  var tot=atecoFiltered.length;
  var byUnione={}, byMestiere={}, bySettore={};
  var donne=0, stranieri=0;
  
  // Debug: conta i valori per verificare cosa arriva
  var sessoCount={}, nazCount={};
  
  atecoFiltered.forEach(function(r){
    var u=r.unione||'N/D';
    var m=r.mestiere||'N/D';
    var s=r.settore||'N/D';
    var sx=String(r.sesso||'').trim();
    var n=String(r.nazionalita||'').trim();
    
    // Debug
    sessoCount[sx]=(sessoCount[sx]||0)+1;
    nazCount[n]=(nazCount[n]||0)+1;
    
    if(!byUnione[u]) byUnione[u]={tot:0,maschi:0,femmine:0,stranieri:0};
    byUnione[u].tot++;
    if(sx==='Maschio') byUnione[u].maschi++;
    if(sx==='Femmina') byUnione[u].femmine++;
    if(n==='Straniero') byUnione[u].stranieri++;
    
    if(!byMestiere[m]) byMestiere[m]={tot:0,maschi:0,femmine:0,stranieri:0};
    byMestiere[m].tot++;
    if(sx==='Maschio') byMestiere[m].maschi++;
    if(sx==='Femmina') byMestiere[m].femmine++;
    if(n==='Straniero') byMestiere[m].stranieri++;
    
    if(!bySettore[s]) bySettore[s]={tot:0,maschi:0,femmine:0,stranieri:0};
    bySettore[s].tot++;
    if(sx==='Maschio') bySettore[s].maschi++;
    if(sx==='Femmina') bySettore[s].femmine++;
    if(n==='Straniero') bySettore[s].stranieri++;
    
    if(sx==='Femmina') donne++;
    if(n==='Straniero') stranieri++;
  });
  
  console.log('Debug sesso:',sessoCount);
  console.log('Debug nazionalita:',nazCount);
  console.log('Donne:',donne,'Stranieri:',stranieri);
  
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=Object.keys(byUnione).length;
  G('at-k3').textContent=Object.keys(byMestiere).length;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';
  G('at-k5').textContent=tot>0?(stranieri/tot*100).toFixed(1)+'%':'0%';
  if(G('at-k6')) G('at-k6').textContent=Object.keys(bySettore).length;

  // CountUp animations
  atecoCountUp('at-k1', tot, false);
  atecoCountUp('at-k2', Object.keys(byUnione).length, false);
  atecoCountUp('at-k3', Object.keys(byMestiere).length, false);
  atecoCountUpPct('at-k4', tot>0?(donne/tot*100):0);
  atecoCountUpPct('at-k5', tot>0?(stranieri/tot*100):0);
  if(G('at-k6')) atecoCountUp('at-k6', Object.keys(bySettore).length, false);
  
  var container=G('at-cards-container');
  container.innerHTML='';
  
  renderTableCard(byUnione,'UNIONE','#0047AB',tot,container);
  renderTableCard(byMestiere,'MESTIERE','#DC2626',tot,container);
  renderTableCard(bySettore,'SETTORE','#F59E0B',tot,container);
}

function renderTableCard(data,title,color,total,container){
  var keys=Object.keys(data);
  var showAll=false;
  var sortCol='tot';
  var sortDir='desc';
  
  function getSorted(){
    return keys.slice().sort(function(a,b){
      var va,vb;
      if(sortCol==='name'){va=a.toLowerCase();vb=b.toLowerCase();return sortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va);}
      if(sortCol==='tot'){va=data[a].tot;vb=data[b].tot;}
      else if(sortCol==='pct'){va=data[a].tot;vb=data[b].tot;}
      else if(sortCol==='maschi'){va=data[a].maschi;vb=data[b].maschi;}
      else if(sortCol==='pctM'){va=data[a].tot>0?data[a].maschi/data[a].tot:0;vb=data[b].tot>0?data[b].maschi/data[b].tot:0;}
      else if(sortCol==='femmine'){va=data[a].femmine;vb=data[b].femmine;}
      else if(sortCol==='pctF'){va=data[a].tot>0?data[a].femmine/data[a].tot:0;vb=data[b].tot>0?data[b].femmine/data[b].tot:0;}
      else if(sortCol==='stranieri'){va=data[a].stranieri;vb=data[b].stranieri;}
      else if(sortCol==='pctS'){va=data[a].tot>0?data[a].stranieri/data[a].tot:0;vb=data[b].tot>0?data[b].stranieri/data[b].tot:0;}
      else{va=data[a].tot;vb=data[b].tot;}
      return sortDir==='asc'?va-vb:vb-va;
    });
  }
  
  var cardDiv=document.createElement('div');
  cardDiv.className='ateco-card';
  cardDiv.style.cssText='background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);margin-bottom:20px';
  
  var headerDiv=document.createElement('div');
  headerDiv.className='ateco-card-header';
  headerDiv.style.cssText='background:'+color+';padding:16px;color:white;font-weight:700;font-size:14px;transition:all 0.3s ease';
  headerDiv.innerHTML=title;
  cardDiv.appendChild(headerDiv);
  
  var tableDiv=document.createElement('div');
  tableDiv.style.cssText='overflow-x:auto;padding:16px';
  cardDiv.appendChild(tableDiv);
  
  var btnDiv=document.createElement('div');
  btnDiv.style.cssText='padding:0 16px 16px 16px';
  cardDiv.appendChild(btnDiv);
  
  var cols=[
    {id:'name',label:title,align:'left',color:'#333'},
    {id:'tot',label:'TOTALE',align:'center',color:'#333'},
    {id:'pct',label:'%',align:'center',color:'#333'},
    {id:'maschi',label:'MASCHI',align:'center',color:'#0047AB'},
    {id:'pctM',label:'%',align:'center',color:'#0047AB'},
    {id:'femmine',label:'FEMMINE',align:'center',color:'#EC4899'},
    {id:'pctF',label:'%',align:'center',color:'#EC4899'},
    {id:'stranieri',label:'STRANIERI',align:'center',color:'#10B981'},
    {id:'pctS',label:'%',align:'center',color:'#10B981'}
  ];
  
  function arrow(colId){
    if(sortCol!==colId) return ' <span style="opacity:0.3;font-size:10px">⇅</span>';
    return sortDir==='asc'?' <span style="font-size:10px">▲</span>':' <span style="font-size:10px">▼</span>';
  }
  
  function buildTable(items){
    var html='<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html+='<thead><tr style="background:#F3F4F6;border-bottom:2px solid #E5E7EB">';
    cols.forEach(function(c){
      html+='<th class="ateco-th" data-col="'+c.id+'" style="text-align:'+c.align+';padding:10px;font-weight:700;color:'+c.color+';cursor:pointer;user-select:none;white-space:nowrap;transition:all 0.2s ease">'+c.label+arrow(c.id)+'</th>';
    });
    html+='</tr></thead><tbody>';
    
    items.forEach(function(key){
      var item=data[key];
      var pctTot=total>0?((item.tot/total)*100).toFixed(1):0;
      var pctM=item.tot>0?((item.maschi/item.tot)*100).toFixed(0):0;
      var pctF=item.tot>0?((item.femmine/item.tot)*100).toFixed(0):0;
      var pctS=item.tot>0?((item.stranieri/item.tot)*100).toFixed(0):0;
      
      html+='<tr class="ateco-row" style="border-bottom:1px solid #E5E7EB;cursor:default">';
      html+='<td style="padding:10px;color:#333;font-weight:500">'+escapeHtml(key)+'</td>';
      html+='<td style="text-align:center;padding:10px;color:#333;font-weight:600">'+item.tot+'</td>';
      html+='<td style="text-align:center;padding:10px;color:#666">'+pctTot+'%</td>';
      html+='<td style="text-align:center;padding:10px;color:#0047AB;font-weight:600">'+item.maschi+'</td>';
      html+='<td style="text-align:center;padding:10px;color:#0047AB">'+pctM+'%</td>';
      html+='<td style="text-align:center;padding:10px;color:#EC4899;font-weight:600">'+item.femmine+'</td>';
      html+='<td style="text-align:center;padding:10px;color:#EC4899">'+pctF+'%</td>';
      html+='<td style="text-align:center;padding:10px;color:#10B981;font-weight:600">'+item.stranieri+'</td>';
      html+='<td style="text-align:center;padding:10px;color:#10B981">'+pctS+'%</td>';
      html+='</tr>';
    });
    
    // RIGA TOTALI
    var totMaschi=0,totFemmine=0,totStranieri=0;
    keys.forEach(function(key){totMaschi+=data[key].maschi;totFemmine+=data[key].femmine;totStranieri+=data[key].stranieri;});
    var pctTotM=total>0?((totMaschi/total)*100).toFixed(0):0;
    var pctTotF=total>0?((totFemmine/total)*100).toFixed(0):0;
    var pctTotS=total>0?((totStranieri/total)*100).toFixed(0):0;
    
    html+='<tr style="background:#F3F4F6;border-top:2px solid #E5E7EB;font-weight:700">';
    html+='<td style="padding:10px;color:#333">TOTALE</td>';
    html+='<td style="text-align:center;padding:10px;color:#333">'+total+'</td>';
    html+='<td style="text-align:center;padding:10px;color:#333">100%</td>';
    html+='<td style="text-align:center;padding:10px;color:#0047AB">'+totMaschi+'</td>';
    html+='<td style="text-align:center;padding:10px;color:#0047AB">'+pctTotM+'%</td>';
    html+='<td style="text-align:center;padding:10px;color:#EC4899">'+totFemmine+'</td>';
    html+='<td style="text-align:center;padding:10px;color:#EC4899">'+pctTotF+'%</td>';
    html+='<td style="text-align:center;padding:10px;color:#10B981">'+totStranieri+'</td>';
    html+='<td style="text-align:center;padding:10px;color:#10B981">'+pctTotS+'%</td>';
    html+='</tr>';
    
    html+='</tbody></table>';
    return html;
  }
  
  function refresh(){
    var sorted=getSorted();
    var items=showAll?sorted:sorted.slice(0,10);
    tableDiv.innerHTML=buildTable(items);
    
    // Attach click handlers sugli header
    tableDiv.querySelectorAll('.ateco-th').forEach(function(th){
      th.addEventListener('click',function(){
        var col=this.getAttribute('data-col');
        if(sortCol===col) sortDir=sortDir==='asc'?'desc':'asc';
        else{sortCol=col;sortDir=col==='name'?'asc':'desc';}
        refresh();
      });
      th.addEventListener('mouseenter',function(){this.style.background='#E5E7EB';});
      th.addEventListener('mouseleave',function(){this.style.background='';});
    });
    
    if(keys.length>10){
      var btn=document.createElement('button');
      btn.textContent=showAll?'Nascondi':'Mostra altro ('+keys.length+')';
      btn.className='ateco-btn';
      btn.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid '+color+';color:'+color+';border-radius:6px;cursor:pointer;font-weight:600;--btn-color:'+color;
      btn.onclick=function(){showAll=!showAll;refresh();};
      btnDiv.innerHTML='';
      btnDiv.appendChild(btn);
    }
  }
  
  refresh();
  
  // CARD STATISTICHE: top 5 con barre inline al posto del grafico
  var statsWrap = document.createElement('div');
  statsWrap.style.cssText = 'padding:0 16px 20px 16px';

  var statsCard = document.createElement('div');
  statsCard.style.cssText = 'background:var(--surface2,#F8FAFC);border-radius:10px;padding:16px;border:1px solid var(--border,#E5E7EB)';

  var statsTitle = document.createElement('div');
  statsTitle.style.cssText = 'font-size:11px;font-weight:700;color:'+color+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;display:flex;align-items:center;gap:6px';
  statsTitle.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Top 5 per volume';
  statsCard.appendChild(statsTitle);

  var sorted = Object.keys(data).sort(function(a,b){ return data[b].tot - data[a].tot; }).slice(0,5);
  var maxVal = sorted.length > 0 ? data[sorted[0]].tot : 1;

  sorted.forEach(function(key, idx) {
    var item = data[key];
    var pct = Math.round((item.tot / maxVal) * 100);
    var pctTot = total > 0 ? ((item.tot / total) * 100).toFixed(1) : '0';
    var pctF = item.tot > 0 ? ((item.femmine / item.tot) * 100).toFixed(0) : '0';
    var pctS = item.tot > 0 ? ((item.stranieri / item.tot) * 100).toFixed(0) : '0';

    var row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px';
    row.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-size:12px;font-weight:600;color:var(--text,#0F172A);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">' +
          '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:'+color+';color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:18px;margin-right:6px;flex-shrink:0">'+(idx+1)+'</span>' +
          escapeHtml(key) +
        '</span>' +
        '<span style="font-size:12px;font-weight:700;color:'+color+';white-space:nowrap">' + item.tot.toLocaleString('it-IT') + '</span>' +
      '</div>' +
      '<div style="background:#E5E7EB;border-radius:999px;height:6px;overflow:hidden">' +
        '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:999px;transition:width .6s ease"></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-top:4px">' +
        '<span style="font-size:10px;color:var(--text-secondary,#64748B)">Sul totale: <strong>'+pctTot+'%</strong></span>' +
        '<span style="font-size:10px;color:#EC4899">♀ <strong>'+pctF+'%</strong></span>' +
        '<span style="font-size:10px;color:#10B981">Stranieri <strong>'+pctS+'%</strong></span>' +
      '</div>';
    statsCard.appendChild(row);
  });

  statsWrap.appendChild(statsCard);
  cardDiv.appendChild(statsWrap);
  container.appendChild(cardDiv);
}

function escapeHtml(text){
  var div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}

function atecoToggleFiltri() {
  var body = document.getElementById('ateco-filters-body');
  var icon = document.getElementById('at-toggle-icon');
  var btn  = document.getElementById('at-toggle-btn');
  if (!body) return;
  var collapsed = body.style.maxHeight === '0px' || body.style.maxHeight === '0' || body.style.maxHeight === '';
  if (collapsed) {
    body.style.maxHeight = '400px';
    body.style.opacity   = '1';
    body.style.marginTop = '0';
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (btn)  btn.innerHTML = '<span id="at-toggle-icon" style="display:inline-block;transition:transform .25s;font-size:10px;transform:rotate(0deg)">▼</span> Chiudi';
  } else {
    body.style.maxHeight = '0';
    body.style.opacity   = '0';
    body.style.marginTop = '0';
    if (btn)  btn.innerHTML = '<span id="at-toggle-icon" style="display:inline-block;transition:transform .25s;font-size:10px;transform:rotate(-90deg)">▼</span> Filtri';
  }
}

function atecoCountUp(elId, finalVal, isCurrency){
  var el = G(elId);
  if(!el || finalVal === 0) { if(el) el.textContent = '0'; return; }
  var steps = 40, duration = 900, current = 0, increment = finalVal / steps;
  var timer = setInterval(function(){
    current += increment;
    if(current >= finalVal){ current = finalVal; clearInterval(timer);
      el.classList.add('popped'); setTimeout(function(){ el.classList.remove('popped'); }, 500); }
    el.textContent = isCurrency ? ('€ ' + Math.round(current).toLocaleString('it-IT')) : Math.round(current).toLocaleString('it-IT');
  }, duration / steps);
}

function atecoCountUpPct(elId, finalVal){
  var el = G(elId);
  if(!el || finalVal === 0) { if(el) el.textContent = '0%'; return; }
  var steps = 40, duration = 900, current = 0, increment = finalVal / steps;
  var timer = setInterval(function(){
    current += increment;
    if(current >= finalVal){ current = finalVal; clearInterval(timer);
      el.classList.add('popped'); setTimeout(function(){ el.classList.remove('popped'); }, 500); }
    el.textContent = current.toFixed(1) + '%';
  }, duration / steps);
}
