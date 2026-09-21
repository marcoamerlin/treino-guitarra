// Armazenamento local (localStorage). Toda a persistência do app passa por aqui;
// a sincronização com o Supabase (sync.js) usa snapshot() e applyRemote().
//
//   logs   { "2026-09-21_seg": { done: {exId: bool}, t: {exId: ms}, notes, notesAt } }
//   speeds { exId: { bpm, clean, errors, history: [{date, bpm}], updatedAt } }  — vale para sempre
//   plans  { seg: { items: [{ex, min}] | null, updatedAt } }  — items null = plano padrão
//   prefs  { metroBpm, metroBeats, metroSub }  — só deste aparelho, não sincroniza
//
// Todo registro sincronizado leva carimbo de tempo, para o merge (merge.js) saber qual é mais novo.

const KEY = 'guitarTraining_v2';
const MIN_BPM = 30;
const MAX_BPM = 260;

const fresh = () => ({ logs: {}, speeds: {}, plans: {}, prefs: {} });
const now = () => Date.now();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (!parsed || !parsed.logs) return fresh();
    const data = { ...fresh(), ...parsed };
    // formato antigo: plano era só a lista de exercícios
    Object.keys(data.plans).forEach((day) => {
      if (Array.isArray(data.plans[day])) data.plans[day] = { items: data.plans[day], updatedAt: 0 };
    });
    return data;
  } catch (e) {
    return fresh();
  }
}

let data = load();
const changeListeners = new Set();
const remoteListeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* cheio ou bloqueado */ }
}

// Salva e avisa que houve mudança local (a sincronização escuta isso).
function save() {
  persist();
  changeListeners.forEach((fn) => fn());
}

const clamp = (bpm) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

function pushHistory(speed, date) {
  const last = speed.history[speed.history.length - 1];
  if (last && last.date === date) last.bpm = speed.bpm;
  else speed.history.push({ date, bpm: speed.bpm });
  speed.history = speed.history.slice(-60);
}

function ensureSpeed(id, cfg, date) {
  if (!data.speeds[id]) {
    data.speeds[id] = { bpm: cfg.start, clean: 0, errors: 0, history: [], updatedAt: now() };
    pushHistory(data.speeds[id], date);
  }
  return data.speeds[id];
}

function ensureLog(date, dayKey) {
  const key = date + '_' + dayKey;
  const log = data.logs[key] || (data.logs[key] = { done: {}, t: {}, notes: '', notesAt: 0 });
  // registros criados antes dos carimbos de tempo não têm t/notesAt
  if (!log.done) log.done = {};
  if (!log.t) log.t = {};
  if (!log.notesAt) log.notesAt = 0;
  return log;
}

export const store = {
  // ---- Ligação com a sincronização ----
  onChange(fn) { changeListeners.add(fn); },
  onRemoteChange(fn) { remoteListeners.add(fn); },
  snapshot() {
    return JSON.parse(JSON.stringify({ logs: data.logs, speeds: data.speeds, plans: data.plans }));
  },
  applyRemote(merged) {
    data.logs = merged.logs;
    data.speeds = merged.speeds;
    data.plans = merged.plans;
    persist();
    remoteListeners.forEach((fn) => fn());
  },

  // ---- Registro do dia ----
  peekLog(date, dayKey) {
    return data.logs[date + '_' + dayKey] || null;
  },
  // Leitura: não cria registro (registro vazio não vale sincronizar).
  getLog(date, dayKey) {
    return data.logs[date + '_' + dayKey] || { done: {}, t: {}, notes: '', notesAt: 0 };
  },
  toggleDone(date, dayKey, exId) {
    const log = ensureLog(date, dayKey);
    log.done[exId] = !log.done[exId];
    log.t[exId] = now();
    save();
  },
  setNotes(date, dayKey, text) {
    const log = ensureLog(date, dayKey);
    log.notes = text;
    log.notesAt = now();
    save();
  },
  hasActivity(date) {
    return Object.keys(data.logs).some((key) => key.startsWith(date + '_')
      && Object.values(data.logs[key].done || {}).some(Boolean));
  },

  // ---- Velocidade por exercício ----
  getSpeed(id, cfg) {
    return data.speeds[id] || { bpm: cfg.start, clean: 0, errors: 0, history: [] };
  },
  // 3 limpos seguidos = +step; 2 erros seguidos = −step. Devolve 'up' | 'down' | null.
  recordRun(id, cfg, ok, date) {
    const speed = ensureSpeed(id, cfg, date);
    const step = cfg.step || 4;
    let event = null;
    if (ok) {
      speed.clean += 1;
      speed.errors = 0;
      if (speed.clean >= 3) {
        speed.bpm = clamp(speed.bpm + step);
        speed.clean = 0;
        event = 'up';
      }
    } else {
      speed.errors += 1;
      speed.clean = 0;
      if (speed.errors >= 2) {
        speed.bpm = clamp(speed.bpm - step);
        speed.errors = 0;
        event = 'down';
      }
    }
    if (event) pushHistory(speed, date);
    speed.updatedAt = now();
    save();
    return event;
  },
  adjustSpeed(id, cfg, delta, date) {
    const speed = ensureSpeed(id, cfg, date);
    speed.bpm = clamp(speed.bpm + delta);
    speed.clean = 0;
    speed.errors = 0;
    pushHistory(speed, date);
    speed.updatedAt = now();
    save();
  },

  // ---- Plano de cada dia ----
  getPlan(dayKey, defaultPlan) {
    const custom = data.plans[dayKey];
    const items = custom && Array.isArray(custom.items) ? custom.items : defaultPlan;
    return items.map((item) => ({ ...item }));
  },
  isCustomPlan(dayKey) {
    const custom = data.plans[dayKey];
    return Boolean(custom && Array.isArray(custom.items));
  },
  setPlan(dayKey, items) {
    data.plans[dayKey] = { items: items.map((item) => ({ ...item })), updatedAt: now() };
    save();
  },
  // Guarda "sem plano personalizado" com carimbo, para a restauração também sincronizar.
  resetPlan(dayKey) {
    data.plans[dayKey] = { items: null, updatedAt: now() };
    save();
  },

  // ---- Preferências deste aparelho ----
  getPref(name, fallback) {
    return name in data.prefs ? data.prefs[name] : fallback;
  },
  setPref(name, value) {
    data.prefs[name] = value;
    persist();
  },
};
