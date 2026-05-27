// Unified API client.
// Tries the Node backend first; if it's not running (404 on /api/* or network error),
// falls back to a localStorage-backed implementation so the site works on any
// static host (GitHub Pages, Netlify, opening files directly, etc.).
//
// Exposes window.api with: login, signup, listExercises, adminListUsers, etc.
(function () {
  const STORE_KEY = 'typing-store-v1';
  let backendStatus = null; // null = unknown, 'live' = backend reachable, 'static' = fallback

  // ---------- localStorage data layer ----------
  function load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    const seed = {
      users: [
        {
          id: 'u1',
          name: 'Administrator',
          email: 'admin@typing.local',
          password: 'admin123', // local-only demo store
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      ],
      exercises: [
        { id: 'e1', section: 'english', mode: 'learn',  title: 'Home Row Basics', content: 'asdf jkl; asdf jkl; sad lad fall jaks asks dad fad lass', createdAt: now() },
        { id: 'e2', section: 'english', mode: 'test',   title: 'Quick Brown Fox', content: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', createdAt: now() },
        { id: 'e3', section: 'english', mode: 'number', title: 'Number Drill',    content: '12345 67890 1029 3847 5566 7788 9900 1122 3344 5566', createdAt: now() },
        { id: 'h1', section: 'hindi-krutidev', mode: 'learn', title: 'अभ्यास 1',  content: "dk[k Mky Hkkjr esjs ns'k dk uke gSA ge lc ,d gSaA", createdAt: now() },
        { id: 'h2', section: 'hindi-krutidev', mode: 'test',  title: 'परीक्षण 1', content: 'fnYyh Hkkjr dh jkt/kkuh gSA ;gk¡ cgqr lkjs ,sfrgkfld LFky gSaA', createdAt: now() },
        { id: 'm1', section: 'hindi-mangal-gail',     mode: 'learn', title: 'GAIL अभ्यास 1',     content: 'भारत मेरा देश है। हम सब भारतवासी हैं।', createdAt: now() },
        { id: 'm2', section: 'hindi-mangal-gail',     mode: 'test',  title: 'GAIL परीक्षण 1',    content: 'दिल्ली भारत की राजधानी है। यहाँ बहुत सारे ऐतिहासिक स्थल हैं।', createdAt: now() },
        { id: 'm3', section: 'hindi-mangal-inscript', mode: 'learn', title: 'INSCRIPT अभ्यास 1', content: 'सूरज पूरब दिशा से उगता है और पश्चिम में अस्त होता है।', createdAt: now() },
        { id: 'm4', section: 'hindi-mangal-inscript', mode: 'test',  title: 'INSCRIPT परीक्षण 1',content: 'विद्या ददाति विनयं विनयाद् याति पात्रताम्। पात्रत्वात् धनमाप्नोति धनात् धर्मं ततः सुखम्।', createdAt: now() },
        { id: 'm5', section: 'hindi-mangal-cbi',      mode: 'learn', title: 'CBI अभ्यास 1',      content: 'गंगा भारत की पवित्र नदी है। यह हिमालय से निकलती है।', createdAt: now() },
        { id: 'm6', section: 'hindi-mangal-cbi',      mode: 'test',  title: 'CBI परीक्षण 1',     content: 'भारतीय संस्कृति विश्व की प्राचीनतम संस्कृतियों में से एक है। यह विविधता में एकता का प्रतीक है।', createdAt: now() },
      ],
    };
    save(seed);
    return seed;
  }
  function save(d) { localStorage.setItem(STORE_KEY, JSON.stringify(d)); }
  function now() { return new Date().toISOString(); }

  // Token: opaque base64-encoded JSON, validated against the user record on use.
  function makeToken(u) {
    const body = { id: u.id, role: u.role, name: u.name, exp: Date.now() + 7 * 86400000 };
    return 'static.' + btoa(unescape(encodeURIComponent(JSON.stringify(body))));
  }
  function readToken(t) {
    if (!t || !t.startsWith('static.')) return null;
    try {
      const body = JSON.parse(decodeURIComponent(escape(atob(t.slice(7)))));
      if (body.exp < Date.now()) return null;
      return body;
    } catch (e) { return null; }
  }

  // ---------- static-mode "endpoints" ----------
  const fallback = {
    'POST /api/auth/login': ({ body }) => {
      const d = load();
      const u = d.users.find((x) => x.email.toLowerCase() === (body.email || '').toLowerCase());
      if (!u || u.password !== body.password) return resp(401, { error: 'Invalid credentials' });
      return resp(200, { token: makeToken(u), user: pub(u) });
    },
    'POST /api/auth/signup': ({ body }) => {
      const d = load();
      if (!body.name || !body.email || !body.password) return resp(400, { error: 'Missing fields' });
      if (d.users.find((x) => x.email.toLowerCase() === body.email.toLowerCase()))
        return resp(409, { error: 'Email already in use' });
      const u = { id: 'u' + Date.now(), name: body.name, email: body.email, password: body.password, role: 'user', createdAt: now() };
      d.users.push(u); save(d);
      return resp(200, { token: makeToken(u), user: pub(u) });
    },
    'GET /api/exercises': ({ query }) => {
      let list = load().exercises;
      if (query.section) list = list.filter((e) => e.section === query.section);
      if (query.mode) list = list.filter((e) => e.mode === query.mode);
      return resp(200, list);
    },
    'GET /api/admin/users': ({ auth }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      return resp(200, load().users.map(pub));
    },
    'DELETE /api/admin/users/:id': ({ auth, params }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      const d = load();
      const next = d.users.filter((u) => u.id !== params.id);
      if (next.length === d.users.length) return resp(404, { error: 'Not found' });
      d.users = next; save(d);
      return resp(200, { ok: true });
    },
    'PATCH /api/admin/users/:id/role': ({ auth, params, body }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      if (!['user', 'admin'].includes(body.role)) return resp(400, { error: 'Invalid role' });
      const d = load();
      const u = d.users.find((x) => x.id === params.id);
      if (!u) return resp(404, { error: 'Not found' });
      u.role = body.role; save(d);
      return resp(200, { ok: true });
    },
    'GET /api/admin/exercises': ({ auth }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      return resp(200, load().exercises);
    },
    'POST /api/admin/exercises': ({ auth, body }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      if (!body.section || !body.mode || !body.title || !body.content) return resp(400, { error: 'Missing fields' });
      const d = load();
      const item = { id: 'ex' + Date.now(), section: body.section, mode: body.mode, title: body.title, content: body.content, createdAt: now() };
      d.exercises.push(item); save(d);
      return resp(200, item);
    },
    'PUT /api/admin/exercises/:id': ({ auth, params, body }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      const d = load();
      const ex = d.exercises.find((x) => x.id === params.id);
      if (!ex) return resp(404, { error: 'Not found' });
      Object.assign(ex, body); save(d);
      return resp(200, ex);
    },
    'DELETE /api/admin/exercises/:id': ({ auth, params }) => {
      if (!auth || auth.role !== 'admin') return resp(403, { error: 'Admin only' });
      const d = load();
      const next = d.exercises.filter((e) => e.id !== params.id);
      if (next.length === d.exercises.length) return resp(404, { error: 'Not found' });
      d.exercises = next; save(d);
      return resp(200, { ok: true });
    },
  };
  function pub(u) { const { password, ...rest } = u; return rest; }
  function resp(status, body) { return { status, body }; }

  function dispatchStatic(method, path, query, body, token) {
    // Try exact key first, then keys with :param
    const exact = `${method} ${path}`;
    if (fallback[exact]) return fallback[exact]({ query, body, params: {}, auth: readToken(token) });
    for (const key of Object.keys(fallback)) {
      const [m, p] = key.split(' ');
      if (m !== method) continue;
      const re = new RegExp('^' + p.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '$');
      const match = path.match(re);
      if (match) return fallback[key]({ query, body, params: match.groups || {}, auth: readToken(token) });
    }
    return resp(404, { error: 'Not found' });
  }

  // ---------- public API ----------
  async function request(method, path, opts = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;

    const qs = opts.query
      ? '?' + Object.entries(opts.query).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&')
      : '';

    // Try real backend first (unless we already know it's offline)
    if (backendStatus !== 'static') {
      try {
        const res = await fetch(path + qs, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        if (res.status === 404 && res.headers.get('content-type')?.includes('text/html')) {
          // Static host returned the SPA fallback HTML for an /api/ route -> backend not running
          throw new Error('STATIC');
        }
        backendStatus = 'live';
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
        return data;
      } catch (e) {
        // Network error or static host => use fallback
        if (e.status && e.status !== 404) throw e;
        backendStatus = 'static';
        // fall through to static dispatch below
      }
    }

    // Static fallback path
    showStaticBanner();
    const url = new URL(path + qs, location.origin);
    const queryObj = Object.fromEntries(url.searchParams);
    const r = dispatchStatic(method, url.pathname, queryObj, opts.body, token);
    if (r.status >= 400) throw Object.assign(new Error(r.body.error || `Request failed (${r.status})`), { status: r.status });
    return r.body;
  }

  function showStaticBanner() {
    if (document.getElementById('static-banner')) return;
    const div = document.createElement('div');
    div.id = 'static-banner';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff7ed;border-top:1px solid #fed7aa;color:#7c2d12;padding:8px 14px;font-size:13px;text-align:center;z-index:200;';
    div.innerHTML = 'Running in static mode — your data is saved in this browser only. To enable the multi-user backend, run <code>node server.js</code> and refresh.';
    document.body.appendChild(div);
  }

  window.api = {
    login: (email, password) => request('POST', '/api/auth/login', { body: { email, password } }),
    signup: (name, email, password) => request('POST', '/api/auth/signup', { body: { name, email, password } }),
    listExercises: (section, mode) => request('GET', '/api/exercises', { query: { section, mode } }),
    adminListUsers: () => request('GET', '/api/admin/users'),
    adminDeleteUser: (id) => request('DELETE', '/api/admin/users/' + encodeURIComponent(id)),
    adminSetUserRole: (id, role) => request('PATCH', '/api/admin/users/' + encodeURIComponent(id) + '/role', { body: { role } }),
    adminListExercises: () => request('GET', '/api/admin/exercises'),
    adminAddExercise: (data) => request('POST', '/api/admin/exercises', { body: data }),
    adminDeleteExercise: (id) => request('DELETE', '/api/admin/exercises/' + encodeURIComponent(id)),
  };
})();
