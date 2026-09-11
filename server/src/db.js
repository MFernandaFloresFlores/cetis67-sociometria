// db.js — Esquema y conexión SQLite (node:sqlite, integrado en Node 22+, sin dependencias nativas).
// Entidades según sección 29 del requerimiento.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const raw = new DatabaseSync(path.join(DATA_DIR, 'cetis67.db'));
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

// Wrapper con la misma superficie que better-sqlite3 (prepare/run/get/all/exec/transaction)
export const db = {
  exec: sql => raw.exec(sql),
  prepare: sql => raw.prepare(sql),
  transaction: fn => (...args) => {
    raw.exec('BEGIN');
    try { const out = fn(...args); raw.exec('COMMIT'); return out; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','counselor','auditor','dev')),
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  user_id INTEGER REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES academic_periods(id),
  plan_estudios TEXT NOT NULL,
  semestre TEXT NOT NULL,
  letra TEXT NOT NULL,
  turno TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id),
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (period_id, plan_estudios, semestre, letra, turno)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  genero TEXT,
  edad INTEGER,
  correo_institucional TEXT,
  estado TEXT NOT NULL DEFAULT 'activo',
  observaciones TEXT,
  fecha_registro TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regla de unicidad: matricula + periodo (via inscripción). El alumno es permanente.
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  period_id INTEGER NOT NULL REFERENCES academic_periods(id),
  estado TEXT NOT NULL DEFAULT 'inscrito', -- inscrito | baja | cambio
  pin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, period_id)
);

CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sociometrico','emocional','combinado')),
  status TEXT NOT NULL DEFAULT 'borrador', -- borrador|activo|pausado|cerrado|archivado
  version INTEGER NOT NULL DEFAULT 1,
  parent_form_id INTEGER REFERENCES forms(id),
  definition TEXT, -- JSON con preguntas (versionado)
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS form_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id),
  version INTEGER NOT NULL,
  definition TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "Aplicación": un formulario aplicado a un grupo, con QR/enlace propio.
CREATE TABLE IF NOT EXISTS qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'activo', -- activo|pausado|cerrado|desactivado
  access_count INTEGER NOT NULL DEFAULT 0,
  closes_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id INTEGER NOT NULL REFERENCES qr_codes(id),
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  status TEXT NOT NULL DEFAULT 'en_progreso', -- no_iniciado|en_progreso|completado|enviado|invalidado|reabierto
  folio TEXT,
  draft TEXT, -- guardado automático (JSON)
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  UNIQUE (qr_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS nominations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES responses(id),
  kind TEXT NOT NULL CHECK (kind IN ('pos','neg')),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  target_enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS perceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES responses(id),
  kind TEXT NOT NULL CHECK (kind IN ('pos','neg')),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  target_enrollment_id INTEGER NOT NULL REFERENCES enrollments(id)
);

CREATE TABLE IF NOT EXISTS emotional_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER UNIQUE NOT NULL REFERENCES responses(id),
  answers TEXT NOT NULL, -- JSON emo_01..emo_25 (respuestas originales inalterables)
  score INTEGER NOT NULL,
  level TEXT NOT NULL,   -- Verde|Amarillo|Naranja|Rojo
  sections TEXT          -- JSON puntajes por sección
);

CREATE TABLE IF NOT EXISTS sociometric_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id INTEGER NOT NULL REFERENCES qr_codes(id),
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  metrics TEXT NOT NULL, -- JSON con todos los índices individuales
  tipo TEXT NOT NULL,    -- Preferido|Rechazado|Ignorado|Controvertido|Promedio
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (qr_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS group_indices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id INTEGER UNIQUE NOT NULL REFERENCES qr_codes(id),
  metrics TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS segregation_indices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id INTEGER NOT NULL REFERENCES qr_codes(id),
  dimension TEXT NOT NULL,
  relationship TEXT NOT NULL,
  h_observed REAL, h_expected REAL, value REAL,
  detail TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (qr_id, dimension, relationship)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id INTEGER REFERENCES qr_codes(id),
  enrollment_id INTEGER REFERENCES enrollments(id),
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Media', -- Baja|Media|Alta|Urgente
  status TEXT NOT NULL DEFAULT 'Nuevo',   -- Nuevo|Pendiente|En valoración|En seguimiento|Canalizado|Cerrado|Descartado
  description TEXT,
  assigned_to INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (qr_id, enrollment_id, type)
);

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL REFERENCES alerts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, -- nota|entrevista|contacto|acuerdo|cambio_estado|cierre
  note TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, rol TEXT, accion TEXT NOT NULL,
  recurso TEXT, resultado TEXT NOT NULL DEFAULT 'ok',
  motivo TEXT, datos_anteriores TEXT, datos_nuevos TEXT,
  ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teacher_groups (
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  PRIMARY KEY (teacher_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_group ON enrollments(group_id);
CREATE INDEX IF NOT EXISTS idx_resp_qr ON responses(qr_id);
CREATE INDEX IF NOT EXISTS idx_nom_resp ON nominations(response_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_logs(created_at);
`);

export function groupName(g) {
  return `${g.semestre} ${g.letra} ${g.turno} · ${g.plan_estudios}`;
}
