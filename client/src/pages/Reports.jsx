import React, { useEffect, useState } from 'react';
import { api, download, toCSV } from '../api.js';
import { useApplications, AppSelector, Chip, tipoColor, AvisoPreventivo } from '../components/UI.jsx';

export default function Reports() {
  const { apps, sel, setSel } = useApplications();
  const [rep, setRep] = useState(null);

  useEffect(() => { sel && api(`/reports/group/${sel}`).then(setRep).catch(() => setRep(null)); }, [sel]);

  if (!rep) return <><h1>Informes</h1><AppSelector apps={apps} sel={sel} setSel={setSel} /><div className="card"><p className="nota">Genera el cálculo de la aplicación para producir el informe.</p></div></>;

  const g = rep.indices_grupales;

  return (
    <>
      <div className="no-print">
        <h1>Informe grupal</h1>
        <AppSelector apps={apps} sel={sel} setSel={setSel} />
        <div className="acciones" style={{ marginBottom: 14 }}>
          <button onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button className="sec" onClick={() => download(`informe_${sel}.json`, JSON.stringify(rep, null, 2), 'application/json')}>Exportar JSON</button>
          <button className="sec" onClick={() => download(`informe_alumnos_${sel}.csv`, toCSV(rep.alumnos, [
            { label: 'Matrícula', value: 'matricula' }, { label: 'Nombre', value: 'nombre' }, { label: 'Tipo', value: 'tipo' },
            { label: 'NPR', value: 'NPR' }, { label: 'NNR', value: 'NNR' }, { label: 'Preferencia', value: 'PS' }
          ]))}>Exportar CSV</button>
        </div>
      </div>

      <div className="card">
        <h1 style={{ marginBottom: 2 }}>Informe sociométrico y de bienestar</h1>
        <p className="nota">{rep.aplicacion.formulario} · {rep.aplicacion.grupo} · Periodo {rep.aplicacion.periodo} · Aplicado: {rep.aplicacion.fecha}</p>
        <AvisoPreventivo />
        {g && (
          <>
            <h2>Índices del grupo</h2>
            <table className="tbl" style={{ maxWidth: 620 }}>
              <tbody>
                <tr><td>Participación</td><td className="num">{g.participacion.pct}% ({g.participacion.sent}/{g.participacion.total}) <Chip color={g.participacion.level}>{g.participacion.level}</Chip></td></tr>
                <tr><td>Media de nominaciones positivas</td><td className="num">{g.media_pos}</td></tr>
                <tr><td>Media de nominaciones negativas</td><td className="num">{g.media_neg}</td></tr>
                <tr><td>Cohesión positiva (pares recíprocos)</td><td className="num">{g.cohesion_positiva}</td></tr>
                <tr><td>Cohesión negativa</td><td className="num">{g.cohesion_negativa}</td></tr>
                <tr><td>Densidad de la red positiva</td><td className="num">{g.densidad}</td></tr>
                <tr><td>Promedio de amistades recíprocas</td><td className="num">{g.promedio_amistades}</td></tr>
              </tbody>
            </table>
            <h2 style={{ marginTop: 14 }}>Tipos sociométricos</h2>
            <div className="acciones">
              {Object.entries(g.tipos).map(([t, n]) => <Chip key={t} color={tipoColor(t)}>{t}: {n}</Chip>)}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Segregación por dimensión</h2>
        <table className="tbl" style={{ maxWidth: 640 }}>
          <thead><tr><th>Dimensión</th><th>Relación</th><th className="num">Índice</th><th>Lectura</th></tr></thead>
          <tbody>
            {rep.segregacion.map((s, i) => (
              <tr key={i}><td>{s.dimension}</td><td>{s.relationship}</td><td className="num">{s.value}</td><td>{s.etiqueta}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Salud emocional (distribución)</h2>
        <div className="acciones">
          {rep.distribucion_emocional.map(d => <Chip key={d.level} color={d.level}>{d.level}: {d.n}</Chip>)}
        </div>
        <h2 style={{ marginTop: 14 }}>Alertas generadas</h2>
        <table className="tbl" style={{ maxWidth: 520 }}>
          <thead><tr><th>Tipo</th><th>Prioridad</th><th className="num">Casos</th></tr></thead>
          <tbody>
            {rep.alertas.map((a, i) => <tr key={i}><td>{a.type}</td><td>{a.priority}</td><td className="num">{a.n}</td></tr>)}
          </tbody>
        </table>
        <p className="nota">Recomendación general: revisar los casos con alerta junto con Orientación Educativa y registrar el seguimiento en la plataforma. La confidencialidad de este documento es responsabilidad de quien lo exporta.</p>
      </div>

      <div className="card">
        <h2>Resultados por alumno</h2>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Tipo</th><th className="num">NPR</th><th className="num">NNR</th><th className="num">Preferencia</th></tr></thead>
          <tbody>
            {rep.alumnos.sort((a, b) => b.PS - a.PS).map(a => (
              <tr key={a.matricula}>
                <td>{a.nombre} <span className="nota">({a.matricula})</span></td>
                <td><Chip color={tipoColor(a.tipo)}>{a.tipo}</Chip></td>
                <td className="num">{a.NPR}</td><td className="num">{a.NNR}</td><td className="num">{a.PS}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
