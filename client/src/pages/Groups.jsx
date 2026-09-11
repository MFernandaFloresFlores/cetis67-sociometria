import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Msg, Modal } from '../components/UI.jsx';

// Modal genérico para acciones que requieren motivo (baja, cambio de grupo, eliminar).
function MotivoModal({ open, title, danger, extra, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setMotivo(''); setError(''); } }, [open]);
  const confirmar = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setBusy(true); setError('');
    try { await onConfirm(motivo.trim()); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {extra}
      <label className="f"><span>Motivo</span>
        <textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus /></label>
      {error && <div className="alerta-msg" role="alert">{error}</div>}
      <div className="acciones" style={{ marginTop: 12 }}>
        <button className={danger ? 'peligro' : ''} disabled={busy} onClick={confirmar}>
          {busy ? 'Procesando…' : 'Confirmar'}
        </button>
        <button className="sec" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [cats, setCats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [msg, setMsg] = useState({});
  const [f, setF] = useState({ plan_estudios: '', semestre: '', letra: 'A', turno: 'Matutino', period_id: '', teacher_id: '' });
  const [newPeriod, setNewPeriod] = useState('');

  const [expanded, setExpanded] = useState(null); // id de grupo expandido
  const [roster, setRoster] = useState([]);

  const [editGroup, setEditGroup] = useState(null); // {...group} en edición
  const [deleteGroup, setDeleteGroup] = useState(null);

  const [editStudent, setEditStudent] = useState(null); // {...alumno} en edición
  const [bajaTarget, setBajaTarget] = useState(null); // fila de alumno
  const [cambioTarget, setCambioTarget] = useState(null); // fila de alumno
  const [cambioDestino, setCambioDestino] = useState('');
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [altaGroup, setAltaGroup] = useState(null); // grupo destino del alta individual
  const [alta, setAlta] = useState({ matricula: '', nombres: '', apellido_paterno: '', apellido_materno: '', genero: '', edad: '', correo_institucional: '' });

  const load = () => {
    api('/groups').then(setGroups).catch(() => {});
    api('/periods').then(p => { setPeriods(p); if (p[0] && !f.period_id) setF(x => ({ ...x, period_id: p[0].id })); }).catch(() => {});
    api('/catalogs').then(c => { setCats(c); setF(x => ({ ...x, plan_estudios: x.plan_estudios || c.plan_estudios[0], semestre: x.semestre || c.semestre[0] })); }).catch(() => {});
    api('/teachers').then(setTeachers).catch(() => {});
  };
  useEffect(load, []);

  const loadRoster = groupId => api(`/students?group_id=${groupId}`).then(setRoster).catch(() => setRoster([]));
  const toggleGroup = g => {
    if (expanded === g.id) { setExpanded(null); setRoster([]); }
    else { setExpanded(g.id); loadRoster(g.id); }
  };

  const crearPeriodo = async () => {
    try { await api('/periods', { method: 'POST', body: { name: newPeriod } }); setNewPeriod(''); setMsg({ ok: 'Periodo creado.' }); load(); }
    catch (e) { setMsg({ error: e.message }); }
  };

  const crearGrupo = async e => {
    e.preventDefault();
    try {
      await api('/groups', { method: 'POST', body: { ...f, teacher_id: f.teacher_id || null } });
      setMsg({ ok: 'Grupo creado.' }); load();
    } catch (err) { setMsg({ error: err.message }); }
  };

  const guardarGrupo = async () => {
    try {
      await api(`/groups/${editGroup.id}`, { method: 'PUT', body: { ...editGroup, teacher_id: editGroup.teacher_id || null } });
      setMsg({ ok: 'Grupo actualizado.' }); setEditGroup(null); load();
    } catch (e) { throw e; }
  };

  const eliminarGrupo = async motivo => {
    await api(`/groups/${deleteGroup.id}`, { method: 'DELETE', body: { motivo } });
    setMsg({ ok: 'Grupo eliminado.' }); setDeleteGroup(null); load();
  };

  const guardarAlumno = async () => {
    await api(`/students/${editStudent.id}`, { method: 'PUT', body: editStudent });
    setMsg({ ok: 'Datos del alumno actualizados.' }); setEditStudent(null); loadRoster(expanded); load();
  };

  const confirmarBaja = async motivo => {
    await api(`/students/${bajaTarget.enrollment_id}/baja`, { method: 'POST', body: { motivo } });
    setMsg({ ok: `${bajaTarget.nombres} dado(a) de baja.` }); setBajaTarget(null); loadRoster(expanded); load();
  };

  const confirmarCambioGrupo = async motivo => {
    if (!cambioDestino) throw new Error('Elige el grupo destino.');
    await api(`/students/${cambioTarget.enrollment_id}/cambio-grupo`, { method: 'POST', body: { group_id: cambioDestino, motivo } });
    setMsg({ ok: `${cambioTarget.nombres} cambiado(a) de grupo.` }); setCambioTarget(null); loadRoster(expanded); load();
  };

  const confirmarEliminarAlumno = async motivo => {
    await api(`/students/${deleteStudent.enrollment_id}`, { method: 'DELETE', body: { motivo } });
    setMsg({ ok: `Inscripción de ${deleteStudent.nombres} eliminada.` }); setDeleteStudent(null); loadRoster(expanded); load();
  };

  const abrirAlta = g => { setAltaGroup(g); setAlta({ matricula: '', nombres: '', apellido_paterno: '', apellido_materno: '', genero: '', edad: '', correo_institucional: '' }); };
  const guardarAlta = async e => {
    e.preventDefault();
    try {
      await api('/students', { method: 'POST', body: { ...alta, group_id: altaGroup.id, period_id: altaGroup.period_id } });
      setMsg({ ok: `${alta.nombres} agregado(a) al grupo.` }); setAltaGroup(null); loadRoster(expanded); load();
    } catch (err) { setMsg({ error: err.message }); }
  };

  return (
    <>
      <h1>Grupos y periodos escolares</h1>
      <Msg {...msg} />
      <div className="card">
        <h2>Periodos</h2>
        <div className="acciones" style={{ marginBottom: 10 }}>
          {periods.map(p => <span key={p.id} className="chip azul">{p.name}</span>)}
        </div>
        <div className="row">
          <label className="f"><span>Nuevo periodo (ej. 2026-2027 B)</span>
            <input value={newPeriod} onChange={e => setNewPeriod(e.target.value)} /></label>
          <button disabled={!newPeriod.trim()} onClick={crearPeriodo} style={{ flex: '0 0 auto' }}>Crear periodo</button>
        </div>
      </div>

      <div className="card">
        <h2>Crear grupo</h2>
        {cats && (
          <form onSubmit={crearGrupo}>
            <div className="row">
              <label className="f"><span>Periodo</span>
                <select value={f.period_id} onChange={e => setF({ ...f, period_id: e.target.value })}>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="f"><span>Plan de estudios</span>
                <select value={f.plan_estudios} onChange={e => setF({ ...f, plan_estudios: e.target.value })}>
                  {cats.plan_estudios.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Semestre</span>
                <select value={f.semestre} onChange={e => setF({ ...f, semestre: e.target.value })}>
                  {cats.semestre.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Grupo</span>
                <select value={f.letra} onChange={e => setF({ ...f, letra: e.target.value })}>
                  {cats.grupo.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Turno</span>
                <select value={f.turno} onChange={e => setF({ ...f, turno: e.target.value })}>
                  {cats.turno.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Profesor/a (opcional)</span>
                <select value={f.teacher_id} onChange={e => setF({ ...f, teacher_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></label>
              <button style={{ flex: '0 0 auto' }}>Crear grupo</button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Grupos existentes</h2>
        <table className="tbl">
          <thead><tr><th>Grupo</th><th>Periodo</th><th>Profesor/a</th><th className="num">Alumnos</th><th></th></tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.id}>
                <tr>
                  <td><b>{g.nombre}</b></td>
                  <td>{g.periodo}</td>
                  <td>{g.profesor || <span className="nota">Sin asignar</span>}</td>
                  <td className="num">{g.alumnos}</td>
                  <td className="acciones">
                    <button className="mini sec" onClick={() => toggleGroup(g)}>{expanded === g.id ? 'Ocultar alumnos' : 'Ver alumnos'}</button>
                    <button className="mini sec" onClick={() => abrirAlta(g)}>Agregar alumno</button>
                    <button className="mini sec" onClick={() => setEditGroup({ ...g })}>Editar</button>
                    <button className="mini peligro" onClick={() => setDeleteGroup(g)}>Eliminar</button>
                  </td>
                </tr>
                {expanded === g.id && (
                  <tr>
                    <td colSpan={5}>
                      <table className="tbl" style={{ margin: '6px 0' }}>
                        <thead><tr><th>Alumno</th><th>Matrícula</th><th>Género</th><th className="num">Edad</th><th>Estado</th><th></th></tr></thead>
                        <tbody>
                          {roster.map(s => (
                            <tr key={s.enrollment_id}>
                              <td>{s.nombres} {s.apellido_paterno} {s.apellido_materno || ''}</td>
                              <td className="nota">{s.matricula}</td>
                              <td>{s.genero || <span className="nota">Sin dato</span>}</td>
                              <td className="num">{s.edad ?? ''}</td>
                              <td>{s.estado_inscripcion}</td>
                              <td className="acciones">
                                <button className="mini sec" onClick={() => setEditStudent({ ...s })}>Editar</button>
                                <button className="mini sec" onClick={() => { setCambioTarget(s); setCambioDestino(''); }}>Cambio de grupo</button>
                                <button className="mini peligro" disabled={s.estado_inscripcion === 'baja'} onClick={() => setBajaTarget(s)}>Baja</button>
                                <button className="mini peligro" onClick={() => setDeleteStudent(s)}>Eliminar</button>
                              </td>
                            </tr>
                          ))}
                          {!roster.length && <tr><td colSpan={6} className="nota">Sin alumnos en este grupo.</td></tr>}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {!groups.length && <p className="nota">Aún no hay grupos. Crea el primero o usa Importar alumnos.</p>}
      </div>

      {/* Editar grupo */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title="Editar grupo">
        {editGroup && cats && (
          <>
            <div className="row">
              <label className="f"><span>Periodo</span>
                <select value={editGroup.period_id} onChange={e => setEditGroup({ ...editGroup, period_id: e.target.value })}>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="f"><span>Plan de estudios</span>
                <select value={editGroup.plan_estudios} onChange={e => setEditGroup({ ...editGroup, plan_estudios: e.target.value })}>
                  {cats.plan_estudios.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Semestre</span>
                <select value={editGroup.semestre} onChange={e => setEditGroup({ ...editGroup, semestre: e.target.value })}>
                  {cats.semestre.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Grupo</span>
                <select value={editGroup.letra} onChange={e => setEditGroup({ ...editGroup, letra: e.target.value })}>
                  {cats.grupo.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Turno</span>
                <select value={editGroup.turno} onChange={e => setEditGroup({ ...editGroup, turno: e.target.value })}>
                  {cats.turno.map(x => <option key={x}>{x}</option>)}
                </select></label>
              <label className="f"><span>Profesor/a</span>
                <select value={editGroup.teacher_id || ''} onChange={e => setEditGroup({ ...editGroup, teacher_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></label>
            </div>
            <p className="nota">Revisa los datos antes de confirmar; el cambio queda registrado en la Bitácora con fecha y valores anteriores.</p>
            <div className="acciones" style={{ marginTop: 12 }}>
              <button onClick={() => guardarGrupo().catch(e => setMsg({ error: e.message }))}>Confirmar cambios</button>
              <button className="sec" onClick={() => setEditGroup(null)}>Cancelar</button>
            </div>
          </>
        )}
      </Modal>

      {/* Alta individual */}
      <Modal open={!!altaGroup} onClose={() => setAltaGroup(null)} title={`Agregar alumno a ${altaGroup?.nombre || ''}`}>
        {altaGroup && (
          <form onSubmit={guardarAlta}>
            <div className="row">
              <label className="f"><span>Matrícula</span>
                <input value={alta.matricula} onChange={e => setAlta({ ...alta, matricula: e.target.value })} required autoFocus /></label>
              <label className="f"><span>Nombre(s)</span>
                <input value={alta.nombres} onChange={e => setAlta({ ...alta, nombres: e.target.value })} required /></label>
              <label className="f"><span>Apellido paterno</span>
                <input value={alta.apellido_paterno} onChange={e => setAlta({ ...alta, apellido_paterno: e.target.value })} required /></label>
              <label className="f"><span>Apellido materno</span>
                <input value={alta.apellido_materno} onChange={e => setAlta({ ...alta, apellido_materno: e.target.value })} /></label>
            </div>
            <div className="row">
              <label className="f"><span>Género</span>
                <input value={alta.genero} onChange={e => setAlta({ ...alta, genero: e.target.value })} /></label>
              <label className="f"><span>Edad</span>
                <input type="number" min={12} max={60} value={alta.edad} onChange={e => setAlta({ ...alta, edad: e.target.value })} /></label>
              <label className="f"><span>Correo institucional</span>
                <input type="email" value={alta.correo_institucional} onChange={e => setAlta({ ...alta, correo_institucional: e.target.value })} /></label>
            </div>
            <div className="acciones" style={{ marginTop: 12 }}>
              <button>Agregar</button>
              <button type="button" className="sec" onClick={() => setAltaGroup(null)}>Cancelar</button>
            </div>
          </form>
        )}
      </Modal>

      <MotivoModal
        open={!!deleteGroup} title={`Eliminar grupo ${deleteGroup?.nombre || ''}`} danger
        onClose={() => setDeleteGroup(null)} onConfirm={eliminarGrupo}
        extra={<p className="nota">Solo se puede eliminar si nunca tuvo alumnos inscritos. Si tuvo, da de baja a los alumnos o deja el grupo inactivo en su lugar.</p>}
      />

      {/* Editar alumno */}
      <Modal open={!!editStudent} onClose={() => setEditStudent(null)} title="Editar datos del alumno">
        {editStudent && (
          <>
            <div className="row">
              <label className="f"><span>Nombre(s)</span>
                <input value={editStudent.nombres} onChange={e => setEditStudent({ ...editStudent, nombres: e.target.value })} /></label>
              <label className="f"><span>Apellido paterno</span>
                <input value={editStudent.apellido_paterno} onChange={e => setEditStudent({ ...editStudent, apellido_paterno: e.target.value })} /></label>
              <label className="f"><span>Apellido materno</span>
                <input value={editStudent.apellido_materno || ''} onChange={e => setEditStudent({ ...editStudent, apellido_materno: e.target.value })} /></label>
            </div>
            <div className="row">
              <label className="f"><span>Género</span>
                <input value={editStudent.genero || ''} onChange={e => setEditStudent({ ...editStudent, genero: e.target.value })} /></label>
              <label className="f"><span>Edad</span>
                <input type="number" min={12} max={60} value={editStudent.edad ?? ''} onChange={e => setEditStudent({ ...editStudent, edad: e.target.value })} /></label>
              <label className="f"><span>Correo institucional</span>
                <input type="email" value={editStudent.correo_institucional || ''} onChange={e => setEditStudent({ ...editStudent, correo_institucional: e.target.value })} /></label>
            </div>
            <label className="f"><span>Observaciones</span>
              <textarea rows={2} value={editStudent.observaciones || ''} onChange={e => setEditStudent({ ...editStudent, observaciones: e.target.value })} /></label>
            <p className="nota">La matrícula no puede editarse aquí. Revisa los datos antes de confirmar; queda registrado en la Bitácora con fecha y valores anteriores.</p>
            <div className="acciones" style={{ marginTop: 12 }}>
              <button onClick={() => guardarAlumno().catch(e => setMsg({ error: e.message }))}>Confirmar cambios</button>
              <button className="sec" onClick={() => setEditStudent(null)}>Cancelar</button>
            </div>
          </>
        )}
      </Modal>

      <MotivoModal
        open={!!bajaTarget} title={`Dar de baja a ${bajaTarget?.nombres || ''}`} danger
        onClose={() => setBajaTarget(null)} onConfirm={confirmarBaja}
        extra={<p className="nota">No se borra su historial: sus respuestas y resultados anteriores se conservan.</p>}
      />

      <MotivoModal
        open={!!cambioTarget} title={`Cambiar de grupo a ${cambioTarget?.nombres || ''}`}
        onClose={() => setCambioTarget(null)} onConfirm={confirmarCambioGrupo}
        extra={
          <label className="f"><span>Grupo destino</span>
            <select value={cambioDestino} onChange={e => setCambioDestino(e.target.value)}>
              <option value="">Selecciona…</option>
              {groups.filter(g => g.id !== cambioTarget?.group_id).map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.periodo}</option>)}
            </select>
          </label>
        }
      />

      <MotivoModal
        open={!!deleteStudent} title={`Eliminar inscripción de ${deleteStudent?.nombres || ''}`} danger
        onClose={() => setDeleteStudent(null)} onConfirm={confirmarEliminarAlumno}
        extra={<p className="nota">Solo posible si el alumno no tiene respuestas, menciones de compañeros ni alertas registradas. Si ya tiene historial, usa Baja en su lugar.</p>}
      />
    </>
  );
}
