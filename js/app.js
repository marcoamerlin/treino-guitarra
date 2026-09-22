import { WEEK } from './data/plans.js';
import { EXERCISES, CATEGORIES } from './data/exercises.js';
import { CHORDS, chordCol } from './data/chords.js';
import { chordSVG } from './chord-diagram.js';
import { buildTab } from './tab.js';
import { metronome } from './metronome.js';
import { tabPlayer } from './tab-player.js';
import { practiceTimer } from './practice-timer.js';
import { NOTE_NAMES, SCALES, hasPositions, positionsOf, fretboardNotes } from './theory.js';
import { fretboardSVG } from './fretboard.js';
import { store } from './store.js';
import { sync } from './sync.js';

// ---- Utilidades -----------------------------------------------------------

const $ = (selector) => document.querySelector(selector);

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const today = new Date();
const todayISO = isoDate(today);

// Data deste dia da semana dentro da semana atual (segunda a domingo).
function dateFor(weekday) {
  const d = new Date(today);
  d.setDate(d.getDate() - ((today.getDay() + 6) % 7) + ((weekday + 6) % 7));
  return d;
}

// Chave do cronômetro de um exercício: um por dia (a mesma data usada no registro do dia).
const timerKey = (dateStr, dayKey, exId) => `${dateStr}_${dayKey}_${exId}`;

function formatClock(seconds) {
  const s = Math.round(Math.abs(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

let toastTimer = null;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2400);
}

// ---- Estado da tela ---------------------------------------------------------

let activeKey = (WEEK.find((d) => d.weekday === today.getDay()) || WEEK[0]).key;
let editing = false;
let openIds = {};
let pageRedrawers = [];   // atualizações de tela dependentes do metrônomo (página)
let sheetRedrawers = [];  // idem, para a folha aberta

const currentPlan = (day) => store.getPlan(day.key, day.plan).filter((item) => EXERCISES[item.ex]);

function updatePlan(day, mutate) {
  const items = currentPlan(day);
  mutate(items);
  store.setPlan(day.key, items);
  render();
}

function computeStreak() {
  let streak = 0;
  const d = new Date(today);
  for (let i = 0; i < 365; i++) {
    if (store.hasActivity(isoDate(d))) streak += 1;
    else if (i !== 0 && d.getDay() !== 0) break; // hoje ainda vazio e domingo de descanso não quebram
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ---- Folha (bottom sheet) ---------------------------------------------------

const sheet = $('#sheet');
const sheetBody = $('#sheetBody');

// A view já foi criada (e registrou seu redesenho em sheetRedrawers) antes de chegar aqui,
// então a lista só é limpa ao fechar a folha.
function openSheet(node) {
  sheetBody.replaceChildren(node);
  sheet.classList.add('open');
  sheet.querySelector('.sheet').scrollTop = 0;
}

function closeSheet() {
  sheet.classList.remove('open');
  sheetBody.replaceChildren();
  sheetRedrawers = [];
}

sheet.addEventListener('click', (e) => {
  if (e.target === sheet || e.target.closest('#sheetClose')) closeSheet();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---- Acorde -----------------------------------------------------------------

function chordView(id) {
  const chord = CHORDS[id];
  const root = el('div');
  root.innerHTML =
    `<h2>${chord.name}</h2><div class="sub">${chord.subtitle}</div>` +
    `<div class="chord-figure">${chordSVG(chord)}</div>` +
    `<div class="tab-readout"><pre>${buildTab([chordCol(id)])}</pre></div>` +
    `<ol class="steps">${chord.steps.map((s) => `<li>${s}</li>`).join('')}</ol>` +
    (chord.tip ? `<p class="tip">${chord.tip}</p>` : '');
  return root;
}

// ---- Metrônomo ---------------------------------------------------------------

function metronomeView() {
  const root = el('div');
  root.innerHTML =
    '<h2>Metrônomo</h2><div class="sub">Livre, independente dos exercícios</div>' +
    '<div class="bpm-readout">' +
      '<button class="bpm-btn" data-delta="-4">−4</button>' +
      '<button class="bpm-btn" data-delta="-1">−1</button>' +
      '<div class="bpm-lcd"><div class="num"></div><div class="unit">BPM</div></div>' +
      '<button class="bpm-btn" data-delta="1">+1</button>' +
      '<button class="bpm-btn" data-delta="4">+4</button>' +
    '</div>' +
    '<input class="bpm-range" type="range" min="30" max="240" aria-label="BPM">' +
    '<div class="label-row"><span>COMPASSO</span></div>' +
    '<div class="seg-row">' +
      [2, 3, 4, 6].map((n) => `<button class="seg" data-beats="${n}">${n}</button>`).join('') +
    '</div>' +
    '<button class="toggle-row" data-sub><span>Colcheias (2 cliques por tempo)</span>' +
      '<span class="switch"><span class="knob"></span></span></button>' +
    '<button class="metro-btn big" data-toggle><span class="beat-led"></span><span class="label"></span></button>';

  const range = root.querySelector('.bpm-range');
  const update = () => {
    root.querySelector('.num').textContent = metronome.bpm;
    range.value = metronome.bpm;
    root.querySelectorAll('.seg').forEach((b) => b.classList.toggle('on', Number(b.dataset.beats) === metronome.beats));
    root.querySelector('.toggle-row .switch').classList.toggle('on', metronome.subdivide);
    const button = root.querySelector('[data-toggle]');
    button.classList.toggle('on', metronome.running);
    button.querySelector('.label').textContent = metronome.running ? 'Parar' : 'Iniciar';
  };
  const remember = () => {
    store.setPref('metroBpm', metronome.bpm);
    store.setPref('metroBeats', metronome.beats);
    store.setPref('metroSub', metronome.subdivide);
  };

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.delta) { metronome.setBpm(metronome.bpm + Number(btn.dataset.delta)); remember(); }
    else if (btn.dataset.beats) { metronome.setBeats(Number(btn.dataset.beats)); remember(); }
    else if ('sub' in btn.dataset) { metronome.setSubdivide(!metronome.subdivide); remember(); }
    else if ('toggle' in btn.dataset) metronome.toggle();
    update();
  });
  range.addEventListener('input', () => { metronome.setBpm(Number(range.value)); remember(); update(); });

  sheetRedrawers.push(update);
  update();
  return root;
}

// ---- Explorador de escalas -------------------------------------------------------------

const scalesOverlay = $('#scalesView');
const scalesBody = $('#scalesBody');

function openScales() { scalesBody.replaceChildren(scaleExplorerView()); scalesOverlay.classList.add('open'); }
function closeScales() { scalesOverlay.classList.remove('open'); }

// "Todas" = modo 0; posição 1..N = aquela caixa só. Ao trocar de escala, uma posição fora do
// alcance da nova escala volta para "Todas" (ver draw() abaixo).
function scaleExplorerView() {
  const rootPc = store.getPref('scaleRoot', 9); // A
  const scaleKey = store.getPref('scaleType', 'pentMinor');

  const root = el('div');
  root.innerHTML =
    '<div class="chip-row root-row"></div>' +
    '<div class="chip-row scale-row"></div>' +
    '<div class="scale-info"><span class="scale-name"></span><span class="scale-degrees"></span></div>' +
    '<div class="chip-row pos-row"></div>' +
    '<div class="fret-scroll"><div class="fret-inner"></div></div>' +
    '<p class="tip"></p>';

  const rootRow = root.querySelector('.root-row');
  NOTE_NAMES.forEach((name, pc) => {
    const chip = el('button', `chip${pc === rootPc ? ' on' : ''}`, name);
    chip.addEventListener('click', () => { store.setPref('scaleRoot', pc); store.setPref('scaleMode', 0); draw(); });
    rootRow.appendChild(chip);
  });

  const scaleRow = root.querySelector('.scale-row');
  Object.entries(SCALES).forEach(([key, scale]) => {
    const chip = el('button', `chip${key === scaleKey ? ' on' : ''}`, scale.label);
    chip.addEventListener('click', () => { store.setPref('scaleType', key); store.setPref('scaleMode', 0); draw(); });
    scaleRow.appendChild(chip);
  });

  function draw() {
    const rp = store.getPref('scaleRoot', 9);
    const sk = store.getPref('scaleType', 'pentMinor');
    const scale = SCALES[sk];
    const withPositions = hasPositions(sk);
    const pos = withPositions ? positionsOf(rp, sk) : [];
    let m = withPositions ? store.getPref('scaleMode', 0) : 0;
    if (m > pos.length) { m = 0; store.setPref('scaleMode', 0); }

    root.querySelectorAll('.root-row .chip').forEach((c, pc) => c.classList.toggle('on', pc === rp));
    root.querySelectorAll('.scale-row .chip').forEach((c) => c.classList.toggle('on', c.textContent === scale.label));
    root.querySelector('.scale-name').textContent = `${NOTE_NAMES[rp]} ${scale.label}`;
    root.querySelector('.scale-degrees').textContent = scale.degrees.join('  ');

    const posRow = root.querySelector('.pos-row');
    posRow.innerHTML = '';
    if (withPositions) {
      const all = el('button', `chip${m === 0 ? ' on' : ''}`, 'Todas');
      all.addEventListener('click', () => { store.setPref('scaleMode', 0); draw(); });
      posRow.appendChild(all);
      pos.forEach((p) => {
        const chip = el('button', `chip${m === p.index ? ' on' : ''}`, String(p.index));
        chip.addEventListener('click', () => { store.setPref('scaleMode', p.index); draw(); });
        posRow.appendChild(chip);
      });
    }

    const fretStart = m === 0 ? 0 : Math.max(0, pos[m - 1].start - 1);
    const fretEnd = m === 0 ? 12 : pos[m - 1].end + 1;
    const notes = fretboardNotes(rp, sk, fretStart, fretEnd);
    root.querySelector('.fret-inner').innerHTML = fretboardSVG({ fretStart, fretEnd, dots: notes });

    root.querySelector('.tip').textContent = withPositions
      ? (m === 0
        ? 'Toque numa posição (1 a 5) para ver só aquela caixa. A raiz aparece com o anel dourado.'
        : `Posição ${m} de ${pos.length}: casas ${pos[m - 1].start} a ${pos[m - 1].end}. A última casa desta posição é a primeira da próxima — é por onde elas se conectam no braço.`)
      : 'Escala de 7 notas: aqui só o braço inteiro, sem posições (as janelas entre graus ficam curtas demais para virar uma caixa de mão).';
  }

  draw();
  return root;
}

$('#scalesBtn').addEventListener('click', openScales);
$('#scalesClose').addEventListener('click', closeScales);
scalesOverlay.addEventListener('click', (e) => { if (e.target === scalesOverlay) closeScales(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && scalesOverlay.classList.contains('open')) closeScales(); });

// ---- Conta e sincronização ------------------------------------------------------------

const SYNC_LABELS = {
  disabled: 'Só local',
  'signed-out': 'Entrar',
  idle: 'Conectado',
  syncing: 'Sincronizando…',
  ok: 'Sincronizado',
  offline: 'Sem conexão',
  error: 'Erro',
};

const clock = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function loginMessage(error) {
  const text = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(text)) return 'Este e-mail ainda não foi confirmado no Supabase.';
  return text;
}

function accountView() {
  const root = el('div');
  let lastKey = '';

  const draw = () => {
    const s = sync.getState();
    const key = [s.status, s.email, s.error, s.lastSync].join('|');
    if (key === lastKey) return;
    lastKey = key;

    if (s.status === 'disabled') {
      root.innerHTML =
        '<h2>Conta e sincronização</h2>' +
        '<div class="sub">Ainda não configurada neste app</div>' +
        '<p class="tip">Enquanto isso, o treino fica salvo só neste aparelho.</p>';
    } else if (s.email) {
      const info = s.status === 'syncing' ? 'Sincronizando…'
        : s.status === 'ok' ? `Sincronizado às ${clock(s.lastSync)}`
        : s.status === 'offline' ? 'Sem conexão. Sincroniza quando a internet voltar.'
        : s.status === 'error' ? `Erro: ${s.error}`
        : 'Conectado';
      root.innerHTML =
        '<h2>Conta e sincronização</h2>' +
        '<div class="sub">Conectado como <strong></strong></div>' +
        `<p class="sync-info ${s.status === 'error' ? 'bad' : ''}"></p>` +
        '<div class="day-actions">' +
          '<button class="action" data-sync>Sincronizar agora</button>' +
          '<button class="action" data-out>Sair deste aparelho</button>' +
        '</div>' +
        '<p class="tip">Sair não apaga o treino guardado neste aparelho, só desliga a sincronização.</p>';
      root.querySelector('strong').textContent = s.email;
      root.querySelector('.sync-info').textContent = info;
      root.querySelector('[data-sync]').addEventListener('click', async () => {
        await sync.syncNow();
        // Deu certo: deixa ver a confirmação por um instante e fecha. Deu erro: fica aberta com o motivo.
        if (sync.getState().status !== 'ok') return;
        setTimeout(() => {
          if (!root.isConnected) return; // a folha já foi fechada ou trocada
          closeSheet();
          toast('Sincronizado.');
        }, 1000);
      });
      root.querySelector('[data-out]').addEventListener('click', () => sync.signOut());
    } else {
      root.innerHTML =
        '<h2>Conta e sincronização</h2>' +
        '<div class="sub">Entre para manter o treino igual no celular e no notebook.</div>' +
        '<form class="account-form">' +
          '<label>E-mail<input type="email" name="email" autocomplete="username" required></label>' +
          '<label>Senha<input type="password" name="password" autocomplete="current-password" required></label>' +
          '<button class="action primary" type="submit">Entrar</button>' +
          '<p class="form-error" role="alert"></p>' +
        '</form>';
      const form = root.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = form.querySelector('button');
        const message = form.querySelector('.form-error');
        submit.disabled = true;
        message.textContent = '';
        try {
          await sync.signIn(form.email.value.trim(), form.password.value);
        } catch (error) {
          message.textContent = loginMessage(error);
          submit.disabled = false;
        }
      });
    }
  };

  sheetRedrawers.push(draw);
  draw();
  return root;
}

// ---- Velocidade + metrônomo dentro do exercício --------------------------------

function speedBox(id, ex) {
  const cfg = ex.bpm;
  const step = cfg.step || 4;
  const box = el('div', 'bpm-box');
  box.innerHTML =
    `<div class="label-row"><span>VELOCIDADE ATUAL</span><span>meta ${cfg.goal} BPM</span></div>` +
    '<div class="bpm-readout">' +
      `<button class="bpm-btn" data-delta="${-step}" aria-label="Diminuir ${step} BPM">−</button>` +
      '<div class="bpm-lcd"><div class="num"></div><div class="unit">BPM</div></div>' +
      `<button class="bpm-btn" data-delta="${step}" aria-label="Aumentar ${step} BPM">+</button>` +
    '</div>' +
    '<div class="run-row">' +
      '<button class="run-btn ok" data-run="ok">✓ Limpo <small></small></button>' +
      '<button class="run-btn bad" data-run="bad">✗ Errei <small></small></button>' +
    '</div>' +
    '<button class="metro-btn" data-metro><span class="beat-led"></span><span class="label"></span></button>' +
    '<div data-history></div>' +
    `<div class="rule">3 limpos seguidos = +${step} BPM · 2 erros seguidos = −${step} BPM</div>`;

  const update = () => {
    const speed = store.getSpeed(id, cfg);
    box.querySelector('.num').textContent = speed.bpm;
    box.querySelector('.ok small').textContent = `${speed.clean}/3`;
    box.querySelector('.bad small').textContent = `${speed.errors}/2`;
    box.querySelector('[data-metro]').classList.toggle('on', metronome.running);
    box.querySelector('[data-metro] .label').textContent = metronome.running ? 'Parar metrônomo' : `Tocar metrônomo a ${speed.bpm} BPM`;

    const history = speed.history.slice(-12);
    const holder = box.querySelector('[data-history]');
    if (history.length > 1) {
      const max = Math.max(...history.map((h) => h.bpm), cfg.goal);
      holder.className = 'bpm-history';
      holder.innerHTML = history
        .map((h) => `<div class="bar" style="height:${Math.max(6, (h.bpm / max) * 34)}px" title="${h.date} — ${h.bpm} BPM"></div>`)
        .join('');
    } else {
      holder.className = 'bpm-history-empty';
      holder.textContent = 'O histórico de velocidade aparece aqui conforme você evolui.';
    }
  };

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.delta) {
      store.adjustSpeed(id, cfg, Number(btn.dataset.delta), todayISO);
      if (metronome.running) metronome.setBpm(store.getSpeed(id, cfg).bpm);
    } else if (btn.dataset.run) {
      const event = store.recordRun(id, cfg, btn.dataset.run === 'ok', todayISO);
      const bpm = store.getSpeed(id, cfg).bpm;
      if (event === 'up') toast(`Subiu para ${bpm} BPM. Bom trabalho!`);
      if (event === 'down') toast(`Voltou para ${bpm} BPM. Limpeza primeiro.`);
      if (event && metronome.running) metronome.setBpm(bpm);
    } else if ('metro' in btn.dataset) {
      if (metronome.running) metronome.stop();
      else { tabPlayer.stop(); metronome.setBpm(store.getSpeed(id, cfg).bpm); metronome.start(); }
    }
    pageRedrawers.forEach((fn) => fn()); // inclui os botões "Ouvir", que mostram o BPM atual
  });

  pageRedrawers.push(update);
  update();
  return box;
}

// ---- Cronômetro do exercício ------------------------------------------------------------

function timerBox(key, minutes, canRun) {
  const box = el('div', 'timer-box');
  box.innerHTML =
    '<div class="label-row"><span>TEMPO DO EXERCÍCIO</span><span></span></div>' +
    '<div class="timer-readout"><div class="lcd"><div class="num"></div><div class="unit">MIN</div></div></div>' +
    '<div class="timer-bar"><div class="fill"></div></div>' +
    '<div class="timer-row">' +
      '<button class="timer-btn" data-toggle></button>' +
      '<button class="timer-btn ghost" data-reset>↺ Zerar</button>' +
    '</div>';

  const update = () => {
    const target = minutes * 60;
    const elapsed = practiceTimer.getElapsed(key);
    const remaining = target - elapsed;
    const over = remaining < 0;
    const running = practiceTimer.isRunning(key);

    box.querySelector('.num').textContent = (over ? '+' : '') + formatClock(remaining);
    box.querySelector('.num').classList.toggle('over', over);
    box.querySelector('.label-row span:last-child').textContent = over ? 'tempo esgotado' : 'restantes';
    box.querySelector('.fill').style.width = `${Math.min(100, (elapsed / target) * 100)}%`;
    box.querySelector('.fill').classList.toggle('over', over);

    const toggleBtn = box.querySelector('[data-toggle]');
    toggleBtn.textContent = running ? '⏸ Pausar' : elapsed > 0 ? '▶ Continuar' : '▶ Iniciar';
    toggleBtn.classList.toggle('on', running);
    toggleBtn.disabled = !canRun;
    box.querySelector('[data-reset]').disabled = elapsed === 0;
  };

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if ('toggle' in btn.dataset) practiceTimer.toggle(key);
    else if ('reset' in btn.dataset) practiceTimer.reset(key);
  });

  pageRedrawers.push(update);
  update();
  return box;
}

// ---- Ouvir a tablatura ----------------------------------------------------------------

// "Ouvir" toca na sua velocidade atual; "Meta" toca na velocidade que você quer alcançar.
function listenButtons(id, ex, tab) {
  const wrap = el('div', 'listen-row');
  const kinds = ex.bpm ? ['now', 'goal'] : ['now'];
  const bpmFor = (kind) => (kind === 'goal' ? ex.bpm.goal : ex.bpm ? store.getSpeed(id, ex.bpm).bpm : 80);

  const buttons = kinds.map((kind) => {
    const button = el('button', 'listen-btn');
    button.dataset.kind = kind;
    wrap.appendChild(button);
    return button;
  });

  const update = () => {
    buttons.forEach((button) => {
      const kind = button.dataset.kind;
      const bpm = bpmFor(kind);
      const on = tabPlayer.isPlaying(tab, bpm);
      button.classList.toggle('on', on);
      button.textContent = on ? (tabPlayer.isLoading(tab, bpm) ? '… carregando' : '■ Parar')
        : `▶ ${kind === 'goal' ? 'Meta' : 'Ouvir'}${ex.bpm ? ` · ${bpm}` : ''}`;
    });
  };

  wrap.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const bpm = bpmFor(button.dataset.kind);
    if (tabPlayer.isPlaying(tab, bpm)) { tabPlayer.stop(); return; }
    metronome.stop();
    tabPlayer.play(tab, bpm);
  });

  pageRedrawers.push(update);
  update();
  return wrap;
}

// ---- Exercício (cartão) ---------------------------------------------------------

function exerciseBody(id, ex, item, tkey, canRun) {
  const body = el('div', 'block-body open');

  body.appendChild(timerBox(tkey, item.min, canRun));

  if (ex.steps && ex.steps.length) {
    body.appendChild(el('ol', 'steps', ex.steps.map((s) => `<li>${s}</li>`).join('')));
  }

  if (ex.tabs && ex.tabs.length) {
    ex.tabs.forEach((tab) => {
      const head = el('div', 'tab-head');
      head.appendChild(el('div', 'tab-label', tab.label));
      if (tab.play) head.appendChild(listenButtons(id, ex, tab));
      body.appendChild(head);
      const readout = el('div', 'tab-readout');
      const pre = el('pre');
      pre.textContent = tab.text;
      readout.appendChild(pre);
      body.appendChild(readout);
    });
    body.appendChild(el('p', 'legend', '<code>v</code> palhetada para baixo · <code>^</code> para cima · linhas de cima = cordas mais finas (e = mais fina)'));
  }

  if (ex.chords && ex.chords.length) {
    body.appendChild(el('div', 'tab-label', 'ACORDES — toque para ver o diagrama'));
    const row = el('div', 'chip-row');
    ex.chords.forEach((chordId) => {
      const chip = el('button', 'chip', CHORDS[chordId].name);
      chip.addEventListener('click', () => openSheet(chordView(chordId)));
      row.appendChild(chip);
    });
    body.appendChild(row);
  }

  if (ex.bpm) body.appendChild(speedBox(id, ex));

  (ex.links || []).forEach((link) => {
    const a = el('a', 'link-row', `${link.label} <span>↗</span>`);
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    body.appendChild(a);
  });

  (ex.tips || []).forEach((tip) => body.appendChild(el('p', 'tip', tip)));
  return body;
}

function exerciseCard(day, item, index, plan, log, canCheck, dateStr) {
  const ex = EXERCISES[item.ex];
  const done = Boolean(log.done[item.ex]);
  const open = Boolean(openIds[item.ex]);

  const card = el('div', 'block');
  const head = el('div', 'block-head');

  const sw = el('button', `switch${done ? ' on' : ''}${canCheck ? '' : ' disabled'}`, '<span class="knob"></span>');
  sw.setAttribute('aria-label', done ? 'Marcar como não feito' : 'Marcar como feito');
  sw.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!canCheck) { toast('Este dia ainda não chegou.'); return; }
    store.toggleDone(dateStr, day.key, item.ex);
    render();
  });

  const meta = el('div', 'meta', `<div class="title${done ? ' done' : ''}"></div><div class="duration"></div>`);
  meta.querySelector('.title').textContent = ex.title;

  const tkey = timerKey(dateStr, day.key, item.ex);
  const updateDuration = () => {
    const durationEl = meta.querySelector('.duration');
    const base = `${item.min} min · ${CATEGORIES[ex.cat]}`;
    const elapsed = practiceTimer.getElapsed(tkey);
    if (elapsed > 0) {
      const remaining = item.min * 60 - elapsed;
      const over = remaining < 0;
      const running = practiceTimer.isRunning(tkey);
      durationEl.innerHTML = `${base} · <span class="timer-chip${over ? ' over' : ''}${running ? ' running' : ''}">${over ? '+' : ''}${formatClock(remaining)}</span>`;
    } else {
      durationEl.textContent = base;
    }
  };
  pageRedrawers.push(updateDuration);
  updateDuration();

  const chev = el('div', `chevron${open ? ' open' : ''}`, '▸');
  head.append(sw, meta, chev);
  head.addEventListener('click', () => { openIds[item.ex] = !openIds[item.ex]; render(); });
  card.appendChild(head);

  if (editing) {
    const row = el('div', 'edit-row',
      '<button data-act="minus" aria-label="Menos 5 minutos">−5</button>' +
      `<span class="mins">${item.min} min</span>` +
      '<button data-act="plus" aria-label="Mais 5 minutos">+5</button>' +
      `<button data-act="up" aria-label="Subir"${index === 0 ? ' disabled' : ''}>↑</button>` +
      `<button data-act="down" aria-label="Descer"${index === plan.length - 1 ? ' disabled' : ''}>↓</button>` +
      '<button data-act="swap">Trocar</button>' +
      '<button data-act="remove" class="danger">Remover</button>');
    row.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'minus') updatePlan(day, (items) => { items[index].min = Math.max(5, items[index].min - 5); });
      if (act === 'plus') updatePlan(day, (items) => { items[index].min = Math.min(90, items[index].min + 5); });
      if (act === 'up') updatePlan(day, (items) => items.splice(index - 1, 0, items.splice(index, 1)[0]));
      if (act === 'down') updatePlan(day, (items) => items.splice(index + 1, 0, items.splice(index, 1)[0]));
      if (act === 'remove') updatePlan(day, (items) => items.splice(index, 1));
      if (act === 'swap') openSheet(bankView(day, 'swap', index));
    });
    card.appendChild(row);
  }

  if (open) card.appendChild(exerciseBody(item.ex, ex, item, tkey, canCheck));
  return card;
}

// ---- Banco de exercícios ---------------------------------------------------------

function bankView(day, mode, index) {
  const plan = currentPlan(day);
  const inPlan = new Set(plan.map((i) => i.ex));
  const current = mode === 'swap' ? plan[index].ex : null;
  let filter = 'todos';

  const root = el('div');
  root.innerHTML =
    `<h2>${mode === 'swap' ? 'Trocar exercício' : 'Adicionar exercício'}</h2>` +
    '<div class="sub">Banco de exercícios. Toque em um para escolher.</div>' +
    '<div class="chip-row cat-row"></div><div class="bank-list"></div>';
  const catRow = root.querySelector('.cat-row');
  const list = root.querySelector('.bank-list');

  const drawList = () => {
    catRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === filter));
    list.innerHTML = '';
    Object.entries(EXERCISES)
      .filter(([, ex]) => filter === 'todos' || ex.cat === filter)
      .forEach(([id, ex]) => {
        const disabled = inPlan.has(id);
        const item = el('button', `bank-item${disabled ? ' disabled' : ''}`);
        item.disabled = disabled;
        item.innerHTML =
          '<div class="bi-title"></div>' +
          `<div class="bi-meta">${CATEGORIES[ex.cat]} · ${ex.min} min${ex.bpm ? ' · metrônomo' : ''}${ex.draft ? ' · resumo' : ''}</div>` +
          `<div class="bi-sub"></div>${disabled ? `<div class="bi-flag">${id === current ? 'atual' : 'já no plano'}</div>` : ''}`;
        item.querySelector('.bi-title').textContent = ex.title;
        item.querySelector('.bi-sub').textContent = ex.subtitle || '';
        item.addEventListener('click', () => {
          closeSheet();
          openIds[id] = true;
          updatePlan(day, (items) => {
            if (mode === 'swap') items[index] = { ex: id, min: ex.min };
            else items.push({ ex: id, min: ex.min });
          });
        });
        list.appendChild(item);
      });
  };

  [['todos', 'Todos'], ...Object.entries(CATEGORIES)].forEach(([key, label]) => {
    const chip = el('button', 'chip', label);
    chip.dataset.cat = key;
    chip.addEventListener('click', () => { filter = key; drawList(); });
    catRow.appendChild(chip);
  });
  drawList();
  return root;
}

// ---- Telas principais --------------------------------------------------------------

function renderStreak() {
  const streak = computeStreak();
  $('#streakNum').textContent = streak;
  $('#streakDot').className = 'streak-dot' + (streak > 0 ? '' : ' off');
}

function renderTabs() {
  const nav = $('#dayTabs');
  nav.innerHTML = '';
  WEEK.forEach((day) => {
    const date = isoDate(dateFor(day.weekday));
    const log = store.peekLog(date, day.key);
    const plan = currentPlan(day);
    const allDone = plan.length > 0 && log && plan.every((item) => log.done[item.ex]);
    const classes = ['day-tab'];
    if (day.key === activeKey) classes.push('active');
    if (day.weekday === today.getDay()) classes.push('today');
    const tab = el('button', classes.join(' '), `${day.label}<span class="dot${allDone ? ' done' : ''}"></span>`);
    tab.addEventListener('click', () => { activeKey = day.key; openIds = {}; editing = false; render(); });
    nav.appendChild(tab);
  });
}

function renderDay() {
  const day = WEEK.find((d) => d.key === activeKey);
  const dateObj = dateFor(day.weekday);
  const dateStr = isoDate(dateObj);
  const canCheck = dateStr <= todayISO;
  const plan = currentPlan(day);
  const log = store.getLog(dateStr, day.key);
  const total = plan.reduce((sum, item) => sum + item.min, 0);
  const drafts = plan.filter((item) => EXERCISES[item.ex].draft).length;
  const custom = store.isCustomPlan(day.key);

  const container = $('#dayContent');
  container.innerHTML = '';

  const header = el('div', 'day-header');
  header.innerHTML =
    `<div class="kicker">${dateStr === todayISO ? 'HOJE · ' : ''}${day.name.toUpperCase()} · ${shortDate(dateObj)}</div>` +
    `<h1>${day.title}</h1><p>${day.focus}</p>` +
    '<div class="tag-row">' +
      `<span class="tag ${total === 60 ? 'ok' : ''}">${total} min</span>` +
      `<span class="tag ${drafts ? '' : 'ok'}">${drafts ? `${drafts} em resumo` : 'detalhado'}</span>` +
      (custom ? '<span class="tag ok">personalizado</span>' : '') +
    '</div>';
  container.appendChild(header);

  const vu = el('div', 'vu-meter');
  plan.forEach((item) => vu.appendChild(el('div', `vu-seg${log.done[item.ex] ? ' on' : ''}`)));
  container.appendChild(vu);

  if (!plan.length) {
    container.appendChild(el('p', 'empty', 'Dia vazio. Toque em “Editar dia” para adicionar exercícios do banco.'));
  }
  plan.forEach((item, i) => container.appendChild(exerciseCard(day, item, i, plan, log, canCheck, dateStr)));

  const actions = el('div', 'day-actions');
  const editBtn = el('button', `action${editing ? ' on' : ''}`, editing ? '✓ Concluir edição' : '✎ Editar dia');
  editBtn.addEventListener('click', () => { editing = !editing; render(); });
  actions.appendChild(editBtn);
  if (editing) {
    const add = el('button', 'action', '+ Adicionar exercício');
    add.addEventListener('click', () => openSheet(bankView(day, 'add')));
    actions.appendChild(add);
    if (custom) {
      const reset = el('button', 'action', 'Restaurar plano padrão');
      reset.addEventListener('click', () => {
        if (window.confirm(`Voltar ${day.name} ao plano padrão? Suas mudanças neste dia serão perdidas.`)) {
          store.resetPlan(day.key);
          render();
        }
      });
      actions.appendChild(reset);
    }
  }
  container.appendChild(actions);

  const notes = el('div', 'notes-block', '<span class="notes-label">NOTAS DE HOJE</span>');
  const textarea = el('textarea', 'notes');
  textarea.placeholder = 'Como foi o treino? O que travou, o que fluiu...';
  textarea.value = log.notes || '';
  textarea.addEventListener('input', () => store.setNotes(dateStr, day.key, textarea.value));
  notes.appendChild(textarea);
  container.appendChild(notes);
}

function updateMetroPill() {
  $('#metroBpm').textContent = metronome.bpm;
  $('#metroBtn').setAttribute('aria-label', `Abrir metrônomo, ${metronome.bpm} BPM`);
  $('#metroBtn').classList.toggle('running', metronome.running);
}

function updateSyncPill() {
  const s = sync.getState();
  $('#syncLabel').textContent = SYNC_LABELS[s.status];
  const pill = $('#syncBtn');
  pill.classList.toggle('ok', s.status === 'ok' || s.status === 'idle');
  pill.classList.toggle('busy', s.status === 'syncing');
  pill.classList.toggle('bad', s.status === 'error');
  $('#footerHint').textContent = s.email
    ? 'Treino sincronizado com a sua conta.'
    : 'Os dados ficam salvos só neste aparelho. Entre na conta para sincronizar.';
}

function render() {
  pageRedrawers = [];
  renderTabs();
  renderStreak();
  renderDay();
  updateMetroPill();
}

// ---- Início --------------------------------------------------------------------------

metronome.bpm = store.getPref('metroBpm', 90);
metronome.beats = store.getPref('metroBeats', 4);
metronome.subdivide = store.getPref('metroSub', false);

tabPlayer.onChange(() => pageRedrawers.forEach((fn) => fn()));
practiceTimer.onChange(() => pageRedrawers.forEach((fn) => fn()));
metronome.on('change', () => {
  if (metronome.running) tabPlayer.stop(); // não tocam juntos
  updateMetroPill();
  pageRedrawers.forEach((fn) => fn());
  sheetRedrawers.forEach((fn) => fn());
});
metronome.on('beat', ({ accent }) => {
  document.querySelectorAll('.beat-led').forEach((led) => {
    led.classList.toggle('accent', accent);
    led.classList.add('on');
    setTimeout(() => led.classList.remove('on'), 90);
  });
});

sync.onState(() => {
  updateSyncPill();
  sheetRedrawers.forEach((fn) => fn());
});
// Outro aparelho trouxe novidades: redesenha, sem atrapalhar quem está digitando uma nota.
store.onRemoteChange(() => {
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
  render();
});

$('#metroBtn').addEventListener('click', () => openSheet(metronomeView()));
$('#syncBtn').addEventListener('click', () => openSheet(accountView()));
render();
updateSyncPill();
sync.init();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* app funciona sem offline */ });
}
