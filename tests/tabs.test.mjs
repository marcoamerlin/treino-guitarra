import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTab } from '../js/tab.js';
import { EXERCISES } from '../js/data/exercises.js';
import { CHORDS, chordCol } from '../js/data/chords.js';
import { WEEK } from '../js/data/plans.js';
import { parseFret } from '../js/tab-player.js';

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
    assert.ok(tab.play.perBeat >= 1, `${id}: perBeat inválido`);
    tab.play.cols.forEach((col) => (col || []).forEach(([string, raw]) => {
      const { fret } = parseFret(raw);
      assert.ok(string >= 0 && string <= 5, `${id}: corda ${string}`);
      assert.ok(Number.isInteger(fret) && fret >= 0 && fret <= 24, `${id}: casa ${raw}`);
    }));
  });
});

test('bend "7b9r7" é lido como casa 7 subindo até 9', () => {
  assert.deepEqual(parseFret('7b9r7'), { fret: 7, bendTo: 9 });
  assert.deepEqual(parseFret(12), { fret: 12, bendTo: null });
});

test('acordes: casas coerentes com os dedos e as notas certas (raiz + quinta)', () => {
  // classe de altura (0=Dó ... 9=Lá) das cordas soltas E A D G B e
  const open = [4, 9, 2, 7, 11, 4];
  const roots = { A5: 9, C5: 0, D5: 2, E5: 4 };
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
