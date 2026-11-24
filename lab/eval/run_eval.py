#!/usr/bin/env python3
"""Run the evaluation. With no arguments it uses the MockProvider and needs no keys and no network.

Examples (from the repository root):
  python3 lab/eval/run_eval.py
  python3 lab/eval/run_eval.py --counselor-provider anthropic --judge-provider anthropic --judge-model <another model id>
  python3 lab/eval/run_eval.py --counselor-provider bedrock --counselor-model <id> --judge-provider bedrock --judge-model <id of another family>
  python3 lab/eval/run_eval.py --report-only lab/eval/runs/<run id>
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from murmur_eval.orchestrator import Orchestrator, RunConfig  # noqa: E402
from murmur_eval.providers import make_provider  # noqa: E402
from murmur_eval.report import write_report  # noqa: E402

MOCK_COUNSELOR, MOCK_JUDGE = "mock-counselor-1", "mock-judge-1"


def main(argv: list[str] | None = None) -> int:
    d = RunConfig()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--counselor-provider", default=os.environ.get("MURMUR_EVAL_COUNSELOR_PROVIDER", "mock"), choices=["mock", "anthropic", "bedrock"])
    p.add_argument("--judge-provider", default=os.environ.get("MURMUR_EVAL_JUDGE_PROVIDER"), choices=["mock", "anthropic", "bedrock"], help="default: same as the counselor provider")
    p.add_argument("--counselor-model", default=os.environ.get("MURMUR_EVAL_COUNSELOR_MODEL"), help="default: the first model listed in js/ai-chat.js")
    p.add_argument("--judge-model", default=os.environ.get("MURMUR_EVAL_JUDGE_MODEL"), help="must differ from the counselor model; default: the second model listed in js/ai-chat.js")
    p.add_argument("--counselor-temperature", type=float, default=None, help="default: not sent, as in the app")
    p.add_argument("--judge-temperature", type=float, default=0.0)
    p.add_argument("--no-judge-temperature", action="store_true", help="do not send a temperature to the judge model")
    p.add_argument("--allow-same-model", action="store_true", help="let the judge be the counselor model (recorded in run.json)")
    p.add_argument("--cases", type=Path, default=d.cases_path)
    p.add_argument("--only", nargs="*", default=[], help="case ids to run")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--replicates", type=int, default=1, help="repeat each case; each replicate is cached separately")
    p.add_argument("--concurrency", type=int, default=d.concurrency)
    p.add_argument("--case-timeout", type=float, default=d.case_timeout)
    p.add_argument("--call-timeout", type=float, default=d.call_timeout)
    p.add_argument("--max-retries", type=int, default=d.max_retries)
    p.add_argument("--seed", type=int, default=d.seed)
    p.add_argument("--out", type=Path, default=d.out_root)
    p.add_argument("--run-id", default=None, help="folder name under --out; default is a UTC timestamp")
    p.add_argument("--cache-dir", type=Path, default=d.cache_dir)
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--skip-judges", action="store_true")
    p.add_argument("--report-only", type=Path, default=None, help="rebuild summary.md for an existing run folder")
    a = p.parse_args(argv)

    if a.report_only:
        print(write_report(a.report_only))
        return 0
    judge_provider_name = a.judge_provider or a.counselor_provider
    counselor_provider = make_provider(a.counselor_provider)
    judge_provider = counselor_provider if judge_provider_name == a.counselor_provider else make_provider(judge_provider_name)
    cfg = RunConfig(
        cases_path=a.cases, out_root=a.out, cache_dir=None if a.no_cache else a.cache_dir, run_id=a.run_id,
        counselor_model=a.counselor_model or (MOCK_COUNSELOR if a.counselor_provider == "mock" else None),
        counselor_temperature=a.counselor_temperature,
        judge_model=a.judge_model or (MOCK_JUDGE if judge_provider_name == "mock" else None),
        judge_temperature=None if a.no_judge_temperature else a.judge_temperature,
        allow_same_model=a.allow_same_model, concurrency=a.concurrency, case_timeout=a.case_timeout, call_timeout=a.call_timeout,
        max_retries=a.max_retries, seed=a.seed, replicates=a.replicates, limit=a.limit, only=a.only, skip_judges=a.skip_judges,
    )
    orch = Orchestrator(cfg, counselor_provider, judge_provider)
    out = orch.run()
    print(f"run written to {out}")
    print(f"report: {out / 'summary.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
