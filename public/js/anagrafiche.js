async function anaFetchAll(table){
  var all=[], offset=0, size=1000;
  while(true){
    anaSetStatus(table, all.length, 'loading');
    var r=await fetch(SB+'/rest/v1/'+table+'?select=*&offset='+offset+'&limit='+size,{headers:H()});
    if(!r.ok) throw new Error(table+': HTTP '+r.status);
    var rows=await r.json();
    if(!Array.isArray(rows)||rows.length===0){ anaSetStatus(table, all.length, 'done'); break; }
    all=all.concat(rows);
    offset+=size;
    if(rows.length<size){ anaSetStatus(table, all.length, 'done'); break; }
    await new Promise(function(res){setTimeout(res,150);});
  }
  return all;
}

function anaSetStatus(table, count, st){
  var el=G('ana-status-'+table);
  if(!el) return;
  var v=el.querySelector('.ana-sval');
  if(st==='done'){ el.className='ana-status-row done'; v.textContent='✓ '+count.toLocaleString('it-IT'); }
  else if(st==='loading'){ el.className='ana-status-row loading'; v.textContent='⏳ '+count.toLocaleString('it-IT')+'…'; }
  else { el.className='ana-status-row'; v.textContent='In attesa…'; }
}

function anaSetProgress(pct, msg){
  G('ana-progress').style.width=pct+'%';
  if(msg) G('ana-load-msg').textContent=msg;
}

function anaJoin(ana, dir, cod){
  anaSetProgress(75, 'Unificazione dati…');
  var res=[];
  var dMap=new Map();
  dir.forEach(function(d){ if(!dMap.has(d.codiceanagrafica)) dMap.set(d.codiceanagrafica,[]); dMap.get(d.codiceanagrafica).push(d); });
  var cMap=new Map();
  cod.forEach(function(c){ var k=String(c.codiceateco).trim(); if(!cMap.has(k)) cMap.set(k,[]); cMap.get(k).push(c); });

  // Raggruppa per codiceanagrafica - una riga per anagrafica
  ana.forEach(function(a, idx){
    var dRecs = dMap.get(a.codiceanagrafica) || [{}];
    var kAte  = String(a.codiceateco).trim();
    var cRecs = cMap.get(kAte) || [];
    var finalC = cRecs.length>0 ? cRecs : [{unione:null, settore:null, mestiere:null}];
    
    // Prendi il primo record di Diretti per questa anagrafica
    var d = dRecs[0] || {};
    // Prendi il primo record di Codiciateco
    var c = finalC[0] || {};
    
    res.push({
      codiceanagrafica: a.codiceanagrafica,
      partitaiva:a.partitaiva, codicefiscale:a.codicefiscale, ragionesociale:a.ragionesociale,
      telefono:a.telefono, email:a.email, cellulare:a.cellulare,
      indirizzo:a.indirizzo, cap:a.cap, comune:a.comune, sesso:a.sesso,
      cognometitolare:a.cognometitolare, nometitolare:a.nometitolare,
      datanascita:a.datanascita, luogonascita:a.luogonascita, codiceateco:a.codiceateco,
      servizio:d.servizio, datastipula:d.datastipula, datadisdetta:d.datadisdetta,
      raggruppamento:d.raggruppamento, sedeerogazione:d.sedeerogazione,
      acuradi:d.acuradi, motivoinizio:d.motivoinizio, importo:d.importo,
      unione:c.unione, settore:c.settore, mestiere:c.mestiere
    });
    
    if(idx%5000===0) anaSetStatus('join', res.length, 'loading');
  });
  anaSetStatus('join', res.length, 'done');
  return res;
}


// ════════════════════════════════════════════════════════════════════════════════
// ARCHIVIO CONTRATTI - COPIATO DA PATTERN ANAGRAFICHE
// ════════════════════════════════════════════════════════════════════════════════


// === GESTIONE LISTA ANAGRAFICHE ===

async function anaLoad(force){
  // CONTROLLO PERMESSI: verifica se l'utente può interrogare l'archivio
  if (!hasPermission('interroga')) {
    alert('❌ ACCESSO NEGATO: Non hai il permesso per interrogare l\'archivio.\nContatta l\'amministratore.');
    return;
  }
  
  if(anaLoading) return;
  if(anaLoaded && !force) return;
  anaLoading=true;
  // reset UI
  G('ana-loader').classList.add('active');
  G('ana-content').style.display='none';
  ['anagrafiche','diretti','codiciateco','join'].forEach(function(t){ anaSetStatus(t,0,null); });
  anaSetProgress(0, 'Connessione a Supabase…');
  try{
    anaSetProgress(5, 'Caricamento Anagrafiche…');
    var ana = await anaFetchAll('Anagrafiche');
    anaSetProgress(30, 'Caricamento Diretti…');
    var dir = await anaFetchAll('diretti');
    allDiretti = dir; // Salva per schede anagrafiche
    anaSetProgress(55, 'Caricamento Codici ATECO…');
    var cod = await anaFetchAll('codiciateco');
    anaAll = anaJoin(ana, dir, cod);
    
    // Filtra: esclude record con servizio "NON ASSOCIABILE" e "CONTABILITA'"
    anaAll = anaAll.filter(function(r) {
      var svc = r.servizio ? r.servizio.trim() : '';
      return svc !== 'NON ASSOCIABILE' && svc !== 'CONTABILITA\'';
    });
    
    anaFiltered = anaAll.slice();
    anaSelected.clear();
    anaSetProgress(95, 'Popolamento filtri…');
    anaPopulateFilters();
    anaRender();
    anaSetProgress(100, 'Completato.');
    anaLoaded=true;
    setTimeout(function(){
      G('ana-loader').classList.remove('active');
      G('ana-content').style.display='block';
    }, 300);
  }catch(e){
    console.error(e);
    G('ana-load-msg').textContent='❌ '+e.message;
    G('ana-load-msg').style.color='var(--red)';
    toast('Errore caricamento anagrafiche: '+e.message,'error');
  }finally{
    anaLoading=false;
  }
}

function anaPopulateFilters(){
  function uniq(key, transform){
    var s={};
    anaAll.forEach(function(r){
      var v = transform ? transform(r[key], r) : r[key];
      if(v!==null && v!==undefined && v!=='') s[v]=1;
    });
    return Object.keys(s).sort();
  }
  function fillSel(id, vals, firstLabel){
    var sel=G(id); if(!sel) return;
    var current=sel.value;
    // Preserva l'etichetta della first option già presente nel DOM (se non passata esplicitamente)
    if(!firstLabel){
      var firstOpt = sel.querySelector('option[value=""]');
      firstLabel = firstOpt ? firstOpt.textContent : 'Tutti';
    }
    sel.innerHTML='<option value="">'+firstLabel+'</option>';
    vals.forEach(function(v){
      var o=document.createElement('option');
      o.value=v; o.textContent=v;
      if(v===current) o.selected=true;
      sel.appendChild(o);
    });
  }
  fillSel('ana-f-comune', uniq('comune'));
  fillSel('ana-f-ateco', uniq('codiceateco'));
  fillSel('ana-f-servizio', uniq('servizio'));
  var anni = uniq('datastipula', function(v){ return v?new Date(v).getFullYear():null; }).map(Number).filter(function(x){return !isNaN(x);}).sort(function(a,b){return b-a;});
  fillSel('ana-f-anno', anni);
  fillSel('ana-f-raggr', uniq('raggruppamento'));
  fillSel('ana-f-sede', uniq('sedeerogazione'));
  fillSel('ana-f-acuradi', uniq('acuradi'));
  fillSel('ana-f-motivo', uniq('motivoinizio'));
  fillSel('ana-f-unione', uniq('unione'));
  fillSel('ana-f-settore', uniq('settore'));
  fillSel('ana-f-mestiere', uniq('mestiere'));
}

function anaApply(){
  var fRs=(G('ana-f-rs').value||'').toLowerCase().trim();
  var fPi=(G('ana-f-piva').value||'').toLowerCase().trim();
  var fCf=(G('ana-f-cf').value||'').toLowerCase().trim();
  var fCap=(G('ana-f-cap').value||'').trim();
  var fCom=G('ana-f-comune').value;
  var fSex=G('ana-f-sesso').value;
  var fAte=G('ana-f-ateco').value;
  var fSrv=G('ana-f-servizio').value;
  var fAn=G('ana-f-anno').value;
  var fRag=G('ana-f-raggr').value;
  var fSed=G('ana-f-sede').value;
  var fAc=G('ana-f-acuradi').value;
  var fMot=G('ana-f-motivo').value;
  var fUn=G('ana-f-unione').value;
  var fSet=G('ana-f-settore').value;
  var fMes=G('ana-f-mestiere').value;
  var fDis=G('ana-f-disdetta-status').value;

  anaFiltered = anaAll.filter(function(r){
    if(fRs && !(r.ragionesociale||'').toLowerCase().includes(fRs)) return false;
    if(fPi && !(String(r.partitaiva||'')).toLowerCase().includes(fPi)) return false;
    if(fCf && !(String(r.codicefiscale||'')).toLowerCase().includes(fCf)) return false;
    if(fCap && String(r.cap||'')!==fCap) return false;
    if(fCom && r.comune!==fCom) return false;
    if(fSex && r.sesso!==fSex) return false;
    if(fAte && String(r.codiceateco||'')!==fAte) return false;
    if(fSrv && r.servizio!==fSrv) return false;
    if(fAn && (!r.datastipula || String(new Date(r.datastipula).getFullYear())!==fAn)) return false;
    if(fRag && r.raggruppamento!==fRag) return false;
    if(fSed && r.sedeerogazione!==fSed) return false;
    if(fAc && r.acuradi!==fAc) return false;
    if(fMot && r.motivoinizio!==fMot) return false;
    if(fUn && r.unione!==fUn) return false;
    if(fSet && r.settore!==fSet) return false;
    if(fMes && r.mestiere!==fMes) return false;
    if(fDis==='present' && (!r.datadisdetta || String(r.datadisdetta).trim()==='')) return false;
    if(fDis==='empty' && r.datadisdetta && String(r.datadisdetta).trim()!=='') return false;
    return true;
  });
  anaSelected.clear();
  G('ana-selall').checked=false;
  anaRender();
}

function anaReset(){
  ['ana-f-rs','ana-f-piva','ana-f-cf','ana-f-cap','ana-f-comune','ana-f-sesso','ana-f-ateco','ana-f-servizio','ana-f-anno','ana-f-raggr','ana-f-sede','ana-f-acuradi','ana-f-motivo','ana-f-unione','ana-f-settore','ana-f-mestiere','ana-f-disdetta-status']
    .forEach(function(id){ var el=G(id); if(el) el.value=''; });
  anaFiltered = anaAll.slice();
  anaSelected.clear();
  G('ana-selall').checked=false;
  anaRender();
}

function anaFmtDate(v){
  if(!v || String(v).trim()==='') return '';
  var s = String(v).trim();
  var d = null;
  
  // Se è un numero (timestamp), gestisci direttamente
  if(!isNaN(v) && v !== ''){
    var num = parseInt(v);
    // Timestamp Unix (secondi: 10 cifre, millisecondi: 13)
    if(num > 1000000000 && num < 9999999999){
      d = new Date(num > 9999999999 ? num : num * 1000);
    }
  }
  
  // ISO YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS
  if(!d && /^\d{4}-\d{2}-\d{2}/.test(s)){
    d = new Date(s);
    if(isNaN(d.getTime())) d = null;
  }
  
  // DD/MM/YYYY (già corretto)
  if(!d && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){
    var p = s.split('/');
    var day = parseInt(p[0]), month = parseInt(p[1]), year = parseInt(p[2]);
    d = new Date(year, month-1, day);
    if(d.getDate() !== day || d.getMonth() !== month-1) d = null; // Validate
  }
  
  // DD-MM-YYYY
  if(!d && /^\d{1,2}-\d{1,2}-\d{4}$/.test(s)){
    var p = s.split('-');
    var day = parseInt(p[0]), month = parseInt(p[1]), year = parseInt(p[2]);
    d = new Date(year, month-1, day);
    if(d.getDate() !== day || d.getMonth() !== month-1) d = null;
  }
  
  // YYYY/MM/DD
  if(!d && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)){
    var p = s.split('/');
    var year = parseInt(p[0]), month = parseInt(p[1]), day = parseInt(p[2]);
    d = new Date(year, month-1, day);
    if(d.getDate() !== day || d.getMonth() !== month-1) d = null;
  }
  
  // DD/MM/YY (anno a 2 cifre)
  if(!d && /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)){
    var p = s.split('/');
    var day = parseInt(p[0]), month = parseInt(p[1]), year = parseInt(p[2]);
    // Assumi 19xx se > 50, 20xx altrimenti
    year = year > 50 ? 1900 + year : 2000 + year;
    d = new Date(year, month-1, day);
    if(d.getDate() !== day || d.getMonth() !== month-1) d = null;
  }
  
  // Fallback: tenta new Date generico
  if(!d){
    d = new Date(s);
  }
  
  // Valida che la data sia valida
  if(!d || isNaN(d.getTime())){
    return escapeHtml(s); // Mostra il valore originale senza decorazione
  }
  
  try {
    return d.toLocaleDateString('it-IT');
  } catch(e) {
    return escapeHtml(s);
  }
}
function anaEsc(v){ if(v===null||v===undefined) return ''; return String(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

function anaRender(){
  var total = anaFiltered.length;
  G('ana-count').textContent = total.toLocaleString('it-IT')+' record';
  G('ana-info-text').textContent = 'DB: '+anaAll.length.toLocaleString('it-IT')+' totali'+(total<anaAll.length?' · Filtrati: '+total.toLocaleString('it-IT'):'');

  var rows = anaFiltered.slice(0, ANA_RENDER_LIMIT);
  var info=G('ana-limit-info');
  if(total>ANA_RENDER_LIMIT){ info.textContent='Mostrati primi '+ANA_RENDER_LIMIT+' di '+total.toLocaleString('it-IT')+' · filtra per restringere'; }
  else{ info.textContent=''; }

  var tb=G('ana-tbody');
  if(!rows.length){ tb.innerHTML='<tr><td colspan="27" class="ana-empty">Nessun record trovato</td></tr>'; anaUpdateSelCount(); return; }
  var html=[];
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var sel = anaSelected.has(i) ? ' class="selected"' : '';
    var chk = anaSelected.has(i) ? ' checked' : '';
    html.push(
      '<tr'+sel+' data-idx="'+i+'">',
      '<td class="col-check"><input type="checkbox" data-idx="'+i+'"'+chk+'></td>',
      '<td>'+anaEsc(r.partitaiva)+'</td>',
      '<td>'+anaEsc(r.codicefiscale)+'</td>',
      '<td>'+anaEsc(r.ragionesociale)+'</td>',
      '<td>'+anaEsc(r.telefono)+'</td>',
      '<td>'+anaEsc(r.email)+'</td>',
      '<td>'+anaEsc(r.cellulare)+'</td>',
      '<td>'+anaEsc(r.indirizzo)+'</td>',
      '<td>'+anaEsc(r.cap)+'</td>',
      '<td>'+anaEsc(r.comune)+'</td>',
      '<td>'+anaEsc(r.sesso)+'</td>',
      '<td>'+anaEsc(r.cognometitolare)+'</td>',
      '<td>'+anaEsc(r.nometitolare)+'</td>',
      '<td>'+anaFmtDate(r.datanascita)+'</td>',
      '<td>'+anaEsc(r.luogonascita)+'</td>',
      '<td>'+anaEsc(r.codiceateco)+'</td>',
      '<td>'+anaEsc(r.servizio)+'</td>',
      '<td>'+anaFmtDate(r.datastipula)+'</td>',
      '<td>'+anaEsc(r.datadisdetta)+'</td>',
      '<td>'+anaEsc(r.raggruppamento)+'</td>',
      '<td>'+anaEsc(r.sedeerogazione)+'</td>',
      '<td>'+anaEsc(r.acuradi)+'</td>',
      '<td>'+anaEsc(r.motivoinizio)+'</td>',
      '<td>'+anaEsc(r.importo)+'</td>',
      '<td>'+anaEsc(r.unione)+'</td>',
      '<td>'+anaEsc(r.settore)+'</td>',
      '<td>'+anaEsc(r.mestiere)+'</td>',
      '</tr>'
    );
  }
  tb.innerHTML=html.join('');
  anaUpdateSelCount();
}

function anaUpdateSelCount(){
  var n=anaSelected.size;
  var chip=G('ana-selcount');
  if(n>0){ chip.style.display='inline-flex'; chip.textContent=n.toLocaleString('it-IT')+' selezionati'; }
  else { chip.style.display='none'; }
}

function anaToggleRow(i, row){
  if(anaSelected.has(i)){ anaSelected.delete(i); if(row) row.classList.remove('selected'); }
  else { anaSelected.add(i); if(row) row.classList.add('selected'); }
  anaUpdateSelCount();
}

function anaToggleAll(){
  var chk=G('ana-selall').checked;
  anaSelected.clear();
  if(chk){
    // select ALL rows (no limit!)
    for(var i=0;i<anaFiltered.length;i++) anaSelected.add(i);
  }
  // re-render to reflect checkbox state
  anaRender();
}

function anaExport(){
  // Solo admin e supervisore possono esportare
  if (session?.ruolo !== 'admin' && session?.ruolo !== 'supervisore') {
    alert('❌ ACCESSO NEGATO: Solo amministratori e supervisori possono esportare dati.');
    return;
  }
  
  if(anaSelected.size===0){ toast('Seleziona almeno una riga','error'); return; }
  try{
    var data = Array.from(anaSelected).map(function(i){ return anaFiltered[i]; }).filter(Boolean);
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CNA');
    var ts = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, 'cna_anagrafiche_'+ts+'.xlsx');
    toast('✓ Esportati '+data.length+' record','success');
  }catch(e){ toast('Errore export: '+e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT MODULE (Upload, conversione e push Supabase)
// ══════════════════════════════════════════════════════════════════════════════

var importData = { diretti: null, anagrafiche: null };
