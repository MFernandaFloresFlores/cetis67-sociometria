import React, { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { useApplications, AppSelector } from '../components/UI.jsx';

export default function Matrix() {
  const { apps, sel, setSel } = useApplications();
  const [data, setData] = useState(null);
  const [vista, setVista] = useState('nominaciones');

  useEffect(() => { sel && api(`/applications/${sel}/matrix`).then(setData).catch(() => {}); }, [sel]);

  if (!data) return <><h1>Matriz sociométrica</h1><AppSelector apps={apps} sel={sel} setSel={setSel} /></>;

  const links = vista === 'nominaciones' ? data.nominations : data.perceptions;
  const cell = {};
  for (const l of links) {
    const k = `${l.source}-${l.target}`;
    cell[k] = cell[k] ? 'ambos' : l.kind;
  }
  const marca = { pos: '+', neg: '−', ambos: '±' };

  const exportar = () => {
    const header = ['Emisor \\ Receptor', ...data.students.map(s => s.nombre)].join(',');
    const rows = data.students.map(f =>
      [f.nombre, ...data.students.map(c => f.id === c.id ? '' : (marca[cell[`${f.id}-${c.id}`]] || ''))].join(','));
    download(`matriz_${vista}_${sel}.csv`, [header, ...rows].join('\n'));
  };

  return (
    <>
      <h1>Matriz sociométrica</h1>
      <AppSelector apps={apps} sel={sel} setSel={setSel} />
      <div className="card">
        <div className="row no-print" style={{ marginBottom: 10 }}>
          <label className="f" style={{ maxWidth: 260 }}><span>Vista</span>
            <select value={vista} onChange={e => setVista(e.target.value)}>
              <option value="nominaciones">Nominaciones (elecciones reales)</option>
              <option value="percepciones">Percepciones (quién creen que los eligió)</option>
            </select></label>
          <div className="acciones" style={{ flex: '0 0 auto' }}>
            <button className="sec" onClick={exportar}>Exportar CSV</button>
            <button className="sec" onClick={() => window.print()}>Imprimir</button>
          </div>
        </div>
        <p className="nota">Filas: quien emite. Columnas: quien recibe. <b style={{ color: 'var(--verde)' }}>+</b> positiva, <b style={{ color: 'var(--rojo)' }}>−</b> negativa, <b style={{ color: 'var(--naranja)' }}>±</b> ambas.</p>
        <div className="matriz-wrap">
          <table className="matriz">
            <thead>
              <tr>
                <th className="nombre">Emisor \ Receptor</th>
                {data.students.map(s => <th key={s.id} className="rot" title={s.nombre}>{s.nombre.split(' ')[0]} {s.nombre.split(' ')[1]?.[0]}.</th>)}
              </tr>
            </thead>
            <tbody>
              {data.students.map(f => (
                <tr key={f.id}>
                  <th className="nombre">{f.nombre}</th>
                  {data.students.map(c => {
                    if (f.id === c.id) return <td key={c.id} style={{ background: '#eef2f6' }}>·</td>;
                    const v = cell[`${f.id}-${c.id}`];
                    return <td key={c.id} className={v || ''} title={v ? `${f.nombre} → ${c.nombre}` : ''}>{marca[v] || ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
