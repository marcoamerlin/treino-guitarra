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
