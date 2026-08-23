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

  await loadStyles();
}

async function createStyle() {
  const ref = document.getElementById('newRef').value.trim();
  const name = document.getElementById('newName').value.trim();
  const client = document.getElementById('newClient').value.trim();
  const date = document.getElementById('newDate').value;

  if (!ref || !name) {
    alert('Référence et nom du style sont requis.');
    return;
  }

  const { error } = await sb.from('styles').insert({
    org_id: currentProfile.org_id,
    style_ref: ref,
    style_name: name,
    client: client || null,
    target_date: date || null,
    created_by: currentProfile.id
  });

  if (error) {
    alert("Erreur lors de la création : " + error.message);
    return;
  }

  document.getElementById('newRef').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newClient').value = '';
  document.getElementById('newDate').value = '';
  await loadStyles();
}

async function updateStage(id, newStage) {
  await sb.from('styles').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', id);
  await loadStyles();
}

async function updateStatus(id, newStatus) {
  await sb.from('styles').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
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
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  renderBoard(styles || []);
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
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="badge ${s.status}">${badgeLabel(s.status)}</div>
        <div class="style-ref">${escapeHtml(s.style_ref)}</div>
        <div class="style-name">${escapeHtml(s.style_name)}</div>
        <div class="client">${s.client ? escapeHtml(s.client) : '—'}${s.target_date ? ' · ' + s.target_date : ''}</div>
        <select onchange="updateStage('${s.id}', this.value)">
          ${STAGES.map(st => `<option value="${st}" ${st === s.stage ? 'selected' : ''}>${STAGE_LABELS[st]}</option>`).join('')}
        </select>
        <select onchange="updateStatus('${s.id}', this.value)">
          <option value="ontime" ${s.status === 'ontime' ? 'selected' : ''}>Dans les temps</option>
          <option value="risk" ${s.status === 'risk' ? 'selected' : ''}>À risque</option>
          <option value="late" ${s.status === 'late' ? 'selected' : ''}>En retard</option>
        </select>
        <div class="card-actions">
          <button class="btn secondary small" onclick="closeStyle('${s.id}')">Fermer</button>
          <button class="btn secondary small" onclick="deleteStyle('${s.id}')">Suppr.</button>
        </div>
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

// Au chargement : vérifie si une session existe déjà
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await onLoggedIn();
})();
