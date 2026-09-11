import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Msg, Modal } from '../components/UI.jsx';

function parseJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState({});
  const [detalle, setDetalle] = useState(null);

  const load = () => api(`/audit?q=${encodeURIComponent(q)}`).then(setRows).catch(e => setMsg({ error: e.message }));
  useEffect(() => { load(); }, []);

  return (
    <>
      <h1>Bitácora de auditoría</h1>
      <p className="nota">Registro inalterable de accesos, cambios y consultas sensibles. Solo lectura.</p>
      <Msg {...msg} />
      <div className="card">
        <div className="row no-print">
          <label className="f"><span>Buscar por acción o recurso</span>
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} /></label>
          <button className="sec" style={{ flex: '0 0 auto' }} onClick={load}>Buscar</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Fecha y hora</th><th>Rol</th><th>Acción</th><th>Recurso</th><th>Resultado</th><th>Motivo</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="nota">{r.created_at}</td>
                <td>{r.rol}</td>
                <td><b>{r.accion}</b></td>
                <td className="nota">{r.recurso}</td>
                <td>{r.resultado}</td>
                <td className="nota">{r.motivo || ''}</td>
                <td>{(r.datos_anteriores || r.datos_nuevos) && <button className="mini sec" onClick={() => setDetalle(r)}>Ver cambio</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="nota">Sin registros.</p>}
      </div>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle del cambio">
        {detalle && (
          <>
            <p className="nota">{detalle.created_at} · {detalle.rol} · {detalle.accion} sobre {detalle.recurso}</p>
            {detalle.motivo && <p><b>Motivo:</b> {detalle.motivo}</p>}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3>Antes</h3>
                <pre style={{ background: '#f2f5f8', padding: 10, borderRadius: 8, fontSize: '.8rem', overflowX: 'auto' }}>
                  {JSON.stringify(parseJSON(detalle.datos_anteriores), null, 2) || '—'}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <h3>Después</h3>
                <pre style={{ background: '#eaf6f6', padding: 10, borderRadius: 8, fontSize: '.8rem', overflowX: 'auto' }}>
                  {JSON.stringify(parseJSON(detalle.datos_nuevos), null, 2) || '—'}
                </pre>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
