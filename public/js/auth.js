// Login + signup using the unified API client (window.api).
const errorEl = document.getElementById('error');
const showError = (msg) => { errorEl.textContent = msg; errorEl.classList.add('show'); };
const clearError = () => errorEl && errorEl.classList.remove('show');

let mode = 'user'; // login page tab
const tabs = document.querySelectorAll('.tab-row button');
tabs.forEach((b) =>
  b.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
  })
);

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
      const data = await api.login(fd.get('email'), fd.get('password'));
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
      const data = await api.signup(fd.get('name'), fd.get('email'), fd.get('password'));
      persist(data);
      location.href = '/';
    } catch (err) {
      showError(err.message);
    }
  });
}
