// Confere por computador (não de cabeça) os graus de cada nota nos acordes abertos que servem de
// base às 5 formas CAGED em js/chord-shapes.js. Uso: node tools/derive-chord-shapes.mjs
//
// Rodar depois de qualquer mudança em CAGED_SHAPES, e comparar a saída com o comentário de cada
// forma no arquivo — foi assim que os offsets de cada forma foram conferidos a primeira vez.

const OPEN_PC = { e: 4, B: 11, G: 7, D: 2, A: 9, E: 4 }; // pitch class das cordas soltas
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEGREE = { 0: 'root', 3: 'm3', 4: '3', 7: '5', 10: 'b7', 11: 'maj7' };

const noteAt = (string, fret) => (OPEN_PC[string] + fret) % 12;
const intervalFrom = (rootPc, pc) => ((pc - rootPc) % 12 + 12) % 12;

// Os acordes abertos que qualquer método de violão ensina primeiro — a referência de verdade.
const KNOWN_OPEN_CHORDS = {
  E: { root: 4, frets: { E: 0, A: 2, D: 2, G: 1, B: 0, e: 0 } },
  Em: { root: 4, frets: { E: 0, A: 2, D: 2, G: 0, B: 0, e: 0 } },
  E7: { root: 4, frets: { E: 0, A: 2, D: 0, G: 1, B: 0, e: 0 } },
  Emaj7: { root: 4, frets: { E: 0, A: 2, D: 1, G: 1, B: 0, e: 0 } },
  Em7: { root: 4, frets: { E: 0, A: 2, D: 0, G: 0, B: 0, e: 0 } },
  A: { root: 9, frets: { A: 0, D: 2, G: 2, B: 2, e: 0 } },
  Am: { root: 9, frets: { A: 0, D: 2, G: 2, B: 1, e: 0 } },
  A7: { root: 9, frets: { A: 0, D: 2, G: 0, B: 2, e: 0 } },
  Amaj7: { root: 9, frets: { A: 0, D: 2, G: 1, B: 2, e: 0 } },
  Am7: { root: 9, frets: { A: 0, D: 2, G: 0, B: 1, e: 0 } },
  D: { root: 2, frets: { D: 0, G: 2, B: 3, e: 2 } },
  Dm: { root: 2, frets: { D: 0, G: 2, B: 3, e: 1 } },
  D7: { root: 2, frets: { D: 0, G: 2, B: 1, e: 2 } },
  Dmaj7: { root: 2, frets: { D: 0, G: 2, B: 2, e: 2 } },
  Dm7: { root: 2, frets: { D: 0, G: 2, B: 1, e: 1 } },
  C: { root: 0, frets: { A: 3, D: 2, G: 0, B: 1, e: 0 } },
  G: { root: 7, frets: { E: 3, A: 2, D: 0, G: 0, B: 3, e: 3 } },
};

for (const [name, { root, frets }] of Object.entries(KNOWN_OPEN_CHORDS)) {
  const rows = Object.entries(frets).map(([string, fret]) => {
    const pc = noteAt(string, fret);
    const degree = intervalFrom(root, pc);
    return `${string}:${fret}=${NAMES[pc]}(${DEGREE[degree] || degree})`;
  });
  console.log(name.padEnd(6), rows.join('  '));
}
