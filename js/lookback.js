// A look back over 換角度 sessions, computed on the device. Descriptions only: with one
// person's handful of sessions nothing here is evidence that an approach works, so counts
// are always shown and averages need at least three sessions with both ratings.

const MIN_FOR_AVERAGE = 3;

export function lookBack(sessions = [], { since = 0, now = Date.now() } = {}) {
  const inRange = sessions.filter((s) => s && s.createdAt >= since && s.createdAt <= now);
  const byLens = new Map();
  const topics = new Map();
  for (const s of inRange) {
    const row = byLens.get(s.lensId) || { lensId: s.lensId, sessions: 0, shifts: [], ratings: [] };
    row.sessions++;
    if (Number.isInteger(s.before) && Number.isInteger(s.after)) row.shifts.push(s.after - s.before);
    if (Number.isInteger(s.rating)) row.ratings.push(s.rating);
    byLens.set(s.lensId, row);
    for (const t of s.topics || (s.topic ? [s.topic] : [])) topics.set(t, (topics.get(t) || 0) + 1);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const lenses = [...byLens.values()]
    .map((r) => ({
      lensId: r.lensId,
      sessions: r.sessions,
      withShift: r.shifts.length,
      meanShift: r.shifts.length >= MIN_FOR_AVERAGE ? Math.round(mean(r.shifts) * 10) / 10 : null,
      lighter: r.shifts.filter((d) => d < 0).length,
      same: r.shifts.filter((d) => d === 0).length,
      heavier: r.shifts.filter((d) => d > 0).length,
      meanRating: r.ratings.length >= MIN_FOR_AVERAGE ? Math.round(mean(r.ratings) * 10) / 10 : null,
    }))
    .sort((a, b) => b.sessions - a.sessions || a.lensId.localeCompare(b.lensId));
  return {
    sessions: inRange.length,
    distinctLenses: lenses.length,
    lenses,
    topics: [...topics.entries()].sort((a, b) => b[1] - a[1]).map(([topic, n]) => ({ topic, n })),
    minForAverage: MIN_FOR_AVERAGE,
  };
}
