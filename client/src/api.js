// api.js — Cliente HTTP. Cookies de sesión incluidas; errores normalizados.
export async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  if (form) { opts.body = form; }
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch { /* respuestas sin cuerpo */ }
  if (!res.ok) {
    const err = new Error(data?.error || (data?.errors ? data.errors.join(' ') : `Error ${res.status}`));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const download = (filename, content, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob(['\ufeff' + content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const toCSV = (rows, columns) => {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [columns.map(c => esc(c.label)).join(','), ...rows.map(r => columns.map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))].join('\n');
};
