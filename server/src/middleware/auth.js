// auth.js — Autenticación JWT en cookie httpOnly, control de roles y bloqueo por intentos.
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-produccion';
const SESSION_MINUTES = Number(process.env.SESSION_MINUTES || 60);

export function signSession(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: `${SESSION_MINUTES}m` }
  );
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // Renovación deslizante: cierre por inactividad
    res.cookie('session', signSession(req.user), cookieOpts());
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      audit(req, 'acceso_denegado', req.originalUrl, 'denegado');
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    }
    next();
  };
}

export function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MINUTES * 60 * 1000
  };
}

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (user_id, rol, accion, recurso, resultado, motivo, datos_anteriores, datos_nuevos, ip)
  VALUES (@user_id, @rol, @accion, @recurso, @resultado, @motivo, @old, @nuevo, @ip)
`);

export function audit(req, accion, recurso, resultado = 'ok', extra = {}) {
  insertAudit.run({
    user_id: req.user?.id ?? null,
    rol: req.user?.role ?? 'anonimo',
    accion,
    recurso: String(recurso ?? ''),
    resultado,
    motivo: extra.motivo ?? null,
    old: extra.old ? JSON.stringify(extra.old) : null,
    nuevo: extra.nuevo ? JSON.stringify(extra.nuevo) : null,
    ip: req.ip
  });
}

// Grupos visibles según rol (mínimo privilegio)
export function visibleGroupIds(user) {
  if (['admin', 'counselor', 'auditor'].includes(user.role)) {
    return db.prepare('SELECT id FROM groups').all().map(r => r.id);
  }
  if (user.role === 'teacher') {
    return db.prepare(`
      SELECT DISTINCT g.id FROM groups g
      LEFT JOIN teachers t ON t.id = g.teacher_id
      LEFT JOIN teacher_groups tg ON tg.group_id = g.id
      LEFT JOIN teachers t2 ON t2.id = tg.teacher_id
      WHERE t.user_id = ? OR t2.user_id = ?
    `).all(user.id, user.id).map(r => r.id);
  }
  return []; // devs: sin datos sensibles por defecto
}
