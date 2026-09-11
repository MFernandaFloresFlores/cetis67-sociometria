import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApplications, AppSelector, Chip } from '../components/UI.jsx';

const colorSeg = v => v < 0 ? 'Verde' : v < 0.2 ? 'Verde' : v < 0.4 ? 'Amarillo' : v < 0.6 ? 'Naranja' : 'Rojo';

export default function Segregation() {
  const { apps, sel, setSel } = useApplications();
  const [rows, setRows] = useState([]);

  useEffect(() => { sel && api(`/applications/${sel}/segregation`).then(setRows).catch(() => setRows([])); }, [sel]);

  return (
    <>
      <h1>Integración y segregación del grupo</h1>
      <AppSelector apps={apps} sel={sel} setSel={setSel} />
      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {rows.map(r => (
          <div className="card" key={r.id}>
            <h2>{r.dimension} · {r.relationship}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="kpi"><div className="num">{r.value}</div></div>
              <Chip color={colorSeg(r.value)}>{r.label}</Chip>
            </div>
            <div style={{ margin: '12px 0 6px', height: 10, background: 'var(--linea)', borderRadius: 99, position: 'relative' }}>
              <div style={{
                position: 'absolute', left: `${Math.max(0, Math.min(100, ((r.value + 0.2) / 1.2) * 100))}%`,
                top: -4, width: 4, height: 18, background: 'var(--azul-800)', borderRadius: 2
              }} aria-hidden="true" />
            </div>
            <p className="nota">
              Relaciones internas al mismo grupo de {r.dimension.toLowerCase()}: {r.detail.internas}/{r.detail.total} ·
              H observada {r.h_observed} · H esperada {r.h_expected}
            </p>
            <details>
              <summary className="nota" style={{ cursor: 'pointer' }}>¿Cómo se calculó?</summary>
              <p className="nota">
                H_observada = relaciones internas / total de relaciones válidas.<br />
                H_esperada = Σ[n_g(n_g−1)] / [N(N−1)] con la composición del grupo.<br />
                Índice = (H_observada − H_esperada) / (1 − H_esperada). Valores negativos indican mayor integración de la esperada.
              </p>
            </details>
          </div>
        ))}
      </div>
      {!rows.length && <div className="card"><p className="nota">Sin cálculo de segregación. Ejecuta "Recalcular" en la página de Alumnos.</p></div>}
    </>
  );
}
