// AudioContext resistente a travas. Numa troca de saída de áudio (cabo, fone, Bluetooth) ou depois
// de muito tempo em segundo plano, o Android às vezes deixa o canal de áudio preso — sem erro
// nenhum, só silêncio (foi o que aconteceu: o YouTube tocava, o app não). Antes de cada som, o
// metrônomo e o "Ouvir" chamam ensureRunningContext, que confere se o canal está de fato tocando
// e, se não estiver, descarta e cria um canal novo — que nasce ligado na saída de áudio atual.

const RESUME_TIMEOUT_MS = 800;

// resume() as vezes nunca resolve nem rejeita quando o canal está realmente preso: sem isso, o
// app ficaria esperando para sempre.
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish(undefined), ms);
    Promise.resolve(promise).then(finish, () => finish(undefined));
  });
}

function defaultCreate() {
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  return Ctx ? new Ctx() : null;
}

// createContext é injetável para testar sem navegador (ver tests/audio-context.test.mjs).
export async function ensureRunningContext(existing, { createContext = defaultCreate } = {}) {
  let ctx = existing || createContext();
  if (!ctx) return null; // este navegador não tem Web Audio

  if (ctx.state !== 'running') {
    await withTimeout(ctx.resume(), RESUME_TIMEOUT_MS);
  }
  if (ctx.state === 'running') return ctx;

  // Preso: descarta e recria. O contexto novo nasce ligado na saída de áudio que estiver ativa agora.
  try { ctx.close(); } catch (e) { /* pode já estar fechado */ }
  const fresh = createContext();
  if (!fresh) return null;
  await withTimeout(fresh.resume(), RESUME_TIMEOUT_MS);
  return fresh;
}
