import { WEEK } from './data/plans.js';
import { EXERCISES, CATEGORIES } from './data/exercises.js';
import { CHORDS, chordCol } from './data/chords.js';
import { chordSVG } from './chord-diagram.js';
import { buildTab } from './tab.js';
import { metronome } from './metronome.js';
import { tabPlayer } from './tab-player.js';
import { practiceTimer } from './practice-timer.js';
import { voiceCommand, voiceSupported } from './voice-command.js';
import { NOTE_NAMES, OPEN_PC, SCALES, hasPositions, positionsOf, modePositions, fretboardNotes, fretboardIntervals } from './theory.js';
import { fretboardSVG, sequenceSVG } from './fretboard.js';
import { CAGED_SHAPES, CHORD_TYPES, voicingFrets } from './chord-shapes.js';
import { store } from './store.js';
import { sync } from './sync.js';
import { teacher } from './teacher.js';

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

const BRACO_TABS = { scales: 'Escalas', chords: 'Acordes', intervals: 'Intervalos' };

function openScales() { renderBraco(); scalesOverlay.classList.add('open'); }
function closeScales() { scalesOverlay.classList.remove('open'); }

function renderBraco() {
  const tab = store.getPref('fbTab', 'scales');
  $('#scalesTitle').textContent = BRACO_TABS[tab];

  const wrap = el('div');
  wrap.innerHTML = '<div class="chip-row fb-tab-row"></div><div class="fb-tab-body"></div>';
  const tabRow = wrap.querySelector('.fb-tab-row');
  Object.entries(BRACO_TABS).forEach(([key, label]) => {
    const chip = el('button', `chip${key === tab ? ' on' : ''}`, label);
    chip.addEventListener('click', () => { store.setPref('fbTab', key); renderBraco(); });
    tabRow.appendChild(chip);
  });
  const view = tab === 'chords' ? chordExplorerView() : tab === 'intervals' ? intervalExplorerView() : scaleExplorerView();
  wrap.querySelector('.fb-tab-body').appendChild(view);
  scalesBody.replaceChildren(wrap);
}

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
    // Maior tem posições de outro jeito: 7 modos, 3 notas por corda (modePositions), não a janela
    // comum de positionsOf (que só rende bem em escalas de até 5 notas — ver hasPositions).
    const isModes = sk === 'modes';
    const withPositions = hasPositions(sk) || isModes;
    const pos = isModes ? modePositions(rp) : (withPositions ? positionsOf(rp, sk) : []);
    let m = withPositions ? store.getPref('scaleMode', 0) : 0;
    if (m > pos.length) { m = 0; store.setPref('scaleMode', 0); }

    root.querySelectorAll('.root-row .chip').forEach((c, pc) => c.classList.toggle('on', pc === rp));
    root.querySelectorAll('.scale-row .chip').forEach((c) => c.classList.toggle('on', c.textContent === scale.label));

    if (isModes && m > 0) {
      const p = pos[m - 1];
      root.querySelector('.scale-name').textContent = `${NOTE_NAMES[p.rootPc]} ${p.name}`;
      root.querySelector('.scale-degrees').textContent = `${NOTE_NAMES[p.rootPc]}${p.chordSuffix}`;
    } else if (isModes) {
      root.querySelector('.scale-name').textContent = `Campo harmônico de ${NOTE_NAMES[rp]} maior`;
      root.querySelector('.scale-degrees').textContent = pos.map((p) => `${NOTE_NAMES[p.rootPc]}${p.chordSuffix}`).join('  ·  ');
    } else {
      root.querySelector('.scale-name').textContent = `${NOTE_NAMES[rp]} ${scale.label}`;
      root.querySelector('.scale-degrees').textContent = scale.degrees.join('  ');
    }

    const posRow = root.querySelector('.pos-row');
    posRow.innerHTML = '';
    if (withPositions) {
      const all = el('button', `chip${m === 0 ? ' on' : ''}`, 'Todas');
      all.addEventListener('click', () => { store.setPref('scaleMode', 0); draw(); });
      posRow.appendChild(all);
      pos.forEach((p) => {
        const label = isModes ? `${p.index} ${p.name}` : String(p.index);
        const chip = el('button', `chip${m === p.index ? ' on' : ''}`, label);
        chip.addEventListener('click', () => { store.setPref('scaleMode', p.index); draw(); });
        posRow.appendChild(chip);
      });
    }

    if (isModes && m > 0) {
      // Posição de modo: sequencial (ordem de execução, corda por corda), não a geometria real do
      // braço — ver sequenceSVG em fretboard.js.
      root.querySelector('.fret-inner').innerHTML = sequenceSVG(pos[m - 1].dots);
    } else {
      const fretStart = m === 0 ? 0 : Math.max(0, pos[m - 1].start - 1);
      const fretEnd = m === 0 ? 12 : pos[m - 1].end + 1;
      const notes = fretboardNotes(rp, sk, fretStart, fretEnd);
      root.querySelector('.fret-inner').innerHTML = fretboardSVG({ fretStart, fretEnd, dots: notes });
    }

    root.querySelector('.tip').textContent = withPositions
      ? (m === 0
        ? (isModes
          ? 'Toque num modo (1 a 7) para ver a caixa dele — são os 7 acordes do campo harmônico. A tônica de cada modo aparece com o anel dourado.'
          : 'Toque numa posição (1 a 5) para ver só aquela caixa. A raiz aparece com o anel dourado.')
        : (isModes
          ? `${pos[m - 1].index}º grau (${pos[m - 1].name}): casas ${pos[m - 1].start} a ${pos[m - 1].end}, 3 notas por corda.`
          : `Posição ${m} de ${pos.length}: casas ${pos[m - 1].start} a ${pos[m - 1].end}. A última casa desta posição é a primeira da próxima — é por onde elas se conectam no braço.`))
      : 'Escala de 7 notas: aqui só o braço inteiro, sem posições (as janelas entre graus ficam curtas demais para virar uma caixa de mão).';
  }

  draw();
  return root;
}

// Mostra o intervalo de cada casa do braço em relação à raiz escolhida — as 12 posições
// cromáticas, sem filtrar por escala (é o "quadro móvel de intervalos", só que na tela).
function intervalExplorerView() {
  const rootPc = store.getPref('intervalRoot', 9); // A

  const root = el('div');
  root.innerHTML =
    '<div class="chip-row root-row"></div>' +
    '<div class="scale-info"><span class="scale-name"></span></div>' +
    '<div class="fret-scroll"><div class="fret-inner"></div></div>' +
    '<p class="tip">Escolha uma nota, toque nela e depois numa casa vizinha: o rótulo mostra exatamente o intervalo entre as duas. Comece pela própria casa da tônica e pelas vizinhas, na corda ao lado — é o mesmo exercício do quadro de intervalos, só que aqui o braço inteiro já vem calculado.</p>';

  const rootRow = root.querySelector('.root-row');
  NOTE_NAMES.forEach((name, pc) => {
    const chip = el('button', `chip${pc === rootPc ? ' on' : ''}`, name);
    chip.addEventListener('click', () => { store.setPref('intervalRoot', pc); draw(); });
    rootRow.appendChild(chip);
  });

  function draw() {
    const rp = store.getPref('intervalRoot', 9);
    root.querySelectorAll('.root-row .chip').forEach((c, pc) => c.classList.toggle('on', pc === rp));
    root.querySelector('.scale-name').textContent = `Intervalos a partir de ${NOTE_NAMES[rp]}`;
    // Casas 1–12, sem a corda solta (casa 0): é um "quadro móvel" — a ideia é pensar em padrão que
    // desliza pelo braço, e a casa 0 é uma âncora fixa que não ajuda nisso. Na tônica mostramos "T"
    // (com cor própria, verde, a mesma de "ativo/concluído" no resto do app) em vez de "1", pra ela
    // se destacar dos outros intervalos de longe, não só pela cor quase igual do dourado.
    const notes = fretboardIntervals(rp, 1, 12).map((n) => (n.root ? { ...n, name: 'T' } : n));
    root.querySelector('.fret-inner').innerHTML = fretboardSVG({ fretStart: 1, fretEnd: 12, dots: notes });
  }

  draw();
  return root;
}

const SHAPE_KEYS = Object.keys(CAGED_SHAPES); // E, A, D, C, G

function chordExplorerView() {
  const rootPc = store.getPref('chordRoot', 9); // A
  const typeKey = store.getPref('chordType', 'major');

  const root = el('div');
  root.innerHTML =
    '<div class="chip-row root-row"></div>' +
    '<div class="chip-row scale-row"></div>' +
    '<div class="scale-info"><span class="scale-name"></span></div>' +
    '<div class="chip-row pos-row"></div>' +
    '<div class="fret-scroll"><div class="fret-inner"></div></div>' +
    '<p class="tip"></p>';

  const rootRow = root.querySelector('.root-row');
  NOTE_NAMES.forEach((name, pc) => {
    const chip = el('button', `chip${pc === rootPc ? ' on' : ''}`, name);
    chip.addEventListener('click', () => { store.setPref('chordRoot', pc); store.setPref('chordShape', 'E'); draw(); });
    rootRow.appendChild(chip);
  });

  const typeRow = root.querySelector('.scale-row');
  Object.entries(CHORD_TYPES).forEach(([key, type]) => {
    const chip = el('button', `chip${key === typeKey ? ' on' : ''}`, type.label);
    chip.addEventListener('click', () => { store.setPref('chordType', key); draw(); });
    typeRow.appendChild(chip);
  });

  function draw() {
    const rp = store.getPref('chordRoot', 9);
    const tk = store.getPref('chordType', 'major');
    const type = CHORD_TYPES[tk];
    const shapeKey = SHAPE_KEYS.includes(store.getPref('chordShape', 'E')) ? store.getPref('chordShape', 'E') : 'E';

    root.querySelectorAll('.root-row .chip').forEach((c, pc) => c.classList.toggle('on', pc === rp));
    root.querySelectorAll('.scale-row .chip').forEach((c) => c.classList.toggle('on', c.textContent === type.label));
    root.querySelector('.scale-name').textContent = `${NOTE_NAMES[rp]}${type.suffix}`;

    const posRow = root.querySelector('.pos-row');
    posRow.innerHTML = '';
    SHAPE_KEYS.forEach((key) => {
      const chip = el('button', `chip${key === shapeKey ? ' on' : ''}`, `Forma ${key}`);
      chip.addEventListener('click', () => { store.setPref('chordShape', key); draw(); });
      posRow.appendChild(chip);
    });

    const frets = voicingFrets(shapeKey, tk, rp);
    const usedFrets = Object.values(frets);
    const lowest = Math.min(...usedFrets);
    const fretStart = Math.max(0, lowest - (lowest === 0 ? 0 : 1));
    const fretEnd = Math.max(...usedFrets) + 1;
    const dots = Object.entries(frets).map(([string, fret]) => {
      const pc = (OPEN_PC[Number(string)] + fret) % 12;
      return { string: Number(string), fret, name: NOTE_NAMES[pc], root: pc === rp };
    });
    const muted = [0, 1, 2, 3, 4, 5].filter((s) => !(s in frets));
    root.querySelector('.fret-inner').innerHTML = fretboardSVG({ fretStart, fretEnd, dots, muted });

    root.querySelector('.tip').textContent =
      `Forma ${shapeKey}: o desenho do acorde aberto de ${shapeKey} maior, deslizado até a casa certa. ` +
      'Toque nas outras formas para ver outros jeitos de tocar o mesmo acorde, subindo pelo braço.';
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
  const wrap = el('div');
  const syncPart = el('div');
  wrap.appendChild(syncPart);
  let lastKey = '';
  let teacherMounted = false;

  const draw = () => {
    const s = sync.getState();
    const key = [s.status, s.email, s.error, s.lastSync].join('|');
    if (key === lastKey) return;
    lastKey = key;
    const root = syncPart;

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

    // Monta a área de professor/aluno uma única vez, assim que há sessão — não depende do
    // status de sincronização (syncing/ok/erro), então não refaz a cada redesenho.
    if (s.email && !teacherMounted) {
      teacherMounted = true;
      wrap.appendChild(teacherSectionView());
    }
  };

  sheetRedrawers.push(draw);
  draw();
  return wrap;
}

// ---- Professor e aluno --------------------------------------------------------------

// Vínculo com professor (lado aluno) + área do professor (código + alunos), dentro da folha de
// conta. Carrega uma vez ao abrir (não fica repetindo a cada redesenho do resto da folha).
function teacherSectionView() {
  const root = el('div', 'teacher-section');
  root.innerHTML = '<p class="sub">Carregando professor/alunos…</p>';
  let students = [];
  let myTeacherRow = null;
  let codeRevealed = null; // null = ainda não pedido; string = já veio

  function linkBlock() {
    const box = el('div');
    if (myTeacherRow) {
      box.innerHTML =
        `<p class="sub">Vinculado ao professor <strong>${myTeacherRow.teacher_email}</strong></p>` +
        '<div class="day-actions"><button class="action" data-unlink>Desvincular</button></div>';
      box.querySelector('[data-unlink]').addEventListener('click', async () => {
        if (!window.confirm(`Desvincular do professor ${myTeacherRow.teacher_email}?`)) return;
        await teacher.unlink(sync.getUserId());
        myTeacherRow = null;
        redraw();
      });
    } else {
      box.innerHTML =
        '<p class="sub">Tem um professor acompanhando seu treino? Digite o código dele:</p>' +
        '<form class="account-form link-form">' +
          '<label>Código do professor<input type="text" name="code" maxlength="6" autocapitalize="characters" required></label>' +
          '<button class="action primary" type="submit">Vincular</button>' +
          '<p class="form-error" role="alert"></p>' +
        '</form>';
      const form = box.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = form.querySelector('button');
        const message = form.querySelector('.form-error');
        submit.disabled = true;
        message.textContent = '';
        try {
          const { teacherEmail } = await teacher.linkToTeacher(form.code.value);
          myTeacherRow = { teacher_email: teacherEmail };
          toast(`Vinculado a ${teacherEmail}.`);
          redraw();
        } catch (error) {
          message.textContent = error.message || String(error);
          submit.disabled = false;
        }
      });
    }
    return box;
  }

  function teacherBlock() {
    const box = el('div');
    if (codeRevealed === null) {
      box.innerHTML = '<button class="teacher-toggle">▸ Sou professor de alguém</button>';
      box.querySelector('button').addEventListener('click', async () => {
        box.innerHTML = '<p class="sub">Gerando código…</p>';
        try {
          codeRevealed = await teacher.myCode();
        } catch (error) {
          box.innerHTML = `<p class="tip">${error.message || error}</p>`;
          return;
        }
        redraw();
      });
      return box;
    }
    box.innerHTML =
      '<p class="sub">Passe este código para o aluno digitar (em Conta → Vincular a um professor):</p>' +
      `<div class="code-lcd"><span class="num">${codeRevealed}</span></div>` +
      '<div class="sub">Meus alunos</div>';
    const list = el('div', 'bank-list');
    if (!students.length) list.appendChild(el('p', 'empty', 'Nenhum aluno vinculado ainda.'));
    students.forEach((s) => list.appendChild(studentRow(s, () => {
      students = students.filter((x) => x.student_id !== s.student_id);
      redraw();
      refreshTeacherPill();
    })));
    box.appendChild(list);
    return box;
  }

  function redraw() {
    root.innerHTML = '';
    root.appendChild(el('h2', null, 'Professor e alunos'));
    root.appendChild(linkBlock());
    root.appendChild(teacherBlock());
  }

  Promise.all([teacher.myTeacher(), teacher.listStudents()])
    .then(([mine, list]) => { myTeacherRow = mine; students = list; redraw(); refreshTeacherPill(); })
    .catch((error) => { root.innerHTML = `<p class="tip">Não consegui carregar: ${error.message || error}</p>`; });

  return root;
}

// Uma linha "aluno" reaproveitada pela tela de conta (teacherSectionView) e pelo atalho rápido
// (myStudentsView, pelo botão "🎓 Alunos" do cabeçalho). onUnlink já cuida de tirar da lista
// local depois de desvincular no banco.
function studentRow(student, onUnlink) {
  const row = el('div', 'bank-item');
  row.innerHTML =
    `<div class="bi-title">${student.student_email}</div>` +
    '<div class="bi-sub">Toque em Planejar para montar a semana dele.</div>' +
    '<div class="day-actions" style="margin-top:8px"><button class="action" data-plan>Planejar</button>' +
    '<button class="action" data-unlink>Desvincular</button></div>';
  row.querySelector('[data-plan]').addEventListener('click', () => openSheet(studentPlanView(student)));
  row.querySelector('[data-unlink]').addEventListener('click', async () => {
    if (!window.confirm(`Desvincular o aluno ${student.student_email}?`)) return;
    await teacher.unlink(student.student_id);
    onUnlink();
  });
  return row;
}

// Atalho direto pro professor: botão "🎓 Alunos" no cabeçalho, só visível se já tiver pelo menos
// 1 aluno vinculado (ver refreshTeacherPill) — evita o caminho Conta → Sou professor → lista.
function myStudentsView() {
  const root = el('div');
  root.innerHTML = '<h2>Meus alunos</h2><p class="sub">Carregando…</p>';
  let students = [];

  function redraw() {
    root.innerHTML = '<h2>Meus alunos</h2>';
    const list = el('div', 'bank-list');
    if (!students.length) list.appendChild(el('p', 'empty', 'Nenhum aluno vinculado no momento.'));
    students.forEach((s) => list.appendChild(studentRow(s, () => {
      students = students.filter((x) => x.student_id !== s.student_id);
      redraw();
      refreshTeacherPill();
    })));
    root.appendChild(list);
  }

  teacher.listStudents().then((list) => { students = list; redraw(); })
    .catch((error) => { root.innerHTML = `<h2>Meus alunos</h2><p class="tip">Não consegui carregar: ${error.message || error}</p>`; });

  return root;
}

// Mostra/esconde o botão "🎓 Alunos" do cabeçalho: só habilita pra quem já é professor de
// alguém (pelo menos 1 aluno vinculado). Silencioso em erro — o botão some, sem toast/alerta.
function refreshTeacherPill() {
  const btn = $('#teacherBtn');
  if (!teacher.available()) { btn.hidden = true; return; }
  teacher.listStudents()
    .then((list) => { btn.hidden = list.length === 0; })
    .catch(() => { btn.hidden = true; });
}

// Tela do professor pra planejar a semana de um aluno específico: progresso resumido (BPM e
// dias concluídos) + edição do plano de um dia, salvando direto no banco do aluno.
function studentPlanView(student) {
  const root = el('div');
  root.innerHTML = `<h2>${student.student_email}</h2><div class="sub">Carregando dados do aluno…</div>`;

  let studentData = null;
  let dayKey = (WEEK.find((d) => d.weekday === today.getDay()) || WEEK[0]).key;
  let items = [];

  // Dias concluídos (do quanto tinha no plano daquele dia) + observações do aluno, num período
  // escolhido pelo professor (padrão: semana atual). Cada dia expande ao tocar, mostrando
  // exercício a exercício: concluído ou não, e em qual BPM.
  function historyBlock() {
    const box = el('div');
    let fromStr = isoDate(dateFor(1)); // segunda desta semana
    let toStr = isoDate(dateFor(0)); // domingo desta semana
    const openDates = new Set();

    const dayOf = (dateObj) => WEEK.find((d) => d.weekday === dateObj.getDay()) || WEEK[0];

    // Com foto do plano daquele dia (hasSnapshot): sabemos com certeza o que foi oferecido, então
    // "não concluído" pode ser afirmado mesmo sem toque nenhum (done começa false mesmo). Sem
    // foto (log antigo, de antes dessa mudança): só dá pra confiar no que tem carimbo (log.t) —
    // pra quem não foi tocado, não afirma "não concluído" (seria chute), diz que não há registro.
    // Nos dois casos, exercícios tocados/concluídos que não estão em planItems também aparecem
    // (fora do plano — pode ter sido removido do plano depois de ter sido feito).
    function exerciseDetail(planItems, log, dateStr, hasSnapshot) {
      const detail = el('div', 'history-detail');
      const planIds = planItems.map((item) => item.ex);
      const loggedIds = new Set([...Object.keys((log && log.done) || {}), ...Object.keys((log && log.t) || {})]);
      planIds.forEach((id) => loggedIds.delete(id)); // já entram pela ordem do plano
      const ids = [...planIds, ...loggedIds].filter((id) => EXERCISES[id]);

      if (!ids.length) { detail.appendChild(el('p', 'tip', 'Nenhum exercício planejado nem registrado nesse dia.')); return detail; }
      ids.forEach((id) => {
        const ex = EXERCISES[id];
        const touched = Boolean(log && log.t && log.t[id] != null);
        const done = Boolean(log && log.done && log.done[id]);
        const known = touched || (hasSnapshot && planIds.includes(id)); // sabemos o status de verdade
        const speed = studentData.speeds && studentData.speeds[id];
        const bpm = speed ? speed.bpm : (ex.bpm ? ex.bpm.start : null);
        const inPlan = planIds.includes(id);

        let status;
        if (known) status = done ? 'Concluído' : 'Não concluído';
        else if (dateStr === todayISO) status = 'Ainda não feito hoje';
        else status = 'Sem registro nesse dia — talvez não estivesse no plano ainda';
        const mark = known ? (done ? '✓' : '·') : '?';

        const line = el('div', 'bank-item');
        line.innerHTML =
          `<div class="bi-title">${mark} ${ex.title}${inPlan ? '' : ' (fora do plano desse dia)'}</div>` +
          `<div class="bi-meta">${status}${(touched || done) && bpm != null ? ' · ' + bpm + ' BPM' : ''}</div>`;
        detail.appendChild(line);
      });
      return detail;
    }

    function drawList() {
      const list = box.querySelector('.history-list');
      list.innerHTML = '';
      const from = new Date(`${fromStr}T00:00:00`);
      const to = new Date(`${toStr}T00:00:00`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        list.appendChild(el('p', 'tip', 'Escolha um período válido (de ≤ até).'));
        return;
      }
      const dates = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
      dates.reverse(); // mais recente primeiro
      dates.forEach((dateObj) => {
        const dateStr = isoDate(dateObj);
        const day = dayOf(dateObj);
        const log = (studentData.logs && studentData.logs[`${dateStr}_${day.key}`]) || null;
        // Se o log tem a foto do plano daquele dia (planSnapshot, ver store.js), usa ela — é o
        // que realmente existia ali. Sem foto (log antigo, de antes dessa mudança, ou dia sem
        // nenhum toque ainda), cai no plano atual como melhor estimativa disponível.
        const hasSnapshot = log && Array.isArray(log.plan);
        const custom = studentData.plans && studentData.plans[day.key];
        const planItems = (hasSnapshot ? log.plan : (custom && Array.isArray(custom.items) ? custom.items : day.plan))
          .filter((item) => EXERCISES[item.ex]);
        const doneCount = log ? planItems.filter((item) => log.done && log.done[item.ex]).length : 0;
        const allDone = planItems.length > 0 && doneCount === planItems.length;
        const isOpen = openDates.has(dateStr);

        const row = el('div', 'bank-item history-day');
        row.innerHTML =
          `<div class="bi-title">${day.label} · ${shortDate(dateObj)}${dateStr === todayISO ? ' (hoje)' : ''}</div>` +
          `<div class="bi-meta">${doneCount}/${planItems.length} concluídos${allDone ? ' · tudo feito ✓' : ''}${hasSnapshot ? '' : ' · plano estimado'}</div>` +
          (log && log.notes ? `<div class="bi-sub">“${log.notes}”</div>` : '') +
          `<div class="bi-flag">${isOpen ? '▾' : '▸'}</div>`;
        row.addEventListener('click', () => {
          if (openDates.has(dateStr)) openDates.delete(dateStr); else openDates.add(dateStr);
          drawList();
        });
        list.appendChild(row);
        if (isOpen) list.appendChild(exerciseDetail(planItems, log, dateStr, hasSnapshot));
      });
    }

    box.innerHTML =
      '<div class="sub">Andamento — escolha o período e toque num dia para ver exercício a exercício</div>' +
      '<div class="date-range account-form">' +
        `<label>De<input type="date" class="from-date" value="${fromStr}"></label>` +
        `<label>Até<input type="date" class="to-date" value="${toStr}"></label>` +
      '</div>' +
      '<div class="history-list"></div>';
    box.querySelector('.from-date').addEventListener('change', (e) => { fromStr = e.target.value; drawList(); });
    box.querySelector('.to-date').addEventListener('change', (e) => { toStr = e.target.value; drawList(); });
    drawList();
    return box;
  }

  function progressBlock() {
    const box = el('div');
    const speeds = (studentData && studentData.speeds) || {};
    const ids = Object.keys(speeds);
    box.innerHTML = '<div class="sub" style="margin-top:16px">Velocidade por exercício</div>';
    if (!ids.length) {
      box.appendChild(el('p', 'tip', 'O aluno ainda não registrou nenhuma velocidade.'));
      return box;
    }
    const list = el('div', 'chip-row');
    ids.forEach((id) => {
      const ex = EXERCISES[id];
      const speed = speeds[id];
      const streak = speed.clean ? ` · ${speed.clean} limpo(s) seguido(s)` : speed.errors ? ` · ${speed.errors} erro(s) seguido(s)` : '';
      list.appendChild(el('span', 'chip', `${ex ? ex.title : id} · ${speed.bpm} BPM${streak}`));
    });
    box.appendChild(list);
    return box;
  }

  function dayTabs() {
    const row = el('div', 'chip-row');
    WEEK.forEach((day) => {
      const chip = el('button', `chip${day.key === dayKey ? ' on' : ''}`, day.label);
      chip.addEventListener('click', () => { dayKey = day.key; loadDay(); });
      row.appendChild(chip);
    });
    return row;
  }

  function loadDay() {
    const day = WEEK.find((d) => d.key === dayKey);
    const custom = studentData.plans && studentData.plans[dayKey];
    items = (custom && Array.isArray(custom.items) ? custom.items : day.plan).map((item) => ({ ...item }));
    drawPlan();
  }

  function planList() {
    const list = el('div');
    if (!items.length) list.appendChild(el('p', 'empty', 'Dia vazio.'));
    items.forEach((item, i) => {
      const ex = EXERCISES[item.ex];
      const row = el('div', 'bank-item');
      row.innerHTML =
        `<div class="bi-title">${ex ? ex.title : item.ex}</div>` +
        `<div class="bi-meta">${ex ? CATEGORIES[ex.cat] : ''}</div>` +
        '<div class="day-actions" style="margin-top:8px">' +
          '<button class="action" data-minus-min>−5 min</button>' +
          `<input class="mins-input" type="number" inputmode="numeric" min="5" max="90" value="${item.min}" aria-label="Minutos">` +
          '<button class="action" data-plus-min>+5 min</button>' +
          `<button class="action" data-up${i === 0 ? ' disabled' : ''}>↑</button>` +
          `<button class="action" data-down${i === items.length - 1 ? ' disabled' : ''}>↓</button>` +
          '<button class="action" data-remove>Remover</button>' +
        '</div>';
      row.querySelector('[data-minus-min]').addEventListener('click', () => {
        item.min = Math.max(5, item.min - 5);
        drawPlan();
      });
      row.querySelector('[data-plus-min]').addEventListener('click', () => {
        item.min = Math.min(90, item.min + 5);
        drawPlan();
      });
      row.querySelector('.mins-input').addEventListener('change', (e) => {
        const raw = e.target.value.trim();
        const typed = Math.round(Number(raw));
        item.min = raw !== '' && Number.isFinite(typed) ? Math.min(90, Math.max(5, typed)) : item.min;
        drawPlan();
      });
      row.querySelector('[data-up]').addEventListener('click', () => {
        if (i === 0) return;
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
        drawPlan();
      });
      row.querySelector('[data-down]').addEventListener('click', () => {
        if (i === items.length - 1) return;
        [items[i + 1], items[i]] = [items[i], items[i + 1]];
        drawPlan();
      });
      row.querySelector('[data-remove]').addEventListener('click', () => {
        items.splice(i, 1);
        drawPlan();
      });

      // BPM: só para exercícios com metrônomo. Grava na hora (não espera o "Salvar plano"),
      // igual à régua +/- do próprio exercício — é um dado à parte (speeds), não do plano.
      if (ex && ex.bpm) {
        const step = ex.bpm.step || 4;
        const currentBpm = () => (studentData.speeds && studentData.speeds[item.ex] && studentData.speeds[item.ex].bpm)
          || ex.bpm.start;
        const bpmRow = el('div', 'day-actions', '');
        bpmRow.innerHTML =
          `<button class="action" data-bpm="${-step}">−${step} BPM</button>` +
          `<input class="mins-input" type="number" inputmode="numeric" value="${currentBpm()}" aria-label="BPM">` +
          `<button class="action" data-bpm="${step}">+${step} BPM</button>`;
        const valEl = bpmRow.querySelector('.mins-input');
        const commitDelta = async (delta) => {
          bpmRow.querySelectorAll('button, input').forEach((el2) => { el2.disabled = true; });
          try {
            const bpm = await teacher.writeStudentSpeed(
              student.student_id, item.ex, delta, ex.bpm.start, todayISO,
            );
            studentData.speeds = studentData.speeds || {};
            studentData.speeds[item.ex] = { ...(studentData.speeds[item.ex] || {}), bpm, clean: 0, errors: 0 };
            valEl.value = bpm;
          } catch (error) {
            window.alert(error.message || String(error));
            valEl.value = currentBpm();
          } finally {
            bpmRow.querySelectorAll('button, input').forEach((el2) => { el2.disabled = false; });
          }
        };
        bpmRow.querySelectorAll('[data-bpm]').forEach((btn) => {
          btn.addEventListener('click', () => commitDelta(Number(btn.dataset.bpm)));
        });
        valEl.addEventListener('change', (e) => {
          const raw = e.target.value.trim();
          const typed = Math.round(Number(raw));
          if (raw === '' || !Number.isFinite(typed) || typed === currentBpm()) { valEl.value = currentBpm(); return; }
          commitDelta(typed - currentBpm());
        });
        row.appendChild(bpmRow);
      }

      list.appendChild(row);
    });
    return list;
  }

  function pickExerciseView(onPick) {
    const picker = el('div');
    let filter = 'todos';
    picker.innerHTML =
      '<h2>Adicionar exercício</h2><div class="sub">Banco de exercícios. Toque em um para escolher.</div>' +
      '<div class="chip-row cat-row"></div><div class="bank-list"></div>';
    const catRow = picker.querySelector('.cat-row');
    const list = picker.querySelector('.bank-list');
    const drawList = () => {
      catRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === filter));
      list.innerHTML = '';
      Object.entries(EXERCISES)
        .filter(([, ex]) => filter === 'todos' || ex.cat === filter)
        .forEach(([id, ex]) => {
          const item = el('button', 'bank-item');
          item.innerHTML =
            `<div class="bi-title">${ex.title}</div>` +
            `<div class="bi-meta">${CATEGORIES[ex.cat]} · ${ex.min} min${ex.bpm ? ' · metrônomo' : ''}</div>` +
            `<div class="bi-sub">${ex.subtitle || ''}</div>`;
          item.addEventListener('click', () => { closeSheet(); onPick(id, ex); });
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
    return picker;
  }

  function drawPlan() {
    const body = root.querySelector('.student-plan-body');
    body.innerHTML = '';
    body.appendChild(dayTabs());
    body.appendChild(planList());
    const actions = el('div', 'day-actions');
    const add = el('button', 'action', '+ Adicionar exercício');
    add.addEventListener('click', () => {
      openSheet(pickExerciseView((id, ex) => { items.push({ ex: id, min: ex.min }); drawPlan(); openSheet(root); }));
    });
    const save = el('button', 'action primary', '✓ Salvar plano deste dia');
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await teacher.writeStudentPlan(student.student_id, dayKey, items);
        // Atualiza a cópia local: sem isso, trocar de dia e voltar recarregava o plano antigo
        // (de antes de salvar), porque loadDay() lê de studentData, buscado só 1 vez ao abrir.
        studentData.plans = studentData.plans || {};
        studentData.plans[dayKey] = { items: items.map((item) => ({ ...item })), updatedAt: Date.now() };
        toast(`Plano de ${WEEK.find((d) => d.key === dayKey).label} salvo.`);
      } catch (error) {
        window.alert(error.message || String(error));
      } finally {
        save.disabled = false;
      }
    });
    actions.appendChild(add);
    actions.appendChild(save);
    body.appendChild(actions);
  }

  function loadAll() {
    root.innerHTML = `<h2>${student.student_email}</h2><div class="sub">Carregando dados do aluno…</div>`;
    teacher.fetchStudentData(student.student_id).then((result) => {
      studentData = (result && result.data) || { logs: {}, speeds: {}, plans: {} };
      root.innerHTML =
        `<h2>${student.student_email}</h2>` +
        '<div class="day-actions"><button class="action" data-refresh>↻ Atualizar</button></div>' +
        '<div class="week-block"></div>' +
        '<div class="progress-block"></div>' +
        '<div class="sub" style="margin-top:16px">Planejar a semana</div>' +
        '<div class="student-plan-body"></div>';
      root.querySelector('[data-refresh]').addEventListener('click', loadAll);
      root.querySelector('.week-block').appendChild(historyBlock());
      root.querySelector('.progress-block').appendChild(progressBlock());
      loadDay();
    }).catch((error) => {
      root.innerHTML = `<h2>${student.student_email}</h2><p class="tip">Não consegui carregar: ${error.message || error}</p>`;
    });
  }

  loadAll();
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
      '<div class="bpm-lcd"><input class="num" type="number" inputmode="numeric" aria-label="BPM"><div class="unit">BPM</div></div>' +
      `<button class="bpm-btn" data-delta="${step}" aria-label="Aumentar ${step} BPM">+</button>` +
    '</div>' +
    '<div class="run-row">' +
      '<button class="run-btn ok" data-run="ok">✓ Limpo <small></small></button>' +
      '<button class="run-btn bad" data-run="bad">✗ Errei <small></small></button>' +
    '</div>' +
    '<button class="metro-btn" data-metro><span class="beat-led"></span><span class="label"></span></button>' +
    (voiceSupported
      ? '<button class="metro-btn voice-btn" data-voice><span class="mic-dot"></span><span class="label"></span></button>' +
        '<div class="voice-heard"></div>'
      : '') +
    '<div data-history></div>' +
    `<div class="rule">3 limpos seguidos = +${step} BPM · 2 erros seguidos = −${step} BPM</div>`;

  // Registra uma tentativa (limpa ou errada) — usado tanto pelos botões quanto pela voz.
  const run = (ok) => {
    const event = store.recordRun(id, cfg, ok, todayISO);
    const bpm = store.getSpeed(id, cfg).bpm;
    if (event === 'up') toast(`Subiu para ${bpm} BPM. Bom trabalho!`);
    if (event === 'down') toast(`Voltou para ${bpm} BPM. Limpeza primeiro.`);
    if (event && metronome.running) metronome.setBpm(bpm);
    pageRedrawers.forEach((fn) => fn());
  };

  const update = () => {
    const speed = store.getSpeed(id, cfg);
    box.querySelector('.num').value = speed.bpm;
    box.querySelector('.ok small').textContent = `${speed.clean}/3`;
    box.querySelector('.bad small').textContent = `${speed.errors}/2`;
    box.querySelector('[data-metro]').classList.toggle('on', metronome.running);
    box.querySelector('[data-metro] .label').textContent = metronome.running ? 'Parar metrônomo' : `Tocar metrônomo a ${speed.bpm} BPM`;

    const voiceBtn = box.querySelector('[data-voice]');
    if (voiceBtn) {
      const listening = voiceCommand.isActive(id);
      voiceBtn.classList.toggle('on', listening);
      voiceBtn.classList.toggle('bad', !listening && voiceCommand.state === 'denied');
      voiceBtn.querySelector('.mic-dot').classList.toggle('live', listening);
      voiceBtn.querySelector('.label').textContent = listening
        ? 'Ouvindo… diga "limpo" ou "errei"'
        : voiceCommand.state === 'denied' ? 'Permissão de microfone negada'
        : '🎙️ Ativar comando de voz';
      // Mostra o que o telefone realmente entendeu — ajuda a calibrar se "limpo"/"errei" não pegar.
      const heard = box.querySelector('.voice-heard');
      heard.textContent = voiceCommand.lastHeard && listening ? `Ouvi: "${voiceCommand.lastHeard}"` : '';
    }

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

  box.querySelector('.num').addEventListener('change', (e) => {
    const raw = e.target.value.trim();
    const typed = Math.round(Number(raw));
    const speed = store.getSpeed(id, cfg);
    if (raw === '' || !Number.isFinite(typed) || typed === speed.bpm) { update(); return; }
    store.adjustSpeed(id, cfg, typed - speed.bpm, todayISO);
    if (metronome.running) metronome.setBpm(store.getSpeed(id, cfg).bpm);
    pageRedrawers.forEach((fn) => fn());
  });

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.delta) {
      store.adjustSpeed(id, cfg, Number(btn.dataset.delta), todayISO);
      if (metronome.running) metronome.setBpm(store.getSpeed(id, cfg).bpm);
    } else if (btn.dataset.run) {
      run(btn.dataset.run === 'ok');
      return; // run() já redesenha
    } else if ('metro' in btn.dataset) {
      if (metronome.running) metronome.stop();
      else { tabPlayer.stop(); metronome.setBpm(store.getSpeed(id, cfg).bpm); metronome.start(); }
    } else if ('voice' in btn.dataset) {
      voiceCommand.toggle(id, (cmd) => run(cmd === 'ok'));
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
    store.toggleDone(dateStr, day.key, item.ex, plan);
    render();
  });

  const meta = el('div', 'meta', `<div class="title${done ? ' done' : ''}"></div><div class="duration"></div>`);
  meta.querySelector('.title').textContent = ex.title;

  const tkey = timerKey(dateStr, day.key, item.ex);
  const updateDuration = () => {
    const durationEl = meta.querySelector('.duration');
    let html = `${item.min} min · ${CATEGORIES[ex.cat]}`;
    if (item.locked) html += ' · <span class="teacher-tag">🎓 professor</span>';
    const elapsed = practiceTimer.getElapsed(tkey);
    if (elapsed > 0) {
      const remaining = item.min * 60 - elapsed;
      const over = remaining < 0;
      const running = practiceTimer.isRunning(tkey);
      html += ` · <span class="timer-chip${over ? ' over' : ''}${running ? ' running' : ''}">${over ? '+' : ''}${formatClock(remaining)}</span>`;
    }
    durationEl.innerHTML = html;
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
      `<input class="mins-input" type="number" inputmode="numeric" min="5" max="90" value="${item.min}" aria-label="Minutos">` +
      '<button data-act="plus" aria-label="Mais 5 minutos">+5</button>' +
      `<button data-act="up" aria-label="Subir"${index === 0 ? ' disabled' : ''}>↑</button>` +
      `<button data-act="down" aria-label="Descer"${index === plan.length - 1 ? ' disabled' : ''}>↓</button>` +
      (item.locked
        ? '<span class="locked-note">🎓 Definido pelo professor</span>'
        : '<button data-act="swap">Trocar</button><button data-act="remove" class="danger">Remover</button>'));
    row.querySelector('.mins-input').addEventListener('change', (e) => {
      const raw = e.target.value.trim();
      const typed = Math.round(Number(raw));
      const val = raw !== '' && Number.isFinite(typed) ? Math.min(90, Math.max(5, typed)) : item.min;
      updatePlan(day, (items) => { items[index].min = val; });
    });
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
  const hasLocked = plan.some((item) => item.locked);

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
      if (hasLocked) {
        reset.disabled = true;
        reset.title = 'Este dia tem exercícios definidos pelo professor — peça a ele pra ajustar.';
      } else {
        reset.addEventListener('click', () => {
          if (window.confirm(`Voltar ${day.name} ao plano padrão? Suas mudanças neste dia serão perdidas.`)) {
            store.resetPlan(day.key);
            render();
          }
        });
      }
      actions.appendChild(reset);
    }
  }
  container.appendChild(actions);

  const notes = el('div', 'notes-block', '<span class="notes-label">NOTAS DE HOJE</span>');
  const textarea = el('textarea', 'notes');
  textarea.placeholder = 'Como foi o treino? O que travou, o que fluiu...';
  textarea.value = log.notes || '';
  textarea.addEventListener('input', () => store.setNotes(dateStr, day.key, textarea.value, plan));
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
voiceCommand.onChange(() => {
  if (voiceCommand.state === 'denied') toast('O celular negou o microfone. Ative-o nas permissões do site.');
  pageRedrawers.forEach((fn) => fn());
});
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

let teacherPillEmail; // só refaz o fetch de alunos quando troca de conta, não a cada tick de sync
sync.onState(() => {
  updateSyncPill();
  sheetRedrawers.forEach((fn) => fn());
  const email = sync.getState().email;
  if (email !== teacherPillEmail) { teacherPillEmail = email; refreshTeacherPill(); }
});
// Outro aparelho trouxe novidades: redesenha, sem atrapalhar quem está digitando uma nota.
store.onRemoteChange(() => {
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
  render();
});

$('#metroBtn').addEventListener('click', () => openSheet(metronomeView()));
$('#syncBtn').addEventListener('click', () => openSheet(accountView()));
$('#teacherBtn').addEventListener('click', () => openSheet(myStudentsView()));
render();
updateSyncPill();
sync.init();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // updateViaCache: 'none' faz o navegador sempre buscar o sw.js de verdade (sem cache HTTP) pra
  // checar se há versão nova — senão o GitHub Pages (Cache-Control: max-age=600) podia mostrar o
  // service worker antigo por até 10 min depois de um deploy, atrasando a atualização do app.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .catch(() => { /* app funciona sem offline */ });
}
