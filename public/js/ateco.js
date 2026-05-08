console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoAllData=[], atecoFiltered=[], atecoCharts={};

async function atecoLoad(force){
  console.log('🔄 atecoLoad()');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  // 1) Scrivi subito il placeholder nel tab
  var tab=G('tab-ateco');
  if(!tab){ atecoLoading=false; return; }
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Connessione a Supabase…</div></div>';

  try{
    G('ateco-msg').textContent='Caricamento tesseramento_records…';
    var tess=await sbGetAll('tesseramento_records');
    console.log('tess:', tess.length);

    G('ateco-msg').textContent='Caricamento Anagrafiche…';
    var ana=await sbGetAll('Anagrafiche');
    console.log('ana:', ana.length);

    G('ateco-msg').textContent='Caricamento codiciateco…';
    var cod=await sbGetAll('codiciateco');
    console.log('cod:', cod.length);

    G('ateco-msg').textContent='Elaborazione dati…';

    // JOIN
    var anaMap=new Map();
    ana.forEach(function(a){
      var piva=String(a.partita_iva||'').trim();
      if(piva) anaMap.set(piva, a);
    });

    var codMap=new Map();
    cod.forEach(function(c){
      var k=String(c.codiceateco||'').trim();
      if(k) codMap.set(k, c);
    });

    console.log('anaMap:', anaMap.size, 'codMap:', codMap.size);

    var joined=[];
    tess.forEach(function(t){
      var piva=String(t.partita_iva||'').trim();
      if(!piva) return;
      var a=anaMap.get(piva);
      if(!a) return;

      var atecoCode=String(a.codiceateco||'').trim();
      var c=codMap.get(atecoCode)||{};

      var cf=a.codice_fiscale_titolare||'';
      var sesso=null;
      if(cf&&cf.length>=10){
        var gg=parseInt(cf.substr(9,2),10);
        sesso=(gg>=41)?'F':(gg>=1&&gg<=31)?'M':null;
      }
      var naz=(cf&&cf.length>=12&&cf.charAt(11)==='Z')?'ST':'IT';

      var data=t.data_associazione||'';
      var pp=data.split('-');

      joined.push({
        piva:piva,
        unione:c.unione||'N/D',
        mestiere:c.mestiere_denom||c.mestiere||'N/D',
        sesso:sesso,
        nazionalita:naz,
        anno:pp[0]||'',
        mese:pp[1]||''
      });
    });

    console.log('✅ joined:', joined.length);
    atecoAllData=joined;
    atecoFiltered=joined.slice();
    atecoLoaded=true;

    // 2) ORA costruisci la UI
    atecoBuildUI();
    atecoPopulateFilters();
    atecoRender();

  }catch(e){
    console.error('❌ atecoLoad error:', e);
    tab.innerHTML='<div style="padding:40px;color:red"><h2>Errore</h2><p>'+e.message+'</p></div>';
  }finally{
    atecoLoading=false;
  }
}

function atecoBuildUI(){
  var tab=G('tab-ateco');
  if(!tab) return;
  tab.innerHTML='<div style="padding:20px">'+
    '<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">'+
        '<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">ANNO</label><select id="ateco-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>'+
        '<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE DA</label><select id="ateco-mese-da" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>'+
        '<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESE A</label><select id="ateco-mese-a" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>'+
        '<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">SESSO</label><select id="ateco-sesso" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="M">Maschio</option><option value="F">Femmina</option></select></div>'+
        '<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">NAZIONALITÀ</label><select id="ateco-nazionalita" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="IT">Italiano</option><option value="ST">Straniero</option></select></div>'+
        '<div style="display:flex;align-items:flex-end"><button id="ateco-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset</button></div>'+
      '</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">'+
      '<div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">IMPRESE</div><div style="font-size:32px;font-weight:700" id="kpi-imprese">0</div></div>'+
      '<div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">UNIONI</div><div style="font-size:32px;font-weight:700" id="kpi-unioni">0</div></div>'+
      '<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">MESTIERI</div><div style="font-size:32px;font-weight:700" id="kpi-mestieri">0</div></div>'+
      '<div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">DONNE %</div><div style="font-size:32px;font-weight:700" id="kpi-donne">0</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">'+
      '<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #A855F7"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Unioni</h3><canvas id="chart-unioni" style="height:280px"></canvas></div>'+
      '<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Mestieri</h3><canvas id="chart-mestieri" style="height:280px"></canvas></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px">'+
      '<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #EC4899"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Sesso</h3><canvas id="chart-sesso" style="height:280px"></canvas></div>'+
      '<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #10B981"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Nazionalità</h3><canvas id="chart-naz" style="height:280px"></canvas></div>'+
    '</div>'+
    '<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Dettaglio Unioni</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:rgba(168,85,247,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px">Unione</th><th style="text-align:center;padding:12px">Imprese</th><th style="text-align:center;padding:12px">% Donne</th><th style="text-align:center;padding:12px">% Stranieri</th></tr></thead><tbody id="tbody-unioni"></tbody></table></div>'+
    '<div style="background:var(--surface);padding:20px;border-radius:8px;border-left:4px solid #F97316"><h3 style="margin:0 0 15px 0;font-size:14px;font-weight:700">Dettaglio Mestieri</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:rgba(249,115,22,0.1);border-bottom:2px solid var(--border)"><th style="text-align:left;padding:12px">Mestiere</th><th style="text-align:center;padding:12px">Imprese</th><th style="text-align:center;padding:12px">% Donne</th><th style="text-align:center;padding:12px">% Stranieri</th></tr></thead><tbody id="tbody-mestieri"></tbody></table></div>'+
  '</div>';
}

function atecoPopulateFilters(){
  var anni=new Set();
  atecoAllData.forEach(function(r){ if(r.anno) anni.add(r.anno); });
  var sel=G('ateco-anno');
  Array.from(anni).sort().forEach(function(a){
    var o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o);
  });
  for(var m=1;m<=12;m++){
    var ms=String(m).padStart(2,'0');
    ['ateco-mese-da','ateco-mese-a'].forEach(function(id){
      var o=document.createElement('option'); o.value=ms; o.textContent=ms; G(id).appendChild(o);
    });
  }
  ['ateco-anno','ateco-mese-da','ateco-mese-a','ateco-sesso','ateco-nazionalita'].forEach(function(id){
    G(id).addEventListener('change', atecoApply);
  });
  G('ateco-reset').addEventListener('click', atecoReset);
}

function atecoApply(){
  var anno=G('ateco-anno').value, mda=G('ateco-mese-da').value, ma=G('ateco-mese-a').value, sex=G('ateco-sesso').value, naz=G('ateco-nazionalita').value;
  atecoFiltered=atecoAllData.filter(function(r){
    return(!anno||r.anno===anno)&&(!mda||!r.mese||r.mese>=mda)&&(!ma||!r.mese||r.mese<=ma)&&(!sex||r.sesso===sex)&&(!naz||r.nazionalita===naz);
  });
  atecoRender();
}

function atecoReset(){
  ['ateco-anno','ateco-mese-da','ateco-mese-a','ateco-sesso','ateco-nazionalita'].forEach(function(id){ G(id).value=''; });
  atecoFiltered=atecoAllData.slice();
  atecoRender();
}

function atecoRender(){
  var piva=new Set(), uSet=new Set(), mSet=new Set(), unioni={}, mestieri={}, sesso={M:0,F:0}, naz={IT:0,ST:0}, donne=0;
  atecoFiltered.forEach(function(r){
    piva.add(r.piva);
    if(r.sesso) sesso[r.sesso]=(sesso[r.sesso]||0)+1;
    if(r.sesso==='F') donne++;
    naz[r.nazionalita]=(naz[r.nazionalita]||0)+1;
    if(r.unione!=='N/D'){
      uSet.add(r.unione);
      if(!unioni[r.unione]) unioni[r.unione]={n:0,d:0,s:0};
      unioni[r.unione].n++; if(r.sesso==='F') unioni[r.unione].d++; if(r.nazionalita==='ST') unioni[r.unione].s++;
    }
    if(r.mestiere!=='N/D'){
      mSet.add(r.mestiere);
      if(!mestieri[r.mestiere]) mestieri[r.mestiere]={n:0,d:0,s:0};
      mestieri[r.mestiere].n++; if(r.sesso==='F') mestieri[r.mestiere].d++; if(r.nazionalita==='ST') mestieri[r.mestiere].s++;
    }
  });

  G('kpi-imprese').textContent=piva.size;
  G('kpi-unioni').textContent=uSet.size;
  G('kpi-mestieri').textContent=mSet.size;
  G('kpi-donne').textContent=piva.size>0?(donne/piva.size*100).toFixed(1)+'%':'0%';

  // Charts
  var colors=['#A855F7','#9333EA','#7E22CE','#6B21A8','#581C87','#9F1239','#BE123C','#DC2626','#EA580C','#F59E0B'];

  if(G('chart-unioni')){
    if(atecoCharts.u) atecoCharts.u.destroy();
    var ul=Object.keys(unioni).sort(function(a,b){return unioni[b].n-unioni[a].n;}).slice(0,10);
    var ud=ul.map(function(k){return unioni[k].n;});
    atecoCharts.u=new Chart(G('chart-unioni'),{type:'doughnut',data:{labels:ul,datasets:[{data:ud,backgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  }

  if(G('chart-mestieri')){
    if(atecoCharts.m) atecoCharts.m.destroy();
    var ml=Object.keys(mestieri).sort(function(a,b){return mestieri[b].n-mestieri[a].n;}).slice(0,8);
    var md=ml.map(function(k){return mestieri[k].n;});
    atecoCharts.m=new Chart(G('chart-mestieri'),{type:'bar',data:{labels:ml,datasets:[{label:'Imprese',data:md,backgroundColor:'#F97316',borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  }

  if(G('chart-sesso')){
    if(atecoCharts.s) atecoCharts.s.destroy();
    atecoCharts.s=new Chart(G('chart-sesso'),{type:'pie',data:{labels:['Maschi','Femmine'],datasets:[{data:[sesso.M||0,sesso.F||0],backgroundColor:['#06B6D4','#EC4899']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  }

  if(G('chart-naz')){
    if(atecoCharts.n) atecoCharts.n.destroy();
    atecoCharts.n=new Chart(G('chart-naz'),{type:'doughnut',data:{labels:['Italiani','Stranieri'],datasets:[{data:[naz.IT||0,naz.ST||0],backgroundColor:['#10B981','#F59E0B']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  }

  // Tables
  var tbU=G('tbody-unioni');
  tbU.innerHTML='';
  Object.keys(unioni).sort(function(a,b){return unioni[b].n-unioni[a].n;}).forEach(function(u){
    var d=unioni[u], pD=(d.d/d.n*100).toFixed(1), pS=(d.s/d.n*100).toFixed(1);
    var tr=document.createElement('tr'); tr.style.borderBottom='1px solid var(--border)';
    tr.innerHTML='<td style="padding:12px"><strong>'+u+'</strong></td><td style="text-align:center;padding:12px">'+d.n+'</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">'+pD+'%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">'+pS+'%</td>';
    tbU.appendChild(tr);
  });

  var tbM=G('tbody-mestieri');
  tbM.innerHTML='';
  Object.keys(mestieri).sort(function(a,b){return mestieri[b].n-mestieri[a].n;}).forEach(function(m){
    var d=mestieri[m], pD=(d.d/d.n*100).toFixed(1), pS=(d.s/d.n*100).toFixed(1);
    var tr=document.createElement('tr'); tr.style.borderBottom='1px solid var(--border)';
    tr.innerHTML='<td style="padding:12px"><strong>'+m+'</strong></td><td style="text-align:center;padding:12px">'+d.n+'</td><td style="text-align:center;padding:12px;color:#EC4899;font-weight:600">'+pD+'%</td><td style="text-align:center;padding:12px;color:#F97316;font-weight:600">'+pS+'%</td>';
    tbM.appendChild(tr);
  });
}
