// Runs Murmur's analyze() on raw 16 kHz mono float32 files and prints one JSON line each.
// Usage: node tools/murmur-analyze.mjs [--frames] file.f32 ...
import { readFileSync } from 'node:fs';
import { analyze } from '../js/features.js';

const args = process.argv.slice(2);
const frames = args.includes('--frames');
for (const file of args.filter((a) => a !== '--frames')) {
  const buf = readFileSync(file);
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const { contour, ...r } = analyze(x, 16000, { returnFrames: frames });
  console.log(JSON.stringify({ file, ...r }));
}
