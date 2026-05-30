/* ════════════════════════════════════════════════════════════
   GUIDA CONTESTUALE — Assistente per tab (Livello 1, statico)
   Modulo additivo e auto-contenuto (IIFE): nessuna variabile globale,
   nessuna modifica ai moduli esistenti. Si aggancia al cambio tab.
   ════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ── Icone (inline SVG, stroke=currentColor) ──────────────────
  var ICO = {
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    bulb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>'
  };

  // ── Contenuti per tab ────────────────────────────────────────
  //   do   = "Cosa puoi fare qui"
  //   read = "Spunti da trarre dai dati"
  var GUIDE = {
    'tab-home': {
      title:'Home',
      intro:'Punto di partenza della dashboard: da qui raggiungi tutte le sezioni.',
      do:['Apri una sezione dai pulsanti di navigazione.','Usa questa pagina come hub per orientarti tra le aree.'],
      read:['Parti da <b>Nuovi associati</b> per il quadro d\'insieme, poi scendi nel dettaglio nelle altre tab.']
    },
    'tab-overview': {
      title:'Nuovi associati',
      intro:'Quadro d\'insieme del tesseramento: KPI, andamento e tabelle di riepilogo.',
      do:['Filtra per <b>anno, mese, tipo rete, promotore</b> o "a cura di".','Leggi i KPI principali e il grafico di trend.','Azzera i filtri con il pulsante dedicato per tornare al totale.'],
      read:['Confronta <b>mese su mese</b> per individuare picchi e cali.','Verifica quali <b>tipi di rete</b> stanno crescendo o rallentando.','Un calo improvviso può segnalare contratti in scadenza o un periodo debole da presidiare.']
    },
    'tab-promotori': {
      title:'Analisi nuovi',
      intro:'Andamento del tesseramento letto per singolo promotore, con sparkline mensili.',
      do:['Filtra per <b>periodo</b> (anno, mese da/a) e tipo rete.','Osserva la sparkline di ogni promotore per cogliere il trend.'],
      read:['Individua chi <b>traina</b> i risultati e chi è in <b>calo</b> da più mesi.','Valuta la <b>concentrazione</b>: se pochi promotori fanno gran parte dei numeri, è un rischio da bilanciare.','Promotori in flessione continua meritano un confronto o supporto mirato.']
    },
    'tab-ateco': {
      title:'Unioni e mestieri',
      intro:'Distribuzione delle imprese per mestiere, unione e settore (codici ATECO).',
      do:['Esplora la composizione per <b>mestiere, settore o unione</b>.','Incrocia le categorie per capire dove si concentrano gli associati.'],
      read:['Trova i settori <b>sovra-rappresentati</b> (punti di forza) e quelli <b>scoperti</b> (potenziale di crescita).','Usa i mestieri meno presidiati per orientare campagne di adesione mirate.']
    },
    'tab-raggruppamenti': {
      title:'Raggruppamenti e Zone',
      intro:'Lettura territoriale: imprese e tesseramento per zona e raggruppamento.',
      do:['Visualizza la distribuzione per <b>zona</b> e raggruppamento.','Confronta le aree tra loro.'],
      read:['Individua le <b>zone scoperte</b> dove l\'adesione è bassa.','Decidi dove concentrare promotori o iniziative sul territorio.']
    },
    'tab-anagrafiche': {
      title:'Archivio Imprese',
      intro:'Anagrafica completa delle imprese CNA, con ricerca, filtri, scheda ed export.',
      do:['Cerca/filtra per <b>ragione sociale, P.IVA, comune, ATECO, servizio</b> e altro.','<b>Doppio click</b> su una riga per aprire la scheda impresa completa.','Esporta la selezione in <b>Excel</b> con gli appositi pulsanti.'],
      read:['Cerca imprese <b>con contratto ma non ancora iscritte</b>: sono le più facili da convertire.','Filtra per servizio o mestiere per costruire liste di contatto mirate.','Le imprese senza tesseramento attivo sono candidate al recupero.']
    },
    'tab-contratti': {
      title:'Archivio Contratti',
      intro:'Tutti i contratti, con filtri per tipo, consulente e data, ed export Excel.',
      do:['Filtra per <b>tipo contratto, consulente o data</b> di stipula.','Esporta i risultati filtrati in Excel.'],
      read:['Vedi quali <b>tipi di contratto</b> sono più diffusi.','Le imprese con <b>un solo contratto</b> sono opportunità di cross-selling.','Confronta la distribuzione per consulente per leggere i carichi di lavoro.']
    },
    'tab-incassi': {
      title:'Incassi',
      intro:'Andamento degli incassi nel tempo.',
      do:['Consulta gli incassi per <b>periodo</b>.','Confronta gli intervalli temporali.'],
      read:['Leggi la <b>stagionalità</b>: in quali mesi si incassa di più.','Incrocia incassi e tesseramento per capire se crescono insieme.']
    },
    'tab-consulenti': {
      title:'Gestione Consulenti',
      intro:'Gestione dei consulenti e lettura della loro attività.',
      do:['Gestisci l\'elenco dei consulenti.','Osserva contratti e attività per consulente.'],
      read:['Verifica la <b>distribuzione dei contratti</b> tra i consulenti.','Carichi molto sbilanciati possono indicare dove ridistribuire il lavoro.']
    },
    'tab-storica': {
      title:'Serie storica',
      intro:'Confronto del tesseramento su più anni, per leggere i trend di lungo periodo.',
      do:['Confronta i <b>diversi anni</b> tra loro.','Osserva l\'evoluzione complessiva nel tempo.'],
      read:['Distingui le oscillazioni stagionali da una <b>crescita o calo strutturale</b>.','Usa il dato pluriennale per fissare obiettivi realistici.']
    },
    'tab-reportistica': {
      title:'Reportistica',
      intro:'Generazione di report riepilogativi (sezione riservata).',
      do:['Genera report sui dati di tesseramento e contratti.'],
      read:['Produci report periodici da condividere con la direzione o le unioni.']
    },
    'tab-import': {
      title:'Carica Dati',
      intro:'Caricamento dei dati da file Excel/CSV: anagrafiche, diretti e contratti.',
      do:['Trascina o seleziona il file <b>Excel/CSV</b> per la tabella giusta.','Controlla l\'<b>anteprima</b> e il mapping delle colonne prima di importare.','Avvia l\'importazione: i dati vengono caricati in batch.'],
      read:['Verifica sempre l\'anteprima: un mapping errato delle colonne è la causa più comune di dati sballati.','Carica i file con le <b>intestazioni corrette</b> per evitare righe scartate.']
    }
  };

  var DEFAULT_TAB = 'tab-home';
  var LS_AUTO = 'asst_autoshow';   // '0' = non aprire da solo al cambio tab
  var panelEl, bodyEl, fabEl, titleEl, currentTab = null;

  function autoOn(){ try{ return localStorage.getItem(LS_AUTO) !== '0'; }catch(e){ return true; } }
  function setAuto(v){ try{ localStorage.setItem(LS_AUTO, v ? '1':'0'); }catch(e){} }

  // ── Costruzione HTML del corpo per una tab ───────────────────
  function buildBody(g){
    function list(items){
      return items.map(function(t){ return '<li>'+t+'</li>'; }).join('');
    }
    var h = '<p class="asst-intro">'+g.intro+'</p>';
    if(g.do && g.do.length){
      h += '<div class="asst-sec asst-sec-do">'
         +   '<div class="asst-sec-head"><span class="asst-sec-ico">'+ICO.play+'</span>Cosa puoi fare qui</div>'
         +   '<ul class="asst-list">'+list(g.do)+'</ul>'
         + '</div>';
    }
    if(g.read && g.read.length){
      h += '<div class="asst-sec asst-sec-read">'
         +   '<div class="asst-sec-head"><span class="asst-sec-ico">'+ICO.bulb+'</span>Spunti dai dati</div>'
         +   '<ul class="asst-list">'+list(g.read)+'</ul>'
         + '</div>';
    }
    return h;
  }

  function render(tabId){
    var g = GUIDE[tabId];
    if(!g){ return false; }
    currentTab = tabId;
    titleEl.textContent = g.title;
    bodyEl.innerHTML = buildBody(g);
    bodyEl.scrollTop = 0;
    return true;
  }

  function openPanel(){ panelEl.classList.add('open'); fabEl.classList.remove('has-tip'); }
  function closePanel(){ panelEl.classList.remove('open'); }
  function isOpen(){ return panelEl.classList.contains('open'); }

  // ── Costruzione DOM (una sola volta) ─────────────────────────
  function buildUI(){
    fabEl = document.createElement('button');
    fabEl.id = 'asst-fab';
    fabEl.title = 'Guida della sezione';
    fabEl.setAttribute('aria-label','Apri la guida della sezione');
    fabEl.innerHTML = ICO.spark + '<span class="asst-fab-dot"></span>';
    document.body.appendChild(fabEl);

    panelEl = document.createElement('div');
    panelEl.id = 'asst-panel';
    panelEl.setAttribute('role','dialog');
    panelEl.innerHTML =
      '<div class="asst-head">'
    +   '<div class="asst-head-icon">'+ICO.spark+'</div>'
    +   '<div class="asst-head-txt">'
    +     '<div class="asst-head-kicker">Guida sezione</div>'
    +     '<div class="asst-head-title" id="asst-title">—</div>'
    +   '</div>'
    +   '<button class="asst-close" id="asst-close" aria-label="Chiudi">'+ICO.close+'</button>'
    + '</div>'
    + '<div class="asst-body" id="asst-body"></div>'
    + '<div class="asst-foot">'
    +   '<span class="asst-foot-label">Suggerimenti per questa sezione</span>'
    +   '<label class="asst-foot-toggle"><input type="checkbox" id="asst-auto">Apri da sola</label>'
    + '</div>';
    document.body.appendChild(panelEl);

    bodyEl  = document.getElementById('asst-body');
    titleEl = document.getElementById('asst-title');

    document.getElementById('asst-close').addEventListener('click', closePanel);
    fabEl.addEventListener('click', function(){
      if(isOpen()){ closePanel(); }
      else { if(currentTab) render(currentTab); else render(activeTab()); openPanel(); }
    });

    var autoChk = document.getElementById('asst-auto');
    autoChk.checked = autoOn();
    autoChk.addEventListener('change', function(){ setAuto(this.checked); });
  }

  // ── Tab attiva corrente ──────────────────────────────────────
  function activeTab(){
    var b = document.querySelector('.tab-btn.active[data-tab]');
    return (b && b.getAttribute('data-tab')) || DEFAULT_TAB;
  }

  // ── Aggancio al cambio tab (listener separato, non invasivo) ──
  function wireTabs(){
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var tabId = this.getAttribute('data-tab');
        if(!tabId) return;
        // Rispetta i permessi: se la tab è bloccata, non mostrare nulla
        if(typeof canAccessTab === 'function' && !canAccessTab(tabId)) return;
        // Ritarda leggermente: lascia che il modulo principale faccia lo switch
        setTimeout(function(){
          if(!render(tabId)) return;
          if(autoOn()){ openPanel(); }
          else if(!isOpen()){ fabEl.classList.add('has-tip'); }
        }, 60);
      });
    });
  }

  // ── Init: parte solo dopo il login, quando la tabs-bar è visibile ──
  function init(){
    if(document.getElementById('asst-fab')) return; // già montato
    buildUI();
    wireTabs();
    render(activeTab());
    // Primo avvio: mostra la guida della tab iniziale se l'auto-apertura è attiva
    if(autoOn()){ setTimeout(openPanel, 400); }
    else { fabEl.classList.add('has-tip'); }
  }

  // La tabs-bar viene resa visibile dopo il login. Aspetta che compaia.
  function waitForApp(){
    var wrap = document.getElementById('tabs-bar-wrap');
    var visible = wrap && wrap.style.display !== 'none' && document.querySelectorAll('.tab-btn[data-tab]').length > 0;
    if(visible){ init(); return; }
    var obs = new MutationObserver(function(){
      var w = document.getElementById('tabs-bar-wrap');
      if(w && w.style.display !== 'none' && document.querySelectorAll('.tab-btn[data-tab]').length > 0){
        obs.disconnect();
        init();
      }
    });
    obs.observe(document.body, { attributes:true, childList:true, subtree:true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', waitForApp);
  } else {
    waitForApp();
  }
})();
