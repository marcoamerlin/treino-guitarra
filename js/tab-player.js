// Toca uma tablatura para ouvir como o exercício deve soar.
//
// Som principal: gravações reais de guitarra (audio/guitar-*/<nota MIDI>.mp3, banco FluidR3_GM,
// ver audio/CREDITS.md). Se uma nota não carregar, cai no sintetizador (corda dedilhada simulada
// por Karplus-Strong, com distorção no timbre "muted"), que também serve de reserva offline.
//
// spec: { cols, perBeat, voice: 'muted' | 'clean', repeat? }  (cols no formato de tab.js)
//   perBeat: colunas por tempo (2 = colcheias). Fret '7b9r7' = bend de 7 até 9 e solta.

const OPEN_MIDI = [64, 59, 55, 50, 45, 40]; // e B G D A E
const midiFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);
const CAB_HZ = 2000; // corte da "caixa" no timbre limpo
// Volume do timbre limpo, medido em volume PERCEBIDO (ver perceivedLoudness). Igualar só o pico
// deixava o limpo 5 a 8 dB mais alto que os riffs, porque suas notas ficam na faixa de 1 a 3 kHz,
// onde o ouvido é muito mais sensível, enquanto o riff mora nos graves. Valor calibrado por medição
// para que o limpo e o abafado soem no mesmo nível.
const CLEAN_LOUDNESS = 1.05e-2;

export function parseFret(raw) {
  const bend = /^(\d+)b(\d+)r\d+$/.exec(String(raw));
  if (bend) return { fret: Number(bend[1]), bendTo: Number(bend[2]) };
  return { fret: parseInt(raw, 10), bendTo: null };
}

export const midiOf = (string, rawFret) => OPEN_MIDI[string] + parseFret(rawFret).fret;

export function notesOf(cols) {
  const notes = new Set();
  cols.forEach((col) => (col || []).forEach(([string, fret]) => notes.add(midiOf(string, fret))));
  return notes;
}

// ---- Volume percebido ---------------------------------------------------------------------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

// Ponderação A (sensibilidade do ouvido por frequência), como potência.
function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2)
    / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * ra;
}

// Volume percebido de uma gravação, logo depois do ataque. Usa metade da ponderação A (em dB),
// porque a curva inteira exagera o peso dos agudos em volumes de escuta normais.
function perceivedLoudness(buffer) {
  const size = 16384;
  const data = buffer.getChannelData(0);
  const start = Math.floor(buffer.sampleRate * 0.02);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) re[i] = (data[start + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  fft(re, im);
  let power = 0;
  for (let k = 1; k < size / 2; k++) {
    power += (re[k] * re[k] + im[k] * im[k]) * Math.sqrt(aWeight((k * buffer.sampleRate) / size));
  }
  return Math.sqrt(power) / size;
}

// ---- Amostras de guitarra ---------------------------------------------------------------

const SAMPLE_DIR = new URL('../audio/', import.meta.url);
const TARGET_PEAK = 0.5; // as gravações vêm baixas e com nível diferente por nota: igualar
const sampleCaches = new WeakMap();

function loadSample(ctx, voice, midi) {
  let cache = sampleCaches.get(ctx);
  if (!cache) { cache = new Map(); sampleCaches.set(ctx, cache); }
  const key = `${voice}/${midi}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(new URL(`guitar-${voice}/${midi}.mp3`, SAMPLE_DIR))
      .then((response) => {
        if (!response.ok) throw new Error(`${key}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const data = buffer.getChannelData(c);
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        }
        if (peak <= 0) return { buffer, norm: 1 };
        // Abafado: igual pelo pico (aprovado). Limpo: igual pelo volume percebido, com teto no pico.
        const norm = voice === 'clean'
          ? Math.min(CLEAN_LOUDNESS / perceivedLoudness(buffer), 0.6 / peak)
          : TARGET_PEAK / peak;
        return { buffer, norm };
      })
      .catch((error) => { cache.delete(key); throw error; }));
  }
  return cache.get(key);
}

// Carrega as notas pedidas. Nota que falhar simplesmente fica de fora (cai no sintetizador).
export async function loadSamples(ctx, voice, midis) {
  const samples = new Map();
  await Promise.all([...midis].map(async (midi) => {
    try { samples.set(midi, await loadSample(ctx, voice, midi)); } catch (e) { /* usa o sintetizador */ }
  }));
  return samples;
}

// Saída com nível de música: compressor, ganho e limitador para nunca estourar.
export function createOutput(ctx) {
  const input = ctx.createGain();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;

  const makeup = ctx.createGain();
  makeup.gain.value = 1.3;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const master = ctx.createGain();
  master.gain.value = 0.9; // margem final: o limitador sozinho ainda deixa passar picos curtos

  input.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(master);
  master.connect(ctx.destination);
  return { input, master };
}

// ---- Sintetizador de reserva -----------------------------------------------------------------

const CURVE = (() => {
  const size = 1024;
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) curve[i] = Math.tanh(((i / (size - 1)) * 2 - 1) * 5);
  return curve;
})();

// Ruído repetível (mesma nota, mesmo som) para o resultado ser previsível.
function noise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const bufferCaches = new WeakMap();

function pluckBuffer(ctx, freq, seconds, damping) {
  let cache = bufferCaches.get(ctx);
  if (!cache) { cache = new Map(); bufferCaches.set(ctx, cache); }
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / freq));
  const key = `${period}|${seconds.toFixed(3)}|${damping}`;
  if (cache.has(key)) return cache.get(key);

  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  const random = noise(period);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = random();
  for (let i = 0; i < length; i++) {
    const j = i % period;
    out[i] = ring[j];
    ring[j] = damping * 0.5 * (ring[j] + ring[(j + 1) % period]);
  }
  // A corda simulada só tem comprimento inteiro, então soa numa altura próxima da pedida.
  // O filtro de média usa a amostra seguinte, o que encurta o atraso em meia amostra:
  // a altura real é rate / (period - 0.5). Quem toca corrige pela velocidade (playbackRate).
  const result = { buffer, actual: rate / (period - 0.5) };
  cache.set(key, result);
  return result;
}

// ---- Agendamento --------------------------------------------------------------------------------

// Agenda todas as notas a partir de t0. `samples` (Map nota → amostra) é opcional: sem ele,
// tudo sai do sintetizador. Devolve a duração total em segundos.
export function scheduleTab(ctx, dest, spec, bpm, t0, samples = null) {
  const step = 60 / bpm / spec.perBeat;
  const muted = spec.voice === 'muted';
  const useSamples = Boolean(samples && samples.size);
  const cols = [];
  for (let r = 0; r < (spec.repeat || 1); r++) cols.push(...spec.cols);

  // Numa guitarra, tocar outra nota na mesma corda interrompe a anterior. Para cada nota,
  // descobre quando a próxima nota da mesma corda entra (Infinity se não houver).
  const cutAt = new Map();
  const nextOnString = new Array(6).fill(Infinity);
  for (let i = cols.length - 1; i >= 0; i--) {
    const col = cols[i] || [];
    col.forEach(([string], n) => cutAt.set(`${i}:${n}`, nextOnString[string]));
    col.forEach(([string], n) => { nextOnString[string] = t0 + i * step + n * 0.007; });
  }

  let end = 0;
  cols.forEach((col, i) => {
    if (!col || !col.length) return; // pausa
    const t = t0 + i * step;

    const bus = ctx.createGain();
    let tail = bus;
    if (useSamples) {
      bus.gain.value = 0.8;
      if (!muted) {
        // As gravações limpas são muito brilhantes: bastante energia entre 1 e 6 kHz, onde o ouvido é mais
        // sensível e o alto-falante do celular é mais forte (soa estridente). Dois filtros em série
        // (−24 dB por oitava) imitam a caixa de um amplificador de guitarra, que corta esses agudos.
        for (let stage = 0; stage < 2; stage++) {
          const cab = ctx.createBiquadFilter();
          cab.type = 'lowpass';
          cab.frequency.value = CAB_HZ;
          cab.Q.value = 0.707;
          tail.connect(cab);
          tail = cab;
        }
      }
    } else {
      bus.gain.value = muted ? 1 : 0.6 / Math.sqrt(col.length);
      if (muted) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = CURVE;
        shaper.oversample = '2x';
        tail.connect(shaper);
        tail = shaper;
      }
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = muted ? 2200 : 4500;
      tail.connect(lowpass);
      const out = ctx.createGain();
      out.gain.value = muted ? 0.65 : 1;
      lowpass.connect(out);
      tail = out;
    }
    tail.connect(dest);

    col.forEach(([string, rawFret], n) => {
      const { fret, bendTo } = parseFret(rawFret);
      const midi = OPEN_MIDI[string] + fret;
      const start = t + n * 0.007; // cordas do acorde entram em sequência, como uma palhetada
      const sample = useSamples ? samples.get(midi) : null;

      // Soma-se o efeito de bend ao playbackRate de quem estiver tocando (amostra ou corda simulada).
      const bendRate = (rate, param) => {
        const bent = rate * 2 ** ((bendTo - fret) / 12);
        param.setValueAtTime(rate, start + 0.1);
        param.linearRampToValueAtTime(bent, start + 0.4);
        param.setValueAtTime(bent, start + 0.8);
        param.linearRampToValueAtTime(rate, start + 1.1);
      };

      if (sample) {
        // Abafado (palm mute): a nota termina um pouco antes da próxima batida, o que deixa as pausas limpas.
        // Limpo: a nota ressoa e vai sumindo devagar; só é cortada rápido se outra nota entra na mesma corda.
        const natural = bendTo != null ? 2.2 : muted ? step * 0.92 : Math.min(2.4, step * 4);
        const cutIn = cutAt.get(`${i}:${n}`) - start;
        const cutShort = cutIn < natural;
        const length = cutShort ? Math.max(0.03, cutIn + 0.005) : natural;
        const fade = muted ? 0.03 : cutShort ? 0.015 : Math.min(0.5, natural * 0.4);
        const source = ctx.createBufferSource();
        source.buffer = sample.buffer;
        const env = ctx.createGain();
        env.gain.setValueAtTime(sample.norm, start);
        env.gain.setValueAtTime(sample.norm, start + Math.max(0, length - fade));
        env.gain.linearRampToValueAtTime(0.0001, start + length); // some sem estalo
        if (bendTo != null) bendRate(1, source.playbackRate);
        source.connect(env);
        env.connect(bus);
        source.start(start);
        source.stop(start + length + 0.02);
        end = Math.max(end, start + length - t0);
        return;
      }

      const freq = midiFreq(midi);
      const length = bendTo != null ? 1.5 : muted ? step * 1.02 + 0.02 : Math.min(1.3, step * 3);
      const source = ctx.createBufferSource();
      const pluck = pluckBuffer(ctx, freq, length + 0.05, muted ? 0.982 : 0.996);
      source.buffer = pluck.buffer;
      const tune = freq / pluck.actual; // ajuste fino para a afinação exata
      const env = ctx.createGain();
      env.gain.setValueAtTime(muted ? 0.5 : 1, start);
      env.gain.linearRampToValueAtTime(0.0001, start + length);
      if (bendTo != null) bendRate(tune, source.playbackRate);
      else source.playbackRate.value = tune;
      source.connect(env);
      env.connect(bus);
      source.start(start);
      source.stop(start + length + 0.05);
      end = Math.max(end, start + length - t0);
    });
  });
  return end + 0.1;
}

// ---- Player -------------------------------------------------------------------------------------------

class TabPlayer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.token = 0;      // invalida um play() que ainda está carregando amostras
    this.current = null; // { tab, bpm, loading }
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  isPlaying(tab, bpm) { return Boolean(this.current && this.current.tab === tab && this.current.bpm === bpm); }
  isLoading(tab, bpm) { return this.isPlaying(tab, bpm) && this.current.loading; }

  async play(tab, bpm) {
    this.stop();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const token = ++this.token;
    this.current = { tab, bpm, loading: true };
    this.emit();

    let samples = null;
    try {
      samples = await loadSamples(this.ctx, tab.play.voice, notesOf(tab.play.cols));
    } catch (e) { /* segue com o sintetizador */ }
    if (token !== this.token) return; // parou (ou trocou de exercício) enquanto carregava

    const output = createOutput(this.ctx);
    this.master = output.master;
    const total = scheduleTab(this.ctx, output.input, tab.play, bpm, this.ctx.currentTime + 0.06, samples);
    this.current = { tab, bpm, loading: false };
    this.timer = setTimeout(() => this.stop(), total * 1000 + 150);
    this.emit();
  }

  stop() {
    this.token += 1;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.master) {
      const master = this.master;
      master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      setTimeout(() => master.disconnect(), 120);
      this.master = null;
    }
    if (this.current) {
      this.current = null;
      this.emit();
    }
  }
}

export const tabPlayer = new TabPlayer();
