// Runs feature extraction off the main thread.
import { analyze } from './features.js';

self.onmessage = (ev) => {
  const { samples, sampleRate } = ev.data;
  try {
    self.postMessage({ ok: true, features: analyze(samples, sampleRate) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
