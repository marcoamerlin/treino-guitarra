// Sistema CAGED: 5 formas móveis (E A D C G) que, deslizadas pelo braço, tocam qualquer acorde
// em qualquer nota. Cada forma nasce de um acorde aberto bem conhecido (o nome da forma É esse
// acorde); os graus de cada corda foram conferidos por cálculo, não de cabeça — ver o comentário
// de cada forma. As variações (menor, 7, maj7, m7) vêm de abaixar 1 nota específica da forma maior,
// a mesma técnica usada nos acordes abertos de verdade (ex.: E → Em → E7 → Em7 só trocam 1 nota
// por vez — confira tocando).
//
// Convenção de cordas: a mesma de theory.js (0=e ... 5=E grave).

import { OPEN_PC } from './theory.js';

export const CHORD_TYPES = {
  major: { label: 'Maior', suffix: '' },
  minor: { label: 'Menor', suffix: 'm' },
  dom7: { label: '7', suffix: '7' },
  maj7: { label: 'maj7', suffix: 'maj7' },
  min7: { label: 'm7', suffix: 'm7' },
};

// fretOffset: casa de cada corda relativa à corda-âncora (âncora = 0; corda ausente = mutada).
// third: cordas com a 3ª maior (abaixa 1 casa para virar menor). seventh: corda com a oitava da
// raiz (abaixa 2 casas para o "7", 1 casa para o "maj7"; os dois juntos para o "m7").
export const CAGED_SHAPES = {
  // Nasce do E maior aberto (0,2,2,1,0,0): Em=(0,2,2,0,0,0), E7=(0,2,0,1,0,0), Em7=(0,2,0,0,0,0).
  E: { anchor: 5, fretOffset: { 5: 0, 4: 2, 3: 2, 2: 1, 1: 0, 0: 0 }, third: [2], seventh: 3 },
  // Nasce do A maior aberto (X,0,2,2,2,0): Am=(X,0,2,2,1,0), A7=(X,0,2,0,2,0), Am7=(X,0,2,0,1,0).
  A: { anchor: 4, fretOffset: { 4: 0, 3: 2, 2: 2, 1: 2, 0: 0 }, third: [1], seventh: 2 },
  // Nasce do D maior aberto (X,X,0,2,3,2): Dm=(...,3,1), D7=(...,1,2), Dm7=(...,1,1).
  D: { anchor: 3, fretOffset: { 3: 0, 2: 2, 1: 3, 0: 2 }, third: [0], seventh: 1 },
  // Nasce do C maior aberto (X,3,2,0,1,0). A 3ª aparece dobrada (corda D e corda e): as duas
  // abaixam juntas para virar menor.
  C: { anchor: 4, fretOffset: { 4: 0, 3: -1, 2: -3, 1: -2, 0: -3 }, third: [3, 0], seventh: 1 },
  // Nasce do G maior aberto (3,2,0,0,3,3).
  G: { anchor: 5, fretOffset: { 5: 0, 4: -1, 3: -3, 2: -3, 1: 0, 0: 0 }, third: [4], seventh: 2 },
};

// Casa de cada corda (índice → casa; corda ausente = mutada) para uma forma+tipo+raiz.
export function voicingFrets(shapeKey, typeKey, rootPc) {
  const shape = CAGED_SHAPES[shapeKey];
  const type = CHORD_TYPES[typeKey];
  if (!shape || !type) throw new Error(`forma ou tipo de acorde inválido: ${shapeKey} ${typeKey}`);
  const isMinor = typeKey === 'minor' || typeKey === 'min7';
  const sevenDelta = typeKey === 'dom7' || typeKey === 'min7' ? 2 : typeKey === 'maj7' ? 1 : 0;

  const anchorOpenPc = OPEN_PC[shape.anchor];
  let anchorFret = ((rootPc - anchorOpenPc) % 12 + 12) % 12;

  const compute = (base) => {
    const frets = {};
    Object.entries(shape.fretOffset).forEach(([str, offset]) => {
      const s = Number(str);
      let fret = base + offset;
      if (isMinor && shape.third.includes(s)) fret -= 1;
      if (sevenDelta && shape.seventh === s) fret -= sevenDelta;
      frets[s] = fret;
    });
    return frets;
  };

  let frets = compute(anchorFret);
  // Se alguma casa desse negativa, a forma não cabe aí para esta raiz+tipo: sobe uma oitava.
  while (Object.values(frets).some((f) => f < 0)) {
    anchorFret += 12;
    frets = compute(anchorFret);
  }
  return frets;
}

// As 6 cordas: fret (número) para quem toca, ou null para quem fica mutada.
export function voicingArray(shapeKey, typeKey, rootPc) {
  const frets = voicingFrets(shapeKey, typeKey, rootPc);
  return [0, 1, 2, 3, 4, 5].map((s) => (s in frets ? frets[s] : null));
}
