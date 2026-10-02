// Detecção de altura (frequência) para o afinador. Funções puras: recebem amostras de áudio e
// devolvem números, sem tocar em navegador nem microfone — dá pra testar com sinais sintéticos
// (ver tests/pitch.test.mjs). A ligação com o microfone fica em tuner.js.

// As 6 cordas soltas, da mais grave (6ª) para a mais aguda (1ª). midi 40 = Mi2 ... 64 = Mi4,
// a mesma numeração de tab-player.js (OPEN_MIDI) e das gravações em audio/guitar-clean/.
export const GUITAR_STRINGS = [
  { letter: 'E', pt: 'Mi grave', pos: 6, midi: 40 },
  { letter: 'A', pt: 'Lá', pos: 5, midi: 45 },
  { letter: 'D', pt: 'Ré', pos: 4, midi: 50 },
  { letter: 'G', pt: 'Sol', pos: 3, midi: 55 },
  { letter: 'B', pt: 'Si', pos: 2, midi: 59 },
  { letter: 'E', pt: 'Mi agudo', pos: 1, midi: 64 },
].map((s) => ({ ...s, freq: 440 * 2 ** ((s.midi - 69) / 12) }));

// Dentro de ± este valor (em cents, 1/100 de semitom) a corda conta como afinada.
export const IN_TUNE_CENTS = 5;

export const centsBetween = (freq, reference) => 1200 * Math.log2(freq / reference);

export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Algoritmo YIN (de Cheveigné e Kawahara, 2002): em vez de procurar o pico da autocorrelação
// (que erra de oitava quando um harmônico é mais forte que a fundamental — comum na corda Mi
// grave), mede a diferença entre o sinal e ele mesmo deslocado, normaliza, e pega o PRIMEIRO
// deslocamento que fica abaixo do limiar — o menor período, não um múltiplo dele.
// `samples` precisa ter pelo menos 2× o maior período procurado (4096 a 48 kHz sobra pra 60 Hz).
// Devolve { freq, clarity } (clarity de 0 a 1) ou null se não há altura clara (silêncio, ruído).
export function detectPitch(samples, sampleRate, { minHz = 60, maxHz = 1000, threshold = 0.15 } = {}) {
  const window = Math.floor(samples.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(window - 1, Math.ceil(sampleRate / minHz));
  if (tauMax <= tauMin + 1) return null;

  // d(τ): soma dos quadrados das diferenças entre o sinal e ele deslocado τ amostras.
  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = samples[i] - samples[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // d'(τ): diferença normalizada pela média acumulada (vale 1 em τ=0 e perto de 0 quando há período).
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau];
    cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++; // desce até o fundo do vale
      tau = t;
      break;
    }
  }
  if (tau === -1) return null;

  // Interpolação parabólica: o período real quase nunca cai num número inteiro de amostras.
  const left = cmnd[tau - 1];
  const right = tau + 1 <= tauMax ? cmnd[tau + 1] : cmnd[tau];
  const denominator = left + right - 2 * cmnd[tau];
  const shift = denominator === 0 ? 0 : (left - right) / (2 * denominator);
  return { freq: sampleRate / (tau + shift), clarity: 1 - cmnd[tau] };
}

// Qual corda está sendo tocada e quão longe da afinação dela: a corda mais próxima em cents
// (não em Hz — a distância que o ouvido percebe é logarítmica). cents > 0 = alta, < 0 = baixa.
export function analyze(freq) {
  let stringIndex = 0;
  let cents = centsBetween(freq, GUITAR_STRINGS[0].freq);
  GUITAR_STRINGS.forEach((string, i) => {
    const c = centsBetween(freq, string.freq);
    if (Math.abs(c) < Math.abs(cents)) { stringIndex = i; cents = c; }
  });
  return { freq, stringIndex, string: GUITAR_STRINGS[stringIndex], cents };
}
