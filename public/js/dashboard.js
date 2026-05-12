// v2026.05.07.2 - cache busting
async function loadDashboard(){
  showLoad('Caricamento dati…');
  try{
    var data=await sbGetAll(TR);
    allDataRaw=data; // dati raw per tab Ateco
    allData=data.map(mapRow);
    // La tabs-bar è sempre visibile dopo login: il tab Anagrafiche
    // è un modulo indipendente che legge da altre tabelle.
    G('tabs-bar').style.display='flex';
    
    // FILTRA TAB IN BASE AL RUOLO
    document.querySelectorAll('.tab-btn').forEach(function(btn){
      var tabId = btn.getAttribute('data-tab');
      if(!canAccessTab(tabId)){
        btn.style.display = 'none';
      }
    });
    
    if(allData.length>0){
      G('upload-zone').style.display='none';
      G('tab-overview').classList.add('active');
      rebuildFilters();
      renderOverview();
      renderPromoTrend();
    }else if(isAdmin()){
      // Admin senza dati tesseramento: mostra l'upload zone, ma i tab restano accessibili
      G('upload-zone').style.display='flex';
    }else{
      // Utente non admin senza dati tesseramento: messaggio informativo nel tab overview
      G('tab-overview').classList.add('active');
      G('tab-overview').innerHTML='<div style="text-align:center;padding:80px 20px;color:var(--text-dim)"><div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text-sub)">Nessun dato tesseramento disponibile</div><div style="font-size:13px">Attendi che l\'amministratore carichi i dati, oppure consulta il tab <b style="color:var(--blue)">🗂️ Interroga archivio</b></div></div>';
    }
  }catch(e){toast('Errore: '+e.message,'error');}
  finally{hideLoad();}
}

function mapRow(r){return{tiporete:r.tiporete||'N/D',promotore:r.promotore||'N/D',acuradi:r.acuradi||'N/D',importo:parseFloat(r.importo)||0,anno:r.anno,mese:r.mese,partitaiva:r.partitaiva||null,codicecliente:r.codicecliente||null};}

// FILE UPLOAD
function handleFile(file,isAdd){
  if(!isAdmin()){toast('Non autorizzato','error');return;}
  if(!file)return;
  var ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='xlsx'&&ext!=='xls'){toast('Formato non supportato','error');return;}
  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      showLoad('Lettura file…');
      var wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      console.log('📊 File Excel letto. Sheet names:',wb.SheetNames);
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      console.log('📄 Righe lette:',rows.length);
      if(rows.length>0) console.log('Colonne disponibili:',Object.keys(rows[0]));
      var parsed=parseRows(rows);
      if(!parsed.length){toast('Nessun dato valido','error');hideLoad();return;}
      showLoad('Salvataggio '+parsed.length+' record…');
      for(var i=0;i<parsed.length;i+=500){
        var chunk=parsed.slice(i,i+500).map(function(r){return{tiporete:r.tiporete,promotore:r.promotore,acuradi:r.acuradi,importo:r.importo,anno:r.anno,mese:r.mese,partitaiva:r.partitaiva,codicecliente:r.codicecliente,ateco:r.ateco,unione:r.unione,mestiere:r.mestiere,settore:r.settore,sesso:r.sesso,nazionalita:r.nazionalita,fonte:file.name};});
        await sbPost(TR,chunk,{'Prefer':'return=minimal'});
      }
      showLoad('Aggiornamento…');
      var data=await sbGetAll(TR);
      allData=data.map(mapRow);
      G('tabs-bar').style.display='flex';
      G('upload-zone').style.display='none';
      rebuildFilters();renderOverview();renderPromoTrend();
      toast('✓ '+parsed.length+' record salvati','success');
    }catch(err){toast('Errore: '+err.message,'error');}
    finally{hideLoad();}
  };
  reader.readAsArrayBuffer(file);
}

function parseRows(rows){
  var out=[];
  if(rows.length>0){
    console.log('Colonne ricevute:',Object.keys(rows[0]));
    console.log('Prima riga:',rows[0]);
    // Log specifico per le colonne ATECO
    console.log('ateco:',rows[0]['ateco']);
    console.log('unione:',rows[0]['unione']);
    console.log('mestiere:',rows[0]['mestiere']);
    console.log('settore:',rows[0]['settore']);
    console.log('sesso:',rows[0]['sesso']);
    console.log('nazionalita:',rows[0]['nazionalita']);
  }
  var skipped=0;
  rows.forEach(function(r,idx){
    if(idx===0){
      console.log('📋 TUTTE LE COLONNE:');
      Object.keys(r).forEach(function(k){console.log('  -',k);});
    }
    var imp=parseFloat(r['Importo']);
    if(isNaN(imp)){
      skipped++;
      if(skipped<=5) console.log('⚠️ Riga',idx,'saltata - Importo non valido:',r['Importo']);
      return;
    }
    var dv=r['F,6: Data Stipula']||r['Data Stipula']||'';var d=null;
    if(dv instanceof Date&&!isNaN(dv))d=dv;
    else if(typeof dv==='string'&&dv)d=new Date(dv);
    else if(typeof dv==='number'){try{var dt=XLSX.SSF.parse_date_code(dv);if(dt)d=new Date(dt.y,dt.m-1,dt.d);}catch(x){}}
    
    var naz=String(r['nazionalità']||r['nazionalita']||'').trim();
    var sx=String(r['sesso']||'').trim();
    // Normalizza sesso: M->Maschio, F->Femmina
    if(sx==='M' || sx==='m') sx='Maschio';
    else if(sx==='F' || sx==='f') sx='Femmina';
    
    if(idx===0) console.log('🔍 DEBUG RIGA 0 - nazionalita raw:', r['nazionalita'], '| naz dopo trim:', naz, '| naz||null:', naz||null);
    
    out.push({tiporete:String(r['Tipo rete']||'').trim()||'N/D',promotore:String(r['Promotore']||'').trim()||'N/D',acuradi:String(r['A cura di']||'').trim()||'N/D',importo:imp,anno:d&&!isNaN(d)?d.getFullYear():null,mese:d&&!isNaN(d)?d.getMonth()+1:null,partitaiva:String(r['B,2: Partita IVA']||'').trim()||null,codicecliente:String(r['C,3: Codice Cliente']||'').trim()||null,ateco:String(r['ateco']||'').trim()||null,unione:String(r['unione']||'').trim()||null,mestiere:String(r['mestiere']||'').trim()||null,settore:String(r['settore']||'').trim()||null,sesso:sx||null,nazionalita:naz||null});
  });
  console.log('✅ Parsed:',out.length,'record. Skipped:',skipped);
  return out;
}

// FILTERS
function getFiltered(){
  var an=G('f-anno').value,me=G('f-mese').value,tr=G('f-tiporete').value,pr=G('f-promotore').value,ac=G('f-acuradi').value;
  return allData.filter(function(r){return(!an||String(r.anno)===an)&&(!me||String(r.mese)===me)&&(!tr||r.tiporete===tr)&&(!pr||r.promotore===pr)&&(!ac||r.acuradi===ac);});
}
function getPromoFiltered(){
  var an=G('fp-anno').value;
  var meDa=parseInt(G('fp-mese-da').value)||0;
  var meA=parseInt(G('fp-mese-a').value)||0;
  var tr=G('fp-tiporete').value;
  return allData.filter(function(r){
    if(an && String(r.anno)!==an) return false;
    if(meDa>0 && (r.mese===null || r.mese<meDa)) return false;
    if(meA>0 && (r.mese===null || r.mese>meA)) return false;
    if(tr && r.tiporete!==tr) return false;
    return true;
  });
}
function unique(d,k){var s={};d.forEach(function(r){s[r[k]]=1;});return Object.keys(s);}
function rebuildFilters(){
  rSel('f-anno',unique(allData,'anno').filter(Boolean).sort().reverse(),function(v){return v;},'Tutti');
  rSel('f-mese',unique(allData,'mese').filter(Boolean).sort(function(a,b){return a-b;}),function(v){return MESI[v]||v;},'Tutti');
  rSel('f-tiporete',unique(allData,'tiporete').sort(),null,'Tutti');
  rSel('f-promotore',unique(allData,'promotore').sort(),null,'Tutti');
  rSel('f-acuradi',unique(allData,'acuradi').sort(),null,'Tutti');
  rSel('fp-anno',unique(allData,'anno').filter(Boolean).sort().reverse(),function(v){return v;},'Tutti gli anni');
  var mesiOrdinati=unique(allData,'mese').filter(Boolean).sort(function(a,b){return a-b;});
  rSel('fp-mese-da',mesiOrdinati,function(v){return MESI[v]||v;},'Tutti');
  rSel('fp-mese-a',mesiOrdinati,function(v){return MESI[v]||v;},'Tutti');
  rSel('fp-tiporete',unique(allData,'tiporete').sort(),null,'Tutti');
}
function rSel(id,vals,lFn,all){var s=G(id),p=s.value;s.innerHTML='<option value="">'+all+'</option>';vals.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=lFn?lFn(v):v;if(String(v)===p)o.selected=true;s.appendChild(o);});}

// AGGREGATE
function agg(data,key){
  var m={};
  data.forEach(function(r){var k=r[key];if(!m[k])m[k]={label:k,count:0,total:0};m[k].count++;m[k].total+=r.importo;});
  return Object.values(m).map(function(x){x.media=x.count>0?x.total/x.count:0;return x;}).sort(function(a,b){return b.total-a.total;});
}

// ── OVERVIEW RENDER ──
async function renderOverview(){
  var data=getFiltered(),tot=data.reduce(function(s,r){return s+r.importo;},0),cnt=data.length;
  var avg=cnt?tot/cnt:0;

  G('kpi-tot').textContent='€ '+fmt(tot);
  G('kpi-cnt').textContent=cnt;
  G('kpi-avg').textContent='€ '+fmt(avg,0);
  G('filtered-count').textContent=cnt+' record';
  G('data-info-text').textContent='DB: '+allData.length+' totali'+(cnt<allData.length?' · Filtrati: '+cnt:'');
  dbCount().then(function(n){G('kpi-db').textContent=n;}).catch(function(){G('kpi-db').textContent=allData.length;});

  // ── Confronto con anno precedente ──
  var annoSel=G('f-anno').value;
  var meseSel=G('f-mese').value;
  var trSel=G('f-tiporete').value;
  var prSel=G('f-promotore').value;
  var acSel=G('f-acuradi').value;

  function setDelta(elId, subId, valNow, valPrev, prevAnno, labelSub) {
    var el=G(elId), sub=G(subId);
    if(!el) return;
    el.className='kpi-delta';
    if(valPrev===null){
      el.innerHTML='';
      if(sub) sub.textContent=labelSub;
      return;
    }
    if(valPrev===0 && valNow>0){
      el.innerHTML='▲ Nuovo vs '+prevAnno;
      el.className='kpi-delta pos';
    } else if(valPrev>0){
      // percentuale calcolata sul numero (conteggio/valore dell'anno precedente)
      var d=(valNow-valPrev)/valPrev*100;
      var arrow=d>0?'▲':d<0?'▼':'=';
      var cls=d>0?'pos':d<0?'neg':'neu';
      el.innerHTML=arrow+' '+Math.abs(d).toFixed(1)+'% vs '+prevAnno;
      el.className='kpi-delta '+cls;
    } else {
      el.innerHTML='';
    }
    if(sub) sub.textContent=labelSub;
  }

  if(annoSel){
    // C'è un anno selezionato: confronta con anno precedente
    var prevAnno=String(parseInt(annoSel)-1);
    var dataPrev=allData.filter(function(r){
      return String(r.anno)===prevAnno
        &&(!meseSel||String(r.mese)===meseSel)
        &&(!trSel||r.tiporete===trSel)
        &&(!prSel||r.promotore===prSel)
        &&(!acSel||r.acuradi===acSel);
    });
    var totPrev=dataPrev.reduce(function(s,r){return s+r.importo;},0);
    var cntPrev=dataPrev.length;
    var avgPrev=cntPrev?totPrev/cntPrev:0;
    // Verifica che l'anno precedente esista nel DB
    var annoEsiste=unique(allData,'anno').indexOf(prevAnno)>=0;
    var ref=annoEsiste?prevAnno:null;
    setDelta('kpi-tot-delta','kpi-tot-sub', tot,   annoEsiste?totPrev:null, ref, 'vs '+prevAnno);
    setDelta('kpi-cnt-delta','kpi-cnt-sub', cnt,   annoEsiste?cntPrev:null, ref, 'vs '+prevAnno);
    setDelta('kpi-avg-delta','kpi-avg-sub', avg,   annoEsiste?avgPrev:null, ref, 'vs '+prevAnno);
  } else {
    // Nessun anno selezionato: trova l'ultimo anno disponibile vs penultimo
    var anniDisp=unique(allData,'anno').filter(Boolean).map(Number).sort();
    if(anniDisp.length>=2){
      var ultAnno=anniDisp[anniDisp.length-1];
      var penAnno=anniDisp[anniDisp.length-2];
      var dUlt=allData.filter(function(r){
        return r.anno===ultAnno
          &&(!meseSel||String(r.mese)===meseSel)
          &&(!trSel||r.tiporete===trSel)
          &&(!prSel||r.promotore===prSel)
          &&(!acSel||r.acuradi===acSel);
      });
      var dPen=allData.filter(function(r){
        return r.anno===penAnno
          &&(!meseSel||String(r.mese)===meseSel)
          &&(!trSel||r.tiporete===trSel)
          &&(!prSel||r.promotore===prSel)
          &&(!acSel||r.acuradi===acSel);
      });
      var tU=dUlt.reduce(function(s,r){return s+r.importo;},0);
      var cU=dUlt.length, aU=cU?tU/cU:0;
      var tP=dPen.reduce(function(s,r){return s+r.importo;},0);
      var cP=dPen.length, aP=cP?tP/cP:0;
      setDelta('kpi-tot-delta','kpi-tot-sub', tU, tP, penAnno, ultAnno+' vs '+penAnno);
      setDelta('kpi-cnt-delta','kpi-cnt-sub', cU, cP, penAnno, ultAnno+' vs '+penAnno);
      setDelta('kpi-avg-delta','kpi-avg-sub', aU, aP, penAnno, ultAnno+' vs '+penAnno);
    } else {
      // Solo un anno: nessun confronto
      ['kpi-tot-delta','kpi-cnt-delta','kpi-avg-delta'].forEach(function(id){var e=G(id);if(e)e.innerHTML='';});
      G('kpi-tot-sub').textContent='Somma filtrata';
      G('kpi-cnt-sub').textContent='Record selezionati';
      G('kpi-avg-sub').textContent='Media per contratto';
    }
  }

  var C={tiporete:['#2563EB','#3B82F6','#60A5FA','#93C5FD'],promotore:['#EA580C','#F97316','#FB923C','#FDBA74'],acuradi:['#7C3AED','#8B5CF6','#A78BFA','#6D28D9','#5B21B6','#9333EA','#4C1D95','#C084FC','#A855F7','#7E22CE','#DDD6FE','#6366F1','#4338CA','#312E81','#818CF8']};
  rReport('tiporete',data,'tiporete',C.tiporete);
  rReport('promotore',data,'promotore',C.promotore);
  rReport('acuradi',data,'acuradi',C.acuradi);
}

function rReport(id,data,key,colors){
  var a=agg(data,key);G('badge-'+id).textContent=a.length+' voci';
  var ctx=G('chart-'+id).getContext('2d');if(charts[id])charts[id].destroy();
  charts[id]=new Chart(ctx,{type:'bar',data:{labels:a.map(function(x){return x.label;}),datasets:[{label:'Importo',data:a.map(function(x){return x.total;}),backgroundColor:a.map(function(_,i){return colors[i%colors.length];}),borderRadius:0,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '€ '+fmt(c.parsed.y);}}}},scales:{y:{beginAtZero:true,grid:{color:'rgba(15,23,42,0.06)'},ticks:{color:'#64748B',font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:11},callback:function(v){return '€'+fmt(v,0);}}},x:{grid:{display:false},ticks:{color:'#64748B',font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:11},maxRotation:30}}}}});
  rTable('table-'+id,a,false);
}

function rTable(tid,a,isTrend){
  var t=G(tid);
  var sk=sortState[tid]||'total',sd=sortState[tid+'_d']||'desc';
  var s=a.slice().sort(function(a,b){var av=a[sk],bv=b[sk];if(typeof av==='string'){av=av.toLowerCase();bv=bv.toLowerCase();}return sd==='asc'?(av>bv?1:-1):(av<bv?1:-1);});
  var tT=a.reduce(function(x,r){return x+r.total;},0),tC=a.reduce(function(x,r){return x+r.count;},0);
  function thC(k){return sk===k?' class="'+(sd==='asc'?'sort-asc':'sort-desc')+'"':'';}
  var h='<thead><tr><th'+thC('label')+' onclick="sSort(\''+tid+'\',\'label\')">Categoria</th><th'+thC('count')+' onclick="sSort(\''+tid+'\',\'count\')">Nr.</th><th'+thC('total')+' onclick="sSort(\''+tid+'\',\'total\')">Importo</th><th>% Tot.</th><th'+thC('media')+' onclick="sSort(\''+tid+'\',\'media\')">Media</th></tr></thead><tbody>';
  s.forEach(function(r){
    var p=tT>0?(r.total/tT*100):0;
    var barW=Math.round(p);
    h+='<tr><td>'+r.label+'</td><td>'+r.count+'</td><td>€ '+fmt(r.total)+'</td><td><div class="pct-bar-wrap"><div class="pct-bar" style="width:'+barW+'px;max-width:80px"></div><span style="font-size:11px;color:var(--gray-600)">'+p.toFixed(1)+'%</span></div></td><td>€ '+fmt(r.media,0)+'</td></tr>';
  });
  h+='</tbody><tfoot><tr><td>Totale</td><td>'+tC+'</td><td>€ '+fmt(tT)+'</td><td>100%</td><td>€ '+fmt(tC?tT/tC:0,0)+'</td></tr></tfoot>';
  t.innerHTML=h;
}

function sSort(tid,key){sortState[tid]===key?sortState[tid+'_d']=(sortState[tid+'_d']==='asc'?'desc':'asc'):(sortState[tid]=key,sortState[tid+'_d']=key==='label'?'asc':'desc');renderOverview();}

// ── PROMOTORI TREND ──
function renderPromoTrend(){
  // Palette colori vivaci per promotori
  if(!window.COLORS_PROMO) {
    window.COLORS_PROMO = [
      '#005CA9', // Blue CNA
      '#00D9FF', // Cyan
      '#FF1493', // Pink vivido
      '#FF8C00', // Orange
      '#10B981', // Green
      '#8B5CF6', // Purple
      '#EC4899', // Pink soft
      '#F59E0B', // Amber
      '#06B6D4', // Cyan bright
      '#D946EF'  // Fuchsia
    ];
  }
  
  var data = getPromoFiltered();

  // Etichetta filtro attivo
  var anF  = G('fp-anno').value;
  var meDa = parseInt(G('fp-mese-da').value)||0;
  var meA  = parseInt(G('fp-mese-a').value)||0;
  var lbl  = '';
  if(anF) lbl += 'Anno: '+anF;
  if(meDa>0||meA>0){
    var da = meDa>0?MESI[meDa]:'Gen';
    var a  = meA>0?MESI[meA]:'Dic';
    lbl += (lbl?' · ':'')+da+' → '+a;
  }
  if(!lbl) lbl = 'Tutti gli anni — tutti i mesi';
  G('promo-chart-label').textContent = lbl;

  // Raccogli anni disponibili nel dataset filtrato
  var anniSet={};data.forEach(function(r){if(r.anno)anniSet[r.anno]=1;});
  var anni=Object.keys(anniSet).map(Number).sort();

  // Raccogli promotori
  var promoSet={};data.forEach(function(r){promoSet[r.promotore]=1;});
  var promotori=Object.keys(promoSet).sort();

  G('badge-promo-trend').textContent=promotori.length+' promotori';

  // Build matrix: promotore x anno → {total, count}
  var matrix={};
  promotori.forEach(function(p){matrix[p]={};anni.forEach(function(a){matrix[p][a]={total:0,count:0,mesi:{}};for(var m=1;m<=12;m++)matrix[p][a].mesi[m]={count:0};});});
  data.forEach(function(r){
    if(r.anno&&r.mese&&matrix[r.promotore]&&matrix[r.promotore][r.anno]){
      matrix[r.promotore][r.anno].total+=r.importo;
      matrix[r.promotore][r.anno].count++;
      var mese=Number(r.mese);
      if(mese>=1&&mese<=12){
        matrix[r.promotore][r.anno].mesi[mese].count++;
      }
    }
  });

  // Totale per anno (per % sul totale anno)
  var totAnno={};
  anni.forEach(function(a){totAnno[a]=promotori.reduce(function(s,p){return s+(matrix[p][a]?matrix[p][a].total:0);},0);});

  // ── CHART BAR (NUMERO DI CONTRATTI PER ANNO) ──
  var ctx=G('chart-promo-trend').getContext('2d');
  if(charts['promo-trend'])charts['promo-trend'].destroy();
  
  // Calcola il NUMERO DI CONTRATTI per anno (somma di tutti i promotori)
  var contractsPerAnno = anni.map(function(a){
    return promotori.reduce(function(sum,p){
      return sum + (matrix[p][a]?matrix[p][a].count:0);
    },0);
  });
  
  // Area chart gradient - stile smooth viola
  var gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');    // Top: viola semi-trasparente
  gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.2)'); // Middle: light viola
  gradient.addColorStop(1, 'rgba(196, 181, 253, 0.02)');  // Bottom: quasi trasparente
  
  // Area chart dataset
  var datasets=[{
    label:'Numero Contratti',
    data:contractsPerAnno,
    borderColor:'rgba(139, 92, 246, 1)',
    borderWidth:2,
    backgroundColor:gradient,
    fill:true,
    tension:0.4,
    pointRadius:5,
    pointHoverRadius:7,
    pointBackgroundColor:'rgba(139, 92, 246, 1)',
    pointBorderColor:'white',
    pointBorderWidth:2,
    pointHoverBackgroundColor:'rgba(168, 85, 247, 1)'
  }];
  
  charts['promo-trend']=new Chart(ctx,{
    type:'line', // AREA CHART
    data:{labels:anni,datasets:datasets},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        filler:{propagate:true},
        legend:{
          position:'bottom',
          labels:{
            color:'#64748B',
            font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:12,weight:'600'},
            boxWidth:16,
            padding:15,
            usePointStyle:true
          }
        },
        tooltip:{
          backgroundColor:'rgba(255,255,255,0.95)',
          titleColor:'#333',
          bodyColor:'#666',
          borderColor:'#E5E7EB',
          borderWidth:1,
          padding:12,
          displayColors:true,
          callbacks:{
            label:function(c){
              return c.dataset.label+': '+c.parsed.y+' contratti';
            }
          }
        }
      },
      scales:{y:{beginAtZero:true,grid:{color:'rgba(15,23,42,0.06)'},ticks:{color:'#64748B',font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:11},callback:function(v){return v;}}},x:{grid:{display:false},ticks:{color:'#64748B',font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:11}}}}}
  });

  // ── TABLE ──
  var tbl=G('table-promo-trend');
  // Header: Promotore | Anno1 | Anno2 | ... | Δ(ult-pen) % | % Tot Anno più recente
  var ultimoAnno=anni[anni.length-1];
  var penultimoAnno=anni.length>1?anni[anni.length-2]:null;

  var h='<thead><tr><th>Promotore</th>';
  anni.forEach(function(a){h+='<th>'+a+' (Nr.)</th><th>'+a+' % tot.</th>';});
  if(penultimoAnno)h+='<th>Δ '+penultimoAnno+'→'+ultimoAnno+'</th>';
  h+='</tr></thead><tbody>';

  // Sort by total dell'ultimo anno desc
  var sortedPromo=promotori.slice().sort(function(a,b){
    return (matrix[b][ultimoAnno]?matrix[b][ultimoAnno].total:0)-(matrix[a][ultimoAnno]?matrix[a][ultimoAnno].total:0);
  });

  sortedPromo.forEach(function(p){
    h+='<tr><td><b>'+p+'</b></td>';
    anni.forEach(function(a){
      var val=matrix[p][a]?matrix[p][a].total:0;
      var cnt=matrix[p][a]?matrix[p][a].count:0;
      var pct=totAnno[a]>0?(val/totAnno[a]*100):0;
      h+='<td>'+cnt+'</td><td>';
      if(val>0){
        var bw=Math.round(pct);
        h+='<div class="pct-bar-wrap"><div class="pct-bar" style="width:'+bw+'px;max-width:60px;background:'+COLORS_PROMO[sortedPromo.indexOf(p)%COLORS_PROMO.length]+'"></div><span style="font-size:11px">'+pct.toFixed(1)+'%</span></div>';
      }else{h+='<span style="color:var(--gray-400)">–</span>';}
      h+='</td>';
    });
    if(penultimoAnno){
      var vNew=matrix[p][ultimoAnno]?matrix[p][ultimoAnno].total:0;
      var vOld=matrix[p][penultimoAnno]?matrix[p][penultimoAnno].total:0;
      if(vOld>0){
        var delta=(vNew-vOld)/vOld*100;
        var cls=delta>0?'grow-pos':delta<0?'grow-neg':'grow-zero';
        var arrow=delta>0?'▲':delta<0?'▼':'–';
        h+='<td class="'+cls+'">'+arrow+' '+Math.abs(delta).toFixed(1)+'%</td>';
      }else if(vNew>0){
        h+='<td class="grow-pos">▲ Nuovo</td>';
      }else{
        h+='<td class="grow-zero">–</td>';
      }
    }
    h+='</tr>';
  });

  // Riga totale
  h+='<tr style="background:var(--gray-50)"><td><b>TOTALE</b></td>';
  anni.forEach(function(a){
    var tCnt=promotori.reduce(function(s,p){return s+(matrix[p][a]?matrix[p][a].count:0);},0);
    h+='<td><b>'+tCnt+'</b></td><td>100%</td>';
  });
  if(penultimoAnno){
    var vN=totAnno[ultimoAnno]||0,vO=totAnno[penultimoAnno]||0;
    if(vO>0){var d=(vN-vO)/vO*100;var cls2=d>0?'grow-pos':d<0?'grow-neg':'grow-zero';var ar=d>0?'▲':d<0?'▼':'–';h+='<td class="'+cls2+'"><b>'+ar+' '+Math.abs(d).toFixed(1)+'%</b></td>';}
    else h+='<td>–</td>';
  }
  h+='</tr></tbody>';
  tbl.innerHTML=h;

  // Schede individuali
  renderPromoCards(data, anni, matrix, totAnno, sortedPromo);
}

// ── SCHEDE INDIVIDUALI PROMOTORI ──
function renderPromoCards(data, anni, matrix, totAnno, sortedPromo) {
  var container = G('promo-cards-grid');
  if (!container) return;
  container.className = 'promo-cards-grid';

  // Distruggi eventuali chart precedenti delle schede
  Object.keys(charts).forEach(function(k){
    if(k.indexOf('spark-')===0){charts[k].destroy();delete charts[k];}
  });

  var html = '';
  sortedPromo.forEach(function(p, pi) {
    var color = COLORS_PROMO[pi % COLORS_PROMO.length];
    // Se è "Credito", usa verde
    if(p === 'Credito' || p === 'credito') { color = '#10B981'; }
    var totalePromo = anni.reduce(function(s,a){return s+(matrix[p][a]?matrix[p][a].total:0);},0);
    var totaleContratti = anni.reduce(function(s,a){return s+(matrix[p][a]?matrix[p][a].count:0);},0);
    var mediaPromo = totaleContratti > 0 ? totalePromo / totaleContratti : 0;

    html += '<div class="promo-card" style="border-top-color:'+color+'">';
    html += '<div class="promo-card-header" style="background-color:'+color+';color:white;padding:10px 15px;border-radius:4px 4px 0 0;">';
    html +=   '<span class="promo-card-name" style="font-weight:bold;color:white">'+p+'</span>';
    html +=   '<span class="promo-card-total" style="color:rgba(255,255,255,0.9)">€ '+fmt(totalePromo,0)+' totale</span>';
    html += '</div>';
    html += '<div class="promo-card-kpi">';
    html +=   '<div class="promo-kpi"><div class="promo-kpi-label">Contratti</div><div class="promo-kpi-value">'+totaleContratti+'</div></div>';
    html +=   '<div class="promo-kpi"><div class="promo-kpi-label">Media</div><div class="promo-kpi-value">€ '+fmt(mediaPromo,0)+'</div></div>';
    html +=   '<div class="promo-kpi"><div class="promo-kpi-label">Anni attivi</div><div class="promo-kpi-value">'+anni.filter(function(a){return matrix[p][a]&&matrix[p][a].total>0;}).length+'</div></div>';
    html += '</div>';

    // Mini grafico sparkline (canvas placeholder)
    html += '<div class="promo-spark"><canvas id="spark-'+pi+'" height="120"></canvas></div>';

    // Tabella anni
    html += '<table class="promo-anni-table">';
    html += '<thead><tr><th>Anno</th><th>Importo</th><th>Nr.</th><th>% anno</th><th>Δ vs prec.</th></tr></thead><tbody>';

    anni.forEach(function(a, ai) {
      var val  = matrix[p][a] ? matrix[p][a].total : 0;
      var cnt  = matrix[p][a] ? matrix[p][a].count : 0;
      var pctAnno = totAnno[a] > 0 ? (val / totAnno[a] * 100) : 0;
      var prevAnno = ai > 0 ? anni[ai-1] : null;
      var deltaHtml = '<span class="delta-na">–</span>';
      if (prevAnno !== null) {
        var vPrev = matrix[p][prevAnno] ? matrix[p][prevAnno].total : 0;
        if (vPrev > 0 && val > 0) {
          var d = (val - vPrev) / vPrev * 100;
          var cls = d > 0 ? 'delta-pos' : 'delta-neg';
          var arrow = d > 0 ? '▲' : '▼';
          deltaHtml = '<span class="'+cls+'">'+arrow+' '+Math.abs(d).toFixed(1)+'%</span>';
        } else if (val > 0 && vPrev === 0) {
          deltaHtml = '<span class="delta-pos">▲ Nuovo</span>';
        } else if (val === 0 && vPrev > 0) {
          deltaHtml = '<span class="delta-neg">▼ Assente</span>';
        }
      }
      var rowStyle = val === 0 ? ' style="opacity:.45"' : '';
      html += '<tr'+rowStyle+'>';
      html +=   '<td><b>'+a+'</b></td>';
      html +=   '<td>€ '+fmt(val)+'</td>';
      html +=   '<td><b>'+cnt+'</b></td>';
      html +=   '<td>';
      if (val > 0) {
        var bw = Math.min(Math.round(pctAnno * 0.8), 60);
        html += '<div style="display:flex;align-items:center;gap:5px"><div style="height:5px;border-radius:3px;background:'+color+';width:'+bw+'px;min-width:2px"></div><span>'+pctAnno.toFixed(1)+'%</span></div>';
      } else { html += '<span style="color:var(--gray-400)">–</span>'; }
      html +=   '</td>';
      html +=   '<td>'+deltaHtml+'</td>';
      html += '</tr>';
    });

    // Riga totale complessivo
    var totPct = Object.values(totAnno).reduce(function(s,v){return s+v;},0);
    var pctGlobale = totPct > 0 ? (totalePromo / totPct * 100) : 0;
    html += '<tr style="background:var(--gray-50);font-weight:700">';
    html +=   '<td>Totale</td>';
    html +=   '<td>€ '+fmt(totalePromo)+'</td>';
    html +=   '<td>'+totaleContratti+'</td>';
    html +=   '<td>'+pctGlobale.toFixed(1)+'% globale</td>';
    html +=   '<td>–</td>';
    html += '</tr>';
    html += '</tbody></table></div>';
  });

  container.innerHTML = html;

  // Disegna sparkline per ogni promotore
  sortedPromo.forEach(function(p, pi) {
    var baseColor = COLORS_PROMO[pi % COLORS_PROMO.length];
    var canvas = document.getElementById('spark-'+pi);
    if (!canvas) return;
    
    // Crea dataset per ogni anno
    var datasets = [];
    var anniUniquiPerPromo = anni.filter(function(a){ return matrix[p][a] && matrix[p][a].total > 0; });
    
    anniUniquiPerPromo.forEach(function(anno, yearIdx) {
      var hslColor = baseColor.replace('rgb(','').replace(')','').split(',');
      var r = parseInt(hslColor[0]), g = parseInt(hslColor[1]), b = parseInt(hslColor[2]);
      var colorForYear = 'rgb(' + r + ',' + g + ',' + b + ')';
      if(yearIdx > 0) {
        var h = Math.floor((yearIdx / anniUniquiPerPromo.length) * 360);
        colorForYear = 'hsl(' + h + ', 65%, 55%)';
      }
      
      // Dati di contratti per i 12 mesi dell'anno
      var vals = [];
      for(var m = 1; m <= 12; m++) {
        if(matrix[p][anno] && matrix[p][anno].mesi && matrix[p][anno].mesi[m]) {
          vals.push(matrix[p][anno].mesi[m].count);
        } else {
          vals.push(0);
        }
      }
      
      datasets.push({
        label: anno,
        data: vals,
        borderColor: colorForYear,
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: colorForYear,
        borderWidth: 2.5,
        tension: 0.3,
        borderDash: yearIdx > 0 ? [5, 5] : []
      });
    });
    
    charts['spark-'+pi] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
        datasets: datasets
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend:{display:false},
          tooltip:{
            callbacks:{
              label:function(c){
                return c.dataset.label + ': ' + c.parsed.y + ' contratti';
              }
            }
          },
          filler: {propagate: true}
        },
        onHover: function(event, activeElements) {
          var chart = this;
          chart.data.datasets.forEach(function(dataset, idx) {
            dataset.borderColor = dataset.borderColor.replace(/[\d.]+\)$/, '0.2)').replace('rgb','rgba').replace('hsl','hsla').replace(/\)$/, ', 0.2)');
            dataset.pointRadius = 1;
            dataset.pointHoverRadius = 3;
          });
          activeElements.forEach(function(el) {
            var ds = chart.data.datasets[el.datasetIndex];
            var origColor = ds.borderColor;
            if(origColor.indexOf('rgba') !== -1) origColor = origColor.replace(/,\s*[\d.]+\)$/, ')').replace('rgba','rgb');
            if(origColor.indexOf('hsla') !== -1) origColor = origColor.replace(/,\s*[\d.]+\)$/, ')').replace('hsla','hsl');
            ds.borderColor = origColor;
            ds.pointRadius = 3;
            ds.pointHoverRadius = 6;
          });
          chart.update('none');
        },
        scales: {
          y: { 
            display:true, beginAtZero:true, 
            grid:{color:'rgba(15,23,42,0.06)'}, 
            ticks:{
              color:'#64748B',
              font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:10},
              callback:function(v){return v;},
              maxTicksLimit:5
            }
          },
          x: { 
            grid:{display:true,color:'rgba(15,23,42,0.04)'}, 
            ticks:{
              color:'#64748B',
              font:{family:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',size:9}
            }
          }
        }
      }
    });
  });
}

// PANELS
function showDashboard(){
  G('upload-zone').style.display='none';
  G('admin-panel').style.display='none';
  G('tabs-bar').style.display='flex';
  // Show active tab
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  G('tab-overview').classList.add('active');
}
/* ════════════════════════════════════════════════════════════════
   CHART COLOR PALETTE - Vivid colors with glow effects
   ════════════════════════════════════════════════════════════════ */

// Palette colori vivaci per i grafici
var chartColorPalette = [
  '#005CA9', // Blue CNA
  '#00D9FF', // Cyan glow
  '#FF1493', // Deep pink glow
  '#FF8C00', // Orange vivid
  '#10B981', // Emerald glow
  '#8B5CF6', // Purple glow
  '#EC4899', // Pink glow
  '#F59E0B', // Amber vivid
  '#06B6D4', // Cyan vivid
  '#D946EF'  // Fuchsia vivid
];

// Funzione per ottenere colore con glow
function getChartColor(index) {
  return chartColorPalette[index % chartColorPalette.length];
}

// Stile colori per barre con gradients
function getBarColor(value, maxValue) {
  var ratio = value / maxValue;
  if (ratio > 0.75) return '#005CA9'; // Blue
  if (ratio > 0.5) return '#00D9FF';  // Cyan
  if (ratio > 0.25) return '#10B981'; // Green
  return '#8B5CF6'; // Purple
}


/* ════════════════════════════════════════════════════════════════
   AREA CHART GRADIENTS - Smooth fill with color transitions
   ════════════════════════════════════════════════════════════════ */

// SVG Gradients per Area Charts - Colori vivaci con sfumature smooth
var areaGradients = {
  1: { start: '#005CA9', end: '#00D9FF', stroke: '#005CA9' },  // Blue to Cyan
  2: { start: '#00D9FF', end: '#06B6D4', stroke: '#00D9FF' },  // Cyan to Teal
  3: { start: '#8B5CF6', end: '#D946EF', stroke: '#8B5CF6' },  // Purple to Fuchsia
  4: { start: '#FF1493', end: '#EC4899', stroke: '#FF1493' },  // Pink variations
  5: { start: '#10B981', end: '#34D399', stroke: '#10B981' },  // Green to Emerald
  6: { start: '#FF8C00', end: '#F97316', stroke: '#FF8C00' }   // Orange variations
};

// Funzione per creare i gradients SVG
function createAreaGradients() {
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.querySelector('svg');
  
  if (!svg) return;
  
  var defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(svgNS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  
  // Crea gradients per ogni area
  Object.keys(areaGradients).forEach(function(key) {
    var gradient = areaGradients[key];
    var existingGrad = defs.querySelector('#areaGradient' + key);
    
    if (!existingGrad) {
      var grad = document.createElementNS(svgNS, 'linearGradient');
      grad.setAttribute('id', 'areaGradient' + key);
      grad.setAttribute('x1', '0%');
      grad.setAttribute('y1', '0%');
      grad.setAttribute('x2', '0%');
      grad.setAttribute('y2', '100%');
      
      var stop1 = document.createElementNS(svgNS, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', gradient.start);
      stop1.setAttribute('stop-opacity', '0.8');
      
      var stop2 = document.createElementNS(svgNS, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', gradient.end);
      stop2.setAttribute('stop-opacity', '0.1');
      
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
    }
  });
}

// Chiama createAreaGradients quando il dashboard carica
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(createAreaGradients, 1000);
});

// Ricrea i gradients se il dashboard si aggiorna
window.addEventListener('resize', function() {
  setTimeout(createAreaGradients, 300);
});


/* ════════════════════════════════════════════════════════════════
   CHART.JS GRADIENT FILL - Area fill con sfumature smooth
   ════════════════════════════════════════════════════════════════ */

// Crea gradient per Chart.js bar chart
function createChartGradient(ctx, colors) {
  var gradient = ctx.createLinearGradient(0, 0, 0, 400);
  
  // Colori vivaci con transizione smooth
  if (colors && colors.length > 0) {
    // Top: colore saturo
    gradient.addColorStop(0, colors[0]);
    // Middle: transizione
    gradient.addColorStop(0.5, colors[1] || colors[0]);
    // Bottom: trasparente
    gradient.addColorStop(1, colors[1] ? colors[1] + '33' : colors[0] + '33');
  }
  
  return gradient;
}

// Palette colori gradient vivaci per bar charts
var chartGradientPalette = [
  ['#005CA9', '#00D9FF'],      // Blue to Cyan
  ['#FF8C00', '#F97316'],      // Orange gradient
  ['#8B5CF6', '#D946EF'],      // Purple to Fuchsia
  ['#10B981', '#34D399'],      // Green to Emerald
  ['#FF1493', '#EC4899'],      // Pink gradient
  ['#0FA3F2', '#06B6D4'],      // Cyan gradient
  ['#6366F1', '#A855F7'],      // Indigo to Purple
  ['#EF4444', '#F87171'],      // Red gradient
  ['#F59E0B', '#FBBF24'],      // Amber gradient
  ['#06B6D4', '#0891B2']       // Teal gradient
];

// Override della funzione rReport per aggiungere gradients
var originalRReport = rReport;
function rReport(id, data, key, colors) {
  var a = agg(data, key);
  G('badge-' + id).textContent = a.length + ' voci';
  var ctx = G('chart-' + id).getContext('2d');
  if (charts[id]) charts[id].destroy();
  
  // Crea gradients per ogni barra
  var gradients = a.map(function(_, i) {
    var colorPair = chartGradientPalette[i % chartGradientPalette.length];
    return createChartGradient(ctx, colorPair);
  });
  
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: a.map(function(x) { return x.label; }),
      datasets: [{
        label: 'Importo',
        data: a.map(function(x) { return x.total; }),
        backgroundColor: gradients,
        borderRadius: 8,
        borderSkipped: false,
        hoverBackgroundColor: a.map(function(_, i) {
          return chartGradientPalette[i % chartGradientPalette.length][0];
        }),
        hoverBorderColor: 'rgba(0, 92, 169, 0.8)',
        hoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#333',
          bodyColor: '#666',
          borderColor: '#E5E7EB',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(c) { 
              return '€ ' + fmt(c.parsed.y); 
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { 
            color: 'rgba(15, 23, 42, 0.06)',
            drawBorder: false
          },
          ticks: {
            color: '#64748B',
            font: {
              family: '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',
              size: 11
            },
            callback: function(v) { 
              return '€' + fmt(v, 0); 
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: {
              family: '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',
              size: 11
            },
            maxRotation: 30
          }
        }
      }
    }
  });
  
  rTable('table-' + id, a, false);
}


// ========== GENERA REPORT PDF — VERSIONE CORRETTA ==========
function generaReportPDF() {
  // Carica la skill se esiste
  if (!window.ReportGenerator) {
    alert('Errore: ReportGenerator non caricato');
    return;
  }

  try {
    // LEGGI KPI DAL DOM (tab overview)
    var kpiTot = G('kpi-tot') ? G('kpi-tot').textContent.trim() : '€ 0';
    var kpiCnt = G('kpi-cnt') ? G('kpi-cnt').textContent.trim() : '0';
    var kpiAvg = G('kpi-avg') ? G('kpi-avg').textContent.trim() : '€ 0';
    var kpiDb = G('kpi-db') ? G('kpi-db').textContent.trim() : '0';
    
    // LEGGI FILTRI ATTUALI
    // Tab overview
    var fAnno = G('f-anno') && G('f-anno').value ? G('f-anno').value : '';
    var fMese = G('f-mese') && G('f-mese').value ? G('f-mese').value : '';
    
    // Tab analisi
    var fpAnno = G('fp-anno') && G('fp-anno').value ? G('fp-anno').value : '';
    var fpMeseDa = G('fp-mese-da') && G('fp-mese-da').value ? G('fp-mese-da').value : '';
    var fpMeseA = G('fp-mese-a') && G('fp-mese-a').value ? G('fp-mese-a').value : '';
    
    var filtroAnno = fAnno || fpAnno || 'tutti gli anni';
    var filtroMesi = '';
    if (fMese) {
      filtroMesi = fMese;
    } else if (fpMeseDa || fpMeseA) {
      filtroMesi = (fpMeseDa || 'tutti') + ' - ' + (fpMeseA || 'tutti');
    } else {
      filtroMesi = 'Tutti i mesi';
    }
    
    // CATTURA GRAFICI DA CANVAS Chart.js
    var charts = {};
    var chartIds = [
      {domId: 'chart-tiporete', reportKey: 'tiporete'},
      {domId: 'chart-promotore', reportKey: 'promotore'},
      {domId: 'chart-acuradi', reportKey: 'acuradi'},
      {domId: 'chart-promo-trend', reportKey: 'trend'}
    ];
    
    chartIds.forEach(function(item) {
      var el = G(item.domId);
      if (el && el.offsetHeight > 0 && el.toDataURL) {
        try {
          charts[item.reportKey] = el.toDataURL('image/png');
        } catch(e) {
          console.warn('Errore cattura grafico ' + item.domId, e);
        }
      }
    });
    
    // COPIA TABELLE DAL DOM
    var tables = {};
    var tableIds = [
      {domId: 'table-tiporete', reportKey: 'tiporete'},
      {domId: 'table-promotore', reportKey: 'promotore'},
      {domId: 'table-acuradi', reportKey: 'acuradi'},
      {domId: 'table-promo-trend', reportKey: 'trendTable'}
    ];
    
    tableIds.forEach(function(item) {
      var el = G(item.domId);
      if (el && el.offsetHeight > 0) {
        tables[item.reportKey] = el.outerHTML;
      }
    });
    
    // RACCOGLI SCHEDE PROMOTORI
    var cardsData = [];
    var promoGrid = G('promo-cards-grid');
    if (promoGrid) {
      var cards = promoGrid.querySelectorAll('.promo-card');
      cards.forEach(function(cardEl, idx) {
        try {
          var headerEl = cardEl.querySelector('.promo-card-header');
          var nameEl = cardEl.querySelector('.promo-card-name');
          var totalEl = cardEl.querySelector('.promo-card-total');
          var tableEl = cardEl.querySelector('.promo-anni-table');
          var sparklineEl = cardEl.querySelector('canvas');
          
          var cardObj = {
            name: nameEl ? nameEl.textContent.trim() : 'Card ' + idx,
            total: totalEl ? totalEl.textContent.trim() : '€ 0',
            color: headerEl ? window.getComputedStyle(headerEl).backgroundColor : '#3B82F6'
          };
          
          // KPI della card
          var kpiEls = cardEl.querySelectorAll('.promo-kpi');
          cardObj.kpis = {};
          kpiEls.forEach(function(kpiEl) {
            var lblEl = kpiEl.querySelector('.promo-kpi-label');
            var valEl = kpiEl.querySelector('.promo-kpi-value');
            if (lblEl && valEl) {
              var label = lblEl.textContent.trim().substring(0, 1).toUpperCase();
              cardObj.kpis[label] = valEl.textContent.trim();
            }
          });
          
          // Sparkline
          if (sparklineEl && sparklineEl.toDataURL) {
            try {
              cardObj.sparkline = sparklineEl.toDataURL('image/png');
            } catch(e) {}
          }
          
          // Tabella scheda
          if (tableEl && tableEl.offsetHeight > 0) {
            cardObj.table = tableEl.outerHTML;
          }
          
          cardsData.push(cardObj);
        } catch(e) {
          console.warn('Errore processing card', e);
        }
      });
    }
    
    // CREA CONFIGURAZIONE REPORT GENERATOR
    var reportConfig = {
      template: 'report-tesseramento',
      title: 'Report Tesseramento CNA Roma',
      logoUrl: 'https://raw.githubusercontent.com/alessandroparrelli/fileappoggio/17b50df8f22632eb360e1da944d997289a598012/NUOVO-LOGO-CNA-ROMA-SOLO-ROMA.png',
      filename: 'Report_Tesseramento_CNA_' + new Date().toISOString().slice(0, 10) + '.pdf',
      
      // KPI
      kpis: {
        totalImporto: kpiTot,
        nrContratti: kpiCnt,
        importoMedio: kpiAvg,
        totalDb: kpiDb
      },
      
      // Filtri
      filters: {
        anno: filtroAnno,
        mesi: filtroMesi
      },
      
      // Grafici (base64 PNG strings)
      charts: charts,
      
      // Tabelle (HTML strings)
      tables: tables,
      
      // Schede promotori
      cards: cardsData,
      
      // Opzioni
      renderingOptions: {
        scale: 2,
        delay: 800,
        timeout: 15000
      },
      
      pageNumbers: true,
      totalPages: true,
      footerType: 'cna'
    };
    
    // GENERA PDF USANDO LA SKILL
    var report = new ReportGenerator(reportConfig);
    report.generatePDF()
      .then(function() {
        console.log('Report generato correttamente');
      })
      .catch(function(err) {
        console.error('Errore nella generazione del report:', err);
        alert('Errore: ' + err.message);
      });
      
  } catch(err) {
    console.error('Errore generaReportPDF:', err);
    alert('Errore critico: ' + err.message);
  }
}
