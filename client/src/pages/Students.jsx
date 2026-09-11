import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download, toCSV } from '../api.js';
import { useApplications, AppSelector, Chip, tipoColor, Msg, useUser } from '../components/UI.jsx';

export default function Students() {
  const { apps, sel, setSel, app } = useApplications();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [msg, setMsg] = useState({});
  const user = useUser();

  const load = () => sel && api(`/applications/${sel}/results`).then(setData).catch(e => setMsg({ error: e.message }));
  useEffect(() => { load(); }, [sel]);

  const recompute = async (override = false) => {
    setMsg({});
    try {
      const out = await api(`/applications/${sel}/compute`, { method: 'POST', body: { override } });
      if (out.blocked) setMsg({ error: `${out.message} (participación: ${out.participation.pct}%)` });
      else { setMsg({ ok: `Cálculo actualizado con ${out.participation.pct}% de participación.` }); load(); }
    } catch (e) { setMsg({ error: e.message }); }
  };

  const rows = (data?.results || [])
    .filter(r => !tipo || r.tipo === tipo)
    .filter(r => !q || `${r.nombres} ${r.apellido_paterno} ${r.matricula}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.metrics.PS - a.metrics.PS);

  const exportar = () => download(`resultados_${sel}.csv`, toCSV(rows, [
    { label: 'Matrícula', value: 'matricula' },
    { label: 'Nombre', value: r => `${r.nombres} ${r.apellido_paterno}` },
    { label: 'Tipo', value: 'tipo' },
    { label: 'NPR', value: r => r.metrics.NPR }, { label: 'NNR', value: r => r.metrics.NNR },
    { label: 'NPRv', value: r => r.metrics.NPRv }, { label: 'NNRv', value: r => r.metrics.NNRv },
    { label: 'Impacto (IP)', value: r => r.metrics.IP }, { label: 'Preferencia (PS)', value: r => r.metrics.PS },
    { label: 'Recíprocas +', value: r => r.metrics.RP }, { label: 'Recíprocas −', value: r => r.metrics.RN }
  ]));

  return (
    <>
      <h1>Alumnos y resultados individuales</h1>
      <AppSelector apps={apps} sel={sel} setSel={setSel} />
      <div className="card">
        <div className="row">
          <label className="f"><span>Buscar</span>
            <input placeholder="Nombre o matrícula" value={q} onChange={e => setQ(e.target.value)} /></label>
          <label className="f"><span>Tipo sociométrico</span>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {['Preferido', 'Promedio', 'Ignorado', 'Controvertido', 'Rechazado'].map(t => <option key={t}>{t}</option>)}
            </select></label>
          <div className="acciones" style={{ flex: '0 0 auto' }}>
            <button className="sec" onClick={exportar}>Exportar CSV</button>
            {['admin', 'counselor'].includes(user?.role) && <button onClick={() => recompute(false)}>Recalcular</button>}
          </div>
        </div>
        <Msg {...msg} />
        {msg.error?.includes('60%') && <button className="peligro mini" onClick={() => recompute(true)}>Forzar cálculo (queda auditado)</button>}
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th><th>Tipo</th>
              <th className="num" title="Nominaciones positivas recibidas">NPR</th>
              <th className="num" title="Nominaciones negativas recibidas">NNR</th>
              <th className="num" title="Valor ponderado positivo (pesos 5/4/3)">NPRv</th>
              <th className="num" title="Impacto social (zP+zN)">Impacto</th>
              <th className="num" title="Preferencia social (zP−zN)">Preferencia</th>
              <th className="num" title="Amistades recíprocas">R+</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.enrollment_id}>
                <td><b>{r.nombres} {r.apellido_paterno}</b><br /><span className="nota">{r.matricula}</span></td>
                <td><Chip color={tipoColor(r.tipo)}>{r.tipo}</Chip></td>
                <td className="num">{r.metrics.NPR}</td>
                <td className="num">{r.metrics.NNR}</td>
                <td className="num">{r.metrics.NPRv}</td>
                <td className="num">{r.metrics.IP}</td>
                <td className="num">{r.metrics.PS}</td>
                <td className="num">{r.metrics.RP}</td>
                <td><Link to={`/perfil/${sel}/${r.enrollment_id}`}>Ver perfil</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="nota">Sin resultados. Ejecuta el cálculo o ajusta los filtros.</p>}
      </div>
    </>
  );
}
