console.log('✅ ateco.js CARICATO');

var atecoLoaded=false, atecoLoading=false, atecoData=[], atecoFiltered=[];

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
  var h='<div style="padding:20px">';

  // FILTRI
  h+='<div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #0047AB">';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">ANNO</label><select id="at-anno" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">UNIONE</label><select id="at-unione" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">MESTIERE</label><select id="at-mest" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SETTORE</label><select id="at-sett" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">SESSO</label><select id="at-sex" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:#333">NAZIONALITÀ</label><select id="at-naz" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:6px;background:white;color:#333"><option value="">Tutti</option></select></div>';
  h+='<div style="display:flex;align-items:flex-end"><button id="at-reset" style="width:100%;padding:10px;background:linear-gradient(135deg,#0047AB,#003380);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;box-shadow:0 4px 6px rgba(0,71,171,0.3)">Reset</button></div>';
  h+='</div></div>';

  // KPI
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #0047AB;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">CONTRATTI</div><div style="font-size:32px;font-weight:700;color:#0047AB" id="at-k1">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #DC2626;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">UNIONI</div><div style="font-size:32px;font-weight:700;color:#DC2626" id="at-k2">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #F59E0B;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">MESTIERI</div><div style="font-size:32px;font-weight:700;color:#F59E0B" id="at-k3">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #EC4899;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">% DONNE</div><div style="font-size:32px;font-weight:700;color:#EC4899" id="at-k4">0</div></div>';
  h+='<div style="background:white;padding:18px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);border-left:4px solid #10B981;text-align:center"><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:8px">% STRANIERI</div><div style="font-size:32px;font-weight:700;color:#10B981" id="at-k5">0</div></div>';
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
    var n=String(r.nazionalita||'').trim().toLowerCase();
    
    // Debug
    sessoCount[sx]=(sessoCount[sx]||0)+1;
    nazCount[n]=(nazCount[n]||0)+1;
    
    if(!byUnione[u]) byUnione[u]={tot:0,maschi:0,femmine:0,stranieri:0};
    byUnione[u].tot++;
    if(sx==='M' || sx==='m') byUnione[u].maschi++;
    if(sx==='F' || sx==='f') byUnione[u].femmine++;
    if(n==='straniero') byUnione[u].stranieri++;
    
    if(!byMestiere[m]) byMestiere[m]={tot:0,maschi:0,femmine:0,stranieri:0};
    byMestiere[m].tot++;
    if(sx==='M' || sx==='m') byMestiere[m].maschi++;
    if(sx==='F' || sx==='f') byMestiere[m].femmine++;
    if(n==='straniero') byMestiere[m].stranieri++;
    
    if(!bySettore[s]) bySettore[s]={tot:0,maschi:0,femmine:0,stranieri:0};
    bySettore[s].tot++;
    if(sx==='M' || sx==='m') bySettore[s].maschi++;
    if(sx==='F' || sx==='f') bySettore[s].femmine++;
    if(n==='straniero') bySettore[s].stranieri++;
    
    if(sx==='F' || sx==='f') donne++;
    if(n==='straniero') stranieri++;
  });
  
  console.log('Debug sesso:',sessoCount);
  console.log('Debug nazionalita:',nazCount);
  console.log('Donne:',donne,'Stranieri:',stranieri);
  
  G('at-k1').textContent=tot.toLocaleString('it-IT');
  G('at-k2').textContent=Object.keys(byUnione).length;
  G('at-k3').textContent=Object.keys(byMestiere).length;
  G('at-k4').textContent=tot>0?(donne/tot*100).toFixed(1)+'%':'0%';
  G('at-k5').textContent=tot>0?(stranieri/tot*100).toFixed(1)+'%':'0%';
  
  var container=G('at-cards-container');
  container.innerHTML='';
  
  renderTableCard(byUnione,'UNIONE','#0047AB',tot,container);
  renderTableCard(byMestiere,'MESTIERE','#DC2626',tot,container);
  renderTableCard(bySettore,'SETTORE','#F59E0B',tot,container);
}

function renderTableCard(data,title,color,total,container){
  var sorted=Object.keys(data).sort(function(a,b){return data[b].tot-data[a].tot;});
  
  var cardDiv=document.createElement('div');
  cardDiv.style.cssText='background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);margin-bottom:20px';
  
  var headerDiv=document.createElement('div');
  headerDiv.style.cssText='background:'+color+';padding:16px;color:white;font-weight:700;font-size:14px';
  headerDiv.innerHTML=title;
  cardDiv.appendChild(headerDiv);
  
  var tableDiv=document.createElement('div');
  tableDiv.style.cssText='overflow-x:auto;padding:16px';
  
  var html='<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html+='<thead><tr style="background:#F3F4F6;border-bottom:2px solid #E5E7EB">';
  html+='<th style="text-align:left;padding:10px;font-weight:700;color:#333">'+title+'</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#333">TOTALE</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#333">%</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#0047AB">MASCHI</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#0047AB">%</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#EC4899">FEMMINE</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#EC4899">%</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#10B981">STRANIERI</th>';
  html+='<th style="text-align:center;padding:10px;font-weight:700;color:#10B981">%</th>';
  html+='</tr></thead><tbody>';
  
  sorted.forEach(function(key){
    var item=data[key];
    var pctTot=total>0?((item.tot/total)*100).toFixed(1):0;
    var pctM=item.tot>0?((item.maschi/item.tot)*100).toFixed(0):0;
    var pctF=item.tot>0?((item.femmine/item.tot)*100).toFixed(0):0;
    var pctS=item.tot>0?((item.stranieri/item.tot)*100).toFixed(0):0;
    
    html+='<tr style="border-bottom:1px solid #E5E7EB">';
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
  var totMaschi=0, totFemmine=0, totStranieri=0;
  sorted.forEach(function(key){
    totMaschi+=data[key].maschi;
    totFemmine+=data[key].femmine;
    totStranieri+=data[key].stranieri;
  });
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
  tableDiv.innerHTML=html;
  cardDiv.appendChild(tableDiv);
  container.appendChild(cardDiv);
}

function escapeHtml(text){
  var div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}
