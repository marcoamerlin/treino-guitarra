// Metrônomo com Web Audio. Agenda os cliques com antecedência (lookahead) para não
// depender da precisão do setInterval, que oscila principalmente no celular.
// Subdivisão = número de cliques por tempo (1, 2, 3 = tercinas, 4, 6), não mais só liga/desliga
// colcheias — pedido do usuário, 2026-10-03 (mesma mudança feita no Treino de Bateria).

import { ensureRunningContext } from './audio-context.js';

const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;

// Subdivisões oferecidas na tela: cliques por tempo → nome.
export const SUBDIVISIONS = [
  { n: 1, name: 'Semínimas' },
  { n: 2, name: 'Colcheias' },
  { n: 3, name: 'Tercinas' },
  { n: 4, name: 'Semicolcheias' },
  { n: 6, name: 'Sextinas' },
];
const VALID = new Set(SUBDIVISIONS.map((s) => s.n));
export const normalizeSubdivision = (n) => (VALID.has(Number(n)) ? Number(n) : 1);

class Metronome {
  constructor() {
    this.bpm = 90;
    this.beats = 4;
    this.subdivision = 1; // cliques por tempo
    this.running = false;
    this.ctx = null;
    this.timer = null;
    this.wake = null;
    this.handlers = { beat: new Set(), change: new Set() };
  }

  on(event, fn) { this.handlers[event].add(fn); }
  off(event, fn) { this.handlers[event].delete(fn); }
  // Um erro na tela nunca pode interromper o áudio.
  emit(event, payload) {
    this.handlers[event].forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }

  setBpm(bpm) {
    this.bpm = Math.min(260, Math.max(30, Math.round(bpm)));
    this.emit('change');
  }
  setBeats(beats) { this.beats = beats; this.emit('change'); }
  setSubdivision(n) { this.subdivision = normalizeSubdivision(n); this.emit('change'); }

  async start() {
    if (this.running) return;
    this.running = true; // trava já, antes do await, para 2 cliques rápidos não abrirem 2 contextos
    const ctx = await ensureRunningContext(this.ctx);
    if (!this.running) return; // start()+stop() rápidos enquanto o await corria: desiste
    if (!ctx) { this.running = false; return; } // sem suporte a Web Audio neste navegador
    this.ctx = ctx;
    this.beat = 0;      // tempos tocados desde o início
    this.subPos = 0;    // posição do clique dentro do tempo (0 = o próprio tempo)
    this.perBeat = this.subdivision;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.lockScreen();
    this.emit('change');
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.unlockScreen();
    this.emit('change');
  }

  toggle() { this.running ? this.stop() : this.start(); }

  tick() {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      // Trocar a subdivisão com o metrônomo tocando só vale a partir do próximo tempo — senão
      // o tempo que está tocando ficaria com cliques de duas subdivisões misturadas.
      if (this.subPos === 0 && this.subdivision !== this.perBeat) this.perBeat = this.subdivision;
      const perBeat = this.perBeat;
      const isSub = this.subPos !== 0;
      const beatIndex = this.beat % this.beats;
      const accent = !isSub && beatIndex === 0;
      this.click(this.nextTime, accent, isSub);
      if (!isSub) {
        const delay = Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
        setTimeout(() => this.running && this.emit('beat', { beatIndex, accent }), delay);
      }
      this.nextTime += 60 / this.bpm / perBeat;
      this.subPos += 1;
      if (this.subPos >= perBeat) { this.subPos = 0; this.beat += 1; }
    }
  }

  click(time, accent, isSub) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = isSub ? 800 : accent ? 1700 : 1150;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(isSub ? 0.3 : 0.9, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  // Mantém a tela acesa enquanto o metrônomo toca (o celular bloquearia o áudio).
  async lockScreen() {
    try { this.wake = await navigator.wakeLock?.request('screen'); } catch (e) { /* sem suporte */ }
  }
  unlockScreen() {
    try { this.wake?.release(); } catch (e) { /* ignora */ }
    this.wake = null;
  }
}

export const metronome = new Metronome();
