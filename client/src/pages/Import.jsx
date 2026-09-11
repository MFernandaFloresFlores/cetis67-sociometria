import React, { useState } from 'react';
import { Msg } from '../components/UI.jsx';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  const enviar = async ruta => {
    setBusy(true); setMsg({});
    try {
      const form = new FormData();
      form.append('file', file);
      if (preview?.sheet) form.append('sheet', preview.sheet);
      const res = await fetch(`/api/import/${ruta}`, { method: 'POST', body: form, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo');
      return data;
    } finally { setBusy(false); }
  };

  const vistaPrev = async () => {
    try { setPreview(await enviar('preview')); }
    catch (e) { setMsg({ error: e.message }); setPreview(null); }
  };

  const confirmar = async () => {
    try {
      const r = await enviar('confirm');
      setMsg({ ok: `Importación completada: ${r.imported} alumnos nuevos, ${r.updated} actualizados, ${r.skipped} omitidos de ${r.total} filas.` });
      setPreview(null); setFile(null);
    } catch (e) { setMsg({ error: e.message }); }
  };

  return (
    <>
      <h1>Importar alumnos desde Excel o CSV</h1>
      <div className="card">
        <p className="nota">
          Formatos: .xlsx, .xls, .csv. <a href="/api/import/template" download>Descargar plantilla CSV</a>.
          Columnas: matricula, nombres, apellido_paterno, apellido_materno, genero, edad, plan_estudios, semestre, grupo, turno, correo_institucional, estado, periodo_escolar.
        </p>
        <div className="row">
          <label className="f"><span>Archivo</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files[0] || null); setPreview(null); }} /></label>
          <button style={{ flex: '0 0 auto' }} disabled={!file || busy} onClick={vistaPrev}>Ver vista previa</button>
        </div>
        <Msg {...msg} />
      </div>

      {preview && (
        <>
          <div className="card">
            <h2>Vista previa · hoja "{preview.sheet}" · {preview.total} filas</h2>
            {preview.sheets.length > 1 && <p className="nota">Hojas detectadas: {preview.sheets.join(', ')} (se importa la primera; renombra si necesitas otra).</p>}
            {preview.missingHeaders.length > 0 && (
              <div className="alerta-msg">Faltan encabezados requeridos: {preview.missingHeaders.join(', ')}</div>
            )}
            <div className="matriz-wrap">
              <table className="tbl">
                <thead><tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {preview.preview.map((r, i) => (
                    <tr key={i}>{preview.headers.map(h => <td key={h}>{String(r[h] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Validación</h2>
            {preview.errors.length === 0
              ? <p className="ok-msg">Sin errores detectados. Puedes confirmar la importación.</p>
              : (
                <>
                  <div className="alerta-msg">{preview.errors.length} problema(s) detectado(s). Las filas con error se omitirán al confirmar.</div>
                  <table className="tbl" style={{ maxWidth: 560 }}>
                    <thead><tr><th>Línea</th><th>Error</th></tr></thead>
                    <tbody>
                      {preview.errors.slice(0, 30).map((e, i) => <tr key={i}><td className="num">{e.line}</td><td>{e.error}</td></tr>)}
                    </tbody>
                  </table>
                </>
              )}
            {preview.yaInscritos > 0 && (
              <p className="nota">
                {preview.yaInscritos} alumno(s) ya inscritos en este periodo: se actualizarán sus datos
                (nombre, género, edad, correo) sin duplicar su inscripción ni cambiar su grupo.
              </p>
            )}
            <div className="acciones" style={{ marginTop: 12 }}>
              <button disabled={busy || preview.missingHeaders.length > 0} onClick={confirmar}>Confirmar importación</button>
              <button className="sec" onClick={() => setPreview(null)}>Cancelar</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
