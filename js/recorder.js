// Microphone capture, live level, decoding and resampling to 16 kHz mono.
export const TARGET_SR = 16000;

const isApple = typeof navigator !== 'undefined' && /Apple/.test(navigator.vendor || '');

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  // WebKit decodes and plays back its own MP4/AAC recordings most reliably.
  const types = isApple
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    : ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
}

export class Recorder {
  constructor() {
    this.stream = null;
    this.rec = null;
    this.chunks = [];
    this.ctx = null;
    this.analyser = null;
    this.startedAt = 0;
    this.settings = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        // Ask the browser not to process the signal: these change pitch and loudness dynamics.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const track = this.stream.getAudioTracks()[0];
    const s = (track && track.getSettings && track.getSettings()) || {};
    const mime = pickMime();
    const opts = { audioBitsPerSecond: 128000 };
    if (mime) opts.mimeType = mime;
    try {
      this.rec = new MediaRecorder(this.stream, opts);
    } catch (_) {
      this.rec = new MediaRecorder(this.stream);
    }
    // What the browser actually applied, stored with each entry.
    this.settings = {
      mimeType: this.rec.mimeType || mime || '',
      sampleRate: s.sampleRate ?? null,
      echoCancellation: s.echoCancellation ?? null,
      noiseSuppression: s.noiseSuppression ?? null,
      autoGainControl: s.autoGainControl ?? null,
    };
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    // created after an await, so it may start suspended on iOS
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.rec.start(250);
    this.startedAt = performance.now();
  }

  // 0..1 level for the live ring
  level() {
    if (!this.analyser || !this.analyser.getFloatTimeDomainData) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    const db = 10 * Math.log10(s / this.buf.length + 1e-12);
    return Math.max(0, Math.min(1, (db + 60) / 50));
  }

  elapsed() {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  // Resolves with the recording, or null if nothing was captured. Never hangs: if the
  // recorder already stopped (the microphone was taken by a call) or onstop never fires,
  // whatever was captured so far is used.
  stop() {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(this.stopTimer);
        if (this.rec) this.rec.onstop = null;
        const type = (this.rec && this.rec.mimeType) || 'audio/webm';
        const blob = this.chunks.length ? new Blob(this.chunks, { type }) : null;
        this.cleanup();
        resolve(blob);
      };
      if (!this.rec || this.rec.state === 'inactive') return finish();
      this.rec.onstop = finish;
      this.stopTimer = setTimeout(finish, 3000);
      try {
        this.rec.stop();
      } catch (_) {
        finish();
      }
    });
  }

  // Called when the microphone is lost (phone call, another app, unplugged).
  onInterrupt(fn) {
    const track = this.stream && this.stream.getAudioTracks()[0];
    if (track) {
      track.addEventListener('ended', fn);
      track.addEventListener('mute', fn);
    }
    if (this.rec) this.rec.onerror = fn;
  }

  cancel() {
    if (this.rec && this.rec.state !== 'inactive') {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.cleanup();
  }

  cleanup() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
  }
}

function decodeWith(ctx, ab) {
  return new Promise((resolve, reject) => {
    // old WebKit calls the error callback with null
    const fail = (e) => reject(e || new Error('decode'));
    const p = ctx.decodeAudioData(ab, resolve, fail);
    if (p && p.then) p.then(resolve, fail);
  });
}

function mixDown(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

// Decode a recorded blob to 16 kHz mono.
export async function decodeToMono16k(blob) {
  const ab = await blob.arrayBuffer();
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // Preferred: an offline context at 16 kHz decodes and resamples in one step, with no
  // live audio context needed.
  try {
    const decoded = await decodeWith(new OAC(1, 1, TARGET_SR), ab.slice(0));
    if (decoded.sampleRate === TARGET_SR) return mixDown(decoded);
  } catch (_) {
    /* fall through */
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  let decoded;
  try {
    decoded = await decodeWith(ctx, ab);
  } finally {
    if (ctx.state !== 'closed') ctx.close().catch(() => {});
  }
  const frames = Math.ceil(decoded.duration * TARGET_SR);
  try {
    const off = new OAC(1, frames, TARGET_SR);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return rendered.getChannelData(0).slice();
  } catch (_) {
    // older Safari cannot render at 16 kHz: average down by hand (fine for speech analysis)
    const x = mixDown(decoded);
    const ratio = decoded.sampleRate / TARGET_SR;
    const out = new Float32Array(Math.floor(x.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const a = Math.floor(i * ratio);
      const b = Math.max(a + 1, Math.floor((i + 1) * ratio));
      let s = 0;
      for (let j = a; j < b; j++) s += x[j];
      out[i] = s / (b - a);
    }
    return out;
  }
}
