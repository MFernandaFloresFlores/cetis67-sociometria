import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApplications, AppSelector, Chip, tipoColor, prioColor, AvisoPreventivo, useUser } from '../components/UI.jsx';

export default function Dashboard() {
  const { apps, sel, setSel, app } = useApplications();
  const [results, setResults] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const user = useUser();

  useEffect(() => {
    if (!sel) return;
    api(`/applications/${sel}/results`).then(setResults).catch(() => setResults(null));
    if (['admin', 'counselor', 'teacher'].includes(user?.role)) {
      api('/alerts').then(a => setAlerts(a.filter(x => !['Cerrado', 'Descartado'].includes(x.status)).slice(0, 6))).catch(() => {});
    }
  }, [sel]);

  const g = results?.group;
  const part = g?.participacion;

  return (
    <>
      <h1>Inicio</h1>
      <AvisoPreventivo />
      {apps.length === 0 && <div className="card">Aún no hay aplicaciones. {user?.role === 'admin' && <>Crea una en <Link to="/formularios">Formularios y QR</Link>.</>}</div>}
      {apps.length > 0 && <AppSelector apps={apps} sel={sel} setSel={setSel} />}

      {g && (
        <div className="cards c3">
          <div className="card kpi">
            <div className="num">{part.pct}%</div>
            <div className="lbl">Participación ({part.sent}/{part.total}) <Chip color={part.level}>{part.level === 'Verde' ? 'Suficiente' : part.level === 'Amarillo' ? 'Aceptable' : 'Insuficiente'}</Chip></div>
          </div>
          <div className="card kpi">
            <div className="num">{g.densidad}</div>
            <div className="lbl">Densidad de elecciones positivas</div>
          </div>
          <div className="card kpi">
            <div className="num">{g.promedio_amistades}</div>
            <div className="lbl">Amistades recíprocas por alumno</div>
          </div>
          <div className="card kpi">
            <div className="num">{alerts.length}</div>
            <div className="lbl">Alertas abiertas recientes</div>
          </div>
        </div>
      )}

      {g && (
        <div className="card">
          <h2>Distribución de tipos sociométricos</h2>
          <div className="acciones" style={{ gap: 12 }}>
            {Object.entries(g.tipos).map(([t, n]) => (
              <Chip key={t} color={tipoColor(t)}>{t}: {n}</Chip>
            ))}
          </div>
          <p className="nota">La clasificación usa puntuaciones estandarizadas de nominaciones recibidas (método de tipos sociométricos).</p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="card">
          <h2>Alertas que requieren revisión</h2>
          <table className="tbl">
            <thead><tr><th>Alumno</th><th>Tipo</th><th>Prioridad</th><th>Estado</th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td>{a.nombres} {a.apellido_paterno}</td>
                  <td>{a.type}</td>
                  <td><Chip color={prioColor(a.priority)}>{a.priority}</Chip></td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginBottom: 0 }}><Link to="/alertas">Ir a alertas y seguimiento →</Link></p>
        </div>
      )}
    </>
  );
}
