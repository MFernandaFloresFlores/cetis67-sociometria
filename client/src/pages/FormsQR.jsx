import React, { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { Msg, Modal, Chip } from '../components/UI.jsx';

const estadoColor = s => ({ activo: 'Verde', pausado: 'Amarillo', cerrado: 'neutral', desactivado: 'Rojo', borrador: 'azul', archivado: 'neutral' }[s] || 'neutral');

export default function FormsQR() {
  const [forms, setForms] = useState([]);
  const [apps, setApps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [msg, setMsg] = useState({});
  const [nf, setNf] = useState({ title: '', type: 'combinado' });
  const [na, setNa] = useState({ form_id: '', group_id: '' });
  const [qrModal, setQrModal] = useState(null); // {app, url, png, svg}

  const load = () => {
    api('/forms').then(setForms).catch(() => {});
    api('/applications').then(setApps).catch(() => {});
    api('/groups').then(setGroups).catch(() => {});
  };
  useEffect(load, []);

  const crearForm = async e => {
    e.preventDefault();
    try { await api('/forms', { method: 'POST', body: nf }); setNf({ title: '', type: 'combinado' }); setMsg({ ok: 'Formulario creado en borrador. Actívalo para poder aplicarlo.' }); load(); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const cambiarEstadoForm = async (id, status) => {
    try { await api(`/forms/${id}/status`, { method: 'POST', body: { status } }); load(); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const crearApp = async e => {
    e.preventDefault();
    try { await api('/applications', { method: 'POST', body: na }); setMsg({ ok: 'Aplicación creada con QR y enlace únicos.' }); load(); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const verQR = async a => {
    try { const q = await api(`/applications/${a.id}/qr`); setQrModal({ app: a, ...q }); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const cambiarEstadoApp = async (id, status) => {
    try { await api(`/applications/${id}/status`, { method: 'POST', body: { status } }); load(); if (qrModal) setQrModal(null); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const regenerar = async id => {
    if (!confirm('Regenerar invalida el QR y el enlace anteriores. ¿Continuar?')) return;
    try { await api(`/applications/${id}/regenerate`, { method: 'POST' }); setQrModal(null); load(); setMsg({ ok: 'Token regenerado. Descarga el nuevo QR.' }); }
    catch (err) { setMsg({ error: err.message }); }
  };

  const copiar = url => navigator.clipboard?.writeText(url).then(() => setMsg({ ok: 'Enlace copiado al portapapeles.' }));

  return (
    <>
      <h1>Formularios y aplicaciones con QR</h1>
      <Msg {...msg} />

      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <div className="card">
          <h2>Nuevo formulario</h2>
          <form onSubmit={crearForm}>
            <label className="f"><span>Título</span>
              <input value={nf.title} onChange={e => setNf({ ...nf, title: e.target.value })} required /></label>
            <label className="f"><span>Tipo</span>
              <select value={nf.type} onChange={e => setNf({ ...nf, type: e.target.value })}>
                <option value="combinado">Sociométrico + salud emocional</option>
                <option value="sociometrico">Solo sociométrico</option>
                <option value="emocional">Solo salud emocional</option>
              </select></label>
            <button>Crear formulario</button>
          </form>
        </div>
        <div className="card">
          <h2>Nueva aplicación (formulario → grupo)</h2>
          <form onSubmit={crearApp}>
            <label className="f"><span>Formulario activo</span>
              <select value={na.form_id} onChange={e => setNa({ ...na, form_id: e.target.value })} required>
                <option value="">Selecciona…</option>
                {forms.filter(f => f.status === 'activo').map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select></label>
            <label className="f"><span>Grupo</span>
              <select value={na.group_id} onChange={e => setNa({ ...na, group_id: e.target.value })} required>
                <option value="">Selecciona…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.periodo}</option>)}
              </select></label>
            <button>Generar QR y enlace</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Formularios</h2>
        <table className="tbl">
          <thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th>Versión</th><th>Acciones</th></tr></thead>
          <tbody>
            {forms.map(f => (
              <tr key={f.id}>
                <td><b>{f.title}</b></td>
                <td>{f.type}</td>
                <td><Chip color={estadoColor(f.status)}>{f.status}</Chip></td>
                <td>v{f.version}</td>
                <td className="acciones">
                  {f.status === 'borrador' && <button className="mini" onClick={() => cambiarEstadoForm(f.id, 'activo')}>Activar</button>}
                  {f.status === 'activo' && <button className="mini sec" onClick={() => cambiarEstadoForm(f.id, 'pausado')}>Pausar</button>}
                  {f.status === 'pausado' && <button className="mini" onClick={() => cambiarEstadoForm(f.id, 'activo')}>Reanudar</button>}
                  {['activo', 'pausado'].includes(f.status) && <button className="mini sec" onClick={() => cambiarEstadoForm(f.id, 'cerrado')}>Cerrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Aplicaciones</h2>
        <table className="tbl">
          <thead><tr><th>Formulario</th><th>Grupo</th><th>Estado</th><th className="num">Enviados</th><th className="num">Accesos</th><th>Acciones</th></tr></thead>
          <tbody>
            {apps.map(a => (
              <tr key={a.id}>
                <td>{a.formulario}</td>
                <td>{a.grupo}</td>
                <td><Chip color={estadoColor(a.status)}>{a.status}</Chip></td>
                <td className="num">{a.enviados}/{a.alumnos}</td>
                <td className="num">{a.access_count}</td>
                <td className="acciones">
                  <button className="mini" onClick={() => verQR(a)}>Ver QR</button>
                  {a.status === 'activo' && <button className="mini sec" onClick={() => cambiarEstadoApp(a.id, 'pausado')}>Pausar</button>}
                  {a.status === 'pausado' && <button className="mini" onClick={() => cambiarEstadoApp(a.id, 'activo')}>Reanudar</button>}
                  {['activo', 'pausado'].includes(a.status) && <button className="mini sec" onClick={() => cambiarEstadoApp(a.id, 'cerrado')}>Cerrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!qrModal} onClose={() => setQrModal(null)} title="QR de la aplicación">
        {qrModal && (
          <div style={{ textAlign: 'center' }}>
            <p><b>{qrModal.app.formulario}</b><br />{qrModal.app.grupo}</p>
            <img src={qrModal.png} alt={`Código QR para responder: ${qrModal.url}`} style={{ width: 260, maxWidth: '100%' }} />
            <p style={{ wordBreak: 'break-all' }} className="nota">{qrModal.url}</p>
            <div className="acciones" style={{ justifyContent: 'center' }}>
              <button className="mini" onClick={() => copiar(qrModal.url)}>Copiar enlace</button>
              <a className="btn mini" style={{ textDecoration: 'none' }} href={qrModal.png} download={`qr_aplicacion_${qrModal.app.id}.png`}>Descargar PNG</a>
              <button className="mini sec" onClick={() => download(`qr_aplicacion_${qrModal.app.id}.svg`, qrModal.svg, 'image/svg+xml')}>Descargar SVG</button>
              <button className="mini peligro" onClick={() => regenerar(qrModal.app.id)}>Regenerar</button>
            </div>
            <p className="nota">El enlace no contiene datos personales. Compártelo solo con el grupo correspondiente.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
