# Notes for coding agents

Read this before changing code. These rules come from the project's privacy and safety design.

- **No network in the app.** No CDNs, remote fonts, analytics or fetches, except the opt-in AI conversation in `js/ai-chat.js`.
- **Every free-text field goes through `checkRisk` in `js/safety.js`** before it is used, saved or drawn. A match pauses with help lines; nothing is deleted. Cards (`js/scene.js`) never draw from text that matches.
- **Never put user text into `innerHTML`.** Use the `h()` helper. SVG strings escape text with `esc()`.
- **Copy:** Traditional Chinese and English for every string, plain and warm, no praise, no diagnosis, no em dashes. The lens summary quotes the person's own words and never builds sentences around them.
- **No regex lookbehind** anywhere in `js/` (older Safari fails to parse the whole app).
- **Release files:** after any change to app files, run `npm run prepare-release` (service worker cache name, content review), then `npm test`.
- **End-to-end tests:** `npm run test:e2e` (Playwright, Chromium); WebKit runs in CI. If several agents run tests at once, share one server on port 8787 instead of killing it.
- **Flat design, 圓方 (circle and square).** Three shapes only: the full circle, the half or quarter circle, and the square-cornered block. Two corners: square (`0`) and the full circle (`--pill`, chips and round things). No gradients, shadows, blur, translucency, texture, tilt or hairline boxes; the only outline is 2.5px ink, on fields, chips and plain buttons. Palette: 紙 paper, 墨 ink, and four spot colours used as flat fields: 玉 `--jade`, 朱 `--red`, 黃 `--sun`, 粉 `--pink`. Text is ink on paper, 黃 and 粉; white on ink and 玉. Never small text on 朱, never ink text on 玉, never 朱 or 玉 as text on paper (use `--red-text`). Primary actions are ink (黃 in dark and night). Tokens are at the top of `css/style.css`; the 圓方 rules are the last layer of that file.
- **Loud and quiet pages.** A loud page (Today, 換角度 home, a question's header, bedtime) has one colour block (`.cblock`, art from `blockArt()` in `js/icons.js`) that bleeds to the screen edges, with at most four colours in it. Quiet pages (the worry screens, choose, journal, about, sheets) are plain paper. One block per screen; the keepsake card counts as the block on the summary.
- **Mumu has two drawings** (`js/mascot.js`): `variant: 'solid'` (white body, big 朱 cheeks) only on a colour block or on a 黃 circle (`.mumu-seat`); the default `'line'` (one ink line, one 朱 dot) on paper. Never both on one screen.
- **Icons only from `js/icons.js`**: one solid mass in the text colour, details knocked out in the ground colour (`--ic-ground`), outside details as 2.2px square-capped lines, exactly one accent dot (`--ic-dot`). No emoji as icons, no other icon sets, no outline-only icons.
- **Type:** titles, buttons, tags and tab labels use Murmur Black (a subset of Noto Sans TC Black, OFL, one weight: 900); other interface text uses Murmur Round (a subset of jf open huninn, OFL); big numerals use Bricolage (`--num`). Rebuild the subsets with `tools/subset-font.py` after adding interface text with new characters. The person's own words use the system font (`--own`). No synthetic bold.
- **Help line:** the header shows the help link on every screen; keep it readable on any block placed under it (white on 玉, ink on 黃 and 粉).
- **Respect `prefers-reduced-motion`** for any animation; 44px touch targets; check 375px width and dark mode.
- Where things live: `docs/architecture.md`. Why 換角度 is built the way it is: `docs/change-the-angle.md`.
