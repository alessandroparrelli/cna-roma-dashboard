var anaContratti = {};   // codiceanagrafica → { tipocontratto: {data, consulente} }
var anaServiziSet = {}; // tutti i tipi di contratto trovati
var anaCCIAAMap = {};   // partita_iva → {num_addetti_sub, num_addetti_fam_ul}

// Fetch con retry: ritenta su errori di rete/5xx (timeout Supabase) con backoff
async function anaFetchRetry(url, opts, tries){
  tries = tries || 4;
  var lastErr;
  for(var t=0; t<tries; t++){
    try{
      var r = await fetch(url, opts || {headers:H()});
      if(r.ok) return r;
      lastErr = new Error('HTTP '+r.status);
      if(r.status < 500 && r.status !== 429) throw lastErr; // errori 4xx: inutile ritentare
    }catch(e){ lastErr = e; if(/HTTP 4/.test(e.message) && !/HTTP 429/.test(e.message)) throw e; }
    await new Promise(function(res){ setTimeout(res, 400*Math.pow(2,t)); });
  }
  throw lastErr;
}

// Conteggio esatto lato DB per verificare che il caricamento sia completo
async function anaExactCount(table, filterQuery){
  var url = SB+'/rest/v1/'+table+'?select=*'+(filterQuery?'&'+filterQuery:'')+'&limit=1';
  var h = Object.assign({}, H(), {'Prefer':'count=exact'});
  var r = await anaFetchRetry(url, {headers:h});
  var cr = r.headers.get('content-range') || '';
  var n = parseInt(cr.split('/')[1], 10);
  return isNaN(n) ? null : n;
}

async function anaFetchAll(table){
  var all=[], offset=0, size=1000;
  var sid = table.toLowerCase();
  while(true){
    anaSetStatus(sid, all.length, 'loading');
    var r;
    try{ r=await anaFetchRetry(SB+'/rest/v1/'+table+'?select=*&offset='+offset+'&limit='+size); }
    catch(e){ throw new Error(table+': '+e.message); }
    var rows=await r.json();
    if(!Array.isArray(rows)||rows.length===0) break;
    all=all.concat(rows);
    offset+=size;
    if(rows.length<size) break;
    await new Promise(function(res){setTimeout(res,50);});
  }
  // Verifica completezza: le righe ricevute devono coincidere con il conteggio DB
  var exp = await anaExactCount(table, '');
  if(exp !== null && exp !== all.length){
    throw new Error(table+': caricamento incompleto ('+all.length+' righe su '+exp+'). Riprova.');
  }
  anaSetStatus(sid, all.length, 'done');
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
    
    // Array di tutti i servizi diretti per questa anagrafica (per filtro multi-servizio)
    // Considera TUTTI i servizi (anche disdettati), per non perdere storici nel filtro
    var serviziTutti = dRecs.map(function(dr){ return dr.servizio || ''; }).filter(Boolean);
    // Rimuovi duplicati
    var serviziTuttiUniq = {};
    serviziTutti.forEach(function(s){ serviziTuttiUniq[s] = true; });
    serviziTutti = Object.keys(serviziTuttiUniq);

    // ── Derive raggruppamento analisi flags (stessa logica di raggruppamenti.js) ──
    var atecoNorm = String(a.codiceateco||'').trim().replace(/\./g,'').replace(/\s/g,'');
    var fAteco = parseFloat(atecoNorm);
    if(!isNaN(fAteco) && String(fAteco)===atecoNorm) atecoNorm = String(Math.round(fAteco));
    var _isCommercio = atecoNorm.startsWith('46') || atecoNorm.startsWith('47');
    var _isTurismo   = atecoNorm.startsWith('55') || atecoNorm.startsWith('56') || atecoNorm.startsWith('79');
    var _isCinema    = atecoNorm.startsWith('591') || atecoNorm.startsWith('592');
    var _isDonna     = String(a.sesso||'').trim().toUpperCase() === 'F';
    var cfTit = String(a.cftitolare||'').trim().toUpperCase();
    var _isStraniero = (cfTit.length >= 12 && cfTit.charAt(11) === 'Z');
    var _isGiovane   = false;
    var ANNO_CORR = new Date().getFullYear();
    if(cfTit.length === 16){
      var a2 = cfTit.substring(6,8);
      if(/^\d{2}$/.test(a2)){
        var y2 = parseInt(a2,10);
        var threshold = ANNO_CORR - 2000;
        var annoNasc = y2 <= threshold ? 2000+y2 : 1900+y2;
        _isGiovane = (ANNO_CORR - annoNasc) <= 40;
      }
    }
    // Build raggruppamenti analisi array
    var raggAnalisi = [];
    if(_isCommercio) raggAnalisi.push('Commercio');
    if(_isTurismo)   raggAnalisi.push('Turismo');
    if(_isCinema)    raggAnalisi.push('Cinema e Audiovisivo');
    if(_isDonna)     raggAnalisi.push('Donne');
    if(_isStraniero) raggAnalisi.push('Stranieri');
    if(_isGiovane)   raggAnalisi.push('Giovani ≤40');

    res.push({
      codiceanagrafica: a.codiceanagrafica,
      partitaiva:a.partitaiva, codicefiscale:a.codicefiscale, ragionesociale:a.ragionesociale,
      telefono:a.telefono, email:a.email, cellulare:a.cellulare,
      indirizzo:a.indirizzo, cap:a.cap, comune:a.comune, sesso:a.sesso,
      cognometitolare:a.cognometitolare, nometitolare:a.nometitolare,
      datanascita:a.datanascita, luogonascita:a.luogonascita, codiceateco:a.codiceateco,
      cftitolare:a.cftitolare,
      servizio:d.servizio, datastipula:d.datastipula, datadisdetta:d.datadisdetta,
      raggruppamento:d.raggruppamento, sedeerogazione:d.sedeerogazione,
      acuradi:d.acuradi, motivoinizio:d.motivoinizio, importo:d.importo,
      unione:c.unione, settore:c.settore, mestiere:c.mestiere,
      servizi_tutti: serviziTutti,
      // Raggruppamento analisi flags
      _isCommercio:_isCommercio, _isTurismo:_isTurismo, _isCinema:_isCinema,
      _isDonna:_isDonna, _isStraniero:_isStraniero, _isGiovane:_isGiovane,
      raggAnalisi: raggAnalisi
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
    // ── FASE 1: Caricamento parallelo delle 3 tabelle principali ──
    anaSetProgress(5, 'Caricamento Anagrafiche, Diretti e ATECO…');
    var phase1 = await Promise.all([
      anaFetchAll('Anagrafiche'),
      anaFetchAll('diretti'),
      anaFetchAll('codiciateco')
    ]);
    var ana = phase1[0];
    var dir = phase1[1];
    allDiretti = dir; // Salva per schede anagrafiche
    var cod = phase1[2];

    // Calcola partite IVA uniche per il fetch CCIAA
    var pivaSet = {};
    ana.forEach(function(a){ if(a.partitaiva) pivaSet[String(a.partitaiva).trim()] = true; });
    var pivaList = Object.keys(pivaSet);

    anaSetProgress(55, 'Caricamento CCIAA e Contratti…');

    // ── FASE 2a: Contratti servizio (prima, senza carico concorrente) ──
    var contrattiRows = await anaFetchAllFiltered('contrattiservizio', 'select=id,codicecliente,tipocontratto,datastipulacontratto,nomeconsulente&datadisdetta=is.null&order=id.asc');

    // ── FASE 2b: CCIAA ──
    // Fonte preferita: cache precalcolata archivio_cciaa_cache (una riga per P.IVA, record più recente).
    // Se la cache non esiste o è vuota, ricade sulle query a batch sulla tabella cciaa.
    var cciaaRows = null;
    try {
      var cacheRows = await anaFetchAllFiltered('archivio_cciaa_cache', 'select=partita_iva,num_addetti_sub,num_addetti_fam_ul,stato_attivita,art_com_tur&order=partita_iva.asc');
      if (cacheRows.length > 0) cciaaRows = cacheRows;
    } catch(eCache) { console.warn('Cache CCIAA non disponibile, uso query dirette:', eCache.message); }

    if (cciaaRows === null) {
      cciaaRows = [];
      if (pivaList.length > 0) {
        var batchSize = 100;
        var batches = [];
        for (var b = 0; b < pivaList.length; b += batchSize) batches.push(pivaList.slice(b, b + batchSize));
        var concurrency = 4;
        for (var ci = 0; ci < batches.length; ci += concurrency) {
          anaSetProgress(55 + Math.round(15 * ci / batches.length), 'Caricamento CCIAA… ' + Math.min(ci + concurrency, batches.length) + '/' + batches.length);
          var chunk = batches.slice(ci, ci + concurrency);
          // Nessun errore ignorato: se un batch fallisce dopo i retry, il caricamento si ferma
          var chunkResults = await Promise.all(chunk.map(function(batch){
            return anaFetchRetry(SB+'/rest/v1/cciaa?select=partita_iva,num_addetti_sub,num_addetti_fam_ul,stato_attivita,art_com_tur&partita_iva=in.('+batch.join(',')+')')
              .then(function(r){ return r.json(); })
              .catch(function(e){ throw new Error('CCIAA: '+e.message+' (dati non completi, riprova)'); });
          }));
          chunkResults.forEach(function(r){ cciaaRows = cciaaRows.concat(r); });
        }
      }
    }

    // Costruisci mappa CCIAA: partita_iva → {sub, fam}
    anaCCIAAMap = {};
    cciaaRows.forEach(function(cc){
      if(cc.partita_iva) anaCCIAAMap[String(cc.partita_iva).trim()] = cc;
    });

    // Costruisci mappa contratti: codiceanagrafica → {tipocontratto: {data, consulente}}
    anaContratti = {};
    anaServiziSet = {};
    contrattiRows.forEach(function(c){
      if(!c.codicecliente) return;
      if(!anaContratti[c.codicecliente]) anaContratti[c.codicecliente] = {};
      if(c.tipocontratto){
        anaServiziSet[c.tipocontratto] = true;
        var existing = anaContratti[c.codicecliente][c.tipocontratto];
        var dataC = c.datastipulacontratto ? new Date(c.datastipulacontratto) : new Date(0);
        if(!existing || dataC > new Date(existing.data || 0)){
          anaContratti[c.codicecliente][c.tipocontratto] = {
            data: c.datastipulacontratto || null,
            consulente: c.nomeconsulente || ''
          };
        }
      }
    });

    anaSetProgress(75, 'Unificazione dati…');
    anaAll = anaJoin(ana, dir, cod);
    
    // Filtra: esclude anagrafiche dove TUTTI i servizi diretti sono NON ASSOCIABILE o CONTABILITA'
    // (non eliminare se ne ha almeno uno valido, es. ISCRITTO)
    anaAll = anaAll.filter(function(r) {
      var tutti = r.servizi_tutti && r.servizi_tutti.length ? r.servizi_tutti : (r.servizio ? [r.servizio] : []);
      if(tutti.length === 0) return true; // nessun servizio: tengo
      var esclusi = ['NON ASSOCIABILE', "CONTABILITA'"];
      // Tieni se almeno un servizio NON è nella lista di esclusione
      return tutti.some(function(s){ return esclusi.indexOf((s||'').trim()) === -1; });
    });
    
    // Costruisci mappa iscritti da diretti: codiceanagrafica → {datastipula, acuradi}
    var iscrittiMap = {};
    dir.forEach(function(d){
      if(!d.servizio || !d.codiceanagrafica) return;
      // ISCRITTO con data cessazione = NON iscritto
      if(d.datadisdetta && String(d.datadisdetta).trim()!=='') return;
      var svc = String(d.servizio).trim().toUpperCase();
      if(svc === 'ISCRITTO'){
        // Mantieni quello con data più recente
        var existing = iscrittiMap[d.codiceanagrafica];
        var dataNew = d.datastipula ? new Date(d.datastipula) : new Date(0);
        var dataOld = existing ? new Date(existing.datastipula || 0) : new Date(0);
        if(!existing || dataNew >= dataOld){
          iscrittiMap[d.codiceanagrafica] = {
            datastipula: d.datastipula || null,
            acuradi: d.acuradi || ''
          };
        }
      }
    });

    // Arricchisce ogni record con dati CCIAA, iscritto e contratti attivi
    anaAll.forEach(function(r){
      var piva = String(r.partitaiva || '').trim();
      var cc = anaCCIAAMap[piva] || null;
      r.addetti_sub    = cc ? (parseInt(cc.num_addetti_sub)    || 0) : 0;
      r.addetti_fam    = cc ? (parseInt(cc.num_addetti_fam_ul) || 0) : 0;
      r.totale_addetti = r.addetti_sub + r.addetti_fam;
      // Tipo impresa da CCIAA
      if(cc && cc.art_com_tur){
        var tc = String(cc.art_com_tur).trim().toUpperCase();
        r.tipoimpresa = tc === 'A' ? 'Artigiano' : tc === 'C' ? 'Commerciante' : tc;
      } else { r.tipoimpresa = ''; }
      // Stato attività da CCIAA (0 attiva, 1 liquidazione, 2 fallita, 3 sospesa, 4 inattiva, 5 cessata)
      if(cc && cc.stato_attivita !== null && cc.stato_attivita !== undefined && String(cc.stato_attivita).trim() !== ''){
        var _sa = String(cc.stato_attivita).trim();
        r.stato_attivita = (typeof traduciStatoAttivita === 'function') ? traduciStatoAttivita(_sa).testo
          : ({'0':'ATTIVA','1':'IN LIQUIDAZIONE','2':'FALLITA','3':'SOSPESA','4':'INATTIVA','5':'CESSATA'}[_sa] || 'SCONOSCIUTO');
      } else { r.stato_attivita = ''; }
      // Iscritto da diretti
      var isc = iscrittiMap[r.codiceanagrafica] || null;
      r.iscritto_data      = isc ? (isc.datastipula || null) : null;
      r.iscritto_consulente = isc ? (isc.acuradi || '') : '';
      // Contratti attivi: cerca per codiceanagrafica
      r.contratti_attivi = anaContratti[r.codiceanagrafica] || {};
      // ISCRITTO anche da contrattiservizio (già filtrato datadisdetta IS NULL)
      var iscCS = r.contratti_attivi['ISCRITTO'];
      if(!isc && iscCS){ r.iscritto_data = iscCS.data || null; r.iscritto_consulente = iscCS.consulente || ''; }
      r.iscritto = !!(isc || iscCS);

      // Arricchisce servizi_tutti con i tipocontratto da contrattiservizio
      // (alcune imprese hanno ISCRITTO/altri servizi in contrattiservizio invece che in diretti)
      var svSet = {};
      (r.servizi_tutti || []).forEach(function(s){ if(s) svSet[s] = true; });
      Object.keys(r.contratti_attivi).forEach(function(tipo){ if(tipo) svSet[tipo] = true; });
      r.servizi_tutti = Object.keys(svSet);
      r.isPagante = false; // inizializzato, verrà aggiornato dopo
    });

    // ── Carica badge Pagante: codici che hanno pagato tessera negli ultimi 3 anni ──
    anaSetProgress(88, 'Verifica paganti…');
    try {
      var annoMin = new Date().getFullYear() - 2;
      var dataMin = annoMin + '-01-01';
      // Legge i codici distinti pagati (saldo=0, data_fattura >= 3 anni fa) in batch da 50
      var codiciAll = anaAll.map(function(r){ return r.codiceanagrafica; }).filter(Boolean);
      var pagantiBatch = [];
      // Fonte preferita: cache archivio_paganti_cache (ultima fattura pagata per cliente G1000001).
      // Stessa regola: pagante se ultima data_fattura pagata >= 1 gennaio di (anno corrente - 2)
      var pagCache = [];
      try {
        pagCache = await anaFetchAllFiltered('archivio_paganti_cache', 'select=codice_cliente,ultima_data_fattura&ultima_data_fattura=gte.' + dataMin + '&order=codice_cliente.asc');
      } catch(ePc) { console.warn('Cache paganti non disponibile, uso query dirette:', ePc.message); pagCache = []; }
      if (pagCache.length > 0) {
        pagCache.forEach(function(row){ if(row.codice_cliente) pagantiBatch.push(row.codice_cliente); });
        codiciAll = []; // salta il percorso a batch
      }
      for (var pb = 0; pb < codiciAll.length; pb += 50) {
        var batch = codiciAll.slice(pb, pb + 50);
        // Paginazione per batch: senza, >1000 fatture nel batch farebbero perdere paganti
        for (var po = 0; ; po += 1000) {
          var rp = await anaFetchRetry(
            SB + '/rest/v1/incassipandora?select=codice_cliente&codice_azienda=eq.G1000001&pagato=eq.true&data_fattura=gte.' + dataMin + '&codice_cliente=in.(' + batch.join(',') + ')&order=codice_cliente.asc,id.asc&offset=' + po + '&limit=1000'
          );
          var dp = await rp.json();
          dp.forEach(function(row){ if(row.codice_cliente) pagantiBatch.push(row.codice_cliente); });
          if (dp.length < 1000) break;
        }
      }
      var pagantiSet = {};
      pagantiBatch.forEach(function(c){ pagantiSet[c] = true; });
      // Regola unica PAGANTE: >= 50€ in 2 anni oppure fatture senza insoluti (RPC get_paganti_tesseramento)
      var _pt = {};
      try {
        var _ptRows = await anaFetchAllFiltered('paganti_tesseramento_cache', 'select=codice_cliente&order=codice_cliente.asc');
        _ptRows.forEach(function(x){ _pt[x.codice_cliente] = true; });
        anaAll.forEach(function(r){ r.isPagante = !!_pt[r.codiceanagrafica]; });
      } catch(ePt) {
        console.warn('Cache paganti tesseramento non disponibile:', ePt.message);
        anaAll.forEach(function(r){ r.isPagante = !!pagantiSet[r.codiceanagrafica]; });
      }
    } catch(ep) {
      console.warn('Errore caricamento paganti:', ep.message);
      toast('⚠ Badge "Pagante" non affidabile: ' + ep.message + '. Ricarica l\'archivio.', 'error');
    }

    anaFiltered = [];  // Parte vuoto: mostra risultati solo dopo ricerca
    anaSelected.clear();
    anaPage=0;
    anaSetProgress(95, 'Popolamento filtri…');
    anaPopulateFilters();
    // NON chiama anaRender() — la tabella parte vuota
    anaSetProgress(100, 'Completato.');
    anaLoaded=true;
    setTimeout(function(){
      G('ana-loader').classList.remove('active');
      G('ana-content').style.display='block';
      if(window.reInitFiltersToggle) reInitFiltersToggle();
      // Messaggio placeholder nella tabella
      var tb=G('ana-tbody');
      if(tb) tb.innerHTML='<tr><td colspan="40" style="text-align:center;padding:48px 24px;color:var(--text-dim);font-size:14px;">'+
        '🔍 Usa i filtri sopra per cercare le imprese, poi clicca <strong>Applica</strong></td></tr>';
      // Aggiorna contatori
      G('ana-count').textContent = '0 record';
      G('ana-info-text').textContent = 'DB: '+anaAll.length.toLocaleString('it-IT')+' imprese caricate — imposta i filtri e clicca Applica';
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

// Fetch paginato con filtro custom (non usa select=* per compatibilità)
async function anaFetchAllFiltered(tableName, filterQuery){
  var all=[], offset=0, size=1000;
  while(true){
    var url = SB+'/rest/v1/'+tableName+'?'+filterQuery+'&offset='+offset+'&limit='+size;
    var r;
    try{ r = await anaFetchRetry(url); }
    catch(e){ throw new Error(tableName+': '+e.message); }
    var rows = await r.json();
    if(!Array.isArray(rows)||rows.length===0) break;
    all = all.concat(rows);
    offset += size;
    if(rows.length < size) break;
    await new Promise(function(res){setTimeout(res,50);});
  }
  // Verifica completezza rispetto al conteggio DB (stessi filtri, senza select/order)
  var filt = filterQuery.split('&').filter(function(p){ return !/^(select|order)=/.test(p); }).join('&');
  var exp = await anaExactCount(tableName, filt);
  if(exp !== null && exp !== all.length){
    throw new Error(tableName+': caricamento incompleto ('+all.length+' righe su '+exp+'). Riprova.');
  }
  return all;
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
  // Popola filtro servizio da TUTTI i servizi diretti (non solo il primo)
  var serviziSet = {};
  anaAll.forEach(function(r){
    (r.servizi_tutti || [r.servizio]).forEach(function(s){
      if(s && s.trim()) serviziSet[s.trim()] = 1;
    });
  });
  fillSel('ana-f-servizio', Object.keys(serviziSet).sort());
  var anni = uniq('datastipula', function(v){ return v?new Date(v).getFullYear():null; }).map(Number).filter(function(x){return !isNaN(x);}).sort(function(a,b){return b-a;});
  fillSel('ana-f-anno', anni);
  fillSel('ana-f-raggr', uniq('raggruppamento'));
  fillSel('ana-f-sede', uniq('sedeerogazione'));
  fillSel('ana-f-acuradi', uniq('acuradi'));
  fillSel('ana-f-motivo', uniq('motivoinizio'));
  fillSel('ana-f-unione', uniq('unione'));
  fillSel('ana-f-settore', uniq('settore'));
  fillSel('ana-f-mestiere', uniq('mestiere'));
  fillSel('ana-f-tipo', uniq('tipoimpresa'));
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
  var fTipo=G('ana-f-tipo').value;
  var fRaggA=G('ana-f-raggr-analisi').value;

  anaFiltered = anaAll.filter(function(r){
    if(fRs && !(r.ragionesociale||'').toLowerCase().includes(fRs)) return false;
    if(fPi && !(String(r.partitaiva||'')).toLowerCase().includes(fPi)) return false;
    if(fCf && !(String(r.codicefiscale||'')).toLowerCase().includes(fCf)) return false;
    if(fCap && String(r.cap||'')!==fCap) return false;
    if(fCom && r.comune!==fCom) return false;
    if(fSex && r.sesso!==fSex) return false;
    if(fAte && String(r.codiceateco||'')!==fAte) return false;
    if(fSrv){
      var tuttiSrv = r.servizi_tutti && r.servizi_tutti.length ? r.servizi_tutti : (r.servizio ? [r.servizio] : []);
      if(!tuttiSrv.some(function(s){ return s === fSrv; })) return false;
    }
    if(fAn && (!r.datastipula || String(new Date(r.datastipula).getFullYear())!==fAn)) return false;
    if(fRag && r.raggruppamento!==fRag) return false;
    if(fSed && r.sedeerogazione!==fSed) return false;
    if(fAc && r.acuradi!==fAc) return false;
    if(fMot && r.motivoinizio!==fMot) return false;
    if(fUn && r.unione!==fUn) return false;
    if(fSet && r.settore!==fSet) return false;
    if(fMes && r.mestiere!==fMes) return false;
    if(fTipo && r.tipoimpresa!==fTipo) return false;
    if(fRaggA){
      if(fRaggA==='commercio' && !r._isCommercio) return false;
      if(fRaggA==='turismo' && !r._isTurismo) return false;
      if(fRaggA==='cinema' && !r._isCinema) return false;
      if(fRaggA==='donne' && !r._isDonna) return false;
      if(fRaggA==='stranieri' && !r._isStraniero) return false;
      if(fRaggA==='giovani' && !r._isGiovane) return false;
    }
    if(fDis==='present' && (!r.datadisdetta || String(r.datadisdetta).trim()==='')) return false;
    if(fDis==='empty' && r.datadisdetta && String(r.datadisdetta).trim()!=='') return false;
    return true;
  });
  anaSelected.clear();
  G('ana-selall').checked=false;
  anaPage=0;
  anaRender();
}

function anaReset(){
  ['ana-f-rs','ana-f-piva','ana-f-cf','ana-f-cap','ana-f-comune','ana-f-sesso','ana-f-ateco','ana-f-servizio','ana-f-anno','ana-f-raggr','ana-f-sede','ana-f-acuradi','ana-f-motivo','ana-f-unione','ana-f-settore','ana-f-mestiere','ana-f-tipo','ana-f-raggr-analisi','ana-f-disdetta-status']
    .forEach(function(id){ var el=G(id); if(el) el.value=''; });
  anaFiltered = anaAll.slice();
  anaSelected.clear();
  G('ana-selall').checked=false;
  anaPage=0;
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

  // Lista servizi (ordinata) per le colonne contratti
  var servizi = Object.keys(anaServiziSet).sort();

  // ── Aggiorna header dinamicamente ──
  var thead = G('ana-table') && G('ana-table').querySelector('thead tr');
  if (thead) {
    // Rimuovi tutte le colonne dinamiche (indice >= 28)
    var thList = Array.from(thead.querySelectorAll('th'));
    for (var j = thList.length - 1; j >= 28; j--) thList[j].parentNode.removeChild(thList[j]);
    // 1) Iscritto (3 colonne)
    var th;
    th = document.createElement('th'); th.setAttribute('data-col','isc-stato'); th.textContent='Iscritto'; th.style.cssText='text-align:center;border-left:2px solid #10B981;color:#065F46;font-weight:700'; thead.appendChild(th);
    th = document.createElement('th'); th.setAttribute('data-col','isc-data');  th.style.cssText='font-size:11px;color:#666;text-align:center;white-space:nowrap'; th.innerHTML='Data<br><small>Iscritto</small>'; thead.appendChild(th);
    th = document.createElement('th'); th.setAttribute('data-col','isc-cons');  th.style.cssText='font-size:11px;color:#666;white-space:nowrap;border-right:2px solid #10B981'; th.innerHTML='Consulente<br><small>Iscritto</small>'; thead.appendChild(th);
    // 2) Dipendenti (3 colonne)
    th = document.createElement('th'); th.setAttribute('data-col','dip-sub'); th.textContent='Dip. Sub.'; th.style.cssText='text-align:center;border-left:2px solid var(--border)'; thead.appendChild(th);
    th = document.createElement('th'); th.setAttribute('data-col','dip-fam'); th.textContent='Dip. Fam.'; th.style.cssText='text-align:center'; thead.appendChild(th);
    th = document.createElement('th'); th.setAttribute('data-col','dip-tot'); th.textContent='Tot. Dip.'; th.style.cssText='text-align:center;font-weight:700;color:#005CA9;border-right:2px solid #005CA9'; thead.appendChild(th);
    // 3) Contratti attivi (3 colonne per tipo)
    servizi.forEach(function(s){
      var th1 = document.createElement('th');
      th1.textContent = s;
      th1.style.cssText = 'text-align:center;border-left:2px solid #ddd;white-space:nowrap';
      var th2 = document.createElement('th');
      th2.style.cssText = 'font-size:11px;color:#666;text-align:center;white-space:nowrap';
      th2.innerHTML = 'Data<br><small>'+s+'</small>';
      var th3 = document.createElement('th');
      th3.style.cssText = 'font-size:11px;color:#666;white-space:nowrap';
      th3.innerHTML = 'Consulente<br><small>'+s+'</small>';
      thead.appendChild(th1);
      thead.appendChild(th2);
      thead.appendChild(th3);
    });
  }

  // ── Paginazione: 50 record per pagina ──
  var totalPages = Math.max(1, Math.ceil(total / ANA_PAGE_SIZE));
  if(anaPage > totalPages-1) anaPage = totalPages-1;
  if(anaPage < 0) anaPage = 0;
  var start = anaPage * ANA_PAGE_SIZE;
  var end = Math.min(start + ANA_PAGE_SIZE, total);
  var rows = anaFiltered.slice(start, end);

  var info=G('ana-limit-info');
  if(info){ info.textContent = total ? ('Pagina '+(anaPage+1)+' di '+totalPages+' · '+ANA_PAGE_SIZE+' per pagina') : ''; }

  var colCount = 28 + 3 + 3 + (servizi.length * 3); // 28 base + 3 iscritto + 3 dip + 3*servizi
  var tb=G('ana-tbody');
  if(!rows.length){ tb.innerHTML='<tr><td colspan="'+colCount+'" class="ana-empty">Nessun record trovato</td></tr>'; anaRenderPagination(totalPages, start, end); anaUpdateSelCount(); return; }
  var html=[];
  for(var j=0;j<rows.length;j++){
    var r=rows[j];
    var i=start+j; // indice ASSOLUTO in anaFiltered (necessario per selezione/export)
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
      '<td>'+anaEsc(r.mestiere)+'</td>'
    );
    // Tipo Impresa con badge colorato
    var tipoBg  = r.tipoimpresa === 'Artigiano' ? '#FEE2E2' : r.tipoimpresa === 'Commerciante' ? '#FEF3C7' : '';
    var tipoCol = r.tipoimpresa === 'Artigiano' ? '#B91C1C' : r.tipoimpresa === 'Commerciante' ? '#92400E' : '#999';
    html.push('<td style="text-align:center;font-size:11px;font-weight:700;'+(r.tipoimpresa ? 'background:'+tipoBg+';color:'+tipoCol : 'color:#999')+'">'+(r.tipoimpresa || '-')+'</td>');
    // Colonne Iscritto (da diretti)
    if(r.iscritto){
      var iscDataStr = r.iscritto_data ? new Date(r.iscritto_data).toLocaleDateString('it-IT') : '-';
      html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#10B981;border-left:2px solid #10B981;white-space:nowrap">Iscritto CNA</td>');
      html.push('<td style="text-align:center;font-size:12px;white-space:nowrap">'+iscDataStr+'</td>');
      html.push('<td style="font-size:12px;border-right:2px solid #10B981">'+anaEsc(r.iscritto_consulente||'-')+'</td>');
    } else {
      html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#DC2626;border-left:2px solid #10B981;white-space:nowrap">Non iscritto CNA</td><td></td><td style="border-right:2px solid #10B981"></td>');
    }
    // Colonne dipendenti
    html.push('<td style="text-align:center;border-left:2px solid var(--border)">'+(r.addetti_sub > 0 ? r.addetti_sub : '-')+'</td>');
    html.push('<td style="text-align:center">'+(r.addetti_fam > 0 ? r.addetti_fam : '-')+'</td>');
    html.push('<td style="text-align:center;font-weight:700;color:#005CA9;background:#E8F0FE;border-right:2px solid #005CA9">'+(r.totale_addetti > 0 ? r.totale_addetti : '-')+'</td>');
    // Colonne contratti attivi
    var contratti = r.contratti_attivi || {};
    servizi.forEach(function(srv){
      var c = contratti[srv];
      if(c){
        var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '-';
        html.push('<td style="text-align:center;font-size:11px;font-weight:700;color:#fff;background:#10B981;border-left:2px solid #ddd">Attivo</td>');
        html.push('<td style="text-align:center;font-size:12px;white-space:nowrap">'+dataStr+'</td>');
        html.push('<td style="font-size:12px">'+anaEsc(c.consulente || '-')+'</td>');
      } else {
        html.push('<td style="border-left:2px solid #ddd"></td><td></td><td></td>');
      }
    });
    html.push('</tr>');
  }
  tb.innerHTML=html.join('');
  anaRenderPagination(totalPages, start, end);
  anaUpdateSelCount();
}

function anaRenderPagination(totalPages, start, end){
  var pag=G('ana-pagination'), info=G('ana-pag-info'), btns=G('ana-pag-buttons');
  if(!pag||!info||!btns) return;
  var total=anaFiltered.length;
  pag.style.display = total>0 ? 'flex' : 'none';
  info.textContent = total ? ('Mostrati '+(start+1)+'–'+end+' di '+total.toLocaleString('it-IT')+' imprese') : '';

  // CSS bottoni condiviso con Archivio Contratti (iniettato una sola volta)
  if(!document.getElementById('pag-style')){
    var s=document.createElement('style'); s.id='pag-style';
    s.textContent=[
      '.pag-btn{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:#fff;color:var(--text);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;}',
      '.pag-btn:hover:not(:disabled){background:#EFF6FF;border-color:#005CA9;color:#005CA9;}',
      '.pag-btn.active{background:#005CA9;border-color:#005CA9;color:#fff;}',
      '.pag-btn:disabled{opacity:.35;cursor:default;}',
      'body.dark-mode .pag-btn{background:var(--surface);color:var(--text);}',
      'body.dark-mode .pag-btn:hover:not(:disabled){background:var(--surface2);}'
    ].join('');
    document.head.appendChild(s);
  }

  var cur=anaPage, html='';
  html += '<button class="pag-btn" onclick="anaGoPage(0)" '+(cur===0?'disabled':'')+' title="Prima pagina">«</button>';
  html += '<button class="pag-btn" onclick="anaGoPage('+(cur-1)+')" '+(cur===0?'disabled':'')+' title="Precedente">‹</button>';
  var winStart=Math.max(0, Math.min(cur-3, totalPages-7));
  var winEnd=Math.min(totalPages, winStart+7);
  if(winStart>0){
    html += '<button class="pag-btn" onclick="anaGoPage(0)">1</button>';
    if(winStart>1) html += '<span style="padding:0 4px;color:var(--text-secondary);font-size:12px">…</span>';
  }
  for(var p=winStart;p<winEnd;p++){
    html += '<button class="pag-btn'+(p===cur?' active':'')+'" onclick="anaGoPage('+p+')">'+(p+1)+'</button>';
  }
  if(winEnd<totalPages){
    if(winEnd<totalPages-1) html += '<span style="padding:0 4px;color:var(--text-secondary);font-size:12px">…</span>';
    html += '<button class="pag-btn" onclick="anaGoPage('+(totalPages-1)+')">'+totalPages+'</button>';
  }
  html += '<button class="pag-btn" onclick="anaGoPage('+(cur+1)+')" '+(cur>=totalPages-1?'disabled':'')+' title="Successiva">›</button>';
  html += '<button class="pag-btn" onclick="anaGoPage('+(totalPages-1)+')" '+(cur>=totalPages-1?'disabled':'')+' title="Ultima pagina">»</button>';
  btns.innerHTML=html;
}

function anaGoPage(p){
  var totalPages=Math.max(1, Math.ceil(anaFiltered.length/ANA_PAGE_SIZE));
  anaPage=Math.max(0, Math.min(p, totalPages-1));
  anaRender();
  var wrap=document.querySelector('#ana-table');
  if(wrap){ var tw=wrap.closest('.ana-table-wrap'); if(tw){ tw.scrollTop=0; tw.scrollLeft=0; } }
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
    var servizi = Object.keys(anaServiziSet).sort();
    var indices = Array.from(anaSelected).sort(function(a,b){return a-b;});
    var wsData = [];

    // Riga 1: Titolo
    wsData.push(['Archivio Imprese CNA — ' + new Date().toLocaleDateString('it-IT')]);

    // Riga 2: Header
    var headerRow = [
      'PARTITA IVA','COD. FISCALE','RAGIONE SOCIALE','TELEFONO','EMAIL','CELLULARE',
      'INDIRIZZO','CAP','COMUNE','SESSO','COGNOME','NOME','DATA NASCITA','LUOGO NASCITA',
      'COD. ATECO','SERVIZIO','DATA STIPULA','DATA DISDETTA','RAGGRUPPAMENTO',
      'SEDE EROGAZIONE','A CURA DI','MOTIVO INIZIO','IMPORTO','UNIONE','SETTORE','MESTIERE',
      'TIPO IMPRESA','STATO ATTIVITÀ','RAGGR. ANALISI','PAGANTE',
      'ISCRITTO','DATA STIPULA ISCRITTO','CONSULENTE ISCRITTO',
      'DIP. SUBORDINATI','DIP. FAMILIARI','TOT. DIPENDENTI'
    ];
    servizi.forEach(function(s){
      headerRow.push(s.toUpperCase());
      headerRow.push('DATA STIPULA '+s.toUpperCase());
      headerRow.push('CONSULENTE '+s.toUpperCase());
    });
    wsData.push(headerRow);

    // Righe dati
    indices.forEach(function(idx){
      var r = anaFiltered[idx];
      if(!r) return;
      var iscDataStr = r.iscritto_data ? new Date(r.iscritto_data).toLocaleDateString('it-IT') : '';
      var row = [
        r.partitaiva||'', r.codicefiscale||'', r.ragionesociale||'',
        r.telefono||'', r.email||'', r.cellulare||'',
        r.indirizzo||'', r.cap||'', r.comune||'', r.sesso||'',
        r.cognometitolare||'', r.nometitolare||'',
        r.datanascita||'', r.luogonascita||'', r.codiceateco||'',
        r.servizio||'', r.datastipula||'', r.datadisdetta||'',
        r.raggruppamento||'', r.sedeerogazione||'', r.acuradi||'',
        r.motivoinizio||'', r.importo||'', r.unione||'', r.settore||'', r.mestiere||'',
        r.tipoimpresa||'', r.stato_attivita||'', (r.raggAnalisi||[]).join(', '), r.isPagante ? 'Pagante' : '',
        r.iscritto ? 'ISCRITTO CNA' : 'NON ISCRITTO CNA', iscDataStr, r.iscritto_consulente||'',
        r.addetti_sub > 0 ? r.addetti_sub : '', r.addetti_fam > 0 ? r.addetti_fam : '', r.totale_addetti > 0 ? r.totale_addetti : ''
      ];
      var contratti = r.contratti_attivi || {};
      servizi.forEach(function(srv){
        var c = contratti[srv];
        if(c){
          var dataStr = c.data ? new Date(c.data).toLocaleDateString('it-IT') : '';
          row.push('Attivo'); row.push(dataStr); row.push(c.consulente||'');
        } else { row.push('','',''); }
      });
      wsData.push(row);
    });

    var ws = XLSX.utils.aoa_to_sheet(wsData);
    var colCount = headerRow.length;

    // ── MERGE titolo ──
    ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:colCount-1}}];

    // ── LARGHEZZE COLONNE ──
    var colWidths = [13,14,50,13,32,13,35,7,18,6,18,14,11,16,10,20,12,12,18,18,18,16,10,18,18,20,16,30];
    // iscritto+dip
    colWidths.splice(27, 0, 18); // STATO ATTIVITÀ
    colWidths.push(10,12,14,25,13,12,13);
    servizi.forEach(function(){ colWidths.push(22,13,25); });
    ws['!cols'] = colWidths.map(function(w){ return {wch:w}; });

    // ── ROW HEIGHT ──
    ws['!rows'] = [{hpt:28},{hpt:36}]; // titolo h28, header h36

    // ── STILI ──
    var CNA_BLUE = 'FF005CA9';
    var CNA_GREEN = 'FF10B981';
    var WHITE = 'FFFFFFFF';
    var GREY_LIGHT = 'FFF2F2F2';
    var TEXT_WHITE = {rgb: WHITE};
    var TEXT_DARK  = {rgb: 'FF1A1A2E'};

    // Riga 1: Titolo — sfondo CNA blu, testo bianco grande
    var titleCell = ws['A1'] || {v:''};
    ws['A1'] = titleCell;
    ws['A1'].s = {
      font: {name:'Calibri', bold:true, sz:18, color:TEXT_WHITE},
      fill: {patternType:'solid', fgColor:{rgb:CNA_BLUE}},
      alignment: {horizontal:'left', vertical:'center'}
    };
    // Colore tutte le celle del titolo (per merge visivo)
    for(var tc=1; tc<colCount; tc++){
      var tcRef = XLSX.utils.encode_col(tc)+'1';
      if(!ws[tcRef]) ws[tcRef] = {v:''};
      ws[tcRef].s = {fill:{patternType:'solid', fgColor:{rgb:CNA_BLUE}}, font:{color:TEXT_WHITE}};
    }

    // Riga 2: Header colonne — sfondo CNA blu scuro, testo bianco grassetto
    for(var hc=0; hc<colCount; hc++){
      var hRef = XLSX.utils.encode_col(hc)+'2';
      if(!ws[hRef]) ws[hRef] = {v: headerRow[hc]||''};
      ws[hRef].s = {
        font: {name:'Calibri', bold:true, sz:11, color:TEXT_WHITE},
        fill: {patternType:'solid', fgColor:{rgb:CNA_BLUE}},
        alignment: {horizontal:'center', vertical:'center', wrapText:true},
        border: {
          left:   {style:'thin', color:{rgb:WHITE}},
          right:  {style:'thin', color:{rgb:WHITE}},
          top:    {style:'thin', color:{rgb:WHITE}},
          bottom: {style:'medium', color:{rgb:'FF0041A0'}}
        }
      };
    }

    // Righe dati: righe alternate bianco / grigio chiaro, Calibri 11
    var COL = function(n){ return headerRow.indexOf(n); };
    var C_TIPO = COL('TIPO IMPRESA'), C_STATO = COL('STATO ATTIVITÀ'), C_PAG = COL('PAGANTE'),
        C_ISC = COL('ISCRITTO'), C_SUB = COL('DIP. SUBORDINATI'), C_FAM = COL('DIP. FAMILIARI'),
        C_TOT = COL('TOT. DIPENDENTI'), C_SRV = C_TOT + 1;
    var STATO_COLORI = {
      'ATTIVA':          ['FF065F46','FFD1FAE5'],
      'IN LIQUIDAZIONE': ['FF92400E','FFFEF3C7'],
      'SOSPESA':         ['FF92400E','FFFEF3C7'],
      'FALLITA':         ['FFB91C1C','FFFEE2E2'],
      'CESSATA':         ['FFB91C1C','FFFEE2E2'],
      'INATTIVA':        ['FF4B5563','FFE5E7EB']
    };
    var dataRowCount = wsData.length - 2; // -titolo -header
    for(var dr=0; dr<dataRowCount; dr++){
      var excelRow = dr + 3; // riga Excel (1-indexed), parte da riga 3
      var isGrey = (dr % 2 === 1);
      var bg = isGrey ? GREY_LIGHT : WHITE;
      for(var dc=0; dc<colCount; dc++){
        var dRef = XLSX.utils.encode_col(dc) + excelRow;
        if(!ws[dRef]) ws[dRef] = {v:''};
        var cellStyle = {
          font: {name:'Calibri', sz:11, color:TEXT_DARK},
          fill: {patternType:'solid', fgColor:{rgb:bg}},
          alignment: {vertical:'center'},
          border: {
            bottom: {style:'thin', color:{rgb:'FFDDDDDD'}}
          }
        };
        // Ragione Sociale — grassetto
        if(dc === 2){
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:{rgb:'FF005CA9'}};
        }
        // Colonna Tipo Impresa (col 26) — colorata
        if(dc === C_TIPO && ws[dRef].v){
          var tipoVal = String(ws[dRef].v);
          if(tipoVal === 'Artigiano'){
            cellStyle.font = {name:'Calibri', sz:11, bold:true, color:{rgb:'FFB91C1C'}};
            cellStyle.fill = {patternType:'solid', fgColor:{rgb:'FFFEE2E2'}};
          } else if(tipoVal === 'Commerciante'){
            cellStyle.font = {name:'Calibri', sz:11, bold:true, color:{rgb:'FF92400E'}};
            cellStyle.fill = {patternType:'solid', fgColor:{rgb:'FFFEF3C7'}};
          }
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonna STATO ATTIVITÀ (CCIAA)
        if(dc === C_STATO && ws[dRef].v){
          var _sc = STATO_COLORI[String(ws[dRef].v)] || ['FF4B5563','FFF3F4F6'];
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:{rgb:_sc[0]}};
          cellStyle.fill = {patternType:'solid', fgColor:{rgb:_sc[1]}};
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonna PAGANTE — verde
        if(dc === C_PAG && ws[dRef].v === 'Pagante'){
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:TEXT_WHITE};
          cellStyle.fill = {patternType:'solid', fgColor:{rgb:'FF16A34A'}};
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonna Iscritto stato (col 29) — verde ISCRITTO CNA / rosso NON ISCRITTO CNA
        if(dc === C_ISC && (ws[dRef].v === 'ISCRITTO CNA' || ws[dRef].v === 'NON ISCRITTO CNA')){
          var _isc = ws[dRef].v === 'ISCRITTO CNA';
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:TEXT_WHITE};
          cellStyle.fill = {patternType:'solid', fgColor:{rgb: _isc ? CNA_GREEN : 'FFDC2626'}};
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonne TOT DIPENDENTI (col 32) — blu
        if(dc === C_TOT && ws[dRef].v !== ''){
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:{rgb:CNA_BLUE}};
          cellStyle.fill = {patternType:'solid', fgColor:{rgb:'FFE8F0FE'}};
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonne Sub/Fam dipendenti (col 30, 31) — centrate
        if(dc === C_SUB || dc === C_FAM){
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        // Colonne "Attivo" contratti (ogni 3° dal col 33+)
        if(dc >= C_SRV && (dc - C_SRV) % 3 === 0 && ws[dRef].v === 'Attivo'){
          cellStyle.font = {name:'Calibri', sz:11, bold:true, color:TEXT_WHITE};
          cellStyle.fill = {patternType:'solid', fgColor:{rgb:CNA_GREEN}};
          cellStyle.alignment = {horizontal:'center', vertical:'center'};
        }
        ws[dRef].s = cellStyle;
      }
    }

    // ── FREEZE: prime 2 righe e prime 3 colonne ──
    ws['!freeze'] = {xSplit:3, ySplit:2, topLeftCell:'D3', activePane:'bottomRight'};

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Imprese');
    var ts = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, 'cna_imprese_'+ts+'.xlsx');
    toast('✅ Esportati '+indices.length+' record', 'success');
  }catch(e){ toast('Errore export: '+e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT MODULE (Upload, conversione e push Supabase)
// ══════════════════════════════════════════════════════════════════════════════

var importData = { diretti: null, anagrafiche: null };
