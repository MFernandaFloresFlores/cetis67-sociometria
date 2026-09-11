import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Chip, prioColor, Msg, Modal, AvisoPreventivo, useUser } from '../components/UI.jsx';

const ESTADOS = ['Nuevo', 'Pendiente', 'En valoración', 'En seguimiento', 'Canalizado', 'Cerrado', 'Descartado'];
const ACCIONES = [['nota', 'Nota'], ['entrevista', 'Entrevista'], ['contacto', 'Contacto con familia'], ['acuerdo', 'Acuerdo']];

export default function Alerts() {
  const [rows, setRows] = useState([]);
  const [fStatus, setFStatus] = useState('');
  const [fPrio, setFPrio] = useState('');
  const [msg, setMsg] = useState({});
  const [detalle, setDetalle] = useState(null); // alerta abierta
  const [seguimientos, setSeguimientos] = useState([]);
  const [nuevo, setNuevo] = useState({ action: 'nota', note: '' });
  const [cambio, setCambio] = useState({ status: '', justificacion: '' });
  const user = useUser();
  const gestiona = ['admin', 'counselor'].includes(user?.role);

  const load = () => {
    const q = new URLSearchParams();
    if (fStatus) q.set('status', fStatus);
    if (fPrio) q.set('priority', fPrio);
    api(`/alerts?${q}`).then(setRows).catch(e => setMsg({ error: e.message }));
  };
  useEffect(load, [fStatus, fPrio]);

  const abrir = async a => {
    setDetalle(a); setCambio({ status: a.status, justificacion: '' }); setNuevo({ action: 'nota', note: '' });
    if (gestiona) api(`/alerts/${a.id}/followups`).then(setSeguimientos).catch(() => setSeguimientos([]));
  };

  const guardarEstado = async () => {
    try {
      await api(`/alerts/${detalle.id}/status`, { method: 'POST', body: cambio });
      setMsg({ ok: 'Estado actualizado.' }); setDetalle(null); load();
    } catch (e) { setMsg({ error: e.message }); }
  };

  const agregarSeguimiento = async () => {
    try {
      await api(`/alerts/${detalle.id}/followups`, { method: 'POST', body: nuevo });
      const f = await api(`/alerts/${detalle.id}/followups`);
      setSeguimientos(f); setNuevo({ action: 'nota', note: '' });
    } catch (e) { setMsg({ error: e.message }); }
  };

  return (
    <>
      <h1>Alertas y seguimiento</h1>
      <AvisoPreventivo />
      <Msg {...msg} />
      <div className="card">
        <div className="row no-print">
          <label className="f"><span>Estado</span>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">Todos</option>{ESTADOS.map(s => <option key={s}>{s}</option>)}
            </select></label>
          <label className="f"><span>Prioridad</span>
            <select value={fPrio} onChange={e => setFPrio(e.target.value)}>
              <option value="">Todas</option>{['Urgente', 'Alta', 'Media', 'Baja'].map(p => <option key={p}>{p}</option>)}
            </select></label>
        </div>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Grupo</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Responsable</th><th></th></tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id}>
                <td><b>{a.nombres} {a.apellido_paterno}</b><br /><span className="nota">{a.matricula}</span></td>
                <td className="nota">{a.grupo}</td>
                <td>{a.type}</td>
                <td><Chip color={prioColor(a.priority)}>{a.priority}</Chip></td>
                <td>{a.status}</td>
                <td>{a.responsable || <span className="nota">Sin asignar</span>}</td>
                <td><button className="mini sec" onClick={() => abrir(a)}>{gestiona ? 'Gestionar' : 'Ver'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="nota">No hay alertas con los filtros actuales.</p>}
      </div>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle de alerta">
        {detalle && (
          <>
            <p><b>{detalle.nombres} {detalle.apellido_paterno}</b> · {detalle.type} <Chip color={prioColor(detalle.priority)}>{detalle.priority}</Chip></p>
            <p className="nota">{detalle.description}</p>
            {gestiona && (
              <>
                <div className="row">
                  <label className="f"><span>Cambiar estado</span>
                    <select value={cambio.status} onChange={e => setCambio({ ...cambio, status: e.target.value })}>
                      {ESTADOS.map(s => <option key={s}>{s}</option>)}
                    </select></label>
                </div>
                {['Cerrado', 'Descartado'].includes(cambio.status) && (
                  <label className="f"><span>Justificación (obligatoria para cerrar o descartar)</span>
                    <textarea rows={2} value={cambio.justificacion} onChange={e => setCambio({ ...cambio, justificacion: e.target.value })} /></label>
                )}
                <button onClick={guardarEstado}>Guardar estado</button>

                <h3 style={{ marginTop: 18 }}>Seguimiento</h3>
                <div className="row">
                  <label className="f" style={{ maxWidth: 180 }}><span>Acción</span>
                    <select value={nuevo.action} onChange={e => setNuevo({ ...nuevo, action: e.target.value })}>
                      {ACCIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></label>
                  <label className="f" style={{ flex: 2 }}><span>Nota confidencial</span>
                    <input value={nuevo.note} onChange={e => setNuevo({ ...nuevo, note: e.target.value })} /></label>
                  <button className="sec" style={{ flex: '0 0 auto' }} disabled={!nuevo.note.trim()} onClick={agregarSeguimiento}>Registrar</button>
                </div>
                {seguimientos.map(s => (
                  <p key={s.id} style={{ borderLeft: '3px solid var(--linea)', paddingLeft: 10, margin: '8px 0' }}>
                    <b>{s.action}</b>: {s.note}<br /><span className="nota">{s.autor} · {s.created_at}</span>
                  </p>
                ))}
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
