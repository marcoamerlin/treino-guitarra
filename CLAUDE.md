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
- `js/metronome.js`: metrônomo Web Audio com agendamento antecipado.
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
- Ao adicionar arquivo novo ao app, incluí-lo em `SHELL` no `sw.js` e subir `CACHE`.

## Pendências

- Sincronização: projeto Supabase `treino-guitarra` ligado em `js/config.js` (cadastro público desligado, RLS testada).
  Validada com 2 aparelhos (notebook → nuvem → celular, com marcações diferentes juntadas). Falta confirmar a velocidade (BPM).
- Publicar no GitHub Pages (repositório `marcoamerlin/treino-guitarra`, ver `docs/setup.md`).
- Conteúdo de terça a domingo escrito por mim (sem professor): validar tablaturas e licks tocando, e ajustar o que soar estranho.
- Ideias: gráfico de progresso, lembrete diário, exercícios criados pelo usuário.
