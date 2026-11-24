"""Optional charts (matplotlib). The pipeline runs without them."""

SURFACE, INK, MUTED, GRID, BLUE = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df", "#2a78d6"


def available():
    try:
        import matplotlib  # noqa: F401
        return True
    except Exception:
        return False


def _setup():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "axes.edgecolor": GRID, "axes.labelcolor": MUTED, "text.color": INK,
        "xtick.color": MUTED, "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True,
        "font.size": 9, "axes.titlesize": 10, "axes.titleweight": "bold", "axes.titlelocation": "left",
        "font.family": ["DejaVu Sans", "Noto Sans CJK TC", "Noto Sans CJK JP", "sans-serif"],
    })
    import logging
    logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
    return plt


def _save(plt, fig, path, note):
    if note:
        fig.text(0.01, 0.005, note, fontsize=7, color=MUTED, ha="left", va="bottom")
    fig.savefig(path, dpi=150, bbox_inches="tight", pad_inches=0.15, metadata={"Software": None})
    plt.close(fig)


def top_ngrams(path, top_by_n, note=""):
    """top_by_n: {n: [(feat, share of all n-grams), ...]}; one panel per n."""
    plt = _setup()
    ns = [n for n in sorted(top_by_n) if top_by_n[n]]
    if not ns:
        return False
    fig, axes = plt.subplots(1, len(ns), figsize=(4.2 * len(ns), 5.2), constrained_layout=True)
    axes = [axes] if len(ns) == 1 else list(axes)
    for ax, n in zip(axes, ns):
        items = top_by_n[n][::-1]
        ax.barh([f for f, _ in items], [100 * v for _, v in items], color=BLUE, height=0.62)
        ax.set_title("Most frequent %d-grams" % n)
        ax.set_xlabel("%% of all %d-grams, all analyzed periods" % n)
        ax.grid(axis="y", visible=False)
        ax.tick_params(length=0)
    fig.get_layout_engine().set(rect=(0, 0.03, 1, 0.97))
    _save(plt, fig, path, note)
    return True


def series_panels(path, periods, series, note=""):
    """Small multiples, one panel per series, shared x axis (never two scales on one panel).
    series: list of (title, y label, [value or None per period])."""
    plt = _setup()
    series = [s for s in series if any(v is not None for v in s[2])]
    if not series or len(periods) < 2:
        return False
    cols = 2 if len(series) > 3 else 1
    rows = (len(series) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(5.2 * cols, 1.9 * rows + 0.6), sharex=True,
                             constrained_layout=True, squeeze=False)
    step = max(1, len(periods) // 6)
    for i, (title, ylabel, values) in enumerate(series):
        ax = axes[i // cols][i % cols]
        xs = [j for j, v in enumerate(values) if v is not None]
        ax.plot(xs, [values[j] for j in xs], color=BLUE, linewidth=2, marker="o", markersize=4,
                markeredgecolor=SURFACE, markeredgewidth=1)
        ax.set_title(title)
        ax.set_ylabel(ylabel)
        ax.set_xlim(-0.5, len(periods) - 0.5)
        ax.set_xticks(range(0, len(periods), step))
        ax.set_xticklabels([periods[j] for j in range(0, len(periods), step)], rotation=30, ha="right")
        ax.tick_params(length=0)
    for j in range(len(series), rows * cols):
        axes[j // cols][j % cols].set_visible(False)
    fig.get_layout_engine().set(rect=(0, 0.03, 1, 0.97))
    _save(plt, fig, path, note)
    return True


def correlation_dots(path, rows, title, note=""):
    """Dot and 95% interval for each row (at most 20), sorted by rho. One outcome per chart."""
    plt = _setup()
    rows = sorted(rows, key=lambda r: r["rho"])[-20:] if rows else []
    rows = [r for r in rows if r.get("rho") is not None]
    if not rows:
        return False
    fig, ax = plt.subplots(figsize=(7.6, 0.3 * len(rows) + 2.0), constrained_layout=True)
    ys = range(len(rows))
    for y, r in zip(ys, rows):
        if r.get("ci_low") is not None and r.get("ci_high") is not None:
            ax.plot([r["ci_low"], r["ci_high"]], [y, y], color=BLUE, linewidth=2, alpha=0.45, solid_capstyle="round")
    ax.plot([r["rho"] for r in rows], list(ys), "o", color=BLUE, markersize=6, markeredgecolor=SURFACE, markeredgewidth=1)
    ax.axvline(0, color=MUTED, linewidth=1)
    ax.set_yticks(list(ys))
    ax.set_yticklabels([r["feature"] for r in rows])
    ax.set_xlim(-1.05, 1.05)
    ax.set_xlabel("Spearman's rho with approximate 95% interval")
    ax.set_title(title)
    ax.grid(axis="y", visible=False)
    ax.tick_params(length=0)
    fig.get_layout_engine().set(rect=(0, 0.09, 1, 0.94))
    _save(plt, fig, path, note)
    return True
