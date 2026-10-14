import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_CAT, LIMITS, makeCustomId, isCustomId, cleanFields, customToExercise, customList,
} from '../js/custom-exercises.js';

// store.js lê o localStorage já ao ser importado: o falso tem que existir antes (import dinâmico).
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
};
const { store } = await import('../js/store.js');

test('makeCustomId: prefixo "meu_", sem colidir entre ids gerados no mesmo instante', () => {
  const ids = new Set(Array.from({ length: 500 }, () => makeCustomId(1_700_000_000_000)));
  assert.ok(ids.size > 450, `só ${ids.size} ids diferentes em 500`); // 36³ = 46 mil sufixos possíveis
  [...ids].forEach((id) => assert.ok(isCustomId(id) && /^meu_[0-9a-z]+$/.test(id), id));
  assert.equal(isCustomId('chroma'), false);
  assert.equal(isCustomId(undefined), false);
});

test('cleanFields: título é obrigatório, o resto é opcional', () => {
  assert.deepEqual(cleanFields({ title: '   ' }), { ok: false, error: 'Dê um título ao exercício.' });
  assert.equal(cleanFields({}).ok, false);
  assert.equal(cleanFields().ok, false);
  const r = cleanFields({ title: '  Escala de Lá menor  ', text: '  devagar\ncom metrônomo  ', min: '15' });
  assert.deepEqual(r, { ok: true, value: { title: 'Escala de Lá menor', text: 'devagar\ncom metrônomo', min: 15 } });
  assert.deepEqual(cleanFields({ title: 'x' }).value, { title: 'x', text: '', min: LIMITS.defaultMin });
});

test('cleanFields: minutos seguem o limite de 5 a 90; vazio ou inválido vira o padrão', () => {
  const min = (m) => cleanFields({ title: 'x', min: m }).value.min;
  assert.equal(min(1), 5);
  assert.equal(min(500), 90);
  assert.equal(min(12.6), 13);
  assert.equal(min(''), LIMITS.defaultMin);
  assert.equal(min('abc'), LIMITS.defaultMin);
  assert.equal(min(undefined), LIMITS.defaultMin);
});

test('cleanFields: corta título e texto nos limites', () => {
  const r = cleanFields({ title: 't'.repeat(300), text: 'a'.repeat(5000), min: 10 });
  assert.equal(r.value.title.length, LIMITS.title);
  assert.equal(r.value.text.length, LIMITS.text);
});

test('customToExercise: no formato das telas; registro apagado ou ausente vira null', () => {
  const ex = customToExercise({ id: 'meu_a', title: 'Meu', text: 'texto', min: 12, updatedAt: 1 });
  assert.deepEqual(ex, { id: 'meu_a', title: 'Meu', subtitle: '', cat: CUSTOM_CAT, min: 12, text: 'texto', custom: true });
  assert.equal(customToExercise({ id: 'meu_a', deleted: true, updatedAt: 2 }), null);
  assert.equal(customToExercise(undefined), null);
});

test('cleanFields: metrônomo é opcional — sem BPM inicial a chave bpm nem existe', () => {
  assert.equal('bpm' in cleanFields({ title: 'x' }).value, false);
  assert.equal('bpm' in cleanFields({ title: 'x', bpmStart: '', bpmGoal: '120' }).value, false); // meta sozinha não liga
  assert.equal('bpm' in cleanFields({ title: 'x', bpmStart: '  ' }).value, false);
});

test('cleanFields: BPM inicial liga o metrônomo; meta vazia = início + 30; nunca abaixo do início', () => {
  const bpm = (start, goal) => cleanFields({ title: 'x', bpmStart: start, bpmGoal: goal }).value.bpm;
  assert.deepEqual(bpm('60', '100'), { start: 60, goal: 100 });
  assert.deepEqual(bpm('60', ''), { start: 60, goal: 90 });
  assert.deepEqual(bpm(60, undefined), { start: 60, goal: 90 });
  assert.deepEqual(bpm('80', '50'), { start: 80, goal: 80 }); // meta menor que o início sobe até ele
  assert.deepEqual(bpm('72.6', '100.2'), { start: 73, goal: 100 });
});

test('cleanFields: BPM fora da faixa do app (30 a 240) é ajustado', () => {
  const bpm = (start, goal) => cleanFields({ title: 'x', bpmStart: start, bpmGoal: goal }).value.bpm;
  assert.deepEqual(bpm('5', '10'), { start: LIMITS.minBpm, goal: LIMITS.minBpm });
  assert.deepEqual(bpm('999', '9999'), { start: LIMITS.maxBpm, goal: LIMITS.maxBpm });
  assert.deepEqual(bpm('230', ''), { start: 230, goal: LIMITS.maxBpm }); // início + 30 passaria de 240
});

test('customToExercise: leva o bpm (formato do banco) e ignora bpm quebrado vindo de fora', () => {
  const rec = { id: 'meu_a', title: 'Meu', min: 10, bpm: { start: 60, goal: 90 } };
  assert.deepEqual(customToExercise(rec).bpm, { start: 60, goal: 90 });
  assert.equal('bpm' in customToExercise({ ...rec, bpm: { start: 'x', goal: null } }), false);
  assert.equal('bpm' in customToExercise({ ...rec, bpm: 'lixo' }), false);
  assert.equal('bpm' in customToExercise({ id: 'meu_b', title: 'Sem', min: 10 }), false);
});

test('customList: ordem alfabética (pt-BR), sem os apagados', () => {
  const list = customList({
    a: { id: 'a', title: 'Zebra', min: 10 },
    b: { id: 'b', title: 'Água', min: 10 },
    c: { id: 'c', deleted: true, updatedAt: 3 },
    d: { id: 'd', title: 'Banana', min: 10 },
  });
  assert.deepEqual(list.map((e) => e.title), ['Água', 'Banana', 'Zebra']);
});

test('store: criar, editar (mantém a data de criação) e apagar (vira lápide)', () => {
  const id = makeCustomId();
  store.saveCustomExercise(id, { title: 'Primeiro', text: 'a', min: 10 });
  const created = store.getCustomExercises()[id];
  assert.equal(created.title, 'Primeiro');
  assert.ok(created.createdAt > 0 && created.updatedAt >= created.createdAt);

  store.saveCustomExercise(id, { title: 'Editado', text: 'b', min: 20 });
  const edited = store.getCustomExercises()[id];
  assert.equal(edited.title, 'Editado');
  assert.equal(edited.min, 20);
  assert.equal(edited.createdAt, created.createdAt);

  store.deleteCustomExercise(id);
  const gone = store.getCustomExercises()[id];
  assert.deepEqual(Object.keys(gone).sort(), ['deleted', 'id', 'updatedAt']);
  assert.equal(customToExercise(gone), null);
});

test('store: grava no localStorage e o snapshot só leva "exercises" quando existe algum registro', () => {
  const persisted = JSON.parse(backing.get('guitarTraining_v2'));
  assert.ok(Object.keys(persisted.exercises).length >= 1); // a lápide do teste anterior
  assert.ok('exercises' in store.snapshot());

  store.applyRemote({ logs: {}, speeds: {}, plans: {} }); // servidor sem a chave: nada criado
  assert.deepEqual(store.getCustomExercises(), {});
  assert.equal('exercises' in store.snapshot(), false);
});

test('store: applyRemote traz os exercícios criados em outro aparelho', () => {
  store.applyRemote({
    logs: {}, speeds: {}, plans: {},
    exercises: { meu_x: { id: 'meu_x', title: 'De outro aparelho', text: '', min: 10, createdAt: 1, updatedAt: 1 } },
  });
  assert.equal(customToExercise(store.getCustomExercises().meu_x).title, 'De outro aparelho');
  assert.equal(store.snapshot().exercises.meu_x.title, 'De outro aparelho');
});

test('store: guarda o bpm; editar sem bpm tira o metrônomo do exercício', () => {
  const id = makeCustomId();
  store.saveCustomExercise(id, { title: 'Com metrônomo', text: '', min: 10, bpm: { start: 60, goal: 100 } });
  assert.deepEqual(store.getCustomExercises()[id].bpm, { start: 60, goal: 100 });
  assert.deepEqual(customToExercise(store.getCustomExercises()[id]).bpm, { start: 60, goal: 100 });
  assert.deepEqual(store.snapshot().exercises[id].bpm, { start: 60, goal: 100 });

  store.saveCustomExercise(id, { title: 'Só texto agora', text: '', min: 10 });
  assert.equal('bpm' in store.getCustomExercises()[id], false);
});
