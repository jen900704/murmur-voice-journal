// A one-minute breathing pacer: in for 4 seconds, out for 6. A longer out-breath is a common,
// low-risk way to settle a little. The circle grows and shrinks; with reduced motion it stays
// still and only the words change. It stops itself when the sheet closes.

const S = {
  'zh-TW': {
    title: '呼吸一分鐘',
    intro: '跟著圓圈，用鼻子輕輕吸氣 4 秒，再慢慢吐氣 6 秒。不用吸得很飽，平常的深度就好。覺得 6 秒太長，就縮短一點。如果頭暈或更不舒服，就停下來，用自己的節奏呼吸。呼吸困難或胸痛時，請直接就醫，不要做這個練習。',
    start: '開始',
    stop: '停止',
    again: '再一分鐘',
    in: '吸氣',
    out: '慢慢吐氣',
    done: '好了。現在照自己的節奏呼吸就好。',
    left: (s) => `還有 ${s} 秒`,
  },
  en: {
    title: 'Breathe for a minute',
    intro: 'Follow the circle: breathe in gently through your nose for 4 seconds, then out slowly for 6. No need to fill your lungs; an ordinary breath is enough. If 6 seconds is too long, make it shorter. If you feel dizzy or worse, stop and breathe at your own pace. If you have trouble breathing or chest pain, get medical help instead of doing this.',
    start: 'Start',
    stop: 'Stop',
    again: 'One more minute',
    in: 'Breathe in',
    out: 'Breathe out slowly',
    done: 'Done. Breathe at your own pace now.',
    left: (s) => `${s} seconds left`,
  },
};

const IN_S = 4;
const OUT_S = 6;
const ROUNDS = 6; // 60 seconds

export function breatheSheet({ h, getLang }) {
  const st = { running: false, finished: false, t0: 0, loop: 0, lock: null };
  const L = () => S[getLang()] || S.en;

  function stop() {
    st.running = false;
    st.loop++; // any tick still scheduled sees a newer loop number and ends
    if (st.lock) {
      st.lock.release().catch(() => {});
      st.lock = null;
    }
  }

  async function keepScreenOn() {
    try {
      if ('wakeLock' in navigator && !st.lock) st.lock = await navigator.wakeLock.request('screen');
    } catch (_) {
      /* not available; the minute still works */
    }
  }

  return (rerender) => {
    const circle = h('div', { class: 'breathe-circle', 'aria-hidden': 'true' });
    const phase = h('p', { class: 'breathe-phase', role: 'status' }, st.finished ? L().done : '');
    const left = h('p', { class: 'muted small breathe-left' }, '');

    const loop = st.loop;
    const view = (st.renders = (st.renders || 0) + 1);
    function tick() {
      // a newer loop or a newer render has its own ticks
      if (loop !== st.loop || view !== st.renders) return;
      // the sheet was closed: stop quietly
      if (!circle.isConnected) return stop();
      const elapsed = (performance.now() - st.t0) / 1000;
      const total = ROUNDS * (IN_S + OUT_S);
      if (elapsed >= total) {
        stop();
        st.finished = true;
        return rerender();
      }
      const inCycle = elapsed % (IN_S + OUT_S);
      const breathingIn = inCycle < IN_S;
      const want = breathingIn ? L().in : L().out;
      if (phase.textContent !== want) {
        phase.textContent = want;
        circle.classList.toggle('in', breathingIn);
        circle.classList.toggle('out', !breathingIn);
      }
      left.textContent = L().left(Math.ceil(total - elapsed));
      setTimeout(tick, 250);
    }

    const startBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn primary',
        'data-key': 'breathe-start',
        onclick: () => {
          if (st.running) {
            stop();
            return rerender();
          }
          st.finished = false;
          st.running = true;
          st.loop++;
          st.t0 = performance.now();
          keepScreenOn();
          rerender();
        },
      },
      st.running ? L().stop : st.finished ? L().again : L().start
    );

    if (st.running)
      setTimeout(() => {
        void circle.offsetWidth; // let the small starting size paint, so the first breath grows smoothly
        tick();
      }, 0);

    return [h('h2', {}, L().title), h('p', { class: 'muted small' }, L().intro), h('div', { class: 'breathe-stage' }, circle), phase, left, h('div', { class: 'actions' }, startBtn)];
  };
}
