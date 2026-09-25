# Treino de Guitarra

PWA de treino diário de guitarra (rock, técnica: velocidade e limpeza). Uso principal no celular,
também no notebook. Estética de painel de amplificador (fundo escuro, LCD âmbar, switches).
Interface e conteúdo em português do Brasil. Briefing original em `docs/briefing.md`.

## Rodar

```
npm start      # node tools/serve.mjs → http://localhost:5173 (sem build, JS puro em módulos ES)
npm test       # testes de merge, sync, tablaturas, acordes e planos (Node, sem dependências)
```

Regenerar ícones: `powershell -File tools/make-icons.ps1`.
Publicação (GitHub Pages) e Supabase: `docs/setup.md`.

## Estrutura

- `js/data/exercises.js`: banco de exercícios (tablaturas, passos, BPM). Editar aqui para criar conteúdo.
- `js/data/chords.js`: banco de acordes (diagrama SVG gerado a partir de `frets`/`fingers`).
- `js/data/plans.js`: plano padrão de cada dia (lista de `{ex, min}` referindo ids do banco).
- `js/tab-dsl.js`: notação curta de tablatura (`'e5h e8p e5 G7b9r7 B8~'`: h/p = hammer-on/pull-off, b = bend, r = retorno,
  ~ = vibrato). Em `exercises.js`, `dslTab()` a usa; nota ligada toca suave, sem ataque de palheta.
- `js/tab.js`: `buildTab()` gera a tablatura; **nunca escrever tablatura à mão** (desalinha).
  Em `exercises.js`, `makeTab()` guarda o texto e as notas (`play`); o botão "Ouvir" toca essas notas via
  `js/tab-player.js`. Som: gravações reais de guitarra em `audio/guitar-<timbre>/<nota MIDI>.mp3` (Mi2 a Mi5,
  FluidR3_GM, CC BY 3.0, ver `audio/CREDITS.md`; gerar com `tools/extract-samples.mjs`); se uma nota falhar,
  cai no sintetizador Karplus-Strong. Fret `'7b9r7'` = bend de 7 até 9 e solta.
- `js/store.js`: única porta de persistência (localStorage). Todo registro sincronizado leva carimbo de tempo.
- `js/merge.js`: combina dados de dois aparelhos (funções puras). `js/sync-core.js`: motor de sync com
  o Supabase (tabela `user_data`, 1 linha por usuário, controle otimista por `rev`); `js/sync.js` liga
  o motor ao navegador; `js/config.js` guarda URL e chave pública. Esquema do banco: `supabase/schema.sql`.
- `js/voice-command.js`: comando de voz para marcar Limpo/Errei sem largar a guitarra (pedido de
  usuário real, 2026-09-24). Usa a Web Speech API do navegador — precisa de internet (roda na nuvem
  do Google) e pode disputar com o som do amplificador. parseCommand() é pura/testável; o resto só
  roda no navegador de verdade (não dá para testar reconhecimento de fala no CI). Opt-in por
  exercício, só um ativo por vez, como o metrônomo.
- `js/audio-context.js`: AudioContext resistente a travas (Android às vezes prende o canal de áudio numa
  troca de saída — cabo/fone/Bluetooth — ou após tempo em segundo plano, sem erro, só silêncio; visto
  na prática em 2026-09-23). `ensureRunningContext()` confere o estado antes de cada som e recria o
  canal se preciso, com tempo limite de 800ms para não travar caso `resume()` nunca responda. Usado
  por metronome.js e tab-player.js — qualquer novo produtor de som deve passar por ele também.
- `js/metronome.js`: metrônomo Web Audio com agendamento antecipado.
- `js/theory.js`: também tem INTERVAL_NAMES/intervalName/fretboardIntervals (aba "Intervalos" do
  explorador: intervalo de cada casa em relação a uma raiz, sem filtrar por escala). Cross-checado
  célula a célula (72 posições) contra um quadro de intervalos real do usuário — ver
  tests/theory.test.mjs. Um bug real: o array tinha 13 nomes para 12 semitons (5# e 6- em posições
  separadas, quando são o mesmo intervalo de 8 semitons); corrigido para "5#/6-" numa posição só.
  Números compostos (9/11/13) não são gerados: no material original a escolha entre básico e
  composto não seguia uma regra (a mesma distância aparecia das duas formas em células diferentes).
  interval_ea em exercises.js (categoria "Teoria") é um exercício de reconhecimento de intervalo
  usando esse mesmo cálculo.
- Quadro de intervalos (app.js `intervalExplorerView` + `fretboard.js`): mostra só as casas 1–12
  (sem corda solta/casa 0) — é um "quadro móvel", a casa 0 é uma âncora fixa que atrapalha a ideia
  de padrão que desliza pelo braço (pedido do usuário em 2026-09-23). A tônica aparece como "T" em
  verde (`--led-green`, a mesma cor de "ativo/concluído" no resto do app) em vez de "1" em
  `--brass`, que era próximo demais do dourado dos outros pontos (`--lcd-text`) para diferenciar
  de longe — a troca é só de exibição, feita em app.js; `theory.js` continua devolvendo "1" (os
  testes de fretboardIntervals checam esse nome). Nomes duplos ("4#/5b", "5#/6-") não cabem numa
  linha só dentro do círculo e ficavam cortados (ex.: "#/5b" virava ilegível); `fretboardSVG` agora
  detecta o "/" e desenha em duas linhas menores, com o círculo um pouco maior nesses casos.
- `seq4` em exercises.js (categoria Técnica): sequência diatônica em grupos de 4 (1-2-3-4, 2-3-4-5...),
  Dó maior, 7ª posição (casas 7–10) — exercício 1 de um vídeo de referência do usuário (Cordas e
  Música/Carlos Lisboa, "10 exercícios fundamentais de guitarra"). A tablatura do vídeo (frames de
  YouTube) era ilegível demais pra transcrever com segurança (compressão embaralha 7/9 e 8/10); o
  usuário ditou a sequência nota a nota assistindo, e ela foi conferida por cálculo antes de entrar
  no banco — gerada a partir de `fretboardNotes(0, 'major', 7, 10)` ordenada por altura (`midiOf`),
  tirando o Si abaixo da tônica e deslizando uma janela de 4 notas. Bate 100% com o ditado do
  usuário (teste em tabs.test.mjs). Só essa posição por enquanto — as outras 3 que o vídeo só cita
  de boca (não mostra a tablatura) ficam pendentes.
- `cascade4` em exercises.js: exercício 3 do mesmo vídeo — cromático "em cascata" (dedos 1-2-3-4,
  casa inicial cai 1 a cada corda, exceto na virada Sol→Si que fica igual, compensando a 3ª maior
  da afinação ali) subindo Mi grave→Mi aguda e descendo uma casa acima, fechando com nota extra na
  casa inicial. Conferido corda por corda com o usuário; a repetição Sol=Si na volta (descida) foi
  extrapolada por simetria da subida (que o usuário confirmou), não checada nota a nota como o
  resto — sinalizado no código, a confirmar quando o usuário ouvir.
- `leg_seq6` em exercises.js: exercício 2 de um segundo vídeo de referência (pentatônica de Lá
  menor, caixa 1). Desce em pares (nota alta puxando pra baixa) numa janela de 3 cordas que
  desliza 1 por vez (e-B-G, B-G-D, G-D-A, D-A-E — 4 janelas de 6 notas), gerado a partir do
  próprio `box1` já usado noutros exercícios (não duplica os números). Conferido corda por corda
  com o usuário, inclusive a ordem exata (que não é "agrupada por corda" como pareceu à primeira
  vista — é intercalada, uma corda de cada janela por vez). Achado por conferência: o pull-off
  cai sempre na 1ª nota de cada grupo de 6, que é exatamente o acento que o usuário descreveu do
  vídeo — validado por teste (regra `pos % 3 === 0`), não é coincidência de dado solto.
- `gd_lick` em exercises.js: lick só nas cordas Sol e Ré (célula de 8 notas: Sol, Ré+3, Sol, Ré+3,
  Ré+1, Ré, Ré+1, Ré+3 — "+N" relativo à casa da corda Sol —, repetida 4 vezes, fechando sozinho
  na Sol). Só palhetada alternada, sem hammer/pull. Conferido com o usuário (vídeo de referência;
  ver CLAUDE.md); usa a nota Si (2º grau), que não existe na pentatônica dos exercícios
  anteriores — por isso provavelmente é A eólio (menor natural completo), não pentatônica, dado o
  contexto da semana em Lá menor. `gdLickDsl(base)` gera o desenho pra qualquer casa; o exercício
  traz 3 posições (casas 1, 5 e 9) como abas — mesmo desenho, só desliza a mão, a pedido do
  usuário depois de conferir a casa 9.
- `js/theory.js` + `js/fretboard.js` + `js/chord-shapes.js`: explorador de escalas e acordes (botão
  "Braço" no cabeçalho, tela cheia, com abas Escalas/Acordes).
  Raiz (12 notas) + escala (maior/menor/pentatônica maior/menor) + posição. Pentatônicas ganham as
  5 posições clássicas (positionsOf, casas conectadas: fim de uma = início da próxima); escalas de
  7 notas só mostram o braço inteiro (janela entre graus fica curta demais para virar posição). Uma
  posição de cada vez, não as 5 sobrepostas: paleta categórica para 5+ grupos não passou no
  validador do skill dataviz para pontos que podem ficar lado a lado (mesmo motivo de referências
  do mercado mostrarem uma caixa por vez). Raiz destacada por anel, não por cor (funciona para
  qualquer visão). SVG do braço precisa de width/height além do viewBox, senão fica 0×0.
  Acordes: sistema CAGED, 5 formas móveis (E A D C G), cada uma nasce de um acorde aberto real
  (comentado em chord-shapes.js); menor/7/maj7/m7 vêm de abaixar 1 nota específica da forma maior
  — a mesma técnica dos acordes abertos de verdade. Nunca calcular grau de acorde de cabeça: usar
  tools/derive-chord-shapes.mjs para conferir por computador.
- `js/practice-timer.js`: cronômetro por exercício (quanto falta dos minutos reservados). Só um roda por vez;
  guarda por timestamp (funciona em segundo plano/tela bloqueada); reinicia a cada dia; não sincroniza (é
  controle da sessão, não histórico). Injeta storage/now() como o sync-core, para testar fora do navegador.
- `js/app.js`: interface. `sw.js` + `manifest.webmanifest`: PWA offline.

## Regras do domínio

- Cada dia soma ~60 min. O usuário personaliza os dias (tempo, ordem, remover, trocar, adicionar).
- A velocidade (BPM) é **por exercício**, não por dia, e continua de uma semana para a outra.
  Regra: 3 limpos seguidos = +4 BPM; 2 erros seguidos = −4 BPM.
- Todos os dias estão detalhados. `draft: true` marca um exercício ainda em resumo (hoje nenhum). Volume por tablatura: `gain` (só para os lentos).
  Nas notas sustentadas (bend/vibrato) o `sample.norm` calibra só o ataque, mas essas notas ficam
  presas a ~0,92s pelo corte `cutAt`/`cutShort` (a próxima nota na mesma corda), então o decaimento
  natural da gravação domina a média e o som sai baixo mesmo com o mesmo `gain` de outros exercícios
  — medido via RMS/pico num `OfflineAudioContext` contra a referência já aprovada (riff1, RMS≈0,21,
  pico≈0,82) e corrigido em 2026-09-23 subindo `gain` nos 4 exercícios de quarta (bends/vibrato):
  bend_1 (1.6→6 / 1.6→5), bend_rel (2.2→11 / 2→10), vibrato (2.2→7), bend_lick (1.6→5 / 1.6→4).
- Ao adicionar arquivo novo ao app, incluí-lo em `SHELL` no `sw.js` e subir `CACHE`.

## Pendências

- Sincronização: projeto Supabase `treino-guitarra` ligado em `js/config.js` (cadastro público desligado, RLS testada).
  Validada com 2 aparelhos (notebook → nuvem → celular, com marcações diferentes juntadas). Falta confirmar a velocidade (BPM).
- Publicar no GitHub Pages (repositório `marcoamerlin/treino-guitarra`, ver `docs/setup.md`).
- Conteúdo de terça a domingo escrito por mim (sem professor): validar tablaturas e licks tocando, e ajustar o que soar estranho.
- Ideias: gráfico de progresso, lembrete diário, exercícios criados pelo usuário.
