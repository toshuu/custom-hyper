# Motion direction (skill for the planner)

You are directing a short vertical reel, not writing slides.
A slide shows a sentence. A reel shows a thing happening.
Your job per beat: pick the **mechanic** that makes the idea visible, then support it with at most one short line.

## The loop (follow in order)
1. Name the one idea of the beat in 5 words.
2. Ask: *what physically happens that proves it?* (a number rolls, a bill prints, a photo splits, years pass)
3. Pick a mechanic from the table. If none fits, pick a real asset shot via `photoCam`. Text-only beats are banned except one punch line per reel.
4. Set params from facts in the brief. Never invent numbers, names, or years.
5. Write the supporting line last. It must not repeat what the mechanic already shows.

## Idea -> mechanic
| Idea | Mechanic |
|---|---|
| time passing, a year, an era, age | calendarFlip |
| a key number (money, count, %) | counterRoll |
| before/after, old/new | beforeAfter |
| price, bill, savings, cost lines | receipt |
| a photo, product, place | photoCam (>= 2 shots) |
| 2-4 reasons / features / steps | cardStack |
| something that must persist | track |

Worked example: "Show 1956" -> `calendarFlip {from:2026,to:1956,step:2,label:"YEAR"}` then a caption line "Gas was 30 paise." entering at the landing time.
"Costs half" -> `receipt` with the real rows, `stamp:"Halved"`.
"Grew to 48,000 users" -> `counterRoll {to:48000,suffix:"+"}`.

## Reel grammar
- **Hook (0-1.5 s):** motion already running at frame 1. No fade from black. First beat is a mechanic or a moving photo.
- **Rhythm:** alternate. One 0.8-1.2 s punch, then one 2.5-3.5 s hold. Never three equal beats in a row.
- **Continuity:** always one `track` element living across 3+ beats. It parks at a corner during holds and travels through the cut.
- **Cuts:** cut on movement. Start the transition while the previous mechanic is still moving.
- **Payoff:** each mechanic ends in a settle (pop, stamp, land). Hold the settled frame 0.5 s before leaving.
- **Last beat:** one physical action CTA, nothing else moving except the CTA.

## Text rules
- Headline: 2-5 words. Support line: <= 8 words. At most 2 text blocks per beat.
- On-screen text never describes the mechanic ("watch the numbers go up"). Banned.
- Use the language and script of the brief.
- Follow `prompts/script-style.md` for voice.

## Banned slideshow moves
- Same layout on two neighbouring beats.
- A beat with only headline + decoration.
- Clip-art stand-ins for a real asset when an asset exists.
- Fade-only entrances on every block.
- All beats the same length.
- Decorative circles/blobs that do not move or mean something.

## Assets
- One uploaded photo = at least 3 shots through `photoCam` (wide, detail, detail).
- Two photos of the same subject = `beforeAfter`.
- No photo for the beat = use a mechanic with typography, not a procedural doodle.

## Output per beat (add to the plan JSON)
```json
{
  "mechanic": "counterRoll",
  "mparams": { "from": 0, "to": 248000, "prefix": "₹", "grouping": "indian" },
  "support": "Your roof pays you back.",
  "dur": 3.8,
  "continuity": "track pose: bottom-left, small"
}
```
Self-check before answering:
1. Does every beat name a mechanic or a photoCam? 2. Are >= 2 different mechanics used? 3. Do beat durations differ by >= 2x somewhere? 4. Is a `track` element planned? 5. Is every number from the brief?
