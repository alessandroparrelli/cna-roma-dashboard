console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoData=[], atecoFiltered=[];
var atecoCharts={};

// STEP 1: Popola le 6 colonne in tesseramento_records
async function populateAtecoColumns(){
  console.log('🔄 Inizio popolamento colonne ATECO in tesseramento_records...');
  showLoad('Popolamento dati ATECO...');
  
  try{
    // Carica i dati
    var tesseramento=await sbGetAll('tesseramento_records');
    console.log('📊 Tesseramento records:',tesseramento.length);
    
    var anagrafiche=await anaFetchAll('Anagrafiche');
    console.log('📋 Anagrafiche:',anagrafiche.length);
    
    var codiciateco=await anaFetchAll('codiciateco');
    console.log('🏢 Codiciateco:',codiciateco.length);
    
    // Mappa per lookup veloce per partitaiva
    var anaMap={};
    anagrafiche.forEach(function(a){
      if(a.partitaiva) anaMap[a.partitaiva]=a;
    });
    
    // Mappa per lookup veloce per codiceateco
    var codMap={};
    codiciateco.forEach(function(c){
      if(c.codiceateco) codMap[c.codiceateco]=c;
    });
    
    console.log('✏️ Inizio elaborazione',tesseramento.length,'record...');
    
    // Per ogni record in tesseramento_records
    for(var i=0;i<tesseramento.length;i++){
      var tr=tesseramento[i];
      var piva=tr.partitaiva;
      
      if(!piva) continue;
      
      var ana=anaMap[piva];
      if(!ana) continue;
      
      var atecoCode=ana.codiceateco;
      var cod=codMap[atecoCode];
      
      // Calcola sesso
      var sesso=ana.sesso || calcSessoFromCF(ana.cftitolare);
      
      // Calcola nazionalità
      var nazionalita=calcNazionalitaFromCF(ana.cftitolare);
      
      // Aggiorna il record
      await sbPatch('tesseramento_records?id=eq.'+tr.id, {
        ateco:atecoCode||null,
        unione:cod?.unione||null,
        mestiere:cod?.mestiere||null,
        settore:cod?.settore||null,
        sesso:sesso||null,
        nazionalita:nazionalita||null
      });
      
      if((i+1)%500===0){
        showLoad('Elaborazione: '+(i+1)+'/'+tesseramento.length);
      }
    }
    
    console.log('✅ Popolamento completato!');
    toast('✅ Colonne ATECO populate','success');
    
  }catch(e){
    console.error('❌ Errore:',e);
    toast('Errore: '+e.message,'error');
  }finally{
    hideLoad();
  }
}

function calcSessoFromCF(cf){
  if(!cf||cf.length<10) return null;
  var giorno=parseInt(cf.substring(9,11));
  if(isNaN(giorno)) return null;
  return giorno>40?'Femmina':'Maschio';
}

function calcNazionalitaFromCF(cf){
  if(!cf||cf.length<6) return 'Italiano';
  var pattern=/^[A-Z]{3}[A-Z]{3}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
  return pattern.test(cf)?'Italiano':'Straniero';
}

// STEP 2: Carica e visualizza i dati ATECO
async function atecoLoad(force){
  console.log('🔄 atecoLoad()');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  var tab=G('tab-ateco');
  if(!tab){atecoLoading=false;return;}
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Connessione…</div></div>';

  try{
    // Prima popola le colonne se non sono state populate
    G('ateco-msg').textContent='Popolo colonne ATECO…';
    await populateAtecoColumns();
    
    // Poi carica i dati da tesseramento_records
    G('ateco-msg').textContent='Caricamento dati…';
    var data=await sbGetAll('tesseramento_records');
    console.log('✅ Dati tesseramento caricati:',data.length);
    
    atecoData=data;
    atecoFiltered=data.slice();
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
  var h='<div style="padding:20px">';

  // FILTRI
  h+='<div style="background:var(--surface);padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #A855F7">';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">MESTIERE</label><select id="at-mest" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">SETTORE</label><select id="at-sett" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="Maschio">Maschio</option><option value="Femmina">Femmina</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg)"><option value="">Tutti</option><option value="Italiano">Italiano</option><option value="Straniero">Straniero</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset</button></div>';
  h+='</div></div>';

  // KPI
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
  h+='<div style="background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">CONTRATTI</div><div style="font-size:32px;font-weight:700" id="at-k1">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#F97316,#EA580C);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">UNIONI</div><div style="font-size:32px;font-weight:700" id="at-k2">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">MESTIERI</div><div style="font-size:32px;font-weight:700" id="at-k3">0</div></div>';
  h+='<div style="background:linear-gradient(135deg,#EC4899,#BE185D);color:white;padding:18px;border-radius:8px;text-align:center"><div style="font-size:11px;opacity:0.9">% DONNE</div><div style="font-size:32px;font-weight:700" id="at-k4">0</div></div>';
  h+='</div>';

  // CARD per categoria
  h+='<div id="at-cards-container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:20px"></div>';

  h+='</div>';
  tab.innerHTML=h;
}

function atecoPopulateFilters(){
  var anni=new Set(), mestieri=new Set(), settori=new Set();
  atecoData.forEach(function(r){
    if(r.anno) anni.add(String(r.anno));
    if(r.mestiere) mestieri.add(r.mestiere);
    if(r.settore) settori.add(r.settore);
  });
  
  var selAnno=G('at-anno');
  Array.from(anni).sort().reverse().forEach(function(a){
    var o=document.createElement('option');
    o.value=a;
    o.textContent=a;
    selAnno.appendChild(o);
  });
  
  var selMest=G('at-mest');
  Array.from(mestieri).sort().forEach(function(m){
    var o=document.createElement('option');
    o.value=m;
    o.textContent=m;
    selMest.appendChild(o);
  });
  
  var selSett=G('at-sett');
  Array.from(settori).sort().forEach(function(s){
    var o=document.createElement('option');
    o.value=s;
    o.textContent=s;
    selSett.appendChild(o);
  });
  
  ['at-anno','at-mest','at-sett','at-sex','at-naz'].forEach(function(id){
    var el=G(id);
    if(el) el.addEventListener('change',atecoApply);
  });
  G('at-reset').addEventListener('click',atecoReset);
}

function atecoApply(){
  var anno=G('at-anno').value;
  var mest=G('at-mest').value;
  var sett=G('at-sett').value;
  var sex=G('at-sex').value;
  var naz=G('at-naz').value;
  
  atecoFiltered=atecoData.filter(function(r){
    if(anno && String(r.anno)!==anno) return false;
    if(mest && r.mestiere!==mest) return false;
    if(sett && r.settore!==sett) return false;
    if(sex && r.sesso!==sex) return false;
    if(naz && r.nazionalita!==naz) return false;
    return true;
  });
  atecoRender();
}

function atecoReset(){
  ['at-anno','at-mest','at-sett','at-sex','at-naz'].forEach(function(id){G(id).value='';});
  atecoFiltered=atecoData.slice();
  atecoRender();
}

function atecoRender(){
  var tot=atecoFiltered.length;
  var byUnione={}, byMestiere={}, bySettore={}, byNazionalita={}, bySesso={};
  var donne=0;
  
  atecoFiltered.forEach(function(r){
    // Unione
    var u=r.unione||'N/D';
    byUnione[u]=(byUnione[u]||0)+1;
    
    // Mestiere
    var m=r.mestiere||'N/D';
    byMestiere[m]=(byMestiere[m]||0)+1;
    
    // Settore
    var s=r.settore||'N/D';
    bySettore[s]=(bySettore[s]||0)+1;
    
    // Nazionalità
    var n=r.nazionalita||'Italiano';
    byNazionalita[n]=(byNazionalita[n]||0)+1;
    
    // Sesso
    var sx=r.sesso||'N/D';
    bySesso[sx]=(bySesso[sx]||0)+1;
    if(sx==='Femmina') donne++;
  });
  
  // KPI
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=Object.keys(byUnione).length;
  G('at-k3').textContent=Object.keys(byMestiere).length;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';
  
  // Render card
  renderCategoryCards(byUnione,'Unione','#A855F7',tot);
  renderCategoryCards(byMestiere,'Mestiere','#F97316',tot);
  renderCategoryCards(bySettore,'Settore','#10B981',tot);
  renderCategoryCards(byNazionalita,'Nazionalità','#7C3AED',tot);
  renderCategoryCards(bySesso,'Sesso','#CA8A04',tot);
}

function renderCategoryCards(data,title,color,total){
  var container=G('at-cards-container');
  if(!container) return;
  
  var sorted=Object.keys(data).sort(function(a,b){return data[b]-data[a];});
  
  var cardHTML='<div style="background:var(--surface);border-radius:8px;overflow:hidden;border-left:4px solid '+color+'">';
  cardHTML+='<div style="background:'+color+';color:white;padding:14px;font-weight:600;font-size:13px">'+title+'</div>';
  cardHTML+='<div style="padding:16px">';
  
  sorted.forEach(function(key){
    var count=data[key];
    var pct=total>0?((count/total)*100).toFixed(1):0;
    cardHTML+='<div style="margin-bottom:12px">';
    cardHTML+='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
    cardHTML+='<strong>'+escapeHtml(key)+'</strong>';
    cardHTML+='<span>'+count+' ('+pct+'%)</span>';
    cardHTML+='</div>';
    cardHTML+='<div style="background:var(--border);height:6px;border-radius:3px">';
    cardHTML+='<div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:3px;transition:width 0.3s"></div>';
    cardHTML+='</div>';
    cardHTML+='</div>';
  });
  
  cardHTML+='</div></div>';
  
  // Aggiungi alla container
  var tempDiv=document.createElement('div');
  tempDiv.innerHTML=cardHTML;
  container.appendChild(tempDiv.firstChild);
}

function escapeHtml(text){
  var div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}
