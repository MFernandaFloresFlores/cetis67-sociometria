// create-user.js — Crea o actualiza una cuenta de acceso de personal (admin/docente/orientación/auditoría).
// La plataforma no tiene pantalla de alta de usuarios; este script es la única vía para gestionarlos.
// Uso: node src/create-user.js <usuario> "<Nombre completo>" <admin|teacher|counselor|auditor> <contraseña>
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const ROLES = ['admin', 'teacher', 'counselor', 'auditor'];
const [username, name, role, password] = process.argv.slice(2);

if (!username || !name || !role || !password) {
  console.error('Uso: node src/create-user.js <usuario> "<Nombre completo>" <admin|teacher|counselor|auditor> <contraseña>');
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Rol inválido "${role}". Usa uno de: ${ROLES.join(', ')}`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE users SET name = ?, role = ?, password_hash = ?, active = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?')
    .run(name, role, hash, existing.id);
  console.log(`Usuario "${username}" actualizado (rol: ${role}).`);
} else {
  db.prepare('INSERT INTO users (username, name, role, password_hash) VALUES (?, ?, ?, ?)').run(username, name, role, hash);
  console.log(`Usuario "${username}" creado (rol: ${role}).`);
}
