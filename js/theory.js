// Teoria musical para o explorador de escalas: notas, intervalos e posições no braço.
//
// Convenção de altura: pitch class 0=Dó ... 11=Si (a mesma usada em tab-player.js e nos testes
// de acordes). Convenção de cordas: índice 0=e (mais fina) ... 5=E grave — a mesma ordem de
// tab.js e tab-player.js (chords.js usa a ordem contrária; aqui seguimos a mais comum no projeto).

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Nome em português (dó-ré-mi), só pra legenda dos modos — pedido de usuário, 2026-09-30, pra
// bater com o material de referência ("Sol Jônio", não "G Jônio").
export const PT_NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const ptName = (pc) => PT_NAMES[((pc % 12) + 12) % 12];
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
export const OPEN_PC = [4, 11, 7, 2, 9, 4]; // pitch class de cada corda solta, mesma ordem de STRING_NAMES

// Rótulo de grau (1, b3, 4...) por intervalo, para mostrar junto do nome da escala.
export const SCALES = {
  major: { label: 'Maior', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  minor: { label: 'Menor natural', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  pentMajor: { label: 'Pentatônica maior', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  pentMinor: { label: 'Pentatônica menor', intervals: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'] },
  // Mesmas notas da escala maior — é o mesmo campo harmônico, só que explorado modo a modo (ver
  // modePositions) em vez da vista simples "1 2 3 4 5 6 7" de sempre. Opção separada (pedido de
  // usuário, 2026-09-30): a "Maior" comum continua do jeito que sempre foi.
  modes: { label: 'Modos gregos', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
};

// Só as pentatônicas (5 notas) rendem posições/caixas úteis: com 7 notas a janela entre graus
// vizinhos fica estreita demais (às vezes 1 casa só) para ser uma posição de mão de verdade.
export const hasPositions = (scaleKey) => SCALES[scaleKey].intervals.length <= 5;

// Nome de cada intervalo (0 a 11 semitons a partir da tônica). Alguns têm duas leituras comuns
// (mesma distância, nomes diferentes): 4#/5b é a mesma casa (trítono), só muda o contexto.
// Conferido contra um quadro de intervalos de verdade (célula por célula, por cálculo, não de
// cabeça) — ver histórico do projeto. Números "compostos" (9, 11, 13 = 2, 4, 6 numa oitava acima)
// não entram aqui de propósito: é a mesma nota, e o quadro original os usava sem uma regra fixa
// (escolha do professor, célula a célula) — então ficamos só com o nome básico, sem ambiguidade.
export const INTERVAL_NAMES = ['1', '2-', '2', '3-', '3', '4', '4#/5b', '5', '5#/6-', '6', '7', '7+'];
export const intervalName = (semitones) => INTERVAL_NAMES[((semitones % 12) + 12) % 12];

// O intervalo de cada casa do braço em relação à raiz escolhida — não filtra por escala,
// mostra as 12 posições cromáticas (é o "quadro móvel de intervalos").
export function fretboardIntervals(rootPc, fretStart, fretEnd) {
  const notes = [];
  for (let string = 0; string < 6; string++) {
    for (let fret = fretStart; fret <= fretEnd; fret++) {
      const pc = (OPEN_PC[string] + fret) % 12;
      const relative = ((pc - rootPc) % 12 + 12) % 12;
      notes.push({ string, fret, pc, relative, root: relative === 0, name: intervalName(relative) });
    }
  }
  return notes;
}

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

// Nome e cifra (tétrade) de cada grau do campo harmônico maior — fixos, não dependem da tônica
// escolhida (pedido de usuário, 2026-09-29, baseado num material de referência do Instituto
// Magno). Índice 0 = 1º grau (Jônio) ... 6 = 7º grau (Lócrio).
export const MODE_NAMES = ['Jônio', 'Dórico', 'Frígio', 'Lídio', 'Mixolídio', 'Eólio', 'Lócrio'];
export const MODE_CHORDS = ['7M', 'm7', 'm7', '7M', '7', 'm7', 'm7(b5)'];

// As 7 notas da escala maior, "relidas" a partir de um grau — ex.: rootPc=G, modeIndex=0 (Jônio)
// devolve G A B C D E F#; modeIndex=2 (Frígio, 3º grau) devolve as mesmas 7 notas mas começando
// em B: B C D E F# G A. modeIndex aqui é 0-based (0=Jônio ... 6=Lócrio).
export function modeScaleNotes(rootPc, modeIndex) {
  const { intervals } = SCALES.major;
  const rotated = [...intervals.slice(modeIndex), ...intervals.slice(0, modeIndex)];
  return rotated.map((iv) => noteName((rootPc + iv) % 12));
}

// As 7 posições dos modos do campo harmônico maior, em "3 notas por corda" — diferente de
// positionsOf() (uma janela de casas comum às 6 cordas, boa pra pentatônica: com 7 notas a janela
// fica curta demais, ver hasPositions()). Aqui cada corda tem seu próprio trecho de casas, do
// jeito que se ensina modo na prática: o braço inteiro dividido em 7 caixas que se conectam, uma
// por grau. Cordas processadas da mais grave pra mais aguda (a lógica é "sobe a escala nota por
// nota, sempre para a casa mais próxima acima da anterior"), resultado guardado na ordem de
// STRING_NAMES (e primeiro). Conferido por computador contra o material de referência antes de
// entrar no explorador — nunca calcular posição de modo de cabeça.
export function modePositions(rootPc) {
  const { intervals } = SCALES.major;
  const nextDegree = (relative) => intervals[(intervals.indexOf(relative) + 1) % intervals.length];
  const order = [5, 4, 3, 2, 1, 0]; // E, A, D, G, B, e — grave para aguda

  const findFret = (stringIdx, minFret, wantRelative) => {
    for (let f = minFret; f <= minFret + 4; f++) {
      const relative = ((OPEN_PC[stringIdx] + f - rootPc) % 12 + 12) % 12;
      if (relative === wantRelative) return f;
    }
    throw new Error(`modePositions: não achei o grau ${wantRelative} a partir da casa ${minFret}`);
  };

  const positions = [];
  let startFret = anchorFret(rootPc);
  let degreeRelative = 0;

  for (let m = 0; m < 7; m++) {
    const dots = [];
    let lastRelative = null;
    let cursorFret = startFret;
    order.forEach((stringIdx) => {
      const fretsHere = [];
      for (let n = 0; n < 3; n++) {
        const wantRelative = lastRelative === null ? degreeRelative : nextDegree(lastRelative);
        const searchFrom = n === 0 ? cursorFret : fretsHere[fretsHere.length - 1];
        const fret = findFret(stringIdx, searchFrom, wantRelative);
        fretsHere.push(fret);
        lastRelative = wantRelative;
      }
      cursorFret = fretsHere[0];
      fretsHere.forEach((fret) => {
        const pc = (OPEN_PC[stringIdx] + fret) % 12;
        const relative = ((pc - rootPc) % 12 + 12) % 12;
        dots.push({ string: stringIdx, fret, pc, relative, root: relative === degreeRelative, name: noteName(pc) });
      });
    });
    const frets = dots.map((d) => d.fret);
    positions.push({
      index: m + 1,
      name: MODE_NAMES[m],
      chordSuffix: MODE_CHORDS[m],
      rootPc: (rootPc + degreeRelative) % 12,
      start: Math.min(...frets),
      end: Math.max(...frets),
      dots,
    });
    degreeRelative = nextDegree(degreeRelative);
    startFret = findFret(5, startFret, degreeRelative);
  }
  return positions;
}
