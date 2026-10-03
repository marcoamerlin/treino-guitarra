# Treino de Guitarra

PWA de treino diário de guitarra (rock, técnica: velocidade e limpeza). Uso principal no celular,
também no notebook. Estética de painel de amplificador (fundo escuro, LCD âmbar, switches).
Interface e conteúdo em português do Brasil. Briefing original em `docs/briefing.md`.

## Rodar

```
npm start      # node tools/serve.mjs → http://localhost:5173 (sem build, JS puro em módulos ES)
npm test       # testes de merge, sync, metrônomo, tablaturas, acordes e planos (Node, sem dependências)
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
  `sync-core.js` expõe `getClient()`/`getUserId()`/`getEmail()` para outros módulos reaproveitarem a
  mesma conexão autenticada (usado por teacher-core.js), em vez de abrir outro client Supabase.
- `js/teacher-core.js` + `js/teacher.js`: professor acompanha e edita o plano de alunos vinculados
  a ele (pedido de usuário, 2026-09-28). Vínculo nasce do **aluno**: o professor gera um código
  (tabela `teacher_codes`) e o aluno digita esse código pra se linkar (tabela `teacher_links`,
  `student_id` é a chave — um aluno tem no máximo 1 professor por vez; vincular de novo troca).
  RLS de `user_data` foi estendida (ver `supabase/schema.sql`) pra um professor ler/gravar a linha
  de alunos vinculados — a policy libera a LINHA inteira por simplicidade (confiança do tamanho do
  grupo: poucos professores conhecidos), mas o app só escreve em `plans` e `speeds`, nunca em
  `logs` (o registro de "fiz esse exercício hoje" é só do aluno). `writeStudentPlan()` e
  `writeStudentSpeed()` (BPM de um exercício do aluno — pedido de usuário, 2026-09-28: o
  professor também define tempo/BPM, não só quais exercícios) usam controle otimista igual ao
  `sync-core.js` (lê rev, grava só essa chave, grava se rev não mudou, refaz em conflito) — sem
  isso, o professor editando ao mesmo tempo que o aluno sincroniza podia perder escrita de um dos
  dois. Continua precisando criar a conta de cada pessoa à mão no painel (cadastro público
  desligado); o código só cria o vínculo, não a conta. Teste: `tests/teacher.test.mjs`, com um
  Supabase de mentira no mesmo espírito de `tests/sync.test.mjs`.
  Todo item que o professor salva vira `locked: true` (pedido de usuário, 2026-09-29): o aluno
  pode reordenar e ajustar tempo/BPM de um exercício travado, mas não remover nem trocar — só os
  que ele mesmo adicionar depois (sem essa marca) ficam livres. `exerciseCard()` em app.js esconde
  os botões Trocar/Remover nesse caso (mostra "🎓 Definido pelo professor" no lugar) e o botão
  "Restaurar plano padrão" fica desabilitado se o dia tiver algum item travado — senão seria uma
  forma disfarçada de apagar o que o professor montou.
  UI: dentro da folha "Conta e sincronização" (`teacherSectionView()`/`studentPlanView()` em
  app.js) — o editor de plano do aluno é uma versão simplificada do "Editar dia" pessoal (sem
  timer/áudio/comando de voz), com minutos e BPM editáveis por exercício; o BPM grava na hora
  (é campo à parte, `speeds`, não faz parte do plano), os outros campos só ao "Salvar plano deste
  dia". Depois de salvar, a cópia local de `studentData` é atualizada manualmente (bug real
  encontrado testando: sem isso, trocar de aba de dia e voltar mostrava o plano de antes de
  salvar, porque `studentData` só é buscado 1 vez ao abrir a tela).
  Também mostra o **andamento** (pedido de usuário, 2026-09-28): `historyBlock()` deixa escolher
  um período (De/Até, padrão a semana atual) e lista cada data (mais recente primeiro) com quantos
  exercícios foram marcados `done` em `logs` e a nota (`notes`) do aluno, se houver; tocar numa
  data expande exercício a exercício (concluído ou não, e o BPM). Datas fora da semana calendário
  funcionam igual (`logs`/`plans` são só por data e dia-da-semana, sem limite de quão para trás
  vai). Achado real testando: como só existe "o plano ATUAL de cada dia da semana" (sem
  histórico), mostrar uma data passada usando o plano de hoje inventava exercício que não existia
  ainda naquele dia. Corrigido gravando uma **foto do plano no 1º toque de cada dia**
  (`log.plan`, congelada — ver `js/store.js` `ensureLog()`/`toggleDone()`/`setNotes()` e o merge
  em `js/merge.js`); `historyBlock()` usa essa foto quando existe (`hasSnapshot`), e só cai no
  plano atual como estimativa pra dias registrados antes dessa mudança (sem foto) — nesse caso
  não afirma "não concluído" pra quem nunca foi tocado (seria chute), diz que não há registro.
  Exercícios concluídos que saíram do plano continuam aparecendo (união com `log.done`/`log.t`).
  `progressBlock()` mostra BPM atual de cada exercício já praticado, mais limpos/erros seguidos.
  Um botão "↻ Atualizar" refaz o fetch (os dados são só uma foto de quando
  a tela abriu, não atualizam sozinhos).
  Atalho no cabeçalho (pedido de usuário, 2026-09-28): botão "🎓 Alunos" (`#teacherBtn` no
  index.html) abre direto `myStudentsView()` — mesma lista de alunos de dentro de "Conta e
  sincronização", sem passar por lá. Só aparece (`hidden`) pra quem já tem pelo menos 1 aluno
  vinculado; `refreshTeacherPill()` decide isso, chamada ao logar/trocar de conta (não a cada
  tick de sync — só quando o e-mail muda) e depois de qualquer entra/sai de aluno.
  Bug real encontrado nisso: o atributo HTML `hidden` não escondia o botão, porque
  `.metro-pill { display: flex }` (mesma especificidade do `[hidden]` do navegador) vencia por
  vir depois na cascata — corrigido com uma regra `[hidden] { display: none !important; }`.
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
- `js/metronome.js`: metrônomo Web Audio com agendamento antecipado. Subdivisão = `subdivision`,
  cliques por tempo, escolhido numa fileira "SUBDIVISÃO" na tela (`SUBDIVISIONS`: 1 semínimas,
  2 colcheias, 3 tercinas, 4 semicolcheias, 6 sextinas) — pedido do usuário, 2026-10-03, mesma
  mudança do Treino de Bateria. Trocar a subdivisão com o metrônomo tocando só vale a partir do
  próximo tempo. Preferência `metroSubdiv`; a antiga `metroSub: true` vira 2. Testes em
  `tests/metronome.test.mjs`. A mesma fileira aparece no quadro de velocidade de cada exercício
  (`speedBox`): cada exercício guarda a sua (`prefs.exSubdiv[id]`, padrão 1; só deste aparelho, o
  professor não mexe) e "Tocar metrônomo" do exercício aplica BPM + subdivisão dele.
  O quadro do exercício também ganhou a barra deslizante de BPM do metrônomo livre (pedido do
  usuário, 2026-10-03): enquanto arrasta só mostra o número (e muda o metrônomo, se tocando); a
  velocidade é gravada uma vez só, ao soltar (`change`), porque cada gravação zera limpos/erros.
- `js/pitch.js` + `js/tuner.js`: afinador (botão "🎵 Afinador" no cabeçalho, pedido de usuário,
  2026-10-02), só guitarra (a bateria não tem). Detecta a corda sozinho — o usuário preferiu isso a
  escolher a corda na tela — e mostra a corda mais próxima, a nota, os Hz e o desvio em cents
  (ponteiro de −50 a +50; dentro de ±5 cents, `IN_TUNE_CENTS`, conta como afinada, verde). Tocar
  na corda na tela toca a gravação da corda solta (as mesmas de `audio/guitar-clean/`, notas MIDI
  40/45/50/55/59/64, via `loadSamples` de tab-player.js; se falhar cai num tom puro).
  `pitch.js` é puro e testado com sinais sintéticos (`tests/pitch.test.mjs`): `detectPitch` usa o
  algoritmo YIN, não pico de autocorrelação — na corda Mi grave (82 Hz) o 2º harmônico costuma ser
  mais forte que a fundamental e a autocorrelação cantaria uma oitava acima; YIN pega o menor
  período abaixo do limiar. Testado também: erro ≤ 1 cent em senoides, sem erro de oitava com
  fundamental fraca, `null` pra silêncio e ruído, e corda dedilhada simulada (Karplus-Strong) sem
  erro de oitava (o desvio de 1,5 a 6 cents que ela mostra é do próprio modelo, que atrasa meia
  amostra, não do detector). `tuner.js` liga o microfone: `getUserMedia` com
  `echoCancellation/noiseSuppression/autoGainControl` desligados (o navegador trata a guitarra como
  ruído e distorce a frequência), `AnalyserNode` com 4096 amostras lido a cada 60 ms, mediana das
  últimas 5 leituras (o ataque da palheta não balança o ponteiro), e a tela só limpa depois de ~360 ms
  sem nota clara (a corda decai). O analisador NÃO vai pra saída de áudio (senão o microfone sairia
  no alto-falante). O contexto de áudio e o pedido de microfone saem juntos, ainda dentro do toque do
  usuário (no iPhone o áudio só liga se criado num gesto, não depois do aviso de permissão). Enquanto
  a referência toca a detecção é ignorada (o microfone ouviria o próprio app). Abrir o afinador para o
  metrônomo, o "Ouvir" e o comando de voz (clique e tablatura entrariam no microfone; a voz disputa o
  mesmo microfone), e fechar a tela solta o microfone (`sheetCleanups` em app.js; se a tela fechar
  enquanto o aviso de permissão ainda está aberto, o microfone que chegar depois é solto também).
  Verificado no navegador trocando `getUserMedia` por um microfone falso (onda dente-de-serra pelo
  próprio Web Audio): afinada, ±cents, troca de corda, silêncio, permissão negada, sem microfone,
  sem a API, permissão tardia, abrir/fechar várias vezes. **Não validado com microfone e guitarra
  de verdade** — falta testar no celular (permissão no Android/iPhone, ruído de sala, precisão real).
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
- `speed_124` em exercises.js: exercício de velocidade pura (pedido do usuário: "algo pra aumentar
  a velocidade aos poucos"), de uma imagem de referência (Guitar Mastery). Sempre nas cordas Ré e
  Sol: tercinas com dedos 1-2-4 (offsets 0,1,3 — pula o dedo 3) alternando com 1-3-4 (offsets
  0,2,3 — pula o dedo 2). 1ª tercina de cada compasso fica toda na Ré; a 2ª começa na Sol (mesma
  casa-base) e volta pra Ré com as duas casas de cima invertidas.
  Conferido compasso a compasso com o usuário (a imagem tinha mais linhas/cordas do que pareceu
  à primeira vista — ver histórico do projeto: errei duas vezes achando que era tudo numa corda só
  antes de confirmar Ré+Sol fixas o exercício inteiro).
  Bug real encontrado pelo usuário DEPOIS de já publicado: cada compasso repete 4x **sozinho**
  (casa 2 quatro vezes, depois casa 3 quatro vezes...), não o par 1-2-4+1-3-4 junto repetindo 4x
  — a 1ª versão juntava os dois num só `cols` com `repeat:4`, tocando 1-2-4,1-3-4,1-2-4,1-3-4...
  em vez de 1-2-4×4 depois 1-3-4×4. Corrigido: 7 abas, uma por casa (2,3,5,6,8,9,11), cada uma
  com `repeat: 4` própria. Nessa correção quase reintroduzi outro bug: `speedMeasureTab` chamava
  `speedMeasure(base, fingers)` passando o rótulo bonito ("1-2-4", com traços) em vez do valor
  que a função compara (`'124'`, sem traços) — todo compasso teria saído com o dedilhado 1-3-4
  por engano. Pego antes de publicar, rodando os testes.
- `js/theory.js` + `js/fretboard.js` + `js/chord-shapes.js`: explorador de escalas e acordes (botão
  "Braço" no cabeçalho, tela cheia, com abas Escalas/Acordes).
  Raiz (12 notas) + escala (maior/menor natural/pentatônica maior/pentatônica menor/modos gregos)
  + posição. Pentatônicas ganham as 5 posições clássicas (`positionsOf`, uma janela de casas comum
  às 6 cordas, casas conectadas: fim de uma = início da próxima); maior e menor natural só mostram
  o braço inteiro, sem posição (janela entre graus vizinhos fica curta demais pra virar posição com
  essa técnica de janela única).
  "Modos gregos" é uma escala separada (mesma nota-a-nota da maior, `SCALES.modes`, mas com seu
  próprio item na lista — pedido de usuário, 2026-09-30: a primeira versão reaproveitou a própria
  "Maior" pra mostrar os modos, e isso fez a visão simples de sempre sumir; agora as duas convivem)
  que usa um jeito de posição bem diferente do `positionsOf`: `modePositions` — os 7 modos do campo
  harmônico (Jônio a Lócrio), cada um com seu próprio recorte por corda ("3 notas por corda", como
  se ensina modo na prática, e não "achar tudo que cai numa faixa de casas"), a partir de um
  material de referência do Instituto Magno ("Modos Gregos — Campo Harmônico de G", 2026-09-29).
  Cada posição mostra o nome do modo e a cifra (7M/m7/m7/7M/7/m7/m7(b5), fixas pra qualquer tônica
  — conferidas batendo exatamente com o material de referência, forte confirmação independente já
  que o campo harmônico só depende da escala); em "Todas" mostra o campo harmônico inteiro (os 7
  acordes) na linha onde normalmente ficam os graus. Nunca calcular posição de modo de cabeça —
  `modePositions` deriva por computador (mesmo princípio de `tools/derive-chord-shapes.mjs` pros
  acordes CAGED); testado casa por casa contra Sol maior em `tests/theory.test.mjs`.
  Segurança de oitava: a subida das 7 posições é contínua (fim de uma = início da próxima), o que
  funciona bem pra Sol (âncora baixa, casa 3 — sobe até 19 no máximo) mas pra tônicas com âncora
  alta (`anchorFret`; Ré = 10, por exemplo) ia empurrando as últimas posições pra casas que não
  existem em violão nenhum — achado testando com o usuário, 2026-09-30: o 6º grau de Ré chegava à
  casa 24. Corrigido descendo cada posição o máximo de oitavas possível (`floor(menor casa / 12)`,
  a mesma nota 12 casas abaixo) sem nunca ficar negativa — pedido explícito do usuário: preferir
  sempre a região de casas 1 a 12 quando der (por isso até as posições altas de Sol, tipo o 6º e 7º
  grau, agora também aparecem baixas, mesmo já estando dentro de um braço de verdade antes do
  ajuste). Isso quebra a conexão visual entre posições vizinhas pra tônicas de âncora alta (uma
  posição pode aparecer mais baixa que a anterior) — inevitável: 7 posições conectadas sem nunca
  descer não cabem no braço pra toda tônica, só pras que já começam baixo. Testado que nenhuma
  posição de nenhuma tônica passa da casa 19 nem fica negativa.
  Uma posição de cada vez, não todas sobrepostas: paleta categórica para 5+ grupos não passou no validador do
  skill dataviz para pontos que podem ficar lado a lado (mesmo motivo de referências do mercado
  mostrarem uma caixa por vez). Raiz/tônica destacada por anel, não por cor (funciona para qualquer
  visão). SVG do braço precisa de width/height além do viewBox, senão fica 0×0.
  Posição de modo usa um desenho diferente do resto do explorador: `sequenceSVG` (fretboard.js), no
  lugar de `fretboardSVG` (usado em "Todas", pentatônica e acordes). Pedido de usuário, 2026-09-30,
  comparando com o material de referência: lá as notas não ficam alinhadas verticalmente por casa
  (geometria real do braço) — o eixo horizontal segue a ORDEM DE EXECUÇÃO, corda por corda (toca
  tudo da corda Mi grave, depois passa pra próxima), então cada corda começa depois de onde a
  anterior terminou, como uma tablatura (mesmo espírito de `buildTab()` em tab.js, só que em SVG
  com círculos). `modePositions()` já gera os `dots` nessa ordem (E→A→D→G→B→e, ascendente dentro
  de cada corda), então `sequenceSVG` só precisa agrupar notas consecutivas da mesma corda. As 6
  linhas de corda são desenhadas por toda a largura do diagrama (não só embaixo de cada grupo de
  notas) — achado testando: sem isso, os grupos pareciam blocos soltos, sem parecer uma tablatura.
  As bolinhas de `sequenceSVG` mostram o número da casa (pedido de usuário, 2026-09-30, bate com o
  material de referência) — a nota já aparece na legenda de texto acima, não precisa repetir bolinha
  por bolinha como faz `fretboardSVG` (que mostra nome da nota, sem número de casa nenhum).
  Legenda de cada modo (também pedido de usuário, 2026-09-30, "complementar conforme a imagem"):
  `.mode-detail` mostra "1º grau · Sol Jônio · G A B C D E F#" — grau (`p.index`), nome em
  português (`ptName`, PT_NAMES em theory.js: dó-ré-mi, só usado aqui) e as 7 notas do modo
  relidas a partir da própria tônica (`modeScaleNotes`, gira `SCALES.major.intervals` a partir do
  grau). `.harmonic-field` mostra os 7 acordes o tempo todo (não só em "Todas"), pra comparar o
  modo aberto com os outros 6 sem trocar de aba — no material de referência essa caixa aparece em
  toda página do PDF, fixa, não só numa visão resumo.
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
- `sw.js`: achado real testando um deploy do Treino de Bateria (mesmo padrão de `sw.js`, replicado
  de lá pra cá, 2026-09-28): o GitHub Pages manda `Cache-Control: max-age=600` nos arquivos do
  app, então um `fetch(request)` comum dentro do service worker podia devolver uma cópia de até
  10 min atrás mesmo pedindo "rede primeiro" — atualizações publicadas pareciam não chegar nos
  aparelhos dos usuários. Corrigido criando o request de novo com `{ cache: 'reload' }` (ignora o
  cache HTTP, vai sempre ao servidor) e registrando o worker com `{ updateViaCache: 'none' }` em
  `app.js` (senão o `sw.js` em si também podia ficar preso no cache por até 10 min, atrasando o
  navegador notar que existe versão nova). Mesmo assim, subir `CACHE` a cada deploy continua
  necessário — é o que faz o service worker antigo ser substituído e o cache velho, apagado.

## Pendências

- Sincronização: projeto Supabase `treino-guitarra` ligado em `js/config.js` (cadastro público desligado, RLS testada).
  Validada com 2 aparelhos (notebook → nuvem → celular, com marcações diferentes juntadas). Falta confirmar a velocidade (BPM).
- Publicar no GitHub Pages (repositório `marcoamerlin/treino-guitarra`, ver `docs/setup.md`).
- Conteúdo de terça a domingo escrito por mim (sem professor): validar tablaturas e licks tocando, e ajustar o que soar estranho.
- Ideias: gráfico de progresso, lembrete diário, exercícios criados pelo usuário.
- Professor/aluno (2026-09-28): código pronto (schema, RLS, UI), mas o schema novo (`teacher_codes`,
  `teacher_links`, RLS estendida de `user_data`) ainda não foi rodado no Supabase de produção —
  precisa colar `supabase/schema.sql` de novo no SQL Editor (é aditivo/idempotente, não mexe nos
  dados existentes) antes de testar de verdade com uma conta professor + uma aluno.
