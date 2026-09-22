// Metrônomo com Web Audio. Agenda os cliques com antecedência (lookahead) para não
// depender da precisão do setInterval, que oscila principalmente no celular.

import { ensureRunningContext } from './audio-context.js';

const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;

class Metronome {
  constructor() {
    this.bpm = 90;
    this.beats = 4;
    this.subdivide = false;
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
  setSubdivide(on) { this.subdivide = on; this.emit('change'); }

  async start() {
    if (this.running) return;
    this.running = true; // trava já, antes do await, para 2 cliques rápidos não abrirem 2 contextos
    const ctx = await ensureRunningContext(this.ctx);
    if (!this.running) return; // start()+stop() rápidos enquanto o await corria: desiste
    if (!ctx) { this.running = false; return; } // sem suporte a Web Audio neste navegador
    this.ctx = ctx;
    this.step = 0;
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
    const perBeat = this.subdivide ? 2 : 1;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      const isSub = perBeat === 2 && this.step % 2 === 1;
      const beatIndex = Math.floor(this.step / perBeat) % this.beats;
      const accent = !isSub && beatIndex === 0;
      this.click(this.nextTime, accent, isSub);
      if (!isSub) {
        const delay = Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
        setTimeout(() => this.running && this.emit('beat', { beatIndex, accent }), delay);
      }
      this.nextTime += 60 / this.bpm / perBeat;
      this.step += 1;
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
