import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await api('/auth/login', { method: 'POST', body: { username, password } });
      onLogin(u);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg,#0d2440,#1a4a7e)' }}>
      <form onSubmit={submit} className="card" style={{ width: 'min(380px, 92vw)', padding: 26 }}>
        <div className="brand" style={{ borderBottom: '1px solid var(--linea)', color: 'inherit' }}>
          <div className="brand-badge">C67</div>
          <div>
            <b style={{ color: 'var(--azul-900)' }}>Plataforma CETIS 67</b>
            <small style={{ color: 'var(--tinta-suave)', display: 'block' }}>Sociometría y salud emocional escolar</small>
          </div>
        </div>
        <label className="f"><span>Usuario o correo</span>
          <input value={username} onChange={e => setU(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="f"><span>Contraseña</span>
          <input type="password" value={password} onChange={e => setP(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="alerta-msg" role="alert">{error}</div>}
        <button disabled={busy} style={{ width: '100%' }}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
        <p className="nota" style={{ marginBottom: 0 }}>Acceso restringido al personal autorizado. Los intentos quedan registrados.</p>
      </form>
    </div>
  );
}
