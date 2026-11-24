# Notes for coding agents

Read this before changing code. These rules come from the project's privacy and safety design.

- **No network in the app.** No CDNs, remote fonts, analytics or fetches, except the opt-in AI conversation in `js/ai-chat.js`.
- **Every free-text field goes through `checkRisk` in `js/safety.js`** before it is used, saved or drawn. A match pauses with help lines; nothing is deleted. Cards (`js/scene.js`) never draw from text that matches.
- **Never put user text into `innerHTML`.** Use the `h()` helper. SVG strings escape text with `esc()`.
- **Copy:** Traditional Chinese and English for every string, plain and warm, no praise, no diagnosis, no em dashes. The lens summary quotes the person's own words and never builds sentences around them.
- **No regex lookbehind** anywhere in `js/` (older Safari fails to parse the whole app).
- **Release files:** after any change to app files, run `npm run prepare-release` (service worker cache name, content review), then `npm test`.
- **End-to-end tests:** `npm run test:e2e` (Playwright, Chromium); WebKit runs in CI. Kill anything on port 8787 first.
- **Icons only from `js/icons.js`** (one line style, current text colour, soft accent fill). No emoji as icons, no other icon sets. Lens marks and colours stay in the purple to blue-violet family.
- **Respect `prefers-reduced-motion`** for any animation; 44px touch targets; check 375px width and dark mode.
- Where things live: `docs/architecture.md`. Why 換角度 is built the way it is: `docs/change-the-angle.md`.
