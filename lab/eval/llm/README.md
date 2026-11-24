# Checks for the language-model layer of 換角度

`js/lens-llm.js` lets a model reword the lens questions, ask one follow-up and write the closing. This folder checks that nothing a model says reaches the person unless it follows the rules.

- `cases.json`: eight cases in Chinese and English, including a prompt-injection attempt written as the worry and two risk cases.
- `run.mjs`: runs the app's real `js/lens-llm.js` on each case, then re-checks every output that would be shown with independent checks (quotes are exact pieces of the person's words, no praise, no diagnosis words, no em dashes) and counts any call made for a risk case.

```
node lab/eval/llm/run.mjs                                   # adversarial mock, no key, runs in npm test
ANTHROPIC_API_KEY=... node lab/eval/llm/run.mjs --live      # a real model
```

The mock alternates replies that break every rule (made-up quotes, praise, a diagnosis, em dashes, objects outside the allowlist, broken JSON, advice instead of a question) with well-formed ones. Current result: 16 outputs reached the person, 0 broke a rule, 0 calls for the risk cases; the rest fell back to the fixed content. The live mode measures how often a real model's output passes (the fallback rate) without changing what the person can see.
