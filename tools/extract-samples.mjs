// Extrai as notas de guitarra usadas pelo app dos arquivos do banco de sons FluidR3_GM
// (gleitz/midi-js-soundfonts, licença CC BY 3.0; ver audio/CREDITS.md).
//
// Uso: node tools/extract-samples.mjs <pasta com os arquivos *-mp3.js baixados>
// Gera audio/guitar-<timbre>/<nota MIDI>.mp3 só para a faixa que o app toca (Mi2 a Mi5).

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) { console.error('Informe a pasta com os arquivos baixados.'); process.exit(1); }

const root = join(fileURLToPath(import.meta.url), '..', '..');
const VOICES = { clean: 'electric_guitar_clean', muted: 'electric_guitar_muted' };
const FIRST_MIDI = 40; // Mi2, corda Mi grave solta
const LAST_MIDI = 76;  // Mi5, corda Mi fina na casa 12

const SEMITONE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midiOf = (name) => {
  const [, note, octave] = /^([A-G][b#]?)(-?\d+)$/.exec(name);
  return (Number(octave) + 1) * 12 + SEMITONE[note];
};

for (const [voice, file] of Object.entries(VOICES)) {
  const text = readFileSync(join(source, `${file}-mp3.js`), 'utf8');
  const outDir = join(root, 'audio', `guitar-${voice}`);
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  let bytes = 0;
  for (const [, name, base64] of text.matchAll(/"([A-G][b#]?-?\d+)":\s*"data:audio\/mp3;base64,([^"]+)"/g)) {
    const midi = midiOf(name);
    if (midi < FIRST_MIDI || midi > LAST_MIDI) continue;
    const target = join(outDir, `${midi}.mp3`);
    writeFileSync(target, Buffer.from(base64, 'base64'));
    bytes += statSync(target).size;
    count += 1;
  }
  console.log(`${voice}: ${count} notas, ${(bytes / 1024).toFixed(0)} KB`);
}
