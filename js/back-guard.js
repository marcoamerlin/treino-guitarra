// Gesto/botão "voltar" do Android fecha a janela aberta (folha, Braço) em vez de sair do app
// (pedido do usuário, 2026-10-24: num Xiaomi com navegação por gestos, deslizar da borda pro
// centro fechava o app inteiro). O app não tem páginas — tudo é uma página só —, então pro
// navegador "voltar" sempre era "sair". Agora, ao abrir a 1ª janela, entra UMA entrada extra no
// histórico; o "voltar" consome essa entrada (popstate) e fecha a janela de cima. Fechar pelo ✕
// devolve a entrada (history.back) pra o próximo "voltar" na tela principal sair do app, como
// esperado. Sem janela aberta, nada muda: "voltar" sai do app, como em qualquer app Android.
//
// history/win/setTimeout são injetados para testar fora do navegador (tests/back-guard.test.mjs).

export function createBackGuard({ history, win, isOpen, closeTop, defer = (fn) => setTimeout(fn, 0) }) {
  let guarded = false; // existe uma entrada nossa no topo do histórico?
  let ignorePops = 0;  // popstates causados pelo nosso próprio history.back()

  const push = () => { history.pushState({ backGuard: true }, ''); guarded = true; };

  win.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops -= 1; return; }
    guarded = false; // o "voltar" acabou de consumir a nossa entrada
    if (!isOpen()) return;
    closeTop();
    if (isOpen()) push(); // ainda há janela por baixo (ex.: folha aberta sobre o Braço)
  });

  return {
    // Chamar sempre que uma janela abre (abrir de novo uma já aberta não empilha outra entrada).
    opened() { if (!guarded) push(); },
    // Chamar sempre que uma janela fecha. Adiado: fechar uma folha e logo abrir outra (trocar de
    // tela dentro da folha) mantém a mesma entrada, sem history.back() no meio do caminho.
    closed() {
      defer(() => {
        if (guarded && !isOpen()) { guarded = false; ignorePops += 1; history.back(); }
      });
    },
  };
}
