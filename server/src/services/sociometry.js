// sociometry.js — Motor de cálculo sociométrico.
// Nomenclatura (sección 12): NPE/NNE emitidas, NPR/NNR recibidas, NPRv/NNRv ponderadas (5/4/3),
// IP impacto social, PS preferencia social, PP/PN impresiones percibidas, RP/RN reciprocidades,
// PPA/PNA ajuste perceptivo. Los resultados son indicadores preventivos, no diagnósticos.
import { db } from '../db.js';

export const WEIGHTS = { 1: 5, 2: 4, 3: 3 };

function zScores(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1)) || 1;
  return { mean, sd, z: v => (v - mean) / sd };
}

function classify(zp, zn) {
  const pref = zp - zn, imp = zp + zn;
  if (pref > 1 && zp > 0 && zn < 0) return 'Preferido';
  if (pref < -1 && zn > 0 && zp < 0) return 'Rechazado';
  if (imp < -1 && zp < 0 && zn < 0) return 'Ignorado';
  if (imp > 1 && zp > 0 && zn > 0) return 'Controvertido';
  return 'Promedio';
}

export function getApplicationData(qrId) {
  const enrollments = db.prepare(`
    SELECT e.id, e.student_id, s.matricula, s.nombres, s.apellido_paterno, s.apellido_materno,
           s.genero, s.edad, e.estado
    FROM enrollments e JOIN students s ON s.id = e.student_id
    WHERE e.group_id = (SELECT group_id FROM qr_codes WHERE id = ?)
      AND e.estado != 'baja'
  `).all(qrId);
  const responses = db.prepare(`SELECT * FROM responses WHERE qr_id = ? AND status = 'enviado'`).all(qrId);
  const respIds = responses.map(r => r.id);
  const inList = respIds.length ? respIds.map(() => '?').join(',') : 'NULL';
  const nominations = respIds.length
    ? db.prepare(`SELECT n.*, r.enrollment_id AS source FROM nominations n JOIN responses r ON r.id = n.response_id WHERE n.response_id IN (${inList})`).all(...respIds)
    : [];
  const perceptions = respIds.length
    ? db.prepare(`SELECT p.*, r.enrollment_id AS source FROM perceptions p JOIN responses r ON r.id = p.response_id WHERE p.response_id IN (${inList})`).all(...respIds)
    : [];
  return { enrollments, responses, nominations, perceptions };
}

export function participation(qrId) {
  const { enrollments, responses } = getApplicationData(qrId);
  const total = enrollments.length;
  const sent = responses.length;
  const pct = total ? Math.round((sent / total) * 100) : 0;
  let level = 'Rojo';
  if (pct >= 80) level = 'Verde'; else if (pct >= 60) level = 'Amarillo';
  return { total, sent, pct, level };
}

export function computeApplication(qrId, { override = false } = {}) {
  const part = participation(qrId);
  if (part.pct < 60 && !override) {
    return { blocked: true, participation: part, message: 'Participación menor al 60%. Los resultados no serían confiables. Puede forzar el cálculo con override (queda auditado).' };
  }
  const { enrollments, nominations, perceptions } = getApplicationData(qrId);
  const ids = enrollments.map(e => e.id);
  const byId = Object.fromEntries(enrollments.map(e => [e.id, e]));

  // Conteos por alumno
  const M = {};
  for (const id of ids) {
    M[id] = { NPE: 0, NNE: 0, NPR: 0, NNR: 0, NPRv: 0, NNRv: 0, PP: 0, PN: 0,
              emitPos: new Set(), emitNeg: new Set(), recvPos: new Set(), recvNeg: new Set(),
              percPos: new Set(), percNeg: new Set(), percPosRecv: 0, percNegRecv: 0 };
  }
  for (const n of nominations) {
    if (!M[n.source] || !M[n.target_enrollment_id]) continue;
    const w = WEIGHTS[n.rank] || 3;
    if (n.kind === 'pos') {
      M[n.source].NPE++; M[n.source].emitPos.add(n.target_enrollment_id);
      M[n.target_enrollment_id].NPR++; M[n.target_enrollment_id].NPRv += w;
      M[n.target_enrollment_id].recvPos.add(n.source);
    } else {
      M[n.source].NNE++; M[n.source].emitNeg.add(n.target_enrollment_id);
      M[n.target_enrollment_id].NNR++; M[n.target_enrollment_id].NNRv += w;
      M[n.target_enrollment_id].recvNeg.add(n.source);
    }
  }
  for (const p of perceptions) {
    if (!M[p.source] || !M[p.target_enrollment_id]) continue;
    if (p.kind === 'pos') { M[p.source].percPos.add(p.target_enrollment_id); M[p.target_enrollment_id].percPosRecv++; }
    else { M[p.source].percNeg.add(p.target_enrollment_id); M[p.target_enrollment_id].percNegRecv++; }
  }

  const zp = zScores(ids.map(id => M[id].NPR));
  const zn = zScores(ids.map(id => M[id].NNR));

  const upsertResult = db.prepare(`
    INSERT INTO sociometric_results (qr_id, enrollment_id, metrics, tipo)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(qr_id, enrollment_id) DO UPDATE SET metrics = excluded.metrics, tipo = excluded.tipo, computed_at = datetime('now')
  `);

  let sumRP = 0, sumRN = 0;
  const results = ids.map(id => {
    const m = M[id];
    // Reciprocidades
    const RP = [...m.emitPos].filter(t => M[t]?.emitPos.has(id)).length;
    const RN = [...m.emitNeg].filter(t => M[t]?.emitNeg.has(id)).length;
    sumRP += RP; sumRN += RN;
    // Ajuste perceptivo: de los que creyó que lo elegirían, cuántos realmente lo hicieron
    const PPA = m.percPos.size ? [...m.percPos].filter(t => m.recvPos.has(t)).length / m.percPos.size : null;
    const PNA = m.percNeg.size ? [...m.percNeg].filter(t => m.recvNeg.has(t)).length / m.percNeg.size : null;
    const zP = zp.z(m.NPR), zN = zn.z(m.NNR);
    const metrics = {
      NPE: m.NPE, NNE: m.NNE, NPR: m.NPR, NNR: m.NNR, NPRv: m.NPRv, NNRv: m.NNRv,
      PP: m.percPosRecv, PN: m.percNegRecv,
      IP: +(zP + zN).toFixed(3),        // impacto social
      PS: +(zP - zN).toFixed(3),        // preferencia social
      RP, RN,
      PPA: PPA === null ? null : +PPA.toFixed(3),
      PNA: PNA === null ? null : +PNA.toFixed(3),
      OS: +((m.NPR + m.percPosRecv) - (m.NNR + m.percNegRecv)).toFixed(2), // opinión social agregada
      zP: +zP.toFixed(3), zN: +zN.toFixed(3)
    };
    const tipo = classify(zP, zN);
    upsertResult.run(qrId, id, JSON.stringify(metrics), tipo);
    return { enrollment_id: id, alumno: byId[id], metrics, tipo };
  });

  // Índices grupales
  const N = ids.length;
  const possiblePairs = N * (N - 1);
  const posDensity = possiblePairs ? nominations.filter(n => n.kind === 'pos').length / possiblePairs : 0;
  const group = {
    participacion: part,
    media_pos: +(results.reduce((a, r) => a + r.metrics.NPR, 0) / (N || 1)).toFixed(2),
    media_neg: +(results.reduce((a, r) => a + r.metrics.NNR, 0) / (N || 1)).toFixed(2),
    cohesion_positiva: +( (sumRP / 2) / (possiblePairs / 2 || 1) ).toFixed(3),
    cohesion_negativa: +( (sumRN / 2) / (possiblePairs / 2 || 1) ).toFixed(3),
    densidad: +posDensity.toFixed(3),
    promedio_amistades: +(sumRP / (N || 1)).toFixed(2),
    promedio_enemistades: +(sumRN / (N || 1)).toFixed(2),
    tipos: results.reduce((acc, r) => { acc[r.tipo] = (acc[r.tipo] || 0) + 1; return acc; }, {})
  };
  db.prepare(`
    INSERT INTO group_indices (qr_id, metrics) VALUES (?, ?)
    ON CONFLICT(qr_id) DO UPDATE SET metrics = excluded.metrics, computed_at = datetime('now')
  `).run(qrId, JSON.stringify(group));

  computeSegregation(qrId, enrollments, nominations);
  generateAlerts(qrId, results);
  return { blocked: false, participation: part, results, group };
}

// ---------- Segregación (sección 16) ----------
export function computeSegregation(qrId, enrollments, nominations) {
  const dims = { 'Género': e => e.genero || 'Sin dato' };
  const rels = {
    'Nominaciones positivas': nominations.filter(n => n.kind === 'pos'),
    'Nominaciones negativas': nominations.filter(n => n.kind === 'neg')
  };
  const byId = Object.fromEntries(enrollments.map(e => [e.id, e]));
  const upsert = db.prepare(`
    INSERT INTO segregation_indices (qr_id, dimension, relationship, h_observed, h_expected, value, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(qr_id, dimension, relationship) DO UPDATE SET
      h_observed = excluded.h_observed, h_expected = excluded.h_expected,
      value = excluded.value, detail = excluded.detail, computed_at = datetime('now')
  `);
  const out = [];
  for (const [dimName, dimFn] of Object.entries(dims)) {
    const groupsCount = {};
    for (const e of enrollments) { const g = dimFn(e); groupsCount[g] = (groupsCount[g] || 0) + 1; }
    const N = enrollments.length;
    const hExpected = N > 1
      ? Object.values(groupsCount).reduce((a, ng) => a + ng * (ng - 1), 0) / (N * (N - 1))
      : 0;
    for (const [relName, links] of Object.entries(rels)) {
      const valid = links.filter(l => byId[l.source] && byId[l.target_enrollment_id]);
      const internal = valid.filter(l => dimFn(byId[l.source]) === dimFn(byId[l.target_enrollment_id])).length;
      const hObserved = valid.length ? internal / valid.length : 0;
      const value = hExpected < 1 ? (hObserved - hExpected) / (1 - hExpected) : 0;
      upsert.run(qrId, dimName, relName, +hObserved.toFixed(3), +hExpected.toFixed(3), +value.toFixed(3),
        JSON.stringify({ internas: internal, total: valid.length, grupos: groupsCount }));
      out.push({ dimension: dimName, relationship: relName, value: +value.toFixed(3) });
    }
  }
  return out;
}

export function segregationLabel(v) {
  if (v < 0) return 'Mayor integración de la esperada';
  if (v < 0.20) return 'Segregación muy baja';
  if (v < 0.40) return 'Segregación baja';
  if (v < 0.60) return 'Segregación moderada';
  if (v < 0.80) return 'Segregación alta';
  return 'Segregación muy alta';
}

// ---------- Alertas automáticas (sección 22). Requieren revisión humana. ----------
function generateAlerts(qrId, results) {
  const insert = db.prepare(`
    INSERT INTO alerts (qr_id, enrollment_id, type, priority, description)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(qr_id, enrollment_id, type) DO NOTHING
  `);
  for (const r of results) {
    const m = r.metrics;
    if (m.zN > 1 && r.tipo === 'Rechazado') {
      insert.run(qrId, r.enrollment_id, 'Rechazo social', 'Alta',
        `Indicador preventivo: ${m.NNR} nominaciones negativas recibidas (z=${m.zN}). Requiere revisión humana.`);
    }
    if (m.NPR === 0 && m.RP === 0) {
      insert.run(qrId, r.enrollment_id, 'Aislamiento', 'Media',
        'Indicador preventivo: sin nominaciones positivas recibidas ni reciprocidades. Requiere revisión humana.');
    }
    if (m.RN > 0) {
      insert.run(qrId, r.enrollment_id, 'Conflicto recíproco', 'Media',
        `Indicador preventivo: ${m.RN} rechazo(s) mutuo(s) detectado(s). Requiere revisión humana.`);
    }
  }
  // Alertas emocionales
  const emos = db.prepare(`
    SELECT er.score, er.level, r.enrollment_id FROM emotional_results er
    JOIN responses r ON r.id = er.response_id WHERE r.qr_id = ?
  `).all(qrId);
  for (const e of emos) {
    if (e.level === 'Rojo') insert.run(qrId, e.enrollment_id, 'Emocional', 'Urgente',
      `Indicador preventivo: puntaje emocional ${e.score}/100. Se recomienda acompañamiento. No es un diagnóstico.`);
    else if (e.level === 'Naranja') insert.run(qrId, e.enrollment_id, 'Emocional', 'Alta',
      `Indicador preventivo: puntaje emocional ${e.score}/100 (estrés moderado). Requiere revisión humana.`);
  }
}

// ---------- Relaciones personales (sección 14) ----------
export function personalRelationships(qrId, enrollmentId) {
  const { enrollments, nominations, perceptions } = getApplicationData(qrId);
  const others = enrollments.filter(e => e.id !== enrollmentId);
  const rel = (src, tgt, kind) => nominations.some(n => n.source === src && n.target_enrollment_id === tgt && n.kind === kind);
  const perc = (src, tgt, kind) => perceptions.some(p => p.source === src && p.target_enrollment_id === tgt && p.kind === kind);
  return others.map(o => {
    const ep = rel(enrollmentId, o.id, 'pos'), en = rel(enrollmentId, o.id, 'neg');
    const rp = rel(o.id, enrollmentId, 'pos'), rn = rel(o.id, enrollmentId, 'neg');
    const pp = perc(enrollmentId, o.id, 'pos'), pn = perc(enrollmentId, o.id, 'neg');
    let d = 0;
    if (ep) d += 2; if (rp) d += 2; if (pp) d += 1;
    if (en) d -= 2; if (rn) d -= 2; if (pn) d -= 1;
    d = Math.max(-6, Math.min(6, d));
    let tipo = 'Relación débil';
    if (ep && rp) tipo = 'Amistad recíproca';
    else if (en && rn) tipo = 'Rechazo recíproco';
    else if ((ep && rn) || (en && rp)) tipo = 'Oposición de sentimientos';
    else if ((ep || rp) && (en || rn)) tipo = 'Relación mixta';
    else if (ep || rp) tipo = 'Cercanía positiva';
    const semaforo = d >= 3 ? 'Verde' : d >= 1 ? 'Amarillo' : d <= -3 ? 'Rojo' : d <= -1 ? 'Naranja' : 'Gris';
    return {
      companero: `${o.nombres} ${o.apellido_paterno}`, enrollment_id: o.id, matricula: o.matricula,
      tipo, distancia: d,
      eleccion_pos_emitida: ep, eleccion_neg_emitida: en,
      eleccion_pos_recibida: rp, eleccion_neg_recibida: rn,
      percepcion_pos: pp, percepcion_neg: pn,
      reciprocidad: (ep && rp) ? 'Positiva' : (en && rn) ? 'Negativa' : 'Sin reciprocidad',
      semaforo
    };
  }).sort((a, b) => b.distancia - a.distancia);
}

export function distanceLabel(d) {
  if (d >= 5) return 'Vínculo muy cercano';
  if (d >= 3) return 'Vínculo positivo';
  if (d >= 1) return 'Relación ligeramente positiva';
  if (d === 0) return 'Relación neutral';
  if (d >= -2) return 'Distancia leve';
  if (d >= -4) return 'Relación conflictiva';
  return 'Conflicto fuerte';
}
