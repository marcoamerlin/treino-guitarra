// Banco de exercícios. Cada dia da semana é uma lista de exercícios daqui (ver plans.js).
//
// bpm: {start, goal, step?} — exercícios com metrônomo guardam a velocidade atual,
//      que continua de uma semana para a outra.
// draft: true — exercício ainda em resumo, a detalhar com tablatura e passo a passo.

import { buildTab } from '../tab.js';
import { chordCol } from './chords.js';

export const CATEGORIES = {
  aquecimento: 'Aquecimento',
  tecnica: 'Técnica',
  riff: 'Riffs',
  frase: 'Frases e licks',
  aplicacao: 'Aplicação',
  ritmo: 'Ritmo',
  jam: 'Jam e gravação',
  descanso: 'Descanso',
};

const BACKING_TRACK = {
  label: 'Buscar backing track em Lá menor no YouTube',
  url: 'https://www.youtube.com/results?search_query=rock+backing+track+A+minor',
};

// ---- Tablaturas ----------------------------------------------------------

const alternate = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? '^' : 'v'));

// Cromático 1-2-3-4 nas casas 5–8, corda a corda (Mi, Lá e Ré; repita nas outras).
const chromaCols = [5, 4, 3].flatMap((s) => [5, 6, 7, 8].map((fret) => [[s, fret]]));
const chromaTab = buildTab(chromaCols, { pick: alternate(chromaCols.length) });

// Pentatônica de Lá menor, caixa 1, de baixo para cima: [corda, casa].
const box1 = [
  [5, 5], [5, 8], [4, 5], [4, 7], [3, 5], [3, 7],
  [2, 5], [2, 7], [1, 5], [1, 8], [0, 5], [0, 8],
];
const box1Up = buildTab(box1.map((n) => [n]), { pick: alternate(12) });
const box1Down = buildTab([...box1].reverse().map((n) => [n]), { pick: alternate(12) });

// Grupos de 3 notas: 1-2-3, 2-3-4, 3-4-5, 4-5-6 (cada grupo começa uma nota acima).
const groups3 = [0, 1, 2, 3].flatMap((i) => box1.slice(i, i + 3).map((n) => [n]));
const groups3Tab = buildTab(groups3, { pick: alternate(groups3.length) });

// Riff em Lá: colcheias de 4 tempos, palm mute. Dois compassos que se repetem.
const COUNT = ['1', 'e', '2', 'e', '3', 'e', '4', 'e'];
const riffChords = ['A5', 'A5', 'A5', 'A5', 'C5', 'C5', 'D5', 'D5', 'A5', 'A5', 'A5', 'A5', 'C5', 'C5', 'E5', 'E5'];
const riff1Tab = buildTab(riffChords.map((id) => chordCol(id)), {
  bar: 8, count: COUNT, pick: riffChords.map(() => 'v'),
});
const riff2Cols = riffChords.map((id, i) => (i % 8 === 3 ? null : chordCol(id)));
const riff2Tab = buildTab(riff2Cols, {
  bar: 8, count: COUNT, pick: riff2Cols.map((c) => (c ? 'v' : ' ')),
});

// Frase de rock com bend na caixa 1.
const phraseCols = [[[0, 8]], [[0, 5]], [[1, 8]], [[1, 5]], [[2, '7b9r7']]];
const phraseTab = buildTab(phraseCols, { pick: ['v', '^', 'v', '^', 'v'] });

// ---- Exercícios ------------------------------------------------------------

export const EXERCISES = {
  chroma: {
    title: 'Cromático 1-2-3-4',
    subtitle: 'Casas 5–8, corda por corda',
    cat: 'aquecimento',
    min: 10,
    bpm: { start: 60, goal: 90 },
    tabs: [{ label: 'Cordas Mi, Lá e Ré (repita nas outras três)', text: chromaTab }],
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
    tabs: [
      { label: 'Subindo', text: box1Up },
      { label: 'Descendo', text: box1Down },
    ],
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
    tabs: [{ label: 'Quatro primeiros grupos (continue até o topo da caixa)', text: groups3Tab }],
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
    tabs: [{ label: '2 compassos — repita', text: riff1Tab }],
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
    tabs: [{ label: '2 compassos — repita', text: riff2Tab }],
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
    tabs: [{ label: 'Frase', text: phraseTab }],
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
    tabs: [{ label: 'Mesmo riff do Riff 1', text: riff1Tab }],
    steps: [
      'Use o riff como exercício rítmico: palm mute firme, sempre para baixo.',
      'Mão direita encostada perto do cavalete, para o som ficar pesado e curto.',
      'Metrônomo entre 90 e 110 BPM. Foque em soar sempre igual, sem variar a força.',
    ],
    tips: [],
  },

  // ---- A detalhar: terça a domingo ----

  legato: {
    title: 'Legato — hammer-on / pull-off',
    subtitle: 'Fluidez com menos palhetada',
    cat: 'tecnica',
    min: 20,
    draft: true,
    bpm: { start: 60, goal: 100 },
    steps: [
      'Sequências de 3–4 notas por corda usando só a mão esquerda: hammer-on subindo, pull-off descendo.',
      'Mesma posição da pentatônica de segunda.',
      'Mesma regra de BPM: 3 limpos seguidos sobem, 2 erros seguidos descem.',
    ],
  },
  legato_licks: {
    title: 'Licks de legato',
    subtitle: 'Frases fluidas em estilo rock',
    cat: 'frase',
    min: 15,
    draft: true,
    steps: ['A detalhar: licks de legato em rock, com tablatura e passo a passo.'],
  },
  bends: {
    title: 'Bends + vibrato controlado',
    subtitle: 'Afinação e expressão',
    cat: 'tecnica',
    min: 20,
    draft: true,
    bpm: { start: 50, goal: 80 },
    steps: [
      'Bends de 1 tom comparando sempre com a nota alvo tocada solta.',
      'Vibrato controlado por pulso, não pelo dedo.',
    ],
  },
  bend_phrases: {
    title: 'Frases com bend',
    subtitle: 'Bends em contexto de rock',
    cat: 'frase',
    min: 15,
    draft: true,
    steps: ['A detalhar: frases de bend em rock, com tablatura e passo a passo.'],
  },
  skipping: {
    title: 'String skipping',
    subtitle: 'Coordenação entre cordas não adjacentes',
    cat: 'tecnica',
    min: 20,
    draft: true,
    bpm: { start: 60, goal: 100 },
    steps: [
      'Padrões pulando uma corda por vez dentro da pentatônica.',
      'Mão direita com controle de silenciamento das cordas não tocadas.',
    ],
  },
  skip_licks: {
    title: 'Frases com salto de corda',
    subtitle: 'String skipping em contexto de rock',
    cat: 'frase',
    min: 15,
    draft: true,
    steps: ['A detalhar: licks de string skipping em rock, com tablatura e passo a passo.'],
  },
  free_tech: {
    title: 'Técnica livre',
    subtitle: 'O que ficou mais difícil na semana',
    cat: 'tecnica',
    min: 20,
    draft: true,
    steps: ['Volte ao exercício da semana que ficou mais travado e treine só ele hoje.'],
  },
  combo_licks: {
    title: 'Licks de rock combinados',
    subtitle: 'Bend + legato + picking numa frase só',
    cat: 'frase',
    min: 15,
    draft: true,
    steps: ['A detalhar: frases que juntam os elementos da semana.'],
  },
  apl_free: {
    title: 'Aplicação com backing track',
    subtitle: 'Improviso em Lá menor com a técnica do dia',
    cat: 'aplicacao',
    min: 10,
    draft: true,
    links: [BACKING_TRACK],
    steps: [
      'Ponha uma base em Lá menor e improvise aplicando a técnica que treinou hoje.',
      'Poucas notas, bem tocadas — soar musical vale mais que mostrar velocidade.',
    ],
  },
  ritmo_pw: {
    title: 'Ritmo — power chords',
    subtitle: 'Palhetada firme com progressão',
    cat: 'ritmo',
    min: 5,
    draft: true,
    bpm: { start: 80, goal: 110 },
    chords: ['A5', 'C5', 'D5', 'E5'],
    steps: ['Power chords em palhetada firme: o riff da segunda ou uma progressão nova.'],
  },
  jam: {
    title: 'Jam session livre',
    subtitle: 'Sem cobrança técnica',
    cat: 'jam',
    min: 40,
    draft: true,
    links: [BACKING_TRACK],
    steps: ['Escolha 2–3 backing tracks de rock e improvise à vontade. Só música.'],
  },
  rec: {
    title: 'Gravação e escuta crítica',
    subtitle: 'Ouvir para evoluir',
    cat: 'jam',
    min: 20,
    draft: true,
    steps: [
      'Grave um trecho de 2–3 minutos e ouça de volta.',
      'Anote 1 coisa boa e 1 coisa para melhorar.',
    ],
  },
  rest: {
    title: 'Revisão leve (opcional)',
    subtitle: 'Descanso também é treino',
    cat: 'descanso',
    min: 15,
    steps: ['Se quiser tocar: sem metrônomo, sem cobrança, só pelo prazer.'],
  },
};
