# Asset generation pipeline

## Contract

The manifest is the single source of truth between creative planning, image generation, validation, and Custom Hyper rendering. Generate only assets named in the manifest. Never ask an image model for a contact sheet, collage, storyboard, or multi-asset board.

## Sequence

1. Lock the script and scene timings.
2. Create or update `assets/manifests/<project>.json`.
3. Generate the character master once. Keep its reference path stable.
4. Generate each character pose separately, passing the master as the reference image.
5. Generate each background separately at the exact target aspect ratio.
6. Generate each transparent overlay or prop separately.
7. Acquire official brand files from an approved official source; never synthesize logos.
8. Run `node scripts/validate-assets.mjs assets/manifests/<project>.json`.
9. Generate only missing or failed assets. Do not regenerate assets that pass validation.
10. Build the HyperSpec using the manifest's scene mappings.

## Manifest rules

Every asset declares a stable ID, exact path, type, format, dimensions, alpha requirement, prompt/reference, and scene/time/animation mapping. Character assets point to one shared character bible. The renderer consumes file paths, not asset boards.

## Generation rules

- One requested asset per generation call.
- No contact sheets, collage layouts, storyboards, labels, captions, filenames, watermarks, or embedded copy.
- Backgrounds are full-frame and contain no lead character.
- Characters and foreground props are transparent cutouts.
- Every character pose uses the same master reference and invariant description.
- Motion overlays are generated independently from scene art.
- Brand logos are sourced, not generated.

## Validation and retries

The validator checks file signatures, dimensions, alpha-channel requirements, duplicate bytes, required metadata, prompts, and scene mappings. Missing files are reported as pending, not silently substituted. Regenerate only the failed asset. Routine validation is deterministic and does not require a vision model.

## Commands

```bash
node scripts/validate-assets.mjs assets/manifests/spotify-every-mood.json
```

A manifest with pending assets is expected to report warnings until generation and official brand-file acquisition are complete. Warnings are not treated as successful asset delivery.
