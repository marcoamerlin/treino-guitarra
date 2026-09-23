import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../js/voice-command.js';

test('reconhece "limpo" e variações', () => {
  assert.equal(parseCommand('limpo'), 'ok');
  assert.equal(parseCommand('Limpo!'), 'ok');
  assert.equal(parseCommand('limpou'), 'ok');
  assert.equal(parseCommand('ficou limpo dessa vez'), 'ok');
});

test('reconhece "errei" e variações', () => {
  assert.equal(parseCommand('errei'), 'bad');
  assert.equal(parseCommand('errou'), 'bad');
  assert.equal(parseCommand('saiu errado'), 'bad');
});

test('fala sem nenhuma das palavras não marca nada', () => {
  assert.equal(parseCommand('oi tudo bem'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand('vou tentar de novo'), null);
});

test('acento não atrapalha (o reconhecimento às vezes devolve sem acento mesmo)', () => {
  assert.equal(parseCommand('Érrei'), 'bad');
});

test('as duas palavras juntas na mesma fala: em dúvida, não marca nada', () => {
  assert.equal(parseCommand('limpo não, errei'), null);
});

test('palavra parecida mas diferente não conta como comando (evita marcar à toa)', () => {
  assert.equal(parseCommand('limpeza'), null); // não é "limpo"
  assert.equal(parseCommand('erro de digitação'), 'bad'); // "erro" está na lista, de propósito
});

test('só marca em cima do resultado final do reconhecimento, não do rascunho que ainda muda', async () => {
  const { voiceCommand } = await import('../js/voice-command.js');

  // simula o SpeechRecognition do navegador: começa com "limp" (rascunho) e fecha em "limpo"
  class FakeRecognition {
    constructor() { FakeRecognition.instance = this; }
    start() {}
    stop() {}
  }
  const realWindow = globalThis.window;
  globalThis.window = { SpeechRecognition: FakeRecognition };

  const calls = [];
  voiceCommand.start('ex-teste', (cmd) => calls.push(cmd));
  const rec = FakeRecognition.instance;

  // rascunho: não deveria marcar nada, mesmo contendo uma palavra parecida
  rec.onresult({ resultIndex: 0, results: [[{ transcript: 'limp' }].map(Object.assign)].map((r) => Object.assign(r, { isFinal: false })) });
  assert.equal(calls.length, 0, 'não pode marcar em cima de um resultado ainda não fechado');
  assert.equal(voiceCommand.lastHeard, '', 'não guarda rascunho como "ouvido"');

  // resultado final: agora sim conta, e fica guardado como "ouvido"
  const final = [{ transcript: 'limpo' }];
  final.isFinal = true;
  rec.onresult({ resultIndex: 0, results: [final] });
  assert.deepEqual(calls, ['ok']);
  assert.equal(voiceCommand.lastHeard, 'limpo');

  voiceCommand.stop();
  globalThis.window = realWindow;
});
