async function doLogin(){
  var loginId=G('inp-email').value.trim().toLowerCase();
  var pwd=G('inp-pwd').value;
  var errEl=G('login-error');
  errEl.style.display='none';
  if(!loginId||!pwd){
    errEl.textContent='Inserisci email/username e password';
    errEl.style.display='block';
    return;
  }
  var btn=G('btn-login');
  btn.disabled=true;
  btn.textContent='Accesso in corso…';
  showLoad('Verifica credenziali…');
  try{
    var hash=await sha256hex(pwd);
    // Determina se è email o username
    var isEmail = loginId.indexOf('@') !== -1;
    var body = isEmail
      ? {email: loginId, password_sha256: hash}
      : {username: loginId, password_sha256: hash};
    // Login tramite Edge Function server-side
    var resp=await fetch(SB+'/functions/v1/cna-login',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':KEY},
      body:JSON.stringify(body)
    });
    var result=await resp.json();
    if(!resp.ok||!result.user){
      writeLog(null,email,null,'fallito');
      errEl.textContent='Email o password non corretti';
      errEl.style.display='block';
      return;
    }
    var user=result.user;
    writeLog(user.id,email,user.nome+' '+user.cognome,'successo');
    saveSession(user);
    showApp();
  }catch(e){
    console.error('❌ ERRORE LOGIN:',e);
    errEl.textContent='Errore di connessione. Riprova.';
    errEl.style.display='block';
  }
  finally{
    hideLoad();
    btn.disabled=false;
    btn.textContent='Accedi';
    console.log('✅ Login process finito');
  }
}
function doLogout(){clearSession();location.reload();}

// ══════════════════════════════════════════════════════════════════════════════
// RICHIESTA PASSWORD D'ACCESSO (dalla schermata di login)
// ══════════════════════════════════════════════════════════════════════════════

function openRichiestaAccesso(){
  G('ra-nome').value='';
  G('ra-cognome').value='';
  G('ra-cellulare').value='';
  G('ra-email').value='';
  var errEl=G('richiesta-accesso-error');
  errEl.style.display='none';
  errEl.textContent='';
  G('modal-richiesta-accesso-bg').style.display='flex';
}

function closeRichiestaAccesso(){
  G('modal-richiesta-accesso-bg').style.display='none';
}

async function inviaRichiestaAccesso(){
  var nome=G('ra-nome').value.trim();
  var cognome=G('ra-cognome').value.trim();
  var cellulare=G('ra-cellulare').value.trim();
  var email=G('ra-email').value.trim().toLowerCase();
  var errEl=G('richiesta-accesso-error');
  errEl.style.display='none';

  if(!nome||!cognome||!cellulare||!email){
    errEl.textContent='Compila tutti i campi';
    errEl.style.display='block';
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    errEl.textContent='Inserisci un indirizzo email valido';
    errEl.style.display='block';
    return;
  }

  var btn=G('btn-invia-richiesta-accesso');
  btn.disabled=true;
  btn.textContent='Invio in corso…';

  try{
    var resp=await fetch(SB+'/functions/v1/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':KEY},
      body:JSON.stringify({type:'richiesta_accesso',nome:nome,cognome:cognome,cellulare:cellulare,email:email})
    });
    var result=await resp.json();
    if(!resp.ok){
      throw new Error(result.error||'Errore invio richiesta');
    }
    closeRichiestaAccesso();
    toast('Richiesta inviata! Riceverai le credenziali via email.','success');
  }catch(e){
    console.error('❌ ERRORE RICHIESTA ACCESSO:',e);
    errEl.textContent='Errore durante l\'invio. Riprova più tardi.';
    errEl.style.display='block';
  }finally{
    btn.disabled=false;
    btn.textContent='Invia richiesta';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GESTIONE PERMESSI (Admin Panel)
// ══════════════════════════════════════════════════════════════════════════════

// Permessi default per ogni ruolo
var defaultPermissions = {
  admin: {carica: true, interroga: true, export: true, admin: true},
  supervisore: {carica: false, interroga: true, export: true, admin: false},
  utente: {carica: false, interroga: true, export: false, admin: false},
  commerciale: {carica: false, interroga: true, export: true, admin: false},
  operatore: {carica: true, interroga: false, export: false, admin: false}
};

// Carica permessi dal localStorage
function loadPermissionsCheckboxes() {
  // Carica i permessi nei CHECKBOX del pannello admin
  var saved = localStorage.getItem('cna_permissions');
  if (saved) {
    var perms = JSON.parse(saved);
    // Applica i permessi ai checkbox
    document.getElementById('perm-super-interroga').checked = perms.supervisore?.interroga ?? true;
    document.getElementById('perm-super-carica').checked = perms.supervisore?.carica ?? false;
    document.getElementById('perm-super-admin').checked = perms.supervisore?.admin ?? false;
    
    document.getElementById('perm-user-interroga').checked = perms.utente?.interroga ?? false;
    document.getElementById('perm-user-carica').checked = perms.utente?.carica ?? false;
    document.getElementById('perm-user-admin').checked = perms.utente?.admin ?? false;
  }
}

function loadUserPermissions() {
  // Carica i permessi per l'UTENTE CORRENTE e aggiorna UI
  console.log('🔐 ==================== INIZIO CARICAMENTO PERMESSI ====================');
  console.log('🔐 Session:', session);
  console.log('🔐 Ruolo utente:', session?.ruolo);
  console.log('🔐 hasPermission("export"):', hasPermission('export'));
  console.log('🔐 updateUIPermissions() - calling...');
  updateUIPermissions();
  console.log('🔐 ==================== FINE CARICAMENTO PERMESSI ====================');
}

// Salva permessi nel localStorage
function savePermissions() {
  var perms = {
    admin: {carica: true, interroga: true, admin: true},
    supervisore: {
      interroga: document.getElementById('perm-super-interroga').checked,
      carica: document.getElementById('perm-super-carica').checked,
      admin: false
    },
    utente: {
      interroga: document.getElementById('perm-user-interroga').checked,
      carica: document.getElementById('perm-user-carica').checked,
      admin: false
    }
  };
  localStorage.setItem('cna_permissions', JSON.stringify(perms));
  console.log('💾 Permessi salvati:', perms);
  loadUserPermissions(); // Ricarica i permessi per l'utente e aggiorna UI
}

// Verifica se l'utente ha permesso per una funzione
function hasPermission(feature) {
  if (!session) {
    console.warn('❌ Session non trovata');
    return false;
  }
  var perms = localStorage.getItem('cna_permissions');
  console.log('📋 Permessi nel localStorage:', perms);
  var permObj = perms ? JSON.parse(perms) : defaultPermissions;
  console.log('📋 Ruolo utente:', session.ruolo);
  console.log('📋 permObj[ruolo]:', permObj[session.ruolo.toLowerCase()]);
  var rolePerms = permObj[session.ruolo.toLowerCase()] || {};
  console.log('📋 Permesso richiesto:', feature, '→', rolePerms[feature]);
  return rolePerms[feature] !== false; // Default: true se non trovato
}

// Applica restrizione di export basata su permessi
function checkExportPermission() {
  if (!hasPermission('export')) {
    alert('Export dati non autorizzato per il tuo ruolo');
    return false;
  }
  return true;
}

// Aggiorna visibilità bottoni in base ai permessi
function updateUIPermissions() {
  // Controlla il permesso per le sezioni interroga e carica
  console.log('🔐 Permessi aggiornati per utente:', session?.ruolo);
}

function showApp(){
  G('login-page').style.display='none';
  G('app').style.display='block';
  
  G('chip-name').textContent=session.nome||session.cognome||'–';
  
  // Avatar nel chip
  updateChipAvatar();
  
  // Header drawer: nome, ruolo, avatar
  var dName = G('drawer-user-name'); if(dName) dName.textContent = (session.nome||'') + ' ' + (session.cognome||'');
  var dRole = G('drawer-user-role'); if(dRole) dRole.textContent = (session.ruolo||'').charAt(0).toUpperCase() + (session.ruolo||'').slice(1);
  // Avatar nel drawer
  var dAvImg  = G('drawer-avatar-img');
  var dAvInit = G('drawer-avatar-initials');
  if(dAvImg && dAvInit){
    if(session.avatar_base64){
      dAvImg.src = session.avatar_base64; dAvImg.style.display='block'; dAvInit.style.display='none';
    } else {
      var ini = ((session.nome||'').charAt(0) + (session.cognome||'').charAt(0)).toUpperCase() || '?';
      dAvInit.textContent = ini; dAvInit.style.display='block'; dAvImg.style.display='none';
    }
  }

  if(isAdmin()){
    var aa=G('mobile-admin-actions'); if(aa) aa.style.display='flex';
    // Mostra sezione Amministrazione app solo agli admin
    var adminSec=G('sb-admin-section'); if(adminSec) adminSec.style.display='flex';
    // Inizializza il modulo reportistica
    setTimeout(function(){ if(typeof reportisticaInit==='function') reportisticaInit(); }, 500);
  }
  // Obiettivi: visibile ad admin e supervisore
  if(isAdmin() || isSupervisore()){
    var obBtn = G('sb-obiettivi-btn'); if(obBtn) obBtn.style.display='flex';
  }
  
  // Export solo per admin e supervisore
  var canExport = isAdmin() || isSupervisore();
  setTimeout(function(){
    var exportBtns = ['ana-btn-export', 'contratti-btn-export'];
    exportBtns.forEach(function(id){
      var btn = G(id);
      if(btn) btn.style.display = canExport ? 'inline-flex' : 'none';
    });
    var exportWrapper = G('ana-export-wrapper');
    if(exportWrapper) exportWrapper.style.display = canExport ? 'block' : 'none';
  }, 100);
  
  loadUserPermissions();
  syncMobileAdmin();
  loadDashboard();
}

// === AVATAR / PROFILO ===

function getInitials() {
  var n = (session.nome || '').charAt(0).toUpperCase();
  var c = (session.cognome || '').charAt(0).toUpperCase();
  return n + c || '–';
}

function updateChipAvatar() {
  var initials = getInitials();
  G('chip-initials').textContent = initials;
  
  var img = G('chip-avatar-img');
  if (session.avatar_base64) {
    img.src = session.avatar_base64;
    img.style.display = 'block';
    G('chip-initials').style.display = 'none';
  } else {
    img.style.display = 'none';
    G('chip-initials').style.display = 'block';
  }
  // Aggiorna anche avatar nel drawer
  var dAvImg  = G('drawer-avatar-img');
  var dAvInit = G('drawer-avatar-initials');
  if(dAvImg && dAvInit){
    if(session.avatar_base64){
      dAvImg.src = session.avatar_base64; dAvImg.style.display='block'; dAvInit.style.display='none';
    } else {
      dAvInit.textContent = initials; dAvInit.style.display='block'; dAvImg.style.display='none';
    }
  }
}

function openProfilo() {
  var modal = G('modal-profilo-bg');
  modal.style.display = 'flex';

  var initials = getInitials();

  // Avatar
  G('profilo-initials').textContent = initials;
  var img = G('profilo-avatar-img');
  if (session.avatar_base64) {
    img.src = session.avatar_base64; img.style.display = 'block';
    G('profilo-initials').style.display = 'none';
    G('btn-rimuovi-avatar').style.display = 'flex';
  } else {
    img.style.display = 'none';
    G('profilo-initials').style.display = 'block';
    G('btn-rimuovi-avatar').style.display = 'none';
  }

  // Nome display nell'header
  var nomeDisplay = ((session.nome||'') + ' ' + (session.cognome||'')).trim();
  var nd = G('profilo-nome-display'); if(nd) nd.textContent = nomeDisplay || '—';
  var rd = G('profilo-ruolo-display'); if(rd) rd.textContent = (session.ruolo||'');

  // Popola form
  var inp = function(id){ return document.getElementById(id); };
  if(inp('profilo-input-nome'))     inp('profilo-input-nome').value     = session.nome     || '';
  if(inp('profilo-input-cognome'))  inp('profilo-input-cognome').value  = session.cognome  || '';
  if(inp('profilo-input-email'))    inp('profilo-input-email').value    = session.email    || '';
  if(inp('profilo-input-username'))  inp('profilo-input-username').value  = session.username  || '';
  if(inp('profilo-input-telefono')) inp('profilo-input-telefono').value = session.cellulare || '';

  if(inp('profilo-ruolo'))          inp('profilo-ruolo').value          = session.ruolo    || '';
  if(inp('profilo-input-password'))  inp('profilo-input-password').value  = '';
  if(inp('profilo-input-password2')) inp('profilo-input-password2').value = '';

  // Nascondi messaggio
  var msg = G('profilo-msg'); if(msg){ msg.style.display='none'; msg.textContent=''; }

  // Compat vecchio codice
  if(G('profilo-nome'))  G('profilo-nome').textContent  = nomeDisplay;
  if(G('profilo-email')) G('profilo-email').textContent = session.email || '';
}

async function salvaProfiloUtente() {
  var inp = function(id){ return (document.getElementById(id)||{}).value || ''; };
  var nome     = inp('profilo-input-nome').trim();
  var cognome  = inp('profilo-input-cognome').trim();
  var email    = inp('profilo-input-email').trim();
  var username  = inp('profilo-input-username').trim().toLowerCase().replace(/\s+/g,'');
  var cellulare = inp('profilo-input-telefono').trim();
  var pwd      = inp('profilo-input-password');
  var pwd2     = inp('profilo-input-password2');

  var msg = G('profilo-msg');
  function showMsg(text, ok) {
    msg.style.display = 'block';
    msg.style.background = ok ? '#f0fdf4' : '#fef2f2';
    msg.style.color = ok ? '#16a34a' : '#dc2626';
    msg.style.border = '1px solid ' + (ok ? '#bbf7d0' : '#fecaca');
    msg.textContent = text;
  }

  if (!nome || !cognome) { showMsg('Nome e cognome sono obbligatori.', false); return; }
  if (!email)            { showMsg('Email obbligatoria.', false); return; }
  if (pwd && pwd !== pwd2) { showMsg('Le password non coincidono.', false); return; }
  if (pwd && pwd.length < 6) { showMsg('La password deve essere di almeno 6 caratteri.', false); return; }

  showLoad('Salvataggio in corso…');
  try {
    var patch = { nome: nome, cognome: cognome, email: email, cellulare: cellulare, username: username || null };

    // Hash SHA-256 della password se fornita
    if (pwd) {
      var encoder = new TextEncoder();
      var data = encoder.encode(pwd);
      var hashBuffer = await crypto.subtle.digest('SHA-256', data);
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      var hashHex = hashArray.map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      patch.password_sha256 = hashHex;
    }

    await sbPatch('cna_users?id=eq.' + session.id, patch);

    // Aggiorna sessione locale
    session.nome = nome; session.cognome = cognome;
    session.email = email; session.cellulare = cellulare; session.username = username || '';
    saveSession(session);

    // Aggiorna UI
    updateChipAvatar();
    openProfilo();

    showMsg('✓ Profilo aggiornato con successo!', true);
    toast('Profilo aggiornato', 'success');
  } catch(e) {
    showMsg('Errore: ' + e.message, false);
  } finally {
    hideLoad();
  }
}

async function uploadAvatar(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Seleziona un file immagine', 'error');
    return;
  }
  
  if (file.size > 500000) {
    toast('Immagine troppo grande (max 500KB)', 'error');
    return;
  }
  
  showLoad('Caricamento foto...');
  
  try {
    var reader = new FileReader();
    var base64 = await new Promise(function(resolve, reject) {
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    // Ridimensiona a 200x200 max
    var resized = await resizeImage(base64, 200);
    
    // Salva in Supabase
    await sbPatch('cna_users?id=eq.' + session.id, { avatar_base64: resized });
    
    // Aggiorna session
    session.avatar_base64 = resized;
    saveSession(session);
    
    // Aggiorna UI
    updateChipAvatar();
    openProfilo();
    
    toast('Foto profilo aggiornata!', 'success');
  } catch(e) {
    console.error('Errore upload avatar:', e);
    toast('Errore caricamento foto', 'error');
  } finally {
    hideLoad();
  }
}

function resizeImage(base64, maxSize) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var w = img.width;
      var h = img.height;
      
      if (w > h) {
        if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
      } else {
        if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
      }
      
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = base64;
  });
}

async function rimuoviAvatar() {
  showLoad('Rimozione foto...');
  try {
    await sbPatch('cna_users?id=eq.' + session.id, { avatar_base64: null });
    session.avatar_base64 = null;
    saveSession(session);
    updateChipAvatar();
    openProfilo();
    toast('Foto profilo rimossa', 'success');
  } catch(e) {
    toast('Errore rimozione foto', 'error');
  } finally {
    hideLoad();
  }
}

// DASHBOARD LOAD — senza limite