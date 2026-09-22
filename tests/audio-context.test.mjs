import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureRunningContext } from '../js/audio-context.js';

// Um AudioContext de mentira, com resume() controlável: é assim que simulamos, sem navegador,
// o canal "preso" que o usuário encontrou (resume() nunca resolve, ou resolve mas o estado não muda).
function fakeContext({ resumeBehavior = 'runs', closable = true } = {}) {
  const ctx = {
    state: 'suspended',
    closed: false,
    resume() {
      if (resumeBehavior === 'runs') { ctx.state = 'running'; return Promise.resolve(); }
      if (resumeBehavior === 'stays-suspended') return Promise.resolve(); // "resolve" mas não desprende
      if (resumeBehavior === 'rejects') return Promise.reject(new Error('não deu'));
      if (resumeBehavior === 'hangs') return new Promise(() => {}); // nunca resolve nem rejeita
      throw new Error('resumeBehavior desconhecido');
    },
    close() { if (!closable) throw new Error('close falhou'); ctx.closed = true; ctx.state = 'closed'; return Promise.resolve(); },
  };
  return ctx;
}

test('contexto já rodando: usa o mesmo, sem criar outro', async () => {
  const running = fakeContext({ resumeBehavior: 'runs' });
  running.state = 'running';
  let created = 0;
  const result = await ensureRunningContext(running, { createContext: () => { created += 1; return fakeContext(); } });
  assert.equal(result, running);
  assert.equal(created, 0);
});

test('contexto suspenso que resume normalmente: usa o mesmo, sem recriar', async () => {
  const ctx = fakeContext({ resumeBehavior: 'runs' });
  let created = 0;
  const result = await ensureRunningContext(ctx, { createContext: () => { created += 1; return fakeContext(); } });
  assert.equal(result, ctx);
  assert.equal(result.state, 'running');
  assert.equal(created, 0);
});

test('canal preso (resume "resolve" mas o estado não sai de suspenso): descarta e cria um novo', async () => {
  const stuck = fakeContext({ resumeBehavior: 'stays-suspended' });
  const fresh = fakeContext({ resumeBehavior: 'runs' });
  const result = await ensureRunningContext(stuck, { createContext: () => fresh });
  assert.equal(result, fresh);
  assert.equal(result.state, 'running');
  assert.equal(stuck.closed, true, 'o contexto preso devia ser fechado');
});

test('canal preso (resume nunca resolve, tipo o problema real): não fica esperando para sempre', async () => {
  const hung = fakeContext({ resumeBehavior: 'hangs' });
  const fresh = fakeContext({ resumeBehavior: 'runs' });
  const start = Date.now();
  const result = await ensureRunningContext(hung, { createContext: () => fresh });
  assert.ok(Date.now() - start < 2000, 'não pode esperar mais que ~800ms + folga por um resume() que nunca volta');
  assert.equal(result, fresh);
});

test('resume() rejeita: mesmo assim recria em vez de travar tudo', async () => {
  const rejecting = fakeContext({ resumeBehavior: 'rejects' });
  const fresh = fakeContext({ resumeBehavior: 'runs' });
  const result = await ensureRunningContext(rejecting, { createContext: () => fresh });
  assert.equal(result, fresh);
});

test('fechar o contexto preso falha (já pode estar fechado sozinho): não impede criar um novo', async () => {
  const stuck = fakeContext({ resumeBehavior: 'stays-suspended', closable: false });
  const fresh = fakeContext({ resumeBehavior: 'runs' });
  const result = await ensureRunningContext(stuck, { createContext: () => fresh });
  assert.equal(result, fresh);
});

test('sem contexto existente: cria um na hora', async () => {
  let created = 0;
  const result = await ensureRunningContext(null, { createContext: () => { created += 1; return fakeContext({ resumeBehavior: 'runs' }); } });
  assert.equal(created, 1);
  assert.equal(result.state, 'running');
});

test('navegador sem suporte a Web Audio (createContext devolve null): não quebra, devolve null', async () => {
  const result = await ensureRunningContext(null, { createContext: () => null });
  assert.equal(result, null);
});

test('mesmo se o contexto novo também não conseguir rodar, devolve ele assim mesmo (não trava o app)', async () => {
  const stuck = fakeContext({ resumeBehavior: 'stays-suspended' });
  const alsoStuck = fakeContext({ resumeBehavior: 'stays-suspended' });
  const result = await ensureRunningContext(stuck, { createContext: () => alsoStuck });
  assert.equal(result, alsoStuck);
});
