// Diagrama do braço inteiro (horizontal), para o explorador de escalas.
// Mesma ordem de cordas das tablaturas do app (tab.js): e (mais fina) em cima, E (grave) embaixo.

import { STRING_NAMES } from './theory.js';

const FRET_W = 34;
const STRING_GAP = 24;
const LEFT = 34; // um pouco mais de espaço à esquerda, para caber o "×" de corda mutada
const TOP = 22;
const SINGLE_MARKERS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_MARKERS = new Set([12, 24]);

// muted: índices de corda que não tocam (marca um "×" antes do traste), para diagramas de acorde.
export function fretboardSVG({ fretStart = 0, fretEnd = 12, dots = [], muted = [] }) {
  const count = fretEnd - fretStart + 1;
  const width = LEFT + count * FRET_W + 12;
  const height = TOP + STRING_GAP * 5 + 22;
  const xOf = (fret) => LEFT + (fret - fretStart + 0.5) * FRET_W;
  const yOf = (string) => TOP + string * STRING_GAP;

  // width/height (não só viewBox): sem eles o SVG não tem tamanho intrínseco e some (fica 0×0).
  let svg = `<svg class="fret-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Braço da guitarra, casas ${fretStart} a ${fretEnd}">`;

  for (let f = fretStart; f <= fretEnd; f++) {
    svg += `<text class="fb-fretnum" x="${xOf(f)}" y="${TOP - 8}" text-anchor="middle">${f}</text>`;
    if (DOUBLE_MARKERS.has(f)) {
      svg += `<circle class="fb-marker" cx="${xOf(f)}" cy="${yOf(1.5)}" r="3"/><circle class="fb-marker" cx="${xOf(f)}" cy="${yOf(3.5)}" r="3"/>`;
    } else if (SINGLE_MARKERS.has(f)) {
      svg += `<circle class="fb-marker" cx="${xOf(f)}" cy="${yOf(2.5)}" r="3"/>`;
    }
  }
  for (let s = 0; s < 6; s++) {
    svg += `<line class="fb-string" x1="${LEFT}" y1="${yOf(s)}" x2="${LEFT + count * FRET_W}" y2="${yOf(s)}"/>`;
  }
  for (let f = fretStart; f <= fretEnd + 1; f++) {
    const nut = fretStart === 0 && f === 0;
    const x = LEFT + (f - fretStart) * FRET_W;
    svg += `<line class="fb-fret${nut ? ' fb-nut' : ''}" x1="${x}" y1="${yOf(0)}" x2="${x}" y2="${yOf(5)}"/>`;
  }
  STRING_NAMES.forEach((name, s) => {
    svg += `<text class="fb-stringname" x="${LEFT - 20}" y="${yOf(s) + 4}" text-anchor="middle">${name}</text>`;
  });
  muted.forEach((s) => {
    svg += `<text class="fb-mute" x="${LEFT - 8}" y="${yOf(s) + 4}" text-anchor="middle">×</text>`;
  });
  dots.forEach((dot) => {
    const x = xOf(dot.fret);
    const y = yOf(dot.string);
    // Nomes duplos (ex.: "4#/5b") não cabem numa linha só dentro do círculo — em vez de cortar
    // (virava "#/5", ilegível), quebramos em duas linhas menores e damos um pouco mais de raio.
    const parts = dot.name.split('/');
    const r = dot.root ? 10 : parts.length > 1 ? 11 : 9;
    svg += `<circle class="fb-dot${dot.root ? ' fb-root' : ''}" cx="${x}" cy="${y}" r="${r}"/>`;
    if (parts.length > 1) {
      svg += `<text class="fb-note fb-note-sm" x="${x}" y="${y - 1}" text-anchor="middle">${parts[0]}</text>`;
      svg += `<text class="fb-note fb-note-sm" x="${x}" y="${y + 8}" text-anchor="middle">${parts[1]}</text>`;
    } else {
      svg += `<text class="fb-note" x="${x}" y="${y + 4}" text-anchor="middle">${dot.name}</text>`;
    }
  });

  return svg + '</svg>';
}
