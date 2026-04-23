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
G('btn-logout-mob').addEventListener('click',function(){closeDrawer();doLogout();});
G('btn-reset-mob').addEventListener('click',function(){closeDrawer();G('btn-reset').click();});
G('btn-go-admin-mob').addEventListener('click',function(){closeDrawer();showAdminPanel();});
G('file-add-mob').addEventListener('change',function(e){handleFile(e.target.files[0],true);e.target.value='';closeDrawer();});

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
  
  // ⭐ CARICA CCIAA SUBITO
  currentCCIAAData = null;
  try {
    console.log('⏳ Caricamento CCIAA per partita_iva:', ana.partitaiva);
    var cciaaResp = await fetch(SB + '/rest/v1/cciaa?partita_iva=eq.' + encodeURIComponent(ana.partitaiva), {
      headers: H()
    });
    if (cciaaResp.ok) {
      var cciaaResults = await cciaaResp.json();
      if (cciaaResults && cciaaResults.length > 0) {
        currentCCIAAData = cciaaResults[0];
        console.log('✅ CCIAA OK - Stato:', currentCCIAAData.stato_attivita, 'Sub:', currentCCIAAData.num_addetti_sub, 'Fam:', currentCCIAAData.num_addetti_fam_ul);
      }
    }
  } catch(e) {
    console.error('❌ Errore CCIAA:', e);
  }
  var cciaaData = currentCCIAAData;
  
  console.log('=== APERTURA SCHEDA ANAGRAFICA ===');
  console.log('Codiceanagrafica:', ana.codiceanagrafica);
  
  // Query Supabase: carica i dati di questa anagrafica usando fetch (come nel resto dell'app)
  try {
    console.log('Caricamento dati per codiceanagrafica:', ana.codiceanagrafica);
    
    // Usa fetch come le altre funzioni sbGet/sbGetAll
    var dirResp = await fetch(SB + '/rest/v1/diretti?codiceanagrafica=eq.' + encodeURIComponent(ana.codiceanagrafica), {
      headers: H()
    });
    
    if (!dirResp.ok) {
      throw new Error('Errore HTTP ' + dirResp.status);
    }
    
    var diretti = await dirResp.json();
    console.log('Record diretti trovati:', diretti.length, diretti);
    
    // Raccoglie servizi unici, escludendo NON ASSOCIABILE e CONTABILITA'
    var serviziUnique = [];
    diretti.forEach(function(d) {
      var svc = d.servizio ? d.servizio.trim() : '';
      if (svc && svc !== 'NON ASSOCIABILE' && svc !== 'CONTABILITA\'' && serviziUnique.indexOf(svc) === -1) {
        serviziUnique.push(svc);
      }
    });
    console.log('Servizi unici:', serviziUnique);
    
    // Carica schema per pagina di Supabase
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px" id="modal-scheda-bg">';
    html += '<div style="background:var(--surface);border-radius:16px;width:100%;max-width:720px;max-height:85vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.25)">';
    
    // Header con gradient indigo
    html += '<div style="background:linear-gradient(135deg,#005CA9,#003D7A);padding:22px 24px;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between">';
    html += '<img src="https://customer31551.img.musvc2.net/static/31551/images/1/CNARoma%20NEGATIVO%20COLORE%20SOLO%20ROMA.png" alt="CNA" style="height:60px;width:auto">';
    html += '<h2 style="margin:0;color:white;font-size:18px;font-weight:800;text-align:center;flex:1">' + (ana.ragionesociale || "Senza nome") + '</h2>';
    html += '<button onclick="document.getElementById(\'modal-scheda-bg\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:20px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;margin-left:16px;border-radius:8px">×</button>';
    html += '</div>';
    
    // Contenuto
    html += '<div style="padding:25px">';
    
    // SEZIONE 1: DATI ANAGRAFICI
    html += '<div style="margin-bottom:25px">';
    
    // Header con titolo + BOX Stato a destra
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;gap:0">';
    html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.5px">📋 Dati Anagrafici</h3>';
    
    // Contenitore BOX (allineati a destra, attaccati)
    html += '<div style="display:flex;gap:0;align-items:center">';
    
    // BOX STATO ATTIVITÀ
    if (cciaaData && cciaaData.stato_attivita !== null && cciaaData.stato_attivita !== undefined) {
      var statoInfo = traduciStatoAttivita(cciaaData.stato_attivita);
      html += '<div style="background:' + statoInfo.color + ';border-radius:6px 0 0 6px;padding:6px 12px;text-align:center;min-width:100px;flex-shrink:0">';
      html += '<div style="font-size:9px;color:white;font-weight:600;text-transform:uppercase;letter-spacing:0.3px">Stato</div>';
      html += '<div style="font-size:11px;font-weight:700;color:white">' + statoInfo.testo + '</div>';
      html += '</div>';
    }
    
    // BOX TIPO IMPRESA (attaccato a Stato, senza margin)
    if (cciaaData && cciaaData.art_com_tur) {
      var tipoInfo = traduciTipoImpresa(cciaaData.art_com_tur);
      html += '<div style="background:' + tipoInfo.bgColor + ';border-radius:0 6px 6px 0;padding:6px 12px;text-align:center;min-width:110px;flex-shrink:0">';
      html += '<div style="font-size:9px;color:' + tipoInfo.textColor + ';font-weight:600;text-transform:uppercase;letter-spacing:0.3px;opacity:0.9">Tipo</div>';
      html += '<div style="font-size:11px;font-weight:700;color:' + tipoInfo.textColor + '">' + tipoInfo.testo + '</div>';
      html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    
    // Nome e Cognome Titolare - Box sfumata su intera riga
    var nomeCompleto = '';
    if (ana.nometitolare && ana.cognometitolare) {
      nomeCompleto = ana.nometitolare + ' ' + ana.cognometitolare;
    } else if (ana.nometitolare) {
      nomeCompleto = ana.nometitolare;
    } else if (ana.cognometitolare) {
      nomeCompleto = ana.cognometitolare;
    }
    
    if (nomeCompleto) {
      html += '<div style="padding:12px 15px;background:rgba(0,92,169,0.08);border-left:3px solid rgba(0,92,169,0.3);border-radius:4px;margin-bottom:15px">';
      html += '<div style="color:var(--text-secondary);font-size:11px;font-weight:600;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px">Titolare</div>';
      html += '<div style="color:#005CA9;font-weight:700;font-size:14px">' + nomeCompleto + '</div>';
      html += '</div>';
    }
    
    // SEZIONE DIPENDENTI E ADDETTI
    if (currentCCIAAData && (currentCCIAAData.num_addetti_sub || currentCCIAAData.num_addetti_fam_ul)) {
      html += '<div style="margin-bottom:25px;padding:15px;background:#F8F9FA;border-left:3px solid #005CA9;border-radius:4px">';
      html += '<h3 style="color:#005CA9;font-size:13px;font-weight:700;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.5px">👥 Addetti e Dipendenti</h3>';
      
      var addSub = parseInt(currentCCIAAData.num_addetti_sub) || 0;
      var addFam = parseInt(currentCCIAAData.num_addetti_fam_ul) || 0;
      var totale = addSub + addFam;
      
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
      
      html += '<div style="background:white;border:1px solid #D1E0FF;border-radius:6px;padding:10px;text-align:center">';
      html += '<div style="color:#666;font-size:10px;font-weight:600;margin-bottom:5px;text-transform:uppercase">Subordinati</div>';
      html += '<div style="color:#005CA9;font-size:16px;font-weight:700">' + addSub + '</div>';
      html += '</div>';
      
      html += '<div style="background:white;border:1px solid #D1E0FF;border-radius:6px;padding:10px;text-align:center">';
      html += '<div style="color:#666;font-size:10px;font-weight:600;margin-bottom:5px;text-transform:uppercase">Familiari</div>';
      html += '<div style="color:#005CA9;font-size:16px;font-weight:700">' + addFam + '</div>';
      html += '</div>';
      
      html += '<div style="background:#005CA9;border-radius:6px;padding:10px;text-align:center">';
      html += '<div style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:600;margin-bottom:5px;text-transform:uppercase">Totale</div>';
      html += '<div style="color:white;font-size:16px;font-weight:700">' + totale + '</div>';
      html += '</div>';
      
      html += '</div>';
      html += '</div>';
    }
    
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px">';
    
    var fieldsAna = [
      {label: 'Codice', value: ana.codiceanagrafica},
      {label: 'Partita IVA', value: ana.partitaiva},
      {label: 'Indirizzo', value: ana.indirizzo, wide: true},
      {label: 'CAP', value: ana.cap},
      {label: 'Comune', value: ana.comune},
      {label: 'Provincia', value: ana.provincia},
      {label: 'Email', value: ana.email, clickable: 'mailto'},
      {label: 'Telefono', value: ana.telefono, clickable: 'tel'},
      {label: 'Cellulare', value: ana.cellulare, clickable: 'tel'}
    ];
    
    fieldsAna.forEach(function(f) {
      if (f.value) {
        var cellStyle = f.wide ? 'grid-column:1/-1' : '';
        html += '<div style="' + cellStyle + '">';
        html += '<div style="color:var(--text-secondary);font-size:11px;font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">' + f.label + '</div>';
        if (f.clickable === 'tel') {
          html += '<a href="tel:' + f.value + '" style="color:#005CA9;text-decoration:none;cursor:pointer;font-weight:500">📞 ' + f.value + '</a>';
        } else if (f.clickable === 'mailto') {
          html += '<a href="mailto:' + f.value + '" style="color:#005CA9;text-decoration:none;cursor:pointer;font-weight:500">📧 ' + f.value + '</a>';
        } else {
          html += '<div style="color:var(--text);font-weight:500">' + f.value + '</div>';
        }
        html += '</div>';

    
      }
    });
    
    html += '</div></div>';
    
    // SEZIONE 1.5: STATO ASSOCIATIVO (caricato dalla query)
    html += '<div style="margin-bottom:25px;padding-bottom:25px;border-bottom:1px solid #eee">';
    html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:0.5px">🤝 Stato Associativo</h3>';
    
    if (serviziUnique.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr;gap:8px">';
      serviziUnique.forEach(function(s) {
        html += '<div style="padding:10px 15px;background:#f0f7ff;border-left:3px solid #005CA9;border-radius:4px">';
        html += '<div style="color:#333;font-weight:600;font-size:13px">• ' + s + '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="padding:10px 15px;color:#666;font-size:13px;font-weight:500">Nessun servizio associato</div>';
    }
    
    html += '</div>';
    
  } catch(e) {
    console.error('Errore caricamento scheda:', e);
    alert('Errore nel caricamento dei dati');
    return;
  }
  
  // SEZIONE 2: DATI CATEGORIA PROFESSIONALE
  if (ana.mestiere || ana.codicemestiere || ana.unione) {
    html += '<div style="margin-bottom:25px;padding-bottom:25px;border-bottom:1px solid #eee">';
    html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:0.5px">🏢 Categoria Professionale</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px">';
    
    var fieldsMest = [
      {label: 'Mestiere', value: ana.mestiere},
      {label: 'Codice Mestiere', value: ana.codicemestiere},
      {label: 'Unione', value: ana.unione},
      {label: 'Settore', value: ana.settore},
      {label: 'Ateco 2025', value: ana['Ateco 2025'] || ana.codiceateco},
      {label: 'Ateco 2007', value: ana['Ateco 2007']}
    ];
    
    fieldsMest.forEach(function(f) {
      if (f.value) {
        html += '<div>';
        html += '<div style="color:var(--text-secondary);font-size:11px;font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">' + f.label + '</div>';
        html += '<div style="color:var(--text);font-weight:500">' + f.value + '</div>';
        html += '</div>';
      }
    });
    
    html += '</div></div>';
  }
  
  // SEZIONE 3: ASSOCIAZIONI (forme associative - raggruppate per codice)
  var tuttiDiretti = allDiretti.filter(function(d) {
    return d.codiceanagrafica && ana.codiceanagrafica && 
           d.codiceanagrafica.toString() === ana.codiceanagrafica.toString();
  });
  
  console.log('Ana codiceanagrafica:', ana.codiceanagrafica);
  console.log('tuttiDiretti trovati:', tuttiDiretti.length);
  console.log('tuttiDiretti:', tuttiDiretti);
  
  // Raccogli TUTTI i servizi unici (da tutti i record, senza filtro datadisdetta)
  var allServizi = tuttiDiretti.map(function(d) { return d.servizio; })
                               .filter(function(s) { return s && s.trim(); });
  var serviziUnique = [];
  allServizi.forEach(function(s) {
    if (serviziUnique.indexOf(s) === -1) serviziUnique.push(s);
  });
  
  console.log('serviziUnique:', serviziUnique);
  
    // SEZIONE 4: DATI CONTRATTO (caricato dalla query diretti)
    if (diretti && diretti.length > 0) {
      html += '<div style="margin-bottom:15px">';
      html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:0.5px">📝 Dati Contratto' + (diretti.length > 1 ? ' (' + diretti.length + ')' : '') + '</h3>';
      
      // Mostra TUTTI i contratti se ce ne sono più di uno
      diretti.forEach(function(d, idx) {
        if (idx > 0) {
          html += '<hr style="border:none;border-top:1px solid #eee;margin:15px 0">';
        }
        
        // Titolo contratto in box colorata (usa il servizio come titolo)
        var titoloContratto = d.servizio || 'Contratto ' + (idx + 1);
        html += '<div style="padding:10px 15px;background:linear-gradient(135deg,#005CA9,#003D7A);border-radius:8px;margin-bottom:12px">';
        html += '<div style="color:white;font-weight:700;font-size:13px">' + titoloContratto + '</div>';
        html += '</div>';
        
        // Dati essenziali: Data Stipula, Importo, Raggruppamento, Zona
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px">';
        
        var fieldsDir = [
          {label: 'Data Stipula', value: d.datastipula},
          {label: 'Importo', value: d.importo},
          {label: 'Raggruppamento', value: d.raggruppamento},
          {label: 'Zona', value: d.zonacliente}
        ];
        
        fieldsDir.forEach(function(f) {
          if (f.value) {
            html += '<div>';
            html += '<div style="color:var(--text-secondary);font-size:11px;font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">' + f.label + '</div>';
            html += '<div style="color:var(--text);font-weight:500">' + f.value + '</div>';
            html += '</div>';
          }
        });
        
        html += '</div>';
      });
      
      html += '</div>';
    }
  
  // SEZIONE 4.5: CONTRATTI SERVIZIO (da tabella contrattiservizio)
  // Carica contratti usando codicecliente come join key - SOLO quelli ATTIVI (datadisdetta IS NULL)
  try {
    var csResp = await fetch(SB + '/rest/v1/contrattiservizio?codicecliente=eq.' + encodeURIComponent(ana.codiceanagrafica) + '&datadisdetta=is.null&order=datastipulacontratto.desc', {
      headers: H()
    });
    
    if (csResp.ok) {
      var contratti = await csResp.json();
      console.log('Contratti servizio ATTIVI trovati:', contratti.length, contratti);
      
      if (contratti && contratti.length > 0) {
        html += '<div style="margin-bottom:25px">';
        html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:0.5px">📋 Contratti Servizio Attivi' + (contratti.length > 1 ? ' (' + contratti.length + ')' : '') + '</h3>';
        
        contratti.forEach(function(c, idx) {
          if (idx > 0) {
            html += '<hr style="border:none;border-top:1px solid #eee;margin:15px 0">';
          }
          
          // Titolo con tipo contratto
          var titoloCS = c.tipocontratto || 'Contratto Servizio ' + (idx + 1);
          html += '<div style="padding:10px 15px;background:linear-gradient(135deg,#EA580C,#C2410C);border-radius:8px;margin-bottom:12px">';
          html += '<div style="color:white;font-weight:700;font-size:13px">' + titoloCS + '</div>';
          html += '</div>';
          
          // Dati: Data stipula, Nome consulente
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px">';
          
          var fieldsCS = [
            {label: 'Data Stipula Contratto', value: c.datastipulacontratto},
            {label: 'Nome Consulente', value: c.nomeconsulente},
            {label: 'Raggruppamento', value: c.raggruppamento},
            {label: 'Sede Erogazione', value: c.sedeerogazione}
          ];
          
          fieldsCS.forEach(function(f) {
            if (f.value) {
              html += '<div>';
              html += '<div style="color:var(--text-secondary);font-size:11px;font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px">' + f.label + '</div>';
              html += '<div style="color:var(--text);font-weight:500">' + f.value + '</div>';
              html += '</div>';
            }
          });
          
          html += '</div>';
        });
        
        html += '</div>';
      }
    }
  } catch(csErr) {
    console.error('Errore caricamento contratti servizio:', csErr);
  }
  
  // SEZIONE 5: MAPPA
  if (ana.indirizzo || ana.comune) {
    var mapAddress = (ana.indirizzo ? ana.indirizzo + ', ' : '') + 
                     (ana.cap ? ana.cap + ' ' : '') + 
                     (ana.comune ? ana.comune : '') + 
                     (ana.provincia ? ' (' + ana.provincia + ')' : '');
    var mapUrl = 'https://maps.google.com/maps?q=' + encodeURIComponent(mapAddress);
    
    html += '<div style="margin-bottom:25px;padding-bottom:25px;border-bottom:1px solid #eee">';
    html += '<h3 style="color:#005CA9;font-size:14px;font-weight:700;margin:0 0 15px 0;text-transform:uppercase;letter-spacing:0.5px">📍 Localizzazione</h3>';
    html += '<iframe width="100%" height="250" style="border:1px solid #ddd;border-radius:6px;margin-bottom:10px" src="https://maps.google.com/maps?q=' + encodeURIComponent(mapAddress) + '&z=15&output=embed" allowfullscreen="" loading="lazy"></iframe>';
    html += '<div style="font-size:12px;color:#666;line-height:1.6">';
    html += '<div style="font-weight:600;color:#333;margin-bottom:5px">' + mapAddress + '</div>';
    html += '<a href="' + mapUrl + '" target="_blank" style="color:#005CA9;text-decoration:none;font-weight:500">Apri in Google Maps →</a>';
    html += '</div>';
    html += '</div>';
  }
  
  // PULSANTI
  html += '<div style="margin-top:25px;padding-top:15px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end">';
  html += '<button onclick="exportAnaToExcel(' + anaIdx + ')" style="background:linear-gradient(135deg,#005CA9,#003D7A);color:white;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;box-shadow:0 4px 12px rgba(0,92,169,0.3);margin-right:10px" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'translateY(0)\'">📥 Esporta Excel</button>';
  html += '<button onclick="exportSchemaPDF()" style="background:linear-gradient(135deg,#EF4444,#DC2626);color:white;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;box-shadow:0 4px 12px rgba(239,68,68,0.3)" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'translateY(0)\'">📄 Download PDF</button>';
  html += '<button onclick="document.getElementById(\'modal-scheda-bg\').remove()" style="background:var(--surface2);color:var(--text-secondary);border:1px solid var(--border);padding:10px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s" onmouseover="this.style.background=\'var(--surface3)\'" onmouseout="this.style.background=\'var(--surface2)\'">Chiudi</button>';
  html += '</div>';
  
  html += '</div></div></div>';
  
  document.body.insertAdjacentHTML('beforeend', html);
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
  
  // Il contenuto della scheda è il primo figlio div del modal
  var cardElement = modalBg.querySelector('div');
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