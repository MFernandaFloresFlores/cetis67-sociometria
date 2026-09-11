// routes/forms.js — Formularios (con versionado) y aplicaciones con QR (sección 08 y 09).
import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db, groupName } from '../db.js';
import { requireAuth, requireRole, audit, visibleGroupIds } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/forms', (req, res) => {
  res.json(db.prepare('SELECT id, title, type, status, version, created_at FROM forms ORDER BY id DESC').all());
});

r.post('/forms', requireRole('admin'), (req, res) => {
  const { title, type } = req.body;
  if (!title || !['sociometrico', 'emocional', 'combinado'].includes(type)) {
    return res.status(400).json({ error: 'Título y tipo válidos requeridos' });
  }
  const info = db.prepare('INSERT INTO forms (title, type, created_by) VALUES (?, ?, ?)').run(title, type, req.user.id);
  db.prepare('INSERT INTO form_versions (form_id, version, definition, author_id) VALUES (?, 1, ?, ?)')
    .run(info.lastInsertRowid, JSON.stringify({ type }), req.user.id);
  audit(req, 'alta_formulario', title, 'ok', { nuevo: { title, type } });
  res.json({ id: info.lastInsertRowid });
});

r.post('/forms/:id/status', requireRole('admin'), (req, res) => {
  const { status } = req.body;
  if (!['borrador', 'activo', 'pausado', 'cerrado', 'archivado'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const old = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Formulario no encontrado' });
  // Versionado: no modificar formularios con respuestas — solo cambiar estado o crear nueva versión.
  db.prepare('UPDATE forms SET status = ? WHERE id = ?').run(status, req.params.id);
  audit(req, 'cambio_estado_formulario', `form:${req.params.id}`, 'ok', { old: { status: old.status }, nuevo: { status } });
  res.json({ ok: true });
});

// ---- Aplicaciones + QR ----
r.get('/applications', (req, res) => {
  const ids = visibleGroupIds(req.user);
  if (!ids.length) return res.json([]);
  const rows = db.prepare(`
    SELECT q.*, f.title AS formulario, f.type AS tipo_formulario,
           g.plan_estudios, g.semestre, g.letra, g.turno,
           (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = q.group_id AND e.estado != 'baja') AS alumnos,
           (SELECT COUNT(*) FROM responses rs WHERE rs.qr_id = q.id AND rs.status = 'enviado') AS enviados,
           (SELECT COUNT(*) FROM responses rs WHERE rs.qr_id = q.id AND rs.status = 'en_progreso') AS en_progreso
    FROM qr_codes q
    JOIN forms f ON f.id = q.form_id
    JOIN groups g ON g.id = q.group_id
    WHERE q.group_id IN (${ids.map(() => '?').join(',')})
    ORDER BY q.id DESC
  `).all(...ids);
  res.json(rows.map(a => ({ ...a, grupo: groupName(a) })));
});

r.post('/applications', requireRole('admin'), (req, res) => {
  const { form_id, group_id } = req.body;
  const form = db.prepare("SELECT * FROM forms WHERE id = ? AND status = 'activo'").get(form_id);
  if (!form) return res.status(400).json({ error: 'El formulario debe existir y estar activo' });
  const token = crypto.randomBytes(16).toString('base64url'); // URL segura sin datos personales
  const info = db.prepare('INSERT INTO qr_codes (form_id, group_id, token) VALUES (?, ?, ?)').run(form_id, group_id, token);
  audit(req, 'alta_aplicacion_qr', `qr:${info.lastInsertRowid}`, 'ok', { nuevo: { form_id, group_id } });
  res.json({ id: info.lastInsertRowid, token });
});

r.get('/applications/:id/qr', async (req, res) => {
  const app_ = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!app_) return res.status(404).json({ error: 'Aplicación no encontrada' });
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}/r/${app_.token}`;
  const png = await QRCode.toDataURL(url, { width: 480, margin: 1 });
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1 });
  res.json({ url, png, svg, status: app_.status, access_count: app_.access_count });
});

r.post('/applications/:id/status', requireRole('admin'), (req, res) => {
  const { status } = req.body; // activo|pausado|cerrado|desactivado
  if (!['activo', 'pausado', 'cerrado', 'desactivado'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const old = db.prepare('SELECT status FROM qr_codes WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE qr_codes SET status = ? WHERE id = ?').run(status, req.params.id);
  audit(req, 'cambio_estado_qr', `qr:${req.params.id}`, 'ok', { old, nuevo: { status } });
  res.json({ ok: true });
});

r.post('/applications/:id/regenerate', requireRole('admin'), (req, res) => {
  const token = crypto.randomBytes(16).toString('base64url');
  db.prepare('UPDATE qr_codes SET token = ? WHERE id = ?').run(token, req.params.id);
  audit(req, 'regenerar_qr', `qr:${req.params.id}`);
  res.json({ token });
});

export default r;
