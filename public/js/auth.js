async function doLogin(){
  var email=G('inp-email').value.trim().toLowerCase();
  var pwd=G('inp-pwd').value;
  var errEl=G('login-error');
  errEl.style.display='none';
  if(!email||!pwd){
    errEl.textContent='Inserisci email e password';
    errEl.style.display='block';
    return;
  }
  var btn=G('btn-login');
  btn.disabled=true;
  btn.textContent='Accesso in corso…';
  showLoad('Verifica credenziali…');
  try{
    var hash=await sha256hex(pwd);
    // Login tramite Edge Function server-side — cna_users non è mai interrogata dal browser
    var resp=await fetch(SB+'/functions/v1/cna-login',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':KEY},
      body:JSON.stringify({email:email,password_sha256:hash})
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
  
  if(isAdmin()){
    var aa=G('mobile-admin-actions'); if(aa) aa.style.display='flex';
    // Mostra sezione Amministrazione app solo agli admin
    var adminSec=G('sb-admin-section'); if(adminSec) adminSec.style.display='flex';
    // Inizializza il modulo reportistica
    setTimeout(function(){ if(typeof reportisticaInit==='function') reportisticaInit(); }, 500);
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
}

function openProfilo() {
  var modal = G('modal-profilo-bg');
  modal.style.display = 'flex';
  
  var initials = getInitials();
  G('profilo-initials').textContent = initials;
  G('profilo-nome').textContent = session.nome + ' ' + session.cognome;
  G('profilo-email').textContent = session.email;
  G('profilo-ruolo').textContent = session.ruolo;
  
  var img = G('profilo-avatar-img');
  var btnRimuovi = G('btn-rimuovi-avatar');
  if (session.avatar_base64) {
    img.src = session.avatar_base64;
    img.style.display = 'block';
    G('profilo-initials').style.display = 'none';
    btnRimuovi.style.display = 'block';
  } else {
    img.style.display = 'none';
    G('profilo-initials').style.display = 'block';
    btnRimuovi.style.display = 'none';
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