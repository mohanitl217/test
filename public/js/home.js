// Home page small enhancements: dynamic year + show signed-in state
document.getElementById('year').textContent = new Date().getFullYear();

const token = localStorage.getItem('token');
const userJson = localStorage.getItem('user');
if (token && userJson) {
  try {
    const user = JSON.parse(userJson);
    const navLinks = document.getElementById('nav-links');
    navLinks.innerHTML = `
      <a href="#english">English</a>
      <a href="#krutidev">KrutiDev</a>
      <a href="#mangal">Mangal</a>
      ${user.role === 'admin' ? '<a href="admin.html" class="btn-ghost">Admin</a>' : ''}
      <span style="font-size:14px;color:var(--text-muted)">Hi, ${user.name}</span>
      <button id="logout-btn" class="btn-ghost">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.reload();
    });
  } catch (e) {}
}
