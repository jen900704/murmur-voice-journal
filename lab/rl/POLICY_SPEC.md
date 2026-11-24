# Featured-item policy: shared specification (v1)

This file is the contract between the in-app policy (`js/policy.js`) and the research
module (`lab/rl/murmur_rl/`). If the two disagree, this file wins, and whichever side
differs is the bug. Constants are collected in section 9.

## 1. Surfaces, contexts, arms

| Surface | Context | Arms | Expert order |
|---|---|---|---|
| `lens` | worry topic, one of `TOPICS` in `js/lenses.js` (`work, relationship, family, self, loss, other`) | lens ids from `lensesForTopic(topic)` | `TOPIC_COMMON[topic]` first, in that order, then every other eligible lens in `LENSES` order. `other` has no `TOPIC_COMMON` entry, so its expert order is `LENSES` order. |
| `track` | bedtime theme, one of `THEMES` in `js/bedtime.js` (`work, relationship, family, health, future, unsure`), or `none` when nothing was set down | all 9 ids in `TRACKS` | `THEME_TRACK[theme]` first, then the other tracks in `TRACKS` order. `none` uses `TRACKS` order. |

The track surface is specified here and simulated in the lab, but the app has no
explicit track rating today. Until one exists, the in-app policy must stay off for
tracks (expert order, nothing logged).

## 2. Action

The action is the id of the ONE item that is featured (shown first, or suggested).
Everything else stays in expert order with the featured item removed. The policy never
reorders the rest, never hides an item, and never changes what an item contains. The
person can still pick any eligible item.

## 3. Safety filter (runs before any sampling)

1. **Eligible set.** `E` = arms allowed for the context (`lensesForTopic` for lenses, all
   tracks for tracks), listed in expert order. Arms outside `E` get probability exactly 0.
   They are removed before probabilities are computed, not zeroed afterwards.
2. **Gate.** If any of the following holds, the decision is *gated*: the featured item is
   `E[0]` (the expert's first item) with probability 1, no random number is drawn for
   the choice, and the session is not used for learning.
   - `opt-out`: the person has not switched exploration on (it is off by default). In
     this state nothing is logged at all.
   - `risk`: the risk-language check (`checkRisk`) matched on text in this session, or
     matched anywhere in the app in the last 36 hours.
   - `low-mood`: the latest mood check-in is 1 or 2 out of 7 and is at most 36 hours
     old (the same rule as the low-mood note).
   - `loss`: the lens topic is `loss`. Grief is not a context to experiment in.
   If several apply, record the first in the order above.
3. A gated decision is logged with `gated` set to the reason and `propensity: 1`
   (except `opt-out`, which logs nothing). Ratings given in gated sessions are stored
   by the app as usual but do not update the policy and are left out of off-policy
   evaluation.

## 4. Model and priors

One Beta-Bernoulli posterior per (surface, context, arm). The prior has total
pseudo-count `N0 = 3` and a mean that follows the expert order:

    m(r) = 0.60 - 0.02 * r        r = 0-based position in the expert order of E
    alpha0 = N0 * m(r),  beta0 = N0 * (1 - m(r))

The posterior is `Beta(alpha0 + s, beta0 + f)`, where `s` and `f` are the (discounted)
counts of helpful and not-helpful ratings. With no data the posterior-mean ranking is the
expert order, so the greedy item at t = 0 is the expert's first item.

## 5. Decision rule: epsilon-mixture over Thompson sampling

For an ungated decision with eligible set `E` (size `K`):

    g      = argmax over E of posterior mean; ties go to the earlier item in expert order
    q_TS   = probability that each arm has the largest draw when one value is drawn
             from every arm's posterior (ties to the earlier item)
    pi(a)  = (1 - EPS) * [a == g]  +  EPS * ( (1 - KAPPA) * q_TS(a) + KAPPA / K )

The featured item is drawn from `pi` with one uniform random number (inverse CDF over
`E` in expert order).

**Propensities.** `q_TS` has no closed form. It is estimated, either by Monte Carlo
(`M = 1000` joint draws; the app does this) or by numerical quadrature (a 300-point
midpoint grid; the lab does this for speed, and its tests check it against Monte Carlo). In both cases the action is
drawn from the vector `pi` that is logged, not from a fresh Thompson draw. The logged
propensity is therefore exact for the mechanism that actually chose the item, even
though `q_TS` inside it is an approximation of true Thompson sampling. The log records
which method was used (`propMethod: "mc"` or `"quad"`) and `mcDraws`.

The smallest possible propensity is `EPS * KAPPA / K` (0.05 / K; 0.0036 for 14 lenses),
so the largest importance weight is `K / 0.05` (280 for 14 lenses).

At t = 0 the policy features the expert's first item with probability at least
`1 - EPS` = 0.8. It is the same as the baseline in its greedy choice, not in every draw.

## 6. Reward and updates

- A rating is the existing 1 to 5 "Was this helpful?" answer. `reward = 1` if rating
  >= 4, `reward = 0` if rating <= 3, `reward = null` if the session ended without a
  rating. Missing is recorded as missing. It is never turned into 0.
- The log also records `used`, the item the person actually opened, which may differ
  from the featured one.
- **Update.** A rated, ungated session updates the posterior of the item that was
  *used* in that context (`s += 1` or `f += 1`). A missing rating changes nothing.
- **What the policy value means.** For evaluation the unit is the session: action =
  featured item, outcome = that session's reward whichever item was used.
- Ratings are missing not at random (people rate more when something helped). Updating
  on rated sessions only is therefore biased upward in level. This is a stated
  limitation, studied in the lab simulator, not corrected in the app.

## 7. Discounting for drift

Before each update in a context, the data counts of every arm in that context are
multiplied by `GAMMA = 0.98`, then the new rating is added:

    s_k <- GAMMA * s_k,  f_k <- GAMMA * f_k   for all k in the context
    then s_used += reward, f_used += 1 - reward

Only the data counts decay; the prior stays. The effective sample size is capped:
the data counts of all arms in one context sum to at most `1 / (1 - GAMMA) = 50`
(so any single arm holds at most 50, or 53 with the prior). A rating's weight halves
after about 34 later ratings in the same context. Discounting is per rated session in
the context, not per calendar day, so the cap holds however often the person rates.

## 8. Decision log (on the device only)

One record per ungated or gated decision (none when opted out):

    {
      v: 1, id, t,                     // schema version, unique id, ISO time
      surface, context,
      eligible: [...],                 // arm ids in expert order
      probs: [...],                    // pi aligned with eligible; sums to 1
      greedy, action, propensity,      // propensity = probs[index of action]
      gated: null | "risk" | "low-mood" | "loss",
      eps, kappa, gamma, n0, propMethod, mcDraws,
      used: null | id, rating: null | 1..5, reward: null | 0 | 1, ratedAt: null | t
    }

No worry text, no answers, no voice measures. The log leaves the device only when
the person exports it.

## 9. Constants

| Name | Value | Meaning |
|---|---|---|
| `N0` | 3 | prior pseudo-count per arm (allowed range 2 to 4) |
| prior mean | `0.60 - 0.02 * r` | r = expert rank within the eligible set |
| `EPS` | 0.20 | share of decisions drawn from the exploration distribution |
| `KAPPA` | 0.25 | uniform share inside the exploration distribution |
| `M` | 1000 | Monte Carlo draws for `q_TS` |
| `GAMMA` | 0.98 | discount per rated session in a context; ESS cap 50 |
| low mood | mood <= 2 of 7 within 36 h | gate |
| risk | `checkRisk` match in session or within 36 h | gate |
| helpful | rating >= 4 of 5 | reward 1 |

## 10. Invariants both implementations must test

1. `probs` sums to 1 (within 1e-9) and has no entry for an arm outside `E`.
2. A gated decision features `E[0]` with propensity 1 and consumes no choice randomness.
3. Every ungated propensity is at least `EPS * KAPPA / K`.
4. With no data, `greedy == E[0]` for every context.
5. A missing rating leaves every posterior unchanged.
6. After any number of updates, data counts in a context sum to at most 50.
7. Same seed and same history give the same decision.
