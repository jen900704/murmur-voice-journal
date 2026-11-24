"""Read a Murmur JSON backup (and optional imported social posts) into flat records.

A backup looks like {app: 'murmur', version: 1, entries: [...], nights: [...],
lensSessions: [...]} (see js/app.js and js/validate.js in the main app). Social posts are a
list of {text, timestamp, source} objects, either in their own file or under a "posts" or
"socialPosts" key of the backup.
"""
import json
from collections import namedtuple
from datetime import datetime, timezone

Message = namedtuple("Message", "created source text")   # created: aware UTC datetime
Rating = namedtuple("Rating", "created mood energy")      # mood/energy: int 1..7 or None

SOURCES = ("entry_note", "night_worry", "night_kindness", "lens_concern", "lens_answer", "social")
MAX_MS = 8.64e15


class ExportError(ValueError):
    """The input file cannot be used; the message says why in plain words."""


def parse_time(value):
    """Epoch milliseconds, epoch seconds, or an ISO 8601 string -> aware UTC datetime, else None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if not (0 < value < MAX_MS):
            return None
        seconds = value / 1000.0 if value > 1e11 else float(value)
        try:
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(value, str) and value.strip():
        s = value.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


def _text(v):
    return v.strip() if isinstance(v, str) and v.strip() else ""


def _rating(v):
    return v if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 7 else None


def parse_posts(data):
    """List of {text, timestamp, source} -> (messages, number skipped)."""
    if isinstance(data, dict):
        data = data.get("posts", data.get("socialPosts"))
    if not isinstance(data, list):
        raise ExportError("Social posts must be a JSON list of {text, timestamp, source} objects.")
    out, skipped = [], 0
    for p in data:
        if not isinstance(p, dict):
            skipped += 1
            continue
        text, when = _text(p.get("text")), parse_time(p.get("timestamp"))
        if not text or when is None:
            skipped += 1
            continue
        src = _text(p.get("source")).lower() or "unknown"
        src = "".join(c if c.isalnum() else "_" for c in src)[:30]
        out.append(Message(when, "social:" + src, text))
    return out, skipped


def parse_export(data, include_demo=False):
    """Backup dict -> dict(messages, ratings, skipped, demo_skipped, synthetic)."""
    if not isinstance(data, dict):
        raise ExportError("The file is not a Murmur backup: expected a JSON object at the top level.")
    known = ("entries", "nights", "lensSessions", "posts", "socialPosts")
    if not any(isinstance(data.get(k), list) for k in known):
        raise ExportError("The file is not a Murmur backup: none of entries, nights, lensSessions or posts was found.")
    messages, ratings, skipped, demo_skipped = [], [], 0, 0

    for e in data.get("entries") or []:
        when = parse_time(e.get("createdAt")) if isinstance(e, dict) else None
        if when is None:
            skipped += 1
            continue
        if e.get("demo") is True and not include_demo:
            demo_skipped += 1
            continue
        mood, energy = _rating(e.get("mood")), _rating(e.get("energy"))
        if mood is not None or energy is not None:
            ratings.append(Rating(when, mood, energy))
        if _text(e.get("note")):
            messages.append(Message(when, "entry_note", _text(e["note"])))

    for n in data.get("nights") or []:
        when = parse_time(n.get("createdAt")) if isinstance(n, dict) else None
        if when is None:
            skipped += 1
            continue
        if _text(n.get("worry")):
            messages.append(Message(when, "night_worry", _text(n["worry"])))
        if _text(n.get("kindness")):
            messages.append(Message(when, "night_kindness", _text(n["kindness"])))

    for s in data.get("lensSessions") or []:
        when = parse_time(s.get("createdAt")) if isinstance(s, dict) else None
        if when is None:
            skipped += 1
            continue
        if _text(s.get("concern")):
            messages.append(Message(when, "lens_concern", _text(s["concern"])))
        answers = s.get("answers") if isinstance(s.get("answers"), list) else []
        for a in answers:  # numbers are multiple-choice picks, not text
            if _text(a):
                messages.append(Message(when, "lens_answer", _text(a)))

    for key in ("posts", "socialPosts"):
        if isinstance(data.get(key), list):
            posts, bad = parse_posts(data[key])
            messages.extend(posts)
            skipped += bad

    return {"messages": messages, "ratings": ratings, "skipped": skipped,
            "demo_skipped": demo_skipped, "synthetic": data.get("synthetic") is True}


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise ExportError("File not found: %s" % path)
    except (json.JSONDecodeError, UnicodeDecodeError) as err:
        raise ExportError("%s is not valid JSON (%s)." % (path, err))


def filter_sources(messages, wanted):
    """Keep messages whose source (or its part before ':') is in wanted."""
    wanted = set(wanted)
    return [m for m in messages if m.source in wanted or m.source.split(":")[0] in wanted]


def sort_messages(messages):
    """Stable, deterministic order: time, then source, then text."""
    return sorted(messages, key=lambda m: (m.created, m.source, m.text))
