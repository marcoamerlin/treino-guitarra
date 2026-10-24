import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackGuard } from '../js/back-guard.js';

// Histórico de mentira: pilha de entradas; back() dispara popstate (assíncrono no navegador,
// aqui na hora de `flush()`), como o gesto "voltar" do Android.
function setup() {
  const entries = ['app'];
  let listener;
  const queue = [];
  const history = {
    pushState(state) { entries.push(state); },
    back() { queue.push(() => { entries.pop(); listener(); }); },
  };
  const win = { addEventListener: (ev, fn) => { assert.equal(ev, 'popstate'); listener = fn; } };
  const layers = []; // janelas abertas, a última por cima
  const deferred = [];
  const guard = createBackGuard({
    history, win,
    isOpen: () => layers.length > 0,
    closeTop: () => { layers.pop(); guard.closed(); },
    defer: (fn) => deferred.push(fn),
  });
  const open = (name) => { layers.push(name); guard.opened(); };
  const closeByX = () => { layers.pop(); guard.closed(); };
  const flush = () => { while (deferred.length || queue.length) { deferred.splice(0).forEach((f) => f()); queue.splice(0).forEach((f) => f()); } };
  // Gesto "voltar": se não há entrada nossa, o navegador sai do app (aqui: devolve 'saiu').
  const swipeBack = () => {
    if (entries.length === 1) return 'saiu';
    entries.pop(); listener(); flush();
    return 'ficou';
  };
  return { entries, layers, open, closeByX, flush, swipeBack };
}

test('voltar com uma janela aberta fecha a janela e não sai do app', () => {
  const t = setup();
  t.open('metrônomo');
  assert.equal(t.entries.length, 2);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.entries.length, 1); // a entrada foi consumida
  assert.equal(t.swipeBack(), 'saiu'); // na tela principal, voltar sai, como qualquer app
});

test('sem janela aberta, voltar sai do app (nada muda)', () => {
  const t = setup();
  assert.equal(t.swipeBack(), 'saiu');
});

test('fechar pelo ✕ devolve a entrada: o próximo voltar sai do app', () => {
  const t = setup();
  t.open('afinador');
  t.closeByX();
  t.flush();
  assert.equal(t.entries.length, 1);
  assert.equal(t.swipeBack(), 'saiu');
});

test('trocar de tela dentro da folha (fecha e abre na hora) mantém uma única entrada', () => {
  const t = setup();
  t.open('biblioteca');
  t.closeByX();
  t.open('formulário');
  t.flush();
  assert.equal(t.entries.length, 2);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
});

test('abrir de novo uma janela já aberta não empilha outra entrada', () => {
  const t = setup();
  t.open('conta');
  t.open('conta');
  assert.equal(t.entries.length, 2);
});

test('folha aberta sobre o Braço: voltar fecha a folha, depois o Braço, depois sai', () => {
  const t = setup();
  t.open('braço');
  t.open('acorde');
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, ['braço']);
  assert.equal(t.swipeBack(), 'ficou');
  assert.deepEqual(t.layers, []);
  assert.equal(t.swipeBack(), 'saiu');
});
