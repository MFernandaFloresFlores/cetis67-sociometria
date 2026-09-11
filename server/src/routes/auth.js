// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signSession, cookieOpts, requireAuth, audit } from '../middleware/auth.js';

const r = Router();
const MAX_ATTEMPTS = 5;

r.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND active = 1').get(username, username);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.' });
  }
  if (!bcrypt.compareSync(password || '', user.password_hash)) {
    const attempts = user.failed_attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + 15 * 60000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, locked, user.id);
    audit({ ip: req.ip, user: null }, 'login_fallido', username, 'fallo');
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  res.cookie('session', signSession(user), cookieOpts());
  audit({ ip: req.ip, user: { id: user.id, role: user.role } }, 'login', username);
  res.json({ id: user.id, name: user.name, role: user.role });
});

r.post('/logout', requireAuth, (req, res) => {
  audit(req, 'logout', req.user.name);
  res.clearCookie('session');
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => res.json(req.user));

export default r;
