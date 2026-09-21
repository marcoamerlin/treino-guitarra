// Plano padrão de cada dia. O usuário pode personalizar no app (tempo, ordem,
// remover, trocar, adicionar); o plano personalizado fica guardado por dia.

export const WEEK = [
  {
    key: 'seg', label: 'SEG', name: 'Segunda-feira', weekday: 1,
    title: 'Alternate Picking',
    focus: 'Técnica: alternate picking em pentatônica de Lá menor, riff com palm mute e primeiro bend.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'pent1', min: 12 },
      { ex: 'pent3', min: 8 },
      { ex: 'riff1', min: 8 },
      { ex: 'riff2', min: 7 },
      { ex: 'apl_bend', min: 10 },
      { ex: 'ritmo_pm', min: 5 },
    ],
  },
  {
    key: 'ter', label: 'TER', name: 'Terça-feira', weekday: 2,
    title: 'Legato',
    focus: 'Técnica: hammer-on e pull-off, fluidez com menos esforço de palhetada.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'legato', min: 20 },
      { ex: 'legato_licks', min: 15 },
      { ex: 'apl_free', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'qua', label: 'QUA', name: 'Quarta-feira', weekday: 3,
    title: 'Bends & Vibrato',
    focus: 'Técnica: controle de afinação em bends e vibrato expressivo.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'bends', min: 20 },
      { ex: 'bend_phrases', min: 15 },
      { ex: 'apl_free', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'qui', label: 'QUI', name: 'Quinta-feira', weekday: 4,
    title: 'String Skipping',
    focus: 'Técnica: coordenação entre cordas não adjacentes.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'skipping', min: 20 },
      { ex: 'skip_licks', min: 15 },
      { ex: 'apl_free', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'sex', label: 'SEX', name: 'Sexta-feira', weekday: 5,
    title: 'Licks de Rock',
    focus: 'Técnica livre: o que estiver mais difícil na semana.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'free_tech', min: 20 },
      { ex: 'combo_licks', min: 15 },
      { ex: 'apl_free', min: 10 },
      { ex: 'ritmo_pm', min: 5 },
    ],
  },
  {
    key: 'sab', label: 'SÁB', name: 'Sábado', weekday: 6,
    title: 'Jam & Gravação',
    focus: 'Aplicar tudo sem pressão técnica e ouvir o resultado.',
    plan: [
      { ex: 'jam', min: 40 },
      { ex: 'rec', min: 20 },
    ],
  },
  {
    key: 'dom', label: 'DOM', name: 'Domingo', weekday: 0,
    title: 'Descanso',
    focus: 'Recuperação: importante para o ganho de velocidade.',
    plan: [{ ex: 'rest', min: 15 }],
  },
];
