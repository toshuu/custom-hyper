import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePlan, normalizeBeat } from './director.mjs';

const STYLE_GUIDE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts', 'script-style.md'), 'utf8');
const MOTION_GUIDE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts', 'motion-direction.md'), 'utf8');

const ANGLES = [
  'a field note from the future',
  'a manifesto with no slogans',
  'a lab report on a feeling',
  'a street poster torn in half',
  'a warning label',
  'a love letter to the subject',
  'a product autopsy',
  'a myth told in one breath',
  'a news brief from an alternate timeline',
  'a quiet argument',
];

const STRUCTURES = [
  'cold open -> evidence -> turn -> close',
  'question -> three proofs -> reversal -> invitation',
  'small detail -> wider system -> human stake -> close',
  'before -> rupture -> after -> instruction',
  'one number -> its history -> its limit -> a new number',
  'claim -> cost -> counterclaim -> synthesis',
];

const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const variationFor = (seed) => {
  const rng = mulberry32(seed >>> 0);
  return { angle: pick(rng, ANGLES), structure: pick(rng, STRUCTURES), seed };
};

const SYSTEM = `You are the planning department and the director of Custom Hyper, a short-form motion film engine.
Return one JSON object only. No markdown. No commentary.

Work in this order. Do it silently. Do not write these steps in the answer.

1. Name the audience. Who stops scrolling? One line.
2. Name the one big idea. The film proves it. It does not say it.
3. Name the tension. What does the viewer believe now that is wrong or incomplete?
4. Pick one proof. A number, object, place, or moment from the brief. Do not invent facts.
5. Pick one visual motif. A thing the frame can show: a bill, a roof grid, a queue, a cracked tile. Not a concept.
6. Give every beat one job: hook, proof, turn, or action. No two beats share a job.
7. Write the visual first. Then write copy that supports the visual.
8. Set the weight. Hook 1. Proof 1.2. Turn 1.3. Action 0.9. Range 0.5 to 2.
9. Pick the shot from: evidence, number, person, product, place, diagram, text, action, contrast, texture.
10. Pick the composition. It decides where the subject sits in the frame.
11. Pick the layout. It decides where the type sits. No two neighbors share a layout.
12. Plan the camera move. static, whip-pan, dolly-in, push-in, tracking, parallax, handheld, crane. Change it between neighbors.
13. Plan the reveal. maskUp, wipe, scale, slideLeft, slideRight, slideUp, blurIn, fade, rise, cut. The reveal must match the energy.
14. Plan the light and the texture. neon, studio, golden, overcast, hard, soft, night. clean, rain, grain, smoke, dust, halftone, scanlines.
15. Plan the handoff. transition is wipe, flash, dip, band, or cut.
16. List 2 to 4 drawable elements per frame. They are the objects the engine can build: scooter, wheel, wet asphalt, neon sign, tree line, café glass.
17. Name the focal point. One thing the eye lands on first.

TOPIC LOCK
- The brief names the subject. The film is about that subject only. Do not drift to a nearby theme, a general lesson, or a made-up example.
- Every beat must name the subject, one of its parts, or a fact from the brief.
- Reuse the brief's own nouns, names, places, numbers, and phrases. Do not invent facts, dates, or statistics.
- If the brief is one line, build the film from that line. Do not invent a backstory.
- The hook must contain the subject or a concrete image of it. Not a slogan about something else.

Frame rules:
- Every beat needs one visible subject. Name it in visual, then name one supporting element and the relation between them.
- composition is one of: single (one object, centered), split (subject right, type left), panorama (wide subject, sky or horizon), diagram (linked parts), grid (several equal things), stack (layered plates), type (words are the subject), object (product on a plain field), portrait (person or face).
- layout is one of: poster, stack, split, rail, grid, brutal, minimal, quote, contrast, cta.
- Match layout to content: number -> rail; several equal items -> grid; before/after -> contrast; quote -> quote; action -> cta. Do not use the same layout twice in a row.
- A frame must be buildable with text, photo, shapes, or procedural art.
- One strong subject per frame. Not a collage.
- A stat beat shows a real number from the brief or the product. If the brief gives no number, do not invent one: use a list or contrast beat instead.
- A quote beat makes the words the subject.
- A CTA shows the action, not a logo wall.
- Visual must be concrete and filmable. No camera directions. No "close-up of". No scene numbers.
- Visual must not repeat the headline. Add a new fact or image.
- If the brief gives no facts, use the client, product, or place it names. Never invent statistics.
- If an asset list is present, set asset to the exact id of the best match. If none matches, set asset to "". Never invent an id.

Art direction rules:
- One accent color. The background is a deep neutral or a warm paper, not a saturated primary.
- Never use pure #0000FF, #00FF00, #FF0000, or fluorescent neon. No default purple-blue tech gradient.
- ink must be near-white on a dark background, or near-black on a light one. Contrast first.
- palette: bg, ink, accent, accent2, paper. accent2 is a quiet support color, not a second loud accent.
- Pick a display face that fits the subject: Bebas Neue for impact, Rozha One for editorial, Space Grotesk for technical, Poppins for warm, Manrope for calm.
- art is print or cinema. Use print for history, records, data, news, culture, and brand films. Use cinema for product launches, energy, nightlife, and physical action. Print uses paper, black type, one red accent, rules, ghost numbers, charts, and duotone photos.

Copy rules:
- 5 to 8 beats. First beat is the hook. Last beat is the action.
- One idea per beat. Concrete nouns and verbs.
- Headline max 7 words. Body max 18 words. Items max 5 words.
- Keep on-screen text and voiceover separate.
- Never describe the video, its length, or its format. Describe the subject.
- Kinds: hook, statement, stat, list, quote, contrast, cta.
- Palette: real hex colors with strong contrast. bg, ink, accent, accent2, paper.
- Avoid default purple-blue tech gradients unless the subject demands it.
- typography: editorial, brutal, soft, technical, luxury, warm, or raw.
- energy: 0 to 1.
- ticker: 3 to 5 short words.
- Write for a viewer who stops scrolling.

${STYLE_GUIDE}

${MOTION_GUIDE}`;

const SHAPE = `{
  "title": "short title",
  "logline": "one sentence",
  "idea": "the one big idea this film proves",
  "audience": "who stops scrolling",
  "tension": "the belief this film breaks",
  "proof": "the number, object, place, or moment that proves it",
  "motif": "one visible thing that repeats across frames",
  "mood": "one or two words",
  "energy": 0.6,
  "typography": "editorial",
  "art": "print",
  "palette": { "bg": "#0B0D12", "ink": "#F2F3F7", "accent": "#FF4D2E", "accent2": "#4C7DFF", "paper": "#EFE6D5" },
  "beats": [
     {
       "kind": "hook",
       "job": "hook",
       "visual": "subject + one supporting element + relation, 3 to 7 concrete words",
       "shot": "evidence",
       "composition": "split",        "layout": "poster",
        "asset": "",
        "mechanic": "calendarFlip|counterRoll|beforeAfter|receipt|photoCam|cardStack|none",
        "mparams": {},
        "explain": "flight|spiral|zoom|map|growth|compare|process|orbit|timeline|none",
        "eparams": {},
        "support": "one short line, does not repeat the mechanic",
        "dur": 2.5,
        "continuity": "where the shared element sits",
        "weight": 1,
       "kicker": "label",
       "headline": "short headline",
       "body": "one short line",
       "vo": "spoken line",
       "items": [],
       "stat": "",
       "label": "",
       "source": ""
     }
  ],
  "cta": "short action",
  "ticker": ["word", "word", "word"]
}`;

export const buildPrompt = ({ brief, seconds, format, variation, language = 'en', assets = [] }) => `BRIEF:
${brief}

LENGTH: ${seconds} seconds
FORMAT: ${format}
LANGUAGE: ${language} (en = English, hi = Hindi, mr = Marathi). Write natively in this language, not translated. Keep the same script.
CREATIVE ANGLE: ${variation.angle}
STRUCTURE: ${variation.structure}
${assets.length ? `\nASSETS (use these ids only):\n${assets.slice(0, 40).map((a) => `- ${a.id}: ${a.name}${a.kind ? ` | ${a.kind}` : ''}${a.duration ? ` | ${a.duration}s` : ''}${a.desc ? ` | ${a.desc}` : ''}${a.tags?.length ? ` | tags: ${a.tags.join(', ')}` : ''}${a.segments?.length ? ` | moments: ${a.segments.map((s) => `${s.start}-${s.end}s ${s.desc}`).join('; ')}` : ''}`).join('\n')}\n` : ''}
Return one JSON object in this shape:
${SHAPE}

Rules for this film:
- Fill every field. Empty visual, shot, job, weight, composition, or layout is an error.
- The angle and structure are instructions, not decoration. Let them change the language and the order.
- Make the hook specific to the brief. Do not open with the title.
- At least one beat must carry a concrete number, name, place, or object from the brief.
- The last beat must ask for a specific action, not "learn more".
- Vary sentence length. Do not use the same rhythm in every beat.
- Stay on the brief's topic. If a line could belong to any other brand, cut it.
- Visual is the main deliverable. If the visual is weak, the frame is weak. Rewrite it before you answer.
- Each visual must name a subject the engine can draw: a panel, meter, bill, house, person, phone, chart, coin, sun, battery, leaf, clock, shield, arrow, wallet, calendar, key, drop, cloud, road, box, factory, or check. Use another concrete object only if none of these fits.
- Use the motif in at least three beats. Change the angle, scale, or crop. Do not repeat the same frame.
- When a video asset fits the beat, set asset to that id. The engine plays its sampled frames. Do not invent a video id. A segment's desc can become the beat's visual.
- Layout must change between neighbors. Use rail only with a real stat; grid only with three or more items; contrast only with two sides.
- Motion, reveal, lighting, texture, and transition must change between neighbors. Never run the same treatment twice in a row.
- elements must be concrete objects a person can point at. Not moods, not concepts.
- The sound line is a plan note only. It is not rendered yet. Keep it short and physical.
- If the beat can be shown as motion, set mechanic and fill mparams from the brief. Use photoCam only when a real asset exists. Use none for a pure text beat. Never invent numbers, years, or names for a mechanic. Keep dur between 0.6 and 3.8 seconds.
- To explain the idea with a drawn scene, set explain and fill eparams. flight = travel or route; spiral = going deeper into a cause; zoom = detail; map = place; growth = a rising number; compare = two sides; process = steps; orbit = a system; timeline = years. Add explain to at most two beats. A policy beat is not a diagram.`;

const SHOT_SET = new Set(['evidence', 'number', 'person', 'product', 'place', 'diagram', 'text', 'action', 'contrast', 'texture']);
const COMP_SET = new Set(['single', 'split', 'panorama', 'diagram', 'grid', 'stack', 'type', 'object', 'portrait']);
const LAYOUT_SET = new Set(['poster', 'stack', 'split', 'rail', 'grid', 'brutal', 'minimal', 'quote', 'contrast', 'cta']);
const BANNED = /\b(unlock|elevate|seamless|game-changer|revolutionize|empower|unleash|leverage|journey|dive into)\b/i;
const wordsOf = (v) => String(v ?? '').trim().split(/\s+/).filter(Boolean);

const factFromBrief = (brief = '') => {
  const text = String(brief).replace(/\b\d+\s*(?:second|seconds|sec|s)\b/gi, ' ');
  const m = text.match(/\b\d[\d,.]*\s*(?:%|percent|km|kgs?|kwh|kw|w|months?|years?|days?|hours?|hrs?|mins?|minutes?|x|times?|rupees?|rs\.?|inr|lakh|crore)?/i);
  if (!m) return null;
  return { value: m[0].trim(), label: 'KEY NUMBER' };
};

export const repairPlan = (plan, brief = '') => {
  const fact = factFromBrief(brief);
  const layouts = ['poster', 'stack', 'split', 'minimal', 'brutal', 'quote', 'contrast'];
  plan.beats.forEach((b, i) => {
    if (!Array.isArray(b.items)) b.items = [];
    if (wordsOf(b.visual).length < 2) {
      b.visual = cleanWords(`${b.headline || plan.motif || 'the subject'} in frame`, 10);
    }
    if (b.layout === 'grid' && b.items.length < 2) {
      const parts = `${b.headline ?? ''} ${b.body ?? ''}`.split(/[,/|]+|\s{2,}/).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 1);
      b.items = parts.slice(0, 3);
      if (b.items.length < 2) b.layout = 'stack';
    }
    if (b.layout === 'rail' && !b.stat) {
      if (fact) { b.stat = fact.value; b.label = fact.label; }
      else b.layout = 'split';
    }
    if (i > 0 && b.layout === plan.beats[i - 1].layout) {
      b.layout = layouts.find((x) => x !== b.layout) ?? b.layout;
    }
    if (b.layout === 'rail' && !b.stat) b.layout = 'split';
    if (b.layout === 'grid' && b.items.length < 2) b.layout = 'stack';
  });
  const copy = plan.beats.map((b) => `${b.headline} ${b.body} ${b.vo} ${b.stat}`).join(' ');
  const briefFacts = String(brief).replace(/\b\d+\s*(?:second|seconds|sec|s)\b/gi, ' ');
  if (/\d/.test(briefFacts) && !plan.beats.some((b) => b.stat) && !/\d/.test(copy)) {
    const mid = Math.max(1, Math.floor(plan.beats.length / 2));
    const target = plan.beats[Math.min(mid, plan.beats.length - 2)] ?? plan.beats[0];
    target.stat = fact?.value ?? String(briefFacts).match(/\d[\d,.]*/)?.[0] ?? '';
    target.label = fact?.label ?? 'KEY NUMBER';
    target.layout = 'rail';
    target.kind = 'stat';
    if (!target.body) target.body = `${target.headline} in one number.`;
  }
  return plan;
};

const cleanWords = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().split(' ').slice(0, n).join(' ');

export const validatePlanQuality = (plan, assets = [], brief = '') => {
  const assetIds = new Set(assets.map((a) => a.id));
  const errors = [];
  if (!plan.idea) errors.push('missing idea');
  if (!plan.audience) errors.push('missing audience');
  if (!plan.tension) errors.push('missing tension');
  if (!plan.proof) errors.push('missing proof');
  if (!plan.motif) errors.push('missing motif');
  plan.beats.forEach((b, i) => {
    if (wordsOf(b.visual).length < 2) errors.push(`beat ${i + 1} has no concrete visual`);
    if (!SHOT_SET.has(b.shot)) errors.push(`beat ${i + 1} has invalid shot`);
    if (!COMP_SET.has(b.composition)) errors.push(`beat ${i + 1} has invalid composition`);
    if (!LAYOUT_SET.has(b.layout)) errors.push(`beat ${i + 1} has invalid layout`);
    if (!(b.weight >= 0.5 && b.weight <= 2)) errors.push(`beat ${i + 1} has invalid weight`);
    if (i > 0 && b.layout === plan.beats[i - 1].layout) errors.push(`beats ${i} and ${i + 1} repeat layout ${b.layout}`);
    if (b.layout === 'rail' && !b.stat) errors.push(`beat ${i + 1} uses rail with no stat`);
    if (b.layout === 'grid' && b.items.length < 2) errors.push(`beat ${i + 1} uses grid with fewer than 2 items`);
    if (b.mechanic && !['calendarFlip', 'counterRoll', 'beforeAfter', 'receipt', 'photoCam', 'cardStack', 'track', 'none'].includes(b.mechanic)) errors.push(`beat ${i + 1} has invalid mechanic`);
    if (b.explain && !['flight', 'spiral', 'zoom', 'map', 'growth', 'compare', 'process', 'orbit', 'timeline', 'none'].includes(b.explain)) errors.push(`beat ${i + 1} has invalid explain`);
    if (b.asset && assetIds.size && !assetIds.has(b.asset)) errors.push(`beat ${i + 1} names unknown asset`);
    if (i === 0 && wordsOf(b.headline).length > 7) errors.push('hook headline is longer than 7 words');
    if (BANNED.test(`${b.headline} ${b.body} ${b.vo}`)) errors.push(`beat ${i + 1} uses a banned word`);
  });
  const copy = plan.beats.map((b) => `${b.headline} ${b.body} ${b.vo} ${b.stat}`).join(' ');
  const briefFacts = String(brief).replace(/\b\d+\s*(?:second|seconds|sec|s)\b/gi, ' ');
  if (/\d/.test(briefFacts) && !plan.beats.some((b) => b.stat) && !/\d/.test(copy)) {
    errors.push('brief has a number, but the film has no number or stat');
  }
  return errors;
};

const STRING = { type: 'STRING' };
const BEAT = {
  type: 'OBJECT',
  properties: {
    kind: STRING, job: STRING, visual: STRING, shot: STRING, weight: { type: 'NUMBER' },
    composition: STRING, layout: STRING, asset: STRING,
    mechanic: STRING, mparams: STRING, explain: STRING, eparams: STRING, support: STRING, dur: { type: 'NUMBER' }, continuity: STRING,
    motion: STRING, reveal: STRING, lighting: STRING, texture: STRING, transition: STRING,
    focal: STRING, sound: STRING,
    elements: { type: 'ARRAY', items: STRING },
    kicker: STRING, headline: STRING, body: STRING, vo: STRING,
    items: { type: 'ARRAY', items: STRING },
    stat: STRING, label: STRING, source: STRING,
  },
  required: ['kind', 'headline', 'visual', 'shot', 'job', 'weight', 'composition', 'layout'],
};
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: STRING, logline: STRING, idea: STRING, audience: STRING, tension: STRING,
    proof: STRING, motif: STRING, mood: STRING,
    energy: { type: 'NUMBER' },
    typography: STRING, art: STRING,
    palette: {
      type: 'OBJECT',
      properties: { bg: STRING, ink: STRING, accent: STRING, accent2: STRING, paper: STRING },
      required: ['bg', 'ink', 'accent', 'accent2'],
    },
    beats: { type: 'ARRAY', items: BEAT },
    cta: STRING,
    ticker: { type: 'ARRAY', items: STRING },
  },
  required: ['title', 'idea', 'audience', 'tension', 'proof', 'motif', 'mood', 'beats', 'cta'],
};

const BEAT_SCHEMA = {
  type: 'OBJECT',
  properties: BEAT.properties,
  required: BEAT.required,
};

const extractError = (text) => {
  try {
    const j = JSON.parse(text);
    return String(j.error?.message ?? j.message ?? text).slice(0, 300);
  } catch {
    return String(text).slice(0, 300);
  }
};

const stripFence = (text) => String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

const parseJson = (text) => {
  let body = stripFence(text).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const attempt = (raw) => JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
  try { return attempt(body); } catch {
    const a = body.indexOf('{');
    const b = body.lastIndexOf('}');
    if (a >= 0 && b > a) return attempt(body.slice(a, b + 1));
    throw new Error('response is not JSON');
  }
};

const callGemini = async ({ apiKey, model, prompt, temperature, schema = GEMINI_SCHEMA }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature, topP: 0.95, maxOutputTokens: 4000,
        responseMimeType: 'application/json', responseSchema: schema,
      },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${extractError(text)}`);
  const data = JSON.parse(text);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const out = parts.map((p) => p.text ?? '').join('');
  if (!out) throw new Error(`Gemini returned no text (${data.promptFeedback?.blockReason ?? 'empty'})`);
  return {
    text: out,
    usage: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 },
  };
};

const callOpenAI = async ({ apiKey, model, prompt, temperature, baseUrl }) => {
  const root = String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${extractError(text)}`);
  const data = JSON.parse(text);
  const out = data.choices?.[0]?.message?.content ?? '';
  if (!out) throw new Error('LLM returned no text');
  return {
    text: out,
    usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
  };
};

const defaults = {
  gemini: { model: 'gemini-2.0-flash', temperature: 0.62 },
  openai: { model: 'gpt-4o-mini', temperature: 0.62 },
  compatible: { model: 'gpt-4o-mini', temperature: 0.62 },
};

export const generatePlan = async ({ brief, seconds, format, language = 'en', provider = 'gemini', apiKey, model, baseUrl, seed, assets = [], repair = true }) => {
  const p = String(provider || 'gemini').toLowerCase();
  if (!defaults[p]) throw new Error(`unknown provider "${provider}"`);
  if (!apiKey) throw new Error('API key required');
  const variation = variationFor(seed ?? (Math.floor(Math.random() * 0x7fffffff) + 1));
  const prompt = buildPrompt({ brief, seconds, format, variation, language, assets });
  const chosenModel = model || defaults[p].model;
  const temperature = defaults[p].temperature;
  const call = (userPrompt) => (p === 'gemini'
    ? callGemini({ apiKey, model: chosenModel, prompt: userPrompt, temperature })
    : callOpenAI({ apiKey, model: chosenModel, prompt: userPrompt, temperature, baseUrl }));

  let first;
  let usage = { input: 0, output: 0 };
  const t0 = Date.now();
  console.error(`[llm] ${p}/${chosenModel} start chars=${prompt.length} assets=${assets.length}`);
  try {
    first = await call(prompt);
    console.error(`[llm] ${p}/${chosenModel} ok ${Date.now() - t0}ms in=${first.usage.input} out=${first.usage.output}`);
    usage = { input: usage.input + first.usage.input, output: usage.output + first.usage.output };
    const raw = parseJson(first.text);
    const plan = repairPlan(normalizePlan(raw, brief), brief);
    const quality = validatePlanQuality(plan, assets, brief);
    if (quality.length) throw new Error(quality.join('; '));
    return { plan, usage, provider: p, model: chosenModel, variation };
  } catch (err) {
    console.error(`[llm] ${p}/${chosenModel} fail ${Date.now() - t0}ms: ${err?.message ?? err}`);
    if (!repair) throw err;
    const previous = String(first?.text ?? '').slice(0, 1800);
    console.error(`[llm] ${p}/${chosenModel} repair call`);
    const fix = `${prompt}\n\nYour previous answer failed: ${err.message}\nPrevious answer:\n${previous}\n\nReturn only one valid JSON object. No markdown.`;
    const second = await call(fix);
    usage = { input: usage.input + second.usage.input, output: usage.output + second.usage.output };
    try {
      const plan = repairPlan(normalizePlan(parseJson(second.text), brief), brief);
      const quality = validatePlanQuality(plan, assets, brief);
      if (quality.length) throw new Error(quality.join('; '));
      return { plan, usage, provider: p, model: chosenModel, variation, repaired: true };
    } catch (err2) {
      throw new Error(`LLM returned an invalid plan after one repair: ${err2.message}`);
    }
  }
};

const BOARD_SHAPE = `{
  "kind": "hook|statement|stat|list|quote|contrast|cta",
  "job": "hook|proof|turn|action",
  "visual": "3 to 7 concrete words: what the frame shows",
  "shot": "evidence|number|person|product|place|diagram|text|action|contrast|texture",
  "composition": "single|split|panorama|diagram|grid|stack|type|object|portrait",
  "layout": "poster|stack|split|rail|grid|brutal|minimal|quote|contrast|cta",
  "mechanic": "calendarFlip|counterRoll|beforeAfter|receipt|photoCam|cardStack|none",
  "mparams": {},
  "explain": "flight|spiral|zoom|map|growth|compare|process|orbit|timeline|none",
  "eparams": {},
  "support": "one short line",
  "dur": 2.5,
  "continuity": "where the shared element sits",
  "motion": "static|whip-pan|dolly-in|push-in|tracking|parallax|handheld|crane",
  "reveal": "maskUp|wipe|scale|slideLeft|slideRight|slideUp|blurIn|fade|rise|cut",
  "lighting": "natural|neon|studio|golden|overcast|hard|soft|night",
  "texture": "clean|rain|grain|smoke|dust|halftone|scanlines",
  "transition": "wipe|flash|dip|band|cut",
  "elements": ["drawable object", "drawable object"],
  "focal": "one thing the eye lands on",
  "sound": "one physical sound",
  "weight": 1,
  "kicker": "label",
  "headline": "short headline, max 7 words",
  "body": "one short line, max 18 words",
  "vo": "spoken line, natural speech",
  "items": ["max 5 words", "max 5 words"],
  "stat": "number",
  "label": "short label",
  "source": ""
}`;

export const generateBoard = async ({
  brief, language = 'en', seconds, board, prev, next,
  provider = 'gemini', apiKey, model, baseUrl, seed = 7,
}) => {
  const p = String(provider || 'gemini').toLowerCase();
  if (!defaults[p]) throw new Error(`unknown provider "${provider}"`);
  if (!apiKey) throw new Error('API key required');
  const variation = variationFor(seed);
  const prompt = `BRIEF: ${brief}
LANGUAGE: ${language}
LENGTH: ${seconds} seconds
CREATIVE ANGLE: ${variation.angle}
STRUCTURE: ${variation.structure}
BOARD TO REWRITE: ${JSON.stringify(board)}
PREVIOUS BOARD: ${JSON.stringify(prev)}
NEXT BOARD: ${JSON.stringify(next)}

Rewrite only this one board. Keep it connected to the neighbors. Return one JSON beat object in this shape:
${BOARD_SHAPE}

Rules:
- Headline max 7 words. Body max 18 words. Items max 5 words.
- On-screen text is not voiceover. Keep them separate.
- One idea. Concrete nouns and verbs.
- Visual is required. It must show a thing the frame can draw, not a concept.
- Pick the shot that shows the visual best.
- Plan motion, reveal, lighting, texture, transition, elements, focal, and sound. Fill every field.
- Set weight by the job. Hook 1. Proof 1.2. Turn 1.3. Action 0.9.
- No "introducing", "welcome", "unlock", "elevate", "seamless".`;
  const chosenModel = model || defaults[p].model;
  const temperature = defaults[p].temperature;
  const call = (userPrompt) => (p === 'gemini'
    ? callGemini({ apiKey, model: chosenModel, prompt: userPrompt, temperature, schema: BEAT_SCHEMA })
    : callOpenAI({ apiKey, model: chosenModel, prompt: userPrompt, temperature, baseUrl }));
  const check = (beat) => {
    const errors = [];
    if (wordsOf(beat.visual).length < 2) errors.push('visual is empty or abstract');
    if (beat.layout === 'grid' && beat.items.length < 2) errors.push('grid needs at least 2 items');
    if (beat.layout === 'rail' && !beat.stat) errors.push('rail needs a real stat');
    return errors;
  };
  let first = await call(prompt);
  let usage = { ...first.usage };
  let raw;
  try { raw = parseJson(first.text); }
  catch (err) {
    const fixJson = `${prompt}\n\nYour previous answer was not valid JSON (${err.message}). Return only one JSON beat object. No markdown. No trailing commas.`;
    const retry = await call(fixJson);
    usage = { input: usage.input + retry.usage.input, output: usage.output + retry.usage.output };
    first = retry;
    try { raw = parseJson(retry.text); }
    catch (err2) { throw new Error(`${err2.message} after one JSON retry. Snippet: ${stripFence(retry.text).slice(0, 200)}`); }
  }
  let beat = normalizeBeat(raw, 0, 1, brief);
  let errors = check(beat);
  if (errors.length) {
    const fix = `${prompt}\n\nYour previous answer failed: ${errors.join('; ')}.\nPrevious answer:\n${JSON.stringify(raw).slice(0, 1200)}\n\nReturn only one valid JSON beat object.`;
    const second = await call(fix);
    usage = { input: usage.input + second.usage.input, output: usage.output + second.usage.output };
    raw = parseJson(second.text);
    beat = normalizeBeat(raw, 0, 1, brief);
    errors = check(beat);
  }
  if (errors.length && wordsOf(beat.visual).length < 2) {
    beat.visual = cleanWords(`${beat.headline || board?.visual || 'the subject'} in frame`, 10);
    errors = check(beat);
  }
  if (errors.length) throw new Error(`board rewrite failed: ${errors.join('; ')}. Try a clearer board idea or use PLAN ALL.`);
  return {
    beat,
    usage,
    provider: p,
    model: chosenModel,
    variation,
  };
};

export { SYSTEM as SYSTEM_PROMPT, SHAPE as PLAN_SHAPE, GEMINI_SCHEMA };
