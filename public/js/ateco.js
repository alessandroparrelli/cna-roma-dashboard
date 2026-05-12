console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoData=[], atecoFiltered=[];

async function atecoLoad(force){
  console.log('🔄 atecoLoad()');
  if(atecoLoading) return;
  if(atecoLoaded && !force) return;
  atecoLoading=true;

  var tab=G('tab-ateco');
  if(!tab){atecoLoading=false;return;}
  tab.innerHTML='<div style="padding:40px;text-align:center"><div style="font-size:18px;margin-bottom:10px">📊 Caricamento dati…</div><div id="ateco-msg" style="color:var(--text-secondary)">Lettura dati…</div></div>';

  try{
    G('ateco-msg').textContent='Caricamento tesseramento_records…';
    var data=await sbGetAll('tesseramento_records');
    
    // Filtra solo record con dati ATECO completi
    atecoData=data.filter(function(r){
      return r.unione && r.mestiere && r.settore && r.sesso && r.nazionalita;
    });
    
    console.log('📊 Tot record:',data.length,'Validi per ATECO:',atecoData.length);
    
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
  var h='<div style="padding:20px">';

  // FILTRI
  h+='<div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #A855F7">';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">UNIONE</label><select id="at-unione" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">MESTIERE</label><select id="at-mest" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SETTORE</label><select id="at-sett" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#A855F7,#7E22CE);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;box-shadow:0 4px 6px rgba(168,85,247,0.3)">Reset</button></div>';
  h+='</div></div>';

  // KPI
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
  
  // Struttura: {categoria: {sesso: count, naz: count, ...}}
  var sesso={}, naz={};
  
  atecoFiltered.forEach(function(r){
    var u=r.unione||'N/D';
    var m=r.mestiere||'N/D';
    var s=r.settore||'N/D';
    var sx=r.sesso||'N/D';
    var n=r.nazionalita||'N/D';
    
    // Conta per categoria
    if(!byUnione[u]) byUnione[u]={tot:0,sesso:{},naz:{}};
    byUnione[u].tot++;
    byUnione[u].sesso[sx]=(byUnione[u].sesso[sx]||0)+1;
    byUnione[u].naz[n]=(byUnione[u].naz[n]||0)+1;
    
    if(!byMestiere[m]) byMestiere[m]={tot:0,sesso:{},naz:{}};
    byMestiere[m].tot++;
    byMestiere[m].sesso[sx]=(byMestiere[m].sesso[sx]||0)+1;
    byMestiere[m].naz[n]=(byMestiere[m].naz[n]||0)+1;
    
    if(!bySettore[s]) bySettore[s]={tot:0,sesso:{},naz:{}};
    bySettore[s].tot++;
    bySettore[s].sesso[sx]=(bySettore[s].sesso[sx]||0)+1;
    bySettore[s].naz[n]=(bySettore[s].naz[n]||0)+1;
    
    // Totali globali
    sesso[sx]=(sesso[sx]||0)+1;
    naz[n]=(naz[n]||0)+1;
    
    if(sx==='Femmina') donne++;
    if(n==='Straniero') stranieri++;
  });
  
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=Object.keys(byUnione).length;
  G('at-k3').textContent=Object.keys(byMestiere).length;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';
  G('at-k5').textContent=tot>0?(stranieri/tot*100).toFixed(1)+'%':'0%';
  
  var container=G('at-cards-container');
  container.innerHTML='';
  
  renderCategoryCardWithBreakdown(byUnione,'Unione','#A855F7',tot,container);
  renderCategoryCardWithBreakdown(byMestiere,'Mestiere','#F97316',tot,container);
  renderCategoryCardWithBreakdown(bySettore,'Settore','#10B981',tot,container);
}

function renderCategoryCardWithBreakdown(data,title,color,total,container){
  var sorted=Object.keys(data).sort(function(a,b){return data[b].tot-data[a].tot;});
  
  var cardDiv=document.createElement('div');
  cardDiv.style.cssText='background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid '+color;
  
  var headerDiv=document.createElement('div');
  headerDiv.style.cssText='background:linear-gradient(135deg,'+color+'80,'+color+'40);padding:16px;border-left:4px solid '+color;
  headerDiv.innerHTML='<div style="font-weight:700;font-size:14px;color:#333">'+title+'</div>';
  cardDiv.appendChild(headerDiv);
  
  var contentDiv=document.createElement('div');
  contentDiv.style.cssText='padding:16px;max-height:450px;overflow-y:auto';
  
  sorted.slice(0,15).forEach(function(key){
    var item=data[key];
    var pct=total>0?((item.tot/total)*100).toFixed(1):0;
    
    var itemDiv=document.createElement('div');
    itemDiv.style.cssText='margin-bottom:14px;padding:10px;background:#F9FAFB;border-radius:6px';
    
    var html='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;font-weight:600"><strong style="color:#333">'+escapeHtml(key)+'</strong><span style="color:#666">'+item.tot+' ('+pct+'%)</span></div>';
    
    // Barra principale
    html+='<div style="background:#E5E7EB;height:6px;border-radius:3px;margin-bottom:8px"><div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:3px;box-shadow:0 0 8px '+color+'40"></div></div>';
    
    // Breakdown sesso
    html+='<div style="font-size:11px;margin-bottom:6px;padding:6px;background:white;border-radius:4px;border-left:2px solid #EC4899">';
    Object.keys(item.sesso).forEach(function(s){
      var cnt=item.sesso[s];
      var pctSesso=item.tot>0?((cnt/item.tot)*100).toFixed(0):'0';
      html+='<div style="color:#666">'+s+': <strong style="color:#EC4899">'+cnt+' ('+pctSesso+'%)</strong></div>';
    });
    html+='</div>';
    
    // Breakdown nazionalità
    html+='<div style="font-size:11px;padding:6px;background:white;border-radius:4px;border-left:2px solid #F59E0B">';
    Object.keys(item.naz).forEach(function(n){
      var cnt=item.naz[n];
      var pctNaz=item.tot>0?((cnt/item.tot)*100).toFixed(0):'0';
      html+='<div style="color:#666">'+n+': <strong style="color:#F59E0B">'+cnt+' ('+pctNaz+'%)</strong></div>';
    });
    html+='</div>';
    
    itemDiv.innerHTML=html;
    contentDiv.appendChild(itemDiv);
  });
  
  if(sorted.length>15){
    var moreBtn=document.createElement('button');
    moreBtn.textContent='Mostra altro...';
    moreBtn.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid '+color+';color:'+color+';border-radius:6px;cursor:pointer;font-weight:600;margin-top:8px';
    
    moreBtn.onclick=function(){
      contentDiv.innerHTML='';
      sorted.forEach(function(key){
        var item=data[key];
        var pct=total>0?((item.tot/total)*100).toFixed(1):0;
        
        var itemDiv=document.createElement('div');
        itemDiv.style.cssText='margin-bottom:14px;padding:10px;background:#F9FAFB;border-radius:6px';
        
        var html='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;font-weight:600"><strong style="color:#333">'+escapeHtml(key)+'</strong><span style="color:#666">'+item.tot+' ('+pct+'%)</span></div>';
        html+='<div style="background:#E5E7EB;height:6px;border-radius:3px;margin-bottom:8px"><div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:3px;box-shadow:0 0 8px '+color+'40"></div></div>';
        
        html+='<div style="font-size:11px;margin-bottom:6px;padding:6px;background:white;border-radius:4px;border-left:2px solid #EC4899">';
        Object.keys(item.sesso).forEach(function(s){
          var cnt=item.sesso[s];
          var pctSesso=item.tot>0?((cnt/item.tot)*100).toFixed(0):'0';
          html+='<div style="color:#666">'+s+': <strong style="color:#EC4899">'+cnt+' ('+pctSesso+'%)</strong></div>';
        });
        html+='</div>';
        
        html+='<div style="font-size:11px;padding:6px;background:white;border-radius:4px;border-left:2px solid #F59E0B">';
        Object.keys(item.naz).forEach(function(n){
          var cnt=item.naz[n];
          var pctNaz=item.tot>0?((cnt/item.tot)*100).toFixed(0):'0';
          html+='<div style="color:#666">'+n+': <strong style="color:#F59E0B">'+cnt+' ('+pctNaz+'%)</strong></div>';
        });
        html+='</div>';
        
        itemDiv.innerHTML=html;
        contentDiv.appendChild(itemDiv);
      });
      
      var hideBtn=document.createElement('button');
      hideBtn.textContent='Nascondi';
      hideBtn.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid '+color+';color:'+color+';border-radius:6px;cursor:pointer;font-weight:600;margin-top:8px';
      hideBtn.onclick=function(){renderCategoryCardWithBreakdown(data,title,color,total,container);};
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
