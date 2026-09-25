// Banco de exercícios. Cada dia da semana é uma lista de exercícios daqui (ver plans.js).
//
// bpm: {start, goal, step?} — exercícios com metrônomo guardam a velocidade atual,
//      que continua de uma semana para a outra.
// draft: true — exercício ainda em resumo, a detalhar com tablatura e passo a passo.

import { buildTab } from '../tab.js';
import { chordCol } from './chords.js';
import { parseTab } from '../tab-dsl.js';
import { voicingArray } from '../chord-shapes.js';
import { fretboardNotes } from '../theory.js';
import { midiOf } from '../tab-player.js';

export const CATEGORIES = {
  aquecimento: 'Aquecimento',
  tecnica: 'Técnica',
  riff: 'Riffs',
  frase: 'Frases e licks',
  aplicacao: 'Aplicação',
  ritmo: 'Ritmo',
  jam: 'Jam e gravação',
  teoria: 'Teoria',
  descanso: 'Descanso',
};

const BACKING_TRACK = {
  label: 'Buscar backing track em Lá menor no YouTube',
  url: 'https://www.youtube.com/results?search_query=rock+backing+track+A+minor',
};

// ---- Tablaturas ----------------------------------------------------------

const alternate = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? '^' : 'v'));

// Uma tablatura: o texto para ler + os dados (cols) que o botão "Ouvir" toca.
const makeTab = (label, cols, layout, play) => ({ label, text: buildTab(cols, layout), play: { cols, ...play } });

// Tablatura escrita na notação curta de tab-dsl.js (ex.: 'e5h e8p e5'). Hammer-on/pull-off viram
// "5h8p5" no texto e tocam sem ataque de palheta.
const dslTab = (label, dsl, { perBeat = 2, voice = 'clean', pick = 'down', gain = 1 } = {}) => {
  const tab = parseTab(dsl, { pick });
  return makeTab(label, tab.cols, { pick: tab.pick, links: tab.links }, { perBeat, voice, soft: tab.soft, gain });
};

// Cromático 1-2-3-4 nas casas 5–8, corda a corda (Mi, Lá e Ré; repita nas outras).
const chromaCols = [5, 4, 3].flatMap((s) => [5, 6, 7, 8].map((fret) => [[s, fret]]));
const chromaTab = makeTab('Cordas Mi, Lá e Ré (repita nas outras três)', chromaCols,
  { pick: alternate(chromaCols.length) }, { perBeat: 1, voice: 'clean' });

// Pentatônica de Lá menor, caixa 1, de baixo para cima: [corda, casa].
const box1 = [
  [5, 5], [5, 8], [4, 5], [4, 7], [3, 5], [3, 7],
  [2, 5], [2, 7], [1, 5], [1, 8], [0, 5], [0, 8],
];
const box1UpTab = makeTab('Subindo', box1.map((n) => [n]),
  { pick: alternate(12) }, { perBeat: 2, voice: 'clean' });
const box1DownTab = makeTab('Descendo', [...box1].reverse().map((n) => [n]),
  { pick: alternate(12) }, { perBeat: 2, voice: 'clean' });

// Grupos de 3 notas: 1-2-3, 2-3-4, 3-4-5, 4-5-6 (cada grupo começa uma nota acima).
const groups3 = [0, 1, 2, 3].flatMap((i) => box1.slice(i, i + 3).map((n) => [n]));
const groups3Tab = makeTab('Quatro primeiros grupos (continue até o topo da caixa)', groups3,
  { pick: alternate(groups3.length) }, { perBeat: 2, voice: 'clean' });

// Pentatônica caixa 1 (mesmas casas de box1), pares descendo nota alta → baixa com pull-off,
// numa janela de 3 cordas que desliza 1 por vez: e-B-G, B-G-D, G-D-A, D-A-E — 4 janelas de 6
// notas. Conferido corda por corda com o usuário (vídeo de referência, exercício 2; ver
// CLAUDE.md): o pull-off cai exatamente na 1ª nota de cada janela — é o acento a cada 6 notas
// que o professor pede. Fecha com uma nota solta na Ré, casa 7.
const descPairs = [10, 8, 6, 4, 2, 0].map((i) => ({ string: box1[i][0], hi: box1[i + 1][1], lo: box1[i][1] }));
const STR6 = ['e', 'B', 'G', 'D', 'A', 'E'];
const pentSeqOcc = [0, 1, 2, 3].flatMap((start) => [0, 1, 2].map((k) => start + k));
const pentSeqDsl = pentSeqOcc.map((idx, pos) => {
  const p = descPairs[idx];
  const accent = pos % 3 === 0; // 1ª nota de cada janela de 3 cordas
  const name = STR6[p.string];
  return `${name}${p.hi}${accent ? 'p' : ''} ${name}${p.lo}`;
}).join(' ') + ' D7'; // fecha sozinha na Ré, casa 7
const pentSeqTab = dslTab('Janela de 3 cordas, deslizando 1 por vez — acento no pull-off', pentSeqDsl, { perBeat: 2 });

// Lick nas cordas Sol e Ré: célula de 8 notas (G D+3 G D+3 D+1 D D+1 D+3, "base" = casa da corda
// Sol), repetida 4 vezes (o "(2x)" do vídeo marca a célula de 16 — duas dessas 8 —, e o próprio
// vídeo toca esse bloco de 16 duas vezes), fechando sozinha na Sol, casa "base". Sem hammer/pull:
// só palhetada alternada. Mesmo desenho, só deslizando a mão — 3 posições (casas 1, 5 e 9),
// pedido do usuário depois de conferir a casa 9 (vídeo de referência; ver CLAUDE.md). 33 notas
// por posição (8×4 + 1).
const gdLickDsl = (base) => {
  const cell = `G${base} D${base + 3} G${base} D${base + 3} D${base + 1} D${base} D${base + 1} D${base + 3}`;
  return `${Array(4).fill(cell).join(' ')} G${base}`;
};
const gdLickTabs = [1, 5, 9].map((base) => dslTab(
  `Casa ${base}: célula de 8 notas, repetida 4 vezes, fechando na Sol`,
  gdLickDsl(base), { perBeat: 2, pick: 'alt' },
));

// Riff em Lá: colcheias de 4 tempos, palm mute. Dois compassos que se repetem.
const COUNT = ['1', 'e', '2', 'e', '3', 'e', '4', 'e'];
const riffChords = ['A5', 'A5', 'A5', 'A5', 'C5', 'C5', 'D5', 'D5', 'A5', 'A5', 'A5', 'A5', 'C5', 'C5', 'E5', 'E5'];
const riffCols = riffChords.map((id) => chordCol(id));
const riff1Tab = makeTab('2 compassos — repita', riffCols,
  { bar: 8, count: COUNT, pick: riffChords.map(() => 'v') }, { perBeat: 2, voice: 'muted', repeat: 2 });
const riff2Cols = riffCols.map((col, i) => (i % 8 === 3 ? null : col));
const riff2Tab = makeTab('2 compassos — repita', riff2Cols,
  { bar: 8, count: COUNT, pick: riff2Cols.map((c) => (c ? 'v' : ' ')) }, { perBeat: 2, voice: 'muted', repeat: 2 });

// Progressão descendo em power chords: A5 G5 F5 E5, um acorde por compasso.
const progCols = ['A5', 'G5', 'F5', 'E5'].flatMap((id) => Array.from({ length: 8 }, () => chordCol(id)));

// Frase de rock com bend na caixa 1.
const phraseCols = [[[0, 8]], [[0, 5]], [[1, 8]], [[1, 5]], [[2, '7b9r7']]];
const phraseTab = makeTab('Frase', phraseCols,
  { pick: ['v', '^', 'v', '^', 'v'] }, { perBeat: 2, voice: 'clean' });

// CAGED em Lá maior, na ordem em que as formas sobem o braço (calculado com voicingArray, a
// mesma função do explorador — nunca de cabeça: A fica aberta (casas 0–2), G em torno da casa
// 2–5, E em barra na 5ª, D na 7ª e C bem alto, na 9ª–12ª). Um compasso (4 tempos) por forma.
const CAGED_ORDER = ['A', 'G', 'E', 'D', 'C'];
const cagedCol = (shape) => voicingArray(shape, 'major', 9) // 9 = Lá
  .map((fret, string) => (fret == null ? null : [string, fret]))
  .filter(Boolean);
const cagedCols = CAGED_ORDER.flatMap((shape) => Array.from({ length: 4 }, () => cagedCol(shape)));
const cagedTab = makeTab(
  'As 5 formas em sequência, um compasso cada: A · G · E · D · C',
  cagedCols,
  { bar: 4, count: ['1', '2', '3', '4'], pick: alternate(cagedCols.length) },
  { perBeat: 1, voice: 'clean' },
);

// Sequência diatônica em grupos de 4 (Dó maior, 7ª posição, casas 7–10 — a única posição do
// vídeo-fonte conferida nota a nota com o usuário, casa por casa e corda por corda; ver
// CLAUDE.md). Gerada por cálculo a partir de fretboardNotes, nunca digitada à mão: pega as
// notas da posição em ordem de altura (grave → agudo) e desliza uma janela de 4 notas, uma
// nota por vez, terminando sozinha na tônica do topo.
const seq4Base = fretboardNotes(0, 'major', 7, 10) // Dó maior, casas 7–10
  .map((n) => ({ ...n, midi: midiOf(n.string, n.fret) }))
  .sort((a, b) => a.midi - b.midi)
  .slice(1); // tira o Si da casa 7 da Mi grave (abaixo da tônica); a sequência começa no Dó
const seq4Cols = [];
for (let i = 0; i <= seq4Base.length - 5; i++) {
  seq4Base.slice(i, i + 4).forEach((n) => seq4Cols.push([[n.string, n.fret]]));
}
seq4Cols.push([[seq4Base[seq4Base.length - 1].string, seq4Base[seq4Base.length - 1].fret]]);
const seq4Tab = makeTab('Grupos de 4, subindo (Dó maior, 7ª posição)', seq4Cols,
  { pick: alternate(seq4Cols.length) }, { perBeat: 2, voice: 'clean' });

// Cromático "em cascata": dedos 1-2-3-4 em cada corda, mas a casa inicial cai 1 a cada corda —
// exceto na virada Sol→Si, que fica igual (compensa a 3ª maior da afinação ali; sem essa exceção
// o padrão desalinha, o mesmo motivo do "salto" do CAGED e do 3nps). Sobe Mi grave→Mi aguda,
// desce Mi aguda→Mi grave uma casa acima da subida, fechando com uma nota extra na casa inicial
// (Mi grave, casa 5). Exercício 3 do mesmo vídeo de referência do seq4 — conferido corda por
// corda com o usuário (ver CLAUDE.md); só a repetição Sol=Si na descida foi extrapolada da
// subida (o usuário confirmou aquilo, isto aqui espelha), a confirmar quando o áudio for ouvido.
const cascadeUp = [
  [5, 5], [5, 6], [5, 7], [5, 8], // E
  [4, 4], [4, 5], [4, 6], [4, 7], // A
  [3, 3], [3, 4], [3, 5], [3, 6], // D
  [2, 2], [2, 3], [2, 4], [2, 5], // G
  [1, 2], [1, 3], [1, 4], [1, 5], // B
  [0, 1], [0, 2], [0, 3], [0, 4], // e
].map((n) => [n]);
const cascadeDown = [
  [0, 5], [0, 4], [0, 3], [0, 2], // e
  [1, 6], [1, 5], [1, 4], [1, 3], // B
  [2, 6], [2, 5], [2, 4], [2, 3], // G
  [3, 7], [3, 6], [3, 5], [3, 4], // D
  [4, 8], [4, 7], [4, 6], [4, 5], // A
  [5, 9], [5, 8], [5, 7], [5, 6], [5, 5], // E — nota extra, fecha na casa inicial
].map((n) => [n]);
const cascadeCols = [...cascadeUp, ...cascadeDown];
const cascadeTab = makeTab(
  'Sobe Mi grave → Mi aguda, desce uma casa acima e fecha na tônica',
  cascadeCols,
  { pick: alternate(cascadeCols.length) },
  { perBeat: 2, voice: 'clean' },
);

// ---- Exercícios ------------------------------------------------------------

export const EXERCISES = {
  chroma: {
    title: 'Cromático 1-2-3-4',
    subtitle: 'Casas 5–8, corda por corda',
    cat: 'aquecimento',
    min: 10,
    bpm: { start: 60, goal: 90 },
    tabs: [chromaTab],
    steps: [
      'Metrônomo em 60 BPM, <strong>uma nota por clique</strong>.',
      'Dedo 1 na casa 5, dedo 2 na 6, dedo 3 na 7, dedo 4 na 8 — um dedo por casa, sem mover a mão.',
      'Palhetada alternada estrita: para baixo, para cima. Cada corda nova recomeça para baixo.',
      'Suba da Mi grave até a Mi fina e volte descendo. Metade do tempo em 60 BPM, metade uns 10 BPM acima.',
    ],
    tips: [
      'O mindinho costuma soar mais fraco. Exija o mesmo volume dos outros dedos.',
      'Dedos perto das casas e sem levantar muito: mais economia, mais velocidade.',
    ],
  },

  pent1: {
    title: 'Pentatônica de Lá menor — caixa 1',
    subtitle: 'Alternate picking, casas 5–8',
    cat: 'tecnica',
    min: 12,
    bpm: { start: 70, goal: 120 },
    tabs: [box1UpTab, box1DownTab],
    steps: [
      'Mão na casa 5. Dedo 1 nas notas da casa 5, dedo 3 nas da casa 7 e dedo 4 nas da casa 8.',
      'Suba tocando <strong>2 notas por corda</strong>, da Mi grave à Mi fina, com palhetada alternada.',
      'Desça pelo caminho contrário. A primeira nota de cada corda é sempre para baixo.',
      'Um metrônomo por colcheias: 2 notas por clique.',
    ],
    tips: [
      'A palhetada sai do pulso, não do braço. Movimento pequeno: a palheta só precisa passar um pouco da corda.',
      'A nota Lá (a raiz) fica na casa 5 da Mi grave, na casa 7 da corda Ré e na casa 5 da Mi fina.',
    ],
  },

  pent3: {
    title: 'Grupos de 3 notas na caixa 1',
    subtitle: 'Quebra o padrão da palhetada',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 60, goal: 100 },
    tabs: [groups3Tab],
    steps: [
      'Mesma caixa, mas em <strong>grupos de 3 notas</strong>: 1-2-3, 2-3-4, 3-4-5... cada grupo começa uma nota acima do anterior.',
      'A palhetada continua alternada sem parar. Como o grupo tem 3 notas, o começo de cada grupo troca de direção — é isso que treina o controle.',
      'Comece uns 10 BPM abaixo do que você faz no exercício anterior.',
    ],
    tips: ['Se a mão direita embolar, pare, respire e volte 8 BPM. Limpeza vem antes de velocidade.'],
  },

  riff1: {
    title: 'Riff 1 — batida reta',
    subtitle: 'Palm mute em Lá: A5 C5 D5 E5',
    cat: 'riff',
    min: 8,
    bpm: { start: 70, goal: 110 },
    chords: ['A5', 'C5', 'D5', 'E5'],
    tabs: [riff1Tab],
    steps: [
      'Antes, aprenda os quatro acordes (toque nos botões de acorde, logo abaixo da tablatura, para ver o diagrama).',
      '<strong>Palm mute:</strong> apoie a lateral da mão direita perto do cavalete, encostando de leve nas cordas.',
      'Só palhetadas para baixo, colcheias contínuas. Conte “1 e 2 e 3 e 4 e”.',
      'Compasso 1: A5 ×4, C5 ×2, D5 ×2. Compasso 2: A5 ×4, C5 ×2, E5 ×2 (o E5 usa a Mi grave solta).',
    ],
    tips: ['Comece devagar até as trocas de acorde ficarem no tempo. Só então suba o BPM.'],
  },

  riff2: {
    title: 'Riff 2 — com pausa',
    subtitle: 'O mesmo riff, com uma colcheia em silêncio',
    cat: 'riff',
    min: 7,
    bpm: { start: 70, goal: 110 },
    chords: ['A5', 'C5', 'D5', 'E5'],
    tabs: [riff2Tab],
    steps: [
      'Igual ao Riff 1, mas a <strong>4ª colcheia</strong> de cada compasso (o “e” depois do 2) fica em silêncio.',
      'Aperte o palm mute ou simplesmente não palhete. O que importa é a pausa cair certinho no tempo.',
      'Só passe para este quando o Riff 1 estiver firme no metrônomo.',
    ],
    tips: ['A pausa é o que faz o riff “respirar”. Ouça o clique e deixe o silêncio no lugar dele.'],
  },

  apl_bend: {
    title: 'Frase com bend + backing track',
    subtitle: 'Caixa 1 e bend de 1 tom, sobre uma base em Lá menor',
    cat: 'aplicacao',
    min: 10,
    tabs: [phraseTab],
    links: [BACKING_TRACK],
    steps: [
      'Toque 8–5 na corda Mi fina e 8–5 na corda Si, com palhetada alternada.',
      'Na corda Sol, casa 7, faça o <strong>bend de 1 tom</strong> (a nota sobe até soar como a casa 9) e solte de volta.',
      'Bend: dedo 3 na corda, dedos 1 e 2 apoiando atrás na mesma corda, e empurre para cima girando o pulso.',
      'Toque a casa 9 da corda Sol para conferir a afinação do bend.',
      'Depois ponha uma base em Lá menor e improvise na caixa 1: pelo menos 1 bend por frase, com espaço entre as frases.',
    ],
    tips: ['Poucas notas, bem afinadas, valem mais do que muitas. O objetivo aqui é limpeza.'],
  },

  ritmo_pm: {
    title: 'Ritmo — palm mute',
    subtitle: 'Mão direita firme com o riff da segunda',
    cat: 'ritmo',
    min: 5,
    bpm: { start: 90, goal: 120 },
    chords: ['A5', 'C5', 'D5', 'E5'],
    tabs: [{ ...riff1Tab, label: 'Mesmo riff do Riff 1' }],
    steps: [
      'Use o riff como exercício rítmico: palm mute firme, sempre para baixo.',
      'Mão direita encostada perto do cavalete, para o som ficar pesado e curto.',
      'Metrônomo entre 90 e 110 BPM. Foque em soar sempre igual, sem variar a força.',
    ],
    tips: [],
  },

  // ---- Teoria: intervalos ---------------------------------------------------------------------

  interval_ea: {
    title: 'Intervalos — cordas Mi grave e Lá',
    subtitle: 'Reconhecer 4ª, 3ª maior, 3ª menor, 2ª maior e 2ª menor de ouvido',
    cat: 'teoria',
    min: 10,
    tabs: [dslTab(
      'Tônica (Lá) e cada intervalo, sempre voltando à tônica para comparar',
      'E5 A5 E5 A4 E5 A3 E5 A2 E5 A1 E5 A0', { perBeat: 2, voice: 'clean' },
    )],
    steps: [
      'Toque o Lá na corda Mi grave, casa 5, e deixe soar — essa é a <strong>tônica</strong> de hoje.',
      'Toque a mesma casa (5) na corda Lá, ao lado. É uma <strong>4ª justa</strong>. Volte para a tônica e compare de novo.',
      'Uma casa abaixo (4) na corda Lá é uma <strong>3ª maior</strong>. Depois, casa 3 é <strong>3ª menor</strong> — repare como a 3ª menor soa mais "triste" que a maior.',
      'Casa 2 é <strong>2ª maior</strong>, casa 1 é <strong>2ª menor</strong>, e a corda Lá solta (casa 0) é a <strong>mesma nota</strong> da tônica, uma oitava não muda — é o mesmo Lá.',
      'Regra prática nessas duas cordas: a <strong>mesma casa</strong> nas cordas vizinhas é sempre uma 4ª. Cada casa a menos na corda de cima tira 1 semitom do intervalo.',
      'Repita a sequência de trás para frente (da 2ª menor até a 4ª), sempre voltando à tônica antes de cada nota nova.',
    ],
    tips: [
      'Não precisa de metrônomo hoje: o objetivo é ouvir e reconhecer, não velocidade.',
      'Quando estiver seguro nessas duas cordas, use o explorador de "Intervalos" (botão Braço, no topo) para ver o mesmo padrão em qualquer nota, em qualquer casa do braço.',
    ],
  },

  // ---- Teoria: CAGED ---------------------------------------------------------------------------

  caged_seq: {
    title: 'CAGED — sequência de Lá maior',
    subtitle: 'As 5 formas do mesmo acorde, subindo o braço',
    cat: 'teoria',
    min: 10,
    bpm: { start: 50, goal: 90 },
    tabs: [cagedTab],
    steps: [
      'É o <strong>mesmo acorde de Lá maior</strong> tocado de 5 jeitos diferentes, cada um nascendo de um acorde aberto conhecido: A, G, E, D e C. Antes de tocar, abra <strong>Braço → Acordes</strong>, escolha raiz <strong>A</strong> e veja o diagrama de cada forma, uma de cada vez.',
      'Ordem subindo o braço: <strong>A</strong> (aberta, casas 0–2) → <strong>G</strong> (casas 2–5) → <strong>E</strong> (barra na 5ª casa) → <strong>D</strong> (7ª casa) → <strong>C</strong> (bem alto, 9ª–12ª casas).',
      'Toque cada forma por um <strong>compasso inteiro</strong> (4 tempos, uma palhetada por tempo) antes de deslizar para a próxima. Não solte a mão antes da hora: a troca acontece exatamente na virada do compasso.',
      'Repare nas notas que <strong>se repetem</strong> entre uma forma e a próxima (mesma corda, casa parecida) — é o ponto de conexão entre as duas, o motivo do sistema se chamar CAGED.',
      'Quando estiver limpo, repita descendo (C → D → E → G → A) e depois experimente outra raiz no explorador, para ver o mesmo padrão se repetir em qualquer nota.',
    ],
    tips: [
      'Se travar numa forma, pare só nela: toque A sozinha várias vezes até a mão decorar, depois só G, e assim por diante, antes de juntar a sequência inteira.',
      'A forma C fica bem no agudo do braço para o Lá — é normal parecer "esquisita" no começo; é a mesma lógica das outras quatro, só que numa oitava mais alta.',
    ],
  },

  // ---- Técnica: sequência diatônica -------------------------------------------------------------

  seq4: {
    title: 'Sequência em grupos de 4',
    subtitle: 'Escala de Dó maior, 7ª posição — sobe uma nota de cada vez',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 55, goal: 95 },
    tabs: [seq4Tab],
    steps: [
      'A ideia: toque <strong>4 notas seguidas</strong> da escala, depois repita o mesmo grupo de 4 começando <strong>uma nota acima</strong> da anterior — 1-2-3-4, depois 2-3-4-5, depois 3-4-5-6, e assim por diante, sempre subindo.',
      'Começa na corda <strong>Mi grave, casa 8</strong> (o Dó, tônica). A casa 7 dessa corda existe na posição mas não entra aqui — a sequência só começa na tônica.',
      'Em cada corda o desenho é sempre <strong>3 notas</strong>, com os dedos 1-2-4 (casas 7-8-10) ou 1-3-4 (casas 7-9-10) — confira no diagrama de cada corda antes de tocar.',
      'Palhetada alternada (para baixo, para cima) do início ao fim, sem pular nenhuma nota.',
      'Por enquanto é só essa posição (casas 7 a 10). Quando estiver limpo, dá pra repetir mais alto ou mais baixo no braço, movendo a mesma forma.',
    ],
    tips: [
      'A troca de corda é onde mais atrasa. Pratique bem devagar só as transições (ex.: só o final de uma corda + começo da próxima) antes de tentar a sequência inteira rápida.',
      'Se perder a conta de qual grupo está tocando, pare e volte para a tônica (Mi grave, casa 8) — é o ponto de referência mais fácil de achar de novo.',
    ],
  },

  cascade4: {
    title: 'Cromático em cascata',
    subtitle: 'Dedos 1-2-3-4 subindo o braço, corda por corda',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 55, goal: 95 },
    tabs: [cascadeTab],
    steps: [
      'Dedos <strong>1-2-3-4</strong>, uma casa por dedo, em cada corda — igual ao cromático de aquecimento, mas agora nas 6 cordas seguidas, e a casa inicial cai 1 a cada corda.',
      'Começa na corda <strong>Mi grave, casa 5</strong> (dedo 1). Depois Lá casa 4, Ré casa 3, Sol casa 2, Si casa 2 <strong>de novo</strong> (não cai — aqui a afinação da Si compensa), e Mi aguda casa 1.',
      'No topo (Mi aguda, casa 4), inverte: desce pelas mesmas 6 cordas na ordem contrária, mas uma casa <strong>acima</strong> de onde subiu em cada corda (Mi aguda 5-4-3-2, Si 6-5-4-3, Sol 6-5-4-3, Ré 7-6-5-4, Lá 8-7-6-5, Mi grave 9-8-7-6).',
      'Termina com uma nota extra na Mi grave, casa 5 — a mesma casa de onde começou, fechando o ciclo.',
      'Palhetada alternada do início ao fim.',
    ],
    tips: [
      'A virada Sol→Si (que não cai de casa) é onde mais gente erra de cabeça. Pratique essa transição isolada antes da sequência inteira.',
      'É praticamente o mesmo desenho da mão inteira, só deslizando 1 casa a cada corda — pense nisso como um só movimento contínuo, não 6 posições separadas.',
    ],
  },

  gd_lick: {
    title: 'Lick nas cordas Sol e Ré',
    subtitle: 'Só palhetada, sem hammer nem pull-off — em 3 posições',
    cat: 'tecnica',
    min: 10,
    bpm: { start: 55, goal: 95 },
    tabs: gdLickTabs,
    steps: [
      'Só duas cordas: <strong>Sol</strong> (uma casa fixa) e <strong>Ré</strong> (essa casa +3, +1, ela mesma, +1, +3). A célula é: Sol, Ré, Sol, e o desenho completo na Ré — 8 notas ao todo.',
      'Ao contrário dos outros exercícios de técnica, aqui é <strong>tudo palhetado</strong>, alternando para baixo e para cima — sem hammer-on nem pull-off.',
      'Repita a célula de 8 notas <strong>4 vezes seguidas</strong>, sem parar entre uma e outra, e termine com uma nota solta na Sol, fechando a frase.',
      'É o <strong>mesmo desenho</strong> nas 3 abas — só a mão desliza para outra casa. Pratique cada posição separada antes de tentar trocar de uma para outra.',
    ],
    tips: [
      'O salto Sol→Ré→Sol é pequeno (cordas vizinhas), mas repetido rápido cansa o pulso. Mantenha o movimento da mão pequeno e relaxado.',
      'Grave-se tocando: numa frase repetitiva como essa, é fácil acelerar sem perceber. Confira se as 4 repetições saem no mesmo tempo.',
    ],
  },

  // ---- Terça: legato ------------------------------------------------------------------------

  leg_1: {
    title: 'Legato — hammer-on e pull-off',
    subtitle: 'Três notas por corda com uma palhetada só',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Uma corda por vez: 5 → 8 → 5 (nas cordas Lá, Ré e Sol: 5 → 7 → 5)',
        'E5h E8p E5 A5h A7p A5 D5h D7p D5 G5h G7p G5 B5h B8p B5 e5h e8p e5', { perBeat: 2 }),
    ],
    steps: [
      'Legato é tocar notas com a mão esquerda, sem palhetar todas. <strong>Hammer-on (h):</strong> o dedo “bate” na casa com força e a nota soa sozinha. <strong>Pull-off (p):</strong> o dedo é puxado de lado, quase beliscando a corda, e a nota anterior soa.',
      'Em cada corda, <strong>palhete só a primeira nota</strong> (casa 5), martele na casa 7 ou 8 (h) e puxe de volta para a 5 (p). São 3 notas com uma palhetada.',
      'Dedo 1 na casa 5. Dedo 3 na casa 7 (cordas Lá, Ré e Sol) ou dedo 4 na casa 8 (cordas Mi grave, Si e Mi fina).',
      'As três notas têm que soar com o <strong>mesmo volume</strong>: o hammer-on e o pull-off não podem ficar mais fracos que a nota palhetada.',
    ],
    tips: [
      'O pull-off é a parte difícil: ao soltar o dedo, puxe-o levemente para o chão. É como palhetar a corda com o próprio dedo.',
      'Volume parelho vale mais que velocidade. Só suba o BPM quando as três notas soarem iguais.',
    ],
  },
  leg_run: {
    title: 'Legato — descida e subida na caixa 1',
    subtitle: 'Doze notas com apenas seis palhetadas',
    cat: 'tecnica',
    min: 7,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Descendo: palhete a nota de cima e puxe (p) para a de baixo',
        'e8p e5 B8p B5 G7p G5 D7p D5 A7p A5 E8p E5', { perBeat: 2 }),
      dslTab('Subindo: palhete a nota de baixo e martele (h) a de cima',
        'E5h E8 A5h A7 D5h D7 G5h G7 B5h B8 e5h e8', { perBeat: 2 }),
    ],
    steps: [
      'Mesma caixa 1 da pentatônica de Lá menor, agora ligando as duas notas de cada corda.',
      '<strong>Descendo:</strong> palhete a nota de cima (casa 8 ou 7) e faça pull-off para a casa 5. Repita corda por corda, da Mi fina até a Mi grave.',
      '<strong>Subindo:</strong> palhete a casa 5 e martele a casa 7 ou 8, da Mi grave até a Mi fina.',
      'A cada troca de corda, palhete de novo. O que muda a palhetada é só a mudança de corda.',
    ],
    tips: ['Abafe a corda que você acabou de tocar com a ponta do dedo para as notas não ficarem soando juntas.'],
  },
  leg_seq6: {
    title: 'Sequência com acento a cada 6',
    subtitle: 'Pentatônica caixa 1, descendo em janelas de 3 cordas',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 55, goal: 95 },
    tabs: [pentSeqTab],
    steps: [
      'Mesma caixa 1 da pentatônica de Lá menor, mas em vez de descer reto (como no exercício anterior), a descida usa uma <strong>janela de 3 cordas</strong> que desliza 1 corda por vez: Mi fina-Si-Sol, depois Si-Sol-Ré, depois Sol-Ré-Lá, depois Ré-Lá-Mi grave.',
      'Cada corda toca sempre o mesmo par: nota de cima <strong>puxando (p)</strong> para a de baixo. Como cada janela repete 2 das 3 cordas da anterior, várias cordas se repetem 2 ou 3 vezes seguidas antes de avançar.',
      'O <strong>acento</strong> cai sempre na 1ª nota de cada grupo de 6 (a primeira corda de cada janela nova) — nesta tablatura é justamente aí que a nota vem com pull-off, então acentue naturalmente ao puxar o dedo com mais força.',
      'Termina com uma nota solta na corda Ré, casa 7, fechando a frase.',
    ],
    tips: [
      'Se enrolar contando as janelas, pense em blocos de 6: toque 1 grupo de cada vez e pare, antes de emendar todos.',
      'O acento não é só mais forte — é a nota que "puxa" a atenção do ouvinte pro início de cada grupo. Exagere um pouco enquanto treina devagar.',
    ],
  },
  leg_trill: {
    title: 'Trinado 5–8 (força dos dedos)',
    subtitle: 'Alternar rápido entre duas notas na mesma corda',
    cat: 'tecnica',
    min: 5,
    bpm: { start: 50, goal: 90 },
    tabs: [
      dslTab('Corda Mi fina', 'e5h e8p e5h e8p e5h e8p e5h e8p e5', { perBeat: 4 }),
      dslTab('Corda Si', 'B5h B8p B5h B8p B5h B8p B5h B8p B5', { perBeat: 4 }),
    ],
    steps: [
      'Palhete só a primeira nota e depois alterne martelando e puxando: 5-8-5-8-5... sem palhetar de novo.',
      'Use o <strong>dedo 1</strong> na casa 5 e o <strong>mindinho (dedo 4)</strong> na casa 8. É um exercício de força para o mindinho.',
      'Metrônomo com <strong>4 notas por clique</strong> (semicolcheias). Comece devagar: o objetivo é cada nota soar limpa.',
      'Pare quando a mão esquerda cansar. Cinco minutos bastam, e dor é sinal para parar.',
    ],
    tips: ['A força vem dos dedos, não do polegar apertando o braço por trás. Dedos perto da casa e relaxados entre as notas.'],
  },
  leg_lick: {
    title: 'Lick de legato — cascata em Lá menor',
    subtitle: 'Trinados e pull-offs descendo até a nota raiz',
    cat: 'frase',
    min: 15,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Cascata: Si → Mi fina → Si, Sol, Ré, Lá → raiz',
        'B5h B8p B5h B8p B5 e5h e8p e5 B8p B5 G7p G5 D7p D5 A7p A5 E5', { perBeat: 4 }),
    ],
    steps: [
      'É uma descida em cascata que resolve na nota raiz (Lá, corda Mi grave). Aprenda em pedaços.',
      '<strong>1º pedaço:</strong> o trinado na corda Si (5-8-5-8-5). <strong>2º:</strong> o trinado curto na Mi fina (5-8-5).',
      '<strong>3º:</strong> a descida com pull-off nas cordas Si, Sol, Ré e Lá (8→5, 7→5, 7→5, 7→5). <strong>4º:</strong> a nota final, Lá na corda Mi grave (casa 5).',
      'Junte os pedaços devagar. O Lá final tem que cair certinho no tempo do metrônomo e ficar soando.',
    ],
    tips: ['Depois que estiver limpo, toque-o em loop, sem pausa, como um rolo de notas. Aí sim vale subir o BPM.'],
  },
  apl_legato: {
    title: 'Aplicação com backing track — fluidez',
    subtitle: 'Improviso em Lá menor com legato',
    cat: 'aplicacao',
    min: 10,
    tabs: [dslTab('Frase de partida (resolve no Lá da corda Ré)', 'e5h e8p e5h e8p e5 B8p B5 G7p G5 D7', { perBeat: 2 })],
    links: [BACKING_TRACK],
    steps: [
      'Ponha uma base em Lá menor e improvise na caixa 1, usando a frase de partida como ideia.',
      'Regra do dia: <strong>pelo menos um hammer-on ou pull-off por frase</strong>, tocando com menos ataques de palheta.',
      'Procure soar fluido, como uma frase cantada, com respiração entre elas.',
    ],
    tips: ['Legato bem feito soa “liso”. Se cada nota soar como uma batida separada, volte um passo no BPM.'],
  },

  // ---- Quarta: bends e vibrato --------------------------------------------------------------------

  bend_1: {
    title: 'Bend de 1 tom afinado',
    subtitle: 'Fazer o bend chegar exatamente na nota-alvo',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 50, goal: 80 },
    tabs: [
      dslTab('Corda Sol: nota-alvo (casa 9) e bend da casa 7 até ela', 'G9 G7b9 G9 G7b9 G9 G7b9', { perBeat: 1, gain: 6 }),
      dslTab('Corda Si: nota-alvo (casa 10) e bend da casa 8 até ela', 'B10 B8b10 B10 B8b10 B10 B8b10', { perBeat: 1, gain: 5 }),
    ],
    steps: [
      'Bend de <strong>um tom</strong> sobe a nota o equivalente a duas casas. Na corda Sol: casa 7 → soar como a casa 9.',
      'Toque primeiro a <strong>nota-alvo</strong> (casa 9), para o ouvido guardar a altura. Depois toque a casa 7 e faça o bend até soar igual.',
      'Dedo 3 na corda, com os dedos 1 e 2 apoiando atrás, na mesma corda. Empurre para cima girando o <strong>pulso</strong>, não só o dedo.',
      'Segure o bend na altura certa por um instante e solte. Repita na corda Si (casa 8 → 10).',
    ],
    tips: [
      'Bend desafinado é o erro mais comum. Se o bend ficou baixo, soa “triste e fraco”, e se passou, soa “forçado”. Ouça antes de mexer.',
      'Empurrar a corda para cima, em direção ao teto, protege a mão. Para as cordas mais agudas, pode puxar para baixo.',
    ],
  },
  bend_rel: {
    title: 'Bend e retorno (release)',
    subtitle: 'Subir a nota e voltar controlando a afinação',
    cat: 'tecnica',
    min: 6,
    bpm: { start: 50, goal: 80 },
    tabs: [
      dslTab('Corda Sol: 7 → 9 → 7', 'G7b9r7 G7b9r7 G7b9r7', { perBeat: 0.5, gain: 11 }),
      dslTab('Corda Si: 8 → 10 → 8', 'B8b10r8 B8b10r8 B8b10r8', { perBeat: 0.5, gain: 10 }),
    ],
    steps: [
      'Faça o bend de 1 tom, segure o alvo e <strong>volte devagar</strong> até a nota original, sem soltar a corda de vez.',
      'O retorno também tem que passar pela afinação: solte de forma controlada, como quem “devolve” a corda.',
      'Cada nota dura 2 tempos. Suba em 1 tempo e volte no outro.',
    ],
    tips: ['Se a corda “estala” ao voltar, você soltou rápido demais. O retorno lento é o que dá a cara de solo de guitarra.'],
  },
  vibrato: {
    title: 'Vibrato controlado',
    subtitle: 'Oscilar a nota com o pulso, não com o dedo',
    cat: 'tecnica',
    min: 6,
    bpm: { start: 50, goal: 80 },
    tabs: [dslTab('Notas longas com vibrato (2 tempos cada)', 'e8~ B8~ G7~ D7~', { perBeat: 0.5, gain: 7 })],
    steps: [
      'Vibrato é subir e descer a altura da nota rapidamente, várias vezes, sem sair muito da afinação.',
      'Sustente a nota com o dedo firme e gire o <strong>pulso</strong>, como quem gira uma maçaneta. O movimento vem do antebraço, não do dedo isolado.',
      'Faça duas oscilações por batida do metrônomo. Comece lento e regular; depois aumente o ritmo.',
      'Tem que soar <strong>parelho</strong>, com a mesma abertura em todas as oscilações.',
    ],
    tips: ['Vibrato muito largo desafina, e muito estreito some. Procure algo em torno de um quarto de tom para cada lado.'],
  },
  bend_lick: {
    title: 'Frases com bend e vibrato',
    subtitle: 'Duas frases curtas para aplicar a técnica',
    cat: 'frase',
    min: 15,
    bpm: { start: 60, goal: 90 },
    tabs: [
      dslTab('Frase 1 — lamento: sobe e termina com bend e vibrato', 'e5 B8 B8b10~', { perBeat: 1, gain: 5 }),
      dslTab('Frase 2 — pergunta e resposta: bend com retorno e vibrato na raiz', 'D7 G7b9r7 G5 D7~', { perBeat: 1, gain: 4 }),
    ],
    steps: [
      '<strong>Frase 1:</strong> toque o Lá (Mi fina, casa 5), o Sol (Si, casa 8) e depois a mesma nota Sol fazendo o bend de 1 tom, terminando com vibrato na nota alta.',
      '<strong>Frase 2:</strong> Lá (Ré, casa 7), bend com retorno na corda Sol (7 → 9 → 7), Dó (Sol, casa 5) e vibrato na nota final, o Lá da corda Ré.',
      'Cada frase termina numa nota longa e cantada. Deixe soar, sem correr para a próxima nota.',
      'Toque cada frase 5 vezes, do jeito mais musical que conseguir, antes de subir o BPM.',
    ],
    tips: ['Essas duas frases são a “espinha” de muitos solos de rock. Depois que soarem naturais, invente variações trocando as notas.'],
  },
  apl_expr: {
    title: 'Aplicação — expressividade',
    subtitle: 'Poucas notas, bem tocadas, sobre uma base',
    cat: 'aplicacao',
    min: 10,
    links: [BACKING_TRACK],
    steps: [
      'Base em Lá menor. Improvise usando <strong>só 3 ou 4 notas</strong> da caixa 1, mas com bends e vibratos caprichados.',
      'Cada frase deve ter uma nota longa (com vibrato ou bend) e um silêncio depois.',
      'Ouça se as notas “cantam” em cima da base. Expressão vale mais que quantidade de notas.',
    ],
    tips: ['Ao gravar isso no sábado, ouça se os bends chegam na afinação: é onde o ouvido mais percebe o erro.'],
  },

  // ---- Quinta: string skipping ---------------------------------------------------------------------

  skip_1: {
    title: 'Saltos de corda — subindo (pulando uma corda)',
    subtitle: 'Alternate picking com corda pulada no meio',
    cat: 'tecnica',
    min: 8,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Casas baixas', 'E5 D5 A5 G5 D5 B5 G5 e5', { perBeat: 2, pick: 'alt' }),
      dslTab('Casas altas', 'E8 D7 A7 G7 D7 B8 G7 e8', { perBeat: 2, pick: 'alt' }),
    ],
    steps: [
      'Toque pares de notas em cordas que <strong>não são vizinhas</strong>, pulando uma corda: Mi → Ré, Lá → Sol, Ré → Si, Sol → Mi fina.',
      'Palhetada alternada estrita (baixo, cima, baixo, cima), mesmo ao pular. A palheta precisa “passar por cima” da corda pulada sem tocá-la.',
      'Toque a versão com as casas baixas (caixa 1, casa 5) e depois a das casas altas (casas 7 e 8).',
    ],
    tips: [
      'A corda pulada não pode soar. Abafe-a com a lateral do dedo da mão esquerda.',
      'Olhe o movimento da palheta em câmera lenta: o erro típico é tocar sem querer a corda do meio.',
    ],
  },
  skip_2: {
    title: 'Saltos de corda — descendo',
    subtitle: 'O caminho inverso, pulando uma corda',
    cat: 'tecnica',
    min: 7,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Casas altas, descendo', 'e8 G7 B8 D7 G7 A7 D7 E8', { perBeat: 2, pick: 'alt' }),
      dslTab('Casas baixas, descendo', 'e5 G5 B5 D5 G5 A5 D5 E5', { perBeat: 2, pick: 'alt' }),
    ],
    steps: [
      'Mesmo padrão, agora descendo: Mi fina → Sol, Si → Ré, Sol → Lá, Ré → Mi grave, pulando uma corda a cada par.',
      'Descer costuma ser mais difícil que subir para muita gente. Comece 10 BPM abaixo do que fez no exercício anterior.',
      'Mantenha a palhetada alternada sem parar. Só a corda muda, o movimento da mão direita não.',
    ],
    tips: ['Se uma direção for muito pior que a outra, treine só ela por um minuto e volte ao exercício completo.'],
  },
  skip_3: {
    title: 'Saltos de corda — pulando duas cordas',
    subtitle: 'Intervalos maiores, controle maior',
    cat: 'tecnica',
    min: 5,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Subindo, pulando duas cordas', 'E5 G5 A5 B5 D5 e5', { perBeat: 2, pick: 'alt' }),
      dslTab('Descendo, pulando duas cordas', 'e8 D7 B8 A7 G7 E8', { perBeat: 2, pick: 'alt' }),
    ],
    steps: [
      'Agora o salto é maior: <strong>duas cordas puladas</strong> entre as notas (Mi → Sol, Lá → Si, Ré → Mi fina).',
      'A palheta percorre mais distância. Mantenha o movimento pequeno e preciso, e não deixe o pulso “pular” junto.',
      'Vá devagar: é o exercício mais exigente do dia para a mão direita.',
    ],
    tips: ['Ao acertar o salto, a nota tem que sair limpa, sem ruído de corda tocada por acidente.'],
  },
  skip_lick: {
    title: 'Lick com saltos de corda — “ping-pong”',
    subtitle: 'Vai e volta entre cordas, descendo até a raiz',
    cat: 'frase',
    min: 15,
    bpm: { start: 60, goal: 100 },
    tabs: [
      dslTab('Cada par se repete: parece uma “bolinha” pulando entre duas cordas',
        'e8 D7 e8 D7 B8 A7 B8 A7 G7 E8 G7 E8 E5', { perBeat: 2, pick: 'alt' }),
    ],
    steps: [
      'Cada par de notas se repete duas vezes, e o par seguinte desce uma corda: Mi fina/Ré, Si/Lá, Sol/Mi grave, e resolve na raiz (Lá, Mi grave, casa 5).',
      'Palhetada alternada estrita o tempo todo. Os saltos de corda são justamente o que treina a precisão.',
      'Aprenda um par por vez (só o par Mi fina/Ré, depois só o Si/Lá...), depois una tudo.',
      'Quando estiver limpo, use como riff: repita em loop sobre uma base em Lá menor.',
    ],
    tips: ['Esse tipo de “ping-pong” é comum em riffs de hard rock. Depois de dominar, experimente mudar as notas.'],
  },
  apl_skip: {
    title: 'Aplicação — saltos em frases',
    subtitle: 'Usar os saltos de corda de forma musical',
    cat: 'aplicacao',
    min: 10,
    links: [BACKING_TRACK],
    steps: [
      'Base em Lá menor. Improvise usando <strong>saltos de corda</strong> em frases curtas de 4 a 6 notas.',
      'Alterne uma frase com saltos e uma frase por notas vizinhas, para o salto ter destaque.',
      'Termine sempre numa nota do acorde (Lá, Dó ou Mi) para a frase “fechar”.',
    ],
    tips: ['O salto de corda dá um som “aberto” e mais moderno, bom para variar depois de frases de escala.'],
  },

  // ---- Sexta: licks de rock ------------------------------------------------------------------------

  free_tech: {
    title: 'Técnica livre — o que ficou mais difícil',
    subtitle: 'Volte ao exercício da semana que mais travou',
    cat: 'tecnica',
    min: 15,
    steps: [
      'Olhe a velocidade de cada exercício da semana (no cartão de cada um): escolha o que está <strong>mais distante da meta</strong>.',
      'Treine só esse exercício por 15 minutos, com o metrônomo, no BPM em que ele ainda sai limpo.',
      'Use a regra de sempre: 3 limpos seguidos sobem 4 BPM; 2 erros descem 4.',
    ],
    tips: ['O exercício que você menos quer repetir costuma ser o que mais precisa de você. É o mais rápido caminho para evoluir.'],
  },
  combo_lick1: {
    title: 'Lick combinado 1 — palhetada, legato e bend',
    subtitle: 'Três técnicas da semana numa frase só',
    cat: 'frase',
    min: 10,
    bpm: { start: 60, goal: 90 },
    tabs: [dslTab('Palhetada (Mi fina) + legato (Si) + bend (Sol) + resolução', 'e8 e5 B5h B8p B5 G7b9r7 D7', { perBeat: 2 })],
    steps: [
      '<strong>Palhetada alternada</strong> nas duas primeiras notas (Mi fina, casas 8 e 5).',
      '<strong>Legato</strong> na corda Si: 5 → 8 → 5 com uma palhetada só.',
      '<strong>Bend com retorno</strong> na corda Sol (7 → 9 → 7) e resolução na nota raiz, o Lá da corda Ré (casa 7).',
      'Cada técnica tem que soar limpa e nos mesmos moldes dos exercícios dos dias anteriores.',
    ],
    tips: ['Repare onde a frase “trava”: geralmente é na troca entre as técnicas. Treine só essa passagem.'],
  },
  combo_lick2: {
    title: 'Lick combinado 2 — saltos, bend e vibrato',
    subtitle: 'Palhetada precisa e nota final expressiva',
    cat: 'frase',
    min: 10,
    bpm: { start: 60, goal: 90 },
    tabs: [dslTab('Saltos entre cordas com vibrato nas notas de chegada', 'A7 e5 B8 e8~ G7 D7~', { perBeat: 2, pick: 'alt' })],
    steps: [
      'Salte entre cordas não vizinhas com palhetada alternada: Lá (corda Lá, casa 7) → Mi fina → Si → Mi fina de novo.',
      'Faça <strong>vibrato</strong> na nota alta da Mi fina (casa 8) e termine com vibrato na raiz, o Lá da corda Ré (casa 7).',
      'A frase é simples, então o objetivo é <strong>som</strong>: afinação, vibrato parelho e finais que “respiram”.',
    ],
    tips: ['Ouça a gravação no sábado e compare com esse lick: é um bom teste de expressividade.'],
  },
  apl_free: {
    title: 'Aplicação com backing track',
    subtitle: 'Improviso em Lá menor com a técnica do dia',
    cat: 'aplicacao',
    min: 10,
    links: [BACKING_TRACK],
    steps: [
      'Ponha uma base em Lá menor e improvise aplicando o que treinou na semana: legato, bends, vibrato e saltos.',
      'Escolha <strong>uma</strong> técnica por frase, sem tentar usar tudo de uma vez.',
      'Poucas notas, bem tocadas. Soar musical vale mais que mostrar velocidade.',
    ],
    tips: [],
  },

  // ---- Ritmo, sábado e domingo ---------------------------------------------------------------------

  ritmo_pw: {
    title: 'Ritmo — power chords descendo',
    subtitle: 'Progressão A5 · G5 · F5 · E5 com palm mute',
    cat: 'ritmo',
    min: 5,
    bpm: { start: 80, goal: 110 },
    chords: ['A5', 'G5', 'F5', 'E5'],
    tabs: [makeTab('4 compassos: um acorde por compasso', progCols,
      { bar: 8, count: COUNT, pick: progCols.map(() => 'v') }, { perBeat: 2, voice: 'muted' })],
    steps: [
      'Uma progressão clássica de rock, descendo: Lá → Sol → Fá → Mi. Um acorde por compasso, em colcheias com <strong>palm mute</strong>.',
      'Só palhetadas para baixo. Deslize a mão inteira de um acorde para o outro sem soltar as cordas.',
      'Foque em ficar sempre no tempo e soar igual do primeiro ao último acorde, sem variar a força.',
    ],
    tips: [],
  },
  jam: {
    title: 'Jam session livre',
    subtitle: 'Sem cobrança técnica, só música',
    cat: 'jam',
    min: 40,
    links: [
      BACKING_TRACK,
      { label: 'Buscar backing track de hard rock em Mi menor no YouTube', url: 'https://www.youtube.com/results?search_query=hard+rock+backing+track+E+minor' },
      { label: 'Buscar backing track de rock alternativo em Ré menor no YouTube', url: 'https://www.youtube.com/results?search_query=alternative+rock+backing+track+D+minor' },
    ],
    steps: [
      'Escolha <strong>2 ou 3 backing tracks</strong> de rock (use os links abaixo) e improvise à vontade, sem se cobrar técnica. É só música.',
      'Em cada base, dê um objetivo leve: 1) só a caixa 1; 2) só notas longas com bend e vibrato; 3) o que vier na cabeça.',
      'Se uma base for em outro tom (Mi menor, Ré menor), a mesma caixa da pentatônica funciona: é só mover a posição na braço.',
    ],
    tips: ['Se travar, volte a uma frase que você já domina e varie o ritmo dela. Improviso também é repetição com variação.'],
  },
  rec: {
    title: 'Gravação e escuta crítica',
    subtitle: 'Ouvir para evoluir',
    cat: 'jam',
    min: 20,
    steps: [
      'Grave <strong>2 a 3 minutos</strong> do que você tocou com o gravador do celular (pode ser o gravador de voz mesmo).',
      'Ouça de volta sem tocar junto, com atenção, de olhos fechados se ajudar.',
      'Anote <strong>1 coisa boa</strong> e <strong>1 coisa a melhorar</strong> nas notas do dia, aqui embaixo.',
      'Use a coisa a melhorar como foco da próxima semana.',
    ],
    tips: ['Ouvir a si mesmo costuma mostrar coisas que você não percebe tocando: afinação dos bends, tempo, notas abafadas.'],
  },
  rest: {
    title: 'Revisão leve (opcional)',
    subtitle: 'Descanso também é treino',
    cat: 'descanso',
    min: 15,
    steps: [
      'Se tiver vontade de tocar, toque por prazer: sem metrônomo, sem cobrança, e o que você quiser.',
      'Descanse as mãos. Ganho de velocidade acontece no descanso, não só no treino.',
      'Se quiser, ouça músicas de guitarra prestando atenção em uma coisa: o riff, o solo ou o timbre.',
    ],
    tips: [],
  },
};
