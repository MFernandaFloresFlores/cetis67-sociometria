// PublicForm.jsx — Flujo del alumno vía QR: bienvenida → identificación → cuestionario
// sociométrico → test emocional → consentimiento y envío → folio. Con guardado automático.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

const PREGUNTAS_SOCIO = [
  ['nom_pos', '¿Con qué tres compañeros o compañeras te gustaría más convivir, trabajar en equipo o realizar actividades escolares?', true],
  ['nom_neg', '¿Con qué tres compañeros o compañeras te resultaría más difícil convivir o trabajar en equipo?', true],
  ['perc_pos', '¿Qué tres compañeros o compañeras crees que te elegirían a ti?', false],
  ['perc_neg', '¿Qué tres compañeros o compañeras crees que preferirían no trabajar contigo?', false]
];
const ESCALA = ['Nunca', 'Casi nunca', 'Algunas veces', 'Frecuentemente', 'Siempre'];
const SECCION_TITULO = {
  estado_emocional: 'Estado emocional', estres_escolar: 'Estrés escolar',
  autoestima_seguridad: 'Autoestima y seguridad', relaciones_sociales: 'Relaciones sociales',
  habitos_bienestar: 'Hábitos y bienestar'
};

export default function PublicForm() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [fase, setFase] = useState('carga'); // carga|bienvenida|identidad|socio|emocional|confirmar|folio|error
  const [error, setError] = useState('');
  const [matricula, setMatricula] = useState('');
  const [sesion, setSesion] = useState(null); // {response_id, alumno, roster, emocional, sociometrico}
  const [socio, setSocio] = useState({});
  const [emo, setEmo] = useState({});
  const [consent, setConsent] = useState(false);
  const [folio, setFolio] = useState('');
  const [busy, setBusy] = useState(false);
  const guardado = useRef(null);

  useEffect(() => {
    api(`/public/app/${token}`)
      .then(i => { setInfo(i); setFase('bienvenida'); })
      .catch(e => { setError(e.message); setFase('error'); });
  }, [token]);

  // Guardado automático con debounce
  useEffect(() => {
    if (!sesion || ['folio', 'error'].includes(fase)) return;
    clearTimeout(guardado.current);
    guardado.current = setTimeout(() => {
      api(`/public/app/${token}/draft/${sesion.response_id}`, { method: 'POST', body: { socio, emo } }).catch(() => {});
    }, 900);
    return () => clearTimeout(guardado.current);
  }, [socio, emo]);

  const identificar = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const s = await api(`/public/app/${token}/identify`, { method: 'POST', body: { matricula } });
      setSesion(s);
      if (s.draft) { setSocio(s.draft.socio || {}); setEmo(s.draft.emo || {}); }
      setFase(s.sociometrico ? 'socio' : 'emocional');
    } catch (err) {
      if (err.status === 409) { setFolio(err.data?.folio || ''); setFase('folio'); }
      else setError(err.message);
    } finally { setBusy(false); }
  };

  const preguntasEmo = useMemo(() => {
    if (!sesion?.emocional) return [];
    const out = [];
    let n = 0;
    for (const [sec, items] of Object.entries(sesion.emocional.sections)) {
      for (const txt of items) { n++; out.push({ n, sec, txt, campo: `emo_${String(n).padStart(2, '0')}` }); }
    }
    return out;
  }, [sesion]);

  const emoRespondidas = preguntasEmo.filter(p => emo[p.campo] !== undefined).length;
  const socioOk = !sesion?.sociometrico || (socio.nom_pos_1 && socio.nom_neg_1);
  const progreso = fase === 'socio' ? 30 : fase === 'emocional' ? 30 + (emoRespondidas / 25) * 50 : fase === 'confirmar' ? 90 : fase === 'folio' ? 100 : 10;

  const enviar = async () => {
    setBusy(true); setError('');
    try {
      const r = await api(`/public/app/${token}/submit/${sesion.response_id}`, {
        method: 'POST',
        body: { sociometrico: socio, emocional: emo, consentimiento: consent }
      });
      setFolio(r.folio); setFase('folio');
    } catch (err) {
      setError(err.data?.errors?.join(' ') || err.message);
    } finally { setBusy(false); }
  };

  const SelectCompanero = ({ campo, propio }) => (
    <select value={socio[campo] || ''} onChange={e => setSocio({ ...socio, [campo]: e.target.value ? Number(e.target.value) : '' })}>
      <option value="">— Elige —</option>
      {sesion.roster.map(r => {
        const usado = ['1', '2', '3'].some(k => `${propio}_${k}` !== campo && Number(socio[`${propio}_${k}`]) === r.id);
        return <option key={r.id} value={r.id} disabled={usado}>{r.nombre}</option>;
      })}
    </select>
  );

  return (
    <div className="publico">
      <div className="publico-header">
        <h1>{info?.title || 'Cuestionario CETIS 67'}</h1>
        {info && <p style={{ margin: 0, opacity: .9 }}>{info.grupo}</p>}
      </div>
      {fase !== 'bienvenida' && fase !== 'error' && (
        <div className="progreso" role="progressbar" aria-valuenow={Math.round(progreso)} aria-valuemin="0" aria-valuemax="100">
          <div style={{ width: `${progreso}%` }} />
        </div>
      )}
      {error && <div className="alerta-msg" role="alert">{error}</div>}

      {fase === 'carga' && <p>Cargando…</p>}

      {fase === 'error' && (
        <div className="card">
          <h2>No pudimos abrir el cuestionario</h2>
          <p>{error}</p>
        </div>
      )}

      {fase === 'bienvenida' && info && (
        <div className="card">
          <h2>¡Hola! 👋</h2>
          <p>Este cuestionario nos ayuda a conocer cómo se lleva tu grupo y cómo te sientes, para poder apoyarles mejor.</p>
          <div className="aviso-preventivo">{info.privacidad}</div>
          <p className="nota">Tardarás entre 10 y 15 minutos. Tus avances se guardan automáticamente.</p>
          <button onClick={() => setFase('identidad')} style={{ width: '100%' }}>Comenzar</button>
        </div>
      )}

      {fase === 'identidad' && (
        <form className="card" onSubmit={identificar}>
          <h2>Identifícate</h2>
          <label className="f"><span>Tu matrícula o número de control</span>
            <input value={matricula} onChange={e => setMatricula(e.target.value)} inputMode="numeric" required autoFocus />
          </label>
          <button disabled={busy} style={{ width: '100%' }}>{busy ? 'Verificando…' : 'Continuar'}</button>
          <p className="nota">Solo puede responder el alumnado del grupo al que pertenece este enlace.</p>
        </form>
      )}

      {fase === 'socio' && sesion && (
        <div className="card">
          <h2>Sobre tu grupo</h2>
          <p className="nota">Hola, {sesion.alumno}. Elige hasta tres personas en cada pregunta, en orden de preferencia. No hay respuestas correctas o incorrectas.</p>
          {PREGUNTAS_SOCIO.map(([campo, texto, obligatoria]) => (
            <div className="pregunta" key={campo}>
              <p className="txt">{texto} {obligatoria ? <span style={{ color: 'var(--rojo)' }}>*</span> : <span className="nota">(opcional)</span>}</p>
              <div className="row">
                {[1, 2, 3].map(k => (
                  <label className="f" key={k}><span>{k}ª elección</span>
                    <SelectCompanero campo={`${campo}_${k}`} propio={campo} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button disabled={!socioOk} onClick={() => setFase(sesion.emocional ? 'emocional' : 'confirmar')} style={{ width: '100%' }}>
            Siguiente
          </button>
          {!socioOk && <p className="nota">Para continuar, elige al menos la 1ª persona en las dos primeras preguntas.</p>}
        </div>
      )}

      {fase === 'emocional' && sesion?.emocional && (
        <div className="card">
          <h2>¿Cómo te has sentido últimamente?</h2>
          <p className="nota">Responde pensando en las últimas semanas. {emoRespondidas}/25 respondidas.</p>
          {preguntasEmo.map((p, i) => (
            <div key={p.campo} className="pregunta">
              {(i === 0 || preguntasEmo[i - 1].sec !== p.sec) && <h3 style={{ marginTop: 18 }}>{SECCION_TITULO[p.sec]}</h3>}
              <p className="txt">{p.n}. {p.txt}</p>
              <div className="escala" role="radiogroup" aria-label={p.txt}>
                {ESCALA.map((lbl, v) => (
                  <label key={v}>
                    <input type="radio" name={p.campo} checked={emo[p.campo] === v} onChange={() => setEmo({ ...emo, [p.campo]: v })} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="acciones">
            {sesion.sociometrico && <button className="sec" onClick={() => setFase('socio')}>Anterior</button>}
            <button disabled={emoRespondidas < 25} onClick={() => setFase('confirmar')} style={{ flex: 1 }}>Siguiente</button>
          </div>
        </div>
      )}

      {fase === 'confirmar' && (
        <div className="card">
          <h2>Revisar y enviar</h2>
          <p>Al enviar, tus respuestas quedarán registradas y no podrás modificarlas.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '14px 0' }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 4 }} checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>He leído el aviso de privacidad y acepto que mis respuestas se usen con fines preventivos y de acompañamiento escolar.</span>
          </label>
          <div className="acciones">
            <button className="sec" onClick={() => setFase(sesion.emocional ? 'emocional' : 'socio')}>Anterior</button>
            <button disabled={!consent || busy} onClick={enviar} style={{ flex: 1 }}>{busy ? 'Enviando…' : 'Enviar respuestas'}</button>
          </div>
        </div>
      )}

      {fase === 'folio' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>✅ ¡Listo, gracias por participar!</h2>
          <p>Tus respuestas fueron enviadas correctamente.</p>
          {folio && <p>Tu folio de confirmación es:<br /><b style={{ fontSize: '1.4rem', letterSpacing: '.05em' }}>{folio}</b></p>}
          <p className="nota">Si algo de lo que respondiste te preocupa o quieres hablar con alguien, acércate a Orientación Educativa de tu plantel.</p>
        </div>
      )}
    </div>
  );
}
