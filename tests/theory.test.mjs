import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_NAMES, OPEN_PC, SCALES, hasPositions, noteName, fretboardNotes, anchorFret, positionsOf,
} from '../js/theory.js';

const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

test('OPEN_PC bate com as cordas soltas de verdade (e B G D A E)', () => {
  assert.deepEqual(OPEN_PC.map((pc) => NOTE_NAMES[pc]), ['E', 'B', 'G', 'D', 'A', 'E']);
});

test('noteName cobre as 12 notas e aceita pitch class fora de 0–11', () => {
  assert.equal(noteName(0), 'C');
  assert.equal(noteName(11), 'B');
  assert.equal(noteName(12), 'C'); // uma oitava acima, mesma classe
  assert.equal(noteName(-1), 'B'); // uma casa abaixo do Dó é o Si
});

test('cada escala tem um grau (degree) para cada intervalo, na mesma ordem', () => {
  Object.values(SCALES).forEach((scale) => assert.equal(scale.intervals.length, scale.degrees.length));
});

test('hasPositions: só as pentatônicas (5 notas) têm posições', () => {
  assert.equal(hasPositions('pentMinor'), true);
  assert.equal(hasPositions('pentMajor'), true);
  assert.equal(hasPositions('major'), false);
  assert.equal(hasPositions('minor'), false);
});

test('fretboardNotes: só devolve notas que pertencem à escala, e marca a raiz certinho', () => {
  // Lá menor pentatônica (A, C, D, E, G), casas 0–12: toda nota fora desse conjunto é erro grave.
  const notes = fretboardNotes(PC.A, 'pentMinor', 0, 12);
  const allowed = new Set(['A', 'C', 'D', 'E', 'G']);
  assert.ok(notes.length > 0);
  notes.forEach((n) => assert.ok(allowed.has(n.name), `nota fora da escala: ${n.name} (corda ${n.string}, casa ${n.fret})`));
  notes.forEach((n) => assert.equal(n.root, n.name === 'A'));
});

test('caixa 1 da pentatônica de Lá menor bate exatamente com o app (segunda-feira) e com a referência visual', () => {
  // js/data/exercises.js usa: E(5,8) A(5,7) D(5,7) G(5,7) B(5,8) e(5,8) — já validado com o usuário.
  const notes = fretboardNotes(PC.A, 'pentMinor', 5, 8);
  const byString = (s) => notes.filter((n) => n.string === s).map((n) => n.fret).sort((a, b) => a - b);
  assert.deepEqual(byString(5), [5, 8]); // E grave
  assert.deepEqual(byString(4), [5, 7]); // A
  assert.deepEqual(byString(3), [5, 7]); // D
  assert.deepEqual(byString(2), [5, 7]); // G
  assert.deepEqual(byString(1), [5, 8]); // B
  assert.deepEqual(byString(0), [5, 8]); // e
});

test('anchorFret: a raiz cai na casa certa da corda Mi grave, sempre entre 0 e 11', () => {
  assert.equal(anchorFret(PC.A), 5); // A na corda E grave é a casa 5
  assert.equal(anchorFret(PC.E), 0); // E na corda E grave é a corda solta
  assert.equal(anchorFret(PC.G), 3);
  Object.values(PC).forEach((pc) => assert.ok(anchorFret(pc) >= 0 && anchorFret(pc) <= 11));
});

test('positionsOf: 5 posições para a pentatônica, conectadas (fim de uma = começo da próxima)', () => {
  const positions = positionsOf(PC.A, 'pentMinor');
  assert.equal(positions.length, 5);
  assert.equal(positions[0].start, 5); // caixa 1 da pentatônica de Lá menor começa na casa 5
  assert.equal(positions[0].end, 8);   // e vai até a 8, batendo com o teste anterior
  for (let i = 1; i < positions.length; i++) assert.equal(positions[i].start, positions[i - 1].end);
  assert.equal(positions[4].end, positions[0].start + 12); // fecha o ciclo numa oitava acima
});

test('toda posição de toda combinação de raiz só contém notas da escala (sem nota errada)', () => {
  for (let pc = 0; pc < 12; pc++) {
    for (const scaleKey of ['pentMinor', 'pentMajor']) {
      const { intervals } = SCALES[scaleKey];
      const relatives = new Set(intervals);
      positionsOf(pc, scaleKey).forEach(({ start, end }) => {
        fretboardNotes(pc, scaleKey, Math.max(0, start), end).forEach((n) => {
          assert.ok(relatives.has(n.relative), `${noteName(pc)} ${scaleKey}: nota inválida ${n.name} na casa ${n.fret}`);
        });
      });
    }
  }
});

test('a escala maior de Dó não usa sustenidos nem bemóis (todas as 7 notas naturais)', () => {
  const notes = fretboardNotes(PC.C, 'major', 0, 12);
  const names = new Set(notes.map((n) => n.name));
  assert.deepEqual([...names].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});

test('a pentatônica maior de Dó (C D E G A) é a mesma forma da pentatônica menor de Lá', () => {
  const c = fretboardNotes(PC.C, 'pentMajor', 0, 12).map((n) => n.name).sort();
  const a = fretboardNotes(PC.A, 'pentMinor', 0, 12).map((n) => n.name).sort();
  assert.deepEqual(c, a);
});
