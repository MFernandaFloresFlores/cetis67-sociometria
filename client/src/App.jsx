// App.jsx — Enrutamiento, sesión y layout privado con navegación por rol.
import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { UserCtx } from './components/UI.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import Profile from './pages/Profile.jsx';
import Groups from './pages/Groups.jsx';
import FormsQR from './pages/FormsQR.jsx';
import Matrix from './pages/Matrix.jsx';
import Sociogram from './pages/Sociogram.jsx';
import Emotional from './pages/Emotional.jsx';
import Segregation from './pages/Segregation.jsx';
import Alerts from './pages/Alerts.jsx';
import Reports from './pages/Reports.jsx';
import Audit from './pages/Audit.jsx';
import ImportPage from './pages/Import.jsx';
import PublicForm from './pages/PublicForm.jsx';

function Layout({ user, onLogout, children }) {
  const puede = (...roles) => roles.includes(user.role);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">C67</div>
          <div>
            <b>CETIS 67</b>
            <small>Sociometría y bienestar</small>
          </div>
        </div>
        <nav className="nav" aria-label="Navegación principal">
          <NavLink to="/" end>Inicio</NavLink>
          <div className="sep">Resultados</div>
          <NavLink to="/alumnos">Alumnos</NavLink>
          <NavLink to="/matriz">Matriz sociométrica</NavLink>
          <NavLink to="/sociograma">Sociograma</NavLink>
          {puede('admin', 'counselor', 'teacher') && <NavLink to="/emocional">Salud emocional</NavLink>}
          <NavLink to="/segregacion">Integración del grupo</NavLink>
          {puede('admin', 'counselor', 'teacher') && <NavLink to="/alertas">Alertas y seguimiento</NavLink>}
          <NavLink to="/informes">Informes</NavLink>
          {puede('admin') && <><div className="sep">Gestión</div>
            <NavLink to="/grupos">Grupos y periodos</NavLink>
            <NavLink to="/formularios">Formularios y QR</NavLink>
            <NavLink to="/importar">Importar alumnos</NavLink></>}
          {puede('admin', 'auditor') && <><div className="sep">Control</div>
            <NavLink to="/bitacora">Bitácora</NavLink></>}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="userbox">
            Sesión: <b>{user.name}</b> <span className="chip azul">{rolLabel(user.role)}</span>
          </div>
          <button className="sec" onClick={onLogout}>Cerrar sesión</button>
        </div>
        {children}
      </main>
    </div>
  );
}

const rolLabel = r => ({ admin: 'Administración', teacher: 'Docente', counselor: 'Orientación', auditor: 'Auditoría', dev: 'Desarrollo' }[r] || r);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando
  const navigate = useNavigate();

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null));
  }, []);

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    setUser(null);
    navigate('/login');
  };

  return (
    <UserCtx.Provider value={user}>
      <Routes>
        {/* Flujo público del alumno: sin sesión */}
        <Route path="/r/:token" element={<PublicForm />} />
        <Route path="/login" element={<Login onLogin={u => { setUser(u); navigate('/'); }} />} />
        <Route path="*" element={
          user === undefined ? <div className="main">Cargando…</div>
          : !user ? <Navigate to="/login" replace />
          : (
            <Layout user={user} onLogout={logout}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/alumnos" element={<Students />} />
                <Route path="/perfil/:qrId/:enrollmentId" element={<Profile />} />
                <Route path="/grupos" element={<Groups />} />
                <Route path="/formularios" element={<FormsQR />} />
                <Route path="/matriz" element={<Matrix />} />
                <Route path="/sociograma" element={<Sociogram />} />
                <Route path="/emocional" element={<Emotional />} />
                <Route path="/segregacion" element={<Segregation />} />
                <Route path="/alertas" element={<Alerts />} />
                <Route path="/informes" element={<Reports />} />
                <Route path="/bitacora" element={<Audit />} />
                <Route path="/importar" element={<ImportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </UserCtx.Provider>
  );
}
