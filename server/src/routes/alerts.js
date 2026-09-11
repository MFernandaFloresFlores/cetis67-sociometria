// routes/alerts.js — Alertas y seguimiento (sección 22), informes (24) y bitácora (25).
import { Router } from 'express';
import { db, groupName } from '../db.js';
import { requireAuth, requireRole, audit, visibleGroupIds } from '../middleware/auth.js';
import { segregationLabel } from '../services/sociometry.js';

const r = Router();
r.use(requireAuth);

const ALERT_STATES = ['Nuevo', 'Pendiente', 'En valoración', 'En seguimiento', 'Canalizado', 'Cerrado', 'Descartado'];

r.get('/alerts', requireRole('admin', 'counselor', 'teacher'), (req, res) => {
  const ids = visibleGroupIds(req.user);
  if (!ids.length) return res.json([]);
  const { status, priority } = req.query;
  let sql = `
    SELECT a.*, s.matricula, s.nombres, s.apellido_paterno,
           g.plan_estudios, g.semestre, g.letra, g.turno, u.name AS responsable
    FROM alerts a
    LEFT JOIN enrollments e ON e.id = a.enrollment_id
    LEFT JOIN students s ON s.id = e.student_id
    LEFT JOIN groups g ON g.id = e.group_id
    LEFT JOIN users u ON u.id = a.assigned_to
    WHERE e.group_id IN (${ids.map(() => '?').join(',')})`;
  const params = [...ids];
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  if (priority) { sql += ' AND a.priority = ?'; params.push(priority); }
  sql += " ORDER BY CASE a.priority WHEN 'Urgente' THEN 0 WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END, a.created_at DESC";
  res.json(db.prepare(sql).all(...params).map(a => ({ ...a, grupo: a.plan_estudios ? groupName(a) : null })));
});

r.post('/alerts/:id/status', requireRole('admin', 'counselor'), (req, res) => {
  const { status, justificacion } = req.body;
  if (!ALERT_STATES.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  if (['Cerrado', 'Descartado'].includes(status) && !justificacion) {
    return res.status(400).json({ error: 'Cerrar o descartar requiere justificación.' });
  }
  const old = db.prepare('SELECT status FROM alerts WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Alerta no encontrada' });
  db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, req.params.id);
  db.prepare('INSERT INTO followups (alert_id, user_id, action, note) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, 'cambio_estado', justificacion || `Estado: ${old.status} → ${status}`);
  audit(req, 'cambio_estado_alerta', `alert:${req.params.id}`, 'ok', { old, nuevo: { status }, motivo: justificacion });
  res.json({ ok: true });
});

r.post('/alerts/:id/assign', requireRole('admin', 'counselor'), (req, res) => {
  db.prepare('UPDATE alerts SET assigned_to = ? WHERE id = ?').run(req.body.user_id, req.params.id);
  audit(req, 'asignar_alerta', `alert:${req.params.id}`, 'ok', { nuevo: { assigned_to: req.body.user_id } });
  res.json({ ok: true });
});

r.post('/alerts/:id/followups', requireRole('admin', 'counselor'), (req, res) => {
  const { action, note, due_at } = req.body; // nota|entrevista|contacto|acuerdo
  db.prepare('INSERT INTO followups (alert_id, user_id, action, note, due_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, req.user.id, action || 'nota', note || '', due_at || null);
  audit(req, 'seguimiento_alerta', `alert:${req.params.id}`);
  res.json({ ok: true });
});

r.get('/alerts/:id/followups', requireRole('admin', 'counselor'), (req, res) => {
  res.json(db.prepare(`
    SELECT f.*, u.name AS autor FROM followups f JOIN users u ON u.id = f.user_id
    WHERE f.alert_id = ? ORDER BY f.created_at DESC`).all(req.params.id));
});

// ---- Informe grupal (JSON exportable; el frontend permite imprimir/PDF y CSV) ----
r.get('/reports/group/:qrId', requireRole('admin', 'counselor', 'teacher'), (req, res) => {
  const qrId = Number(req.params.qrId);
  const app_ = db.prepare(`
    SELECT q.*, f.title, g.plan_estudios, g.semestre, g.letra, g.turno, p.name AS periodo
    FROM qr_codes q JOIN forms f ON f.id = q.form_id JOIN groups g ON g.id = q.group_id
    JOIN academic_periods p ON p.id = g.period_id WHERE q.id = ?`).get(qrId);
  if (!app_) return res.status(404).json({ error: 'Aplicación no encontrada' });
  if (!visibleGroupIds(req.user).includes(app_.group_id)) return res.status(403).json({ error: 'Sin acceso' });
  audit(req, 'exportacion_informe_grupal', `qr:${qrId}`);
  const group = db.prepare('SELECT metrics FROM group_indices WHERE qr_id = ?').get(qrId);
  const results = db.prepare(`
    SELECT sr.metrics, sr.tipo, s.matricula, s.nombres, s.apellido_paterno
    FROM sociometric_results sr JOIN enrollments e ON e.id = sr.enrollment_id
    JOIN students s ON s.id = e.student_id WHERE sr.qr_id = ?`).all(qrId);
  const seg = db.prepare('SELECT dimension, relationship, value FROM segregation_indices WHERE qr_id = ?').all(qrId);
  const emoDist = db.prepare(`
    SELECT er.level, COUNT(*) AS n FROM emotional_results er
    JOIN responses r ON r.id = er.response_id WHERE r.qr_id = ? GROUP BY er.level`).all(qrId);
  const alerts = db.prepare(`
    SELECT type, priority, COUNT(*) AS n FROM alerts WHERE qr_id = ? GROUP BY type, priority`).all(qrId);
  res.json({
    aviso: 'Los resultados son indicadores preventivos, no diagnósticos. Deben interpretarse por personal capacitado.',
    aplicacion: { formulario: app_.title, grupo: groupName(app_), periodo: app_.periodo, fecha: app_.created_at },
    indices_grupales: group ? JSON.parse(group.metrics) : null,
    alumnos: results.map(x => ({ matricula: x.matricula, nombre: `${x.nombres} ${x.apellido_paterno}`, tipo: x.tipo, ...JSON.parse(x.metrics) })),
    segregacion: seg.map(s => ({ ...s, etiqueta: segregationLabel(s.value) })),
    distribucion_emocional: emoDist,
    alertas: alerts
  });
});

// ---- Bitácora (solo lectura; el auditor no modifica) ----
r.get('/audit', requireRole('admin', 'auditor'), (req, res) => {
  const { accion, q, limit } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (accion) { sql += ' AND accion = ?'; params.push(accion); }
  if (q) { sql += ' AND (recurso LIKE ? OR accion LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 1000));
  res.json(db.prepare(sql).all(...params));
});

export default r;
