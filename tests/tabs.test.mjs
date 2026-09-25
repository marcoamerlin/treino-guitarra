import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTab } from '../js/tab.js';
import { EXERCISES } from '../js/data/exercises.js';
import { CHORDS, chordCol } from '../js/data/chords.js';
import { WEEK } from '../js/data/plans.js';
import { parseFret } from '../js/tab-player.js';
import { parseTab } from '../js/tab-dsl.js';
import { intervalName } from '../js/theory.js';

const allTabs = Object.entries(EXERCISES).flatMap(([id, ex]) => (ex.tabs || []).map((tab) => ({ id, tab })));

test('buildTab alinha as seis cordas, inclusive com casas de 2 dígitos e barras de compasso', () => {
  const text = buildTab([[[5, 10]], [[4, 5], [3, 7]], null, [[0, 12]]], { bar: 2 });
  const rows = text.split('\n');
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map((r) => r.length)).size, 1);
  assert.match(rows[5], /^E\|-10--/);
});

test('todas as tablaturas têm linhas das cordas com o mesmo comprimento', () => {
  assert.ok(allTabs.length > 0);
  allTabs.forEach(({ id, tab }) => {
    const rows = tab.text.split('\n').filter((line) => /^[eBGDAE]\|/.test(line));
    assert.equal(rows.length, 6, `${id}: esperava 6 linhas de corda`);
    assert.equal(new Set(rows.map((r) => r.length)).size, 1, `${id}: linhas desalinhadas`);
  });
});

test('toda tablatura tocável só usa cordas 0–5 e casas válidas', () => {
  allTabs.filter(({ tab }) => tab.play).forEach(({ id, tab }) => {
    assert.ok(['clean', 'muted'].includes(tab.play.voice), `${id}: timbre inválido`);
    assert.ok(tab.play.perBeat > 0, `${id}: perBeat inválido`);
    tab.play.cols.forEach((col) => (col || []).forEach(([string, raw]) => {
      const { fret } = parseFret(raw);
      assert.ok(string >= 0 && string <= 5, `${id}: corda ${string}`);
      assert.ok(Number.isInteger(fret) && fret >= 0 && fret <= 24, `${id}: casa ${raw}`);
    }));
  });
});

test('parseFret entende bend, retorno e vibrato', () => {
  assert.deepEqual(parseFret('7b9r7'), { fret: 7, bendTo: 9, release: true, vibrato: false });
  assert.deepEqual(parseFret('7b9'), { fret: 7, bendTo: 9, release: false, vibrato: false });
  assert.deepEqual(parseFret('8~'), { fret: 8, bendTo: null, release: false, vibrato: true });
  assert.deepEqual(parseFret('8b10~'), { fret: 8, bendTo: 10, release: false, vibrato: true });
  assert.deepEqual(parseFret(12), { fret: 12, bendTo: null, release: false, vibrato: false });
});

test('acordes: casas coerentes com os dedos e as notas certas (raiz + quinta)', () => {
  // classe de altura (0=Dó ... 9=Lá) das cordas soltas E A D G B e
  const open = [4, 9, 2, 7, 11, 4];
  const roots = { A5: 9, C5: 0, D5: 2, E5: 4, G5: 7, F5: 5 };
  Object.entries(CHORDS).forEach(([id, chord]) => {
    const notes = chord.frets.map((f, i) => (f == null ? null : (open[i] + f) % 12)).filter((n) => n !== null);
    const root = roots[id];
    const fifth = (root + 7) % 12;
    assert.ok(notes.every((n) => n === root || n === fifth), `${id}: só raiz e quinta`);
    assert.equal(notes.includes(root) && notes.includes(fifth), true, `${id}: precisa de raiz e quinta`);
    chord.frets.forEach((f, i) => {
      if (f > 0) assert.ok(chord.fingers[i] > 0, `${id}: casa apertada sem dedo na corda ${i}`);
    });
    assert.ok(chordCol(id).length >= 2);
  });
});

test('todo dia da semana cita só exercícios que existem no banco e soma 60 min (exceto descanso e sábado)', () => {
  WEEK.forEach((day) => {
    day.plan.forEach((item) => assert.ok(EXERCISES[item.ex], `${day.key}: exercício ${item.ex} não existe`));
  });
  ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].forEach((key) => {
    const total = WEEK.find((d) => d.key === key).plan.reduce((sum, item) => sum + item.min, 0);
    assert.equal(total, 60, `${key} soma ${total} min`);
  });
});

test('toda nota de toda tablatura tocável tem gravação de guitarra no projeto', async () => {
  const { existsSync } = await import('node:fs');
  const { notesOf } = await import('../js/tab-player.js');
  const root = new URL('../', import.meta.url);
  allTabs.filter(({ tab }) => tab.play).forEach(({ id, tab }) => {
    notesOf(tab.play.cols).forEach((midi) => {
      const file = new URL(`audio/guitar-${tab.play.voice}/${midi}.mp3`, root);
      assert.ok(existsSync(file), `${id}: falta a gravação da nota MIDI ${midi} (${tab.play.voice})`);
    });
  });
});

test('o service worker guarda offline exatamente as gravações que existem (MIDI 40 a 76)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  assert.match(sw, /length: 37/);
  for (const voice of ['clean', 'muted']) {
    const files = readdirSync(new URL(`audio/guitar-${voice}/`, root)).map((f) => parseInt(f, 10)).sort((a, b) => a - b);
    assert.equal(files.length, 37);
    assert.equal(files[0], 40);
    assert.equal(files[36], 76);
  }
});

test('notação curta: hammer-on/pull-off viram ligação, e a nota ligada não leva palhetada', () => {
  const tab = parseTab('e5h e8p e5 B8');
  assert.equal(tab.cols.length, 4);
  assert.deepEqual(tab.links, ['h', 'p', null, null]);
  assert.deepEqual(tab.pick, ['v', ' ', ' ', 'v']);
  assert.deepEqual(tab.soft, [false, true, true, false]);
  assert.deepEqual(tab.cols[0], [[0, 5]]);
  assert.deepEqual(tab.cols[3], [[1, 8]]);
});

test('notação curta: bend, vibrato, pausa, palhetada alternada e erro em nota inválida', () => {
  const tab = parseTab('G7b9r7 B8~ - D7', { pick: 'alt' });
  assert.deepEqual(tab.cols[0], [[2, '7b9r7']]);
  assert.deepEqual(tab.cols[1], [[1, '8~']]);
  assert.equal(tab.cols[2], null);
  assert.deepEqual(tab.pick, ['v', '^', ' ', 'v']);
  assert.throws(() => parseTab('X5'), /inválida/);
});

test('buildTab com ligações desenha 5h8p5 e mantém as linhas alinhadas', () => {
  const tab = parseTab('E5h E8p E5 A5h A7p A5');
  const text = buildTab(tab.cols, { links: tab.links, pick: tab.pick });
  const rows = text.split('\n').filter((line) => /^[eBGDAE]\|/.test(line));
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map((r) => r.length)).size, 1);
  assert.match(rows[5], /^E\|-5h8p5-/);
  assert.match(rows[4], /5h7p5--\|$/);
});

test('cada dia de treino detalhado: todos os exercícios têm passos e nenhum ficou em resumo (draft)', () => {
  WEEK.forEach((day) => day.plan.forEach((item) => {
    const ex = EXERCISES[item.ex];
    assert.ok(ex.steps && ex.steps.length >= 1, `${item.ex}: sem passo a passo`);
    assert.ok(!ex.draft, `${item.ex}: ainda em resumo`);
  }));
});

test('exercícios com metrônomo têm meta maior que o começo', () => {
  Object.entries(EXERCISES).filter(([, ex]) => ex.bpm).forEach(([id, ex]) => {
    assert.ok(ex.bpm.goal > ex.bpm.start, `${id}: meta menor que o início`);
  });
});

test('o service worker guarda offline todo arquivo .js do app (js/ e js/data/)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const files = [
    ...readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
    ...readdirSync(new URL('js/data/', root)).filter((f) => f.endsWith('.js')).map((f) => 'js/data/' + f),
  ];
  const missing = files.filter((f) => !sw.includes("'" + f + "'"));
  assert.deepEqual(missing, [], 'faltam no SHELL do sw.js: ' + missing.join(', '));
});

test('exercício de intervalos (Mi grave/Lá): a sequência toca exatamente os intervalos que o passo a passo descreve', () => {
  const tab = EXERCISES.interval_ea.tabs[0];
  const rootMidi = 5 + 40; // E grave (MIDI 40) + casa 5 = A
  // sequência real do dslTab: E5 A5 E5 A4 E5 A3 E5 A2 E5 A1 E5 A0
  const expected = ['1', '4', '1', '3', '1', '3-', '1', '2', '1', '2-', '1', '1'];
  const got = tab.play.cols.map((col) => {
    const [[string, fret]] = col;
    const midi = [64, 59, 55, 50, 45, 40][string] + Number(fret); // e B G D A E
    return intervalName(((midi - rootMidi) % 12 + 12) % 12);
  });
  assert.deepEqual(got, expected);
});

test('seq4 (grupos de 4, Dó maior 7ª posição): bate nota a nota com a sequência conferida com o usuário', () => {
  const STR = ['e', 'B', 'G', 'D', 'A', 'E'];
  // Ditada pelo usuário assistindo ao vídeo-fonte (Cordas e Música, exercício 1), casa por casa e
  // corda por corda; conferida por cálculo a partir da escala antes de entrar aqui — ver CLAUDE.md.
  const expected = (
    'E8 E10 A7 A8 E10 A7 A8 A10 A7 A8 A10 D7 A8 A10 D7 D9 A10 D7 D9 D10 D7 D9 D10 G7 D9 D10 '
    + 'G7 G9 D10 G7 G9 G10 G7 G9 G10 B8 G9 G10 B8 B10 G10 B8 B10 e7 B8 B10 e7 e8 e10'
  ).split(' ');
  const got = EXERCISES.seq4.tabs[0].play.cols.map(([[string, fret]]) => STR[string] + fret);
  assert.deepEqual(got, expected);
});

test('cascade4 (cromático em cascata): sobe Mi grave→Mi aguda, desce 1 casa acima e fecha na tônica', () => {
  const STR = ['e', 'B', 'G', 'D', 'A', 'E'];
  const expected = (
    'E5 E6 E7 E8 A4 A5 A6 A7 D3 D4 D5 D6 G2 G3 G4 G5 B2 B3 B4 B5 e1 e2 e3 e4 '
    + 'e5 e4 e3 e2 B6 B5 B4 B3 G6 G5 G4 G3 D7 D6 D5 D4 A8 A7 A6 A5 E9 E8 E7 E6 E5'
  ).split(' ');
  const got = EXERCISES.cascade4.tabs[0].play.cols.map(([[string, fret]]) => STR[string] + fret);
  assert.deepEqual(got, expected);
});
