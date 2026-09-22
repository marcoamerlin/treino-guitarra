import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_NAMES, OPEN_PC, noteName } from '../js/theory.js';
import { CAGED_SHAPES, CHORD_TYPES, voicingFrets, voicingArray } from '../js/chord-shapes.js';

const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const CHORD_TONES = {
  major: [0, 4, 7], minor: [0, 3, 7], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
};

function notesOf(shapeKey, typeKey, rootPc) {
  const frets = voicingFrets(shapeKey, typeKey, rootPc);
  return Object.entries(frets).map(([string, fret]) => {
    const pc = (OPEN_PC[Number(string)] + fret) % 12;
    return { string: Number(string), fret, pc, relative: ((pc - rootPc) % 12 + 12) % 12 };
  });
}

test('as 5 formas na raiz E/A/D reproduzem exatamente os acordes abertos conhecidos', () => {
  // E,A,D "moram" em posição aberta na sua própria raiz (E, A, D) — comparação direta com o que
  // qualquer método de violão ensina como primeiro acorde.
  assert.deepEqual(voicingArray('E', 'major', PC.E), [0, 0, 1, 2, 2, 0]); // e B G D A E
  assert.deepEqual(voicingArray('E', 'minor', PC.E), [0, 0, 0, 2, 2, 0]);
  assert.deepEqual(voicingArray('E', 'dom7', PC.E), [0, 0, 1, 0, 2, 0]);
  assert.deepEqual(voicingArray('E', 'maj7', PC.E), [0, 0, 1, 1, 2, 0]);
  assert.deepEqual(voicingArray('E', 'min7', PC.E), [0, 0, 0, 0, 2, 0]);

  assert.deepEqual(voicingArray('A', 'major', PC.A), [0, 2, 2, 2, 0, null]);
  assert.deepEqual(voicingArray('A', 'minor', PC.A), [0, 1, 2, 2, 0, null]);
  assert.deepEqual(voicingArray('A', 'dom7', PC.A), [0, 2, 0, 2, 0, null]);
  assert.deepEqual(voicingArray('A', 'maj7', PC.A), [0, 2, 1, 2, 0, null]);
  assert.deepEqual(voicingArray('A', 'min7', PC.A), [0, 1, 0, 2, 0, null]);

  assert.deepEqual(voicingArray('D', 'major', PC.D), [2, 3, 2, 0, null, null]);
  assert.deepEqual(voicingArray('D', 'minor', PC.D), [1, 3, 2, 0, null, null]);
  assert.deepEqual(voicingArray('D', 'dom7', PC.D), [2, 1, 2, 0, null, null]);
  assert.deepEqual(voicingArray('D', 'maj7', PC.D), [2, 2, 2, 0, null, null]);
  assert.deepEqual(voicingArray('D', 'min7', PC.D), [1, 1, 2, 0, null, null]);
});

test('a forma C na raiz C reproduz o acorde aberto de Dó (X32010)', () => {
  assert.deepEqual(voicingArray('C', 'major', PC.C), [0, 1, 0, 2, 3, null]);
});

test('a forma G na raiz G reproduz o acorde aberto de Sol (320033)', () => {
  assert.deepEqual(voicingArray('G', 'major', PC.G), [3, 3, 0, 0, 2, 3]);
});

test('toda combinação (5 formas × 5 tipos × 12 raízes) só usa as notas certas do acorde, sem casa negativa', () => {
  let checked = 0;
  Object.keys(CAGED_SHAPES).forEach((shapeKey) => {
    Object.keys(CHORD_TYPES).forEach((typeKey) => {
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        const allowed = new Set(CHORD_TONES[typeKey]);
        const notes = notesOf(shapeKey, typeKey, rootPc);
        assert.ok(notes.length >= 3, `${shapeKey} ${typeKey} ${noteName(rootPc)}: menos de 3 notas`);
        notes.forEach((n) => {
          assert.ok(n.fret >= 0, `${shapeKey} ${typeKey} ${noteName(rootPc)}: casa negativa na corda ${n.string}`);
          assert.ok(n.fret <= 24, `${shapeKey} ${typeKey} ${noteName(rootPc)}: casa ${n.fret} fora do braço`);
          assert.ok(allowed.has(n.relative),
            `${shapeKey} ${typeKey} ${noteName(rootPc)}: nota errada (grau ${n.relative}) na corda ${n.string}, casa ${n.fret}`);
        });
        // a raiz e (para tríades/tétrades com 3ª e 5ª) esses graus básicos têm que estar presentes.
        const relatives = new Set(notes.map((n) => n.relative));
        assert.ok(relatives.has(0), `${shapeKey} ${typeKey} ${noteName(rootPc)}: sem a nota raiz`);
        const third = typeKey === 'minor' || typeKey === 'min7' ? 3 : 4;
        assert.ok(relatives.has(third), `${shapeKey} ${typeKey} ${noteName(rootPc)}: sem a 3ª`);
        checked += 1;
      }
    });
  });
  assert.equal(checked, 5 * 5 * 12);
});

test('cada forma tem uma corda-âncora dentro do seu próprio desenho (fretOffset[anchor] = 0)', () => {
  Object.entries(CAGED_SHAPES).forEach(([key, shape]) => {
    assert.equal(shape.fretOffset[shape.anchor], 0, `${key}: âncora não está em offset 0`);
  });
});

test('CHORD_TYPES e NOTE_NAMES existem e têm os rótulos esperados', () => {
  assert.equal(CHORD_TYPES.major.label, 'Maior');
  assert.equal(CHORD_TYPES.min7.suffix, 'm7');
  assert.equal(NOTE_NAMES.length, 12);
});
