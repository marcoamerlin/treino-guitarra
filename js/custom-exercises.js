// Exercícios criados pelo próprio usuário (pedido de 2026-10-14). Por enquanto só texto: título,
// instruções e minutos. Funções puras (sem navegador), testadas em tests/custom-exercises.test.mjs.
//
// Guardados em data.exercises (store.js), um registro por id:
//   { id, title, text, min, bpm?, src?, note?, noteAt?, createdAt, updatedAt } — exercício (bpm:
//        {start, goal}, opcional; src: id de origem, se veio do professor; note/noteAt: observação do
//        aluno e o carimbo dela, que o merge escolhe à parte — ver mergeExercises em merge.js)
//   { id, deleted: true, updatedAt }                        — apagado (fica como "lápide")
// A lápide é o que faz o apagar sincronizar: se só sumisse da lista, o outro aparelho ainda teria
// o exercício e o merge (merge.js, vale o updatedAt mais novo por id) o traria de volta.

export const CUSTOM_CAT = 'meus';
export const LIMITS = {
  title: 80, text: 2000, minMin: 5, maxMin: 90, defaultMin: 10,
  minBpm: 30, maxBpm: 240, goalGap: 30, // mesma faixa da barra de BPM do app; meta padrão = início + 30
};

// Único entre aparelhos sem combinar nada: o carimbo de tempo mais um pedaço aleatório.
// O prefixo "meu_" não colide com nenhum id do banco de exercícios do app.
export function makeCustomId(now = Date.now(), random = Math.random) {
  const tail = Math.floor(random() * 36 ** 3).toString(36).padStart(3, '0');
  return `meu_${now.toString(36)}${tail}`;
}

export const isCustomId = (id) => typeof id === 'string' && id.startsWith('meu_');

// Limpa e valida o que veio do formulário. Só o título é obrigatório (um exercício como "Estudar
// aquela música" não precisa de instruções). Os minutos seguem o mesmo limite de 5 a 90 do resto
// do app e, se vierem vazios ou inválidos, usam o padrão em vez de recusar.
//
// Metrônomo é opcional: só um "BPM inicial" preenchido liga o quadro de velocidade (o mesmo dos
// exercícios do banco). Sem ele, o exercício segue só texto e a chave `bpm` nem existe. A meta,
// se vier vazia, é início + 30; nunca fica abaixo do início.
export function cleanFields({ title, text, min, bpmStart, bpmGoal } = {}) {
  const cleanTitle = String(title ?? '').trim().slice(0, LIMITS.title);
  if (!cleanTitle) return { ok: false, error: 'Dê um título ao exercício.' };
  const cleanText = String(text ?? '').trim().slice(0, LIMITS.text);
  const raw = Math.round(Number(min));
  const cleanMin = Number.isFinite(raw) && String(min ?? '').trim() !== ''
    ? Math.min(LIMITS.maxMin, Math.max(LIMITS.minMin, raw))
    : LIMITS.defaultMin;
  const value = { title: cleanTitle, text: cleanText, min: cleanMin };
  const bpm = cleanBpm(bpmStart, bpmGoal);
  if (bpm) value.bpm = bpm;
  return { ok: true, value };
}

const inBpmRange = (n) => Math.min(LIMITS.maxBpm, Math.max(LIMITS.minBpm, n));
const typed = (v) => String(v ?? '').trim() !== '' && Number.isFinite(Math.round(Number(v)));

function cleanBpm(start, goal) {
  if (!typed(start)) return null;
  const s = inBpmRange(Math.round(Number(start)));
  const g = typed(goal) ? Math.max(s, inBpmRange(Math.round(Number(goal)))) : Math.min(LIMITS.maxBpm, s + LIMITS.goalGap);
  return { start: s, goal: g };
}

// Registro guardado -> o formato que as telas já usam para os exercícios do banco (id, title,
// cat, min...). null para registro ausente ou apagado: quem chama trata como "exercício que não
// existe mais", igual a um id desconhecido.
export function customToExercise(record) {
  if (!record || record.deleted || !record.title) return null;
  const ex = {
    id: record.id,
    title: record.title,
    subtitle: '',
    cat: CUSTOM_CAT,
    min: record.min,
    text: record.text || '',
    custom: true,
  };
  if (record.src) ex.fromTeacher = true; // veio de uma atribuição do professor (virou do aluno)
  if (record.note) ex.note = record.note; // observação do aluno
  // Registro vindo de outro aparelho/professor não é confiável: só vale com os dois números certos.
  const b = record.bpm;
  if (b && Number.isFinite(b.start) && Number.isFinite(b.goal)) ex.bpm = { start: b.start, goal: b.goal };
  return ex;
}

// Atribuir um exercício do professor a um aluno = dar ao aluno uma CÓPIA, que passa a ser dele
// (pedido do usuário, 2026-10-15): o aluno edita à vontade sem mexer no original nem nas cópias dos
// outros alunos. `src` guarda o id do exercício de origem; é por ele que atribuir o mesmo exercício
// de novo ao mesmo aluno reaproveita a cópia que ele já tem (e já pode ter personalizado), em vez
// de criar duplicata ou sobrescrever a versão dele.
export function makeStudentCopy(ex, { now = Date.now(), random = Math.random } = {}) {
  const copy = {
    id: makeCustomId(now, random),
    title: ex.title,
    text: ex.text || '',
    min: ex.min,
    src: ex.id,
    createdAt: now,
    updatedAt: now,
  };
  if (ex.bpm) copy.bpm = { start: ex.bpm.start, goal: ex.bpm.goal };
  return copy;
}

// Procura, em um ou mais mapas de registros, a cópia (não apagada) feita a partir de `srcId`.
export function findCopyOf(srcId, ...maps) {
  for (const map of maps) {
    const hit = Object.values(map || {}).find((rec) => rec && !rec.deleted && rec.src === srcId);
    if (hit) return hit;
  }
  return null;
}

// Todos os exercícios criados e não apagados, em ordem alfabética (pra lista do banco).
export function customList(records = {}) {
  return Object.values(records)
    .map(customToExercise)
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}
