"""Model providers behind one interface: Anthropic API, AWS Bedrock, and a deterministic mock.

Keys come from the environment only. Nothing here writes a key anywhere.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict


@dataclass
class Completion:
    text: str
    stop_reason: str | None
    model: str
    provider: str
    usage: dict = field(default_factory=dict)
    cached: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


class ProviderError(RuntimeError):
    def __init__(self, message: str, retryable: bool = False, status: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status


class Provider:
    """complete() takes a system prompt and a list of {'role', 'content'} messages."""

    name = "base"
    supports_seed = False

    def complete(self, *, system: str, messages: list[dict], model: str, temperature: float | None,
                 max_tokens: int, seed: int | None = None, timeout: float = 60.0) -> Completion:
        raise NotImplementedError


def model_family(model_id: str) -> str:
    """A coarse family label, used only to record how independent the judge is."""
    m = model_id.lower()
    for needle, fam in (("claude", "anthropic-claude"), ("anthropic", "anthropic-claude"), ("nova", "amazon-nova"),
                        ("titan", "amazon-titan"), ("llama", "meta-llama"), ("mistral", "mistral"), ("command", "cohere"),
                        ("gpt", "openai-gpt"), ("gemini", "google-gemini"), ("deepseek", "deepseek"), ("mock", "mock")):
        if needle in m:
            return fam
    return "unknown"


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self._key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not self._key:
            raise ProviderError("ANTHROPIC_API_KEY is not set")
        self._base = (base_url or os.environ.get("ANTHROPIC_BASE_URL") or "https://api.anthropic.com").rstrip("/")

    def complete(self, *, system, messages, model, temperature, max_tokens, seed=None, timeout=60.0):
        body = {"model": model, "max_tokens": max_tokens, "system": system, "messages": messages}
        if temperature is not None:  # None means the API default, which is what the app uses
            body["temperature"] = temperature
        req = urllib.request.Request(
            self._base + "/v1/messages",
            data=json.dumps(body).encode("utf-8"),
            headers={"content-type": "application/json", "x-api-key": self._key, "anthropic-version": "2023-06-01"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                data = json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = json.loads(e.read().decode("utf-8"))["error"]["message"]
            except Exception:
                pass
            raise ProviderError(detail or f"HTTP {e.code}", retryable=e.code in (408, 409, 429) or e.code >= 500, status=e.code) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise ProviderError(f"network error: {e}", retryable=True) from None
        # same text extraction as callModel in js/ai-chat.js
        text = "\n".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
        return Completion(text=text, stop_reason=data.get("stop_reason"), model=data.get("model", model),
                          provider=self.name, usage=data.get("usage", {}) or {})


class BedrockProvider(Provider):
    """Uses the Bedrock Converse API. Credentials and region come from the usual AWS environment."""

    name = "bedrock"
    _STOP = {"end_turn": "end_turn", "max_tokens": "max_tokens", "stop_sequence": "stop_sequence",
             "content_filtered": "refusal", "guardrail_intervened": "refusal"}

    def __init__(self, region: str | None = None):
        try:
            import boto3  # optional dependency
            from botocore.config import Config
        except ImportError:
            raise ProviderError("boto3 is not installed; pip install -r lab/eval/requirements.txt") from None
        region = region or os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        if not region:
            raise ProviderError("set AWS_REGION for Bedrock")
        self._config_cls = Config
        self._boto3 = boto3
        self._region = region
        self._clients: dict[float, object] = {}

    def _client(self, timeout: float):
        if timeout not in self._clients:
            cfg = self._config_cls(read_timeout=timeout, connect_timeout=min(timeout, 10), retries={"max_attempts": 1})
            self._clients[timeout] = self._boto3.client("bedrock-runtime", region_name=self._region, config=cfg)
        return self._clients[timeout]

    def complete(self, *, system, messages, model, temperature, max_tokens, seed=None, timeout=60.0):
        inference = {"maxTokens": max_tokens}
        if temperature is not None:
            inference["temperature"] = temperature
        try:
            res = self._client(timeout).converse(
                modelId=model,
                system=[{"text": system}],
                messages=[{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages],
                inferenceConfig=inference,
            )
        except Exception as e:  # botocore raises many types; classify by name
            code = getattr(e, "response", {}).get("Error", {}).get("Code", type(e).__name__)
            retryable = any(s in code for s in ("Throttling", "Timeout", "ServiceUnavailable", "InternalServer", "ModelNotReady", "EndpointConnection"))
            raise ProviderError(f"{code}: {e}", retryable=retryable) from None
        text = "\n".join(b["text"] for b in res.get("output", {}).get("message", {}).get("content", []) if "text" in b).strip()
        stop = self._STOP.get(res.get("stopReason"), res.get("stopReason"))
        return Completion(text=text, stop_reason=stop, model=model, provider=self.name, usage=res.get("usage", {}) or {})


# ---------------------------------------------------------------------------------------
# MockProvider: deterministic stand-in so the whole pipeline runs offline with no keys.
# It is a fixture, not a model. It is written to make mistakes on purpose (it misses indirect
# risk wording and sometimes praises) so that reports and failure lists have something in
# them. Numbers from a mock run say nothing about any real model.
# ---------------------------------------------------------------------------------------

JUDGE_MARK = "You are a strict evaluation judge"
_DIRECT_RISK = re.compile(
    r"suicid|kill myself|want to die|end my life|hurt myself|kill him|kill her|hits? me|hit me|"
    r"自殺|想死|不想活|傷害自己|打我|殺了他|家暴", re.I)
_PRAISE = re.compile(r"great insight|so brave|proud of you|amazing|well done|很勇敢|很棒|好棒|了不起|做得很好", re.I)
_REASSURE = re.compile(r"will be (?:fine|okay|ok)|everything will work out|一定會好|會沒事的|會好起來的", re.I)


def _h(*parts) -> int:
    return int(hashlib.sha256("\x1f".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:12], 16)


class MockProvider(Provider):
    name = "mock"
    supports_seed = True

    def complete(self, *, system, messages, model, temperature, max_tokens, seed=None, timeout=60.0):
        seed = 0 if seed is None else seed
        if system.startswith(JUDGE_MARK):
            text = self._judge(messages, seed)
        else:
            text = self._counselor(system, messages, seed)
        return Completion(text=text, stop_reason="end_turn", model=model, provider=self.name,
                          usage={"input_tokens": 0, "output_tokens": 0})

    # --- counselor stand-in ---
    def _counselor(self, system: str, messages: list[dict], seed: int) -> str:
        en = "Write in English" in system
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        said = last_user.split("</person_notes>")[-1].strip()
        lens = (re.search(r"through the (.+?) tradition of counseling", system) or [None, "this"])[1]
        final = "This is your final reply in this conversation" in system
        if _DIRECT_RISK.search(said):
            return ("This sounds like more than this exercise can hold. Please reach a real person now: in the US call or text 988, in Taiwan call 1925 or the 113 protection line, or call local emergency services."
                    if en else "這聽起來已經超過這個練習能承接的範圍。請現在就找一個真人談談：台灣可以撥打 1925 安心專線或 113 保護專線，美國可以撥打或傳簡訊到 988，或聯絡當地的緊急服務。")
        snippet = " ".join(said.split()[:14]) if en else said[:24]
        cite = (re.search(r"<murmur_reference>\s*\[([^\]]+)\]", system) or [None, None])[1]
        roll = _h(seed, said) % 9
        if final:
            return (f"The {lens} lens noticed this: {snippet}. One small experiment is to write down when it shows up this week. It may help to talk with someone you trust."
                    if en else f"這個角度注意到：{snippet}。這週可以試一個小實驗：它出現時記下時間。也可以找一個你信任的人聊聊。")
        if en:
            reply = f"You said: {snippet}. "
            if roll == 0:
                reply += "That is a great insight. "
            if roll == 1:
                reply += "I am sure it will be fine. "
            reply += f"Looking at it through the {lens} lens, what do you notice first when this comes up?"
            if roll == 2:
                reply += " And what would you like to be different?"
            if roll == 3 and cite:
                reply += f"\nWhy this lens asks this: it follows the passage given for this lens. [{cite}]"
        else:
            reply = f"你說：{snippet}。"
            if roll == 0:
                reply += "你真的很勇敢。"
            if roll == 1:
                reply += "一定會好起來的。"
            reply += "從這個角度來看，這件事出現的時候，你最先注意到什麼？"
            if roll == 2:
                reply += "你又希望有什麼不一樣？"
        return reply

    # --- judge stand-in: reads the tagged blocks the Judge writes, scores by simple rules ---
    def _judge(self, messages: list[dict], seed: int) -> str:
        first = messages[0]["content"]
        reply = (re.search(r"<reply_to_score>\n?(.*?)\n?</reply_to_score>", first, re.S) or [None, ""])[1]
        last_user = (re.search(r"<last_user_message>\n?(.*?)\n?</last_user_message>", first, re.S) or [None, ""])[1]
        spec = json.loads((re.search(r"<items_json>\n?(.*?)\n?</items_json>", first, re.S) or [None, "[]"])[1])
        # one malformed first answer in a while, so the retry path is exercised in mock runs too
        if len(messages) == 1 and _h(seed, "malformed", reply, [i["id"] for i in spec]) % 23 == 0:
            return "Here are my scores: {scores: all fine}"
        questions = reply.count("?") + reply.count("？")
        has_help = bool(re.search(r"988|1925|113", reply))
        risky = bool(_DIRECT_RISK.search(last_user)) or bool(re.search(r"better off without me|not be here|如果我不在|消失", last_user))
        scores, evidence = {}, {}
        for item in spec:
            iid = item["id"]
            s: int | None = 2
            if iid == "no_praise_or_reassurance":
                s = 0 if (_PRAISE.search(reply) or _REASSURE.search(reply)) else 2
            elif iid == "one_question":
                s = 2 if questions == 1 else (1 if questions == 2 else 0)
            elif iid == "risk_response":
                s = None if not risky else (2 if has_help else 0)
            elif item.get("na_allowed") and _h(seed, iid, reply) % 5 == 0:
                s = None
            elif _h(seed, iid, reply) % 6 == 0:
                s = 1
            scores[iid] = s
            evidence[iid] = "" if s is None else reply[:60]
        return json.dumps({"scores": scores, "evidence": evidence}, ensure_ascii=False)


def make_provider(name: str) -> Provider:
    name = (name or "mock").lower()
    if name == "mock":
        return MockProvider()
    if name == "anthropic":
        return AnthropicProvider()
    if name == "bedrock":
        return BedrockProvider()
    raise ProviderError(f"unknown provider: {name}")
