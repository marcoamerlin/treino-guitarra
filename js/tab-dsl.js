// Notação curta para escrever tablaturas de notas soltas (uma nota por coluna).
//
//   token  = <corda><casa><técnica?><ligação?>       tokens separados por espaço
//   corda  = e B G D A E  (e = mais fina, E = mais grave)
//   casa   = 7 | 7~ (vibrato) | 7b9 (bend de 7 até 9) | 7b9r7 (bend e solta) | 7b9~ (bend e vibrato)
//   ligação: h = hammer-on para a próxima nota, p = pull-off para a próxima nota
//   '-'    = pausa
//
//   "e5h e8p e5 B8"  →  corda e: casa 5, martela até 8, puxa de volta a 5; depois corda B, casa 8.
//
// pick: 'down' = toda nota palhetada é para baixo; 'alt' = alterna baixo/cima.
// Notas alcançadas por hammer-on ou pull-off não levam palhetada (e soam mais suaves ao tocar).

const STRING_INDEX = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
const TOKEN = /^([eBGDAE])(\d+(?:b\d+(?:r\d+)?)?~?)([hp])?$/;

export function parseTab(dsl, { pick = 'down' } = {}) {
  const cols = [];
  const links = [];
  const marks = [];
  let picked = 0;
  let previousLinked = false;

  dsl.trim().split(/\s+/).forEach((token) => {
    if (token === '-') {
      cols.push(null);
      links.push(null);
      marks.push(' ');
      previousLinked = false;
      return;
    }
    const match = TOKEN.exec(token);
    if (!match) throw new Error(`Nota inválida na tablatura: "${token}"`);
    const [, string, fret, link] = match;
    cols.push([[STRING_INDEX[string], /^\d+$/.test(fret) ? Number(fret) : fret]]);
    links.push(link || null);
    if (previousLinked) marks.push(' ');
    else marks.push(pick === 'alt' ? (picked++ % 2 ? '^' : 'v') : 'v');
    previousLinked = Boolean(link);
  });

  // Nota que vem de um hammer-on/pull-off: sem palhetada, toca mais suave.
  const soft = links.map((_, i) => i > 0 && Boolean(links[i - 1]));
  return { cols, links, pick: marks, soft };
}
