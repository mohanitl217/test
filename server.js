// Zero-dependency HTTP server: static files + JSON API for auth, users, exercises.
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EX_FILE = path.join(DATA_DIR, 'exercises.json');
const SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// --------------------- helpers ---------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
};

function readJson(file)  { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf-8');
}

// Password hashing (scrypt) — replaces bcrypt
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(plain, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + dk.toString('hex');
}
function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const dk = crypto.scryptSync(plain, salt, expected.length);
  return crypto.timingSafeEqual(dk, expected);
}

// Token (HMAC-signed JSON) — replaces jsonwebtoken
function signToken(payload, ttlSeconds = 7 * 24 * 3600) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = b64url(JSON.stringify(body));
  const sig  = b64url(crypto.createHmac('sha256', SECRET).update(head + '.' + data).digest());
  return `${head}.${data}.${sig}`;
}
function verifyToken(token) {
  if (!token || token.split('.').length !== 3) return null;
  const [head, data, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(head + '.' + data).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(fromB64url(data));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

// --------------------- seed data ---------------------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(USERS_FILE)) {
  writeJson(USERS_FILE, [
    {
      id: 'u1',
      name: 'Administrator',
      email: 'admin@typing.local',
      password: hashPassword('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
  ]);
}

if (!fs.existsSync(EX_FILE)) {
  writeJson(EX_FILE, [
    { id: 'e1', section: 'english', mode: 'learn', title: 'Home Row Basics', content: 'asdf jkl; asdf jkl; sad lad fall jaks asks dad fad lass', createdAt: new Date().toISOString() },
    { id: 'e2', section: 'english', mode: 'test',  title: 'Quick Brown Fox', content: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', createdAt: new Date().toISOString() },
    { id: 'e3', section: 'english', mode: 'number',title: 'Number Drill',    content: '12345 67890 1029 3847 5566 7788 9900 1122 3344 5566', createdAt: new Date().toISOString() },
    { id: 'h1', section: 'hindi-krutidev', mode: 'learn', title: 'अभ्यास 1', content: 'dk[k Mky Hkkjr esjs ns\'k dk uke gSA ge lc ,d gSaA', createdAt: new Date().toISOString() },
    { id: 'h2', section: 'hindi-krutidev', mode: 'test',  title: 'परीक्षण 1', content: 'fnYyh Hkkjr dh jkt/kkuh gSA ;gk¡ cgqr lkjs ,sfrgkfld LFky gSaA', createdAt: new Date().toISOString() },
    { id: 'm1', section: 'hindi-mangal-gail', mode: 'learn', title: 'GAIL अभ्यास 1', content: 'भारत मेरा देश है। हम सब भारतवासी हैं।', createdAt: new Date().toISOString() },
    { id: 'm2', section: 'hindi-mangal-gail', mode: 'test',  title: 'GAIL परीक्षण 1', content: 'दिल्ली भारत की राजधानी है। यहाँ बहुत सारे ऐतिहासिक स्थल हैं।', createdAt: new Date().toISOString() },
    { id: 'm3', section: 'hindi-mangal-inscript', mode: 'learn', title: 'INSCRIPT अभ्यास 1', content: 'सूरज पूरब दिशा से उगता है और पश्चिम में अस्त होता है।', createdAt: new Date().toISOString() },
    { id: 'm4', section: 'hindi-mangal-inscript', mode: 'test',  title: 'INSCRIPT परीक्षण 1', content: 'विद्या ददाति विनयं विनयाद् याति पात्रताम्। पात्रत्वात् धनमाप्नोति धनात् धर्मं ततः सुखम्।', createdAt: new Date().toISOString() },
    { id: 'm5', section: 'hindi-mangal-cbi', mode: 'learn', title: 'CBI अभ्यास 1', content: 'गंगा भारत की पवित्र नदी है। यह हिमालय से निकलती है।', createdAt: new Date().toISOString() },
    { id: 'm6', section: 'hindi-mangal-cbi', mode: 'test',  title: 'CBI परीक्षण 1', content: 'भारतीय संस्कृति विश्व की प्राचीनतम संस्कृतियों में से एक है। यह विविधता में एकता का प्रतीक है।', createdAt: new Date().toISOString() },
  ]);
}

// --------------------- request helpers ---------------------
function send(res, status, data, headers = {}) {
  const isJson = typeof data === 'object' && !(data instanceof Buffer);
  const body = isJson ? JSON.stringify(data) : data;
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : (headers['Content-Type'] || 'text/plain'),
    ...headers,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyToken(token);
}

// --------------------- API handlers ---------------------
async function handleApi(req, res, parsed) {
  const { pathname, query } = parsed;
  const method = req.method;

  // --- AUTH ---
  if (pathname === '/api/auth/signup' && method === 'POST') {
    const { name, email, password } = await readBody(req);
    if (!name || !email || !password) return send(res, 400, { error: 'Missing fields' });
    const users = readJson(USERS_FILE);
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
      return send(res, 409, { error: 'Email already in use' });
    const newUser = {
      id: 'u' + Date.now(),
      name, email,
      password: hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeJson(USERS_FILE, users);
    const token = signToken({ id: newUser.id, role: newUser.role, name: newUser.name });
    return send(res, 200, { token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const { email, password } = await readBody(req);
    if (!email || !password) return send(res, 400, { error: 'Missing fields' });
    const users = readJson(USERS_FILE);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !verifyPassword(password, user.password))
      return send(res, 401, { error: 'Invalid credentials' });
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    return send(res, 200, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }

  // --- PUBLIC EXERCISES ---
  if (pathname === '/api/exercises' && method === 'GET') {
    let list = readJson(EX_FILE);
    if (query.section) list = list.filter((e) => e.section === query.section);
    if (query.mode)    list = list.filter((e) => e.mode === query.mode);
    return send(res, 200, list);
  }

  // --- ADMIN guard ---
  if (pathname.startsWith('/api/admin')) {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: 'No token' });
    if (u.role !== 'admin') return send(res, 403, { error: 'Admin only' });

    // USERS
    if (pathname === '/api/admin/users' && method === 'GET') {
      return send(res, 200, readJson(USERS_FILE).map(({ password, ...u }) => u));
    }
    let m;
    if ((m = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)) && method === 'DELETE') {
      const id = m[1];
      const users = readJson(USERS_FILE);
      const next = users.filter((x) => x.id !== id);
      if (next.length === users.length) return send(res, 404, { error: 'Not found' });
      writeJson(USERS_FILE, next);
      return send(res, 200, { ok: true });
    }
    if ((m = pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/)) && method === 'PATCH') {
      const id = m[1];
      const { role } = await readBody(req);
      if (!['user', 'admin'].includes(role)) return send(res, 400, { error: 'Invalid role' });
      const users = readJson(USERS_FILE);
      const target = users.find((x) => x.id === id);
      if (!target) return send(res, 404, { error: 'Not found' });
      target.role = role;
      writeJson(USERS_FILE, users);
      return send(res, 200, { ok: true });
    }

    // EXERCISES
    if (pathname === '/api/admin/exercises' && method === 'GET') {
      return send(res, 200, readJson(EX_FILE));
    }
    if (pathname === '/api/admin/exercises' && method === 'POST') {
      const { section, mode, title, content } = await readBody(req);
      if (!section || !mode || !title || !content) return send(res, 400, { error: 'Missing fields' });
      const list = readJson(EX_FILE);
      const item = { id: 'ex' + Date.now(), section, mode, title, content, createdAt: new Date().toISOString() };
      list.push(item);
      writeJson(EX_FILE, list);
      return send(res, 200, item);
    }
    if ((m = pathname.match(/^\/api\/admin\/exercises\/([^/]+)$/)) && method === 'DELETE') {
      const id = m[1];
      const list = readJson(EX_FILE);
      const next = list.filter((x) => x.id !== id);
      if (next.length === list.length) return send(res, 404, { error: 'Not found' });
      writeJson(EX_FILE, next);
      return send(res, 200, { ok: true });
    }
    if ((m = pathname.match(/^\/api\/admin\/exercises\/([^/]+)$/)) && method === 'PUT') {
      const id = m[1];
      const patch = await readBody(req);
      const list = readJson(EX_FILE);
      const target = list.find((x) => x.id === id);
      if (!target) return send(res, 404, { error: 'Not found' });
      Object.assign(target, patch);
      writeJson(EX_FILE, list);
      return send(res, 200, target);
    }

    return send(res, 404, { error: 'Not found' });
  }

  return send(res, 404, { error: 'Not found' });
}

// --------------------- static files ---------------------
function serveStatic(req, res, parsed) {
  let p = decodeURIComponent(parsed.pathname);
  if (p === '/' || p === '') p = '/index.html';
  // Resolve safely inside PUBLIC_DIR
  const target = path.normalize(path.join(PUBLIC_DIR, p));
  if (!target.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      // SPA-style fallback to home only for unknown root paths
      if (path.extname(target) === '') {
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, buf) =>
          e2 ? send(res, 404, 'Not found') : send(res, 200, buf, { 'Content-Type': 'text/html; charset=utf-8' })
        );
      }
      return send(res, 404, 'Not found');
    }
    fs.readFile(target, (e2, buf) => {
      if (e2) return send(res, 500, 'Server error');
      const mime = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
      send(res, 200, buf, { 'Content-Type': mime });
    });
  });
}

// --------------------- server ---------------------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  try {
    if (parsed.pathname.startsWith('/api/')) return await handleApi(req, res, parsed);
    if (parsed.pathname === '/health') return send(res, 200, { ok: true });
    return serveStatic(req, res, parsed);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Typing site running on http://localhost:${PORT}`);
  console.log('Default admin -> email: admin@typing.local  password: admin123');
});
