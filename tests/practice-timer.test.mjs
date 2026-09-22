import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeTimer } from '../js/practice-timer.js';

function fakeStorage(initial = {}) {
  let data = JSON.stringify(initial);
  return { getItem: () => data, setItem: (_key, value) => { data = value; } };
}

test('o cronômetro ativo acumula o tempo corrido; os outros ficam em zero', () => {
  let t = 1000;
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => t, todayISO: () => '2026-09-22' });
  timer.start('2026-09-22_seg_chroma');
  t += 5000; // 5 s
  assert.equal(timer.getElapsed('2026-09-22_seg_chroma'), 5);
  assert.equal(timer.getElapsed('2026-09-22_seg_pent1'), 0);
  timer.pause();
});

test('pausar congela o tempo; retomar continua de onde parou', () => {
  let t = 0;
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => t, todayISO: () => '2026-09-22' });
  const key = '2026-09-22_seg_chroma';
  timer.start(key);
  t += 3000;
  timer.pause();
  assert.equal(timer.getElapsed(key), 3);
  t += 10000; // parado, não conta
  assert.equal(timer.getElapsed(key), 3);
  timer.start(key);
  t += 2000;
  assert.equal(timer.getElapsed(key), 5);
  timer.pause();
});

test('só um cronômetro roda por vez: iniciar outro pausa o anterior sem perder o tempo dele', () => {
  let t = 0;
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => t, todayISO: () => '2026-09-22' });
  const a = '2026-09-22_seg_chroma';
  const b = '2026-09-22_seg_pent1';
  timer.start(a);
  t += 4000;
  timer.start(b); // troca: a fica parado com 4 s acumulados
  t += 6000;
  assert.equal(timer.getElapsed(a), 4);
  assert.equal(timer.getElapsed(b), 6);
  assert.equal(timer.isRunning(a), false);
  assert.equal(timer.isRunning(b), true);
  timer.pause();
});

test('reset zera o tempo e, se o cronômetro zerado estava rodando, ele para', () => {
  let t = 0;
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => t, todayISO: () => '2026-09-22' });
  const key = '2026-09-22_seg_chroma';
  timer.start(key);
  t += 2000;
  timer.reset(key);
  assert.equal(timer.getElapsed(key), 0);
  assert.equal(timer.isRunning(key), false);
});

test('toggle liga quando está parado e pausa quando está rodando', () => {
  let t = 0;
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => t, todayISO: () => '2026-09-22' });
  const key = '2026-09-22_seg_chroma';
  timer.toggle(key);
  assert.equal(timer.isRunning(key), true);
  t += 1000;
  timer.toggle(key);
  assert.equal(timer.isRunning(key), false);
  assert.equal(timer.getElapsed(key), 1);
});

test('ao carregar, só o tempo de hoje é mantido; o de outros dias é descartado', () => {
  const storage = fakeStorage({
    '2026-09-21_seg_chroma': 120,
    '2026-09-22_seg_chroma': 30,
  });
  const timer = createPracticeTimer({ storage, now: () => 0, todayISO: () => '2026-09-22' });
  assert.equal(timer.getElapsed('2026-09-22_seg_chroma'), 30);
  assert.equal(timer.getElapsed('2026-09-21_seg_chroma'), 0);
});

test('onChange é chamado ao iniciar, pausar e resetar', () => {
  const timer = createPracticeTimer({ storage: fakeStorage(), now: () => 0, todayISO: () => '2026-09-22' });
  let calls = 0;
  timer.onChange(() => { calls += 1; });
  timer.start('k');
  timer.pause();
  timer.reset('k');
  assert.equal(calls, 3);
});

test('armazenamento indisponível (ex.: modo privado) não trava: getElapsed segue funcionando', () => {
  const brokenStorage = {
    getItem() { throw new Error('bloqueado'); },
    setItem() { throw new Error('bloqueado'); },
  };
  let t = 0;
  const timer = createPracticeTimer({ storage: brokenStorage, now: () => t, todayISO: () => '2026-09-22' });
  timer.start('k');
  t += 1000;
  assert.equal(timer.getElapsed('k'), 1);
  timer.pause();
});
