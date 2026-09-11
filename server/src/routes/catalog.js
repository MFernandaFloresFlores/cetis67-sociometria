// routes/catalog.js — Gestión ABC (Altas, Bajas, Cambios) e importación.
// Regla: nunca borrar historial; todo cambio queda auditado con valores anteriores y nuevos.
import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { db, groupName } from '../db.js';
import { requireAuth, requireRole, audit, visibleGroupIds } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const CATALOGS = {
  plan_estudios: ['Programación', 'Contabilidad', 'Construcción', 'Inteligencia de Negocios', 'Ciberseguridad'],
  semestre: ['1ro o 2do', '3ro o 4to', '5to o 6to'],
  grupo: ['A', 'B', 'C'],
  turno: ['Matutino', 'Vespertino']
};
r.get('/catalogs', (req, res) => res.json(CATALOGS));

// ---- Periodos ----
r.get('/periods', (req, res) => res.json(db.prepare('SELECT * FROM academic_periods ORDER BY id DESC').all()));
r.post('/periods', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const info = db.prepare('INSERT INTO academic_periods (name) VALUES (?)').run(name);
  audit(req, 'alta_periodo', name, 'ok', { nuevo: { name } });
  res.json({ id: info.lastInsertRowid, name });
});

// ---- Profesores ----
r.get('/teachers', requireRole('admin', 'counselor'), (req, res) =>
  res.json(db.prepare('SELECT * FROM teachers WHERE active = 1').all()));
r.post('/teachers', requireRole('admin'), (req, res) => {
  const { name, email } = req.body;
  const info = db.prepare('INSERT INTO teachers (name, email) VALUES (?, ?)').run(name, email || null);
  audit(req, 'alta_profesor', name, 'ok', { nuevo: { name, email } });
  res.json({ id: info.lastInsertRowid });
});

// ---- Grupos ----
r.get('/groups', (req, res) => {
  const ids = visibleGroupIds(req.user);
  if (!ids.length) return res.json([]);
  const rows = db.prepare(`
    SELECT g.*, p.name AS periodo, t.name AS profesor,
      (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = g.id AND e.estado != 'baja') AS alumnos
    FROM groups g
    JOIN academic_periods p ON p.id = g.period_id
    LEFT JOIN teachers t ON t.id = g.teacher_id
    WHERE g.id IN (${ids.map(() => '?').join(',')}) AND g.active = 1
  `).all(...ids);
  res.json(rows.map(g => ({ ...g, nombre: groupName(g) })));
});
r.post('/groups', requireRole('admin'), (req, res) => {
  const { period_id, plan_estudios, semestre, letra, turno, teacher_id } = req.body;
  for (const [k, v] of [['plan_estudios', plan_estudios], ['semestre', semestre], ['turno', turno]]) {
    const cat = k === 'plan_estudios' ? CATALOGS.plan_estudios : k === 'semestre' ? CATALOGS.semestre : CATALOGS.turno;
    if (!cat.includes(v)) return res.status(400).json({ error: `Valor inválido en ${k}: ${v}` });
  }
  if (!CATALOGS.grupo.includes(letra)) return res.status(400).json({ error: `Grupo inválido: ${letra}` });
  try {
    const info = db.prepare(`INSERT INTO groups (period_id, plan_estudios, semestre, letra, turno, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)`).run(period_id, plan_estudios, semestre, letra, turno, teacher_id || null);
    audit(req, 'alta_grupo', `grupo:${info.lastInsertRowid}`, 'ok', { nuevo: req.body });
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Ese grupo ya existe en el periodo.' });
  }
});

// Editar grupo: valida catálogos y unicidad, audita valores anteriores y nuevos.
r.put('/groups/:id', requireRole('admin'), (req, res) => {
  const old = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Grupo no encontrado' });
  const { period_id, plan_estudios, semestre, letra, turno, teacher_id } = req.body;
  for (const [k, v] of [['plan_estudios', plan_estudios], ['semestre', semestre], ['turno', turno]]) {
    const cat = k === 'plan_estudios' ? CATALOGS.plan_estudios : k === 'semestre' ? CATALOGS.semestre : CATALOGS.turno;
    if (!cat.includes(v)) return res.status(400).json({ error: `Valor inválido en ${k}: ${v}` });
  }
  if (!CATALOGS.grupo.includes(letra)) return res.status(400).json({ error: `Grupo inválido: ${letra}` });
  if (!db.prepare('SELECT id FROM academic_periods WHERE id = ?').get(period_id)) {
    return res.status(400).json({ error: 'Periodo inválido' });
  }
  const dup = db.prepare(`SELECT id FROM groups WHERE period_id = ? AND plan_estudios = ? AND semestre = ? AND letra = ? AND turno = ? AND id != ?`)
    .get(period_id, plan_estudios, semestre, letra, turno, old.id);
  if (dup) return res.status(400).json({ error: 'Ya existe otro grupo con esos mismos datos en ese periodo.' });
  const nuevo = { period_id, plan_estudios, semestre, letra, turno, teacher_id: teacher_id || null };
  db.prepare(`UPDATE groups SET period_id = ?, plan_estudios = ?, semestre = ?, letra = ?, turno = ?, teacher_id = ? WHERE id = ?`)
    .run(nuevo.period_id, nuevo.plan_estudios, nuevo.semestre, nuevo.letra, nuevo.turno, nuevo.teacher_id, old.id);
  audit(req, 'edicion_grupo', `grupo:${old.id}`, 'ok', { old, nuevo });
  res.json({ ok: true });
});

// Eliminar grupo: solo si nunca tuvo alumnos inscritos (ni de baja); si tuvo, el
// historial no se borra y hay que dejarlo inactivo en su lugar.
r.delete('/groups/:id', requireRole('admin'), (req, res) => {
  const old = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Grupo no encontrado' });
  const { motivo } = req.body || {};
  if (!motivo) return res.status(400).json({ error: 'El motivo es obligatorio.' });
  const tieneAlumnos = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE group_id = ?').get(old.id).n;
  if (tieneAlumnos > 0) {
    return res.status(409).json({ error: `Este grupo tiene ${tieneAlumnos} alumno(s) con historial y no se puede eliminar. Da de baja a los alumnos o desactiva el grupo en su lugar.` });
  }
  db.prepare('DELETE FROM teacher_groups WHERE group_id = ?').run(old.id);
  db.prepare('DELETE FROM groups WHERE id = ?').run(old.id);
  audit(req, 'eliminacion_grupo', `grupo:${old.id}`, 'ok', { motivo, old });
  res.json({ ok: true });
});

// ---- Alumnos ----
r.get('/students', (req, res) => {
  const ids = visibleGroupIds(req.user);
  if (!ids.length) return res.json([]);
  const { group_id, q } = req.query;
  let sql = `
    SELECT s.*, e.id AS enrollment_id, e.group_id, e.estado AS estado_inscripcion,
           g.plan_estudios, g.semestre, g.letra, g.turno, p.name AS periodo
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    JOIN groups g ON g.id = e.group_id
    JOIN academic_periods p ON p.id = e.period_id
    WHERE e.group_id IN (${ids.map(() => '?').join(',')})`;
  const params = [...ids];
  if (group_id) { sql += ' AND e.group_id = ?'; params.push(group_id); }
  if (q) { sql += ' AND (s.matricula LIKE ? OR s.nombres LIKE ? OR s.apellido_paterno LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY s.apellido_paterno, s.nombres';
  res.json(db.prepare(sql).all(...params));
});

// Validaciones compartidas por alta e edición de alumnos.
function validarDatosAlumno(b) {
  if (!b.nombres?.trim()) return 'El nombre es obligatorio.';
  if (!b.apellido_paterno?.trim()) return 'El apellido paterno es obligatorio.';
  if (b.edad !== undefined && b.edad !== null && b.edad !== '') {
    const edad = Number(b.edad);
    if (!Number.isInteger(edad) || edad < 12 || edad > 60) return `Edad inválida: ${b.edad} (debe ser un entero entre 12 y 60).`;
  }
  if (b.correo_institucional && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.correo_institucional)) {
    return `Correo inválido: ${b.correo_institucional}`;
  }
  return null;
}

r.post('/students', requireRole('admin'), (req, res) => {
  const b = req.body;
  const required = ['matricula', 'nombres', 'apellido_paterno', 'group_id', 'period_id'];
  for (const f of required) if (!b[f]) return res.status(400).json({ error: `Campo requerido: ${f}` });
  const errorValidacion = validarDatosAlumno(b);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });
  const dup = db.prepare('SELECT e.id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE s.matricula = ? AND e.period_id = ?')
    .get(b.matricula, b.period_id);
  if (dup) return res.status(400).json({ error: `La matrícula ${b.matricula} ya está inscrita en este periodo.` });
  if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(b.group_id)) return res.status(400).json({ error: 'Grupo inválido' });
  if (!db.prepare('SELECT id FROM academic_periods WHERE id = ?').get(b.period_id)) return res.status(400).json({ error: 'Periodo inválido' });
  let student = db.prepare('SELECT * FROM students WHERE matricula = ?').get(b.matricula);
  if (!student) {
    const info = db.prepare(`INSERT INTO students (matricula, nombres, apellido_paterno, apellido_materno, genero, edad, correo_institucional, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(b.matricula, b.nombres, b.apellido_paterno, b.apellido_materno || null, b.genero || null, b.edad || null, b.correo_institucional || null, b.observaciones || null);
    student = { id: info.lastInsertRowid };
  }
  db.prepare('INSERT INTO enrollments (student_id, group_id, period_id) VALUES (?, ?, ?)').run(student.id, b.group_id, b.period_id);
  audit(req, 'alta_alumno', `matricula:${b.matricula}`, 'ok', { nuevo: b });
  res.json({ id: student.id });
});

// Baja: no borra historial, cambia estado. Motivo obligatorio.
r.post('/students/:enrollmentId/baja', requireRole('admin'), (req, res) => {
  const { motivo } = req.body;
  if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo de la baja es obligatorio.' });
  const old = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.enrollmentId);
  if (!old) return res.status(404).json({ error: 'Inscripción no encontrada' });
  if (old.estado === 'baja') return res.status(400).json({ error: 'Este alumno ya estaba dado de baja.' });
  db.prepare("UPDATE enrollments SET estado = 'baja' WHERE id = ?").run(old.id);
  audit(req, 'baja_alumno', `enrollment:${old.id}`, 'ok', { motivo, old, nuevo: { ...old, estado: 'baja' } });
  res.json({ ok: true });
});

// Cambio de grupo: no altera respuestas anteriores. El grupo destino debe existir
// y pertenecer al mismo periodo (la inscripción es única por alumno+periodo).
r.post('/students/:enrollmentId/cambio-grupo', requireRole('admin'), (req, res) => {
  const { group_id, motivo } = req.body;
  if (!group_id || !motivo?.trim()) return res.status(400).json({ error: 'Grupo destino y motivo son obligatorios.' });
  const old = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.enrollmentId);
  if (!old) return res.status(404).json({ error: 'Inscripción no encontrada' });
  const destino = db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id);
  if (!destino) return res.status(400).json({ error: 'Grupo destino inválido.' });
  if (destino.period_id !== old.period_id) return res.status(400).json({ error: 'El grupo destino debe pertenecer al mismo periodo escolar del alumno.' });
  if (String(destino.id) === String(old.group_id)) return res.status(400).json({ error: 'El alumno ya pertenece a ese grupo.' });
  db.prepare('UPDATE enrollments SET group_id = ?, estado = ? WHERE id = ?').run(group_id, 'inscrito', old.id);
  audit(req, 'cambio_grupo', `enrollment:${old.id}`, 'ok', { motivo, old, nuevo: { ...old, group_id } });
  res.json({ ok: true });
});

// Editar datos del alumno (corrige errores de captura). No toca su inscripción/historial.
r.put('/students/:id', requireRole('admin'), (req, res) => {
  const old = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Alumno no encontrado' });
  const b = req.body;
  const errorValidacion = validarDatosAlumno(b);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });
  const nuevo = {
    nombres: b.nombres.trim(), apellido_paterno: b.apellido_paterno.trim(),
    apellido_materno: b.apellido_materno?.trim() || null, genero: b.genero?.trim() || null,
    edad: b.edad ? Number(b.edad) : null, correo_institucional: b.correo_institucional?.trim() || null,
    observaciones: b.observaciones?.trim() || null
  };
  db.prepare(`UPDATE students SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, genero = ?, edad = ?, correo_institucional = ?, observaciones = ? WHERE id = ?`)
    .run(nuevo.nombres, nuevo.apellido_paterno, nuevo.apellido_materno, nuevo.genero, nuevo.edad, nuevo.correo_institucional, nuevo.observaciones, old.id);
  audit(req, 'edicion_alumno', `matricula:${old.matricula}`, 'ok', { old, nuevo });
  res.json({ ok: true });
});

// Eliminar inscripción: solo si el alumno nunca respondió nada ni tiene alertas/
// menciones en ese periodo — de lo contrario se pierde trazabilidad y debe usarse Baja.
r.delete('/students/:enrollmentId', requireRole('admin'), (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo?.trim()) return res.status(400).json({ error: 'El motivo es obligatorio.' });
  const old = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.enrollmentId);
  if (!old) return res.status(404).json({ error: 'Inscripción no encontrada' });
  const tieneRespuestas = db.prepare('SELECT COUNT(*) AS n FROM responses WHERE enrollment_id = ?').get(old.id).n;
  const esMencionado = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM nominations WHERE target_enrollment_id = ?) +
      (SELECT COUNT(*) FROM perceptions WHERE target_enrollment_id = ?) AS n
  `).get(old.id, old.id).n;
  const tieneAlertas = db.prepare('SELECT COUNT(*) AS n FROM alerts WHERE enrollment_id = ?').get(old.id).n;
  if (tieneRespuestas > 0 || esMencionado > 0 || tieneAlertas > 0) {
    return res.status(409).json({ error: 'Este alumno ya tiene respuestas, menciones de compañeros o alertas registradas. No se puede eliminar sin perder ese historial — usa Baja en su lugar.' });
  }
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(old.student_id);
  // sociometric_results es una caché derivada (se reconstruye con "Recalcular"), no historial real.
  db.prepare('DELETE FROM sociometric_results WHERE enrollment_id = ?').run(old.id);
  db.prepare('DELETE FROM enrollments WHERE id = ?').run(old.id);
  const otrasInscripciones = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE student_id = ?').get(student.id).n;
  const tieneObservaciones = db.prepare('SELECT COUNT(*) AS n FROM observations WHERE student_id = ?').get(student.id).n;
  let studentEliminado = false;
  if (otrasInscripciones === 0 && tieneObservaciones === 0) {
    db.prepare('DELETE FROM students WHERE id = ?').run(student.id);
    studentEliminado = true;
  }
  audit(req, 'eliminacion_alumno', `matricula:${student.matricula}`, 'ok', { motivo, old: { ...old, alumno: student }, nuevo: { studentEliminado } });
  res.json({ ok: true, studentEliminado });
});

// ---- Importación Excel/CSV (sección 07) ----
const TEMPLATE = ['matricula','nombres','apellido_paterno','apellido_materno','genero','edad','plan_estudios','semestre','grupo','turno','correo_institucional','estado','periodo_escolar'];

r.get('/import/template', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla_alumnos.csv');
  res.send(TEMPLATE.join(',') + '\n');
});

// Paso 1: subir archivo → vista previa con hojas, encabezados y validaciones
r.post('/import/preview', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido (.xlsx, .xls o .csv)' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = req.body.sheet || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const missingHeaders = TEMPLATE.filter(c => !headers.includes(c) && !['correo_institucional','estado','apellido_materno','observaciones'].includes(c));
  const errors = [];
  const seen = new Set();
  let yaInscritos = 0;
  rows.forEach((row, i) => {
    const line = i + 2;
    if (!row.matricula) errors.push({ line, error: 'Matrícula vacía' });
    else if (seen.has(String(row.matricula))) errors.push({ line, error: `Matrícula duplicada en archivo: ${row.matricula}` });
    seen.add(String(row.matricula));
    if (!row.nombres || !row.apellido_paterno) errors.push({ line, error: 'Nombre incompleto' });
    if (row.plan_estudios && !CATALOGS.plan_estudios.includes(row.plan_estudios)) errors.push({ line, error: `Carrera inválida: ${row.plan_estudios}` });
    if (row.semestre && !CATALOGS.semestre.includes(String(row.semestre))) errors.push({ line, error: `Semestre inválido: ${row.semestre}` });
    if (row.grupo && !CATALOGS.grupo.includes(String(row.grupo))) errors.push({ line, error: `Grupo inválido: ${row.grupo}` });
    if (row.turno && !CATALOGS.turno.includes(row.turno)) errors.push({ line, error: `Turno inválido: ${row.turno}` });
    const edad = Number(row.edad);
    if (row.edad !== '' && (!Number.isInteger(edad) || edad < 12 || edad > 60)) errors.push({ line, error: `Edad inválida: ${row.edad}` });
    const yaInscrito = db.prepare(`
      SELECT e.id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN academic_periods p ON p.id = e.period_id
      WHERE s.matricula = ? AND p.name = ?`).get(String(row.matricula), String(row.periodo_escolar));
    if (yaInscrito) yaInscritos++;
  });
  res.json({ sheets: wb.SheetNames, sheet: sheetName, headers, missingHeaders, total: rows.length, preview: rows.slice(0, 10), errors, yaInscritos });
});

// Paso 2: confirmar importación (solo filas válidas)
r.post('/import/confirm', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[req.body.sheet || wb.SheetNames[0]], { defval: '' });
  let imported = 0, updated = 0, skipped = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      try {
        if (!row.matricula || !row.nombres || !row.apellido_paterno) { skipped++; continue; }
        if (validarDatosAlumno(row)) { skipped++; continue; }
        let period = db.prepare('SELECT id FROM academic_periods WHERE name = ?').get(String(row.periodo_escolar));
        if (!period) {
          const info = db.prepare('INSERT INTO academic_periods (name) VALUES (?)').run(String(row.periodo_escolar));
          period = { id: info.lastInsertRowid };
        }
        let group = db.prepare(`SELECT id FROM groups WHERE period_id = ? AND plan_estudios = ? AND semestre = ? AND letra = ? AND turno = ?`)
          .get(period.id, row.plan_estudios, String(row.semestre), String(row.grupo), row.turno);
        if (!group) {
          const info = db.prepare(`INSERT INTO groups (period_id, plan_estudios, semestre, letra, turno) VALUES (?, ?, ?, ?, ?)`)
            .run(period.id, row.plan_estudios, String(row.semestre), String(row.grupo), row.turno);
          group = { id: info.lastInsertRowid };
        }
        // Alumno nuevo: se crea. Alumno ya existente (misma matrícula): se actualizan sus datos
        // (corrige errores de captura como género/edad) sin tocar su historial de grupo.
        let student = db.prepare('SELECT id FROM students WHERE matricula = ?').get(String(row.matricula));
        if (!student) {
          const info = db.prepare(`INSERT INTO students (matricula, nombres, apellido_paterno, apellido_materno, genero, edad, correo_institucional)
            VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(String(row.matricula), row.nombres, row.apellido_paterno, row.apellido_materno || null,
                 row.genero || null, Number(row.edad) || null, row.correo_institucional || null);
          student = { id: info.lastInsertRowid };
          imported++;
        } else {
          db.prepare(`UPDATE students SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, genero = ?, edad = ?, correo_institucional = ? WHERE id = ?`)
            .run(row.nombres, row.apellido_paterno, row.apellido_materno || null,
                 row.genero || null, Number(row.edad) || null, row.correo_institucional || null, student.id);
          updated++;
        }
        // Inscripción: solo se crea si el alumno no estaba ya inscrito en este periodo
        // (evita duplicar; un cambio de grupo real debe hacerse desde "Cambio de grupo", con motivo).
        const yaInscrito = db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND period_id = ?').get(student.id, period.id);
        if (!yaInscrito) db.prepare('INSERT INTO enrollments (student_id, group_id, period_id) VALUES (?, ?, ?)').run(student.id, group.id, period.id);
      } catch { skipped++; }
    }
  });
  tx();
  audit(req, 'importacion_excel', req.file.originalname, 'ok', { nuevo: { imported, updated, skipped } });
  res.json({ imported, updated, skipped, total: rows.length });
});

export default r;
