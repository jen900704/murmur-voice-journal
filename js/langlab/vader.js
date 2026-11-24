// VADER sentiment for English, ported from vaderSentiment 3.3.2 (MIT, (c) 2016 C.J. Hutto).
// Hutto, C.J. & Gilbert, E.E. (2014). VADER: A Parsimonious Rule-based Model for Sentiment
// Analysis of Social Media Text. ICWSM-14.
// The port follows the Python reference step by step (including its handling of "but") so
// that scores match it; tests/langlab.test.mjs checks them against values from the Python
// package. What is added here: each word keeps its position and its final valence, so the
// score can be explained word by word. The lexicon and rule constants come from
// data/lexica/vader.json (made by tools/build-lexica.py).

const PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

function stripPunc(tok) {
  let a = 0;
  let b = tok.length;
  while (a < b && PUNCT.has(tok[a])) a++;
  while (b > a && PUNCT.has(tok[b - 1])) b--;
  if (b - a <= 2) return { t: tok, a: 0, b: tok.length };
  return { t: tok.slice(a, b), a, b };
}

const isUpper = (w) => w !== w.toLowerCase() && w === w.toUpperCase();

export function createVader(data) {
  const lexicon = new Map(Object.entries(data.lexicon));
  const emojis = new Map(Object.entries(data.emoji || {}));
  const C = data.constants;
  const NEGATE = new Set(C.NEGATE);
  const BOOSTER = new Map(Object.entries(C.BOOSTER_DICT));
  const SPECIAL = new Map(Object.entries(C.SPECIAL_CASES));
  const { C_INCR, N_SCALAR } = C;

  const negated = (word) => NEGATE.has(word) || word.includes("n't");

  function scalarIncDec(word, valence, isCapDiff) {
    let scalar = 0;
    const lower = word.toLowerCase();
    if (BOOSTER.has(lower)) {
      scalar = BOOSTER.get(lower);
      if (valence < 0) scalar *= -1;
      if (isUpper(word) && isCapDiff) scalar += valence > 0 ? C_INCR : -C_INCR;
    }
    return scalar;
  }

  // Words with positions. Emoji become the words of their description, all pointing back
  // at the emoji (as the reference does: a space before the description, none after).
  function words(text) {
    let expanded = '';
    const map = []; // for each character of expanded: [start, end] in text
    let prevSpace = true;
    let pos = 0;
    for (const ch of text) {
      const range = [pos, pos + ch.length];
      if (emojis.has(ch)) {
        const d = (prevSpace ? '' : ' ') + emojis.get(ch);
        for (let k = 0; k < d.length; k++) map.push(range);
        expanded += d;
        prevSpace = false;
      } else {
        for (let k = 0; k < ch.length; k++) map.push([pos + k, pos + k + 1]);
        expanded += ch;
        prevSpace = ch === ' ';
      }
      pos += ch.length;
    }
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(expanded))) {
      const { t, a, b } = stripPunc(m[0]);
      out.push({ t, start: map[m.index + a][0], end: map[m.index + b - 1][1] });
    }
    return { toks: out, expanded: expanded.trim() };
  }

  function negationCheck(valence, low, startI, i) {
    if (startI === 0) {
      if (negated(low[i - 1])) valence *= N_SCALAR;
    }
    if (startI === 1) {
      if (low[i - 2] === 'never' && (low[i - 1] === 'so' || low[i - 1] === 'this')) valence *= 1.25;
      else if (low[i - 2] === 'without' && low[i - 1] === 'doubt') {
        /* unchanged */
      } else if (negated(low[i - 2])) valence *= N_SCALAR;
    }
    if (startI === 2) {
      if ((low[i - 3] === 'never' && (low[i - 2] === 'so' || low[i - 2] === 'this')) || low[i - 1] === 'so' || low[i - 1] === 'this') valence *= 1.25;
      else if (low[i - 3] === 'without' && (low[i - 2] === 'doubt' || low[i - 1] === 'doubt')) {
        /* unchanged */
      } else if (negated(low[i - 3])) valence *= N_SCALAR;
    }
    return valence;
  }

  function specialIdiomsCheck(valence, low, i) {
    const onezero = `${low[i - 1]} ${low[i]}`;
    const twoonezero = `${low[i - 2]} ${low[i - 1]} ${low[i]}`;
    const twoone = `${low[i - 2]} ${low[i - 1]}`;
    const threetwoone = `${low[i - 3]} ${low[i - 2]} ${low[i - 1]}`;
    const threetwo = `${low[i - 3]} ${low[i - 2]}`;
    for (const seq of [onezero, twoonezero, twoone, threetwoone, threetwo]) {
      if (SPECIAL.has(seq)) {
        valence = SPECIAL.get(seq);
        break;
      }
    }
    if (low.length - 1 > i) {
      const zeroone = `${low[i]} ${low[i + 1]}`;
      if (SPECIAL.has(zeroone)) valence = SPECIAL.get(zeroone);
    }
    if (low.length - 1 > i + 1) {
      const zeroonetwo = `${low[i]} ${low[i + 1]} ${low[i + 2]}`;
      if (SPECIAL.has(zeroonetwo)) valence = SPECIAL.get(zeroonetwo);
    }
    for (const g of [threetwoone, threetwo, twoone]) if (BOOSTER.has(g)) valence += BOOSTER.get(g);
    return valence;
  }

  function leastCheck(valence, low, i) {
    if (i > 1 && !lexicon.has(low[i - 1]) && low[i - 1] === 'least') {
      if (low[i - 2] !== 'at' && low[i - 2] !== 'very') valence *= N_SCALAR;
    } else if (i > 0 && !lexicon.has(low[i - 1]) && low[i - 1] === 'least') {
      valence *= N_SCALAR;
    }
    return valence;
  }

  // Scores a list of words (as produced by words()); text is used for ! and ? emphasis.
  function scoreWords(toks, text) {
    const raw = toks.map((x) => x.t);
    const low = raw.map((x) => x.toLowerCase());
    const n = raw.length;
    let caps = 0;
    for (const x of raw) if (isUpper(x)) caps++;
    const isCapDiff = caps > 0 && caps < n;
    const sentiments = [];
    for (let i = 0; i < n; i++) {
      let valence = 0;
      if (BOOSTER.has(low[i]) || (i < n - 1 && low[i] === 'kind' && low[i + 1] === 'of')) {
        sentiments.push(0);
        continue;
      }
      if (lexicon.has(low[i])) {
        valence = lexicon.get(low[i]);
        if (low[i] === 'no' && i !== n - 1 && lexicon.has(low[i + 1])) valence = 0;
        if ((i > 0 && low[i - 1] === 'no') || (i > 1 && low[i - 2] === 'no') || (i > 2 && low[i - 3] === 'no' && (low[i - 1] === 'or' || low[i - 1] === 'nor'))) {
          valence = lexicon.get(low[i]) * N_SCALAR;
        }
        if (isUpper(raw[i]) && isCapDiff) valence += valence > 0 ? C_INCR : -C_INCR;
        for (let startI = 0; startI < 3; startI++) {
          if (i > startI && !lexicon.has(low[i - (startI + 1)])) {
            let s = scalarIncDec(raw[i - (startI + 1)], valence, isCapDiff);
            if (startI === 1 && s !== 0) s *= 0.95;
            if (startI === 2 && s !== 0) s *= 0.9;
            valence += s;
            valence = negationCheck(valence, low, startI, i);
            if (startI === 2) valence = specialIdiomsCheck(valence, low, i);
          }
        }
        valence = leastCheck(valence, low, i);
      }
      sentiments.push(valence);
    }
    // "but": what comes before counts half, what comes after counts one and a half times.
    // The reference looks each value up by its first position in the list; kept as is.
    const bi = low.indexOf('but');
    if (bi !== -1) {
      for (let k = 0; k < sentiments.length; k++) {
        const val = sentiments[k];
        const si = sentiments.indexOf(val);
        if (si < bi) sentiments[si] = val * 0.5;
        else if (si > bi) sentiments[si] = val * 1.5;
      }
    }
    let compound = 0;
    let pos = 0;
    let neg = 0;
    let neu = 0;
    if (sentiments.length) {
      let sum = 0;
      for (const v of sentiments) sum += v;
      const ep = Math.min((text.match(/!/g) || []).length, 4) * 0.292;
      const qn = (text.match(/\?/g) || []).length;
      const qm = qn > 1 ? (qn <= 3 ? qn * 0.18 : 0.96) : 0;
      const amp = ep + qm;
      if (sum > 0) sum += amp;
      else if (sum < 0) sum -= amp;
      compound = Math.max(-1, Math.min(1, sum / Math.sqrt(sum * sum + 15)));
      let posSum = 0;
      let negSum = 0;
      let neuCount = 0;
      for (const v of sentiments) {
        if (v > 0) posSum += v + 1;
        if (v < 0) negSum += v - 1;
        if (v === 0) neuCount++;
      }
      if (posSum > Math.abs(negSum)) posSum += amp;
      else if (posSum < Math.abs(negSum)) negSum -= amp;
      const total = posSum + Math.abs(negSum) + neuCount;
      pos = Math.abs(posSum / total);
      neg = Math.abs(negSum / total);
      neu = Math.abs(neuCount / total);
    }
    const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
    return {
      compound: r(compound, 4),
      pos: r(pos, 3),
      neg: r(neg, 3),
      neu: r(neu, 3),
      tokens: toks.map((x, i) => ({ t: low[i], start: x.start, end: x.end, v: sentiments[i] })),
    };
  }

  return {
    polarity(text) {
      const { toks, expanded } = words(String(text));
      return scoreWords(toks, expanded);
    },
    // the same sentence with some words taken out (for "without these words" comparisons)
    polarityWithout(text, dropLower) {
      const { toks, expanded } = words(String(text));
      return scoreWords(
        toks.filter((x) => !dropLower.has(x.t.toLowerCase())),
        expanded
      );
    },
  };
}
