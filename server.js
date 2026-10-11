const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const authFile = path.join(dataDir, 'designer-auth.json');
const requestsFile = path.join(dataDir, 'design-requests.json');

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(authFile)) fs.writeFileSync(authFile, JSON.stringify({}, null, 2));
  if (!fs.existsSync(requestsFile)) fs.writeFileSync(requestsFile, JSON.stringify([], null, 2));
}

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

function createOrReadAuth() {
  const record = readJson(authFile, null);
  if (record && record.username && record.salt && record.hash) {
    return { username: record.username, salt: record.salt, hash: record.hash };
  }

  const username = process.env.DESIGNER_USERNAME || 'diseñador';
  const password = process.env.DESIGNER_PASSWORD || crypto.randomBytes(18).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const auth = { username, salt, hash };
  writeJson(authFile, auth);

  if (!process.env.DESIGNER_PASSWORD) {
    console.warn('\n=== Credenciales del diseñador generadas ===');
    console.warn(`Usuario: ${username}`);
    console.warn(`Contraseña: ${password}`);
    console.warn('Cámbialas con DESIGNER_USERNAME y DESIGNER_PASSWORD en un .env real.\n');
  }

  return auth;
}

function verifyPassword(password, storedHash, salt) {
  const candidate = hashPassword(password, salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Autenticación requerida.' });
}

ensureStorage();
const designerAuth = createOrReadAuth();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false }
}));

app.get('/api/auth/session', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    username: req.session && req.session.username ? req.session.username : null,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }

  if (username !== designerAuth.username) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  if (!verifyPassword(password, designerAuth.hash, designerAuth.salt)) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  req.session.authenticated = true;
  req.session.username = designerAuth.username;
  return res.json({ ok: true, username: designerAuth.username });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post('/api/design-requests', (req, res) => {
  const payload = req.body || {};
  const id = payload.id || `DR-${Date.now().toString(36).toUpperCase()}`;
  const record = {
    id,
    type: String(payload.type || 'pedido'),
    status: payload.status || 'Pendiente de revisión',
    customer: payload.customer || {},
    product: payload.product || null,
    quantity: payload.quantity != null ? Number(payload.quantity) : null,
    note: typeof payload.note === 'string' ? payload.note : '',
    payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const rows = readJson(requestsFile, []);
  rows.unshift(record);
  writeJson(requestsFile, rows);

  return res.status(201).json({ ok: true, id, status: record.status });
});

app.get('/api/design-requests', requireAuth, (req, res) => {
  const rows = readJson(requestsFile, []);
  return res.json(rows.map((row) => ({ ...row })));
});

app.patch('/api/design-requests/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body || {};
  const rows = readJson(requestsFile, []);
  const index = rows.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  const nextStatus = status || rows[index].status;
  const nextNote = note != null ? String(note) : rows[index].note;

  rows[index] = {
    ...rows[index],
    status: nextStatus,
    note: nextNote,
    updated_at: new Date().toISOString(),
  };

  writeJson(requestsFile, rows);
  return res.json({ ok: true, id, status: nextStatus });
});

app.use(express.static(rootDir, { index: false }));

app.get('/designer', (req, res) => {
  res.sendFile(path.join(rootDir, 'designer.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(rootDir, 'assets', 'logo_corpotex_simbolo.png'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.includes('.')) return next();
  return res.sendFile(path.join(rootDir, 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Corpotex web listening on http://localhost:${port}`);
  console.log(`Designer login: http://localhost:${port}/designer`);
});
