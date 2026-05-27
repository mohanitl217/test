// Shared auth logic for login + signup pages
const errorEl = document.getElementById('error');
const showError = (msg) => {
  errorEl.textContent = msg;
  errorEl.classList.add('show');
};
const clearError = () => errorEl && errorEl.classList.remove('show');

let mode = 'user'; // toggle on login page

const tabs = document.querySelectorAll('.tab-row button');
tabs.forEach((b) =>
  b.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
  })
);

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function persist(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}

// LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const fd = new FormData(loginForm);
    try {
      const data = await postJson('/api/auth/login', {
        email: fd.get('email'),
        password: fd.get('password'),
      });
      // If admin tab selected, but user is not admin -> reject
      if (mode === 'admin' && data.user.role !== 'admin') {
        return showError('This account is not an admin.');
      }
      persist(data);
      location.href = data.user.role === 'admin' ? 'admin.html' : '/';
    } catch (err) {
      showError(err.message);
    }
  });
}

// SIGNUP
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const fd = new FormData(signupForm);
    try {
      const data = await postJson('/api/auth/signup', {
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
      });
      persist(data);
      location.href = '/';
    } catch (err) {
      showError(err.message);
    }
  });
}
