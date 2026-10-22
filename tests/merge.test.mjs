import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, sameData } from '../js/merge.js';

const log = (done, t, notes = '', notesAt = 0) => ({ done, t, notes, notesAt });

test('exercícios marcados em aparelhos diferentes no mesmo dia são somados', () => {
  const phone = { logs: { '2026-09-21_seg': log({ chroma: true }, { chroma: 100 }) } };
  const laptop = { logs: { '2026-09-21_seg': log({ pent1: true }, { pent1: 200 }) } };
  const merged = mergeData(phone, laptop).logs['2026-09-21_seg'];
  assert.deepEqual(merged.done, { chroma: true, pent1: true });
});

test('o desmarcar mais recente vence o marcar mais antigo', () => {
  const a = { logs: { k: log({ chroma: true }, { chroma: 100 }) } };
  const b = { logs: { k: log({ chroma: false }, { chroma: 300 }) } };
  assert.equal(mergeData(a, b).logs.k.done.chroma, false);
  assert.equal(mergeData(b, a).logs.k.done.chroma, false);
});

test('a nota mais recente vence', () => {
  const a = { logs: { k: log({}, {}, 'texto antigo', 100) } };
  const b = { logs: { k: log({}, {}, 'texto novo', 200) } };
  assert.equal(mergeData(a, b).logs.k.notes, 'texto novo');
  assert.equal(mergeData(b, a).logs.k.notes, 'texto novo');
});

test('velocidade: vence o registro alterado por último', () => {
  const a = { speeds: { riff1: { bpm: 74, updatedAt: 100 } } };
  const b = { speeds: { riff1: { bpm: 78, updatedAt: 200 } }, };
  assert.equal(mergeData(a, b).speeds.riff1.bpm, 78);
  assert.equal(mergeData(b, a).speeds.riff1.bpm, 78);
});

test('velocidades de exercícios diferentes convivem', () => {
  const a = { speeds: { riff1: { bpm: 74, updatedAt: 100 } } };
  const b = { speeds: { chroma: { bpm: 64, updatedAt: 50 } } };
  const merged = mergeData(a, b).speeds;
  assert.equal(merged.riff1.bpm, 74);
  assert.equal(merged.chroma.bpm, 64);
});

test('restaurar o plano padrão (items null) mais recente vence a personalização antiga', () => {
  const custom = { plans: { ter: { items: [{ ex: 'jam', min: 60 }], updatedAt: 100 } } };
  const reset = { plans: { ter: { items: null, updatedAt: 200 } } };
  assert.equal(mergeData(custom, reset).plans.ter.items, null);
  assert.equal(mergeData(reset, custom).plans.ter.items, null);
});

test('merge com dados vazios ou ausentes não quebra e não muda nada', () => {
  const data = { logs: { k: log({ a: true }, { a: 1 }) }, speeds: { x: { bpm: 60, updatedAt: 1 } }, plans: {} };
  assert.ok(sameData(mergeData(data, {}), data));
  assert.ok(sameData(mergeData({}, data), data));
  assert.deepEqual(mergeData(), { logs: {}, speeds: {}, plans: {} });
});

test('merge é idempotente e comutativo quando os carimbos são distintos', () => {
  const a = { logs: { k: log({ a: true }, { a: 10 }, 'x', 5) }, speeds: { s: { bpm: 1, updatedAt: 1 } }, plans: {} };
  const b = { logs: { k: log({ a: false, b: true }, { a: 20, b: 30 }, 'y', 9) }, speeds: { s: { bpm: 2, updatedAt: 2 } }, plans: {} };
  const ab = mergeData(a, b);
  assert.ok(sameData(ab, mergeData(b, a)));
  assert.ok(sameData(ab, mergeData(ab, b)));
  assert.ok(sameData(ab, mergeData(ab, ab)));
});

test('log.plan (foto do plano do dia): mantém quando só um lado tem, e não perde no merge', () => {
  const withPlan = { logs: { k: log({ chroma: true }, { chroma: 100 }) } };
  withPlan.logs.k.plan = [{ ex: 'chroma', min: 10 }];
  const without = { logs: { k: log({ chroma: true }, { chroma: 100 }) } };
  assert.deepEqual(mergeData(withPlan, without).logs.k.plan, [{ ex: 'chroma', min: 10 }]);
  assert.deepEqual(mergeData(without, withPlan).logs.k.plan, [{ ex: 'chroma', min: 10 }]);
});

test('log.plan: se os dois lados já têm (2 aparelhos criando o mesmo dia quase junto), fica um dos dois, não vira null', () => {
  const a = { logs: { k: log({}, {}) } };
  a.logs.k.plan = [{ ex: 'chroma', min: 10 }];
  const b = { logs: { k: log({}, {}) } };
  b.logs.k.plan = [{ ex: 'chroma', min: 10 }]; // mesmo plano, calculado nos dois aparelhos
  const merged = mergeData(a, b).logs.k;
  assert.deepEqual(merged.plan, [{ ex: 'chroma', min: 10 }]);
});

test('sameData ignora a ordem das chaves (o jsonb do Postgres reordena)', () => {
  assert.ok(sameData({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!sameData({ a: 1 }, { a: 2 }));
});

test('exercises (criados pelo usuário): exercícios de aparelhos diferentes se somam', () => {
  const a = { exercises: { meu_a: { id: 'meu_a', title: 'A', min: 10, updatedAt: 100 } } };
  const b = { exercises: { meu_b: { id: 'meu_b', title: 'B', min: 10, updatedAt: 200 } } };
  assert.deepEqual(Object.keys(mergeData(a, b).exercises).sort(), ['meu_a', 'meu_b']);
});

test('exercises: a edição mais recente vence, nos dois sentidos', () => {
  const old = { exercises: { meu_a: { id: 'meu_a', title: 'antigo', min: 10, updatedAt: 100 } } };
  const recent = { exercises: { meu_a: { id: 'meu_a', title: 'novo', min: 10, updatedAt: 300 } } };
  assert.equal(mergeData(old, recent).exercises.meu_a.title, 'novo');
  assert.equal(mergeData(recent, old).exercises.meu_a.title, 'novo');
});

test('exercises: apagar mais recente vence a edição antiga (a lápide impede o exercício de voltar)', () => {
  const edited = { exercises: { meu_a: { id: 'meu_a', title: 'A', min: 10, updatedAt: 100 } } };
  const deleted = { exercises: { meu_a: { id: 'meu_a', deleted: true, updatedAt: 200 } } };
  assert.equal(mergeData(edited, deleted).exercises.meu_a.deleted, true);
  assert.equal(mergeData(deleted, edited).exercises.meu_a.deleted, true);
  // e o contrário: recriar/editar depois de apagado em outro aparelho vence a lápide
  const revived = { exercises: { meu_a: { id: 'meu_a', title: 'A2', min: 10, updatedAt: 300 } } };
  assert.equal(mergeData(deleted, revived).exercises.meu_a.title, 'A2');
});

test('exercises: quem nunca criou nenhum não ganha a chave (a linha no servidor fica igual)', () => {
  const merged = mergeData({ logs: {}, speeds: {}, plans: {} }, { logs: {}, speeds: {}, plans: {} });
  assert.equal('exercises' in merged, false);
  const withOne = mergeData({ exercises: { meu_a: { id: 'meu_a', title: 'A', updatedAt: 1 } } }, {});
  assert.ok(sameData(withOne, mergeData(withOne, {})));
});

// ---- observação do aluno x correção do professor (2026-10-15) ----

const copy = (extra = {}) => ({ id: 'meu_c', title: 'Spider', text: 'v1', min: 8, src: 'meu_p', createdAt: 1, updatedAt: 100, ...extra });
const ex = (rec) => ({ exercises: { meu_c: rec } });

test('exercises: correção do professor (updatedAt maior) não apaga a observação ainda não sincronizada do aluno', () => {
  const alunoLocal = ex(copy({ note: 'travei no 3º compasso', noteAt: 150, updatedAt: 150 }));
  const professor = ex(copy({ text: 'v2 corrigido', updatedAt: 200 })); // não conhece a observação
  const merged = mergeData(alunoLocal, professor).exercises.meu_c;
  assert.equal(merged.text, 'v2 corrigido');           // conteúdo: vale o mais novo
  assert.equal(merged.note, 'travei no 3º compasso');  // observação: vale a dela, à parte
  assert.equal(merged.noteAt, 150);
  // e o contrário (o aluno é o "remoto"): mesmo resultado
  assert.deepEqual(mergeData(professor, alunoLocal).exercises.meu_c, merged);
});

test('exercises: a observação mais nova vence, inclusive quando o aluno a apagou', () => {
  const velha = ex(copy({ note: 'antiga', noteAt: 120, updatedAt: 120 }));
  const nova = ex(copy({ note: 'nova', noteAt: 180, updatedAt: 180 }));
  assert.equal(mergeData(velha, nova).exercises.meu_c.note, 'nova');
  assert.equal(mergeData(nova, velha).exercises.meu_c.note, 'nova');

  const apagada = ex(copy({ noteAt: 190, updatedAt: 190 })); // sem note, mas com noteAt: foi apagada depois
  const merged = mergeData(nova, apagada).exercises.meu_c;
  assert.equal('note' in merged, false);
  assert.equal(merged.noteAt, 190);
});

test('exercises: registro de antes do noteAt conta a observação com o updatedAt dele', () => {
  const legado = ex(copy({ note: 'sem noteAt', updatedAt: 140 }));
  const professor = ex(copy({ text: 'v2', updatedAt: 200 }));
  const merged = mergeData(legado, professor).exercises.meu_c;
  assert.equal(merged.note, 'sem noteAt');
  assert.equal(merged.text, 'v2');
});

test('exercises: apagado continua vencendo e não ganha observação; sem observação em lado nenhum, nada muda', () => {
  const lapide = ex({ id: 'meu_c', deleted: true, updatedAt: 300 });
  const comNota = ex(copy({ note: 'x', noteAt: 150 }));
  const merged = mergeData(lapide, comNota).exercises.meu_c;
  assert.equal(merged.deleted, true);
  assert.equal('note' in merged, false);

  const a = ex(copy({ updatedAt: 100 }));
  const b = ex(copy({ text: 'v2', updatedAt: 200 }));
  assert.deepEqual(mergeData(a, b).exercises.meu_c, b.exercises.meu_c);
  assert.ok(sameData(mergeData(comNota, {}), mergeData(mergeData(comNota, {}), comNota)));
});
