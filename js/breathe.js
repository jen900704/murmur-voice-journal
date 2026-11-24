// A one-minute breathing pacer: in for 4 seconds, out for 6. A longer out-breath is a common,
// low-risk way to settle a little. The circle grows and shrinks; with reduced motion it stays
// still and only the words change. It stops itself when the sheet closes.

const S = {
  'zh-TW': {
    title: '呼吸一分鐘',
    intro: '跟著圓圈，吸氣 4 秒，吐氣 6 秒。如果覺得頭暈或更不舒服，就停下來，用自己的節奏呼吸。',
    start: '開始',
    stop: '停止',
    again: '再一分鐘',
    in: '吸氣',
    out: '慢慢吐氣',
    done: '好了。注意一下現在身體的感覺，不用評分。',
    left: (s) => `還有 ${s} 秒`,
  },
  en: {
    title: 'Breathe for a minute',
    intro: 'Follow the circle: in for 4 seconds, out for 6. If you feel dizzy or worse, stop and breathe at your own pace.',
    start: 'Start',
    stop: 'Stop',
    again: 'One more minute',
    in: 'Breathe in',
    out: 'Breathe out slowly',
    done: 'Done. Notice how your body feels now, without grading it.',
    left: (s) => `${s} seconds left`,
  },
};

const IN_S = 4;
const OUT_S = 6;
const ROUNDS = 6; // 60 seconds

export function breatheSheet({ h, getLang }) {
  const st = { running: false, finished: false, timer: null, t0: 0 };
  const L = () => S[getLang()] || S.en;

  function stop() {
    st.running = false;
    clearTimeout(st.timer);
  }

  return (rerender) => {
    const circle = h('div', { class: 'breathe-circle', 'aria-hidden': 'true' });
    const phase = h('p', { class: 'breathe-phase', role: 'status' }, st.finished ? L().done : '');
    const left = h('p', { class: 'muted small breathe-left' }, '');

    function tick() {
      // the sheet was closed or rerendered: stop quietly
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
      st.timer = setTimeout(tick, 250);
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
          st.t0 = performance.now();
          rerender();
        },
      },
      st.running ? L().stop : st.finished ? L().again : L().start
    );

    if (st.running) setTimeout(tick, 0);

    return [h('h2', {}, L().title), h('p', { class: 'muted small' }, L().intro), h('div', { class: 'breathe-stage' }, circle), phase, left, h('div', { class: 'actions' }, startBtn)];
  };
}
