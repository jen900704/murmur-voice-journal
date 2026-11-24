// The phone's Back button inside a multi-step flow (the bedtime ritual, a lens exercise).
//
// A flow that is on screen owns ONE extra history entry with the same URL as the page under it
// (state { murmurFlow: name }); one per flow, not one per step, so there is no long trail.
// Pressing Back pops that entry: the flow then goes one step back and the entry is pushed again,
// or, at its first step, the flow is left and the entry stays gone. When the flow ends through
// its own buttons the entry is removed with history.back(); the URL does not change, so no
// hashchange fires and the app's router is not involved. Only pushState and popstate are used,
// which also work in an installed (standalone) app on iOS.
//
// Sheets put their own #entry on top of the flow's entry; Back from a sheet lands on the flow's
// entry (its state says so) and is left to the app's hashchange handler.

const KEY = 'murmurFlow';
const flows = new Map();
let pending = 0; // history.back() calls of our own whose popstate has not arrived yet
let pendingTimer = null;

const mark = (state = history.state) => (state && typeof state === 'object' && state[KEY]) || null;

function ownBack() {
  pending++;
  clearTimeout(pendingTimer);
  // if the browser never answers (nothing to go back to), stop waiting
  pendingTimer = setTimeout(() => {
    pending = 0;
    syncAll();
  }, 1500);
  history.back();
}

// shown: the caller is drawing the flow right now (its view is not in the page yet)
function sync(f, shown = false) {
  if (pending || !f.atHome()) return; // mid-traversal, or a sheet or another tab is on top
  const here = mark();
  if (f.active() && (shown || f.visible())) {
    if (here === f.name) return;
    try {
      history.pushState({ [KEY]: f.name }, '', location.href);
    } catch (_) {
      /* some browsers limit how often this may be called; Back then behaves as it did before */
    }
  } else if (here === f.name && !f.active()) ownBack(); // the flow ended: take its entry away
}

function syncAll() {
  for (const f of flows.values()) sync(f);
}

function onPop(e) {
  if (pending) {
    // our own removal of an entry: not a Back press
    if (--pending === 0) {
      clearTimeout(pendingTimer);
      syncAll(); // a flow started again while the entry was being removed
    }
    return;
  }
  const name = mark(e.state);
  if (name) {
    // Arrived on a flow's entry: a sheet above it was closed, or the person came back from
    // another tab. If that flow is over (finished elsewhere, or the page was reloaded), the
    // entry is a leftover: step over it.
    const f = flows.get(name);
    if (!f || !f.active()) ownBack();
    return;
  }
  for (const f of flows.values()) {
    // Back from the flow's entry to the page under it: same URL, flow still on screen
    if (!f.active() || !f.visible() || !f.atHome()) continue;
    try {
      f.back();
    } finally {
      sync(f); // still in the flow: put its entry back
    }
    return;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPop);
  // After a reload on a flow's entry the flow itself is gone (it lives in memory): drop the
  // leftover entry so the next Back is not a press that does nothing.
  if (mark()) {
    if (history.length > 1) ownBack();
    else history.replaceState(null, '', location.href);
  }
}

// name: the flow's id. active(): a step of the flow is current (it may be hidden behind another
// tab). visible(): it is on screen. hashes: the location.hash values of the page the flow lives
// on. back(): go one step back, or leave the flow at its first step.
// Returns { sync }: call sync(true) while drawing the flow, and sync() after the flow ends.
export function createFlowHistory({ name, active, visible, hashes, back }) {
  const f = { name, active, visible, back, atHome: () => hashes.includes(location.hash) };
  flows.set(name, f);
  return { sync: (shown = false) => sync(f, shown === true) };
}
