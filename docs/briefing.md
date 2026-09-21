# Painel de Treino de Guitarra — briefing para o Claude Code

## Contexto
App de treino diário de guitarra para quem já toca há 2 anos, foco em rock/blues,
objetivo principal: melhorar técnica (velocidade e limpeza). Estilo visual: painel de
amplificador (fundo escuro, LCD âmbar, toggles tipo switch de hardware).

## O que já existe
Arquivo `treino-guitarra.html` (anexo) — protótipo funcional em HTML/CSS/JS puro,
publicado como Artifact no claude.ai. Já tem:
- 7 dias da semana (abas), abrindo automaticamente no dia de hoje
- Segunda-feira **totalmente detalhada**: aquecimento, alternate picking em pentatônica
  de Lá menor (com tablatura), riff original estilo alternativo/grunge (com power chords
  A5/C5/D5/E5), aplicação sobre backing track, ritmo com palm mute
- Terça a domingo: estrutura e foco técnico definidos, mas **conteúdo ainda resumido**
  (legato, bends/vibrato, string skipping, licks de rock combinados, jam+gravação, descanso)
- Contador de BPM por bloco de técnica (regra: 3x limpo = +4 BPM, 2 erros seguidos = −4 BPM),
  com histórico
- Checklist de blocos (toggle "feito"), notas diárias, contador de sequência (streak)
- Persistência via `localStorage` — **funciona só no navegador atual, sem sincronizar
  entre dispositivos**

## O que falta / motivo da migração
1. **Sincronização entre celular e computador** — hoje os dados ficam presos ao
   navegador. Precisa de um backend simples (ex: banco local tipo SQLite, ou serviço
   de sync) para o histórico de treino acompanhar o usuário em qualquer aparelho.
2. **Instalável como app** — transformar em PWA (ícone na tela inicial do celular,
   funciona offline, sync quando volta a conexão).
3. **Detalhar os dias restantes** (terça a domingo) com o mesmo nível de profundidade
   da segunda-feira — tablaturas, riffs, licks, no estilo rock que o usuário prefere
   (referências: Alice in Chains, Deftones, e rock/hard rock em geral).
4. Possíveis extensões futuras: histórico visual de progresso (gráfico de BPM ao longo
   do tempo), lembrete/notificação diária, biblioteca de riffs/licks pesquisável.

## Preferências do usuário
- Toca há 2 anos, já sabe o básico
- Objetivo atual: técnica (velocidade + limpeza), não teoria pesada
- Estilo preferido: rock (não curte foco em blues)
- Pratica ~60 minutos por dia
- Gosta da estética "painel de hardware/amplificador" já usada no protótipo — manter
  a identidade visual ao evoluir o app
