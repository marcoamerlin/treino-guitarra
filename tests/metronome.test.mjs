import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metronome, SUBDIVISIONS, normalizeSubdivision } from '../js/metronome.js';

// Roda o agendador com um relógio de áudio falso e devolve os cliques agendados até `seconds`,
// como letras: A = tempo 1 acentuado, B = outro tempo, s = subdivisão. Troca de subdivisão no
// meio é feita por `changes` ({ at: segundos, n }).
function clicksFor({ bpm = 60, beats = 4, subdivision, seconds, changes = [] }) {
  const out = [];
  const ctx = { currentTime: 0 };
  Object.assign(metronome, {
    bpm, beats, subdivision, running: false, ctx,
    beat: 0, subPos: 0, perBeat: subdivision, nextTime: 0,
    click: (time, accent, isSub) => out.push({ time, ch: isSub ? 's' : accent ? 'A' : 'B' }),
  });
  for (let t = 0; t <= seconds; t += 0.01) {
    for (const c of changes) if (Math.abs(c.at - t) < 0.005) metronome.subdivision = c.n;
    ctx.currentTime = t;
    metronome.tick();
  }
  return out.filter((c) => c.time < seconds - 1e-6);
}
const pattern = (clicks) => clicks.map((c) => c.ch).join('');

test('subdivisões oferecidas: 1, 2, 3 (tercinas), 4, 6', () => {
  assert.deepEqual(SUBDIVISIONS.map((s) => s.n), [1, 2, 3, 4, 6]);
  assert.equal(SUBDIVISIONS.find((s) => s.n === 3).name, 'Tercinas');
});

test('normalizeSubdivision aceita só valores da lista, senão volta pra 1', () => {
  assert.equal(normalizeSubdivision(3), 3);
  assert.equal(normalizeSubdivision('4'), 4);
  assert.equal(normalizeSubdivision(5), 1);
  assert.equal(normalizeSubdivision(undefined), 1);
});

test('semínimas: 1 clique por tempo, acento no 1', () => {
  assert.equal(pattern(clicksFor({ subdivision: 1, seconds: 4 })), 'ABBB');
});

test('tercinas: 3 cliques por tempo, igualmente espaçados', () => {
  const clicks = clicksFor({ subdivision: 3, seconds: 2 });
  assert.equal(pattern(clicks), 'AssBss');
  clicks.forEach((c, i) => assert.ok(Math.abs(c.time - i / 3) < 1e-9));
});

test('semicolcheias em compasso de 2: 4 cliques por tempo', () => {
  assert.equal(pattern(clicksFor({ beats: 2, subdivision: 4, seconds: 3 })), 'AsssBsssAsss');
});

test('trocar a subdivisão no meio de um tempo só vale a partir do tempo seguinte', () => {
  // 60 BPM: troca de colcheias pra tercinas em 0,6s (no meio do tempo 1).
  const clicks = clicksFor({ subdivision: 2, seconds: 3, changes: [{ at: 0.3, n: 3 }] });
  assert.equal(pattern(clicks), 'AsBssBss');
  assert.ok(clicks.filter((c) => c.ch !== 's').every((c) => Math.abs(c.time - Math.round(c.time)) < 1e-9));
});
