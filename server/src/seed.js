// seed.js — Datos semilla: usuarios, periodo, grupo demo con 24 alumnos,
// una aplicación combinada y respuestas simuladas para verificar los criterios de aceptación.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.js';
import { fieldName, scoreEmotional } from './services/emotional.js';
import { computeApplication } from './services/sociometry.js';

const hash = p => bcrypt.hashSync(p, 10);

const already = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (already > 0) {
  console.log('La base ya tiene datos. Borra server/data/cetis67.db para re-sembrar.');
  process.exit(0);
}

const tx = db.transaction(() => {
  // Usuarios
  const users = [
    ['admin', 'Dirección CETIS 67', 'admin', 'admin123'],
    ['profe.laura', 'Laura Méndez', 'teacher', 'profe123'],
    ['orientacion', 'Orientación Educativa', 'counselor', 'orienta123'],
    ['auditor', 'Auditoría', 'auditor', 'audita123']
  ];
  const userIds = {};
  for (const [username, name, role, pass] of users) {
    const info = db.prepare('INSERT INTO users (username, name, role, password_hash, email) VALUES (?, ?, ?, ?, ?)')
      .run(username, name, role, hash(pass), `${username}@cetis67.edu.mx`);
    userIds[username] = info.lastInsertRowid;
  }

  const period = db.prepare("INSERT INTO academic_periods (name) VALUES ('2026-2027 A')").run().lastInsertRowid;
  const teacher = db.prepare('INSERT INTO teachers (name, email, user_id) VALUES (?, ?, ?)')
    .run('Laura Méndez', 'profe.laura@cetis67.edu.mx', userIds['profe.laura']).lastInsertRowid;
  const group = db.prepare(`INSERT INTO groups (period_id, plan_estudios, semestre, letra, turno, teacher_id)
    VALUES (?, 'Programación', '1ro o 2do', 'A', 'Matutino', ?)`).run(period, teacher).lastInsertRowid;

  const nombres = [
    ['Ana', 'García', 'López', 'F'], ['Luis', 'Hernández', 'Pérez', 'M'], ['María', 'Martínez', 'Ruiz', 'F'],
    ['José', 'Sánchez', 'Torres', 'M'], ['Valeria', 'Ramírez', 'Flores', 'F'], ['Diego', 'Cruz', 'Gómez', 'M'],
    ['Sofía', 'Morales', 'Díaz', 'F'], ['Carlos', 'Reyes', 'Vargas', 'M'], ['Camila', 'Jiménez', 'Castro', 'F'],
    ['Miguel', 'Torres', 'Ortiz', 'M'], ['Ximena', 'Flores', 'Mendoza', 'F'], ['Andrés', 'Rivera', 'Silva', 'M'],
    ['Regina', 'Gómez', 'Rojas', 'F'], ['Emiliano', 'Díaz', 'Aguilar', 'M'], ['Renata', 'Vázquez', 'Luna', 'F'],
    ['Santiago', 'Castillo', 'Ramos', 'M'], ['Daniela', 'Romero', 'Chávez', 'F'], ['Leonardo', 'Mendoza', 'Ríos', 'M'],
    ['Fernanda', 'Guerrero', 'Núñez', 'F'], ['Pablo', 'Ortega', 'Campos', 'M'], ['Isabela', 'Delgado', 'Vega', 'F'],
    ['Mateo', 'Núñez', 'Salas', 'M'], ['Victoria', 'Salinas', 'Mora', 'F'], ['Iker', 'Peña', 'Cortés', 'M']
  ];
  const enrollIds = [];
  nombres.forEach(([n, ap, am, g], i) => {
    const mat = `26670${String(100 + i)}`;
    const sid = db.prepare(`INSERT INTO students (matricula, nombres, apellido_paterno, apellido_materno, genero, edad, correo_institucional)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(mat, n, ap, am, g, 15 + (i % 3), `${n.toLowerCase()}.${ap.toLowerCase()}@cetis67.edu.mx`).lastInsertRowid;
    const eid = db.prepare('INSERT INTO enrollments (student_id, group_id, period_id) VALUES (?, ?, ?)')
      .run(sid, group, period).lastInsertRowid;
    enrollIds.push(eid);
  });

  // Formulario combinado activo + aplicación con QR
  const form = db.prepare(`INSERT INTO forms (title, type, status, created_by)
    VALUES ('Sociometría y bienestar · Otoño 2026', 'combinado', 'activo', ?)`).run(userIds.admin).lastInsertRowid;
  db.prepare('INSERT INTO form_versions (form_id, version, definition, author_id) VALUES (?, 1, ?, ?)')
    .run(form, JSON.stringify({ type: 'combinado' }), userIds.admin);
  const token = crypto.randomBytes(16).toString('base64url');
  const qr = db.prepare('INSERT INTO qr_codes (form_id, group_id, token) VALUES (?, ?, ?)').run(form, group, token).lastInsertRowid;

  // Respuestas simuladas (22 de 24 = 92% de participación).
  // Escenario: núcleo popular (0-4), un alumno rechazado (índice 7), uno aislado (índice 21 no recibe), un par en conflicto (9↔10).
  const rand = seedRandom(42);
  const pick = (exclude, prefer = []) => {
    const pool = [...prefer.filter(x => !exclude.has(x)), ...enrollIds.filter(x => !exclude.has(x))];
    return pool[Math.floor(rand() * Math.min(pool.length, 8))];
  };
  const popular = enrollIds.slice(0, 5);
  const rejected = enrollIds[7];
  const conflictA = enrollIds[9], conflictB = enrollIds[10];

  enrollIds.slice(0, 22).forEach((eid, idx) => {
    const rid = db.prepare("INSERT INTO responses (qr_id, enrollment_id, status, folio, submitted_at) VALUES (?, ?, 'enviado', ?, datetime('now'))")
      .run(qr, eid, 'C67-' + crypto.randomBytes(4).toString('hex').toUpperCase()).lastInsertRowid;

    // Nominaciones positivas: sesgo hacia el núcleo popular; nadie nomina positivo al índice 21.
    const exclude = new Set([eid, enrollIds[21]]);
    for (let rank = 1; rank <= 3; rank++) {
      const t = pick(exclude, popular);
      exclude.add(t);
      db.prepare('INSERT INTO nominations (response_id, kind, rank, target_enrollment_id) VALUES (?, ?, ?, ?)').run(rid, 'pos', rank, t);
    }
    // Negativas: sesgo hacia el rechazado; conflicto mutuo 9↔10.
    const excludeN = new Set([eid]);
    const negPrefer = eid === conflictA ? [conflictB] : eid === conflictB ? [conflictA] : [rejected];
    for (let rank = 1; rank <= 3; rank++) {
      const t = pick(excludeN, rank === 1 ? negPrefer : [rejected]);
      excludeN.add(t);
      db.prepare('INSERT INTO nominations (response_id, kind, rank, target_enrollment_id) VALUES (?, ?, ?, ?)').run(rid, 'neg', rank, t);
    }
    // Percepciones
    const excP = new Set([eid]);
    for (let rank = 1; rank <= 2; rank++) {
      const t = pick(excP); excP.add(t);
      db.prepare('INSERT INTO perceptions (response_id, kind, rank, target_enrollment_id) VALUES (?, ?, ?, ?)').run(rid, 'pos', rank, t);
    }
    const excN2 = new Set([eid]);
    const tN = pick(excN2, [rejected]);
    db.prepare('INSERT INTO perceptions (response_id, kind, rank, target_enrollment_id) VALUES (?, ?, ?, ?)').run(rid, 'neg', 1, tN);
  });

  // Test emocional: la mayoría estable; rechazado, aislado y un caso más con malestar alto.
  const resps = db.prepare("SELECT id, enrollment_id FROM responses WHERE qr_id = ?").all(qr);
  for (const rp of resps) {
    const distressed = rp.enrollment_id === rejected || rp.enrollment_id === enrollIds[21] || rp.enrollment_id === enrollIds[15];
    const answers = {};
    for (let i = 1; i <= 25; i++) {
      const reverse = [1,5,7,10,11,13,15,16,17,20,21,22,23,25].includes(i);
      let v;
      if (distressed) v = reverse ? Math.floor(rand() * 2) : 3 + Math.floor(rand() * 2);
      else v = reverse ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 2);
      answers[fieldName(i)] = v;
    }
    const result = scoreEmotional(answers);
    db.prepare('INSERT INTO emotional_results (response_id, answers, score, level, sections) VALUES (?, ?, ?, ?, ?)')
      .run(rp.id, JSON.stringify(answers), result.score, result.color, JSON.stringify(result.sections));
  }

  return { qr, token };
});

// Generador pseudoaleatorio reproducible
function seedRandom(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const { qr, token } = tx();
const out = computeApplication(qr);
console.log('Semilla creada.');
console.log(`Participación: ${out.participation.pct}% (${out.participation.sent}/${out.participation.total})`);
console.log(`Enlace público de la aplicación demo: /r/${token}`);
console.log('Usuarios: admin/admin123 · profe.laura/profe123 · orientacion/orienta123 · auditor/audita123');
