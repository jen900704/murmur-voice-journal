"""Runs scripted test cases through Counselor, SafetyGate and Judges, and writes a run folder."""
from __future__ import annotations

import csv
import json
import platform
import random
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .agents import JUDGE_SYSTEM, Counselor, Judge, ParityError, SafetyGate, ScriptedUser
from .bridge import EVAL_DIR, Bridge
from .cache import DiskCache, call_key, canonical, sha256
from .checks import auto_checks
from .providers import Completion, Provider, ProviderError, model_family
from .schema import load_cases, load_rubrics, rubric_hash


class CaseTimeout(RuntimeError):
    pass


class LLMClient:
    """One provider plus the shared machinery: semaphore, disk cache, retries with backoff, timeouts."""

    def __init__(self, provider: Provider, cache: DiskCache, semaphore: threading.Semaphore, *, call_timeout: float = 60.0,
                 max_retries: int = 4, backoff_base: float = 1.0, backoff_cap: float = 30.0, sleep=time.sleep, rng: random.Random | None = None):
        self.provider = provider
        self.cache = cache
        self._sem = semaphore
        self.call_timeout = call_timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.backoff_cap = backoff_cap
        self._sleep = sleep
        self._rng = rng or random.Random(0)
        self._lock = threading.Lock()
        self.stats = {"calls": 0, "cache_hits": 0, "retries": 0, "errors": 0}

    def _bump(self, key: str, n: int = 1) -> None:
        with self._lock:
            self.stats[key] += n

    def call(self, *, role: str, system: str, messages: list[dict], model: str, temperature, max_tokens: int, seed=None,
             replicate: int = 0, deadline: float | None = None) -> Completion:
        key = call_key(self.provider.name, model, system, messages, temperature, max_tokens, seed, replicate)
        self._bump("calls")
        hit = self.cache.get(key)
        if hit is not None:
            self._bump("cache_hits")
            return Completion(**{**hit, "cached": True})
        attempt = 0
        while True:
            if deadline is not None and time.monotonic() > deadline:
                raise CaseTimeout(f"case deadline passed before a {role} call")
            try:
                with self._sem:
                    comp = self.provider.complete(system=system, messages=messages, model=model, temperature=temperature,
                                                  max_tokens=max_tokens, seed=seed, timeout=self.call_timeout)
                break
            except ProviderError as e:
                attempt += 1
                if not e.retryable or attempt > self.max_retries:
                    self._bump("errors")
                    raise
                self._bump("retries")
                with self._lock:
                    jitter = self._rng.random()
                self._sleep(min(self.backoff_cap, self.backoff_base * 2 ** (attempt - 1)) * (0.5 + jitter / 2))
        self.cache.put(key, {k: v for k, v in comp.to_dict().items() if k != "cached"})
        return comp


@dataclass
class RunConfig:
    cases_path: Path = EVAL_DIR / "cases" / "cases.json"
    rubrics_dir: Path = EVAL_DIR / "rubrics"
    out_root: Path = EVAL_DIR / "runs"
    cache_dir: Path | None = EVAL_DIR / ".cache"
    run_id: str | None = None
    counselor_model: str | None = None          # None = the app's first model
    counselor_temperature: float | None = None  # None = provider default, as in the app
    judge_model: str | None = None
    judge_temperature: float | None = 0.0
    allow_same_model: bool = False
    concurrency: int = 4
    case_timeout: float = 600.0
    call_timeout: float = 60.0
    max_retries: int = 4
    judge_attempts: int = 3
    seed: int = 20261124
    replicates: int = 1
    limit: int | None = None
    only: list[str] = field(default_factory=list)
    skip_judges: bool = False


def independence(c_provider: str, c_model: str, j_provider: str, j_model: str) -> str:
    cf, jf = model_family(c_model), model_family(j_model)
    if cf != jf and "unknown" not in (cf, jf):
        return "different_family"
    if c_model != j_model:
        return "different_model"
    return "same_model"


def _git_commit() -> str | None:
    try:  # read-only
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=EVAL_DIR, capture_output=True, text=True, timeout=5)
        return out.stdout.strip() or None
    except Exception:
        return None


class Orchestrator:
    def __init__(self, config: RunConfig, counselor_provider: Provider, judge_provider: Provider, bridge: Bridge | None = None, sleep=time.sleep):
        self.cfg = config
        self.bridge = bridge or Bridge()
        self.info = self.bridge.info()
        self.lens_info = {l["id"]: l for l in self.info["lenses"]}
        sem = threading.Semaphore(max(1, config.concurrency))
        cache = DiskCache(config.cache_dir)
        self.cache = cache
        rng = random.Random(config.seed)
        common = dict(call_timeout=config.call_timeout, max_retries=config.max_retries, sleep=sleep, rng=rng)
        self.counselor_client = LLMClient(counselor_provider, cache, sem, **common)
        self.judge_client = self.counselor_client if judge_provider is counselor_provider else LLMClient(judge_provider, cache, sem, **common)
        self.counselor_model = config.counselor_model or self.info["models"][0]["id"]
        self.judge_model = config.judge_model or self.info["models"][1]["id"]
        self.independence = independence(counselor_provider.name, self.counselor_model, judge_provider.name, self.judge_model)
        if self.independence == "same_model" and not config.allow_same_model and not config.skip_judges:
            raise ValueError("the judge model is the same as the counselor model; choose another judge model or pass allow_same_model")
        self.rubrics = load_rubrics(config.rubrics_dir)
        self.gate = SafetyGate(self.bridge)
        self.counselor = Counselor(self.bridge, self.counselor_client, self.counselor_model, config.counselor_temperature, config.seed)
        self.judges = [Judge(r, self.judge_client, self.judge_model, config.judge_temperature, max_attempts=config.judge_attempts, seed=config.seed)
                       for r in self.rubrics.values()]
        self.cases = load_cases(config.cases_path, self.lens_info)
        if config.only:
            self.cases = [c for c in self.cases if c["id"] in set(config.only)]
        if config.limit:
            self.cases = self.cases[: config.limit]

    # ---------------------------------------------------------------- one conversation
    def run_case(self, case: dict, replicate: int = 0) -> dict:
        """Plays the script into the app's own send() and records what the app did at each step."""
        deadline = time.monotonic() + self.cfg.case_timeout
        user = ScriptedUser(case)
        lens, lang = case["lens"], case["lang"]
        chat = self.counselor.open(lens, lang, user.context)
        turns: list[dict] = []
        ended = None
        try:
            for st in user.turns:
                if chat.state["ended"]:
                    break
                shown_before = [{"role": m["role"], "content": m["content"]} for m in chat.state["messages"]]
                pre = self.gate.before_send(st.text)
                rec = {"turn": st.index, "label": st.label, "meta": st.meta, "user": st.text,
                       "pre_gate": {"risk": pre.risk, "kinds": pre.kinds}, "paused": False, "pause_action": None,
                       "assistant": None, "assistant_raw": None, "based_on": None, "stop_reason": None, "post_gate": None, "outcome": None,
                       "turn_type": None, "app_help_shown": False, "history_before": shown_before}
                turns.append(rec)
                request = chat.send(st.text)
                if chat.state["pause"] != pre.risk:
                    raise ParityError(f"{case['id']} turn {st.index}: app pause={chat.state['pause']} but checkRisk={pre.risk}")
                if chat.state["pause"]:  # the app shows help lines and waits; the script stops or sends anyway
                    rec.update(paused=True, app_help_shown=True, pause_action=user.on_pause(st))
                    if rec["pause_action"] == "stop":
                        rec["outcome"] = "paused_stop"
                        ended = "paused_stop"
                        break
                    request = chat.send(st.text, confirmed=True)
                if request is None:
                    rec.update(outcome="app_error", app_error=chat.state["error"])
                    continue
                n_before = len(chat.state["messages"])
                comp, meta = self.counselor.answer(request, replicate=replicate, deadline=deadline)
                state = chat.deliver(comp.text, comp.stop_reason)
                rec.update(stop_reason=comp.stop_reason, counselor_model=comp.model, cached=comp.cached, **meta)
                raw = comp.text
                answered = bool(raw) and comp.stop_reason not in ("refusal", "max_tokens")
                if raw:
                    post, action = self.gate.after_reply(raw)
                    rec["assistant_raw"] = raw
                    rec["post_gate"] = {"risk": post.risk, "kinds": post.kinds, "help_line": post.help_line}
                if answered:
                    if state["crisis"] != (action == "hold"):
                        raise ParityError(f"{case['id']} turn {st.index}: app held={state['crisis']} but the gate says {action}")
                    rec["turn_type"] = "crisis" if post.help_line else ("final" if meta["last"] else "standard")
                if state["crisis"]:
                    rec.update(outcome="held", app_help_shown=True, assistant=raw)
                    chat.back_to_conversation()
                elif len(state["messages"]) == n_before + 1 and state["messages"][-1]["role"] == "assistant":
                    msg = state["messages"][-1]
                    rec.update(outcome="shown", assistant=msg["content"], based_on=msg["basedOn"], app_help_shown=rec["app_help_shown"] or state["showHelp"])
                elif state["ended"]:
                    rec.update(outcome="no_reply_help_shown", app_help_shown=True)
                else:
                    rec.update(outcome="truncated" if comp.stop_reason == "max_tokens" else "app_error", app_error=state["error"])
                if rec["assistant"] and rec["turn_type"]:
                    rec["auto_checks"] = auto_checks(rec["assistant"], lang, rec["turn_type"], rec["post_gate"]["help_line"])
                if state["ended"]:
                    ended = {"shown": "help_line" if state["showHelp"] else "turn_limit"}.get(rec["outcome"], "no_reply")
                    break
        finally:
            chat.close()
        judgments = [] if self.cfg.skip_judges else self._judge_case(case, user, turns, deadline)
        return {"case": case, "replicate": replicate, "turns": turns, "ended": ended or "script_finished", "judgments": judgments}

    def _judge_case(self, case: dict, user: ScriptedUser, turns: list[dict], deadline: float) -> list[dict]:
        out = []
        for rec in turns:
            if not rec["assistant"] or rec["turn_type"] is None:
                continue
            for judge in self.judges:
                j = judge.score(lens_id=case["lens"], lang=case["lang"], turn_type=rec["turn_type"], notes=user.context,
                                history=rec["history_before"], last_user=rec["user"], reply=rec["assistant"], deadline=deadline)
                if j is not None:
                    out.append({"case_id": case["id"], "turn": rec["turn"], **j})
        return out

    def _safe_case(self, case: dict, replicate: int) -> dict:
        try:
            return self.run_case(case, replicate)
        except Exception as e:  # one broken case must not lose the run
            return {"case": case, "replicate": replicate, "turns": [], "ended": "error", "judgments": [], "error": f"{type(e).__name__}: {e}"}

    # ---------------------------------------------------------------- the whole run
    def manifest(self, run_id: str, started: str) -> dict:
        prompts = {}  # base prompts; the app appends retrieved passages per turn, hashed per turn in transcripts.jsonl
        for c in self.cases:
            for last in (False, True):
                prompts[f"{c['lens']}|{c['lang']}|{'final' if last else 'standard'}"] = sha256(self.bridge.system_prompt(c["lens"], c["lang"], last))
        cp, jp = self.counselor_client.provider, self.judge_client.provider
        return {
            "run_id": run_id, "started_utc": started, "harness_version": __version__, "git_commit": _git_commit(),
            "python": platform.python_version(), "node": self.info["node"],
            "app_sources_sha256": self.info["sources"],
            "cases_file": str(Path(self.cfg.cases_path).name), "cases_sha256": sha256(Path(self.cfg.cases_path).read_text(encoding="utf-8")),
            "n_cases": len(self.cases), "replicates": self.cfg.replicates, "seed": self.cfg.seed,
            "counselor": {"provider": cp.name, "model": self.counselor_model, "temperature": self.cfg.counselor_temperature,
                          "temperature_note": "null means the provider default, which is what the app sends",
                          "app_model_setting": self.counselor.app_model, "max_tokens": "taken from each request the app builds", "seed_applied": cp.supports_seed, "max_user_turns": self.counselor.max_user_turns},
            "judge": {"provider": jp.name, "model": self.judge_model, "temperature": self.cfg.judge_temperature, "max_tokens": self.judges[0].max_tokens,
                      "seed_applied": jp.supports_seed, "max_attempts": self.cfg.judge_attempts, "system_prompt_sha256": sha256(JUDGE_SYSTEM)},
            "judge_independence": self.independence,
            "rubrics": {rid: {"version": r["version"], "sha256": rubric_hash(r)} for rid, r in self.rubrics.items()},
            "counselor_base_system_prompt_sha256": prompts, "app_retrieval": self.info["retrieval"], "app_help_region": self.info["regionFor"],
            "concurrency": self.cfg.concurrency, "case_timeout_s": self.cfg.case_timeout, "call_timeout_s": self.cfg.call_timeout,
            "max_retries": self.cfg.max_retries, "judges_skipped": self.cfg.skip_judges,
        }

    def run(self) -> Path:
        started = datetime.now(timezone.utc)
        run_id = self.cfg.run_id or started.strftime("%Y%m%dT%H%M%SZ")
        out = Path(self.cfg.out_root) / run_id
        out.mkdir(parents=True, exist_ok=True)
        manifest = self.manifest(run_id, started.isoformat(timespec="seconds"))
        jobs = [(c, r) for r in range(self.cfg.replicates) for c in self.cases]
        with ThreadPoolExecutor(max_workers=max(1, self.cfg.concurrency)) as pool:
            results = list(pool.map(lambda job: self._safe_case(*job), jobs))
        manifest["finished_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if self.judge_client is self.counselor_client:  # one provider serves both roles
            manifest["calls"] = {"counselor and judge": dict(self.counselor_client.stats)}
        else:
            manifest["calls"] = {"counselor": dict(self.counselor_client.stats), "judge": dict(self.judge_client.stats)}
        manifest["case_errors"] = [{"case_id": r["case"]["id"], "error": r["error"]} for r in results if r.get("error")]
        write_run(out, manifest, results)
        from .report import write_report
        write_report(out)
        return out


# ---------------------------------------------------------------- output files

RESULT_COLUMNS = ["run_id", "case_id", "replicate", "lens", "lang", "topic", "turn", "turn_label", "turn_type", "outcome", "source", "rubric", "item", "score"]
RISK_COLUMNS = ["run_id", "case_id", "replicate", "lens", "lang", "label", "category", "directness", "turn", "gate_flagged", "pause_action",
                "model_help_line", "model_no_reply", "reply_held", "app_help_shown", "help_line_by_end"]


def write_run(out: Path, manifest: dict, results: list[dict]) -> None:
    run_id = manifest["run_id"]
    stamp = {"run_id": run_id, "counselor_model": manifest["counselor"]["model"], "counselor_temperature": manifest["counselor"]["temperature"],
             "judge_model": manifest["judge"]["model"], "judge_temperature": manifest["judge"]["temperature"], "seed": manifest["seed"]}
    (out / "run.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with open(out / "transcripts.jsonl", "w", encoding="utf-8") as tf, open(out / "labels.jsonl", "w", encoding="utf-8") as lf, \
            open(out / "judgments.jsonl", "w", encoding="utf-8") as jf, \
            open(out / "results.csv", "w", encoding="utf-8", newline="") as rf, open(out / "risk_turns.csv", "w", encoding="utf-8", newline="") as kf:
        rw = csv.DictWriter(rf, fieldnames=RESULT_COLUMNS)
        rw.writeheader()
        kw = csv.DictWriter(kf, fieldnames=RISK_COLUMNS)
        kw.writeheader()
        for res in results:
            c, rep = res["case"], res["replicate"]
            base = {"run_id": run_id, "case_id": c["id"], "replicate": rep, "lens": c["lens"], "lang": c["lang"], "topic": c["topic"]}
            # transcripts.jsonl is what a human annotator loads: no case labels, no judge scores
            tf.write(json.dumps({**stamp, "case_id": c["id"], "replicate": rep, "lens": c["lens"], "lang": c["lang"],
                                 "notes": {"worry": c["worry"], "answers": c["answers"]}, "ended": res["ended"], "error": res.get("error"),
                                 "turns": [{k: t.get(k) for k in ("turn", "user", "pre_gate", "paused", "pause_action", "assistant", "assistant_raw", "based_on",
                                                                  "stop_reason", "post_gate", "outcome", "turn_type", "app_help_shown",
                                                                  "system_prompt_sha256", "request_sha256", "cached")} for t in res["turns"]]}, ensure_ascii=False) + "\n")
            # labels.jsonl holds what the annotator must not see
            lf.write(json.dumps({"run_id": run_id, "case_id": c["id"], "replicate": rep, "topic": c["topic"], "persona": c["persona"],
                                 "tags": c.get("tags", []), "turn_labels": [{"turn": t["turn"], "label": t["label"], "meta": t["meta"]} for t in res["turns"]]},
                                ensure_ascii=False) + "\n")
            by_turn = {t["turn"]: t for t in res["turns"]}
            for j in res["judgments"]:
                jf.write(json.dumps({**stamp, "replicate": rep, **j}, ensure_ascii=False) + "\n")
                t = by_turn[j["turn"]]
                for item, score in j["scores"].items():
                    rw.writerow({**base, "turn": j["turn"], "turn_label": t["label"], "turn_type": t["turn_type"], "outcome": t["outcome"],
                                 "source": "judge_failed" if j["failed"] else "judge", "rubric": j["rubric"], "item": item, "score": "" if score is None else score})
            for t in res["turns"]:
                for item, score in (t.get("auto_checks") or {}).items():
                    rw.writerow({**base, "turn": t["turn"], "turn_label": t["label"], "turn_type": t["turn_type"], "outcome": t["outcome"],
                                 "source": "auto", "rubric": "auto_checks", "item": item, "score": "" if score is None else score})
            later_help = any((t.get("post_gate") or {}).get("help_line") for t in res["turns"])
            for t in res["turns"]:
                post = t.get("post_gate") or {}
                kw.writerow({"run_id": run_id, "case_id": c["id"], "replicate": rep, "lens": c["lens"], "lang": c["lang"], "label": t["label"],
                             "category": t["meta"].get("category", ""), "directness": t["meta"].get("directness", ""), "turn": t["turn"],
                             "gate_flagged": int(t["pre_gate"]["risk"]), "pause_action": t["pause_action"] or "",
                             "model_help_line": "" if t["outcome"] in ("paused_stop", None) else int(bool(post.get("help_line"))),
                             "model_no_reply": int(t["outcome"] == "no_reply_help_shown"), "reply_held": int(t["outcome"] == "held"),
                             "app_help_shown": int(t["app_help_shown"]), "help_line_by_end": int(later_help)})
