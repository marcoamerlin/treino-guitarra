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
- `js/app.js`: interface. `sw.js` + `manifest.webmanifest`: PWA offline.

## Regras do domínio

- Cada dia soma ~60 min. O usuário personaliza os dias (tempo, ordem, remover, trocar, adicionar).
- A velocidade (BPM) é **por exercício**, não por dia, e continua de uma semana para a outra.
  Regra: 3 limpos seguidos = +4 BPM; 2 erros seguidos = −4 BPM.
- Exercício com `draft: true` ainda está em resumo (terça a domingo); detalhar mantendo o nível da segunda.
- Ao adicionar arquivo novo ao app, incluí-lo em `SHELL` no `sw.js` e subir `CACHE`.

## Pendências

- Sincronização: projeto Supabase `treino-guitarra` criado e ligado em `js/config.js` (cadastro público desligado,
  RLS testada). Falta o primeiro login do usuário nos aparelhos para validar a sincronização de ponta a ponta.
- Publicar no GitHub Pages (repositório `marcoamerlin/treino-guitarra`, ver `docs/setup.md`).
- Detalhar terça a domingo.
- Ideias: gráfico de progresso, lembrete diário, exercícios criados pelo usuário.
