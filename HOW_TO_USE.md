# How to use Custom Hyper

Custom Hyper turns one JSON file into an MP4. No browser. No FFmpeg command. No network at render time.

## What you can use today

| Version | Status | How you use it |
|---|---|---|
| **Custom Hyper Main** (agent) | Works | Tell opencode to make the video. It writes the JSON and renders. |
| **Custom Hyper Studio** (prototype portal) | Works | `HOST=0.0.0.0 node server.mjs`, then open the tunnel URL. One client, assets, boards, edit, MP4. See section 3. |
| **Custom Hyper Main Direct** (UI) | Works | Open `<tunnel-url>/direct`. Use your LLM key, or the local preview. |
| **Custom Hyper Lite** | Not built | Planned upload page. No API key. |

Use the demo first. It proves the engine works on this machine.

## 1. Render the demo

Run from `custom-hyper/`:

```bash
node src/cli.mjs check  specs/signal-16s.json
node src/cli.mjs stills specs/signal-16s.json --at 1,4,8,12,15
node src/cli.mjs render specs/signal-16s.json --scale 0.5
```

Results:

- Stills: `out/signal-16s-f*.png`
- Video: `out/signal-16s-540.mp4`
- Plan: `out/signal-16s.plan.json` if you run `plan`

Open the stills first. If a still looks wrong, fix the spec before rendering the video.

## 2. Make a video with an AI workspace

This works in OpenCode, ChatGPT workspaces, GitHub agents, or any shell-capable AI workspace. The agent is the author. The engine is the renderer.

1. Open a terminal in `/kaggle/working`.
2. Start your agent workspace.
3. Paste a prompt like this:

```text
Make a 12 second vertical video about <topic> with Custom Hyper.

Read these first:
- custom-hyper/AGENTS.md
- custom-hyper/docs/LIVING.md
- custom-hyper/docs/HYPERSPEC.md

Then:
1. Write the spec to custom-hyper/specs/<slug>.json.
2. Run check.
3. Render stills at 3 or 4 key times and inspect them.
4. Fix any layout, copy, or contrast problem. Re-render stills.
5. Render the MP4 at --scale 0.5 into custom-hyper/out/.
6. Report the file path, duration, size, and frame count.
7. Add a line to the session log in custom-hyper/docs/LIVING.md.

Do not use Chrome, HTML, CSS, or an external API at render time.
```

The agent will:

- Write one JSON spec.
- Validate it with `node src/cli.mjs check`.
- Render stills and look at them.
- Render the MP4.
- Update the living document.

Good output looks like:

```text
custom-hyper/out/<slug>-540.mp4
540x960, 30 fps, 360 frames, 12.000 s
```

### Review loop

Ask for changes in plain words:

```text
The headline is too small. Make it fill the width. Keep the same palette.
```

The agent edits the spec, re-renders stills, and shows you the result. The renderer is deterministic, so only spec changes alter the output.

### If the agent seems lost

Tell it:

```text
Read custom-hyper/docs/LIVING.md and continue from the first unchecked roadmap task. Do not rebuild finished work.
```

## 3. Custom Hyper Studio (prototype portal)

```bash
node server.mjs
# open http://127.0.0.1:8098/
```

Flow:

1. Pick a preset chip (`SOLAR`, `TRAVEL`, `DEVTOOLS`, `TOURISM`, `SCOOTER`). It fills the client and the brief.
2. Edit the client card if needed. Save.
3. Drop images or clips. They go to `data/assets/`. A clip is sampled to frames and a contact sheet in `data/video/<base>/`. Only the new asset is added to the page.
4. Click `INDEX ASSETS (VISION)` once. The key is saved, so you do not enter it again after a restart.
5. Write a brief. Pick seconds and format.
6. Click `GENERATE BOARDS` with a key, or `LOCAL PREVIEW / NO KEY`.
7. Boards appear as stills. Click `EDIT` to open the visual editor.
8. Drag an element to move it. Drag a corner to resize. Use the top handle to rotate. Double-click text to type.
9. Pick face, color, size, position, or lock in the inspector. Drag an asset onto a photo to swap it.
10. Click `PLAN` to rewrite one board with one LLM call. It uses the previous and next board. It does not touch other boards. `PLAN ALL` rebuilds from the saved plan. Locked elements survive.
11. If a contrast error appears, click `FIX CONTRAST`. It changes only the failing text colors.
12. Use `SPEC` or `CRACKDOWN` to export JSON. Click `RENDER MP4` to make the video.

Work is saved in `data/projects/<id>/`: `spec.json`, `meta.json`, `stills/`, `out/`.

The old Direct page still works at `/direct`.

### Remote access (Kaggle)

The browser runs on your machine, not in the container. `http://127.0.0.1:8098` will not open there. Run on all interfaces and expose the port:

```bash
# supervised server, restarts on crash
bash scripts/serve.sh

# or run once
HOST=0.0.0.0 PORT=8098 node server.mjs

# stable public URL (preferred)
curl -fsSL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x /tmp/cloudflared
/tmp/cloudflared tunnel --url http://127.0.0.1:8098 --no-autoupdate

# fallback, less stable
npx --yes localtunnel --port 8098
```

Cloudflared prints `https://<random>.trycloudflare.com`. Open that URL, or `<url>/direct`. Localtunnel prints `https://....loca.lt` and drops after a few minutes.

- If loca.lt asks for a password, use the container public IP: `curl -s https://api.ipify.org`.
- Run the server and the tunnel as persistent processes. If the shell command ends, both stop.
- `scripts/serve.sh` loops the server and logs every exit to `out/server.log`. Use it instead of a bare `node server.mjs`.
- Do not kill with `pkill -f "node server.mjs"` from inside a shell whose command line contains that text. It kills its own shell.
- The link is public. Anyone with it can open your client data and settings. Stop the tunnel when you are done.
- `HOST=0.0.0.0` alone is not enough on Kaggle. The tunnel is the reachable entry point.

## 4. Custom Hyper Main Direct (web UI)

This is the version for people who do not want to use a terminal.

```bash
HOST=0.0.0.0 PORT=8098 node server.mjs
npx --yes localtunnel --port 8098
# open the printed https://....loca.lt URL
```

Flow:

1. Open the page.
2. Paste a brief: topic, tone, duration, format.
3. Paste your LLM API key. It stays in browser memory for the session. Or click `LOCAL PREVIEW / NO KEY`.
4. Click Generate.
5. The server makes one compact LLM call and expands the result locally.
6. You see 3 preview stills.
7. Click Render. Download the MP4.

The LLM does not write every block. It writes a short beat plan. Local code expands that plan into the full HyperSpec. This keeps token use low and output quality high.

The server saves the key, provider, model, language, seconds, and format in `data/settings.json` (mode 0600). It does not log the key. The file is local and is not committed.

## 5. Custom Hyper Lite (planned upload)

Not built yet.

Planned flow:

1. Open the upload page.
2. Upload a HyperSpec JSON file and any images.
3. Click Render.
4. Download the MP4.

No LLM. No API key. Same compiler and renderer as Main.

## 6. Command reference

```bash
node src/cli.mjs check  <spec.json>
node src/cli.mjs plan   <spec.json>
node src/cli.mjs stills <spec.json> --at 1,4,8 [--scale 0.5] [--out DIR]
node src/cli.mjs render <spec.json> [--scale 0.5] [--out FILE]
node src/cli.mjs verify <spec.json> --at 1,4
```

- `check` validates and compiles. It does not render.
- `plan` writes the compiled X80 plan for debugging.
- `stills` renders PNG frames at the given seconds.
- `render` renders an MP4.
- `verify` renders the same stills in two child processes and compares SHA-256.

`--scale 0.5` halves the output size. Use it for fast review. Final renders can use scale 1.

## 7. Spec basics

Start from `specs/minimal-3s.json`. Copy it, then change:

- `canvas`: width, height, fps
- `duration`: seconds
- `palette`: colors
- `faces`: font families
- `layers`: each layer has `from`, `duration`, and `blocks`
- `chrome`: persistent header, rules, ticker, progress

Full field list: `docs/HYPERSPEC.md`.

Rules:

- Layers overlap in time. Do not make one layer per scene.
- Put persistent chrome in `chrome`, not in a layer.
- Use motion on most text and images. Static frames look like slides.
- Keep display text short. The block does not shrink text to fit.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `font cache missing` | Check `fonts/cache/` and the family name in the spec. |
| `asset not found` | Put the file in `assets/` and use a path relative to the spec. |
| Text is clipped | Reduce size, widen `w`, or move `x`. |
| Render is slow | Use `--scale 0.5` for review. Full 1080p is about 4x slower. |
| MP4 hashes differ | Expected. The H.264 encoder is multi-threaded. Frames are stable. |
| Stills differ | That is a real bug. Run `verify` and inspect fonts and assets. |
| Nothing at `127.0.0.1:8098` | The browser is outside the container. Bind `HOST=0.0.0.0`, keep the process alive, and open the tunnel URL. See section 3. The port is 8098, not 8998. |
| 413 on upload | The request body is too large for the tunnel. The UI chunks files over 40 MB automatically. Do not POST a huge file as one body. |
| AVIF upload is rejected | AVIF crashes the Skia renderer and this build has no AVIF decoder. Export PNG, JPG or WEBP. |
| CSS blocked, bad MIME type | The devtunnel (`*.devtunnels.ms`) sends `/public/editor.css` to a GitHub auth page (302). Use the cloudflared URL, not the devtunnel. |
| `PLAN` says "no concrete visual" | The LLM returned an empty visual. Add the concrete subject to the brief and retry, or edit the board text and render again. |

## 9. Where to change things

| Want to change | File |
|---|---|
| Colors, copy, layout | the spec JSON |
| New block type | `src/blocks.mjs` |
| Mechanics (year wheel, odometer, receipt, camera) | `src/mechanics.mjs`, `docs/MECHANICS.md` |
| Reel-vs-slideshow score | `src/slideshow-lint.mjs` |
| Easing or motion | `src/motion.mjs`, `src/ease.mjs` |
| Transitions, chrome, scale | `src/compile.mjs` |
| Fonts, assets, encode | `src/render.mjs` |
| Commands | `src/cli.mjs` |
| Product names | `docs/NAMING.md` |
| Status and roadmap | `docs/LIVING.md` |

After any change, update `docs/LIVING.md`. That file is the handoff if access is lost.
