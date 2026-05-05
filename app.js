/* ============================================
   MODO BESTIA — APP.JS
   Toda la lógica de la aplicación
   ============================================ */

// ── CONSTANTES ──────────────────────────────

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const NIVELES = [
  { nombre: 'Bronce I',    badge: '🥉', min: 0,    max: 100  },
  { nombre: 'Bronce II',   badge: '🥉', min: 100,  max: 200  },
  { nombre: 'Bronce III',  badge: '🥉', min: 200,  max: 350  },
  { nombre: 'Plata I',     badge: '🥈', min: 350,  max: 500  },
  { nombre: 'Plata II',    badge: '🥈', min: 500,  max: 700  },
  { nombre: 'Plata III',   badge: '🥈', min: 700,  max: 950  },
  { nombre: 'Oro I',       badge: '🥇', min: 950,  max: 1250 },
  { nombre: 'Oro II',      badge: '🥇', min: 1250, max: 1600 },
  { nombre: 'Oro III',     badge: '🥇', min: 1600, max: 2000 },
  { nombre: 'Élite',       badge: '💎', min: 2000, max: Infinity },
];

const MENSAJES = [
  "Arrancá fuerte. La primera semana marca el tono de todo.",
  "El ritmo se construye ahora. No saltes ningún día.",
  "Ya estás en el medio del camino. Seguí empujando.",
  "La fatiga es señal de que estás progresando. No pares.",
  "Las últimas semanas son donde se forja la diferencia.",
  "Estás llegando. Cada rep cuenta más que nunca.",
  "Tope del ciclo. Deja todo en la cancha.",
  "Semana de transición. Recargá para el próximo bloque.",
];

const PUNTOS_POR_SESION = 25;

// ── ESTADO GLOBAL ────────────────────────────

// Estos son los valores que se usan si el usuario nunca configuró nada.
const DEFAULT_STATE = {
  config: {
    startDate: null,
    totalWeeks: 6,
    rirByWeek: [4, 3, 3, 2, 1, 0],
  },
  trainDays: [],      // días de la semana: 0=Dom...6=Sáb
  sessions: [],       // array de {date: 'YYYY-MM-DD', week, rir, points}
  points: 0,
};

// Estado activo de la app (empieza con los valores por defecto)
let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

// ── PERSISTENCIA (localStorage) ─────────────

/**
 * GUARDAR: Convierte el estado a texto (JSON.stringify) y lo guarda.
 * localStorage solo puede guardar texto, por eso necesitamos stringify.
 */
function saveState() {
  try {
    const texto = JSON.stringify(state);
    localStorage.setItem('modoBestia_v2', texto);
  } catch (e) {
    console.warn('No se pudo guardar el estado:', e);
  }
}

/**
 * CARGAR: Lee el texto guardado, lo convierte de vuelta a objeto (JSON.parse)
 * y lo fusiona con los valores por defecto para que nunca falte ningún campo.
 */
function loadState() {
  try {
    const texto = localStorage.getItem('modoBestia_v2');

    // Si no hay nada guardado todavía, usamos los valores por defecto
    if (!texto) return;

    // Convertimos el texto de vuelta a un objeto JavaScript
    const guardado = JSON.parse(texto);

    // FUSIÓN: combinamos lo guardado con los defaults campo por campo.
    // Esto evita que falten campos si la app se actualizó o los datos están incompletos.
    state = {
      config: {
        startDate:   guardado.config?.startDate  ?? DEFAULT_STATE.config.startDate,
        totalWeeks:  guardado.config?.totalWeeks ?? DEFAULT_STATE.config.totalWeeks,
        rirByWeek:   Array.isArray(guardado.config?.rirByWeek) && guardado.config.rirByWeek.length > 0
                       ? guardado.config.rirByWeek
                       : [...DEFAULT_STATE.config.rirByWeek],
      },
      trainDays: Array.isArray(guardado.trainDays) ? guardado.trainDays : [],
      sessions:  Array.isArray(guardado.sessions)  ? guardado.sessions  : [],
      points:    typeof guardado.points === 'number' ? guardado.points  : 0,
    };

  } catch (e) {
    // Si los datos guardados están corruptos, empezamos de cero
    console.warn('Error al cargar datos guardados. Se usarán los valores por defecto.', e);
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

// ── UTILIDADES DE FECHA ──────────────────────

function todayStr() {
  // YYYY-MM-DD en hora local
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseLocalDate(str) {
  // str = 'YYYY-MM-DD' → Date en medianoche local
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}

function formatDateNice(str) {
  const d = parseLocalDate(str);
  return `${DIAS_FULL[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// ── LÓGICA DEL CICLO ─────────────────────────

function calcCurrentWeek() {
  if (!state.config.startDate) return null;
  const start = parseLocalDate(state.config.startDate);
  const today = parseLocalDate(todayStr());
  const diff = Math.floor((today - start) / 86400000); // días
  if (diff < 0) return null;
  const total = state.config.totalWeeks;
  const weekIdx = Math.floor(diff / 7) % total; // ciclo se repite
  return weekIdx + 1; // semana 1-based
}

function calcCurrentRIR() {
  const week = calcCurrentWeek();
  if (week === null) return null;
  const rirs = state.config.rirByWeek;
  return rirs[week - 1] ?? rirs[rirs.length - 1];
}

function calcCycleProgress() {
  if (!state.config.startDate) return { pct: 0, weekNum: 0, totalWeeks: 0 };
  const start = parseLocalDate(state.config.startDate);
  const today = parseLocalDate(todayStr());
  const diff = Math.floor((today - start) / 86400000);
  const total = state.config.totalWeeks;
  const dayInCycle = diff % (total * 7);
  const pct = Math.min(100, Math.round((dayInCycle / (total * 7)) * 100));
  return { pct, weekNum: calcCurrentWeek(), totalWeeks: total };
}

// ── NIVELES ──────────────────────────────────

function getCurrentLevel(pts) {
  for (let i = NIVELES.length - 1; i >= 0; i--) {
    if (pts >= NIVELES[i].min) return i;
  }
  return 0;
}

function getLevelProgress(pts) {
  const idx = getCurrentLevel(pts);
  const lvl = NIVELES[idx];
  if (lvl.max === Infinity) return 100;
  const range = lvl.max - lvl.min;
  return Math.min(100, Math.round(((pts - lvl.min) / range) * 100));
}

// ── MENSAJES MOTIVACIONALES ──────────────────

function getMotivMsg(weekNum) {
  if (!weekNum) return "Configurá tu ciclo para comenzar 💪";
  const idx = Math.min(weekNum - 1, MENSAJES.length - 1);
  return MENSAJES[idx];
}

// ── RACHA (días consecutivos entrenados) ─────

function calcStreak() {
  if (!state.sessions.length) return 0;
  const dates = [...new Set(state.sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  let cursor = parseLocalDate(todayStr());
  for (const d of dates) {
    const dp = parseLocalDate(d);
    const diff = Math.floor((cursor - dp) / 86400000);
    if (diff === 0 || diff === 1) { streak++; cursor = dp; }
    else break;
  }
  return streak;
}

// ── RENDER: HOME ─────────────────────────────

function renderHome() {
  const today = todayStr();
  const todayDate = parseLocalDate(today);
  const weekNum = calcCurrentWeek();
  const rir = calcCurrentRIR();
  const prog = calcCycleProgress();
  const pts = state.points;
  const lvlIdx = getCurrentLevel(pts);
  const lvl = NIVELES[lvlIdx];

  // Fecha
  document.getElementById('heroDate').textContent =
    `${DIAS_FULL[todayDate.getDay()]}, ${todayDate.getDate()} de ${MESES[todayDate.getMonth()]} ${todayDate.getFullYear()}`;

  // Semana y RIR
  document.getElementById('heroWeek').textContent = weekNum ?? '--';
  document.getElementById('heroRIR').textContent = (rir !== null) ? rir : '--';

  // Mensaje
  document.getElementById('heroMsg').textContent = getMotivMsg(weekNum);

  // Progreso
  document.getElementById('heroProgressFill').style.width = prog.pct + '%';
  document.getElementById('heroProgressLabel').textContent =
    weekNum ? `Semana ${prog.weekNum} de ${prog.totalWeeks} · ${prog.pct}% del ciclo` : 'Sin ciclo configurado';

  // Nivel
  document.getElementById('levelBadge').textContent = lvl.badge;
  document.getElementById('levelName').textContent = lvl.nombre;
  document.getElementById('levelPts').textContent = `${pts} puntos`;
  const nextLvl = NIVELES[lvlIdx + 1];
  document.getElementById('levelNext').textContent =
    nextLvl ? `Próximo: ${nextLvl.min} pts` : '¡Nivel máximo!';
  document.getElementById('levelBarFill').style.width = getLevelProgress(pts) + '%';

  // Días de la semana (lunes a domingo)
  renderWeekDaysHome();
}

function renderWeekDaysHome() {
  const today = parseLocalDate(todayStr());
  const dow = today.getDay(); // 0=Dom
  // Calcular el lunes de esta semana
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const container = document.getElementById('weekDaysHome');
  container.innerHTML = '';

  // Días: Lun(1) a Dom(0) — mostramos L M M J V S D
  const order = [1,2,3,4,5,6,0];

  for (let i = 0; i < 7; i++) {
    const dayDow = order[i];
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday = dStr === todayStr();
    const isTrain = state.trainDays.includes(dayDow);
    const isDone = state.sessions.some(s => s.date === dStr);

    const el = document.createElement('div');
    el.className = 'day-chip';
    if (isTrain) el.classList.add('is-training');
    if (isToday) el.classList.add('is-today');
    if (isDone) el.classList.add('is-done');

    el.innerHTML = `
      <span class="day-abbr">${DIAS[dayDow]}</span>
      <span class="day-icon">${isDone ? '✅' : isTrain ? '🏋️' : '—'}</span>
    `;
    container.appendChild(el);
  }
}

// ── RENDER: TRAINING ─────────────────────────

function renderTraining() {
  renderDaySelector();
  renderRegisterCard();
  renderHistory();
}

function renderDaySelector() {
  const container = document.getElementById('daySelector');
  container.innerHTML = '';
  const order = [1,2,3,4,5,6,0];
  order.forEach(dow => {
    const btn = document.createElement('button');
    btn.className = 'day-sel-btn' + (state.trainDays.includes(dow) ? ' selected' : '');
    btn.textContent = DIAS[dow];
    btn.onclick = () => {
      if (state.trainDays.includes(dow)) {
        state.trainDays = state.trainDays.filter(d => d !== dow);
      } else {
        state.trainDays.push(dow);
      }
      saveState();
      renderDaySelector();
      renderWeekDaysHome();
    };
    container.appendChild(btn);
  });
}

function renderRegisterCard() {
  const today = todayStr();
  const todayDate = parseLocalDate(today);
  const weekNum = calcCurrentWeek();
  const rir = calcCurrentRIR();

  document.getElementById('regDate').textContent = `${todayDate.getDate()}/${todayDate.getMonth()+1}/${todayDate.getFullYear()}`;
  document.getElementById('regWeek').textContent = weekNum ? `Semana ${weekNum}` : '—';
  document.getElementById('regRIR').textContent = (rir !== null) ? rir : '—';

  const alreadyDone = state.sessions.some(s => s.date === today);
  const btn = document.getElementById('btnComplete');
  const msg = document.getElementById('completedMsg');

  if (alreadyDone) {
    btn.disabled = true;
    btn.textContent = '✔ YA REGISTRADO HOY';
    msg.classList.remove('hidden');
  } else {
    btn.disabled = false;
    btn.textContent = '✔ MARCAR COMO COMPLETADO';
    msg.classList.add('hidden');
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const sessions = [...state.sessions].reverse().slice(0, 10);
  if (!sessions.length) {
    list.innerHTML = '<p class="history-empty">Todavía no registraste ningún entrenamiento.</p>';
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="history-item">
      <span class="h-date">${formatDateNice(s.date)} · Sem ${s.week ?? '?'} · RIR ${s.rir ?? '?'}</span>
      <span class="h-pts">+${s.points}pts</span>
    </div>
  `).join('');
}

// ── REGISTRO DE ENTRENAMIENTO ─────────────────

document.getElementById('btnComplete').addEventListener('click', () => {
  const today = todayStr();
  const alreadyDone = state.sessions.some(s => s.date === today);
  if (alreadyDone) return;

  const session = {
    date: today,
    week: calcCurrentWeek(),
    rir: calcCurrentRIR(),
    points: PUNTOS_POR_SESION,
  };
  state.sessions.push(session);
  state.points += PUNTOS_POR_SESION;
  saveState();
  renderAll();
});

// ── RENDER: PROGRESO ─────────────────────────

function renderProgress() {
  const pts = state.points;
  const sessions = state.sessions.length;
  const streak = calcStreak();
  const lvlIdx = getCurrentLevel(pts);

  document.getElementById('statPoints').textContent = pts;
  document.getElementById('statSessions').textContent = sessions;
  document.getElementById('statStreak').textContent = streak;

  // Lista de niveles
  const list = document.getElementById('levelsList');
  list.innerHTML = NIVELES.map((lvl, i) => `
    <div class="level-row ${i === lvlIdx ? 'current' : ''}">
      <span class="lr-badge">${lvl.badge}</span>
      <div class="lr-info">
        <div class="lr-name">${lvl.nombre}</div>
        <div class="lr-range">${lvl.min} – ${lvl.max === Infinity ? '∞' : lvl.max} pts</div>
      </div>
      ${i === lvlIdx ? '<span class="lr-tag">ACTUAL</span>' : ''}
    </div>
  `).join('');

  // Info del ciclo
  const ci = document.getElementById('cycleInfo');
  const weekNum = calcCurrentWeek();
  const rir = calcCurrentRIR();
  if (state.config.startDate) {
    ci.innerHTML = `
      <div class="ci-row"><span class="ci-label">Inicio del ciclo</span><span class="ci-val">${formatDateNice(state.config.startDate)}</span></div>
      <div class="ci-row"><span class="ci-label">Duración</span><span class="ci-val">${state.config.totalWeeks} semanas</span></div>
      <div class="ci-row"><span class="ci-label">Semana actual</span><span class="ci-val">${weekNum ?? '—'}</span></div>
      <div class="ci-row"><span class="ci-label">RIR hoy</span><span class="ci-val">${rir !== null ? rir : '—'}</span></div>
    `;
  } else {
    ci.innerHTML = '<p class="history-empty">Configurá el ciclo para ver la información.</p>';
  }
}

// ── RENDER GLOBAL ────────────────────────────

function renderAll() {
  renderHome();
  renderTraining();
  renderProgress();
}

// ── CONFIGURACIÓN MODAL ──────────────────────

function openConfig() {
  const modal = document.getElementById('modalConfig');
  modal.classList.remove('hidden');

  // Cargar valores actuales
  document.getElementById('cfgStartDate').value = state.config.startDate ?? todayStr();
  document.getElementById('cfgWeeks').value = state.config.totalWeeks;

  renderRIRInputs();
}

function closeConfig() {
  document.getElementById('modalConfig').classList.add('hidden');
}

function renderRIRInputs() {
  const total = parseInt(document.getElementById('cfgWeeks').value) || 6;
  const container = document.getElementById('rirInputs');
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const val = state.config.rirByWeek[i] ?? 2;
    container.innerHTML += `
      <div class="rir-row">
        <label>Semana ${i + 1}</label>
        <input type="number" class="rir-input" data-week="${i}" min="0" max="10" value="${val}" />
      </div>
    `;
  }
}

document.getElementById('cfgWeeks').addEventListener('input', renderRIRInputs);

document.getElementById('btnConfig').addEventListener('click', openConfig);
document.getElementById('modalClose').addEventListener('click', closeConfig);
document.getElementById('modalBg').addEventListener('click', closeConfig);

document.getElementById('btnSave').addEventListener('click', () => {
  const startDate  = document.getElementById('cfgStartDate').value;
  const totalWeeks = parseInt(document.getElementById('cfgWeeks').value) || 6;

  // CORRECCIÓN: leemos los inputs desde su contenedor específico (#rirInputs),
  // no con querySelectorAll global que puede fallar si el modal está oculto.
  const contenedor = document.getElementById('rirInputs');
  const rirInputs  = contenedor.querySelectorAll('.rir-input');

  // Si por algún motivo no hay inputs todavía, no guardamos y avisamos
  if (rirInputs.length === 0) {
    alert('Hubo un problema leyendo los valores de RIR. Intentá de nuevo.');
    return;
  }

  const rirByWeek = Array.from(rirInputs).map(inp => {
    const val = parseInt(inp.value);
    // Si el valor no es un número válido, usamos 0 como fallback
    return isNaN(val) ? 0 : val;
  });

  // Actualizamos el estado con los nuevos valores
  state.config = { startDate, totalWeeks, rirByWeek };

  // Guardamos en localStorage
  saveState();

  // Actualizamos la pantalla
  renderAll();
  closeConfig();
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('⚠ ¿Estás seguro? Esto borrará todos tus datos: puntos, historial y configuración.')) {
    localStorage.removeItem('modoBestia_v2');
    // Usamos una copia profunda del DEFAULT_STATE para evitar mutaciones accidentales
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    renderAll();
    closeConfig();
  }
});

// ── NAVEGACIÓN ───────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Botones
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Renderizar la pestaña activa
    if (tab === 'home') renderHome();
    if (tab === 'training') renderTraining();
    if (tab === 'progress') renderProgress();
  });
});

// ── INICIO ───────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Mostrar la app después del splash
  setTimeout(() => {
    document.getElementById('app').classList.remove('hidden');
    renderAll();
  }, 1900);
});
