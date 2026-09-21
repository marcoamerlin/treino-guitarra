// Diagrama de acorde em SVG. frets: [E, A, D, G, B, e]; null = não tocar, 0 = solta.
// As cores vêm de classes CSS (.chord-svg ...) para acompanhar o tema.

const ROWS = 4;
const GAP = 22;
const ROW_H = 28;
const LEFT = 30;
const TOP = 34;
const NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export function chordSVG(chord) {
  const { frets, fingers = [] } = chord;
  const played = frets.filter((f) => f > 0);
  const maxFret = played.length ? Math.max(...played) : 0;
  const base = maxFret <= ROWS ? 1 : Math.min(...played);

  const gridW = GAP * 5;
  const width = LEFT + gridW + 34;
  const height = TOP + ROW_H * ROWS + 22;
  const xOf = (i) => LEFT + i * GAP;

  let svg = `<svg class="chord-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diagrama do acorde ${chord.name}">`;

  for (let r = 0; r <= ROWS; r++) {
    const y = TOP + r * ROW_H;
    const nut = r === 0 && base === 1;
    svg += `<line class="cd-line${nut ? ' cd-nut' : ''}" x1="${LEFT}" y1="${y}" x2="${LEFT + gridW}" y2="${y}"/>`;
  }
  for (let i = 0; i < 6; i++) {
    svg += `<line class="cd-line" x1="${xOf(i)}" y1="${TOP}" x2="${xOf(i)}" y2="${TOP + ROW_H * ROWS}"/>`;
  }

  frets.forEach((fret, i) => {
    const x = xOf(i);
    if (fret == null) {
      svg += `<text class="cd-mark" x="${x}" y="${TOP - 10}" text-anchor="middle">×</text>`;
    } else if (fret === 0) {
      svg += `<circle class="cd-open" cx="${x}" cy="${TOP - 14}" r="5"/>`;
    } else {
      const cy = TOP + (fret - base) * ROW_H + ROW_H / 2;
      svg += `<circle class="cd-dot" cx="${x}" cy="${cy}" r="10"/>`;
      if (fingers[i]) {
        svg += `<text class="cd-finger" x="${x}" y="${cy + 4.5}" text-anchor="middle">${fingers[i]}</text>`;
      }
    }
  });

  if (base > 1) {
    svg += `<text class="cd-base" x="${LEFT + gridW + 10}" y="${TOP + ROW_H / 2 + 4}">${base}ª</text>`;
  }
  NAMES.forEach((name, i) => {
    svg += `<text class="cd-string" x="${xOf(i)}" y="${TOP + ROW_H * ROWS + 16}" text-anchor="middle">${name}</text>`;
  });

  return svg + '</svg>';
}
