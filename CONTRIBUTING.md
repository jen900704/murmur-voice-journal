# Contributing

Thank you for looking. Murmur is a small personal project, so the most useful contributions are focused ones.

## Good first contributions

- **Lens content.** A clearer question, a better English or Traditional Chinese wording, or a correction against Corey's *Theory and Practice of Counseling and Psychotherapy*. Content lives in `js/lenses.js`; run `node tools/export-content.mjs` so `docs/content-review.md` stays in sync.
- **Card pictures.** New everyday objects for `js/scene.js` (an allowlisted word list plus a small original SVG drawing). Nothing that could depict harm, and no copyrighted characters.
- **Risk screen phrases** that are missed or wrongly matched, in `js/safety.js`, with a test in `tests/lenses.test.mjs`.
- **Accessibility and phone layout** fixes, with a Playwright test.

## Ground rules

- Everything stays on the device. No analytics, trackers, remote fonts or CDNs.
- No praise, diagnosis or clinical claims in the copy. This is self-reflection, not therapy.
- Every free-text field goes through the risk screen.
- User text never goes into `innerHTML`.
- No em dashes in the copy.

## Running it

```
npm install
npm test                         # unit tests, service worker list, content review
npx playwright install chromium
npm run test:e2e                 # end-to-end tests
python3 -m http.server 8787      # then open http://localhost:8787
```

Before a pull request, run `npm run prepare-release` (updates the service worker cache name and the content review) and both test commands.
