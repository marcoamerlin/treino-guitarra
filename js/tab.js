// Gera tablatura em texto monoespaçado sem risco de desalinhar colunas.
//
// cols: uma entrada por coluna (tempo). Cada coluna é uma lista de [corda, casa],
//       com corda 0 = e (fina) ... 5 = E (grave). Coluna vazia ou null = pausa.
// bar:  quantas colunas por compasso (insere a barra "|"); 0 = sem barras.
// pick: array com 'v' (para baixo) / '^' (para cima) por coluna, mostrado abaixo.
// count: padrão de contagem repetido acima das colunas (ex.: ['1','e','2','e']).

const STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];

export function buildTab(cols, { bar = 0, pick = null, count = null } = {}) {
  const rows = STRINGS.map((name) => name + '|-');
  let pickRow = '   ';
  let countRow = '   ';

  cols.forEach((col, i) => {
    const notes = col || [];
    const width = Math.max(1, ...notes.map(([, fret]) => String(fret).length));

    STRINGS.forEach((_, s) => {
      const hit = notes.find(([str]) => str === s);
      rows[s] += (hit ? String(hit[1]) : '').padEnd(width, '-') + '--';
    });
    pickRow += (pick && pick[i] ? pick[i] : ' ').padEnd(width + 2, ' ');
    countRow += (count ? count[i % count.length] : ' ').padEnd(width + 2, ' ');

    if (bar && (i + 1) % bar === 0 && i < cols.length - 1) {
      STRINGS.forEach((_, s) => { rows[s] += '|-'; });
      pickRow += '  ';
      countRow += '  ';
    }
  });

  const lines = [];
  if (count) lines.push(countRow.trimEnd());
  lines.push(...rows.map((row) => row + '|'));
  if (pick) lines.push(pickRow.trimEnd());
  return lines.join('\n');
}
