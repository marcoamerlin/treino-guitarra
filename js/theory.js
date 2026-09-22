// Teoria musical para o explorador de escalas: notas, intervalos e posições no braço.
//
// Convenção de altura: pitch class 0=Dó ... 11=Si (a mesma usada em tab-player.js e nos testes
// de acordes). Convenção de cordas: índice 0=e (mais fina) ... 5=E grave — a mesma ordem de
// tab.js e tab-player.js (chords.js usa a ordem contrária; aqui seguimos a mais comum no projeto).

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
export const OPEN_PC = [4, 11, 7, 2, 9, 4]; // pitch class de cada corda solta, mesma ordem de STRING_NAMES

// Rótulo de grau (1, b3, 4...) por intervalo, para mostrar junto do nome da escala.
export const SCALES = {
  major: { label: 'Maior', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  minor: { label: 'Menor natural', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  pentMajor: { label: 'Pentatônica maior', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  pentMinor: { label: 'Pentatônica menor', intervals: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'] },
};

// Só as pentatônicas (5 notas) rendem posições/caixas úteis: com 7 notas a janela entre graus
// vizinhos fica estreita demais (às vezes 1 casa só) para ser uma posição de mão de verdade.
export const hasPositions = (scaleKey) => SCALES[scaleKey].intervals.length <= 5;

export const noteName = (pc) => NOTE_NAMES[((pc % 12) + 12) % 12];

// Todas as notas da escala visíveis entre fretStart e fretEnd, em todas as cordas.
export function fretboardNotes(rootPc, scaleKey, fretStart, fretEnd) {
  const { intervals } = SCALES[scaleKey];
  const set = new Set(intervals);
  const notes = [];
  for (let string = 0; string < 6; string++) {
    for (let fret = fretStart; fret <= fretEnd; fret++) {
      const pc = (OPEN_PC[string] + fret) % 12;
      const relative = ((pc - rootPc) % 12 + 12) % 12;
      if (set.has(relative)) notes.push({ string, fret, pc, relative, root: relative === 0, name: noteName(pc) });
    }
  }
  return notes;
}

// A casa mais baixa (0–11) onde a raiz aparece na corda Mi grave: âncora das posições/caixas.
export function anchorFret(rootPc) {
  return ((rootPc - OPEN_PC[5]) % 12 + 12) % 12;
}

// As N posições (caixas) da escala, como faixas de casas (a mesma faixa vale para as 6 cordas).
// Cada posição vai de um grau até o próximo, então posições vizinhas compartilham a casa da
// virada — é a nota que "conecta" uma caixa à outra ao trocar de posição no braço.
export function positionsOf(rootPc, scaleKey) {
  const { intervals } = SCALES[scaleKey];
  const start = anchorFret(rootPc);
  const bounds = [...intervals].sort((a, b) => a - b);
  return bounds.map((deg, i) => ({
    index: i + 1,
    start: start + deg,
    end: start + (i + 1 < bounds.length ? bounds[i + 1] : bounds[0] + 12),
  }));
}
