// A short breathing pacer: in for 4 seconds and out for 6, or with a 2-second hold between,
// five rounds. A longer out-breath is a common, low-risk way to settle a little. The circle
// grows and shrinks; with reduced motion it stays still and only the words and the count
// change. Spoken cues are optional and use the device's own voices only. After the last round
// it offers 5-4-3-2-1 grounding (js/calm.js). It stops itself when the sheet closes.
//
// This file and js/calm.js import each other; each only calls the other after both have loaded.

import { createSpeaker, groundingStage, voiceToggle, redrawAndFocus, calmStrings } from './calm.js';

const S = {
  'zh-TW': {
    title: '呼吸一分鐘',
    how: {
      46: '跟著圓圈，用鼻子輕輕吸氣 4 秒，再慢慢吐氣 6 秒。',
      426: '跟著圓圈，用鼻子輕輕吸氣 4 秒，停 2 秒，再慢慢吐氣 6 秒。',
    },
    care: '不用吸得很飽，平常的深度就好。覺得 6 秒太長，就縮短一點。如果頭暈或更不舒服，就停下來，用自己的節奏呼吸。呼吸困難或胸痛時，請直接就醫，不要做這個練習。',
    pattern: '節奏',
    patterns: { 46: '吸 4 秒，吐 6 秒', 426: '吸 4 秒，停 2 秒，吐 6 秒' },
    start: '開始',
    stop: '停止',
    again: '再一次',
    in: '吸氣',
    hold: '停一下',
    out: '慢慢吐氣',
    done: '好了。現在照自己的節奏呼吸就好。',
    round: (i, n) => `第 ${i} 回，共 ${n} 回`,
    handoff: '接下來可以用 5-4-3-2-1，把注意力帶回身邊。',
    skip: '跳過',
  },
  en: {
    title: 'Breathe for a minute',
    how: {
      46: 'Follow the circle: breathe in gently through your nose for 4 seconds, then out slowly for 6.',
      426: 'Follow the circle: breathe in gently through your nose for 4 seconds, hold for 2, then out slowly for 6.',
    },
    care: 'No need to fill your lungs; an ordinary breath is enough. If 6 seconds is too long, make it shorter. If you feel dizzy or worse, stop and breathe at your own pace. If you have trouble breathing or chest pain, get medical help instead of doing this.',
    pattern: 'Pace',
    patterns: { 46: 'In 4, out 6', 426: 'In 4, hold 2, out 6' },
    start: 'Start',
    stop: 'Stop',
    again: 'Once more',
    in: 'Breathe in',
    hold: 'Hold',
    out: 'Breathe out slowly',
    done: 'Done. Breathe at your own pace now.',
    round: (i, n) => `Round ${i} of ${n}`,
    handoff: 'Next, 5-4-3-2-1 can bring your attention back to what is around you.',
    skip: 'Skip',
  },
};

// seconds for each part of one breath
export const PATTERNS = {
  46: [
    ['in', 4],
    ['out', 6],
  ],
  426: [
    ['in', 4],
    ['hold', 2],
    ['out', 6],
  ],
};
export const ROUNDS = 5;

// The pacer and what follows it, as a part of a sheet. Stages:
// idle -> breathing -> handoff -> ground -> end. js/calm.js builds its sheet around this.
export function breatheFlow({ h, getLang, speaker = createSpeaker(getLang), pattern = '46', rounds = ROUNDS, choosePattern = true, compact = false, startKey = 'breathe-start', startClass = 'btn primary', startLabel = null, onSkip = null }) {
  const st = { stage: 'idle', pattern: PATTERNS[pattern] ? pattern : '46', endLine: '', t0: 0, loop: 0, renders: 0, lock: null, said: '' };
  const L = () => S[getLang()] || S.en;
  const C = () => calmStrings(getLang());

  function stop() {
    st.loop++; // any tick still scheduled sees a newer loop number and ends
    if (st.lock) {
      st.lock.release().catch(() => {});
      st.lock = null;
    }
  }

  async function keepScreenOn() {
    try {
      if ('wakeLock' in navigator && !st.lock) {
        const loop = st.loop;
        const lock = await navigator.wakeLock.request('screen');
        if (loop !== st.loop) lock.release().catch(() => {}); // stopped while the request was pending
        else st.lock = lock;
      }
    } catch (_) {
      /* not available; the breathing still works */
    }
  }

  function end(rerender, line, focusKey = startKey) {
    stop();
    st.stage = 'end';
    st.endLine = line;
    if (line) speaker.say(line);
    else speaker.cancel();
    redrawAndFocus(rerender, focusKey);
  }

  const ground = groundingStage({
    h,
    getLang,
    speaker,
    onEnd: (rerender) => end(rerender, C().back),
    onStop: (rerender) => end(rerender, L().done),
  });

  function begin(rerender) {
    speaker.unlock(); // inside the tap, before anything else
    stop();
    st.stage = 'breathing';
    st.endLine = '';
    st.said = '';
    st.t0 = performance.now();
    keepScreenOn();
    rerender();
  }

  function render(rerender) {
    const view = ++st.renders;

    if (st.stage === 'handoff') {
      return h(
        'div',
        { class: 'breathe-handoff' },
        h('p', { class: 'calm-big', id: 'handoff-done' }, L().done),
        h('p', { class: 'muted', id: 'handoff-next' }, L().handoff),
        h(
          'div',
          { class: 'actions calm-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn primary calm-next',
              'data-key': 'calm-next', // the same key as the grounding steps, so focus stays put
              'aria-describedby': 'handoff-done handoff-next',
              onclick: () => {
                speaker.unlock();
                ground.reset();
                st.stage = 'ground';
                rerender();
              },
            },
            C().next
          ),
          onSkip
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'link',
                  'data-key': 'calm-skip',
                  onclick: () => {
                    stop();
                    st.stage = 'end';
                    st.endLine = '';
                    speaker.cancel();
                    onSkip(rerender);
                  },
                },
                L().skip
              )
            : null,
          h('button', { type: 'button', class: 'link', 'data-key': 'calm-stop-here', onclick: () => end(rerender, L().done) }, C().stopHere)
        )
      );
    }

    if (st.stage === 'ground') return ground.render(rerender);

    const running = st.stage === 'breathing';
    const count = h('span', { class: 'breathe-count' }, '');
    const circle = h('div', { class: 'breathe-circle', 'aria-hidden': 'true' }, count);
    const phase = h('p', { class: 'breathe-phase' + (st.stage === 'end' ? ' calm-big' : ''), role: 'status' }, st.stage === 'end' ? st.endLine : '');
    const left = h('p', { class: 'muted small breathe-left' }, '');

    const loop = st.loop;
    const parts = PATTERNS[st.pattern];
    const cycle = parts.reduce((sum, [, s]) => sum + s, 0);
    let shown = '';
    function tick() {
      // a newer loop or a newer render has its own ticks
      if (loop !== st.loop || view !== st.renders) return;
      // the sheet was closed: stop quietly
      if (!circle.isConnected) {
        stop();
        st.stage = 'idle';
        speaker.cancel();
        return;
      }
      const elapsed = (performance.now() - st.t0) / 1000;
      if (elapsed >= rounds * cycle) {
        stop();
        st.stage = 'handoff';
        speaker.say(`${L().done}${L().handoff}`);
        // focus follows only if it was on the Stop button, which is about to disappear
        const a = document.activeElement;
        if (a && a.dataset && a.dataset.key === startKey) return redrawAndFocus(rerender, 'calm-next');
        return rerender();
      }
      const round = Math.floor(elapsed / cycle) + 1;
      let t = elapsed % cycle;
      let part = parts[parts.length - 1];
      for (const p of parts) {
        if (t < p[1]) {
          part = p;
          break;
        }
        t -= p[1];
      }
      const id = `${round}:${part[0]}`;
      if (shown !== id) {
        shown = id;
        phase.textContent = L()[part[0]];
        circle.className = `breathe-circle ${part[0]}`;
        left.textContent = L().round(round, rounds);
        if (st.said !== id) {
          st.said = id;
          speaker.say(L()[part[0]]);
        }
      }
      // the seconds left in this part: with reduced motion this is what paces the breath
      const secs = String(Math.max(1, Math.ceil(part[1] - t)));
      if (count.textContent !== secs) count.textContent = secs;
      setTimeout(tick, 250);
    }

    const startBtn = h(
      'button',
      {
        type: 'button',
        class: st.stage === 'idle' ? startClass : 'btn primary',
        'data-key': startKey,
        onclick: () => {
          if (st.stage === 'breathing') {
            stop();
            st.stage = 'idle';
            speaker.cancel();
            return rerender();
          }
          begin(rerender);
        },
      },
      running ? L().stop : st.stage === 'end' ? L().again : startLabel ? startLabel() : L().start
    );

    if (running)
      setTimeout(() => {
        void circle.offsetWidth; // let the small starting size paint, so the first breath grows smoothly
        tick();
      }, 0);

    const chooser =
      choosePattern && !running
        ? h(
            'div',
            { class: 'chips wrap breathe-patterns', role: 'group', 'aria-label': L().pattern },
            Object.keys(PATTERNS).map((p) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'chip small' + (p === st.pattern ? ' on' : ''),
                  'aria-pressed': p === st.pattern ? 'true' : 'false',
                  'data-key': `breathe-pattern-${p}`,
                  onclick: () => {
                    st.pattern = p;
                    rerender();
                  },
                },
                L().patterns[p]
              )
            )
          )
        : null;

    return h(
      'div',
      { class: 'breathe-flow' + (compact ? ' compact' : '') },
      compact ? null : h('p', { class: 'muted small breathe-intro' }, `${L().how[st.pattern]}${getLang() === 'en' ? ' ' : ''}${L().care}`),
      chooser,
      // in the compact form the circle only appears once breathing starts
      compact && !running ? null : h('div', { class: 'breathe-stage' }, circle),
      compact && st.stage === 'idle' ? null : phase,
      running ? left : null,
      h('div', { class: 'actions' }, startBtn),
      running ? null : voiceToggle({ h, getLang, speaker })
    );
  }

  return { render, stage: () => st.stage, stop };
}

export function breatheSheet({ h, getLang }) {
  const flow = breatheFlow({ h, getLang });
  const L = () => S[getLang()] || S.en;
  return (rerender) => [h('h2', {}, L().title), flow.render(rerender)];
}
