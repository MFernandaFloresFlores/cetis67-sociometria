// routes/results.js — Resultados, matrices, perfiles, relaciones, segregación y sociograma.
import { Router } from 'express';
import { db, groupName } from '../db.js';
import { requireAuth, requireRole, audit, visibleGroupIds } from '../middleware/auth.js';
import { computeApplication, getApplicationData, participation, personalRelationships, distanceLabel, segregationLabel } from '../services/sociometry.js';

const r = Router();
r.use(requireAuth);

function assertVisible(req, res, qrId) {
  const app_ = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(qrId);
  if (!app_) { res.status(404).json({ error: 'Aplicación no encontrada' }); return null; }
  if (!visibleGroupIds(req.user).includes(app_.group_id)) {
    audit(req, 'acceso_denegado_resultados', `qr:${qrId}`, 'denegado');
    res.status(403).json({ error: 'No tienes acceso a este grupo' });
    return null;
  }
  return app_;
}

// Calcular (o recalcular) una aplicación. Bloqueo por participación < 60% con override auditado.
r.post('/applications/:id/compute', requireRole('admin', 'counselor'), (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  const out = computeApplication(Number(req.params.id), { override: !!req.body?.override });
  audit(req, 'recalculo_sociometria', `qr:${req.params.id}`, out.blocked ? 'bloqueado' : 'ok',
    { motivo: req.body?.override ? 'override participación' : null });
  res.json(out);
});

r.get('/applications/:id/participation', (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  res.json(participation(Number(req.params.id)));
});

// Resultados individuales (tabla de valores e índices + tipos)
r.get('/applications/:id/results', (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  const rows = db.prepare(`
    SELECT sr.*, s.matricula, s.nombres, s.apellido_paterno, s.genero
    FROM sociometric_results sr
    JOIN enrollments e ON e.id = sr.enrollment_id
    JOIN students s ON s.id = e.student_id
    WHERE sr.qr_id = ?
  `).all(req.params.id);
  const group = db.prepare('SELECT metrics FROM group_indices WHERE qr_id = ?').get(req.params.id);
  res.json({
    results: rows.map(x => ({ ...x, metrics: JSON.parse(x.metrics) })),
    group: group ? JSON.parse(group.metrics) : null
  });
});

// Matriz sociométrica (nominaciones y percepciones emisor × receptor)
r.get('/applications/:id/matrix', (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  const { enrollments, nominations, perceptions } = getApplicationData(Number(req.params.id));
  res.json({
    students: enrollments.map(e => ({ id: e.id, nombre: `${e.nombres} ${e.apellido_paterno}`, matricula: e.matricula })),
    nominations: nominations.map(n => ({ source: n.source, target: n.target_enrollment_id, kind: n.kind, rank: n.rank })),
    perceptions: perceptions.map(p => ({ source: p.source, target: p.target_enrollment_id, kind: p.kind, rank: p.rank }))
  });
});

// Sociograma: nodos con tipo/alertas/popularidad + aristas
r.get('/applications/:id/sociogram', (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  const qrId = Number(req.params.id);
  const { enrollments, nominations } = getApplicationData(qrId);
  const results = db.prepare('SELECT enrollment_id, metrics, tipo FROM sociometric_results WHERE qr_id = ?').all(qrId);
  const byEnroll = Object.fromEntries(results.map(x => [x.enrollment_id, { ...JSON.parse(x.metrics), tipo: x.tipo }]));
  const alerted = new Set(db.prepare("SELECT DISTINCT enrollment_id FROM alerts WHERE qr_id = ? AND status NOT IN ('Cerrado','Descartado')").all(qrId).map(x => x.enrollment_id));
  res.json({
    nodes: enrollments.map(e => ({
      id: e.id,
      nombre: `${e.nombres} ${e.apellido_paterno}`,
      genero: e.genero,
      tipo: byEnroll[e.id]?.tipo || 'Sin calcular',
      npr: byEnroll[e.id]?.NPR ?? 0,
      alerta: alerted.has(e.id)
    })),
    edges: nominations.map(n => ({ source: n.source, target: n.target_enrollment_id, kind: n.kind, rank: n.rank }))
  });
});

// Salud emocional del grupo
r.get('/applications/:id/emotional', requireRole('admin', 'counselor', 'teacher'), (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  audit(req, 'consulta_emocional_grupo', `qr:${req.params.id}`);
  const rows = db.prepare(`
    SELECT er.score, er.level, er.sections, s.matricula, s.nombres, s.apellido_paterno, r.enrollment_id
    FROM emotional_results er
    JOIN responses r ON r.id = er.response_id
    JOIN enrollments e ON e.id = r.enrollment_id
    JOIN students s ON s.id = e.student_id
    WHERE r.qr_id = ?
    ORDER BY er.score DESC
  `).all(req.params.id);
  res.json(rows.map(x => ({ ...x, sections: x.sections ? JSON.parse(x.sections) : null })));
});

// Segregación
r.get('/applications/:id/segregation', (req, res) => {
  if (!assertVisible(req, res, req.params.id)) return;
  const rows = db.prepare('SELECT * FROM segregation_indices WHERE qr_id = ?').all(req.params.id);
  res.json(rows.map(x => ({ ...x, detail: JSON.parse(x.detail || '{}'), label: segregationLabel(x.value) })));
});

// Perfil personal (sección 13)
r.get('/applications/:id/profile/:enrollmentId', (req, res) => {
  const app_ = assertVisible(req, res, req.params.id);
  if (!app_) return;
  const qrId = Number(req.params.id), eid = Number(req.params.enrollmentId);
  audit(req, 'consulta_perfil', `enrollment:${eid}`);
  const alumno = db.prepare(`
    SELECT s.*, e.estado AS estado_inscripcion, g.plan_estudios, g.semestre, g.letra, g.turno
    FROM enrollments e JOIN students s ON s.id = e.student_id JOIN groups g ON g.id = e.group_id
    WHERE e.id = ?`).get(eid);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
  const resp = db.prepare('SELECT status, folio, submitted_at FROM responses WHERE qr_id = ? AND enrollment_id = ?').get(qrId, eid);
  const socio = db.prepare('SELECT metrics, tipo FROM sociometric_results WHERE qr_id = ? AND enrollment_id = ?').get(qrId, eid);
  const emo = db.prepare(`
    SELECT er.score, er.level, er.sections FROM emotional_results er
    JOIN responses r ON r.id = er.response_id WHERE r.qr_id = ? AND r.enrollment_id = ?`).get(qrId, eid);
  const alerts = db.prepare('SELECT * FROM alerts WHERE qr_id = ? AND enrollment_id = ?').all(qrId, eid);
  const obs = db.prepare('SELECT o.*, u.name AS autor FROM observations o JOIN users u ON u.id = o.user_id WHERE o.student_id = ? ORDER BY o.created_at DESC').all(alumno.id);
  const relaciones = personalRelationships(qrId, eid).map(x => ({ ...x, etiqueta_distancia: distanceLabel(x.distancia) }));
  const metrics = socio ? JSON.parse(socio.metrics) : null;
  res.json({
    alumno,
    estado_respuesta: resp || { status: 'no_iniciado' },
    sociometria: metrics ? { ...metrics, tipo: socio.tipo } : null,
    semaforos: metrics ? {
      popularidad: metrics.zP > 0.5 ? { color: 'Verde', texto: 'Alta aceptación' }
        : metrics.zP > -0.5 ? { color: 'Amarillo', texto: 'Integración media' }
        : { color: 'Rojo', texto: 'Baja visibilidad positiva' },
      rechazo: metrics.zN <= 0 ? { color: 'Verde', texto: 'Bajo nivel de rechazo' }
        : metrics.zN <= 0.5 ? { color: 'Amarillo', texto: 'Requiere observación' }
        : metrics.zN <= 1 ? { color: 'Naranja', texto: 'Atención prioritaria' }
        : { color: 'Rojo', texto: 'Alerta alta de rechazo social' },
      explicacion: 'Semáforos calculados con puntuaciones estandarizadas (z) de nominaciones recibidas dentro del grupo. Son indicadores preventivos, no diagnósticos.'
    } : null,
    salud_emocional: emo ? { ...emo, sections: JSON.parse(emo.sections || '{}') } : null,
    relaciones,
    alertas: alerts,
    observaciones: obs
  });
});

// Observaciones (profesor/orientador/admin)
r.post('/students/:studentId/observations', requireRole('admin', 'teacher', 'counselor'), (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  db.prepare('INSERT INTO observations (student_id, user_id, text) VALUES (?, ?, ?)').run(req.params.studentId, req.user.id, text);
  audit(req, 'alta_observacion', `student:${req.params.studentId}`);
  res.json({ ok: true });
});

export default r;
