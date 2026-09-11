// UI.jsx — Componentes compartidos.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

export const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

export function Chip({ color, children }) {
  return <span className={`chip ${color || 'neutral'}`}>{children}</span>;
}

export const tipoColor = t => ({
  Preferido: 'Verde', Promedio: 'azul', Ignorado: 'Amarillo',
  Controvertido: 'Naranja', Rechazado: 'Rojo'
}[t] || 'neutral');

export const prioColor = p => ({ Urgente: 'Rojo', Alta: 'Naranja', Media: 'Amarillo', Baja: 'neutral' }[p] || 'neutral');

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="sec mini" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Msg({ error, ok }) {
  if (error) return <div className="alerta-msg" role="alert">{error}</div>;
  if (ok) return <div className="ok-msg">{ok}</div>;
  return null;
}

export function AvisoPreventivo() {
  return (
    <div className="aviso-preventivo">
      Los resultados de esta plataforma son <b>indicadores preventivos, no diagnósticos</b>.
      Deben interpretarse por personal capacitado y usarse con fines de acompañamiento.
    </div>
  );
}

// Hook: aplicaciones visibles + selección persistente
export function useApplications() {
  const [apps, setApps] = useState([]);
  const [sel, setSel] = useState(() => localStorage.getItem('qr_sel') || '');
  useEffect(() => {
    api('/applications').then(a => {
      setApps(a);
      if (a.length && !a.find(x => String(x.id) === sel)) setSel(String(a[0].id));
    }).catch(() => {});
  }, []);
  useEffect(() => { if (sel) localStorage.setItem('qr_sel', sel); }, [sel]);
  const app = apps.find(a => String(a.id) === String(sel));
  return { apps, sel, setSel, app };
}

export function AppSelector({ apps, sel, setSel }) {
  return (
    <label className="f" style={{ maxWidth: 460 }}>
      <span>Aplicación (formulario · grupo)</span>
      <select value={sel} onChange={e => setSel(e.target.value)}>
        {apps.map(a => (
          <option key={a.id} value={a.id}>
            {a.formulario} — {a.grupo} ({a.enviados}/{a.alumnos} enviados)
          </option>
        ))}
      </select>
    </label>
  );
}
