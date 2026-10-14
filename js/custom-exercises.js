// Exercícios criados pelo próprio usuário (pedido de 2026-10-14). Por enquanto só texto: título,
// instruções e minutos. Funções puras (sem navegador), testadas em tests/custom-exercises.test.mjs.
//
// Guardados em data.exercises (store.js), um registro por id:
//   { id, title, text, min, createdAt, updatedAt }          — exercício
//   { id, deleted: true, updatedAt }                        — apagado (fica como "lápide")
// A lápide é o que faz o apagar sincronizar: se só sumisse da lista, o outro aparelho ainda teria
// o exercício e o merge (merge.js, vale o updatedAt mais novo por id) o traria de volta.

export const CUSTOM_CAT = 'meus';
export const LIMITS = { title: 80, text: 2000, minMin: 5, maxMin: 90, defaultMin: 10 };

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
export function cleanFields({ title, text, min } = {}) {
  const cleanTitle = String(title ?? '').trim().slice(0, LIMITS.title);
  if (!cleanTitle) return { ok: false, error: 'Dê um título ao exercício.' };
  const cleanText = String(text ?? '').trim().slice(0, LIMITS.text);
  const raw = Math.round(Number(min));
  const cleanMin = Number.isFinite(raw) && String(min ?? '').trim() !== ''
    ? Math.min(LIMITS.maxMin, Math.max(LIMITS.minMin, raw))
    : LIMITS.defaultMin;
  return { ok: true, value: { title: cleanTitle, text: cleanText, min: cleanMin } };
}

// Registro guardado -> o formato que as telas já usam para os exercícios do banco (id, title,
// cat, min...). null para registro ausente ou apagado: quem chama trata como "exercício que não
// existe mais", igual a um id desconhecido.
export function customToExercise(record) {
  if (!record || record.deleted || !record.title) return null;
  return {
    id: record.id,
    title: record.title,
    subtitle: '',
    cat: CUSTOM_CAT,
    min: record.min,
    text: record.text || '',
    custom: true,
  };
}

// Todos os exercícios criados e não apagados, em ordem alfabética (pra lista do banco).
export function customList(records = {}) {
  return Object.values(records)
    .map(customToExercise)
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}
