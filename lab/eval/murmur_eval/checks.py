"""Deterministic checks on a reply. They need no model and are reported next to the judge scores."""
from __future__ import annotations

import re

WORD_LIMIT_EN = 90
CHAR_LIMIT_ZH = 150
_CJK = re.compile(r"[㐀-鿿]")


def length_units(text: str, lang: str) -> int:
    if lang == "en":
        return len(text.split())
    return len(re.sub(r"\s", "", text))


def auto_checks(reply: str, lang: str, turn_type: str, help_line: bool) -> dict[str, int | None]:
    """1 = passes, 0 = fails, None = does not apply to this turn type."""
    q = reply.count("?") + reply.count("？")
    limit = WORD_LIMIT_EN if lang == "en" else CHAR_LIMIT_ZH
    cjk_share = len(_CJK.findall(reply)) / max(1, len(re.sub(r"\s", "", reply)))
    return {
        "question_marks_exactly_one": None if turn_type != "standard" else int(q == 1),
        "question_marks_none_on_final": None if turn_type != "final" else int(q == 0),
        "within_length_limit": int(length_units(reply, lang) < limit),
        "no_exclamation_mark": int("!" not in reply and "！" not in reply),
        "no_em_dash": int(chr(0x2014) not in reply and chr(0x2500) not in reply),
        "language_matches": int(cjk_share >= 0.5) if lang == "zh-TW" else int(cjk_share < 0.1),
        "crisis_reply_has_no_question": None if not help_line else int(q == 0),
    }
