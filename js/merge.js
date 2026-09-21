// Combina os dados de dois aparelhos sem que um apague o trabalho do outro.
// Funções puras (sem navegador), testadas em tests/merge.test.mjs.
//
// Regras:
//  - logs: cada exercício marcado (done) vale pelo carimbo de tempo mais novo; notas idem.
//  - speeds e plans: vence o registro alterado por último (updatedAt).

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
  return { done, t, notes: notesSource.notes || '', notesAt: Math.max(nx, ny) };
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

export function mergeData(local = {}, remote = {}) {
  return {
    logs: mergeLogs(local.logs, remote.logs),
    speeds: mergeRecords(local.speeds, remote.speeds),
    plans: mergeRecords(local.plans, remote.plans),
  };
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
