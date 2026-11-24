"""Assign messages and ratings to weeks or months, and average ratings per period."""
from collections import OrderedDict
from datetime import timedelta


def week_id(dt, utc_offset_hours=0.0):
    """ISO week, for example 2026-W40 (weeks start on Monday)."""
    return (dt + timedelta(hours=utc_offset_hours)).strftime("%G-W%V")


def month_id(dt, utc_offset_hours=0.0):
    return (dt + timedelta(hours=utc_offset_hours)).strftime("%Y-%m")


def period_id(dt, group, utc_offset_hours=0.0):
    if group == "week":
        return week_id(dt, utc_offset_hours)
    if group == "month":
        return month_id(dt, utc_offset_hours)
    raise ValueError("group must be 'week' or 'month'")


def group_messages(messages, group, utc_offset_hours=0.0):
    """-> OrderedDict period -> list of messages, periods in time order."""
    out = {}
    for m in messages:
        out.setdefault(period_id(m.created, group, utc_offset_hours), []).append(m)
    return OrderedDict(sorted(out.items()))


def mean_ratings(ratings, group, utc_offset_hours=0.0):
    """-> period -> {mood, energy, n_mood, n_energy}; a mean is None when nothing was rated."""
    acc = {}
    for r in ratings:
        a = acc.setdefault(period_id(r.created, group, utc_offset_hours), {"mood": [], "energy": []})
        if r.mood is not None:
            a["mood"].append(r.mood)
        if r.energy is not None:
            a["energy"].append(r.energy)
    out = OrderedDict()
    for p in sorted(acc):
        row = {}
        for k in ("mood", "energy"):
            v = acc[p][k]
            row[k] = sum(v) / len(v) if v else None
            row["n_" + k] = len(v)
        out[p] = row
    return out
