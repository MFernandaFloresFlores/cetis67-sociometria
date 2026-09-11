import React, { useEffect, useState } from 'react';
import { api, download, toCSV } from '../api.js';
import { useApplications, AppSelector, Chip, AvisoPreventivo } from '../components/UI.jsx';

const NIVELES = ['Verde', 'Amarillo', 'Naranja', 'Rojo'];
const DESCR = {
  Verde: 'Salud emocional estable', Amarillo: 'Algunas áreas necesitan atención',
  Naranja: 'Estrés emocional moderado', Rojo: 'Se recomienda acompañamiento emocional'
};

export default function Emotional() {
  const { apps, sel, setSel } = useApplications();
  const [rows, setRows] = useState([]);
  const [nivel, setNivel] = useState('');

  useEffect(() => { sel && api(`/applications/${sel}/emotional`).then(setRows).catch(() => setRows([])); }, [sel]);

  const dist = NIVELES.map(n => ({ n, c: rows.filter(r => r.level === n).length }));
  const max = Math.max(1, ...dist.map(d => d.c));
  const filtradas = rows.filter(r => !nivel || r.level === nivel);

  const exportar = () => download(`salud_emocional_${sel}.csv`, toCSV(filtradas, [
    { label: 'Matrícula', value: 'matricula' },
    { label: 'Nombre', value: r => `${r.nombres} ${r.apellido_paterno}` },
    { label: 'Puntaje', value: 'score' },
    { label: 'Nivel', value: 'level' }
  ]));

  return (
    <>
      <h1>Salud emocional del grupo</h1>
      <AvisoPreventivo />
      <AppSelector apps={apps} sel={sel} setSel={setSel} />

      <div className="card">
        <h2>Distribución por semáforo</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'end', height: 150 }}>
          {dist.map(d => (
            <div key={d.n} style={{ textAlign: 'center' }}>
              <div style={{
                height: `${(d.c / max) * 110 + 6}px`,
                background: `var(--${d.n.toLowerCase()})`, borderRadius: '8px 8px 0 0',
                display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700
              }}>{d.c}</div>
              <Chip color={d.n}>{d.n}</Chip>
            </div>
          ))}
        </div>
        <p className="nota">Puntaje 0-100; mayor puntaje = mayor malestar reportado. {DESCR.Rojo} para el nivel rojo.</p>
      </div>

      <div className="card">
        <div className="row no-print">
          <label className="f" style={{ maxWidth: 240 }}><span>Filtrar por nivel</span>
            <select value={nivel} onChange={e => setNivel(e.target.value)}>
              <option value="">Todos</option>
              {NIVELES.map(n => <option key={n}>{n}</option>)}
            </select></label>
          <button className="sec" style={{ flex: '0 0 auto' }} onClick={exportar}>Exportar CSV</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th className="num">Puntaje</th><th>Nivel</th><th>Lectura</th></tr></thead>
          <tbody>
            {filtradas.map(r => (
              <tr key={r.enrollment_id}>
                <td><b>{r.nombres} {r.apellido_paterno}</b><br /><span className="nota">{r.matricula}</span></td>
                <td className="num">{r.score}/100</td>
                <td><Chip color={r.level}>{r.level}</Chip></td>
                <td className="nota">{DESCR[r.level]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtradas.length && <p className="nota">Sin registros emocionales para esta aplicación.</p>}
      </div>
    </>
  );
}
