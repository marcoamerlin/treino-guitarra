// Armazenamento local (localStorage). Toda a persistência do app passa por aqui;
// a sincronização com o Supabase (sync.js) usa snapshot() e applyRemote().
//
//   logs   { "2026-09-21_seg": { done: {exId: bool}, t: {exId: ms}, notes, notesAt, plan? } }
//            plan: foto do plano do dia no 1º toque (ver ensureLog) — congelada, nunca muda
//            depois; sem ela (logs de antes dessa mudança), quem lê tem que usar o plano atual
//            como estimativa (ver app.js, tela de andamento do professor)
//   speeds { exId: { bpm, clean, errors, history: [{date, bpm}], updatedAt } }  — vale para sempre
//   plans  { seg: { items: [{ex, min}] | null, updatedAt } }  — items null = plano padrão
//   exercises { meu_xxx: { id, title, text, min, createdAt, updatedAt } | { id, deleted, updatedAt } }
//            — exercícios criados pelo usuário (custom-exercises.js); a chave some do snapshot se vazia
//   prefs  { metroBpm, metroBeats, metroSubdiv, exSubdiv: {id: n} }  — só deste aparelho, não sincroniza
//
// Todo registro sincronizado leva carimbo de tempo, para o merge (merge.js) saber qual é mais novo.

const KEY = 'guitarTraining_v2';
const MIN_BPM = 30;
const MAX_BPM = 260;

const fresh = () => ({ logs: {}, speeds: {}, plans: {}, exercises: {}, prefs: {} });
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

// planSnapshot: o plano do dia no momento do 1º toque, gravado uma vez e nunca mais mudado —
// é o que permite ver depois "o que existia naquele dia", mesmo se o plano for editado no futuro
// (pelo aluno ou pelo professor). Sem isso, o histórico de um dia passado ficava preso ao plano
// ATUAL da semana, dando informação errada quando o plano mudava (achado testando com o usuário).
function ensureLog(date, dayKey, planSnapshot) {
  const key = date + '_' + dayKey;
  const isNew = !data.logs[key];
  const log = data.logs[key] || (data.logs[key] = { done: {}, t: {}, notes: '', notesAt: 0 });
  // registros criados antes dos carimbos de tempo não têm t/notesAt
  if (!log.done) log.done = {};
  if (!log.t) log.t = {};
  if (!log.notesAt) log.notesAt = 0;
  if (isNew && !log.plan && Array.isArray(planSnapshot)) {
    log.plan = planSnapshot.map((item) => ({ ex: item.ex, min: item.min }));
  }
  return log;
}

export const store = {
  // ---- Ligação com a sincronização ----
  onChange(fn) { changeListeners.add(fn); },
  onRemoteChange(fn) { remoteListeners.add(fn); },
  snapshot() {
    const out = { logs: data.logs, speeds: data.speeds, plans: data.plans };
    if (Object.keys(data.exercises).length) out.exercises = data.exercises; // simétrico a mergeData
    return JSON.parse(JSON.stringify(out));
  },
  applyRemote(merged) {
    data.logs = merged.logs;
    data.speeds = merged.speeds;
    data.plans = merged.plans;
    data.exercises = merged.exercises || {};
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
  toggleDone(date, dayKey, exId, planSnapshot) {
    const log = ensureLog(date, dayKey, planSnapshot);
    log.done[exId] = !log.done[exId];
    log.t[exId] = now();
    save();
  },
  setNotes(date, dayKey, text, planSnapshot) {
    const log = ensureLog(date, dayKey, planSnapshot);
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

  // ---- Exercícios criados pelo usuário ----
  // Devolve os registros crus (incluindo as lápides); quem mostra passa por customToExercise().
  getCustomExercises() {
    return { ...data.exercises };
  },
  // Cria (sem id) ou edita (com id). `fields` já vem limpo de cleanFields(). Devolve o id.
  saveCustomExercise(id, fields) {
    const existing = data.exercises[id];
    const t = now();
    data.exercises[id] = {
      id,
      title: fields.title,
      text: fields.text,
      min: fields.min,
      createdAt: existing && existing.createdAt ? existing.createdAt : t,
      updatedAt: t,
    };
    // metrônomo opcional; editar e apagar o BPM tira a chave (o registro novo substitui o velho)
    if (fields.bpm) data.exercises[id].bpm = { start: fields.bpm.start, goal: fields.bpm.goal };
    save();
    return id;
  },
  // Observação do aluno num exercício que veio do professor (campo à parte: o conteúdo do
  // professor o aluno não edita, só anota). Vazia some do registro. Mexe só no registro que já
  // existe; apagado ou inexistente não volta.
  setCustomNote(id, text, max = 1000) {
    const rec = data.exercises[id];
    if (!rec || rec.deleted) return;
    const clean = String(text ?? '').trim().slice(0, max);
    if (clean) rec.note = clean; else delete rec.note;
    // noteAt: carimbo só da observação (ver mergeExercises). Apagar também carimba, pra o "vazio"
    // vencer uma observação mais velha em outro aparelho.
    rec.noteAt = now();
    rec.updatedAt = rec.noteAt;
    save();
  },
  // Lápide, não remoção: ver custom-exercises.js. Some do plano porque o id deixa de existir.
  deleteCustomExercise(id) {
    data.exercises[id] = { id, deleted: true, updatedAt: now() };
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
