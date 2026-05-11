console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoData=[], atecoFiltered=[];
var atecoCharts={};

async function populateAtecoColumns(){
  console.log('🔄 Inizio popolamento colonne ATECO...');
  showLoad('Popolamento dati ATECO...');
  
  try{
    var tesseramento=await sbGetAll('tesseramento_records');
    console.log('📊 Tesseramento:',tesseramento.length);
    
    var anagrafiche=await anaFetchAll('Anagrafiche');
    console.log('📋 Anagrafiche:',anagrafiche.length);
    
    var codiciateco=await anaFetchAll('codiciateco');
    console.log('🏢 Codiciateco:',codiciateco.length);
    
    var anaMap={};
    anagrafiche.forEach(function(a){if(a.partitaiva) anaMap[a.partitaiva]=a;});
    console.log('📍 Anagrafiche mappate per partitaiva:',Object.keys(anaMap).length);
    
    var codMap={};
    codiciateco.forEach(function(c){if(c.codiceateco) codMap[c.codiceateco]=c;});
    console.log('📍 Codiciateco mappati:',Object.keys(codMap).length);
    
    var matched=0, unmatched=0;
    for(var i=0;i<tesseramento.length;i++){
      var tr=tesseramento[i];
      var piva=tr.partitaiva;
      if(!piva) continue;
      
      var ana=anaMap[piva];
      if(!ana){unmatched++; continue;}
      matched++;
      
      var atecoCode=ana.codiceateco;
      var cod=codMap[atecoCode];
      
      // Sesso: se c'è 'M' o 'F' in ana.sesso, usa quello, altrimenti Maschio
      var sesso='Maschio';
      if(ana.sesso==='F' || ana.sesso==='f') sesso='Femmina';
      else if(ana.sesso==='M' || ana.sesso==='m') sesso='Maschio';
      
      // Nazionalità: se 12° carattere di cftitolare è 'Z', è Straniero
      var nazionalita='Italiano';
      var cf=ana.cftitolare||'';
      if(cf.length>=12 && (cf.charAt(11)==='Z' || cf.charAt(11)==='z')){
        nazionalita='Straniero';
      }
      
      await sbPatch('tesseramento_records?id=eq.'+tr.id, {
        ateco:atecoCode||null,
        unione:cod?.unione||null,
        mestiere:cod?.mestiere||null,
        settore:cod?.settore||null,
        sesso:sesso,
        nazionalita:nazionalita
      });
      
      if((i+1)%500===0) showLoad('Elaborazione: '+(i+1)+'/'+tesseramento.length);
    }
    
    console.log('✅ Matched:',matched,'Unmatched:',unmatched);
    console.log('✅ Popolamento completato!');
    toast('✅ '+matched+' record ATECO aggiornati','success');
    
  }catch(e){
    console.error('❌',e);
    toast('Errore: '+e.message,'error');
  }finally{
    hideLoad();
  }
}

async function atecoLoad(force){
  console.log('🔄 atecoLoad()');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  var tab=G('tab-ateco');
  if(!tab){atecoLoading=false;return;}
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Connessione…</div></div>';

  try{
    G('ateco-msg').textContent='Popolo colonne ATECO…';
    await populateAtecoColumns();
    
    G('ateco-msg').textContent='Caricamento dati…';
    var data=await sbGetAll('tesseramento_records');
    console.log('✅ Dati caricati:',data.length);
    
    // Conta i dati validi
    var validUnione=0, validMestiere=0, validSettore=0;
    data.forEach(function(r){
      if(r.unione && r.unione!=='N/D') validUnione++;
      if(r.mestiere && r.mestiere!=='N/D') validMestiere++;
      if(r.settore && r.settore!=='N/D') validSettore++;
    });
    console.log('📊 Unione validi:',validUnione,'Mestiere validi:',validMestiere,'Settore validi:',validSettore);
    
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

  h+='<div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #A855F7">';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">UNIONE</label><select id="at-unione" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">MESTIERE</label><select id="at-mest" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SETTORE</label><select id="at-sett" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option><option value="Maschio">Maschio</option><option value="Femmina">Femmina</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option><option value="Italiano">Italiano</option><option value="Straniero">Straniero</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;box-shadow:0 4px 6px rgba(168,85,247,0.3)">Reset</button></div>';
  h+='</div></div>';

  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #A855F7;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">CONTRATTI</div><div style="font-size:32px;font-weight:700;color:#A855F7" id="at-k1">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #F97316;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">UNIONI</div><div style="font-size:32px;font-weight:700;color:#F97316" id="at-k2">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #10B981;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">MESTIERI</div><div style="font-size:32px;font-weight:700;color:#10B981" id="at-k3">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #EC4899;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">% DONNE</div><div style="font-size:32px;font-weight:700;color:#EC4899" id="at-k4">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #F59E0B;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">% STRANIERI</div><div style="font-size:32px;font-weight:700;color:#F59E0B" id="at-k5">0</div></div>';
  h+='</div>';

  h+='<div id="at-cards-container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:20px"></div>';

  h+='</div>';
  tab.innerHTML=h;
}

function atecoPopulateFilters(){
  var anni=new Set(), unioni=new Set(), mestieri=new Set(), settori=new Set();
  atecoData.forEach(function(r){
    if(r.anno) anni.add(String(r.anno));
    if(r.unione && r.unione!=='N/D') unioni.add(r.unione);
    if(r.mestiere && r.mestiere!=='N/D') mestieri.add(r.mestiere);
    if(r.settore && r.settore!=='N/D') settori.add(r.settore);
  });
  
  var selAnno=G('at-anno');
  Array.from(anni).sort().reverse().forEach(function(a){
    var o=document.createElement('option');
    o.value=a;
    o.textContent=a;
    selAnno.appendChild(o);
  });
  
  var selUnione=G('at-unione');
  Array.from(unioni).sort().forEach(function(u){
    var o=document.createElement('option');
    o.value=u;
    o.textContent=u;
    selUnione.appendChild(o);
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
  var byUnione={}, byMestiere={}, bySettore={}, byNazionalita={}, bySesso={};
  var donne=0, stranieri=0;
  
  atecoFiltered.forEach(function(r){
    var u=r.unione||'N/D';
    byUnione[u]=(byUnione[u]||0)+1;
    
    var m=r.mestiere||'N/D';
    byMestiere[m]=(byMestiere[m]||0)+1;
    
    var s=r.settore||'N/D';
    bySettore[s]=(bySettore[s]||0)+1;
    
    var n=r.nazionalita||'Italiano';
    byNazionalita[n]=(byNazionalita[n]||0)+1;
    
    var sx=r.sesso||'Maschio';
    bySesso[sx]=(bySesso[sx]||0)+1;
    
    if(sx==='Femmina') donne++;
    if(n==='Straniero') stranieri++;
  });
  
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=Object.keys(byUnione).filter(k=>k!=='N/D').length;
  G('at-k3').textContent=Object.keys(byMestiere).filter(k=>k!=='N/D').length;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';
  G('at-k5').textContent=tot>0?(stranieri/tot*100).toFixed(1)+'%':'0%';
  
  var container=G('at-cards-container');
  container.innerHTML='';
  
  renderCategoryCard(byUnione,'Unione','#A855F7',tot,container);
  renderCategoryCard(byMestiere,'Mestiere','#F97316',tot,container);
  renderCategoryCard(bySettore,'Settore','#10B981',tot,container);
  renderCategoryCard(byNazionalita,'Nazionalità','#7C3AED',tot,container);
  renderCategoryCard(bySesso,'Sesso','#CA8A04',tot,container);
}

function renderCategoryCard(data,title,color,total,container){
  var sorted=Object.keys(data).sort(function(a,b){return data[b]-data[a];});
  
  var cardDiv=document.createElement('div');
  cardDiv.style.cssText='background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid '+color;
  
  var headerDiv=document.createElement('div');
  headerDiv.style.cssText='background:linear-gradient(135deg,'+color+'80,'+color+'40);padding:16px;border-left:4px solid '+color;
  headerDiv.innerHTML='<div style="font-weight:700;font-size:14px;color:#333">'+title+'</div>';
  cardDiv.appendChild(headerDiv);
  
  var contentDiv=document.createElement('div');
  contentDiv.style.cssText='padding:16px;max-height:400px;overflow-y:auto';
  
  sorted.slice(0,15).forEach(function(key){
    var count=data[key];
    var pct=total>0?((count/total)*100).toFixed(1):0;
    
    var itemDiv=document.createElement('div');
    itemDiv.style.cssText='margin-bottom:12px;padding:10px;background:#F9FAFB;border-radius:6px';
    itemDiv.innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><strong style="color:#333">'+escapeHtml(key)+'</strong><span style="color:#666">'+count+' ('+pct+'%)</span></div><div style="background:#E5E7EB;height:6px;border-radius:3px"><div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:3px;box-shadow:0 0 8px '+color+'40"></div></div>';
    contentDiv.appendChild(itemDiv);
  });
  
  if(sorted.length>15){
    var moreBtn=document.createElement('button');
    moreBtn.textContent='Mostra altro...';
    moreBtn.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid '+color+';color:'+color+';border-radius:6px;cursor:pointer;font-weight:600;margin-top:8px';
    
    moreBtn.onclick=function(){
      contentDiv.innerHTML='';
      sorted.forEach(function(key){
        var count=data[key];
        var pct=total>0?((count/total)*100).toFixed(1):0;
        var itemDiv=document.createElement('div');
        itemDiv.style.cssText='margin-bottom:12px;padding:10px;background:#F9FAFB;border-radius:6px';
        itemDiv.innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><strong style="color:#333">'+escapeHtml(key)+'</strong><span style="color:#666">'+count+' ('+pct+'%)</span></div><div style="background:#E5E7EB;height:6px;border-radius:3px"><div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:3px;box-shadow:0 0 8px '+color+'40"></div></div>';
        contentDiv.appendChild(itemDiv);
      });
      var hideBtn=document.createElement('button');
      hideBtn.textContent='Nascondi';
      hideBtn.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid '+color+';color:'+color+';border-radius:6px;cursor:pointer;font-weight:600;margin-top:8px';
      hideBtn.onclick=function(){renderCategoryCard(data,title,color,total,container);};
      contentDiv.appendChild(hideBtn);
    };
    contentDiv.appendChild(moreBtn);
  }
  
  cardDiv.appendChild(contentDiv);
  container.appendChild(cardDiv);
}

function escapeHtml(text){
  var div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}
