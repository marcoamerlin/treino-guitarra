// Gesto/botão "voltar" do Android fecha o que estiver aberto em vez de sair do app (pedido do
// usuário, 2026-10-24: num Xiaomi com navegação por gestos, deslizar da borda pro centro fechava o
// app inteiro). O app é uma página só, então pro navegador todo "voltar" era "sair".
//
// Cada coisa aberta — folha, Braço (só na guitarra), exercício do dia expandido — ganha UMA entrada
// (`pushState`), criada na hora do toque que a abriu: o Chrome do Android pula, no "voltar",
// entradas criadas sem toque do usuário, então nunca criamos entrada dentro do próprio popstate.
// O "voltar" consome uma entrada (popstate) e fecha a coisa de cima (`closeTop`). Fechar pelo ✕
// ou tocando de novo devolve as entradas que sobraram (`history.go(-n)`), pra que, sem nada aberto,
// o "voltar" saia do app como em qualquer app Android.
//
// `countOpen()` diz quantas coisas estão abertas agora; o módulo mantém o número de entradas igual
// a isso. history/win/defer são injetados para testar fora do navegador (tests/back-guard.test.mjs).

export function createBackGuard({ history, win, countOpen, closeTop, defer = (fn) => setTimeout(fn, 0) }) {
  let entries = 0;    // entradas nossas no topo do histórico
  let ignorePops = 0; // popstates causados pelo nosso próprio history.go()
  let scheduled = false;

  // Adiado: fechar uma folha e logo abrir outra (trocar de tela dentro da folha) reaproveita a
  // mesma entrada, sem mexer no histórico no meio do caminho.
  const reconcile = () => {
    scheduled = false;
    const extra = entries - countOpen();
    if (extra > 0) { entries -= extra; ignorePops += 1; history.go(-extra); }
  };

  win.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops -= 1; return; }
    if (entries === 0) return; // não é nosso (nada aberto): deixa o navegador seguir
    entries -= 1;
    if (countOpen() > 0) closeTop();
  });

  return {
    // Chamar logo depois de abrir algo (ainda dentro do toque). Abrir de novo o que já estava
    // aberto não muda a contagem, então não empilha entrada.
    opened() {
      while (entries < countOpen()) { history.pushState({ backGuard: true }, ''); entries += 1; }
    },
    // Chamar logo depois de fechar algo.
    closed() {
      if (scheduled) return;
      scheduled = true;
      defer(reconcile);
    },
  };
}
