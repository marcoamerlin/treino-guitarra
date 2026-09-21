// Banco de acordes. frets: [E, A, D, G, B, e] (da corda grave para a fina);
// null = não tocar a corda, 0 = corda solta. fingers: 1 = indicador ... 4 = mindinho.

export const CHORDS = {
  A5: {
    name: 'A5',
    subtitle: 'Lá — power chord na corda A',
    frets: [null, 0, 2, 2, null, null],
    fingers: [0, 0, 1, 2, 0, 0],
    steps: [
      'Toque só três cordas: <strong>A</strong> (solta), <strong>D</strong> e <strong>G</strong>.',
      'Dedo 1 na corda D, casa 2. Dedo 2 na corda G, casa 2.',
      'Comece a palhetada pela corda A e deixe a Mi grave de fora.',
    ],
    tip: 'A corda A solta é a raiz do acorde (a nota Lá).',
  },
  C5: {
    name: 'C5',
    subtitle: 'Dó — power chord na corda A',
    frets: [null, 3, 5, 5, null, null],
    fingers: [0, 1, 3, 4, 0, 0],
    steps: [
      'Dedo 1 na corda A, casa 3 (a raiz, Dó).',
      'Dedo 3 na corda D, casa 5. Dedo 4 na corda G, casa 5.',
      'Palhete só as três cordas (A, D, G). A Mi grave não toca.',
    ],
    tip: 'É a forma móvel do power chord: o mesmo desenho do D5, duas casas abaixo.',
  },
  D5: {
    name: 'D5',
    subtitle: 'Ré — power chord na corda A',
    frets: [null, 5, 7, 7, null, null],
    fingers: [0, 1, 3, 4, 0, 0],
    steps: [
      'Dedo 1 na corda A, casa 5 (a raiz, Ré).',
      'Dedo 3 na corda D, casa 7. Dedo 4 na corda G, casa 7.',
      'Palhete só as três cordas (A, D, G).',
    ],
    tip: 'Mesmo desenho do C5, duas casas acima. Deslize a mão inteira entre os dois sem soltar.',
  },
  E5: {
    name: 'E5',
    subtitle: 'Mi — power chord na corda E grave',
    frets: [0, 2, 2, null, null, null],
    fingers: [0, 1, 2, 0, 0, 0],
    steps: [
      'Corda Mi grave <strong>solta</strong> (a raiz, Mi).',
      'Dedo 1 na corda A, casa 2. Dedo 2 na corda D, casa 2.',
      'Palhete as três cordas graves (E, A, D).',
    ],
    tip: 'Diferente dos outros: aqui a raiz é a corda Mi grave, então toque uma corda abaixo.',
  },
  G5: {
    name: 'G5',
    subtitle: 'Sol — power chord na corda E grave',
    frets: [3, 5, 5, null, null, null],
    fingers: [1, 3, 4, 0, 0, 0],
    steps: [
      'Dedo 1 na corda Mi grave, casa 3 (a raiz, Sol).',
      'Dedo 3 na corda Lá, casa 5. Dedo 4 na corda Ré, casa 5.',
      'Palhete as três cordas graves (E, A, D). As outras ficam de fora.',
    ],
    tip: 'Forma móvel com a raiz na corda Mi grave: o mesmo desenho do F5 (duas casas abaixo) e do A5 (duas acima).',
  },
  F5: {
    name: 'F5',
    subtitle: 'Fá — power chord na corda E grave',
    frets: [1, 3, 3, null, null, null],
    fingers: [1, 3, 4, 0, 0, 0],
    steps: [
      'Dedo 1 na corda Mi grave, casa 1 (a raiz, Fá).',
      'Dedo 3 na corda Lá, casa 3. Dedo 4 na corda Ré, casa 3.',
      'Palhete as três cordas graves (E, A, D).',
    ],
    tip: 'Mesmo desenho do G5, duas casas abaixo. Deslize a mão inteira sem soltar as cordas.',
  },
};

// Converte um acorde em uma coluna de tablatura (ver tab.js).
export function chordCol(id) {
  return CHORDS[id].frets
    .map((fret, i) => (fret == null ? null : [5 - i, fret]))
    .filter(Boolean);
}
