var hamburger=G('hamburger-btn'),drawer=G('mobile-drawer');
function closeDrawer(){hamburger.classList.remove('open');drawer.classList.remove('open');}
hamburger.addEventListener('click',function(){
  hamburger.classList.toggle('open');
  drawer.classList.toggle('open');
});
document.addEventListener('click',function(e){
  if(drawer.classList.contains('open')&&!drawer.contains(e.target)&&!hamburger.contains(e.target))closeDrawer();
});

// Wire mobile drawer buttons to main handlers
G('btn-logout').addEventListener('click',function(){closeDrawer();doLogout();});
G('btn-reset').addEventListener('click',function(){closeDrawer();G('btn-reset').click();});
G('btn-go-admin').addEventListener('click',function(){closeDrawer();showAdminPanel();});
G('file-add').addEventListener('change',function(e){handleFile(e.target.files[0],true);e.target.value='';closeDrawer();});

// sync mobile admin visibility with desktop
function syncMobileAdmin(){
  var show=isAdmin();
  var mob=G('mobile-admin-actions');
  if(mob) mob.style.display=show?'flex':'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDA ANAGRAFICA MODAL
// ══════════════════════════════════════════════════════════════════════════════

function traduciTipoImpresa(codice) {
  var tipoMap = {
    'A': { testo: 'Artigiano', bgColor: '#EF4444', textColor: 'white' },
    'C': { testo: 'Commerciante', bgColor: '#FBBF24', textColor: 'black' }
  };
  return tipoMap[codice] || { testo: 'Varie', bgColor: '#F97316', textColor: 'black' };
}

function traduciStatoAttivita(codice) {
  var statMap = {
    '0': { testo: 'ATTIVA', color: '#10B981' },
    '1': { testo: 'IN LIQUIDAZIONE', color: '#F59E0B' },
    '2': { testo: 'FALLITA', color: '#EF4444' },
    '3': { testo: 'SOSPESA', color: '#F59E0B' },
    '4': { testo: 'INATTIVA', color: '#9CA3AF' },
    '5': { testo: 'CESSATA', color: '#EF4444' }
  };
  return statMap[String(codice)] || { testo: 'SCONOSCIUTO', color: '#6B7280' };
}

// currentAnaIdx e currentCCIAAData sono già dichiarate in alto

async function openAnagraficaModal(anaIdx) {
  currentAnaIdx = anaIdx;
  var ana = anaFiltered[anaIdx];
  if (!ana) return;

  showLoad('Caricamento scheda…');

  // ── Carica tutti i dati in parallelo ──────────────────────────────
  var [cciaaRes, direttiRes, contrattiRes, incassiRes] = await Promise.allSettled([
    // CCIAA
    fetch(SB + '/rest/v1/cciaa?partita_iva=eq.' + encodeURIComponent(ana.partitaiva), { headers: H() }),
    // Diretti (tesseramento)
    fetch(SB + '/rest/v1/diretti?codiceanagrafica=eq.' + encodeURIComponent(ana.codiceanagrafica), { headers: H() }),
    // Contratti servizio attivi
    fetch(SB + '/rest/v1/contrattiservizio?codicecliente=eq.' + encodeURIComponent(ana.codiceanagrafica) + '&datadisdetta=is.null&order=datastipulacontratto.desc', { headers: H() }),
    // Incassi ultimi 2 anni
    (function() {
      var d = new Date(); d.setFullYear(d.getFullYear() - 2);
      return fetch(SB + '/rest/v1/incassi?codice_cliente=eq.' + encodeURIComponent(ana.codiceanagrafica) + '&data_pagamento=gte.' + d.toISOString().substring(0,10) + '&select=*&order=data_pagamento.desc', { headers: H() });
    })()
  ]);

  // Estrai dati
  currentCCIAAData = null;
  try {
    if (cciaaRes.status === 'fulfilled' && cciaaRes.value.ok) {
      var cciaaArr = await cciaaRes.value.json();
      if (cciaaArr && cciaaArr.length > 0) currentCCIAAData = cciaaArr[0];
    }
  } catch(e) {}

  var diretti = [];
  try {
    if (direttiRes.status === 'fulfilled' && direttiRes.value.ok) {
      diretti = await direttiRes.value.json() || [];
    }
  } catch(e) {}

  var contratti = [];
  try {
    if (contrattiRes.status === 'fulfilled' && contrattiRes.value.ok) {
      contratti = await contrattiRes.value.json() || [];
    }
  } catch(e) {}

  var incassi = [];
  try {
    if (incassiRes.status === 'fulfilled' && incassiRes.value.ok) {
      incassi = await incassiRes.value.json() || [];
    }
  } catch(e) {}

  hideLoad();

  var cciaa = currentCCIAAData;

  // ── Helpers ──────────────────────────────────────────────────────
  function field(label, value, opts) {
    if (!value && !opts) return '';
    opts = opts || {};
    var val = '';
    if (opts.tel)        val = '<a href="tel:' + value + '" style="color:var(--blue)">📞 ' + value + '</a>';
    else if (opts.mail)  val = '<a href="mailto:' + value + '" style="color:var(--blue)">✉ ' + value + '</a>';
    else                 val = String(value || '');
    var wide = opts.wide ? 'grid-column:1/-1' : '';
    return '<div class="scheda-field" style="' + wide + '">' +
      '<div class="scheda-field-label">' + label + '</div>' +
      '<div class="scheda-field-value">' + val + '</div>' +
    '</div>';
  }

  function fmtDate(d) {
    if (!d) return '—';
    return String(d).substring(0,10).split('-').reverse().join('/');
  }

  function fmtEur(n) {
    return '€\u00a0' + Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  // Header sezione colorato — bg pieno, testo e icona bianchi
  function secHdr(bgColor, svgPath, label) {
    return '<div style="display:flex;align-items:center;gap:8px;background:' + bgColor + ';margin:-16px -18px 14px -18px;padding:10px 18px;border-radius:12px 12px 0 0">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + svgPath + '</svg>' +
      '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:white">' + label + '</span>' +
    '</div>';
  }

  // SVG paths per ogni sezione
  var P = {
    person:  '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:   '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    briefc:  '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    hand:    '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
    euro:    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    pin:     '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    doc:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
  };

  // ── Stato associativo ─────────────────────────────────────────────
  var isIscritto = diretti.some(function(d){ return d.servizio === 'ISCRITTO'; }) ||
                   contratti.some(function(c){ return c.tipocontratto === 'ISCRITTO'; });
  var isInps = diretti.some(function(d){ return d.servizio === 'TESSERAMENTO INPS'; });
  var iscrittoContratto = contratti.find(function(c){ return c.tipocontratto === 'ISCRITTO'; });
  var serviziContratto = contratti.filter(function(c){ return c.tipocontratto !== 'ISCRITTO'; });

  // ── HTML ──────────────────────────────────────────────────────────
  var body = '';

  // ══════════════════════════════════════════════════════
  // SEZIONE 1 — DATI ANAGRAFICI  (header: blu CNA)
  // ══════════════════════════════════════════════════════
  body += '<div class="scheda-section">';
  body += secHdr('#005CA9', P.person, 'Dati Anagrafici');

  // Badge stato + tipo impresa + iscritto
  body += '<div class="scheda-status-row" style="margin-bottom:14px">';

  if (cciaa && cciaa.stato_attivita !== null && cciaa.stato_attivita !== undefined) {
    var statoInfo = traduciStatoAttivita(cciaa.stato_attivita);
    body += '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:10px;background:' + statoInfo.color + ';min-width:80px">' +
      '<svg width="16" height="16" viewBox="0 0 8 8" style="margin-bottom:3px"><circle cx="4" cy="4" r="4" fill="white" opacity=".9"/></svg>' +
      '<span style="font-size:10px;font-weight:800;color:white;letter-spacing:.04em;text-transform:uppercase">' + statoInfo.testo + '</span>' +
    '</div>';
  }
  if (cciaa && cciaa.art_com_tur) {
    var tipoInfo = traduciTipoImpresa(cciaa.art_com_tur);
    body += '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:10px;background:' + tipoInfo.bgColor + ';min-width:80px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + tipoInfo.textColor + '" stroke-width="2.5" style="margin-bottom:3px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>' +
      '<span style="font-size:10px;font-weight:800;color:' + tipoInfo.textColor + ';letter-spacing:.04em;text-transform:uppercase">' + tipoInfo.testo + '</span>' +
    '</div>';
  }
  if (isIscritto) {
    body += '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:10px;background:#059669;min-width:80px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="margin-bottom:3px"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span style="font-size:10px;font-weight:800;color:white;letter-spacing:.04em;text-transform:uppercase">Iscritto</span>' +
    '</div>';
  }
  if (isInps) {
    body += '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:10px;background:#0284C7;min-width:80px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="margin-bottom:3px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
      '<span style="font-size:10px;font-weight:800;color:white;letter-spacing:.04em;text-transform:uppercase">INPS</span>' +
    '</div>';
  }
  body += '</div>';

  // Titolare
  var nomeCompleto = [ana.nometitolare, ana.cognometitolare].filter(Boolean).join(' ');
  if (nomeCompleto) {
    body += '<div style="padding:9px 12px;background:rgba(0,92,169,.06);border-left:3px solid rgba(0,92,169,.3);border-radius:6px;margin-bottom:12px">';
    body += '<div class="scheda-field-label">Titolare</div>';
    body += '<div style="font-size:14px;font-weight:700;color:#005CA9">' + nomeCompleto + '</div>';
    body += '</div>';
  }

  body += '<div class="scheda-grid">';
  body += field('Codice', ana.codiceanagrafica);
  body += field('Partita IVA', ana.partitaiva);
  body += field('Indirizzo', ana.indirizzo, {wide:true});
  body += field('CAP', ana.cap);
  body += field('Comune', ana.comune);
  body += field('Provincia', ana.provincia);
  body += field('Email', ana.email, {mail:true});
  body += field('Telefono', ana.telefono, {tel:true});
  body += field('Cellulare', ana.cellulare, {tel:true});
  body += '</div></div>';

  // ══════════════════════════════════════════════════════
  // SEZIONE 2 — ADDETTI  (header: grigio ardesia)
  // ══════════════════════════════════════════════════════
  if (cciaa && (cciaa.num_addetti_sub || cciaa.num_addetti_fam_ul)) {
    var addSub = parseInt(cciaa.num_addetti_sub) || 0;
    var addFam = parseInt(cciaa.num_addetti_fam_ul) || 0;
    body += '<div class="scheda-section">';
    body += secHdr('#475569', P.users, 'Addetti e Dipendenti');
    body += '<div class="scheda-addetti">';
    body += '<div class="scheda-addetti-card"><div class="scheda-addetti-val">' + addSub + '</div><div class="scheda-addetti-lbl">Subordinati</div></div>';
    body += '<div class="scheda-addetti-card"><div class="scheda-addetti-val">' + addFam + '</div><div class="scheda-addetti-lbl">Familiari</div></div>';
    body += '<div class="scheda-addetti-card tot"><div class="scheda-addetti-val">' + (addSub+addFam) + '</div><div class="scheda-addetti-lbl">Totale</div></div>';
    body += '</div></div>';
  }

  // ══════════════════════════════════════════════════════
  // SEZIONE 3 — CATEGORIA PROFESSIONALE  (header: viola)
  // ══════════════════════════════════════════════════════
  if (ana.mestiere || ana.codicemestiere || ana.unione) {
    body += '<div class="scheda-section">';
    body += secHdr('#7C3AED', P.briefc, 'Categoria Professionale');
    body += '<div class="scheda-grid">';
    body += field('Mestiere', ana.mestiere, {wide:true});
    body += field('Codice Mestiere', ana.codicemestiere);
    body += field('Unione', ana.unione);
    body += field('Settore', ana.settore);
    body += field('Ateco 2025', ana['Ateco 2025'] || ana.codiceateco);
    body += field('Ateco 2007', ana['Ateco 2007']);
    body += '</div></div>';
  }

  // ══════════════════════════════════════════════════════
  // SEZIONE 4 — TESSERAMENTO + CONTRATTI  (header: arancio)
  // ══════════════════════════════════════════════════════
  body += '<div class="scheda-section">';
  body += secHdr('#EA580C', P.hand, 'Tesseramento e Contratti');

  // Helper riga contratto/tesseramento
  function contrattoRow(titolo, dataStipula, dettagli, accentColor) {
    var hasDet = dettagli && (dettagli.raggruppamento || dettagli.importo || dettagli.consulente || dettagli.sede);
    var html = '<div style="padding:10px 14px;background:var(--surface2);border-left:4px solid ' + accentColor + ';border-radius:8px;margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (hasDet ? '8px' : '0') + '">';
    html += '<span style="font-weight:700;font-size:13px;color:' + accentColor + '">' + titolo + '</span>';
    if (dataStipula) html += '<span style="font-size:11px;color:var(--text-dim);white-space:nowrap">dal ' + dataStipula + '</span>';
    html += '</div>';
    if (hasDet) {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">';
      if (dettagli.raggruppamento) html += '<div><div class="scheda-field-label">Raggruppamento</div><div class="scheda-field-value">' + dettagli.raggruppamento + '</div></div>';
      if (dettagli.importo)        html += '<div><div class="scheda-field-label">Importo</div><div class="scheda-field-value" style="color:#059669;font-weight:700">€ ' + dettagli.importo + '</div></div>';
      if (dettagli.consulente)     html += '<div><div class="scheda-field-label">Consulente</div><div class="scheda-field-value">' + dettagli.consulente + '</div></div>';
      if (dettagli.sede)           html += '<div><div class="scheda-field-label">Sede erogazione</div><div class="scheda-field-value">' + dettagli.sede + '</div></div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ISCRITTO
  if (isIscritto) {
    var iscDir = diretti.find(function(d){ return d.servizio === 'ISCRITTO'; });
    var dataIsc = iscDir ? fmtDate(iscDir.datastipula)
                         : (iscrittoContratto ? fmtDate(iscrittoContratto.datastipulacontratto) : null);
    var detIsc = {};
    if (iscDir) {
      if (iscDir.raggruppamento) detIsc.raggruppamento = iscDir.raggruppamento;
      if (iscDir.importo && iscDir.importo !== '0') detIsc.importo = iscDir.importo;
      if (iscDir.acuradi) detIsc.consulente = iscDir.acuradi;
      if (iscDir.sedeerogazione) detIsc.sede = iscDir.sedeerogazione;
    } else if (iscrittoContratto) {
      if (iscrittoContratto.raggruppamento) detIsc.raggruppamento = iscrittoContratto.raggruppamento;
      if (iscrittoContratto.nomeconsulente) detIsc.consulente = iscrittoContratto.nomeconsulente;
      if (iscrittoContratto.sedeerogazione) detIsc.sede = iscrittoContratto.sedeerogazione;
    }
    body += contrattoRow('✓ ISCRITTO CNA', dataIsc, detIsc, '#059669');
  }

  // TESSERAMENTO INPS
  if (isInps) {
    var inpsDir = diretti.find(function(d){ return d.servizio === 'TESSERAMENTO INPS'; });
    var detInps = {};
    if (inpsDir) {
      if (inpsDir.raggruppamento) detInps.raggruppamento = inpsDir.raggruppamento;
      if (inpsDir.importo && inpsDir.importo !== '0') detInps.importo = inpsDir.importo;
      if (inpsDir.acuradi) detInps.consulente = inpsDir.acuradi;
      if (inpsDir.sedeerogazione) detInps.sede = inpsDir.sedeerogazione;
    }
    body += contrattoRow('TESSERAMENTO INPS', inpsDir ? fmtDate(inpsDir.datastipula) : null, detInps, '#0284C7');
  }

  // Contratti servizio
  if (serviziContratto.length > 0) {
    if (isIscritto || isInps) {
      body += '<div class="scheda-field-label" style="margin:12px 0 8px">Contratti Servizio attivi (' + serviziContratto.length + ')</div>';
    }
    serviziContratto.forEach(function(c) {
      var det = {};
      if (c.raggruppamento)    det.raggruppamento = c.raggruppamento;
      if (c.importo && c.importo !== '0') det.importo = c.importo;
      if (c.nomeconsulente)    det.consulente = c.nomeconsulente;
      if (c.sedeerogazione)    det.sede = c.sedeerogazione;
      body += contrattoRow(c.tipocontratto || '—', fmtDate(c.datastipulacontratto), det, '#EA580C');
    });
  }

  if (!isIscritto && !isInps && serviziContratto.length === 0) {
    body += '<div style="color:var(--text-dim);font-size:13px;font-style:italic">Nessun contratto attivo</div>';
  }

  body += '</div>'; // fine sezione contratti

  // ══════════════════════════════════════════════════════
  // SEZIONE 5 — PAGAMENTI  (header: verde smeraldo)
  // ══════════════════════════════════════════════════════
  body += '<div class="scheda-section">';
  body += secHdr('#059669', P.euro, 'Pagamenti ultimi 2 anni');

  if (incassi.length === 0) {
    body += '<div style="color:var(--text-dim);font-size:13px;font-style:italic">Non risultano pagamenti negli ultimi due anni.</div>';
  } else {
    var totInc = incassi.reduce(function(s,r){ return s+(r.avere||0); }, 0);
    var totSepa = incassi.filter(function(r){ return (r.tipo_doc_az||'').toUpperCase()==='RID'; }).reduce(function(s,r){ return s+(r.avere||0); }, 0);
    var ultimaData = fmtDate(incassi[0].data_pagamento);

    body += '<div class="scheda-pay-kpis">';
    body += '<div class="scheda-pay-kpi" style="border-left-color:#059669"><div class="scheda-pay-kpi-lbl">Totale</div><div class="scheda-pay-kpi-val">' + fmtEur(totInc) + '</div></div>';
    body += '<div class="scheda-pay-kpi" style="border-left-color:#0284C7"><div class="scheda-pay-kpi-lbl">SEPA</div><div class="scheda-pay-kpi-val">' + fmtEur(totSepa) + '</div></div>';
    body += '<div class="scheda-pay-kpi" style="border-left-color:#F59E0B"><div class="scheda-pay-kpi-lbl">Cassa</div><div class="scheda-pay-kpi-val">' + fmtEur(totInc - totSepa) + '</div></div>';
    body += '<div class="scheda-pay-kpi" style="border-left-color:#7C3AED"><div class="scheda-pay-kpi-lbl">Ultimo</div><div class="scheda-pay-kpi-val" style="font-size:12px">' + ultimaData + '</div></div>';
    body += '</div>';

    body += '<table class="scheda-pay-table"><thead><tr>';
    body += '<th>Data</th><th style="text-align:right">Importo</th><th>Metodo</th><th>Sede</th><th>Causale</th>';
    body += '</tr></thead><tbody>';
    incassi.slice(0, 8).forEach(function(r) {
      var metodo = (r.tipo_doc_az||'').toUpperCase()==='RID' ? 'SEPA' : 'Cassa';
      var mc = metodo === 'SEPA' ? '#0284C7' : '#059669';
      var causale = (r.compensazione || r.documento || '').substring(0,40);
      body += '<tr>';
      body += '<td style="white-space:nowrap">' + fmtDate(r.data_pagamento) + '</td>';
      body += '<td style="text-align:right;font-weight:700;color:#059669">' + fmtEur(r.avere||0) + '</td>';
      body += '<td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:' + mc + '18;color:' + mc + '">' + metodo + '</span></td>';
      body += '<td style="font-size:11px;color:var(--text-dim)">' + (r.cassa||'').replace(/^CASSA /,'') + '</td>';
      body += '<td style="font-size:11px;color:var(--text-dim);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (r.compensazione||'').replace(/"/g,'') + '">' + causale + '</td>';
      body += '</tr>';
    });
    body += '</tbody></table>';
    if (incassi.length > 8) {
      body += '<div style="text-align:center;padding:8px;font-size:11px;color:var(--text-dim)">+ altri ' + (incassi.length-8) + ' pagamenti</div>';
    }
  }
  body += '</div>';

  // ── SEZIONE: MAPPA ───────────────────────────────────────────────
  if (ana.indirizzo || ana.comune) {
    var mapAddress = [ana.indirizzo, ana.cap, ana.comune, ana.provincia ? '(' + ana.provincia + ')' : ''].filter(Boolean).join(' ');
    var mapUrl = 'https://maps.google.com/maps?q=' + encodeURIComponent(mapAddress);
    body += '<div class="scheda-section">';
    body += secHdr('#0F766E', P.pin, 'Localizzazione');
    body += '<iframe width="100%" height="220" style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:block" src="https://maps.google.com/maps?q=' + encodeURIComponent(mapAddress) + '&z=15&output=embed" allowfullscreen loading="lazy"></iframe>';
    body += '<div style="font-size:12px;color:var(--text-dim)">' + mapAddress + ' · <a href="' + mapUrl + '" target="_blank" style="color:var(--blue)">Apri in Maps →</a></div>';
    body += '</div>';
  }

  // ── Costruisci overlay fullscreen ─────────────────────────────────
  var overlay = document.createElement('div');
  overlay.className = 'scheda-overlay';
  overlay.id = 'modal-scheda-bg';

  overlay.innerHTML =
    // Topbar con logo CNA + nome impresa
    '<div class="scheda-topbar" style="background:white;border-bottom:1px solid #e2e8f0">' +
      '<button class="scheda-topbar-back" style="background:rgba(0,92,169,.08);color:#005CA9;border:1px solid rgba(0,92,169,.2)" onclick="document.getElementById(\'modal-scheda-bg\').remove()">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>' +
        'Indietro' +
      '</button>' +
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:12px;min-width:0;overflow:hidden">' +
        '<img src="https://raw.githubusercontent.com/alessandroparrelli/fileappoggio/refs/heads/main/Nuovo-logo-CNA-blu-bianco.png" ' +
          'style="height:38px;width:auto;flex-shrink:0;object-fit:contain" alt="CNA" ' +
          'onerror="this.style.display=\'none\'">' +
        '<div style="width:1px;height:24px;background:#cbd5e1;flex-shrink:0"></div>' +
        '<span style="color:#1e293b;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          (ana.ragionesociale || '—') +
        '</span>' +
      '</div>' +
      '<button class="scheda-topbar-close" style="background:rgba(0,0,0,.06);color:#475569" onclick="document.getElementById(\'modal-scheda-bg\').remove()">×</button>' +
    '</div>' +
    // Corpo
    '<div class="scheda-body">' + body + '</div>' +
    // Footer
    '<div class="scheda-footer">' +
      '<button onclick="exportAnaToExcel(' + anaIdx + ')" class="btn btn-secondary btn-sm">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        'Esporta Excel' +
      '</button>' +
      '<button onclick="exportSchemaPDF()" class="btn btn-secondary btn-sm">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        'PDF' +
      '</button>' +
      '<button onclick="document.getElementById(\'modal-scheda-bg\').remove()" class="btn btn-primary btn-sm">Chiudi</button>' +
    '</div>';

  document.body.appendChild(overlay);

  // Blocca scroll del body quando la scheda è aperta
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('remove', function() {
    document.body.style.overflow = '';
  });
  // MutationObserver per ripristinare scroll alla chiusura
  var mo = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.removedNodes.forEach(function(n) {
        if (n === overlay) { document.body.style.overflow = ''; mo.disconnect(); }
      });
    });
  });
  mo.observe(document.body, { childList: true });
}


// ============================================
// PDF EXPORT - VERSIONE COMPLETA E GRAFICA
// ============================================
// PDF DA SCREENSHOT - Stampa scheda anagrafica come immagine
async function exportSchemaPDF() {
  console.log('📄 PDF Screenshot v2 - START');
  
  var ana = anaFiltered[currentAnaIdx];
  if (!ana) {
    alert('Anagrafica non trovata');
    return;
  }
  
  // Trova il modal della scheda anagrafica
  var modalBg = document.getElementById('modal-scheda-bg');
  if (!modalBg) {
    alert('Apri prima la scheda anagrafica');
    return;
  }
  
  // Il contenuto della scheda è .scheda-body
  var cardElement = modalBg.querySelector('.scheda-body');
  if (!cardElement) {
    alert('Elemento scheda non trovato');
    return;
  }
  
  console.log('📄 Elemento trovato:', cardElement.tagName, cardElement.style.width);
  
  // Nascondi elementi da NON stampare
  var hideEls = [];
  
  // Nascondi mappa
  var mapEls = cardElement.querySelectorAll('iframe, [id*="map"], [class*="map"]');
  mapEls.forEach(function(el) {
    if (el.style.display !== 'none') {
      hideEls.push({el: el, old: el.style.display});
      el.style.display = 'none';
    }
  });
  
  // Nascondi bottoni (PDF, Excel, Chiudi)
  var btns = cardElement.querySelectorAll('button');
  btns.forEach(function(btn) {
    var txt = btn.textContent || '';
    if (txt.includes('PDF') || txt.includes('Excel') || txt.includes('Chiudi') || txt.includes('Esporta')) {
      hideEls.push({el: btn, old: btn.style.display});
      btn.style.display = 'none';
    }
  });
  
  showLoad('Generazione PDF in corso...');
  
  try {
    // Temporaneamente rendi il card senza max-height per catturare TUTTO
    var oldMaxH = cardElement.style.maxHeight;
    var oldOverflow = cardElement.style.overflow;
    cardElement.style.maxHeight = 'none';
    cardElement.style.overflow = 'visible';
    
    // Cattura con html2canvas
    var canvas = await html2canvas(cardElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: cardElement.scrollWidth,
      height: cardElement.scrollHeight,
      windowWidth: cardElement.scrollWidth,
      windowHeight: cardElement.scrollHeight
    });
    
    // Ripristina stili
    cardElement.style.maxHeight = oldMaxH;
    cardElement.style.overflow = oldOverflow;
    
    console.log('📄 Canvas:', canvas.width, 'x', canvas.height);
    
    // Converti in immagine
    var imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Crea PDF A4
    var { jsPDF } = window.jspdf;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var pw = 210;
    var ph = 297;
    var margin = 5;
    
    // FORZA TUTTO IN 1 PAGINA A4
    var imgW = pw - (margin * 2);
    var imgH = (canvas.height * imgW) / canvas.width;
    
    // Se troppo alto, scala per entrare in 1 pagina
    var maxH = ph - (margin * 2);
    if (imgH > maxH) {
      imgH = maxH;
      imgW = (canvas.width * imgH) / canvas.height;
    }
    
    // Centra orizzontalmente
    var x = (pw - imgW) / 2;
    var y = margin;
    
    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
    
    // LOGO CNA in alto a sinistra (sopra l'immagine, nell'header)
    try {
      var logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise(function(resolve, reject) {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = 'https://customer31551.img.musvc2.net/static/31551/images/1/CNARoma%20NEGATIVO%20COLORE%20SOLO%20ROMA.png';
      });
      
      // Crea canvas per il logo
      var logoCanvas = document.createElement('canvas');
      logoCanvas.width = logoImg.naturalWidth;
      logoCanvas.height = logoImg.naturalHeight;
      var logoCtx = logoCanvas.getContext('2d');
      logoCtx.drawImage(logoImg, 0, 0);
      var logoData = logoCanvas.toDataURL('image/png');
      
      // Logo 30mm x 10mm in alto a sinistra nell'header
      pdf.addImage(logoData, 'PNG', x + 3, y + 3, 30, 10);
      console.log('Logo CNA aggiunto');
    } catch(logoErr) {
      console.warn('Logo non caricato (CORS):', logoErr);
    }
    
    // Salva
    var fname = 'Scheda_' + (ana.ragionesociale || 'impresa').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    pdf.save(fname);
    
    console.log('PDF salvato:', fname);
    
  } catch(e) {
    console.error('Errore PDF:', e);
    alert('Errore generazione PDF: ' + e.message);
  } finally {
    hideLoad();
    
    // Ripristina elementi nascosti
    hideEls.forEach(function(h) {
      h.el.style.display = h.old || '';
    });
  }
}


function exportAnaToExcel(anaIdx) {
  // BLOCCO DOPPIO DI SICUREZZA - Impedisce fughe di dati
  if (!hasPermission('export')) {
    console.error('🚨 TENTATIVO DI EXPORT SENZA PERMESSO! Utente:', session?.email);
    alert('❌ ACCESSO NEGATO: Export dati non autorizzato per il tuo ruolo.\nQuesta azione è stata registrata.');
    return;
  }
  
  var ana = anaFiltered[anaIdx];
  if (!ana) return;
  
  var diretto = allDiretti.find(function(d) { 
    return d.codiceanagrafica && ana.codiceanagrafica && 
           d.codiceanagrafica.toString() === ana.codiceanagrafica.toString(); 
  });
  
  var data = [Object.assign({}, ana, diretto || {})];
  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Anagrafica');
  var ts = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, (ana['Ragione Sociale/Denominazione'] || 'scheda') + '_' + ts + '.xlsx');
  toast('✓ Scheda esportata','success');
}

// ════════════════════════════════════════════════════════════════════════════════
// ARCHIVIO CONTRATTI
// ════════════════════════════════════════════════════════════════════════════════

var allContratti = [];

async function loadContratti() {
  try {
    var loader = G('contratti-loader');
    var content = G('contratti-content');
    var progressFill = G('contratti-progress');
    
    // STEP 1: Carica contratti
    G('contratti-load-msg').textContent = 'Caricamento contratti servizio…';
    G('contratti-status-contratti').querySelector('.ana-sval').textContent = 'Caricamento…';
    progressFill.style.width = '10%';
    
    var resp1 = await fetch(SB + '/rest/v1/contrattiservizio?select=*&datadisdetta=is.null&order=datastipulacontratto.desc', {
      headers: H()
    });
    
    if (!resp1.ok) {
      var errText = await resp1.text();
      throw new Error('Contratti HTTP ' + resp1.status + ': ' + errText);
    }
    
    allContratti = await resp1.json();
    console.log('Contratti caricati:', allContratti.length);
    G('contratti-status-contratti').querySelector('.ana-sval').textContent = allContratti.length + ' caricati';
    progressFill.style.width = '30%';
    
    // STEP 2: Carica anagrafiche
    G('contratti-load-msg').textContent = 'Caricamento anagrafiche…';
    G('contratti-status-anagrafiche').querySelector('.ana-sval').textContent = 'Caricamento…';
    
    var resp2 = await fetch(SB + '/rest/v1/Anagrafiche?select=*', {
      headers: H()
    });
    
    if (!resp2.ok) {
      var errText = await resp2.text();
      throw new Error('Anagrafiche HTTP ' + resp2.status + ': ' + errText);
    }
    
    var anagrafiche = await resp2.json();
    console.log('Anagrafiche caricate:', anagrafiche.length);
    G('contratti-status-anagrafiche').querySelector('.ana-sval').textContent = anagrafiche.length + ' caricate';
    progressFill.style.width = '50%';
    
    // STEP 3: Carica diretti
    G('contratti-load-msg').textContent = 'Caricamento diretti…';
    G('contratti-status-diretti').querySelector('.ana-sval').textContent = 'Caricamento…';
    
    var resp3 = await fetch(SB + '/rest/v1/diretti?select=*', {
      headers: H()
    });
    
    if (!resp3.ok) {
      var errText = await resp3.text();
      throw new Error('Diretti HTTP ' + resp3.status + ': ' + errText);
    }
    
    var diretti = await resp3.json();
    console.log('Diretti caricati:', diretti.length);
    G('contratti-status-diretti').querySelector('.ana-sval').textContent = diretti.length + ' caricati';
    progressFill.style.width = '70%';
    
    // STEP 4: Unificazione
    G('contratti-load-msg').textContent = 'Unificazione dati…';
    G('contratti-status-join').querySelector('.ana-sval').textContent = 'Elaborazione…';
    
    // Crea mappe
    var anaMap = {};
    anagrafiche.forEach(function(a) {
      anaMap[a.codiceanagrafica] = a;
    });
    
    var direttiMap = {};
    diretti.forEach(function(d) {
      if (!direttiMap[d.codiceanagrafica]) {
        direttiMap[d.codiceanagrafica] = [];
      }
      direttiMap[d.codiceanagrafica].push(d);
    });
    
    // Popola servizi dropdown
    var serviziUnique = [];
    allContratti.forEach(function(c) {
      if (c.tipocontratto && serviziUnique.indexOf(c.tipocontratto) === -1) {
        serviziUnique.push(c.tipocontratto);
      }
    });
    serviziUnique.sort();
    
    var select = G('contratti-f-servizio');
    serviziUnique.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
    
    // Crea mappa di imprese UNIQUE con i loro contratti
    var impreseMap = {};
    allContratti.forEach(function(c) {
      var ana = anaMap[c.codicecliente];
      if (ana) {
        if (!impreseMap[c.codicecliente]) {
          // Determina tesseramento una sola volta per impresa
          var tesseramento = 'Non associato';
          var direttiAza = direttiMap[c.codicecliente] || [];
          if (direttiAza.length > 0) {
            var hasIscritto = direttiAza.some(function(d) { return d.servizio && d.servizio.indexOf('Iscritto') !== -1; });
            var hasInps = direttiAza.some(function(d) { return d.servizio && d.servizio.indexOf('INPS') !== -1; });
            
            if (hasIscritto) {
              tesseramento = 'Iscritto';
            } else if (hasInps) {
              tesseramento = 'Tesseramento INPS';
            }
          }
          
          impreseMap[c.codicecliente] = {
            partitaiva: ana.partitaiva,
            ragionesociale: ana.ragionesociale,
            codicecliente: c.codicecliente,
            tesseramento: tesseramento,
            contratti: []
          };
        }
        
        // Aggiungi contratto a questa impresa
        impreseMap[c.codicecliente].contratti.push({
          tipocontratto: c.tipocontratto,
          datastipulacontratto: c.datastipulacontratto,
          nomeconsulente: c.nomeconsulente
        });
      }
    });
    
    // Prepara righe: una riga per ogni impresa con tutti i contratti
    var rows = [];
    var codiciClienti = Object.keys(impreseMap).sort();
    codiciClienti.forEach(function(codiceCliente) {
      var impresa = impreseMap[codiceCliente];
      
      // Raggruppa contratti per tipo
      var tipiContratti = {};
      impresa.contratti.forEach(function(c) {
        if (!tipiContratti[c.tipocontratto]) {
          tipiContratti[c.tipocontratto] = [];
        }
        tipiContratti[c.tipocontratto].push(c);
      });
      
      // Crea una riga per ogni tipo di contratto
      Object.keys(tipiContratti).forEach(function(tipo) {
        var contratti = tipiContratti[tipo];
        var datePiuRecente = contratti.reduce(function(max, c) {
          var d = new Date(c.datastipulacontratto || 0);
          return d > max ? d : max;
        }, new Date(0));
        
        rows.push({
          partitaiva: impresa.partitaiva,
          ragionesociale: impresa.ragionesociale,
          codicecliente: impresa.codicecliente,
          tipocontratto: tipo,
          datastipulacontratto: datePiuRecente.toISOString().split('T')[0],
          nomeconsulente: contratti[0].nomeconsulente || '-',
          tesseramento: impresa.tesseramento,
          countContratti: contratti.length
        });
      });
    });
    
    // Popola tabella
    var tbody = G('contratti-tbody');
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="ana-empty">Nessun contratto trovato</td></tr>';
    } else {
      rows.forEach(function(r) {
        var tr = document.createElement('tr');
        var contrattiInfo = r.countContratti > 1 ? ' (' + r.countContratti + ')' : '';
        tr.innerHTML = '<td>' + (r.partitaiva || '-') + '</td>' +
                      '<td><strong>' + (r.ragionesociale || '-') + '</strong></td>' +
                      '<td>' + (r.codicecliente || '-') + '</td>' +
                      '<td>' + (r.tipocontratto || '-') + contrattiInfo + '</td>' +
                      '<td>' + (r.datastipulacontratto ? new Date(r.datastipulacontratto).toLocaleDateString('it-IT') : '-') + '</td>' +
                      '<td>' + (r.nomeconsulente || '-') + '</td>' +
                      '<td><strong style="color:' + (r.tesseramento === 'Non associato' ? '#999' : '#005CA9') + '">' + r.tesseramento + '</strong></td>';
        tbody.appendChild(tr);
      });
    }
    
    G('contratti-count').textContent = Object.keys(impreseMap).length + ' imprese';
    G('contratti-info-text').textContent = 'Dati caricati e pronti';
    G('contratti-status-join').querySelector('.ana-sval').textContent = 'Completato';
    
    progressFill.style.width = '100%';
    
    // Mostra contenuto dopo 1 secondo
    setTimeout(function() {
      loader.classList.remove('active');
      content.style.display = 'block';
    }, 1000);
    
  } catch(err) {
    console.error('Errore caricamento contratti:', err);
    G('contratti-load-msg').textContent = '❌ Errore: ' + err.message;
    G('contratti-status-contratti').querySelector('.ana-sval').textContent = 'Errore';
  }
}

async function estraiBtnClick() {
  try {
    var serviziFilter = G('contratti-f-servizio').value;
    
    var statusDiv = G('contratti-status');
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#fffacd';
    statusDiv.innerHTML = '⏳ Estrazione in corso...';
    
    var contrattiFiltered = allContratti;
    if (serviziFilter) {
      contrattiFiltered = allContratti.filter(function(c) {
        return c.tipocontratto === serviziFilter;
      });
    }
    
    var anagrafiche = await sbGetAll('Anagrafiche');
    var diretti = await sbGetAll('diretti');
    
    var anaMap = {};
    anagrafiche.forEach(function(a) {
      anaMap[a.codiceanagrafica] = a;
    });
    
    var direttiMap = {};
    diretti.forEach(function(d) {
      if (!direttiMap[d.codiceanagrafica]) {
        direttiMap[d.codiceanagrafica] = [];
      }
      direttiMap[d.codiceanagrafica].push(d);
    });
    
    var rows = [];
    contrattiFiltered.forEach(function(c) {
      var ana = anaMap[c.codicecliente];
      if (ana) {
        var tesseramento = 'Non associato';
        var direttiAza = direttiMap[c.codicecliente] || [];
        if (direttiAza.length > 0) {
          var hasIscritto = direttiAza.some(function(d) { return d.servizio && d.servizio.indexOf('Iscritto') !== -1; });
          var hasInps = direttiAza.some(function(d) { return d.servizio && d.servizio.indexOf('INPS') !== -1; });
          
          if (hasIscritto) {
            tesseramento = 'Iscritto';
          } else if (hasInps) {
            tesseramento = 'Tesseramento INPS';
          }
        }
        
        rows.push({
          partitaiva: ana.partitaiva,
          ragionesociale: ana.ragionesociale,
          codicecliente: c.codicecliente,
          tipocontratto: c.tipocontratto,
          datastipulacontratto: c.datastipulacontratto,
          nomeconsulente: c.nomeconsulente,
          tesseramento: tesseramento
        });
      }
    });
    
    var tbody = G('contratti-tbody');
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="ana-empty">Nessun contratto trovato</td></tr>';
    } else {
      rows.forEach(function(r) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (r.partitaiva || '-') + '</td>' +
                      '<td><strong>' + (r.ragionesociale || '-') + '</strong></td>' +
                      '<td>' + (r.codicecliente || '-') + '</td>' +
                      '<td>' + (r.tipocontratto || '-') + '</td>' +
                      '<td>' + (r.datastipulacontratto ? new Date(r.datastipulacontratto).toLocaleDateString('it-IT') : '-') + '</td>' +
                      '<td>' + (r.nomeconsulente || '-') + '</td>' +
                      '<td><strong style="color:' + (r.tesseramento === 'Non associato' ? '#999' : '#005CA9') + '">' + r.tesseramento + '</strong></td>';
        tbody.appendChild(tr);
      });
    }
    
    G('contratti-count').textContent = rows.length + ' imprese';
    
    statusDiv.style.background = '#d4edda';
    statusDiv.innerHTML = '✅ Elenco estratto: ' + rows.length + ' imprese';
    
  } catch(err) {
    console.error('Errore:', err);
    var statusDiv = G('contratti-status');
    statusDiv.style.background = '#f8d7da';
    statusDiv.innerHTML = '❌ Errore: ' + err.message;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Event listener contratti
  G('contratti-btn-export').addEventListener('click', contrattiExportExcel);
  G('contratti-f-servizio').addEventListener('change', function() {
    contrattiRender();
  });
  G('contratti-selall').addEventListener('change', contrattiToggleAll);
  
  // Delega checkbox righe
  var tbody = G('contratti-tbody');
  if (tbody) {
    tbody.addEventListener('change', function(e) {
      if (e.target.type === 'checkbox' && e.target.className === '' || e.target.classList.contains('contratti-row-chk')) {
        var idx = parseInt(e.target.getAttribute('data-idx'));
        if (!isNaN(idx)) contrattiToggleRow(idx);
      }
    });
  }
  
  var tabContratti = G('tab-contratti');
  if (tabContratti) {
    var checkInterval = setInterval(function() {
      if (tabContratti.style.display !== 'none' && !contrattiLoaded) {
        contrattiLoad();
        clearInterval(checkInterval);
      }
    }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DARK MODE
// ══════════════════════════════════════════════════════════════════════════════

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  var isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('cna_darkmode', isDark ? '1' : '0');
}

function initDarkMode() {
  // Controlla preferenza salvata
  var saved = localStorage.getItem('cna_darkmode');
  if (saved !== null) {
    if (saved === '1') {
      document.body.classList.add('dark-mode');
    }
  } else {
    // Auto-detect da preferenza sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-mode');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORT PDF — Tesseramento | Analisi — Report dettagliato per promotore
// ══════════════════════════════════════════════════════════════════════════════

function generaReportPDF() {
  try {
  if (!allData || allData.length === 0) {
    toast('Nessun dato caricato. Carica prima i dati dal tab "Tesseramento | Andamento".', 'error');
    return;
  }
  var data = getPromoFiltered();
  if (!data || data.length === 0) {
    toast('Nessun dato disponibile per i filtri selezionati', 'error');
    return;
  }

  if (!window.jspdf) {
    toast('Libreria jsPDF non caricata. Riprova tra qualche secondo.', 'error');
    console.error('window.jspdf non disponibile');
    return;
  }

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var W = 297, H = 210;
  var marginL = 15, marginR = 15, marginT = 35, marginB = 15;
  var contentW = W - marginL - marginR;

  // Colori del design
  var cPrimary = [99, 102, 241];     // Indigo
  var cAccent = [236, 72, 153];      // Pink
  var cSuccess = [16, 185, 129];     // Green
  var cWarning = [245, 158, 11];     // Orange
  var cInfo = [6, 182, 212];         // Teal
  var cText = [26, 26, 26];
  var cTextSub = [75, 85, 99];
  var cTextDim = [156, 163, 175];
  var cBg = [245, 247, 250];
  var cWhite = [255, 255, 255];

  // Filtri attivi
  var anF = G('fp-anno').value;
  var meDa = parseInt(G('fp-mese-da').value) || 0;
  var meA = parseInt(G('fp-mese-a').value) || 0;
  var trF = G('fp-tiporete').value;
  var filtroLabel = '';
  if (anF) filtroLabel += 'Anno: ' + anF;
  if (meDa > 0 || meA > 0) {
    var da = meDa > 0 ? MESI[meDa] : 'Gen';
    var a = meA > 0 ? MESI[meA] : 'Dic';
    filtroLabel += (filtroLabel ? ' · ' : '') + da + ' → ' + a;
  }
  if (trF) filtroLabel += (filtroLabel ? ' · ' : '') + 'Rete: ' + trF;
  if (!filtroLabel) filtroLabel = 'Tutti gli anni — Tutti i mesi';

  // Raccogli dati per promotore
  var anniSet = {};
  data.forEach(function(r) { if (r.anno) anniSet[r.anno] = 1; });
  var anni = Object.keys(anniSet).map(Number).sort();

  var promoSet = {};
  data.forEach(function(r) { promoSet[r.promotore] = 1; });
  var promotori = Object.keys(promoSet).sort();

  // Matrix: promotore × anno → {total, count}
  var matrix = {};
  promotori.forEach(function(p) {
    matrix[p] = {};
    anni.forEach(function(a) { matrix[p][a] = { total: 0, count: 0 }; });
  });
  data.forEach(function(r) {
    if (r.anno && matrix[r.promotore] && matrix[r.promotore][r.anno]) {
      matrix[r.promotore][r.anno].total += r.importo;
      matrix[r.promotore][r.anno].count++;
    }
  });

  var totAnno = {};
  anni.forEach(function(a) {
    totAnno[a] = promotori.reduce(function(s, p) { return s + (matrix[p][a] ? matrix[p][a].total : 0); }, 0);
  });

  // Sort promotori per totale desc
  var sortedPromo = promotori.slice().sort(function(a, b) {
    var tA = anni.reduce(function(s, an) { return s + (matrix[a][an] ? matrix[a][an].total : 0); }, 0);
    var tB = anni.reduce(function(s, an) { return s + (matrix[b][an] ? matrix[b][an].total : 0); }, 0);
    return tB - tA;
  });

  // === FUNZIONI HELPER PDF ===
  function drawHeader(doc, pageNum, totalPages) {
    // Barra gradient header
    doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2]);
    doc.rect(0, 0, W, 28, 'F');
    // Accent bar
    doc.setFillColor(cAccent[0], cAccent[1], cAccent[2]);
    doc.rect(0, 28, W, 2, 'F');

    // Logo testo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CNA Roma', marginL, 14);

    // Titolo report
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Tesseramento | Analisi — Report Promotori', marginL, 22);

    // Data e pagina a destra
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('it-IT', {day:'2-digit', month:'long', year:'numeric'}), W - marginR, 10, { align: 'right' });
    doc.text('Pagina ' + pageNum + ' di ' + totalPages, W - marginR, 17, { align: 'right' });
    doc.text('Filtro: ' + filtroLabel, W - marginR, 24, { align: 'right' });
  }

  function drawFooter(doc) {
    doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2]);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('Dashboard CNA Roma v59 — Report generato automaticamente', W / 2, H - 3, { align: 'center' });
  }

  // === PAGINA 1: RIEPILOGO GENERALE ===
  var totalPages = 1 + sortedPromo.length; // 1 riepilogo + 1 per promotore
  drawHeader(doc, 1, totalPages);
  drawFooter(doc);

  var y = marginT + 5;

  // Titolo riepilogo
  doc.setTextColor(cPrimary[0], cPrimary[1], cPrimary[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Riepilogo generale', marginL, y);
  y += 12;

  // KPI strip
  var grandTotal = data.reduce(function(s, r) { return s + r.importo; }, 0);
  var grandCount = data.length;
  var grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;

  var kpis = [
    { label: 'Totale importo', value: '\u20AC ' + fmt(grandTotal, 0), color: cPrimary },
    { label: 'Contratti', value: String(grandCount), color: cAccent },
    { label: 'Media', value: '\u20AC ' + fmt(grandAvg, 0), color: cSuccess },
    { label: 'Promotori', value: String(sortedPromo.length), color: cInfo },
    { label: 'Anni', value: anni.join(', '), color: cWarning }
  ];

  var kpiW = (contentW - 8 * 4) / 5;
  kpis.forEach(function(kpi, i) {
    var x = marginL + i * (kpiW + 8);
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(x, y, kpiW, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(kpi.label.toUpperCase(), x + kpiW / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(kpi.value, x + kpiW / 2, y + 18, { align: 'center' });
  });
  y += 32;

  // Tabella riepilogo promotori
  doc.setTextColor(cText[0], cText[1], cText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Classifica promotori', marginL, y);
  y += 8;

  // Header tabella
  var cols = [
    { label: '#', w: 10, align: 'center' },
    { label: 'Promotore', w: 60, align: 'left' },
    { label: 'Contratti', w: 25, align: 'center' },
    { label: 'Importo totale', w: 40, align: 'right' },
    { label: 'Media', w: 35, align: 'right' },
    { label: '% sul totale', w: 30, align: 'center' }
  ];

  doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2]);
  doc.rect(marginL, y, contentW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  var cx = marginL + 3;
  cols.forEach(function(col) {
    doc.text(col.label, cx + (col.align === 'right' ? col.w - 3 : col.align === 'center' ? col.w / 2 : 0), y + 5.5, { align: col.align });
    cx += col.w;
  });
  y += 8;

  // Righe tabella
  sortedPromo.forEach(function(p, i) {
    if (y > H - marginB - 15) return; // Evita overflow

    var totP = anni.reduce(function(s, a) { return s + (matrix[p][a] ? matrix[p][a].total : 0); }, 0);
    var cntP = anni.reduce(function(s, a) { return s + (matrix[p][a] ? matrix[p][a].count : 0); }, 0);
    var avgP = cntP > 0 ? totP / cntP : 0;
    var pctP = grandTotal > 0 ? (totP / grandTotal * 100) : 0;

    // Background alternato
    if (i % 2 === 0) {
      doc.setFillColor(cBg[0], cBg[1], cBg[2]);
      doc.rect(marginL, y, contentW, 7, 'F');
    }

    doc.setTextColor(cText[0], cText[1], cText[2]);
    doc.setFontSize(9);
    var cx2 = marginL + 3;

    // #
    doc.setFont('helvetica', 'bold');
    doc.text(String(i + 1), cx2 + cols[0].w / 2, y + 5, { align: 'center' });
    cx2 += cols[0].w;

    // Nome
    doc.setFont('helvetica', 'normal');
    doc.text(p.substring(0, 30), cx2, y + 5);
    cx2 += cols[1].w;

    // Contratti
    doc.text(String(cntP), cx2 + cols[2].w / 2, y + 5, { align: 'center' });
    cx2 += cols[2].w;

    // Importo
    doc.setFont('helvetica', 'bold');
    doc.text('\u20AC ' + fmt(totP, 0), cx2 + cols[3].w - 3, y + 5, { align: 'right' });
    cx2 += cols[3].w;

    // Media
    doc.setFont('helvetica', 'normal');
    doc.text('\u20AC ' + fmt(avgP, 0), cx2 + cols[4].w - 3, y + 5, { align: 'right' });
    cx2 += cols[4].w;

    // % bar + testo
    var barW = Math.min(pctP * 0.5, cols[5].w - 12);
    doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2]);
    doc.roundedRect(cx2 + 2, y + 1.5, barW, 4, 1, 1, 'F');
    doc.setTextColor(cTextSub[0], cTextSub[1], cTextSub[2]);
    doc.setFontSize(7);
    doc.text(pctP.toFixed(1) + '%', cx2 + cols[5].w - 2, y + 5, { align: 'right' });

    y += 7;
  });

  // === PAGINE DETTAGLIO PER PROMOTORE ===
  sortedPromo.forEach(function(p, pi) {
    doc.addPage('a4', 'landscape');
    drawHeader(doc, pi + 2, totalPages);
    drawFooter(doc);

    var color = COLORS_PROMO[pi % COLORS_PROMO.length];
    var rgb = hexToRgb(color);

    var yp = marginT + 5;

    // Barra nome promotore
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(marginL, yp, contentW, 16, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(p, marginL + 8, yp + 11);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Promotore #' + (pi + 1) + ' di ' + sortedPromo.length, W - marginR - 5, yp + 11, { align: 'right' });
    yp += 22;

    // KPI del promotore
    var totP = anni.reduce(function(s, a) { return s + (matrix[p][a] ? matrix[p][a].total : 0); }, 0);
    var cntP = anni.reduce(function(s, a) { return s + (matrix[p][a] ? matrix[p][a].count : 0); }, 0);
    var avgP = cntP > 0 ? totP / cntP : 0;
    var pctGlob = grandTotal > 0 ? (totP / grandTotal * 100) : 0;
    var anniAttivi = anni.filter(function(a) { return matrix[p][a] && matrix[p][a].total > 0; }).length;

    var pKpis = [
      { label: 'Importo totale', value: '\u20AC ' + fmt(totP, 0), bg: cPrimary },
      { label: 'Contratti', value: String(cntP), bg: cAccent },
      { label: 'Media contratto', value: '\u20AC ' + fmt(avgP, 0), bg: cSuccess },
      { label: '% sul globale', value: pctGlob.toFixed(1) + '%', bg: cWarning },
      { label: 'Anni attivi', value: String(anniAttivi) + '/' + anni.length, bg: cInfo }
    ];

    var pkW = (contentW - 8 * 4) / 5;
    pKpis.forEach(function(kpi, i) {
      var xk = marginL + i * (pkW + 8);
      doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
      doc.roundedRect(xk, yp, pkW, 20, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(kpi.label.toUpperCase(), xk + pkW / 2, yp + 7, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(kpi.value, xk + pkW / 2, yp + 16, { align: 'center' });
    });
    yp += 28;

    // Tabella dettaglio per anno
    doc.setTextColor(cText[0], cText[1], cText[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dettaglio per anno', marginL, yp);
    yp += 7;

    // Header tabella
    var dCols = [
      { label: 'Anno', w: 30 },
      { label: 'Nr. Contratti', w: 35 },
      { label: 'Importo', w: 45 },
      { label: 'Media', w: 40 },
      { label: '% Anno', w: 30 },
      { label: 'Variazione vs precedente', w: 55 }
    ];

    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(marginL, yp, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    var dcx = marginL + 3;
    dCols.forEach(function(col) {
      doc.text(col.label, dcx, yp + 5.5);
      dcx += col.w;
    });
    yp += 8;

    anni.forEach(function(a, ai) {
      var val = matrix[p][a] ? matrix[p][a].total : 0;
      var cnt = matrix[p][a] ? matrix[p][a].count : 0;
      var avg2 = cnt > 0 ? val / cnt : 0;
      var pctAnno = totAnno[a] > 0 ? (val / totAnno[a] * 100) : 0;

      // Delta
      var deltaText = '–';
      if (ai > 0) {
        var prevA = anni[ai - 1];
        var vPrev = matrix[p][prevA] ? matrix[p][prevA].total : 0;
        if (vPrev > 0 && val > 0) {
          var d = (val - vPrev) / vPrev * 100;
          deltaText = (d > 0 ? '+' : '') + d.toFixed(1) + '%';
        } else if (val > 0 && vPrev === 0) {
          deltaText = 'Nuovo';
        } else if (val === 0 && vPrev > 0) {
          deltaText = 'Assente';
        }
      }

      if (ai % 2 === 0) {
        doc.setFillColor(cBg[0], cBg[1], cBg[2]);
        doc.rect(marginL, yp, contentW, 8, 'F');
      }

      doc.setTextColor(val === 0 ? cTextDim[0] : cText[0], val === 0 ? cTextDim[1] : cText[1], val === 0 ? cTextDim[2] : cText[2]);
      doc.setFontSize(9);

      dcx = marginL + 3;
      doc.setFont('helvetica', 'bold');
      doc.text(String(a), dcx, yp + 5.5);
      dcx += dCols[0].w;

      doc.setFont('helvetica', 'normal');
      doc.text(String(cnt), dcx, yp + 5.5);
      dcx += dCols[1].w;

      doc.setFont('helvetica', 'bold');
      doc.text('\u20AC ' + fmt(val), dcx, yp + 5.5);
      dcx += dCols[2].w;

      doc.setFont('helvetica', 'normal');
      doc.text('\u20AC ' + fmt(avg2, 0), dcx, yp + 5.5);
      dcx += dCols[3].w;

      doc.text(pctAnno.toFixed(1) + '%', dcx, yp + 5.5);
      dcx += dCols[4].w;

      // Delta con colore
      if (deltaText.indexOf('+') === 0) {
        doc.setTextColor(cSuccess[0], cSuccess[1], cSuccess[2]);
      } else if (deltaText.indexOf('-') === 0 || deltaText === 'Assente') {
        doc.setTextColor(cAccent[0], cAccent[1], cAccent[2]);
      } else {
        doc.setTextColor(cTextSub[0], cTextSub[1], cTextSub[2]);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(deltaText, dcx, yp + 5.5);

      yp += 8;
    });

    // Riga totale
    yp += 2;
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(marginL, yp, contentW, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTALE', marginL + 6, yp + 7);
    doc.text(cntP + ' contratti', marginL + dCols[0].w + 3, yp + 7);
    doc.text('\u20AC ' + fmt(totP), marginL + dCols[0].w + dCols[1].w + 3, yp + 7);
    doc.text('\u20AC ' + fmt(avgP, 0) + ' media', marginL + dCols[0].w + dCols[1].w + dCols[2].w + 3, yp + 7);
    yp += 18;

    // Dettaglio per tipo rete (se disponibile)
    var reteData = {};
    data.filter(function(r) { return r.promotore === p; }).forEach(function(r) {
      var rete = r.tiporete || 'N/D';
      if (!reteData[rete]) reteData[rete] = { count: 0, total: 0 };
      reteData[rete].count++;
      reteData[rete].total += r.importo;
    });

    var reti = Object.keys(reteData).sort(function(a, b) { return reteData[b].total - reteData[a].total; });

    if (reti.length > 0 && yp < H - marginB - 40) {
      doc.setTextColor(cText[0], cText[1], cText[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Ripartizione per tipo rete', marginL, yp);
      yp += 7;

      reti.forEach(function(rete, ri) {
        if (yp > H - marginB - 12) return;
        var rd = reteData[rete];
        var pctRete = totP > 0 ? (rd.total / totP * 100) : 0;
        var barMaxW = 120;
        var barFillW = Math.max(2, pctRete * barMaxW / 100);

        if (ri % 2 === 0) {
          doc.setFillColor(cBg[0], cBg[1], cBg[2]);
          doc.rect(marginL, yp, contentW, 8, 'F');
        }

        doc.setTextColor(cText[0], cText[1], cText[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(rete, marginL + 3, yp + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.text('\u20AC ' + fmt(rd.total, 0), marginL + 80, yp + 5.5);
        doc.text(rd.count + ' contr.', marginL + 130, yp + 5.5);

        // Progress bar
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(marginL + 170, yp + 1.5, barMaxW, 4, 1, 1, 'F');
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.roundedRect(marginL + 170, yp + 1.5, barFillW, 4, 1, 1, 'F');

        doc.setTextColor(cTextSub[0], cTextSub[1], cTextSub[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(pctRete.toFixed(1) + '%', marginL + 170 + barMaxW + 5, yp + 5.5);

        yp += 8;
      });
    }
  });

  // Salva PDF
  var ts = new Date().toISOString().slice(0, 10);
  var filename = 'CNA_Report_Promotori_' + ts + '.pdf';
  doc.save(filename);
  toast('✓ Report PDF generato: ' + filename, 'success');
  } catch(err) {
    console.error('Errore generazione PDF:', err);
    toast('Errore generazione PDF: ' + err.message, 'error');
  }
}

// Helper: hex to rgb
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

// INIT
initDarkMode();
if(loadSession())showApp();

// === PROFILO EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', function() {
  // Click su chip utente → apri profilo
  var chip = document.getElementById('user-chip');
  if (chip) chip.addEventListener('click', openProfilo);
  
  // Click su avatar nel modal → apri file picker
  var avatarContainer = document.getElementById('profilo-avatar-container');
  if (avatarContainer) {
    avatarContainer.addEventListener('click', function() {
      document.getElementById('avatar-file-input').click();
    });
  }
  
  // File selezionato → upload
  var fileInput = document.getElementById('avatar-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        uploadAvatar(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
});