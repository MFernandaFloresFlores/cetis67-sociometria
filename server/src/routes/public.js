// routes/public.js — Flujo público del alumno vía QR/enlace (secciones 08-11).
// Validaciones: pertenencia al grupo, no autoelección, no repetidos, no doble envío.
import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { SECTIONS, SCALE, scoreEmotional, fieldName } from '../services/emotional.js';

const r = Router();

function getApp(token) {
  return db.prepare(`
    SELECT q.*, f.type AS form_type, f.title,
           g.plan_estudios, g.semestre, g.letra, g.turno
    FROM qr_codes q JOIN forms f ON f.id = q.form_id JOIN groups g ON g.id = q.group_id
    WHERE q.token = ?
  `).get(token);
}

// Info de la aplicación (bienvenida + aviso de privacidad)
r.get('/app/:token', (req, res) => {
  const app_ = getApp(req.params.token);
  if (!app_) return res.status(404).json({ error: 'Enlace no válido' });
  if (app_.status !== 'activo') return res.status(423).json({ error: `Esta aplicación está ${app_.status}. Pregunta a tu profesor.` });
  db.prepare('UPDATE qr_codes SET access_count = access_count + 1 WHERE id = ?').run(app_.id);
  res.json({
    title: app_.title, form_type: app_.form_type,
    grupo: `${app_.semestre} ${app_.letra} ${app_.turno} · ${app_.plan_estudios}`,
    privacidad: 'Tus respuestas son confidenciales y se usan solo con fines preventivos y de acompañamiento escolar. Los resultados no son diagnósticos y serán interpretados por personal capacitado.'
  });
});

// Identificación del alumno: valida pertenencia al grupo. No permite acceso a otro grupo.
r.post('/app/:token/identify', (req, res) => {
  const app_ = getApp(req.params.token);
  if (!app_ || app_.status !== 'activo') return res.status(404).json({ error: 'Enlace no válido o cerrado' });
  const { matricula } = req.body || {};
  const enrollment = db.prepare(`
    SELECT e.id, s.nombres, s.apellido_paterno
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE s.matricula = ? AND e.group_id = ? AND e.estado != 'baja'
  `).get(String(matricula || '').trim(), app_.group_id);
  if (!enrollment) return res.status(403).json({ error: 'Matrícula no encontrada en este grupo. Verifica con tu profesor.' });

  let response = db.prepare('SELECT * FROM responses WHERE qr_id = ? AND enrollment_id = ?').get(app_.id, enrollment.id);
  if (response?.status === 'enviado') {
    return res.status(409).json({ error: 'Ya enviaste tus respuestas. No es posible responder dos veces.', folio: response.folio });
  }
  if (!response) {
    const info = db.prepare("INSERT INTO responses (qr_id, enrollment_id, status) VALUES (?, ?, 'en_progreso')").run(app_.id, enrollment.id);
    response = { id: info.lastInsertRowid, draft: null };
  }
  // Roster del grupo (sin el propio alumno: no autoelección)
  const roster = db.prepare(`
    SELECT e.id, s.nombres || ' ' || s.apellido_paterno || ' ' || COALESCE(s.apellido_materno,'') AS nombre
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.group_id = ? AND e.estado != 'baja' AND e.id != ?
    ORDER BY s.apellido_paterno
  `).all(app_.group_id, enrollment.id);

  res.json({
    response_id: response.id,
    alumno: `${enrollment.nombres} ${enrollment.apellido_paterno}`,
    roster,
    draft: response.draft ? JSON.parse(response.draft) : null,
    emocional: app_.form_type !== 'sociometrico' ? { sections: SECTIONS, scale: SCALE } : null,
    sociometrico: app_.form_type !== 'emocional'
  });
});

// Guardado automático del borrador
r.post('/app/:token/draft/:responseId', (req, res) => {
  const app_ = getApp(req.params.token);
  const resp = db.prepare('SELECT * FROM responses WHERE id = ? AND qr_id = ?').get(req.params.responseId, app_?.id);
  if (!resp || resp.status === 'enviado') return res.status(400).json({ error: 'No se puede guardar' });
  db.prepare('UPDATE responses SET draft = ? WHERE id = ?').run(JSON.stringify(req.body || {}), resp.id);
  res.json({ ok: true });
});

// Envío final: valida y guarda respuestas originales inalterables.
r.post('/app/:token/submit/:responseId', (req, res) => {
  const app_ = getApp(req.params.token);
  if (!app_ || app_.status !== 'activo') return res.status(404).json({ error: 'Enlace no válido o cerrado' });
  const resp = db.prepare('SELECT * FROM responses WHERE id = ? AND qr_id = ?').get(req.params.responseId, app_.id);
  if (!resp) return res.status(404).json({ error: 'Respuesta no encontrada' });
  if (resp.status === 'enviado') return res.status(409).json({ error: 'Ya enviaste tus respuestas.', folio: resp.folio });

  const body = req.body || {};
  const errors = [];

  const validGroupIds = new Set(db.prepare(
    "SELECT id FROM enrollments WHERE group_id = ? AND estado != 'baja'"
  ).all(app_.group_id).map(x => x.id));

  const nomRows = [];
  const percRows = [];
  if (app_.form_type !== 'emocional') {
    const socio = body.sociometrico || {};
    const blocks = [
      ['nom_pos', 'nominations', 'pos', true], ['nom_neg', 'nominations', 'neg', true],
      ['perc_pos', 'perceptions', 'pos', false], ['perc_neg', 'perceptions', 'neg', false]
    ];
    for (const [prefix, table, kind, required] of blocks) {
      const seen = new Set();
      for (let rank = 1; rank <= 3; rank++) {
        const val = socio[`${prefix}_${rank}`];
        if (!val) { if (required && rank === 1) errors.push(`Debes elegir al menos una persona en ${prefix}_1`); continue; }
        const target = Number(val);
        if (target === resp.enrollment_id) { errors.push('No puedes elegirte a ti mismo/a.'); continue; }
        if (!validGroupIds.has(target)) { errors.push('Una elección no pertenece a tu grupo.'); continue; }
        if (seen.has(target)) { errors.push('No puedes repetir al mismo compañero en una misma pregunta.'); continue; }
        seen.add(target);
        const row = { kind, rank, target, reason: socio[`${prefix}_${rank}_motivo`] || null };
        (table === 'nominations' ? nomRows : percRows).push(row);
      }
    }
  }

  let emotional = null;
  if (app_.form_type !== 'sociometrico') {
    const answers = body.emocional || {};
    for (let i = 1; i <= 25; i++) {
      if (answers[fieldName(i)] === undefined || answers[fieldName(i)] === '') {
        errors.push(`Falta responder la pregunta ${i} del test emocional.`);
      }
    }
    if (!errors.length) {
      try { emotional = { answers, result: scoreEmotional(answers) }; }
      catch (e) { errors.push(e.message); }
    }
  }

  if (!body.consentimiento) errors.push('Debes aceptar el aviso de privacidad para enviar.');
  if (errors.length) return res.status(400).json({ errors });

  const folio = 'C67-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const tx = db.transaction(() => {
    for (const n of nomRows) {
      db.prepare('INSERT INTO nominations (response_id, kind, rank, target_enrollment_id, reason) VALUES (?, ?, ?, ?, ?)')
        .run(resp.id, n.kind, n.rank, n.target, n.reason);
    }
    for (const p of percRows) {
      db.prepare('INSERT INTO perceptions (response_id, kind, rank, target_enrollment_id) VALUES (?, ?, ?, ?)')
        .run(resp.id, p.kind, p.rank, p.target);
    }
    if (emotional && !emotional.result.incomplete) {
      db.prepare('INSERT INTO emotional_results (response_id, answers, score, level, sections) VALUES (?, ?, ?, ?, ?)')
        .run(resp.id, JSON.stringify(emotional.answers), emotional.result.score, emotional.result.color, JSON.stringify(emotional.result.sections));
    }
    db.prepare("UPDATE responses SET status = 'enviado', folio = ?, submitted_at = datetime('now'), draft = NULL WHERE id = ?")
      .run(folio, resp.id);
  });
  tx();
  res.json({ ok: true, folio, mensaje: '¡Gracias! Tus respuestas fueron enviadas correctamente.' });
});

export default r;
