// Vínculo professor/aluno e edição do plano do aluno pelo professor.
// Não depende do navegador: recebe o client do Supabase já autenticado (ver teacher.js), o
// mesmo client de sync-core.js — não abre outra conexão. Funções puras o bastante para testar
// com um client de mentira (ver tests/teacher.test.mjs), no mesmo espírito de sync-core.js.
//
// Tabelas (ver supabase/schema.sql): teacher_codes (1 por professor) e teacher_links (1 por
// aluno — cada aluno só tem 1 professor por vez). O vínculo nasce do aluno, digitando o código.

const MAX_ATTEMPTS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I, pra não confundir no dedo
const MIN_BPM = 30;
const MAX_BPM = 260;
const clampBpm = (bpm) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

function randomCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// Devolve o código do professor, criando um na primeira vez.
export async function myCode(client, teacherId, teacherEmail) {
  const { data: row, error } = await client
    .from('teacher_codes').select('code').eq('teacher_id', teacherId).maybeSingle();
  if (error) throw error;
  if (row) return row.code;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const { error: insertError } = await client
      .from('teacher_codes').insert({ teacher_id: teacherId, code, teacher_email: teacherEmail });
    if (!insertError) return code;
    if (insertError.code !== '23505') throw insertError; // código colidiu: tenta outro
  }
  throw new Error('Não consegui gerar um código agora. Tente de novo.');
}

// Aluno se vincula a um professor a partir do código. Troca o professor se já tinha um (o aluno
// só tem 1 por vez — student_id é chave primária de teacher_links).
export async function linkToTeacher(client, studentId, studentEmail, code) {
  const clean = code.trim().toUpperCase();
  const { data: found, error } = await client
    .from('teacher_codes').select('teacher_id, teacher_email').eq('code', clean).maybeSingle();
  if (error) throw error;
  if (!found) throw new Error('Código não encontrado. Confira com o professor.');
  if (found.teacher_id === studentId) throw new Error('Esse é o seu próprio código.');

  const row = {
    student_id: studentId,
    teacher_id: found.teacher_id,
    student_email: studentEmail,
    teacher_email: found.teacher_email,
  };
  const { error: upsertError } = await client.from('teacher_links').upsert(row);
  if (upsertError) throw upsertError;
  return { teacherEmail: found.teacher_email };
}

export async function myTeacher(client, studentId) {
  const { data, error } = await client
    .from('teacher_links').select('teacher_email, created_at').eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listStudents(client, teacherId) {
  const { data, error } = await client
    .from('teacher_links').select('student_id, student_email, created_at')
    .eq('teacher_id', teacherId).order('student_email');
  if (error) throw error;
  return data || [];
}

// Desfaz o vínculo — student_id é a chave, então serve tanto pro professor quanto pro aluno.
export async function unlink(client, studentId) {
  const { error } = await client.from('teacher_links').delete().eq('student_id', studentId);
  if (error) throw error;
}

// Dados do aluno (para a tela de progresso): logs, speeds e plans, iguais ao que o próprio
// aluno sincroniza. null se o aluno ainda não sincronizou nenhuma vez.
export async function fetchStudentData(client, studentId) {
  const { data, error } = await client
    .from('user_data').select('data, rev').eq('user_id', studentId).maybeSingle();
  if (error) throw error;
  return data ? { data: data.data || {}, rev: data.rev } : null;
}

// Professor grava o plano de um dia do aluno, sem tocar em logs/speeds nem nos outros dias —
// controle otimista igual ao sync-core.js (lê, aplica só essa chave, grava se rev não mudou).
// Todo item salvo aqui vira locked: true (pedido do usuário, 2026-09-29) — o aluno pode reordenar
// e ajustar tempo/BPM, mas não remover nem trocar um exercício que o professor definiu; só os que
// ele mesmo adicionar depois (sem essa marca) ficam livres pra remover/trocar. Ver exerciseCard em
// app.js.
export async function writeStudentPlan(client, studentId, dayKey, items) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: row, error } = await client
      .from('user_data').select('data, rev').eq('user_id', studentId).maybeSingle();
    if (error) throw error;

    const plan = { items: items.map((item) => ({ ...item, locked: true })), updatedAt: Date.now() };
    if (!row) {
      const fresh = { logs: {}, speeds: {}, plans: { [dayKey]: plan } };
      const { error: insertError } = await client
        .from('user_data').insert({ user_id: studentId, data: fresh, rev: 1 });
      if (!insertError) return;
      if (insertError.code === '23505') continue; // o aluno sincronizou entre a leitura e a escrita
      throw insertError;
    }

    const nextData = { ...row.data, plans: { ...(row.data.plans || {}), [dayKey]: plan } };
    const { data: updated, error: updateError } = await client
      .from('user_data')
      .update({ data: nextData, rev: row.rev + 1, updated_at: new Date().toISOString() })
      .eq('user_id', studentId)
      .eq('rev', row.rev)
      .select('rev');
    if (updateError) throw updateError;
    if (updated && updated.length) return;
    // rev mudou entre a leitura e a escrita (aluno sincronizou nesse meio-tempo): refaz.
  }
  throw new Error('Não consegui salvar agora (o aluno estava sincronizando). Tente de novo.');
}

function pushHistory(speed, dateStr) {
  const history = [...(speed.history || [])];
  const last = history[history.length - 1];
  if (last && last.date === dateStr) last.bpm = speed.bpm;
  else history.push({ date: dateStr, bpm: speed.bpm });
  return history.slice(-60);
}

// Professor ajusta a velocidade (BPM) de um exercício do aluno — mesmo formato de store.js
// (bpm/clean/errors/history), controle otimista igual a writeStudentPlan. delta é somado ao BPM
// atual do aluno (ou ao "start" do exercício, se ele nunca tiver praticado esse exercício ainda);
// zera clean/errors, do mesmo jeito que ajustar na régua +/- durante o treino.
export async function writeStudentSpeed(client, studentId, exId, delta, startBpm, dateStr) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: row, error } = await client
      .from('user_data').select('data, rev').eq('user_id', studentId).maybeSingle();
    if (error) throw error;

    const current = row && row.data.speeds && row.data.speeds[exId];
    const bpm = clampBpm((current ? current.bpm : startBpm) + delta);
    const speed = { ...(current || {}), bpm, clean: 0, errors: 0, updatedAt: Date.now() };
    speed.history = pushHistory(speed, dateStr);

    if (!row) {
      const fresh = { logs: {}, plans: {}, speeds: { [exId]: speed } };
      const { error: insertError } = await client
        .from('user_data').insert({ user_id: studentId, data: fresh, rev: 1 });
      if (!insertError) return bpm;
      if (insertError.code === '23505') continue;
      throw insertError;
    }

    const nextData = { ...row.data, speeds: { ...(row.data.speeds || {}), [exId]: speed } };
    const { data: updated, error: updateError } = await client
      .from('user_data')
      .update({ data: nextData, rev: row.rev + 1, updated_at: new Date().toISOString() })
      .eq('user_id', studentId)
      .eq('rev', row.rev)
      .select('rev');
    if (updateError) throw updateError;
    if (updated && updated.length) return bpm;
  }
  throw new Error('Não consegui salvar agora (o aluno estava sincronizando). Tente de novo.');
}
