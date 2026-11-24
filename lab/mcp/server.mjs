#!/usr/bin/env node
// Murmur MCP server: Murmur's vetted psychoeducation content as read-only tools and resources,
// over stdio. It has no storage, no network code and no logging. Text passed to check_risk is
// checked in memory and is never written anywhere or echoed back.

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import * as c from './src/content.mjs';

const lang = z.enum(c.LANGS).default('en').describe('Language of the content: zh-TW or en.');
const scope_note = z.string().describe('Scope of this content: psychoeducation, not therapy.');
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const lensSummary = z.object({
  id: z.string(),
  name: z.string(),
  name_zh: z.string(),
  name_en: z.string(),
  chapter: z.number(),
  people: z.string(),
  exclude_topics: z.array(z.string()),
});
const helpLine = z.object({ label: z.string(), number: z.string().optional(), tel: z.string().optional(), url: z.string().optional() });
const trackSummary = z.object({ id: z.string(), name: z.string(), style: z.string(), lens: z.string(), caution: z.string().optional() });

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });
const fail = (message, l) => ({ isError: true, content: [{ type: 'text', text: `${message}\n\n${c.scopeNote(l)}` }] });

const server = new McpServer(
  { name: 'murmur', version: '0.1.0' },
  {
    instructions:
      'Read-only access to the psychoeducation content of Murmur, a private voice journal: counseling-theory lenses, bedtime tracks, curated recommendations, help lines, and the app\'s keyword risk screen. All of it is psychoeducation, not therapy or diagnosis. check_risk is a coarse screen, not an assessment. If it matches, show the help lines it returns.',
  }
);

server.registerTool(
  'list_lenses',
  {
    title: 'List theory lenses',
    description: 'List Murmur\'s counseling-theory lenses (id, name in both languages, textbook chapter, people, topics each lens is not offered for). Psychoeducation, not therapy.',
    inputSchema: { lang },
    outputSchema: { count: z.number(), topics: z.array(z.string()), lenses: z.array(lensSummary), scope_note },
    annotations: READ_ONLY,
  },
  async ({ lang }) => ok(c.listLenses(lang))
);

server.registerTool(
  'get_lens',
  {
    title: 'Get one theory lens',
    description: 'Get one lens in one language: the core idea, its three or four self-guided questions with the reason for each, a small experiment, key concepts, and what the lens might miss. Psychoeducation, not therapy.',
    inputSchema: { id: z.enum(c.LENS_IDS).describe('Lens id'), lang },
    outputSchema: {
      ...lensSummary.shape,
      lang: z.string(),
      idea: z.string(),
      steps: z.array(z.object({ number: z.number(), question: z.string(), why: z.string(), kind: z.enum(['text', 'scale_0_to_10']), shows_previous_answer_rewritten: z.boolean().optional(), question_if_zero: z.string().optional() })),
      summary_template: z.string(),
      summary_template_note: z.string(),
      experiment: z.string(),
      concepts: z.array(z.string()),
      misses: z.string(),
      scope_note,
    },
    annotations: READ_ONLY,
  },
  async ({ id, lang }) => {
    const lens = c.getLens(id, lang);
    return lens ? ok(lens) : fail(`Unknown lens id "${id}". Known ids: ${c.LENS_IDS.join(', ')}.`, lang);
  }
);

server.registerTool(
  'lenses_for_topic',
  {
    title: 'Lenses for a kind of worry',
    description: 'Lenses the app offers for a kind of worry, with those often used for it first. For loss, only the lenses suited to grief are returned. Psychoeducation, not therapy.',
    inputSchema: { topic: z.enum(c.TOPICS).describe('Kind of worry.'), lang },
    outputSchema: {
      topic: z.string(),
      count: z.number(),
      lenses: z.array(lensSummary.extend({ often_used_for_topic: z.boolean() })),
      excluded: z.array(z.string()),
      ordering_note: z.string(),
      scope_note,
    },
    annotations: READ_ONLY,
  },
  async ({ topic, lang }) => ok(c.lensesFor(topic, lang))
);

server.registerTool(
  'get_help_lines',
  {
    title: 'Help lines by region',
    description: 'Crisis and help lines the app shows for a region (TW, US, or other), from the app\'s own list. Psychoeducation, not therapy or crisis care.',
    inputSchema: { region: z.enum(c.REGIONS).describe('TW (Taiwan), US, or other.'), lang },
    outputSchema: { region: z.string(), lang: z.string(), lines: z.array(helpLine), note: z.string(), scope_note },
    annotations: READ_ONLY,
  },
  async ({ region, lang }) => ok(c.getHelpLines(region, lang))
);

server.registerTool(
  'check_risk',
  {
    title: 'Risk-language screen',
    description:
      'Run the app\'s deterministic keyword check for signs of suicide or self-harm (self), harm to others (others), or abuse (abuse) in zh-TW or English text. This is a screen, not an assessment: it misses indirect wording and sometimes matches ordinary text, and a result of no risk does not mean the person is safe. When it matches, the result always includes help lines to show. The text is checked in memory only; it is not stored, logged or returned.',
    inputSchema: {
      text: z.string().max(20000).describe('Text to screen. Not stored, logged or echoed back.'),
      region: z.enum(c.REGIONS).optional().describe('Region for the help lines. If omitted, lines for every region are returned on a match.'),
      lang,
    },
    outputSchema: {
      risk: z.boolean(),
      kinds: z.array(z.enum(['self', 'others', 'abuse'])),
      is_assessment: z.literal(false),
      limits: z.string(),
      guidance: z.string(),
      help_lines: z.array(z.object({ region: z.string(), lines: z.array(helpLine) })).optional(),
      scope_note,
    },
    annotations: READ_ONLY,
  },
  async ({ text, region, lang }) => ok(c.riskScreen(text, region, lang))
);

server.registerTool(
  'suggest_track',
  {
    title: 'Suggest a bedtime track',
    description: 'The bedtime wind-down track the app suggests for a kind of worry, with the other tracks listed. Set include_script to get the full script (sentences with pauses). Psychoeducation, not therapy.',
    inputSchema: { theme: z.enum(c.THEMES).describe('What the person set down tonight.'), lang, include_script: z.boolean().default(false).describe('Include the full script text.') },
    outputSchema: {
      theme: z.string(),
      lang: z.string(),
      track: trackSummary.extend({ approx_minutes: z.number() }),
      script: z.array(z.object({ text: z.string(), pause_seconds: z.number() })).optional(),
      other_tracks: z.array(trackSummary),
      note: z.string(),
      scope_note,
    },
    annotations: READ_ONLY,
  },
  async ({ theme, lang, include_script }) => ok(c.suggestTrack(theme, lang, include_script))
);

const recFilters = z
  .object({
    type: z.enum(c.REC_TYPES).optional().describe('Kind of work.'),
    tone: z.enum(c.REC_TONES).optional().describe('Tone tag.'),
    max_minutes: z.number().int().positive().optional().describe('Longest running time, for works that list one.'),
    include_heavy: z.boolean().default(false).describe('Include works with heavy content warnings (for example suicide, self-harm, abuse, violence). Off unless the person asks.'),
    lang,
    limit: z.number().int().min(1).max(50).default(10),
  })
  .default({});

server.registerTool(
  'search_recommendations',
  {
    title: 'Search curated recommendations',
    description: 'Search Murmur\'s curated list of gentle films, books, series and music by words in the title, creator, tone or reason. Works with heavy content warnings are left out unless filters.include_heavy is true; every result lists its content warnings. Nothing here is treatment.',
    inputSchema: { query: z.string().max(200).default('').describe('Words to match. Empty returns the whole list, filtered.'), filters: recFilters },
    outputSchema: {
      query: z.string(),
      total: z.number(),
      heavy_included: z.boolean(),
      heavy_hidden: z.number(),
      heavy_rule: z.string(),
      heavy_tags: z.array(z.string()),
      items: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          original_title: z.string().optional(),
          creator: z.string(),
          year: z.number().optional(),
          minutes: z.number().optional(),
          tones: z.array(z.string()),
          content_warnings: z.array(z.string()),
          heavy: z.boolean(),
          why: z.string(),
          lens: z.string().optional(),
        })
      ),
      list_note: z.string(),
      scope_note,
    },
    annotations: READ_ONLY,
  },
  async ({ query, filters }) => ok(c.searchRecommendations(query, filters))
);

// ---------- resources ----------

const json = (uri, data) => ({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] });
const pickLang = (v) => (v === 'en' ? 'en' : 'zh-TW');

server.registerResource('scope', 'murmur://scope', { title: 'Scope note', description: 'What this content is and is not.', mimeType: 'text/plain' }, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: 'text/plain', text: `${c.scopeNote('en')}\n${c.scopeNote('zh-TW')}` }],
}));

server.registerResource('lenses', 'murmur://lenses', { title: 'Theory lenses (index)', description: 'All lenses with names in both languages.', mimeType: 'application/json' }, async (uri) => json(uri.href, c.listLenses('en')));

server.registerResource(
  'lens',
  new ResourceTemplate('murmur://lens/{id}/{lang}', {
    list: async () => ({ resources: c.LENS_IDS.flatMap((id) => c.LANGS.map((l) => ({ uri: `murmur://lens/${id}/${l}`, name: `lens-${id}-${l}`, mimeType: 'application/json' }))) }),
    complete: { id: (v) => c.LENS_IDS.filter((x) => x.startsWith(v)), lang: (v) => c.LANGS.filter((x) => x.startsWith(v)) },
  }),
  { title: 'One theory lens', description: 'Full content of one lens in one language.', mimeType: 'application/json' },
  async (uri, { id, lang }) => {
    const lens = c.getLens(String(id), pickLang(String(lang)));
    if (!lens) throw new Error(`Unknown lens id "${id}"`);
    return json(uri.href, lens);
  }
);

server.registerResource(
  'help-lines',
  new ResourceTemplate('murmur://help-lines/{region}/{lang}', {
    list: async () => ({ resources: c.REGIONS.flatMap((r) => c.LANGS.map((l) => ({ uri: `murmur://help-lines/${r}/${l}`, name: `help-lines-${r}-${l}`, mimeType: 'application/json' }))) }),
    complete: { region: (v) => c.REGIONS.filter((x) => x.startsWith(v)), lang: (v) => c.LANGS.filter((x) => x.startsWith(v)) },
  }),
  { title: 'Help lines', description: 'Help lines for one region.', mimeType: 'application/json' },
  async (uri, { region, lang }) => {
    if (!c.REGIONS.includes(String(region))) throw new Error(`Unknown region "${region}"`);
    return json(uri.href, c.getHelpLines(String(region), pickLang(String(lang))));
  }
);

server.registerResource('tracks', 'murmur://tracks', { title: 'Bedtime tracks (index)', description: 'The bedtime tracks and the track suggested for each theme.', mimeType: 'application/json' }, async (uri) => json(uri.href, c.listTracks('en')));

server.registerResource(
  'recommendations',
  'murmur://recommendations',
  { title: 'Curated recommendations (heavy content left out)', description: 'The curated list without works that carry heavy content warnings. Use search_recommendations with include_heavy to see those.', mimeType: 'application/json' },
  async (uri) => json(uri.href, c.searchRecommendations('', { lang: 'en', limit: 50 }))
);

await server.connect(new StdioServerTransport());
