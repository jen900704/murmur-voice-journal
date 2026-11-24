# Preregistration: when, if ever, does a learned featured-item policy beat the expert order?

Written on 2026-11-24, after the simulator, policies and safety filter were coded and
before any policy comparison was run or looked at. Up to this point the simulator had
only been run to time it and to count safety-filter violations (10 users per world; no
reward, regret or gain figures were printed). Anything that departs from this file is
listed under "Deviations" in `RESULTS.md`.

This is a simulation study. Its users are synthetic, and its parameters are assumptions
that were not fitted to any data. It can show how the policy behaves under stated
assumptions. It cannot show how real people respond.

## 1. Question

At about one session a day, how many interactions does it take until a learned
featured-item policy does better for a user than the fixed expert order, if it ever does?

## 2. Design

- Unit: one synthetic user followed for 90 sessions (one session = one interaction =
  one featured-item decision). Exploration is opted in for every simulated user.
- Each user meets every policy on the same days with the same contexts, moods and
  random draws (common random numbers), so differences between policies within a user
  are paired.
- Surfaces: theory lens (14 lenses, 6 worry topics) on 60% of days, bedtime track
  (9 tracks, 6 themes plus "none") on 40%. Each user has their own mix of contexts.
- Ratings are missing not at random: a helpful session is rated with probability .75,
  an unhelpful one with .45 (misspecified world: .85 and .30). A missing rating is
  missing for the policy; it is not a zero.
- Low-mood days (about 13% of days, in runs), risk days (1%) and the loss topic are
  gated: every policy shows the expert's first item there and learns nothing.

### Worlds (parameters in `murmur_rl/env.py`, fixed before the run)

| World | What it assumes | Role |
|---|---|---|
| `null` | Every user is the same. No person-by-item differences, no drift, no habituation or novelty. The expert order is right for everyone. | Negative control. A learned policy cannot truly win here. |
| `heterogeneous` | Person-by-item effects with sd 0.6 logits, person-by-context-by-item sd 0.3, slow drift (daily autocorrelation .99), mild habituation and novelty, the featured item is used 70% of the time. The expert order is right on average. | **Primary.** |
| `strong` | As above with both sds doubled (1.2 and 0.6). | Optimistic bound. |
| `misspecified` | The expert order is only weakly right (30% of its usual advantage plus unrelated item effects, sd 0.4), an unobserved time-of-day effect (sd 0.5), each user's tastes are redrawn once on a day between 20 and 70, the featured item is used only 50% of the time, and missingness is stronger. | Stress test of the model's assumptions. |

### Policies

`expert` (baseline), `murmur` (the policy in `POLICY_SPEC.md`: epsilon-mixture over
Thompson sampling, eps .20, kappa .25, gamma .98, prior pseudo-count 3), `ts`
(plain Beta-Bernoulli Thompson sampling, same prior), `ts_discounted` (gamma .98),
`eps_greedy` (eps .10), `linucb` (alpha .5, eps .05). All go through the same safety
filter. The **primary policy is `murmur`**. The others are exploratory comparisons.

### Size and seeds

- 1000 users per world, 4 worlds, 6 policies, 90 sessions each.
- Master seed 20261124. User `i` in world `w` is generated from
  `SeedSequence([20261124, w, i])`; policy `p` for that user draws from
  `SeedSequence([20261124, w, i, 1 + p])`.
- Off-policy validation: 500 replicates, seeds 0 to 499 (section 5).

## 3. Metrics

For user `i`, policy `p`, horizon `H` in {30, 60, 90}:

- `V_p(H)`: the sum over the first H sessions of the true expected helpfulness of
  the session given what was featured (known in the simulator; not the noisy rating).
- **Cumulative regret against the expert order**: `R(H) = V_expert(H) - V_p(H)`.
  Negative regret means the learned policy did better. The same number with the sign
  flipped is reported as the gain `G(H)`, in expected helpful sessions.
- **Probability of beating the expert order**: the share of users with `G(H) > 0`.
  The share with `G(H) < 0` is reported next to it. A second, noisier version uses
  realised helpful sessions instead of expected ones, since that is what a person
  would actually live through (descriptive only).
- **Safety-filter violations**: decisions where an excluded item was featured or had
  positive probability, or where a gated state did not get the expert's first item
  with propensity 1. Counted by `safety.audit`, which is separate from the code that
  makes the decision. **Must be zero.**
- Descriptive: the curve of mean cumulative gain at every session 1 to 90; the first
  session after which the mean cumulative gain stays above zero through session 90
  ("break-even"); the headroom (`best featured item each day` minus expert).

## 4. Decision rules

1. **Safety.** If violations are not zero for any policy in any world, the study
   fails and no other result is interpreted.
2. **Negative control.** In the `null` world, if the confidence interval for the mean
   gain of any learned policy lies wholly above zero at any horizon, the simulator or
   the metric is wrong and no other result is interpreted.
3. **Beats the expert order on average at H** (primary: `murmur` in `heterogeneous`):
   the confidence interval for the mean of `G(H)` across users lies above zero.
   Intervals are normal-theory intervals across users (users are independent, so this
   is valid here). For the three primary horizons they are Bonferroni-adjusted
   (98.33% each, z = 2.394). Every other interval is 95% and exploratory.
4. **Large enough to matter**: mean `G(H)` is at least `0.03 * H` (0.9, 1.8 and 2.7
   more helpful sessions at 30, 60 and 90). A gain that passes rule 3 but not rule 4
   is reported as "detectable in simulation but small".
5. **Most users benefit at H**: the lower end of the 95% Wilson interval for the share
   of users with `G(H) > 0` is above .5. If the upper end is below .5, the report says
   most users are worse off.
6. **Answer to the question.** The answer is the smallest H in {30, 60, 90} at which
   rules 3 and 5 both hold in the primary world, with rule 4 reported next to it. If
   there is none, the answer is "not within 90 interactions under these assumptions",
   and it is reported as the main finding. The `strong` and `misspecified` worlds are
   reported as a bound and a stress test, and they do not change the answer.
7. If the mean gain interval lies wholly below zero, the report says the learned
   policy is worse than the expert order at that horizon.

No parameter of any world or policy will be changed after the results are seen. If a
bug is found, it is fixed, the whole study is rerun, and the fix is listed as a deviation.

## 5. Off-policy evaluation check (methods validation, no hypothesis)

Purpose: show that the estimators in `murmur_rl/ope.py` recover a known policy value.

- Environment: a stationary contextual bandit built from the `heterogeneous` world's
  population effects for the lens surface (5 ungated topics, 14 lenses), with Bernoulli
  rewards. The true value of any policy is then an exact sum.
- Logging policy (not adaptive): expert's first item with probability .5, otherwise
  uniform over the eligible items. Target policy: expert's second item with
  probability .8, otherwise uniform.
- n = 90, 500 and 2000 logged sessions; 500 replicates each.
- Estimators: IPS, self-normalised IPS, doubly robust (reward model: smoothed mean per
  context and item, two-fold cross-fitted).
- Reported: bias, standard deviation, RMSE, and Monte Carlo standard error of the bias.
  Expectation, stated in advance: IPS bias within two Monte Carlo standard errors of
  zero; SNIPS and DR bias small and shrinking with n. Failures are reported as they are.
- Missingness row: the same logs with ratings missing not at random (.75 / .45),
  analysed on rated sessions only, to show the size of the bias this causes.
- Adaptive-data check: a 3-arm bandit with equal arms (true value .5), 2000
  replicates, T = 90 and 500, logged by (a) Thompson sampling with a 1% floor and
  (b) the `murmur` policy. Target: the value of arm 1. Reported: coverage of the
  usual 95% normal interval for IPS and DR, and of an adaptively weighted DR estimator
  (weights proportional to the square root of the propensity). The check is on a
  non-contextual problem only. Confidence intervals for contextual policy values from
  adaptively collected logs are out of scope, and `ope.py` says so.
