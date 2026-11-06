# Video assets

Clips are normal assets. The engine never decodes a video at render time. On upload it samples frames and builds a contact sheet. The renderer plays the sampled frames as images, so output stays deterministic.

## Pipeline

```
upload mp4/mov/webm
  -> ffprobe: duration, width, height, fps
  -> ffmpeg: N frames at even times (N = duration x 5, min 6, max 24)
  -> ffmpeg: one contact sheet PNG (4 columns)
  -> vision LLM: desc + tags + 2-5 time segments
  -> data/assets.index.json + data/assets.md
  -> planner picks a clip id
  -> director emits a `video` block
  -> Skia draws the sampled frames
```

## Where files live

```
data/assets/<clip>.mp4           original upload
data/video/<base>/f00.jpg        sampled frames
data/video/<base>/sheet.png      contact sheet
data/video/<base>/meta.json      duration, size, fps, times, hash
data/assets.index.json           meaning, tags, segments
data/assets.md                   human-readable copy
```

`<base>` is the file name without its extension. Re-upload replaces that folder.

## Index

`INDEX ASSETS (VISION)` sends every unindexed image and every video contact sheet in one call.

- Images: one entry each.
- Videos: one entry each, with `duration`, `frames`, `sampleFps`, and `segments`.
- A segment is `{start, end, desc, tags}` in seconds. 2 to 5 per clip, in order.
- A file is indexed when its hash matches and a video has at least one segment.
- A deleted file is flagged `missing` in `assets.md`.

Vision cost: one image per video, not one per frame. 12 assets per call, by default.

## Render block

```json
{
  "type": "video",
  "frames": ["v0f0", "v0f1"],
  "fps": 5,
  "x": 0, "y": 0, "w": 1080, "h": 1920,
  "fit": "cover", "radius": 0,
  "tint": { "color": "bg", "opacity": 0.24, "blend": "multiply" },
  "vignette": 0.35
}
```

- `frames` are asset ids, in time order.
- `fps` is the sampled rate, not the source rate. 5-6 is enough for a reel.
- Each frame is visible for `1 / fps`. Opacity is baked per frame.
- Missing frames throw. There is no silent fallback.
- `tint` and `vignette` sit above the frames, below text.

## Planner

The plan lists each clip as `id | video | duration | desc | tags | moments`. The director picks a clip when:

1. the beat names its id, or
2. the beat visual matches the clip desc, tags, or segment text.

A clip used on a full-bleed beat gets a dark scrim so text stays readable.

## Limits

- No audio track is used. Sound stays a plan note.
- A 24 frame clip is 24 image nodes. 3 clips per reel is safe; 10 is heavy.
- Frame extraction is fixed. A clip always samples the same times, so frames stay deterministic.
- Contact sheet text labels are not drawn. The prompt gives times instead.
- Video is sampled, not played at source fps. Fast action needs a higher `sampleFps`.
- A clip shorter than 0.5 s still gets 6 frames.

## Large files (413 fix)

A tunnel can reject a single large request. The UI uploads files over 40 MB in 8 MB chunks.

```
POST /api/p/assets/chunk?id=<id>&index=<i>&total=<n>&name=<file>&mode=library|temp
```

- Send raw bytes per chunk. `index` starts at 0.
- Each response says `done:false` until the last chunk. The last chunk returns `asset` and `video`.
- Single-request upload is capped at 40 MB. Chunk requests are capped at 30 MB.
- Chunk parts collect in `data/tmp/upload/<id>.part`, then move to `data/assets/` or `data/tmp/assets/`.
- A 413 from a tunnel means the request was too large. Use the UI (it chunks automatically) or split the file.

## Add by URL

`POST /api/p/assets/url` with `{url, mode, name?}`.

| mode | Result |
|---|---|
| `library` | Saves to `data/assets/`, ingests frames, appears in the library and index. |
| `temp` | Saves to `data/tmp/`, ingests frames, used by the next build only. Not in the library. |

Rules:

- Only `http` and `https`.
- Private hosts are rejected: localhost, 127., 10., 192.168., 172.16-31., 169.254., ::1.
- Max 200 MB. Timeout 120 s.
- The file name comes from the URL path unless `name` is given.
- A temp clip is still listed by `videoAssets()` with `temp: true`, so the planner can use it once. Delete `data/tmp/` to clear.

UI: paste a URL in the Assets card. `ADD TO LIBRARY` keeps it. `USE ONCE` fetches it for this build.

## Check a clip

```bash
node -e "import('./src/video.mjs').then(m=>console.log(m.ingestVideo('clip.mp4')))"
ffprobe -v error -show_entries format=duration -of csv=p=0 data/assets/clip.mp4
```
