# Explain scenes

An explain scene draws the idea instead of writing it. A plane flies a route for travel. A year wheel rolls back for "1956". A spiral pulls inward for a cause. All are procedural blocks with baked motion, so frames stay deterministic.

Source: `src/explain.mjs`. Block type: `explain`.

## Kinds

| kind | Shows | Main params |
|---|---|---|
| `flight` | a plane flying a curved route between two labels | `from`, `to`, `at`, `dur` |
| `spiral` | dots spiralling inward to a centre label | `label`, `turns` |
| `zoom` | rings shrinking inward to a focal label | `label` |
| `map` | a grid map, route dots, a pin drop | `from`, `to` |
| `growth` | a rising curve with markers and a value | `value`, `label` |
| `compare` | two columns growing from a baseline | `left`, `right` |
| `process` | numbered nodes joined by arrows | `items` (2-3) |
| `orbit` | a centre body with orbiting dots | `label` |
| `timeline` | a drawn line with year nodes | `years` (2-6) |

A year found in the beat text uses `calendarFlip` instead. It rolls the wheel from `year + 20` back to `year`, with `step: 2`.

## Block shape

```json
{
  "type": "explain",
  "kind": "flight",
  "x": 64, "y": 700, "w": 950, "h": 600,
  "from": "DELHI", "to": "TOKYO",
  "at": 0.2, "dur": 1.9
}
```

`x`, `y`, `w`, `h` place the scene. Text blocks sit above it. Use one scene per beat.

## Planner fields

Each beat can carry `explain` and `eparams`:

```json
{ "explain": "spiral", "eparams": { "label": "WHY" } }
```

The planner is told to use at most two explain scenes per reel, and never on a policy beat.

## Auto-pick

If a beat has no `mechanic` and no asset, the director reads the beat text:

| Text | Scene |
|---|---|
| a year (1956, 2026) | `calendarFlip` |
| fly, travel, route, trip | `flight` |
| inside, depth, why, layer | `spiral` |
| zoom, detail, focus | `zoom` |
| map, where, city, place | `map` |
| grow, rise, more, double | `growth` |
| vs, compare, before, after | `compare` |
| step, process, how, first | `process` |
| orbit, system, cycle | `orbit` |
| timeline, history, era | `timeline` |

The director allows two auto scenes per film. An explicit `explain` field always renders.

## Limits

- Scenes are 2D shapes and text. No illustrations, no icons.
- The plane is three rounded rects, not a photo of a plane.
- The map is a grid, not geography.
- Keep labels short. The scene does not shrink text to fit.
- No audio cues. The `sound` plan field stays a note.
