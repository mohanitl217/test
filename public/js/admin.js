// Admin dashboard - uses window.api (with static-mode fallback)
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'admin') {
  alert('Admin login required.');
  location.href = 'login.html';
}

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = 'login.html';
});

// View switching
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach((n) =>
  n.addEventListener('click', () => {
    navLinks.forEach((x) => x.classList.remove('active'));
    n.classList.add('active');
    document.getElementById('view-users').hidden = n.dataset.view !== 'users';
    document.getElementById('view-exercises').hidden = n.dataset.view !== 'exercises';
    if (n.dataset.view === 'users') loadUsers();
    if (n.dataset.view === 'exercises') loadExercises();
  })
);

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// USERS
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  try {
    const users = await api.adminListUsers();
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="5">No users yet.</td></tr>'; return; }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="role-badge role-${u.role}">${u.role}</span></td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td style="text-align:right;display:flex;gap:6px;justify-content:flex-end;">
          <button class="btn" data-act="role" data-id="${u.id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}">
            Make ${u.role === 'admin' ? 'user' : 'admin'}
          </button>
          <button class="btn btn-danger" data-act="del" data-id="${u.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button').forEach((b) => b.addEventListener('click', onUserAction));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5">Error: ${e.message}</td></tr>`;
  }
}

async function onUserAction(e) {
  const { act, id, role } = e.currentTarget.dataset;
  try {
    if (act === 'del') {
      if (!confirm('Delete this user?')) return;
      await api.adminDeleteUser(id);
      toast('User deleted');
    } else if (act === 'role') {
      await api.adminSetUserRole(id, role);
      toast('Role updated');
    }
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

// EXERCISES
let exerciseFilter = '';

document.querySelectorAll('#ex-tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('#ex-tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    exerciseFilter = b.dataset.section || '';
    loadExercises();
  })
);

async function loadExercises() {
  const tbody = document.getElementById('ex-tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  try {
    let list = await api.adminListExercises();
    if (exerciseFilter) list = list.filter((e) => e.section === exerciseFilter);
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5">No exercises.</td></tr>'; return; }
    tbody.innerHTML = list.map((ex) => `
      <tr>
        <td>${escapeHtml(ex.title)}</td>
        <td><code style="font-size:12px;">${ex.section}</code></td>
        <td>${ex.mode}</td>
        <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ex.content.slice(0,80))}${ex.content.length>80?'…':''}</td>
        <td style="text-align:right;"><button class="btn btn-danger" data-id="${ex.id}">Delete</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button').forEach((b) => b.addEventListener('click', async (e) => {
      if (!confirm('Delete this exercise?')) return;
      await api.adminDeleteExercise(e.currentTarget.dataset.id);
      toast('Exercise deleted');
      loadExercises();
    }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5">Error: ${e.message}</td></tr>`;
  }
}

document.getElementById('add-exercise').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  try {
    await api.adminAddExercise({
      section: fd.get('section'),
      mode: fd.get('mode'),
      title: fd.get('title'),
      content: fd.get('content'),
    });
    e.currentTarget.reset();
    toast('Exercise added');
    loadExercises();
  } catch (err) {
    alert(err.message);
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

loadUsers();
