// Cronômetro de prática por exercício: quanto já foi treinado hoje, dentro do tempo reservado
// para aquele exercício. Só um cronômetro fica "andando" por vez; os outros ficam parados,
// guardando o tempo acumulado.
//
// Não sincroniza entre aparelhos (é controle da sessão de hoje, não histórico de treino: isso
// já é o que o botão "Limpo/Errei" e a marcação do exercício registram). Fica só neste
// localStorage e reinicia a cada dia.
//
// Como o metronome.js e o tab-player.js, é testável fora do navegador: storage e now() são
// injetáveis (ver tests/practice-timer.test.mjs).

const STORAGE_KEY = 'guitarPracticeTimer_v1';
const SAVE_EVERY_TICKS = 4; // grava a cada ~2s (tick de 500ms) enquanto roda, para não perder muito se o app fechar

const pad = (n) => String(n).padStart(2, '0');

function defaultTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createPracticeTimer({ storage, now = () => Date.now(), todayISO = defaultTodayISO } = {}) {
  // Só guarda o tempo de hoje: o de outros dias não serve mais para nada (cada dia é uma sessão nova).
  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const prefix = `${todayISO()}_`;
      const kept = {};
      Object.keys(data).forEach((key) => { if (key.startsWith(prefix)) kept[key] = data[key]; });
      return kept;
    } catch (e) {
      return {};
    }
  }

  const state = {
    elapsed: load(), // chave (data_dia_exercicio) -> segundos acumulados, com o cronômetro parado
    activeKey: null,
    startedAt: null,
    ticks: 0,
    timer: null,
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  const save = () => { try { storage.setItem(STORAGE_KEY, JSON.stringify(state.elapsed)); } catch (e) { /* cheio ou bloqueado */ } };

  // Soma o tempo corrido desde o último flush ao total do exercício ativo, e recomeça a contar dali.
  function flush() {
    if (state.activeKey && state.startedAt != null) {
      const current = now();
      state.elapsed[state.activeKey] = (state.elapsed[state.activeKey] || 0) + (current - state.startedAt) / 1000;
      state.startedAt = current;
    }
  }

  function stopInterval() {
    if (state.timer != null) { clearInterval(state.timer); state.timer = null; }
  }

  const api = {
    onChange(fn) { listeners.add(fn); },

    isRunning(key) { return state.activeKey === key; },

    // Segundos acumulados, incluindo o que correu desde o último flush, se for o cronômetro ativo.
    getElapsed(key) {
      const base = state.elapsed[key] || 0;
      if (state.activeKey === key && state.startedAt != null) return base + (now() - state.startedAt) / 1000;
      return base;
    },

    start(key) {
      if (state.activeKey === key) return;
      flush(); // congela o cronômetro anterior, se havia um rodando
      save();
      state.activeKey = key;
      state.startedAt = now();
      state.ticks = 0;
      stopInterval();
      state.timer = setInterval(() => {
        flush();
        state.ticks += 1;
        if (state.ticks % SAVE_EVERY_TICKS === 0) save();
        emit();
      }, 500);
      emit();
    },

    pause() {
      if (!state.activeKey) return;
      flush();
      save();
      state.activeKey = null;
      state.startedAt = null;
      stopInterval();
      emit();
    },

    toggle(key) { (api.isRunning(key) ? api.pause : () => api.start(key))(); },

    reset(key) {
      if (state.activeKey === key) { state.activeKey = null; state.startedAt = null; stopInterval(); }
      delete state.elapsed[key];
      save();
      emit();
    },
  };

  return api;
}

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
}

// Alguns navegadores em modo privado lançam erro ao usar localStorage: cai para memória.
function safeLocalStorage() {
  try {
    window.localStorage.setItem('__probe__', '1');
    window.localStorage.removeItem('__probe__');
    return window.localStorage;
  } catch (e) {
    return memoryStorage();
  }
}

export const practiceTimer = createPracticeTimer(
  typeof window !== 'undefined' ? { storage: safeLocalStorage() } : { storage: memoryStorage() },
);
