import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Chip, tipoColor, prioColor, Msg, AvisoPreventivo, useUser } from '../components/UI.jsx';

export default function Profile() {
  const { qrId, enrollmentId } = useParams();
  const [p, setP] = useState(null);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState({});
  const user = useUser();

  const load = () => api(`/applications/${qrId}/profile/${enrollmentId}`).then(setP).catch(e => setMsg({ error: e.message }));
  useEffect(() => { load(); }, [qrId, enrollmentId]);

  const addObs = async () => {
    try {
      await api(`/students/${p.alumno.id}/observations`, { method: 'POST', body: { text: obs } });
      setObs(''); setMsg({ ok: 'Observación registrada.' }); load();
    } catch (e) { setMsg({ error: e.message }); }
  };

  if (!p) return <Msg {...msg} />;
  const a = p.alumno, s = p.sociometria, emo = p.salud_emocional;

  return (
    <>
      <div className="topbar no-print">
        <Link to="/alumnos">← Volver a alumnos</Link>
        <button className="sec" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      <h1>{a.nombres} {a.apellido_paterno} {a.apellido_materno || ''}</h1>
      <p className="nota">Matrícula {a.matricula} · {a.semestre} {a.letra} {a.turno} · {a.plan_estudios} · Estado: {a.estado_inscripcion}</p>
      <AvisoPreventivo />
      <Msg {...msg} />

      {p.semaforos && (
        <div className="cards c3">
          <div className="card">
            <h3>Popularidad</h3>
            <Chip color={p.semaforos.popularidad.color}>{p.semaforos.popularidad.texto}</Chip>
            <p className="nota">{s.NPR} nominaciones positivas (valor ponderado {s.NPRv}).</p>
          </div>
          <div className="card">
            <h3>Rechazo</h3>
            <Chip color={p.semaforos.rechazo.color}>{p.semaforos.rechazo.texto}</Chip>
            <p className="nota">{s.NNR} nominaciones negativas (valor ponderado {s.NNRv}).</p>
          </div>
          <div className="card">
            <h3>Tipo sociométrico</h3>
            <Chip color={tipoColor(s.tipo)}>{s.tipo}</Chip>
            <p className="nota">Impacto {s.IP} · Preferencia {s.PS} · Recíprocas +{s.RP} / −{s.RN}</p>
          </div>
        </div>
      )}
      {p.semaforos && <p className="nota">{p.semaforos.explicacion}</p>}

      {emo && (
        <div className="card">
          <h2>Salud emocional</h2>
          <Chip color={emo.level}>{emo.level} · {emo.score}/100</Chip>
          <table className="tbl" style={{ marginTop: 10, maxWidth: 520 }}>
            <tbody>
              {Object.entries(emo.sections).map(([k, v]) => (
                <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k.replaceAll('_', ' ')}</td><td className="num">{v}/20</td></tr>
              ))}
            </tbody>
          </table>
          <p className="nota">Mayor puntaje indica mayor malestar reportado. Instrumento de tamizaje, no diagnóstico.</p>
        </div>
      )}
      {!emo && <div className="card"><h2>Salud emocional</h2><p className="nota">Sin registro para esta aplicación (estado de respuesta: {p.estado_respuesta.status}).</p></div>}

      <div className="card">
        <h2>Relaciones con el grupo</h2>
        <table className="tbl">
          <thead><tr><th>Compañero/a</th><th>Tipo de relación</th><th>Distancia</th><th>Reciprocidad</th><th>Semáforo</th></tr></thead>
          <tbody>
            {p.relaciones.map(r => (
              <tr key={r.enrollment_id}>
                <td>{r.companero}</td>
                <td>{r.tipo}</td>
                <td>{r.distancia > 0 ? '+' : ''}{r.distancia} · {r.etiqueta_distancia}</td>
                <td>{r.reciprocidad}</td>
                <td><Chip color={r.semaforo}>{r.semaforo === 'Gris' ? 'Neutral' : r.semaforo}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.alertas.length > 0 && (
        <div className="card">
          <h2>Alertas asociadas</h2>
          {p.alertas.map(al => (
            <p key={al.id} style={{ margin: '6px 0' }}>
              <Chip color={prioColor(al.priority)}>{al.priority}</Chip> <b>{al.type}</b> — {al.description} <span className="nota">({al.status})</span>
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Observaciones del personal</h2>
        {p.observaciones.map(o => (
          <p key={o.id} style={{ borderLeft: '3px solid var(--linea)', paddingLeft: 10 }}>
            {o.text}<br /><span className="nota">{o.autor} · {o.created_at}</span>
          </p>
        ))}
        {['admin', 'teacher', 'counselor'].includes(user?.role) && (
          <div className="row no-print">
            <label className="f" style={{ flex: 3 }}><span>Nueva observación</span>
              <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} /></label>
            <button disabled={!obs.trim()} onClick={addObs} style={{ flex: '0 0 auto' }}>Guardar</button>
          </div>
        )}
      </div>
    </>
  );
}
