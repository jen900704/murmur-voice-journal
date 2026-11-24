"""The preregistered plan in machine-readable form. Fixed before any corpus text was scored.

PREREG.md is the plan in prose. If the two ever disagree, PREREG.md wins and the
disagreement is listed under "Deviations" in RESULTS.md.
"""

SEED = 20261124
B_BOOT = 10000  # bootstrap resamples
ALPHA = 0.05

# ---- decision thresholds (PREREG.md section 7) ----
AUC_SUPPORTED = 0.65      # point estimate, target vs neutral
AUC_SUPPORTED_LOW = 0.60  # family-adjusted lower bound must be above this
AUC_SPECIFIC = 0.60       # point estimate, target vs other emotional texts
AUC_DISCRIMINANT_MAX = 0.55  # the opposite set must not be separated from neutral by more than this
AUC_WEAK = 0.55
AUC_CHANCE = 0.50

# ---- GoEmotions (English) ----
GE_POSITIVE = ["amusement", "excitement", "joy", "love", "desire", "optimism", "caring", "pride",
               "admiration", "gratitude", "relief", "approval"]
GE_NEGATIVE = ["fear", "nervousness", "remorse", "embarrassment", "disappointment", "sadness", "grief",
               "disgust", "anger", "annoyance", "disapproval"]
GE_NEUTRAL = "neutral"

# score: a category id of js/langlab/score.js, or "tone" (posemo minus negemo), both as hits per 100 words
# target: texts carrying at least one of these labels
# opposite: labels of the other valence that the category should NOT pick up (discriminant check)
# near: same-valence labels reported for specificity, without a threshold
# vader_sign: +1 or -1, the direction in which VADER compound is used as the reference for this row
EN_CONFIRMATORY = [
    dict(id="posemo", score="posemo", label="positive emotion", target=GE_POSITIVE, opposite=GE_NEGATIVE, near=[], vader_sign=1),
    dict(id="negemo", score="negemo", label="negative emotion", target=GE_NEGATIVE, opposite=GE_POSITIVE, near=[], vader_sign=-1),
    dict(id="anx", score="anx", label="anxiety (worry words)", target=["fear", "nervousness"], opposite=["joy"], near=["anger", "annoyance"], vader_sign=-1),
    dict(id="anger", score="anger", label="anger", target=["anger", "annoyance"], opposite=["joy"], near=["sadness", "grief"], vader_sign=-1),
    dict(id="sad", score="sad", label="sadness", target=["sadness", "grief"], opposite=["joy"], near=["anger", "annoyance"], vader_sign=-1),
    dict(id="grat", score="grat", label="gratitude", target=["gratitude"], opposite=["anger", "annoyance"], near=["joy"], vader_sign=1),
    dict(id="affil", score="affil", label="love and closeness", target=["love", "caring"], opposite=["anger", "annoyance"], near=["joy"], vader_sign=1),
    dict(id="loss", score="loss", label="loss and grief", target=["grief"], opposite=["joy"], near=["anger", "annoyance"], vader_sign=-1),
    dict(id="apology", score="apology", label="apology and regret", target=["remorse"], opposite=["joy"], near=["sadness", "grief"], vader_sign=-1),
]
# Valence contrast: positive-only texts against negative-only texts, no neutral group.
EN_VALENCE = [
    dict(id="tone", score="tone", label="tone (posemo minus negemo)", positive=GE_POSITIVE, negative=GE_NEGATIVE),
]
# Family size for the adjusted intervals: nine categories plus tone.
EN_FAMILY = len(EN_CONFIRMATORY) + len(EN_VALENCE)

# Exploratory rows: looser label matches. Reported with plain 95% intervals and no verdict.
EN_EXPLORATORY = [
    dict(id="care", score="care", label="care (moral theme)", target=["caring"]),
    dict(id="conflict", score="conflict", label="conflict", target=["anger", "annoyance"]),
    dict(id="lonely", score="lonely", label="loneliness", target=["sadness", "grief"]),
    dict(id="risk", score="risk", label="risk and caution", target=["fear", "nervousness"]),
    dict(id="insight", score="insight", label="insight", target=["realization"]),
    dict(id="tentat", score="tentat", label="hedging", target=["confusion"]),
    dict(id="achieve", score="achieve", label="achievement", target=["pride"]),
    dict(id="reward", score="reward", label="reward", target=["joy", "excitement"]),
    dict(id="polite", score="polite", label="politeness", target=["gratitude"]),
    dict(id="loss_sad", score="loss", label="loss and grief (wider target)", target=["grief", "sadness"]),
]

# ---- CPED (Chinese, secondary study) ----
CPED_POSITIVE = ["happy", "grateful", "relaxed", "positive-other"]
CPED_NEGATIVE = ["anger", "sadness", "fear", "depress", "disgust", "worried", "negative-other"]
CPED_NEUTRAL = "neutral"
ZH_CONFIRMATORY = [
    dict(id="posemo", score="posemo", label="positive emotion", target=CPED_POSITIVE, opposite=CPED_NEGATIVE, near=[]),
    dict(id="negemo", score="negemo", label="negative emotion", target=CPED_NEGATIVE, opposite=CPED_POSITIVE, near=[]),
    dict(id="anx", score="anx", label="anxiety (worry words)", target=["fear", "worried"], opposite=["happy"], near=["anger"]),
    dict(id="anger", score="anger", label="anger", target=["anger"], opposite=["happy"], near=["sadness", "depress"]),
    dict(id="sad", score="sad", label="sadness", target=["sadness", "depress"], opposite=["happy"], near=["anger"]),
    dict(id="grat", score="grat", label="gratitude", target=["grateful"], opposite=["anger"], near=["happy"]),
]
ZH_VALENCE = [
    dict(id="tone", score="tone", label="tone (posemo minus negemo)", positive=CPED_POSITIVE, negative=CPED_NEGATIVE),
]
ZH_FAMILY = len(ZH_CONFIRMATORY) + len(ZH_VALENCE)


def verdict(auc, adj_low, auc_specific, auc_opposite=None, diff_adj_low=None):
    """The preregistered decision rule (PREREG.md section 7).

    auc           target vs neutral, point estimate
    adj_low       lower bound of the family-adjusted interval for auc
    auc_specific  target vs other emotional texts, point estimate
    auc_opposite  opposite set vs neutral, point estimate (None when there is no discriminant check)
    diff_adj_low  lower bound of the family-adjusted interval for auc minus auc_opposite
    """
    disc_ok = True
    if auc_opposite is not None:
        disc_ok = auc_opposite <= AUC_DISCRIMINANT_MAX and diff_adj_low is not None and diff_adj_low > 0
    if auc >= AUC_SUPPORTED and adj_low > AUC_SUPPORTED_LOW and auc_specific >= AUC_SPECIFIC and disc_ok:
        return "supported"
    if auc >= AUC_WEAK and adj_low > AUC_CHANCE:
        return "weak"
    return "not supported"


def verdict_valence(auc, adj_low):
    """Rule for the valence contrast (positive vs negative texts): no neutral group, no discriminant set."""
    if auc >= AUC_SUPPORTED and adj_low > AUC_SUPPORTED_LOW:
        return "supported"
    if auc >= AUC_WEAK and adj_low > AUC_CHANCE:
        return "weak"
    return "not supported"
