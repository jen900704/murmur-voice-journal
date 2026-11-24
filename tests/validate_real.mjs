// Validation against Praat on synthesized speech. Usage: node validate_real.mjs file.f32 ...
import { readFileSync } from 'node:fs';
import { analyze } from '../js/features.js';
for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  let x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const r = analyze(x, 16000);
  const { contour, ...rest } = r;
  console.log(JSON.stringify({ file: f, ...rest }));
}
