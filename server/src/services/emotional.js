// emotional.js — Test de salud emocional: 25 ítems, escala 0-4, ítems inversos, rango 0-100.
// Los resultados son indicadores preventivos, no diagnósticos.

export const SCALE = { 0: 'Nunca', 1: 'Casi nunca', 2: 'Algunas veces', 3: 'Frecuentemente', 4: 'Siempre' };

export const SECTIONS = {
  estado_emocional: [
    'Me siento tranquilo/a la mayor parte del tiempo.',
    'Últimamente me siento triste sin razón clara.',
    'Me enojo fácilmente por situaciones pequeñas.',
    'Siento ansiedad o nervios con frecuencia.',
    'Me siento feliz con mi vida actualmente.'
  ],
  estres_escolar: [
    'Las tareas y exámenes me generan demasiado estrés.',
    'Puedo organizar bien mi tiempo escolar.',
    'Me cuesta concentrarme en clases o tareas.',
    'Me siento presionado/a por obtener buenas calificaciones.',
    'Tengo motivación para asistir a la escuela.'
  ],
  autoestima_seguridad: [
    'Confío en mis capacidades.',
    'Me comparo constantemente con otras personas.',
    'Me siento satisfecho/a conmigo mismo/a.',
    'Me preocupa mucho la opinión de los demás.',
    'Creo que puedo superar problemas difíciles.'
  ],
  relaciones_sociales: [
    'Tengo amigos o personas con quienes hablar.',
    'Me siento apoyado/a por mi familia.',
    'Me cuesta expresar cómo me siento.',
    'Me siento solo/a con frecuencia.',
    'Puedo resolver conflictos de forma tranquila.'
  ],
  habitos_bienestar: [
    'Duermo lo suficiente.',
    'Tengo hábitos saludables de alimentación.',
    'Dedico tiempo a actividades que disfruto.',
    'Me siento cansado/a emocionalmente.',
    'Sé pedir ayuda cuando la necesito.'
  ]
};

export const ITEMS = Object.values(SECTIONS).flat(); // emo_01 .. emo_25 en orden
// Ítems formulados en positivo: puntaje se invierte para que MAYOR total = MAYOR malestar.
export const REVERSE_ITEMS = [1, 5, 7, 10, 11, 13, 15, 16, 17, 20, 21, 22, 23, 25]; // 1-based
const REVERSE_MAP = { 0: 4, 1: 3, 2: 2, 3: 1, 4: 0 };

export const RANGES = [
  { min: 0, max: 25, color: 'Verde', label: 'Salud emocional estable' },
  { min: 26, max: 50, color: 'Amarillo', label: 'Algunas áreas necesitan atención' },
  { min: 51, max: 75, color: 'Naranja', label: 'Estrés emocional moderado' },
  { min: 76, max: 100, color: 'Rojo', label: 'Se recomienda acompañamiento emocional' }
];

export function fieldName(i) { return `emo_${String(i).padStart(2, '0')}`; }

// answers: { emo_01: 0..4, ... }. Devuelve null si faltan demasiados ítems (no semáforo).
export function scoreEmotional(answers) {
  let missing = 0;
  let total = 0;
  const sectionScores = {};
  const names = Object.keys(SECTIONS);
  for (let i = 1; i <= 25; i++) {
    const raw = answers[fieldName(i)];
    const section = names[Math.floor((i - 1) / 5)];
    if (raw === undefined || raw === null || raw === '') { missing++; continue; }
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 0 || v > 4) throw new Error(`Valor inválido en ${fieldName(i)}`);
    const adjusted = REVERSE_ITEMS.includes(i) ? REVERSE_MAP[v] : v;
    total += adjusted;
    sectionScores[section] = (sectionScores[section] || 0) + adjusted;
  }
  if (missing > 3) return { incomplete: true, missing }; // regla de datos faltantes
  const range = RANGES.find(r => total >= r.min && total <= r.max);
  return { score: total, color: range.color, label: range.label, sections: sectionScores, missing };
}
