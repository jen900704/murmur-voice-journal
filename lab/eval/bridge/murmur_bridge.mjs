// Bridge between the Python harness and the app's real JavaScript, so there is one source
// of truth for the system prompt, the safety net and the order in which the app applies them.
//
// js/safety.js and js/lenses.js are imported unchanged. js/ai-chat.js keeps its prompt and its
// send() private, so this script reads its source, points its relative imports at the real
// files, exposes the private names, and imports the result from a temporary file. Nothing in
// js/ is modified. If a name the bridge needs is gone, it fails loudly at start.
//
// A conversation is run by the app's own createAiChat().send(). The bridge supplies what a
// browser would: a settings store, a `document`, and `fetch`. Its `fetch` does not touch the
// network. It hands the request the app built to the harness and waits for the harness to
// give back a model reply. So retrieval, the notes fence, the pause on risk words, the hold
// on a risky reply and the turn limit are all the app's code, not a port of it.
//
// Protocol: one JSON request per line on stdin, one JSON response per line on stdout.
process.env.TZ = 'UTC'; // help-line region then follows the language (zh-TW: Taiwan, en: US), on any machine
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { AsyncLocalStorage } from 'node:async_hooks';

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = resolve(process.env.MURMUR_JS_DIR || join(here, '..', '..', '..', 'js'));
const url = (name) => pathToFileURL(join(jsDir, name)).href;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const fail = (msg) => {
  throw new Error(`murmur_bridge: ${msg}. js/ai-chat.js has changed in a way the bridge does not know; update lab/eval/bridge/murmur_bridge.mjs`);
};

const safety = await import(url('safety.js'));
const lenses = await import(url('lenses.js'));

// ---- load js/ai-chat.js with its private parts exposed ----
const PRIVATE = ['systemPrompt', 'notesBlock', 'LENS_RULES', 'MAX_USER_TURNS'];
const chatSource = readFileSync(join(jsDir, 'ai-chat.js'), 'utf8');
const imported = [];
let patched = chatSource.replace(/from\s+'\.\/([\w.-]+\.js)'/g, (_, file) => {
  imported.push(file);
  return `from '${url(file)}'`;
});
for (const name of PRIVATE) {
  if (!new RegExp(`^(?:function|const)\\s+${name}\\b`, 'm').test(chatSource)) fail(`'${name}' not found`);
}
const RETURN = /return \{ open, view, close, abort \};/;
if (!RETURN.test(patched)) fail('the return of createAiChat was not found');
patched = patched.replace(RETURN, 'return { open, view, close, abort, __st: st, __send: send };');
patched += `\nexport { ${PRIVATE.map((n) => `${n} as __${n}`).join(', ')} };\n`;
const tmp = mkdtempSync(join(tmpdir(), 'murmur-bridge-'));
let chat;
try {
  writeFileSync(join(tmp, 'ai-chat.patched.mjs'), patched);
  chat = await import(pathToFileURL(join(tmp, 'ai-chat.patched.mjs')).href);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const sources = {};
for (const f of new Set(['ai-chat.js', 'safety.js', 'lenses.js', ...imported])) sources[f] = sha(readFileSync(join(jsDir, f), 'utf8'));

// ---- what the browser would provide ----
globalThis.document = { getElementById: () => null };
const als = new AsyncLocalStorage();
const realFetch = globalThis.fetch;
globalThis.fetch = async (target, opts = {}) => {
  const session = als.getStore();
  if (!session) throw new Error('murmur_bridge: fetch outside a harness conversation is blocked');
  if (!/^https:\/\/api\.anthropic\.com\/v1\/messages$/.test(String(target))) throw new Error(`murmur_bridge: unexpected fetch to ${target}`);
  const body = JSON.parse(opts.body);
  const headerNames = Object.keys(opts.headers || {}).filter((k) => k.toLowerCase() !== 'x-api-key');
  return new Promise((resolveFetch) => {
    session.resolveFetch = resolveFetch;
    session.onFetch({ url: String(target), headerNames, body });
  });
};
void realFetch;

const sessions = new Map();
let nextId = 1;
const h = (tag, props, ...children) => ({ tag, props: props || {}, children });

function snapshot(s) {
  const st = s.api.__st;
  return {
    messages: st.messages.map((m) => ({ role: m.role, content: m.content, raw: m.raw ?? null, basedOn: m.basedOn ?? null })),
    pause: !!st.pause,
    crisis: !!st.crisis,
    ended: !!st.ended,
    showHelp: !!st.showHelp,
    error: st.error || '',
    draft: st.draft || '',
    busy: !!st.busy,
  };
}

function lensOrThrow(id) {
  const lens = lenses.lensById(id);
  if (!lens) throw new Error(`unknown lens: ${id}`);
  return lens;
}
function sessionOrThrow(id) {
  const s = sessions.get(id);
  if (!s) throw new Error(`unknown chat: ${id}`);
  return s;
}

const ops = {
  info() {
    return {
      node: process.version,
      jsDir,
      sources,
      models: chat.MODELS,
      maxUserTurns: chat.__MAX_USER_TURNS,
      topics: lenses.TOPICS,
      regionFor: { 'zh-TW': safety.getRegion('zh-TW'), en: safety.getRegion('en') },
      retrieval: imported.includes('rag.js'),
      lenses: lenses.LENSES.map((l) => ({
        id: l.id,
        chapter: l.chapter,
        excludeTopics: l.excludeTopics,
        en: { name: l.en.name, concepts: l.en.concepts },
        zh: { name: l.zh.name, concepts: l.zh.concepts },
        allowed: chat.__LENS_RULES[l.id][0],
        avoid: chat.__LENS_RULES[l.id][1],
      })),
    };
  },
  // the base prompt, before any retrieved passages are appended by send()
  system_prompt({ lens, lang, last }) {
    return chat.__systemPrompt(lensOrThrow(lens), lang, { last: !!last });
  },
  notes_block({ context }) {
    return chat.__notesBlock(context || {});
  },
  safety({ texts }) {
    return texts.map((t) => {
      const r = safety.checkRisk(t);
      return { risk: r.risk, kinds: r.kinds, helpLine: safety.hasHelpLine(t) };
    });
  },

  chat_open({ lens, lang, context, model }) {
    lensOrThrow(lens);
    const id = `chat${nextId++}`;
    const s = { id, lang, closed: false };
    const settings = { aiKey: 'not-a-key-the-bridge-never-sends-it', aiModel: model || chat.MODELS[0].id };
    s.api = chat.createAiChat({
      h,
      add: () => {},
      getLang: () => lang,
      db: { getSetting: async (k, d) => (k in settings ? settings[k] : d) },
      onClose: () => (s.closed = true),
    });
    s.api.open(lens, { concern: context.concern, answers: context.answers });
    sessions.set(id, s);
    return { chat: id, state: snapshot(s) };
  },
  // The person presses send. Resolves when the app either stops by itself (pause on risk
  // words, an error) or asks for a model reply.
  async chat_send({ chat: id, text, confirmed }) {
    const s = sessionOrThrow(id);
    if (s.resolveFetch) throw new Error('a model reply is still awaited for this chat');
    s.api.__st.draft = text;
    const asked = new Promise((r) => (s.onFetch = r));
    s.sendDone = als.run(s, () => s.api.__send(() => {}, { confirmed: !!confirmed }));
    const first = await Promise.race([s.sendDone.then(() => null), asked]);
    if (first) return { awaitingModel: true, request: first, state: snapshot(s) };
    return { awaitingModel: false, state: snapshot(s) };
  },
  // The model's answer arrives. `status` other than 200 is delivered as an HTTP error.
  async chat_reply({ chat: id, text, stopReason, status }) {
    const s = sessionOrThrow(id);
    if (!s.resolveFetch) throw new Error('this chat is not waiting for a model reply');
    const resolveFetch = s.resolveFetch;
    s.resolveFetch = null;
    const code = status || 200;
    resolveFetch({
      ok: code === 200,
      status: code,
      json: async () => (code === 200 ? { content: [{ type: 'text', text: text || '' }], stop_reason: stopReason || 'end_turn' } : { error: { message: text || `HTTP ${code}` } }),
    });
    await s.sendDone;
    return { state: snapshot(s) };
  },
  // The person taps "Back to the conversation" after a held reply.
  chat_dismiss_crisis({ chat: id }) {
    const s = sessionOrThrow(id);
    s.api.__st.crisis = false;
    return { state: snapshot(s) };
  },
  // The person taps "Edit first" on the pause screen.
  chat_dismiss_pause({ chat: id }) {
    const s = sessionOrThrow(id);
    s.api.__st.pause = false;
    return { state: snapshot(s) };
  },
  chat_close({ chat: id }) {
    const s = sessions.get(id);
    if (s) {
      if (s.resolveFetch) s.resolveFetch({ ok: false, status: 499, json: async () => ({ error: { message: 'closed' } }) });
      s.api.close();
      sessions.delete(id);
    }
    return { closed: true };
  },
};

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let out;
  try {
    const req = JSON.parse(line);
    if (!ops[req.op]) throw new Error(`unknown op: ${req.op}`);
    out = { ok: true, result: await ops[req.op](req) };
  } catch (e) {
    out = { ok: false, error: String((e && e.message) || e) };
  }
  process.stdout.write(JSON.stringify(out) + '\n');
}
