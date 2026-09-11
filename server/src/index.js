// index.js — Servidor Express. Sirve la API y el frontend compilado.
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import './db.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import formsRoutes from './routes/forms.js';
import publicRoutes from './routes/public.js';
import resultsRoutes from './routes/results.js';
import alertsRoutes from './routes/alerts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Cabeceras básicas de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'CETIS 67', ts: new Date().toISOString() }));
app.use('/api/public', publicRoutes); // flujo del alumno: sin autenticación, validado por token + matrícula
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', formsRoutes);
app.use('/api', resultsRoutes);
app.use('/api', alertsRoutes);

// Frontend compilado (client/dist). En desarrollo, usar el proxy de Vite.
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno. Consulta la bitácora del servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Plataforma CETIS 67 escuchando en http://localhost:${PORT}`));
