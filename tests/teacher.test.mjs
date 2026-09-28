import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  myCode, linkToTeacher, myTeacher, listStudents, unlink, fetchStudentData, writeStudentPlan,
  writeStudentSpeed,
} from '../js/teacher-core.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Supabase de mentira: só as 3 tabelas e os métodos que teacher-core.js realmente usa.
function makeServer() {
  const db = { teacher_codes: [], teacher_links: [], user_data: [] };
  const server = { db, beforeUpdate: null };

  server.client = {
    from(table) {
      const rows = db[table];
      return {
        select: (cols) => {
          let filtered = rows;
          const api = {
            eq(col, val) {
              filtered = filtered.filter((r) => r[col] === val);
              return api;
            },
            order(col) {
              filtered = [...filtered].sort((a, b) => (a[col] > b[col] ? 1 : -1));
              return Promise.resolve({ data: clone(filtered), error: null });
            },
            async maybeSingle() {
              return { data: filtered[0] ? clone(filtered[0]) : null, error: null };
            },
          };
          void cols;
          return api;
        },
        async insert(obj) {
          const pk = table === 'teacher_codes' ? 'teacher_id' : table === 'teacher_links' ? 'student_id' : 'user_id';
          if (rows.some((r) => r[pk] === obj[pk])) return { error: { code: '23505', message: 'duplicate' } };
          if (table === 'teacher_codes' && rows.some((r) => r.code === obj.code)) {
            return { error: { code: '23505', message: 'duplicate code' } };
          }
          rows.push(clone(obj));
          return { error: null };
        },
        async upsert(obj) {
          const pk = 'student_id';
          const i = rows.findIndex((r) => r[pk] === obj[pk]);
          if (i >= 0) rows[i] = clone(obj); else rows.push(clone(obj));
          return { error: null };
        },
        update(obj) {
          return {
            eq: (col1, val1) => ({
              eq: (col2, val2) => ({
                async select() {
                  if (server.beforeUpdate) { const hook = server.beforeUpdate; server.beforeUpdate = null; hook(); }
                  const row = rows.find((r) => r[col1] === val1 && r[col2] === val2);
                  if (!row) return { data: [], error: null };
                  Object.assign(row, clone(obj));
                  return { data: [{ rev: row.rev }], error: null };
                },
              }),
            }),
          };
        },
        delete() {
          return {
            async eq(col, val) {
              const i = rows.findIndex((r) => r[col] === val);
              if (i >= 0) rows.splice(i, 1);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return server;
}

test('myCode: gera um código na primeira vez e devolve o mesmo depois', async () => {
  const { client } = makeServer();
  const code1 = await myCode(client, 't1', 'prof@x.com');
  const code2 = await myCode(client, 't1', 'prof@x.com');
  assert.equal(code1, code2);
  assert.equal(code1.length, 6);
});

test('linkToTeacher: aluno se vincula pelo código; código inexistente dá erro claro', async () => {
  const { client } = makeServer();
  const code = await myCode(client, 't1', 'prof@x.com');
  const result = await linkToTeacher(client, 's1', 'aluno@x.com', code.toLowerCase()); // minúsculo também funciona
  assert.equal(result.teacherEmail, 'prof@x.com');
  await assert.rejects(() => linkToTeacher(client, 's2', 'outro@x.com', 'ZZZZZZ'), /não encontrado/i);
});

test('linkToTeacher: não deixa vincular ao próprio código', async () => {
  const { client } = makeServer();
  const code = await myCode(client, 't1', 'prof@x.com');
  await assert.rejects(() => linkToTeacher(client, 't1', 'prof@x.com', code), /próprio código/i);
});

test('linkToTeacher: vincular de novo troca de professor (student_id é a chave)', async () => {
  const { client } = makeServer();
  const codeA = await myCode(client, 'tA', 'a@x.com');
  const codeB = await myCode(client, 'tB', 'b@x.com');
  await linkToTeacher(client, 's1', 'aluno@x.com', codeA);
  await linkToTeacher(client, 's1', 'aluno@x.com', codeB);
  const found = await myTeacher(client, 's1');
  assert.equal(found.teacher_email, 'b@x.com');
});

test('listStudents e unlink', async () => {
  const { client } = makeServer();
  const code = await myCode(client, 't1', 'prof@x.com');
  await linkToTeacher(client, 's1', 'ana@x.com', code);
  await linkToTeacher(client, 's2', 'bia@x.com', code);
  const students = await listStudents(client, 't1');
  assert.deepEqual(students.map((s) => s.student_email), ['ana@x.com', 'bia@x.com']);

  await unlink(client, 's1');
  const after = await listStudents(client, 't1');
  assert.deepEqual(after.map((s) => s.student_email), ['bia@x.com']);
  assert.equal(await myTeacher(client, 's1'), null);
});

test('fetchStudentData: null quando o aluno nunca sincronizou', async () => {
  const { client } = makeServer();
  assert.equal(await fetchStudentData(client, 's1'), null);
});

test('writeStudentPlan: cria a linha do aluno se ele nunca sincronizou', async () => {
  const { client, db } = makeServer();
  await writeStudentPlan(client, 's1', 'seg', [{ ex: 'chroma', min: 10 }]);
  assert.equal(db.user_data[0].rev, 1);
  assert.deepEqual(db.user_data[0].data.plans.seg.items, [{ ex: 'chroma', min: 10 }]);
});

test('writeStudentPlan: troca só o dia editado, sem mexer em logs/speeds nem noutros dias', async () => {
  const { client, db } = makeServer();
  db.user_data.push({
    user_id: 's1',
    rev: 3,
    data: {
      logs: { '2026-09-28_seg': { done: { chroma: true }, t: {}, notes: '', notesAt: 0 } },
      speeds: { chroma: { bpm: 80 } },
      plans: { ter: { items: [{ ex: 'leg_1', min: 8 }], updatedAt: 1 } },
    },
  });
  await writeStudentPlan(client, 's1', 'seg', [{ ex: 'seq4', min: 8 }]);
  const row = db.user_data[0];
  assert.equal(row.rev, 4);
  assert.deepEqual(row.data.plans.seg.items, [{ ex: 'seq4', min: 8 }]);
  assert.deepEqual(row.data.plans.ter.items, [{ ex: 'leg_1', min: 8 }]); // dia intocado
  assert.deepEqual(row.data.logs['2026-09-28_seg'].done, { chroma: true }); // log intocado
  assert.equal(row.data.speeds.chroma.bpm, 80); // velocidade intocada
});

test('writeStudentPlan: se o aluno grava no meio da rodada, refaz e não perde a escrita', async () => {
  const { client, db } = makeServer();
  db.user_data.push({ user_id: 's1', rev: 1, data: { logs: {}, speeds: {}, plans: {} } });
  const server = { beforeUpdate: null };
  let hookRan = false;
  // na primeira tentativa de update, simula o aluno sincronizando antes (rev sobe embaixo do pé)
  const origUpdate = client.from;
  client.from = (table) => {
    const api = origUpdate(table);
    if (table === 'user_data') {
      const origUpdateFn = api.update;
      api.update = (obj) => {
        const chain = origUpdateFn(obj);
        const origEq = chain.eq;
        chain.eq = (col1, val1) => {
          const inner = origEq(col1, val1);
          const origEq2 = inner.eq;
          inner.eq = (col2, val2) => {
            if (!hookRan) { hookRan = true; db.user_data[0].rev = 2; }
            return origEq2(col2, val2);
          };
          return inner;
        };
        return chain;
      };
    }
    return api;
  };
  void server;
  await writeStudentPlan(client, 's1', 'seg', [{ ex: 'chroma', min: 5 }]);
  assert.equal(db.user_data[0].rev, 3); // 1 -> (conflito, rev virou 2 por fora) -> refaz -> 3
  assert.deepEqual(db.user_data[0].data.plans.seg.items, [{ ex: 'chroma', min: 5 }]);
});

test('writeStudentSpeed: cria a linha do aluno (nunca sincronizou) a partir do bpm inicial do exercício', async () => {
  const { client, db } = makeServer();
  const bpm = await writeStudentSpeed(client, 's1', 'chroma', 4, 60, '2026-09-28');
  assert.equal(bpm, 64); // 60 (start) + 4
  assert.equal(db.user_data[0].data.speeds.chroma.bpm, 64);
  assert.equal(db.user_data[0].data.speeds.chroma.clean, 0);
  assert.deepEqual(db.user_data[0].data.speeds.chroma.history, [{ date: '2026-09-28', bpm: 64 }]);
});

test('writeStudentSpeed: soma ao bpm atual do aluno (não ao "start" do exercício) e respeita limites', async () => {
  const { client, db } = makeServer();
  db.user_data.push({
    user_id: 's1', rev: 1,
    data: { logs: {}, plans: {}, speeds: { chroma: { bpm: 258, clean: 3, errors: 0, history: [] } } },
  });
  const bpm = await writeStudentSpeed(client, 's1', 'chroma', 4, 60, '2026-09-28');
  assert.equal(bpm, 260); // 258+4=262, mas o teto é 260
  assert.equal(db.user_data[0].data.speeds.chroma.clean, 0); // zera ao ajustar, igual ao store.js
});

test('writeStudentSpeed: só mexe em speeds, não em plans nem logs', async () => {
  const { client, db } = makeServer();
  db.user_data.push({
    user_id: 's1', rev: 1,
    data: { logs: { x: 1 }, plans: { seg: { items: [{ ex: 'chroma', min: 10 }], updatedAt: 1 } }, speeds: {} },
  });
  await writeStudentSpeed(client, 's1', 'chroma', -4, 60, '2026-09-28');
  assert.deepEqual(db.user_data[0].data.logs, { x: 1 });
  assert.deepEqual(db.user_data[0].data.plans.seg.items, [{ ex: 'chroma', min: 10 }]);
});
