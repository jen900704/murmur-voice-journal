"""Arms, contexts and expert orders, copied from js/lenses.js and js/bedtime.js.

tests/test_catalog.py checks this copy against the JavaScript sources when they are present.
"""

LENSES = [
    "psychoanalytic", "adlerian", "existential", "person-centered", "gestalt", "behavioral",
    "acceptance", "rebt", "cognitive", "reality", "feminist", "solution-focused", "narrative",
    "family-systems",
]
TOPICS = ["work", "relationship", "family", "self", "loss", "other"]
# lenses whose excludeTopics contains 'loss'
LOSS_EXCLUDED = {
    "adlerian", "existential", "gestalt", "behavioral", "rebt", "cognitive", "reality",
    "solution-focused", "narrative",
}
TOPIC_COMMON = {
    "work": ["cognitive", "rebt", "solution-focused", "behavioral", "acceptance"],
    "relationship": ["person-centered", "adlerian", "family-systems", "feminist", "narrative"],
    "family": ["family-systems", "adlerian", "feminist", "narrative", "person-centered"],
    "self": ["person-centered", "existential", "cognitive", "narrative", "acceptance"],
    "loss": ["person-centered", "acceptance", "family-systems", "psychoanalytic"],
}

TRACKS = [
    "person-centered", "acceptance", "existential", "narrative", "solution-focused", "drift",
    "family-systems", "relaxation", "adlerian",
]
THEMES = ["work", "relationship", "family", "health", "future", "unsure", "none"]
THEME_TRACK = {
    "work": "solution-focused", "relationship": "person-centered", "family": "family-systems",
    "health": "relaxation", "future": "acceptance", "unsure": "person-centered",
}

SURFACES = ["lens", "track"]
ARMS = {"lens": LENSES, "track": TRACKS}
CONTEXTS = {"lens": TOPICS, "track": THEMES}


def allowed(surface, context):
    """Arms the app offers for this context, in catalogue order (lensesForTopic / TRACKS)."""
    if surface == "lens":
        if context not in TOPICS:
            raise ValueError(f"unknown topic {context!r}")
        return [a for a in LENSES if not (context == "loss" and a in LOSS_EXCLUDED)]
    if surface == "track":
        if context not in THEMES:
            raise ValueError(f"unknown theme {context!r}")
        return list(TRACKS)
    raise ValueError(f"unknown surface {surface!r}")


def expert_order(surface, context):
    """Eligible arms in expert order (POLICY_SPEC section 1)."""
    ok = allowed(surface, context)
    if surface == "lens":
        first = [a for a in TOPIC_COMMON.get(context, []) if a in ok]
    else:
        first = [THEME_TRACK[context]] if context in THEME_TRACK else []
    return first + [a for a in ok if a not in first]


_ORDER_CACHE = {(s, c): tuple(expert_order(s, c)) for s in SURFACES for c in CONTEXTS[s]}


def eligible(surface, context):
    """Cached tuple version of expert_order."""
    return _ORDER_CACHE[(surface, context)]
