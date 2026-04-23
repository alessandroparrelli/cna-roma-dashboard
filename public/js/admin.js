function showAdminPanel(){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  G('upload-zone').style.display='none';
  G('admin-panel').style.display='block';
  G('tabs-bar').style.display='none';
  loadUsers();
  loadLogs();
}

// ADMIN USERS
var modalUserId = null;

async function loadUsers(){
  try{
    var us=await sbGet('cna_users?select=id,nome,cognome,email,ruolo,attivo,last_login&order=created_at.asc');
    var tb=G('users-tbody');
    var cnt=G('users-count');
    if(cnt) cnt.textContent=us.length+' utenti';
    if(!us.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-400)">Nessun utente</td></tr>';return;}
    tb.innerHTML=us.map(function(u){
      var rb=u.ruolo==='admin'?'<span class="badge badge-admin">Admin</span>':'<span class="badge badge-user">Utente</span>';
      var sb=u.attivo?'<span class="badge badge-on">● Attivo</span>':'<span class="badge badge-off">● Inattivo</span>';
      var ll=u.last_login?fmtDate(u.last_login):'<span style="color:var(--gray-400)">Mai</span>';
      var actions='<div class="user-actions">';
      // Cambio password (tutti)
      actions+='<button class="btn btn-sm btn-secondary" onclick="openChangePwd(\''+u.id+'\',\''+escQ(u.nome+' '+u.cognome)+'\')" title="Cambia password"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Pwd</button>';
      if(u.ruolo!=='admin'){
        // Attiva/Disattiva
        if(u.attivo) actions+='<button class="btn btn-sm btn-danger" onclick="toggleU(\''+u.id+'\',false)">Disattiva</button>';
        else actions+='<button class="btn btn-sm btn-primary" onclick="toggleU(\''+u.id+'\',true)">Attiva</button>';
        // Elimina
        actions+='<button class="btn btn-sm btn-danger" onclick="deleteU(\''+u.id+'\',\''+escQ(u.nome+' '+u.cognome)+'\')" title="Elimina utente"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>';
      }
      actions+='</div>';
      return '<tr><td><b>'+escapeHtml(u.nome+' '+u.cognome)+'</b></td><td style="font-size:12px">'+escapeHtml(u.email)+'</td><td>'+rb+'</td><td>'+sb+'</td><td style="font-size:11px;white-space:nowrap">'+ll+'</td><td>'+actions+'</td></tr>';
    }).join('');
    // Aggiorna filtro utenti nei log
    var sel=G('log-filter-user');
    if(sel){
      var prev=sel.value;
      sel.innerHTML='<option value="">Tutti gli utenti</option>';
      us.forEach(function(u){var o=document.createElement('option');o.value=u.email;o.textContent=u.nome+' '+u.cognome;if(u.email===prev)o.selected=true;sel.appendChild(o);});
    }
  }catch(e){toast('Errore utenti','error');console.error(e);}
}

function escQ(s){return escapeHtml(s);}

function fmtDate(iso){
  try{
    var d=new Date(iso);
    return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  }catch(e){return iso;}
}

async function toggleU(id,active){
  try{await sbPatch('cna_users?id=eq.'+id,{attivo:active});toast(active?'Utente attivato':'Utente disattivato','success');loadUsers();}
  catch(e){toast('Errore: '+e.message,'error');}
}

async function deleteU(id, nome){
  if(!confirm('Eliminare definitivamente l\'utente "'+nome+'"?\nQuesta operazione non può essere annullata.')) return;
  showLoad('Eliminazione utente…');
  try{
    await sbDel('cna_users?id=eq.'+id);
    toast('Utente "'+nome+'" eliminato','success');
    loadUsers();
  }catch(e){toast('Errore eliminazione: '+e.message,'error');}
  finally{hideLoad();}
}

function openChangePwd(id, nome){
  modalUserId=id;
  G('modal-user-name').textContent=nome;
  G('modal-new-pwd').value='';
  G('modal-confirm-pwd').value='';
  G('modal-err').style.display='none';
  G('modal-pwd').style.display='flex';
  setTimeout(function(){G('modal-new-pwd').focus();},100);
}

function closeModal(){
  G('modal-pwd').style.display='none';
  modalUserId=null;
}

async function saveNewPwd(){
  var p1=G('modal-new-pwd').value;
  var p2=G('modal-confirm-pwd').value;
  var errEl=G('modal-err');
  errEl.style.display='none';
  if(!p1||!p2){errEl.textContent='Compila entrambi i campi';errEl.style.display='block';return;}
  if(p1.length<6){errEl.textContent='Password minimo 6 caratteri';errEl.style.display='block';return;}
  if(p1!==p2){errEl.textContent='Le password non coincidono';errEl.style.display='block';return;}
  showLoad('Salvataggio password…');
  try{
    var hash=await sha256hex(p1);
    await sbPatch('cna_users?id=eq.'+modalUserId,{password_sha256:hash});
    toast('Password aggiornata con successo','success');
    closeModal();
  }catch(e){
    errEl.textContent='Errore: '+e.message;
    errEl.style.display='block';
  }finally{hideLoad();}
}

async function createUser(){
  var nome=G('u-nome').value.trim(),cognome=G('u-cognome').value.trim();
  var email=G('u-email').value.trim().toLowerCase(),cell=G('u-cell').value.trim(),pwd=G('u-pwd').value;
  var errEl=G('u-err');errEl.style.display='none';
  if(!nome||!cognome||!email||!pwd){errEl.textContent='Compila tutti i campi';errEl.style.display='block';return;}
  if(pwd.length<6){errEl.textContent='Password min. 6 caratteri';errEl.style.display='block';return;}
  showLoad('Creazione utente…');
  try{
    var hash=await sha256hex(pwd);
    await sbPost('cna_users',{nome:nome,cognome:cognome,email:email,cellulare:cell||null,password_sha256:hash,ruolo:'utente',attivo:true},{'Prefer':'return=minimal'});
    toast('Utente '+nome+' '+cognome+' creato!','success');
    G('u-nome').value='';G('u-cognome').value='';G('u-email').value='';G('u-cell').value='';G('u-pwd').value='';
    loadUsers();
  }catch(e){
    errEl.textContent=(e.message.includes('unique')||e.message.includes('duplicate'))?'Email già registrata':'Errore: '+e.message;
    errEl.style.display='block';
  }finally{hideLoad();}
}

// ── LOG CONNESSIONI ──
var logPage=0, logPageSize=50, logTotal=0;

async function writeLog(userId, email, nomeCompleto, esito){
  try{
    var ua=navigator.userAgent||'';
    await sbPost('cna_login_logs',{
      user_id: userId||null,
      email: email,
      nome_completo: nomeCompleto||email,
      esito: esito,
      user_agent: ua.substring(0,200)
    },{'Prefer':'return=minimal'});
  }catch(e){ console.warn('Log write failed',e); }
}

async function loadRuoli(){
  try {
    var users = await sbGet('cna_users?select=id,nome,cognome,email,ruolo,attivo&order=email.asc');
    var tb = G('ruoli-tbody');
    
    if(!users || users.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-dim)">Nessun utente</td></tr>';
      return;
    }
    
    tb.innerHTML = users.map(function(u) {
      var roleBadge = '';
      var roleColor = '';
      
      if(u.ruolo === 'admin') {
        roleBadge = '👨‍💼 Admin';
        roleColor = 'var(--blue)';
      } else if(u.ruolo === 'supervisore') {
        roleBadge = '👤 Supervisore';
        roleColor = 'var(--accent2)';
      } else {
        roleBadge = '👁️ Utente';
        roleColor = 'var(--green)';
      }
      
      var statusBadge = u.attivo 
        ? '<span class="badge badge-on">● Attivo</span>'
        : '<span class="badge badge-off">● Inattivo</span>';
      
      return '<tr style="border-bottom:1px solid var(--border);hover:background:var(--surface2)">' +
        '<td style="padding:10px">' + escapeHtml(u.email) + '</td>' +
        '<td style="padding:10px">' + escapeHtml(u.nome + ' ' + u.cognome) + '</td>' +
        '<td style="padding:10px"><span style="color:' + roleColor + ';font-weight:600">' + roleBadge + '</span></td>' +
        '<td style="padding:10px;text-align:center">' +
        '<select class="role-select" data-user-id="' + u.id + '" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);font-size:11px">' +
        '<option value="admin"' + (u.ruolo === 'admin' ? ' selected' : '') + '>Admin</option>' +
        '<option value="supervisore"' + (u.ruolo === 'supervisore' ? ' selected' : '') + '>Supervisore</option>' +
        '<option value="utente"' + (u.ruolo === 'utente' ? ' selected' : '') + '>Utente</option>' +
        '</select>' +
        '</td></tr>';
    }).join('');
    
    // Attacca event listener ai select
    setTimeout(function() {
      document.querySelectorAll('.role-select').forEach(function(select) {
        select.addEventListener('change', function() {
          var userId = this.getAttribute('data-user-id');
          var newRole = this.value;
          updateUserRole(userId, newRole);
        });
      });
      // Carica i checkbox dei permessi
      loadPermissionsCheckboxes();
    }, 100);
    
  } catch(err) {
    toast('Errore caricamento ruoli: ' + err.message, 'error');
  }
}

async function updateUserRole(id, newRole) {
  try {
    // Verifica che i parametri siano corretti
    if(!id || !newRole) {
      throw new Error('ID o Ruolo mancante. ID=' + id + ', Ruolo=' + newRole);
    }
    
    console.log('updateUserRole: ID=' + id + ', NewRole=' + newRole);
    
    // Costruisci il body correttamente
    var body = { ruolo: newRole };
    
    // Effettua la PATCH
    var url = SB + '/rest/v1/cna_users?id=eq.' + encodeURIComponent(id);
    console.log('PATCH URL:', url);
    console.log('PATCH Body:', JSON.stringify(body));
    
    var resp = await fetch(url, {
      method: 'PATCH',
      headers: H({'Prefer': 'return=minimal'}),
      body: JSON.stringify(body)
    });
    
    console.log('PATCH Response Status:', resp.status);
    
    if (!resp.ok) {
      var errText = '';
      var errJSON = null;
      try {
        errText = await resp.text();
        try {
          errJSON = JSON.parse(errText);
        } catch(e) {}
      } catch(e) {}
      
      console.error('PATCH Error Response:', errText);
      console.error('PATCH Error JSON:', errJSON);
      
      // Se è un errore di constraint
      if(errJSON && errJSON.code === '23514') {
        throw new Error('❌ Il valore "' + newRole + '" non è valido per il ruolo.\n\nVerifica i valori consentiti nel database.\nApri: DIAGNOSTICA_CONSTRAINT_RUOLO.sql in Supabase SQL Editor');
      }
      
      throw new Error('HTTP ' + resp.status + ': ' + (errText || resp.statusText));
    }
    
    toast('✓ Ruolo aggiornato a: ' + newRole, 'success');
    loadRuoli();
  } catch(err) {
    console.error('updateUserRole error:', err);
    toast('❌ Errore: ' + err.message, 'error');
    loadRuoli(); // Ripristina il valore precedente
  }
}

async function loadLogs(){
  try{
    var filterUser=G('log-filter-user')?G('log-filter-user').value:'';
    var filterEsito=G('log-filter-esito')?G('log-filter-esito').value:'';
    var qs='cna_login_logs?select=*&order=created_at.desc';
    if(filterUser) qs+='&email=eq.'+encodeURIComponent(filterUser);
    if(filterEsito) qs+='&esito=eq.'+filterEsito;

    // Count
    var countUrl=SB+'/rest/v1/cna_login_logs?select=id';
    if(filterUser) countUrl+='&email=eq.'+encodeURIComponent(filterUser);
    if(filterEsito) countUrl+='&esito=eq.'+filterEsito;
    var cr_res=await fetch(countUrl,{headers:H({'Prefer':'count=exact','Range':'0-0'})});
    var cr=cr_res.headers.get('content-range');
    logTotal=cr?parseInt(cr.split('/')[1])||0:0;

    // Page
    var from=logPage*logPageSize, to=from+logPageSize-1;
    var rows=await fetch(SB+'/rest/v1/'+qs,{headers:H({'Range':from+'-'+to})}).then(function(r){return r.json();});

    // KPI (all logs, no filter)
    var allStats=await sbGet('cna_login_logs?select=esito,email,nome_completo');
    var totOk=allStats.filter(function(r){return r.esito==='successo';}).length;
    var totFail=allStats.filter(function(r){return r.esito==='fallito';}).length;
    var utentiUnici=new Set(allStats.filter(function(r){return r.esito==='successo';}).map(function(r){return r.email;})).size;
    G('log-kpi-strip').innerHTML=[
      {v:totOk+totFail,l:'Accessi totali',c:'var(--blue)'},
      {v:totOk,l:'Successi',c:'var(--green)'},
      {v:totFail,l:'Falliti',c:'var(--red)'},
      {v:utentiUnici,l:'Utenti distinti',c:'var(--accent3)'}
    ].map(function(k){
      return '<div class="log-kpi"><div class="log-kpi-val" style="color:'+k.c+'">'+k.v+'</div><div class="log-kpi-lbl">'+k.l+'</div></div>';
    }).join('');

    // Table
    var tb=G('logs-tbody');
    if(!rows.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-400)">Nessun accesso registrato</td></tr>';G('log-pagination').innerHTML='';return;}
    tb.innerHTML=rows.map(function(r){
      var badge=r.esito==='successo'?'<span class="log-esito-ok">✓ Successo</span>':'<span class="log-esito-fail">✗ Fallito</span>';
      var ua=parseUA(r.user_agent||'');
      return '<tr><td style="white-space:nowrap;font-size:12px">'+escapeHtml(fmtDate(r.created_at))+'</td><td><b>'+escapeHtml(r.nome_completo||'–')+'</b></td><td style="font-size:12px">'+escapeHtml(r.email)+'</td><td>'+badge+'</td><td style="font-size:11px;color:var(--gray-400)">'+escapeHtml(ua)+'</td></tr>';
    }).join('');

    // Pagination
    var pages=Math.ceil(logTotal/logPageSize);
    var pg=G('log-pagination');
    pg.innerHTML='<span>'+logTotal+' record · Pag. '+(logPage+1)+' di '+pages+'</span><span style="flex:1"></span>';
    if(logPage>0) pg.innerHTML+='<button class="btn btn-sm btn-secondary" onclick="logGoPage('+(logPage-1)+')">‹ Prec.</button>';
    if(logPage<pages-1) pg.innerHTML+='<button class="btn btn-sm btn-secondary" onclick="logGoPage('+(logPage+1)+')">Succ. ›</button>';

  }catch(e){toast('Errore log','error');console.error(e);}
}

function logGoPage(p){logPage=p;loadLogs();}

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function parseUA(ua){
  if(!ua) return '–';
  var browser='Sconosciuto';
  if(ua.includes('Chrome')&&!ua.includes('Edg')) browser='Chrome';
  else if(ua.includes('Firefox')) browser='Firefox';
  else if(ua.includes('Safari')&&!ua.includes('Chrome')) browser='Safari';
  else if(ua.includes('Edg')) browser='Edge';
  var device='Desktop';
  if(/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) device='Mobile';
  else if(/Tablet|iPad/i.test(ua)) device='Tablet';
  return browser+' · '+device;
}

// ══════════════════════════════════════════════
// ANAGRAFICHE MODULE (Data Manager integrato)
// ══════════════════════════════════════════════
var anaAll=[], anaFiltered=[], anaSelected=new Set(), anaLoaded=false, anaLoading=false;
var allDiretti = []; // Caricati da anaLoad per le schede anagrafiche
var ANA_RENDER_LIMIT=500; // rendering paginato client-side per performance
