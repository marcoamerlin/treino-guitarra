// Afinador: liga o microfone ao detector de altura (pitch.js) e toca a nota de referência de cada
// corda. Só roda no navegador (microfone e Web Audio) — a parte que tem conta pra errar fica em
// pitch.js, testada com sinais sintéticos.

import { ensureRunningContext } from './audio-context.js';
import { detectPitch, analyze, median, rms, GUITAR_STRINGS } from './pitch.js';
import { loadSamples, createOutput } from './tab-player.js';

const FFT_SIZE = 4096; // ~85 ms a 48 kHz: cabe mais de 6 períodos da corda Mi grave (82 Hz)
const TICK_MS = 60;
const MIN_RMS = 0.008; // abaixo disso é silêncio/ruído de fundo: não tenta achar nota
const KEEP = 5; // mediana das últimas leituras: um erro isolado (ataque da palheta) não balança o ponteiro
const HOLD_MISSES = 6; // ~360 ms sem nota clara antes de limpar a tela (a corda decai e some)
const REFERENCE_SECONDS = 2.4;

// Sem isto o navegador "melhora" a voz: o cancelamento de eco e a redução de ruído tratam a
// guitarra como ruído e distorcem a frequência, e o ganho automático faz o volume pular.
const MIC_CONSTRAINTS = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };

class Tuner {
  constructor() {
    this.state = 'idle'; // idle | starting | listening | denied | nomic | unavailable | error
    this.reading = null; // resultado de analyze() ou null (sem nota clara agora)
    this.playingString = null; // índice da corda cuja referência está tocando
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.buffer = new Float32Array(FFT_SIZE);
    this.timer = null;
    this.recent = [];
    this.misses = 0;
    this.ignoreUntil = 0;
    this.token = 0;
    this.reference = null; // { master, timer }
    this.listeners = new Set();
  }

  // Devolve a função que cancela o registro (a tela remove o ouvinte ao fechar).
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  async start() {
    if (this.state === 'starting' || this.state === 'listening') return;
    const token = ++this.token;
    this.state = 'starting';
    this.reading = null;
    this.emit();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.state = 'unavailable';
      this.emit();
      return;
    }

    // Os dois pedidos saem juntos, ainda dentro do toque do usuário: no iPhone o canal de áudio só
    // liga se for criado/retomado num gesto, e criá-lo depois do aviso de permissão já não vale.
    const contextPromise = ensureRunningContext(this.ctx);
    const streamPromise = navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    let ctx;
    let stream;
    try {
      [ctx, stream] = await Promise.all([contextPromise, streamPromise]);
    } catch (error) {
      if (token !== this.token) return;
      const name = error && error.name;
      this.state = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nomic' : 'error';
      this.emit();
      return;
    }
    const release = () => stream.getTracks().forEach((track) => track.stop());
    if (token !== this.token) { release(); return; } // fechou a tela enquanto esperava a permissão
    if (!ctx) { release(); this.state = 'unavailable'; this.emit(); return; }

    this.ctx = ctx;
    this.stream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    // De propósito NÃO ligado à saída de áudio: senão o microfone sairia no alto-falante e faria eco.
    this.source.connect(this.analyser);
    this.recent = [];
    this.misses = 0;
    this.state = 'listening';
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.emit();
  }

  tick() {
    if (Date.now() < this.ignoreUntil) return; // tocando a referência: o microfone ouviria o próprio app
    this.analyser.getFloatTimeDomainData(this.buffer);
    let freq = null;
    if (rms(this.buffer) >= MIN_RMS) {
      const found = detectPitch(this.buffer, this.ctx.sampleRate);
      if (found) freq = found.freq;
    }
    if (freq) {
      this.recent.push(freq);
      if (this.recent.length > KEEP) this.recent.shift();
      this.misses = 0;
      this.reading = analyze(median(this.recent));
    } else if (++this.misses >= HOLD_MISSES) {
      this.recent = [];
      this.reading = null;
    }
    this.emit();
  }

  stop() {
    this.token += 1;
    clearInterval(this.timer);
    this.timer = null;
    this.stopReference();
    if (this.source) { try { this.source.disconnect(); } catch (e) { /* já solto */ } }
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop()); // solta o microfone
    this.source = null;
    this.analyser = null;
    this.stream = null;
    this.recent = [];
    this.reading = null;
    this.state = 'idle';
    this.emit();
  }

  stopReference() {
    if (!this.reference) return;
    const { master, timer } = this.reference;
    clearTimeout(timer);
    master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => master.disconnect(), 400);
    this.reference = null;
    this.playingString = null;
    this.ignoreUntil = Date.now() + 300; // folga pro eco da sala morrer antes de voltar a escutar
  }

  // Toca a gravação da corda solta (a mesma "limpa" dos exercícios); se a gravação falhar, um tom puro.
  async playReference(stringIndex) {
    const string = GUITAR_STRINGS[stringIndex];
    const ctx = await ensureRunningContext(this.ctx);
    if (!ctx) return;
    this.ctx = ctx;
    this.stopReference();
    const samples = await loadSamples(ctx, 'clean', [string.midi]);
    const sample = samples.get(string.midi);

    const output = createOutput(ctx);
    const t0 = ctx.currentTime + 0.02;
    if (sample) {
      const source = ctx.createBufferSource();
      source.buffer = sample.buffer;
      const gain = ctx.createGain();
      gain.gain.value = sample.norm;
      source.connect(gain).connect(output.input);
      source.start(t0);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = string.freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + REFERENCE_SECONDS);
      osc.connect(gain).connect(output.input);
      osc.start(t0);
      osc.stop(t0 + REFERENCE_SECONDS + 0.1);
    }

    const timer = setTimeout(() => { this.stopReference(); this.emit(); }, REFERENCE_SECONDS * 1000);
    this.reference = { master: output.master, timer };
    this.playingString = stringIndex;
    this.ignoreUntil = Date.now() + REFERENCE_SECONDS * 1000 + 300;
    this.reading = null;
    this.recent = [];
    this.emit();
  }
}

export const tuner = new Tuner();
