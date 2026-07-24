'use strict';

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '/data';
const HLS_DIR = process.env.HLS_DIR || '/hls';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });

function createInitialState() {
  return {
    configured: false,
    channel: '',
    title: 'Transmissão ao vivo',
    passwordSalt: '',
    passwordHash: '',
    streamToken: crypto.randomBytes(24).toString('base64url'),
    sessionSecret: crypto.randomBytes(32).toString('hex')
  };
}

function saveState(state) {
  const temp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, STATE_FILE);
}

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { ...createInitialState(), ...saved };
  } catch {
    const initial = createInitialState();
    saveState(initial);
    return initial;
  }
}

let state = loadState();

function normalizeChannel(value) {
  let channel = String(value || '').trim();
  channel = channel.replace(/^https?:\/\/(?:www\.)?twitch\.tv\//i, '');
  channel = channel.split(/[/?#]/)[0].replace(/^@/, '').toLowerCase();
  return channel;
}

function validChannel(channel) {
  return /^[a-z0-9_]{3,25}$/.test(channel);
}

function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function safeEqualHex(a, b) {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function makeAdminSession() {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  const signature = crypto.createHmac('sha256', state.sessionSecret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function isAdmin(req) {
  const token = parseCookies(req).painel;
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const payload = `admin.${parts[1]}`;
  const expected = crypto.createHmac('sha256', state.sessionSecret).update(payload).digest('hex');
  const received = parts[2];
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

function setAdminCookie(req, res) {
  const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=604800'];
  if (secure) flags.push('Secure');
  res.setHeader('Set-Cookie', `painel=${encodeURIComponent(makeAdminSession())}; ${flags.join('; ')}`);
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', 'painel=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Entre no painel primeiro.' });
  next();
}

function streamIsLive() {
  try {
    const file = path.join(HLS_DIR, 'principal.m3u8');
    const stat = fs.statSync(file);
    return Date.now() - stat.mtimeMs < 12000;
  } catch {
    return false;
  }
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.get('/api/public', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    configured: Boolean(state.configured),
    channel: state.channel,
    title: state.title,
    live: streamIsLive()
  });
});

app.get('/api/live', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ live: streamIsLive() });
});

app.post('/api/setup', (req, res) => {
  if (state.configured) return res.status(409).json({ error: 'O site já foi configurado.' });

  const channel = normalizeChannel(req.body.channel);
  const password = String(req.body.password || '');
  const title = String(req.body.title || 'Transmissão ao vivo').trim().slice(0, 100);

  if (!validChannel(channel)) {
    return res.status(400).json({ error: 'Digite um canal válido da Twitch.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha do painel precisa ter pelo menos 6 caracteres.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  state = {
    ...state,
    configured: true,
    channel,
    title: title || 'Transmissão ao vivo',
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    streamToken: crypto.randomBytes(24).toString('base64url')
  };
  saveState(state);
  setAdminCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (!state.configured) return res.status(409).json({ error: 'Faça a configuração inicial primeiro.' });
  const password = String(req.body.password || '');
  const received = hashPassword(password, state.passwordSalt);
  if (!safeEqualHex(received, state.passwordHash)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  setAdminCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/info', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    channel: state.channel,
    title: state.title,
    streamKey: `principal?token=${state.streamToken}`,
    live: streamIsLive()
  });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const channel = normalizeChannel(req.body.channel);
  const title = String(req.body.title || '').trim().slice(0, 100);
  if (!validChannel(channel)) return res.status(400).json({ error: 'Digite um canal válido da Twitch.' });

  state.channel = channel;
  state.title = title || 'Transmissão ao vivo';
  saveState(state);
  res.json({ ok: true });
});

app.post('/api/admin/regenerate-key', requireAdmin, (req, res) => {
  state.streamToken = crypto.randomBytes(24).toString('base64url');
  saveState(state);
  res.json({ ok: true, streamKey: `principal?token=${state.streamToken}` });
});

function extractPublishData(req) {
  let name = String(req.body.name || req.query.name || '');
  let token = String(req.body.token || req.query.token || '');
  const args = String(req.body.args || req.query.args || '');

  if (name.includes('?')) {
    const [plainName, query] = name.split('?', 2);
    name = plainName;
    token = token || new URLSearchParams(query).get('token') || '';
  }
  if (!token && args) token = new URLSearchParams(args).get('token') || '';

  return { name, token };
}

app.all('/api/rtmp/publish', (req, res) => {
  const { name, token } = extractPublishData(req);
  if (name !== 'principal' || !token || token !== state.streamToken) {
    return res.status(403).type('text/plain').send('Chave de transmissão inválida.');
  }
  res.status(200).type('text/plain').send('OK');
});

const viewers = new Set();

function broadcastViewerCount() {
  const payload = `data: ${JSON.stringify({ viewers: viewers.size })}\n\n`;
  for (const response of viewers) response.write(payload);
}

app.get('/api/viewers', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  viewers.add(res);
  broadcastViewerCount();
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    viewers.delete(res);
    broadcastViewerCount();
  });
});

app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'hls.js', 'dist'), {
  maxAge: '30d',
  immutable: true
}));
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Painel e site iniciados na porta ${PORT}.`);
});
