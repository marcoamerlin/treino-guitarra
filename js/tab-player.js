// Toca uma tablatura com som sintetizado, para ouvir como o exercício deve soar.
// Cada nota é uma corda dedilhada simulada (Karplus-Strong); o timbre "muted" passa por
// distorção e decai rápido, imitando power chord com palm mute. Não usa arquivos de áudio.
//
// spec: { cols, perBeat, voice: 'muted' | 'clean', repeat? }  (cols no formato de tab.js)
//   perBeat: colunas por tempo (2 = colcheias). Fret '7b9r7' = bend de 7 até 9 e solta.

const OPEN_MIDI = [64, 59, 55, 50, 45, 40]; // e B G D A E
const midiFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function parseFret(raw) {
  const bend = /^(\d+)b(\d+)r\d+$/.exec(String(raw));
  if (bend) return { fret: Number(bend[1]), bendTo: Number(bend[2]) };
  return { fret: parseInt(raw, 10), bendTo: null };
}

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
  const key = `${freq.toFixed(2)}|${seconds.toFixed(3)}|${damping}`;
  if (cache.has(key)) return cache.get(key);

  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / freq));
  const random = noise(Math.round(freq * 100));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = random();
  for (let i = 0; i < length; i++) {
    const j = i % period;
    out[i] = ring[j];
    ring[j] = damping * 0.5 * (ring[j] + ring[(j + 1) % period]);
  }
  cache.set(key, buffer);
  return buffer;
}

// Agenda todas as notas a partir de t0. Devolve a duração total em segundos.
export function scheduleTab(ctx, dest, spec, bpm, t0) {
  const step = 60 / bpm / spec.perBeat;
  const muted = spec.voice === 'muted';
  const cols = [];
  for (let r = 0; r < (spec.repeat || 1); r++) cols.push(...spec.cols);

  let end = 0;
  cols.forEach((col, i) => {
    if (!col || !col.length) return; // pausa
    const t = t0 + i * step;

    const bus = ctx.createGain();
    bus.gain.value = muted ? 1 : 0.6 / Math.sqrt(col.length);
    let node = bus;
    if (muted) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = CURVE;
      shaper.oversample = '2x';
      node.connect(shaper);
      node = shaper;
    }
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = muted ? 2200 : 4500;
    node.connect(lowpass);
    const out = ctx.createGain();
    out.gain.value = muted ? 0.65 : 1;
    lowpass.connect(out);
    out.connect(dest);

    col.forEach(([string, rawFret], n) => {
      const { fret, bendTo } = parseFret(rawFret);
      const freq = midiFreq(OPEN_MIDI[string] + fret);
      const start = t + n * 0.007; // cordas do acorde entram em sequência, como uma palhetada
      const length = bendTo != null ? 1.5 : muted ? step * 1.02 + 0.02 : Math.min(1.3, step * 3);

      const source = ctx.createBufferSource();
      source.buffer = pluckBuffer(ctx, freq, length + 0.05, muted ? 0.982 : 0.996);
      const env = ctx.createGain();
      env.gain.setValueAtTime(muted ? 0.5 : 1, start);
      env.gain.linearRampToValueAtTime(0.0001, start + length);

      if (bendTo != null) {
        const ratio = 2 ** ((bendTo - fret) / 12);
        source.playbackRate.setValueAtTime(1, start + 0.1);
        source.playbackRate.linearRampToValueAtTime(ratio, start + 0.4);
        source.playbackRate.setValueAtTime(ratio, start + 0.8);
        source.playbackRate.linearRampToValueAtTime(1, start + 1.1);
      }

      source.connect(env);
      env.connect(bus);
      source.start(start);
      source.stop(start + length + 0.05);
      end = Math.max(end, start + length - t0);
    });
  });
  return end + 0.1;
}

class TabPlayer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.current = null; // { tab, bpm }
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  isPlaying(tab, bpm) { return Boolean(this.current && this.current.tab === tab && this.current.bpm === bpm); }

  play(tab, bpm) {
    this.stop();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    const total = scheduleTab(this.ctx, this.master, tab.play, bpm, this.ctx.currentTime + 0.06);
    this.current = { tab, bpm };
    this.timer = setTimeout(() => this.stop(), total * 1000 + 150);
    this.emit();
  }

  stop() {
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
