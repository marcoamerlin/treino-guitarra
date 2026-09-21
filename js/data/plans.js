// Plano padrão de cada dia. O usuário pode personalizar no app (tempo, ordem,
// remover, trocar, adicionar); o plano personalizado fica guardado por dia.
// Cada dia de treino soma 60 min.

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
      { ex: 'leg_1', min: 8 },
      { ex: 'leg_run', min: 7 },
      { ex: 'leg_trill', min: 5 },
      { ex: 'leg_lick', min: 15 },
      { ex: 'apl_legato', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'qua', label: 'QUA', name: 'Quarta-feira', weekday: 3,
    title: 'Bends & Vibrato',
    focus: 'Técnica: controle de afinação em bends e vibrato expressivo.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'bend_1', min: 8 },
      { ex: 'bend_rel', min: 6 },
      { ex: 'vibrato', min: 6 },
      { ex: 'bend_lick', min: 15 },
      { ex: 'apl_expr', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'qui', label: 'QUI', name: 'Quinta-feira', weekday: 4,
    title: 'String Skipping',
    focus: 'Técnica: coordenação entre cordas não adjacentes.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'skip_1', min: 8 },
      { ex: 'skip_2', min: 7 },
      { ex: 'skip_3', min: 5 },
      { ex: 'skip_lick', min: 15 },
      { ex: 'apl_skip', min: 10 },
      { ex: 'ritmo_pw', min: 5 },
    ],
  },
  {
    key: 'sex', label: 'SEX', name: 'Sexta-feira', weekday: 5,
    title: 'Licks de Rock',
    focus: 'Técnica livre e frases que juntam o que foi treinado na semana.',
    plan: [
      { ex: 'chroma', min: 10 },
      { ex: 'free_tech', min: 15 },
      { ex: 'combo_lick1', min: 10 },
      { ex: 'combo_lick2', min: 10 },
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
