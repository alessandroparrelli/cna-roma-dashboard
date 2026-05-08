console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoAllData=[], atecoFiltered=[];
var atecoCharts={};

async function atecoLoad(force){
  console.log('🔄 atecoLoad()');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  var tab=G('tab-ateco');
  if(!tab){atecoLoading=false;return;}
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Connessione…</div></div>';

  try{
    G('ateco-msg').textContent='Caricamento Anagrafiche…';
    var ana=await anaFetchAll('Anagrafiche');
    console.log('ana:', ana.length);

    G('ateco-msg').textContent='Caricamento diretti…';
    var dir=await anaFetchAll('diretti');
    console.log('dir:', dir.length);

    G('ateco-msg').textContent='Caricamento codiciateco…';
    var cod=await anaFetchAll('codiciateco');
    console.log('cod:', cod.length);

    G('ateco-msg').textContent='Elaborazione…';

    // Mappa codiciateco
    var codMap=new Map();
    cod.forEach(function(c){
      var k=String(c.codiceateco||'').trim();
      if(k) codMap.set(k,c);
    });

    // Mappa anagrafiche per codiceanagrafica
    var anaMap=new Map();
    ana.forEach(function(a){
      anaMap.set(a.codiceanagrafica, a);
    });

    // Filtra diretti: solo TESSERAMENTO (servizio contiene "Iscritto" o "TESSERAMENTO")
    var joined=[];
    dir.forEach(function(d){
      if(!d.codiceanagrafica) return;
      var svc=String(d.servizio||'').trim().toUpperCase();
      // Prendi tutti i contratti con datastipula (= associazioni)
      if(!d.datastipula) return;

      var a=anaMap.get(d.codiceanagrafica);
      if(!a) return;

      var atecoCode=String(a.codiceateco||'').trim();
      var c=codMap.get(atecoCode)||{};

      // Sesso: dalla tabella anagrafiche (campo sesso) o dal CF
      var sesso=a.sesso||null;
      if(!sesso){
        var cf=a.codicefiscale||'';
        if(cf&&cf.length>=10){
          var gg=parseInt(cf.substr(9,2),10);
          sesso=(gg>=41)?'F':(gg>=1&&gg<=31)?'M':null;
        }
      }

      // Nazionalità: 12° char del CF = Z → straniero
      var cf2=a.codicefiscale||'';
      var naz=(cf2&&cf2.length>=12&&cf2.charAt(11)==='Z')?'ST':'IT';

      // Data contratto
      var ds=d.datastipula||'';
      var anno=null, mese=null;
      if(ds){
        var dt=new Date(ds);
        if(!isNaN(dt)){
          anno=dt.getFullYear();
          mese=dt.getMonth()+1;
        }
      }

      joined.push({
        codice:d.codiceanagrafica,
        ragionesociale:a.ragionesociale||'',
        unione:c.unione||'N/D',
        mestiere:c.mestiere||'N/D',
        settore:c.settore||'N/D',
        sesso:sesso,
        nazionalita:naz,
        anno:anno,
        mese:mese,
        servizio:d.servizio||''
      });
    });

    console.log('✅ joined:', joined.length);
    atecoAllData=joined;
    atecoFiltered=joined.slice();
    atecoLoaded=true;

    atecoBuildUI();
    atecoPopulateFilters();
    atecoRender();

  }catch(e){
    console.error('❌',e);
    tab.innerHTML='<div style="padding:40px;color:red"><h2>Errore</h2><p>'+e.message+'</p></div>';
  }finally{
    atecoLoading=false;
  }
}

/* ══════════════ UI ══════════════ */

function atecoBuildUI(){
  var tab=G('tab-ateco');
  if(!tab) return;
  var h='<div style="padding:20px">';

  // FILTRI
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE DA</label><select id="at-mda" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE A</label><select id="at-ma" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="M">Maschio</option><option value="F">Femmina</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="IT">Italiano</option><option value="ST">Straniero</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset</button></div>';
  h+='</div></div>';

  // KPI
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
  h+='<div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">CONTRATTI</div><div style="font-size:32px;font-weight:700" id="at-k1">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">UNIONI</div><div style="font-size:32px;font-weight:700" id="at-k2">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">MESTIERI</div><div style="font-size:32px;font-weight:700" id="at-k3">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">% DONNE</div><div style="font-size:32px;font-weight:700" id="at-k4">0</div></div>';
  h+='</div>';

  // CARD SESSO
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">';
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #EC4899"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Sesso Titolare</h3><canvas id="at-ch-sex" style="height:280px"></canvas></div>';
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #10B981"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Nazionalità</h3><canvas id="at-ch-naz" style="height:280px"></canvas></div>';
  h+='</div>';

  // TABELLA UNIONI
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">';
  h+='<h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3>';
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:rgba(168,85,247,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px">Unione</th><th style="text-align:center;padding:12px">Tot</th><th style="text-align:center;padding:12px">%</th><th style="text-align:center;padding:12px">Donne %</th><th style="text-align:center;padding:12px">Stranieri %</th></tr></thead><tbody id="at-tb-u"></tbody></table></div>';
  h+='</div>';

  // TABELLA TOP 25 MESTIERI
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #F97316">';
  h+='<h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Top 25 Mestieri</h3>';
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:rgba(249,115,22,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px">Mestiere</th><th style="text-align:center;padding:12px">Tot</th><th style="text-align:center;padding:12px">%</th><th style="text-align:center;padding:12px">Donne %</th><th style="text-align:center;padding:12px">Stranieri %</th></tr></thead><tbody id="at-tb-m"></tbody></table></div>';
  h+='</div>';

  // CARD PER OGNI UNIONE (con sottomestieri)
  h+='<div id="at-unioni-cards"></div>';

  h+='</div>';
  tab.innerHTML=h;
}

/* ══════════════ FILTERS ══════════════ */

function atecoPopulateFilters(){
  var anni=new Set();
  atecoAllData.forEach(function(r){if(r.anno) anni.add(r.anno);});
  var sel=G('at-anno');
  Array.from(anni).sort().forEach(function(a){
    var o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o);
  });
  for(var m=1;m<=12;m++){
    var ms=String(m).padStart(2,'0');
    ['at-mda','at-ma'].forEach(function(id){
      var o=document.createElement('option'); o.value=m; o.textContent=MESI[m]||ms; G(id).appendChild(o);
    });
  }
  ['at-anno','at-mda','at-ma','at-sex','at-naz'].forEach(function(id){
    G(id).addEventListener('change',atecoApply);
  });
  G('at-reset').addEventListener('click',atecoReset);
}

function atecoApply(){
  var anno=G('at-anno').value, mda=parseInt(G('at-mda').value)||0, ma=parseInt(G('at-ma').value)||0;
  var sex=G('at-sex').value, naz=G('at-naz').value;
  atecoFiltered=atecoAllData.filter(function(r){
    if(anno && String(r.anno)!==anno) return false;
    if(mda>0 && (r.mese===null||r.mese<mda)) return false;
    if(ma>0 && (r.mese===null||r.mese>ma)) return false;
    if(sex && r.sesso!==sex) return false;
    if(naz && r.nazionalita!==naz) return false;
    return true;
  });
  atecoRender();
}

function atecoReset(){
  ['at-anno','at-mda','at-ma','at-sex','at-naz'].forEach(function(id){G(id).value='';});
  atecoFiltered=atecoAllData.slice();
  atecoRender();
}

/* ══════════════ RENDER ══════════════ */

function atecoRender(){
  var tot=atecoFiltered.length;
  var uSet=new Set(), mSet=new Set();
  var unioni={}, mestieri={}, sesso={M:0,F:0}, naz={IT:0,ST:0}, donne=0;

  atecoFiltered.forEach(function(r){
    if(r.sesso==='M') sesso.M++;
    if(r.sesso==='F'){sesso.F++; donne++;}
    naz[r.nazionalita]=(naz[r.nazionalita]||0)+1;

    var u=r.unione||'N/D';
    uSet.add(u);
    if(!unioni[u]) unioni[u]={n:0,d:0,s:0,mestieri:{}};
    unioni[u].n++;
    if(r.sesso==='F') unioni[u].d++;
    if(r.nazionalita==='ST') unioni[u].s++;
    // Sottomestiere per unione
    var m=r.mestiere||'N/D';
    if(!unioni[u].mestieri[m]) unioni[u].mestieri[m]={n:0,d:0,s:0};
    unioni[u].mestieri[m].n++;
    if(r.sesso==='F') unioni[u].mestieri[m].d++;
    if(r.nazionalita==='ST') unioni[u].mestieri[m].s++;

    mSet.add(m);
    if(!mestieri[m]) mestieri[m]={n:0,d:0,s:0};
    mestieri[m].n++;
    if(r.sesso==='F') mestieri[m].d++;
    if(r.nazionalita==='ST') mestieri[m].s++;
  });

  // KPI
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=uSet.size;
  G('at-k3').textContent=mSet.size;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';

  // CHART SESSO
  if(G('at-ch-sex')){
    if(atecoCharts.s) atecoCharts.s.destroy();
    atecoCharts.s=new Chart(G('at-ch-sex'),{type:'pie',data:{labels:['Maschi ('+sesso.M+')','Femmine ('+sesso.F+')'],datasets:[{data:[sesso.M,sesso.F],backgroundColor:['#06B6D4','#EC4899']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  }

  // CHART NAZIONALITÀ
  if(G('at-ch-naz')){
    if(atecoCharts.n) atecoCharts.n.destroy();
    atecoCharts.n=new Chart(G('at-ch-naz'),{type:'doughnut',data:{labels:['Italiani ('+naz.IT+')','Stranieri ('+(naz.ST||0)+')'],datasets:[{data:[naz.IT||0,naz.ST||0],backgroundColor:['#10B981','#F59E0B']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  }

  // TABELLA UNIONI
  var tbU=G('at-tb-u');
  tbU.innerHTML='';
  Object.keys(unioni).sort(function(a,b){return unioni[b].n-unioni[a].n;}).forEach(function(u){
    var d=unioni[u];
    var pct=tot>0?(d.n/tot*100).toFixed(1):'0';
    var pD=d.n>0?(d.d/d.n*100).toFixed(1):'0';
    var pS=d.n>0?(d.s/d.n*100).toFixed(1):'0';
    var tr=document.createElement('tr');
    tr.style.borderBottom='1px solid var(--border)';
    tr.innerHTML='<td style="padding:12px"><strong>'+u+'</strong></td><td style="text-align:center;padding:12px">'+d.n+'</td><td style="text-align:center;padding:12px">'+pct+'%</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">'+pD+'%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">'+pS+'%</td>';
    tbU.appendChild(tr);
  });

  // TABELLA TOP 25 MESTIERI
  var tbM=G('at-tb-m');
  tbM.innerHTML='';
  Object.keys(mestieri).sort(function(a,b){return mestieri[b].n-mestieri[a].n;}).slice(0,25).forEach(function(m){
    var d=mestieri[m];
    var pct=tot>0?(d.n/tot*100).toFixed(1):'0';
    var pD=d.n>0?(d.d/d.n*100).toFixed(1):'0';
    var pS=d.n>0?(d.s/d.n*100).toFixed(1):'0';
    var tr=document.createElement('tr');
    tr.style.borderBottom='1px solid var(--border)';
    tr.innerHTML='<td style="padding:12px"><strong>'+m+'</strong></td><td style="text-align:center;padding:12px">'+d.n+'</td><td style="text-align:center;padding:12px">'+pct+'%</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">'+pD+'%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">'+pS+'%</td>';
    tbM.appendChild(tr);
  });

  // CARD PER OGNI UNIONE con sottomestieri
  var cardsDiv=G('at-unioni-cards');
  cardsDiv.innerHTML='';
  var colors=['#A855F7','#F97316','#10B981','#EC4899','#06B6D4','#EAB308','#DC2626','#6366F1','#14B8A6','#F43F5E'];
  var uSorted=Object.keys(unioni).sort(function(a,b){return unioni[b].n-unioni[a].n;});
  uSorted.forEach(function(u, idx){
    var d=unioni[u];
    var color=colors[idx%colors.length];
    var card=document.createElement('div');
    card.style.cssText='background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid '+color;

    var html='<h3 style="margin:0 0 5px 0;font-size:16px;font-weight:700;color:'+color+'">'+u+'</h3>';
    html+='<div style="font-size:13px;color:var(--text-secondary);margin-bottom:15px">'+d.n+' contratti &middot; '+(d.n>0?(d.d/d.n*100).toFixed(1):'0')+'% donne &middot; '+(d.n>0?(d.s/d.n*100).toFixed(1):'0')+'% stranieri</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:2px solid var(--border)"><th style="text-align:left;padding:8px">Mestiere</th><th style="text-align:center;padding:8px">Tot</th><th style="text-align:center;padding:8px">%</th><th style="text-align:center;padding:8px">Donne %</th><th style="text-align:center;padding:8px">Stranieri %</th></tr></thead><tbody>';

    var mSorted=Object.keys(d.mestieri).sort(function(a,b){return d.mestieri[b].n-d.mestieri[a].n;});
    mSorted.forEach(function(m){
      var md=d.mestieri[m];
      var pct=d.n>0?(md.n/d.n*100).toFixed(1):'0';
      var pD=md.n>0?(md.d/md.n*100).toFixed(1):'0';
      var pS=md.n>0?(md.s/md.n*100).toFixed(1):'0';
      html+='<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px">'+m+'</td><td style="text-align:center;padding:8px">'+md.n+'</td><td style="text-align:center;padding:8px">'+pct+'%</td><td style="text-align:center;padding:8px;color:#EC4899">'+pD+'%</td><td style="text-align:center;padding:8px;color:#F97316">'+pS+'%</td></tr>';
    });

    html+='</tbody></table>';
    card.innerHTML=html;
    cardsDiv.appendChild(card);
  });
}
