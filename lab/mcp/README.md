# Murmur MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Murmur's vetted psychoeducation content to an MCP client such as Claude Desktop or Claude Code. It is read-only and runs on your own machine over stdio.

It imports the app's own modules (`../../js/lenses.js`, `../../js/safety.js`, `../../js/bedtime.js`) and reads `../../data/recs.json`, so the app stays the single source of truth. Nothing is copied into this folder.

Everything it returns is psychoeducation, not therapy, diagnosis or crisis care.

## Run

Needs Node 20 or later and a checkout of this repository (the server reads files two folders up).

```
cd lab/mcp
npm ci
npm test
npm start    # waits for an MCP client on stdin/stdout
```

## Add it to a client

Replace `/ABSOLUTE/PATH/TO` with the path to your checkout.

**Claude Desktop.** Open Settings, Developer, Edit Config (the file is `claude_desktop_config.json`), add this, and restart the app:

```json
{
  "mcpServers": {
    "murmur": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/murmur-voice-journal/lab/mcp/server.mjs"]
    }
  }
}
```

**Claude Code.** Either run

```
claude mcp add murmur -- node /ABSOLUTE/PATH/TO/murmur-voice-journal/lab/mcp/server.mjs
```

or put a `.mcp.json` with the same `mcpServers` block as above in the project you want to use it from.

## Tools

Every tool takes an optional `lang` (`zh-TW` or `en`, default `en`) and every result has a `scope_note` field.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `list_lenses` | `lang` | The 14 theory lenses: id, names, chapter, people, topics each is not offered for |
| `get_lens` | `id`, `lang` | One lens: idea, its questions with the reason for each, experiment, concepts, what it might miss |
| `lenses_for_topic` | `topic`, `lang` | Lenses the app offers for that kind of worry, often-used ones first; for `loss` only the five suited to grief |
| `get_help_lines` | `region` (`TW`, `US`, `other`), `lang` | The help lines the app shows for that region |
| `check_risk` | `text`, optional `region`, `lang` | `risk`, `kinds` (`self`, `others`, `abuse`), limits, and help lines whenever `risk` is true |
| `suggest_track` | `theme`, `lang`, optional `include_script` | The bedtime track the app suggests for that theme, the other tracks, and the script on request |
| `search_recommendations` | `query`, `filters` (`type`, `tone`, `max_minutes`, `include_heavy`, `lang`, `limit`) | Matching works with their content warnings; heavy content left out unless `include_heavy` is true |

Resources: `murmur://scope`, `murmur://lenses`, `murmur://lens/{id}/{lang}`, `murmur://help-lines/{region}/{lang}`, `murmur://tracks`, `murmur://recommendations` (heavy content left out).

### About check_risk

`check_risk` runs the same deterministic pattern check the app uses (`checkRisk` in `js/safety.js`). It is a screen, not an assessment. It misses indirect wording and sometimes matches ordinary text. A result of `risk: false` does not mean a person is safe, and the result says so. When `risk` is true the result always includes help lines: for the region you pass, or for all three regions if you pass none.

## Privacy

The app's promise is that what a person writes stays on their phone. This server does not connect to the app and cannot read anything from it. It has no storage, no network code and no logging.

`check_risk` is the one tool that takes free text. The text is checked in memory, is not written anywhere, and is not included in the result. Keep in mind that whatever MCP client calls the tool has already seen that text; the server adds no new place for it to go. Do not wire this tool to real journal entries from the app.

The tests enforce this: one test checks that the server's source imports only the SDK, zod, two read helpers and the app's modules, and contains no file writes, network calls, child processes, logging or environment reads. Another checks that a marker string passed to `check_risk` never appears in the result or on stderr.

## Design notes

- **One source of truth.** Lens text, help lines, the risk patterns and the track mapping are imported from `js/`. A change in the app shows up here without edits, and the tests compare tool output with the app modules directly.
- **Read-only by construction.** There are no tools that change anything. Every tool is annotated `readOnlyHint: true` and `openWorldHint: false`.
- **Scope note on everything.** Each structured result has `scope_note`, each tool description states the scope, and error results carry the note too. A model that sees only one tool result still sees the limit.
- **Structured output.** Each tool declares an output schema and returns `structuredContent` plus the same JSON as text. The tests validate every result against the declared schema.
- **Heavy content.** The app keeps its list of heavy content warnings as a private constant in `js/extras.js`. That file needs the app's DOM helpers and is not written to be imported in Node, so the server reads that one line from the source text. If the line cannot be found, the rule fails closed: any work with a content warning counts as heavy, and results report `heavy_rule: "fallback-any-content-warning"`. Exporting the list from a small module would be cleaner.
- **Bedtime suggestions.** `suggest_track` uses the app's theme mapping, which never points to the one track that invites images to surface. That track is listed with its caution so a person can still choose it on purpose.
- **Lens summaries.** `get_lens` returns the summary text as a template with `{1}`, `{2}`, `{3}` placeholders. Filling it in needs a person's answers, and that happens only on the device.
- **Plain Node ESM.** No build step, so the server can import the app's browser modules as they are.
