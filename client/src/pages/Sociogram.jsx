import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApplications, AppSelector, Chip, tipoColor } from '../components/UI.jsx';

const COLORES = {
  Preferido: '#1e8e4e', Promedio: '#1a4a7e', Ignorado: '#b07d10',
  Controvertido: '#c05e13', Rechazado: '#bb2b3a', 'Sin calcular': '#5b6b78'
};
const W = 860, H = 560;

// Layout de fuerzas simple y determinista (sin dependencias externas)
function forceLayout(nodes, edges, iterations = 260) {
  const pos = nodes.map((n, i) => {
    const a = (i / nodes.length) * 2 * Math.PI;
    return { id: n.id, x: W / 2 + 190 * Math.cos(a), y: H / 2 + 190 * Math.sin(a) };
  });
  const idx = Object.fromEntries(pos.map((p, i) => [p.id, i]));
  const posEdges = edges.filter(e => e.kind === 'pos');
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    // repulsión
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
      let d2 = dx * dx + dy * dy || 1;
      const f = 5200 / d2 * t;
      const d = Math.sqrt(d2);
      dx = dx / d * f; dy = dy / d * f;
      pos[i].x += dx; pos[i].y += dy; pos[j].x -= dx; pos[j].y -= dy;
    }
    // atracción por elección positiva
    for (const e of posEdges) {
      const a = pos[idx[e.source]], b = pos[idx[e.target]];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 120) * 0.012 * t;
      a.x += dx / d * f; a.y += dy / d * f;
      b.x -= dx / d * f; b.y -= dy / d * f;
    }
    for (const p of pos) {
      p.x = Math.max(40, Math.min(W - 40, p.x));
      p.y = Math.max(40, Math.min(H - 40, p.y));
    }
  }
  return Object.fromEntries(pos.map(p => [p.id, p]));
}

export default function Sociogram() {
  const { apps, sel, setSel } = useApplications();
  const [data, setData] = useState(null);
  const [verNeg, setVerNeg] = useState(true);
  const [porGenero, setPorGenero] = useState(false);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const [posOverride, setPosOverride] = useState({});
  const svgRef = useRef(null);

  useEffect(() => {
    if (!sel) return;
    setPosOverride({});
    api(`/applications/${sel}/sociogram`).then(setData).catch(() => {});
  }, [sel]);

  const layout = useMemo(() => data ? forceLayout(data.nodes, data.edges) : {}, [data]);
  const P = id => posOverride[id] || layout[id] || { x: W / 2, y: H / 2 };

  const svgPoint = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };

  if (!data) return <><h1>Sociograma</h1><AppSelector apps={apps} sel={sel} setSel={setSel} /></>;

  const maxNpr = Math.max(1, ...data.nodes.map(n => n.npr));
  const nodo = hover != null ? data.nodes.find(n => n.id === hover) : null;

  return (
    <>
      <h1>Sociograma del grupo</h1>
      <AppSelector apps={apps} sel={sel} setSel={setSel} />
      <div className="card">
        <div className="acciones no-print" style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '.9rem' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={verNeg} onChange={e => setVerNeg(e.target.checked)} />
            Mostrar rechazos
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '.9rem' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={porGenero} onChange={e => setPorGenero(e.target.checked)} />
            Colorear por género
          </label>
          <span className="nota">Arrastra los nodos para reacomodar. El tamaño refleja la popularidad; el borde rojo indica alerta abierta.</span>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="socio-svg" role="img" aria-label="Sociograma del grupo"
          onMouseMove={e => { if (drag != null) { const p = svgPoint(e); setPosOverride(o => ({ ...o, [drag]: p })); } }}
          onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)}>
          <defs>
            <marker id="fPos" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#1e8e4e" opacity=".7" />
            </marker>
            <marker id="fNeg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#bb2b3a" opacity=".7" />
            </marker>
          </defs>
          {data.edges.filter(e => e.kind === 'pos' || verNeg).map((e, i) => {
            const a = P(e.source), b = P(e.target);
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            const r2 = 12 + 12 * ((data.nodes.find(n => n.id === e.target)?.npr || 0) / maxNpr);
            const bx = b.x - dx / d * (r2 + 4), by = b.y - dy / d * (r2 + 4);
            const activo = hover == null || e.source === hover || e.target === hover;
            return <line key={i} x1={a.x} y1={a.y} x2={bx} y2={by}
              stroke={e.kind === 'pos' ? '#1e8e4e' : '#bb2b3a'}
              strokeWidth={e.rank === 1 ? 2 : 1.2} strokeDasharray={e.kind === 'neg' ? '5 4' : ''}
              opacity={activo ? (e.kind === 'pos' ? .55 : .45) : .06}
              markerEnd={`url(#${e.kind === 'pos' ? 'fPos' : 'fNeg'})`} />;
          })}
          {data.nodes.map(n => {
            const p = P(n.id);
            const r = 12 + 12 * (n.npr / maxNpr);
            const fill = porGenero ? (n.genero === 'F' ? '#7c5cbf' : '#0fa3a3') : COLORES[n.tipo];
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'grab' }}
                onMouseDown={() => setDrag(n.id)}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(h => h === n.id ? null : h)}>
                <circle r={r} fill={fill} stroke={n.alerta ? '#bb2b3a' : '#fff'} strokeWidth={n.alerta ? 3.5 : 2} />
                <text y={r + 13} textAnchor="middle" fontSize="10.5" fill="#17242f">{n.nombre.split(' ')[0]}</text>
              </g>
            );
          })}
        </svg>
        {nodo && (
          <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
            <b>{nodo.nombre}</b> <Chip color={tipoColor(nodo.tipo)}>{nodo.tipo}</Chip>
            {' '}· {nodo.npr} nominaciones positivas {nodo.alerta && <Chip color="Rojo">Con alerta abierta</Chip>}
            {' '}· <Link to={`/perfil/${sel}/${nodo.id}`}>Abrir perfil</Link>
          </div>
        )}
        <div className="leyenda">
          {porGenero
            ? <><span><i style={{ background: '#7c5cbf' }} />Femenino</span><span><i style={{ background: '#0fa3a3' }} />Masculino</span></>
            : Object.entries(COLORES).slice(0, 5).map(([t, c]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
          <span><i style={{ background: '#fff', border: '2.5px solid #bb2b3a' }} />Alerta abierta</span>
          <span>— elección positiva · - - rechazo</span>
        </div>
      </div>
    </>
  );
}
