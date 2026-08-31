const { createClient } = supabase;
const sb = createClient(window.MAILLE_CONFIG.SUPABASE_URL, window.MAILLE_CONFIG.SUPABASE_ANON_KEY);

const STAGES = ['Coupe', 'Couture', 'Finition', 'Expedition', 'Cloture'];
const STAGE_LABELS = {
  Coupe: 'Coupe',
  Couture: 'Couture',
  Finition: 'Finition',
  Expedition: 'Expédition',
  Cloture: 'Clôturé'
};

let authMode = 'signup'; // 'signup' | 'login'
let currentProfile = null;

function toggleAuthMode() {
  authMode = authMode === 'signup' ? 'login' : 'signup';
  const isSignup = authMode === 'signup';
  document.getElementById('authTitle').textContent = isSignup ? 'Créer un compte' : 'Se connecter';
  document.getElementById('signupFields').classList.toggle('hidden', !isSignup);
  document.getElementById('authSubmit').textContent = isSignup ? 'Créer mon compte' : 'Se connecter';
  document.getElementById('authSwitchText').textContent = isSignup ? 'Déjà un compte ?' : "Pas encore de compte ?";
  document.getElementById('authSwitchLink').textContent = isSignup ? 'Se connecter' : 'Créer un compte';
  clearAuthMessages();
}

function clearAuthMessages() {
  document.getElementById('authError').classList.add('hidden');
  document.getElementById('authInfo').classList.add('hidden');
}
function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function showAuthInfo(msg) {
  const el = document.getElementById('authInfo');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function handleAuthSubmit() {
  clearAuthMessages();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showAuthError('E-mail et mot de passe requis.');
    return;
  }

  if (authMode === 'signup') {
    const factoryName = document.getElementById('factoryName').value.trim();
    if (!factoryName) {
      showAuthError("Le nom de l'usine / entreprise est requis.");
      return;
    }
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { factory_name: factoryName } }
    });
    if (error) { showAuthError(error.message); return; }
    if (data.session) {
      await onLoggedIn();
    } else {
      showAuthInfo("Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.");
    }
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { showAuthError(error.message); return; }
    await onLoggedIn();
  }
}

async function logout() {
  await sb.auth.signOut();
  currentProfile = null;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('whoami').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

async function onLoggedIn() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, full_name, role, org_id, organizations(name)')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    showAuthError("Impossible de charger le profil. Réessaie dans quelques secondes.");
    return;
  }

  currentProfile = profile;
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('whoami').classList.remove('hidden');
  document.getElementById('whoamiName').textContent =
    (profile.organizations && profile.organizations.name) || user.email;

  await loadClients();
  await loadStyles();
}

async function createStyle() {
  const ref = document.getElementById('newRef').value.trim();
  const name = document.getElementById('newName').value.trim();
  const clientId = document.getElementById('newClientSelect').value;
  const date = document.getElementById('newDate').value;
  const errorEl = document.getElementById('styleFormError');
  errorEl.classList.add('hidden');

  if (!ref || !name) {
    alert('Référence et nom du style sont requis.');
    return;
  }
  if (!clientId) {
    errorEl.textContent = "Sélectionne un client existant, ou ajoute-le d'abord dans ton portefeuille clients ci-dessus.";
    errorEl.classList.remove('hidden');
    return;
  }

  const { error } = await sb.from('styles').insert({
    org_id: currentProfile.org_id,
    style_ref: ref,
    style_name: name,
    client_id: clientId,
    target_date: date || null,
    created_by: currentProfile.id
  });

  if (error) {
    alert("Erreur lors de la création : " + error.message);
    return;
  }

  document.getElementById('newRef').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newClientSelect').value = '';
  document.getElementById('newDate').value = '';
  await loadStyles();
}

async function updateStage(id, newStage) {
  await sb.from('styles').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', id);
  await loadStyles();
}

async function closeStyle(id) {
  await sb.from('styles').update({ stage: 'Cloture', updated_at: new Date().toISOString() }).eq('id', id);
  await loadStyles();
}

async function deleteStyle(id) {
  if (!confirm('Supprimer ce style ?')) return;
  await sb.from('styles').delete().eq('id', id);
  await loadStyles();
}

async function loadStyles() {
  const { data: styles, error } = await sb
    .from('styles')
    .select('*, clients(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  renderBoard(styles || []);
  await refreshOverview();
}

function renderBoard(styles) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  STAGES.forEach(stage => {
    const items = styles.filter(s => s.stage === stage);
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `<div class="col-head"><span>${STAGE_LABELS[stage]}</span><span>${items.length}</span></div>`;

    if (items.length === 0) {
      col.innerHTML += `<div class="empty">Vide</div>`;
    }

    items.forEach(s => {
      const clientName = s.clients ? s.clients.name : (s.client || null);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="badge ${s.status}">${badgeLabel(s.status)}</div>
        <div class="style-ref">${escapeHtml(s.style_ref)}</div>
        <div class="style-name">${escapeHtml(s.style_name)}</div>
        <div class="client">${clientName ? escapeHtml(clientName) : '—'}${s.target_date ? ' · ' + s.target_date : ''}</div>
        <select onchange="updateStage('${s.id}', this.value)">
          ${STAGES.map(st => `<option value="${st}" ${st === s.stage ? 'selected' : ''}>${STAGE_LABELS[st]}</option>`).join('')}
        </select>
        <div class="card-actions">
          <button class="btn secondary small" onclick="closeStyle('${s.id}')">Fermer</button>
          <button class="btn secondary small" onclick="deleteStyle('${s.id}')">Suppr.</button>
        </div>
        <button class="btn tna-open" onclick="openTna('${s.id}', '${escapeHtml(s.style_ref)}', '${escapeHtml(s.style_name)}')">Calendrier TNA</button>
      `;
      col.appendChild(card);
    });

    board.appendChild(col);
  });
}

function badgeLabel(status) {
  if (status === 'late') return 'RETARD';
  if (status === 'risk') return 'À RISQUE';
  return 'DANS LES TEMPS';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let currentTnaStyleId = null;

async function openTna(styleId, ref, name) {
  currentTnaStyleId = styleId;
  document.getElementById('tnaModalSub').textContent = `${ref} — ${name}`;
  document.getElementById('tnaModal').classList.remove('hidden');
  await loadTnaSteps(styleId);
}

function closeTna() {
  document.getElementById('tnaModal').classList.add('hidden');
  currentTnaStyleId = null;
}

async function loadClients() {
  const { data: clients, error } = await sb
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) { console.error(error); return; }
  renderClientList(clients || []);
  renderClientSelect(clients || []);
}

function renderClientList(clients) {
  const list = document.getElementById('clientList');
  if (clients.length === 0) {
    list.innerHTML = `<div class="empty">Aucun client dans ton portefeuille pour l'instant.</div>`;
    return;
  }
  list.innerHTML = clients.map(c => `
    <div class="client-row">
      <div>
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="meta">${c.contact_name ? escapeHtml(c.contact_name) : ''}${c.contact_email ? ' · ' + escapeHtml(c.contact_email) : ''}</div>
      </div>
      <div class="actions">
        <button class="btn secondary small" onclick="editClient('${c.id}', '${escapeHtml(c.name)}')">Renommer</button>
        <button class="btn secondary small" onclick="deleteClient('${c.id}')">Suppr.</button>
      </div>
    </div>
  `).join('');
}

function renderClientSelect(clients) {
  const select = document.getElementById('newClientSelect');
  const current = select.value;
  select.innerHTML = `<option value="">— Sélectionner un client —</option>` +
    clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (clients.some(c => c.id === current)) select.value = current;
}

async function createClientFunc() {
  const name = document.getElementById('newClientName').value.trim();
  const contact = document.getElementById('newClientContact').value.trim();
  const email = document.getElementById('newClientEmail').value.trim();

  if (!name) {
    alert('Le nom du client est requis.');
    return;
  }

  const { error } = await sb.from('clients').insert({
    org_id: currentProfile.org_id,
    name,
    contact_name: contact || null,
    contact_email: email || null
  });

  if (error) {
    alert("Erreur lors de la création du client : " + error.message);
    return;
  }

  document.getElementById('newClientName').value = '';
  document.getElementById('newClientContact').value = '';
  document.getElementById('newClientEmail').value = '';
  await loadClients();
}

async function editClient(id, oldName) {
  const newName = prompt('Nouveau nom du client :', oldName);
  if (newName === null || newName.trim() === '' || newName === oldName) return;
  const { error } = await sb.from('clients')
    .update({ name: newName.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { alert("Erreur : " + error.message); return; }
  await loadClients();
  await loadStyles();
}

async function deleteClient(id) {
  if (!confirm('Supprimer ce client ? Les commandes déjà liées resteront mais perdront ce lien.')) return;
  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) { alert("Erreur : " + error.message); return; }
  await loadClients();
  await loadStyles();
}

async function loadTnaSteps(styleId) {
  const { data: steps, error } = await sb
    .from('tna_steps')
    .select('*')
    .eq('style_id', styleId)
    .order('step_order', { ascending: true });

  if (error) {
    document.getElementById('tnaModalBody').innerHTML =
      `<div class="error-msg">Erreur de chargement : ${escapeHtml(error.message)}</div>`;
    return;
  }
  renderTnaSteps(steps || []);
}

function renderTnaSteps(steps) {
  const body = document.getElementById('tnaModalBody');
  if (steps.length === 0) {
    body.innerHTML = `<div class="empty">Aucune étape trouvée pour cette commande.</div>`;
    return;
  }
  body.innerHTML = steps.map(step => `
    <div class="tna-row">
      <div class="step-label">${escapeHtml(step.step_name)}</div>
      <div>
        <label>Date prévue</label>
        <input type="date" value="${step.planned_date || ''}"
          onchange="updateTnaStep('${step.id}', 'planned_date', this.value)">
      </div>
      <div>
        <label>Date réelle</label>
        <input type="date" value="${step.actual_date || ''}"
          onchange="updateTnaStep('${step.id}', 'actual_date', this.value)">
      </div>
      <div>
        <label>Statut</label>
        <span class="badge ${step.status}" style="display:inline-block;">${tnaStatusLabel(step.status)}</span>
      </div>
    </div>
  `).join('');
  const note = document.createElement('div');
  note.className = 'auto-note';
  note.textContent = 'Statut calculé automatiquement à partir des dates.';
  body.appendChild(note);
}

function tnaStatusLabel(status) {
  if (status === 'late') return 'EN RETARD';
  if (status === 'done') return 'FAIT';
  return 'EN ATTENTE';
}

async function updateTnaStep(id, field, value) {
  const payload = { [field]: value || null, updated_at: new Date().toISOString() };
  const { error } = await sb.from('tna_steps').update(payload).eq('id', id);
  if (error) {
    alert("Erreur lors de la mise à jour : " + error.message);
    return;
  }
  if (currentTnaStyleId) await loadTnaSteps(currentTnaStyleId);
  await refreshOverview();
}

async function refreshOverview() {
  const { data: rows, error } = await sb
    .from('tna_steps')
    .select('id, step_name, planned_date, actual_date, status, style_id, styles(style_ref, style_name, stage, clients(name))')
    .order('planned_date', { ascending: true });

  if (error) { console.error(error); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRows = (rows || []).filter(r => r.styles && r.styles.stage !== 'Cloture');
  const activeStyleIds = new Set(activeRows.map(r => r.style_id));
  const lateStyleIds = new Set();
  const actionItems = [];

  activeRows.forEach(r => {
    if (r.status === 'late') {
      lateStyleIds.add(r.style_id);
      const planned = new Date(r.planned_date);
      planned.setHours(0, 0, 0, 0);
      const daysLate = Math.round((today - planned) / (1000 * 60 * 60 * 24));
      actionItems.push({ ...r, urgency: 'late', days: daysLate });
    } else if (r.status === 'pending' && r.planned_date) {
      const planned = new Date(r.planned_date);
      planned.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((planned - today) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0 && daysUntil <= 3) {
        actionItems.push({ ...r, urgency: 'soon', days: daysUntil });
      }
    }
  });

  actionItems.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'late' ? -1 : 1;
    return a.urgency === 'late' ? (b.days - a.days) : (a.days - b.days);
  });

  const activeCount = activeStyleIds.size;
  const lateCount = lateStyleIds.size;
  const onTimeRate = activeCount > 0 ? Math.round(((activeCount - lateCount) / activeCount) * 100) : 100;

  renderOverview({
    activeCount,
    lateCount,
    onTimeRate,
    actionItems: actionItems.slice(0, 8)
  });
}

function renderOverview({ activeCount, lateCount, onTimeRate, actionItems }) {
  const kpis = document.getElementById('kpis');
  kpis.innerHTML = `
    <div class="kpi"><div class="num amber">${activeCount}</div><div class="lbl">Commandes actives</div></div>
    <div class="kpi"><div class="num red">${lateCount}</div><div class="lbl">En retard</div></div>
    <div class="kpi"><div class="num green">${onTimeRate}%</div><div class="lbl">Taux on-time</div></div>
    <div class="kpi"><div class="num">${actionItems.length}</div><div class="lbl">Actions à traiter</div></div>
  `;

  const list = document.getElementById('priorityList');
  if (actionItems.length === 0) {
    list.innerHTML = `<div class="empty">Rien d'urgent — toutes les étapes sont à jour.</div>`;
    return;
  }
  list.innerHTML = actionItems.map(item => {
    const st = item.styles;
    const clientName = st.clients ? st.clients.name : null;
    const badge = item.urgency === 'late'
      ? `<span class="priority-badge late">RETARD ${item.days}J</span>`
      : `<span class="priority-badge soon">DANS ${item.days}J</span>`;
    return `
      <div class="priority-item">
        <div class="priority-left">
          <div class="priority-order">${escapeHtml(st.style_ref)} — ${escapeHtml(st.style_name)}</div>
          <div class="priority-step">${escapeHtml(item.step_name)}${clientName ? ' · ' + escapeHtml(clientName) : ''}</div>
        </div>
        <div class="priority-right">
          ${badge}
          <button class="btn secondary small" onclick="openTna('${item.style_id}', '${escapeHtml(st.style_ref)}', '${escapeHtml(st.style_name)}')">Voir</button>
        </div>
      </div>
    `;
  }).join('');
}

// Au chargement : vérifie si une session existe déjà
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await onLoggedIn();
})();
