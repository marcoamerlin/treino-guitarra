import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSync } from '../js/sync-core.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Objeto com as chaves em ordem inversa, como o Postgres (jsonb) pode devolver.
const reorder = (v) => {
  if (Array.isArray(v)) return v.map(reorder);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reverse().reduce((o, k) => { o[k] = reorder(v[k]); return o; }, {});
  }
  return v;
};

// Supabase de mentira: uma tabela user_data com controle por rev.
function makeServer() {
  const server = { row: null, updates: 0, beforeUpdate: null, failSelect: false };
  server.client = () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'eu@exemplo.com' } } } }),
      signInWithPassword: async () => ({ data: { session: { user: { id: 'u1', email: 'eu@exemplo.com' } } }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (server.failSelect) return { data: null, error: new Error('falha de rede') };
            return { data: server.row ? { data: reorder(server.row.data), rev: server.row.rev } : null, error: null };
          },
        }),
      }),
      insert: async (obj) => {
        if (server.row) return { error: { code: '23505', message: 'duplicate key' } };
        server.row = clone(obj);
        return { error: null };
      },
      update: (obj) => ({
        eq: () => ({
          eq: (_col, rev) => ({
            select: async () => {
              if (server.beforeUpdate) { const hook = server.beforeUpdate; server.beforeUpdate = null; hook(); }
              if (!server.row || server.row.rev !== rev) return { data: [], error: null };
              server.row = { ...server.row, ...clone(obj) };
              server.updates += 1;
              return { data: [{ rev: server.row.rev }], error: null };
            },
          }),
        }),
      }),
    }),
  });
  return server;
}

function makeDevice(server, initial) {
  let data = clone(initial);
  const store = {
    snapshot: () => clone(data),
    applyRemote: (merged) => { data = clone(merged); },
  };
  const sync = createSync({
    store,
    config: { url: 'https://x.supabase.co', key: 'chave' },
    loadSdk: async () => ({ createClient: () => server.client() }),
  });
  return { sync, get data() { return data; }, set data(v) { data = v; } };
}

const day = (done, t) => ({ logs: { '2026-09-21_seg': { done, t, notes: '', notesAt: 0 } }, speeds: {}, plans: {} });

test('primeiro aparelho cria a linha no servidor', async () => {
  const server = makeServer();
  const phone = makeDevice(server, day({ chroma: true }, { chroma: 100 }));
  await phone.sync.init();
  assert.equal(server.row.rev, 1);
  assert.equal(server.row.data.logs['2026-09-21_seg'].done.chroma, true);
  assert.equal(phone.sync.getState().status, 'ok');
});

test('dois aparelhos convergem para a soma do que cada um fez', async () => {
  const server = makeServer();
  const phone = makeDevice(server, day({ chroma: true }, { chroma: 100 }));
  const laptop = makeDevice(server, day({ pent1: true }, { pent1: 200 }));
  await phone.sync.init();          // celular envia
  await laptop.sync.init();         // notebook junta e envia
  await phone.sync.syncNow();       // celular recebe o que o notebook fez
  const expected = { chroma: true, pent1: true };
  assert.deepEqual(laptop.data.logs['2026-09-21_seg'].done, expected);
  assert.deepEqual(phone.data.logs['2026-09-21_seg'].done, expected);
  assert.deepEqual(server.row.data.logs['2026-09-21_seg'].done, expected);
});

test('sincronizar sem novidades não grava nada (rev não sobe à toa)', async () => {
  const server = makeServer();
  const phone = makeDevice(server, day({ chroma: true }, { chroma: 100 }));
  await phone.sync.init();
  const rev = server.row.rev;
  await phone.sync.syncNow();
  await phone.sync.syncNow();
  assert.equal(server.row.rev, rev);
  assert.equal(server.updates, 0);
});

test('se outro aparelho gravar no meio da rodada, refaz e não perde ninguém', async () => {
  const server = makeServer();
  const phone = makeDevice(server, day({ chroma: true }, { chroma: 100 }));
  await phone.sync.init();

  const laptop = makeDevice(server, day({ pent1: true }, { pent1: 200 }));
  phone.data = day({ chroma: true, riff1: true }, { chroma: 100, riff1: 300 });
  // no instante em que o celular vai gravar, o notebook grava primeiro
  server.beforeUpdate = () => {
    server.row = {
      ...server.row,
      data: { ...server.row.data, logs: day({ chroma: true, pent1: true }, { chroma: 100, pent1: 200 }).logs },
      rev: server.row.rev + 1,
    };
  };
  await phone.sync.syncNow();
  const done = server.row.data.logs['2026-09-21_seg'].done;
  assert.deepEqual(done, { chroma: true, pent1: true, riff1: true });
  assert.equal(phone.sync.getState().status, 'ok');
  void laptop;
});

test('erro de rede vira estado de erro e mantém os dados locais intactos', async () => {
  const server = makeServer();
  const phone = makeDevice(server, day({ chroma: true }, { chroma: 100 }));
  await phone.sync.init();
  const before = clone(phone.data);
  server.failSelect = true;
  await phone.sync.syncNow();
  assert.equal(phone.sync.getState().status, 'error');
  assert.match(phone.sync.getState().error, /falha de rede/);
  assert.deepEqual(phone.data, before);
});

test('sem configuração, a sincronização fica desligada e não chama o SDK', async () => {
  let loaded = false;
  const sync = createSync({
    store: { snapshot: () => ({}), applyRemote() {} },
    config: { url: '', key: '' },
    loadSdk: async () => { loaded = true; return {}; },
  });
  await sync.init();
  await sync.syncNow();
  assert.equal(sync.getState().status, 'disabled');
  assert.equal(loaded, false);
});
