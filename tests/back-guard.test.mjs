import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackGuard } from '../js/back-guard.js';

// Histórico de mentira: pilha de entradas acima da página do app. go(-n) dispara UM popstate
// (assíncrono no navegador, aqui na hora de `flush()`), como no navegador de verdade.
function setup() {
  let ours = 0; // entradas acima da página do app
  let listener;
  const queue = [];
  const history = {
    pushState() { ours += 1; },
    go(n) { queue.push(() => { ours += n; listener(); }); },
  };
  const win = { addEventListener: (ev, fn) => { assert.equal(ev, 'popstate'); listener = fn; } };
  const layers = []; // coisas abertas, a última por cima
  const deferred = [];
  const guard = createBackGuard({
    history, win,
    countOpen: () => layers.length,
    closeTop: () => { layers.pop(); guard.closed(); },
    defer: (fn) => deferred.push(fn),
  });
  const flush = () => {
    while (deferred.length || queue.length) {
      deferred.splice(0).forEach((f) => f());
      queue.splice(0).forEach((f) => f());
    }
  };
  const open = (name) => { if (!layers.includes(name)) layers.push(name); guard.opened(); };
  const close = (name) => { layers.splice(layers.indexOf(name), 1); guard.closed(); };
  const closeAll = () => { layers.length = 0; guard.closed(); };
  // Gesto "voltar": sem entrada nossa, o navegador sai do app.
  const swipeBack = () => {
    if (ours === 0) return 'saiu';
    ours -= 1; listener(); flush();
    return 'ficou';
  };
  return { layers, open, close, closeAll, flush, swipeBack, entries: () => ours };
}

test('voltar com uma janela aberta fecha a janela e não sai do app', () => {
  const t = setup();
  t.open('metrônomo');
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.swipeBack(), 'saiu'); // na tela principal, voltar sai, como qualquer app
});

test('sem nada aberto, voltar sai do app (nada muda)', () => {
  assert.equal(setup().swipeBack(), 'saiu');
});

test('exercício do dia expandido: voltar fecha o exercício, não o app', () => {
  const t = setup();
  t.open('exercício riff1');
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.swipeBack(), 'saiu');
});

test('dois exercícios expandidos: cada voltar fecha um, o último aberto primeiro', () => {
  const t = setup();
  t.open('exercício A');
  t.open('exercício B');
  assert.equal(t.entries(), 2);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, ['exercício A']);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.swipeBack(), 'saiu');
});

test('fechar pelo ✕ (ou tocando de novo) devolve a entrada: o próximo voltar sai do app', () => {
  const t = setup();
  t.open('afinador');
  t.close('afinador');
  t.flush();
  assert.equal(t.entries(), 0);
  assert.equal(t.swipeBack(), 'saiu');
});

test('fechar vários de uma vez (trocar de dia) devolve todas as entradas num passo só', () => {
  const t = setup();
  t.open('exercício A');
  t.open('exercício B');
  t.closeAll();
  t.flush();
  assert.equal(t.entries(), 0);
  assert.equal(t.swipeBack(), 'saiu');
});

test('trocar de tela dentro da folha (fecha e abre na hora) mantém uma única entrada', () => {
  const t = setup();
  t.open('biblioteca');
  t.close('biblioteca');
  t.open('formulário');
  t.flush();
  assert.equal(t.entries(), 1);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
});

test('abrir de novo o que já está aberto não empilha outra entrada', () => {
  const t = setup();
  t.open('conta');
  t.open('conta');
  assert.equal(t.entries(), 1);
});

test('folha sobre o Braço sobre um exercício: voltar fecha um de cada vez, depois sai', () => {
  const t = setup();
  t.open('exercício');
  t.open('braço');
  t.open('acorde');
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, ['exercício', 'braço']);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, ['exercício']);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.swipeBack(), 'saiu');
});
