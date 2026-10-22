// Combina os dados de dois aparelhos sem que um apague o trabalho do outro.
// Funções puras (sem navegador), testadas em tests/merge.test.mjs.
//
// Regras:
//  - logs: cada exercício marcado (done) vale pelo carimbo de tempo mais novo; notas idem.
//  - speeds, plans e exercises: vence o registro alterado por último (updatedAt); só que, nos
//    exercícios, a observação do aluno (note/noteAt) é escolhida à parte (ver mergeExercises).
//  - plan (dentro de um log): foto do plano do dia, gravada uma vez no 1º toque e nunca mais
//    mudada (ver store.js); os dois aparelhos calculam ela a partir do mesmo plano quase no
//    mesmo instante, então não precisa de carimbo — só fica com quem já tiver uma.

const clone = (value) => JSON.parse(JSON.stringify(value));

function mergeLog(x, y) {
  const done = {};
  const t = {};
  const ids = new Set([...Object.keys(x.done || {}), ...Object.keys(y.done || {})]);
  ids.forEach((id) => {
    const tx = (x.t && x.t[id]) || 0;
    const ty = (y.t && y.t[id]) || 0;
    const source = tx >= ty ? x : y; // empate: fica o primeiro (local)
    done[id] = Boolean(source.done && source.done[id]);
    t[id] = Math.max(tx, ty);
  });
  const nx = x.notesAt || 0;
  const ny = y.notesAt || 0;
  const notesSource = nx >= ny ? x : y;
  const merged = { done, t, notes: notesSource.notes || '', notesAt: Math.max(nx, ny) };
  const plan = x.plan || y.plan;
  if (plan) merged.plan = plan;
  return merged;
}

export function mergeLogs(a = {}, b = {}) {
  const out = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((key) => {
    out[key] = a[key] && b[key] ? mergeLog(a[key], b[key]) : clone(a[key] || b[key]);
  });
  return out;
}

export function mergeRecords(a = {}, b = {}) {
  const out = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((key) => {
    const x = a[key];
    const y = b[key];
    if (!x || !y) out[key] = clone(x || y);
    else out[key] = clone((x.updatedAt || 0) >= (y.updatedAt || 0) ? x : y);
  });
  return out;
}

// Exercícios: o registro inteiro vale pelo updatedAt mais novo, MAS a observação do aluno (`note`)
// tem carimbo próprio (`noteAt`) e é escolhida à parte. Sem isso, uma correção do professor (que
// atualiza o conteúdo da cópia do aluno) apagaria uma observação que o aluno acabou de escrever
// e ainda não sincronizou. Registro de antes do `noteAt` conta a observação com o updatedAt dele.
const noteStamp = (rec) => (rec && !rec.deleted ? rec.noteAt ?? (rec.note ? rec.updatedAt || 0 : 0) : 0);

export function mergeExercises(a = {}, b = {}) {
  const out = mergeRecords(a, b);
  Object.keys(out).forEach((id) => {
    const x = a[id];
    const y = b[id];
    const winner = out[id];
    if (!x || !y || winner.deleted) return;
    const nx = noteStamp(x);
    const ny = noteStamp(y);
    if (nx === ny) return;
    const source = nx > ny ? x : y;
    if (source.note) winner.note = source.note; else delete winner.note;
    winner.noteAt = nx > ny ? nx : ny;
  });
  return out;
}

export function mergeData(local = {}, remote = {}) {
  const merged = {
    logs: mergeLogs(local.logs, remote.logs),
    speeds: mergeRecords(local.speeds, remote.speeds),
    plans: mergeRecords(local.plans, remote.plans),
  };
  // exercises (criados pelo usuário, ver custom-exercises.js): vale o updatedAt mais novo por id,
  // inclusive a lápide de um exercício apagado. A chave só entra quando existe algum: a linha de
  // quem nunca criou nada continua exatamente como era (sem escrita extra no servidor, e
  // sameData(merged, local) segue igual — store.snapshot() também omite a chave quando vazia).
  const exercises = mergeExercises(local.exercises, remote.exercises);
  if (Object.keys(exercises).length) merged.exercises = exercises;
  return merged;
}

// Serialização com chaves ordenadas: o Postgres (jsonb) reordena as chaves,
// então comparar JSON.stringify direto acusaria diferença que não existe.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => { acc[key] = canonical(value[key]); return acc; }, {});
  }
  return value;
}

export const sameData = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
