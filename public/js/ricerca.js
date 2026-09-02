// ══════════════════════════════════════════════════════════════
//  RICERCA IMPRESE — tab-ricerca-imprese
//  Logica identica al CRM (associaticna.vercel.app) + Pandora
// ══════════════════════════════════════════════════════════════

function _riEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _riFmt(d){ if(!d)return '—'; var x=new Date(d); if(isNaN(x))return d; return ('0'+x.getDate()).slice(-2)+'/'+('0'+(x.getMonth()+1)).slice(-2)+'/'+x.getFullYear(); }
function _riEur(n){ var v=parseFloat(n)||0; return '€ '+v.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}); }

async function riCerca() {
  var ragione = (G('ri-ragione')||{value:''}).value.trim();
  var piva    = (G('ri-piva')   ||{value:''}).value.trim();
  var nome    = (G('ri-nome')   ||{value:''}).value.trim();
  var cognome = (G('ri-cognome')||{value:''}).value.trim();
  var comune  = (G('ri-comune') ||{value:''}).value.trim();
  var cf      = (G('ri-cf')     ||{value:''}).value.trim().toUpperCase();

  var statusEl    = G('ri-status');
  var risultatiEl = G('ri-risultati');
  var listaEl     = G('ri-lista');
  var schedaEl    = G('ri-scheda');

  var haInput = ragione.length>=2||piva.length>=2||nome.length>=2||cognome.length>=2||comune.length>=2||cf.length>=2;
  if(!haInput){ statusEl.textContent='Inserisci almeno un criterio (min. 2 caratteri)'; statusEl.style.color='#D97706'; return; }

  statusEl.textContent='Ricerca in corso…'; statusEl.style.color='var(--text-dim)';
  risultatiEl.style.display='none'; listaEl.innerHTML='';
  schedaEl.style.display='none'; schedaEl.innerHTML='';

  try {
    var esc = function(s){ return s.replace(/[%_]/g,''); };

    // Query Anagrafiche
    var aOrs=[];
    if(piva.length>=2)    aOrs.push('partitaiva.eq.'+esc(piva));
    if(cf.length>=2)      aOrs.push('codicefiscale.ilike.*'+esc(cf)+'*');
    if(cognome.length>=2) aOrs.push('cognometitolare.ilike.*'+esc(cognome)+'*');
    if(nome.length>=2)    aOrs.push('nometitolare.ilike.*'+esc(nome)+'*');
    if(ragione.length>=2) aOrs.push('ragionesociale.ilike.*'+esc(ragione)+'*');
    if(comune.length>=2)  aOrs.push('comune.ilike.*'+esc(comune)+'*');
    var urlA=SB+'/rest/v1/Anagrafiche?or=('+aOrs.join(',')+')'+'&select=codiceanagrafica,partitaiva,codicefiscale,ragionesociale,cognometitolare,nometitolare,comune,provincia,statogiuridico,codiceateco,mestiere&limit=50';

    var rA = await fetch(urlA, {headers:H()});
    if(!rA.ok){ statusEl.textContent='Errore: HTTP '+rA.status; return; }
    var anagrafiche = await rA.json();

    if(!anagrafiche.length){
      statusEl.textContent='Nessun risultato trovato';
      statusEl.style.color='#059669';
      listaEl.innerHTML='<div style="text-align:center;padding:32px;background:var(--surface2);border-radius:10px;color:var(--text-dim)">'+
        '<div style="font-size:28px;margin-bottom:8px">🔍</div>'+
        '<div style="font-weight:700;font-size:14px">Nessuna impresa trovata</div>'+
        '<div style="font-size:13px;margin-top:4px">Prova con criteri diversi</div>'+
        '</div>';
      risultatiEl.style.display='block'; return;
    }

    statusEl.textContent = anagrafiche.length + ' impres'+(anagrafiche.length===1?'a trovata':'e trovate');
    statusEl.style.color='var(--text-dim)';

    listaEl.innerHTML='';
    anagrafiche.forEach(function(a){
      var tit=[a.cognometitolare,a.nometitolare].filter(Boolean).join(' ');
      var sub=[];
      if(a.partitaiva)  sub.push('P.IVA: '+a.partitaiva);
      if(a.comune)      sub.push(a.comune+(a.provincia?' ('+a.provincia+')':''));

      var card=document.createElement('div');
      card.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:all .15s;gap:12px';
      card.onmouseenter=function(){ card.style.borderColor='#2563EB'; card.style.background='var(--blue-pale,#EFF6FF)'; card.style.transform='translateY(-1px)'; card.style.boxShadow='0 4px 12px rgba(37,99,235,.12)'; };
      card.onmouseleave=function(){ card.style.borderColor='var(--border)'; card.style.background='var(--surface2)'; card.style.transform=''; card.style.boxShadow=''; };
      card.onclick=function(){ riApriScheda(a); };

      var statoColor = a.statogiuridico==='ATTIVO' ? '#059669' : '#9CA3AF';
      var statoLabel = a.statogiuridico || '—';

      card.innerHTML=
        '<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">'+
          '<div style="width:40px;height:40px;background:rgba(37,99,235,.08);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'+
          '</div>'+
          '<div style="min-width:0">'+
            '<div style="font-weight:700;font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_riEsc(a.ragionesociale||'—')+
              (tit?'<span style="font-weight:400;color:var(--text-sub)"> — '+_riEsc(tit)+'</span>':'')+
            '</div>'+
            (sub.length?'<div style="font-size:11px;color:var(--text-dim);margin-top:2px;font-family:monospace">'+sub.join('  ·  ')+'</div>':'')+
            (a.mestiere?'<div style="font-size:11px;color:var(--text-sub);margin-top:1px">'+_riEsc(a.mestiere)+'</div>':'')+
          '</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'+
          '<span style="background:'+statoColor+'22;color:'+statoColor+';font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap">'+_riEsc(statoLabel)+'</span>'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>'+
        '</div>';
      listaEl.appendChild(card);
    });

    risultatiEl.style.display='block';

    // Se c'è un solo risultato, apri subito la scheda
    if(anagrafiche.length===1) riApriScheda(anagrafiche[0]);

  } catch(e) {
    statusEl.textContent='Errore: '+e.message;
    statusEl.style.color='#DC2626';
    console.error('riCerca:', e);
  }
}

async function riApriScheda(ana) {
  var schedaEl = G('ri-scheda');
  schedaEl.style.display='block';
  schedaEl.innerHTML='<div style="text-align:center;padding:32px;color:var(--text-dim)"><span class="spinner"></span><p style="margin-top:12px">Caricamento scheda…</p></div>';
  schedaEl.scrollIntoView({behavior:'smooth',block:'start'});

  var cod  = ana.codiceanagrafica||'';
  var piva = ana.partitaiva||'';
  var cf   = ana.codicefiscale||'';

  try {
    // Fetch parallelo: diretti, contrattiservizio, cciaa, pandora G1, pandora G3
    var urlD = SB+'/rest/v1/diretti?codiceanagrafica=eq.'+encodeURIComponent(cod)+'&select=servizio,datastipula,datadisdetta,raggruppamento,importo,acuradi,sedeerogazione,zonacliente&order=datastipula.desc';
    var urlS = SB+'/rest/v1/contrattiservizio?codicecliente=eq.'+encodeURIComponent(cod)+'&datadisdetta=is.null&select=tipocontratto,datastipulacontratto,raggruppamento,sedeerogazione,nomeconsulente,zonacliente&order=datastipulacontratto.desc';
    var urlC = piva ? SB+'/rest/v1/cciaa?partita_iva=eq.'+encodeURIComponent(piva)+'&select=stato_attivita,art_com_tur,num_addetti_sub,num_addetti_fam_ul&limit=1' : null;
    var urlP1= SB+'/rest/v1/incassipandora?codice_cliente=eq.'+encodeURIComponent(cod)+'&codice_azienda=eq.G1000001&order=data_fattura.desc&limit=200';
    var urlP3= SB+'/rest/v1/incassipandora?codice_cliente=eq.'+encodeURIComponent(cod)+'&codice_azienda=eq.G1000003&order=data_fattura.desc&limit=200';

    var fetches=[
      fetch(urlD,{headers:H()}),
      fetch(urlS,{headers:H()}),
      urlC ? fetch(urlC,{headers:H()}) : Promise.resolve({ok:true,json:function(){return Promise.resolve([]);}}),
      fetch(urlP1,{headers:H()}),
      fetch(urlP3,{headers:H()})
    ];
    var [rD,rS,rC,rP1,rP3] = await Promise.all(fetches);
    var diretti   = rD.ok  ? await rD.json()  : [];
    var servizi   = rS.ok  ? await rS.json()  : [];
    var cciaaArr  = rC.ok  ? await rC.json()  : [];
    var pandoraG1 = rP1.ok ? await rP1.json() : [];
    var pandoraG3 = rP3.ok ? await rP3.json() : [];
    var cciaa = cciaaArr[0]||null;

    // Badge stato
    var statoLabel = ana.statogiuridico||'—';
    var statoColor = ana.statogiuridico==='ATTIVO'?'#059669':'#9CA3AF';
    var statoGrad  = ana.statogiuridico==='ATTIVO'?'linear-gradient(135deg,#047857,#10B981)':'linear-gradient(135deg,#6B7280,#9CA3AF)';

    // Tipo impresa da CCIAA
    var tipoImp = cciaa ? (cciaa.art_com_tur==='A'?'Artigiano':cciaa.art_com_tur==='C'?'Commerciante':null) : null;

    // Iscritto (da diretti + contrattiservizio)
    var isIscritto = diretti.some(function(d){ return (d.servizio||'').toUpperCase()==='ISCRITTO'; }) ||
                     servizi.some(function(s){ return (s.tipocontratto||'').toUpperCase()==='ISCRITTO'; });

    // Pagante (pagato almeno una quota tessera negli ultimi 3 anni)
    var annoMin = new Date().getFullYear()-2;
    var isPagante = pandoraG1.some(function(p){
      if(!p.data_fattura||!p.pagato) return false;
      return parseInt(p.data_fattura.substring(0,4))>=annoMin;
    });

    // Addetti
    var addSub = cciaa ? (parseInt(cciaa.num_addetti_sub)||0) : 0;
    var addFam = cciaa ? (parseInt(cciaa.num_addetti_fam_ul)||0) : 0;

    // Titolare
    var titolare = [ana.cognometitolare, ana.nometitolare].filter(Boolean).join(' ');

    // ── Render scheda ──
    var html = '';

    // Header scheda
    html += '<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '<div>';
    html += '<div style="font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px">'+_riEsc(ana.ragionesociale||'—')+'</div>';
    if(titolare) html += '<div style="font-size:13px;color:var(--text-sub)">Titolare: '+_riEsc(titolare)+'</div>';
    html += '</div>';
    // Badge
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
    html += '<span style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:30px;background:'+statoGrad+';color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:9px;margin-right:4px">STATO</span>'+_riEsc(statoLabel)+'</span>';
    if(tipoImp) {
      var tGrad = tipoImp==='Artigiano'?'linear-gradient(135deg,#DC2626,#F87171)':'linear-gradient(135deg,#D97706,#FCD34D)';
      var tColor = tipoImp==='Artigiano'?'#fff':'#78350F';
      html += '<span style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:30px;background:'+tGrad+';color:'+tColor+';font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 3px 10px rgba(0,0,0,.15)"><span style="font-size:9px;margin-right:4px">TIPO</span>'+_riEsc(tipoImp)+'</span>';
    }
    if(isIscritto) html += '<span style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:30px;background:linear-gradient(135deg,#047857,#10B981);color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 3px 10px rgba(0,0,0,.15)">✓ Iscritto CNA</span>';
    if(isPagante) html += '<span style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:30px;background:linear-gradient(135deg,#15803D,#4ADE80);color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 3px 10px rgba(0,0,0,.15)">✓ Pagante</span>';
    html += '</div></div></div>';

    // Dati anagrafici
    html += riSezione('#2563EB', '📋', 'Dati Anagrafici', [
      ['Codice', ana.codiceanagrafica],
      ['Partita IVA', ana.partitaiva],
      ['Codice Fiscale', ana.codicefiscale],
      ['Indirizzo', [ana.indirizzo, ana.cap, ana.comune, ana.provincia ? '('+ana.provincia+')':''].filter(Boolean).join(' ')],
      ['Comune', ana.comune],
      ['Provincia', ana.provincia],
      ['Email', ana.email ? '<a href="mailto:'+_riEsc(ana.email)+'" style="color:#2563EB">'+_riEsc(ana.email)+'</a>' : null],
      ['Telefono', ana.telefono ? '<a href="tel:'+_riEsc(ana.telefono)+'" style="color:#2563EB">'+_riEsc(ana.telefono)+'</a>' : null],
      ['Cellulare', ana.cellulare ? '<a href="tel:'+_riEsc(ana.cellulare)+'" style="color:#7C3AED">'+_riEsc(ana.cellulare)+'</a>' : null],
    ]);

    // Addetti e dipendenti
    if(addSub+addFam > 0) {
      html += '<div class="ri-card-section">';
      html += '<div class="ri-section-hdr" style="background:#F3F4F6;color:#374151"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Addetti e Dipendenti</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr">';
      html += '<div style="padding:16px;text-align:center;border-right:1px solid var(--border)"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Subordinati</div><div style="font-size:28px;font-weight:800;color:var(--text)">'+addSub+'</div></div>';
      html += '<div style="padding:16px;text-align:center;border-right:1px solid var(--border)"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Familiari</div><div style="font-size:28px;font-weight:800;color:var(--text)">'+addFam+'</div></div>';
      html += '<div style="padding:16px;text-align:center;background:linear-gradient(135deg,#2563EB,#1D4ED8)"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px">Totale</div><div style="font-size:28px;font-weight:800;color:#fff">'+(addSub+addFam)+'</div></div>';
      html += '</div></div>';
    }

    // Stato associativo (diretti)
    var direttiAttivi = diretti.filter(function(d){ return !d.datadisdetta; });
    if(direttiAttivi.length) {
      html += '<div class="ri-card-section">';
      html += '<div class="ri-section-hdr" style="background:#F5F3FF;color:#7C3AED"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Stato Associativo</div>';
      direttiAttivi.forEach(function(d){
        html += '<div style="background:#F5F3FF;border-bottom:1px solid #DDD6FE;padding:12px 16px">';
        html += '<div style="display:flex;flex-wrap:wrap;gap:12px">';
        html += '<div style="flex:2;min-width:140px"><div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Tipo</div><div style="font-size:14px;font-weight:700;color:#3B0764">'+_riEsc(d.servizio||'—')+'</div><div style="font-size:11px;color:#6D28D9;margin-top:2px">'+_riEsc((d.raggruppamento||'').replace(/,\s*$/,'').trim()||'—')+(d.acuradi?' · '+_riEsc(d.acuradi):'')+'</div></div>';
        html += '<div style="flex:1;min-width:100px"><div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Data Stipula</div><div style="font-size:13px;color:#3B0764">'+_riFmt(d.datastipula)+'</div></div>';
        if(d.importo>0) html += '<div style="flex:1;min-width:80px"><div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Importo</div><div style="font-size:13px;font-weight:700;color:#3B0764">'+_riEur(d.importo)+'</div></div>';
        if(d.sedeerogazione) html += '<div style="flex:1;min-width:80px"><div style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Sede Erogazione</div><div style="font-size:13px;color:#3B0764">'+_riEsc(d.sedeerogazione)+'</div></div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Contratti servizio attivi
    var serviziAltri = servizi.filter(function(s){ return (s.tipocontratto||'').toUpperCase()!=='ISCRITTO'; });
    if(serviziAltri.length) {
      html += '<div class="ri-card-section">';
      html += '<div class="ri-section-hdr" style="background:#EFF6FF;color:#1D4ED8"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Contratti Servizio Attivi</div>';
      serviziAltri.forEach(function(s){
        var sede=(s.sedeerogazione||'').replace(/^\d+\s*-\s*/,'').trim();
        html += '<div style="background:#EFF6FF;border-bottom:1px solid #BFDBFE;padding:12px 16px">';
        html += '<div style="display:flex;flex-wrap:wrap;gap:12px">';
        html += '<div style="flex:2;min-width:140px"><div style="font-size:10px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Contratto</div><div style="font-size:14px;font-weight:700;color:#1E3A5F">'+_riEsc(s.tipocontratto||'—')+'</div><div style="font-size:11px;color:#0369A1;margin-top:3px">'+_riEsc((s.raggruppamento||'').replace(/,\s*$/,'').trim()||'—')+(sede?' · '+_riEsc(sede):'')+'</div></div>';
        html += '<div style="flex:1;min-width:110px"><div style="font-size:10px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Data Stipula</div><div style="font-size:13px;color:#1E3A5F">'+_riFmt(s.datastipulacontratto)+'</div>'+(s.nomeconsulente?'<div style="font-size:11px;color:#0369A1;margin-top:2px">'+_riEsc(s.nomeconsulente)+'</div>':'')+'</div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Categoria professionale
    if(ana.codiceateco || ana.mestiere) {
      html += riSezione('#059669', '🏭', 'Categoria Professionale', [
        ['Codice ATECO', ana.codiceateco],
        ['Mestiere', ana.mestiere],
      ]);
    }

    // Pagamenti Pandora
    html += riPandoraSection(pandoraG1, pandoraG3, isPagante);

    // Localizzazione mappa
    if(ana.comune || ana.indirizzo) {
      var addr=[ana.indirizzo,ana.cap,ana.comune,ana.provincia?'('+ana.provincia+')':''].filter(Boolean).join(' ');
      var mapUrl='https://maps.google.com/maps?q='+encodeURIComponent(addr);
      html += '<div class="ri-card-section">';
      html += '<div class="ri-section-hdr" style="background:#F0FDF4;color:#059669"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Localizzazione</div>';
      html += '<div style="padding:14px 16px">';
      html += '<iframe width="100%" height="200" style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:block" src="https://maps.google.com/maps?q='+encodeURIComponent(addr)+'&z=15&output=embed" allowfullscreen loading="lazy"></iframe>';
      html += '<div style="font-size:12px;color:var(--text-dim)">'+_riEsc(addr)+' · <a href="'+mapUrl+'" target="_blank" style="color:#2563EB">Apri in Maps →</a></div>';
      html += '</div></div>';
    }

    html += '<div style="text-align:center;padding:16px 0"><button onclick="G(\'ri-scheda\').style.display=\'none\';G(\'ri-scheda\').innerHTML=\'\'" class="btn btn-secondary btn-sm">← Torna ai risultati</button></div>';

    schedaEl.innerHTML = html;

  } catch(e) {
    schedaEl.innerHTML='<div style="color:#DC2626;padding:20px">Errore: '+e.message+'</div>';
    console.error('riApriScheda:', e);
  }
}

// ── Sezione generica tabella chiave/valore ──
function riSezione(color, icon, titolo, righe) {
  var visibili = righe.filter(function(r){ return r[1]||r[1]===0; });
  if(!visibili.length) return '';
  var html = '<div class="ri-card-section">';
  html += '<div class="ri-section-hdr" style="background:'+color+'11;color:'+color+'">'+icon+' '+_riEsc(titolo)+'</div>';
  visibili.forEach(function(r){
    html += '<div class="ri-row"><div class="ri-lbl">'+_riEsc(r[0])+'</div><div class="ri-val">'+r[1]+'</div></div>';
  });
  html += '</div>';
  return html;
}

// ── Sezione pagamenti Pandora ──
function riPandoraSection(g1, g3, isPagante) {
  if(!g1.length && !g3.length) {
    return '<div class="ri-card-section"><div class="ri-section-hdr" style="background:#EFF6FF;color:#2563EB">💳 Pagamenti Pandora</div>'+
      '<div style="padding:16px;color:var(--text-dim);font-size:13px;font-style:italic">Nessun dato di pagamento disponibile. Esegui l\'import da Pandora.</div></div>';
  }

  var html = '<div class="ri-card-section">';
  html += '<div class="ri-section-hdr" style="background:#EFF6FF;color:#2563EB">'+
    '💳 Pagamenti Pandora'+
    (isPagante?'<span style="margin-left:10px;display:inline-flex;align-items:center;padding:4px 12px;border-radius:30px;background:linear-gradient(135deg,#15803D,#4ADE80);color:#fff;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase">✓ PAGANTE</span>':'')+
  '</div>';

  // CNA Roma
  html += '<div style="padding:14px 16px">';
  html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#EFF6FF;border-radius:8px;margin-bottom:12px">';
  html += '<span style="font-size:15px">🏛</span><span style="font-size:14px;font-weight:700;color:#2563EB">CNA Roma — Tesseramento</span>';
  html += '<span style="font-family:monospace;font-size:11px;color:var(--text-dim);margin-left:auto">G1000001</span>';
  html += '<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:#DBEAFE;color:#2563EB">'+g1.length+' doc</span>';
  html += '</div>';
  html += riPandoraBlock(g1, 'CNA Roma');
  html += '</div>';

  html += '<div style="height:1px;background:var(--border)"></div>';

  // CNA CAF Lazio
  html += '<div style="padding:14px 16px">';
  html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFFBEB;border-radius:8px;margin-bottom:12px">';
  html += '<span style="font-size:15px">📋</span><span style="font-size:14px;font-weight:700;color:#D97706">CNA CAF Lazio — Servizi fiscali</span>';
  html += '<span style="font-family:monospace;font-size:11px;color:var(--text-dim);margin-left:auto">G1000003</span>';
  html += '<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:#FDE68A;color:#92400E">'+g3.length+' doc</span>';
  html += '</div>';
  html += riPandoraBlock(g3, 'CNA CAF Lazio');
  html += '</div>';

  html += '</div>';
  return html;
}

function riPandoraBlock(rows, label) {
  if(!rows.length) return '<p style="color:var(--text-dim);font-size:13px;font-style:italic;padding:8px 0">Nessun documento per '+label+'</p>';

  var totFat = rows.reduce(function(s,r){ return s+(parseFloat(r.totale_fattura)||0); },0);
  var totSal = rows.reduce(function(s,r){ return s+(parseFloat(r.saldo)||0); },0);
  var nPag   = rows.filter(function(r){ return r.pagato; }).length;

  var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">';
  html += '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE">'+rows.length+' documenti</span>';
  html += '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0">✓ '+nPag+' pagati</span>';
  if(totSal>0) html += '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA">⚠ Insoluto '+_riEur(totSal)+'</span>';
  else html += '<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:6px;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0">Tutto saldato</span>';
  html += '<span style="font-size:12px;font-weight:500;padding:4px 12px;border-radius:6px;background:var(--surface2);color:var(--text-dim)">Fatturato '+_riEur(totFat)+'</span>';
  html += '</div>';

  html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="background:var(--surface2)">';
  html += '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Data</th>';
  html += '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Scadenza</th>';
  html += '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Riferimento</th>';
  html += '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Importo</th>';
  html += '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Saldo</th>';
  html += '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Stato</th>';
  html += '</tr></thead><tbody>';

  rows.forEach(function(r){
    var saldo = parseFloat(r.saldo)||0;
    var rif = (r.riferimento||'').toLowerCase();
    var statoStyle = r.pagato ? 'background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0' : 'background:#FEF2F2;color:#DC2626;border:1px solid #FECACA';
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:7px 12px;white-space:nowrap;font-family:monospace">'+_riFmt(r.data_fattura)+'</td>';
    html += '<td style="padding:7px 12px;white-space:nowrap;font-family:monospace;color:var(--text-dim)">'+_riFmt(r.data_scadenza)+'</td>';
    html += '<td style="padding:7px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+_riEsc(r.riferimento||'')+'">'+_riEsc(rif)+'</td>';
    html += '<td style="padding:7px 12px;text-align:right;font-weight:600">'+_riEur(r.totale_fattura)+'</td>';
    html += '<td style="padding:7px 12px;text-align:right;font-weight:700;color:'+(saldo>0?'#DC2626':'#16A34A')+'">'+_riEur(saldo)+'</td>';
    html += '<td style="padding:7px 12px;text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;'+statoStyle+'">'+(r.pagato?'PAGATO':'APERTO')+'</span></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function riReset() {
  ['ri-ragione','ri-piva','ri-nome','ri-cognome','ri-comune','ri-cf'].forEach(function(id){
    var el=G(id); if(el) el.value='';
  });
  var s=G('ri-status'); if(s){s.textContent='';} 
  var r=G('ri-risultati'); if(r){r.style.display='none';}
  var l=G('ri-lista'); if(l){l.innerHTML='';}
  var sc=G('ri-scheda'); if(sc){sc.style.display='none';sc.innerHTML='';}
}
