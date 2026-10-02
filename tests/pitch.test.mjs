import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUITAR_STRINGS, IN_TUNE_CENTS, centsBetween, rms, median, detectPitch, analyze,
} from '../js/pitch.js';

const SIZE = 4096; // o mesmo tamanho de janela que tuner.js usa

// Soma de senoidais: harmonics = [[múltiplo da fundamental, amplitude], ...]
function tone(freq, sampleRate, harmonics = [[1, 1]]) {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    let v = 0;
    harmonics.forEach(([k, a]) => { v += a * Math.sin((2 * Math.PI * freq * k * i) / sampleRate); });
    out[i] = 0.3 * v;
  }
  return out;
}

// Ruído repetível (sem Math.random): mesma sequência em toda execução.
function noise(seed = 1) {
  const out = new Float32Array(SIZE);
  let s = seed;
  for (let i = 0; i < SIZE; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    out[i] = (s / 4294967296 - 0.5) * 0.6;
  }
  return out;
}

const centsOff = (freq, target) => Math.abs(centsBetween(freq, target));

test('GUITAR_STRINGS: 6 cordas soltas, das mais graves às mais agudas, com a frequência certa', () => {
  assert.equal(GUITAR_STRINGS.length, 6);
  const hz = GUITAR_STRINGS.map((s) => Math.round(s.freq * 100) / 100);
  assert.deepEqual(hz, [82.41, 110, 146.83, 196, 246.94, 329.63]); // E2 A2 D3 G3 B3 E4
  assert.deepEqual(GUITAR_STRINGS.map((s) => s.pos), [6, 5, 4, 3, 2, 1]);
});

test('detectPitch acha cada corda solta, a 44,1 kHz e a 48 kHz, com erro de no máximo 1 cent', () => {
  [44100, 48000].forEach((sampleRate) => {
    GUITAR_STRINGS.forEach((string) => {
      const found = detectPitch(tone(string.freq, sampleRate), sampleRate);
      assert.ok(found, `${string.letter}${string.pos}ª a ${sampleRate} Hz: não detectou nada`);
      assert.ok(centsOff(found.freq, string.freq) <= 1,
        `${string.letter}${string.pos}ª a ${sampleRate} Hz: achou ${found.freq.toFixed(2)} Hz, esperava ${string.freq.toFixed(2)}`);
    });
  });
});

test('detectPitch não erra de oitava quando um harmônico é mais forte que a fundamental (caso típico do Mi grave)', () => {
  const E2 = GUITAR_STRINGS[0].freq;
  // fundamental fraca, 2º e 3º harmônicos fortes: um detector por pico de autocorrelação diria 165 Hz
  const found = detectPitch(tone(E2, 48000, [[1, 0.35], [2, 1], [3, 0.8], [4, 0.4]]), 48000);
  assert.ok(found);
  assert.ok(centsOff(found.freq, E2) <= 2, `achou ${found.freq.toFixed(2)} Hz, esperava ${E2.toFixed(2)}`);
});

test('detectPitch acompanha uma corda desafinada: +20 cents e −30 cents', () => {
  const A2 = GUITAR_STRINGS[1].freq;
  [20, -30].forEach((cents) => {
    const freq = A2 * 2 ** (cents / 1200);
    const found = detectPitch(tone(freq, 48000), 48000);
    assert.ok(found);
    assert.ok(Math.abs(centsBetween(found.freq, A2) - cents) <= 1.5, `${cents} cents: achou ${centsBetween(found.freq, A2).toFixed(1)}`);
  });
});

test('detectPitch devolve null para silêncio e para ruído (nada de nota inventada)', () => {
  assert.equal(detectPitch(new Float32Array(SIZE), 48000), null);
  [1, 2, 3].forEach((seed) => assert.equal(detectPitch(noise(seed), 48000), null, `ruído seed ${seed}`));
});

test('detectPitch: o volume do sinal não muda a frequência achada', () => {
  const D3 = GUITAR_STRINGS[2].freq;
  const loud = tone(D3, 48000);
  const quiet = loud.map((v) => v * 0.05);
  assert.ok(Math.abs(detectPitch(loud, 48000).freq - detectPitch(quiet, 48000).freq) < 0.01);
});

test('analyze: acha a corda certa e o desvio em cents (positivo = alta, negativo = baixa)', () => {
  GUITAR_STRINGS.forEach((string, i) => {
    const exact = analyze(string.freq);
    assert.equal(exact.stringIndex, i);
    assert.ok(Math.abs(exact.cents) < 0.001);
  });
  const sharp = analyze(GUITAR_STRINGS[3].freq * 2 ** (20 / 1200));
  assert.equal(sharp.stringIndex, 3);
  assert.ok(Math.abs(sharp.cents - 20) < 0.001);
  const flat = analyze(GUITAR_STRINGS[4].freq * 2 ** (-35 / 1200));
  assert.equal(flat.string.letter, 'B');
  assert.ok(Math.abs(flat.cents + 35) < 0.001);
});

test('analyze: entre duas cordas vale a mais próxima em cents, não em Hz', () => {
  // 100 Hz está entre o Mi grave (82,4) e o Lá (110): fica mais perto do Lá
  assert.equal(analyze(100).string.letter, 'A');
  // 96 Hz fica mais perto do Mi grave (+266 cents) ou do Lá (−236 cents)? do Lá
  assert.equal(analyze(96).stringIndex, 1);
  assert.equal(analyze(90).stringIndex, 0);
});

test('IN_TUNE_CENTS é uma tolerância pequena (tarraxa de verdade não segura mais fino que isso)', () => {
  assert.ok(IN_TUNE_CENTS > 0 && IN_TUNE_CENTS <= 10);
});

test('rms e median: o básico', () => {
  assert.equal(rms(new Float32Array(100)), 0);
  assert.ok(Math.abs(rms(Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.1))) - Math.SQRT1_2) < 0.01);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([110.1, 110.0, 220.0, 110.2, 109.9]), 110.1); // um erro de oitava isolado não passa
});
